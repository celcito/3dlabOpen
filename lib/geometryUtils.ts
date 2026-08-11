import * as THREE from "three";

export interface CutLoop {
  vertices: THREE.Vector3[];
  normal: THREE.Vector3;
  centroid: THREE.Vector3;
  groupA: number;
  groupB: number;
}

export interface ConnectorRequest {
  connector_config: {
    type: "dovetail" | "plug" | "dowel";
    size_mm: number;
    depth_mm: number;
    count: number;
    distribution: string;
    tolerance_preset: string;
    tolerance_mm?: number;
    xy_compensation_mm?: number;
    draft_angle_deg?: number;
    plug_shape?: string;
    dovetail_sides?: number;
  };
  vertex_groups: Record<number, number[]>;
  model_name: string;
  placement_mode: string;
  manual_assignments?: Record<string, string>;
}

export function detectBoundaryEdges(
  geometry: THREE.BufferGeometry,
  vertexGroups: Uint8Array,
  groups: { id: number }[]
): CutLoop[] {
  const position = geometry.attributes.position;
  const index = geometry.index;
  if (!position || !index) return [];

  const groupOfVertex: Map<number, number> = new Map();
  for (let i = 0; i < vertexGroups.length; i++) {
    if (vertexGroups[i] !== undefined && vertexGroups[i] !== 0) {
      groupOfVertex.set(i, vertexGroups[i]);
    }
  }

  const edgeMap = new Map<string, Set<number>>();
  const arr = index.array;
  const pos = position.array;

  for (let i = 0; i < arr.length; i += 3) {
    const v0 = arr[i];
    const v1 = arr[i + 1];
    const v2 = arr[i + 2];

    const g0 = groupOfVertex.get(v0) ?? 0;
    const g1 = groupOfVertex.get(v1) ?? 0;
    const g2 = groupOfVertex.get(v2) ?? 0;

    const edges = [
      [v0, v1, g0, g1],
      [v1, v2, g1, g2],
      [v2, v0, g2, g0],
    ];

    for (const [a, b, ga, gb] of edges) {
      if (ga !== gb && ga > 0 && gb > 0) {
        const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
        if (!edgeMap.has(key)) edgeMap.set(key, new Set());
        edgeMap.get(key)!.add(ga);
        edgeMap.get(key)!.add(gb);
      } else if (ga !== gb && (ga > 0 || gb > 0)) {
        const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
        if (!edgeMap.has(key)) edgeMap.set(key, new Set());
        const nonZero = ga > 0 ? ga : gb;
        edgeMap.get(key)!.add(nonZero);
        edgeMap.get(key)!.add(0);
      }
    }
  }

  const boundaryEdgesByPair = new Map<string, [number, number][]>();
  for (const [key, gset] of edgeMap.entries()) {
    if (gset.size >= 2) {
      const sorted = [...gset].sort();
      const pairKey = sorted.join("-");
      if (!boundaryEdgesByPair.has(pairKey)) {
        boundaryEdgesByPair.set(pairKey, []);
      }
      const [v1, v2] = key.split("-").map(Number);
      boundaryEdgesByPair.get(pairKey)!.push([v1, v2]);
    }
  }

  const loops: CutLoop[] = [];
  for (const [pairKey, edges] of boundaryEdgesByPair.entries()) {
    const [ga, gb] = pairKey.split("-").map(Number);
    const loopVertices = traceLoop(edges, pos);
    if (!loopVertices || loopVertices.length < 3) continue;

    const centroid = new THREE.Vector3();
    for (const v of loopVertices) centroid.add(v);
    centroid.divideScalar(loopVertices.length);

    const normal = computeLoopNormal(loopVertices, centroid);

    loops.push({ vertices: loopVertices, normal, centroid, groupA: ga, groupB: gb });
  }

  return loops;
}

function traceLoop(
  edges: [number, number][],
  pos: ArrayLike<number>
): THREE.Vector3[] | null {
  if (edges.length === 0) return null;

  const adj = new Map<number, number[]>();
  for (const [v1, v2] of edges) {
    if (!adj.has(v1)) adj.set(v1, []);
    if (!adj.has(v2)) adj.set(v2, []);
    adj.get(v1)!.push(v2);
    adj.get(v2)!.push(v1);
  }

  if (adj.size < 3) return null;

  const visited = new Set<number>();
  const ordered: number[] = [];
  let current = edges[0][0];

  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    ordered.push(current);
    const neighbors = adj.get(current)?.filter((n) => !visited.has(n)) ?? [];
    current = neighbors[0];
  }

  if (ordered.length < 3) return null;
  return ordered.map((i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
}

function computeLoopNormal(
  vertices: THREE.Vector3[],
  centroid: THREE.Vector3
): THREE.Vector3 {
  const n = new THREE.Vector3();
  for (let i = 0; i < vertices.length; i++) {
    const v0 = vertices[i];
    const v1 = vertices[(i + 1) % vertices.length];
    const v2 = vertices[(i + 2) % vertices.length];
    const e1 = new THREE.Vector3().copy(v1).sub(v0);
    const e2 = new THREE.Vector3().copy(v2).sub(v0);
    const cross = new THREE.Vector3().crossVectors(e1, e2);
    n.add(cross);
  }
  const len = n.length();
  if (len > 1e-10) n.divideScalar(len);
  else n.set(0, 0, 1);
  if (n.dot(new THREE.Vector3().copy(vertices[0]).sub(centroid)) > 0) {
    n.negate();
  }
  return n;
}

export function collectVertexGroups(
  geometry: THREE.BufferGeometry,
  vertexGroups: Uint8Array
): Record<string, number[][]> {
  const pos = geometry.attributes.position;
  const groups: Record<number, [number, number, number][]> = {};
  for (let i = 0; i < vertexGroups.length; i++) {
    const g = vertexGroups[i];
    if (g > 0) {
      if (!groups[g]) groups[g] = [];
      groups[g].push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    }
  }
  const result: Record<string, number[][]> = {};
  for (const [gid, verts] of Object.entries(groups)) {
    result[gid] = verts;
  }
  return result;
}

export function computeGroupCentroids(
  geometry: THREE.BufferGeometry,
  vertexGroups: Uint8Array
): Record<number, [number, number, number]> {
  const pos = geometry.attributes.position;
  const sums: Record<number, [number, number, number]> = {};
  const counts: Record<number, number> = {};
  for (let i = 0; i < vertexGroups.length; i++) {
    const g = vertexGroups[i];
    if (g > 0) {
      if (!sums[g]) { sums[g] = [0, 0, 0]; counts[g] = 0; }
      sums[g][0] += pos.getX(i);
      sums[g][1] += pos.getY(i);
      sums[g][2] += pos.getZ(i);
      counts[g]++;
    }
  }
  const centroids: Record<number, [number, number, number]> = {};
  for (const g of Object.keys(sums).map(Number)) {
    centroids[g] = [
      sums[g][0] / counts[g],
      sums[g][1] / counts[g],
      sums[g][2] / counts[g],
    ];
  }
  return centroids;
}

export function computeLoopLength(loop: CutLoop): number {
  let len = 0;
  for (let i = 0; i < loop.vertices.length; i++) {
    const v0 = loop.vertices[i];
    const v1 = loop.vertices[(i + 1) % loop.vertices.length];
    len += v0.distanceTo(v1);
  }
  return len;
}
