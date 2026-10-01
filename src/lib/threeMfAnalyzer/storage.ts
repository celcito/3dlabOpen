import type { FixId, PresetId } from "./types";

const STORAGE_KEY = "analisador3mf.prefs";

export const MESH_FIXES: FixId[] = ["M1", "M2", "M3", "M4", "M5", "M6", "M7"];
export const SETTINGS_FIXES: FixId[] = ["S1", "S2", "S3", "S4", "S5"];
export const TOGGLABLE_FIXES: FixId[] = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "S1", "S2", "S3", "S5"];

export interface AnalyzerPreferences {
  preset: PresetId;
  fixes: FixId[];
}

const DEFAULT_PREFERENCES: AnalyzerPreferences = { preset: "equilibrado", fixes: [...TOGGLABLE_FIXES] };

const PRESETS: PresetId[] = ["detalhe", "equilibrado", "rapido"];

export function loadPreferences(): AnalyzerPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AnalyzerPreferences>;
    const fixes = Array.isArray(parsed.fixes)
      ? TOGGLABLE_FIXES.filter((id) => (parsed.fixes as string[]).includes(id))
      : DEFAULT_PREFERENCES.fixes;
    const preset = PRESETS.includes(parsed.preset as PresetId) ? (parsed.preset as PresetId) : "equilibrado";
    return { preset, fixes };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: AnalyzerPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    /* armazenamento indisponível — as preferências ficam só em memória */
  }
}
