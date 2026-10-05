import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateMedalModel } from '../geometry';
import { DEFAULT_MEDAL_CONFIG } from '../presets';
import type { MedalConfig } from '../../../types/medal';

/**
 * O filete da borda é apagado sob a pegada da alça (círculo ∪ pescoço) e
 * redesenhado no relevo da alça. Sem o pescoço no recorte, o furo redondo —
 * alça pequena + reforço largo — deixava dois vãos de ~3,4 mm: o "círculo
 * maior" da borda ficava com a volta interrompida.
 */
describe('borda perimetral (rim)', () => {
  it('furo-redondo: o anel da borda fecha a volta, também sob o pescoço da alça', async () => {
    const config: MedalConfig = { ...DEFAULT_MEDAL_CONFIG, handleMode: 'furo-redondo' };
    const r = config.diameter / 2;
    const model = await generateMedalModel(config);
    const meshes = [model.baseMesh, model.reliefMesh, model.handleMesh].filter(Boolean) as THREE.Mesh[];
    expect(meshes).toHaveLength(3);

    const box = new THREE.Box3();
    for (const m of meshes) {
      m.geometry.computeBoundingBox();
      if (m.geometry.boundingBox) box.union(m.geometry.boundingBox);
    }
    // a peça sai centralizada: o centro do disco é a cota inferior + raio
    const bodyCx = 0;
    const bodyCy = box.min.y + r;
    // filete do rim: raio r − rimWidth .. r, amostrado no meio do filete
    const ringR = r - config.rimWidth / 2;
    const rimTop = config.baseThickness + config.rimHeight;

    const ray = new THREE.Raycaster();
    const rayDir = new THREE.Vector3(0, 0, -1);
    const semRelevo: number[] = [];
    const semFilete: number[] = [];
    for (let deg = 0; deg < 360; deg++) {
      const a = (deg * Math.PI) / 180;
      ray.set(
        new THREE.Vector3(bodyCx + ringR * Math.cos(a), bodyCy + ringR * Math.sin(a), 500),
        rayDir
      );
      const hits = ray.intersectObjects(meshes, false);
      if (hits.length === 0) {
        semRelevo.push(deg);
      } else if (hits[0].point.z < rimTop - 0.3) {
        // superfície no nível da face lisa: o filete não foi redesenhado ali
        semFilete.push(deg);
      }
    }
    expect(semRelevo).toEqual([]);
    expect(semFilete).toEqual([]);
  }, 180000);
});
