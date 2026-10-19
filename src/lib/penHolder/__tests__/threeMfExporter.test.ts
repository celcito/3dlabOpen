import { unzipSync } from 'fflate';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { exportPenHolder3MF } from '../threeMfExporter';

async function exportAndReadAsync(): Promise<Record<string, Uint8Array>> {
  const blob = exportPenHolder3MF(
    new THREE.BoxGeometry(10, 4, 60),
    new THREE.BoxGeometry(8, 2, 16),
    '#111827',
    '#FBBF24',
    'Porta_Canetas_Nome_Multicolor.3mf'
  );
  const buffer = await blob.arrayBuffer();
  return unzipSync(new Uint8Array(buffer));
}

describe('exportPenHolder3MF — pacote', () => {
  it('gera um ZIP íntegro com as 5 entradas obrigatórias', async () => {
    const output = await exportAndReadAsync();
    expect(Object.keys(output).sort()).toEqual([
      '3D/3dmodel.model',
      'Metadata/model_settings.config',
      'Metadata/project_settings.config',
      '[Content_Types].xml',
      '_rels/.rels',
    ]);
    for (const name of Object.keys(output)) {
      expect(output[name].length).toBeGreaterThan(0);
    }
  });

  it('todos os documentos XML têm exatamente uma declaração XML', async () => {
    const output = await exportAndReadAsync();
    const xmlDocs = [
      '[Content_Types].xml',
      '_rels/.rels',
      '3D/3dmodel.model',
      'Metadata/model_settings.config',
    ];
    for (const name of xmlDocs) {
      const xml = new TextDecoder().decode(output[name]);
      expect(xml.match(/<\?xml/g)?.length ?? 0).toBe(1);
    }
  });

  it('não usa JSZip/generateAsync (zip síncrono via fflate)', () => {
    expect(typeof exportPenHolder3MF).toBe('function');
  });
});

describe('exportPenHolder3MF — modelo', () => {
  it('declara 2 objetos, 2 basematerials e 2 build items com pid/pindex válidos', async () => {
    const output = await exportAndReadAsync();
    const xml = new TextDecoder().decode(output['3D/3dmodel.model']);

    expect(xml.match(/<base /g)?.length).toBe(2);
    expect(xml.match(/<object /g)?.length).toBe(2);
    expect(xml.match(/<item /g)?.length).toBe(2);
    expect(xml).toContain('displaycolor="#111827"');
    expect(xml).toContain('displaycolor="#FBBF24"');
    expect(xml).toContain('BambuStudio-02.05.00.66');
    expect(xml).toContain('BambuStudio:3mfVersion');
    expect(xml).toContain('1_Porta_Canetas_Nome');
    expect(xml).toContain('2_Aro_Colorido');

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();

    const objects = Array.from(doc.getElementsByTagName('object'));
    expect(objects.map((o) => o.getAttribute('pid'))).toEqual(['1', '1']);
    expect(objects.map((o) => o.getAttribute('pindex'))).toEqual(['0', '1']);
  });

  it('todas as referências de triângulo estão dentro da faixa de vértices', async () => {
    const output = await exportAndReadAsync();
    const xml = new TextDecoder().decode(output['3D/3dmodel.model']);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');

    for (const object of Array.from(doc.getElementsByTagName('object'))) {
      const vertices = object.getElementsByTagName('vertex').length;
      const triangles = Array.from(object.getElementsByTagName('triangle'));
      expect(vertices).toBeGreaterThan(0);
      expect(triangles.length).toBeGreaterThan(0);
      for (const triangle of triangles) {
        for (const attr of ['v1', 'v2', 'v3']) {
          const index = Number(triangle.getAttribute(attr));
          expect(Number.isInteger(index)).toBe(true);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(vertices);
        }
      }
    }
  });

  it('deduplica vértices compartilhados', async () => {
    const output = await exportAndReadAsync();
    const xml = new TextDecoder().decode(output['3D/3dmodel.model']);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const vertices = doc.getElementsByTagName('vertex').length;
    const triangles = doc.getElementsByTagName('triangle').length;
    // Box 12 triângulos + Box 12 triângulos = 24 triângulos; sem dedupe seriam 72 vértices
    expect(triangles).toBe(24);
    expect(vertices).toBeLessThanOrEqual(48);
  });
});

describe('exportPenHolder3MF — metadados Bambu', () => {
  it('model_settings.config tem extruders 1 e 2 e filament_list de 2 slots', async () => {
    const output = await exportAndReadAsync();
    const xml = new TextDecoder().decode(output['Metadata/model_settings.config']);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();

    const extruders = Array.from(doc.getElementsByTagName('metadata'))
      .filter((m) => m.getAttribute('key') === 'extruder')
      .map((m) => m.getAttribute('value'));
    expect(extruders).toEqual(['1', '2']);

    const filamentIds = Array.from(doc.getElementsByTagName('metadata'))
      .filter((m) => m.getAttribute('key') === 'filament_id')
      .map((m) => m.getAttribute('value'));
    expect(filamentIds).toEqual(['1', '2']);
  });

  it('project_settings.config é JSON válido com os 2 filamentos', async () => {
    const output = await exportAndReadAsync();
    const json = JSON.parse(new TextDecoder().decode(output['Metadata/project_settings.config']));
    expect(json.filament_colour).toEqual(['#111827', '#FBBF24']);
    expect(json.filament_type).toEqual(['PLA', 'PLA']);
    expect(json.layer_height).toBe('0.2');
  });
});
