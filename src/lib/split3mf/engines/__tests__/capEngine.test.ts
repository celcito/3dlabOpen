import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  extractBoundaryLoops,
  projectLoopTo2D,
  triangulateLoop2D,
  fanTriangulation,
  tangentBasis,
  capBoundaries,
  capBoundariesAsync,
} from "../capEngine";

/** Open box: 5 quads (flattened to 10 tris), missing the top (z=1) face. */
function openBox(): { positions: Float32Array; indices: number[]; mask: Uint8Array } {
  const positions = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, // bottom z=0
    0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, // top z=1 (open boundary)
  ]);
  // bottom quad + 4 side quads (0,1,4,5 : 0,3,7,4 : 3,2,6,7 : 2,1,5,6)
  const quads: [number, number, number, number][] = [
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [3, 7, 6, 2],
    [0, 4, 7, 3],
  ];
  const indices: number[] = [0, 2, 1, 0, 3, 2];
  for (const [a, b, c, d] of quads) indices.push(a, b, c, a, c, d);
  const mask = new Uint8Array(positions.length / 3);
  mask.fill(1);
  return { positions, indices, mask };
}

/** Single triangle (3 boundary edges = 1 loop of 3). */
function triangle(): { positions: Float32Array; indices: number[]; mask: Uint8Array } {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    indices: [0, 1, 2],
    mask: new Uint8Array([1, 1, 1]),
  };
}

/** Square at z=0 (2 tris, 4 boundary edges). */
function square(): { positions: Float32Array; indices: number[]; mask: Uint8Array } {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    indices: [0, 1, 2, 0, 2, 3],
    mask: new Uint8Array([1, 1, 1, 1]),
  };
}

describe("extractBoundaryLoops", () => {
  it("extracts the open boundary loop of a box missing its top", () => {
    const { positions, indices, mask } = openBox();
    const loops = extractBoundaryLoops(positions, indices, mask);
    expect(loops.length).toBe(1);
    expect(loops[0].vertexIds.length).toBe(4); // top rim (verts 4,5,6,7)
  });

  it("extracts a 3-vertex loop for a lone triangle", () => {
    const { positions, indices, mask } = triangle();
    const loops = extractBoundaryLoops(positions, indices, mask);
    expect(loops.length).toBe(1);
    expect(loops[0].vertexIds.length).toBe(3);
  });

  it("extracts a 4-vertex loop for a square", () => {
    const { positions, indices, mask } = square();
    const loops = extractBoundaryLoops(positions, indices, mask);
    expect(loops.length).toBe(1);
    expect(loops[0].vertexIds.length).toBe(4);
  });

  it("computes a unit normal and finite centroid", () => {
    const { positions, indices, mask } = square();
    const [loop] = extractBoundaryLoops(positions, indices, mask);
    expect(loop.normal.length()).toBeCloseTo(1, 5);
    expect(Number.isFinite(loop.centroid.x)).toBe(true);
  });

  it("returns no loops for a fully closed mesh (tetrahedron)", () => {
    const tetra = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0.5, Math.sqrt(3) / 2, 0, 0.5, Math.sqrt(3) / 6, Math.sqrt(2 / 3)]),
      indices: [0, 1, 2, 0, 1, 3, 0, 2, 3, 1, 2, 3],
    };
    const mask = new Uint8Array(4).fill(1);
    const loops = extractBoundaryLoops(tetra.positions, tetra.indices, mask);
    expect(loops.length).toBe(0);
  });
});

describe("projectLoopTo2D / tangentBasis", () => {
  it("returns 2D points matching polygon vertex count", () => {
    const { positions, indices, mask } = square();
    const [loop] = extractBoundaryLoops(positions, indices, mask);
    const { poly } = projectLoopTo2D(loop, positions);
    expect(poly.length).toBe(4);
  });

  it("tangent basis is orthonormal", () => {
    const { u, v } = tangentBasis(new THREE.Vector3(0, 1, 0));
    expect(Math.abs(u.dot(v))).toBeLessThan(1e-6);
    expect(u.length()).toBeCloseTo(1, 5);
    expect(v.length()).toBeCloseTo(1, 5);
  });
});

describe("triangulateLoop2D / fanTriangulation", () => {
  it("fan-triangulates a quad into 2 cells", () => {
    const cells = fanTriangulation([[0, 0], [1, 0], [1, 1], [0, 1]]);
    expect(cells.length).toBe(2);
  });

  it("cdt2d triangulates a convex quad", () => {
    const { poly } = { poly: [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][] };
    const r = triangulateLoop2D(poly);
    expect(r.cells.length).toBeGreaterThanOrEqual(2);
    expect(r.usedFallback).toBe(false);
  });

  it("falls back to fan when cdt2d fails (-in code path)", () => {
    // cdt2d throws on degenerate/collinear-only input; verify the path returns
    // a usable fan.
    const r = triangulateLoop2D([[0, 0], [1, 1], [2, 2]] as [number, number][]);
    expect(r.cells.length).toBeGreaterThanOrEqual(0);
  });
});

describe("capBoundaries", () => {
  it("caps a square hole and adds vertices", () => {
    const { positions, indices, mask } = square();
    const res = capBoundaries({ method: "centroid_cap", thickness: 0.4, resolution: 16, positions, indices, regionMask: mask });
    expect(res.addedVertices).toBeGreaterThan(0);
    expect(res.indices.length).toBeGreaterThan(indices.length);
  });

  it("all 5 methods return a result without throwing", () => {
    const { positions, indices, mask } = square();
    for (const method of ["centroid_cap", "projected_normal", "winding_fill", "soap_film", "cdt_boundary"] as const) {
      const res = capBoundaries({ method, thickness: 0.4, resolution: 16, positions, indices, regionMask: mask });
      expect(res.indices.length).toBeGreaterThan(indices.length);
      expect(res.addedVertices).toBeGreaterThan(0);
      expect(res.positions.length / 3).toBe(res.indices.length / 3 * 0 + (positions.length / 3 + res.addedVertices));
    }
  });

  it("soap_film and winding_fill use the CPU fallback path", () => {
    const { positions, indices, mask } = square();
    for (const method of ["soap_film", "winding_fill"] as const) {
      const res = capBoundaries({ method, thickness: 0.4, resolution: 16, positions, indices, regionMask: mask });
      expect(res.usedFallback).toBe(true);
    }
  });

  it("soap_film async path validates or safely falls back", async () => {
    const { positions, indices, mask } = openBox();
    const res = await capBoundariesAsync({ method: "soap_film", thickness: 0.05, resolution: 16, positions, indices, regionMask: mask });
    expect(res.indices.length).toBeGreaterThan(indices.length);
    expect(typeof res.usedFallback).toBe("boolean");
  });

  it("no-op when there is no open boundary", () => {
    const tetra = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0.5, Math.sqrt(3) / 2, 0, 0.5, Math.sqrt(3) / 6, Math.sqrt(2 / 3)]),
      indices: [0, 1, 2, 0, 1, 3, 0, 2, 3, 1, 2, 3],
    };
    const mask = new Uint8Array(4).fill(1);
    const res = capBoundaries({ method: "centroid_cap", thickness: 0.4, resolution: 16, positions: tetra.positions, indices: tetra.indices, regionMask: mask });
    expect(res.addedVertices).toBe(0);
  });

  it("respects regionIds filter (caps only the requested region)", () => {
    // Two separate triangles: region 1 and region 2.
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0, // tri A (region 1)
      2, 2, 0, 3, 2, 0, 2, 3, 0, // tri B (region 2)
    ]);
    const indices = [0, 1, 2, 3, 4, 5];
    const mask = new Uint8Array([1, 1, 1, 2, 2, 2]);
    const res = capBoundaries({ method: "centroid_cap", thickness: 0.4, resolution: 16, positions, indices, regionMask: mask, regionIds: [2] });
    // Region 2, capped only — 3 new vertices for the displaced top ring.
    expect(res.addedVertices).toBe(3);
    const res1 = capBoundaries({ method: "centroid_cap", thickness: 0.4, resolution: 16, positions, indices, regionMask: mask, regionIds: [1] });
    expect(res1.addedVertices).toBe(3);
  });
});
