import { deltaE, hexToRgb, rgbToHex, type RGB } from "../utils/deltaE";

export interface ClusterOptions {
  /** ΔE threshold (CIE76) — default 8.0. 0 = identical, >8 = clearly different. */
  threshold?: number;
  /** Regions smaller than this many vertices are merged into their largest neighbor. */
  minRegionSize?: number;
}

export interface RegionStats {
  regionMask: Uint8Array;
  regionCount: number;
  regionSizes: number[];
  boundaryEdgeCount: number;
  /** One suggested hex color per region (1-based id). */
  regionColors: string[];
}

export interface SegmentGeometry {
  colors?: Float32Array;
  indices?: Uint32Array | Uint16Array | Uint8Array | number[] | null;
  vertexCount: number;
}

export interface Adjacency {
  neighbors: Uint32Array[];
}

/** 0-based triangle indices per face. */
function triangleListOf(g: SegmentGeometry): [number, number, number][] {
  const faces: [number, number, number][] = [];
  if (g.indices && g.indices.length > 0) {
    const idx = g.indices;
    for (let i = 0; i + 2 < idx.length; i += 3) {
      faces.push([idx[i], idx[i + 1], idx[i + 2]]);
    }
  } else {
    for (let i = 0; i + 2 < g.vertexCount; i += 3) {
      faces.push([i, i + 1, i + 2]);
    }
  }
  return faces;
}

/**
 * Builds a vertex adjacency list from triangle connectivity.
 * CPU-friendly: counts degrees first, then fills CSR rows.
 */
export function buildAdjacency(g: SegmentGeometry): Adjacency {
  const faces = triangleListOf(g);
  const degree = new Uint32Array(g.vertexCount);
  for (const [a, b, c] of faces) {
    if (a < g.vertexCount && b < g.vertexCount && c < g.vertexCount) {
      degree[a]++; degree[a]++;
      degree[b]++; degree[b]++;
      degree[c]++; degree[c]++;
    }
  }
  const offsets = new Uint32Array(g.vertexCount + 1);
  for (let vi = 0; vi < g.vertexCount; vi++) {
    offsets[vi + 1] = offsets[vi] + degree[vi];
  }
  const flat = new Uint32Array(offsets[g.vertexCount]);
  const cursor = offsets.slice(0, g.vertexCount);

  const addEdge = (x: number, y: number) => {
    if (x >= g.vertexCount || y >= g.vertexCount) return;
    flat[cursor[x]++] = y;
    flat[cursor[y]++] = x;
  };
  for (const [a, b, c] of faces) {
    if (a < g.vertexCount && b < g.vertexCount && c < g.vertexCount) {
      addEdge(a, b);
      addEdge(a, c);
      addEdge(b, c);
    }
  }

  const neighbors: Uint32Array[] = new Array(g.vertexCount);
  for (let vi = 0; vi < g.vertexCount; vi++) {
    neighbors[vi] = flat.subarray(offsets[vi], offsets[vi + 1]);
  }
  return { neighbors };
}

/**
 * Greedy color clustering: assigns each vertex to the first cluster whose
 * color is within `threshold` ΔE of the cluster seed. Vertices without a
 * color attribute all fall into region 0.
 */
export function clusterColorsBySimilarity(colors: Float32Array, threshold = 8.0): Uint8Array {
  const vertexCount = colors.length / 3;
  const mask = new Uint8Array(vertexCount);
  if (vertexCount === 0) return mask;
  const seeds: RGB[] = [];
  for (let vi = 0; vi < vertexCount; vi++) {
    const c: RGB = { r: colors[vi * 3] * 255, g: colors[vi * 3 + 1] * 255, b: colors[vi * 3 + 2] * 255 };
    let assigned = 0;
    for (let si = 0; si < seeds.length; si++) {
      if (deltaE(seeds[si], c) < threshold) {
        assigned = si + 1;
        break;
      }
    }
    if (assigned === 0) {
      seeds.push(c);
      assigned = seeds.length;
    }
    mask[vi] = assigned;
  }
  return mask;
}

/**
 * Relabels the mask so each 4-connected component gets a unique region id,
 * preserving seed order (first occurrence wins). Ensures spatial contiguity.
 */
export function floodFillConnectedComponents(
  mask: Uint8Array,
  adjacency: Adjacency
): Uint8Array {
  const vertexCount = mask.length;
  const out = new Uint8Array(vertexCount);
  const visited = new Uint8Array(vertexCount);
  let nextId = 1;
  const queue: number[] = [];
  for (let start = 0; start < vertexCount; start++) {
    if (visited[start] || mask[start] === 0) continue;
    const label = mask[start];
    const componentId = nextId++;
    visited[start] = 1;
    out[start] = componentId;
    queue.push(start);
    while (queue.length > 0) {
      const cur = queue.pop()!;
      for (const nb of adjacency.neighbors[cur]) {
        if (!visited[nb] && mask[nb] === label) {
          visited[nb] = 1;
          out[nb] = componentId;
          queue.push(nb);
        }
      }
    }
  }
  return out;
}

/**
 * Merges regions smaller than `minRegionSize` vertices into their largest
 * adjacent region (speckle removal).
 */
export function mergeSmallRegions(
  mask: Uint8Array,
  adjacency: Adjacency,
  minRegionSize: number
): Uint8Array {
  if (minRegionSize <= 0) return mask;
  const vertexCount = mask.length;
  const sizes = new Map<number, number>();
  for (let vi = 0; vi < vertexCount; vi++) {
    const r = mask[vi];
    if (r === 0) continue;
    sizes.set(r, (sizes.get(r) || 0) + 1);
  }

  let changed = true;
  const out = new Uint8Array(mask);
  while (changed) {
    changed = false;
    for (let vi = 0; vi < vertexCount; vi++) {
      const r = out[vi];
      if (r === 0 || (sizes.get(r) || 0) >= minRegionSize) continue;
      // Find the largest neighbor region.
      let best = 0;
      let bestSize = 0;
      for (const nb of adjacency.neighbors[vi]) {
        const nr = out[nb];
        if (nr === 0 || nr === r) continue;
        const sz = sizes.get(nr) || 0;
        if (sz > bestSize) {
          bestSize = sz;
          best = nr;
        }
      }
      if (best !== 0) {
        out[vi] = best;
        sizes.set(r, (sizes.get(r) || 1) - 1);
        sizes.set(best, bestSize + 1);
        changed = true;
      }
    }
  }
  return out;
}

/**
 * Counts boundary edges: pairs of adjacent vertices whose region ids differ.
 * Requires indexed connectivity (or tri-strip); returns 0 otherwise.
 */
export function countBoundaryEdges(mask: Uint8Array, g: SegmentGeometry): number {
  let count = 0;
  if (g.indices && g.indices.length > 0) {
    const idx = g.indices;
    for (let i = 0; i + 2 < idx.length; i += 3) {
      const tri: [number, number, number] = [idx[i], idx[i + 1], idx[i + 2]];
      const pairs: [number, number][] = [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]];
      for (const [a, b] of pairs) {
        if (a < mask.length && b < mask.length && mask[a] !== mask[b]) count++;
      }
    }
  }
  return count;
}

/**
 * Full CPU segmentation pipeline.
 * 1. Greedy color clustering by ΔE threshold
 * 2. Flood-fill to split spatially disconnected same-color clusters
 * 3. Merge speckle regions under `minRegionSize`
 */
export function segmentByColor(
  colors: Float32Array,
  geometry: SegmentGeometry,
  options: ClusterOptions = {}
): RegionStats {
  const threshold = options.threshold ?? 8.0;
  const minRegionSize = options.minRegionSize ?? 0;
  const adjacency = buildAdjacency(geometry);

  if (!colors || colors.length === 0) {
    return {
      regionMask: new Uint8Array(geometry.vertexCount),
      regionCount: 0,
      regionSizes: [],
      boundaryEdgeCount: 0,
      regionColors: [],
    };
  }

  let mask = clusterColorsBySimilarity(colors, threshold);
  mask = floodFillConnectedComponents(mask, adjacency);
  mask = mergeSmallRegions(mask, adjacency, minRegionSize);

  const sizes = new Map<number, number>();
  for (let vi = 0; vi < mask.length; vi++) {
    const r = mask[vi];
    if (r === 0) continue;
    sizes.set(r, (sizes.get(r) || 0) + 1);
  }
  const regionCount = sizes.size;
  const regionSizes = Array.from({ length: regionCount }, (_, i) => sizes.get(i + 1) || 0);

  const regionColors: string[] = [];
  if (colors.length > 0) {
    const seen = new Map<number, string>();
    for (let vi = 0; vi < mask.length; vi++) {
      const r = mask[vi];
      if (r === 0 || seen.has(r)) continue;
      const c: RGB = { r: colors[vi * 3] * 255, g: colors[vi * 3 + 1] * 255, b: colors[vi * 3 + 2] * 255 };
      const hex = rgbToHex(c.r, c.g, c.b);
      seen.set(r, hex);
      regionColors.push(hex);
    }
  }

  return {
    regionMask: mask,
    regionCount,
    regionSizes,
    boundaryEdgeCount: countBoundaryEdges(mask, geometry),
    regionColors,
  };
}

export function sampleColorAt(colors: Float32Array, vi: number): RGB {
  return { r: colors[vi * 3] * 255, g: colors[vi * 3 + 1] * 255, b: colors[vi * 3 + 2] * 255 };
}

export { hexToRgb, rgbToHex };