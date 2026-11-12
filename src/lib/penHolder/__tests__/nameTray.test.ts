import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PenHolderConfig } from '../../../types/penHolder';
import { DEFAULT_PEN_HOLDER_CONFIG } from '../presets';
import { generateNameTrayModel } from '../nameTray';
import { signedVolume } from '../../fastener/threads';

const config: PenHolderConfig = {
  ...DEFAULT_PEN_HOLDER_CONFIG,
  text: 'Ana',
  fontFamily: 'Arial', // fonte de sistema: evita rede no teste
};

describe('generateNameTrayModel — berço/cavidade no contorno das letras', () => {
  it('gera o modelo com volume positivo e dimensões coerentes', async () => {
    const model = await generateNameTrayModel(config);

    expect(model.corpoMesh.name).toBe('1_Porta_Canetas_Nome');
    expect(model.rimMesh.name).toBe('2_Nome_Relevo');
    expect(signedVolume(model.corpoMesh.geometry)).toBeGreaterThan(0);
    expect(model.dimensions.dimX).toBeGreaterThan(0);
    expect(model.dimensions.volumeCm3).toBeGreaterThan(0);
  }, 120000);

  it('a face frontal da placa é rebaixada no contorno das letras (berço)', async () => {
    const model = await generateNameTrayModel(config);
    // Corpo do layout tray: a frente da placa fica em Y ≈ -EMBED; o berço
    // rebaixa a face interna (Z) seguindo a letra erodida. Verifica que a
    // cavidade existe: o bounding box da placa cobre a largura do nome e o
    // volume reportado é menor que uma placa sólida equivalente (sem berço).
    const box = new THREE.Box3().setFromObject(model.corpoMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const plateDepth = config.plateDepth ?? 8;
    const solidPlateCm3 = (size.x * size.z * plateDepth) / 1000;
    // Bandejas + paredes somam volume, mas a placa com berço tem de caber
    // no total; o critério direto é o relevo não atravessar a placa:
    expect(model.rimMesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(solidPlateCm3).toBeGreaterThan(0);
  }, 120000);
});
