import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  SHEET_SLICER_OVERRIDES,
  buildThermoformModelSettingsConfig,
  exportThermoform3MF,
  type Thermoform3MFItem,
} from '../threeMfExporter';
import { exportThermoformStlZip } from '../stlKit';
import { generateThermoformKit } from '../geometry';
import { DEFAULT_THERMOFORM_CONFIG } from '../presets';

async function unzipBlob(blob: Blob): Promise<Record<string, Uint8Array>> {
  const buffer = await blob.arrayBuffer();
  return unzipSync(new Uint8Array(buffer));
}

function kitItems(): { items: Thermoform3MFItem[] } {
  const config = DEFAULT_THERMOFORM_CONFIG;
  const kit = generateThermoformKit(config);
  expect(kit).not.toBeNull();
  const colorById: Record<string, string> = {
    mold: config.moldColor,
    press: config.pressColor,
    folha: config.folhaColor,
    encaixe: config.clipColor,
  };
  const nameById: Record<string, string> = {
    mold: 'Molde',
    press: 'Prensa',
    folha: 'Folha',
    encaixe: 'Encaixe',
  };
  const items: Thermoform3MFItem[] = kit!.parts.map((part) => ({
    geoms: part.geoms,
    name: nameById[part.id],
    color: colorById[part.id],
    overrides: part.id === 'folha' ? SHEET_SLICER_OVERRIDES : undefined,
  }));
  return { items };
}

describe('thermoform/threeMfExporter — model_settings.config', () => {
  it('grava extruder por peça e overrides por objeto', () => {
    const xml = buildThermoformModelSettingsConfig(
      [
        { name: '1_Molde', objId: 2, extruder: 1 },
        { name: '3_Folha', objId: 4, extruder: 2, overrides: SHEET_SLICER_OVERRIDES },
      ],
      2
    );
    expect(xml).toContain('<metadata key="extruder" value="1"/>');
    expect(xml).toContain('<metadata key="extruder" value="2"/>');
    expect(xml).toContain('<metadata key="top_shell_layers" value="0"/>');
    expect(xml).toContain('<metadata key="bottom_shell_layers" value="0"/>');
    expect(xml).toContain('<metadata key="sparse_infill_pattern" value="honeycomb"/>');
    expect(xml).toContain('<metadata key="sparse_infill_density" value="25%"/>');
    expect(xml).toContain('<metadata key="plater_id" value="1"/>');
  });
});

describe('thermoform/threeMfExporter — export 3MF', () => {
  it('zip abre com as 5 entradas, metadados Bambu e overrides da folha [X1/X2/AC-02]', async () => {
    const { items } = kitItems();
    const blob = exportThermoform3MF(items, 'Kit Termoformado');
    const files = await unzipBlob(blob);

    expect(Object.keys(files).sort()).toEqual(
      ['3D/3dmodel.model', 'Metadata/model_settings.config', 'Metadata/project_settings.config', '[Content_Types].xml', '_rels/.rels'].sort()
    );

    const model = strFromU8(files['3D/3dmodel.model']);
    expect(model).toContain('BambuStudio-02.05.00.66');
    expect(model).toContain('BambuStudio:3mfVersion');
    expect(model).toContain('unit="millimeter"');
    expect(model.match(/<object /g)?.length).toBe(4);
    expect(model.match(/<item /g)?.length).toBe(4);

    const settings = strFromU8(files['Metadata/model_settings.config']);
    expect(settings).toContain('sparse_infill_pattern');
    expect(settings).toContain('honeycomb');
    expect(settings).toContain('top_shell_layers');
    expect(settings).toContain('Molde');
    expect(settings).toContain('Folha');
    // extruders 1..4 (uma cor por peça)
    for (let e = 1; e <= 4; e++) {
      expect(settings).toContain(`<metadata key="extruder" value="${e}"/>`);
    }

    const project = strFromU8(files['Metadata/project_settings.config']);
    expect(project).toContain('#111827');
    expect(project).toContain('#3B82F6');
  }, 60_000);

  it('cores iguais deduplicam slots de filamento e compartilham extruder [K6]', async () => {
    const { items } = kitItems();
    const same = items.map((item) => ({ ...item, color: '#111827', overrides: undefined }));
    const blob = exportThermoform3MF(same, 'Cores iguais');
    const files = await unzipBlob(blob);
    const model = strFromU8(files['3D/3dmodel.model']);
    // Um único <base> de basematerials
    expect(model.match(/<base /g)?.length).toBe(1);
    const settings = strFromU8(files['Metadata/model_settings.config']);
    expect(settings).toContain('<metadata key="extruder" value="1"/>');
    expect(settings).not.toContain('<metadata key="extruder" value="2"/>');
  }, 60_000);
});

describe('thermoform/stlKit — zip de STLs', () => {
  it('gera um .stl binário por peça [X4]', async () => {
    const config = DEFAULT_THERMOFORM_CONFIG;
    const kit = generateThermoformKit(config)!;
    const blob = exportThermoformStlZip(kit.parts.map((p) => ({ id: p.id, geoms: p.geoms })));
    const files = await unzipBlob(blob);
    const names = Object.keys(files).sort();
    expect(names).toEqual(['encaixe.stl', 'folha.stl', 'mold.stl', 'press.stl']);
    for (const name of names) {
      const bytes = files[name];
      expect(bytes.length).toBeGreaterThan(84);
      const triangles = new DataView(bytes.buffer, bytes.byteOffset + 80, 4).getUint32(0, true);
      expect(triangles).toBeGreaterThan(0);
      expect(bytes.length).toBe(84 + triangles * 50);
    }
  }, 60_000);
});
