import { describe, expect, it } from "vitest";
import { analyzePackage } from "../packageReader";
import { makeBambu3mf, makeModel3mf, makeSimple3mf, torusModelXml } from "./fixtures";

const SETTINGS = "Metadata/project_settings.config";
const PROFILE_IDS = ["C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "C15", "C16"];

function withSettings(settings: Record<string, unknown>, size?: [number, number, number]): ArrayBuffer {
  return makeSimple3mf(size ? { size } : {}, { [SETTINGS]: JSON.stringify(settings) });
}

function profileIds(issues: { id: string }[]): string[] {
  return issues.map((i) => i.id).filter((id) => PROFILE_IDS.includes(id));
}

describe("perfis de processo (C7–C16)", () => {
  it("sem project_settings não emite perfis", async () => {
    const { result } = await analyzePackage(makeSimple3mf());
    expect(profileIds(result.issues)).toEqual([]);
  });

  it("fixture Bambu padrão não dispara nenhum perfil", async () => {
    const { result } = await analyzePackage(makeBambu3mf());
    expect(profileIds(result.issues)).toEqual([]);
  });

  it("todo problema de perfil é info em 'settings' com fonte", async () => {
    const { result } = await analyzePackage(withSettings({ wall_generator: "arachne" }, [10, 10, 50]));
    const profiles = result.issues.filter((i) => PROFILE_IDS.includes(i.id));
    expect(profiles.length).toBeGreaterThan(0);
    for (const issue of profiles) {
      expect(issue.severity).toBe("info");
      expect(issue.category).toBe("settings");
      expect(issue.source).toContain("bambu-labs");
    }
  });

  it("C7 ativo: wall_generator arachne ou seam_position back", async () => {
    const a = await analyzePackage(withSettings({ wall_generator: "arachne" }, [10, 10, 50]));
    const c7 = a.result.issues.find((i) => i.id === "C7");
    expect(c7?.title).toContain("Perfil ativo: Texto e letras");
    expect(c7?.detail).toContain("wall_generator=arachne");

    const b = await analyzePackage(withSettings({ seam_position: "back" }, [10, 10, 50]));
    expect(b.result.issues.some((i) => i.id === "C7")).toBe(true);
  });

  it("C8 ativo: layer_height ≤ 0,08 mm", async () => {
    const { result } = await analyzePackage(withSettings({ layer_height: "0.08" }, [10, 10, 50]));
    const c8 = result.issues.find((i) => i.id === "C8");
    expect(c8?.title).toContain("Perfil ativo: Miniatura");
  });

  it("C9 ativo: spiral_mode 1", async () => {
    const { result } = await analyzePackage(withSettings({ spiral_mode: "1" }, [10, 10, 50]));
    const c9 = result.issues.find((i) => i.id === "C9");
    expect(c9?.title).toContain("Perfil ativo: Vaso");
  });

  it("C10 ativo: xy_hole_compensation ou precise_outer_wall", async () => {
    const a = await analyzePackage(withSettings({ xy_hole_compensation: "0.2" }, [10, 10, 50]));
    const c10 = a.result.issues.find((i) => i.id === "C10");
    expect(c10?.title).toContain("Perfil ativo: Ajuste funcional");

    const b = await analyzePackage(withSettings({ precise_outer_wall: "1" }, [10, 10, 50]));
    expect(b.result.issues.some((i) => i.id === "C10")).toBe(true);
  });

  it("C11 ativo: brim + primeira camada lenta; ignora brim rápido", async () => {
    const ok = await analyzePackage(
      withSettings({ brim_type: "auto_brim", initial_layer_speed: "16" }, [10, 10, 50])
    );
    const c11 = ok.result.issues.find((i) => i.id === "C11");
    expect(c11?.title).toContain("Perfil ativo: Placa grande");

    const fast = await analyzePackage(
      withSettings({ brim_type: "auto_brim", initial_layer_speed: "60" }, [10, 10, 50])
    );
    expect(fast.result.issues.some((i) => i.id === "C11")).toBe(false);
  });

  it("C12 ativo: ironing ligado; ignora 'no ironing'", async () => {
    const on = await analyzePackage(withSettings({ ironing_type: "top_surfaces" }, [10, 10, 50]));
    expect(on.result.issues.some((i) => i.id === "C12")).toBe(true);

    const off = await analyzePackage(withSettings({ ironing_type: "no ironing" }, [10, 10, 50]));
    expect(off.result.issues.some((i) => i.id === "C12")).toBe(false);
  });

  it("C13 ativo: top_surface_pattern hilbertcurve", async () => {
    const { result } = await analyzePackage(withSettings({ top_surface_pattern: "hilbertcurve" }, [10, 10, 50]));
    expect(result.issues.some((i) => i.id === "C13")).toBe(true);
  });

  it("C14 ativo: fuzzy_skin contour; ignora none", async () => {
    const on = await analyzePackage(withSettings({ fuzzy_skin: "contour" }, [10, 10, 50]));
    expect(on.result.issues.some((i) => i.id === "C14")).toBe(true);

    const off = await analyzePackage(withSettings({ fuzzy_skin: "none" }, [10, 10, 50]));
    expect(off.result.issues.some((i) => i.id === "C14")).toBe(false);
  });

  it("C15 ativo: has_scarf_joint_seam 1", async () => {
    const { result } = await analyzePackage(withSettings({ has_scarf_joint_seam: "1" }, [10, 10, 50]));
    expect(result.issues.some((i) => i.id === "C15")).toBe(true);
  });

  it("C16 ativo: elephant_foot_compensation > 0", async () => {
    const { result } = await analyzePackage(withSettings({ elephant_foot_compensation: "0.2" }, [10, 10, 50]));
    expect(result.issues.some((i) => i.id === "C16")).toBe(true);
  });

  it("C8 recomendado: cubo pequeno (envolvente ≤ 30 mm)", async () => {
    const { result } = await analyzePackage(makeSimple3mf({ size: [20, 20, 20] }, { [SETTINGS]: "{}" }));
    const c8 = result.issues.find((i) => i.id === "C8");
    expect(c8?.title).toContain("Perfil recomendado: Miniatura");
    expect(c8?.detail).toContain("Motivo da recomendação");
  });

  it("C7 recomendado: chapa fina (menor eixo < 0,8 mm)", async () => {
    const { result } = await analyzePackage(makeSimple3mf({ size: [0.6, 40, 40] }, { [SETTINGS]: "{}" }));
    const c7 = result.issues.find((i) => i.id === "C7");
    expect(c7?.title).toContain("Perfil recomendado: Texto e letras");
  });

  it("C11 recomendado: peça ≥ 150 mm na cama", async () => {
    const { result } = await analyzePackage(makeSimple3mf({ size: [160, 40, 10] }, { [SETTINGS]: "{}" }));
    const c11 = result.issues.find((i) => i.id === "C11");
    expect(c11?.title).toContain("Perfil recomendado: Placa grande");
  });

  it("C10 recomendado: toro fechado (gênero 1)", async () => {
    const { result } = await analyzePackage(makeModel3mf(torusModelXml(), { [SETTINGS]: "{}" }));
    expect(result.objects[0].genus).toBe(1);
    const c10 = result.issues.find((i) => i.id === "C10");
    expect(c10?.title).toContain("Perfil recomendado: Ajuste funcional");
    expect(c10?.detail).toContain("gênero 1");
  });

  it("detecção + recomendação combinadas no mesmo perfil", async () => {
    const { result } = await analyzePackage(withSettings({ layer_height: "0.08" }, [10, 10, 10]));
    const c8 = result.issues.find((i) => i.id === "C8");
    expect(c8?.title).toContain("Perfil ativo: Miniatura");
    expect(c8?.detail).toContain("Motivo da recomendação");
  });
});
