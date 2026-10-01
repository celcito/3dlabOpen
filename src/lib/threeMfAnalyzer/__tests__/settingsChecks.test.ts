import { describe, expect, it } from "vitest";
import { runSettingsChecks } from "../settingsChecks";

const base = {
  settings: {},
  kind: "model" as const,
  hasOverhang: false,
  touchingBed: true,
  footprint: 40,
  height: 20,
  modelColors: 1,
};

function byId(issues: ReturnType<typeof runSettingsChecks>, id: string) {
  const issue = issues.find((i) => i.id === id);
  if (!issue) throw new Error(`issue ${id} não emitido`);
  return issue;
}

describe("runSettingsChecks (C1–C6)", () => {
  it("aceita layer 0,2 mm num bico de 0,4 (50%)", () => {
    const issues = runSettingsChecks({ ...base, settings: { nozzle_diameter: ["0.4"], layer_height: "0.2" } });
    const c1 = byId(issues, "C1");
    expect(c1.severity).toBe("info");
    expect(c1.fixId).toBeUndefined();
  });

  it("rejeita layer 0,4 mm no mesmo bico (100%) e sugere S1", () => {
    const issues = runSettingsChecks({ ...base, settings: { nozzle_diameter: ["0.4"], layer_height: "0.4" } });
    const c1 = byId(issues, "C1");
    expect(c1.severity).toBe("warning");
    expect(c1.fixId).toBe("S1");
  });

  it("exige wall_loops >= 3", () => {
    const issues = runSettingsChecks({ ...base, settings: { wall_loops: "1" } });
    const c2 = byId(issues, "C2");
    expect(c2.severity).toBe("warning");
    expect(c2.fixId).toBe("S1");
    expect(byId(runSettingsChecks({ ...base, settings: { wall_loops: "3" } }), "C2").severity).toBe("info");
  });

  it("pede suporte quando há overhang e o suporte está desligado", () => {
    const issues = runSettingsChecks({ ...base, hasOverhang: true, settings: { enable_support: "false" } });
    const c3 = byId(issues, "C3");
    expect(c3.severity).toBe("warning");
    expect(c3.fixId).toBe("S2");
  });

  it("não pede suporte quando não há overhang", () => {
    const issues = runSettingsChecks({ ...base, hasOverhang: false, settings: { enable_support: "false" } });
    expect(byId(issues, "C3").severity).toBe("info");
  });

  it("cobra compensação de pé de elefante em peça que toca a mesa", () => {
    const issues = runSettingsChecks({ ...base, touchingBed: true, settings: { elephant_foot_compensation: "0" } });
    const c4 = byId(issues, "C4");
    expect(c4.severity).toBe("warning");
    expect(c4.fixId).toBe("S3");
    expect(
      byId(runSettingsChecks({ ...base, touchingBed: true, settings: { elephant_foot_compensation: "0.2" } }), "C4")
        .severity
    ).toBe("info");
  });

  it("pede brim para base menor que 20 mm", () => {
    const issues = runSettingsChecks({ ...base, footprint: 10, settings: { brim_type: "none" } });
    const c5 = byId(issues, "C5");
    expect(c5.severity).toBe("warning");
    expect(c5.fixId).toBe("S5");
    expect(byId(runSettingsChecks({ ...base, footprint: 10, settings: { brim_type: "brim" } }), "C5").severity).toBe(
      "info"
    );
    expect(byId(runSettingsChecks({ ...base, footprint: 60, settings: { brim_type: "none" } }), "C5").severity).toBe(
      "info"
    );
  });

  it("sempre emite C6 como dica", () => {
    const issues = runSettingsChecks({ ...base, settings: { filament_colour: ["#FF0000"] }, modelColors: 3 });
    const c6 = byId(issues, "C6");
    expect(c6.severity).toBe("info");
    expect(c6.detail).toContain("3 cor(es)");
  });

  it("sempre emite exatamente C1–C6", () => {
    const issues = runSettingsChecks(base);
    expect(issues.map((i) => i.id)).toEqual(["C1", "C2", "C3", "C4", "C5", "C6"]);
  });
});
