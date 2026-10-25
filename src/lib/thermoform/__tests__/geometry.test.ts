import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { countBoundaryEdges, isWatertight, signedVolume } from '../../fastener/threads';
import { DEFAULT_THERMOFORM_CONFIG, THERMOFORM_PRESETS } from '../presets';
import { buildClips, buildMold, buildPress, buildSheet, buildStem, generateThermoformKit } from '../geometry';
import { resolveOutline } from '../outlines';
import type { ThermoformConfig } from '../../../types/thermoform';

function cfg(overrides: Partial<ThermoformConfig> = {}): ThermoformConfig {
  return { ...DEFAULT_THERMOFORM_CONFIG, ...overrides, parts: { ...DEFAULT_THERMOFORM_CONFIG.parts, ...(overrides.parts ?? {}) } };
}

function expectShell(geom: THREE.BufferGeometry, label: string): void {
  expect(countBoundaryEdges(geom), `${label}: arestas abertas`).toBe(0);
  expect(isWatertight(geom), `${label}: watertight`).toBe(true);
  expect(signedVolume(geom), `${label}: volume`).toBeGreaterThan(0);
}

const FRUIT_IDS = new Set(['morango', 'maca', 'banana', 'cacho']);

describe('thermoform/geometry — kit por preset', () => {
  it('todos os presets geram kit completo com cascas fechadas e volume > 0', () => {
    for (const preset of THERMOFORM_PRESETS) {
      const kit = generateThermoformKit(cfg({ preset: preset.id }));
      expect(kit, `kit ${preset.id}`).not.toBeNull();
      const ids = kit!.parts.map((p) => p.id);
      if (FRUIT_IDS.has(preset.id)) {
        expect(ids, `peças do preset ${preset.id}`).toEqual(['mold', 'press', 'folha', 'encaixe', 'cabo']);
        expect(kit!.dimensions.partCount).toBe(5);
      } else {
        expect(ids, `peças do preset ${preset.id}`).toEqual(['mold', 'press', 'folha', 'encaixe']);
        expect(kit!.dimensions.partCount).toBe(4);
      }
      expect(kit!.dimensions.dimX).toBeGreaterThan(50);
      expect(kit!.dimensions.dimZ).toBeGreaterThan(5);

      for (const part of kit!.parts) {
        expect(part.geoms.length, `${preset.id}/${part.id}`).toBeGreaterThan(0);
        part.geoms.forEach((g, i) => expectShell(g, `${preset.id}/${part.id}[${i}]`));
      }
    }
  }, 120_000);

  it('clipes de fruta ficam só na borda inferior (y < 0, outline centrado)', () => {
    for (const id of ['morango', 'banana'] as const) {
      const config = cfg({ preset: id, clipCount: 3 });
      const outline = resolveOutline(config)!;
      const clips = buildClips(outline, config, { bottomOnly: true });
      expect(clips.length, `clips de ${id}`).toBeGreaterThan(0);
      for (const g of clips) {
        g.computeBoundingBox();
        expect(g.boundingBox!.max.y, `clip de ${id} deve estar abaixo do centro`).toBeLessThan(0);
      }
    }
  }, 60_000);

  it('cabo: cascas fechadas (slot U + talo)', () => {
    for (const id of ['morango', 'banana'] as const) {
      const config = cfg({ preset: id });
      const outline = resolveOutline(config)!;
      const stem = buildStem(outline, config, THERMOFORM_PRESETS.find((p) => p.id === id)!.stemPathData!);
      expect(stem.length, `cascas do cabo ${id}`).toBe(2);
      stem.forEach((g, i) => expectShell(g, `cabo ${id}[${i}]`));
    }
  }, 60_000);

  it('parts.cabo false remove a peça (fruta volta a 4 peças)', () => {
    const kit = generateThermoformKit(cfg({ preset: 'morango', parts: { mold: true, press: true, folha: true, encaixe: true, cabo: false } }));
    expect(kit!.parts.map((p) => p.id)).toEqual(['mold', 'press', 'folha', 'encaixe']);
  }, 60_000);

  it('mold do coração: 2 cascas (laje + domo) e largura ≈ sizeMm [AC-01]', () => {
    const outline = resolveOutline(cfg({ preset: 'coracao' }))!;
    const mold = buildMold(outline, cfg({ preset: 'coracao' }));
    expect(mold.length).toBe(2);
    const box = new THREE.Box3();
    for (const g of mold) {
      g.computeBoundingBox();
      box.union(g.boundingBox!);
    }
    expect(box.max.x - box.min.x).toBeCloseTo(100, 0);
    // Domos: altura total = base + domeHeight
    expect(box.max.z).toBeCloseTo(4 + 12, 0);
  }, 60_000);

  it('press: flange + parede embutida; folha: piso + aro; encaixes: clipCount geoms', () => {
    const config = cfg({ clipCount: 3 });
    const outline = resolveOutline(config)!;
    const press = buildPress(outline, config);
    expect(press.length).toBe(2);
    press.forEach((g, i) => expectShell(g, `press[${i}]`));

    const sheet = buildSheet(outline, config);
    expect(sheet.length).toBe(2);
    sheet.forEach((g, i) => expectShell(g, `folha[${i}]`));

    const clips = buildClips(outline, config);
    expect(clips.length).toBe(3);
    clips.forEach((g, i) => expectShell(g, `clip[${i}]`));
  }, 60_000);

  it('toggles por peça desligam geração; tudo off = null [K5]', () => {
    const noClips = generateThermoformKit(cfg({ parts: { mold: true, press: true, folha: true, encaixe: false, cabo: false } }));
    expect(noClips!.parts.map((p) => p.id)).toEqual(['mold', 'press', 'folha']);

    const onlyMold = generateThermoformKit(cfg({ parts: { mold: true, press: false, folha: false, encaixe: false, cabo: false } }));
    expect(onlyMold!.parts.map((p) => p.id)).toEqual(['mold']);

    expect(generateThermoformKit(cfg({ parts: { mold: false, press: false, folha: false, encaixe: false, cabo: false } }))).toBeNull();
  }, 60_000);

  it('SVG custom gera kit (outline resolvido do markup)', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#000"/></svg>';
    const kit = generateThermoformKit(cfg({ svgPathData: svg, sizeMm: 80 }));
    expect(kit).not.toBeNull();
    expect(kit!.parts.length).toBe(4);
    for (const part of kit!.parts) {
      part.geoms.forEach((g, i) => expectShell(g, `svg/${part.id}[${i}]`));
    }
  }, 60_000);
});
