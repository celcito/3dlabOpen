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
  const radius = footprintRadius(config);
  const fit = resolveFit(config);
  let limit = Math.min(config.height / 2 - 0.05, radius - 0.1);
  if (fit) {
    // The lower bevel sits on the spigot, the upper one on the flange.
    limit = Math.min(limit, fit.height - 0.05, config.height - fit.height - 0.05, radius - fit.clearance - 0.1);
  }
  return Math.max(0, Math.min(config.chamferSize, Math.max(0, limit)));
}

/** Knurl actually applied: ridge count and depth on the side walls. */
export function resolveKnurl(config: PrimitiveConfig): { ridges: number; depth: number } {
  if (!config.knurl) return { ridges: 0, depth: 0 };
  return {
    ridges: Math.max(3, Math.round(config.knurlRidges)),
    depth: Math.max(0, Math.min(config.knurlDepth, footprintRadius(config) * 0.5)),
  };
}

/** Lid spigot actually applied: step height and clearance per side. */
export function resolveFit(config: PrimitiveConfig): { height: number; clearance: number } | null {
  if (!config.fit) return null;
  const radius = footprintRadius(config);
  return {
    clearance: Math.min(Math.max(0.05, config.fitClearance), radius * 0.4),
    height: Math.min(Math.max(0.5, config.fitHeight), Math.max(0.5, config.height - 0.5)),
  };
}

export interface GrooveSpec {
  /** Distance from the base to the lower edge, mm. */
  bottom: number;
  /** Axial width, mm. */
  width: number;
  /** Radial depth, mm. */
  depth: number;
}

/**
 * Elastic-band groove actually applied. Cylinders only: the channel has to sit
 * inside one section (spigot or flange) and clear the chamfers and the
 * shoulder, so it is clamped instead of being allowed to break the part.
 */
export function resolveGroove(config: PrimitiveConfig): GrooveSpec | null {
  if (!config.groove || config.shape !== "cylinder") return null;

  const height = Math.max(0.5, config.height);
  const radius = footprintRadius(config);
  const chamfer = resolveChamfer(config);
  const fit = resolveFit(config);
  const fitHeight = fit ? Math.min(fit.height, Math.max(0.5, height - 0.5)) : 0;
  const onSpigot = fitHeight > 0.05 && config.grooveHeight <= fitHeight;
  const sectionRadius = onSpigot ? Math.max(0.2, radius - (fit?.clearance ?? 0)) : radius;
  const sectionBottom = onSpigot ? 0 : fitHeight;
  const sectionTop = onSpigot ? fitHeight : height;
  const margin = chamfer > 0 ? chamfer + 0.1 : 0;
  const low = sectionBottom + margin;
  const high = sectionTop - margin;
  if (high - low < 0.5) return null;

  const width = Math.min(Math.max(0.2, config.grooveWidth), high - low);
  const center = Math.max(low + width / 2, Math.min(high - width / 2, config.grooveHeight));
  const depth = Math.min(Math.max(0.05, config.grooveDepth), sectionRadius - 0.2);

  return { bottom: center - width / 2, width, depth };
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

/**
 * Rectangle outline (CCW seen from +Y) with `steps` samples per face,
 * optionally ridged. Both outlines of a stepped part use the same step count,
 * so their rings line up index by index.
 */
function rectPoints(halfW: number, halfD: number, steps: number, ridges: number, knurlDepth: number): Pt[] {
  const sides = [
    { from: { x: halfW, z: -halfD }, to: { x: halfW, z: halfD } },
    { from: { x: halfW, z: halfD }, to: { x: -halfW, z: halfD } },
    { from: { x: -halfW, z: halfD }, to: { x: -halfW, z: -halfD } },
    { from: { x: -halfW, z: -halfD }, to: { x: halfW, z: -halfD } },
  ];
  const pts: Pt[] = [];
  for (const side of sides) {
    const dx = side.to.x - side.from.x;
    const dz = side.to.z - side.from.z;
    const len = Math.hypot(dx, dz);
    const nx = len ? dz / len : 0;
    const nz = len ? -dx / len : 0;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const offset =
        ridges > 0 && knurlDepth > 0
          ? knurlDepth * (0.5 - 0.5 * Math.cos(t * ridges * Math.PI * 2))
          : 0;
      pts.push({ x: side.from.x + dx * t - nx * offset, z: side.from.z + dz * t - nz * offset });
    }
  }
  return pts;
}

/**
 * Moves an outline point inward for a chamfered ring. The shift is capped at
 * the smooth footprint, so a ridged outline is trimmed by the chamfer instead
 * of being pushed outward at its sharp valleys.
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
  /** Which part to build when the lid fit splits the part into two sections. */
  part?: "full" | "spigot" | "flange";
}

interface Ring {
  y: number;
  points: Pt[];
  inset: number;
  halfW: number;
  halfD: number;
}

/**
 * Builds a watertight, faceted primitive standing on the origin (0..height).
 * The side walls come from the outline (circle, rectangle, or either with
 * ridges); the chamfer insets the first and last ring, which cuts a 45° bevel
 * on both ends — and trims the ridges as well.
 *
 * With the lid fit enabled the part gets two stacked sections: a smaller
 * spigot at the base (nominal footprint minus the clearance) and the full-size
 * flange on top, so the bevels land on the spigot base and on the flange top.
 */
export function buildPrimitiveGeometry(
  config: PrimitiveConfig,
  opts: PrimitiveGeometryOptions = {}
): THREE.BufferGeometry {
  const height = Math.max(0.5, config.height);
  const chamfer = Math.min(resolveChamfer(config), height / 2);
  const knurl = resolveKnurl(config);
  const fit = resolveFit(config);
  const segments = opts.segments ?? segmentsForQuality(config.quality || 1);

  const circular = config.shape === "cylinder";
  const radius = footprintRadius(config);
  const halfW = circular ? radius : config.width / 2;
  const halfD = circular ? radius : config.depth / 2;

  const fitHeight = fit ? Math.min(fit.height, height - 0.5) : 0;
  const hasFit = fit !== null && fitHeight > 0.05;
  const clearance = hasFit ? fit!.clearance : 0;
  const fitRadius = Math.max(0.1, radius - clearance);
  const fitHalfW = Math.max(0.1, halfW - clearance);
  const fitHalfD = Math.max(0.1, halfD - clearance);

  const knurled = knurl.depth > 0;
  const samplesPerFace = knurled ? knurl.ridges * SAMPLES_PER_RIDGE : 1;
  const circleSamples = knurled ? knurl.ridges * SAMPLES_PER_RIDGE : segments;

  const outerPoints = circular
    ? knurled
      ? knurledCirclePoints(radius, knurl.ridges, knurl.depth)
      : circlePoints(radius, circleSamples)
    : rectPoints(halfW, halfD, samplesPerFace, knurl.ridges, knurl.depth);
  const fitPoints = circular
    ? circlePoints(fitRadius, circleSamples)
    : rectPoints(fitHalfW, fitHalfD, samplesPerFace, 0, 0);

  const lowerPoints = hasFit ? fitPoints : outerPoints;
  const lowerW = hasFit ? fitHalfW : halfW;
  const lowerD = hasFit ? fitHalfD : halfD;

  const groove = resolveGroove(config);
  const grooveOnSpigot = groove !== null && hasFit && groove.bottom + groove.width <= fitHeight + 1e-9;
  const grooveFloorRadius = groove ? Math.max(0.1, (grooveOnSpigot ? fitRadius : radius) - groove.depth) : 0;
  const grooveFloor = groove ? circlePoints(grooveFloorRadius, circleSamples) : null;

  const spigotRings: Ring[] = [];
  const flangeRings: Ring[] = [];
  const addSpigot = (y: number, points: Pt[], inset: number, hw: number, hd: number) =>
    spigotRings.push({ y, points, inset, halfW: hw, halfD: hd });
  const addFlange = (y: number, points: Pt[], inset: number, hw: number, hd: number) =>
    flangeRings.push({ y, points, inset, halfW: hw, halfD: hd });
  /** Channel cut into the wall: flat shoulders, smooth floor, then the wall again. */
  const addGrooveTo = (target: Ring[], points: Pt[], hw: number, hd: number) => {
    if (!groove || !grooveFloor) return;
    const push = (y: number, pts: Pt[], inset: number, hW: number, hD: number) =>
      target.push({ y, points: pts, inset, halfW: hW, halfD: hD });
    push(groove.bottom, points, 0, hw, hd);
    push(groove.bottom, grooveFloor, 0, grooveFloorRadius, grooveFloorRadius);
    push(groove.bottom + groove.width, grooveFloor, 0, grooveFloorRadius, grooveFloorRadius);
    push(groove.bottom + groove.width, points, 0, hw, hd);
  };

  if (hasFit) {
    // Spigot section: smaller step at the base, chamfer on its bottom edge.
    if (chamfer > 0) addSpigot(0, lowerPoints, chamfer, lowerW, lowerD);
    addSpigot(chamfer, lowerPoints, 0, lowerW, lowerD);
    if (groove && grooveOnSpigot) addGrooveTo(spigotRings, lowerPoints, lowerW, lowerD);
    addSpigot(fitHeight, lowerPoints, 0, lowerW, lowerD);
    // Flange section: full-size top, chamfer on its top edge.
    addFlange(fitHeight, outerPoints, 0, halfW, halfD);
    if (groove && !grooveOnSpigot) addGrooveTo(flangeRings, outerPoints, halfW, halfD);
    if (chamfer > 0) addFlange(height - chamfer, outerPoints, 0, halfW, halfD);
    addFlange(height, outerPoints, chamfer, halfW, halfD);
  } else {
    // Single section: chamfer on both ends.
    if (chamfer > 0) addFlange(0, outerPoints, chamfer, halfW, halfD);
    addFlange(chamfer, outerPoints, 0, halfW, halfD);
    if (groove) addGrooveTo(flangeRings, outerPoints, halfW, halfD);
    if (chamfer > 0) addFlange(height - chamfer, outerPoints, 0, halfW, halfD);
    addFlange(height, outerPoints, chamfer, halfW, halfD);
  }

  const part = opts.part ?? "full";
  const rings: Ring[] =
    part === "spigot"
      ? (spigotRings.length ? spigotRings : flangeRings)
      : part === "flange"
        ? (flangeRings.length ? flangeRings : spigotRings)
        : [...spigotRings, ...flangeRings];

  const ringPoints = rings.map((ring) =>
    ring.points.map((p) => {
      const q = insetPoint(p, ring.inset, ring.halfW, ring.halfD, circular);
      return new THREE.Vector3(q.x, ring.y, q.z);
    })
  );

  const positions: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  const count = ringPoints[0].length;
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
  const bottomCenter = new THREE.Vector3(0, bottom[0].y, 0);
  const topCenter = new THREE.Vector3(0, top[0].y, 0);
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
