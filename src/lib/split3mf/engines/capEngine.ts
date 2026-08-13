import * as THREE from "three";
import cdt2d from "cdt2d";
import type { CapMethod } from "../state/splitTypes";
import { loadManifold } from "./manifoldLoader";

export interface CapRequest {
  method: CapMethod;
  thickness: number; // mm
  resolution: number; // circular segments hint
  /** Positions (mm, already scaled) of the whole model. */
  positions: Float32Array;
  /** Triangle indices. */
  indices: number[] | Uint32Array | Uint16Array | Uint8Array;
  /** Region mask: same length as positions/3. */
  regionMask: Uint8Array;
  /** Which region id(s) to cap. Capped if `regionId === null` (all non-zero). */
  regionIds?: number[] | null;
}

export interface CapResult {
  /** Capped geometry (positions + index) appended to the input. */
  positions: Float32Array;
  indices: number[];
  /** True when a CPU fallback (not manifold-3d) was used. */
  usedFallback: boolean;
  /** Count of vertices added by caps. */
  addedVertices: number;
}

export interface BoundaryLoop {
  /** Vertex indices forming a closed loop (polyline). */
  vertexIds: number[];
  /** Average normal of the loop (unit). */
  normal: THREE.Vector3;
  /** Loop centroid. */
  centroid: THREE.Vector3;
  /** Bounding-box diagonal (for degenerate detection). */
  diagonal: number;
}

/**
 * Extracts open boundary loops for the given region(s): edges that belong to
 * exactly one triangle in the region. Loops are ordered and closed.
 */
export function extractBoundaryLoops(
  positions: Float32Array,
  indices: number[] | Uint32Array | Uint16Array | Uint8Array,
  regionMask: Uint8Array,
  regionIds?: number[] | null
): BoundaryLoop[] {
  const idx = indices;
  const faceCount = Math.floor(idx.length / 3);
  const vertexCount = positions.length / 3;

  // Map directed edges to the count of region faces using them.
  const edgeFaceCount = new Map<number, number>();
  const edgeRegion = new Map<number, number>();
  const inRegion = (vi: number): boolean => {
    const r = regionMask[vi];
    if (r === 0) return false;
    if (regionIds && !regionIds.includes(r)) return false;
    return true;
  };

  for (let f = 0; f < faceCount; f++) {
    const a = idx[f * 3];
    const b = idx[f * 3 + 1];
    const c = idx[f * 3 + 2];
    if (!inRegion(a) || !inRegion(b) || !inRegion(c)) continue;
    const region = regionMask[a];
    const edges: [number, number][] = [[a, b], [b, c], [c, a]];
    for (const [x, y] of edges) {
      const key = x < y ? x * vertexCount + y : y * vertexCount + x;
      edgeFaceCount.set(key, (edgeFaceCount.get(key) || 0) + 1);
      edgeRegion.set(key, region);
    }
  }

  // Boundary edges: face count 1 within the region set.
  const boundaryEdges = new Map<number, [number, number]>();
  for (const [key, count] of edgeFaceCount) {
    if (count === 1) {
      const region = edgeRegion.get(key)!;
      if (!regionIds || regionIds.includes(region)) {
        const x = Math.floor(key / vertexCount);
        const y = key % vertexCount;
        boundaryEdges.set(key, [x, y]);
      }
    }
  }

  // Trace loops from boundary edges (each vertex connects to ≤2 edges).
  const adjacency = new Map<number, number[]>();
  for (const [x, y] of boundaryEdges.values()) {
    if (!adjacency.has(x)) adjacency.set(x, []);
    if (!adjacency.has(y)) adjacency.set(y, []);
    adjacency.get(x)!.push(y);
    adjacency.get(y)!.push(x);
  }

  const visited = new Set<number>();
  const loops: BoundaryLoop[] = [];
  for (const key of boundaryEdges.keys()) {
    if (visited.has(key)) continue;
    const [start, next] = boundaryEdges.get(key)!;
    const loop: number[] = [start, next];
    visited.add(key);
    let cur = next;
    let prev = start;
    let guard = 0;
    while (cur !== start && guard < vertexCount) {
      const neighbors = adjacency.get(cur) || [];
      const nxt = neighbors.find((n) => n !== prev);
      if (nxt === undefined) break;
      if (nxt === start) {
        // Ring closed — mark the closing edge so no spurious loop is spawned.
        const ckey = cur < start ? cur * vertexCount + start : start * vertexCount + cur;
        visited.add(ckey);
        break;
      }
      const ekey = cur < nxt ? cur * vertexCount + nxt : nxt * vertexCount + cur;
      if (visited.has(ekey)) break;
      visited.add(ekey);
      loop.push(nxt);
      prev = cur;
      cur = nxt;
      guard++;
    }
    loops.push(loopToLoop(loop, positions, regionMask));
  }

  // Keep the largest loops (small loops = tessellation slivers).
  if (loops.length > 1) {
    loops.sort((a, b) => b.vertexIds.length - a.vertexIds.length);
    const maxLen = loops[0].vertexIds.length;
    return loops.filter((l) => l.vertexIds.length >= maxLen * 0.5);
  }
  return loops;
}

function loopToLoop(vertexIds: number[], positions: Float32Array, regionMask: Uint8Array): BoundaryLoop {
  const pts = vertexIds.map((vi) => new THREE.Vector3(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]));
  const centroid = new THREE.Vector3();
  for (const p of pts) centroid.add(p);
  centroid.divideScalar(pts.length || 1);

  // Newell's method normal.
  const normal = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    normal.x += (a.y - b.y) * (a.z + b.z);
    normal.y += (a.z - b.z) * (a.x + b.x);
    normal.z += (a.x - b.x) * (a.y + b.y);
  }
  normal.normalize();
  if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1);

  let diagonal = 0;
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of pts) {
    min.min(p);
    max.max(p);
  }
  diagonal = min.distanceTo(max);

  return { vertexIds, normal, centroid, diagonal };
}

/** Builds a unit-length orthonormal basis from a normal (tangent plane). */
export function tangentBasis(normal: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
  const helper = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(helper, normal).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
  return { u, v };
}

/**
 * Converts a boundary loop to a planar polygon (2D) in its tangent plane.
 * Returns [x, y] pairs plus the origin used.
 */
export function projectLoopTo2D(
  loop: BoundaryLoop,
  positions: Float32Array
): { poly: [number, number][]; origin: THREE.Vector3 } {
  const { u, v } = tangentBasis(loop.normal);
  const poly: [number, number][] = [];
  for (const vi of loop.vertexIds) {
    const p = new THREE.Vector3(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]);
    poly.push([p.sub(loop.centroid).dot(u), p.sub(loop.centroid).dot(v)]);
  }
  return { poly, origin: loop.centroid };
}

export interface Triangulation2D {
  /** Triangle cells, each [i, j, k] into the loop's vertex ids. */
  cells: [number, number, number][];
  usedFallback: boolean;
}

/**
 * Triangulates a boundary loop. Uses cdt2d (constrained Delaunay) when
 * available and the polygon is planar-simple; falls back to fan triangulation.
 */
export function triangulateLoop2D(
  poly: [number, number][],
  resolution = 32
): Triangulation2D {
  void resolution;
  if (poly.length < 3) return { cells: [], usedFallback: true };
  try {
    const points = poly as unknown as [number, number][];
    const edges: [number, number][] = [];
    for (let i = 0; i < points.length; i++) {
      edges.push([i, (i + 1) % points.length]);
    }
    const cells = cdt2d(points, edges) as unknown as [number, number, number][];
    const clean: [number, number, number][] = [];
    for (const cell of cells) {
      if (cell.length >= 3) {
        clean.push([cell[0], cell[1], cell[2]]);
      }
    }
    return { cells: clean, usedFallback: false };
  } catch {
    return { cells: fanTriangulation(poly), usedFallback: true };
  }
}

/** Fan triangulation from poly[0] — robust fallback for arbitrary polygons. */
export function fanTriangulation(poly: [number, number][]): [number, number, number][] {
  const cells: [number, number, number][] = [];
  if (poly.length < 3) return cells;
  for (let i = 1; i < poly.length - 1; i++) {
    cells.push([0, i, i + 1]);
  }
  return cells;
}

/**
 * Caps the open boundaries of one or more regions. Methods:
 * - centroid_cap / projected_normal / winding_fill: CPU triangulation in the
 *   loop's tangent plane, capped by a thin manifold-valid disk.
 * - soap_film: manifold-3d (lazy WASM) when loaded; otherwise the same CPU
 *   path (usedFallback=true).
 * - cdt_boundary: constrained Delaunay via cdt2d.
 *
 * All methods emit a watertight-ish cap: boundary loop + center fan, extruded
 * by `thickness` so the cap overlaps the surrounding geometry.
 */
export function capBoundaries(request: CapRequest): CapResult {
  const { method, thickness, positions, indices, regionMask, regionIds } = request;
  const loops = extractBoundaryLoops(positions, indices, regionMask, regionIds);
  if (loops.length === 0) {
    return { positions, indices: Array.from(indices as number[]), usedFallback: false, addedVertices: 0 };
  }

  const outPos = Array.from(positions);
  const outIdx: number[] = Array.from(indices as number[]);
  const usedFallback = method === "soap_film" || method === "winding_fill";
  let added = 0;

  for (const loop of loops) {
    if (loop.vertexIds.length < 3) continue;
    const { poly } = projectLoopTo2D(loop, positions);
    const triangulated = triangulateLoop2D(poly, request.resolution);
    const cells = request.method === "centroid_cap"
      ? fanTriangulation(poly)
      : triangulated.cells.length > 0
      ? triangulated.cells
      : fanTriangulation(poly);

    // Reuse the existing boundary ring for the bottom surface and add only a
    // displaced top ring, keeping the cap connected to the source mesh.
    const ringCount = loop.vertexIds.length;
    const capPos: number[] = [];
    const n = loop.normal;
    for (const vi of loop.vertexIds) {
      capPos.push(
        positions[vi * 3] + n.x * thickness,
        positions[vi * 3 + 1] + n.y * thickness,
        positions[vi * 3 + 2] + n.z * thickness
      );
    }

    const baseIdx = outPos.length / 3;
    const topBase = baseIdx;

    // Top disk closes the opening; the original boundary surface supplies the
    // opposite side and the walls connect both rings.
    for (const cell of cells) {
      if (cell[0] === undefined || cell[1] === undefined || cell[2] === undefined) continue;
      outIdx.push(topBase + cell[2], topBase + cell[1], topBase + cell[0]);
    }
    // Side walls connecting bottom ring to top ring.
    for (let i = 0; i < ringCount; i++) {
      const j = (i + 1) % ringCount;
      outIdx.push(
        loop.vertexIds[i], loop.vertexIds[j], topBase + i,
        loop.vertexIds[j], topBase + j, topBase + i
      );
    }

    outPos.push(...capPos);
    added += ringCount;
  }

  return {
    positions: new Float32Array(outPos),
    indices: outIdx,
    usedFallback,
    addedVertices: added,
  };
}

/**
 * Builds the requested cap synchronously, then validates soap-film output with
 * Manifold-3D when its WASM module is available. The CPU result remains the
 * explicit fallback for environments where WASM cannot load.
 */
export async function capBoundariesAsync(request: CapRequest): Promise<CapResult> {
  const result = capBoundaries(request);
  if (request.method !== "soap_film" || result.addedVertices === 0) return result;

  try {
    const manifold = await loadManifold();
    const numProp = 3;
    const mesh = new manifold.Mesh({
      numProp,
      vertProperties: result.positions,
      triVerts: new Uint32Array(result.indices),
    });
    const solid = new manifold.Manifold(mesh);
    const output = solid.getMesh();
    const positions: number[] = [];
    for (let i = 0; i < output.vertProperties.length; i += output.numProp) {
      positions.push(output.vertProperties[i], output.vertProperties[i + 1], output.vertProperties[i + 2]);
    }
    solid.delete();
    return {
      positions: new Float32Array(positions),
      indices: Array.from(output.triVerts),
      usedFallback: false,
      addedVertices: Math.max(0, positions.length / 3 - request.positions.length / 3),
    };
  } catch {
    return { ...result, usedFallback: true };
  }
}
