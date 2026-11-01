import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadPlaqueCollection, savePlaqueCollection } from "../storage";
import { defaultPlaque, type Plaque } from "../plaque";

function plainPlaque(label: string): Plaque {
  const plaque = defaultPlaque("placa");
  plaque.topper.text = "";
  plaque.label = label;
  return plaque;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("coleção de plaquinhas (localStorage)", () => {
  it("roundtrip: salva e recarrega intacto", () => {
    const plaques = [plainPlaque("Entrada"), defaultPlaque("nome-silhueta")];
    plaques[1].label = "Nome Bonito";
    expect(savePlaqueCollection(plaques)).toBe(true);

    const loaded = loadPlaqueCollection();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].label).toBe("Entrada");
    expect(loaded[0].style).toBe("placa");
    expect(loaded[1].label).toBe("Nome Bonito");
    expect(loaded[1].style).toBe("nome-silhueta");
    expect(loaded[1].name.loopEnabled).toBe(false);
    expect(loaded[0].topper.sticks).toHaveLength(plaques[0].topper.sticks.length);
  });

  it("retorna [] para lixo/chave inexistente", () => {
    expect(loadPlaqueCollection()).toEqual([]);
    localStorage.setItem("topo_bolo_placas_v1", "{not json");
    expect(loadPlaqueCollection()).toEqual([]);
    localStorage.setItem("topo_bolo_placas_v1", JSON.stringify({ weird: true }));
    expect(loadPlaqueCollection()).toEqual([]);
  });

  it("descarta plaquinhas com estilo inválido e força loopEnabled false", () => {
    const valid = plainPlaque("Ok");
    const raw = [
      valid,
      { ...plainPlaque("Ruim"), style: "chaveiro" },
      { id: "x", label: "sem-style", style: "nome-placa", topper: {}, name: { loopEnabled: true, text: "Ana" } },
    ];
    localStorage.setItem("topo_bolo_placas_v1", JSON.stringify(raw));

    const loaded = loadPlaqueCollection();
    expect(loaded.map((p) => p.label)).toEqual(["Ok", "sem-style"]);
    expect(loaded[1].name.loopEnabled).toBe(false);
    expect(loaded[1].name.text).toBe("Ana");
    // topper vazio recebe defaults
    expect(loaded[1].topper.plateWidth).toBeGreaterThan(0);
    expect(loaded[1].topper.sticks.length).toBeGreaterThan(0);
  });

  it("clamp de valores fora de faixa", () => {
    const plaque = plainPlaque("Clamp");
    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, plateWidth: 99999, stickCount: -5, fontSize: 0 } }])
    );
    const [loaded] = loadPlaqueCollection();
    expect(loaded.topper.plateWidth).toBeLessThanOrEqual(400);
    expect(loaded.topper.fontSize).toBeGreaterThanOrEqual(4);
    expect(loaded.topper.stickCount).toBe(0);
  });

  it("preserva e clampa stickZOffset; ausente cai no default 0", () => {
    const plaque = plainPlaque("Offset");
    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, stickZOffset: 7 } }])
    );
    expect(loadPlaqueCollection()[0].topper.stickZOffset).toBe(7);

    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, stickZOffset: 999 } }])
    );
    expect(loadPlaqueCollection()[0].topper.stickZOffset).toBe(30);

    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, stickZOffset: undefined } }])
    );
    expect(loadPlaqueCollection()[0].topper.stickZOffset).toBe(0);
  });

  it("stickSpacing: número explícito preservado; null/lixo vira null (auto)", () => {
    const plaque = plainPlaque("Spacing");
    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, stickSpacing: 30 } }])
    );
    expect(loadPlaqueCollection()[0].topper.stickSpacing).toBe(30);

    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, stickSpacing: null } }])
    );
    expect(loadPlaqueCollection()[0].topper.stickSpacing).toBeNull();

    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, stickSpacing: "abc" } }])
    );
    expect(loadPlaqueCollection()[0].topper.stickSpacing).toBeNull();
  });

  it("plateShape: id válido preservado; desconhecido/svgsemdados caem em retangulo", () => {
    const plaque = plainPlaque("Forma");
    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, plateShape: "coracao" } }])
    );
    expect(loadPlaqueCollection()[0].topper.plateShape).toBe("coracao");

    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, plateShape: "formainvalida" } }])
    );
    expect(loadPlaqueCollection()[0].topper.plateShape).toBe("retangulo");

    // "svg" sem dados válidos não pode virar forma de SVG
    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, plateShape: "svg", plateShapeSvg: null } }])
    );
    expect(loadPlaqueCollection()[0].topper.plateShape).toBe("retangulo");

    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, plateShape: 12345 } }])
    );
    expect(loadPlaqueCollection()[0].topper.plateShape).toBe("retangulo");
  });

  it("plateShapeSvg: markup preservado; capado acima do limite; lixo vira null", () => {
    const plaque = plainPlaque("Svg");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="#000"/></svg>';
    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, plateShape: "svg", plateShapeSvg: svg } }])
    );
    const [loaded] = loadPlaqueCollection();
    expect(loaded.topper.plateShape).toBe("svg");
    expect(loaded.topper.plateShapeSvg).toBe(svg);

    // > 100KB → null e a forma volta para retangulo
    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([
        { ...plaque, topper: { ...plaque.topper, plateShape: "svg", plateShapeSvg: "<svg>" + "a".repeat(110_000) + "</svg>" } },
      ])
    );
    const [big] = loadPlaqueCollection();
    expect(big.topper.plateShapeSvg).toBeNull();
    expect(big.topper.plateShape).toBe("retangulo");

    // não-string → null
    localStorage.setItem(
      "topo_bolo_placas_v1",
      JSON.stringify([{ ...plaque, topper: { ...plaque.topper, plateShapeSvg: { evil: true } } }])
    );
    expect(loadPlaqueCollection()[0].topper.plateShapeSvg).toBeNull();
  });

  it("fallback sem customFontBase64 quando estoura quota", () => {
    const plaque = plainPlaque("Grande");
    plaque.name.customFontBase64 = "A".repeat(1000);
    const spy = vi.spyOn(Storage.prototype, "setItem");
    spy.mockImplementationOnce(() => {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    expect(savePlaqueCollection([plaque])).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
    const saved = spy.mock.calls[1][1] as string;
    expect(saved).not.toContain("customFontBase64");

    spy.mockRestore();
    expect(loadPlaqueCollection()).toHaveLength(1);
  });
});
