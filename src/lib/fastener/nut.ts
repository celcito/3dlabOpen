import * as THREE from "three";
import { csgSubtract } from "./boolean";
import { buildInternalThreadRemoval } from "./threads";
import type { FastenerConfig, FastenerSizeSpec } from "./types";
import { resolveNutDims } from "./sizes";

export interface NutBuildOptions {
  config: FastenerConfig;
  spec: FastenerSizeSpec;
  segments?: number;
  stepsPerPitch?: number;
}

/** Hex circumradius from across-flats: r = s / (2*cos(30°)). */
export function circumRadius(acrossFlats: number): number {
  return acrossFlats / (2 * Math.cos(Math.PI / 6));
}

function polygonShape(radius: number, sides: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
    else s.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  s.closePath();
  return s;
}

/** Builds the beveled hex/square body prism (without the threaded hole). */
export function buildNutBody(config: FastenerConfig, spec: FastenerSizeSpec, thickness: number): THREE.BufferGeometry {
  const shape =
    config.nutShape === "hex"
      ? polygonShape(circumRadius(resolveNutDims(spec, "hex").s), 6)
      : polygonShape((resolveNutDims(spec, "square").s * Math.SQRT2) / 2, 4);

  const bevel = config.bevelNut ? Math.min(0.08 * thickness, 0.4) : 0;
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  });
  // ExtrudeGeometry builds along +Z; rotate to +Y and center at origin.
  body.rotateX(-Math.PI / 2);
  body.translate(0, -thickness / 2, 0);
  return body;
}

/** Builds a watertight nut along +Y (hole axis on Y), spanning 0..thickness. */
export async function buildNutGeometry(opts: NutBuildOptions): Promise<THREE.BufferGeometry> {
  const { config, spec } = opts;
  const segments = opts.segments ?? 48;
  const stepsPerPitch = opts.stepsPerPitch ?? 12;

  const major = spec.majorD;
  const pitch = spec.pitch;
  const thickness = config.nutThicknessOverride > 0 ? config.nutThicknessOverride : resolveNutDims(spec, config.nutShape).m;
  const clearance = config.clearance;

  // Body: beveled hexagon/square prism via ExtrudeGeometry (robust, no CSG).
  const body = buildNutBody(config, spec, thickness);

  // Threaded hole removal, extending one pitch past each face. The body
  // spans -thickness/2..+thickness/2, so center the removal on it.
  const removal = buildInternalThreadRemoval({
    holeDiameter: major + clearance,
    pitch,
    length: thickness + 2 * pitch,
    segments,
    stepsPerPitch,
  });
  removal.translate(0, -(thickness / 2 + pitch), 0);

  return (await csgSubtract(body, removal)).geometry;
}