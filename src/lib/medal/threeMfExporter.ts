import * as THREE from 'three';
import { zipSync, strToU8 } from 'fflate';

function geometryToXmlMesh(geometry: THREE.BufferGeometry): string {
  let nonIndexed = geometry;
  if (geometry.index) {
    nonIndexed = geometry.toNonIndexed();
  }

  const pos = nonIndexed.attributes.position;
  if (!pos || pos.count === 0) {
    return '<mesh><vertices></vertices><triangles></triangles></mesh>';
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
    triangleStrings.push(`<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`);
  }

  return `<mesh>\n<vertices>\n${vertexStrings.join('\n')}\n</vertices>\n<triangles>\n${triangleStrings.join('\n')}\n</triangles>\n</mesh>`;
}

export interface Medal3MFItem {
  geom: THREE.BufferGeometry;
  color: string;
  name: string;
}

const DEFAULT_APPLICATION = '3D Lab Open Medalhas 3D Parametrico';

function cleanColor(hex: string): string {
  return (hex.startsWith('#') ? hex : `#${hex}`) + 'FF';
}

export async function exportMedal3MF(items: Medal3MFItem[], modelName = 'Medalha_3D'): Promise<Blob> {
  const safeItems = items.filter((item) => item && item.geom);

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  const colorXml = safeItems.map((item) => `      <m:color color="${cleanColor(item.color)}"/>`).join('\n');
  const objectXml = safeItems
    .map(
      (item, index) =>
        `    <object id="${index + 2}" type="model" pid="1" pindex="${index}" name="${item.name}">\n      ${geometryToXmlMesh(
          item.geom
        )}\n    </object>`
    )
    .join('\n');
  const buildXml = safeItems.map((_, index) => `    <item objectid="${index + 2}"/>`).join('\n');

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Title">${modelName}</metadata>
  <metadata name="Application">${DEFAULT_APPLICATION}</metadata>
  <resources>
    <m:colorgroup id="1">
${colorXml}
    </m:colorgroup>
${objectXml}
  </resources>
  <build>
${buildXml}
  </build>
</model>`;

  const zipped = zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypesXml),
      '_rels/.rels': strToU8(relsXml),
      '3D/3dmodel.model': strToU8(modelXml),
    },
    { level: 6 }
  );

  return new Blob([zipped], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' });
}
