import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import * as THREE from 'three';
import {
  axisCenterY,
  buildTextShapes,
  faceWidthFor,
  faceNormal,
  faceTangent,
  generatePencilPersonal,
  letterPlacementMatrix,
  measureWallThickness,
  normalAt,
  surfaceOffset,
  tangentAt,
} from '../geometry';
import { setManifoldWasmUrl } from '../../split3mf/engines/manifoldLoader';
import {
  BODY_AXIS,
  DEFAULT_PENCIL_PERSONAL_CONFIG,
  HEX_FACE_WIDTH,
  LETTER_RELIEF,
  MAX_DEPTH,
  VARIANTS,
} from '../presets';
import { loadEstojoOnce, loadModelOnce } from './helpers';
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
    const wall = measureWallThickness(
      pkg.bodyPart.geometry,
      faceNormal(1),
      faceTangent(1),
      -12,
      VARIANTS['lapis-hex']
    );
    expect(wall).toBeGreaterThan(1.4);
    expect(wall).toBeLessThan(2.4);
  }, 60000);
});

describe('faceNormal', () => {
  it('gera as 6 normais a 60° no plano XY (eixo do corpo em Z)', () => {
    const normals = [1, 2, 3, 4, 5, 6].map((f) => faceNormal(f as 1));
    expect(normals[2].x).toBeCloseTo(1, 5);
    expect(normals[2].y).toBeCloseTo(0, 5);
    expect(normals[2].z).toBe(0);
    for (const normal of normals) {
      expect(normal.length()).toBeCloseTo(1, 6);
      expect(normal.z).toBe(0);
    }
  });
});

describe('buildTextShapes', () => {
  it('gera contorno denso, sem facetas grossas nas curvas', async () => {
    const shapes = await buildTextShapes(config({ text: 'Nome', letterSpacing: 1 }));
    const points = shapes.shapes.reduce((n, s) => n + s.getPoints(1).length, 0);
    expect(points).toBeGreaterThan(250);
    expect(shapes.shapes.length).toBeGreaterThan(1);
  }, 60000);
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
    expect(size.z).toBeCloseTo(generated.clampedDepth + LETTER_RELIEF, 3);
    expect(size.z).toBeGreaterThan(generated.clampedDepth);
    expect(size.z).toBeGreaterThanOrEqual(0.4);
    expect(size.x).toBeGreaterThan(0);
    expect(letterBox.min.z).toBeCloseTo(0, 5);

    expect(generated.engraveRangeMin).toBeCloseTo(2.054931640625, 4);
    expect(generated.engraveRangeMax).toBeCloseTo(117.054931640625, 4);
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

describe('orientação por variante ([G1]/[G2])', () => {
  it('normalAt/tangentAt seguem normal × BODY_AXIS nas 2 variantes', () => {
    for (const variant of Object.values(VARIANTS)) {
      const angles = variant.placement === 'angle' ? [0, 37, 90, 180, 271, 359] : null;
      const samples = angles
        ? angles.map((angleDeg) => config({ variant: variant.id, angleDeg }))
        : [1, 2, 3, 4, 5, 6].map((face) => config({ variant: variant.id, face: face as 1 }));

      for (const cfg of samples) {
        const normal = normalAt(cfg, variant);
        const tangent = tangentAt(cfg, variant);
        expect(normal.length()).toBeCloseTo(1, 6);
        expect(normal.z).toBe(0);
        expect(tangent.dot(normal)).toBeCloseTo(0, 6);
        const expected = new THREE.Vector3().crossVectors(normal, BODY_AXIS);
        expect(tangent.distanceTo(expected)).toBeCloseTo(0, 6);
      }
    }
  });

  it('normalAt varre a circunferência em 0–359° (redondo)', () => {
    const variant = VARIANTS['estojo-giz'];
    for (const angleDeg of [0, 45, 90, 135, 180, 225, 315]) {
      const normal = normalAt(config({ variant: 'estojo-giz', angleDeg }), variant);
      const rad = (angleDeg * Math.PI) / 180;
      expect(normal.x).toBeCloseTo(Math.cos(rad), 6);
      expect(normal.y).toBeCloseTo(Math.sin(rad), 6);
    }
    expect(surfaceOffset(variant)).toBe(57.5);
    expect(surfaceOffset(VARIANTS['lapis-hex'])).toBe(20);
  });

  it('faceWidth do redondo é a corda permitida pela profundidade ([G3])', () => {
    const estojo = VARIANTS['estojo-giz'];
    const chord = 2 * Math.sqrt(2 * 57.5 * (1 + LETTER_RELIEF));
    expect(faceWidthFor(estojo, 1)).toBeCloseTo(chord, 6);
    expect(faceWidthFor(estojo, 1)).toBeGreaterThan(25);
    expect(faceWidthFor(estojo, 1)).toBeLessThan(26);
    expect(faceWidthFor(VARIANTS['lapis-hex'], 1)).toBeCloseTo(HEX_FACE_WIDTH, 6);
  });

  it('assenta o bolso tangente na superfície do ângulo escolhido', () => {
    const cfg = config({
      variant: 'estojo-giz',
      angleDeg: 90,
      positionAlongAxis: 22,
      depth: 1,
    });
    const matrix = letterPlacementMatrix(cfg, 1);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(position.x).toBeCloseTo(0, 6);
    expect(position.y).toBeCloseTo(57.5 - 1, 6);
    expect(position.z).toBeCloseTo(0, 6);
    expect(axisCenterY(cfg)).toBeCloseTo(0, 6);

    // colunas: x = eixo do corpo, y = tangente, z = normal radial
    const xAxis = new THREE.Vector3().setFromMatrixColumn(matrix, 0);
    expect(xAxis.distanceTo(BODY_AXIS)).toBeCloseTo(0, 6);
    const zAxis = new THREE.Vector3().setFromMatrixColumn(matrix, 2);
    expect(zAxis.distanceTo(new THREE.Vector3(0, 1, 0))).toBeCloseTo(0, 6);
  });
});

describe('generatePencilPersonal (variante estojo-giz)', () => {
  it('grava no corpo cilíndrico: parede ~4 mm, faixa ±18 e letras = profundidade + relevo', async () => {
    const pkg = await loadEstojoOnce();
    const before = signedVolume(pkg.bodyPart.geometry);

    const generated = await generatePencilPersonal(
      pkg.bodyPart.geometry,
      config({ variant: 'estojo-giz', text: 'Ana', angleDeg: 45, positionAlongAxis: 22 })
    );

    expect(signedVolume(generated.bodyGraved)).toBeLessThan(before);
    expect(generated.wallThickness).toBeGreaterThan(3.4);
    expect(generated.wallThickness).toBeLessThan(4.6);
    expect(generated.clampedDepth).toBeLessThanOrEqual(3.6 + 1e-6);
    expect(generated.textTooWide).toBe(false);
    expect(generated.textTooLong).toBe(false);
    expect(generated.engraveRangeMin).toBeCloseTo(4, 6);
    expect(generated.engraveRangeMax).toBeCloseTo(40, 6);

    const letterBox = new THREE.Box3().setFromBufferAttribute(
      generated.letters.getAttribute('position') as THREE.BufferAttribute
    );
    expect(letterBox.getSize(new THREE.Vector3()).z).toBeCloseTo(
      generated.clampedDepth + LETTER_RELIEF,
      3
    );
  }, 180000);

  it('avisa quando a altura da letra excede a corda', async () => {
    const pkg = await loadEstojoOnce();
    const generated = await generatePencilPersonal(
      pkg.bodyPart.geometry,
      config({
        variant: 'estojo-giz',
        text: 'Nome',
        letterHeight: 40,
        positionAlongAxis: 22,
      })
    );
    expect(generated.faceWidth).toBeLessThan(30);
    expect(generated.textTooWide).toBe(true);
  }, 180000);
});
