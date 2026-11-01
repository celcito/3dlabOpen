import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  buildFrameGeometry,
  buildFrameParts,
  CUSTOM_PRESET_ID,
  PORTRAIT_PRESETS,
} from "../frame";

describe("PORTRAIT_PRESETS", () => {
  it("traz medidas de porta-retrato em mm, com ids únicos", () => {
    expect(PORTRAIT_PRESETS.length).toBeGreaterThanOrEqual(4);
    const ids = PORTRAIT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PORTRAIT_PRESETS) {
      expect(p.width).toBeGreaterThan(50);
      expect(p.height).toBeGreaterThanOrEqual(p.width);
    }
    expect(ids).not.toContain(CUSTOM_PRESET_ID);
    // 10 × 15 cm = 100 × 150 mm
    const small = PORTRAIT_PRESETS.find((p) => p.id === "10x15")!;
    expect(small.width).toBe(100);
    expect(small.height).toBe(150);
  });
});

describe("buildFrameGeometry", () => {
  const base = {
    openingWidth: 100,
    openingHeight: 150,
    border: 12,
    depth: 6,
    radius: 6,
    panelThickness: 3,
  };

  it("o aro externo é abertura + 2 × borda, com a profundidade pedida", () => {
    const geom = buildFrameGeometry(base)!;
    geom.computeBoundingBox();
    const box = geom.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(100 + 2 * 12, 3);
    expect(box.max.y - box.min.y).toBeCloseTo(150 + 2 * 12, 3);
    expect(box.min.z).toBeCloseTo(0, 5);
    expect(box.max.z).toBeCloseTo(6, 5);
  });

  it("não deixa vértice dentro da abertura (a foto passa)", () => {
    const parts = buildFrameParts(base)!;
    const eps = 1e-6;
    for (const geom of [parts.front, parts.recess]) {
      const pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = Math.abs(pos.getX(i));
        const y = Math.abs(pos.getY(i));
        const insideOpening =
          x < base.openingWidth / 2 + parts.clearance - eps &&
          y < base.openingHeight / 2 + parts.clearance - eps;
        expect(insideOpening).toBe(false);
      }
    }
  });

  it("rebaixo traseiro cabe a litofania e sobra aro na frente", () => {
    const parts = buildFrameParts(base)!;
    // Painel de 3mm + folga, nunca passando da profundidade.
    expect(parts.rebate).toBeCloseTo(3.4, 5);
    expect(parts.rebate).toBeLessThan(base.depth);
    expect(parts.lip).toBeGreaterThan(0);
    expect(parts.lip).toBeLessThanOrEqual(base.border);
  });

  it("profundidade menor que o painel ainda gera sólido válido", () => {
    const geom = buildFrameGeometry({ ...base, depth: 1, panelThickness: 4 })!;
    geom.computeBoundingBox();
    const box = geom.boundingBox!;
    expect(box.max.z - box.min.z).toBeLessThanOrEqual(1 + 1e-6);
    expect(geom.attributes.position.count).toBeGreaterThan(0);
  });

  it("raio grande é limitado pelo menor lado da moldura", () => {
    const geom = buildFrameGeometry({ ...base, radius: 500 })!;
    geom.computeBoundingBox();
    const box = geom.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(124, 3);
    expect(box.max.y - box.min.y).toBeCloseTo(174, 3);
  });

  it("medidas inválidas devolvem null", () => {
    expect(buildFrameGeometry({ ...base, openingWidth: 0 })).toBeNull();
    expect(buildFrameGeometry({ ...base, border: 0 })).toBeNull();
    expect(buildFrameGeometry({ ...base, depth: 0 })).toBeNull();
    expect(buildFrameGeometry({ ...base, openingHeight: Number.NaN })).toBeNull();
  });

  it("a moldura abre para o tamanho da foto do preset (13 × 18)", () => {
    const preset = PORTRAIT_PRESETS.find((p) => p.id === "13x18")!;
    const geom = buildFrameGeometry({
      ...base,
      openingWidth: preset.width,
      openingHeight: preset.height,
    })!;
    geom.computeBoundingBox();
    const box = geom.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(130 + 24, 3);
    expect(box.max.y - box.min.y).toBeCloseTo(180 + 24, 3);
    expect(geom).toBeInstanceOf(THREE.BufferGeometry);
  });
});
