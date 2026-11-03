import { describe, it, expect } from 'vitest';
import { DEFAULT_MEDAL_CONFIG } from '../presets';
import { resolveHandleColor } from '../handleColor';

const base = {
  ...DEFAULT_MEDAL_CONFIG,
  backgroundColor: '#111111',
  rimColor: '#E2A829',
  handleColor: '#00AA00',
};

describe('resolveHandleColor', () => {
  it('padrão preserva o comportamento anterior: alça acompanha a borda', () => {
    expect(DEFAULT_MEDAL_CONFIG.handleUseBodyColor).toBe(false);
    expect(resolveHandleColor({ ...base, handleUseBodyColor: false, handleColorSync: true })).toBe('#E2A829');
  });

  it('sem sincronia usa a cor própria da alça', () => {
    expect(resolveHandleColor({ ...base, handleUseBodyColor: false, handleColorSync: false })).toBe('#00AA00');
  });

  it('"cor do corpo" tem prioridade sobre sincronia e cor própria', () => {
    expect(resolveHandleColor({ ...base, handleUseBodyColor: true, handleColorSync: true })).toBe('#111111');
    expect(resolveHandleColor({ ...base, handleUseBodyColor: true, handleColorSync: false })).toBe('#111111');
  });
});
