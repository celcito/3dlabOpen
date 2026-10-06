import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadPencilPackage, transformMatrix } from '../package';
import { loadModelOnce } from './helpers';

describe('loadPencilPackage', () => {
  it('extrai as 6 peças, o corpo e os transforms do pacote real', async () => {
    const pkg = await loadModelOnce();

    expect(pkg.parts).toHaveLength(6);
    expect(pkg.bodyPart.name).toBe('Pencil_Main_Body.stl');
    expect(pkg.bodyObjectId).toBe(8);
    expect(pkg.bodyPart.extruder).toBe(1);

    const indices = pkg.bodyPart.geometry.getIndex();
    expect(indices?.count).toBe(14740 * 3);
  }, 60000);

  it('lê o bbox do corpo (46,19 × 152,11 × 46,19) e os 5 filamentos', async () => {
    const pkg = await loadModelOnce();

    const box = new THREE.Box3().setFromBufferAttribute(
      pkg.bodyPart.geometry.getAttribute('position') as THREE.BufferAttribute
    );
    const size = box.getSize(new THREE.Vector3());
    expect(size.y).toBeCloseTo(152.11, 1);
    expect(size.x).toBeCloseTo(46.19, 1);
    expect(size.z).toBeCloseTo(46.19, 1);

    expect(pkg.filamentColors).toEqual(['#FFFF00', '#EC5EAF', '#000000', '#F0EEA2', '#808080']);
  }, 60000);

  it('carrega os transforms de <assemble> das 6 peças', async () => {
    const pkg = await loadModelOnce();

    for (const part of pkg.parts) {
      expect(part.assembleTransform).toHaveLength(12);
    }
    const body = pkg.bodyPart.assembleTransform;
    expect(body.slice(0, 9)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(body[9]).toBeCloseTo(191.099, 2);
  }, 60000);

  it('falha com pacote sem 3D/3dmodel.model', async () => {
    const { zipSync } = await import('fflate');
    const empty = zipSync({ 'other.txt': new Uint8Array([1, 2, 3]) });
    const buffer = new Uint8Array(empty).buffer as ArrayBuffer;
    await expect(loadPencilPackage(buffer)).rejects.toThrow('3D/3dmodel.model');
  });
});

describe('transformMatrix', () => {
  it('aplica a convenção 3MF do Bambu (colunas 0-2 + translação 9-11)', () => {
    const identity = transformMatrix([1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 20, 30]);
    const point = new THREE.Vector3(1, 2, 3).applyMatrix4(identity);
    expect(point.x).toBeCloseTo(11);
    expect(point.y).toBeCloseTo(22);
    expect(point.z).toBeCloseTo(33);

    // mesmo <item> do corpo: eixo local +Y vira +Z do mundo
    const rotation = transformMatrix([1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0]);
    const rotated = new THREE.Vector3(0, 1, 0).applyMatrix4(rotation);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(0);
    expect(rotated.z).toBeCloseTo(1);
  });
});
