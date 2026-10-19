import type { ThermoformConfig, ThermoformPresetId } from '../../types/thermoform';
import {
  BASE_THICKNESS_MAX,
  BASE_THICKNESS_MIN,
  CLIP_COUNT_MAX,
  CLIP_COUNT_MIN,
  CLIP_GAP_MAX,
  CLIP_GAP_MIN,
  CLIP_LENGTH_MAX,
  CLIP_LENGTH_MIN,
  CLIP_THICKNESS_MAX,
  CLIP_THICKNESS_MIN,
  CLIP_WIDTH_MAX,
  CLIP_WIDTH_MIN,
  DEFAULT_THERMOFORM_CONFIG,
  DOME_HEIGHT_MAX,
  DOME_HEIGHT_MIN,
  FLANGE_THICKNESS_MAX,
  FLANGE_THICKNESS_MIN,
  FLOOR_THICKNESS_MAX,
  FLOOR_THICKNESS_MIN,
  RIM_HEIGHT_MAX,
  RIM_HEIGHT_MIN,
  RIM_WIDTH_MAX,
  RIM_WIDTH_MIN,
  RING_HEIGHT_MAX,
  RING_HEIGHT_MIN,
  RING_WALL_MAX,
  RING_WALL_MIN,
  SIZE_MAX,
  SIZE_MIN,
  THERMOFORM_PRESETS,
} from './presets';

const STORAGE_KEY = 'termoformado_kit_3d_config_v1';

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function isColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.startsWith('#') ? value : fallback;
}

function isBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function loadSavedThermoformConfig(): ThermoformConfig {
  if (typeof window === 'undefined') return DEFAULT_THERMOFORM_CONFIG;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THERMOFORM_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_THERMOFORM_CONFIG;

    const def = DEFAULT_THERMOFORM_CONFIG;
    const presetIds = THERMOFORM_PRESETS.map((p) => p.id) as string[];

    return {
      ...def,
      preset: presetIds.includes(parsed.preset) ? (parsed.preset as ThermoformPresetId) : def.preset,
      svgPathData: typeof parsed.svgPathData === 'string' && parsed.svgPathData ? parsed.svgPathData : null,
      sizeMm: clamp(parsed.sizeMm, SIZE_MIN, SIZE_MAX, def.sizeMm),
      baseThickness: clamp(parsed.baseThickness, BASE_THICKNESS_MIN, BASE_THICKNESS_MAX, def.baseThickness),
      domeHeight: clamp(parsed.domeHeight, DOME_HEIGHT_MIN, DOME_HEIGHT_MAX, def.domeHeight),
      flangeThickness: clamp(parsed.flangeThickness, FLANGE_THICKNESS_MIN, FLANGE_THICKNESS_MAX, def.flangeThickness),
      ringWallThickness: clamp(parsed.ringWallThickness, RING_WALL_MIN, RING_WALL_MAX, def.ringWallThickness),
      ringHeight: clamp(parsed.ringHeight, RING_HEIGHT_MIN, RING_HEIGHT_MAX, def.ringHeight),
      floorThickness: clamp(parsed.floorThickness, FLOOR_THICKNESS_MIN, FLOOR_THICKNESS_MAX, def.floorThickness),
      rimWidth: clamp(parsed.rimWidth, RIM_WIDTH_MIN, RIM_WIDTH_MAX, def.rimWidth),
      rimHeight: clamp(parsed.rimHeight, RIM_HEIGHT_MIN, RIM_HEIGHT_MAX, def.rimHeight),
      clipCount: clamp(parsed.clipCount, CLIP_COUNT_MIN, CLIP_COUNT_MAX, def.clipCount),
      clipLength: clamp(parsed.clipLength, CLIP_LENGTH_MIN, CLIP_LENGTH_MAX, def.clipLength),
      clipWidth: clamp(parsed.clipWidth, CLIP_WIDTH_MIN, CLIP_WIDTH_MAX, def.clipWidth),
      clipGap: clamp(parsed.clipGap, CLIP_GAP_MIN, CLIP_GAP_MAX, def.clipGap),
      clipThickness: clamp(parsed.clipThickness, CLIP_THICKNESS_MIN, CLIP_THICKNESS_MAX, def.clipThickness),
      parts: {
        mold: isBool(parsed.parts?.mold, def.parts.mold),
        press: isBool(parsed.parts?.press, def.parts.press),
        folha: isBool(parsed.parts?.folha, def.parts.folha),
        encaixe: isBool(parsed.parts?.encaixe, def.parts.encaixe),
      },
      moldColor: isColor(parsed.moldColor, def.moldColor),
      pressColor: isColor(parsed.pressColor, def.pressColor),
      folhaColor: isColor(parsed.folhaColor, def.folhaColor),
      clipColor: isColor(parsed.clipColor, def.clipColor),
    };
  } catch (err) {
    console.warn('Erro ao carregar termoformado do localStorage:', err);
    return DEFAULT_THERMOFORM_CONFIG;
  }
}

export function saveThermoformConfigToStorage(config: ThermoformConfig): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (err) {
    console.warn('Erro ao salvar termoformado no localStorage:', err);
    return false;
  }
}
