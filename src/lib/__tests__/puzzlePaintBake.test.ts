import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { bakePaintForGeometry, ImagePixels, loadImagePixels } from "../puzzlePaintBake";

const PNG_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const SVG_URL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='2' height='2'><rect width='2' height='2' fill='red'/></svg>";

/** Fake browser Image: fires onload (or onerror for bad URLs) without decoding. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string | null = null;
  naturalWidth = 2;
  naturalHeight = 2;
  width = 2;
  height = 2;
  private _src = "";
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      if (value.includes("bad")) this.onerror?.();
      else this.onload?.();
    });
  }
  get src() {
    return this._src;
  }
}

function stubCanvasPixels(fill = 128) {
  const getImageData = vi.fn((x: number, y: number, w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4).fill(fill),
  }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    getImageData,
  } as unknown as CanvasRenderingContext2D);
  return { getImageData };
}

/** Front quad (real UVs) + side quad (degenerate UV), non-indexed. */
function makePieceGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        // front T1
        0, 0, 0, 1, 0, 0, 0, 1, 0,
        // front T2
        1, 0, 0, 1, 1, 0, 0, 1, 0,
        // side T3 (UV pinned to 0,0)
        1, 0, 0, 1, 0, -1, 0, 1, -1,
        // side T4 (UV pinned to 0,0)
        1, 0, -1, 0, 1, -1, 0, 1, 0,
      ],
      3
    )
  );
  geom.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      [
        // front T1
        0, 1, 1, 1, 0, 0,
        // front T2
        1, 1, 1, 0, 0, 0,
        // sides
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
      ],
      2
    )
  );
  return geom;
}

function makePixels(): ImagePixels {
  // 2×2: top row red/green, bottom row blue/white (row 0 = image top = v=1)
  return {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255,
    ]),
  };
}

const PALETTE = [
  { color: "#FF0000" },
  { color: "#0000FF" },
  { color: "#FFFFFF" },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadImagePixels", () => {
  it("resolve PNG data URL em pixels RGBA", async () => {
    vi.stubGlobal("Image", FakeImage);
    const { getImageData } = stubCanvasPixels(200);

    const pixels = await loadImagePixels(PNG_URL);

    expect(pixels.width).toBe(2);
    expect(pixels.height).toBe(2);
    expect(pixels.data).toHaveLength(16);
    expect(pixels.data[0]).toBe(200);
    expect(getImageData).toHaveBeenCalledWith(0, 0, 2, 2);
  });

  it("resolve SVG data URL (rasterizado via canvas)", async () => {
    vi.stubGlobal("Image", FakeImage);
    stubCanvasPixels(0);

    const pixels = await loadImagePixels(SVG_URL);

    expect(pixels.width).toBe(2);
    expect(pixels.height).toBe(2);
    expect(pixels.data).toHaveLength(16);
  });

  it("rejeita quando a imagem falha ao carregar", async () => {
    vi.stubGlobal("Image", FakeImage);
    stubCanvasPixels();

    await expect(loadImagePixels("data:image/png;base64,bad")).rejects.toThrow(
      /Falha ao carregar imagem/
    );
  });
});

describe("bakePaintForGeometry", () => {
  it("pinta triângulos frontais com o slot mais próximo e deixa laterais em 0", () => {
    const geometry = makePieceGeometry();
    const states = bakePaintForGeometry(geometry, makePixels(), PALETTE);

    expect(states).toHaveLength(4);
    // T1 centroide → pixel (0,0) vermelho → slot 1
    // T2 centroide → pixel (1,1) branco → slot 3
    expect(Array.from(states)).toEqual([1, 3, 0, 0]);
  });

  it("processa geometria indexada normalizando para a ordem de serialização", () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3)
    );
    geom.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)
    );
    geom.setIndex([0, 1, 2, 0, 2, 3]);

    const states = bakePaintForGeometry(geom, makePixels(), PALETTE);

    expect(states).toHaveLength(2);
    expect(states[0]).toBeGreaterThan(0);
    expect(states[1]).toBeGreaterThan(0);
  });

  it("geometria sem UV → array de zeros, sem exceção", () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
    );

    const states = bakePaintForGeometry(geom, makePixels(), PALETTE);

    expect(states).toHaveLength(1);
    expect(states[0]).toBe(0);
  });

  it("paleta vazia → array de zeros", () => {
    const states = bakePaintForGeometry(makePieceGeometry(), makePixels(), []);
    expect(Array.from(states)).toEqual([0, 0, 0, 0]);
  });
});
