import type { EstojoBorrachaConfig } from '../../types/estojoBorracha';
import {
  ALTURA_MAX,
  ALTURA_MIN,
  CAIXA_MAX,
  CAIXA_MIN,
  DEFAULT_ESTOJO_BORRACHA_CONFIG,
  RIPAS_MAX,
  RIPAS_MIN,
} from './presets';

const STORAGE_KEY = 'estojo_borracha_3d_config_v1';

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function loadSavedEstojoConfig(): EstojoBorrachaConfig {
  if (typeof window === 'undefined') return DEFAULT_ESTOJO_BORRACHA_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ESTOJO_BORRACHA_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_ESTOJO_BORRACHA_CONFIG;

    const def = DEFAULT_ESTOJO_BORRACHA_CONFIG;
    return {
      ...def,
      ...parsed,
      text: typeof parsed.text === 'string' ? parsed.text : def.text,
      fontFamily: typeof parsed.fontFamily === 'string' && parsed.fontFamily ? parsed.fontFamily : def.fontFamily,
      letterHeight: clamp(parsed.letterHeight, 6, 14, def.letterHeight),
      fontWeightScale: clamp(parsed.fontWeightScale, 0.5, 2.0, def.fontWeightScale),
      compInterno: clamp(parsed.compInterno, CAIXA_MIN, CAIXA_MAX, def.compInterno),
      alturaTotal: clamp(parsed.alturaTotal, ALTURA_MIN, ALTURA_MAX, def.alturaTotal),
      nRipas: Math.round(clamp(parsed.nRipas, RIPAS_MIN, RIPAS_MAX, def.nRipas)),
      raioCanto: clamp(parsed.raioCanto, 0, 12, def.raioCanto),
      capaLarg: clamp(parsed.capaLarg, 20, 200, def.capaLarg),
      textoProf: clamp(parsed.textoProf, -2.0, 2.0, def.textoProf),
      caixaColor: typeof parsed.caixaColor === 'string' && parsed.caixaColor.startsWith('#') ? parsed.caixaColor : def.caixaColor,
      capaColor: typeof parsed.capaColor === 'string' && parsed.capaColor.startsWith('#') ? parsed.capaColor : def.capaColor,
    };
  } catch (err) {
    console.warn('Erro ao carregar estojo do localStorage:', err);
    return DEFAULT_ESTOJO_BORRACHA_CONFIG;
  }
}

export function saveEstojoConfigToStorage(config: EstojoBorrachaConfig): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (err) {
    console.warn('Erro ao salvar estojo no localStorage:', err);
    return false;
  }
}
