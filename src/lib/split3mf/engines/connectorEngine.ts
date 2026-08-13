import * as THREE from "three";
import { buildAdjacency } from "../segmentation/colorCluster";
import type { ConnectorType } from "../state/splitTypes";
export type { ConnectorType };

export interface ConnectorPlacement {
  /** World-space anchor point on the boundary between two regions. */
  point: THREE.Vector3;
  /** Unit direction the connector points along (out of the plug piece). */
  direction: THREE.Vector3;
  /** Unit up vector (perpendicular to direction) orienting the cross-section. */
  up: THREE.Vector3;
  /** Cross-section area of the connector (mm²). */
  area: number;
  /** Depth of the connector (mm). */
  depth: number;
  /** Tolerance applied to the socket (mm) — socket is slightly larger. */
  toleranceMm: number;
  regionA: number;
  regionB: number;
}

export interface BoundaryEdge {
  a: number;
  b: number;
  midpoint: THREE.Vector3;
  normal: THREE.Vector3;
  regionA: number;
  regionB: number;
}

export interface ConnectorPlanOptions {
  type: ConnectorType;
  areaPercent: number; // 1-20
  depthMm: number;
  socketToleranceMm: number;
  side: "part_plug" | "body_plug";
  manualPositions?: { regionA: number; regionB: number; point: THREE.Vector3 }[];
}

/**
 * Traces boundary edges between two region masks using an indexed triangle
 * list, returning the midpoint+normal of each boundary edge.
 */
export function findBoundaryEdges(
  positions: Float32Array,
  indices: number[] | Uint32Array | Uint16Array | Uint8Array,
  regionMask: Uint8Array
): BoundaryEdge[] {
  const edges: BoundaryEdge[] = [];
  const byGeometryEdge = new Map<string, typeof edges>();
  const faceCount = Math.floor(indices.length / 3);
  for (let f = 0; f < faceCount; f++) {
    const i0 = indices[f * 3];
    const i1 = indices[f * 3 + 1];
    const i2 = indices[f * 3 + 2];
    const faceNormal = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3(positions[i1 * 3] - positions[i0 * 3], positions[i1 * 3 + 1] - positions[i0 * 3 + 1], positions[i1 * 3 + 2] - positions[i0 * 3 + 2]),
        new THREE.Vector3(positions[i2 * 3] - positions[i0 * 3], positions[i2 * 3 + 1] - positions[i0 * 3 + 1], positions[i2 * 3 + 2] - positions[i0 * 3 + 2])
      )
      .normalize();
    const faceRegion = dominantRegion(regionMask[i0], regionMask[i1], regionMask[i2]);
    const pairs: [number, number][] = [[i0, i1], [i1, i2], [i2, i0]];
    for (const [x, y] of pairs) {
      const regionX = regionMask[x];
      const regionY = regionMask[y];
      if (regionX === 0 || regionY === 0) continue;
      const ax = positions[x * 3], ay = positions[x * 3 + 1], az = positions[x * 3 + 2];
      const bx = positions[y * 3], by = positions[y * 3 + 1], bz = positions[y * 3 + 2];
      const mid = new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      const n = faceNormal.lengthSq() > 1e-10 ? faceNormal : new THREE.Vector3(bx - ax, by - ay, bz - az).normalize();
      const directBoundary = regionX !== regionY ? [{ a: x, b: y, midpoint: mid, normal: n, regionA: regionX, regionB: regionY }] : [];
      const key = [pointKey(ax, ay, az), pointKey(bx, by, bz)].sort().join("|");
      const candidates = byGeometryEdge.get(key) ?? [];
      candidates.push(...directBoundary);
      if (faceRegion !== 0) candidates.push({ a: x, b: y, midpoint: mid, normal: n, regionA: faceRegion, regionB: faceRegion });
      byGeometryEdge.set(key, candidates);
    }
  }

  for (const candidates of byGeometryEdge.values()) {
    const regions = Array.from(
      new Set(candidates.flatMap((e) => [e.regionA, e.regionB]).filter((id) => id !== 0))
    );
    if (regions.length < 2) continue;
    const first = candidates.find((e) => e.regionA === regions[0])!;
    for (const regionB of regions.slice(1)) {
      edges.push({ ...first, regionB });
    }
  }
  return edges;
}

function dominantRegion(a: number, b: number, c: number): number {
  if (a === b || a === c) return a;
  if (b === c) return b;
  return a || b || c;
}

function pointKey(x: number, y: number, z: number): string {
  return `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
}

/**
 * Distributes `count` connector placements evenly along the boundary edges.
 * Returns up to `count` placements (fewer if the boundary is short).
 */
export function planConnectorPlacements(
  boundaryEdges: BoundaryEdge[],
  count: number,
  options: ConnectorPlanOptions
): ConnectorPlacement[] {
  if (boundaryEdges.length === 0 || count <= 0 || options.type === "none") return [];
  const clampedCount = Math.min(count, boundaryEdges.length);

  // Fallback: place connectors at evenly spaced boundary-edge midpoints.
  const midpoints = boundaryEdges.map((e) => e.midpoint);
  const placements: ConnectorPlacement[] = [];

  const area = connectorArea(options.areaPercent, options.type, boundaryEdges);

  if (options.manualPositions?.length) {
    return options.manualPositions.flatMap((manual) => {
      const candidate = boundaryEdges
        .filter((edge) => sameRegionPair(edge, manual.regionA, manual.regionB))
        .sort((a, b) => a.midpoint.distanceToSquared(manual.point) - b.midpoint.distanceToSquared(manual.point))[0];
      if (!candidate) return [];
      return [{
        point: manual.point.clone(),
        direction: candidate.normal.clone(),
        up: new THREE.Vector3(0, 1, 0),
        area,
        depth: options.depthMm,
        toleranceMm: options.socketToleranceMm,
        regionA: manual.regionA,
        regionB: manual.regionB,
      }];
    });
  }

  for (let k = 0; k < clampedCount; k++) {
    const idx = Math.round((k / Math.max(clampedCount - 1, 1)) * (midpoints.length - 1));
    const p = midpoints[idx].clone();
    placements.push({
      point: p,
      direction: boundaryEdges[idx].normal.clone(),
      up: new THREE.Vector3(0, 1, 0),
      area,
      depth: options.depthMm,
      toleranceMm: options.socketToleranceMm,
        regionA: boundaryEdges[idx].regionA,
        regionB: boundaryEdges[idx].regionB,
    });
  }
  return placements;
}

function sameRegionPair(edge: BoundaryEdge, regionA: number, regionB: number): boolean {
  return (edge.regionA === regionA && edge.regionB === regionB) || (edge.regionA === regionB && edge.regionB === regionA);
}

/**
 * Cross-section area (mm²) for a rectangular connector given areaPercent
 * (1-20% of the piece's plan area). Uses a circular-area formula so the
 * connector is comparable across shapes.
 */
export function connectorArea(areaPercent: number, type: ConnectorType, boundaryEdges: unknown[]): number {
  const pct = Math.max(1, Math.min(20, areaPercent));
  const reference = Math.max(1, boundaryEdges.length);
  void type;
  return (pct / 100) * reference * reference * 0.5;
}

/**
 * Builds the connector prism geometry (x/y = cross-section plane, z = depth
 * axis). Returns an indexed BufferGeometry. The prism is centered at origin;
 * the caller translates/rotates it via the placement matrix.
 */
export function buildConnectorPrimitive(
  type: ConnectorType,
  area: number,
  depth: number
): THREE.BufferGeometry {
  if (type === "none" || depth <= 0) {
    const empty = new THREE.BufferGeometry();
    empty.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    return empty;
  }
  const geo = new THREE.BufferGeometry();
  if (type === "cylinder") {
    const r = Math.sqrt(area / Math.PI);
    const segments = 16;
    const positions: number[] = [];
    const indices: number[] = [];
    const half = depth / 2;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(angle) * r, Math.sin(angle) * r, -half);
    }
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(angle) * r, Math.sin(angle) * r, half);
    }
    const ringBottom = 0;
    const ringTop = segments;
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      // bottom face
      indices.push(ringBottom + i, ringBottom + next, ringTop + i);
      // top face
      indices.push(ringTop + i, ringTop + next, ringBottom + i);
      // side quads
      indices.push(ringBottom + i, ringBottom + next, ringTop + next);
      indices.push(ringBottom + i, ringTop + next, ringTop + i);
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
  } else if (type === "rectangular_prism") {
    const s = Math.sqrt(area);
    const half = depth / 2;
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -s / 2, -s / 2, -half,  s / 2, -s / 2, -half,  s / 2,  s / 2, -half, -s / 2,  s / 2, -half,
          -s / 2, -s / 2,  half,  s / 2, -s / 2,  half,  s / 2,  s / 2,  half, -s / 2,  s / 2,  half,
        ],
        3
      )
    );
    geo.setIndex([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      1, 2, 6, 1, 6, 5,
      2, 3, 7, 2, 7, 6,
      3, 0, 4, 3, 4, 7,
    ]);
  } else if (type === "triangular_prism") {
    const s = Math.sqrt((area * 4) / Math.sqrt(3)); // equilateral side
    const h = (s * Math.sqrt(3)) / 2;
    const half = depth / 2;
    const baseY = -h / 3;
    const topY = (h * 2) / 3;
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          0, topY, -half,  -s / 2, baseY, -half,  s / 2, baseY, -half,
          0, topY, half,  -s / 2, baseY, half,  s / 2, baseY, half,
        ],
        3
      )
    );
    geo.setIndex([
      0, 1, 2, 3, 5, 4,
      0, 1, 4, 0, 4, 3,
      1, 2, 5, 1, 5, 4,
      2, 0, 3, 2, 3, 5,
    ]);
  } else {
    return new THREE.BufferGeometry();
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

/**
 * Creates a placement matrix: origin at `point`, +Z along `direction`,
 * up-axis approximated from `up`.
 */
export function placementMatrix(p: ConnectorPlacement): THREE.Matrix4 {
  const z = p.direction.clone().normalize();
  let x = new THREE.Vector3().crossVectors(p.up, z);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(p.point);
}

/** Unit end-cap cross-section area for the given type. */
export function capBaseRadius(type: ConnectorType, area: number): number {
  if (type === "cylinder") return Math.sqrt(area / Math.PI);
  if (type === "rectangular_prism") return Math.sqrt(area) / 2;
  return Math.sqrt((area * 4) / Math.sqrt(3)) * 0.5;
}

export function faceNormal(g: THREE.BufferGeometry, face: number): THREE.Vector3 {
  const idx = g.index;
  const pos = g.attributes.position;
  if (!idx || !pos) return new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(face * 3));
  const b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(face * 3 + 1));
  const c = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(face * 3 + 2));
  return new THREE.Vector3().crossVectors(b.sub(a), c.sub(a)).normalize();
}

export function totalBoundaryLength(boundaryEdges: { a: number; b: number; midpoint: THREE.Vector3 }[], positions: Float32Array): number {
  return boundaryEdges.reduce((sum, e) => {
    const ax = positions[e.a * 3], ay = positions[e.a * 3 + 1], az = positions[e.a * 3 + 2];
    const bx = positions[e.b * 3], by = positions[e.b * 3 + 1], bz = positions[e.b * 3 + 2];
    return sum + Math.hypot(ax - bx, ay - by, az - bz);
  }, 0);
}

export { buildAdjacency };
