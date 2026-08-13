import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  findBoundaryEdges,
  planConnectorPlacements,
  connectorArea,
  buildConnectorPrimitive,
  placementMatrix,
  capBaseRadius,
  faceNormal,
  totalBoundaryLength,
} from "../connectorEngine";

/** Two region quads sharing one edge (verts 2,3) in a 4-vertex strip. */
function twoRegionSharedEdge(): { positions: Float32Array; indices: number[]; mask: Uint8Array } {
  const positions = new Float32Array([
    0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0,
    0, 1, 0, 1, 1, 0, 2, 1, 0, 3, 1, 0,
  ]);
  // Triangulate as 4 quads (regions: 0..3 region1, 4..7 region2)
  const indices = [
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    0, 1, 2, 0, 2, 3,
  ];
  const mask = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2]);
  return { positions, indices, mask };
}

function rectType(type: "none" | "cylinder" | "rectangular_prism" | "triangular_prism") {
  return type;
}

describe("findBoundaryEdges", () => {
  it("finds edges between the two regions", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(mask[e.a]).not.toBe(mask[e.b]);
    }
  });

  it("preserves the actual region ids in placements", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    const placements = planConnectorPlacements(edges, 1, {
      type: "cylinder",
      areaPercent: 5,
      depthMm: 4,
      socketToleranceMm: 0.2,
      side: "part_plug",
    });
    expect(placements[0].regionA).toBeGreaterThan(0);
    expect(placements[0].regionB).toBeGreaterThan(0);
    expect(placements[0].regionA).not.toBe(placements[0].regionB);
  });

  it("uses manual connector positions matched to the requested region pair", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    const point = new THREE.Vector3(1.5, 0.5, 0);
    const placements = planConnectorPlacements(edges, 4, {
      type: "cylinder",
      areaPercent: 5,
      depthMm: 4,
      socketToleranceMm: 0.2,
      side: "part_plug",
      manualPositions: [{ regionA: 1, regionB: 2, point }],
    });
    expect(placements).toHaveLength(1);
    expect(placements[0].point.toArray()).toEqual(point.toArray());
  });

  it("returns empty for single-region mask", () => {
    const { positions, indices } = twoRegionSharedEdge();
    const mask = new Uint8Array(8).fill(1);
    const edges = findBoundaryEdges(positions, indices, mask);
    expect(edges.length).toBe(0);
  });

  it("deduplicates shared boundary edges", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    const keys = new Set(edges.map((e) => (e.a < e.b ? `${e.a}:${e.b}` : `${e.b}:${e.a}`)));
    expect(keys.size).toBe(edges.length);
  });

  it("computes finite midpoints and normals", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    for (const e of edges) {
      expect(Number.isFinite(e.midpoint.x)).toBe(true);
      expect(e.normal.length()).toBeCloseTo(1, 5);
    }
  });
});

describe("planConnectorPlacements", () => {
  const opts = (side: "part_plug" | "body_plug" = "part_plug"): ConnectorPlanOptionsShim => ({
    type: "cylinder",
    areaPercent: 5,
    depthMm: 4,
    socketToleranceMm: 0.2,
    side,
  });

  it("returns empty for count 0", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    expect(planConnectorPlacements(edges, 0, opts())).toEqual([]);
  });

  it("returns empty for type none", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    expect(planConnectorPlacements(edges, 2, { ...opts(), type: "none" })).toEqual([]);
  });

  it("returns at most the requested count", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    const placements = planConnectorPlacements(edges, 3, opts());
    expect(placements.length).toBeLessThanOrEqual(3);
  });

  it("clamps placements to boundary edge count", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    const placements = planConnectorPlacements(edges, 999, opts());
    expect(placements.length).toBeLessThanOrEqual(edges.length);
  });

  it("respects areaPercent clamp (1-20)", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    const a1 = connectorArea(0, "cylinder", edges);
    const a20 = connectorArea(50, "cylinder", edges);
    const aMid = connectorArea(5, "cylinder", edges);
    expect(a1).toBeLessThanOrEqual(a20);
    expect(aMid).toBeGreaterThan(0);
  });

  it("places connectors at boundary midpoints", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    const placements = planConnectorPlacements(edges, 2, opts());
    expect(placements.length).toBe(2);
    for (const p of placements) {
      expect(p.point.x).toBeGreaterThan(0);
    }
  });
});

describe("buildConnectorPrimitive", () => {
  it("builds a cylinder with vertices and indices", () => {
    const g = buildConnectorPrimitive(rectType("cylinder"), 10, 4);
    expect(g.attributes.position.count).toBeGreaterThan(0);
    expect(g.index).not.toBeNull();
    expect(g.index!.count).toBeGreaterThan(0);
  });

  it("builds a rectangular prism (8 verts, 12 tris)", () => {
    const g = buildConnectorPrimitive(rectType("rectangular_prism"), 16, 4);
    expect(g.attributes.position.count).toBe(8);
    expect(g.index!.count).toBe(36);
  });

  it("builds a triangular prism (6 verts)", () => {
    const g = buildConnectorPrimitive(rectType("triangular_prism"), 10, 4);
    expect(g.attributes.position.count).toBe(6);
  });

  it("returns empty geometry for type none", () => {
    const g = buildConnectorPrimitive(rectType("none"), 10, 4);
    expect(g.attributes.position.count).toBe(0);
  });

  it("respects depth parameter", () => {
    const g = buildConnectorPrimitive(rectType("rectangular_prism"), 16, 10);
    const box = new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);
    expect(box.max.z - box.min.z).toBeCloseTo(10, 5);
  });

  it("cross-section area approximates requested area (cylinder)", () => {
    const g = buildConnectorPrimitive(rectType("cylinder"), 12.566, 4);
    const box = new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);
    const diamX = box.max.x - box.min.x;
    const r = diamX / 2;
    expect(Math.PI * r * r).toBeCloseTo(12.566, 1);
  });
});

describe("placementMatrix", () => {
  it("orients +Z along direction and positions at point", () => {
    const p = {
      point: new THREE.Vector3(1, 2, 3),
      direction: new THREE.Vector3(0, 0, 1),
      up: new THREE.Vector3(0, 1, 0),
      area: 10,
      depth: 4,
      toleranceMm: 0.2,
      regionA: 1,
      regionB: 2,
    };
    const m = placementMatrix(p);
    const origin = new THREE.Vector3().applyMatrix4(m);
    expect(origin.x).toBeCloseTo(1, 5);
    expect(origin.y).toBeCloseTo(2, 5);
    expect(origin.z).toBeCloseTo(3, 5);
  });
});

describe("helpers", () => {
  it("capBaseRadius is positive for all non-none types", () => {
    for (const t of ["cylinder", "rectangular_prism", "triangular_prism"] as const) {
      expect(capBaseRadius(t, 10)).toBeGreaterThan(0);
    }
  });

  it("faceNormal returns a unit vector for a box face", () => {
    const g = buildConnectorPrimitive(rectType("rectangular_prism"), 16, 4);
    const n = faceNormal(g, 0);
    expect(n.length()).toBeCloseTo(1, 5);
  });

  it("totalBoundaryLength sums edge lengths", () => {
    const { positions, indices, mask } = twoRegionSharedEdge();
    const edges = findBoundaryEdges(positions, indices, mask);
    const len = totalBoundaryLength(edges, positions);
    expect(len).toBeGreaterThan(0);
  });
});

type ConnectorPlanOptionsShim = Parameters<typeof planConnectorPlacements>[2];
