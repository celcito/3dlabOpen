import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import * as THREE from "three";
import { generate3MfBlob, ThreeMfExportOptions } from "../threeMfExporter";

const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Front quad (real UVs) + side quad (degenerate UV), non-indexed. */
function pieceGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0, 1, 0, 0, 0, 1, 0,
        1, 0, 0, 1, 1, 0, 0, 1, 0,
        1, 0, 0, 1, 0, -1, 0, 1, -1,
        1, 0, -1, 0, 1, -1, 0, 1, 0,
      ],
      3
    )
  );
  geom.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      [
        0, 1, 1, 1, 0, 0,
        1, 1, 1, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
      ],
      2
    )
  );
  return geom;
}

function exportFixture(): ThreeMfExportOptions {
  return {
    title: "Golden Fixture",
    designer: "Test",
    filaments: [
      { name: "Filamento 1", color: "#D4B996" },
      { name: "Filamento 2", color: "#334155" },
    ],
    items: [
      {
        geometry: pieceGeometry(),
        name: "Peca_Tex",
        filamentIndex: 0,
        textureImage: PNG_1x1,
        textureName: "art",
      },
      {
        geometry: pieceGeometry(),
        name: "Peca_Plain",
        filamentIndex: 1,
      },
    ],
  };
}

/** Counter closure over pre-baked states — mirrors the PuzzleGenerator wiring. */
function counterSampler(states: number[]) {
  let t = 0;
  const sampler = () => states[t++];
  sampler.calls = () => t;
  return sampler;
}

/**
 * Reference decoder for Bambu's TriangleSelector bitstream (bbs_3mf.cpp),
 * read RIGHT-TO-LEFT one nibble at a time. Whole-triangle leaves only.
 */
function decodePaintColor(hex: string): number {
  const nibbles = hex.split("").reverse();
  let i = 0;
  const next = () => parseInt(nibbles[i++], 16);
  const code = next();
  if ((code & 3) !== 0) throw new Error(`split node não suportado: ${hex}`);
  const s2 = code >> 2;
  return s2 !== 3 ? s2 : 3 + next();
}

async function unzipTexts(
  blob: Blob
): Promise<{ model: string; project: string; modelSettings: string }> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return {
    model: await zip.file("3D/3dmodel.model")!.async("string"),
    project: await zip.file("Metadata/project_settings.config")!.async("string"),
    modelSettings: await zip.file("Metadata/model_settings.config")!.async("string"),
  };
}

function readGolden(): { model: string; project: string; modelSettings: string } {
  const file = path.resolve(process.cwd(), "src/lib/__tests__/fixtures/threeMfGolden.json");
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

describe("export 3MF com paint_color", () => {
  it("serializa paint_color nos triângulos frontais com a codificação do Bambu", async () => {
    const states = [1, 3, 0, 0]; // 2 frontais pintados, laterais 0
    const sampler = counterSampler(states);
    const options = exportFixture();
    options.items[0] = { ...options.items[0], paintSampler: sampler };
    delete options.items[0].textureImage;
    delete options.items[0].textureName;

    const { model } = await unzipTexts(await generate3MfBlob(options));

    const triangles = model.match(/<triangle /g)?.length ?? 0;
    const painted = model.match(/ paint_color="/g)?.length ?? 0;
    expect(triangles).toBe(8); // 4 da peça pintada + 4 da peça plain
    expect(painted).toBe(2);
    // Literais do formato Bambu (bbs_3mf.cpp). NÃO usar paintStateToHex aqui:
    // comparar com a própria função vira tautologia e não pega regressão.
    expect(model).toContain('paint_color="4"'); // slot 1
    expect(model).toContain('paint_color="0C"'); // slot 3
    // Round-trip: cada paint_color gravado deve decodificar de volta ao slot
    const encoded = [...model.matchAll(/paint_color="([^"]+)"/g)].map(m => m[1]);
    expect(encoded.map(decodePaintColor)).toEqual([1, 3]);
    // pid/p1 (cor base) mantidos ao lado do paint_color
    expect(model).toMatch(/pid="1" p1="0" paint_color="/);
    // sampler invocado por triângulo na ordem de serialização
    expect(sampler.calls()).toBe(4);
  });

  it("com pintura: omite m:texture2dgroup e mantém basematerials", async () => {
    const sampler = counterSampler([1, 1, 0, 0]);
    const options = exportFixture();
    options.items[0] = { ...options.items[0], paintSampler: sampler };
    delete options.items[0].textureImage;
    delete options.items[0].textureName;

    const { model } = await unzipTexts(await generate3MfBlob(options));

    expect(model).not.toContain("m:texture2dgroup");
    expect(model).not.toContain("m:tex2coord");
    expect(model).not.toContain("m:texture2d ");
    expect(model).toContain("<basematerials");
  });

  it("sem sampler: 3D/3dmodel.model byte-idêntico ao comportamento atual", async () => {
    const golden = readGolden();
    const { model } = await unzipTexts(await generate3MfBlob(exportFixture()));
    expect(model).toBe(golden.model);
  });

  it("sem sampler: configs byte-idênticas (regressão T5)", async () => {
    const golden = readGolden();
    const texts = await unzipTexts(await generate3MfBlob(exportFixture()));
    expect(texts.project).toBe(golden.project);
    expect(texts.modelSettings).toBe(golden.modelSettings);
  });

  it("item com textura e sem pintura mantém o caminho UV intacto", async () => {
    const { model } = await unzipTexts(await generate3MfBlob(exportFixture()));
    expect(model).toContain("m:texture2dgroup");
    expect(model).toContain("m:tex2coord");
    expect(model).not.toContain("paint_color");
  });
});

describe("paleta mesclada nos metadados Bambu", () => {
  const PALETTE = [
    { name: "Filamento 1", color: "#D4B996", base: true },
    { name: "Filamento 2", color: "#334155", base: false },
    { name: "Auto_1", color: "#00FF00", base: false },
    { name: "Auto_2", color: "#0000FF", base: false },
  ];

  it("extras aparecem em basematerials, filament_colour e filament_list", async () => {
    const options = exportFixture();
    options.palette = PALETTE;

    const { model, project, modelSettings } = await unzipTexts(
      await generate3MfBlob(options)
    );

    expect(model.match(/<base /g)?.length).toBe(4);
    expect(model).toContain('<base name="Auto_1" displaycolor="#00FF00"');
    expect(model).toContain('<base name="Auto_2" displaycolor="#0000FF"');

    const settings = JSON.parse(project);
    expect(settings.filament_colour).toEqual(["#D4B996", "#334155", "#00FF00", "#0000FF"]);
    expect(settings.filament_type).toHaveLength(4);

    expect(modelSettings.match(/filament_id/g)?.length).toBe(4);
  });

  it("extruder de cada objeto aponta ao slot base (filIdx + 1)", async () => {
    const options = exportFixture();
    options.palette = PALETTE;

    const { modelSettings } = await unzipTexts(await generate3MfBlob(options));
    const extruders = [...modelSettings.matchAll(/key="extruder" value="(\d+)"/g)].map(
      m => m[1]
    );
    expect(extruders).toEqual(["1", "2"]);
  });
});
