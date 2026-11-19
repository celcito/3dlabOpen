import type * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { FitConfig } from "../types";
import { resolveFitPair } from "../fit";
import { lidToPrimitive } from "../lid";
import { buildContainerGeometry } from "../container";
import { generateFitScad } from "../scad";
import { buildPrimitiveGeometry } from "../../primitives/geometry";

const base: FitConfig = {
  shape: "cylinder",
  diameter: 60,
  width: 50,
  depth: 80,
  containerHeight: 40,
  wall: 2.5,
  floor: 2.5,
  lidPlate: 4,
  lidSkirt: 10,
  clearance: 0.4,
  chamfer: false,
  chamferSize: 2,
  quality: 1,
};

function bbox(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  return {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z,
    minY: box.min.y,
    maxY: box.max.y,
  };
}

function radii(geometry: THREE.BufferGeometry) {
  const positions = geometry.attributes.position;
  const list: { r: number; y: number }[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    expect(Number.isNaN(x + y + z)).toBe(false);
    list.push({ r: Math.hypot(x, z), y });
  }
  return list;
}

describe("resolveFitPair", () => {
  it("derives the opening and the skirt from the outside diameter", () => {
    const fit = resolveFitPair(base);
    expect(fit.circular).toBe(true);
    expect(fit.outerHalfW).toBeCloseTo(30, 5);
    expect(fit.innerHalfW).toBeCloseTo(27.5, 5);
    expect(fit.skirtHalfW).toBeCloseTo(27.1, 5);
    expect(fit.skirt).toBeCloseTo(10, 5);
    expect(fit.lidPlate).toBeCloseTo(4, 5);
  });

  it("locks the depth to the width for a square", () => {
    const fit = resolveFitPair({ ...base, shape: "square", width: 50, depth: 120 });
    expect(fit.outerHalfW).toBeCloseTo(25, 5);
    expect(fit.outerHalfD).toBeCloseTo(25, 5);
  });

  it("keeps width and depth free for a rectangle", () => {
    const fit = resolveFitPair({ ...base, shape: "rectangle", width: 50, depth: 80 });
    expect(fit.innerHalfW).toBeCloseTo(22.5, 5);
    expect(fit.innerHalfD).toBeCloseTo(37.5, 5);
    expect(fit.skirtHalfW).toBeCloseTo(22.1, 5);
    expect(fit.skirtHalfD).toBeCloseTo(37.1, 5);
  });

  it("keeps the skirt short enough not to bottom out", () => {
    const fit = resolveFitPair({ ...base, lidSkirt: 200 });
    expect(fit.skirt).toBeCloseTo(fit.height - fit.floor - 1, 5);
    expect(fit.skirt).toBeLessThan(fit.height - fit.floor);
  });

  it("clamps the container chamfer by the wall", () => {
    const fit = resolveFitPair({ ...base, chamfer: true, chamferSize: 8 });
    expect(fit.chamfer).toBeCloseTo(2.25, 5);
  });
});

describe("buildContainerGeometry", () => {
  it("builds a hollow cylinder on the origin", () => {
    const g = buildContainerGeometry(base);
    const s = bbox(g);
    expect(s.x).toBeCloseTo(60, 1);
    expect(s.z).toBeCloseTo(60, 1);
    expect(s.y).toBeCloseTo(40, 5);
    expect(s.minY).toBeCloseTo(0, 5);

    const list = radii(g);
    expect(list.filter((p) => p.r > 0.5).every((p) => p.r >= 27.4)).toBe(true);
    expect(list.some((p) => Math.abs(p.r - 27.5) < 0.01)).toBe(true);
    expect(list.some((p) => p.y > 2.4 && p.y < 2.6 && Math.abs(p.r - 27.5) < 0.01)).toBe(true);
  });

  it("builds a rectangular container with the configured footprint", () => {
    const g = buildContainerGeometry({ ...base, shape: "rectangle" });
    const s = bbox(g);
    expect(s.x).toBeCloseTo(50, 5);
    expect(s.z).toBeCloseTo(80, 5);
    expect(s.y).toBeCloseTo(40, 5);
  });

  it("bevels the base and the rim when the chamfer is on", () => {
    const g = buildContainerGeometry({ ...base, chamfer: true, chamferSize: 2 });
    const s = bbox(g);
    expect(s.x).toBeCloseTo(60, 5);
    const bottoms = radii(g).filter((p) => p.y < 1e-6 && p.r > 1);
    expect(Math.max(...bottoms.map((p) => p.r))).toBeCloseTo(28, 1);
  });
});

describe("lid geometry", () => {
  it("matches the container opening with the configured clearance", () => {
    const config = lidToPrimitive(base);
    const skirt = buildPrimitiveGeometry(config, { part: "spigot" });
    const flange = buildPrimitiveGeometry(config, { part: "flange" });

    const skirtRadius = Math.max(...radii(skirt).map((p) => p.r));
    const flangeSize = bbox(flange);

    expect(skirtRadius).toBeCloseTo(27.1, 1);
    expect(flangeSize.x).toBeCloseTo(60, 1);
    expect(flangeSize.y).toBeCloseTo(4, 5);
  });

  it("stacks the skirt and the plate into the lid height", () => {
    const config = lidToPrimitive(base);
    const s = bbox(buildPrimitiveGeometry(config));
    expect(s.y).toBeCloseTo(14, 5);
    expect(s.x).toBeCloseTo(60, 1);
  });
});

describe("generateFitScad", () => {
  it("emits both modules with the resolved numbers", () => {
    const scad = generateFitScad(base);
    expect(scad).toContain("module container()");
    expect(scad).toContain("module lid()");
    expect(scad).toContain('PART = "both"');
    expect(scad).toContain("RS = 27.1;");
    expect(scad).toContain("SKIRT = 10;");
  });

  it("uses the box primitives for a square container", () => {
    const scad = generateFitScad({ ...base, shape: "square" });
    expect(scad).toContain("module chamfered_box(");
    expect(scad).not.toContain("rotate_extrude");
    expect(scad).toContain("SW = 44.2;");
  });
});
