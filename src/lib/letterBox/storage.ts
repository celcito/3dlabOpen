import type { LetterBoxConfig } from '../../types/letterBox';
import { DEFAULT_CONFIG } from './presets';

const STORAGE_KEY = 'letra_caixa_3d_config_v1';

export function loadSavedConfig(): LetterBoxConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_CONFIG;

    if (parsed.customFontBase64 && parsed.customFontName && 'fonts' in document) {
      try {
        const binaryString = window.atob(parsed.customFontBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const fontFace = new FontFace(parsed.customFontName, bytes.buffer);
        fontFace.load().then((loadedFace) => {
          document.fonts.add(loadedFace);
        }).catch((err) => {
          console.warn('Não foi possível restaurar fonte customizada:', err);
        });
      } catch (fontErr) {
        console.warn('Falha ao decodificar fonte customizada salva:', fontErr);
      }
    }

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      text: typeof parsed.text === 'string' ? parsed.text : DEFAULT_CONFIG.text,
      fontFamily: typeof parsed.fontFamily === 'string' ? parsed.fontFamily : DEFAULT_CONFIG.fontFamily,
      letterHeight: typeof parsed.letterHeight === 'number' && !isNaN(parsed.letterHeight) ? parsed.letterHeight : DEFAULT_CONFIG.letterHeight,
      backDepth: typeof parsed.backDepth === 'number' && !isNaN(parsed.backDepth) ? parsed.backDepth : DEFAULT_CONFIG.backDepth,
      letterSpacing: typeof parsed.letterSpacing === 'number' && !isNaN(parsed.letterSpacing) ? parsed.letterSpacing : DEFAULT_CONFIG.letterSpacing,
      backContour: typeof parsed.backContour === 'number' && !isNaN(parsed.backContour) ? parsed.backContour : DEFAULT_CONFIG.backContour,
      midContour: typeof parsed.midContour === 'number' && !isNaN(parsed.midContour) ? parsed.midContour : DEFAULT_CONFIG.midContour,
      frontThickness: typeof parsed.frontThickness === 'number' && !isNaN(parsed.frontThickness) ? parsed.frontThickness : DEFAULT_CONFIG.frontThickness,
      midThickness: typeof parsed.midThickness === 'number' && !isNaN(parsed.midThickness) ? parsed.midThickness : DEFAULT_CONFIG.midThickness,
      flatBase: typeof parsed.flatBase === 'boolean' ? parsed.flatBase : DEFAULT_CONFIG.flatBase,
      backColor: typeof parsed.backColor === 'string' && parsed.backColor.startsWith('#') ? parsed.backColor : DEFAULT_CONFIG.backColor,
      midColor: typeof parsed.midColor === 'string' && parsed.midColor.startsWith('#') ? parsed.midColor : DEFAULT_CONFIG.midColor,
      frontColor: typeof parsed.frontColor === 'string' && parsed.frontColor.startsWith('#') ? parsed.frontColor : DEFAULT_CONFIG.frontColor,
    };
  } catch (err) {
    console.warn('Erro ao carregar configuração do localStorage:', err);
    return DEFAULT_CONFIG;
  }
}

export function saveConfigToStorage(config: LetterBoxConfig): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const serialized = JSON.stringify(config);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    try {
      const configWithoutBase64 = { ...config, customFontBase64: undefined };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configWithoutBase64));
      return true;
    } catch (fallbackErr) {
      console.warn('Erro ao salvar no localStorage:', fallbackErr);
      return false;
    }
  }
}

export function clearSavedConfig(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Erro ao limpar localStorage:', err);
    }
  }
}
