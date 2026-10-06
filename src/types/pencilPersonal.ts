export type PencilFace = 1 | 2 | 3 | 4 | 5 | 6;
export type PencilFilamentIndex = 1 | 2 | 3 | 4 | 5;

export interface PencilPersonalConfig {
  text: string;
  fontFamily: string;
  customFontName?: string;
  customFontBase64?: string;
  letterHeight: number;
  letterSpacing: number;
  fontWeightScale: number;

  face: PencilFace;
  positionAlongAxis: number;

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
