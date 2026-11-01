import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { defaultPlaque } from "../plaque";
import { buildStickGeometries, buildPlaqueParts, getPlaqueBounds, checkNameFitsPlate } from "../plaqueGeometry";
import { plateShapeShape } from "../cakeTopperGeometry";

/** Plaquinha headless-safe: sem texto (sem fetch de fonte) e sem elementos. */
function plainPlaque() {
  const plaque = defaultPlaque("placa");
  plaque.topper.text = "";
  plaque.topper.subtitle = "";
  plaque.topper.elements = [];
  return plaque;
}

function geomBox(geoms: THREE.BufferGeometry[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const g of geoms) {
    g.computeBoundingBox();
    if (g.boundingBox) box.union(g.boundingBox);
  }
  return box;
}

describe("buildPlaqueParts (estilo placa, em mm)", () => {
  it("gera parts placa/borda/hastes com cores do config", async () => {
    const plaque = plainPlaque();
    const parts = await buildPlaqueParts(plaque);
    const names = parts.map((p) => p.name).sort();
    expect(names).toEqual(["borda", "hastes", "placa"]);
    const placa = parts.find((p) => p.name === "placa")!;
    const borda = parts.find((p) => p.name === "borda")!;
    const hastes = parts.find((p) => p.name === "hastes")!;
    expect(placa.color).toBe(plaque.topper.plateColor);
    expect(borda.color).toBe(plaque.topper.borderColor);
    expect(hastes.color).toBe(plaque.topper.stickColor);
  });

  it("placa tem dimensões em mm (bug de escala 10× corrigido)", async () => {
    const plaque = plainPlaque();
    plaque.topper.text = ""; // sem texto → bbox é só a placa
    const parts = await buildPlaqueParts(plaque);
    const box = geomBox(parts.find((p) => p.name === "placa")!.geoms);
    expect(box.max.x - box.min.x).toBeCloseTo(plaque.topper.plateWidth, 1);
    expect(box.max.y - box.min.y).toBeCloseTo(plaque.topper.plateHeight, 1);
    expect(box.max.z - box.min.z).toBeCloseTo(plaque.topper.plateThickness, 1);
  });

  it("hastes penduram para baixo (regressão: -π/2 apontava para cima)", async () => {
    const plaque = plainPlaque();
    const parts = await buildPlaqueParts(plaque);
    const box = geomBox(parts.find((p) => p.name === "hastes")!.geoms);
    const stick = plaque.topper.sticks[0];
    // Bug antigo: y ∈ [-30, +50] (furava por cima da placa). Agora: totalmente abaixo.
    expect(box.max.y).toBeLessThanOrEqual(-plaque.topper.plateHeight / 2 + 1);
    expect(box.min.y).toBeCloseTo(-plaque.topper.plateHeight / 2 + 1 - stick.height, 1);
    // Espessura da haste alinhada em z ∈ [0, thickness] (tocando a placa).
    expect(box.min.z).toBeCloseTo(0, 5);
    expect(box.max.z).toBeCloseTo(stick.thickness, 1);
    // Haste em contato volumétrico com a placa (empenamento de 1 mm).
    expect(box.max.y).toBeCloseTo(-plaque.topper.plateHeight / 2 + 1, 5);
  });

  it("respeita as posições x de todas as hastes", async () => {
    const plaque = plainPlaque();
    expect(plaque.topper.sticks).toHaveLength(2);
    const parts = await buildPlaqueParts(plaque);
    const geoms = parts.find((p) => p.name === "hastes")!.geoms;
    expect(geoms).toHaveLength(2);
    const xs = geoms.map((g) => geomBox([g]).getCenter(new THREE.Vector3()).x).sort((a, b) => a - b);
    const expected = plaque.topper.sticks.map((s) => s.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(expected[0], 1);
    expect(xs[1]).toBeCloseTo(expected[1], 1);
  });
});

describe("getPlaqueBounds", () => {
  it("faz a union de placa e hastes", async () => {
    const plaque = plainPlaque();
    const parts = await buildPlaqueParts(plaque);
    const bounds = getPlaqueBounds(parts);
    // Borda (showBorder) é maior que a placa em borderWidth em cada lado.
    expect(bounds.maxY).toBeCloseTo(plaque.topper.plateHeight / 2 + plaque.topper.borderWidth, 1);
    expect(bounds.minY).toBeCloseTo(-plaque.topper.plateHeight / 2 + 1 - plaque.topper.stickHeight, 1);
    expect(bounds.minX).toBeCloseTo(-plaque.topper.plateWidth / 2 - plaque.topper.borderWidth, 1);
    expect(bounds.maxX).toBeCloseTo(plaque.topper.plateWidth / 2 + plaque.topper.borderWidth, 1);
  });
});

describe("buildStickGeometries", () => {
  it("ancora na aresta informada com empenamento", () => {
    const plaque = plainPlaque();
    const geoms = buildStickGeometries(plaque.topper, -plaque.topper.plateHeight / 2);
    expect(geoms).toHaveLength(plaque.topper.stickCount);
  });

  it("stickZOffset sobe/desce a haste a partir da âncora (controle Eixo Z)", () => {
    const plaque = plainPlaque();
    const anchor = -plaque.topper.plateHeight / 2;
    const embed = 1; // STICK_EMBED_MM

    plaque.topper.stickZOffset = 5;
    let box = geomBox(buildStickGeometries(plaque.topper, anchor));
    expect(box.max.y).toBeCloseTo(anchor + embed + 5, 5);

    plaque.topper.stickZOffset = -10;
    box = geomBox(buildStickGeometries(plaque.topper, anchor));
    expect(box.max.y).toBeCloseTo(anchor + embed - 10, 5);
  });

  it("com shape, cada haste ancora na borda inferior real da forma", () => {
    const plaque = plainPlaque();
    const anchor = -plaque.topper.plateHeight / 2;
    const heart = plateShapeShape(
      plaque.topper.plateWidth,
      plaque.topper.plateHeight,
      plaque.topper.plateCornerRadius,
      "coracao",
      null
    );
    // Hastes em x=±20: borda do coração ali fica acima do fundo da caixa.
    const box = geomBox(buildStickGeometries(plaque.topper, anchor, heart));
    expect(box.max.y).toBeGreaterThan(anchor + 1 + 0.5);
    expect(box.max.y).toBeLessThan(anchor + 1 + plaque.topper.stickHeight);
  });
});

describe("forma da placa em buildPlaqueParts", () => {
  it("preset (coracao) mantém bbox da caixa e hastes ancoram na borda real", async () => {
    const plaque = plainPlaque();
    plaque.topper.plateShape = "coracao";
    const parts = await buildPlaqueParts(plaque);

    const placaBox = geomBox(parts.find((p) => p.name === "placa")!.geoms);
    expect(placaBox.max.x - placaBox.min.x).toBeCloseTo(plaque.topper.plateWidth, 1);
    expect(placaBox.max.y - placaBox.min.y).toBeCloseTo(plaque.topper.plateHeight, 1);

    const stickBox = geomBox(parts.find((p) => p.name === "hastes")!.geoms);
    // Canto inferior da caixa (-h/2) não existe no x das hastes no coração:
    // a haste deve terminar acima de -h/2 + empenamento.
    expect(stickBox.max.y).toBeGreaterThan(-plaque.topper.plateHeight / 2 + 1 + 0.5);
  });

  it("svg da forma também preenche a caixa", async () => {
    const plaque = plainPlaque();
    plaque.topper.plateShape = "svg";
    plaque.topper.plateShapeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><circle cx="25" cy="25" r="24" fill="#000"/></svg>';
    const parts = await buildPlaqueParts(plaque);
    const box = geomBox(parts.find((p) => p.name === "placa")!.geoms);
    expect(box.max.x - box.min.x).toBeCloseTo(plaque.topper.plateWidth, 1);
    expect(box.max.y - box.min.y).toBeCloseTo(plaque.topper.plateHeight, 1);
  });
});

describe("checkNameFitsPlate", () => {
  it("compara a largura do nome com a área útil da placa", () => {
    const plaque = plainPlaque();
    // placa 120, cornerRadius 5 → útil = 110
    expect(checkNameFitsPlate(100, plaque.topper)).toBe(true);
    expect(checkNameFitsPlate(110, plaque.topper)).toBe(true);
    expect(checkNameFitsPlate(111, plaque.topper)).toBe(false);
  });
});
