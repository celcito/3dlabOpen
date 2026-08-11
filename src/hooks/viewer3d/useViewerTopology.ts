import { useMemo } from "react";
import * as THREE from "three";

export function buildAdjacencyList(geometry: THREE.BufferGeometry): Set<number>[] {
  const count = geometry.attributes.position?.count || 0;
  const adjacency = Array.from({ length: count }, () => new Set<number>());
  const indices = geometry.index?.array;
  const add = (a: number, b: number, c: number) => { adjacency[a].add(b); adjacency[a].add(c); adjacency[b].add(a); adjacency[b].add(c); adjacency[c].add(a); adjacency[c].add(b); };
  if (indices) for (let i = 0; i < indices.length; i += 3) add(indices[i], indices[i + 1], indices[i + 2]);
  else for (let i = 0; i < count; i += 3) if (i + 2 < count) add(i, i + 1, i + 2);
  return adjacency;
}

export function useViewerTopology(modelGeometry: THREE.BufferGeometry | null) {
  return useMemo(() => modelGeometry ? buildAdjacencyList(modelGeometry) : null, [modelGeometry]);
}
