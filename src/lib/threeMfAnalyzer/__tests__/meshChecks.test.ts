import { describe, expect, it } from "vitest";
import { readPackage } from "../packageReader";
import { resolveWorldMeshes, runMeshChecks } from "../meshChecks";
import { make3mf, makeSimple3mf } from "./fixtures";

async function check(buffer: ArrayBuffer) {
  const { info } = await readPackage(buffer);
  return runMeshChecks(resolveWorldMeshes(info.model), info.model);
}

describe("runMeshChecks (B1–B9)", () => {
  it("cube fechado passa em B1/B2/B3/B4", async () => {
    const mesh = await check(makeSimple3mf());
    const ids = mesh.issues.map((i) => i.id);
    expect(ids).not.toContain("B1");
    expect(ids).not.toContain("B2");
    expect(ids).not.toContain("B3");
    expect(ids).not.toContain("B4");
    expect(ids).not.toContain("B9");
    expect(mesh.totalTriangles).toBe(12);
    expect(mesh.objects[0].boundaryEdges).toBe(0);
    expect(mesh.objects[0].volume).toBeGreaterThan(0);
    expect(mesh.touchingBed).toBe(true);
    expect(mesh.hasOverhang).toBe(false);
  });

  it("B1: abertura no topo gera arestas de contorno", async () => {
    const mesh = await check(makeSimple3mf({ dropTop: true }));
    const b1 = mesh.issues.find((i) => i.id === "B1");
    expect(b1?.severity).toBe("error");
    expect(b1?.fixId).toBe("M1");
    expect(mesh.objects[0].boundaryEdges).toBe(4);
    expect(mesh.boundarySegments.length).toBe(24);
  });

  it("B4: winding invertido derruba o volume assinado", async () => {
    const mesh = await check(makeSimple3mf({ flip: true }));
    const b4 = mesh.issues.find((i) => i.id === "B4");
    expect(b4?.severity).toBe("error");
    expect(b4?.fixId).toBe("M3");
    expect(mesh.objects[0].volume).toBeLessThan(0);
  });

  it("B3: triângulo degenerado e duplicado são contados", async () => {
    const mesh = await check(makeSimple3mf({ degenerate: true, duplicate: true }));
    const b3 = mesh.issues.find((i) => i.id === "B3");
    expect(b3?.severity).toBe("warning");
    expect(b3?.fixId).toBe("M2");
    expect(mesh.objects[0].degenerate).toBe(1);
    expect(mesh.objects[0].duplicates).toBe(1);
    expect(mesh.totalTriangles).toBe(12);
  });

  it("B6: peça flutuando vira warning com M6", async () => {
    const mesh = await check(makeSimple3mf({ transform: "1 0 0 0 1 0 0 0 1 0 0 5" }));
    const b6 = mesh.issues.find((i) => i.id === "B6");
    expect(b6?.severity).toBe("warning");
    expect(b6?.fixId).toBe("M6");
    expect(mesh.objects[0].floating).toBe(true);
    expect(mesh.highlights[0]?.kind).toBe("floating");
  });

  it("B6: peça fora da cama vira error sem fixId", async () => {
    const mesh = await check(makeSimple3mf({ transform: "1 0 0 400 0 1 0 0 0 0 1 0" }));
    const b6 = mesh.issues.find((i) => i.id === "B6");
    expect(b6?.severity).toBe("error");
    expect(b6?.fixId).toBeUndefined();
    expect(mesh.objects[0].offBed).toBe(true);
  });

  it("B6: peça abaixo de Z=0 é reportada", async () => {
    const mesh = await check(makeSimple3mf({ transform: "1 0 0 0 1 0 0 0 1 0 0 -3" }));
    expect(mesh.issues.find((i) => i.id === "B6")?.severity).toBe("warning");
    expect(mesh.objects[0].belowBed).toBe(true);
  });

  it("B8: dimensão mínima abaixo de 0,8 mm", async () => {
    const mesh = await check(makeSimple3mf({ size: [0.5, 40, 40] }));
    const b8 = mesh.issues.find((i) => i.id === "B8");
    expect(b8?.severity).toBe("warning");
    expect(b8?.fixId).toBeUndefined();
  });

  it("B9: objeto sem triângulos é reportado com M7", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources>
  <object id="1" type="model" name="Vazio"><components><component objectid="2"/></components></object>
  <object id="2" type="model" name="Também vazio"/>
 </resources>
 <build><item objectid="1"/></build>
</model>`;
    const buffer = make3mf({ "[Content_Types].xml": "<Types/>", "3D/3dmodel.model": xml });
    const { info } = await readPackage(buffer);
    const mesh = runMeshChecks(resolveWorldMeshes(info.model), info.model);
    const b9 = mesh.issues.find((i) => i.id === "B9");
    expect(b9?.severity).toBe("error");
    expect(b9?.fixId).toBe("M7");
    expect(b9?.title).toContain("vazio");
  });
});
