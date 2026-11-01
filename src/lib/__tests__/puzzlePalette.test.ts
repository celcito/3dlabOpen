import { describe, expect, it } from "vitest";
import { ImagePixels } from "../puzzlePaintBake";
import { kmeansPalette, mergePalette, PaletteSlot } from "../puzzlePalette";

/** Solid image built from a color per pixel, row-major. */
function pixelsFrom(colors: Array<[number, number, number]>, width: number): ImagePixels {
  const data = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([r, g, b], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  return { width, height: colors.length / width, data };
}

/** 10×10: top half red, bottom half blue. */
const TWO_COLOR = pixelsFrom(
  Array.from({ length: 100 }, (_, i) =>
    (i < 50 ? [255, 0, 0] : [0, 0, 255]) as [number, number, number]
  ),
  10
);

const USER_SLOTS: PaletteSlot[] = [
  { name: "Filamento 1", color: "#FF0000", base: true },
  { name: "Filamento 2", color: "#0000FF", base: false },
];

describe("kmeansPalette", () => {
  it("é determinística: mesma imagem + seed → mesma paleta", () => {
    const a = kmeansPalette(TWO_COLOR, 4, 42);
    const b = kmeansPalette(TWO_COLOR, 4, 42);
    expect(a).toEqual(b);
  });

  it("K=0 retorna vazio", () => {
    expect(kmeansPalette(TWO_COLOR, 0)).toEqual([]);
  });

  it("encontra as cores dominantes de uma imagem de 2 cores", () => {
    const colors = kmeansPalette(TWO_COLOR, 2, 7);
    expect(colors).toHaveLength(2);
    const flat = colors.map(c => `${c.r},${c.g},${c.b}`);
    expect(flat).toContain("255,0,0");
    expect(flat).toContain("0,0,255");
  });

  it("K > cores distintas → retorna no máximo K (clusters vazios descartados)", () => {
    const colors = kmeansPalette(TWO_COLOR, 8, 42);
    expect(colors.length).toBeLessThanOrEqual(8);
    expect(colors.length).toBeGreaterThanOrEqual(2);
  });

  it("amostra ≤10k pixels de imagem grande e segue determinístico", () => {
    const gradient = pixelsFrom(
      Array.from({ length: 12_000 }, (_, i) => [
        (i * 7) % 256,
        (i * 13) % 256,
        (i * 29) % 256,
      ] as [number, number, number]),
      120
    );
    const a = kmeansPalette(gradient, 4, 99);
    const b = kmeansPalette(gradient, 4, 99);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(4);
    expect(a).toEqual(b);
  });
});

describe("mergePalette", () => {
  it("K=0 → apenas slots do usuário intactos", () => {
    const autos = kmeansPalette(TWO_COLOR, 0);
    const palette = mergePalette(USER_SLOTS, autos);
    expect(palette).toEqual(USER_SLOTS);
  });

  it("descarta cor próxima (RGB dist < 30) e mantém a distante como Auto_1", () => {
    const palette = mergePalette(USER_SLOTS, [
      { r: 250, g: 5, b: 5 }, // ~7 de distância de #FF0000 → dedup
      { r: 0, g: 255, b: 0 }, // distante → extra
    ]);
    expect(palette).toHaveLength(3);
    expect(palette[0]).toEqual(USER_SLOTS[0]);
    expect(palette[1]).toEqual(USER_SLOTS[1]);
    expect(palette[2]).toEqual({ name: "Auto_1", color: "#00FF00", base: false });
  });

  it("dedup também entre cores automáticas", () => {
    const palette = mergePalette(USER_SLOTS, [
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 255, g: 255, b: 0 },
    ]);
    expect(palette.map(s => s.name)).toEqual([
      "Filamento 1",
      "Filamento 2",
      "Auto_1",
      "Auto_2",
    ]);
  });

  it("cap 16 respeitado com prioridade dos slots do usuário", () => {
    const autoColors = Array.from({ length: 20 }, (_, i) => ({
      r: (i % 6) * 51,
      g: (Math.floor(i / 6) % 6) * 51,
      b: Math.floor(i / 36) * 51,
    }));
    const palette = mergePalette(USER_SLOTS, autoColors, { cap: 16 });

    expect(palette).toHaveLength(16);
    expect(palette.slice(0, 2)).toEqual(USER_SLOTS);
    const autoNames = palette.slice(2).map(s => s.name);
    expect(autoNames[0]).toBe("Auto_1");
    autoNames.forEach((name, i) => expect(name).toBe(`Auto_${i + 1}`));
  });
});
