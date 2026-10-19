import { describe, expect, it } from 'vitest';
import type { PenHolderConfig } from '../../../types/penHolder';
import { DEFAULT_PEN_HOLDER_CONFIG } from '../presets';
import { computeHolderMetrics } from '../geometry';

const OUTLINES = [1.0, 2.8, 4.0, 6.0];
const SCALES = [0.5, 1.0, 2.0];
const WALLS = [1.5, 2.0, 6.0];
const FLOORS = [1.5, 3, 8];
const HEIGHTS = [50, 100, 160];
const RIMS = [0.8, 1.5, 3.0];

function config(overrides: Partial<PenHolderConfig>): PenHolderConfig {
  return { ...DEFAULT_PEN_HOLDER_CONFIG, ...overrides };
}

describe('computeHolderMetrics — invariantes em todas as combinações de canto', () => {
  for (const outlineSize of OUTLINES) {
    for (const fontWeightScale of SCALES) {
      for (const wallThickness of WALLS) {
        for (const floorThickness of FLOORS) {
          for (const cupHeight of HEIGHTS) {
            for (const rimThickness of RIMS) {
              const label = `o${outlineSize} s${fontWeightScale} wall${wallThickness} floor${floorThickness} h${cupHeight} rim${rimThickness}`;
              it(label, () => {
                const m = computeHolderMetrics(
                  config({ outlineSize, fontWeightScale, wallThickness, floorThickness, cupHeight, rimThickness })
                );

                // Dilatação efetiva sempre ≥ mínimo (peça com "gordura")
                expect(m.outlineMm).toBeGreaterThanOrEqual(1.5);
                // Cavidade sempre existe (canal ≥ 0.6 mm) e a parede nunca some (≥ 0.4 mm)
                expect(m.cavityDilation).toBeGreaterThanOrEqual(0.6);
                expect(m.cavityMarginMm).toBeGreaterThanOrEqual(0.4 - 1e-9);
                // Margem bate com a definição
                expect(m.cavityMarginMm).toBeCloseTo(m.outlineMm - m.cavityDilation, 10);
                // Altura livre sempre positiva (paredes existem entre piso e aro)
                expect(m.freeHeight).toBeGreaterThan(0);
                expect(m.freeHeight).toBeLessThanOrEqual(cupHeight);
              });
            }
          }
        }
      }
    }
  }
});

describe('computeHolderMetrics — defaults (D5/D6/D7)', () => {
  const m = computeHolderMetrics(DEFAULT_PEN_HOLDER_CONFIG);

  it('defaults: altura 100, parede 2, fundo 3, aro 1.5, contorno 4', () => {
    expect(DEFAULT_PEN_HOLDER_CONFIG.cupHeight).toBe(100);
    expect(DEFAULT_PEN_HOLDER_CONFIG.wallThickness).toBe(2.0);
    expect(DEFAULT_PEN_HOLDER_CONFIG.floorThickness).toBe(3);
    expect(DEFAULT_PEN_HOLDER_CONFIG.rimThickness).toBe(1.5);
    expect(DEFAULT_PEN_HOLDER_CONFIG.outlineSize).toBe(4.0);
  });

  it('outline efetivo = 4 (scale 1); cavity = 4 − 2 = 2; margem = 2', () => {
    expect(m.outlineMm).toBeCloseTo(4.0, 10);
    expect(m.cavityDilation).toBeCloseTo(2.0, 10);
    expect(m.cavityMarginMm).toBeCloseTo(2.0, 10);
    expect(m.wallClamped).toBe(false);
  });

  it('altura livre = 100 − 3 − 1.5 = 95.5', () => {
    expect(m.freeHeight).toBeCloseTo(95.5, 10);
  });
});

describe('computeHolderMetrics — parede maior que o contorno (clamps)', () => {
  it('contorno mínimo (1.0 × scale 0.5 → 1.5) com parede 6 limita a cavidade e sinaliza', () => {
    const m = computeHolderMetrics(
      config({ outlineSize: 1.0, fontWeightScale: 0.5, wallThickness: 6.0 })
    );
    expect(m.outlineMm).toBeCloseTo(1.5, 10);
    expect(m.cavityDilation).toBeCloseTo(0.6, 10);
    expect(m.cavityMarginMm).toBeCloseTo(0.9, 10);
    expect(m.wallClamped).toBe(true);
  });

  it('contorno máximo (6) com parede mínima (1.5) mantém a parede cheia', () => {
    const m = computeHolderMetrics(config({ outlineSize: 6.0, fontWeightScale: 1.0, wallThickness: 1.5 }));
    expect(m.cavityDilation).toBeCloseTo(4.5, 10);
    expect(m.cavityMarginMm).toBeCloseTo(1.5, 10);
    expect(m.wallClamped).toBe(false);
  });
});
