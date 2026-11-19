import * as THREE from "three";
import type { FitConfig } from "./types";
import { resolveFitPair } from "./fit";

interface Pt {
  x: number;
  z: number;
}

const BASE_SEGMENTS = 64;

function circlePoints(radius: number, count: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius });
  }
  return pts;
}

/** Rectangle outline, one vertex per corner, same order as the circle. */
function rectPoints(halfW: number, halfD: number): Pt[] {
  return [
    { x: halfW, z: -halfD },
    { x: halfW, z: halfD },
    { x: -halfW, z: halfD },
    { x: -halfW, z: -halfD },
  ];
}

/** Moves a point inward for a chamfered ring (same rule as the primitive mesh). */
function insetPoint(p: Pt, inset: number, halfW: number, halfD: number, circular: boolean): Pt {
  if (inset <= 0) return p;
  if (circular) {
    const len = Math.hypot(p.x, p.z) || 1;
    const r = Math.max(0, Math.min(len - inset, halfW - inset));
    return { x: (p.x / len) * r, z: (p.z / len) * r };
  }
  return {
    x: Math.sign(p.x) * Math.min(Math.max(0, Math.abs(p.x) - inset), Math.max(0, halfW - inset)),
    z: Math.sign(p.z) * Math.min(Math.max(0, Math.abs(p.z) - inset), Math.max(0, halfD - inset)),
  };
}

interface Ring {
  y: number;
  points: Pt[];
}

/**
 * Builds the container as a closed shell standing on the origin: bottom cap,
 * outer wall, rim annulus, inner wall and inner floor. With the chamfer on,
 * the outer bottom and top rings are inset, which bevels the base and the rim.
 */
export function buildContainerGeometry(
  config: FitConfig,
  opts: { segments?: number } = {}
): THREE.BufferGeometry {
  const fit = resolveFitPair(config);
  const circular = fit.circular;
  const segments = opts.segments ?? Math.max(16, Math.round(BASE_SEGMENTS * (config.quality || 1)));
  const chamfer = fit.chamfer;

  const outline = (halfW: number, halfD: number) =>
    circular ? circlePoints(halfW, segments) : rectPoints(halfW, halfD);

  const ring = (y: number, halfW: number, halfD: number, inset = 0): Ring => ({
    y,
    points: outline(halfW, halfD).map((p) => insetPoint(p, inset, halfW, halfD, circular)),
  });

  const rings: Ring[] = [];
  if (chamfer > 0) rings.push(ring(0, fit.outerHalfW, fit.outerHalfD, chamfer));
  rings.push(ring(chamfer, fit.outerHalfW, fit.outerHalfD));
  if (chamfer > 0) rings.push(ring(fit.height - chamfer, fit.outerHalfW, fit.outerHalfD));
  rings.push(ring(fit.height, fit.outerHalfW, fit.outerHalfD, chamfer));
  rings.push(ring(fit.height, fit.innerHalfW, fit.innerHalfD));
  rings.push(ring(fit.floor, fit.innerHalfW, fit.innerHalfD));

  const ringVertices = rings.map((r) => r.points.map((p) => new THREE.Vector3(p.x, r.y, p.z)));
  const count = ringVertices[0].length;

  const positions: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  for (let r = 0; r < ringVertices.length - 1; r++) {
    const low = ringVertices[r];
    const up = ringVertices[r + 1];
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      tri(low[i], low[j], up[i]);
      tri(low[j], up[j], up[i]);
    }
  }

  const bottom = ringVertices[0];
  const bottomCenter = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < count; i++) {
    tri(bottomCenter, bottom[i], bottom[(i + 1) % count]);
  }

  const innerFloor = ringVertices[ringVertices.length - 1];
  const floorCenter = new THREE.Vector3(0, fit.floor, 0);
  for (let i = 0; i < count; i++) {
    tri(floorCenter, innerFloor[(i + 1) % count], innerFloor[i]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
