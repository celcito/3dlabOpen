import { LetterBoxConfig, PencilTopperConfig } from '../types/letterBox';
import { DEFAULT_CONFIG } from '../data/fontsAndPresets';
import { DEFAULT_PENCIL_CONFIG } from '../data/pencilTopperPresets';

const LETTER_STORAGE_KEY = 'workbench-letter-box-config';
const PENCIL_STORAGE_KEY = 'workbench-pencil-topper-config';

export function loadSavedConfig(): LetterBoxConfig {
  try {
    const stored = localStorage.getItem(LETTER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Falha ao carregar configuração salva:', e);
  }
  return DEFAULT_CONFIG;
}

export function saveConfigToStorage(config: LetterBoxConfig): void {
  try {
    localStorage.setItem(LETTER_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Falha ao salvar configuração:', e);
  }
}

export function clearSavedConfig(): void {
  try {
    localStorage.removeItem(LETTER_STORAGE_KEY);
  } catch (e) {
    console.warn('Falha ao limpar configuração:', e);
  }
}

export function loadSavedPencilConfig(): PencilTopperConfig {
  try {
    const stored = localStorage.getItem(PENCIL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PENCIL_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Falha ao carregar configuração da ponteira:', e);
  }
  return DEFAULT_PENCIL_CONFIG;
}

export function savePencilConfigToStorage(config: PencilTopperConfig): void {
  try {
    localStorage.setItem(PENCIL_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Falha ao salvar configuração da ponteira:', e);
  }
}