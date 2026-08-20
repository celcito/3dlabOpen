import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import * as THREE from "three";
import {
  buildCanOpenerGeometry,
  buildCuttingTipGeometry,
  buildEngravingGeometries,
  buildHandleGeometry,
} from "../canOpenerGeometry";
import { setManifoldWasmUrl } from "../../split3mf/engines/manifoldLoader";
import { isWatertight, signedVolume } from "../../fastener/threads";

beforeAll(() => {
  // Node/vitest can't resolve the Vite ?url WASM asset; point at the real file.
  setManifoldWasmUrl("file://" + path.join(process.cwd(), "node_modules/manifold-3d/manifold.wasm"));
});

function rectShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  return s;
}

function textLikeShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-8, -4);
  s.lineTo(8, -4);
  s.lineTo(8, 4);
  s.lineTo(-8, 4);
  s.closePath();
  return s;
}

const baseConfig = {
  handleThickness: 8,
  bevel: 0.6,
  engraving: "raised" as const,
  engravingDepth: 0.6,
  tip: "hook_wheel" as const,
  tipLength: 12,
  hookWidth: 5,
  hookDepth: 4,
  wheelRadius: 4,
  wheelTube: 0.6,
  armWidth: 3,
  armDepth: 2,
  keyring: false,
  keyringDiameter: 3,
};

describe("can opener geometry", () => {
  it("handle alone is a watertight solid", () => {
    const cfg = { ...baseConfig, outer: rectShape(30, 70), details: [] };
    const g = buildHandleGeometry(cfg);
    expect(isWatertight(g)).toBe(true);
    expect(signedVolume(g)).toBeGreaterThan(0);
    g.computeBoundingBox();
    // Depth equals handleThickness + 2*bevel (bevel extends outward on both
    // faces).
    const expectedDepth = cfg.handleThickness + 2 * cfg.bevel;
    expect(g.boundingBox!.max.z - g.boundingBox!.min.z).toBeCloseTo(expectedDepth, 1);
  });

  it("cutting tip with hook+wheel is watertight", () => {
    const cfg = { ...baseConfig, outer: rectShape(30, 70), details: [] };
    const g = buildCuttingTipGeometry(cfg);
    expect(g.attributes.position.count).toBeGreaterThan(0);
    expect(isWatertight(g)).toBe(true);
  });

  it("cutting tip hook_only still produces geometry", () => {
    const cfg = { ...baseConfig, outer: rectShape(30, 70), details: [], tip: "hook_only" as const };
    const g = buildCuttingTipGeometry(cfg);
    expect(g.attributes.position.count).toBeGreaterThan(0);
    expect(isWatertight(g)).toBe(true);
  });

  it("full assembly (handle + tip) is watertight", async () => {
    const cfg = {
      ...baseConfig,
      outer: rectShape(30, 70),
      details: [textLikeShape()],
    };
    const g = await buildCanOpenerGeometry(cfg);
    expect(isWatertight(g)).toBe(true);
    expect(signedVolume(g)).toBeGreaterThan(0);
  });

  it("recessed engraving yields smaller volume than raised", async () => {
    const raisedCfg = { ...baseConfig, outer: rectShape(30, 70), details: [textLikeShape()], engraving: "raised" as const };
    const recessedCfg = { ...raisedCfg, engraving: "recessed" as const };
    const raisedVol = signedVolume(await buildCanOpenerGeometry(raisedCfg));
    const recessedVol = signedVolume(await buildCanOpenerGeometry(recessedCfg));
    expect(raisedVol).toBeGreaterThan(recessedVol);
  });

  it("keyring hole subtracts from the handle", async () => {
    const cfg = { ...baseConfig, outer: rectShape(30, 70), details: [], tip: "none" as const, keyring: true };
    const g = await buildCanOpenerGeometry(cfg);
    // Volume with hole must be smaller than the same handle without hole.
    const cfgNoHole = { ...cfg, keyring: false };
    const gNoHole = await buildCanOpenerGeometry(cfgNoHole);
    expect(signedVolume(g)).toBeLessThan(signedVolume(gNoHole));
  });

  it("engraving geometry sits at the front face (z = handleThickness/2)", () => {
    const cfg = { ...baseConfig, outer: rectShape(30, 70), details: [textLikeShape()] };
    const geoms = buildEngravingGeometries(cfg);
    expect(geoms.length).toBe(1);
    geoms[0].computeBoundingBox();
    const bb = geoms[0].boundingBox!;
    expect(bb.min.z).toBeCloseTo(cfg.handleThickness / 2, 5);
    expect(bb.max.z).toBeCloseTo(cfg.handleThickness / 2 + cfg.engravingDepth, 5);
  });

  it("recessed engraving actually carves into the handle", async () => {
    const cfg = {
      ...baseConfig,
      outer: rectShape(30, 70),
      details: [textLikeShape()],
      engraving: "recessed" as const,
    };
    // A recessed engraving must reduce volume below the plain handle.
    const engraved = await buildCanOpenerGeometry(cfg);
    const plain = await buildCanOpenerGeometry({ ...cfg, engraving: "none" as const });
    expect(signedVolume(engraved)).toBeLessThan(signedVolume(plain));
  });

  it("keyring on a tiny handle is skipped instead of breaking geometry", async () => {
    // Height 10mm with a 6mm hole — the circle cannot fit inside.
    const cfg = {
      ...baseConfig,
      outer: rectShape(30, 10),
      details: [],
      tip: "none" as const,
      keyring: true,
      keyringDiameter: 6,
    };
    const g = await buildCanOpenerGeometry(cfg);
    expect(isWatertight(g)).toBe(true);
    expect(signedVolume(g)).toBeGreaterThan(0);
  });

  it("keyring on a concave/narrow silhouette is skipped safely", async () => {
    // A narrow teardrop whose top doesn't fit the keyring circle.
    const teardrop = new THREE.Shape();
    teardrop.moveTo(-6, 0);
    teardrop.lineTo(6, 0);
    teardrop.lineTo(2, 8);
    teardrop.lineTo(0, 9);
    teardrop.lineTo(-2, 8);
    teardrop.closePath();
    const cfg = {
      ...baseConfig,
      outer: teardrop,
      details: [],
      tip: "none" as const,
      keyring: true,
      keyringDiameter: 3,
    };
    const g = await buildCanOpenerGeometry(cfg);
    expect(isWatertight(g)).toBe(true);
    expect(signedVolume(g)).toBeGreaterThan(0);
  });

  it("cutting tip clamps when wheel radius exceeds tip length", () => {
    // wheelRadius 8 > tipLength 6 → arm/hook must not go negative.
    const cfg = {
      ...baseConfig,
      outer: rectShape(30, 70),
      details: [],
      tip: "hook_wheel" as const,
      tipLength: 6,
      wheelRadius: 8,
    };
    const g = buildCuttingTipGeometry(cfg);
    expect(g.attributes.position.count).toBeGreaterThan(0);
    expect(isWatertight(g)).toBe(true);
  });

  it("cutting tip clamps when wheel tube approaches the radius", () => {
    const cfg = {
      ...baseConfig,
      outer: rectShape(30, 70),
      details: [],
      tip: "hook_wheel" as const,
      wheelRadius: 2,
      wheelTube: 2,
    };
    const g = buildCuttingTipGeometry(cfg);
    expect(g.attributes.position.count).toBeGreaterThan(0);
    expect(isWatertight(g)).toBe(true);
  });
});