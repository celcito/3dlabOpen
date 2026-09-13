import type { PencilTopperConfig } from '../../types/pencilTopper';
import { DEFAULT_PENCIL_CONFIG } from './presets';

const STORAGE_KEY = 'ponteira_lapis_3d_config_v1';

export function loadSavedPencilConfig(): PencilTopperConfig {
  if (typeof window === 'undefined') return DEFAULT_PENCIL_CONFIG;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PENCIL_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PENCIL_CONFIG;

    return {
      ...DEFAULT_PENCIL_CONFIG,
      ...parsed,
      text: typeof parsed.text === 'string' ? parsed.text : DEFAULT_PENCIL_CONFIG.text,
      pencilModel: parsed.pencilModel || DEFAULT_PENCIL_CONFIG.pencilModel,
      pencilDiameter: typeof parsed.pencilDiameter === 'number' ? parsed.pencilDiameter : DEFAULT_PENCIL_CONFIG.pencilDiameter,
      clearance: typeof parsed.clearance === 'number' ? parsed.clearance : DEFAULT_PENCIL_CONFIG.clearance,
      letterSpacing: typeof parsed.letterSpacing === 'number' && parsed.letterSpacing >= 0.5 ? parsed.letterSpacing : DEFAULT_PENCIL_CONFIG.letterSpacing,
      holeShape: parsed.holeShape || DEFAULT_PENCIL_CONFIG.holeShape,
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
    console.warn('Erro ao salvar ponteira no localStorage:', err);
    return false;
  }
}
