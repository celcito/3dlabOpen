import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateMedalModel } from '../geometry';
import { DEFAULT_MEDAL_CONFIG } from '../presets';
import type { MedalConfig } from '../../../types/medal';

type Amostra = { offset: number; z: number | null };

const BASE = DEFAULT_MEDAL_CONFIG.baseThickness;

/**
 * Corte vertical em x = 0 descendo do topo da peça até o vão: mede o relevo da
 * borda na alça pela distância à borda externa (offset). O corte para no
 * primeiro vão sem sólido, de modo que todas as amostras ficam na parede.
 */
async function perfilVertical(config: MedalConfig): Promise<Amostra[]> {
  const model = await generateMedalModel(config);
  const meshes = [model.baseMesh, model.reliefMesh, model.handleMesh].filter(Boolean) as THREE.Mesh[];
  expect(meshes).toHaveLength(3);

  const box = new THREE.Box3();
  for (const m of meshes) {
    m.geometry.computeBoundingBox();
    if (m.geometry.boundingBox) box.union(m.geometry.boundingBox);
  }

  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, 0, -1);
  const amostras: Amostra[] = [];
  for (let offset = 0.05; offset < 20; offset += 0.05) {
    ray.set(new THREE.Vector3(0, box.max.y - offset, 500), dir);
    const hits = ray.intersectObjects(meshes, false);
    if (hits.length === 0) {
      if (amostras.length > 0) break;
      continue;
    }
    amostras.push({ offset, z: hits[0].point.z });
  }
  return amostras;
}

/** Largura do filete, mesma fórmula do geometry.ts (parede/3 limitada ao rim). */
function bandMm(config: MedalConfig): number {
  const wallMm = Math.max(1.2, config.handleWall);
  return Math.max(0.4, Math.min(config.rimWidth, Math.max(0.4, wallMm / 3)));
}

const emRelevo = (a: Amostra | undefined) => !!a && a.z !== null && a.z > BASE + 0.6;
const emBase = (a: Amostra | undefined) => !!a && a.z !== null && a.z < BASE + 0.3;

function em(amostras: Amostra[], offset: number): Amostra | undefined {
  return amostras.find((a) => Math.abs(a.offset - offset) < 0.06);
}

/**
 * Os três estilos da referência (medalha_personalizada_*.stl) diferem só no
 * relevo da alça: Maciça eleva a almofada inteira (Preenchida), Canal Duplo
 * de dois filetes com canal na base e Contorno só o filete externo.
 */
describe('estilos da borda na alça', () => {
  it('macica: a parede inteira da alça fica em relevo (passante)', async () => {
    const amostras = await perfilVertical({
      ...DEFAULT_MEDAL_CONFIG,
      handleMode: 'passante',
      rimHandleStyle: 'macica',
    });
    expect(amostras.length).toBeGreaterThan(40);
    for (const a of amostras) expect(emRelevo(a), `offset ${a.offset} mm → z=${a.z}`).toBe(true);
  }, 180000);

  it('macica: a parede inteira fica em relevo também no furo redondo', async () => {
    const amostras = await perfilVertical({
      ...DEFAULT_MEDAL_CONFIG,
      handleMode: 'furo-redondo',
      rimHandleStyle: 'macica',
    });
    expect(amostras.length).toBeGreaterThan(30);
    for (const a of amostras) expect(emRelevo(a), `offset ${a.offset} mm → z=${a.z}`).toBe(true);
  }, 180000);

  it('contorno: só o filete externo, miolo e trecho junto ao vão na base', async () => {
    const config: MedalConfig = { ...DEFAULT_MEDAL_CONFIG, handleMode: 'passante', rimHandleStyle: 'contorno' };
    const band = bandMm(config);
    const amostras = await perfilVertical(config);
    expect(amostras.length).toBeGreaterThan(40);
    expect(emRelevo(em(amostras, 0.05))).toBe(true);
    expect(emBase(em(amostras, band * 1.5))).toBe(true);
    expect(emBase(amostras[amostras.length - 1])).toBe(true);
  }, 180000);

  it('canal-duplo: filete externo, canal na base, filete interno e miolo na base', async () => {
    const config: MedalConfig = { ...DEFAULT_MEDAL_CONFIG, handleMode: 'passante', rimHandleStyle: 'canal-duplo' };
    const band = bandMm(config);
    const amostras = await perfilVertical(config);
    expect(amostras.length).toBeGreaterThan(40);
    expect(emRelevo(em(amostras, 0.05))).toBe(true);
    expect(emBase(em(amostras, band * 1.5))).toBe(true);
    expect(emRelevo(em(amostras, band * 2.5))).toBe(true);
    expect(emBase(em(amostras, band * 4))).toBe(true);
  }, 180000);
});
