export type { Model3DDimensions } from './pencilTopper';

export type MedalBodyShape = 'redonda' | 'hexagonal' | 'octogonal' | 'escudo';
export type HandleMode = 'passante' | 'furo-redondo' | 'fita' | 'nenhuma';
export type RimCoverage = 'disco' | 'geral';
export type RimHandleStyle = 'canal-duplo' | 'macica' | 'contorno';

export interface MedalConfig {
  artUrl?: string;
  artName?: string;
  artReliefHeight: number;
  artScale: number;

  topText: string;
  bottomText: string;
  centerText: string;
  fontFamily: string;
  customFontName?: string;
  customFontBase64?: string;
  topArcSize: number;
  bottomArcSize: number;
  centerTextSize: number;
  arcRadiusPct: number;

  diameter: number;
  baseThickness: number;
  bodyShape: MedalBodyShape;
  backgroundColor: string;

  rimEnabled: boolean;
  rimWidth: number;
  rimHeight: number;
  rimColor: string;
  rimCoverage: RimCoverage;
  rimHandleStyle: RimHandleStyle;

  handleMode: HandleMode;
  ribbonWidth: number;
  slotHeight: number;
  holeDiameter: number;
  handleWall: number;
  handleThicknessZ: number;
  handleColor: string;
  handleColorSync: boolean;
  /** Alça na cor do corpo: evita 2 cores por camada na base (menos purga). */
  handleUseBodyColor: boolean;

  innerRingCount: number;
  innerRingRadiusPct: number;
  innerRingWidth: number;
}

export interface GeneratedMedal {
  baseMesh?: import('three').Mesh;
  reliefMesh?: import('three').Mesh;
  handleMesh?: import('three').Mesh;
  dimensions: import('./pencilTopper').Model3DDimensions;
}
