export interface PencilModelOption {
  id: 'bic-cristal' | 'caneta-compact' | 'lapis-redondo' | 'lapis-hexagonal' | 'personalizado';
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
  pencilModel: 'bic-cristal' | 'caneta-compact' | 'lapis-redondo' | 'lapis-hexagonal' | 'personalizado';
  pencilDiameter: number;
  clearance: number;
  holeShape: 'round' | 'hexagonal';
  holeOrientation: 'horizontal' | 'vertical' | 'through-center';
  socketHeight: number;

  text: string;
  fontFamily: string;
  customFontName?: string;
  customFontBase64?: string;
  letterHeight: number;
  letterSpacing: number;
  fontWeightScale: number;

  symbolId: string;
  symbolPosition: 'left' | 'right' | 'both';
  /** Espaço (mm) entre a letra e o ícone — vale para início, fim ou ambos. */
  symbolGap: number;
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

export interface GeneratedPencilTopper {
  baseMesh: import('three').Mesh;
  reliefMesh: import('three').Mesh;
  guideGroup: import('three').Group;
  dimensions: Model3DDimensions;
}