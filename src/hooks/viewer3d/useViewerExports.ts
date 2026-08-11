import { useState } from "react";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { addPeg, addSocket, addReinforcedSocket, capBoundaryHoles } from "../../../lib/csg";

const belongsToGroup = (a: number, b: number, c: number, group: number) => group === 0 ? a === 0 && b === 0 && c === 0 : [a, b, c].filter((value) => value === group).length >= 2;

export function useViewerExports({ modelGeometry, setModelGeometry, vertexGroups, setVertexGroups, groups, fileName, jointType, jointSizes, capSelection, setIsProcessing, setProcessingMessage, setStats, setHistory, setGroupJointTypes, setManualJoints, setPlacementMode, getGroupName, findNeighborGroups, getPairJointSpecs, getEffectiveJointType, jointConfigurationWarning }: any) {
  const [isExporting, setIsExporting] = useState<number | null>(null);
  const [loadingCap, setLoadingCap] = useState(false);
  const [isCapped, setIsCapped] = useState(false);
  const [isDownloadingCapped, setIsDownloadingCapped] = useState(false);

  const capHollowVase = async () => {
    if (!modelGeometry) return;
    setLoadingCap(true); setIsProcessing(true); setProcessingMessage("Fechando furos..."); await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      let geom = BufferGeometryUtils.mergeVertices(modelGeometry.clone()); const index = geom.getIndex(); if (!index) { alert("Sem índices."); return; }
      const position = geom.getAttribute("position"), edges = new Set<string>(); const key = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
      for (let i = 0; i < index.count; i += 3) [[index.getX(i), index.getX(i + 1)], [index.getX(i + 1), index.getX(i + 2)], [index.getX(i + 2), index.getX(i)]].forEach(([a, b]) => { const k = key(a, b); edges.has(k) ? edges.delete(k) : edges.add(k); });
      const boundary = Array.from(edges).map((edge) => edge.split(":").map(Number)); if (!boundary.length) { alert("Malha já fechada."); return; }
      geom.computeBoundingBox(); const bbox = geom.boundingBox!; const axis = ["x", "y", "z"].sort((a, b) => (bbox.max[b as "x" | "y" | "z"] - bbox.min[b as "x" | "y" | "z"]) - (bbox.max[a as "x" | "y" | "z"] - bbox.min[a as "x" | "y" | "z"]))[0] as "x" | "y" | "z";
      const min = bbox.min[axis], max = bbox.max[axis], coordinate = (vertex: number) => axis === "x" ? position.getX(vertex) : axis === "y" ? position.getY(vertex) : position.getZ(vertex);
      const target = boundary.filter(([a]) => capSelection === "top" ? coordinate(a) >= min + (max - min) * 0.5 : coordinate(a) <= min + (max - min) * 0.5);
      const loops = target.length ? [target.map(([a]) => a)] : [];
      if (!loops.length) { alert("Nenhum buraco encontrado."); return; }
      const oldColors = geom.getAttribute("color"), vertexCount = position.count + loops.length, positions = new Float32Array(vertexCount * 3), colors = new Float32Array(vertexCount * 3); positions.set(position.array); if (oldColors) colors.set(oldColors.array); else colors.fill(1);
      const indices = new Uint32Array(index.count + loops.reduce((sum, loop) => sum + loop.length * 3, 0)); indices.set(index.array); let vi = position.count, ii = index.count;
      loops.forEach((loop) => { const center = new THREE.Vector3(); loop.forEach((v) => center.add(new THREE.Vector3(position.getX(v), position.getY(v), position.getZ(v)))); center.divideScalar(loop.length); positions.set([center.x, center.y, center.z], vi * 3); loop.forEach((v) => { colors.set(oldColors ? [oldColors.getX(v), oldColors.getY(v), oldColors.getZ(v)] : [1, 1, 1], vi * 3); }); loop.forEach((v, i) => { indices[ii++] = loop[(i + 1) % loop.length]; indices[ii++] = v; indices[ii++] = vi; }); vi++; });
      const capped = new THREE.BufferGeometry(); capped.setAttribute("position", new THREE.BufferAttribute(positions, 3)); capped.setIndex(new THREE.BufferAttribute(indices, 1)); capped.computeVertexNormals(); capped.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      setModelGeometry(capped); setVertexGroups(new Uint8Array(vertexCount)); setHistory([]); setGroupJointTypes({}); setManualJoints([]); setPlacementMode(false); setStats({ faces: indices.length / 3, vertices: vertexCount }); setIsCapped(true); alert(`Parte "${capSelection}" fechada!`);
    } catch (error) { console.error(error); alert("Erro ao fechar vaso."); } finally { setLoadingCap(false); setIsProcessing(false); }
  };

  const downloadCappedModel = () => {
    if (!modelGeometry) return; setIsDownloadingCapped(true); setIsProcessing(true);
    setTimeout(() => { try { const exporter = new STLExporter(); const mesh = new THREE.Mesh(modelGeometry, new THREE.MeshBasicMaterial()); const result = exporter.parse(mesh, { binary: true }); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" })); link.download = `vaso_fechado_${capSelection}.stl`; link.click(); setIsCapped(false); } finally { setIsDownloadingCapped(false); setIsProcessing(false); } }, 100);
  };

  const exportSeparatedPart = async (groupId: number) => {
    if (!modelGeometry) return; if (jointType === "default" && jointConfigurationWarning) { alert(jointConfigurationWarning); return; }
    setIsExporting(groupId); setIsProcessing(true); setProcessingMessage(`Exportando ${groupId === 0 ? "Peça Principal" : getGroupName(groupId)}...`); await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      const position = modelGeometry.attributes.position, values: number[] = [], index = modelGeometry.index;
      const add = (a: number, b: number, c: number) => { if (belongsToGroup(vertexGroups[a] || 0, vertexGroups[b] || 0, vertexGroups[c] || 0, groupId)) [a, b, c].forEach((i) => values.push(position.getX(i), position.getY(i), position.getZ(i))); };
      if (index) for (let i = 0; i < index.count; i += 3) add(index.getX(i), index.getX(i + 1), index.getX(i + 2)); else for (let i = 0; i < position.count; i += 3) if (i + 2 < position.count) add(i, i + 1, i + 2);
      if (!values.length) return;
      let geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3)); geometry = capBoundaryHoles(geometry);
      findNeighborGroups(groupId).forEach((neighborId: number) => getPairJointSpecs(groupId, neighborId).forEach((spec: any) => { const type = getEffectiveJointType(groupId, neighborId), direction = spec.normalFrom.clone(), point = spec.position; if (jointType === "magnet") geometry = addSocket(geometry, point, direction.clone().negate(), jointSizes.magnetDiameter, jointSizes.magnetDepth, 6); else if (type === "female") geometry = addReinforcedSocket(geometry, point, direction.clone().negate(), jointSizes.pegDiameter + jointSizes.fitTolerance * 2, jointSizes.pegLength + jointSizes.fitTolerance, jointSizes.reinforcementDiameter, jointSizes.reinforcementHeight, jointSizes.reinforcementWall, 6); else geometry = addPeg(geometry, point, direction, jointSizes.pegDiameter, jointSizes.pegLength, 6, 0.5); }));
      geometry.computeVertexNormals(); const result = new STLExporter().parse(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()), { binary: true }); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" })); link.download = `${fileName.replace(/\.[a-zA-Z0-9]+$/, "")}_${getGroupName(groupId).replace(/\s+/g, "_")}.stl`; link.click();
    } finally { setIsExporting(null); setIsProcessing(false); }
  };
  const exportAllSeparatedParts = async () => { if (!modelGeometry || isExporting !== null) return; for (const group of groups) if (group.id === 0 || vertexGroups.some((value) => value === group.id)) await exportSeparatedPart(group.id); };
  return { isExporting, loadingCap, isCapped, isDownloadingCapped, capHollowVase, downloadCappedModel, exportSeparatedPart, exportAllSeparatedParts };
}
