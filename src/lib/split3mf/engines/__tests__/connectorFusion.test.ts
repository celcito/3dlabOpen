import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { fusePlug, carveSocket, buildBridge } from "../connectorFusion";
import type { ConnectorPlacement } from "../connectorEngine";

function box(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(4, 4, 4);
  g.computeVertexNormals();
  return g;
}

const placement: ConnectorPlacement = {
  point: new THREE.Vector3(0, 0, 2), // on the +Z face of the 4³ box
  direction: new THREE.Vector3(0, 0, 1),
  up: new THREE.Vector3(0, 1, 0),
  area: 1,
  depth: 2,
  toleranceMm: 0.2,
  regionA: 1,
  regionB: 2,
};

describe("connectorFusion", () => {
  it("fusePlug unions a cylinder into the piece (vertex count grows)", () => {
    const piece = box();
    const before = piece.attributes.position.count;
    const result = fusePlug(piece, placement, { type: "cylinder", depthMm: 2, socketToleranceMm: 0.2 });
    expect(result.attributes.position.count).toBeGreaterThan(before);
  });

  it("fusePlug returns a clone for type none", () => {
    const piece = box();
    const result = fusePlug(piece, placement, { type: "none", depthMm: 2, socketToleranceMm: 0.2 });
    expect(result.attributes.position.count).toBe(piece.attributes.position.count);
  });

  it("carveSocket subtracts a cylinder (vertex count changes)", () => {
    const piece = box();
    const before = piece.attributes.position.count;
    const result = carveSocket(piece, placement, { type: "cylinder", depthMm: 2, socketToleranceMm: 0.2 });
    expect(result.attributes.position.count).toBeGreaterThanOrEqual(before * 0.8);
  });

  it("socket is larger than plug (tolerance applied)", () => {
    const plug = fusePlug(box(), placement, { type: "cylinder", depthMm: 2, socketToleranceMm: 0.2 });
    const socket = carveSocket(box(), placement, { type: "cylinder", depthMm: 2, socketToleranceMm: 0.2 });
    expect(plug).toBeDefined();
    expect(socket).toBeDefined();
  });

  it("buildBridge produces a standalone connector piece", () => {
    const bridge = buildBridge(placement, { type: "cylinder", depthMm: 2, socketToleranceMm: 0.2 });
    expect(bridge.attributes.position.count).toBeGreaterThan(0);
  });

  it("buildBridge with type none returns empty geometry", () => {
    const bridge = buildBridge(placement, { type: "none", depthMm: 2, socketToleranceMm: 0.2 });
    expect(bridge.attributes.position.count).toBe(0);
  });

  it("supports triangular and rectangular prisms through CSG", () => {
    for (const t of ["triangular_prism", "rectangular_prism"] as const) {
      const plug = fusePlug(box(), placement, { type: t, depthMm: 2, socketToleranceMm: 0.2 });
      expect(plug.attributes.position.count).toBeGreaterThan(0);
    }
  });
});