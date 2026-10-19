export type { Model3DDimensions } from './pencilTopper';
import type { Model3DDimensions } from './pencilTopper';

export interface PenHolderConfig {
  text: string;
  fontFamily: string;
  customFontName?: string;
  customFontBase64?: string;
  letterHeight: number;
  letterSpacing: number;
  fontWeightScale: number;

  /** Dilatação da silhueta do nome (mm) — define a "gordura" da peça. */
  outlineSize: number;
  /** Banda colorida no topo das paredes (mm). */
  rimThickness: number;

  /** Altura do extrude (mm). */
  cupHeight: number;
  wallThickness: number;
  floorThickness: number;

  baseColor: string;
  reliefColor: string;
}

export interface PenHolderDimensions extends Model3DDimensions {
  nameWidthMm: number;
  /** Quantas cascas disjuntas a silhueta gerou (letras separadas = peças separadas). */
  bodyCount: number;
  /** Margem interna efetiva da cavidade (outlineSize − cavityDilation), mm. */
  cavityMarginMm: number;
}

export interface GeneratedPenHolder {
  corpoMesh: import('three').Mesh;
  rimMesh: import('three').Mesh;
  dimensions: PenHolderDimensions;
}
