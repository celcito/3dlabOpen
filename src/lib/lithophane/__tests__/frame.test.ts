import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  buildFrameGeometry,
  buildFrameParts,
  buildStandGeometry,
  CUSTOM_PRESET_ID,
  FRAME_TEXTURES,
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

  it("a litofania entra por trás e é segurada pelo batente", () => {
    const panelThickness = 3;
    const parts = buildFrameParts({ ...base, panelThickness })!;
    // Abertura frontal tem folga em relação à litofania...
    expect(base.openingWidth + 2 * parts.clearance).toBeGreaterThan(base.openingWidth);
    // ...o rebaixo é mais fundo que o painel, e o batente sobra na frente.
    expect(parts.rebate).toBeGreaterThan(panelThickness);
    expect(parts.lip).toBeGreaterThan(0);
    expect(parts.lip).toBeLessThanOrEqual(parts.border);
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

describe("texturas da moldura", () => {
  const base = {
    openingWidth: 100,
    openingHeight: 150,
    border: 12,
    depth: 6,
    radius: 6,
    panelThickness: 3,
  };

  it("toda textura lista gera moldura com o mesmo aro externo", () => {
    for (const texture of FRAME_TEXTURES) {
      const geom = buildFrameGeometry({ ...base, texture: texture.id })!;
      geom.computeBoundingBox();
      const box = geom.boundingBox!;
      expect(box.max.x - box.min.x).toBeCloseTo(124, 3);
      expect(box.max.y - box.min.y).toBeCloseTo(174, 3);
      expect(geom.attributes.position.count).toBeGreaterThan(0);
    }
  });

  it("o relevo das texturas fica só na frente, sem mudar o aro", () => {
    const smooth = buildFrameGeometry({ ...base, texture: "smooth" })!;
    for (const id of ["molded", "carved"] as const) {
      const textured = buildFrameGeometry({ ...base, texture: id })!;
      expect(textured.attributes.position.count).toBeGreaterThan(smooth.attributes.position.count);
      expect(textured.boundingBox!.min.z).toBeCloseTo(0, 3);
      expect(textured.boundingBox!.max.z).toBeGreaterThan(base.depth);
      expect(textured.boundingBox!.max.z).toBeLessThanOrEqual(base.depth + 1.3);
    }
  });
});

describe("buildStandGeometry (cavalete)", () => {
  const base = { frameWidth: 200, frameHeight: 150, frameDepth: 6 };
  const floor = 3;
  const foot = 18;
  const clearance = 0.6;
  const groove = 6 + clearance;
  const standHeight = 18;

  it("apoia a moldura com o encaixe na espessura dela", () => {
    const geom = buildStandGeometry(base)!;
    geom.computeBoundingBox();
    const box = geom.boundingBox!;
    // Largura = largura da moldura, base mais funda para não tombar.
    expect(box.max.x - box.min.x).toBeCloseTo(200, 3);
    expect(box.max.z - box.min.z).toBeCloseTo(groove + 2 * foot, 3);
    // O fundo do encaixe fica na base da moldura.
    expect(box.min.y).toBeCloseTo(-base.frameHeight / 2 - floor, 3);
    expect(box.max.y).toBeCloseTo(-base.frameHeight / 2 - floor + standHeight, 3);
  });

  it("deixa o encaixe livre para a moldura entrar", () => {
    const geom = buildStandGeometry(base)!;
    const pos = geom.attributes.position;
    const centerZ = base.frameDepth / 2;
    const halfGroove = groove / 2;
    const bottom = -base.frameHeight / 2 + 0.5;
    const top = -base.frameHeight / 2 - floor + standHeight - 0.5;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const insideGroove =
        y > bottom && y < top && Math.abs(z - centerZ) < halfGroove - 1e-6;
      expect(insideGroove).toBe(false);
    }
  });

  it("moldura larga não gera base gigante", () => {
    const geom = buildStandGeometry({ ...base, frameWidth: 324 })!;
    geom.computeBoundingBox();
    expect(geom.boundingBox!.max.x - geom.boundingBox!.min.x).toBeCloseTo(200, 3);
  });

  it("medidas inválidas devolvem null", () => {
    expect(buildStandGeometry({ ...base, frameWidth: 0 })).toBeNull();
    expect(buildStandGeometry({ ...base, frameHeight: Number.NaN })).toBeNull();
    expect(buildStandGeometry({ ...base, frameDepth: 0 })).toBeNull();
  });
});
