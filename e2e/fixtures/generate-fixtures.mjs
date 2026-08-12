import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    result = null;
    onloadend = null;
    readAsArrayBuffer(blob) {
      Promise.resolve(blob.arrayBuffer ? blob.arrayBuffer() : blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength)).then((ab) => {
        this.result = ab;
        if (this.onloadend) this.onloadend({});
      });
    }
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const CUBE_TWO_COLORS = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">
      <base name="Ciano" displaycolor="#00E5FF" />
      <base name="Vermelho" displaycolor="#FF1744" />
    </basematerials>
    <object id="10" name="Cube">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0" pid="1" pindex="0" />
          <vertex x="10" y="0" z="0" pid="1" pindex="0" />
          <vertex x="10" y="10" z="0" pid="1" pindex="0" />
          <vertex x="0" y="10" z="0" pid="1" pindex="0" />
          <vertex x="0" y="0" z="10" pid="1" pindex="1" />
          <vertex x="10" y="0" z="10" pid="1" pindex="1" />
          <vertex x="10" y="10" z="10" pid="1" pindex="1" />
          <vertex x="0" y="10" z="10" pid="1" pindex="1" />
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2" />
          <triangle v1="0" v2="2" v3="3" />
          <triangle v1="4" v2="5" v3="6" />
          <triangle v1="4" v2="6" v3="7" />
          <triangle v1="0" v2="4" v3="7" />
          <triangle v1="0" v2="7" v3="3" />
          <triangle v1="1" v2="5" v3="6" />
          <triangle v1="1" v2="6" v3="2" />
          <triangle v1="3" v2="7" v3="6" />
          <triangle v1="3" v2="6" v3="2" />
          <triangle v1="0" v2="1" v3="5" />
          <triangle v1="0" v2="5" v3="4" />
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="10" />
  </build>
</model>`;

async function build3mf(modelXml) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  zip.file("3D/3dmodel.model", modelXml);
  return zip.generateAsync({ type: "nodebuffer" });
}

const PLAIN_CUBE_OBJ = `# simple cube, no groups
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
v 0 0 1
v 1 0 1
v 1 1 1
v 0 1 1
f 1 2 3
f 1 3 4
f 5 6 7
f 5 7 8
f 1 5 8
f 1 8 4
f 2 6 7
f 2 7 3
f 4 8 7
f 4 7 3
f 1 2 6
f 1 6 5
`;

function buildGlb() {
  return new Promise((resolve, reject) => {
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = i % 2 === 0 ? 1 : 0;
      colors[i * 3] = r;
      colors[i * 3 + 1] = 0.7;
      colors[i * 3 + 2] = 1 - r;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "MultiCube";
    const exporter = new GLTFExporter();
    exporter.parse(
      mesh,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(Buffer.from(result));
        else if (ArrayBuffer.isView(result)) resolve(Buffer.from(result.buffer, result.byteOffset, result.byteLength));
        else resolve(Buffer.from(JSON.stringify(result)));
      },
      (err) => reject(err),
      { binary: true }
    );
  });
}

const out3mf = await build3mf(CUBE_TWO_COLORS);
writeFileSync(join(__dirname, "painted-cube.3mf"), out3mf);

writeFileSync(join(__dirname, "plain-cube.obj"), PLAIN_CUBE_OBJ);

const glb = await buildGlb();
writeFileSync(join(__dirname, "colored-cube.glb"), glb);

console.log("fixtures written:", out3mf.length, "3mf bytes;", PLAIN_CUBE_OBJ.length, "obj bytes;", glb.length, "glb bytes");