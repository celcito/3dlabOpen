import * as THREE from "three";
import type { PrimitiveConfig } from "./types";

interface Pt {
  x: number;
  z: number;
}

const BASE_SEGMENTS = 64;
/** Knurl samples per ridge: crest, ramp, valley, ramp. */
const SAMPLES_PER_RIDGE = 4;

/** Radial resolution for a quality factor (1 = preview, 2 = export). */
export function segmentsForQuality(quality: number): number {
  return Math.max(16, Math.round(BASE_SEGMENTS * quality));
}

/** Smallest footprint half-size: the usable radius of the primitive. */
export function footprintRadius(config: PrimitiveConfig): number {
  const footprint = config.shape === "cylinder" ? config.diameter : Math.min(config.width, config.depth);
  return Math.max(0.2, footprint / 2);
}

/** Chamfer actually applied, clamped so it cannot consume the part. */
export function resolveChamfer(config: PrimitiveConfig): number {
  if (!config.chamfer) return 0;
  const limit = Math.min(config.height / 2 - 0.05, footprintRadius(config) - 0.1);
  return Math.max(0, Math.min(config.chamferSize, limit));
}

/** Knurl actually applied: ridge count and depth on the side walls. */
export function resolveKnurl(config: PrimitiveConfig): { ridges: number; depth: number } {
  if (!config.knurl) return { ridges: 0, depth: 0 };
  return {
    ridges: Math.max(3, Math.round(config.knurlRidges)),
    depth: Math.max(0, Math.min(config.knurlDepth, footprintRadius(config) * 0.5)),
  };
}

function circlePoints(radius: number, count: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius });
  }
  return pts;
}

function knurledCirclePoints(radius: number, ridges: number, depth: number): Pt[] {
  const count = ridges * SAMPLES_PER_RIDGE;
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const phase = (i % SAMPLES_PER_RIDGE) / SAMPLES_PER_RIDGE;
    const r = radius - depth * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));
    pts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  return pts;
}

/** Rectangle outline (CCW seen from +Y), optionally with ridges on each face. */
function boxPoints(width: number, depth: number, ridges: number, knurlDepth: number): Pt[] {
  const hw = width / 2;
  const hd = depth / 2;
  const sides = [
    { from: { x: hw, z: -hd }, to: { x: hw, z: hd } },
    { from: { x: hw, z: hd }, to: { x: -hw, z: hd } },
    { from: { x: -hw, z: hd }, to: { x: -hw, z: -hd } },
    { from: { x: -hw, z: -hd }, to: { x: hw, z: -hd } },
  ];
  if (ridges <= 0 || knurlDepth <= 0) return sides.map((s) => s.from);

  const pts: Pt[] = [];
  for (const side of sides) {
    const dx = side.to.x - side.from.x;
    const dz = side.to.z - side.from.z;
    const len = Math.hypot(dx, dz);
    const nx = dz / len;
    const nz = -dx / len;
    const steps = ridges * SAMPLES_PER_RIDGE;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const offset = knurlDepth * (0.5 - 0.5 * Math.cos(t * ridges * Math.PI * 2));
      pts.push({ x: side.from.x + dx * t - nx * offset, z: side.from.z + dz * t - nz * offset });
    }
  }
  return pts;
}

/**
 * Moves an outline point inward for a chamfered end ring. The shift is capped
 * at the smooth footprint, so a ridged outline is trimmed by the chamfer
 * instead of being pushed outward at its sharp valleys.
 */
function insetPoint(p: Pt, inset: number, halfW: number, halfD: number, circular: boolean): Pt {
  if (inset <= 0) return p;
  if (circular) {
    const len = Math.hypot(p.x, p.z) || 1;
    const r = Math.max(0, Math.min(len - inset, halfW - inset));
    return { x: (p.x / len) * r, z: (p.z / len) * r };
  }
  const maxX = Math.max(0, halfW - inset);
  const maxZ = Math.max(0, halfD - inset);
  return {
    x: Math.sign(p.x) * Math.min(Math.max(0, Math.abs(p.x) - inset), maxX),
    z: Math.sign(p.z) * Math.min(Math.max(0, Math.abs(p.z) - inset), maxZ),
  };
}

export interface PrimitiveGeometryOptions {
  /** Radial segments override. */
  segments?: number;
}

/**
 * Builds a watertight, faceted primitive standing on the origin (0..height).
 * The side walls come from the outline (circle, rectangle, or either with
 * ridges); the chamfer insets the first and last ring, which cuts a 45° bevel
 * on both ends — and trims the ridges as well.
 */
export function buildPrimitiveGeometry(
  config: PrimitiveConfig,
  opts: PrimitiveGeometryOptions = {}
): THREE.BufferGeometry {
  const height = Math.max(0.5, config.height);
  const chamfer = Math.min(resolveChamfer(config), height / 2);
  const knurl = resolveKnurl(config);
  const segments = opts.segments ?? segmentsForQuality(config.quality || 1);

  const points =
    config.shape === "cylinder"
      ? knurl.depth > 0
        ? knurledCirclePoints(footprintRadius(config), knurl.ridges, knurl.depth)
        : circlePoints(footprintRadius(config), segments)
      : boxPoints(config.width, config.depth, knurl.ridges, knurl.depth);
  const circular = config.shape === "cylinder";
  const halfW = circular ? footprintRadius(config) : config.width / 2;
  const halfD = circular ? footprintRadius(config) : config.depth / 2;

  const rings: { y: number; inset: number }[] =
    chamfer > 0
      ? [
          { y: 0, inset: chamfer },
          { y: chamfer, inset: 0 },
          { y: height - chamfer, inset: 0 },
          { y: height, inset: chamfer },
        ]
      : [
          { y: 0, inset: 0 },
          { y: height, inset: 0 },
        ];

  const ringPoints = rings.map((ring) =>
    points.map((p) => {
      const q = insetPoint(p, ring.inset, halfW, halfD, circular);
      return new THREE.Vector3(q.x, ring.y, q.z);
    })
  );

  const positions: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  const count = points.length;
  for (let r = 0; r < ringPoints.length - 1; r++) {
    const low = ringPoints[r];
    const up = ringPoints[r + 1];
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      tri(low[i], up[i], low[j]);
      tri(low[j], up[i], up[j]);
    }
  }

  const bottom = ringPoints[0];
  const top = ringPoints[ringPoints.length - 1];
  const bottomCenter = new THREE.Vector3(0, 0, 0);
  const topCenter = new THREE.Vector3(0, height, 0);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    tri(bottomCenter, bottom[i], bottom[j]);
    tri(topCenter, top[j], top[i]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
