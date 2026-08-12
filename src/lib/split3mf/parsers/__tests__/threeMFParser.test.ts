import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parseThreeMF } from "../threeMFParser";

async function build3mf(modelXml: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  zip.file("3D/3dmodel.model", modelXml);
  return zip.generateAsync({ type: "arraybuffer" });
}

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

const MODEL_WITH_TRANSFORM = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="7">
      <base name="Verde" displaycolor="#00FF41" />
    </basematerials>
    <object id="2" name="Squashed">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0" pid="7" pindex="0" />
          <vertex x="2" y="0" z="0" pid="7" pindex="0" />
          <vertex x="2" y="2" z="0" pid="7" pindex="0" />
          <vertex x="0" y="2" z="0" pid="7" pindex="0" />
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2" />
          <triangle v1="0" v2="2" v3="3" />
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="2" transform="2 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1" />
  </build>
</model>`;

describe("parseThreeMF", () => {
  it("extracts regionMask from basematerials pid/pindex", async () => {
    const buf = await build3mf(CUBE_TWO_COLORS);
    const parsed = await parseThreeMF(buf);
    expect(parsed.geometry.attributes.position.count).toBe(8);
    expect(parsed.regionMask).toBeDefined();
    const mask = parsed.regionMask!;
    // Vertices 0-3 (bottom, color 0) share one region; 4-7 (top, color 1) another.
    const bottom = new Set([mask[0], mask[1], mask[2], mask[3]]);
    const top = new Set([mask[4], mask[5], mask[6], mask[7]]);
    expect(bottom.size).toBe(1);
    expect(top.size).toBe(1);
    expect(bottom.values().next().value).not.toBe(top.values().next().value);
  });

  it("applies build-item transform", async () => {
    const buf = await build3mf(MODEL_WITH_TRANSFORM);
    const parsed = await parseThreeMF(buf);
    const pos = parsed.geometry.attributes.position;
    const xs = new Set<number>();
    for (let i = 0; i < pos.count; i++) xs.add(Math.round(pos.getX(i)));
    const ys = new Set<number>();
    for (let i = 0; i < pos.count; i++) ys.add(Math.round(pos.getY(i)));
    // Original square spans X∈[0,2] (scaled ×2 → [0,4]) and Y∈[0,2].
    // After `.center()` the shape is symmetric about the origin:
    expect(Math.max(...xs) - Math.min(...xs)).toBe(4); // X doubled by transform
    expect(Math.max(...ys) - Math.min(...ys)).toBe(2); // Y untouched
  });

  it("produces suggested colors in material order", async () => {
    const buf = await build3mf(CUBE_TWO_COLORS);
    const parsed = await parseThreeMF(buf);
    const lower = parsed.suggestedColors.map((c) => c.toLowerCase());
    expect(lower).toContain("#00e5ff");
    expect(lower).toContain("#ff1744");
  });

  it("throws on non-3MF zip", async () => {
    const zip = new JSZip();
    zip.file("foo.txt", "hello");
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(parseThreeMF(buf)).rejects.toThrow(/missing 3D\/3dmodel/);
  });

  it("handles model with no basematerials (regionMask absent)", async () => {
    const model = `<?xml version="1.0"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1"><mesh>
      <vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices>
      <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
    </mesh></object>
  </resources>
  <build><item objectid="1"/></build>
</model>`;
    const buf = await build3mf(model);
    const parsed = await parseThreeMF(buf);
    expect(parsed.regionMask).toBeUndefined();
    expect(parsed.geometry.attributes.position.count).toBe(3);
  });

  it("honors triangle-level pid for per-face regions", async () => {
    const model = `<?xml version="1.0"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="3">
      <base name="A" displaycolor="#FF0000" />
      <base name="B" displaycolor="#00FF00" />
    </basematerials>
    <object id="1"><mesh>
      <vertices>
        <vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/>
        <vertex x="0" y="0" z="1"/><vertex x="1" y="0" z="1"/><vertex x="0" y="1" z="1"/>
      </vertices>
      <triangles>
        <triangle v1="0" v2="1" v3="2" pid="3" pindex="0" />
        <triangle v1="3" v2="4" v3="5" pid="3" pindex="1" />
      </triangles>
    </mesh></object>
  </resources>
  <build><item objectid="1"/></build>
</model>`;
    const buf = await build3mf(model);
    const parsed = await parseThreeMF(buf);
    const mask = parsed.regionMask!;
    expect(mask[0]).toBe(mask[1]);
    expect(mask[0]).toBe(mask[2]);
    expect(mask[3]).toBe(mask[4]);
    expect(mask[3]).toBe(mask[5]);
    expect(mask[0]).not.toBe(mask[3]);
  });
});