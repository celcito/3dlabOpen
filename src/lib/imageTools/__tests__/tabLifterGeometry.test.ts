import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import * as THREE from "three";
import { buildTabLifterParts, buildTabLifterSingleColor } from "../tabLifterGeometry";
import { setManifoldWasmUrl } from "../../split3mf/engines/manifoldLoader";
import { isWatertight, signedVolume } from "../../fastener/threads";
import { OPENER_PRESETS, buildOpenerPreset } from "../openerPresets";
import type { TracedRegion } from "../traceImage";

beforeAll(() => {
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

function region(color: string, ...shapes: THREE.Shape[]): TracedRegion {
  return { color, shapes };
}

const baseCfg = {
  outer: rectShape(40, 70),
  regions: [] as TracedRegion[],
  handleThickness: 6,
  bevel: 0.6,
  slotDepth: 14,
  slotGap: 12,
  slotX: 0.5,
  slotWall: 1.5,
  reliefDepth: 0.8,
  fillBackground: false,
  repeatBack: false,
  baseColor: "#ffffff",
  keyring: false,
  keyringDiameter: 3,
};

describe("tab lifter geometry", () => {
  it("base with slot is a watertight solid", async () => {
    const pieces = await buildTabLifterParts(baseCfg);
    expect(pieces.length).toBe(1);
    expect(isWatertight(pieces[0].geometry)).toBe(true);
    expect(signedVolume(pieces[0].geometry)).toBeGreaterThan(0);
    expect(pieces[0].color).toBe("#ffffff");
  });

  it("slot carves an open notch on the top edge", async () => {
    const withSlot = await buildTabLifterParts(baseCfg);
    const withoutSlot = await buildTabLifterParts({ ...baseCfg, slotDepth: 0 });
    const volWith = signedVolume(withSlot[0].geometry);
    const volWithout = signedVolume(withoutSlot[0].geometry);
    expect(volWith).toBeLessThan(volWithout);
  });

  it("captured fit: default rasgo removes exactly gap x depth x pocket z", async () => {
    // A 202 stay-on-tab ring is ~10mm wide and ~1mm of metal. The default rasgo
    // (12mm gap, 14mm deep, 1.5mm wall) is a closed pocket recessed from both
    // faces: the tab slides in through the top-edge slit (fresta) and is
    // captured inside, while the front and back stay solid.
    const cfg = { ...baseCfg, bevel: 0, slotDepth: 14, slotGap: 12, slotWall: 1.5, keyring: false };
    const withSlot = await buildTabLifterParts(cfg);
    const withoutSlot = await buildTabLifterParts({ ...cfg, slotDepth: 0 });
    const removed = signedVolume(withoutSlot[0].geometry) - signedVolume(withSlot[0].geometry);
    // Removed = gap x depth x pocket depth (thickness - 2 walls), NOT the full
    // thickness — the faces are sealed on both sides.
    const pocketZ = 6 - 2 * 1.5;
    expect(removed).toBeCloseTo(12 * 14 * pocketZ, 1);
    expect(removed).toBeLessThan(12 * 14 * 6);
    // The fresta (pocket z) still clears the ~1mm metal of the tab ring.
    expect(pocketZ).toBeGreaterThan(1);
    expect(isWatertight(withSlot[0].geometry)).toBe(true);
  });

  it("slot stays a closed pocket with a thinner/thicker wall setting", async () => {
    for (const slotWall of [0.8, 2.5]) {
      const cfg = { ...baseCfg, bevel: 0, slotDepth: 14, slotGap: 12, slotWall, keyring: false };
      const withSlot = await buildTabLifterParts(cfg);
      const withoutSlot = await buildTabLifterParts({ ...cfg, slotDepth: 0 });
      const removed = signedVolume(withoutSlot[0].geometry) - signedVolume(withSlot[0].geometry);
      expect(removed).toBeCloseTo(12 * 14 * (6 - 2 * slotWall), 1);
      expect(isWatertight(withSlot[0].geometry)).toBe(true);
    }
  });

  it("keyring hole sits on the bottom edge, opposite the rasgo", async () => {
    // baseCfg.outer is rectShape(40, 70) → after centring the piece spans
    // y in [0, 70] (base at 0). Hole radius = 1.5, so the bottom-hole centre
    // lands at y = 2 and the void spans y in [0.5, 3.5].
    const cfg = { ...baseCfg, bevel: 0, slotDepth: 0, keyring: true, keyringDiameter: 3 };
    const pieces = await buildTabLifterParts(cfg);
    const mesh = new THREE.Mesh(pieces[0].geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const yAt = (x: number) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 200, 0), new THREE.Vector3(0, -1, 0));
      return ray.intersectObject(mesh).map((h) => h.point.y);
    };
    // Solid column (beside the hole): enters at the top, exits at the bottom.
    const solid = yAt(3);
    expect(Math.min(...solid)).toBeCloseTo(0, 1);
    expect(Math.max(...solid)).toBeCloseTo(70, 1);
    // Hole column: an interior face pair appears near the BOTTOM edge — the
    // keyring hole moved to the opposite side of the rasgo.
    const holeCol = yAt(0);
    const interior = holeCol.filter((y) => y > 0.1 && y < 65);
    expect(interior.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...interior)).toBeLessThan(10);
    // No void near the top — nothing overlaps the rasgo's position.
    expect(holeCol.filter((y) => y > 10 && y < 65).length).toBe(0);
    expect(isWatertight(pieces[0].geometry)).toBe(true);
  });

  it("coloured regions become one extra piece per region with its colour", async () => {
    const cfg = {
      ...baseCfg,
      regions: [
        region("#1d4ed8", rectShape(16, 12)),
        region("#eab308", rectShape(10, 10)),
      ],
    };
    const pieces = await buildTabLifterParts(cfg);
    expect(pieces.length).toBe(3);
    expect(pieces[0].name).toBe("base");
    expect(pieces[1].color).toBe("#1d4ed8");
    expect(pieces[2].color).toBe("#eab308");
    for (const p of pieces) expect(isWatertight(p.geometry)).toBe(true);
  });

  it("reliefs sit on the front face (z = +thickness/2)", async () => {
    const cfg = {
      ...baseCfg,
      regions: [region("#1d4ed8", rectShape(16, 12))],
    };
    const pieces = await buildTabLifterParts(cfg);
    const relief = pieces[1].geometry;
    relief.computeBoundingBox();
    expect(relief.boundingBox!.min.z).toBeCloseTo(cfg.handleThickness / 2, 5);
    expect(relief.boundingBox!.max.z).toBeCloseTo(cfg.handleThickness / 2 + cfg.reliefDepth, 5);
  });

  it("bevel is disabled automatically when reliefs are present (flat face)", async () => {
    const cfg = {
      ...baseCfg,
      regions: [region("#1d4ed8", rectShape(16, 12))],
    };
    const pieces = await buildTabLifterParts(cfg);
    const relief = pieces[1].geometry;
    relief.computeBoundingBox();
    expect(relief.boundingBox!.min.z).toBeCloseTo(cfg.handleThickness / 2, 5);
  });

  it("slot is clamped/skipped on a narrow silhouette instead of breaking", async () => {
    const cfg = {
      ...baseCfg,
      outer: rectShape(6, 40), // width ~ 3mm per side → slot cannot fit
      slotDepth: 20,
    };
    const pieces = await buildTabLifterParts(cfg);
    expect(pieces.length).toBe(1);
    expect(isWatertight(pieces[0].geometry)).toBe(true);
    expect(signedVolume(pieces[0].geometry)).toBeGreaterThan(0);
  });

  it("silhouetteMode makes the base follow the region union, not the rectangle", async () => {
    const small = rectShape(10, 10); // x[-5,5], y[-5,5]
    const cfg = {
      ...baseCfg,
      bevel: 0,
      slotDepth: 0,
      keyring: false,
      silhouetteMode: true,
      regions: [region("#1d4ed8", small)],
    };
    const pieces = await buildTabLifterParts(cfg);
    expect(pieces.length).toBe(2); // base + relief
    // Base = the region extruded at full thickness, NOT the 40x70 rectangle.
    expect(signedVolume(pieces[0].geometry)).toBeCloseTo(10 * 10 * 6, 0);
    expect(isWatertight(pieces[0].geometry)).toBe(true);
    const rectPieces = await buildTabLifterParts({ ...cfg, silhouetteMode: false });
    expect(signedVolume(rectPieces[0].geometry)).toBeCloseTo(40 * 70 * 6, 0);
  });

  it("silhouetteMode unions disjoint region shapes into one base", async () => {
    const left = new THREE.Shape();
    left.moveTo(-15, -35); left.lineTo(-5, -35); left.lineTo(-5, 35); left.lineTo(-15, 35); left.closePath();
    const right = new THREE.Shape();
    right.moveTo(5, -35); right.lineTo(15, -35); right.lineTo(15, 35); right.lineTo(5, 35); right.closePath();
    const cfg = {
      ...baseCfg,
      bevel: 0,
      slotDepth: 0,
      keyring: false,
      silhouetteMode: true,
      regions: [region("#1d4ed8", left, right)],
    };
    const pieces = await buildTabLifterParts(cfg);
    // Two disjoint 10x70 strips → unioned base = 2 * (10*70*6).
    expect(signedVolume(pieces[0].geometry)).toBeCloseTo(2 * 10 * 70 * 6, 0);
    expect(isWatertight(pieces[0].geometry)).toBe(true);
  });

  it("silhouetteMode still carves the closed slot from the drawing top", async () => {
    const cfg = {
      ...baseCfg,
      bevel: 0,
      slotDepth: 14,
      slotGap: 12,
      slotWall: 1.5,
      keyring: false,
      silhouetteMode: true,
      regions: [region("#1d4ed8", rectShape(20, 70))],
    };
    const withSlot = await buildTabLifterParts(cfg);
    const without = await buildTabLifterParts({ ...cfg, slotDepth: 0 });
    const removed = signedVolume(without[0].geometry) - signedVolume(withSlot[0].geometry);
    expect(removed).toBeCloseTo(12 * 14 * (6 - 2 * 1.5), 1);
    expect(isWatertight(withSlot[0].geometry)).toBe(true);
  });

  it("every preset in silhouette mode carves a real closed pocket (no hollow)", { timeout: 30000 }, async () => {
    // Regression for the "peça oca" bug: in silhouette mode the base used to
    // be a fragile union of separate prisms that (a) broke manifold on the
    // butterfly and (b) let the rasgo eat a 2 mm disconnected head without
    // forming any cavity — no internal structure to capture the tab. Every
    // preset must now produce a solid, watertight body with a genuine sealed
    // pocket at the rasgo.
    for (const preset of OPENER_PRESETS) {
      const traced = buildOpenerPreset(preset, 60);
      const cfg = {
        ...baseCfg,
        bevel: 0,
        slotDepth: 14,
        slotGap: 12,
        slotWall: 1.5,
        keyring: false,
        silhouetteMode: true,
        outer: traced.outer,
        regions: traced.regions,
      };
      const withSlot = await buildTabLifterParts(cfg);
      const without = await buildTabLifterParts({ ...cfg, slotDepth: 0 });
      const removed = signedVolume(without[0].geometry) - signedVolume(withSlot[0].geometry);
      // The rasgo carves a real cavity (structure exists)...
      expect(removed, `${preset.id} should carve a pocket`).toBeGreaterThan(0);
      // ...but it is a CLOSED pocket: less than a full through-slot
      // (gap x depth x full thickness), so both faces stay solid ("tampado").
      expect(removed, `${preset.id} pocket must stay sealed on both faces`).toBeLessThan(cfg.slotGap * cfg.slotDepth * cfg.handleThickness);
      expect(isWatertight(withSlot[0].geometry), `${preset.id} piece must be watertight`).toBe(true);
    }
  });

  it("single-colour merge is watertight", async () => {
    const cfg = {
      ...baseCfg,
      regions: [region("#1d4ed8", rectShape(16, 12))],
    };
    const merged = await buildTabLifterSingleColor(cfg);
    expect(isWatertight(merged)).toBe(true);
    expect(signedVolume(merged)).toBeGreaterThan(0);
  });

  it("fillBackground closes the internal hole (solid slab)", async () => {
    // Outer with a central hole (like the "vazada" background).
    const outer = new THREE.Shape();
    outer.moveTo(-20, -35);
    outer.lineTo(20, -35);
    outer.lineTo(20, 35);
    outer.lineTo(-20, 35);
    outer.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 6, 0, Math.PI * 2, false);
    outer.holes.push(hole);

    const hollow = await buildTabLifterParts({ ...baseCfg, outer, slotDepth: 0, bevel: 0 });
    const filled = await buildTabLifterParts({ ...baseCfg, outer, slotDepth: 0, bevel: 0, fillBackground: true });
    // The hollow base has less material; the filled base recovers the hole's
    // volume (area pi*6^2 x thickness 6).
    const volHollow = signedVolume(hollow[0].geometry);
    const volFilled = signedVolume(filled[0].geometry);
    expect(volFilled).toBeGreaterThan(volHollow);
    expect(volFilled - volHollow).toBeGreaterThan(Math.PI * 36 * 6 * 0.98);
    expect(volFilled - volHollow).toBeLessThan(Math.PI * 36 * 6 * 1.02);
    expect(isWatertight(filled[0].geometry)).toBe(true);
  });

  it("repeatBack mirrors the relief onto the back face", async () => {
    const cfg = {
      ...baseCfg,
      regions: [region("#1d4ed8", rectShape(16, 12))],
      repeatBack: true,
    };
    const pieces = await buildTabLifterParts(cfg);
    // Same single region piece (front + back merged into one colour piece).
    expect(pieces.length).toBe(2);
    const relief = pieces[1].geometry;
    relief.computeBoundingBox();
    expect(relief.boundingBox!.min.z).toBeCloseTo(-cfg.handleThickness / 2 - cfg.reliefDepth, 5);
    expect(relief.boundingBox!.max.z).toBeCloseTo(cfg.handleThickness / 2 + cfg.reliefDepth, 5);
    expect(isWatertight(pieces[1].geometry)).toBe(true);
  });
});