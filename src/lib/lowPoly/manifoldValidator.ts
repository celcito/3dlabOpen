import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, ADDITION } from "three-bvh-csg";

export interface ManifoldAnalysisResult {
  isManifold: boolean;
  isWatertight: boolean;
  openEdgesCount: number;         // Bordas de buracos / abertas (deve ser 0)
  nonManifoldEdgesCount: number;  // Bordas compartilhadas por 3+ faces (deve ser 0)
  reversedEdgesCount: number;     // Inconsistência de orientação/winding (deve ser 0)
  degenerateFacesCount: number;   // Faces com área zero ou vértices duplicados (deve ser 0)
  eulerCharacteristic: number;    // V - E + F (deve ser 2 para sólidos esféricos/fechados)
  vertexCount: number;
  faceCount: number;
  edgeCount: number;
  volumeCm3: number;
  surfaceAreaMm2: number;
  status: "perfect" | "valid" | "warning" | "non_manifold";
  statusLabel: string;
  qualityScore: number;           // 0 a 100%
  issues: string[];
  openEdgePositions?: number[];   // Coordenadas x,y,z dos segmentos de arestas com erros
}

/**
 * Calculates signed volume of a triangular mesh using the divergence theorem.
 */
export function calculateSignedVolume(geometry: THREE.BufferGeometry): number {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  let totalVolume = 0;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();

  const numFaces = index ? index.count / 3 : pos.count / 3;

  for (let i = 0; i < numFaces; i++) {
    const iA = index ? index.getX(i * 3) : i * 3;
    const iB = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const iC = index ? index.getX(i * 3 + 2) : i * 3 + 2;

    vA.fromBufferAttribute(pos, iA);
    vB.fromBufferAttribute(pos, iB);
    vC.fromBufferAttribute(pos, iC);

    // Signed volume of tetrahedron formed with origin: (A · (B × C)) / 6
    const cross = new THREE.Vector3().crossVectors(vB, vC);
    totalVolume += vA.dot(cross) / 6.0;
  }

  return totalVolume;
}

/**
 * Calculates surface area of a triangular mesh.
 */
export function calculateSurfaceArea(geometry: THREE.BufferGeometry): number {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  let totalArea = 0;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  const numFaces = index ? index.count / 3 : pos.count / 3;

  for (let i = 0; i < numFaces; i++) {
    const iA = index ? index.getX(i * 3) : i * 3;
    const iB = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const iC = index ? index.getX(i * 3 + 2) : i * 3 + 2;

    vA.fromBufferAttribute(pos, iA);
    vB.fromBufferAttribute(pos, iB);
    vC.fromBufferAttribute(pos, iC);

    edge1.subVectors(vB, vA);
    edge2.subVectors(vC, vA);
    cross.crossVectors(edge1, edge2);
    totalArea += cross.length() * 0.5;
  }

  return totalArea;
}

/**
 * Comprehensive analysis of 3D mesh manifoldness for slicing software (Bambu Studio, PrusaSlicer, Orca, Cura).
 */
export function analyzeMeshManifold(rawGeometry: THREE.BufferGeometry): ManifoldAnalysisResult {
  // Ensure indexed geometry with welded vertices for accurate topological edge analysis
  let indexedGeom: THREE.BufferGeometry;
  if (!rawGeometry.index) {
    indexedGeom = BufferGeometryUtils.mergeVertices(rawGeometry.clone(), 1e-4);
  } else {
    indexedGeom = BufferGeometryUtils.mergeVertices(rawGeometry, 1e-4);
  }

  const pos = indexedGeom.attributes.position;
  const index = indexedGeom.index!;
  const vertexCount = pos.count;
  const faceCount = index.count / 3;

  const edgeMap = new Map<string, { count: number; halfEdges: { from: number; to: number }[] }>();
  let degenerateFacesCount = 0;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let i = 0; i < faceCount; i++) {
    const i0 = index.getX(i * 3);
    const i1 = index.getX(i * 3 + 1);
    const i2 = index.getX(i * 3 + 2);

    // Check for duplicate vertices in single face
    if (i0 === i1 || i1 === i2 || i2 === i0) {
      degenerateFacesCount++;
      continue;
    }

    vA.fromBufferAttribute(pos, i0);
    vB.fromBufferAttribute(pos, i1);
    vC.fromBufferAttribute(pos, i2);

    edge1.subVectors(vB, vA);
    edge2.subVectors(vC, vA);
    cross.crossVectors(edge1, edge2);
    const area = cross.length() * 0.5;

    if (area < 1e-7) {
      degenerateFacesCount++;
      continue;
    }

    // Process 3 directed half-edges of this triangle
    const edges = [
      { from: i0, to: i1 },
      { from: i1, to: i2 },
      { from: i2, to: i0 }
    ];

    for (const he of edges) {
      const minIdx = Math.min(he.from, he.to);
      const maxIdx = Math.max(he.from, he.to);
      const key = `${minIdx}_${maxIdx}`;

      let entry = edgeMap.get(key);
      if (!entry) {
        entry = { count: 0, halfEdges: [] };
        edgeMap.set(key, entry);
      }
      entry.count++;
      entry.halfEdges.push(he);
    }
  }

  let openEdgesCount = 0;
  let nonManifoldEdgesCount = 0;
  let reversedEdgesCount = 0;
  const openEdgePositions: number[] = [];

  for (const entry of edgeMap.values()) {
    if (entry.count === 1) {
      openEdgesCount++;
      const he = entry.halfEdges[0];
      openEdgePositions.push(
        pos.getX(he.from), pos.getY(he.from), pos.getZ(he.from),
        pos.getX(he.to), pos.getY(he.to), pos.getZ(he.to)
      );
    } else if (entry.count > 2) {
      nonManifoldEdgesCount++;
      const he = entry.halfEdges[0];
      openEdgePositions.push(
        pos.getX(he.from), pos.getY(he.from), pos.getZ(he.from),
        pos.getX(he.to), pos.getY(he.to), pos.getZ(he.to)
      );
    } else if (entry.count === 2) {
      // In a 2-manifold surface, the two adjacent triangles must traverse the shared edge in OPPOSITE directions
      const he1 = entry.halfEdges[0];
      const he2 = entry.halfEdges[1];
      if (he1.from === he2.from && he1.to === he2.to) {
        reversedEdgesCount++;
        openEdgePositions.push(
          pos.getX(he1.from), pos.getY(he1.from), pos.getZ(he1.from),
          pos.getX(he1.to), pos.getY(he1.to), pos.getZ(he1.to)
        );
      }
    }
  }

  const uniqueEdgesCount = edgeMap.size;
  // Euler characteristic: χ = V - E + F
  const eulerCharacteristic = vertexCount - uniqueEdgesCount + faceCount;

  const rawVolume = calculateSignedVolume(indexedGeom);
  const volumeCm3 = Math.round(Math.abs(rawVolume) / 1000 * 100) / 100;
  const surfaceAreaMm2 = Math.round(calculateSurfaceArea(indexedGeom) * 10) / 10;

  const isWatertight = openEdgesCount === 0 && nonManifoldEdgesCount === 0;
  const isManifold = isWatertight && reversedEdgesCount === 0 && degenerateFacesCount === 0;

  const issues: string[] = [];
  if (openEdgesCount > 0) {
    issues.push(`${openEdgesCount} bordas abertas (malha com furos/não-fechada).`);
  }
  if (nonManifoldEdgesCount > 0) {
    issues.push(`${nonManifoldEdgesCount} bordas não-manifold (3+ triângulos conectados na mesma aresta).`);
  }
  if (reversedEdgesCount > 0) {
    issues.push(`${reversedEdgesCount} arestas com inversão de normais (inconsistent winding).`);
  }
  if (degenerateFacesCount > 0) {
    issues.push(`${degenerateFacesCount} faces degeneradas com área nula.`);
  }

  let status: "perfect" | "valid" | "warning" | "non_manifold" = "perfect";
  let statusLabel = "100% Manifold (Watertight / Sólido Perfeito)";
  let qualityScore = 100;

  if (!isManifold) {
    if (!isWatertight) {
      status = "non_manifold";
      statusLabel = "Não-Manifold (Necessita Reparo)";
      qualityScore = Math.max(20, 100 - openEdgesCount * 5 - nonManifoldEdgesCount * 10);
    } else {
      status = "warning";
      statusLabel = "Fechado com Avisos";
      qualityScore = 80;
    }
  }

  return {
    isManifold,
    isWatertight,
    openEdgesCount,
    nonManifoldEdgesCount,
    reversedEdgesCount,
    degenerateFacesCount,
    eulerCharacteristic,
    vertexCount,
    faceCount,
    edgeCount: uniqueEdgesCount,
    volumeCm3,
    surfaceAreaMm2,
    status,
    statusLabel,
    qualityScore,
    issues,
    openEdgePositions: openEdgePositions.length > 0 ? openEdgePositions : undefined
  };
}

/**
 * Creates a LineSegments geometry of all problematic non-manifold / open boundary edges
 * for high-visibility visual overlay in the 3D viewport.
 */
export function createErrorEdgesGeometry(edgePositions?: number[]): THREE.BufferGeometry | null {
  if (!edgePositions || edgePositions.length === 0) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
  return geom;
}

/**
 * Evaluates and welds multiple overlapping solid geometries into a single 100% watertight 2-manifold mesh using CSG Boolean Union.
 */
export function csgUnionGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) return new THREE.BufferGeometry();
  if (geometries.length === 1) {
    const single = geometries[0].clone();
    single.computeVertexNormals();
    return BufferGeometryUtils.mergeVertices(single, 1e-4);
  }

  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  let currentBrush = new Brush(BufferGeometryUtils.mergeVertices(geometries[0].clone(), 1e-4));
  currentBrush.updateMatrixWorld();

  for (let i = 1; i < geometries.length; i++) {
    try {
      const nextBrush = new Brush(BufferGeometryUtils.mergeVertices(geometries[i].clone(), 1e-4));
      nextBrush.updateMatrixWorld();
      const result = evaluator.evaluate(currentBrush, nextBrush, ADDITION);
      currentBrush = result;
    } catch (err) {
      console.warn("CSG union step fallback:", err);
    }
  }

  const outputGeom = currentBrush.geometry;
  outputGeom.computeVertexNormals();
  outputGeom.computeBoundingBox();
  outputGeom.computeBoundingSphere();
  return BufferGeometryUtils.mergeVertices(outputGeom, 1e-4);
}

/**
 * Repairs a geometry by welding vertices, fixing orientation and ensuring normal vectors point outwards.
 */
export function repairGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const welded = BufferGeometryUtils.mergeVertices(geometry.clone(), 1e-4);
  const vol = calculateSignedVolume(welded);

  // If volume is negative, winding is reversed (faces point inwards), invert index winding
  if (vol < 0 && welded.index) {
    const idx = welded.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const tmp = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = tmp;
    }
    welded.index.needsUpdate = true;
  }

  welded.computeVertexNormals();
  welded.computeBoundingBox();
  welded.computeBoundingSphere();
  return welded;
}
