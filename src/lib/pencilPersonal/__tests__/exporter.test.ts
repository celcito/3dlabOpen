import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'fflate';
import {
  exportPersonalizedPencil,
  LETTER_OBJECT_ID,
  LETTER_PART_ID,
  LETTER_PLATE_ID,
  LETTER_ITEM_TRANSFORM,
} from '../exporter';
import { loadModelOnce } from './helpers';

const REWRITTEN = [
  '3D/Objects/object_6.model',
  '3D/3dmodel.model',
  'Metadata/model_settings.config',
];

async function exportSample() {
  const pkg = await loadModelOnce();
  const bodyGraved = new THREE.BoxGeometry(10, 20, 10).toNonIndexed();
  const letters = new THREE.BoxGeometry(4, 6, 0.8).toNonIndexed();
  letters.computeBoundingBox();
  const minZ = letters.boundingBox?.min.z ?? 0;
  letters.translate(0, 0, -minZ);
  letters.computeBoundingBox();

  const blob = exportPersonalizedPencil({
    source: pkg.source,
    bodyGraved,
    letters,
    filamentIndex: 3,
    text: 'Ana',
  });
  const buffer = await blob.arrayBuffer();
  return {
    entries: unzipSync(new Uint8Array(buffer)),
    source: pkg.source,
    bodyGraved,
    letters,
  };
}

describe('exportPersonalizedPencil (copy-ZIP)', () => {
  it('mantém byte a byte todas as entradas fora das 3 autorizadas [E1/E2]', async () => {
    const { entries, source } = await exportSample();
    const original = unzipSync(new Uint8Array(source));

    expect(Object.keys(entries).sort()).toEqual(Object.keys(original).sort());
    for (const name of Object.keys(original)) {
      if (REWRITTEN.includes(name)) continue;
      expect(Array.from(entries[name]), `entry ${name} mudou`).toEqual(
        Array.from(original[name])
      );
    }
    for (const name of REWRITTEN) {
      expect(entries[name], `entry ${name} ausente`).toBeTruthy();
    }
  }, 60000);

  it('reescreve só a malha do corpo em object_6.model', async () => {
    const { entries, bodyGraved } = await exportSample();
    const xml = strFromU8(entries['3D/Objects/object_6.model']);

    expect(xml.match(/<\?xml/g)).toHaveLength(1);
    expect(xml).toContain('<object id="7"');

    const vertexCount = (xml.match(/<vertex /g) || []).length;
    expect(vertexCount).toBe(bodyGraved.getAttribute('position').count);
    const triangleTotal = (xml.match(/<triangle /g) || []).length;
    expect(triangleTotal).toBe(bodyGraved.getAttribute('position').count / 3);

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
  }, 60000);

  it('injeta objeto 14/part 13 e o <item> na célula livre da grade [E3/E4]', async () => {
    const { entries, letters } = await exportSample();
    const xml = strFromU8(entries['3D/3dmodel.model']);

    expect(xml.match(/<\?xml/g)).toHaveLength(1);
    expect(xml).toContain(`<object id="${LETTER_PART_ID}" type="model">`);
    expect(xml).toContain(`<object id="${LETTER_OBJECT_ID}" type="model">`);
    expect(xml).toContain(`<component objectid="${LETTER_PART_ID}"`);
    expect(xml).toContain(`<item objectid="${LETTER_OBJECT_ID}"`);
    expect(xml).toContain(`transform="${LETTER_ITEM_TRANSFORM}"`);

    const item = xml.match(new RegExp(`<item objectid="${LETTER_OBJECT_ID}"[^>]*>`));
    expect(item).not.toBeNull();
    expect(item?.[0]).not.toContain('p:path');

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();

    // a malha das letras entra assentada em Z=0
    const block = xml.slice(xml.indexOf(`<object id="${LETTER_PART_ID}"`));
    const zValues = Array.from(block.matchAll(/<vertex [^>]*z="([^"]*)"/g)).map((m) => Number(m[1]));
    expect(zValues.length).toBe(letters.getAttribute('position').count);
    expect(Math.min(...zValues)).toBeCloseTo(0, 5);

    const originalXml = strFromU8(unzipSync(new Uint8Array((await loadModelOnce()).source))[
      '3D/3dmodel.model'
    ]);
    expect(originalXml).not.toContain(`id="${LETTER_OBJECT_ID}"`);
  }, 60000);

  it('cria a placa 7 com o objeto das letras em model_settings [E5]', async () => {
    const { entries } = await exportSample();
    const xml = strFromU8(entries['Metadata/model_settings.config']);

    expect(xml.match(/<\?xml/g)).toHaveLength(1);
    expect(xml).toContain(`<object id="${LETTER_OBJECT_ID}">`);
    expect(xml).toContain(`<part id="${LETTER_PART_ID}" subtype="normal_part"`);
    expect(xml).toContain('<metadata key="extruder" value="3"/>');
    expect(xml).toContain(`<metadata key="plater_id" value="${LETTER_PLATE_ID}"/>`);
    expect(xml).not.toContain('plate_7.png');
    expect((xml.match(/<metadata key="plater_id"/g) || []).length).toBe(7);
    expect(xml).toMatch(
      new RegExp(
        `<metadata key="object_id" value="${LETTER_OBJECT_ID}"/>[\\s\\S]*?<metadata key="identify_id"`
      )
    );

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
  }, 60000);
});
