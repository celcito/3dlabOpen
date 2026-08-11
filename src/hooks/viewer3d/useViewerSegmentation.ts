import { useState } from "react";
import * as THREE from "three";

type Group = { id: number; name: string; color: string; border?: string };

export function useViewerSegmentation({
  geometry,
  adjacencyList,
  groups,
  setGroups,
  setVertexGroups,
  pushHistory,
  onProcessing,
}: {
  geometry: THREE.BufferGeometry | null;
  adjacencyList: Set<number>[] | null;
  groups: Group[];
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  setVertexGroups: React.Dispatch<React.SetStateAction<Uint8Array>>;
  pushHistory: () => void;
  onProcessing: (message: string | null) => void;
}) {
  const [segmentLegs, setSegmentLegs] = useState(true);
  const [segmentArms, setSegmentArms] = useState(true);
  const [segmentTorso, setSegmentTorso] = useState(true);
  const colorFor = (id: number) => groups.find((group) => group.id === id)?.color || "#333333";
  const applyColors = (values: Uint8Array) => {
    const color = geometry?.attributes.color;
    if (!color) return;
    for (let i = 0; i < values.length; i++) { const c = new THREE.Color(colorFor(values[i])); color.setXYZ(i, c.r, c.g, c.b); }
    color.needsUpdate = true;
  };
  const autoSegmentAnatomy = () => {
    if (!geometry) return;
    onProcessing("Segmentando...");
    setTimeout(() => {
      pushHistory(); const position = geometry.attributes.position; const values = new Uint8Array(position.count);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < position.count; i++) { const x = position.getX(i), y = position.getY(i); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      const height = maxY - minY, width = maxX - minX;
      for (let i = 0; i < position.count; i++) { const x = position.getX(i), y = position.getY(i); values[i] = y < minY + height * .36 ? (segmentLegs ? 1 : 0) : x < minX + width * .33 ? (segmentArms ? 3 : 0) : x > maxX - width * .33 ? (segmentArms ? 4 : 0) : (segmentTorso ? 2 : 0); }
      applyColors(values); setVertexGroups(values);
      onProcessing(null);
    }, 100);
  };
  const segmentShells = (smart: boolean) => {
    if (!geometry || !adjacencyList) return;
    onProcessing(smart ? "Analisando..." : "Detectando shells...");
    setTimeout(() => {
      pushHistory(); const count = geometry.attributes.position.count, values = new Uint8Array(count), visited = new Uint8Array(count); const position = geometry.attributes.position;
      const shells: { vertices: number[]; center: THREE.Vector3; count: number }[] = [];
      let currentGroup = 1, shellCount = 0;
      for (let i = 0; i < count; i++) if (!visited[i]) { shellCount++; const queue = [i], component: number[] = [], center = new THREE.Vector3(); visited[i] = 1; while (queue.length) { const u = queue.shift()!; component.push(u); center.add(new THREE.Vector3(position.getX(u), position.getY(u), position.getZ(u))); if (component.length > (smart ? 200000 : 500000)) break; for (const v of adjacencyList[u] || []) if (!visited[v]) { visited[v] = 1; queue.push(v); } } shells.push({ vertices: component, center: center.divideScalar(component.length), count: component.length }); }
      if (!smart) shells.forEach((shell) => { shell.vertices.forEach((index) => { values[index] = currentGroup; }); currentGroup = currentGroup < 4 ? currentGroup + 1 : 1; });
      else { shells.sort((a, b) => b.count - a.count); const minY = geometry.boundingBox!.min.y, maxY = geometry.boundingBox!.max.y, height = maxY - minY; shells.forEach((shell, index) => { const group = index === 0 ? 1 : shell.count > count * .05 ? (shell.center.y < minY + height * .3 ? 2 : shell.center.y > maxY - height * .3 ? 3 : 1) : shell.center.y < minY + height * .2 ? 2 : 4; shell.vertices.forEach((value) => { values[value] = group; }); }); }
      if (shellCount <= 1) alert("Apenas uma peça detectada.");
      applyColors(values); setVertexGroups(values);
      setGroups(smart ? [{ id: 0, name: "Base Principal (Cinza)", color: "#333333", border: "border-zinc-700" }, { id: 1, name: "Estrutura", color: "#00E5FF", border: "border-[#00E5FF]" }, { id: 2, name: "Base", color: "#FF1744", border: "border-[#FF1744]" }, { id: 3, name: "Topo", color: "#00FF41", border: "border-[#00FF41]" }, { id: 4, name: "Detalhes", color: "#D500F9", border: "border-[#D500F9]" }] : [{ id: 0, name: "Base Principal (Cinza)", color: "#333333", border: "border-zinc-700" }, { id: 1, name: "Grupo 1", color: "#00E5FF", border: "border-[#00E5FF]" }, { id: 2, name: "Grupo 2", color: "#FF1744", border: "border-[#FF1744]" }, { id: 3, name: "Grupo 3", color: "#00FF41", border: "border-[#00FF41]" }, { id: 4, name: "Grupo 4", color: "#D500F9", border: "border-[#D500F9]" }]);
      onProcessing(null);
    }, 100);
  };
  return { segmentLegs, setSegmentLegs, segmentArms, setSegmentArms, segmentTorso, setSegmentTorso, autoSegmentAnatomy, autoSegmentShells: () => segmentShells(false), autoSegmentSmart: () => segmentShells(true) };
}
