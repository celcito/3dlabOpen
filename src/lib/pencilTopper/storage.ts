import type { PencilTopperConfig } from '../../types/pencilTopper';
import { DEFAULT_PENCIL_CONFIG, SYMBOL_GAP_MAX, SYMBOL_GAP_MIN, autoSymbolGapMm } from './presets';

const STORAGE_KEY = 'ponteira_lapis_3d_config_v1';

export function loadSavedPencilConfig(): PencilTopperConfig {
  if (typeof window === 'undefined') return DEFAULT_PENCIL_CONFIG;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PENCIL_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PENCIL_CONFIG;

    if (parsed.customFontBase64 && parsed.customFontName && 'fonts' in document) {
      try {
        const binaryString = window.atob(parsed.customFontBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const fontFace = new FontFace(parsed.customFontName, bytes.buffer);
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

    return {
      ...DEFAULT_PENCIL_CONFIG,
      ...parsed,
      text: typeof parsed.text === 'string' ? parsed.text : DEFAULT_PENCIL_CONFIG.text,
      pencilModel: parsed.pencilModel || DEFAULT_PENCIL_CONFIG.pencilModel,
      pencilDiameter: typeof parsed.pencilDiameter === 'number' ? parsed.pencilDiameter : DEFAULT_PENCIL_CONFIG.pencilDiameter,
      clearance: typeof parsed.clearance === 'number' ? parsed.clearance : DEFAULT_PENCIL_CONFIG.clearance,
      letterSpacing: typeof parsed.letterSpacing === 'number' && parsed.letterSpacing >= 0.5 ? parsed.letterSpacing : DEFAULT_PENCIL_CONFIG.letterSpacing,
      // Configs salvas antes do slider: mantém o espaço que o gerador usava (proporcional à letra).
      symbolGap:
        typeof parsed.symbolGap === 'number' && Number.isFinite(parsed.symbolGap)
          ? Math.min(SYMBOL_GAP_MAX, Math.max(SYMBOL_GAP_MIN, parsed.symbolGap))
          : autoSymbolGapMm(typeof parsed.letterHeight === 'number' ? parsed.letterHeight : DEFAULT_PENCIL_CONFIG.letterHeight),
      holeShape: parsed.holeShape || DEFAULT_PENCIL_CONFIG.holeShape,
      holeOrientation: 'horizontal',
      baseColor: typeof parsed.baseColor === 'string' && parsed.baseColor.startsWith('#') ? parsed.baseColor : DEFAULT_PENCIL_CONFIG.baseColor,
      reliefColor: typeof parsed.reliefColor === 'string' && parsed.reliefColor.startsWith('#') ? parsed.reliefColor : DEFAULT_PENCIL_CONFIG.reliefColor,
    };
  } catch (err) {
    console.warn('Erro ao carregar ponteira do localStorage:', err);
    return DEFAULT_PENCIL_CONFIG;
  }
}

export function savePencilConfigToStorage(config: PencilTopperConfig): boolean {
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
      console.warn('Erro ao salvar ponteira no localStorage:', fallbackErr);
      return false;
    }
  }
}
