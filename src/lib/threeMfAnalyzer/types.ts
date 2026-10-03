export type Severity = "error" | "warning" | "info";

export type IssueCategory = "package" | "mesh" | "settings";

export type FixId =
  | "M1"
  | "M2"
  | "M3"
  | "M4"
  | "M5"
  | "M6"
  | "M7"
  | "S1"
  | "S2"
  | "S3"
  | "S4"
  | "S5";

export interface Issue {
  id: string;
  category: IssueCategory;
  severity: Severity;
  title: string;
  detail: string;
  hint: string;
  source: string;
  fixId?: FixId;
}

export type PackageKind = "bambu" | "prusa" | "cura" | "cad" | "model";

export interface RawObject {
  docPath: string;
  id: number;
  name: string;
  /** Elemento `<object>` original — os repairs o mutam preservando atributos. */
  element: Element;
  meshElement: Element | null;
  vertices: number[];
  triangles: number[];
  components: { objectid: number; transform?: number[] }[];
}

export interface RawDocument {
  path: string;
  doc: Document;
  dirty: boolean;
}

export interface BuildItem {
  objectid: number;
  transform?: number[];
}

export interface RawModel {
  corePath: string;
  docs: RawDocument[];
  unit: string;
  objects: RawObject[];
  buildItems: BuildItem[];
}

export interface PackageInfo {
  kind: PackageKind;
  kindLabel: string;
  application: string;
  unit: string;
  model: RawModel;
  projectSettings: Record<string, unknown> | null;
  hasModelSettings: boolean;
  hasSliceInfo: boolean;
  plateGcodePaths: string[];
  colors: string[];
  objectNames: string[];
}

export interface WorldMesh {
  name: string;
  positions: Float32Array;
  indices: Uint32Array;
  matrix: number[];
}

export interface MeshStats {
  name: string;
  triangles: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  degenerate: number;
  duplicates: number;
  volume: number;
  min: [number, number, number];
  max: [number, number, number];
  floating: boolean;
  belowBed: boolean;
  offBed: boolean;
  overhangArea: number;
  overhangRatio: number;
  /** Gênero topológico (0 = sem furo passante; ≥1 = com furo/túnel). */
  genus: number;
}

export type PresetId = "detalhe" | "equilibrado" | "rapido";

export interface AnalysisResult {
  issues: Issue[];
  objects: MeshStats[];
  totalTriangles: number;
  meshes: WorldMesh[];
  boundarySegments: Float32Array;
  overhangTriangles: Float32Array;
  highlights: { min: [number, number, number]; max: [number, number, number]; kind: "offBed" | "floating" | "below" }[];
}

export interface RepairResult {
  applied: FixId[];
  notes: string[];
}
