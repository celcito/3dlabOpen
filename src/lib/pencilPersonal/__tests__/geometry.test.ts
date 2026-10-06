import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import * as THREE from 'three';
import { generatePencilPersonal, measureWallThickness, faceNormal } from '../geometry';
import { setManifoldWasmUrl } from '../../split3mf/engines/manifoldLoader';
import { DEFAULT_PENCIL_PERSONAL_CONFIG, MAX_DEPTH } from '../presets';
import { loadModelOnce } from './helpers';
import type { PencilPersonalConfig } from '../../../types/pencilPersonal';

beforeAll(() => {
  // Node/vitest can't resolve the Vite ?url WASM asset; point at the real file.
  setManifoldWasmUrl('file://' + path.join(process.cwd(), 'node_modules/manifold-3d/manifold.wasm'));
});

function signedVolume(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const index = geometry.getIndex();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let volume = 0;
  const triangleCount = index ? index.count / 3 : position.count / 3;
  for (let i = 0; i < triangleCount; i++) {
    const ia = index ? index.getX(i * 3) : i * 3;
    const ib = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const ic = index ? index.getX(i * 3 + 2) : i * 3 + 2;
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    volume += a.dot(b.clone().cross(c)) / 6;
  }
  return Math.abs(volume);
}

function config(overrides: Partial<PencilPersonalConfig> = {}): PencilPersonalConfig {
  return {
    ...DEFAULT_PENCIL_PERSONAL_CONFIG,
    // fonte de sistema: evita rede no teste
    fontFamily: 'Arial',
    ...overrides,
  };
}

describe('measureWallThickness', () => {
  it('mede ~1,8 mm de parede no corpo real', async () => {
    const pkg = await loadModelOnce();
    const wall = measureWallThickness(pkg.bodyPart.geometry, 1, -12);
    expect(wall).toBeGreaterThan(1.4);
    expect(wall).toBeLessThan(2.4);
  }, 60000);
});

describe('faceNormal', () => {
  it('gera as 6 normais a 60° no plano XZ', () => {
    const normals = [1, 2, 3, 4, 5, 6].map((f) => faceNormal(f as 1));
    expect(normals[0].y).toBe(0);
    expect(normals[0].x).toBeCloseTo(0.5, 5);
    expect(normals[0].z).toBeCloseTo(Math.sqrt(3) / 2, 5);
    for (const normal of normals) {
      expect(normal.length()).toBeCloseTo(1, 6);
      expect(Math.abs(normal.y)).toBe(0);
    }
  });
});

describe('generatePencilPersonal', () => {
  it('subtrai o nome do corpo e gera as letras inlay', async () => {
    const pkg = await loadModelOnce();
    const before = signedVolume(pkg.bodyPart.geometry);

    const generated = await generatePencilPersonal(pkg.bodyPart.geometry, config({ text: 'Ana' }));

    expect(signedVolume(generated.bodyGraved)).toBeLessThan(before);
    expect(generated.bodyGraved.getAttribute('position').count).toBeGreaterThan(0);

    const letterBox = new THREE.Box3().setFromBufferAttribute(
      generated.letters.getAttribute('position') as THREE.BufferAttribute
    );
    const size = letterBox.getSize(new THREE.Vector3());
    expect(size.z).toBeCloseTo(generated.clampedDepth - 0.2, 3);
    expect(size.z).toBeGreaterThanOrEqual(0.4);
    expect(size.x).toBeGreaterThan(0);
    expect(letterBox.min.z).toBeCloseTo(0, 5);
  }, 120000);

  it('clampa a profundidade pela espessura da parede', async () => {
    const pkg = await loadModelOnce();
    const generated = await generatePencilPersonal(
      pkg.bodyPart.geometry,
      config({ text: 'Ana', depth: 5 })
    );
    expect(generated.clampedDepth).toBeLessThanOrEqual(MAX_DEPTH + 1e-6);
    expect(generated.clampedDepth).toBeGreaterThanOrEqual(0.4);
    expect(generated.wallThickness).toBeGreaterThan(generated.clampedDepth);
  }, 120000);

  it('avisa quando a letra é mais larga que a face', async () => {
    const pkg = await loadModelOnce();
    const generated = await generatePencilPersonal(
      pkg.bodyPart.geometry,
      config({ text: 'Nome', letterHeight: 24, positionAlongAxis: 10 })
    );
    expect(generated.textTooWide || generated.textTooLong).toBe(true);
  }, 120000);
});
