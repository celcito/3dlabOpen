import { describe, it, expect } from "vitest";
import * as THREE from "three";
import JSZip from "jszip";
import { parseSplitFile } from "../../parsers";
import { arrangePiecesOnPlate, exportSplit, splitPieces } from "../index";
import { parseThreeMF } from "../../parsers/threeMFParser";
import { parseGLB } from "../../parsers/glbParser";
import { parseOBJ } from "../../parsers/objParser";
import { buildObjAndMtl } from "../objExporter";
import type { SplitState, RegionId } from "../../state/splitTypes";

async function build3mfBytes(modelXml: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("3D/3dmodel.model", modelXml);
  return zip.generateAsync({ type: "arraybuffer" });
}

const TWO_REGION_CUBE = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">
      <base name="Azul" displaycolor="#2979FF" />
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

async function stateFrom3mf(): Promise<{ state: SplitState }> {
  const buf = await build3mfBytes(TWO_REGION_CUBE);
  const file = new File([buf], "model.3mf");
  const parsed = await parseSplitFile(file);

  // Two distinct regions as detected from the mask.
  const mask = parsed.regionMask!;
  const ids = Array.from(new Set(Array.from(mask).filter((v) => v !== 0))) as RegionId[];
  const low = parsed.suggestedColors ?? ["#2979FF", "#FF1744"];
  const regions = ids.map((id, i) => ({
    id,
    color: low[i % low.length],
    name: `Regiao_${id}`,
    vertexCount: 0,
    boundaryEdges: 0,
  }));

  const geo = parsed.geometry;
  const state: SplitState = {
    geometry: {
      positions: geo.attributes.position.array as Float32Array,
      indices: geo.index ? (geo.index.array as Uint32Array | Uint16Array | Uint8Array) : undefined,
    },
    regions,
    regionMask: mask,
    capConfig: { method: "soap_film", thickness: 0.4, resolution: 32 },
    connectorConfig: { type: "cylinder", side: "part_plug", areaPercent: 5, socketToleranceMm: 0.2, depthMm: 4, position: "auto" },
    boundary: { smoothness: 20, brushRadius: 4, activeRegionId: 1 },
    history: [],
  };
  return { state };
}

describe("F6 — roundtrip export/parse", () => {
  it("3mf → export 3mf → parse: two pieces with colors", async () => {
    const { state } = await stateFrom3mf();
    const blob = await exportSplit(state, { format: "3mf", includeConnectors: false, capPieces: false, filename: "roundtrip" });
    const buf = await blob.arrayBuffer();
    const reparsed = await parseThreeMF(buf);
    expect(reparsed.geometry.index!.count / 3).toBeGreaterThan(0);
    // Multi-object: exported model must contain one color resource per piece.
    const zip = await JSZip.loadAsync(buf);
    const modelXml = await zip.file("3D/3dmodel.model")!.async("string");
    const colorObjects = modelXml.match(/<object id="\d+" type="color">/g) ?? [];
    expect(colorObjects.length).toBe(2);
  });

  it("glb → export glb → parse: vertex colors preserved", async () => {
    const { state } = await stateFrom3mf();
    const blob = await exportSplit(state, { format: "glb", includeConnectors: false, capPieces: false, filename: "roundtrip" });
    const buf = await blob.arrayBuffer();
    const re = await parseGLB(buf);
    expect(re.geometry.attributes.position.count).toBeGreaterThan(0);
    expect(re.suggestedColors?.length).toBeGreaterThan(0);
  });

  it("obj → export obj (zip) → parse: group regions roundtrip", async () => {
    const { state } = await stateFrom3mf();
    const blob = await exportSplit(state, { format: "obj", includeConnectors: false, capPieces: false, filename: "r" });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const objText = await zip.file("r.obj")!.async("string");
    const re = await parseOBJ(objText);
    expect(re.regionMask).toBeDefined();
    expect(re.geometry.index!.count / 3).toBeGreaterThan(0);
  });

  it("obj builder produces paired mtl with a Kd per piece", () => {
    const g1 = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    const g2 = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    const { obj, mtl } = buildObjAndMtl([
      { geometry: g1, regionId: 1, color: "#FF0000", name: "A" },
      { geometry: g2, regionId: 2, color: "#00FF00", name: "B" },
    ]);
    expect(obj).toContain("usemtl piece_0");
    expect(obj).toContain("usemtl piece_1");
    expect(mtl).toContain("newmtl piece_0");
    expect(mtl).toContain("0.000000 1.000000 0.000000");
  });

  it("stl exporter writes valid binary header + triangle count", async () => {
    const { state } = await stateFrom3mf();
    const blob = await exportSplit(state, { format: "stl", includeConnectors: false, capPieces: false, filename: "r" });
    const buf = await blob.arrayBuffer();
    const dv = new DataView(buf);
    const triCount = dv.getUint32(80, true);
    expect(buf.byteLength).toBe(84 + triCount * 50);
    expect(triCount).toBeGreaterThan(0);
    const header = new TextDecoder().decode(new Uint8Array(buf, 0, 80));
    expect(header.startsWith("split3mf:")).toBe(true);
  });

  it("capPieces adds geometry (caps open boundaries)", async () => {
    const { state } = await stateFrom3mf();
    const pieces = splitPieces(state);
    const baseTris = pieces[0].geometry.index!.count / 3;
    const blob = await exportSplit(state, { format: "stl", includeConnectors: false, capPieces: true, filename: "r" });
    const buf = await blob.arrayBuffer();
    const dv = new DataView(buf);
    const triCount = dv.getUint32(80, true);
    expect(triCount).toBeGreaterThan(baseTris);
  });

  it("includeConnectors fuses plugs into pieces", async () => {
    const { state } = await stateFrom3mf();
    const plain = await exportSplit(state, { format: "stl", includeConnectors: false, capPieces: false, filename: "a" });
    const fused = await exportSplit(state, { format: "stl", includeConnectors: true, capPieces: false, filename: "b" });
    const d1 = new DataView(await plain.arrayBuffer());
    const d2 = new DataView(await fused.arrayBuffer());
    const t1 = d1.getUint32(80, true);
    const t2 = d2.getUint32(80, true);
    expect(t2).toBeGreaterThan(t1);
  });
});

describe("splitPieces", () => {
  it("arranges pieces apart for a 3MF print plate", () => {
    const makePiece = (regionId: number) => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      return { geometry, regionId, color: "#fff", name: `piece-${regionId}` };
    };
    const arranged = arrangePiecesOnPlate([makePiece(1), makePiece(2)], "3mf");
    const centers = arranged.map((piece) => piece.geometry.boundingBox?.getCenter(new THREE.Vector3()).x ?? 0);

    expect(Math.abs(centers[0] - centers[1])).toBeGreaterThan(2);
  });

  it("produces one piece per region", async () => {
    const { state } = await stateFrom3mf();
    const pieces = splitPieces(state);
    const ids = new Set(Array.from(state.regionMask!).filter((v) => v !== 0));
    expect(pieces.length).toBe(ids.size);
    expect(pieces.every((p) => p.geometry.index!.count >= 3)).toBe(true);
  });

  it("uses region color and name", async () => {
    const { state } = await stateFrom3mf();
    const pieces = splitPieces(state);
    expect(pieces[0].name.startsWith("Regiao_")).toBe(true);
    expect(pieces[0].color).toMatch(/^#/);
  });

  it("assigns a mixed triangle to the majority region", async () => {
    const { state } = await stateFrom3mf();
    state.geometry = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
    };
    state.regionMask = new Uint8Array([1, 2, 2]);
    const pieces = splitPieces(state);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].regionId).toBe(2);
  });
});

describe("exportSplit dispatcher", () => {
  it("rejects unknown format", async () => {
    const { state } = await stateFrom3mf();
    await expect(
      exportSplit(state, { format: "nope" as never, includeConnectors: false, capPieces: false })
    ).rejects.toThrow(/Unsupported format/);
  });
});
