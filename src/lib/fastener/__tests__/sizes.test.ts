import { describe, it, expect } from "vitest";
import {
  getFastenerSize,
  getSizeLabels,
  resolveHeadDims,
  resolveNutDims,
  resolveWasherDims,
} from "../sizes";

describe("fastener size tables", () => {
  it("exposes every metric size M2..M20", () => {
    const labels = getSizeLabels("metric");
    expect(labels).toEqual(["M2", "M2.5", "M3", "M4", "M5", "M6", "M7", "M8", "M10", "M12", "M14", "M16", "M18", "M20"]);
  });

  it("exposes every UTS size", () => {
    const labels = getSizeLabels("uts");
    expect(labels).toContain("#4");
    expect(labels).toContain("1/4");
    expect(labels).toContain("3/4");
  });

  it("M5 resolves to pitch 0.8 and hex across-flats 8", () => {
    const m5 = getFastenerSize("metric", "M5");
    expect(m5.majorD).toBeCloseTo(5, 5);
    expect(m5.pitch).toBeCloseTo(0.8, 5);
    expect(m5.hexHead?.s).toBeCloseTo(8, 5);
    expect(m5.nut?.s).toBeCloseTo(8, 5);
    expect(m5.nut?.m).toBeCloseTo(4, 5);
    expect(m5.washer?.d1).toBeCloseTo(5.3, 5);
  });

  it("every metric size has a positive pitch and major diameter", () => {
    for (const label of getSizeLabels("metric")) {
      const spec = getFastenerSize("metric", label);
      expect(spec.pitch).toBeGreaterThan(0);
      expect(spec.majorD).toBeGreaterThan(0);
      expect(spec.majorD).toBeLessThanOrEqual(20);
    }
  });

  it("UTS 1/4 converts to ~6.35 mm major and ~1.27 mm pitch", () => {
    const q = getFastenerSize("uts", "1/4");
    expect(q.majorD).toBeCloseTo(6.35, 1);
    expect(q.pitch).toBeCloseTo(1.27, 1);
  });

  it("falls back gracefully for unknown sizes", () => {
    const spec = getFastenerSize("metric", "banana");
    expect(spec.majorD).toBeGreaterThan(0);
  });

  it("resolveHeadDims fills defaults when a table entry is missing", () => {
    const bare = { label: "X", system: "metric", majorD: 5, pitch: 0.8 } as const;
    const hex = resolveHeadDims({ ...bare }, "hex");
    expect(hex.dk).toBeGreaterThan(0);
    expect(hex.k).toBeGreaterThan(0);
  });

  it("socket head exposes a hex socket size", () => {
    const m5 = getFastenerSize("metric", "M5");
    const socket = resolveHeadDims(m5, "socket");
    expect(socket.socket).toBeCloseTo(4, 5);
  });

  it("resolveNutDims and resolveWasherDims return sane values", () => {
    const m5 = getFastenerSize("metric", "M5");
    const nut = resolveNutDims(m5, "hex");
    const w = resolveWasherDims(m5, false);
    const wl = resolveWasherDims(m5, true);
    expect(nut.s).toBeGreaterThan(m5.majorD);
    expect(nut.m).toBeGreaterThan(0);
    expect(w.d1).toBeGreaterThan(m5.majorD * 0.9);
    expect(wl.d2).toBeGreaterThan(w.d2);
  });
});
