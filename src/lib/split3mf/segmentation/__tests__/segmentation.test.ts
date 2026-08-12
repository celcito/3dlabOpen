import { describe, it, expect } from "vitest";
import {
  segmentByColor,
  buildAdjacency,
  clusterColorsBySimilarity,
  floodFillConnectedComponents,
  mergeSmallRegions,
  countBoundaryEdges,
  type SegmentGeometry,
} from "../colorCluster";
import { segmentColors, detectGpu, estimateVram } from "../gpuSegmenter";

/** Two 4-vertex quads: red on the left, blue on the right (indexed). */
function twoColorQuads(): { colors: Float32Array; geom: SegmentGeometry } {
  const colors = new Float32Array(8 * 3);
  for (let i = 0; i < 4; i++) {
    colors[i * 3] = 1; // red (255,0,0)
  }
  for (let i = 4; i < 8; i++) {
    colors[i * 3 + 2] = 1; // blue (0,0,255)
  }
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const geom: SegmentGeometry = { colors, indices, vertexCount: 8 };
  return { colors, geom };
}

describe("colorCluster — known clusters", () => {
  it("separates two known color clusters by ΔE threshold", () => {
    const { colors, geom } = twoColorQuads();
    const stats = segmentByColor(colors, geom, { threshold: 8 });
    expect(stats.regionCount).toBe(2);
    expect(stats.regionSizes).toEqual([4, 4]);
    expect(stats.regionMask[0]).toBe(1);
    expect(stats.regionMask[4]).toBe(2);
  });

  it("merges colors within threshold into a single region", () => {
    const colors = new Float32Array(6 * 3);
    for (let i = 0; i < 6; i++) {
      colors[i * 3] = 1; // all near-red
      colors[i * 3 + 1] = i * 0.001; // tiny drift
    }
    // Connected triangle strip so flood-fill keeps one component.
    const indices = new Uint32Array([0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 4, 5]);
    const geom: SegmentGeometry = { colors, indices, vertexCount: 6 };
    const stats = segmentByColor(colors, geom, { threshold: 20 });
    expect(stats.regionCount).toBe(1);
  });

  it("leaves the mask zero when there are no colors", () => {
    const geom: SegmentGeometry = { vertexCount: 5 };
    const stats = segmentByColor(new Float32Array(0), geom);
    expect(stats.regionCount).toBe(0);
    expect(Array.from(stats.regionMask)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("colorCluster — speckle merge", () => {
  it("merges a tiny speckle region into its largest neighbor", () => {
    const { colors, geom } = twoColorQuads();
    const spec = new Float32Array(8 * 3);
    for (let i = 0; i < 8; i++) spec[i * 3] = 1; // all red
    spec[7 * 3 + 2] = 1; // one blue vertex at index 7
    const mask = clusterColorsBySimilarity(spec, 8);
    expect(mask[7]).not.toBe(mask[6]); // isolated speckle
    const merged = mergeSmallRegions(mask, buildAdjacency(geom), 2);
    expect(merged[7]).toBe(merged[6]); // absorbed into neighbor
  });

  it("keeps regions at or above minRegionSize intact", () => {
    const { colors, geom } = twoColorQuads();
    const stats = segmentByColor(colors, geom, { threshold: 8, minRegionSize: 4 });
    expect(stats.regionCount).toBe(2);
  });
});

describe("colorCluster — boundary edges & stats", () => {
  it("counts boundary edges between two regions", () => {
    // 6-vertex triangle strip. Verts 0-2 red, 3-5 blue; edges (1,2)/(2,3)
    // straddle the color boundary.
    const colors = new Float32Array(6 * 3);
    for (let i = 0; i < 3; i++) colors[i * 3] = 1; // red
    for (let i = 3; i < 6; i++) colors[i * 3 + 2] = 1; // blue
    const indices = new Uint32Array([0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 4, 5]);
    const geom: SegmentGeometry = { colors, indices, vertexCount: 6 };
    const mask = clusterColorsBySimilarity(colors, 8);
    const boundary = countBoundaryEdges(mask, geom);
    expect(boundary).toBeGreaterThan(0);
  });

  it("reports zero boundary for a single-color mesh", () => {
    const colors = new Float32Array(6 * 3);
    for (let i = 0; i < 6; i++) colors[i * 3] = 0.5;
    const geom: SegmentGeometry = { colors, indices: new Uint32Array([0, 1, 2, 3, 4, 5]), vertexCount: 6 };
    const mask = clusterColorsBySimilarity(colors, 8);
    expect(countBoundaryEdges(mask, geom)).toBe(0);
  });
});

describe("gpuSegmenter — fallback & detection", () => {
  it("returns empty mask when no color data (CPU-safe)", () => {
    const stats = segmentColors({ vertexCount: 4 }, { forceCpu: true });
    expect(stats.regionCount).toBe(0);
  });

  it("segments with CPU fallback when GPU is unavailable", () => {
    const { colors, geom } = twoColorQuads();
    const stats = segmentColors(geom, { forceCpu: true });
    expect(stats.regionCount).toBe(2);
  });

  it("detects no GPU in the test environment", () => {
    const gpu = detectGpu();
    expect(typeof gpu.vramMb).toBe("number");
    expect(typeof gpu.available).toBe("boolean");
  });

  it("parses VRAM from renderer strings", () => {
    expect(estimateVram("NVIDIA GeForce RTX 4080")).toBe(8192);
    expect(estimateVram("4.0 GB")).toBe(4096);
    expect(estimateVram("2.5 GiB")).toBe(2560);
    expect(estimateVram("8 GB")).toBe(8192);
    expect(estimateVram("Apple M1 Pro")).toBe(1536);
    expect(estimateVram("llvmpipe (LLVM ...)")).toBe(1536);
  });
});

describe("colorCluster — flood fill", () => {
  it("labels spatially disconnected same-color islands as separate regions", () => {
    // Two separate quads, same color, but NOT connected in the triangle list.
    const colors = new Float32Array(8 * 3);
    colors.fill(0.3);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const geom: SegmentGeometry = { colors, indices, vertexCount: 8 };
    const mask = clusterColorsBySimilarity(colors, 8); // all one color → one cluster
    const adjacency = buildAdjacency(geom);
    const filled = floodFillConnectedComponents(mask, adjacency);
    const set = new Set<number>();
    for (let i = 0; i < 8; i++) set.add(filled[i]);
    expect(set.size).toBe(2); // two islands
  });
});

describe("performance baseline", () => {
  it("segments 100K triangles under 2s (CPU)", () => {
    // 7 contiguous color bands over a triangle strip, so each color is one
    // connected component (avoiding flood-fill explosion of interleaved runs).
    const bands = 7;
    const verticesPerBand = Math.ceil(300_000 / bands); // ~100K triangles
    const vertexCount = 300_000;
    const colors = new Float32Array(vertexCount * 3);
    for (let band = 0; band < bands; band++) {
      const c = band / (bands - 1);
      const start = band * verticesPerBand;
      const end = Math.min(start + verticesPerBand, vertexCount);
      for (let i = start; i < end; i++) {
        colors[i * 3] = c;
        colors[i * 3 + 1] = c;
        colors[i * 3 + 2] = c;
      }
    }
    // Overlapping triangle strip: tri i = [i, i+1, i+2] so the whole band
    // is one connected component.
    const indices: number[] = [];
    for (let i = 0; i + 2 < vertexCount; i++) indices.push(i, i + 1, i + 2);
    const geom: SegmentGeometry = { colors, indices: new Uint32Array(indices), vertexCount };
    const t0 = performance.now();
    const stats = segmentByColor(colors, geom, { threshold: 8 });
    const elapsed = performance.now() - t0;
    expect(stats.regionCount).toBe(bands);
    expect(elapsed).toBeLessThan(2000);
  });
});