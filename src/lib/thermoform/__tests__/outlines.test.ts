import { describe, expect, it } from 'vitest';
import { DEFAULT_THERMOFORM_CONFIG, THERMOFORM_PRESETS, getPreset } from '../presets';
import {
  bboxOfRings,
  clampErosionMax,
  offsetOutline,
  outlineFromPathData,
  outlineFromSvgMarkup,
  polygonArea,
  resolveOutline,
  ringPerimeter,
  samplePerimeter,
} from '../outlines';

describe('thermoform/outlines — presets', () => {
  it('todos os 5 presets normalizam com maior lado = sizeMm, centrados e com área > 0', () => {
    for (const preset of THERMOFORM_PRESETS) {
      const outline = outlineFromPathData(preset.pathData, 100);
      expect(outline, `preset ${preset.id}`).not.toBeNull();
      const box = bboxOfRings([outline!.outer, ...outline!.holes]);
      const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
      expect(span, `span do preset ${preset.id}`).toBeCloseTo(100, 1);
      // Centrado na origem
      expect((box.minX + box.maxX) / 2).toBeCloseTo(0, 1);
      expect((box.minY + box.maxY) / 2).toBeCloseTo(0, 1);
      expect(Math.abs(polygonArea(outline!.outer))).toBeGreaterThan(100);
      expect(outline!.outer.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('coração tem entalhe não-convexo (área < área do bbox)', () => {
    const outline = outlineFromPathData(getPreset('coracao').pathData, 100)!;
    const box = bboxOfRings([outline.outer]);
    const area = Math.abs(polygonArea(outline.outer));
    expect(area).toBeLessThan((box.maxX - box.minX) * (box.maxY - box.minY));
  });

  it('resolveOutline usa o preset e o svgPathData substitui', () => {
    const fromPreset = resolveOutline({ ...DEFAULT_THERMOFORM_CONFIG, preset: 'estrela', sizeMm: 80 });
    expect(fromPreset).not.toBeNull();
    const starBox = bboxOfRings([fromPreset!.outer]);
    expect(Math.max(starBox.maxX - starBox.minX, starBox.maxY - starBox.minY)).toBeCloseTo(80, 1);

    const circle = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#000"/></svg>';
    const custom = resolveOutline({ ...DEFAULT_THERMOFORM_CONFIG, svgPathData: circle, sizeMm: 120 });
    expect(custom).not.toBeNull();
    const customBox = bboxOfRings([custom!.outer]);
    expect(Math.max(customBox.maxX - customBox.minX, customBox.maxY - customBox.minY)).toBeCloseTo(120, 1);
  });
});

describe('thermoform/outlines — SVG import', () => {
  it('escolhe o maior contorno externo entre shapes', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">' +
      '<circle cx="40" cy="50" r="20" fill="#000"/>' +
      '<circle cx="130" cy="50" r="45" fill="#000"/>' +
      '</svg>';
    const outline = outlineFromSvgMarkup(svg, 100);
    expect(outline).not.toBeNull();
    const box = bboxOfRings([outline!.outer]);
    expect(box.maxX - box.minX).toBeCloseTo(100, 1);
    // O círculo grande (raio 45) vence o pequeno (20)
    expect(Math.abs(polygonArea(outline!.outer))).toBeGreaterThan(Math.PI * 20 * 20);
  });

  it('preserva furos (ring com furo interno)', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<path d="M 10 10 L 90 10 L 90 90 L 10 90 Z M 30 30 L 70 30 L 70 70 L 30 70 Z" fill="#000" fill-rule="evenodd"/>' +
      '</svg>';
    const outline = outlineFromSvgMarkup(svg, 100);
    expect(outline).not.toBeNull();
    expect(outline!.holes.length).toBe(1);
  });

  it('retorna null para SVG vazio/inválido', () => {
    expect(outlineFromSvgMarkup('', 100)).toBeNull();
    expect(outlineFromSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 100)).toBeNull();
  });
});

describe('thermoform/outlines — offset (ClipperOffset)', () => {
  it('dilatação aumenta a área e erosão diminui', () => {
    for (const preset of THERMOFORM_PRESETS) {
      const outline = outlineFromPathData(preset.pathData, 100)!;
      const baseArea = Math.abs(polygonArea(outline.outer));

      const clamp = clampErosionMax(outline, 100, preset.maxErosionRatio);
      expect(clamp, `clamp do preset ${preset.id}`).toBeGreaterThan(0.4);

      const eroded = offsetOutline(outline, -clamp);
      expect(eroded, `erosão do preset ${preset.id}`).not.toBeNull();
      expect(eroded!.outer.length).toBeGreaterThanOrEqual(3);
      const erodedArea = Math.abs(polygonArea(eroded!.outer));
      expect(erodedArea, `área erodida do preset ${preset.id}`).toBeGreaterThan(0);
      expect(erodedArea).toBeLessThan(baseArea);

      const dilated = offsetOutline(outline, 3);
      expect(dilated).not.toBeNull();
      expect(Math.abs(polygonArea(dilated!.outer))).toBeGreaterThan(baseArea);
    }
  });

  it('δmax clampado não colapsa o corte do coração nem os braços da estrela', () => {
    for (const id of ['coracao', 'estrela'] as const) {
      const preset = getPreset(id);
      const outline = outlineFromPathData(preset.pathData, 100)!;
      const clamp = clampErosionMax(outline, 100, preset.maxErosionRatio);
      const eroded = offsetOutline(outline, -clamp);
      expect(eroded, `colapsou ${id} no clamp`).not.toBeNull();
      expect(Math.abs(polygonArea(eroded!.outer))).toBeGreaterThan(50);
    }
  });

  it('erosão profunda demais colapsa (retorna null) — validação do clamp', () => {
    const outline = outlineFromPathData(getPreset('estrela').pathData, 100)!;
    expect(offsetOutline(outline, -60)).toBeNull();
  });

  it('delta 0 devolve contorno cópia', () => {
    const outline = outlineFromPathData(getPreset('coracao').pathData, 100)!;
    const same = offsetOutline(outline, 0);
    expect(same).not.toBeNull();
    expect(same!.outer.length).toBe(outline.outer.length);
    expect(same!.outer[0][0]).toBeCloseTo(outline.outer[0][0], 6);
  });
});

describe('thermoform/outlines — samplePerimeter', () => {
  it('gera amostras com normais unitárias, arco crescente e dentro do tamanho', () => {
    const outline = outlineFromPathData(getPreset('coracao').pathData, 100)!;
    const samples = samplePerimeter(outline.outer, 5);
    expect(samples.length).toBeGreaterThan(8);

    const total = ringPerimeter(outline.outer);
    expect(samples[samples.length - 1].arclen).toBeLessThanOrEqual(total);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].arclen).toBeGreaterThan(samples[i - 1].arclen);
    }
    for (const s of samples) {
      expect(Math.hypot(s.nx, s.ny)).toBeCloseTo(1, 3);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(60);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(60);
    }
  });

  it('normais apontam para fora (projeto no ponto médio do bbox é positivo no lado direito)', () => {
    const outline = outlineFromPathData(getPreset('roda').pathData, 100)!;
    const samples = samplePerimeter(outline.outer, 8);
    // num círculo centrado, a normal externa ~ radial
    let radial = 0;
    for (const s of samples) {
      const len = Math.hypot(s.x, s.y) || 1;
      radial += (s.x / len) * s.nx + (s.y / len) * s.ny;
    }
    expect(radial / samples.length).toBeGreaterThan(0.9);
  });
});
