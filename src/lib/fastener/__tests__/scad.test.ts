import { describe, it, expect } from "vitest";
import { generateScad } from "../scad";
import { getFastenerSize } from "../sizes";
import type { FastenerConfig } from "../types";

const base = (over: Partial<FastenerConfig>): FastenerConfig => ({
  type: "screw",
  system: "metric",
  size: "M5",
  length: 20,
  headType: "hex",
  driveType: "hex",
  fullThread: true,
  threadLength: 20,
  splitScrew: false,
  nutShape: "hex",
  nutThicknessOverride: 0,
  clearance: 0.1,
  bevelNut: true,
  washerType: "standard",
  washerChamfer: true,
  quality: 1,
  debugMode: false,
  ...over,
});

describe("pure-OpenSCAD export", () => {
  it("never emits BOSL2 or template-literal leftovers", () => {
    const scad = generateScad(base({}), getFastenerSize("metric", "M5"));
    expect(scad).not.toMatch(/\$\{/);
    expect(scad).not.toContain("BOSL2");
    expect(scad).not.toContain("include <");
  });

  it("interpolates real dimensions (M5 screw, 20 mm)", () => {
    const scad = generateScad(base({}), getFastenerSize("metric", "M5"));
    expect(scad).toContain("L = 20;");
    expect(scad).toContain("P = 0.8;");
    expect(scad).toContain("screw();");
  });

  it("uses a stacked twist extrusion for threads", () => {
    const scad = generateScad(base({}), getFastenerSize("metric", "M5"));
    expect(scad).toContain("linear_extrude(height = pitch, twist = 360");
  });

  it("emits a valid screw body and drive recess", () => {
    const scad = generateScad(base({ headType: "hex" }), getFastenerSize("metric", "M5"));
    expect(scad).toContain("module screw()");
    expect(scad).toContain("$fn = 6");
    expect(scad).toContain("difference()");
  });

  it("wraps the screw in an intersection when split", () => {
    const scad = generateScad(base({ splitScrew: true }), getFastenerSize("metric", "M5"));
    expect(scad).toContain("intersection()");
    expect(scad).toContain("cube([500, 1000, 1000])");
  });

  it("renders a partial-thread shank when fullThread is off", () => {
    const scad = generateScad(base({ fullThread: false, threadLength: 10 }), getFastenerSize("metric", "M5"));
    expect(scad).toContain("threadEnd = 10.8;");
    expect(scad).toContain("shankEnd = 20;");
  });

  it("renders a torx recess as a star polygon", () => {
    const scad = generateScad(base({ driveType: "torx", headType: "socket" }), getFastenerSize("metric", "M5"));
    expect(scad).toContain("polygon(points = [");
  });

  it("renders a nut with a threaded hole and chamfers", () => {
    const scad = generateScad(base({ type: "nut", bevelNut: true }), getFastenerSize("metric", "M5"));
    expect(scad).toContain("module nut()");
    expect(scad).toContain("thread_rod(holeD + 2 * depth");
    expect(scad).toContain("chamfer_ring");
    expect(scad).toContain("nut();");
  });

  it("uses a square prism for square nuts", () => {
    const scad = generateScad(base({ type: "nut", nutShape: "square" }), getFastenerSize("metric", "M5"));
    expect(scad).toContain("cube([s, s, t]");
  });

  it("renders a washer with chamfered edges", () => {
    const scad = generateScad(base({ type: "washer", washerChamfer: true }), getFastenerSize("metric", "M5"));
    expect(scad).toContain("module washer()");
    expect(scad).toContain("d1 = 5.3;");
    expect(scad).toContain("washer();");
  });

  it("honors nut thickness override", () => {
    const scad = generateScad(base({ type: "nut", nutThicknessOverride: 6 }), getFastenerSize("metric", "M5"));
    expect(scad).toContain("t = 6;");
  });

  it("emits debug echo when requested", () => {
    const scad = generateScad(base({ debugMode: true }), getFastenerSize("metric", "M5"));
    expect(scad).toContain('echo("size=M5');
  });
});