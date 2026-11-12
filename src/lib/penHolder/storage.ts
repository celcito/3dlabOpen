import type { PenHolderConfig } from '../../types/penHolder';
import {
  CUP_FLOOR_MAX,
  CUP_FLOOR_MIN,
  CUP_HEIGHT_MAX,
  CUP_HEIGHT_MIN,
  CUP_WALL_MAX,
  CUP_WALL_MIN,
  DEFAULT_PEN_HOLDER_CONFIG,
  RIM_MAX,
  RIM_MIN,
} from './presets';

const STORAGE_KEY = 'porta_canetas_nome_3d_config_v1';

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
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

export function loadSavedPenHolderConfig(): PenHolderConfig {
  if (typeof window === 'undefined') return DEFAULT_PEN_HOLDER_CONFIG;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PEN_HOLDER_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PEN_HOLDER_CONFIG;

    restoreCustomFont(parsed as Record<string, unknown>);

    const def = DEFAULT_PEN_HOLDER_CONFIG;
    return {
      ...def,
      ...parsed,
      text: typeof parsed.text === 'string' ? parsed.text : def.text,
      fontFamily: typeof parsed.fontFamily === 'string' && parsed.fontFamily ? parsed.fontFamily : def.fontFamily,
      customFontName: typeof parsed.customFontName === 'string' ? parsed.customFontName : undefined,
      customFontBase64: typeof parsed.customFontBase64 === 'string' ? parsed.customFontBase64 : undefined,
      letterHeight: clamp(parsed.letterHeight, 10, 28, def.letterHeight),
      letterSpacing: clamp(parsed.letterSpacing, 0, 2.5, def.letterSpacing),
      fontWeightScale: clamp(parsed.fontWeightScale, 0.5, 2.0, def.fontWeightScale),
      outlineSize: clamp(parsed.outlineSize, 1.0, 6.0, def.outlineSize),
      // Migração da v1 (placa + copo): reliefThickness vira a espessura do aro.
      rimThickness: clamp(
        parsed.rimThickness ?? parsed.reliefThickness,
        RIM_MIN,
        RIM_MAX,
        def.rimThickness
      ),
      compartments: clamp(parsed.compartments, 1, 8, def.compartments ?? 4),
      trayDepth: clamp(parsed.trayDepth, 20, 80, def.trayDepth ?? 40),
      trayHeight: clamp(parsed.trayHeight, 40, 140, def.trayHeight ?? 90),
      frontWallHeight: clamp(parsed.frontWallHeight, 8, 60, def.frontWallHeight ?? 20),
      plateDepth: clamp(parsed.plateDepth, 4, 16, def.plateDepth ?? 8),
      cupHeight: clamp(parsed.cupHeight, CUP_HEIGHT_MIN, CUP_HEIGHT_MAX, def.cupHeight),
      wallThickness: clamp(parsed.wallThickness, CUP_WALL_MIN, CUP_WALL_MAX, def.wallThickness),
      floorThickness: clamp(parsed.floorThickness, CUP_FLOOR_MIN, CUP_FLOOR_MAX, def.floorThickness),
      baseColor: typeof parsed.baseColor === 'string' && parsed.baseColor.startsWith('#') ? parsed.baseColor : def.baseColor,
      reliefColor: typeof parsed.reliefColor === 'string' && parsed.reliefColor.startsWith('#') ? parsed.reliefColor : def.reliefColor,
    };
  } catch (err) {
    console.warn('Erro ao carregar porta-canetas do localStorage:', err);
    return DEFAULT_PEN_HOLDER_CONFIG;
  }
}

export function savePenHolderConfigToStorage(config: PenHolderConfig): boolean {
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
      console.warn('Erro ao salvar porta-canetas no localStorage:', fallbackErr);
      return false;
    }
  }
}
