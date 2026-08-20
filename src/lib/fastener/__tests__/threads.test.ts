import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  buildThreadedRod,
  buildInternalThreadRemoval,
  threadDepth,
  minorDiameter,
  threadRadiusFactor,
  isWatertight,
  signedVolume,
} from "../threads";

function boundingBox(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  return {
    minX: bb.min.x, maxX: bb.max.x,
    minY: bb.min.y, maxY: bb.max.y,
    minZ: bb.min.z, maxZ: bb.max.z,
  };
}

describe("threadRadiusFactor", () => {
  it("rises to crest at quarter pitch and returns to root at half", () => {
    expect(threadRadiusFactor(0)).toBeCloseTo(0, 5);
    expect(threadRadiusFactor(0.25)).toBeCloseTo(1, 5);
    expect(threadRadiusFactor(0.5)).toBeCloseTo(0, 5);
    expect(threadRadiusFactor(1)).toBeCloseTo(0, 5);
    expect(threadRadiusFactor(1.25)).toBeCloseTo(1, 5);
  });
});

describe("buildThreadedRod", () => {
  const rod = () => buildThreadedRod({ major: 5, pitch: 0.8, length: 8, segments: 48, stepsPerPitch: 12 });

  it("is watertight", () => {
    expect(isWatertight(rod())).toBe(true);
  });

  it("has positive outward volume", () => {
    expect(signedVolume(rod())).toBeGreaterThan(0);
  });

  it("matches nominal diameter and length bounds", () => {
    const bb = boundingBox(rod());
    expect(bb.maxY - bb.minY).toBeCloseTo(8, 5);
    // Crest radius ~= 2.5
    expect(Math.max(bb.maxX, bb.maxZ)).toBeGreaterThan(2.4);
    expect(Math.max(bb.maxX, bb.maxZ)).toBeLessThanOrEqual(2.51);
    // Root radius must stay above minor diameter
    const minR = Math.min(bb.maxX, Math.abs(bb.minX), Math.abs(bb.minZ), bb.maxZ);
    expect(minR).toBeGreaterThanOrEqual(minorDiameter(5, 0.8) / 2 - 1e-6);
  });

  it("keeps axial position aligned with Y", () => {
    const bb = boundingBox(rod());
    expect(bb.minY).toBeCloseTo(0, 5);
  });

  it("supports left-hand threads", () => {
    const lhs = buildThreadedRod({ major: 5, pitch: 0.8, length: 4, segments: 48, stepsPerPitch: 12, hand: -1 });
    expect(isWatertight(lhs)).toBe(true);
  });
});

describe("buildInternalThreadRemoval", () => {
  it("is watertight and sized for a threaded hole", () => {
    const rem = buildInternalThreadRemoval({ holeDiameter: 5, pitch: 0.8, length: 6, segments: 48, stepsPerPitch: 12 });
    expect(isWatertight(rem)).toBe(true);
    expect(signedVolume(rem)).toBeGreaterThan(0);
    const bb = boundingBox(rem);
    // Removal crests extend depth beyond the hole wall.
    const crestR = Math.max(bb.maxX, bb.maxZ);
    expect(crestR).toBeGreaterThan(2.5 + threadDepth(0.8) - 1e-6);
    expect(bb.maxY - bb.minY).toBeCloseTo(6, 5);
  });
});

describe("dimension helpers", () => {
  it("computes ISO thread depth and minor diameter", () => {
    const d = threadDepth(0.8);
    expect(d).toBeCloseTo(0.433, 2);
    expect(minorDiameter(5, 0.8)).toBeCloseTo(5 - 2 * d, 5);
  });
});
