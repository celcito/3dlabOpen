import { describe, it, expect } from "vitest";
import { splitReducer, INITIAL_STATE, HISTORY_LIMIT } from "../splitReducer";
import type { SplitState } from "../splitTypes";

function geometryOf(size: number): SplitState["geometry"] {
  return { positions: new Float32Array(size * 3) };
}

describe("splitReducer", () => {
  it("loads geometry with regionMask and empty history", () => {
    const next = splitReducer(INITIAL_STATE, { type: "loadGeometry", geometry: geometryOf(4), regionMask: new Uint8Array([1, 1, 2, 2]) });
    expect(next.geometry).not.toBeNull();
    expect(next.regionMask).toEqual(new Uint8Array([1, 1, 2, 2]));
    expect(next.history).toEqual([]);
  });

  it("pushes a snapshot when setting regionMask (undoable)", () => {
    let state = splitReducer(INITIAL_STATE, { type: "loadGeometry", geometry: geometryOf(4) });
    state = splitReducer(state, { type: "setRegionMask", regionMask: new Uint8Array([1, 1, 1, 2]) });
    expect(state.history.length).toBe(1);
    const undone = splitReducer(state, { type: "undo" });
    expect(undone.regionMask).toBeNull();
    expect(undone.history.length).toBe(0);
  });

  it("applies pure cap config patches", () => {
    const next = splitReducer(INITIAL_STATE, { type: "setCapConfig", patch: { method: "cdt_boundary", thickness: 1.0 } });
    expect(next.capConfig.method).toBe("cdt_boundary");
    expect(next.capConfig.thickness).toBe(1.0);
    expect(INITIAL_STATE.capConfig.method).toBe("soap_film");
  });

  it("applies connector config patches without mutating state", () => {
    const next = splitReducer(INITIAL_STATE, { type: "setConnectorConfig", patch: { side: "body_plug", type: "triangular_prism" } });
    expect(next.connectorConfig.side).toBe("body_plug");
    expect(next.connectorConfig.type).toBe("triangular_prism");
    expect(INITIAL_STATE.connectorConfig.type).toBe("cylinder");
  });

  it("paints a single vertex and records history for undo", () => {
    let state = splitReducer(INITIAL_STATE, { type: "loadGeometry", geometry: geometryOf(5), regionMask: new Uint8Array(5) });
    state = splitReducer(state, { type: "setVertexGroup", vertexIndex: 2, groupId: 3 });
    expect(state.regionMask![2]).toBe(3);
    state = splitReducer(state, { type: "undo" });
    expect(state.regionMask![2]).toBe(0);
  });

  it("batches vertex group changes in one action", () => {
    let state = splitReducer(INITIAL_STATE, { type: "loadGeometry", geometry: geometryOf(6), regionMask: new Uint8Array(6) });
    state = splitReducer(state, { type: "setVertexGroups", changes: [{ i: 0, g: 1 }, { i: 1, g: 1 }, { i: 2, g: 2 }] });
    expect(Array.from(state.regionMask!)).toEqual([1, 1, 2, 0, 0, 0]);
    expect(state.history.length).toBe(1);
  });

  it("caps history under the memory limit", () => {
    let state = splitReducer(INITIAL_STATE, { type: "loadGeometry", geometry: geometryOf(2), regionMask: new Uint8Array(2) });
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      state = splitReducer(state, { type: "setVertexGroup", vertexIndex: 0, groupId: i % 2 });
    }
    expect(state.history.length).toBe(HISTORY_LIMIT);
  });

  it("applies a boundary edit mask and records history for undo", () => {
    let state = splitReducer(INITIAL_STATE, { type: "loadGeometry", geometry: geometryOf(6), regionMask: new Uint8Array([1, 1, 1, 2, 2, 2]) });
    state = splitReducer(state, { type: "applyBoundaryEdit", mask: new Uint8Array([1, 1, 2, 2, 2, 2]) });
    expect(Array.from(state.regionMask!)).toEqual([1, 1, 2, 2, 2, 2]);
    expect(state.history.length).toBe(1);
    state = splitReducer(state, { type: "undo" });
    expect(Array.from(state.regionMask!)).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it("ignores applyBoundaryEdit with mismatched mask length", () => {
    const state = splitReducer(INITIAL_STATE, { type: "loadGeometry", geometry: geometryOf(4), regionMask: new Uint8Array(4) });
    const next = splitReducer(state, { type: "applyBoundaryEdit", mask: new Uint8Array([1]) });
    expect(next.regionMask).toEqual(new Uint8Array(4));
    expect(next.history.length).toBe(0);
  });

  it("resets to initial state", () => {
    let state = splitReducer(INITIAL_STATE, { type: "loadGeometry", geometry: geometryOf(3), regionMask: new Uint8Array([1, 2, 3]) });
    state = splitReducer(state, { type: "reset" });
    expect(state.geometry).toBeNull();
    expect(state.history).toEqual([]);
  });
});