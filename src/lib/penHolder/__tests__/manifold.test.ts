import { describe, expect, it } from 'vitest';
import { buildPenHolderShellGeometries, generatePenHolderModel } from '../geometry';
import { DEFAULT_PEN_HOLDER_CONFIG } from '../presets';
import { countBoundaryEdges, isWatertight, signedVolume } from '../../fastener/threads';

describe('gate de malha (validate_mesh.py)', () => {
  it('as 3 cascas (piso, paredes, aro) saem fechadas, 2-manifold e com volume > 0', async () => {
    const shells = await buildPenHolderShellGeometries({
      ...DEFAULT_PEN_HOLDER_CONFIG,
      // fonte de sistema: evita rede no teste
      fontFamily: 'Arial',
    });

    const named = [
      ['piso', shells.floorGeom],
      ['paredes', shells.wallsGeom],
      ['aro', shells.rimGeom],
    ] as const;

    for (const [name, geometry] of named) {
      expect(countBoundaryEdges(geometry), `${name}: arestas abertas`).toBe(0);
      expect(isWatertight(geometry), `${name}: fechada`).toBe(true);
      expect(signedVolume(geometry), `${name}: volume`).toBeGreaterThan(0);
    }

    // Peça apoiada na chapa (D7): piso em minZ = 0; paredes descem 0.4 mm (EMBED)
    // dentro do piso para não compartilhar vértices no plano de contato (anti
    // não-manifold no merge); aro fica no topo, acima das paredes.
    const EMBED = 0.4;
    shells.floorGeom.computeBoundingBox();
    expect(shells.floorGeom.boundingBox?.min.z, 'piso: minZ').toBeCloseTo(0, 5);

    shells.wallsGeom.computeBoundingBox();
    expect(shells.wallsGeom.boundingBox?.min.z).toBeCloseTo(
      DEFAULT_PEN_HOLDER_CONFIG.floorThickness - EMBED,
      5
    );

    const metricsFloor = DEFAULT_PEN_HOLDER_CONFIG.floorThickness;
    const metricsRim = DEFAULT_PEN_HOLDER_CONFIG.rimThickness;
    shells.rimGeom.computeBoundingBox();
    expect(shells.rimGeom.boundingBox?.min.z).toBeCloseTo(
      DEFAULT_PEN_HOLDER_CONFIG.cupHeight - metricsRim,
      5
    );
    // Aro não invade o piso e respeita a altura total
    expect(shells.rimGeom.boundingBox?.min.z).toBeGreaterThan(metricsFloor);
    expect(shells.rimGeom.boundingBox?.max.z).toBeCloseTo(DEFAULT_PEN_HOLDER_CONFIG.cupHeight, 5);

    expect(shells.nameWidthMm).toBeGreaterThan(0);
    expect(shells.bodyCount).toBeGreaterThanOrEqual(1);
  }, 120000);

  it('generatePenHolderModel mescla o corpo e reporta dimensões coerentes', async () => {
    const model = await generatePenHolderModel({
      ...DEFAULT_PEN_HOLDER_CONFIG,
      fontFamily: 'Arial',
    });

    expect(model.corpoMesh.name).toBe('1_Porta_Canetas_Nome');
    expect(model.rimMesh.name).toBe('2_Aro_Colorido');
    expect(model.dimensions.dimZ).toBeGreaterThan(90);
    expect(model.dimensions.dimX).toBeGreaterThan(0);
    expect(model.dimensions.dimY).toBeGreaterThan(0);
    expect(model.dimensions.volumeCm3).toBeGreaterThan(0);
    expect(model.dimensions.weightGrams).toBeGreaterThan(0);
    expect(model.dimensions.printTimeMinutes).toBeGreaterThan(0);
    expect(model.dimensions.nameWidthMm).toBeGreaterThan(0);
    expect(model.dimensions.bodyCount).toBeGreaterThanOrEqual(1);
    expect(model.dimensions.cavityMarginMm).toBeGreaterThanOrEqual(0.4);
  }, 120000);
});
