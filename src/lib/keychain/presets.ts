import type { KeychainConfig } from '../../types/keychain';

export { PENCIL_COLOR_PALETTES, PRESET_SYMBOLS } from '../pencilTopper/presets';

export const LOOP_HOLE_MIN = 3;
export const LOOP_HOLE_MAX = 10;
export const LOOP_WALL_MIN = 1.2;
export const LOOP_WALL_MAX = 4;

export const DEFAULT_KEYCHAIN_CONFIG: KeychainConfig = {
  text: 'Nome',
  fontFamily: 'Pacifico',
  letterHeight: 16,
  letterSpacing: 1.8,
  fontWeightScale: 1.0,
  symbolId: 'none',
  symbolPosition: 'right',
  outlineSize: 2.8,
  bodyThickness: 3.0,
  reliefThickness: 2.0,
  baseColor: '#111827',
  reliefColor: '#FBBF24',
  loopEnabled: true,
  loopSide: 'left',
  loopHoleDiameter: 5,
  loopWallThickness: 2,
};
