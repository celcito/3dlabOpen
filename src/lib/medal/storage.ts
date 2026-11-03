import type { MedalConfig } from '../../types/medal';
import {
  ARC_RADIUS_MAX,
  ARC_RADIUS_MIN,
  ARC_SIZE_MAX,
  ARC_SIZE_MIN,
  ART_RELIEF_MAX,
  ART_RELIEF_MIN,
  ART_SCALE_MAX,
  ART_SCALE_MIN,
  DEFAULT_MEDAL_CONFIG,
  DIAMETER_MAX,
  DIAMETER_MIN,
  HANDLE_THICKNESS_MAX,
  HANDLE_THICKNESS_MIN,
  HANDLE_WALL_MAX,
  HANDLE_WALL_MIN,
  HOLE_DIAMETER_MAX,
  HOLE_DIAMETER_MIN,
  INNER_RING_MAX,
  INNER_RING_RADIUS_MAX,
  INNER_RING_RADIUS_MIN,
  INNER_RING_WIDTH_MAX,
  INNER_RING_WIDTH_MIN,
  RIBBON_WIDTH_OPTIONS,
  RIM_HEIGHT_MAX,
  RIM_HEIGHT_MIN,
  RIM_WIDTH_MAX,
  RIM_WIDTH_MIN,
  SLOT_HEIGHT_MAX,
  SLOT_HEIGHT_MIN,
} from './presets';

const STORAGE_KEY = 'medalhas_3d_config_v1';

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readBodyShape(value: unknown): MedalConfig['bodyShape'] {
  return value === 'hexagonal' || value === 'octogonal' || value === 'escudo' ? value : 'redonda';
}

function readHandleMode(value: unknown): MedalConfig['handleMode'] {
  return value === 'furo-redondo' || value === 'fita' || value === 'nenhuma' ? value : 'passante';
}

function readRimCoverage(value: unknown): MedalConfig['rimCoverage'] {
  return value === 'disco' ? 'disco' : 'geral';
}

function readRimHandleStyle(value: unknown): MedalConfig['rimHandleStyle'] {
  return value === 'macica' || value === 'contorno' || value === 'canal-duplo'
    ? value
    : DEFAULT_MEDAL_CONFIG.rimHandleStyle;
}

function readRibbonWidth(value: unknown, fallback: number): number {
  return RIBBON_WIDTH_OPTIONS.includes(Number(value)) ? Number(value) : fallback;
}

function readColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.startsWith('#') ? value : fallback;
}

function restoreCustomFont(parsed: Record<string, unknown>): void {
  const base64 = parsed.customFontBase64;
  const fontName = parsed.customFontName;
  if (typeof base64 !== 'string' || typeof fontName !== 'string' || !fontName) return;
  if (typeof document === 'undefined' || !('fonts' in document)) return;

  try {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const fontFace = new FontFace(fontName, bytes.buffer);
    fontFace
      .load()
      .then((loadedFace) => {
        document.fonts.add(loadedFace);
      })
      .catch((err) => {
        console.warn('Não foi possível restaurar fonte customizada:', err);
      });
  } catch (fontErr) {
    console.warn('Falha ao decodificar fonte customizada salva:', fontErr);
  }
}

export function loadSavedMedalConfig(): MedalConfig {
  if (typeof window === 'undefined') return DEFAULT_MEDAL_CONFIG;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MEDAL_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_MEDAL_CONFIG;

    restoreCustomFont(parsed as Record<string, unknown>);

    const def = DEFAULT_MEDAL_CONFIG;
    const synced = typeof parsed.handleColorSync === 'boolean' ? parsed.handleColorSync : def.handleColorSync;

    return {
      ...def,
      ...parsed,
      artUrl: typeof parsed.artUrl === 'string' && parsed.artUrl ? parsed.artUrl : undefined,
      artName: typeof parsed.artName === 'string' && parsed.artName ? parsed.artName : undefined,
      artReliefHeight: clamp(parsed.artReliefHeight, ART_RELIEF_MIN, ART_RELIEF_MAX, def.artReliefHeight),
      artScale: clamp(parsed.artScale, ART_SCALE_MIN, ART_SCALE_MAX, def.artScale),

      topText: typeof parsed.topText === 'string' ? parsed.topText : def.topText,
      bottomText: typeof parsed.bottomText === 'string' ? parsed.bottomText : def.bottomText,
      centerText: typeof parsed.centerText === 'string' ? parsed.centerText : def.centerText,
      fontFamily: typeof parsed.fontFamily === 'string' && parsed.fontFamily ? parsed.fontFamily : def.fontFamily,
      customFontName: typeof parsed.customFontName === 'string' ? parsed.customFontName : undefined,
      customFontBase64: typeof parsed.customFontBase64 === 'string' ? parsed.customFontBase64 : undefined,
      topArcSize: clamp(parsed.topArcSize, ARC_SIZE_MIN, ARC_SIZE_MAX, def.topArcSize),
      bottomArcSize: clamp(parsed.bottomArcSize, ARC_SIZE_MIN, ARC_SIZE_MAX, def.bottomArcSize),
      centerTextSize: clamp(parsed.centerTextSize, ARC_SIZE_MIN, ARC_SIZE_MAX, def.centerTextSize),
      arcRadiusPct: clamp(parsed.arcRadiusPct, ARC_RADIUS_MIN, ARC_RADIUS_MAX, def.arcRadiusPct),

      diameter: clamp(parsed.diameter, DIAMETER_MIN, DIAMETER_MAX, def.diameter),
      baseThickness: clamp(parsed.baseThickness, 2.0, 6.0, def.baseThickness),
      bodyShape: readBodyShape(parsed.bodyShape),
      backgroundColor: readColor(parsed.backgroundColor, def.backgroundColor),

      rimEnabled: typeof parsed.rimEnabled === 'boolean' ? parsed.rimEnabled : def.rimEnabled,
      rimWidth: clamp(parsed.rimWidth, RIM_WIDTH_MIN, RIM_WIDTH_MAX, def.rimWidth),
      rimHeight: clamp(parsed.rimHeight, RIM_HEIGHT_MIN, RIM_HEIGHT_MAX, def.rimHeight),
      rimColor: readColor(parsed.rimColor, def.rimColor),
      rimCoverage: readRimCoverage(parsed.rimCoverage),
      rimHandleStyle: readRimHandleStyle(parsed.rimHandleStyle),

      handleMode: readHandleMode(parsed.handleMode),
      ribbonWidth: readRibbonWidth(parsed.ribbonWidth, def.ribbonWidth),
      slotHeight: clamp(parsed.slotHeight, SLOT_HEIGHT_MIN, SLOT_HEIGHT_MAX, def.slotHeight),
      holeDiameter: clamp(parsed.holeDiameter, HOLE_DIAMETER_MIN, HOLE_DIAMETER_MAX, def.holeDiameter),
      handleWall: clamp(parsed.handleWall, HANDLE_WALL_MIN, HANDLE_WALL_MAX, def.handleWall),
      handleThicknessZ: clamp(parsed.handleThicknessZ, HANDLE_THICKNESS_MIN, HANDLE_THICKNESS_MAX, def.handleThicknessZ),
      handleColor: readColor(parsed.handleColor, def.handleColor),
      handleColorSync: synced,
      handleUseBodyColor:
        typeof parsed.handleUseBodyColor === 'boolean' ? parsed.handleUseBodyColor : def.handleUseBodyColor,

      innerRingCount: Math.round(clamp(parsed.innerRingCount, 0, INNER_RING_MAX, def.innerRingCount)),
      innerRingRadiusPct: clamp(parsed.innerRingRadiusPct, INNER_RING_RADIUS_MIN, INNER_RING_RADIUS_MAX, def.innerRingRadiusPct),
      innerRingWidth: clamp(parsed.innerRingWidth, INNER_RING_WIDTH_MIN, INNER_RING_WIDTH_MAX, def.innerRingWidth),
    };
  } catch (err) {
    console.warn('Erro ao carregar medalha do localStorage:', err);
    return DEFAULT_MEDAL_CONFIG;
  }
}

export function saveMedalConfigToStorage(config: MedalConfig): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (err) {
    try {
      const configWithoutBase64 = { ...config, customFontBase64: undefined };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configWithoutBase64));
      return true;
    } catch (fallbackErr) {
      console.warn('Erro ao salvar medalha no localStorage:', fallbackErr);
      return false;
    }
  }
}
