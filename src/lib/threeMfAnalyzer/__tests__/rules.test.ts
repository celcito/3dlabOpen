import { describe, expect, it } from "vitest";
import { RULES, SOURCES } from "../rules";

describe("rules — limites citando skills", () => {
  it("manifold exige 0 arestas de contorno e no máximo 2 faces por aresta", () => {
    expect(RULES.B1_MAX_BOUNDARY_EDGES.value).toBe(0);
    expect(RULES.B2_MAX_FACES_PER_EDGE.value).toBe(2);
    expect(RULES.B1_MAX_BOUNDARY_EDGES.source).toContain("3d-print");
    expect(RULES.B1_MAX_BOUNDARY_EDGES.source).toContain("design-rules.md");
  });

  it("anti-pattern de triângulos é 500k", () => {
    expect(RULES.B5_MAX_TRIANGLES.value).toBe(500_000);
  });

  it("cama bambu é 256 mm (180 mm no A1 mini) e a fonte é a skill bambu-labs", () => {
    expect(RULES.B6_BED_MM.value).toBe(256);
    expect(RULES.B6_SMALL_BED_MM.value).toBe(180);
    expect(RULES.B6_BED_MM.source).toContain("bambu-labs");
  });

  it("overhang: PLA 50° / PETG 45°", () => {
    expect(RULES.B7_OVERHANG_PLA_DEG.value).toBe(50);
    expect(RULES.B7_OVERHANG_PETG_DEG.value).toBe(45);
    expect(RULES.B7_OVERHANG_PLA_DEG.source).toContain("Overhang Management");
    expect(RULES.B7_OVERHANG_PETG_DEG.source).toContain("Overhang Limits");
  });

  it("parede decorativa mínima 0,8 mm = 2 perímetros @ 0,4 mm", () => {
    expect(RULES.B8_MIN_DIMENSION_MM.value).toBe(0.8);
  });

  it("altura de camada entre 25% e 75% do bico; parede funcional ≥ 3 perímetros", () => {
    expect(RULES.C1_LAYER_RATIO_MIN.value).toBe(0.25);
    expect(RULES.C1_LAYER_RATIO_MAX.value).toBe(0.75);
    expect(RULES.C2_MIN_WALL_LOOPS.value).toBe(3);
    expect(RULES.C1_LAYER_RATIO_MIN.source).toContain("Layer Height");
    expect(RULES.C2_MIN_WALL_LOOPS.source).toContain("Wall Thickness Minimums");
  });

  it("pé de elefante 0,2 mm vem do Elephant Foot da skill 3d-print", () => {
    expect(RULES.C4_ELEPHANT_FOOT_MM.value).toBe(0.2);
    expect(RULES.C4_ELEPHANT_FOOT_MM.source).toContain("Elephant Foot");
  });

  it("weld snap é 0,1 µm (1e-4 mm)", () => {
    expect(RULES.M1_WELD_SNAP_MM.value).toBe(1e-4);
  });

  it("escala inch → 25,4× vem de formats.md", () => {
    expect(RULES.A3_UNIT_SCALE.value).toBe(25.4);
    expect(RULES.A3_UNIT_SCALE.source).toContain("formats.md");
  });

  it("regra do gcode embutido aponta para a skill bambu-labs", () => {
    expect(SOURCES.slicedGcode).toContain("bambu-labs");
  });
});
