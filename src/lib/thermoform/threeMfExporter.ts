import * as THREE from 'three';
import { zipSync, strToU8 } from 'fflate';
import {
  buildProjectSettingsConfig,
  normalizeColor,
  type FilamentDefinition,
} from '../threeMfExporter';

const BASE_MATERIALS_ID = 1;

/**
 * Overrides de slicer espelhados do kit de referência (`coracao termoformado.3mf`):
 * é isso que gera a malha visível da folha no fatiador (D2 / [X2]).
 */
export const SHEET_SLICER_OVERRIDES: Record<string, string> = {
  top_shell_layers: '0',
  bottom_shell_layers: '0',
  sparse_infill_pattern: 'honeycomb',
  sparse_infill_density: '25%',
};

export interface Thermoform3MFItem {
  /** Cascas fechadas da peça — viram um único `<object>` (mescla de vértices). */
  geoms: THREE.BufferGeometry[];
  name: string;
  /** Cor da peça; cores iguais deduplicam slots e o `extruder` sai do slot. */
  color: string;
  /** Overrides de slicer por objeto (`<metadata key=… value=…/>`). */
  overrides?: Record<string, string>;
}

function xmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function concatPositions(geoms: THREE.BufferGeometry[]): Float32Array | null {
  const parts = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of parts) {
    const pos = g.getAttribute('position');
    if (!pos) return null;
    total += pos.count;
  }
  if (total === 0) return null;

  const out = new Float32Array(total * 3);
  let offset = 0;
  for (const g of parts) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      out[(offset + i) * 3] = pos.getX(i);
      out[(offset + i) * 3 + 1] = pos.getY(i);
      out[(offset + i) * 3 + 2] = pos.getZ(i);
    }
    offset += pos.count;
  }
  return out;
}

function geometryToXmlMesh(positions: Float32Array, pindex: number): string {
  const vertexIds = new Map<string, number>();
  const vertexStrings: string[] = [];
  const triangleStrings: string[] = [];
  const totalVertices = positions.length / 3;
  const totalTriangles = totalVertices / 3;

  const vertexId = (index: number): number => {
    const x = positions[index * 3].toFixed(4);
    const y = positions[index * 3 + 1].toFixed(4);
    const z = positions[index * 3 + 2].toFixed(4);
    const key = `${x}|${y}|${z}`;
    let id = vertexIds.get(key);
    if (id === undefined) {
      id = vertexStrings.length;
      vertexIds.set(key, id);
      vertexStrings.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
    }
    return id;
  };

  for (let t = 0; t < totalTriangles; t++) {
    const v1 = vertexId(t * 3);
    const v2 = vertexId(t * 3 + 1);
    const v3 = vertexId(t * 3 + 2);
    triangleStrings.push(`<triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="${BASE_MATERIALS_ID}" pindex="${pindex}"/>`);
  }

  return `<mesh>\n<vertices>\n${vertexStrings.join('\n')}\n</vertices>\n<triangles>\n${triangleStrings.join('\n')}\n</triangles>\n</mesh>`;
}

/**
 * `model_settings.config` com `extruder` real por peça **e overrides de slicer
 * por objeto** (extensão nova vs. o builder compartilhado).
 */
export function buildThermoformModelSettingsConfig(
  items: Array<{ name: string; objId: number; extruder: number; overrides?: Record<string, string> }>,
  filamentCount: number
): string {
  const objectEntries = items
    .map((item) => {
      const overrideLines = Object.entries(item.overrides ?? {})
        .map(([key, value]) => `    <metadata key="${xmlAttr(key)}" value="${xmlAttr(value)}"/>`)
        .join('\n');
      const overrideBlock = overrideLines ? `\n${overrideLines}` : '';
      return `  <object id="${item.objId}">
    <metadata key="name" value="${xmlAttr(item.name)}"/>
    <metadata key="extruder" value="${item.extruder}"/>${overrideBlock}
    <part id="1" subtype="normal_part">
      <metadata key="name" value="${xmlAttr(item.name)}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
    </part>
  </object>`;
    })
    .join('\n');

  const modelInstances = items
    .map(
      (item, idx) => `    <model_instance>
      <metadata key="object_id" value="${item.objId}"/>
      <metadata key="instance_id" value="${idx}"/>
      <metadata key="identify_id" value="${idx + 1}"/>
    </model_instance>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
${objectEntries}
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value="Plate 1"/>
    <metadata key="locked" value="false"/>
    <metadata key="print_sequence" value="by layer"/>
    <filament_list>
      ${Array.from({ length: filamentCount }, (_, i) => `<metadata key="filament_id" value="${i + 1}"/>`).join('\n      ')}
    </filament_list>
${modelInstances}
  </plate>
</config>`;
}

/**
 * 3MF Bambu-compatível do kit (spec `bambu-3mf-compat`): metadados + `extruder`
 * por peça + overrides por objeto. Cores iguais deduplicam slots de filamento.
 */
export function exportThermoform3MF(items: Thermoform3MFItem[], title: string): Blob {
  // Dedupe de cores → slots de filamento.
  const colorToSlot = new Map<string, number>();
  const filaments: FilamentDefinition[] = [];
  for (const item of items) {
    const color = normalizeColor(item.color);
    if (!colorToSlot.has(color)) {
      colorToSlot.set(color, filaments.length);
      filaments.push({ name: `Filamento ${filaments.length + 1}`, color, type: 'PLA' });
    }
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  const baseMaterialElements = filaments
    .map((f) => `      <base name="${xmlAttr(f.name)}" displaycolor="${normalizeColor(f.color)}" />`)
    .join('\n');

  const safeTitle = xmlAttr(title.replace(/[<>&"]/g, '_'));

  const objectEntries: string[] = [];
  const settingsItems: Array<{ name: string; objId: number; extruder: number; overrides?: Record<string, string> }> = [];
  const buildItems: string[] = [];

  items.forEach((item, idx) => {
    const objId = BASE_MATERIALS_ID + 1 + idx;
    const pindex = colorToSlot.get(normalizeColor(item.color)) ?? 0;
    const positions = concatPositions(item.geoms);
    if (!positions) return;
    const name = `${idx + 1}_${item.name}`;
    objectEntries.push(
      `    <object id="${objId}" type="model" pid="${BASE_MATERIALS_ID}" pindex="${pindex}" name="${xmlAttr(name)}">\n` +
        `      ${geometryToXmlMesh(positions, pindex)}\n` +
        `    </object>`
    );
    settingsItems.push({ name, objId, extruder: pindex + 1, overrides: item.overrides });
    buildItems.push(`    <item objectid="${objId}" />`);
  });

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Application">BambuStudio-02.05.00.66</metadata>
  <metadata name="BambuStudio:3mfVersion">1</metadata>
  <metadata name="Title">${safeTitle}</metadata>
  <resources>
    <basematerials id="${BASE_MATERIALS_ID}">
${baseMaterialElements}
    </basematerials>
${objectEntries.join('\n')}
  </resources>
  <build>
${buildItems.join('\n')}
  </build>
</model>`;

  const modelSettings = buildThermoformModelSettingsConfig(settingsItems, filaments.length);
  const projectSettings = buildProjectSettingsConfig(filaments);

  const zipped = zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypesXml),
      '_rels/.rels': strToU8(relsXml),
      '3D/3dmodel.model': strToU8(modelXml),
      'Metadata/project_settings.config': strToU8(projectSettings),
      'Metadata/model_settings.config': strToU8(modelSettings),
    },
    { level: 6 }
  );

  return new Blob([zipped], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' });
}
