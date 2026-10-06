import type { PencilPersonalConfig, PencilFace, PencilFilamentIndex } from '../../types/pencilPersonal';

export const MODEL_URL = '/models/Pencil_Maglama_cortado.3mf';

export const HEX_CIRCUMRADIUS = 23.0940113;
export const HEX_APOTHEM = 20;
export const HEX_FACE_WIDTH = 23.0940113;
export const BODY_LENGTH = 152.1098632;
export const BODY_HALF_LENGTH = BODY_LENGTH / 2;
export const WALL_THICKNESS = 1.8;
export const ENGRAVE_MIN_Y = -74;
export const ENGRAVE_MAX_Y = 50;
export const MIN_LETTER_THICKNESS = 0.4;
export const WALL_RESERVE = 0.4;
export const MAX_DEPTH = WALL_THICKNESS - WALL_RESERVE;

export const FACE_NORMAL_ANGLE_DEG: Record<PencilFace, number> = {
  1: 60,
  2: 120,
  3: 180,
  4: 240,
  5: 300,
  6: 0,
};

export const FILAMENT_COLORS: Record<PencilFilamentIndex, string> = {
  1: '#FFFF00',
  2: '#EC5EAF',
  3: '#000000',
  4: '#F0EEA2',
  5: '#808080',
};

export const FILAMENT_NAMES: Record<PencilFilamentIndex, string> = {
  1: 'Amarelo',
  2: 'Rosa',
  3: 'Preto',
  4: 'Creme',
  5: 'Cinza',
};

export const DEFAULT_PENCIL_PERSONAL_CONFIG: PencilPersonalConfig = {
  text: 'Nome',
  fontFamily: 'Montserrat',
  letterHeight: 14,
  letterSpacing: 1.5,
  fontWeightScale: 1.0,
  face: 1,
  positionAlongAxis: (ENGRAVE_MIN_Y + ENGRAVE_MAX_Y) / 2 + BODY_HALF_LENGTH,
  depth: 1.0,
  filamentIndex: 3,
};
