import type { PencilPersonalConfig, PencilFace, PencilFilamentIndex, PencilVariantId } from '../../types/pencilPersonal';
import {
  DEFAULT_PENCIL_PERSONAL_CONFIG,
  DEFAULT_VARIANT,
  MAX_DEPTH,
  VARIANTS,
  isPencilVariantId,
} from './presets';

const STORAGE_KEY = 'personalizar_lapis_config_v1';

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readFace(value: unknown): PencilFace {
  const n = typeof value === 'number' ? value : Number(value);
  return n >= 1 && n <= 6 ? (n as PencilFace) : DEFAULT_PENCIL_PERSONAL_CONFIG.face;
}

/** Normaliza para uma volta inteira: `[-1, 719] → [0, 359]` (passo 1, ver [U2]). */
function readAngleDeg(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_PENCIL_PERSONAL_CONFIG.angleDeg;
  return ((Math.round(n) % 360) + 360) % 360;
}

function readVariant(value: unknown): PencilVariantId {
  return isPencilVariantId(value) ? value : DEFAULT_VARIANT;
}

function readFilament(value: unknown): PencilFilamentIndex {
  const n = typeof value === 'number' ? value : Number(value);
  return n >= 1 && n <= 5 ? (n as PencilFilamentIndex) : DEFAULT_PENCIL_PERSONAL_CONFIG.filamentIndex;
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

export function loadSavedPencilPersonalConfig(): PencilPersonalConfig {
  if (typeof window === 'undefined') return DEFAULT_PENCIL_PERSONAL_CONFIG;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PENCIL_PERSONAL_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PENCIL_PERSONAL_CONFIG;

    restoreCustomFont(parsed as Record<string, unknown>);

    const def = DEFAULT_PENCIL_PERSONAL_CONFIG;
    const variant = readVariant(parsed.variant);
    const variantDef = VARIANTS[variant];
    const axisHalf = variantDef.bodyLength / 2;
    const defaultAxis = (variantDef.engraveMinY + variantDef.engraveMaxY) / 2 + axisHalf;
    return {
      ...def,
      ...parsed,
      text: typeof parsed.text === 'string' ? parsed.text : def.text,
      fontFamily: typeof parsed.fontFamily === 'string' && parsed.fontFamily ? parsed.fontFamily : def.fontFamily,
      customFontName: typeof parsed.customFontName === 'string' ? parsed.customFontName : undefined,
      customFontBase64: typeof parsed.customFontBase64 === 'string' ? parsed.customFontBase64 : undefined,
      letterHeight: clamp(parsed.letterHeight, 6, 24, def.letterHeight),
      letterSpacing: clamp(parsed.letterSpacing, 0, 3, def.letterSpacing),
      fontWeightScale: clamp(parsed.fontWeightScale, 0.5, 2.0, def.fontWeightScale),
      variant,
      face: readFace(parsed.face),
      angleDeg: readAngleDeg(parsed.angleDeg),
      positionAlongAxis: clamp(
        parsed.positionAlongAxis,
        variantDef.engraveMinY + axisHalf,
        variantDef.engraveMaxY + axisHalf,
        defaultAxis
      ),
      depth: clamp(parsed.depth, 0.4, MAX_DEPTH, def.depth),
      filamentIndex: readFilament(parsed.filamentIndex),
    };
  } catch (err) {
    console.warn('Erro ao carregar personalização do lápis:', err);
    return DEFAULT_PENCIL_PERSONAL_CONFIG;
  }
}

export function savePencilPersonalConfigToStorage(config: PencilPersonalConfig): boolean {
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
      console.warn('Erro ao salvar personalização do lápis:', fallbackErr);
      return false;
    }
  }
}
