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
  /** Espessura da base do chaveiro (corpo). Afeta a altura da peça. */
  baseThickness: number;
  reliefThickness: number;

  baseColor: string;
  /** Cor da camada de topo do nome. */
  reliefColor: string;
  /** Cor da camada intermediária do nome (usada com 3 camadas de nome). */
  reliefColor2?: string;
  /** Cor da camada de base do nome (usada com 2 ou 3 camadas de nome). */
  reliefColor3?: string;
  /** Camadas do nome (1 a 3). Com o corpo, o modelo chega a 4 camadas/cores. */
  nameLayerCount: number;
  /** Degrau (mm) entre os contornos das camadas do nome. */
  nameLayerStep: number;
  /** Espaçamento (mm) entre as linhas do nome quando o texto tem pulo de linha. */
  nameLineSpacing: number;

  loopEnabled: boolean;
  loopSide: 'left' | 'right';
  loopHoleDiameter: number;
  loopWallThickness: number;
  /** Folga (mm) entre a borda do furo da argola e a letra mais próxima. */
  loopLetterGap: number;
}

export interface GeneratedKeychain {
  baseMesh: import('three').Mesh;
  /** Camadas do nome, da base (mais larga) para o topo (relevo visível). */
  reliefMeshes: import('three').Mesh[];
  dimensions: import('./pencilTopper').Model3DDimensions;
}
