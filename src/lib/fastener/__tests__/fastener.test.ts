import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import * as THREE from "three";
import { generateFastenerGeometry } from "../geometry";
import { isWatertight, signedVolume } from "../threads";
import { buildNutBody } from "../nut";
import { getFastenerSize, resolveNutDims } from "../sizes";
import { setManifoldWasmUrl } from "../../split3mf/engines/manifoldLoader";
import type { FastenerConfig } from "../types";

beforeAll(() => {
  // Node/vitest can't resolve the Vite ?url WASM asset; point at the real file.
  setManifoldWasmUrl("file://" + path.join(process.cwd(), "node_modules/manifold-3d/manifold.wasm"));
});

function baseConfig(over: Partial<FastenerConfig>): FastenerConfig {
  return {
    type: "screw",
    system: "metric",
    size: "M5",
    length: 20,
    headType: "socket",
    driveType: "hex",
    fullThread: true,
    threadLength: 10,
    splitScrew: false,
    nutShape: "hex",
    nutThicknessOverride: 0,
    clearance: 0.1,
    bevelNut: true,
    washerType: "standard",
    washerChamfer: false,
    quality: 1,
    debugMode: false,
    ...over,
  };
}

function bbox(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  return {
    minX: bb.min.x, maxX: bb.max.x,
    minY: bb.min.y, maxY: bb.max.y,
    minZ: bb.min.z, maxZ: bb.max.z,
  };
}

describe("screw geometry", () => {
  it("is watertight for a full-thread socket screw", async () => {
    const g = await generateFastenerGeometry(baseConfig({}));
    expect(isWatertight(g)).toBe(true);
    expect(signedVolume(g)).toBeGreaterThan(0);
  });

  it("has correct length and head diameter bounds", async () => {
    const g = await generateFastenerGeometry(baseConfig({ length: 20, headType: "socket" }));
    const spec = getFastenerSize("metric", "M5");
    const headK = spec.socketHead!.k;
    const bb = bbox(g);
    expect(bb.maxY - bb.minY).toBeGreaterThan(20 + headK - 1);
    const maxR = Math.max(bb.maxX, Math.abs(bb.minX), Math.abs(bb.minZ));
    expect(maxR).toBeGreaterThan(spec.socketHead!.dk / 2 - 0.1);
    expect(maxR).toBeLessThan(spec.socketHead!.dk / 2 + 0.1);
  });

  it("supports partial thread with plain shank", async () => {
    const g = await generateFastenerGeometry(baseConfig({ fullThread: false, threadLength: 8 }));
    expect(isWatertight(g)).toBe(true);
  });

  it("supports split screw for flat printing", async () => {
    const g = await generateFastenerGeometry(baseConfig({ splitScrew: true }));
    const bb = bbox(g);
    // Only the +X half remains.
    expect(bb.minX).toBeGreaterThanOrEqual(-0.01);
  });

  it("cuts drive recess for hex drive", async () => {
    const g = await generateFastenerGeometry(baseConfig({ headType: "socket", driveType: "hex" }));
    // Volume must be less than the screw with no drive.
    const solid = await generateFastenerGeometry(baseConfig({ headType: "socket", driveType: "none" }));
    expect(signedVolume(g)).toBeLessThan(signedVolume(solid) * 0.99);
  });
});

describe("nut geometry", () => {
  it("is watertight", async () => {
    const g = await generateFastenerGeometry(baseConfig({ type: "nut", nutShape: "hex" }));
    expect(isWatertight(g)).toBe(true);
  });

  it("has a threaded hole (volume below solid body)", async () => {
    const config = baseConfig({ type: "nut", nutShape: "hex" });
    const g = await generateFastenerGeometry(config);
    const spec = getFastenerSize("metric", "M5");
    const m = resolveNutDims(spec, "hex").m;
    const body = buildNutBody(config, spec, m);
    const solidVol = signedVolume(body);
    const vol = signedVolume(g);
    expect(vol).toBeGreaterThan(0);
    // The threaded bore must remove a meaningful fraction of the body.
    expect(vol).toBeLessThan(solidVol * 0.92);
  });

  it("supports square nuts", async () => {
    const g = await generateFastenerGeometry(baseConfig({ type: "nut", nutShape: "square", bevelNut: false }));
    expect(isWatertight(g)).toBe(true);
  });

  it("honors thickness override", async () => {
    const g = await generateFastenerGeometry(baseConfig({ type: "nut", nutThicknessOverride: 12, bevelNut: false }));
    const bb = bbox(g);
    expect(bb.maxY - bb.minY).toBeCloseTo(12, 5);
  });
});

describe("washer geometry", () => {
  it("is watertight with a centered hole", async () => {
    const g = await generateFastenerGeometry(baseConfig({ type: "washer" }));
    expect(isWatertight(g)).toBe(true);
    expect(signedVolume(g)).toBeGreaterThan(0);
    const bb = bbox(g);
    // Hole keeps the washer radius below the outer diameter.
    const maxR = Math.max(bb.maxX, bb.maxZ);
    const spec = getFastenerSize("metric", "M5");
    expect(maxR).toBeLessThanOrEqual(spec.washer!.d2 / 2 + 0.1);
  });

  it("supports large washers and chamfer", async () => {
    const g = await generateFastenerGeometry(baseConfig({ type: "washer", washerType: "large", washerChamfer: true }));
    expect(isWatertight(g)).toBe(true);
  });

  it("supports spring lock washers (DIN 127)", async () => {
    const g = await generateFastenerGeometry(baseConfig({ type: "washer", washerType: "spring" }));
    expect(isWatertight(g)).toBe(true);
    expect(signedVolume(g)).toBeGreaterThan(0);

    const spec = getFastenerSize("metric", "M5");
    const ri = spec.washer!.d1 / 2;
    const ro = spec.washer!.d2 / 2;
    const b = ro - ri;
    const s = Math.max(0.4, b * 0.6);
    const H = 2 * s;
    const bb = bbox(g);
    // Same inner/outer diameter as the flat washer.
    expect(Math.max(bb.maxX, bb.maxZ)).toBeCloseTo(ro, 1);
    // Raised end: overall height is roughly the band height.
    expect(bb.maxY - bb.minY).toBeCloseTo(H, 1);

    // The split ring leaves an angular gap (no material past the swept end).
    const gap = Math.max(0.4, s * 0.6);
    const sweep = Math.PI * 2 - (2 * gap) / ((ri + ro) / 2);
    const p = g.attributes.position;
    let beyond = 0;
    for (let i = 0; i < p.count; i++) {
      let th = Math.atan2(p.getZ(i), p.getX(i));
      if (th < 0) th += Math.PI * 2;
      if (th > sweep + 0.05) beyond++;
    }
    expect(beyond).toBe(0);
  });
});
