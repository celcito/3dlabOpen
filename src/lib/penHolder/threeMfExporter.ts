import * as THREE from 'three';
import { zipSync, strToU8 } from 'fflate';
import {
  buildProjectSettingsConfig,
  normalizeColor,
  type FilamentDefinition,
} from '../threeMfExporter';

const BASE_MATERIALS_ID = 1;
const CORPO_NAME = '1_Porta_Canetas_Nome';
const RIM_NAME = '2_Aro_Colorido';

function xmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function geometryToXmlMesh(geometry: THREE.BufferGeometry, pindex: number): string {
  let nonIndexed = geometry;
  if (geometry.index) {
    nonIndexed = geometry.toNonIndexed();
  }

  const pos = nonIndexed.attributes.position;
  if (!pos || pos.count === 0) {
    return '<mesh>\n<vertices>\n</vertices>\n<triangles>\n</triangles>\n</mesh>';
  }

  const vertexIds = new Map<string, number>();
  const vertexStrings: string[] = [];
  const triangleStrings: string[] = [];
  const totalTriangles = pos.count / 3;

  const vertexId = (index: number): number => {
    const x = pos.getX(index).toFixed(4);
    const y = pos.getY(index).toFixed(4);
    const z = pos.getZ(index).toFixed(4);
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

function buildModelSettingsConfig(
  items: Array<{ name: string; objId: number; extruder: number }>,
  filamentCount: number
): string {
  const objectEntries = items
    .map(
      (item) => `  <object id="${item.objId}">
    <metadata key="name" value="${xmlAttr(item.name)}"/>
    <metadata key="extruder" value="${item.extruder}"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="${xmlAttr(item.name)}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
    </part>
  </object>`
    )
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

export function exportPenHolder3MF(
  corpo: THREE.BufferGeometry,
  rim: THREE.BufferGeometry,
  baseColor: string,
  rimColor: string,
  title: string
): Blob {
  const filaments: FilamentDefinition[] = [
    { name: 'Filamento 1', color: baseColor, type: 'PLA' },
    { name: 'Filamento 2', color: rimColor, type: 'PLA' },
  ];

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

  const corpoObjId = BASE_MATERIALS_ID + 1;
  const rimObjId = BASE_MATERIALS_ID + 2;
  const safeTitle = xmlAttr(title.replace(/[<>&"]/g, '_'));

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Application">BambuStudio-02.05.00.66</metadata>
  <metadata name="BambuStudio:3mfVersion">1</metadata>
  <metadata name="Title">${safeTitle}</metadata>
  <resources>
    <basematerials id="${BASE_MATERIALS_ID}">
${baseMaterialElements}
    </basematerials>
    <object id="${corpoObjId}" type="model" pid="${BASE_MATERIALS_ID}" pindex="0" name="${CORPO_NAME}">
      ${geometryToXmlMesh(corpo, 0)}
    </object>
    <object id="${rimObjId}" type="model" pid="${BASE_MATERIALS_ID}" pindex="1" name="${RIM_NAME}">
      ${geometryToXmlMesh(rim, 1)}
    </object>
  </resources>
  <build>
    <item objectid="${corpoObjId}" />
    <item objectid="${rimObjId}" />
  </build>
</model>`;

  const modelSettings = buildModelSettingsConfig(
    [
      { name: CORPO_NAME, objId: corpoObjId, extruder: 1 },
      { name: RIM_NAME, objId: rimObjId, extruder: 2 },
    ],
    filaments.length
  );

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
