export type PencilFace = 1 | 2 | 3 | 4 | 5 | 6;
export type PencilFilamentIndex = 1 | 2 | 3 | 4 | 5;

export type PencilVariantId = 'lapis-hex' | 'estojo-giz';

/**
 * Como a posição da gravação é escolhida:
 * - `face`: grade de faces planas (hexágono) via `config.face`;
 * - `angle`: ponto livre da circunferência (cilindro) via `config.angleDeg`.
 */
export type VariantPlacement = 'face' | 'angle';

export interface PencilVariant {
  id: PencilVariantId;
  label: string;
  modelUrl: string;
  /** prefixos de `model_settings.config` que identificam o corpo */
  bodyNamePrefixes: string[];
  /** extensão do corpo ao longo de `BODY_AXIS`, centrada na origem */
  bodyLength: number;
  engraveMinY: number;
  engraveMaxY: number;
  wallThickness: number;
  /** raio da superfície de gravação: apotema no hex, raio no cilindro */
  surfaceRadius: number;
  placement: VariantPlacement;
  sourceFileName: string;
  staleSliceCache: string;
  letterPlateId: number;
  letterItemTransform: string;
}

export interface PencilPersonalConfig {
  text: string;
  fontFamily: string;
  customFontName?: string;
  customFontBase64?: string;
  letterHeight: number;
  letterSpacing: number;
  fontWeightScale: number;

  variant: PencilVariantId;
  face: PencilFace;
  /** usado apenas quando a variante tem `placement === 'face'` */
  angleDeg: number;
  positionAlongAxis: number;

  /** ícone vetorial junto ao nome (ids de `pencilTopper/symbols`) */
  symbolId: string;
  symbolPosition: 'left' | 'right' | 'both';

  depth: number;
  filamentIndex: PencilFilamentIndex;
}

export interface GeneratedPencilPersonal {
  bodyGraved: import('three').BufferGeometry;
  letters: import('three').BufferGeometry;
  wallThickness: number;
  faceWidth: number;
  engraveRangeMin: number;
  engraveRangeMax: number;
  clampedDepth: number;
  textWidth: number;
  textTooWide: boolean;
  textTooLong: boolean;
}
