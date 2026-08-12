import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { isZipMagic, isGlbMagic, parseSplitFile, detectExtension } from "../index";

const MINIMAL_3MF_MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">
      <base name="Azul" displaycolor="#2979FF" />
    </basematerials>
    <object id="10" name="Cube">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0" pid="1" pindex="0" />
          <vertex x="10" y="0" z="0" pid="1" pindex="0" />
          <vertex x="10" y="10" z="0" pid="1" pindex="0" />
          <vertex x="0" y="10" z="0" pid="1" pindex="0" />
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2" />
          <triangle v1="0" v2="2" v3="3" />
        </triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="10" /></build>
</model>`;

async function build3mf(modelXml: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("3D/3dmodel.model", modelXml);
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("parsers/index dispatcher", () => {
  it("detects extension from filename", () => {
    expect(detectExtension("model.3MF")).toBe("3mf");
    expect(detectExtension("model.glb")).toBe("glb");
    expect(detectExtension("model.obj")).toBe("obj");
    expect(detectExtension("model.stl")).toBe("stl");
    expect(detectExtension("noext")).toBe("noext");
  });

  it("sniffs 3MF via ZIP magic even with no extension", async () => {
    const buf = await build3mf(MINIMAL_3MF_MODEL);
    const file = new File([buf], "mystery-model");
    const parsed = await parseSplitFile(file);
    expect(parsed.regionMask).toBeDefined();
  });

  it("recognizes ZIP magic bytes (3MF)", async () => {
    const buf = await build3mf(MINIMAL_3MF_MODEL);
    expect(isZipMagic(buf)).toBe(true);
  });

  it("recognizes GLB magic bytes", () => {
    const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00]);
    expect(isGlbMagic(glb.buffer)).toBe(true);
  });

  it("parses a 3MF File end-to-end (regionMask created)", async () => {
    const buf = await build3mf(MINIMAL_3MF_MODEL);
    const file = new File([buf], "model.3mf", { type: "application/vnd.ms-package.3dmanufacturing-3dmodel+xml" });
    const parsed = await parseSplitFile(file);
    expect(parsed.geometry.attributes.position.count).toBe(4);
    expect(parsed.regionMask).toBeDefined();
    expect(parsed.regionMask![0]).toBeGreaterThan(0);
    expect(parsed.fileName).toBe("model.3mf");
  });

  it("parses an OBJ File without extension detection issues", async () => {
    const obj = "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n";
    const file = new File([new TextEncoder().encode(obj)], "model.obj");
    const parsed = await parseSplitFile(file);
    expect(parsed.geometry.attributes.position.count).toBe(3);
  });

  it("rejects unsupported extensions", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "model.stl");
    await expect(parseSplitFile(file)).rejects.toThrow(/Unsupported format/);
  });

  it("rejects files over the hard cap", async () => {
    const big = new Uint8Array(201 * 1024 * 1024);
    const file = new File([big], "huge.3mf");
    await expect(parseSplitFile(file)).rejects.toThrow(/too large/i);
  });
});