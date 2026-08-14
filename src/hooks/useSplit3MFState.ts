import { useCallback, useMemo, useReducer } from "react";
import {
  splitReducer,
  INITIAL_STATE,
  DEFAULT_CAP_CONFIG,
  DEFAULT_CONNECTOR_CONFIG,
  DEFAULT_BOUNDARY,
} from "../lib/split3mf/state/splitReducer";
import {
  pullBoundary,
  pushBoundary,
  selectConnectedComponent,
  selectConnectedComponents,
  smoothBoundary,
} from "../lib/split3mf/segmentation/boundaryEditor";
import type { SegmentGeometry } from "../lib/split3mf/segmentation/colorCluster";
import type { SplitState, ColorRegion, ParsedSplitFile } from "../lib/split3mf/state/splitTypes";

export function useSplit3MFState() {
  const [state, dispatch] = useReducer(splitReducer, INITIAL_STATE);

  const loadFile = useCallback((parsed: ParsedSplitFile) => {
    const geometry = splitGeometryFromThree(parsed.geometry);
    const regions: ColorRegion[] = parsed.regionMask
      ? deriveRegionsFromMask(parsed.regionMask, parsed.geometry.attributes.position.count, parsed.suggestedColors)
      : (parsed.suggestedColors?.map((color, index) => ({
          id: index + 1,
          color,
          name: `Região ${index + 1}`,
          vertexCount: 0,
          boundaryEdges: 0,
        })) ?? []);
    dispatch({
      type: "loadGeometry",
      geometry,
      regionMask: parsed.regionMask ?? null,
      regions,
    });
  }, []);

  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const setCapConfig = useCallback((patch: Partial<SplitState["capConfig"]>) => dispatch({ type: "setCapConfig", patch }), []);
  const setConnectorConfig = useCallback((patch: Partial<SplitState["connectorConfig"]>) => dispatch({ type: "setConnectorConfig", patch }), []);
  const setBoundary = useCallback((patch: Partial<SplitState["boundary"]>) => dispatch({ type: "setBoundary", patch }), []);
  const setRegions = useCallback((regions: ColorRegion[]) => dispatch({ type: "setRegions", regions }), []);
  const setRegionMask = useCallback((regionMask: Uint8Array, regions?: ColorRegion[]) => dispatch({ type: "setRegionMask", regionMask, regions }), []);

  /**
   * Applies a boundary brush edit (pull/push) at a vertex, dispatching to the
   * reducer with history. `geometry` may be null (no-op) before load.
   */
  const applyBoundaryBrush = useCallback(
    (kind: "pull" | "push", vertexIndex: number, radius: number) => {
      const geom = state.geometry;
      if (!geom) return;
      const segGeom: SegmentGeometry = {
        indices: geom.indices ?? null,
        vertexCount: geom.positions.length / 3,
      };
      const mask = state.regionMask ?? new Uint8Array(segGeom.vertexCount);
      const target = state.boundary.activeRegionId;
      const next =
        kind === "pull"
          ? pullBoundary(mask, segGeom, vertexIndex, target, radius)
          : pushBoundary(mask, segGeom, vertexIndex, target, radius);
      dispatch({ type: "applyBoundaryEdit", mask: next });
    },
    [state.geometry, state.regionMask, state.boundary.activeRegionId]
  );

  const smoothBoundaries = useCallback(() => {
    const geom = state.geometry;
    if (!geom) return;
    const segGeom: SegmentGeometry = {
      indices: geom.indices ?? null,
      vertexCount: geom.positions.length / 3,
    };
    const mask = state.regionMask ?? new Uint8Array(segGeom.vertexCount);
    const next = smoothBoundary(mask, segGeom, state.boundary.smoothness);
    dispatch({ type: "applyBoundaryEdit", mask: next });
  }, [state.geometry, state.regionMask, state.boundary.smoothness]);

  const selectComponent = useCallback(
    (vertexIndex: number) => {
      const geom = state.geometry;
      if (!geom) return;
      const segGeom: SegmentGeometry = {
        indices: geom.indices ?? null,
        vertexCount: geom.positions.length / 3,
      };
      const mask = state.regionMask ?? new Uint8Array(segGeom.vertexCount);
      const next = selectConnectedComponent(mask, segGeom, vertexIndex, state.boundary.activeRegionId);
      dispatch({ type: "applyBoundaryEdit", mask: next });
    },
    [state.geometry, state.regionMask, state.boundary.activeRegionId]
  );

  const selectComponents = useCallback(
    (vertexIndices: number[]) => {
      const geom = state.geometry;
      if (!geom) return;
      const segGeom: SegmentGeometry = {
        indices: geom.indices ?? null,
        vertexCount: geom.positions.length / 3,
      };
      const mask = state.regionMask ?? new Uint8Array(segGeom.vertexCount);
      const next = selectConnectedComponents(mask, segGeom, vertexIndices, state.boundary.activeRegionId);
      dispatch({ type: "applyBoundaryEdit", mask: next });
    },
    [state.geometry, state.regionMask, state.boundary.activeRegionId]
  );

  const canUndo = state.history.length > 0;

  return useMemo(() => ({
    state,
    loadFile,
    reset,
    undo,
    canUndo,
    setCapConfig,
    setConnectorConfig,
    setBoundary,
    setRegions,
    setRegionMask,
    applyBoundaryBrush,
    smoothBoundaries,
    selectComponent,
    selectComponents,
    defaults: { cap: DEFAULT_CAP_CONFIG, connector: DEFAULT_CONNECTOR_CONFIG, boundary: DEFAULT_BOUNDARY },
  }), [state, loadFile, reset, undo, canUndo, setCapConfig, setConnectorConfig, setBoundary, setRegions, setRegionMask, applyBoundaryBrush, smoothBoundaries, selectComponent, selectComponents]);
}

const FALLBACK_COLORS = ["#632CE5", "#FF1744", "#00FF41", "#D500F9", "#FF9100", "#FF4081", "#FFEA00", "#2979FF"];

function deriveRegionsFromMask(mask: Uint8Array, vertexCount: number, suggested?: string[]): ColorRegion[] {
  const byId = new Map<number, number>();
  for (const id of mask) {
    if (id === 0) continue;
    byId.set(id, (byId.get(id) ?? 0) + 1);
  }
  const palette = suggested ?? [];
  return Array.from(byId.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([id, count], idx) => ({
      id,
      color: palette[idx] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
      name: `Região ${id}`,
      vertexCount: count,
      boundaryEdges: 0,
    }));
}

function splitGeometryFromThree(geometry: import("three").BufferGeometry): SplitState["geometry"] {
  const pos = geometry.attributes.position;
  const norm = geometry.attributes.normal;
  const col = geometry.attributes.color;
  const index = geometry.index;
  const toF32 = (arr?: { array: ArrayLike<number> }): Float32Array | undefined =>
    arr ? new Float32Array(arr.array as ArrayLike<number>) : undefined;
  return {
    positions: new Float32Array(pos.array as ArrayLike<number>),
    normals: toF32(norm),
    colors: toF32(col),
    indices: index ? new Uint32Array(index.array as ArrayLike<number>) : undefined,
  };
}
