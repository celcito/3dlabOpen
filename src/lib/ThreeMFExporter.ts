import * as THREE from "three";
import JSZip from "jszip";

export class ThreeMFExporter {
  parse(
    geometry: THREE.BufferGeometry,
    vertexGroups: Uint8Array,
    groups: { id: number; color: string; name: string }[]
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const zip = new JSZip();
        const posAttr = geometry.attributes.position;
        const indexAttr = geometry.index;
        if (!posAttr || !indexAttr) {
          reject(new Error("Geometry must be indexed with position attribute"));
          return;
        }

        const groupTriangles: Map<number, number[]> = new Map();
        const allVerts: Map<string, number> = new Map();
        const vertCoords: number[] = [];
        const groupColors: Map<number, string> = new Map();

        groups.forEach((g) => {
          groupTriangles.set(g.id, []);
          groupColors.set(g.id, g.color);
        });
        // Also handle group 0 (unpainted)
        if (!groupTriangles.has(0)) groupTriangles.set(0, []);
        groupColors.set(0, "#e0e0e0");

        const idx = indexAttr.array;
        for (let i = 0; i < idx.length; i += 3) {
          const i0 = idx[i], i1 = idx[i + 1], i2 = idx[i + 2];
          const g0 = vertexGroups[i0] || 0;
          const g1 = vertexGroups[i1] || 0;
          const g2 = vertexGroups[i2] || 0;
          const g = g0 || g1 || g2;

          const triangles = groupTriangles.get(g) || groupTriangles.get(0)!;

          const addVert = (vi: number) => {
            const key = `${vi}`;
            if (!allVerts.has(key)) {
              allVerts.set(key, vertCoords.length / 3);
              vertCoords.push(
                parseFloat(posAttr.getX(vi).toFixed(6)),
                parseFloat(posAttr.getY(vi).toFixed(6)),
                parseFloat(posAttr.getZ(vi).toFixed(6))
              );
            }
            triangles.push(allVerts.get(key)!);
          };
          addVert(i0); addVert(i1); addVert(i2);
        }

        let meshResources = "";
        let meshCount = 0;
        const resourceIds: number[] = [];

        groupTriangles.forEach((tris, gId) => {
          if (tris.length === 0) return;
          meshCount++;
          const objId = meshCount;
          resourceIds.push(objId);
          const colorHex = groupColors.get(gId) || "#888888";

          meshResources += `
    <object id="${objId}" type="model">
      <mesh>
        <vertices>`;
          const localVerts = new Map<number, number>();
          let localIdx = 0;
          tris.forEach((vi) => {
            if (!localVerts.has(vi)) {
              localVerts.set(vi, localIdx++);
              const x = vertCoords[vi * 3];
              const y = vertCoords[vi * 3 + 1];
              const z = vertCoords[vi * 3 + 2];
              meshResources += `
          <vertex x="${x}" y="${y}" z="${z}" />`;
            }
          });
          meshResources += `
        </vertices>
        <triangles>`;
          for (let t = 0; t < tris.length; t += 3) {
            const a = localVerts.get(tris[t])!;
            const b = localVerts.get(tris[t + 1])!;
            const c = localVerts.get(tris[t + 2])!;
            meshResources += `
          <triangle v1="${a}" v2="${b}" v3="${c}" />`;
          }
          meshResources += `
        </triangles>
      </mesh>
      <components>`;
          const colorObjId = meshCount + 100;
          meshResources += `
        <component objectid="${colorObjId}" />`;
          meshResources += `
      </components>
    </object>`;

          // Color resource
          meshResources += `
    <object id="${colorObjId}" type="color">
      <color color="${colorHex}" />
    </object>`;
        });

        const now = new Date().toISOString().replace(/[:\-]/g, "").slice(0, 15);

        const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Application">Vértice Studio 3D Print Painter</metadata>
  <metadata name="ModificationDate">${now}</metadata>
  <resources>
    ${meshResources}
  </resources>
  <build>
    ${resourceIds.map((id) => `
    <item objectid="${id}" />`).join("")}
  </build>
</model>`;

        const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`;

        const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;

        zip.file("[Content_Types].xml", contentTypesXml);
        zip.file("_rels/.rels", relsXml);
        zip.file("3D/3dmodel.model", modelXml);

        zip.generateAsync({ type: "blob" }).then(resolve);
      } catch (err) {
        reject(err);
      }
    });
  }
}
