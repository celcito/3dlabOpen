import * as THREE from "three";
import { csgUnion, csgSubtract } from "./boolean";
import { buildThreadedRod } from "./threads";
import type { FastenerConfig, FastenerSizeSpec, HeadSpec } from "./types";
import { resolveHeadDims } from "./sizes";

export interface ScrewBuildOptions {
  config: FastenerConfig;
  spec: FastenerSizeSpec;
  /** Radial resolution used for round primitives. */
  segments?: number;
  /** Axial steps per pitch used for the thread. */
  stepsPerPitch?: number;
}

const EPS = 0.02;

function hexPrism(radius: number, height: number, yCenter: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius, height, 6);
  g.translate(0, yCenter, 0);
  return g;
}

function roundCyl(radius: number, height: number, segments: number, yCenter: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius, height, segments);
  g.translate(0, yCenter, 0);
  return g;
}

function starShape(outer: number, inner: number, points: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

/** Builds a complete watertight screw along +Y: tip at 0, head at `length..length+k`. */
export async function buildScrewGeometry(opts: ScrewBuildOptions): Promise<THREE.BufferGeometry> {
  const { config, spec } = opts;
  const segments = opts.segments ?? 48;
  const stepsPerPitch = opts.stepsPerPitch ?? 12;

  const major = spec.majorD;
  const pitch = spec.pitch;
  const length = Math.max(1, config.length);
  const fullThread = config.fullThread;
  const threadLen = fullThread ? length : Math.min(Math.max(1, config.threadLength), length);

  const headSpec = resolveHeadDims(spec, config.headType);
  const headK = headSpec.k;
  const headTopY = length + headK;

  // 1. Threaded rod, extended one pitch past its end for clean overlap.
  //    Slight oversize (EPS) keeps the crest proud of the plain shank wall.
  const thread = buildThreadedRod({
    major: major + EPS,
    pitch,
    length: threadLen + pitch,
    segments,
    stepsPerPitch,
  });

  let result: THREE.BufferGeometry = thread;

  // 2. Plain shank for partial-thread screws.
  if (!fullThread && threadLen < length) {
    const shank = roundCyl(major / 2, length - threadLen, segments, threadLen + (length - threadLen) / 2);
    result = (await csgUnion(result, shank)).geometry;
  }

  // 3. Head.
  const head = await buildHead(config, spec, headSpec, segments, length);
  result = (await csgUnion(result, head)).geometry;

  // 4. Drive recess.
  if (config.headType !== "hex" && config.driveType !== "none") {
    const cutters = buildDriveCutters(config, headSpec, major, headTopY, headK);
    for (const cutter of cutters) {
      result = (await csgSubtract(result, cutter)).geometry;
    }
  }

  return result;
}

async function buildHead(
  config: FastenerConfig,
  _spec: FastenerSizeSpec,
  head: HeadSpec,
  segments: number,
  shankTopY: number
): Promise<THREE.BufferGeometry> {
  const dk = head.dk;
  const k = head.k;
  const yCenter = shankTopY + k / 2;

  if (config.headType === "hex") {
    return hexPrism(dk / 2, k, yCenter);
  }
  if (config.headType === "flat") {
    // Countersunk cone: apex at top (+Y), base flush with shank top.
    const cone = new THREE.ConeGeometry(dk / 2, k, segments);
    cone.translate(0, yCenter, 0);
    return cone;
  }
  if (config.headType === "button") {
    const cyl = roundCyl(dk / 2, k, segments, yCenter);
    const dome = new THREE.SphereGeometry(dk / 2, segments, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(0, shankTopY + k, 0);
    return (await csgUnion(cyl, dome)).geometry;
  }
  // pan / socket / ribbed_socket: cylinder, pan slightly tapered on top.
  const topR = config.headType === "pan" ? (dk * 0.85) / 2 : dk / 2;
  const g = new THREE.CylinderGeometry(topR, dk / 2, k, segments);
  g.translate(0, yCenter, 0);
  return g;
}

function buildDriveCutters(
  config: FastenerConfig,
  head: HeadSpec,
  major: number,
  headTopY: number,
  headK: number
): THREE.BufferGeometry[] {
  const socketSize = head.socket ?? Math.max(0.8, major * 0.8);
  const recessD = Math.max(socketSize * 1.15, 0.8);
  // Recess must stay inside the head: keep its bottom a hair above the shank
  // top so the threads directly below the head stay complete.
  const depth = Math.max(0.6, headK - 0.2);
  const yCenter = headTopY - depth / 2;

  switch (config.driveType) {
    case "hex": {
      const g = new THREE.CylinderGeometry(recessD / 2, recessD / 2, depth, 6);
      g.translate(0, yCenter, 0);
      return [g];
    }
    case "slot": {
      const g = new THREE.BoxGeometry(recessD * 2.4, depth, recessD * 0.32);
      g.translate(0, yCenter, 0);
      return [g];
    }
    case "phillips": {
      const g1 = new THREE.BoxGeometry(recessD * 2.2, depth, recessD * 0.42);
      const g2 = new THREE.BoxGeometry(recessD * 0.42, depth, recessD * 2.2);
      g1.translate(0, yCenter, 0);
      g2.translate(0, yCenter, 0);
      return [g1, g2];
    }
    case "torx": {
      const star = starShape(recessD * 0.55, recessD * 0.34, 6);
      const g = new THREE.ExtrudeGeometry(star, { depth, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, yCenter, 0);
      return [g];
    }
    default:
      return [];
  }
}