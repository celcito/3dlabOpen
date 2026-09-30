import * as THREE from 'three';
import JSZip from 'jszip';

function geometryToXmlMesh(geometry: THREE.BufferGeometry): string {
  let nonIndexed = geometry;
  if (geometry.index) {
    nonIndexed = geometry.toNonIndexed();
  }

  const pos = nonIndexed.attributes.position;
  if (!pos || pos.count === 0) {
    return '<mesh><vertices></vertices><triangles></triangles></mesh>';
  }

  const vertexStrings: string[] = [];
  const triangleStrings: string[] = [];
  const totalTriangles = pos.count / 3;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i).toFixed(4);
    const y = pos.getY(i).toFixed(4);
    const z = pos.getZ(i).toFixed(4);
    vertexStrings.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
  }

  for (let t = 0; t < totalTriangles; t++) {
    const v1 = t * 3;
    const v2 = t * 3 + 1;
    const v3 = t * 3 + 2;
    triangleStrings.push(`<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`);
  }

  return `<mesh>\n<vertices>\n${vertexStrings.join('\n')}\n</vertices>\n<triangles>\n${triangleStrings.join('\n')}\n</triangles>\n</mesh>`;
}

export interface ThreeMFMeta {
  application?: string;
  baseObjectName?: string;
  reliefObjectName?: string;
}

const DEFAULT_APPLICATION = '3D Lab Open Ponteira de Lapis 3D Parametrico';
const DEFAULT_BASE_OBJECT_NAME = '1_Corpo_da_Base';
const DEFAULT_RELIEF_OBJECT_NAME = '2_Letras_em_Relevo';

export async function exportPencilTopper3MF(
  baseGeom: THREE.BufferGeometry,
  reliefGeom: THREE.BufferGeometry,
  baseColorHex: string,
  reliefColorHex: string,
  modelName: string = 'Ponteira_Lapis_3D',
  meta?: ThreeMFMeta
): Promise<Blob> {
  const application = meta?.application ?? DEFAULT_APPLICATION;
  const baseObjectName = meta?.baseObjectName ?? DEFAULT_BASE_OBJECT_NAME;
  const reliefObjectName = meta?.reliefObjectName ?? DEFAULT_RELIEF_OBJECT_NAME;
  const zip = new JSZip();

  const cleanColor1 = (baseColorHex.startsWith('#') ? baseColorHex : `#${baseColorHex}`) + 'FF';
  const cleanColor2 = (reliefColorHex.startsWith('#') ? reliefColorHex : `#${reliefColorHex}`) + 'FF';

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  zip.file('[Content_Types].xml', contentTypesXml);

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  zip.folder('_rels')?.file('.rels', relsXml);

  const baseMeshXml = geometryToXmlMesh(baseGeom);
  const reliefMeshXml = geometryToXmlMesh(reliefGeom);

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Title">${modelName}</metadata>
  <metadata name="Application">${application}</metadata>
  <resources>
    <m:colorgroup id="1">
      <m:color color="${cleanColor1}"/>
      <m:color color="${cleanColor2}"/>
    </m:colorgroup>
    <object id="2" type="model" pid="1" pindex="0" name="${baseObjectName}">
      ${baseMeshXml}
    </object>
    <object id="3" type="model" pid="1" pindex="1" name="${reliefObjectName}">
      ${reliefMeshXml}
    </object>
  </resources>
  <build>
    <item objectid="2"/>
    <item objectid="3"/>
  </build>
</model>`;

  zip.folder('3D')?.file('3dmodel.model', modelXml);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
