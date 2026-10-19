import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import * as THREE from 'three';
import { generateEstojoModel } from '../geometry';
import { computeDerived } from '../presets';
import { isWatertight, signedVolume } from '../../fastener/threads';
import { setManifoldWasmUrl } from '../../split3mf/engines/manifoldLoader';
import type { EstojoBorrachaConfig } from '../../../types/estojoBorracha';
import { DEFAULT_ESTOJO_BORRACHA_CONFIG } from '../presets';

beforeAll(() => {
  setManifoldWasmUrl('file://' + path.join(process.cwd(), 'node_modules/manifold-3d/manifold.wasm'));
});

function baseConfig(over: Partial<EstojoBorrachaConfig>): EstojoBorrachaConfig {
  return { ...DEFAULT_ESTOJO_BORRACHA_CONFIG, ...over };
}

function expectValidSolid(geom: THREE.BufferGeometry, label: string) {
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);
  expect(size.x, `${label}: largura`).toBeGreaterThan(0);
  expect(size.y, `${label}: altura`).toBeGreaterThan(0);
  expect(size.z, `${label}: profundidade`).toBeGreaterThan(0);

  const vol = signedVolume(geom);
  expect(Math.abs(vol), `${label}: volume > 0`).toBeGreaterThan(1);

  // manifold deve sair estanque; se não, a malha tem buraco/orientação errada
  expect(isWatertight(geom), `${label}: watertight`).toBe(true);
}

describe('computeDerived', () => {
  it('deriva geometria consistente com o .scad (comp=180, altura=60, ripas=9)', () => {
    const d = computeDerived(baseConfig({}));
    expect(d.nRipas).toBe(9);
    expect(d.Ly).toBeCloseTo(180 - 2 * 0.5, 5);
    expect(d.Yo).toBeGreaterThan(180);
    expect(d.Hb).toBe(63); // 60 + borda 3
    expect(d.curso_max).toBeGreaterThan(0);
    expect(d.Xo).toBeGreaterThan(d.xa);
  });

  it('nRipas é arredondado para dentro do intervalo', () => {
    expect(computeDerived(baseConfig({ nRipas: 99 })).nRipas).toBe(14);
    expect(computeDerived(baseConfig({ nRipas: 1 })).nRipas).toBe(5);
  });
});

describe('generateEstojoModel', () => {
  it(
    'gera as 4 peças válidas e estanques',
    async () => {
      const model = await generateEstojoModel(baseConfig({}));

      expectValidSolid(model.caixaMesh.geometry, 'caixa');
      expectValidSolid(model.portaMesh.geometry, 'porta');
      expectValidSolid(model.plugueMesh.geometry, 'plugue');
      expectValidSolid(model.capaMesh.geometry, 'capa');

      expect(model.dimensions.volumeCm3).toBeGreaterThan(0);
      expect(model.dimensions.cursoMax).toBeGreaterThan(0);
    },
    60000
  );

  it(
    'respeita as dimensões internas do lápis (comp_interno)',
    async () => {
      const d = computeDerived(baseConfig({ compInterno: 120 }));
      const model = await generateEstojoModel(baseConfig({ compInterno: 120 }));
      // a ripa tem Ly ≈ comp - 2*ye ao longo de Y; a caixa ocupa Yo > comp
      model.caixaMesh.geometry.computeBoundingBox();
      const box = model.caixaMesh.geometry.boundingBox!;
      // Y é o eixo do comprimento interno
      expect(box.max.y - box.min.y).toBeGreaterThan(120);
      expect(d.Ly).toBeCloseTo(119, 5);
    },
    60000
  );

  it(
    'gera um nome na capa quando texto presente e mede a largura',
    async () => {
      const withName = await generateEstojoModel(baseConfig({ text: 'ANA' }));
      expect(withName.dimensions.nameWidthMm).toBeGreaterThan(0);

      const noName = await generateEstojoModel(baseConfig({ text: '' }));
      expect(noName.dimensions.nameWidthMm).toBe(0);
    },
    60000
  );
});
