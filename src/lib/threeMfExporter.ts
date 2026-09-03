/**
 * 3MF (3D Manufacturing Format) Exporter with Multi-Color & Multi-Filament Support
 * Compatible with Bambu Studio, OrcaSlicer, PrusaSlicer, Creality Print, and Cura.
 */
import JSZip from "jszip";
import * as THREE from "three";

export interface FilamentDefinition {
  name: string;
  color: string; // Hex format: #RRGGBB or #RRGGBBAA
  type?: string; // PLA, PETG, TPU, etc.
}

export interface ThreeMfMeshItem {
  geometry: THREE.BufferGeometry;
  name: string;
  filamentIndex: number; // Index in the filaments array (0-based)
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export interface ThreeMfExportOptions {
  title?: string;
  designer?: string;
  filaments: FilamentDefinition[];
  items: ThreeMfMeshItem[];
  unit?: "millimeter" | "inch";
}

/**
 * Format hex color to 3MF required uppercase `#RRGGBB` or `#RRGGBBAA`
 */
function normalizeColor(hex: string): string {
  let clean = hex.trim().replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map(c => c + c).join("");
  }
  if (clean.length === 6) {
    return `#${clean.toUpperCase()}`;
  }
  if (clean.length === 8) {
    return `#${clean.toUpperCase()}`;
  }
  return "#00E5FF";
}

/**
 * Converts THREE.BufferGeometry into 3MF mesh XML string
 */
function geometryTo3MfMesh(
  geometry: THREE.BufferGeometry,
  defaultColorIndex: number,
  colorgroupId: number = 1
): { verticesXml: string; trianglesXml: string } {
  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geom.computeVertexNormals();

  const posAttr = geom.getAttribute("position");
  if (!posAttr) {
    return { verticesXml: "", trianglesXml: "" };
  }

  // We can de-duplicate vertices for cleaner and smaller 3MF file
  const vertices: string[] = [];
  const vertexMap = new Map<string, number>();
  const triangleIndices: number[] = [];

  const precision = 4;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    // Format coordinates
    const key = `${x.toFixed(precision)}_${y.toFixed(precision)}_${z.toFixed(precision)}`;
    let vIdx = vertexMap.get(key);
    if (vIdx === undefined) {
      vIdx = vertices.length;
      vertexMap.set(key, vIdx);
      vertices.push(`<vertex x="${x.toFixed(precision)}" y="${y.toFixed(precision)}" z="${z.toFixed(precision)}" />`);
    }
    triangleIndices.push(vIdx);
  }

  const triangles: string[] = [];
  const p1Attr = defaultColorIndex;

  for (let i = 0; i < triangleIndices.length; i += 3) {
    const v1 = triangleIndices[i];
    const v2 = triangleIndices[i + 1];
    const v3 = triangleIndices[i + 2];

    // Ensure non-degenerate triangle
    if (v1 !== v2 && v2 !== v3 && v1 !== v3) {
      triangles.push(
        `<triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="${colorgroupId}" p1="${p1Attr}" />`
      );
    }
  }

  return {
    verticesXml: vertices.join("\n        "),
    trianglesXml: triangles.join("\n        ")
  };
}

/**
 * Builds and packages a valid .3MF zip archive with full multi-color metadata
 * Compatible with Bambu Studio, OrcaSlicer, PrusaSlicer
 */
export async function generate3MfBlob(options: ThreeMfExportOptions): Promise<Blob> {
  const zip = new JSZip();
  const title = options.title || "Puzzle 3D Multi-Color";
  const filaments = options.filaments && options.filaments.length > 0
    ? options.filaments
    : [{ name: "Filamento 1", color: "#00E5FF" }];
  const unit = options.unit || "millimeter";

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  zip.file("[Content_Types].xml", contentTypesXml);

  // 2. _rels/.rels
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  zip.file("_rels/.rels", relsXml);

  // 3. 3D/3dmodel.model
  // Base materials for slicer (must come first in resources for Bambu Studio)
  const baseMaterialElements = filaments.map(f => 
    `      <base name="${f.name.replace(/"/g, "'")}" displaycolor="${normalizeColor(f.color)}" />`
  ).join("\n");

  const objectsXmlList: string[] = [];
  const buildItemsList: string = [];

  // Object IDs start at 1 (required by Bambu Studio)
  let nextObjectId = 1;
  const basematerialsId = 1;

  options.items.forEach((item, idx) => {
    const objId = nextObjectId++;
    const safeName = (item.name || `Object_${idx + 1}`).replace(/[<>&"]/g, "_");
    const filIdx = Math.max(0, Math.min(item.filamentIndex ?? 0, filaments.length - 1));

    const { verticesXml, trianglesXml } = geometryTo3MfMesh(item.geometry, filIdx, basematerialsId);

    // Each object references basematerials with pid and pindex
    const objXml = `    <object id="${objId}" name="${safeName}" type="model" pid="${basematerialsId}" pindex="${filIdx}">
      <mesh>
        <vertices>
        ${verticesXml}
        </vertices>
        <triangles>
        ${trianglesXml}
        </triangles>
      </mesh>
    </object>`;

    objectsXmlList.push(objXml);

    // Build item with transform if needed
    let transformAttr = "";
    if (item.position || item.rotation) {
      const pos = item.position || [0, 0, 0];
      transformAttr = ` transform="1 0 0 0 1 0 0 0 1 ${pos[0]} ${pos[1]} ${pos[2]}"`;
    }

    buildItemsList.push(`    <item objectid="${objId}"${transformAttr} />`);
  });

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="${unit}" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Application">Puzzle Studio 3D</metadata>
  <metadata name="Title">${title.replace(/[<>&"]/g, "_")}</metadata>
  <metadata name="Designer">${(options.designer || "Vértice Studio").replace(/[<>&"]/g, "_")}</metadata>
  <resources>
    <basematerials id="${basematerialsId}">
${baseMaterialElements}
    </basematerials>
${objectsXmlList.join("\n")}
  </resources>
  <build>
${buildItemsList}
  </build>
</model>`;

  zip.file("3D/3dmodel.model", modelXml);

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
}
