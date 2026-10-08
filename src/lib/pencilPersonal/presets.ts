import * as THREE from 'three';
import type {
  PencilPersonalConfig,
  PencilFace,
  PencilFilamentIndex,
  PencilVariant,
  PencilVariantId,
} from '../../types/pencilPersonal';

export const MODEL_URL = '/models/Pencil_Maglama_cortado_open.3mf';

export const HEX_CIRCUMRADIUS = 23.0940113;
export const HEX_APOTHEM = 20;
export const HEX_FACE_WIDTH = 23.0940113;
export const BODY_LENGTH = 126.1098632;
export const BODY_HALF_LENGTH = BODY_LENGTH / 2;
export const BODY_AXIS = new THREE.Vector3(0, 0, 1);
export const WALL_THICKNESS = 1.8;
export const ENGRAVE_MIN_Y = -61;
export const ENGRAVE_MAX_Y = 54;
export const MIN_LETTER_THICKNESS = 0.4;
export const LETTER_RELIEF = 0.4;
export const WALL_RESERVE = 0.4;
export const MAX_DEPTH = WALL_THICKNESS - WALL_RESERVE;

export const FACE_NORMAL_ANGLE_DEG: Record<PencilFace, number> = {
  1: 240,
  2: 300,
  3: 0,
  4: 60,
  5: 120,
  6: 180,
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

export const DEFAULT_VARIANT: PencilVariantId = 'lapis-hex';

/**
 * Fonte única das constantes por variante. Os módulos leem daqui em vez de
 * `if (variant === '…')`; as constantes soltas acima continuam exportadas com
 * os mesmos valores (nenhum import existente quebra).
 */
export const VARIANTS: Record<PencilVariantId, PencilVariant> = {
  'lapis-hex': {
    id: 'lapis-hex',
    label: 'Lápis Hexagonal',
    modelUrl: MODEL_URL,
    bodyNamePrefixes: ['Pencil_Main_Body', 'Pencil_corpo_hexagonal'],
    bodyLength: BODY_LENGTH,
    engraveMinY: ENGRAVE_MIN_Y,
    engraveMaxY: ENGRAVE_MAX_Y,
    wallThickness: WALL_THICKNESS,
    surfaceRadius: HEX_APOTHEM,
    placement: 'face',
    sourceFileName: 'Pencil_Maglama_cortado_open.3mf',
    staleSliceCache: 'Metadata/plate_5.json',
    letterPlateId: 6,
    letterItemTransform: '1 0 0 0 1 0 0 0 1 522 -126 0',
  },
  'estojo-giz': {
    id: 'estojo-giz',
    label: 'Estojo de Giz de Cera',
    modelUrl: '/models/Estojo_Giz_Cera_open.3mf',
    bodyNamePrefixes: ['Estojo_corpo_cilindrico'],
    // corpo real de M2: Ø115 × 44, z ∈ [-22, 22] (a montada de 63 é o envelope)
    bodyLength: 44,
    engraveMinY: -18,
    engraveMaxY: 18,
    wallThickness: 4,
    surfaceRadius: 57.5,
    placement: 'angle',
    sourceFileName: 'Estojo_Giz_Cera_open.3mf',
    staleSliceCache: 'Metadata/plate_2.json',
    letterPlateId: 3,
    letterItemTransform: '1 0 0 0 1 0 0 0 1 522 90 0',
  },
};

export function isPencilVariantId(value: unknown): value is PencilVariantId {
  return value === 'lapis-hex' || value === 'estojo-giz';
}

export const DEFAULT_PENCIL_PERSONAL_CONFIG: PencilPersonalConfig = {
  text: 'Nome',
  fontFamily: 'Montserrat',
  letterHeight: 14,
  letterSpacing: 1.5,
  fontWeightScale: 1.0,
  variant: DEFAULT_VARIANT,
  face: 6,
  angleDeg: 0,
  positionAlongAxis: (ENGRAVE_MIN_Y + ENGRAVE_MAX_Y) / 2 + BODY_HALF_LENGTH,
  depth: 1.0,
  filamentIndex: 3,
};
