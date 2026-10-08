import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadPencilPackage, transformMatrix } from '../package';
import { loadEstojoOnce, loadModelOnce } from './helpers';

describe('loadPencilPackage', () => {
  it('extrai as 5 peças, o corpo e os transforms do pacote real', async () => {
    const pkg = await loadModelOnce();

    expect(pkg.parts).toHaveLength(5);
    expect(pkg.bodyPart.name).toBe('Pencil_corpo_hexagonal_encaixe_reto.stl');
    expect(pkg.bodyObjectId).toBe(11);
    expect(pkg.bodyPart.extruder).toBe(1);
    expect(pkg.bodyPart.meshPath).toBe('3D/Objects/object_40.model');
    expect(pkg.bodyPart.meshObjectId).toBe(9);

    const names = pkg.parts.map((part) => part.name);
    expect(names).toEqual([
      'Pencil_Eraser.stl',
      'Pencil_TIP_Body.stl',
      'Pencil_Graphite.stl',
      'Pencil_base_rosca_macho_reto.stl',
      'Pencil_corpo_hexagonal_encaixe_reto.stl',
    ]);

    const indices = pkg.bodyPart.geometry.getIndex();
    expect(indices?.count).toBe(5256 * 3);
  }, 60000);

  it('lê o bbox do corpo deitado (40 × 46,19 × 126,11) e os 5 filamentos', async () => {
    const pkg = await loadModelOnce();

    const box = new THREE.Box3().setFromBufferAttribute(
      pkg.bodyPart.geometry.getAttribute('position') as THREE.BufferAttribute
    );
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(40, 1);
    expect(size.y).toBeCloseTo(46.19, 1);
    expect(size.z).toBeCloseTo(126.11, 1);

    expect(pkg.filamentColors).toEqual(['#FFFF00', '#EC5EAF', '#000000', '#F0EEA2', '#808080']);
  }, 60000);

  it('carrega os transforms de <assemble> das 5 peças', async () => {
    const pkg = await loadModelOnce();

    for (const part of pkg.parts) {
      expect(part.assembleTransform).toHaveLength(12);
      expect(part.buildTransform).toHaveLength(12);
    }
    const body = pkg.bodyPart.assembleTransform;
    expect(body.slice(0, 9)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(body[9]).toBeCloseTo(350.38, 2);
  }, 60000);

  it('falha com pacote sem 3D/3dmodel.model', async () => {
    const { zipSync } = await import('fflate');
    const empty = zipSync({ 'other.txt': new Uint8Array([1, 2, 3]) });
    const buffer = new Uint8Array(empty).buffer as ArrayBuffer;
    await expect(loadPencilPackage(buffer)).rejects.toThrow('3D/3dmodel.model');
  });
});

describe('loadPencilPackage (variante estojo-giz)', () => {
  it('extrai as 2 peças e reconhece o corpo pelo prefixo da variante', async () => {
    const pkg = await loadEstojoOnce();

    expect(pkg.parts.map((part) => part.name)).toEqual([
      'Estojo_corpo_cilindrico.stl',
      'Estojo_ponta_conica.stl',
    ]);
    expect(pkg.bodyPart.name).toBe('Estojo_corpo_cilindrico.stl');
    expect(pkg.bodyPart.meshPath).toBe('3D/Objects/object_1.model');
    expect(pkg.bodyPart.meshObjectId).toBe(1);
    expect(pkg.bodyObjectId).toBe(2);
    expect(pkg.bodyPart.buildTransform).toHaveLength(12);
    expect(pkg.bodyPart.assembleTransform).toHaveLength(12);
  }, 60000);

  it('lê o bbox montado do conjunto (115 × 115 × 63)', async () => {
    const pkg = await loadEstojoOnce();

    const box = new THREE.Box3();
    for (const part of pkg.parts) {
      box.expandByObject(new THREE.Mesh(part.geometry));
    }
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(115, 1);
    expect(size.y).toBeCloseTo(115, 1);
    expect(size.z).toBeCloseTo(63, 1);
  }, 60000);
});

describe('transformMatrix', () => {
  it('aplica a convenção 3MF do Bambu (colunas 0-2 + translação 9-11)', () => {
    const identity = transformMatrix([1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 20, 30]);
    const point = new THREE.Vector3(1, 2, 3).applyMatrix4(identity);
    expect(point.x).toBeCloseTo(11);
    expect(point.y).toBeCloseTo(22);
    expect(point.z).toBeCloseTo(33);
  });

  it('assenta a face 3 na mesa e a face 6 no topo pelo <item> do corpo', () => {
    const item = transformMatrix([
      2.22044605e-16, 0, -1, 0, 1, 0, 1, 0, 2.22044605e-16, 300.454235, -133.899542, 20,
    ]);
    const onBed = new THREE.Vector3(20, 0, 0).applyMatrix4(item);
    expect(onBed.z).toBeCloseTo(0, 5);
    const onTop = new THREE.Vector3(-20, 0, 0).applyMatrix4(item);
    expect(onTop.z).toBeCloseTo(40, 5);
  });
});
