import type { PenHolderConfig } from '../../types/penHolder';

export { PENCIL_COLOR_PALETTES } from '../pencilTopper/presets';

export const CUP_HEIGHT_MIN = 50;
export const CUP_HEIGHT_MAX = 160;
export const CUP_WALL_MIN = 1.5;
export const CUP_WALL_MAX = 6;
export const CUP_FLOOR_MIN = 1.5;
export const CUP_FLOOR_MAX = 8;
export const RIM_MIN = 0.8;
export const RIM_MAX = 3.0;

export const DEFAULT_PEN_HOLDER_CONFIG: PenHolderConfig = {
  text: 'Nome',
  fontFamily: 'Fredoka',
  letterHeight: 30,
  letterSpacing: 1.8,
  fontWeightScale: 1.0,
  outlineSize: 4.0,
  rimThickness: 1.5,
  cupHeight: 100,
  wallThickness: 2.0,
  floorThickness: 3,
  layout: 'tray',
  baseColor: '#F4F4F5',
  reliefColor: '#8B5CF6',
};
