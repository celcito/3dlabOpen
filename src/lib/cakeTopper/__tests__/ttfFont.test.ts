import { readFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { createTextGeometry } from "../cakeTopperGeometry";
import { BLUEY_FONT_URL } from "../bluey";
import { isTtfFontUrl, isTtfTopperFontAvailable, opentypeFontToTypeface } from "../ttfFont";

/** Um .ttf empacotado serve de dublê para a fonte Bluey nos testes. */
const TTF_PATH = "public/fonts/Super Mario 256.ttf";

function ttfBuffer(): ArrayBuffer {
  const buf = readFileSync(TTF_PATH);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function stubFetch(available: boolean) {
  const bytes = available ? ttfBuffer() : null;
  vi.stubGlobal("fetch", async (url: string) => {
    if (String(url) === BLUEY_FONT_URL && bytes) return new Response(bytes, { status: 200 });
    return new Response(null, { status: 404 });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fonte TTF do topo de bolo", () => {
  it("reconhece .ttf como fonte local (e ignora URLs de typeface JSON)", () => {
    expect(isTtfFontUrl("/fonts/Bluey.ttf")).toBe(true);
    expect(isTtfFontUrl("/fonts/Bluey.ttf?v=2")).toBe(true);
    expect(isTtfFontUrl("https://example.com/helvetiker_bold.typeface.json")).toBe(false);
  });

  it("converte o TTF no formato do three preservando os furos das letras", async () => {
    const opentype = await import("opentype.js");
    const parsed = opentype.parse(ttfBuffer());
    const font = new Font(opentypeFontToTypeface(parsed));
    const shapes = font.generateShapes("B", 10);
    expect(shapes.length).toBe(1);
    // "B" tem dois contornos internos (furos) — sem eles a letra sairia maciça.
    expect(shapes[0].holes.length).toBe(2);
  });

  it("aceita a fonte com o mesmo nome em .otf quando falta o .ttf", async () => {
    const bytes = ttfBuffer();
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).endsWith("/Bluey.otf")) return new Response(bytes, { status: 200 });
      return new Response(null, { status: 404 });
    });
    expect(await isTtfTopperFontAvailable(BLUEY_FONT_URL)).toBe(true);
  });

  it("gera geometria de texto a partir de public/fonts/Bluey.ttf", async () => {
    stubFetch(true);
    const { geometry, width, height } = await createTextGeometry("BLUEY", BLUEY_FONT_URL, 1, 0.2, 0.05);
    expect(geometry.getAttribute("position")?.count ?? 0).toBeGreaterThan(0);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});
