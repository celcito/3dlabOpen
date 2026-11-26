export type MoldType = 'single_open' | 'two_part' | 'silicone_box';
export type MoldShape = 'box' | 'rounded' | 'cylinder';
export type MoldViewMode = 'mold' | 'xray' | 'cast' | 'original';
export type MoldPartId = 'single' | 'partA' | 'partB';

export interface MoldConfig {
  type: MoldType;
  shape: MoldShape;
  /** Margem de parede ao redor do objeto (mm). */
  wallThickness: number;
  /** Espessura do fundo / piso do molde (mm). */
  floorThickness: number;
  /** Posição do plano de partição, 0–1 da altura do objeto (só bipartido). */
  splitPlaneRatio: number;
  pourSpout: boolean;
  pourSpoutDiameter: number;
  airVents: boolean;
  airVentDiameter: number;
  alignmentPins: boolean;
  pinSize: number;
  /** Ângulo de saída das paredes externas (graus). */
  draftAngle: number;
  /** Folga visual entre as metades na viewport (mm). */
  explodeDistance: number;
  moldColor: string;
  topColor: string;
}

export interface MoldModelStats {
  width: number;
  height: number;
  depth: number;
  triangles: number;
}

export interface MoldBounds {
  width: number;
  height: number;
  depth: number;
}

export interface MoldModelInfo {
  name: string;
  sizeLabel: string;
  triangles: number;
  dimensions: MoldBounds;
}

export interface MoldBuildResult {
  parts: { id: MoldPartId; geoms: import('three').BufferGeometry[] }[];
  originalGeometry: import('three').BufferGeometry;
  bounds: MoldBounds;
  triangles: number;
}

export const MOLD_TYPES: { id: MoldType; label: string; hint: string }[] = [
  { id: 'single_open', label: 'Cavidade aberta', hint: 'Peça única com a cavidade do objeto' },
  { id: 'two_part', label: 'Bipartido', hint: 'Base + tampa com pinos de encaixe' },
  { id: 'silicone_box', label: 'Caixa p/ silicone', hint: 'Caixa com parede alta para vazar RTV' },
];

export const MOLD_SHAPES: { id: MoldShape; label: string }[] = [
  { id: 'box', label: 'Retangular' },
  { id: 'rounded', label: 'Cantos arred.' },
  { id: 'cylinder', label: 'Cilíndrica' },
];

export const MOLD_SAMPLES: { id: MoldSampleId; label: string }[] = [
  { id: 'coracao', label: 'Coração' },
  { id: 'urso', label: 'Ursinho' },
  { id: 'gema', label: 'Gema' },
  { id: 'estrela', label: 'Estrela' },
  { id: 'caveira', label: 'Caveira' },
];

export type MoldSampleId = 'coracao' | 'urso' | 'gema' | 'estrela' | 'caveira';

export const MOLD_PART_LABELS: Record<MoldPartId, string> = {
  single: 'Molde',
  partA: 'Parte A (base)',
  partB: 'Parte B (tampa)',
};
