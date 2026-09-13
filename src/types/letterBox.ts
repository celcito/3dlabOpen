export interface FontOption {
  id: string;
  name: string;
  category: 'bold' | 'geom' | 'fun' | 'condensed' | 'script' | 'classic';
  description: string;
  isSystem?: boolean;
}

export interface ColorPalettePreset {
  id: string;
  name: string;
  backColor: string;
  midColor: string;
  frontColor: string;
}

export interface LetterBoxConfig {
  text: string;
  fontFamily: string;
  letterHeight: number;
  backDepth: number;

  letterSpacing: number;
  backContour: number;
  midContour: number;
  frontThickness: number;
  midThickness: number;

  flatBase: boolean;
  baseExtraHeight: number;
  wallMountHole: boolean;

  backColor: string;
  midColor: string;
  frontColor: string;

  explodedProgress: number;
  showDimensionsOverlay: boolean;
  environmentMode: 'plate' | 'desk' | 'minimal';
  bevelFront: boolean;
  bevelSize: number;

  customFontUrl?: string;
  customFontName?: string;
  customFontBase64?: string;
}

export interface PencilModelOption {
  id: string;
  name: string;
  emoji: string;
  defaultDiameter: number;
  description: string;
  defaultHoleShape: 'round' | 'hexagonal';
}

export interface PencilColorPalette {
  id: string;
  name: string;
  baseColor: string;
  reliefColor: string;
}

export interface PresetSymbol {
  id: string;
  name: string;
  emoji: string;
  pathSvg?: string;
}

export interface PencilTopperConfig {
  pencilModel: string;
  pencilDiameter: number;
  clearance: number;
  holeShape: 'round' | 'hexagonal';
  holeOrientation: 'horizontal' | 'vertical' | 'through-center';
  socketHeight: number;

  text: string;
  fontFamily: string;
  letterHeight: number;
  letterSpacing: number;

  symbolId: string;
  symbolPosition: 'left' | 'right' | 'both';
  customSvgData?: string;
  customIconUrl?: string;

  outlineSize: number;
  baseWallThickness: number;
  reliefThickness: number;

  baseColor: string;
  reliefColor: string;

  showPencilGuide: boolean;
  showDimensionsOverlay: boolean;
  environmentMode: 'plate' | 'desk' | 'minimal';
}

export interface Model3DDimensions {
  dimX: number;
  dimY: number;
  dimZ: number;
  volumeCm3: number;
  weightGrams: number;
  printTimeMinutes: number;
}

export type AppMode = 'letra-caixa' | 'ponteira-lapis';

export interface GeneratedLetterBox {
  backMesh: import('three').Mesh;
  midMesh: import('three').Mesh;
  frontMesh: import('three').Mesh;
  dimensions: Model3DDimensions;
}