import type { KeychainConfig } from '../../types/keychain';
import {
  DEFAULT_KEYCHAIN_CONFIG,
  LOOP_GAP_MAX,
  LOOP_GAP_MIN,
  LOOP_HOLE_MAX,
  LOOP_HOLE_MIN,
  LOOP_WALL_MAX,
  LOOP_WALL_MIN,
} from './presets';

export const SYMBOL_GAP_FACTOR_MIN = 0.05;
export const SYMBOL_GAP_FACTOR_MAX = 1.2;

const STORAGE_KEY = 'chaveiro_nome_3d_config_v1';

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readLoopSide(value: unknown): KeychainConfig['loopSide'] {
  return value === 'right' ? 'right' : 'left';
}

function readSymbolPosition(value: unknown): KeychainConfig['symbolPosition'] {
  return value === 'left' || value === 'right' || value === 'both'
    ? value
    : DEFAULT_KEYCHAIN_CONFIG.symbolPosition;
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

export function loadSavedKeychainConfig(): KeychainConfig {
  if (typeof window === 'undefined') return DEFAULT_KEYCHAIN_CONFIG;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KEYCHAIN_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_KEYCHAIN_CONFIG;

    restoreCustomFont(parsed as Record<string, unknown>);

    const def = DEFAULT_KEYCHAIN_CONFIG;
    return {
      ...def,
      ...parsed,
      text: typeof parsed.text === 'string' ? parsed.text : def.text,
      fontFamily: typeof parsed.fontFamily === 'string' && parsed.fontFamily ? parsed.fontFamily : def.fontFamily,
      customFontName: typeof parsed.customFontName === 'string' ? parsed.customFontName : undefined,
      customFontBase64: typeof parsed.customFontBase64 === 'string' ? parsed.customFontBase64 : undefined,
      customIconUrl: typeof parsed.customIconUrl === 'string' && parsed.customIconUrl ? parsed.customIconUrl : undefined,
      letterHeight: clamp(parsed.letterHeight, 10, 28, def.letterHeight),
      letterSpacing: clamp(parsed.letterSpacing, 0, 2.5, def.letterSpacing),
      fontWeightScale: clamp(parsed.fontWeightScale, 0.5, 2.0, def.fontWeightScale),
      symbolId: typeof parsed.symbolId === 'string' ? parsed.symbolId : def.symbolId,
      symbolPosition: readSymbolPosition(parsed.symbolPosition),
      outlineSize: clamp(parsed.outlineSize, 1.0, 6.0, def.outlineSize),
      bodyThickness: clamp(parsed.bodyThickness, 1.5, 6.0, def.bodyThickness),
      reliefThickness: clamp(parsed.reliefThickness, 0.8, 4.0, def.reliefThickness),
      baseColor: typeof parsed.baseColor === 'string' && parsed.baseColor.startsWith('#') ? parsed.baseColor : def.baseColor,
      reliefColor: typeof parsed.reliefColor === 'string' && parsed.reliefColor.startsWith('#') ? parsed.reliefColor : def.reliefColor,
      loopEnabled: typeof parsed.loopEnabled === 'boolean' ? parsed.loopEnabled : def.loopEnabled,
      loopSide: readLoopSide(parsed.loopSide),
      loopHoleDiameter: clamp(parsed.loopHoleDiameter, LOOP_HOLE_MIN, LOOP_HOLE_MAX, def.loopHoleDiameter),
      loopWallThickness: clamp(parsed.loopWallThickness, LOOP_WALL_MIN, LOOP_WALL_MAX, def.loopWallThickness),      loopLetterGap: clamp(
        parsed.loopLetterGap,
        LOOP_GAP_MIN,
        LOOP_GAP_MAX,
        def.loopLetterGap
      ),
      symbolGapFactor: clamp(
        parsed.symbolGapFactor,
        SYMBOL_GAP_FACTOR_MIN,
        SYMBOL_GAP_FACTOR_MAX,
        def.symbolGapFactor
      ),
    };
  } catch (err) {
    console.warn('Erro ao carregar chaveiro do localStorage:', err);
    return DEFAULT_KEYCHAIN_CONFIG;
  }
}

export function saveKeychainConfigToStorage(config: KeychainConfig): boolean {
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
      console.warn('Erro ao salvar chaveiro no localStorage:', fallbackErr);
      return false;
    }
  }
}
