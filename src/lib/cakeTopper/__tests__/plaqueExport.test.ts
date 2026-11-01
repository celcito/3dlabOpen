import { describe, it, expect } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { defaultPlaque, type Plaque } from "../plaque";
import { sanitizeFileName, packPlaqueLayout, buildPlaqueStlZip, buildPlaques3MF } from "../plaqueExport";

/** Plaquinhas headless-safe: sem texto (sem fetch de fonte) e sem elementos. */
function plainPlaque(label: string): Plaque {
  const plaque = defaultPlaque("placa");
  plaque.topper.text = "";
  plaque.topper.subtitle = "";
  plaque.topper.elements = [];
  plaque.label = label;
  return plaque;
}

describe("sanitizeFileName", () => {
  it("remove acentos, espaços e caracteres inválidos", () => {
    expect(sanitizeFileName("Feliz Aniversário!")).toBe("Feliz-Aniversario");
    expect(sanitizeFileName("1_Entrada Fofa")).toBe("1_Entrada-Fofa");
    expect(sanitizeFileName("///")).toBe("plaquinha");
    expect(sanitizeFileName("")).toBe("plaquinha");
  });
});

describe("packPlaqueLayout", () => {
  it("não sobrepõe peças e quebra fileira em 250 mm", () => {
    const sizes = [
      { width: 120, height: 140 },
      { width: 120, height: 140 },
      { width: 120, height: 140 },
    ];
    const positions = packPlaqueLayout(sizes, 5, 250);
    expect(positions).toHaveLength(3);
    // 120+5+120 = 245 ≤ 250 → 2ª cabe; 3ª quebra de fileira.
    expect(positions[0]).toEqual({ x: 0, y: 0 });
    expect(positions[1]).toEqual({ x: 125, y: 0 });
    expect(positions[2]).toEqual({ x: 0, y: -145 });
    // Sem sobreposição na mesma fileira.
    expect(positions[0].x + sizes[0].width).toBeLessThanOrEqual(positions[1].x);
  });
});

describe("buildPlaqueStlZip", () => {
  it("gera 1 STL binário por plaquinha", async () => {
    const plaques = [plainPlaque("Entrada Fofa"), plainPlaque("Mesa Doce")];
    const blob = await buildPlaqueStlZip(plaques);
    expect(blob.type).toBe("application/zip");
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const names = Object.keys(files).sort();
    expect(names).toEqual(["1_Entrada-Fofa.stl", "2_Mesa-Doce.stl"]);
    // STL binário: header 80 + uint32 triângulos + 50 bytes/tri.
    const stl = files["1_Entrada-Fofa.stl"];
    const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
    const triangles = view.getUint32(80, true);
    expect(stl.byteLength).toBe(84 + triangles * 50);
    expect(triangles).toBeGreaterThan(0);
  });
});

describe("buildPlaques3MF", () => {
  it("gera 3MF único com objetos por part colorida", async () => {
    const plaques = [plainPlaque("Entrada"), plainPlaque("Mesa")];
    const blob = await buildPlaques3MF(plaques, "Plaquinhas de Topo de Bolo");
    expect(blob.type).toContain("3dmanufacturing");
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files)).toContain("3D/3dmodel.model");
    expect(Object.keys(files)).toContain("Metadata/model_settings.config");
    const model = strFromU8(files["3D/3dmodel.model"]);
    // Plaquinha placa: placa + borda + hastes = 3 parts coloridas × 2 plaquinhas.
    const objectCount = (model.match(/<object /g) || []).length;
    expect(objectCount).toBe(6);
    const itemCount = (model.match(/<item objectid=/g) || []).length;
    expect(itemCount).toBe(6);
    // Grade: as 2 plaquinhas não compartilham a mesma coordenada de partida.
    expect(model).toContain("millimeter");
    const settings = strFromU8(files["Metadata/model_settings.config"]);
    expect(settings).toContain("extruder");
  });

  it("cores iguais deduplicam slots de filamento", async () => {
    const plaques = [plainPlaque("A"), plainPlaque("B")];
    const blob = await buildPlaques3MF(plaques, "t");
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const model = strFromU8(files["3D/3dmodel.model"]);
    const basematerials = model.match(/<base name=/g) || [];
    // placa (#FF6B9D), borda (#FF1A6D), hastes (#FF6B9D) → 3 parts, 2 cores únicas.
    expect(basematerials).toHaveLength(2);
  });
});
