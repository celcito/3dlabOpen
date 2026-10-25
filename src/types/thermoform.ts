export interface ThermoformConfig {
  /** Preset ativo (usado quando `svgPathData` é null). */
  preset: ThermoformPresetId;
  /** SVG importado (markup completo ou path data) — presente ⇒ substitui o preset. */
  svgPathData: string | null;

  /** Tamanho do maior lado de todo o kit (mm). */
  sizeMm: number;

  /** Mold: espessura da laje base (mm). */
  baseThickness: number;
  /** Mold: altura do domo no centro (mm). */
  domeHeight: number;

  /** Press: espessura da flange/pé largo (mm). */
  flangeThickness: number;
  /** Press: espessura da seção estreita do anel (mm). */
  ringWallThickness: number;
  /** Press: altura do anel (mm). */
  ringHeight: number;

  /** Folha: espessura do piso (mm). */
  floorThickness: number;
  /** Folha: largura do aro (mm). */
  rimWidth: number;
  /** Folha: altura do aro (mm). */
  rimHeight: number;

  /** Encaixes: quantidade (0–6). */
  clipCount: number;
  /** Encaixes: comprimento do clipe em U (mm). */
  clipLength: number;
  /** Encaixes: largura do clipe (mm). */
  clipWidth: number;
  /** Encaixes: fala do U (mm). */
  clipGap: number;
  /** Encaixes: espessura da barra (mm). */
  clipThickness: number;

  /** Toggles por peça. */
  parts: ThermoformPartsToggle;

  moldColor: string;
  pressColor: string;
  folhaColor: string;
  clipColor: string;
  caboColor: string;
}

export type ThermoformPresetId = 'coracao' | 'morango' | 'maca' | 'roda' | 'estrela' | 'banana' | 'cacho';

export type ThermoformPartId = 'mold' | 'press' | 'folha' | 'encaixe' | 'cabo';

export type ThermoformPartsToggle = Record<ThermoformPartId, boolean>;

export interface ThermoformKitDimensions {
  dimX: number;
  dimY: number;
  dimZ: number;
  /** Quantas peças o kit atual gerou (toggles ligados). */
  partCount: number;
}

export interface ThermoformPartBuild {
  id: ThermoformPartId;
  /** Cascas fechadas da peça (cada uma passa em `countBoundaryEdges === 0`). */
  geoms: import('three').BufferGeometry[];
}

export interface GeneratedThermoformKit {
  parts: ThermoformPartBuild[];
  dimensions: ThermoformKitDimensions;
}
