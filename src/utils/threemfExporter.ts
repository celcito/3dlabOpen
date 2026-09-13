import * as THREE from 'three';
import JSZip from 'jszip';

function geometryToXmlMesh(geometry: THREE.BufferGeometry, zOffset: number = 0): string {
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
    const z = (pos.getZ(i) + zOffset).toFixed(4);
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

export async function exportToMulticolor3MF(
  backGeom: THREE.BufferGeometry,
  midGeom: THREE.BufferGeometry,
  frontGeom: THREE.BufferGeometry,
  backColorHex: string,
  midColorHex: string,
  frontColorHex: string,
  backDepth: number,
  midThickness: number,
  modelName: string = 'Letra_Caixa_3D'
): Promise<Blob> {
  const zip = new JSZip();

  const cleanColor1 = (backColorHex.startsWith('#') ? backColorHex : `#${backColorHex}`) + 'FF';
  const cleanColor2 = (midColorHex.startsWith('#') ? midColorHex : `#${midColorHex}`) + 'FF';
  const cleanColor3 = (frontColorHex.startsWith('#') ? frontColorHex : `#${frontColorHex}`) + 'FF';

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

  const backMeshXml = geometryToXmlMesh(backGeom, 0);
  const midMeshXml = geometryToXmlMesh(midGeom, backDepth);
  const frontMeshXml = geometryToXmlMesh(frontGeom, backDepth + midThickness);

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Title">${modelName}</metadata>
  <metadata name="Application">Workbench Studio - Letra Caixa 3D Paramétrico</metadata>
  <resources>
    <m:colorgroup id="1">
      <m:color color="${cleanColor1}"/>
      <m:color color="${cleanColor2}"/>
      <m:color color="${cleanColor3}"/>
    </m:colorgroup>
    <object id="2" type="model" pid="1" pindex="0" name="1_Camada_Traseira_Caixa">
      ${backMeshXml}
    </object>
    <object id="3" type="model" pid="1" pindex="1" name="2_Camada_Intermediaria">
      ${midMeshXml}
    </object>
    <object id="4" type="model" pid="1" pindex="2" name="3_Texto_Frontal">
      ${frontMeshXml}
    </object>
  </resources>
  <build>
    <item objectid="2"/>
    <item objectid="3"/>
    <item objectid="4"/>
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