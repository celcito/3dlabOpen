import { buildAdjacency, type Adjacency, type SegmentGeometry } from "./colorCluster";

export interface BoundaryEditOptions {
  /** Radius in topological hops (1 = immediate neighbors). */
  radius?: number;
  /** Target region id assigned by the brush. */
  targetRegion?: number;
}

export interface BoundaryLine {
  a: number;
  b: number;
}

/**
 * Collects boundary edges (pairs of adjacent vertices with different region
 * ids) as vertex index pairs. Used by the boundary-line overlay.
 */
export function collectBoundaryLines(
  mask: Uint8Array,
  geometry: SegmentGeometry
): BoundaryLine[] {
  const lines: BoundaryLine[] = [];
  if (!geometry.indices || geometry.indices.length === 0) return lines;
  const idx = geometry.indices;
  for (let i = 0; i + 2 < idx.length; i += 3) {
    const tri: [number, number, number] = [idx[i], idx[i + 1], idx[i + 2]];
    const pairs: [number, number][] = [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]];
    for (const [a, b] of pairs) {
      if (a < mask.length && b < mask.length && mask[a] !== mask[b]) {
        if (a < b) lines.push({ a, b });
      }
    }
  }
  // Deduplicate (each boundary edge appears in 1-2 triangles).
  const dedup = new Map<number, BoundaryLine>();
  for (const l of lines) {
    dedup.set(l.a * 1000000 + l.b, l);
  }
  return Array.from(dedup.values());
}

/**
 * Paints `targetRegion` onto the vertex at `vertexIndex` and all vertices
 * within `radius` topological hops. Left brush = pull toward the target
 * region: hard-assigns the painted vertices to targetRegion.
 */
export function pullBoundary(
  mask: Uint8Array,
  geometry: SegmentGeometry,
  vertexIndex: number,
  targetRegion: number,
  radius = 1
): Uint8Array {
  return paintRegion(mask, geometry, vertexIndex, targetRegion, radius);
}

/**
 * Right brush = push away from the target region: the painted neighborhood
 * is assigned to the *most common* region among its neighbors that is not
 * the target region (grows neighboring regions across the boundary).
 */
export function pushBoundary(
  mask: Uint8Array,
  geometry: SegmentGeometry,
  vertexIndex: number,
  targetRegion: number,
  radius = 1
): Uint8Array {
  if (radius < 1) return new Uint8Array(mask);
  const adjacency = buildAdjacency(geometry);
  const out = new Uint8Array(mask);
  const seen = new Uint8Array(mask.length);
  const stack = [vertexIndex];
  seen[vertexIndex] = 1;

  for (let hop = 0; hop < radius && stack.length > 0; hop++) {
    const frontier: number[] = [];
    for (const vi of stack) {
      for (const nb of adjacency.neighbors[vi]) {
        if (!seen[nb]) {
          seen[nb] = 1;
          frontier.push(nb);
        }
      }
    }
    stack.length = 0;
    if (hop === radius - 1) {
      // Last hop: assign frontier vertices away from targetRegion.
      for (const vi of frontier) {
        if (out[vi] === targetRegion) {
          out[vi] = dominantNeighborRegion(mask, adjacency, vi, targetRegion);
        }
      }
    } else {
      stack.push(...frontier);
    }
  }
  return out;
}

/**
 * Conservative smoothing via majority vote: each vertex adopts the most
 * frequent region among its immediate neighbors (excluding itself), but only
 * when the local vote is decisive (> threshold of agreement). `smoothness`
 * is 0-100 (0 = no change); higher values relax the agreement requirement.
 */
export function smoothBoundary(
  mask: Uint8Array,
  geometry: SegmentGeometry,
  smoothness = 20
): Uint8Array {
  const vertexCount = mask.length;
  if (vertexCount === 0 || smoothness <= 0) return new Uint8Array(mask);
  const adjacency = buildAdjacency(geometry);
  const out = new Uint8Array(mask);
  // required agreement = 50% .. 30% as smoothness goes 0→100.
  const minAgreement = Math.max(0.3, 0.5 - (smoothness / 100) * 0.2);

  for (let vi = 0; vi < vertexCount; vi++) {
    const neighbors = adjacency.neighbors[vi];
    if (neighbors.length === 0) { out[vi] = mask[vi]; continue; }
    const votes = new Map<number, number>();
    for (const nb of neighbors) {
      const r = mask[nb];
      votes.set(r, (votes.get(r) || 0) + 1);
    }
    let best = mask[vi];
    let bestCount = 0;
    for (const [r, count] of votes) {
      if (count > bestCount) { bestCount = count; best = r; }
    }
    const agreement = bestCount / neighbors.length;
    if (best !== mask[vi] && agreement >= minAgreement) {
      out[vi] = best;
    }
  }
  return out;
}

/**
 * Applies a brush edit — convenience wrapper dispatching between pull
 * (left/assign) and push (right/grow) semantics. Returns a new mask.
 */
export function applyBoundaryEdit(
  mask: Uint8Array,
  geometry: SegmentGeometry,
  kind: "pull" | "push",
  vertexIndex: number,
  targetRegion: number,
  options: BoundaryEditOptions = {}
): Uint8Array {
  const radius = options.radius ?? 1;
  const target = options.targetRegion ?? targetRegion;
  return kind === "pull"
    ? pullBoundary(mask, geometry, vertexIndex, target, radius)
    : pushBoundary(mask, geometry, vertexIndex, target, radius);
}

function paintRegion(
  mask: Uint8Array,
  geometry: SegmentGeometry,
  vertexIndex: number,
  targetRegion: number,
  radius: number
): Uint8Array {
  const out = new Uint8Array(mask);
  if (radius < 0 || vertexIndex < 0 || vertexIndex >= mask.length) return out;
  const adjacency = buildAdjacency(geometry);
  out[vertexIndex] = targetRegion;
  const seen = new Uint8Array(mask.length);
  seen[vertexIndex] = 1;
  let frontier = [vertexIndex];
  for (let hop = 0; hop < radius; hop++) {
    const next: number[] = [];
    for (const vi of frontier) {
      for (const nb of adjacency.neighbors[vi]) {
        if (!seen[nb]) {
          seen[nb] = 1;
          out[nb] = targetRegion;
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
  return out;
}

function dominantNeighborRegion(
  mask: Uint8Array,
  adjacency: Adjacency,
  vi: number,
  exclude: number
): number {
  const votes = new Map<number, number>();
  for (const nb of adjacency.neighbors[vi]) {
    const r = mask[nb];
    if (r === exclude) continue;
    votes.set(r, (votes.get(r) || 0) + 1);
  }
  let best = exclude;
  let bestCount = 0;
  for (const [r, count] of votes) {
    if (count > bestCount) { bestCount = count; best = r; }
  }
  return best;
}