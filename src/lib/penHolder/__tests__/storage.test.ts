import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PEN_HOLDER_CONFIG } from '../presets';
import { loadSavedPenHolderConfig, savePenHolderConfigToStorage } from '../storage';

const STORAGE_KEY = 'porta_canetas_nome_3d_config_v1';

describe('penHolder/storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('retorna os defaults quando não há nada salvo', () => {
    expect(loadSavedPenHolderConfig()).toEqual(DEFAULT_PEN_HOLDER_CONFIG);
  });

  it('save → load preserva a config', () => {
    const config = {
      ...DEFAULT_PEN_HOLDER_CONFIG,
      text: 'Milene',
      cupHeight: 120,
      wallThickness: 4,
      floorThickness: 5,
      rimThickness: 2.4,
    };
    expect(savePenHolderConfigToStorage(config)).toBe(true);
    expect(loadSavedPenHolderConfig()).toEqual(config);
  });

  it('aplica clamps por campo em valores fora da faixa', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        text: 'Ana',
        cupHeight: -10,
        wallThickness: 0.1,
        floorThickness: 100,
        rimThickness: 50,
        letterHeight: 999,
        letterSpacing: -5,
        fontWeightScale: 0,
        outlineSize: 99,
      })
    );
    const loaded = loadSavedPenHolderConfig();
    expect(loaded.cupHeight).toBe(50);
    expect(loaded.wallThickness).toBe(1.5);
    expect(loaded.floorThickness).toBe(8);
    expect(loaded.rimThickness).toBe(3.0);
    expect(loaded.letterHeight).toBe(28);
    expect(loaded.letterSpacing).toBe(0);
    expect(loaded.fontWeightScale).toBe(0.5);
    expect(loaded.outlineSize).toBe(6.0);
  });

  it('migra reliefThickness antigo (v1 placa+copo) para rimThickness', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ text: 'Ana', reliefThickness: 2.4 })
    );
    expect(loadSavedPenHolderConfig().rimThickness).toBe(2.4);
  });

  it('JSON inválido cai nos defaults sem crash', () => {
    window.localStorage.setItem(STORAGE_KEY, '{nope');
    expect(loadSavedPenHolderConfig()).toEqual(DEFAULT_PEN_HOLDER_CONFIG);
  });
});
