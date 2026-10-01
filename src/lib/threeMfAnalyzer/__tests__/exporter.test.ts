import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { analyzePackage } from "../packageReader";
import { applyMeshRepairs } from "../repair";
import { applySettingsFixes } from "../settingsApply";
import { exportFixed3mf } from "../exporter";
import type { FixId, RawModel } from "../types";
import { PRESERVED_ENTRY_NAMES, makeBambu3mf, makeSimple3mf } from "./fixtures";

const ALL_MESH_FIXES: FixId[] = ["M1", "M2", "M3", "M4", "M5", "M6", "M7"];
const ALL_SETTINGS_FIXES: FixId[] = ["S1", "S2", "S3", "S4", "S5"];

async function exportAndReread(
  source: ArrayBuffer,
  options: { removeStaleSlice: boolean; settings: Record<string, unknown> | null },
  mutate: (model: RawModel) => void
): Promise<{ blob: Blob; reread: Awaited<ReturnType<typeof analyzePackage>> }> {
  const { info } = await analyzePackage(source);
  mutate(info.model);
  const blob = exportFixed3mf(source, {
    model: info.model,
    settings: options.settings,
    removeStaleSlice: options.removeStaleSlice,
  });
  return { blob, reread: await analyzePackage(await blob.arrayBuffer()) };
}

describe("exportFixed3mf — roundtrip", () => {
  it("repara malha, exporta e a re-análise zera os erros", async () => {
    const source = makeSimple3mf({ flip: true, transform: "1 0 0 0 1 0 0 0 1 0 0 5" });

    const before = await analyzePackage(source);
    expect(before.result.issues.some((i) => i.id === "B4")).toBe(true);
    expect(before.result.issues.some((i) => i.id === "B6" && i.fixId === "M6")).toBe(true);

    const { blob, reread } = await exportAndReread(source, { removeStaleSlice: false, settings: null }, (model) => {
      const repair = applyMeshRepairs(model, ALL_MESH_FIXES);
      expect(repair.applied).toEqual(expect.arrayContaining(["M3", "M6"]));
      expect(repair.applied).not.toContain("M5");
    });

    expect(reread.result.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(reread.result.issues.some((i) => i.id === "B6")).toBe(false);
    expect(reread.result.objects[0].volume).toBeGreaterThan(0);
    expect(blob.type).toBe("model/3mf");
  });

  it("preserva byte a byte todas as entradas que não foram alteradas", async () => {
    const source = makeBambu3mf();
    const original = unzipSync(new Uint8Array(source));

    const { blob } = await exportAndReread(source, { removeStaleSlice: false, settings: null }, (model) => {
      applyMeshRepairs(model, ALL_MESH_FIXES);
    });

    const output = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(output).sort()).toEqual(Object.keys(original).sort());
    for (const name of PRESERVED_ENTRY_NAMES) {
      expect(output[name]).toEqual(original[name]);
    }
    expect(output["Metadata/plate_1.gcode"]).toEqual(original["Metadata/plate_1.gcode"]);
    expect(output["Metadata/SliceInfo.config"]).toEqual(original["Metadata/SliceInfo.config"]);
  });

  it("S1–S5 reescrevem o project_settings e removem o fatiado obsoleto", async () => {
    const source = makeBambu3mf();
    const { info, result } = await analyzePackage(source);
    expect(result.issues.some((i) => i.id === "C1" && i.severity === "warning")).toBe(true);

    const fixes = applySettingsFixes(info.projectSettings, ALL_SETTINGS_FIXES, "equilibrado", false);
    expect(fixes.applied).toEqual(expect.arrayContaining(["S1", "S2", "S3", "S4", "S5"]));
    expect(fixes.removeStaleSlice).toBe(true);
    expect(fixes.refatizar).toBe(true);

    const blob = exportFixed3mf(source, {
      model: info.model,
      settings: fixes.settings,
      removeStaleSlice: fixes.removeStaleSlice,
    });
    const re = await analyzePackage(await blob.arrayBuffer());

    expect(re.result.issues.filter((i) => i.severity === "warning")).toEqual([]);
    expect(re.result.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(re.info.projectSettings?.layer_height).toBe("0.2");
    expect(re.info.projectSettings?.wall_loops).toBe("3");
    expect(re.info.plateGcodePaths).toEqual([]);
    expect(re.info.hasSliceInfo).toBe(false);

    const output = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(output["Metadata/plate_1.gcode"]).toBeUndefined();
    expect(output["Metadata/SliceInfo.config"]).toBeUndefined();
    expect(output["Metadata/model_settings.config"]).toBeDefined();
    expect(output["Metadata/thumbnail.png.b64"]).toBeDefined();
    expect(new TextDecoder().decode(output["[Content_Types].xml"])).not.toContain("gcode");
  });

  it("sem alterações o pacote sairia idêntico (só recria o ZIP)", async () => {
    const source = makeSimple3mf();
    const original = unzipSync(new Uint8Array(source));
    const { blob } = await exportAndReread(source, { removeStaleSlice: false, settings: null }, () => {});
    const output = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(output).sort()).toEqual(Object.keys(original).sort());
    for (const name of Object.keys(original)) expect(output[name]).toEqual(original[name]);
  });

  it("os documentos reescritos têm exatamente uma declaração XML", async () => {
    const source = makeBambu3mf();
    const { blob } = await exportAndReread(source, { removeStaleSlice: true, settings: null }, (model) => {
      applyMeshRepairs(model, ALL_MESH_FIXES);
    });

    const output = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    for (const name of Object.keys(output)) {
      if (!name.endsWith(".xml") && !name.endsWith(".model")) continue;
      const xml = new TextDecoder().decode(output[name]);
      expect(xml.match(/<\?xml/g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });
});
