import { useMemo } from "react";
import * as THREE from "three";

export interface CookieLayer { type: "cutter" | "stamp" | "ignore"; points: THREE.Vector2[]; }

export function getOffsetPoints(points: THREE.Vector2[], offset: number): THREE.Vector2[] {
  const result: THREE.Vector2[] = [];
  if (points.length < 3) return points.map(point => point.clone());

  let cleanPoints = [...points];
  if (points[0].distanceTo(points[points.length - 1]) < 0.001) cleanPoints.pop();
  const m = cleanPoints.length;

  for (let i = 0; i < m; i++) {
    const prev = cleanPoints[(i - 1 + m) % m];
    const curr = cleanPoints[i];
    const next = cleanPoints[(i + 1) % m];
    const dir1 = new THREE.Vector2().subVectors(curr, prev).normalize();
    const dir2 = new THREE.Vector2().subVectors(next, curr).normalize();
    const norm1 = new THREE.Vector2(-dir1.y, dir1.x);
    const norm2 = new THREE.Vector2(-dir2.y, dir2.x);
    const bisectorNorm = new THREE.Vector2().addVectors(norm1, norm2).normalize();
    const cosHalfTheta = norm1.dot(bisectorNorm);
    const scale = Math.min(cosHalfTheta > 0.1 ? 1 / cosHalfTheta : 1, 2.5);
    result.push(new THREE.Vector2().copy(curr).addScaledVector(bisectorNorm, offset * scale));
  }

  if (result.length > 0) result.push(result[0].clone());
  return result;
}

export function createRibbonShapeFromPoints(points: THREE.Vector2[], thickness: number, isClosed: boolean): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length < 2) return shape;

  if (isClosed) {
    const outer = getOffsetPoints(points, thickness / 2);
    const inner = getOffsetPoints(points, -thickness / 2);
    shape.moveTo(outer[0].x, outer[0].y);
    for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].y);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(inner[0].x, inner[0].y);
    for (let i = 1; i < inner.length; i++) hole.lineTo(inner[i].x, inner[i].y);
    hole.closePath();
    shape.holes.push(hole);
  } else {
    const forward: THREE.Vector2[] = [];
    const backward: THREE.Vector2[] = [];
    for (let i = 0; i < points.length; i++) {
      const tangent = new THREE.Vector2();
      if (i === 0) tangent.subVectors(points[1], points[0]).normalize();
      else if (i === points.length - 1) tangent.subVectors(points[i], points[i - 1]).normalize();
      else {
        const t1 = new THREE.Vector2().subVectors(points[i], points[i - 1]).normalize();
        const t2 = new THREE.Vector2().subVectors(points[i + 1], points[i]).normalize();
        tangent.addVectors(t1, t2).normalize();
      }
      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      forward.push(new THREE.Vector2().copy(points[i]).addScaledVector(normal, thickness / 2));
      backward.unshift(new THREE.Vector2().copy(points[i]).addScaledVector(normal, -thickness / 2));
    }
    const combined = [...forward, ...backward];
    shape.moveTo(combined[0].x, combined[0].y);
    for (let i = 1; i < combined.length; i++) shape.lineTo(combined[i].x, combined[i].y);
    shape.closePath();
  }
  return shape;
}

export function useNormalizedCookieLayers<T extends CookieLayer>(layers: T[], size: number) {
  return useMemo(() => {
    if (!layers.length) return [] as T[];
    const active = layers.filter(layer => layer.type !== "ignore");
    if (!active.length) return [] as T[];
    const cutters = active.filter(layer => layer.type === "cutter");
    const targets = cutters.length ? cutters : active;
    const box = new THREE.Box2();
    targets.forEach(layer => layer.points.forEach(point => box.expandByPoint(point)));
    const maxDimension = Math.max(box.max.x - box.min.x, box.max.y - box.min.y);
    if (maxDimension <= 0) return layers;
    const center = new THREE.Vector2((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2);
    const scale = size / maxDimension;
    return layers.map(layer => ({
      ...layer,
      points: layer.points.map(point => new THREE.Vector2().subVectors(point, center).multiplyScalar(scale).multiply(new THREE.Vector2(1, -1))),
    }));
  }, [layers, size]);
}

export function useCookieOutline<T extends CookieLayer>(layers: T[]) {
  return useMemo(() => {
    const cutter = layers.find(layer => layer.type === "cutter");
    if (cutter) return cutter.points;
    let largest = layers[0]; let maxArea = -1;
    layers.forEach(layer => {
      if (layer.type === "ignore") return;
      const box = new THREE.Box2(); layer.points.forEach(point => box.expandByPoint(point));
      const area = (box.max.x - box.min.x) * (box.max.y - box.min.y);
      if (area > maxArea) { maxArea = area; largest = layer; }
    });
    return largest?.points ?? [];
  }, [layers]);
}
