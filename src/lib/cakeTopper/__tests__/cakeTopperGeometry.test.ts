import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  defaultSticks,
  plateShapeShape,
  plateShapeBottomYAt,
  svgPlateShape,
} from "../cakeTopperGeometry";

describe("defaultSticks (Espaçamento X)", () => {
  it("sem spacing (null/omitido) mantém a distribuição proporcional à placa", () => {
    expect(defaultSticks(2, 120, 80, 2, 4).map((s) => s.x)).toEqual([-20, 20]);
    expect(defaultSticks(2, 300, 80, 2, 4).map((s) => s.x)).toEqual([-50, 50]);
    expect(defaultSticks(3, 120, 80, 2, 4).map((s) => s.x)).toEqual([-30, 0, 30]);
  });

  it("spacing explícito centraliza as hastes", () => {
    expect(defaultSticks(2, 120, 80, 2, 4, 30).map((s) => s.x)).toEqual([-15, 15]);
    expect(defaultSticks(3, 120, 80, 2, 4, 20).map((s) => s.x)).toEqual([-20, 0, 20]);
    expect(defaultSticks(1, 120, 80, 2, 4, 30).map((s) => s.x)).toEqual([0]);
  });

  it("clamp: spacing que extrapolaria a placa é limitado à borda", () => {
    const sticks = defaultSticks(2, 120, 80, 2, 4, 400);
    for (const s of sticks) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(120 / 2 - 4 / 2 + 1e-9);
    }
  });
});

function bboxOf(shape: THREE.Shape) {
  const box = new THREE.Box2().setFromPoints(shape.getPoints(64));
  return {
    w: box.max.x - box.min.x,
    h: box.max.y - box.min.y,
    cx: (box.max.x + box.min.x) / 2,
    cy: (box.max.y + box.min.y) / 2,
  };
}

describe("plateShapeShape (forma da placa)", () => {
  it("retangulo: canto arredondado preenche a caixa centrada na origem", () => {
    const b = bboxOf(plateShapeShape(120, 60, 5, "retangulo", null));
    expect(b.w).toBeCloseTo(120, 5);
    expect(b.h).toBeCloseTo(60, 5);
    expect(b.cx).toBeCloseTo(0, 5);
    expect(b.cy).toBeCloseTo(0, 5);
  });

  it("presets são esticados para preencher Largura × Altura", () => {
    for (const id of ["coracao", "estrela", "circulo", "losango", "coroa"]) {
      const b = bboxOf(plateShapeShape(120, 60, 5, id, null));
      expect(b.w, id).toBeCloseTo(120, 5);
      expect(b.h, id).toBeCloseTo(60, 5);
      expect(b.cx, id).toBeCloseTo(0, 5);
      expect(b.cy, id).toBeCloseTo(0, 5);
    }
  });

  it("svg válido vira o contorno (preenche a caixa); inválido cai no retângulo", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#000"/></svg>';
    const b = bboxOf(plateShapeShape(120, 60, 5, "svg", svg));
    expect(b.w).toBeCloseTo(120, 5);
    expect(b.h).toBeCloseTo(60, 5);

    const fallback = bboxOf(plateShapeShape(120, 60, 5, "svg", "isso nao e svg <<<"));
    expect(fallback.w).toBeCloseTo(120, 5);
    expect(fallback.h).toBeCloseTo(60, 5);
  });

  it("svgPlateShape: markup válido → shape; lixo/vazio → null (validação de upload)", () => {
    expect(svgPlateShape("", 100, 100)).toBeNull();
    expect(svgPlateShape("lixo total", 100, 100)).toBeNull();
    const ok = svgPlateShape(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#000"/></svg>',
      100,
      100
    );
    expect(ok).not.toBeNull();
    const b = bboxOf(ok!);
    expect(b.w).toBeCloseTo(100, 5);
    expect(b.h).toBeCloseTo(100, 5);
  });
});

describe("plateShapeBottomYAt (âncora das hastes na forma)", () => {
  it("retangulo: borda inferior = -altura/2 dentro da caixa; null fora", () => {
    const rect = plateShapeShape(120, 60, 5, "retangulo", null);
    expect(plateShapeBottomYAt(rect, 0)).toBeCloseTo(-30, 5);
    expect(plateShapeBottomYAt(rect, -50)).toBeCloseTo(-30, 5);
    expect(plateShapeBottomYAt(rect, 70)).toBeNull();
  });

  it("coracao: ponta toca o fundo da caixa e a borda sobe longe do centro", () => {
    const heart = plateShapeShape(120, 60, 5, "coracao", null);
    const center = plateShapeBottomYAt(heart, 0)!;
    const side = plateShapeBottomYAt(heart, 40)!;
    expect(center).toBeCloseTo(-30, 5); // ponta (y-up: base) = fundo da caixa
    expect(side).toBeGreaterThan(center + 1); // sobe em direção às laterais
  });

  it("coracao aponta para baixo (ponta em -y, lobos largos em +y)", () => {
    const heart = plateShapeShape(120, 60, 5, "coracao", null);
    const pts = heart.getPoints(64);
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(-30, 5); // ponta toca o fundo
    // lobos largos perto do topo (versão invertida não teria pontos largos em +y)
    expect(pts.some((p) => p.y > 20 && Math.abs(p.x) > 40)).toBe(true);
  });
});
