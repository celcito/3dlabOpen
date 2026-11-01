import { describe, expect, it } from "vitest";
import type * as THREE from "three";
import { DEFAULT_TOPPER_CONFIG, createTextGeometry } from "../cakeTopperGeometry";

const FONT = DEFAULT_TOPPER_CONFIG.fontFamily;

function allFinite(geometry: THREE.BufferGeometry): boolean {
  const pos = geometry.getAttribute("position");
  if (!pos) return false;
  for (let i = 0; i < pos.array.length; i++) {
    if (!Number.isFinite(pos.array[i] as number)) return false;
  }
  return true;
}

describe("createTextGeometry — regressão do bug de NaN com espaços (T9)", () => {
  it("texto com espaço e letterSpacing > 0 gera geometria finita", async () => {
    const { geometry, width, height } = await createTextGeometry("Feliz Aniversário", FONT, 14, 2, 0.5);
    expect(geometry.getAttribute("position")!.count).toBeGreaterThan(0);
    expect(allFinite(geometry)).toBe(true);
    expect(Number.isFinite(width)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  }, 20000);

  it("só espaços devolve geometria vazia com dimensões 0", async () => {
    const { geometry, width, height } = await createTextGeometry("   ", FONT, 14, 2, 0.5);
    expect(geometry.getAttribute("position")?.count ?? 0).toBe(0);
    expect(width).toBe(0);
    expect(height).toBe(0);
  }, 20000);

  it("export da plaquinha placa com texto padrão não tem NaN", async () => {
    const { buildPlaqueParts } = await import("../plaqueGeometry");
    const { defaultPlaqueNameConfig } = await import("../plaque");
    const parts = await buildPlaqueParts({
      id: "t",
      label: "t",
      style: "placa",
      topper: DEFAULT_TOPPER_CONFIG,
      name: defaultPlaqueNameConfig(),
    });
    for (const part of parts) {
      for (const geom of part.geoms) {
        expect(allFinite(geom)).toBe(true);
      }
    }
  }, 20000);
});
