import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'fflate';
import { exportPencilTopper3MF } from '../threeMfExporter';

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function modelXml(meta?: { singleColor?: boolean }): Promise<string> {
  const blob = await exportPencilTopper3MF(
    new THREE.BoxGeometry(10, 4, 2),
    new THREE.BoxGeometry(6, 1, 0.8),
    '#111111',
    '#FFFFFF',
    'Chaveiro_Teste',
    { singleColor: meta?.singleColor }
  );
  const files = unzipSync(await readBytes(blob));
  return strFromU8(files['3D/3dmodel.model']);
}

describe('3MF do chaveiro', () => {
  it('cor única declara um só material e não pede troca de cor', async () => {
    const xml = await modelXml({ singleColor: true });
    expect(xml.match(/<m:color /g)).toHaveLength(1);
    // corpo e relevo no mesmo índice de material
    expect(xml).toContain('id="2" type="model" pid="1" pindex="0"');
    expect(xml).toContain('id="3" type="model" pid="1" pindex="0"');
  });

  it('sem a opção mantém as duas cores (ponteira de lápis)', async () => {
    const xml = await modelXml();
    expect(xml.match(/<m:color /g)).toHaveLength(2);
    expect(xml).toContain('id="3" type="model" pid="1" pindex="1"');
  });
});
