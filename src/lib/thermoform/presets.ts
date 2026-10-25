import type { ThermoformConfig, ThermoformPresetId } from '../../types/thermoform';

export const SIZE_MIN = 40;
export const SIZE_MAX = 200;
export const SIZE_DEFAULT = 100;

export const BASE_THICKNESS_MIN = 2;
export const BASE_THICKNESS_MAX = 8;
export const DOME_HEIGHT_MIN = 4;
export const DOME_HEIGHT_MAX = 30;
export const FLANGE_THICKNESS_MIN = 1.5;
export const FLANGE_THICKNESS_MAX = 6;
export const RING_WALL_MIN = 1;
export const RING_WALL_MAX = 6;
export const RING_HEIGHT_MIN = 4;
export const RING_HEIGHT_MAX = 40;
export const FLOOR_THICKNESS_MIN = 0.8;
export const FLOOR_THICKNESS_MAX = 4;
export const RIM_WIDTH_MIN = 1.5;
export const RIM_WIDTH_MAX = 12;
export const RIM_HEIGHT_MIN = 1;
export const RIM_HEIGHT_MAX = 8;
export const CLIP_COUNT_MIN = 0;
export const CLIP_COUNT_MAX = 6;
export const CLIP_LENGTH_MIN = 6;
export const CLIP_LENGTH_MAX = 30;
export const CLIP_WIDTH_MIN = 3;
export const CLIP_WIDTH_MAX = 15;
export const CLIP_GAP_MIN = 1;
export const CLIP_GAP_MAX = 10;
export const CLIP_THICKNESS_MIN = 0.8;
export const CLIP_THICKNESS_MAX = 4;

export interface ThermoformPreset {
  id: ThermoformPresetId;
  label: string;
  /** Path data em convenção SVG (y-down), qualquer escala — normalizado em `outlines.ts`. */
  pathData: string;
  /**
   * Path data do cabo/talo da fruta (y-down, ponta para cima), qualquer escala.
   * Presente ⇒ preset de fruta: gera peça `cabo` separada e restringe encaixes à borda inferior.
   */
  stemPathData?: string;
  /**
   * Fração do `sizeMm` que o erode do domo do mold pode alcançar no máximo.
   * Clamp extra (distância local) é aplicado em `outlines.ts`.
   */
  maxErosionRatio: number;
}

export const THERMOFORM_PRESETS: ThermoformPreset[] = [
  {
    id: 'coracao',
    label: 'Coração',
    pathData:
      'M 50 88 C 46 82 8 56 8 30 C 8 14 20 4 34 4 C 43 4 49 9 50 16 C 51 9 57 4 66 4 C 80 4 92 14 92 30 C 92 56 54 82 50 88 Z',
    maxErosionRatio: 0.1,
  },
  {
    id: 'morango',
    label: 'Morango',
    pathData:
      'M 50 96 C 34 84 12 62 12 40 C 12 22 28 10 44 10 C 48 10 52 10 56 10 C 72 10 88 22 88 40 C 88 62 66 84 50 96 Z',
    stemPathData: 'M 35 88 C 40 60 42 40 50 22 C 58 40 60 60 65 88 C 58 94 42 94 35 88 Z',
    maxErosionRatio: 0.1,
  },
  {
    id: 'maca',
    label: 'Maçã',
    pathData:
      'M 50 14 C 44 6 32 4 24 10 C 12 18 8 34 10 50 C 13 74 30 96 44 96 C 48 96 49 93 50 93 C 51 93 52 96 56 96 C 70 96 87 74 90 50 C 92 34 88 18 76 10 C 68 4 56 6 50 14 Z',
    stemPathData: 'M 47 90 C 47 50 48 30 52 12 C 56 30 55 50 55 90 C 52 95 50 95 47 90 Z',
    maxErosionRatio: 0.1,
  },
  {
    id: 'roda',
    label: 'Roda de limão',
    pathData:
      'M 50 4 C 75.4 4 96 24.6 96 50 C 96 75.4 75.4 96 50 96 C 24.6 96 4 75.4 4 50 C 4 24.6 24.6 4 50 4 Z',
    maxErosionRatio: 0.3,
  },
  {
    id: 'estrela',
    label: 'Estrela',
    pathData:
      'M 50 4 L 61.76 33.82 L 93.75 35.79 L 69.02 56.18 L 77.04 87.21 L 50 70 L 22.96 87.21 L 30.98 56.18 L 6.25 35.79 L 38.24 33.82 Z',
    maxErosionRatio: 0.06,
  },
  {
    id: 'banana',
    label: 'Banana',
    pathData:
      'M 10 48 C 18 15 65 5 88 28 C 102 45 96 75 75 85 C 85 70 82 48 68 38 C 50 25 25 32 22 55 C 20 68 10 62 10 48 Z',
    stemPathData: 'M 38 90 C 40 50 42 30 50 15 C 58 30 60 50 62 90 C 58 96 42 96 38 90 Z',
    maxErosionRatio: 0.08,
  },
  {
    id: 'cacho',
    label: 'Cacho de uvas',
    pathData:
      'M 50 20 C 58 14 68 18 68 28 C 78 30 84 42 76 50 C 82 62 72 74 60 70 C 54 82 46 82 40 70 C 28 74 18 62 24 50 C 16 42 22 30 32 28 C 32 18 42 14 50 20 Z',
    stemPathData:
      'M 45 95 C 45 60 46 35 50 12 C 56 16 58 26 54 32 C 60 28 68 32 66 40 C 60 42 56 38 54 34 C 52 55 51 75 52 95 C 50 99 47 99 45 95 Z',
    maxErosionRatio: 0.1,
  },
];

export function getPreset(id: ThermoformPresetId): ThermoformPreset {
  return THERMOFORM_PRESETS.find((p) => p.id === id) ?? THERMOFORM_PRESETS[0];
}

/** Path do cabo quando o preset ativo é fruta (senão null). */
export function activeStemPathData(config: ThermoformConfig): string | null {
  if (config.svgPathData?.trim()) return null;
  return getPreset(config.preset).stemPathData ?? null;
}

export const DEFAULT_THERMOFORM_CONFIG: ThermoformConfig = {
  preset: 'coracao',
  svgPathData: null,
  sizeMm: SIZE_DEFAULT,
  baseThickness: 4,
  domeHeight: 12,
  flangeThickness: 3,
  ringWallThickness: 2,
  ringHeight: 12,
  floorThickness: 1,
  rimWidth: 4,
  rimHeight: 2,
  clipCount: 2,
  clipLength: 10,
  clipWidth: 5.2,
  clipGap: 6,
  clipThickness: 1.4,
  parts: { mold: true, press: true, folha: true, encaixe: true, cabo: true },
  moldColor: '#111827',
  pressColor: '#FBBF24',
  folhaColor: '#3B82F6',
  clipColor: '#EF4444',
  caboColor: '#78350F',
};
