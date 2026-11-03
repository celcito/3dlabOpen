import { describe, it, expect } from 'vitest';
import { DEFAULT_PENCIL_CONFIG, SYMBOL_GAP_MAX, SYMBOL_GAP_MIN, autoSymbolGapMm } from '../presets';
import { loadSavedPencilConfig } from '../storage';

describe('espaço letra↔ícone (ponteira)', () => {
  it('o padrão reproduz o espaço antigo (35% do ícone = 85% da letra)', () => {
    expect(autoSymbolGapMm(16)).toBeCloseTo(4.8, 1);
    expect(DEFAULT_PENCIL_CONFIG.symbolGap).toBe(autoSymbolGapMm(DEFAULT_PENCIL_CONFIG.letterHeight));
  });

  it('o espaço antigo escala com o tamanho da letra', () => {
    expect(autoSymbolGapMm(24)).toBeGreaterThan(autoSymbolGapMm(12));
  });

  it('config salva sem symbolGap migra para o valor proporcional à letra', () => {
    const store: Record<string, string> = {
      ponteira_lapis_3d_config_v1: JSON.stringify({ text: 'Ana', letterHeight: 20 }),
    };
    (globalThis as any).window = {
      localStorage: { getItem: (k: string) => store[k] ?? null, setItem: () => undefined },
    };
    try {
      expect(loadSavedPencilConfig().symbolGap).toBe(autoSymbolGapMm(20));
    } finally {
      delete (globalThis as any).window;
    }
  });

  it('limita o valor salvo ao intervalo do slider', () => {
    const store: Record<string, string> = {
      ponteira_lapis_3d_config_v1: JSON.stringify({ symbolGap: 999 }),
    };
    (globalThis as any).window = {
      localStorage: { getItem: (k: string) => store[k] ?? null, setItem: () => undefined },
    };
    try {
      expect(loadSavedPencilConfig().symbolGap).toBe(SYMBOL_GAP_MAX);
      store.ponteira_lapis_3d_config_v1 = JSON.stringify({ symbolGap: -5 });
      expect(loadSavedPencilConfig().symbolGap).toBe(SYMBOL_GAP_MIN);
    } finally {
      delete (globalThis as any).window;
    }
  });
});
