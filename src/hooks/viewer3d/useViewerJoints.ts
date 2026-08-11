import { useState } from "react";
import * as THREE from "three";

export interface ManualJoint {
  id: string;
  groupA: number;
  groupB: number;
  position: THREE.Vector3;
  normalA: THREE.Vector3;
}

export interface JointSpec {
  position: THREE.Vector3;
  normalFrom: THREE.Vector3;
  manualId?: string;
}

export function useViewerJoints({
  modelGeometry, vertexGroups, adjacencyList, groups, jointType, jointSizes,
}: {
  modelGeometry: THREE.BufferGeometry | null;
  vertexGroups: Uint8Array;
  adjacencyList: Set<number>[] | null;
  groups: { id: number; name: string }[];
  jointType: "default" | "magnet";
  jointSizes: { pegDiameter: number; pegLength: number; fitTolerance: number; magnetDiameter: number; magnetDepth: number; reinforcementDiameter: number; reinforcementHeight: number; reinforcementWall: number };
}) {
  const [groupJointTypes, setGroupJointTypes] = useState<Record<number, "male" | "female" | "auto">>({});
  const [manualJoints, setManualJoints] = useState<ManualJoint[]>([]);
  const [selectedManualJointId, setSelectedManualJointId] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState(false);

  const setGroupJointType = (groupId: number, type: "male" | "female" | "auto") => setGroupJointTypes((prev) => ({ ...prev, [groupId]: type }));
  const getGroupName = (id: number) => groups.find((group) => group.id === id)?.name || `Parte ${id}`;
  const getEffectiveJointType = (groupId: number, neighborId: number): "male" | "female" => {
    const groupType = groupJointTypes[groupId];
    const neighborType = groupJointTypes[neighborId];
    if (groupType === "male" || groupType === "female") return groupType;
    if (neighborType === "male") return "female";
    if (neighborType === "female") return "male";
    return groupId < neighborId ? "female" : "male";
  };

  const computeGroupCentroid = (groupId: number) => {
    if (!modelGeometry) return null;
    const position = modelGeometry.attributes.position;
    const centroid = new THREE.Vector3();
    let count = 0;
    for (let i = 0; i < position.count; i++) if ((vertexGroups[i] || 0) === groupId) {
      centroid.x += position.getX(i); centroid.y += position.getY(i); centroid.z += position.getZ(i); count++;
    }
    return count ? centroid.divideScalar(count) : null;
  };

  const findNeighborGroups = (groupId: number) => {
    if (!modelGeometry || !adjacencyList) return [];
    const neighbors = new Set<number>();
    const position = modelGeometry.attributes.position;
    for (let i = 0; i < position.count; i++) if ((vertexGroups[i] || 0) === groupId) {
      for (const neighbor of adjacencyList[i] || []) {
        const neighborGroup = vertexGroups[neighbor] || 0;
        if (neighborGroup !== groupId) neighbors.add(neighborGroup);
      }
    }
    if (!neighbors.size) {
      const size = modelGeometry.boundingBox?.getSize(new THREE.Vector3()).length() || 1;
      const maxDistanceSq = Math.pow(size * 0.15, 2);
      const step = Math.max(1, Math.floor(position.count / 400));
      const source: THREE.Vector3[] = [];
      for (let i = 0; i < position.count; i += step) if ((vertexGroups[i] || 0) === groupId) source.push(new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)));
      groups.forEach((candidate) => {
        if (candidate.id === groupId) return;
        let nearest = Infinity;
        for (let i = 0; i < position.count; i += step) if ((vertexGroups[i] || 0) === candidate.id) {
          const point = new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
          for (const sourcePoint of source) nearest = Math.min(nearest, sourcePoint.distanceToSquared(point));
        }
        if (nearest <= maxDistanceSq) neighbors.add(candidate.id);
      });
    }
    manualJoints.forEach((joint) => {
      if (joint.groupA === groupId) neighbors.add(joint.groupB);
      if (joint.groupB === groupId) neighbors.add(joint.groupA);
    });
    return Array.from(neighbors);
  };

  const computeGroupPairAnchor = (groupId: number, neighborId: number) => {
    if (!modelGeometry || !adjacencyList) return null;
    const centroidA = computeGroupCentroid(groupId), centroidB = computeGroupCentroid(neighborId);
    if (!centroidA || !centroidB) return null;
    let normalA = new THREE.Vector3().subVectors(centroidB, centroidA).normalize();
    const position = modelGeometry.attributes.position;
    const target = centroidA.clone().add(centroidB).multiplyScalar(0.5);
    let best: THREE.Vector3 | null = null, bestDistance = Infinity;
    const localDirection = new THREE.Vector3(); let directionCount = 0;
    for (let i = 0; i < position.count; i++) if ((vertexGroups[i] || 0) === groupId) {
      for (const neighbor of adjacencyList[i] || []) if ((vertexGroups[neighbor] || 0) === neighborId) {
        const point = new THREE.Vector3((position.getX(i) + position.getX(neighbor)) / 2, (position.getY(i) + position.getY(neighbor)) / 2, (position.getZ(i) + position.getZ(neighbor)) / 2);
        const distance = point.distanceToSquared(target);
        if (distance < bestDistance) { bestDistance = distance; best = point; }
        localDirection.add(new THREE.Vector3(position.getX(neighbor) - position.getX(i), position.getY(neighbor) - position.getY(i), position.getZ(neighbor) - position.getZ(i))); directionCount++;
      }
    }
    if (directionCount && localDirection.lengthSq()) { localDirection.normalize(); if (localDirection.dot(normalA) < 0) localDirection.negate(); normalA = localDirection; }
    if (!best) {
      const samplesA: THREE.Vector3[] = [], samplesB: THREE.Vector3[] = [], step = Math.max(1, Math.floor(position.count / 600));
      for (let i = 0; i < position.count; i += step) {
        const point = new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
        if ((vertexGroups[i] || 0) === groupId) samplesA.push(point); else if ((vertexGroups[i] || 0) === neighborId) samplesB.push(point);
      }
      let closest = Infinity, a: THREE.Vector3 | null = null, b: THREE.Vector3 | null = null;
      samplesA.forEach((pointA) => samplesB.forEach((pointB) => { const distance = pointA.distanceToSquared(pointB); if (distance < closest) { closest = distance; a = pointA; b = pointB; } }));
      if (a && b) { best = a.clone().add(b).multiplyScalar(0.5); normalA = b.clone().sub(a).normalize(); }
    }
    return best ? { position: best, normalA } : null;
  };

  const getPairJointSpecs = (groupId: number, neighborId: number): JointSpec[] => {
    const manual = manualJoints.filter((joint) => (joint.groupA === groupId && joint.groupB === neighborId) || (joint.groupA === neighborId && joint.groupB === groupId));
    if (manual.length) return manual.map((joint) => ({ position: joint.position.clone(), normalFrom: joint.groupA === groupId ? joint.normalA.clone() : joint.normalA.clone().negate(), manualId: joint.id }));
    const anchor = computeGroupPairAnchor(groupId, neighborId);
    return anchor ? [{ position: anchor.position, normalFrom: anchor.normalA }] : [];
  };

  const placeJointAt = (clickPoint: THREE.Vector3, clickGroupId: number) => {
    if (!modelGeometry || !adjacencyList) return;
    const position = modelGeometry.attributes.position;
    let bestPosition: THREE.Vector3 | null = null, bestGroupA = -1, bestGroupB = -1, bestDistance = Infinity;
    for (let i = 0; i < position.count; i++) for (const neighbor of adjacencyList[i] || []) {
      const groupA = vertexGroups[i] || 0, groupB = vertexGroups[neighbor] || 0;
      if (groupA === groupB || (clickGroupId !== 0 && groupA !== clickGroupId && groupB !== clickGroupId)) continue;
      const point = new THREE.Vector3((position.getX(i) + position.getX(neighbor)) / 2, (position.getY(i) + position.getY(neighbor)) / 2, (position.getZ(i) + position.getZ(neighbor)) / 2);
      const distance = point.distanceToSquared(clickPoint);
      if (distance < bestDistance) { bestDistance = distance; bestPosition = point; bestGroupA = groupA; bestGroupB = groupB; }
    }
    if (!bestPosition) {
      const candidate = findNeighborGroups(clickGroupId).map((neighborId) => ({ neighborId, anchor: computeGroupPairAnchor(clickGroupId, neighborId) })).filter((item): item is { neighborId: number; anchor: { position: THREE.Vector3; normalA: THREE.Vector3 } } => !!item.anchor).sort((a, b) => a.anchor.position.distanceToSquared(clickPoint) - b.anchor.position.distanceToSquared(clickPoint))[0];
      if (candidate) { bestPosition = candidate.anchor.position; bestGroupA = clickGroupId; bestGroupB = candidate.neighborId; }
    }
    if (!bestPosition) { alert("Não foi encontrada outra peça próxima para conectar."); return; }
    const existing = manualJoints.find((joint) => (joint.groupA === bestGroupA && joint.groupB === bestGroupB) || (joint.groupA === bestGroupB && joint.groupB === bestGroupA));
    if (existing) { setSelectedManualJointId(existing.id); return; }
    const centroidA = computeGroupCentroid(bestGroupA), centroidB = computeGroupCentroid(bestGroupB);
    if (!centroidA || !centroidB) return;
    const id = crypto.randomUUID?.() || `j${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setManualJoints((prev) => [...prev, { id, groupA: bestGroupA, groupB: bestGroupB, position: bestPosition!, normalA: computeGroupPairAnchor(bestGroupA, bestGroupB)?.normalA || centroidB.sub(centroidA).normalize() }]);
    setSelectedManualJointId(id);
  };

  const selectPreviewJoint = (joint: { id?: string; groupId: number; neighborId: number; type: "peg" | "socket" | "magnet"; position: THREE.Vector3; direction: THREE.Vector3 }) => {
    if (joint.id) { setSelectedManualJointId(joint.id); return joint.id; }
    const existing = manualJoints.find((item) => (item.groupA === joint.groupId && item.groupB === joint.neighborId) || (item.groupA === joint.neighborId && item.groupB === joint.groupId));
    if (existing) { setSelectedManualJointId(existing.id); return existing.id; }
    const id = crypto.randomUUID?.() || `j${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setManualJoints((prev) => [...prev, { id, groupA: joint.groupId, groupB: joint.neighborId, position: joint.position.clone(), normalA: (joint.type === "peg" ? joint.direction : joint.direction.clone().negate()).normalize() }]);
    setSelectedManualJointId(id); return id;
  };

  const moveManualJointToBoundary = (jointId: string, point: THREE.Vector3, groupId: number) => {
    if (!modelGeometry || !adjacencyList) return;
    const position = modelGeometry.attributes.position; let best: THREE.Vector3 | null = null, distance = Infinity;
    for (let i = 0; i < position.count; i++) if ((vertexGroups[i] || 0) === groupId) for (const neighbor of adjacencyList[i] || []) {
      if ((vertexGroups[neighbor] || 0) === groupId) continue;
      const candidate = new THREE.Vector3((position.getX(i) + position.getX(neighbor)) / 2, (position.getY(i) + position.getY(neighbor)) / 2, (position.getZ(i) + position.getZ(neighbor)) / 2);
      const candidateDistance = candidate.distanceToSquared(point); if (candidateDistance < distance) { distance = candidateDistance; best = candidate; }
    }
    if (best) setManualJoints((prev) => prev.map((joint) => joint.id === jointId ? { ...joint, position: best! } : joint));
  };
  const moveManualJointFromRay = (jointId: string, ray: THREE.Ray, groupId: number, offset: THREE.Vector3) => {
    const current = manualJoints.find((joint) => joint.id === jointId); if (!current) return;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(ray.direction, current.position.clone().add(offset));
    const point = ray.intersectPlane(plane, new THREE.Vector3()); if (point) moveManualJointToBoundary(jointId, point.sub(offset), groupId);
  };
  const updateManualJointPosition = (axis: "x" | "y" | "z", value: number) => {
    if (!selectedManualJointId || !Number.isFinite(value)) return;
    setManualJoints((prev) => prev.map((joint) => { if (joint.id !== selectedManualJointId) return joint; const position = joint.position.clone(); position[axis] = value; return { ...joint, position }; }));
  };
  const selectedManualJoint = manualJoints.find((joint) => joint.id === selectedManualJointId) || null;
  const jointBounds = modelGeometry?.boundingBox;
  const clearManualJoints = () => { setManualJoints([]); setSelectedManualJointId(null); };

  return { groupJointTypes, setGroupJointTypes, setGroupJointType, getEffectiveJointType, findNeighborGroups, getPairJointSpecs, getGroupName, manualJoints, setManualJoints, selectedManualJointId, setSelectedManualJointId, selectedManualJoint, jointBounds, placementMode, setPlacementMode, placeJointAt, selectPreviewJoint, moveManualJointFromRay, updateManualJointPosition, clearManualJoints };
}
