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
  /** Folga (mm) entre a borda do furo da argola e a letra mais próxima. */
  loopLetterGap: number;
  /** Fator de folga do ícone em relação ao tamanho da letra (1 = ícone muito afastado). */
  symbolGapFactor: number;
  /** Ícone como peça separada do nome, com argola no início do ícone e no fim do nome. */
  symbolSeparated: boolean;
  /** Corpo em formato de tag (osso ou peixinho) com o nome dentro e argola no topo. */
  tagShape?: 'bone' | 'fish';
}

export interface GeneratedKeychain {
  baseMesh: import('three').Mesh;
  reliefMesh: import('three').Mesh;
  dimensions: import('./pencilTopper').Model3DDimensions;
}
