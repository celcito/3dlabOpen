import { useEffect } from "react";
import * as THREE from "three";

export function useViewerPainting({
  geometry,
  vertexGroups,
  setVertexGroups,
  history,
  setHistory,
  activeGroupId,
  effectiveIsolateGroupId,
  groupColor,
  adjacencyList,
}: {
  geometry: THREE.BufferGeometry | null;
  vertexGroups: Uint8Array;
  setVertexGroups: React.Dispatch<React.SetStateAction<Uint8Array>>;
  history: Uint8Array[];
  setHistory: React.Dispatch<React.SetStateAction<Uint8Array[]>>;
  activeGroupId: number;
  effectiveIsolateGroupId: number | null;
  groupColor: (id: number) => string;
  adjacencyList: Set<number>[] | null;
}) {
  const pushStateToHistory = (customState?: Uint8Array) => {
    const state = customState || vertexGroups;
    if (!state.length) return;
    setHistory((previous) => { const next = [...previous, new Uint8Array(state)]; if (next.length > 20) next.shift(); return next; });
  };
  const handleUndo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1]; setVertexGroups(previous); setHistory((value) => value.slice(0, -1));
    const color = geometry?.attributes.color; if (!color) return;
    for (let i = 0; i < previous.length; i++) { const c = effectiveIsolateGroupId !== null && previous[i] !== effectiveIsolateGroupId ? new THREE.Color("#1c1c1c") : new THREE.Color(groupColor(previous[i])); color.setXYZ(i, c.r, c.g, c.b); }
    color.needsUpdate = true;
  };
  useEffect(() => { const listener = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); handleUndo(); } }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); }, [history, geometry, effectiveIsolateGroupId]);
  const resetPainting = () => {
    if (!geometry) return; pushStateToHistory(); const values = new Uint8Array(geometry.attributes.position.count); setVertexGroups(values); const color = geometry.attributes.color; if (color) { const c = new THREE.Color(groupColor(0)); for (let i = 0; i < values.length; i++) color.setXYZ(i, c.r, c.g, c.b); color.needsUpdate = true; }
  };
  const fillRemainingWithActiveGroup = () => {
    if (!geometry) return; pushStateToHistory(); const values = new Uint8Array(vertexGroups); const color = geometry.attributes.color, c = new THREE.Color(groupColor(activeGroupId)); let changed = false; for (let i = 0; i < values.length; i++) if (!values[i]) { values[i] = activeGroupId; color?.setXYZ(i, c.r, c.g, c.b); changed = true; } if (changed) { if (color) color.needsUpdate = true; setVertexGroups(values); }
  };
  const fillAllWithActiveGroup = () => {
    if (!geometry) return; pushStateToHistory(); const values = new Uint8Array(geometry.attributes.position.count); values.fill(activeGroupId); const color = geometry.attributes.color, c = new THREE.Color(groupColor(activeGroupId)); if (color) { for (let i = 0; i < values.length; i++) color.setXYZ(i, c.r, c.g, c.b); color.needsUpdate = true; } setVertexGroups(values);
  };
  const expandConnectedPaint = () => {
    if (!geometry || !adjacencyList) return; const seeds = vertexGroups.reduce<number[]>((result, value, index) => { if (value === activeGroupId) result.push(index); return result; }, []); if (!seeds.length) { alert("Pinte primeiro uma parte!"); return; } pushStateToHistory(); const values = new Uint8Array(vertexGroups), visited = new Uint8Array(values.length), queue = [...seeds], color = geometry.attributes.color, c = new THREE.Color(groupColor(activeGroupId)); seeds.forEach((seed) => { visited[seed] = 1; }); let expanded = 0; while (queue.length) { const u = queue.shift()!; for (const v of adjacencyList[u] || []) if (!visited[v] && !vertexGroups[v]) { visited[v] = 1; values[v] = activeGroupId; color?.setXYZ(v, c.r, c.g, c.b); queue.push(v); expanded++; } } if (!expanded) { alert("Nenhuma parte conectada não pintada!"); return; } if (color) color.needsUpdate = true; setVertexGroups(values);
  };
  return { pushStateToHistory, handleUndo, resetPainting, fillRemainingWithActiveGroup, fillAllWithActiveGroup, expandConnectedPaint };
}
