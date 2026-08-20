import * as THREE from "three";
import type { FastenerConfig, FastenerSizeSpec } from "./types";
import { resolveWasherDims } from "./sizes";

export interface WasherBuildOptions {
  config: FastenerConfig;
  spec: FastenerSizeSpec;
  segments?: number;
}

/** Builds a watertight washer (annular disk) centered at the origin. */
export function buildWasherGeometry(opts: WasherBuildOptions): THREE.BufferGeometry {
  const { config, spec } = opts;
  const segments = opts.segments ?? 48;

  const w = resolveWasherDims(spec, config.washerType === "large");

  const shape = new THREE.Shape();
  shape.absarc(0, 0, w.d2 / 2, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, w.d1 / 2, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const bevel = config.washerChamfer ? Math.min(0.1 * w.h, 0.25) : 0;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: w.h,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: Math.max(8, Math.round(segments / 4)),
  });
  // ExtrudeGeometry builds along +Z; rotate to +Y and center at origin.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -w.h / 2, 0);

  return geometry;
}

/**
 * Builds a helical spring (lock) washer, DIN 127 style: a split ring whose
 * band sweeps around the axis while ramping up axially, so the two ends are
 * offset by one band thickness. Watertight swept hex-grid solid.
 */
export function buildSpringWasherGeometry(opts: WasherBuildOptions): THREE.BufferGeometry {
  const { config, spec } = opts;
  const segments = opts.segments ?? 48;

  const w = resolveWasherDims(spec, false);
  const ri = w.d1 / 2;
  const ro = w.d2 / 2;
  const rm = (ri + ro) / 2;
  const b = ro - ri; // radial band width
  const s = Math.max(0.4, b * 0.6); // axial band thickness
  const H = 2 * s; // free height (end lifted by one thickness)
  const gap = Math.max(0.4, s * 0.6); // angular gap between the two ends
  const gapAngle = (2 * gap) / rm;
  const sweep = Math.PI * 2 - gapAngle;

  const Nt = Math.max(32, Math.round(segments * 2));
  const Nu = 2;
  const Nv = 2;

  const pos: number[] = [];
  const idx: number[] = [];
  const vid = (i: number, j: number, k: number) => (i * (Nu + 1) + j) * (Nv + 1) + k;

  for (let i = 0; i <= Nt; i++) {
    const th = (i / Nt) * sweep;
    const zc = (i / Nt) * (H - s);
    const ct = Math.cos(th);
    const st = Math.sin(th);
    for (let j = 0; j <= Nu; j++) {
      const r = rm - b / 2 + (j / Nu) * b;
      for (let k = 0; k <= Nv; k++) {
        pos.push(r * ct, zc - s / 2 + (k / Nv) * s, r * st);
      }
    }
  }

  // Bottom face (outward -Y)
  for (let i = 0; i < Nt; i++) {
    for (let j = 0; j < Nu; j++) {
      const a = vid(i, j, 0), b0 = vid(i, j + 1, 0);
      const c = vid(i + 1, j + 1, 0), d = vid(i + 1, j, 0);
      idx.push(a, b0, c, a, c, d);
    }
  }
  // Top face (outward +Y)
  for (let i = 0; i < Nt; i++) {
    for (let j = 0; j < Nu; j++) {
      const a = vid(i, j, Nv), b0 = vid(i, j + 1, Nv);
      const c = vid(i + 1, j + 1, Nv), d = vid(i + 1, j, Nv);
      idx.push(a, d, c, a, c, b0);
    }
  }
  // Inner face (outward -radial)
  for (let i = 0; i < Nt; i++) {
    for (let k = 0; k < Nv; k++) {
      const a = vid(i, 0, k), b0 = vid(i + 1, 0, k);
      const c = vid(i + 1, 0, k + 1), d = vid(i, 0, k + 1);
      idx.push(a, b0, c, a, c, d);
    }
  }
  // Outer face (outward +radial)
  for (let i = 0; i < Nt; i++) {
    for (let k = 0; k < Nv; k++) {
      const a = vid(i, Nu, k), b0 = vid(i + 1, Nu, k);
      const c = vid(i + 1, Nu, k + 1), d = vid(i, Nu, k + 1);
      idx.push(a, d, c, a, c, b0);
    }
  }
  // Start cap at theta=0 (outward -tangential)
  for (let j = 0; j < Nu; j++) {
    for (let k = 0; k < Nv; k++) {
      const a = vid(0, j, k), b0 = vid(0, j, k + 1);
      const c = vid(0, j + 1, k), d = vid(0, j + 1, k + 1);
      idx.push(a, b0, c, c, b0, d);
    }
  }
  // End cap at theta=sweep (outward +tangential)
  for (let j = 0; j < Nu; j++) {
    for (let k = 0; k < Nv; k++) {
      const a = vid(Nt, j, k), b0 = vid(Nt, j + 1, k);
      const c = vid(Nt, j + 1, k + 1), d = vid(Nt, j, k + 1);
      idx.push(a, b0, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  return geometry;
}