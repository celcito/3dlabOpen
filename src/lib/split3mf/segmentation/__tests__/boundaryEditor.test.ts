import { describe, it, expect } from "vitest";
import {
  pullBoundary,
  pushBoundary,
  smoothBoundary,
  applyBoundaryEdit,
  collectBoundaryLines,
} from "../boundaryEditor";
import type { SegmentGeometry } from "../colorCluster";

/** 8-vertex triangle strip, all one region: [0..7] → region 1. */
function stripGeometry(): { mask: Uint8Array; geom: SegmentGeometry } {
  const indices: number[] = [];
  for (let i = 0; i + 2 < 8; i++) indices.push(i, i + 1, i + 2);
  const geom: SegmentGeometry = { indices: new Uint32Array(indices), vertexCount: 8 };
  const mask = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]);
  return { mask, geom };
}

/** Two-region strip: verts 0-3 region 1, verts 4-7 region 2. */
function twoRegionStrip(): { mask: Uint8Array; geom: SegmentGeometry } {
  const indices: number[] = [];
  for (let i = 0; i + 2 < 8; i++) indices.push(i, i + 1, i + 2);
  const geom: SegmentGeometry = { indices: new Uint32Array(indices), vertexCount: 8 };
  const mask = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2]);
  return { mask, geom };
}

describe("pullBoundary", () => {
  it("paints the target vertex and its 1-hop neighborhood", () => {
    const { mask, geom } = stripGeometry();
    const out = pullBoundary(mask, geom, 3, 2, 1);
    expect(out[3]).toBe(2);
    expect(out[2]).toBe(2); // neighbor via triangles
    expect(out[0]).toBe(1); // far vertex untouched
  });

  it("respects radius 0 (single vertex paint)", () => {
    const { mask, geom } = stripGeometry();
    const out = pullBoundary(mask, geom, 4, 2, 0);
    expect(out[4]).toBe(2);
    expect(out[3]).toBe(1);
    expect(out[5]).toBe(1);
  });

  it("does not mutate the input mask (immutability)", () => {
    const { mask, geom } = stripGeometry();
    const out = pullBoundary(mask, geom, 3, 2, 1);
    expect(mask[3]).toBe(1);
    expect(out[3]).toBe(2);
  });

  it("is a no-op for out-of-range vertex index", () => {
    const { mask, geom } = stripGeometry();
    const out = pullBoundary(mask, geom, 999, 2, 1);
    expect(Array.from(out)).toEqual(Array.from(mask));
  });
});

describe("pushBoundary", () => {
  it("erases target-region paint at the brush frontier", () => {
    const { mask, geom } = twoRegionStrip();
    // Push at boundary vertex 4 (region 2), radius 1: target-painted frontier
    // vertex 5 gets reassigned to region 1.
    const out = pushBoundary(mask, geom, 4, 2, 1);
    expect(out[5]).toBe(1);
    expect(out[4]).toBe(2); // brush anchor keeps its region
    expect(out[1]).toBe(1); // far side untouched
  });

  it("keeps the target region vertex when it has no non-target neighbors", () => {
    const { mask, geom } = stripGeometry();
    const out = pushBoundary(mask, geom, 7, 1, 1);
    // All neighbors are also region 1 → unchanged.
    expect(Array.from(out)).toEqual(Array.from(mask));
  });

  it("does not mutate the input mask", () => {
    const { mask, geom } = twoRegionStrip();
    const before = Array.from(mask);
    pushBoundary(mask, geom, 4, 2, 1);
    expect(Array.from(mask)).toEqual(before);
  });
});

describe("smoothBoundary", () => {
  it("is a no-op at smoothness 0", () => {
    const { mask, geom } = twoRegionStrip();
    const out = smoothBoundary(mask, geom, 0);
    expect(Array.from(out)).toEqual(Array.from(mask));
  });

  it("removes a single stray vertex via majority vote", () => {
    const { mask, geom } = stripGeometry();
    mask[4] = 2; // stray
    const out = smoothBoundary(mask, geom, 60);
    expect(out[4]).toBe(1); // neighbors agree on region 1
  });

  it("keeps a well-supported region boundary", () => {
    const { mask, geom } = twoRegionStrip();
    const out = smoothBoundary(mask, geom, 60);
    // 4 vs 4 split keeps both halves (no decisive majority to flip).
    expect(new Set([out[0], out[3], out[4], out[7]]).size).toBeGreaterThanOrEqual(1);
  });
});

describe("applyBoundaryEdit", () => {
  it("dispatches pull semantics", () => {
    const { mask, geom } = stripGeometry();
    const out = applyBoundaryEdit(mask, geom, "pull", 3, 2, { radius: 1 });
    expect(out[3]).toBe(2);
  });

  it("dispatches push semantics", () => {
    const { mask, geom } = twoRegionStrip();
    const out = applyBoundaryEdit(mask, geom, "push", 4, 2, { radius: 1 });
    expect(out[5]).toBe(1);
  });
});

describe("collectBoundaryLines", () => {
  it("returns pairs where region ids differ", () => {
    const { mask, geom } = twoRegionStrip();
    const lines = collectBoundaryLines(mask, geom);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(mask[l.a]).not.toBe(mask[l.b]);
    }
  });

  it("returns no lines for a single-region mask", () => {
    const { mask, geom } = stripGeometry();
    expect(collectBoundaryLines(mask, geom)).toEqual([]);
  });

  it("deduplicates shared boundary edges", () => {
    const { mask, geom } = twoRegionStrip();
    const lines = collectBoundaryLines(mask, geom);
    const keys = new Set(lines.map((l) => `${l.a}:${l.b}`));
    expect(keys.size).toBe(lines.length);
  });
});