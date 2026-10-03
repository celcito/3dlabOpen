import type { MedalConfig } from '../../types/medal';

export interface MedalPalette {
  id: string;
  name: string;
  backgroundColor: string;
  rimColor: string;
  handleColor: string;
}

export const DIAMETER_MIN = 50;
export const DIAMETER_MAX = 100;
export const DIAMETER_PRESETS = [50, 60, 70, 80, 90, 100];

export const THICKNESS_PRESETS = [2.5, 3.5, 5.0];

export const ART_RELIEF_MIN = 0.6;
export const ART_RELIEF_MAX = 4;
export const ART_SCALE_MIN = 50;
export const ART_SCALE_MAX = 150;

export const ARC_SIZE_MIN = 2.5;
export const ARC_SIZE_MAX = 20;
export const ARC_RADIUS_MIN = 60;
export const ARC_RADIUS_MAX = 95;

export const RIM_WIDTH_MIN = 0.5;
export const RIM_WIDTH_MAX = 4;
export const RIM_HEIGHT_MIN = 0.4;
export const RIM_HEIGHT_MAX = 3;

export const RIBBON_WIDTH_OPTIONS = [20, 22, 25, 30];
export const SLOT_HEIGHT_MIN = 2;
export const SLOT_HEIGHT_MAX = 6;
export const HOLE_DIAMETER_MIN = 4;
export const HOLE_DIAMETER_MAX = 12;
export const HANDLE_WALL_MIN = 1.2;
export const HANDLE_WALL_MAX = 5;
export const HANDLE_THICKNESS_MIN = 1.5;
export const HANDLE_THICKNESS_MAX = 6;

export const INNER_RING_MAX = 3;
export const INNER_RING_RADIUS_MIN = 30;
export const INNER_RING_RADIUS_MAX = 90;
export const INNER_RING_WIDTH_MIN = 0.4;
export const INNER_RING_WIDTH_MAX = 3;

export const MEDAL_PALETTES: MedalPalette[] = [
  { id: 'ouro-olimpico', name: 'Ouro Olímpico', backgroundColor: '#1A1A1A', rimColor: '#E2A829', handleColor: '#E2A829' },
  { id: 'prata-esportiva', name: 'Prata Esportiva', backgroundColor: '#111827', rimColor: '#D1D5DB', handleColor: '#D1D5DB' },
  { id: 'bronze-premium', name: 'Bronze Premium', backgroundColor: '#2B1A0E', rimColor: '#B87333', handleColor: '#B87333' },
  { id: 'black-gold-luxo', name: 'Black & Gold Luxo', backgroundColor: '#0B0B0B', rimColor: '#F5D547', handleColor: '#F5D547' },
  { id: 'brasil-oficial', name: 'Brasil Oficial', backgroundColor: '#009739', rimColor: '#FEDD00', handleColor: '#FEDD00' },
  { id: 'branco-vermelho', name: 'Branco & Vermelho', backgroundColor: '#F9FAFB', rimColor: '#DC2626', handleColor: '#DC2626' },
  { id: 'pink-black-3k', name: 'Pink & Black 3K', backgroundColor: '#111827', rimColor: '#EC4899', handleColor: '#EC4899' },
];

export const DEFAULT_MEDAL_CONFIG: MedalConfig = {
  artReliefHeight: 1.5,
  artScale: 100,

  topText: 'MEDALHA',
  bottomText: '',
  centerText: '',
  fontFamily: 'Montserrat',
  topArcSize: 7,
  bottomArcSize: 6,
  centerTextSize: 8,
  arcRadiusPct: 82,

  diameter: 80,
  baseThickness: 3.5,
  bodyShape: 'redonda',
  backgroundColor: '#1A1A1A',

  rimEnabled: true,
  rimWidth: 1.5,
  rimHeight: 1.2,
  rimColor: '#E2A829',
  rimCoverage: 'geral',
  rimHandleStyle: 'canal-duplo',

  handleMode: 'passante',
  ribbonWidth: 25,
  slotHeight: 3.5,
  holeDiameter: 6,
  handleWall: 2.8,
  handleThicknessZ: 3.5,
  handleColor: '#E2A829',
  handleColorSync: true,

  innerRingCount: 1,
  innerRingRadiusPct: 62,
  innerRingWidth: 1.2,
};
