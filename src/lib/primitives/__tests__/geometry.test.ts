import { describe, expect, it } from "vitest";
import { buildPrimitiveGeometry, resolveChamfer } from "../geometry";
import type { PrimitiveConfig } from "../types";

const base: PrimitiveConfig = {
  shape: "cylinder",
  diameter: 40,
  width: 40,
  depth: 30,
  height: 50,
  chamfer: false,
  chamferSize: 2,
  knurl: false,
  knurlRidges: 24,
  knurlDepth: 1,
  quality: 1,
};

function size(config: PrimitiveConfig) {
  const g = buildPrimitiveGeometry(config);
  g.computeBoundingBox();
  const box = g.boundingBox!;
  return {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z,
    triangles: g.attributes.position.count / 3,
  };
}

describe("buildPrimitiveGeometry", () => {
  it("builds a cylinder with the configured footprint and height", () => {
    const s = size(base);
    expect(s.x).toBeCloseTo(40, 1);
    expect(s.z).toBeCloseTo(40, 1);
    expect(s.y).toBeCloseTo(50, 5);
    expect(s.triangles).toBeGreaterThan(0);
  });

  it("builds a box with the configured dimensions", () => {
    const s = size({ ...base, shape: "box" });
    expect(s.x).toBeCloseTo(40, 5);
    expect(s.z).toBeCloseTo(30, 5);
    expect(s.y).toBeCloseTo(50, 5);
  });

  it("keeps the outer dimensions when chamfered", () => {
    const s = size({ ...base, chamfer: true, chamferSize: 3 });
    expect(s.x).toBeCloseTo(40, 1);
    expect(s.z).toBeCloseTo(40, 1);
    expect(s.y).toBeCloseTo(50, 5);
  });

  it("keeps knurl ridges inside the configured diameter", () => {
    const g = buildPrimitiveGeometry({ ...base, knurl: true, knurlRidges: 20, knurlDepth: 1.5 });
    const positions = g.attributes.position;
    let maxRadius = 0;
    for (let i = 0; i < positions.count; i++) {
      maxRadius = Math.max(maxRadius, Math.hypot(positions.getX(i), positions.getZ(i)));
    }
    expect(maxRadius).toBeLessThanOrEqual(20.0001);
    expect(maxRadius).toBeGreaterThan(19);
  });

  it("clamps the chamfer to the part", () => {
    const chamfer = resolveChamfer({ ...base, chamfer: true, chamferSize: 200 });
    expect(chamfer).toBeLessThan(20);
    expect(chamfer).toBeGreaterThan(0);
  });
});
