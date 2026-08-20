import * as THREE from "three";
import { csgIntersect } from "./boolean";
import { getFastenerSize } from "./sizes";
import { buildScrewGeometry } from "./screw";
import { buildNutGeometry } from "./nut";
import { buildWasherGeometry, buildSpringWasherGeometry } from "./washer";
import type { FastenerConfig } from "./types";

export interface FastenerGeometryOptions {
  /** Radial segments override. */
  segments?: number;
  /** Axial steps per pitch override. */
  stepsPerPitch?: number;
}

const BASE_SEGMENTS = 32;
const BASE_STEPS = 10;

/** Segments for a given quality factor (1 = preview, 2 = export). */
export function segmentsForQuality(quality: number): number {
  return Math.max(16, Math.round(BASE_SEGMENTS * quality));
}

export function stepsForQuality(quality: number): number {
  return Math.max(6, Math.round(BASE_STEPS * quality));
}

/**
 * Builds the real, watertight fastener geometry for a config. Uses low
 * resolution for previews and high resolution for STL export.
 */
export async function generateFastenerGeometry(
  config: FastenerConfig,
  opts: FastenerGeometryOptions = {}
): Promise<THREE.BufferGeometry> {
  const spec = getFastenerSize(config.system, config.size);
  const q = config.quality || 1;
  const segments = opts.segments ?? segmentsForQuality(q);
  const stepsPerPitch = opts.stepsPerPitch ?? stepsForQuality(q);

  let geometry: THREE.BufferGeometry;
  switch (config.type) {
    case "screw":
      geometry = await buildScrewGeometry({ config, spec, segments, stepsPerPitch });
      break;
    case "nut":
      geometry = await buildNutGeometry({ config, spec, segments, stepsPerPitch });
      break;
    case "washer":
      geometry =
        config.washerType === "spring"
          ? buildSpringWasherGeometry({ config, spec, segments })
          : buildWasherGeometry({ config, spec, segments });
      break;
    default:
      geometry = new THREE.BufferGeometry();
  }

  if (config.type === "screw" && config.splitScrew) {
    geometry = await splitScrewHalf(geometry);
  }

  geometry.computeBoundingBox();
  return geometry;
}

/** Cuts the screw along its X mid-plane so it can be printed flat. */
async function splitScrewHalf(geometry: THREE.BufferGeometry): Promise<THREE.BufferGeometry> {
  const big = 500;
  const box = new THREE.BoxGeometry(big, big, big);
  const matrix = new THREE.Matrix4().makeTranslation(big / 2, 0, 0);
  const clipped = box.clone();
  clipped.applyMatrix4(matrix);
  return (await csgIntersect(geometry, clipped)).geometry;
}