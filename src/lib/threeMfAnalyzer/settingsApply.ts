import type { FixId, PresetId } from "./types";
import { RULES } from "./rules";

export const PRESETS: Record<PresetId, { label: string; settings: Record<string, string> }> = {
  detalhe: { label: "Detalhe", settings: { layer_height: "0.12", wall_loops: "3", sparse_infill_density: "15" } },
  equilibrado: { label: "Equilibrado", settings: { layer_height: "0.2", wall_loops: "3", sparse_infill_density: "15" } },
  rapido: { label: "Rápido", settings: { layer_height: "0.28", wall_loops: "3", sparse_infill_density: "10" } },
};

const SETTINGS_FIXES: FixId[] = ["S1", "S2", "S3", "S5"];

export interface SettingsFixes {
  settings: Record<string, unknown> | null;
  /** Remove `Metadata/plate_*.gcode` e `SliceInfo.config` (ficariam obsoletos). */
  removeStaleSlice: boolean;
  applied: FixId[];
  appliedKeys: string[];
  /** Precisa de novo fatiamento para gerar G-code novo. */
  refatizar: boolean;
}

export function applySettingsFixes(
  settings: Record<string, unknown> | null,
  enabled: FixId[],
  preset: PresetId,
  hasOverhang: boolean
): SettingsFixes {
  const on = new Set(enabled.filter((id) => id.startsWith("S")));
  const applied: FixId[] = [];
  const appliedKeys: string[] = [];
  const out = settings ? { ...settings } : null;

  for (const fix of SETTINGS_FIXES) {
    if (!on.has(fix)) continue;
    switch (fix) {
      case "S1": {
        if (!out) break;
        const keys = Object.keys(PRESETS[preset].settings);
        const changed = keys.filter((key) => String(out[key] ?? "") !== PRESETS[preset].settings[key]);
        if (changed.length === 0) break;
        Object.assign(out, PRESETS[preset].settings);
        appliedKeys.push(...changed);
        applied.push(fix);
        break;
      }
      case "S2": {
        if (!out) break;
        const wanted = hasOverhang ? "true" : "false";
        if (String(out.enable_support ?? "false") === wanted) break;
        out.enable_support = wanted;
        appliedKeys.push("enable_support");
        applied.push(fix);
        break;
      }
      case "S3": {
        if (!out) break;
        const wanted = String(RULES.C4_ELEPHANT_FOOT_MM.value);
        if (String(out.elephant_foot_compensation ?? "0") === wanted) break;
        out.elephant_foot_compensation = wanted;
        appliedKeys.push("elephant_foot_compensation");
        applied.push(fix);
        break;
      }
      case "S5": {
        if (!out) break;
        if (String(out.brim_type ?? "none") === "brim" && String(out.brim_width ?? "0") === "5") break;
        out.brim_type = "brim";
        out.brim_width = "5";
        appliedKeys.push("brim_type", "brim_width");
        applied.push(fix);
        break;
      }
    }
  }

  // S4: qualquer correção deixa o fatiado anterior obsoleto — o G-code
  // embutido e o SliceInfo.config deixam de corresponder ao pacote.
  const removeStaleSlice = applied.length > 0 && on.has("S4");
  const finalApplied: FixId[] = removeStaleSlice ? [...applied, "S4"] : applied;

  return {
    settings: out,
    removeStaleSlice,
    applied: finalApplied,
    appliedKeys,
    refatizar: finalApplied.length > 0,
  };
}
