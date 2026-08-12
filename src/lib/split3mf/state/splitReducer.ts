import type {
  SplitState,
  SplitStateSnapshot,
  ColorRegion,
  CapConfig,
  ConnectorConfig,
  BoundaryState,
  RegionId,
} from "./splitTypes";

export const HISTORY_LIMIT = 50;

export const DEFAULT_CAP_CONFIG: CapConfig = {
  method: "soap_film",
  thickness: 0.4,
  resolution: 32,
};

export const DEFAULT_CONNECTOR_CONFIG: ConnectorConfig = {
  type: "cylinder",
  side: "part_plug",
  areaPercent: 5,
  socketToleranceMm: 0.2,
  depthMm: 4,
  position: "auto",
};

export const DEFAULT_BOUNDARY: BoundaryState = {
  smoothness: 20,
  brushRadius: 4,
  activeRegionId: 1,
};

export const INITIAL_STATE: SplitState = {
  geometry: null,
  regions: [],
  regionMask: null,
  capConfig: { ...DEFAULT_CAP_CONFIG },
  connectorConfig: { ...DEFAULT_CONNECTOR_CONFIG },
  boundary: { ...DEFAULT_BOUNDARY },
  history: [],
};

export type SplitAction =
  | { type: "loadGeometry"; geometry: SplitState["geometry"]; regionMask?: Uint8Array | null; regions?: ColorRegion[] }
  | { type: "setRegionMask"; regionMask: Uint8Array; regions?: ColorRegion[] }
  | { type: "setRegions"; regions: ColorRegion[] }
  | { type: "setCapConfig"; patch: Partial<CapConfig> }
  | { type: "setConnectorConfig"; patch: Partial<ConnectorConfig> }
  | { type: "setBoundary"; patch: Partial<BoundaryState> }
  | { type: "setVertexGroup"; vertexIndex: number; groupId: RegionId }
  | { type: "setVertexGroups"; changes: { i: number; g: RegionId }[] }
  | { type: "applyBoundaryEdit"; mask: Uint8Array }
  | { type: "undo" }
  | { type: "reset" };

export function splitReducer(state: SplitState, action: SplitAction): SplitState {
  switch (action.type) {
    case "loadGeometry": {
      return {
        ...state,
        geometry: action.geometry,
        regionMask: action.regionMask ?? null,
        regions: action.regions ?? [],
        history: [],
      };
    }

    case "setRegionMask": {
      const snapshot: SplitStateSnapshot = {
        regionMask: state.regionMask ? new Uint8Array(state.regionMask) : null,
        regions: state.regions,
      };
      return {
        ...state,
        regionMask: action.regionMask,
        regions: action.regions ?? state.regions,
        history: pushHistory(state.history, snapshot),
      };
    }

    case "setRegions": {
      return { ...state, regions: action.regions };
    }

    case "setCapConfig": {
      return { ...state, capConfig: { ...state.capConfig, ...action.patch } };
    }

    case "setConnectorConfig": {
      return {
        ...state,
        connectorConfig: { ...state.connectorConfig, ...action.patch },
      };
    }

    case "setBoundary": {
      return { ...state, boundary: { ...state.boundary, ...action.patch } };
    }

    case "setVertexGroup": {
      return debugSetVertexGroup(state, [{ i: action.vertexIndex, g: action.groupId }]);
    }

    case "setVertexGroups": {
      return debugSetVertexGroup(state, action.changes);
    }

    case "applyBoundaryEdit": {
      if (!state.regionMask || action.mask.length !== state.regionMask.length) return state;
      const snapshot: SplitStateSnapshot = {
        regionMask: new Uint8Array(state.regionMask),
        regions: state.regions,
      };
      return {
        ...state,
        regionMask: action.mask,
        history: pushHistory(state.history, snapshot),
      };
    }

    case "undo": {
      const snapshot = state.history[state.history.length - 1];
      if (!snapshot) return state;
      return {
        ...state,
        regionMask: snapshot.regionMask,
        regions: snapshot.regions,
        history: state.history.slice(0, -1),
      };
    }

    case "reset": {
      return { ...INITIAL_STATE };
    }

    default:
      return state;
  }
}

function debugSetVertexGroup(state: SplitState, changes: { i: number; g: RegionId }[]): SplitState {
  if (!state.regionMask) return state;
  const snapshot: SplitStateSnapshot = {
    regionMask: new Uint8Array(state.regionMask),
    regions: state.regions,
  };
  const mask = new Uint8Array(state.regionMask);
  for (const { i, g } of changes) {
    if (i >= 0 && i < mask.length) mask[i] = g;
  }
  return {
    ...state,
    regionMask: mask,
    history: pushHistory(state.history, snapshot),
  };
}

function pushHistory(history: SplitStateSnapshot[], snapshot: SplitStateSnapshot): SplitStateSnapshot[] {
  const next = [...history, snapshot];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}