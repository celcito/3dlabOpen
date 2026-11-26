import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildPrimitiveGeometry, resolveChamfer, resolveFit, resolveGroove } from "../geometry";
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
  fit: false,
  fitHeight: 8,
  fitClearance: 0.4,
  groove: false,
  grooveWidth: 2.5,
  grooveDepth: 1.2,
  grooveHeight: 4,
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

/** Largest radial distance among the vertices below `maxY`. */
function maxRadiusBelow(config: PrimitiveConfig, maxY: number) {
  const g = buildPrimitiveGeometry(config);
  const positions = g.attributes.position;
  let maxRadius = 0;
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) < maxY - 1e-6) {
      maxRadius = Math.max(maxRadius, Math.hypot(positions.getX(i), positions.getZ(i)));
    }
  }
  return maxRadius;
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

  it("steps the lid spigot in by the clearance and keeps the nominal top", () => {
    const config = { ...base, fit: true, fitHeight: 8, fitClearance: 0.4 };
    const s = size(config);
    expect(s.x).toBeCloseTo(40, 1);
    expect(s.y).toBeCloseTo(50, 5);
    // Below the shoulder only the spigot exists: radius 20 - 0.4.
    expect(maxRadiusBelow(config, 8)).toBeCloseTo(19.6, 1);
    expect(maxRadiusBelow(config, 49)).toBeCloseTo(20, 1);
  });

  it("steps a square lid spigot on both faces", () => {
    const config: PrimitiveConfig = { ...base, shape: "box", fit: true, fitHeight: 10, fitClearance: 0.5 };
    const g = buildPrimitiveGeometry(config);
    const positions = g.attributes.position;
    let maxX = 0;
    let maxZ = 0;
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) < 10 - 1e-6) {
        maxX = Math.max(maxX, Math.abs(positions.getX(i)));
        maxZ = Math.max(maxZ, Math.abs(positions.getZ(i)));
      }
    }
    expect(maxX).toBeCloseTo(19.5, 5);
    expect(maxZ).toBeCloseTo(14.5, 5);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeCloseTo(40, 5);
  });

  it("cuts an elastic-band groove into a cylinder", () => {
    const config: PrimitiveConfig = { ...base, groove: true, grooveHeight: 25, grooveWidth: 4, grooveDepth: 1.5 };
    const g = buildPrimitiveGeometry(config);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const wallAt = (y: number) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(0, y, 0), new THREE.Vector3(1, 0, 0));
      const hit = ray.intersectObject(mesh)[0];
      return hit ? hit.distance : 0;
    };

    expect(wallAt(25)).toBeCloseTo(18.5, 2);
    expect(wallAt(10)).toBeCloseTo(20, 2);
    expect(wallAt(40)).toBeCloseTo(20, 2);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeCloseTo(40, 1);
    expect(g.boundingBox!.max.y - g.boundingBox!.min.y).toBeCloseTo(50, 5);
  });

  it("keeps the groove on the spigot and ignores it for boxes", () => {
    const config: PrimitiveConfig = {
      ...base,
      fit: true,
      fitHeight: 8,
      groove: true,
      grooveHeight: 4,
      grooveWidth: 2.4,
      grooveDepth: 1.2,
    };
    const groove = resolveGroove(config);
    expect(groove).not.toBeNull();
    expect(groove!.bottom).toBeGreaterThan(0);
    expect(groove!.bottom + groove!.width).toBeLessThan(8);
    expect(resolveGroove({ ...config, shape: "box" })).toBeNull();
  });

  it("keeps the chamfer inside the spigot height", () => {
    const config: PrimitiveConfig = { ...base, chamfer: true, chamferSize: 20, fit: true, fitHeight: 6, fitClearance: 0.4 };
    const chamfer = resolveChamfer(config);
    expect(chamfer).toBeLessThan(6);
    const s = size(config);
    expect(s.x).toBeCloseTo(40, 1);
    expect(s.y).toBeCloseTo(50, 5);
    expect(resolveFit(config)?.height).toBe(6);
  });
});
