import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSampleModel, generateMold, prepareTargetGeometry } from './generator';
import { DEFAULT_MOLD_CONFIG } from './constants';
import type { MoldConfig, MoldShape } from '../../types/mold';

const target = prepareTargetGeometry(createSampleModel('coracao'), 50);
target.computeBoundingBox();
const objSize = new THREE.Vector3();
target.boundingBox!.getSize(objSize);

const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

/** Interseções (ordenadas) de um raio vertical com as geometrias. */
function verticalHits(geoms: THREE.BufferGeometry[], x: number, y: number, fromZ: number, dir: 1 | -1) {
  const raycaster = new THREE.Raycaster(new THREE.Vector3(x, y, fromZ), new THREE.Vector3(0, 0, dir));
  return geoms
    .flatMap((geometry) => raycaster.intersectObject(new THREE.Mesh(geometry, material)))
    .sort((a, b) => a.distance - b.distance)
    .map((hit) => hit.point.z)
    // Triângulos vizinhos/duplicados devolvem o mesmo z: conta cada superfície uma vez.
    .filter((z, i, all) => i === 0 || Math.abs(z - all[i - 1]) > 1e-3);
}

function config(overrides: Partial<MoldConfig>): MoldConfig {
  return { ...DEFAULT_MOLD_CONFIG, ...overrides };
}

describe('generateMold', () => {
  describe('single_open', () => {
    it.each<MoldShape>(['box', 'rounded', 'cylinder'])('deixa a cavidade aberta no topo (%s)', (shape) => {
      const { parts } = generateMold(target, config({ type: 'single_open', shape }));
      const hits = verticalHits(parts[0].geoms, 0, 0, objSize.z + 50, -1);
      // Com a cavidade aberta o primeiro contato é o fundo da cavidade, bem abaixo do topo.
      expect(hits[0]).toBeLessThan(objSize.z * 0.5);
    });
  });

  describe('silicone_box', () => {
    it('é uma caixa aberta: piso em z = 0 e parede mais alta que o objeto', () => {
      const wall = 10;
      const { parts } = generateMold(target, config({ type: 'silicone_box', wallThickness: wall }));
      const hits = verticalHits(parts[0].geoms, 0, 0, objSize.z + wall + 50, -1);
      expect(hits[0]).toBeCloseTo(0, 1);

      const box = new THREE.Box3().setFromBufferAttribute(
        parts[0].geoms[0].getAttribute('position') as THREE.BufferAttribute
      );
      expect(box.max.z).toBeCloseTo(objSize.z + wall, 1);
    });
  });

  describe('two_part', () => {
    it('cilíndrico: as metades não passam do raio do cilindro', () => {
      const cfg = config({ type: 'two_part', shape: 'cylinder' });
      const { parts, bounds } = generateMold(target, cfg);
      const radius = Math.max(bounds.width, bounds.height) / 2;
      const maxAllowed = radius * (1 + Math.tan((cfg.draftAngle * Math.PI) / 180)) + 0.5;

      for (const part of parts) {
        const position = part.geoms[0].getAttribute('position');
        let maxRadius = 0;
        for (let i = 0; i < position.count; i++) {
          maxRadius = Math.max(maxRadius, Math.hypot(position.getX(i), position.getY(i)));
        }
        expect(maxRadius).toBeLessThanOrEqual(maxAllowed);
      }
    });

    it('cantos arredondados: os cantos do bloco são cortados', () => {
      const wall = 10;
      const { parts } = generateMold(target, config({ type: 'two_part', shape: 'rounded', wallThickness: wall, draftAngle: 0, alignmentPins: false }));
      const halfW = objSize.x / 2 + wall;
      const halfH = objSize.y / 2 + wall;
      const position = parts[0].geoms[0].getAttribute('position');
      let maxCorner = 0;
      for (let i = 0; i < position.count; i++) {
        maxCorner = Math.max(maxCorner, Math.hypot(position.getX(i), position.getY(i)));
      }
      expect(maxCorner).toBeLessThan(Math.hypot(halfW, halfH) - 0.5);
    });

    describe('pinos de alinhamento', () => {
      const wall = 10;
      const cfg = config({ type: 'two_part', shape: 'box', wallThickness: wall, draftAngle: 0, pourSpout: false, airVents: false });
      const { parts } = generateMold(target, cfg);
      const [lower, upper] = [parts[0].geoms[0], parts[1].geoms[0]];

      const splitZ = objSize.z * cfg.splitPlaneRatio;
      const lowerD = splitZ + cfg.floorThickness;
      const pinH = Math.min(8, Math.max(2, lowerD * 0.4));
      const px = (objSize.x + wall * 2) / 2 - wall * 0.75;
      const py = (objSize.y + wall * 2) / 2 - wall * 0.75;

      it('o pino fica fundido à metade de cima (só 2 superfícies: ponta e topo)', () => {
        // Raio levemente fora do centro, para não passar pelo vértice do leque da tampa.
        const hits = verticalHits([upper], px + 0.37, py + 0.21, splitZ - pinH - 5, 1);
        expect(hits).toHaveLength(2);
        expect(hits[0]).toBeCloseTo(splitZ - pinH, 1);
      });

      /** Distância do eixo do pino até a primeira superfície, num raio horizontal em z. */
      const radiusAt = (geometry: THREE.BufferGeometry, z: number) => {
        const raycaster = new THREE.Raycaster(new THREE.Vector3(px - 10, py + 0.2, z), new THREE.Vector3(1, 0, 0));
        const hit = raycaster.intersectObject(new THREE.Mesh(geometry, material))[0];
        return hit ? px - hit.point.x : Number.NaN;
      };

      it('o pino afina em direção à ponta livre', () => {
        const tip = radiusAt(upper, splitZ - pinH + 0.3);
        const root = radiusAt(upper, splitZ - 0.3);
        expect(tip).toBeLessThan(root);
      });

      it('o pino consegue entrar no furo: cada seção passa por todas as seções do furo acima dela', () => {
        const zs = [0.05, 0.25, 0.5, 0.75, 0.95].map((t) => splitZ - pinH + 0.3 + t * (pinH - 0.6));
        const pin = zs.map((z) => radiusAt(upper, z));
        const hole = zs.map((z) => radiusAt(lower, z));
        for (let i = 0; i < zs.length; i++) {
          for (let j = i; j < zs.length; j++) {
            expect(hole[j] - pin[i]).toBeGreaterThan(0.1);
          }
        }
      });

      it('a metade de baixo recebe o furo, aberto no plano de corte', () => {
        const hits = verticalHits([lower], px + 0.37, py + 0.21, splitZ + 5, -1);
        // Furo aberto: primeiro contato é o fundo do furo, sem membrana no plano de corte.
        expect(hits[0]).toBeLessThan(splitZ - pinH + 0.1);
      });
    });
  });
});
