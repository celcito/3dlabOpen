import { describe, it, expect } from 'vitest';
import { generateMedalModel, computeHandleLayout } from '../geometry';
import { DEFAULT_MEDAL_CONFIG } from '../presets';
import type { MedalConfig } from '../../../types/medal';

const TAU = Math.PI * 2;

/** Espelha bodyPolygon(): pontos fechados (último == primeiro). */
function ring(r: number, n: number, angleOf: (k: number) => number): { x: number; y: number }[] {
  const pts = Array.from({ length: n }, (_, k) => {
    const a = angleOf(k);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
  pts.push({ ...pts[0] });
  return pts;
}

const circleBody = (r: number) => ring(r, 128, (k) => (k * TAU) / 128);
const hexBody = (r: number) => ring(r, 6, (k) => (k * TAU) / 6);

/** topYAtCenter() para o hexágono regular (aresta superior horizontal). */
const hexTopY = (r: number) => r * Math.sin(Math.PI / 3);

describe('reforço da alça — pescoço (AC MED-004.7)', () => {
  it('passante: nasce no diâmetro da alça e alarga sem invadir o contorno', () => {
    const r = 40;
    const layout = computeHandleLayout(DEFAULT_MEDAL_CONFIG, r, r, circleBody(r));
    expect(layout).not.toBeNull();
    if (!layout) return;
    const g = layout.gusset;

    expect(g.wTop).toBeCloseTo(layout.outerR, 6);
    expect(g.yTop).toBeCloseTo(layout.cy, 6);
    expect(g.yBot).toBeCloseTo(layout.cy - layout.outerR, 6);
    expect(layout.innerRadius).toBeCloseTo(g.yBot, 6);
    expect(g.wBot).toBeCloseTo(layout.outerR * 1.3, 6);
    expect(g.wBot).toBeLessThanOrEqual(Math.sqrt(r * r - g.yBot * g.yBot) - 0.5 + 1e-6);
    // apoio do pescoço exatamente no contorno, com a borda apontando para baixo
    expect(g.yEdge).toBeCloseTo(Math.sqrt(r * r - g.wBot * g.wBot), 1);
    expect(g.edgeDx).toBeGreaterThan(0);
    expect(g.edgeDy).toBeLessThan(0);
  });

  it('furo-redondo: mesmo reforço na alça redonda', () => {
    const r = 40;
    const config: MedalConfig = { ...DEFAULT_MEDAL_CONFIG, handleMode: 'furo-redondo' };
    const layout = computeHandleLayout(config, r, r, circleBody(r));
    expect(layout).not.toBeNull();
    if (!layout) return;
    const g = layout.gusset;

    expect(g.wTop).toBeCloseTo(layout.outerR, 6);
    expect(g.wBot).toBeCloseTo(layout.outerR * 1.3, 6);
    expect(g.yBot).toBeCloseTo(layout.cy - layout.outerR, 6);
  });

  it('corpo menor: o clamp mantém o reforço dentro do contorno', () => {
    const r = 25;
    const config: MedalConfig = { ...DEFAULT_MEDAL_CONFIG, diameter: 50, bodyShape: 'hexagonal' };
    const layout = computeHandleLayout(config, hexTopY(r), r, hexBody(r));
    expect(layout).not.toBeNull();
    if (!layout) return;
    const g = layout.gusset;

    expect(g.wBot).toBeGreaterThanOrEqual(g.wTop);
    expect(g.wBot).toBeLessThan(layout.outerR * 1.3);
    expect(g.wBot).toBeLessThanOrEqual(0.85 * r);
  });

  it('sem alça: sem reforço', () => {
    const r = 40;
    const layout = computeHandleLayout({ ...DEFAULT_MEDAL_CONFIG, handleMode: 'nenhuma' }, r, r, circleBody(r));
    expect(layout).toBeNull();
  });

  it('fita: aba retangular com fenda tangencial e sem pescoço', () => {
    const r = 40;
    const config: MedalConfig = { ...DEFAULT_MEDAL_CONFIG, handleMode: 'fita' };
    const layout = computeHandleLayout(config, r, r, circleBody(r));
    expect(layout).not.toBeNull();
    if (!layout) return;
    const wall = Math.max(1.2, config.handleWall);

    expect(layout.mode).toBe('fita');
    expect(layout.slotW).toBe(config.ribbonWidth);
    expect(layout.slotH).toBe(config.slotHeight);
    expect(layout.outerT).toBeCloseTo(config.ribbonWidth / 2 + wall, 6);
    expect(layout.outerR).toBeCloseTo(config.slotHeight / 2 + wall + 4, 6);
    expect(layout.gusset.wTop).toBe(0);
    expect(layout.gusset.wBot).toBe(0);
    // AC MED-004.5 — sobreposiçãoXY ≥ 2 mm (cy − bodyTop = 0.55·outerR)
    expect(layout.outerR - (layout.cy - r)).toBeGreaterThanOrEqual(2);
    // AC MED-004.6 — não invade mais que 35% do raio do corpo
    expect(layout.outerR - (layout.cy - r)).toBeLessThanOrEqual(0.35 * r + 1e-6);
    // fenda com folga de parede nos dois eixos
    expect(layout.outerT - layout.slotW / 2).toBeGreaterThanOrEqual(1.2);
    expect(layout.outerR - layout.slotH / 2).toBeGreaterThanOrEqual(1.2);
  });
});

describe('reforço da alça — geometria gerada', () => {
  it('a pegada da alça passa a ter a largura do reforço (passante + furo)', async () => {
    for (const handleMode of ['passante', 'furo-redondo'] as const) {
      const config: MedalConfig = { ...DEFAULT_MEDAL_CONFIG, handleMode };
      const r = config.diameter / 2;
      const layout = computeHandleLayout(config, r, r, circleBody(r));
      expect(layout).not.toBeNull();
      if (!layout) continue;

      const model = await generateMedalModel(config);
      expect(model.handleMesh).toBeTruthy();
      expect(model.baseMesh).toBeTruthy();
      if (!model.handleMesh) continue;

      const geom = model.handleMesh.geometry;
      geom.computeBoundingBox();
      const box = geom.boundingBox;
      expect(box).toBeTruthy();
      if (!box) continue;

      const width = box.max.x - box.min.x;
      // sem reforço a largura seria 2·outerR; o pescoço alarga além disso
      expect(width).toBeGreaterThan(2 * layout.outerR * 1.15);
      // o contorno não pode engolir o alargamento (cantos não filetados perdiam ~3 mm)
      expect(width).toBeGreaterThan(2 * layout.gusset.wBot * 0.97);
      // sem passar do projetado (o contorno arredonda os cantos filetados)
      expect(width).toBeLessThanOrEqual(2 * layout.gusset.wBot + 0.5);
      // simetria em X (peça centrada no pipeline)
      expect(box.min.x + box.max.x).toBeCloseTo(0, 0);
      // o reforço não alarga a peça fora do disco (o contorno rasterizado fica ~0,4 mm a menos)
      expect(model.dimensions.dimX).toBeLessThanOrEqual(config.diameter);
      expect(model.dimensions.dimX).toBeGreaterThan(config.diameter - 1);
    }
  }, 180000);

  it('fita: gera aba retangular com a largura tangencial projetada', async () => {
    const config: MedalConfig = { ...DEFAULT_MEDAL_CONFIG, handleMode: 'fita' };
    const r = config.diameter / 2;
    const layout = computeHandleLayout(config, r, r, circleBody(r));
    expect(layout).not.toBeNull();
    if (!layout) return;

    const model = await generateMedalModel(config);
    expect(model.handleMesh).toBeTruthy();
    expect(model.baseMesh).toBeTruthy();
    if (!model.handleMesh) return;

    const geom = model.handleMesh.geometry;
    geom.computeBoundingBox();
    const box = geom.boundingBox;
    expect(box).toBeTruthy();
    if (!box) return;

    // aba com a largura tangencial projetada (raster ≈ 0,4 mm a menos)
    const width = box.max.x - box.min.x;
    expect(width).toBeGreaterThan(2 * layout.outerT - 0.6);
    expect(width).toBeLessThanOrEqual(2 * layout.outerT + 0.6);
    // simetria em X
    expect(box.min.x + box.max.x).toBeCloseTo(0, 0);
    // profundidade radial ≈ 2·outerR
    const depth = box.max.y - box.min.y;
    expect(depth).toBeGreaterThan(2 * layout.outerR - 0.6);
    expect(depth).toBeLessThanOrEqual(2 * layout.outerR + 0.6);
    // a aba não engorda o disco
    expect(model.dimensions.dimX).toBeLessThanOrEqual(config.diameter);
  }, 180000);
});
