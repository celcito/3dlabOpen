import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { capBoundaryHoles, booleanDifferenceWithTolerance, booleanUnionWithTolerance } from "../../../lib/csg";

function classifyTriangleGroup(g0: number, g1: number, g2: number, target: number) {
  if (target === 0) return g0 === 0 && g1 === 0 && g2 === 0;
  return [g0, g1, g2].filter((group) => group === target).length >= 2;
}

export function useViewerSeparatedPreview({
  previewSeparated, modelGeometry, vertexGroups, groups, jointType, jointSizes, findNeighborGroups, getPairJointSpecs, getEffectiveJointType, getGroupName, setPlacementMode, showConnectors = true, booleanMode = false, booleanTolerance = 0.2,
}: any) {
  const [finalizedPreview, setFinalizedPreview] = useState(false);
  const [previewValidation, setPreviewValidation] = useState<"idle" | "valid" | "warning">("idle");
  const [separationDistance, setSeparationDistance] = useState(1);

  const subGeometries = useMemo(() => {
    if (!previewSeparated || !modelGeometry) return [];
    const position = modelGeometry.attributes.position, index = modelGeometry.index, normal = modelGeometry.attributes.normal;
    const center = new THREE.Vector3(); const step = Math.max(1, Math.floor(position.count / 1000));
    let sampleCount = 0;
    for (let i = 0; i < position.count; i += step) { center.x += position.getX(i); center.y += position.getY(i); center.z += position.getZ(i); sampleCount++; }
    center.divideScalar(sampleCount || 1);
    return Array.from(new Set([0, ...groups.map((group: any) => group.id)])).flatMap((groupId) => {
      const positions: number[] = [], normals: number[] = []; let sum = new THREE.Vector3(); let count = 0;
      const add = (a: number, b: number, c: number) => {
        const g0 = vertexGroups[a] || 0, g1 = vertexGroups[b] || 0, g2 = vertexGroups[c] || 0; if (!classifyTriangleGroup(g0, g1, g2, groupId)) return;
        [a, b, c].forEach((i) => { positions.push(position.getX(i), position.getY(i), position.getZ(i)); sum.add(new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i))); if (normal) normals.push(normal.getX(i), normal.getY(i), normal.getZ(i)); count++; });
      };
      if (index) for (let i = 0; i < index.count; i += 3) add(index.getX(i), index.getX(i + 1), index.getX(i + 2));
      else for (let i = 0; i < position.count; i += 3) if (i + 2 < position.count) add(i, i + 1, i + 2);
      if (!positions.length) return [];
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); if (normals.length) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      const direction = sum.divideScalar(count || 1).sub(center); if (direction.lengthSq() < 0.0001) direction.set((groupId % 3 - 1) * 0.5, ((groupId + 1) % 3 - 1) * 0.5, ((groupId + 2) % 3 - 1) * 0.5); direction.normalize();
      const group = groups.find((item: any) => item.id === groupId);
      return [{ groupId, color: group?.color || "#888888", name: group?.name || "Restante", geometry, direction }];
    });
  }, [previewSeparated, modelGeometry, vertexGroups, groups]);

  const jointGeometries = useMemo(() => {
    if (!previewSeparated || !modelGeometry || !showConnectors) return [];
    const joints: any[] = [];
    groups.forEach((group: any) => {
      if (group.id === 0) return;
      findNeighborGroups(group.id).forEach((neighborId: number) => getPairJointSpecs(group.id, neighborId).forEach((spec: any) => {
        const type = getEffectiveJointType(group.id, neighborId), intoGroup = spec.normalFrom.clone().negate();
        if (jointType === "magnet") joints.push({ id: spec.manualId, groupId: group.id, neighborId, type: "magnet", position: spec.position.clone(), direction: intoGroup, color: "#FFD700", neighborName: getGroupName(neighborId) });
        else if (type === "female") joints.push({ id: spec.manualId, groupId: group.id, neighborId, type: "socket", position: spec.position.clone(), direction: intoGroup, color: "#FF1744", neighborName: getGroupName(neighborId), reinforcement: { diameter: jointSizes.reinforcementDiameter, height: jointSizes.reinforcementHeight, wall: jointSizes.reinforcementWall } });
        else joints.push({ id: spec.manualId, groupId: group.id, neighborId, type: "peg", position: spec.position.clone(), direction: spec.normalFrom.clone(), color: "#00E5FF", neighborName: getGroupName(neighborId) });
      }));
    });
    return joints;
  }, [previewSeparated, modelGeometry, groups, vertexGroups, jointType, jointSizes, findNeighborGroups, getPairJointSpecs, getEffectiveJointType, getGroupName, showConnectors]);

  const extractGroupGeometry = (groupId: number): THREE.BufferGeometry | null => {
    if (!modelGeometry) return null;
    const position = modelGeometry.attributes.position;
    const index = modelGeometry.index;
    const positions: number[] = [];
    const addTri = (a: number, b: number, c: number) => {
      const g0 = vertexGroups[a] || 0, g1 = vertexGroups[b] || 0, g2 = vertexGroups[c] || 0;
      if (!classifyTriangleGroup(g0, g1, g2, groupId)) return;
      positions.push(
        position.getX(a), position.getY(a), position.getZ(a),
        position.getX(b), position.getY(b), position.getZ(b),
        position.getX(c), position.getY(c), position.getZ(c),
      );
    };
    if (index) {
      const arr = index.array;
      for (let i = 0; i < arr.length; i += 3) addTri(arr[i], arr[i + 1], arr[i + 2]);
    } else {
      const count = position.count;
      for (let i = 0; i < count; i += 3) if (i + 2 < count) addTri(i, i + 1, i + 2);
    }
    if (positions.length === 0) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return capBoundaryHoles(geom);
  };

  const booleanSubGeometries = useMemo(() => {
    if (!previewSeparated || !modelGeometry || !booleanMode) return [];
    const center = new THREE.Vector3();
    const position = modelGeometry.attributes.position;
    const step = Math.max(1, Math.floor(position.count / 1000));
    let sampleCount = 0;
    for (let i = 0; i < position.count; i += step) { center.x += position.getX(i); center.y += position.getY(i); center.z += position.getZ(i); sampleCount++; }
    center.divideScalar(sampleCount || 1);

    return Array.from(new Set([0, ...groups.map((g: any) => g.id)])).flatMap((groupId) => {
      let geom = extractGroupGeometry(groupId);
      if (!geom) return [];

      const neighbors = findNeighborGroups(groupId);
      for (const neighborId of neighbors) {
        if (neighborId === 0) continue;
        const myType = getEffectiveJointType(groupId, neighborId);
        const neighborGeom = extractGroupGeometry(neighborId);
        if (!neighborGeom) continue;
        try {
          if (myType === 'female') {
            geom = booleanDifferenceWithTolerance(geom, neighborGeom, booleanTolerance);
          } else {
            geom = booleanUnionWithTolerance(geom, neighborGeom, booleanTolerance);
          }
        } catch (err) {
          console.warn(`[boolean preview] CSG failed for ${groupId}x${neighborId}:`, err);
        }
      }

      geom.computeVertexNormals();
      const sum = new THREE.Vector3();
      const posAttr = geom.attributes.position;
      for (let i = 0; i < posAttr.count; i++) { sum.x += posAttr.getX(i); sum.y += posAttr.getY(i); sum.z += posAttr.getZ(i); }
      const centroid = sum.divideScalar(posAttr.count || 1);
      const direction = centroid.sub(center);
      if (direction.lengthSq() < 0.0001) direction.set((groupId % 3 - 1) * 0.5, ((groupId + 1) % 3 - 1) * 0.5, ((groupId + 2) % 3 - 1) * 0.5);
      direction.normalize();

      const group = groups.find((g: any) => g.id === groupId);
      return [{ groupId, color: group?.color || "#888888", name: group?.name || "Restante", geometry: geom, direction }];
    });
  }, [previewSeparated, modelGeometry, vertexGroups, groups, booleanMode, booleanTolerance, findNeighborGroups, getEffectiveJointType]);

  const validatePreviewJoints = () => {
    if (booleanMode) {
      setPreviewValidation("valid"); setFinalizedPreview(true); setSeparationDistance(0); setPlacementMode(false);
      return;
    }
    const pairs = new Map<string, { peg: number; socket: number; magnet: number }>();
    jointGeometries.forEach((joint: any) => { const key = [joint.groupId, joint.neighborId].sort((a, b) => a - b).join(":"); const pair = pairs.get(key) || { peg: 0, socket: 0, magnet: 0 }; pair[joint.type]++; pairs.set(key, pair); });
    const valid = pairs.size > 0 && Array.from(pairs.values()).every((pair) => jointType === "magnet" ? pair.magnet >= 2 : pair.peg > 0 && pair.socket > 0);
    setPreviewValidation(valid ? "valid" : "warning"); setFinalizedPreview(true); setSeparationDistance(0); setPlacementMode(false);
    if (!valid) alert("Atenção: o preview não encontrou um par completo de macho e fêmea. Ajuste a fronteira ou o tipo das peças.");
  };
  useEffect(() => () => { subGeometries.forEach((sub: any) => sub.geometry.dispose()); booleanSubGeometries.forEach((sub: any) => sub.geometry.dispose()); }, [subGeometries, booleanSubGeometries]);
  const effectiveSubGeometries = booleanMode ? booleanSubGeometries : subGeometries;
  return { subGeometries: effectiveSubGeometries, jointGeometries: booleanMode ? [] : jointGeometries, finalizedPreview, setFinalizedPreview, previewValidation, setPreviewValidation, separationDistance, setSeparationDistance, validatePreviewJoints };
}
