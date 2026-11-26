import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";
import { repairGeometry } from "./manifoldValidator";

export interface LoadedMeshInfo {
  geometry: THREE.BufferGeometry;
  fileName: string;
  originalFaceCount: number;
  originalVertexCount: number;
  fileSizeBytes: number;
  format: "stl" | "obj" | "ply" | "gltf" | "glb" | "unknown";
  boundingBoxSize: THREE.Vector3;
}

export interface DecimationOptions {
  mode?: "triangles" | "percentage";
  targetTriangles?: number; // exact target number of triangles (e.g. 50 to 5000)
  reductionPercent?: number; // 10 to 98%
  algorithm: "qem" | "voxel_grid" | "faceted_planar";
  gridResolution?: number;  // 10 to 90 for voxel_grid
  jitter?: number;          // 0 to 4
  fastPreview?: boolean;    // skip heavy repair during live slider dragging
}

export interface DecimationResult {
  geometry: THREE.BufferGeometry;
  originalFaceCount: number;
  decimatedFaceCount: number;
  originalVertexCount: number;
  decimatedVertexCount: number;
  reductionRatio: number; // e.g. 0.94 -> 94%
  processingTimeMs: number;
  targetTrianglesRequested?: number;
}

/**
 * Loads any 3D file format (STL, OBJ, PLY, GLTF/GLB) and extracts a single unified BufferGeometry.
 */
export async function load3DModelFile(file: File): Promise<LoadedMeshInfo> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const arrayBuffer = await file.arrayBuffer();
  let geometry: THREE.BufferGeometry | null = null;

  if (extension === "stl") {
    const loader = new STLLoader();
    geometry = loader.parse(arrayBuffer);
  } else if (extension === "ply") {
    const loader = new PLYLoader();
    geometry = loader.parse(arrayBuffer);
  } else if (extension === "obj") {
    const text = new TextDecoder().decode(arrayBuffer);
    const loader = new OBJLoader();
    const obj = loader.parse(text);
    geometry = extractMergedGeometryFromObject3D(obj);
  } else if (extension === "gltf" || extension === "glb") {
    const loader = new GLTFLoader();
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.parse(arrayBuffer, "", resolve, reject);
    });
    geometry = extractMergedGeometryFromObject3D(gltf.scene || gltf.scenes?.[0]);
  } else {
    throw new Error(`Formato .${extension} não suportado. Por favor use .stl, .obj, .ply ou .glb/.gltf`);
  }

  if (!geometry || !geometry.attributes.position || geometry.attributes.position.count === 0) {
    throw new Error("Não foi possível extrair geometria válida do arquivo 3D importado.");
  }

  // Ensure index or weld vertices
  let indexedGeom: THREE.BufferGeometry;
  if (!geometry.index) {
    indexedGeom = BufferGeometryUtils.mergeVertices(geometry, 1e-4);
  } else {
    indexedGeom = geometry;
  }

  indexedGeom.computeVertexNormals();
  indexedGeom.computeBoundingBox();
  indexedGeom.computeBoundingSphere();

  const box = indexedGeom.boundingBox || new THREE.Box3();
  const size = new THREE.Vector3();
  box.getSize(size);

  const posCount = indexedGeom.attributes.position.count;
  const faceCount = indexedGeom.index ? indexedGeom.index.count / 3 : posCount / 3;

  return {
    geometry: indexedGeom,
    fileName: file.name,
    originalFaceCount: Math.round(faceCount),
    originalVertexCount: posCount,
    fileSizeBytes: file.size,
    format: (["stl", "obj", "ply", "gltf", "glb"].includes(extension) ? extension : "unknown") as any,
    boundingBoxSize: size
  };
}

/**
 * Extracts and merges all mesh geometries from a Three.js Object3D hierarchy.
 */
function extractMergedGeometryFromObject3D(root: THREE.Object3D): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  root.updateMatrixWorld(true);

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        const cloned = mesh.geometry.clone();
        cloned.applyMatrix4(mesh.matrixWorld);
        if (!cloned.attributes.normal) cloned.computeVertexNormals();
        geometries.push(cloned);
      }
    }
  });

  if (geometries.length === 0) {
    throw new Error("Nenhuma malha 3D encontrada na hierarquia do arquivo.");
  }

  if (geometries.length === 1) {
    return BufferGeometryUtils.mergeVertices(geometries[0], 1e-4);
  }

  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  return BufferGeometryUtils.mergeVertices(merged, 1e-4);
}

/**
 * Decimates and transforms any 3D model into an iconic faceted Low-Poly geometry
 * with real-time target triangle count control.
 */
export function decimateToLowPoly(
  sourceGeometry: THREE.BufferGeometry,
  options: DecimationOptions
): DecimationResult {
  const startTime = performance.now();

  let workingGeom = BufferGeometryUtils.mergeVertices(sourceGeometry.clone(), 1e-4);
  const origPosCount = workingGeom.attributes.position.count;
  const origFaceCount = workingGeom.index ? workingGeom.index.count / 3 : origPosCount / 3;

  // Determine effective target triangle count & reduction ratio
  let targetFaces: number;
  let reductionRatio: number;

  if (options.mode === "triangles" && options.targetTriangles !== undefined) {
    targetFaces = Math.max(12, Math.min(origFaceCount, options.targetTriangles));
    reductionRatio = origFaceCount > 0 ? Math.max(0.01, 1 - (targetFaces / origFaceCount)) : 0.9;
  } else {
    reductionRatio = Math.min(0.99, Math.max(0.02, (options.reductionPercent || 85) / 100));
    targetFaces = Math.max(12, Math.round(origFaceCount * (1 - reductionRatio)));
  }

  let decimatedGeom: THREE.BufferGeometry;

  if (options.algorithm === "voxel_grid") {
    // Calculate optimal grid resolution to match the requested target triangle count
    const targetGridRes = options.gridResolution || estimateGridResolutionForTriangles(targetFaces);
    decimatedGeom = clusterGridDecimation(workingGeom, targetGridRes);
  } else if (options.algorithm === "qem") {
    // Quadric Edge Collapse via SimplifyModifier
    try {
      const modifier = new SimplifyModifier();
      const currentVerts = workingGeom.attributes.position.count;
      // In a 2-manifold triangle mesh, F ≈ 2V, so target vertices ≈ targetFaces / 2
      const targetVerts = Math.max(8, Math.min(currentVerts, Math.round(targetFaces * 0.55)));
      decimatedGeom = modifier.modify(workingGeom, targetVerts);
    } catch (err) {
      console.warn("SimplifyModifier fallback to grid decimation:", err);
      const gridRes = estimateGridResolutionForTriangles(targetFaces);
      decimatedGeom = clusterGridDecimation(workingGeom, gridRes);
    }
  } else {
    const gridRes = estimateGridResolutionForTriangles(targetFaces);
    decimatedGeom = clusterGridDecimation(workingGeom, gridRes);
  }

  // Apply crystal facet jitter if requested
  if (options.jitter && options.jitter > 0) {
    applyFacetJitter(decimatedGeom, options.jitter * 0.4);
  }

  // Convert to non-indexed faceted flat geometry so every triangle has independent crisp flat normal
  let flatGeom = decimatedGeom.toNonIndexed();
  flatGeom.computeVertexNormals();

  // Re-weld close vertices to maintain manifold topology
  flatGeom = BufferGeometryUtils.mergeVertices(flatGeom, 1e-3);
  
  if (!options.fastPreview) {
    flatGeom = repairGeometry(flatGeom);
  }

  const finalPosCount = flatGeom.attributes.position.count;
  const finalFaceCount = flatGeom.index ? flatGeom.index.count / 3 : finalPosCount / 3;

  const endTime = performance.now();

  return {
    geometry: flatGeom,
    originalFaceCount: Math.round(origFaceCount),
    decimatedFaceCount: Math.round(finalFaceCount),
    originalVertexCount: origPosCount,
    decimatedVertexCount: finalPosCount,
    reductionRatio: origFaceCount > 0 ? Math.max(0, (origFaceCount - finalFaceCount) / origFaceCount) : 0,
    processingTimeMs: Math.round(endTime - startTime),
    targetTrianglesRequested: targetFaces
  };
}

/**
 * Calculates approximately what spatial grid resolution produces ~targetTriangles faces.
 */
function estimateGridResolutionForTriangles(targetTriangles: number): number {
  // Approximate empirical relationship for 3D bounded surfaces:
  // Surface triangles ≈ c * R^2 to R^2.5
  const estimated = Math.round(Math.pow(targetTriangles, 0.46) * 2.1);
  return Math.max(8, Math.min(95, estimated));
}

/**
 * Grid-based Spatial Vertex Clustering decimation algorithm.
 * Groups vertices inside spatial grid cubes into single centroids, eliminating internal redundant triangles.
 */
function clusterGridDecimation(geometry: THREE.BufferGeometry, gridResolution: number): THREE.BufferGeometry {
  const merged = BufferGeometryUtils.mergeVertices(geometry.clone(), 1e-4);
  merged.computeBoundingBox();
  const box = merged.boundingBox || new THREE.Box3();
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const cellSize = maxDim / Math.max(6, gridResolution);

  const pos = merged.attributes.position;
  const index = merged.index;
  const vertCount = pos.count;

  // Map 3D grid cell key -> { sum: Vector3, count: number, newIndex: number }
  const cellMap = new Map<string, { sum: THREE.Vector3; count: number; newIndex: number }>();
  const vertToNewIdx: number[] = new Array(vertCount);

  const p = new THREE.Vector3();
  let uniqueVertCount = 0;

  for (let i = 0; i < vertCount; i++) {
    p.fromBufferAttribute(pos, i);
    const gx = Math.floor((p.x - box.min.x) / cellSize);
    const gy = Math.floor((p.y - box.min.y) / cellSize);
    const gz = Math.floor((p.z - box.min.z) / cellSize);
    const key = `${gx}_${gy}_${gz}`;

    let cell = cellMap.get(key);
    if (!cell) {
      cell = { sum: new THREE.Vector3(0, 0, 0), count: 0, newIndex: uniqueVertCount++ };
      cellMap.set(key, cell);
    }
    cell.sum.add(p);
    cell.count++;
    vertToNewIdx[i] = cell.newIndex;
  }

  // Create new collapsed vertex positions
  const newPositions = new Float32Array(uniqueVertCount * 3);
  for (const cell of cellMap.values()) {
    const avg = cell.sum.divideScalar(cell.count);
    newPositions[cell.newIndex * 3] = avg.x;
    newPositions[cell.newIndex * 3 + 1] = avg.y;
    newPositions[cell.newIndex * 3 + 2] = avg.z;
  }

  // Re-map triangles and discard collapsed degenerate triangles
  const newIndices: number[] = [];
  const faceCount = index ? index.count / 3 : vertCount / 3;

  for (let i = 0; i < faceCount; i++) {
    const i0 = index ? index.getX(i * 3) : i * 3;
    const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;

    const n0 = vertToNewIdx[i0];
    const n1 = vertToNewIdx[i1];
    const n2 = vertToNewIdx[i2];

    // If 2 or 3 vertices collapsed to the same cell, the triangle is discarded
    if (n0 !== n1 && n1 !== n2 && n2 !== n0) {
      newIndices.push(n0, n1, n2);
    }
  }

  const outGeom = new THREE.BufferGeometry();
  outGeom.setAttribute("position", new THREE.BufferAttribute(newPositions, 3));
  outGeom.setIndex(newIndices);
  outGeom.computeVertexNormals();
  outGeom.computeBoundingBox();
  outGeom.computeBoundingSphere();

  return BufferGeometryUtils.mergeVertices(outGeom, 1e-4);
}

/**
 * Displaces vertices slightly along their normals to enhance the faceted crystal look.
 */
function applyFacetJitter(geometry: THREE.BufferGeometry, amount: number) {
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const noise = Math.sin(v.x * 12.3 + v.y * 34.5 + v.z * 56.7) * amount;
    v.x += noise;
    v.y += noise * 0.8;
    v.z += noise;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}
