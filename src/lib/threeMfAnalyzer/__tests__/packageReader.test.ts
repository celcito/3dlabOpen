import { describe, expect, it } from "vitest";
import { analyzePackage, readPackage } from "../packageReader";
import { make3mf, makeBambu3mf, makeSimple3mf } from "./fixtures";

describe("readPackage (A1–A5)", () => {
  it("classifica um 3MF puro sem reclamar da unidade", async () => {
    const { info, issues } = await readPackage(makeSimple3mf());
    expect(info.kind).toBe("model");
    expect(info.kindLabel).toBe("Modelo 3MF puro");
    expect(info.unit).toBe("millimeter");
    expect(info.objectNames).toEqual(["Cube"]);
    expect(issues.find((i) => i.id === "A1")?.severity).toBe("info");
    expect(issues.some((i) => i.id === "A3")).toBe(false);
  });

  it("detecta unidade inch e sugere M5", async () => {
    const { info, issues } = await readPackage(makeSimple3mf({ unit: "inch" }));
    expect(info.unit).toBe("inch");
    const a3 = issues.find((i) => i.id === "A3");
    expect(a3?.severity).toBe("warning");
    expect(a3?.fixId).toBe("M5");
    expect(a3?.detail).toContain("25,4");
  });

  it("classifica projeto Bambu com G-code e configuração embutidos", async () => {
    const { info, issues } = await readPackage(makeBambu3mf());
    expect(info.kind).toBe("bambu");
    expect(info.kindLabel).toBe("Projeto Bambu Studio");
    expect(info.plateGcodePaths).toEqual(["Metadata/plate_1.gcode"]);
    expect(info.hasSliceInfo).toBe(true);
    expect(info.hasModelSettings).toBe(true);
    expect(info.projectSettings?.wall_loops).toBe("1");
    expect(issues.some((i) => i.id === "A5")).toBe(false);
  });

  it("rejeita pacote sem modelo 3D", async () => {
    await expect(readPackage(make3mf({ "[Content_Types].xml": "<Types/>" }))).rejects.toThrow(/3MF inválido/);
  });

  it("marca o core como não-dirty na leitura", async () => {
    const { info } = await readPackage(makeSimple3mf());
    expect(info.model.docs.every((d) => !d.dirty)).toBe(true);
    expect(info.model.docs[0].path).toBe("3D/3dmodel.model");
  });
});

describe("analyzePackage (B + C)", () => {
  it("cube limpo passa sem erro", async () => {
    const { result } = await analyzePackage(makeSimple3mf());
    expect(result.totalTriangles).toBe(12);
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(result.objects[0].volume).toBeGreaterThan(0);
  });

  it("emite checagens de impressão só quando há project_settings", async () => {
    const pure = await analyzePackage(makeSimple3mf());
    expect(pure.result.issues.some((i) => i.category === "settings")).toBe(false);

    const sliced = await analyzePackage(makeBambu3mf());
    expect(sliced.result.issues.some((i) => i.id === "C1" && i.severity === "warning")).toBe(true);
    expect(sliced.result.issues.some((i) => i.id === "C6")).toBe(true);
  });
});
