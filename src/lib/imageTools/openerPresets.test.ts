import { describe, it, expect } from "vitest";
import { OPENER_PRESETS, buildOpenerPreset } from "./openerPresets";

describe("openerPresets", () => {
  it("provides a non-empty library of rectangular presets", () => {
    expect(OPENER_PRESETS.length).toBeGreaterThanOrEqual(6);
    for (const preset of OPENER_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.svg).toContain("<svg");
      expect(preset.svg).toContain("viewBox");
    }
  });

  it("builds a rectangular TracedImage from a preset", { timeout: 15000 }, () => {
    for (const preset of OPENER_PRESETS) {
      const traced = buildOpenerPreset(preset, 60);
      expect(traced.outer.getPoints().length).toBeGreaterThanOrEqual(4);
      expect(traced.regions.length).toBeGreaterThanOrEqual(1);
      expect(traced.widthMm).toBeCloseTo(60, 5);
      expect(traced.heightMm).toBeCloseTo(90, 5); // 1.5 * width
      // The base must be a rectangle: axis-aligned box with straight corners.
      const pts = traced.outer.getPoints();
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      expect(minX).toBeCloseTo(0, 5);
      expect(minY).toBeCloseTo(0, 5);
      expect(maxX).toBeCloseTo(60, 5);
      expect(maxY).toBeCloseTo(90, 5);
      for (const pt of pts) {
        expect(pt.x).toBeGreaterThanOrEqual(-1e-6);
        expect(pt.x).toBeLessThanOrEqual(60 + 1e-6);
        expect(pt.y).toBeGreaterThanOrEqual(-1e-6);
        expect(pt.y).toBeLessThanOrEqual(90 + 1e-6);
      }
      // Every region colour is a valid hex.
      for (const region of traced.regions) {
        expect(region.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(region.shapes.length).toBeGreaterThanOrEqual(1);
      }
      // All drawing shapes stay inside the base.
      for (const region of traced.regions) {
        for (const shape of region.shapes) {
          for (const p of shape.getPoints(4)) {
            expect(p.x).toBeGreaterThanOrEqual(-1e-3);
            expect(p.x).toBeLessThanOrEqual(60 + 1e-3);
            expect(p.y).toBeGreaterThanOrEqual(-1e-3);
            expect(p.y).toBeLessThanOrEqual(90 + 1e-3);
          }
        }
      }
    }
  });

  it("re-scales the base when the target width changes", () => {
    const traced = buildOpenerPreset(OPENER_PRESETS[0], 40);
    expect(traced.widthMm).toBeCloseTo(40, 5);
    expect(traced.heightMm).toBeCloseTo(60, 5);
  });
});