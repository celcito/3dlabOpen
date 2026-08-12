export type RegionId = number;

import type { BufferGeometry } from "three";

export type Vec3 = [number, number, number];

export interface ColorRegion {
  id: RegionId;
  color: string;
  name: string;
  vertexCount: number;
  boundaryEdges: number;
}

export type CapMethod =
  | "soap_film"
  | "cdt_boundary"
  | "winding_fill"
  | "projected_normal"
  | "centroid_cap";

export interface CapConfig {
  method: CapMethod;
  thickness: number;
  resolution: number;
}

export type ConnectorType = "none" | "triangular_prism" | "cylinder" | "rectangular_prism";

export interface ConnectorConfig {
  type: ConnectorType;
  side: "part_plug" | "body_plug";
  areaPercent: number;
  socketToleranceMm: number;
  depthMm: number;
  position: "auto" | "manual";
  manualPositions?: { regionA: RegionId; regionB: RegionId; point: Vec3 }[];
}

export interface BoundaryState {
  smoothness: number;
  brushRadius: number;
  activeRegionId: RegionId;
}

export interface SplitGeometry {
  positions: Float32Array;
  normals?: Float32Array;
  colors?: Float32Array;
  indices?: Uint32Array | Uint16Array | Uint8Array;
}

export interface SplitStateSnapshot {
  regionMask: Uint8Array | null;
  regions: ColorRegion[];
}

export interface SplitState {
  geometry: SplitGeometry | null;
  regions: ColorRegion[];
  regionMask: Uint8Array | null;
  capConfig: CapConfig;
  connectorConfig: ConnectorConfig;
  boundary: BoundaryState;
  history: SplitStateSnapshot[];
}

export interface SplitExportOptions {
  format: "3mf" | "obj" | "glb" | "stl";
  includeConnectors: boolean;
  capPieces: boolean;
  filename?: string;
}

export type ParsedSplitFile = {
  geometry: BufferGeometry;
  regionMask?: Uint8Array;
  suggestedColors?: string[];
  fileName: string;
};