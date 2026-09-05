import { useState, useCallback } from "react";
import * as THREE from "three";

export interface ConnectorPoint {
  id: string;
  groupId: number;
  role: "male" | "female";
  pairId: string;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  scale?: number;
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
  const [connectorPoints, setConnectorPoints] = useState<ConnectorPoint[]>([]);
  const [pendingConnector, setPendingConnector] = useState<{ groupId: number; role: "male" | "female"; position: THREE.Vector3; normal: THREE.Vector3 } | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState(false);

  const setGroupJointType = (groupId: number, type: "male" | "female" | "auto") => setGroupJointTypes((prev) => ({ ...prev, [groupId]: type }));
  const getGroupName = useCallback((id: number) => groups.find((group) => group.id === id)?.name || `Parte ${id}`, [groups]);
  const getEffectiveJointType = useCallback((groupId: number, neighborId: number): "male" | "female" => {
    const groupType = groupJointTypes[groupId];
    const neighborType = groupJointTypes[neighborId];
    if (groupType === "male" || groupType === "female") return groupType;
    if (neighborType === "male") return "female";
    if (neighborType === "female") return "male";
    return groupId < neighborId ? "female" : "male";
  }, [groupJointTypes]);

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

  const findNeighborGroups = useCallback((groupId: number) => {
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
    connectorPoints.forEach((pt) => {
      const pair = connectorPoints.find((p) => p.pairId === pt.pairId && p.id !== pt.id);
      if (pair && pt.groupId === groupId) neighbors.add(pair.groupId);
    });
    return Array.from(neighbors);
  }, [modelGeometry, adjacencyList, vertexGroups, groups, connectorPoints]);

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

  const getPairJointSpecs = useCallback((groupId: number, neighborId: number): JointSpec[] => {
    const pairPoints = connectorPoints.filter((pt) => {
      if (pt.groupId !== groupId) return false;
      const pair = connectorPoints.find((p) => p.pairId === pt.pairId && p.id !== pt.id);
      return pair && pair.groupId === neighborId;
    });
    if (pairPoints.length) return pairPoints.map((pt) => ({ position: pt.position.clone(), normalFrom: pt.normal.clone(), manualId: pt.id }));
    const anchor = computeGroupPairAnchor(groupId, neighborId);
    return anchor ? [{ position: anchor.position, normalFrom: anchor.normalA }] : [];
  }, [connectorPoints, modelGeometry, adjacencyList, vertexGroups, groups]);

  const placeJointAt = (clickPoint: THREE.Vector3, clickGroupId: number) => {
    if (!modelGeometry || !adjacencyList) return;
    const position = modelGeometry.attributes.position;

    const faceNormal = new THREE.Vector3();
    let bestVertexIdx = -1, bestDist = Infinity;
    for (let i = 0; i < position.count; i++) {
      if ((vertexGroups[i] || 0) !== clickGroupId) continue;
      const dx = position.getX(i) - clickPoint.x, dy = position.getY(i) - clickPoint.y, dz = position.getZ(i) - clickPoint.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestDist) { bestDist = d; bestVertexIdx = i; }
    }
    if (bestVertexIdx >= 0) {
      const nx = position.getX(bestVertexIdx), ny = position.getY(bestVertexIdx), nz = position.getZ(bestVertexIdx);
      const neighbors = adjacencyList[bestVertexIdx];
      if (neighbors) {
        let avgNx = 0, avgNy = 0, avgNz = 0, count = 0;
        for (const ni of neighbors) {
          if ((vertexGroups[ni] || 0) !== clickGroupId) continue;
          avgNx += position.getX(ni) - nx; avgNy += position.getY(ni) - ny; avgNz += position.getZ(ni) - nz; count++;
        }
        if (count > 0) { faceNormal.set(avgNx / count, avgNy / count, avgNz / count).normalize().negate(); }
        else { faceNormal.copy(clickPoint).sub(modelGeometry.boundingSphere?.center || new THREE.Vector3()).normalize(); }
      } else {
        faceNormal.copy(clickPoint).sub(modelGeometry.boundingSphere?.center || new THREE.Vector3()).normalize();
      }
    } else {
      faceNormal.copy(clickPoint).sub(modelGeometry.boundingSphere?.center || new THREE.Vector3()).normalize();
    }

    if (!pendingConnector) {
      const newPending = { groupId: clickGroupId, role: "male" as const, position: clickPoint.clone(), normal: faceNormal.clone() };
      setPendingConnector(newPending);
      return;
    }

    if (clickGroupId === pendingConnector.groupId) return;

    const pairId = crypto.randomUUID?.() || `p${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const pegId = crypto.randomUUID?.() || `c${Date.now()}-peg`;
    const socketId = crypto.randomUUID?.() || `c${Date.now()}-socket`;
    const pegPoint: ConnectorPoint = { id: pegId, groupId: pendingConnector.groupId, role: "male", pairId, position: pendingConnector.position.clone(), normal: pendingConnector.normal.clone() };
    const socketPoint: ConnectorPoint = { id: socketId, groupId: clickGroupId, role: "female", pairId, position: clickPoint.clone(), normal: faceNormal.clone().negate() };
    setConnectorPoints((prev) => [...prev, pegPoint, socketPoint]);
    setPendingConnector(null);
    setSelectedConnectorId(pegId);
  };

  const cancelPendingConnector = () => setPendingConnector(null);

  const selectPreviewJoint = (joint: { id?: string; groupId: number; neighborId: number; type: "peg" | "socket" | "magnet"; position: THREE.Vector3; direction: THREE.Vector3 }) => {
    if (joint.id) { setSelectedConnectorId(joint.id); return joint.id; }
    const existing = connectorPoints.find((pt) => pt.groupId === joint.groupId);
    if (existing) { setSelectedConnectorId(existing.id); return existing.id; }
    const pairId = crypto.randomUUID?.() || `p${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const id = crypto.randomUUID?.() || `c${Date.now()}`;
    const role = joint.type === "peg" ? "male" as const : joint.type === "socket" ? "female" as const : "male" as const;
    setConnectorPoints((prev) => [...prev, { id, groupId: joint.groupId, role, pairId, position: joint.position.clone(), normal: (joint.type === "peg" ? joint.direction : joint.direction.clone().negate()).normalize() }]);
    setSelectedConnectorId(id); return id;
  };

  const moveConnectorToBoundary = (pointId: string, point: THREE.Vector3, groupId: number) => {
    if (!modelGeometry || !adjacencyList) return;
    const position = modelGeometry.attributes.position; let best: THREE.Vector3 | null = null, distance = Infinity;
    for (let i = 0; i < position.count; i++) if ((vertexGroups[i] || 0) === groupId) for (const neighbor of adjacencyList[i] || []) {
      if ((vertexGroups[neighbor] || 0) === groupId) continue;
      const candidate = new THREE.Vector3((position.getX(i) + position.getX(neighbor)) / 2, (position.getY(i) + position.getY(neighbor)) / 2, (position.getZ(i) + position.getZ(neighbor)) / 2);
      const candidateDistance = candidate.distanceToSquared(point); if (candidateDistance < distance) { distance = candidateDistance; best = candidate; }
    }
    if (best) setConnectorPoints((prev) => prev.map((pt) => pt.id === pointId ? { ...pt, position: best! } : pt));
  };
  const moveConnectorFromRay = (pointId: string, ray: THREE.Ray, groupId: number, offset: THREE.Vector3) => {
    const current = connectorPoints.find((pt) => pt.id === pointId); if (!current) return;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(ray.direction, current.position.clone().add(offset));
    const pt = ray.intersectPlane(plane, new THREE.Vector3()); if (pt) moveConnectorToBoundary(pointId, pt.sub(offset), groupId);
  };
  const updateConnectorPosition = (axis: "x" | "y" | "z", value: number) => {
    if (!selectedConnectorId || !Number.isFinite(value)) return;
    setConnectorPoints((prev) => prev.map((pt) => { if (pt.id !== selectedConnectorId) return pt; const position = pt.position.clone(); position[axis] = value; return { ...pt, position }; }));
  };
  const selectedConnector = connectorPoints.find((pt) => pt.id === selectedConnectorId) || null;
  const jointBounds = modelGeometry?.boundingBox;
  const clearConnectorPoints = () => { setConnectorPoints([]); setSelectedConnectorId(null); setPendingConnector(null); };
  const removeConnectorPoint = (id: string) => {
    const pt = connectorPoints.find((p) => p.id === id);
    if (pt) setConnectorPoints((prev) => prev.filter((p) => p.pairId !== pt.pairId));
    if (selectedConnectorId === id) setSelectedConnectorId(null);
  };

  return { groupJointTypes, setGroupJointTypes, setGroupJointType, getEffectiveJointType, findNeighborGroups, getPairJointSpecs, getGroupName, connectorPoints, setConnectorPoints, selectedConnectorId, setSelectedConnectorId, selectedConnector, jointBounds, placementMode, setPlacementMode, placeJointAt, selectPreviewJoint, moveConnectorFromRay, updateConnectorPosition, clearConnectorPoints, removeConnectorPoint, pendingConnector, cancelPendingConnector };
}
