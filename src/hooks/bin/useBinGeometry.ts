import { useMemo } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import type { BinConfig, BatterySlotGroup, BatteryType } from "../useBinGenerator";

export function createRoundedRectShape(w: number, d: number, r: number) {
  const shape = new THREE.Shape();
  if (r <= 0) {
    shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2, -d / 2); shape.lineTo(w / 2, d / 2);
    shape.lineTo(-w / 2, d / 2); shape.lineTo(-w / 2, -d / 2); return shape;
  }
  shape.moveTo(-w / 2 + r, -d / 2); shape.lineTo(w / 2 - r, -d / 2);
  shape.absarc(w / 2 - r, -d / 2 + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(w / 2, d / 2 - r); shape.absarc(w / 2 - r, d / 2 - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-w / 2 + r, d / 2); shape.absarc(-w / 2 + r, d / 2 - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w / 2, -d / 2 + r); shape.absarc(-w / 2 + r, -d / 2 + r, r, Math.PI, Math.PI * 1.5, false);
  shape.closePath(); return shape;
}

export function createRoundedRectPath(w: number, d: number, r: number) {
  const path = new THREE.Path();
  if (r <= 0) {
    path.moveTo(-w / 2, -d / 2); path.lineTo(-w / 2, d / 2); path.lineTo(w / 2, d / 2);
    path.lineTo(w / 2, -d / 2); path.lineTo(-w / 2, -d / 2); return path;
  }
  path.moveTo(-w / 2, -d / 2 + r); path.lineTo(-w / 2, d / 2 - r);
  path.absarc(-w / 2 + r, d / 2 - r, r, Math.PI, Math.PI / 2, true);
  path.lineTo(w / 2 - r, d / 2); path.absarc(w / 2 - r, d / 2 - r, r, Math.PI / 2, 0, true);
  path.lineTo(w / 2, -d / 2 + r); path.absarc(w / 2 - r, -d / 2 + r, r, 0, -Math.PI / 2, true);
  path.lineTo(-w / 2 + r, -d / 2); path.absarc(-w / 2 + r, -d / 2 + r, r, -Math.PI / 2, -Math.PI, true);
  return path;
}

const BATTERY_DIMS: Record<BatteryType, { r: number; w: number; d: number }> = {
  aa: { r: 0.75, w: 0, d: 0 }, aaa: { r: 0.55, w: 0, d: 0 }, "9v": { r: 0, w: 1.75, d: 2.65 }, cr: { r: 0, w: 0, d: 0 },
};
const getBatteryRadius = (type: BatteryType, diameter: number) => type === "cr" ? (diameter || 20) / 20 + 0.03 : BATTERY_DIMS[type].r;

function buildSlots(groups: BatterySlotGroup[], innerW: number, innerD: number, h: number, t: number) {
  const holes: THREE.BufferGeometry[] = [], cradles: THREE.BufferGeometry[] = [];
  const totalRows = groups.reduce((sum, group) => sum + group.rows, 0); let yOffset = 0;
  groups.forEach(group => {
    const groupH = group.rows / totalRows * innerD, sx = innerW / group.cols, sy = groupH / group.rows;
    for (let x = 0; x < group.cols; x++) for (let y = 0; y < group.rows; y++) {
      const cx = -innerW / 2 + sx / 2 + x * sx, cy = -innerD / 2 + yOffset + sy / 2 + y * sy;
      if (group.style === "hole") {
        const radius = getBatteryRadius(group.batteryType, group.crDiameter);
        const geom = group.batteryType === "9v" ? new THREE.BoxGeometry(1.75, 2.65, h - t + 0.2) : new THREE.CylinderGeometry(radius, radius, h - t + 0.2, 24);
        geom.translate(cx, cy, t + (h - t + 0.2) / 2); holes.push(geom);
      } else {
        const radius = getBatteryRadius(group.batteryType, group.crDiameter);
        const outer = group.batteryType === "9v" ? createRoundedRectShape(1.75 + 2 * t + 0.06, 2.65 + 2 * t + 0.06, 0.1) : (() => { const s = new THREE.Shape(); s.absarc(0, 0, radius + t, 0, Math.PI * 2, false); return s; })();
        const inner = group.batteryType === "9v" ? createRoundedRectPath(1.75 + 0.06, 2.65 + 0.06, 0.05) : (() => { const p = new THREE.Path(); p.absarc(0, 0, radius + 0.04, 0, Math.PI * 2, true); return p; })();
        outer.holes.push(inner);
        const wall = new THREE.ExtrudeGeometry(outer, { depth: h - t, bevelEnabled: false, curveSegments: 16 });
        wall.translate(cx, cy, t);
        const base = new THREE.ExtrudeGeometry(group.batteryType === "9v" ? createRoundedRectShape(1.75 + 2 * t + 0.06, 2.65 + 2 * t + 0.06, 0.1) : (() => { const s = new THREE.Shape(); s.absarc(0, 0, radius + t, 0, Math.PI * 2, false); return s; })(), { depth: t, bevelEnabled: false, curveSegments: 16 });
        base.translate(cx, cy, 0); cradles.push(base, wall);
      }
    }
    yOffset += groupH;
  });
  return { holes, cradles };
}

export function useBinGeometry(config: BinConfig) {
  const { width, depth, height, thickness, radius, stackable, slotGroups } = config;
  const w = width / 10, d = depth / 10, h = height / 10, t = thickness / 10;
  const r = Math.min(radius / 10, w / 2, d / 2), innerW = w - t * 2, innerD = d - t * 2;
  const geometry = useMemo(() => {
    const baseShape = createRoundedRectShape(w, d, r);
    const baseGeom = new THREE.ExtrudeGeometry(baseShape, { depth: t, bevelEnabled: false, curveSegments: 24 });
    const wallShape = createRoundedRectShape(w, d, r);
    wallShape.holes.push(createRoundedRectPath(innerW, innerD, Math.max(0, r - t)));
    const wallGeom = new THREE.ExtrudeGeometry(wallShape, { depth: h - t, bevelEnabled: false, curveSegments: 24 });
    let lipGeom: THREE.BufferGeometry | null = null;
    if (stackable) {
      const lipW = innerW - 0.04, lipD = innerD - 0.04, lipR = Math.max(0, r - t - 0.02);
      const lipShape = createRoundedRectShape(lipW, lipD, lipR);
      if (lipW - t * 2 > 0 && lipD - t * 2 > 0) lipShape.holes.push(createRoundedRectPath(lipW - t * 2, lipD - t * 2, Math.max(0, lipR - t)));
      lipGeom = new THREE.ExtrudeGeometry(lipShape, { depth: Math.min(t, 0.4), bevelEnabled: false, curveSegments: 24 });
    }
    return { baseGeom, wallGeom, lipGeom };
  }, [w, d, h, t, r, innerW, innerD, stackable]);
  const slotGeoms = useMemo(() => buildSlots(slotGroups, innerW, innerD, h, t), [slotGroups, innerW, innerD, h, t]);
  const finalMesh = useMemo(() => {
    if (!slotGeoms.holes.length && !slotGeoms.cradles.length) return null;
    const toNI = (g: THREE.BufferGeometry) => g.clone().toNonIndexed();
    const combined = BufferGeometryUtils.mergeGeometries([toNI(geometry.baseGeom), toNI(geometry.wallGeom)]);
    const bin = new Brush(combined); bin.updateMatrixWorld();
    let result: THREE.BufferGeometry | null = combined;
    if (slotGeoms.holes.length) {
      const holes = new Brush(BufferGeometryUtils.mergeGeometries(slotGeoms.holes.map(toNI))); holes.updateMatrixWorld();
      result = new Evaluator().evaluate(bin, holes, SUBTRACTION).geometry;
    }
    if (!result) return null;
    if (slotGeoms.cradles.length) result = BufferGeometryUtils.mergeGeometries([toNI(result), BufferGeometryUtils.mergeGeometries(slotGeoms.cradles.map(toNI))]);
    result.rotateX(-Math.PI / 2); return result;
  }, [geometry, slotGeoms]);
  return { ...geometry, slotGeoms, finalMesh, w, d, h, t, r, innerW, innerD };
}
