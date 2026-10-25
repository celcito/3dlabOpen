export type { Model3DDimensions } from './pencilTopper';

export interface KeychainConfig {
  text: string;
  fontFamily: string;
  customFontName?: string;
  customFontBase64?: string;
  letterHeight: number;
  letterSpacing: number;
  fontWeightScale: number;

  symbolId: string;
  symbolPosition: 'left' | 'right' | 'both';
  customIconUrl?: string;

  outlineSize: number;
  bodyThickness: number;
  reliefThickness: number;

  baseColor: string;
  reliefColor: string;

  loopEnabled: boolean;
  loopSide: 'left' | 'right';
  loopHoleDiameter: number;
  loopWallThickness: number;
}

export interface GeneratedKeychain {
  baseMesh: import('three').Mesh;
  reliefMesh: import('three').Mesh;
  dimensions: import('./pencilTopper').Model3DDimensions;
}
