import type { Issue, PackageKind } from "./types";
import { RULES, SOURCES } from "./rules";

export interface SettingsContext {
  settings: Record<string, unknown>;
  kind: PackageKind;
  hasOverhang: boolean;
  touchingBed: boolean;
  footprint: number;
  height: number;
  modelColors?: number;
}

/** Lê um número de `project_settings.config` (string, number ou array de uma peça). */
export function num(settings: Record<string, unknown>, key: string, fallback: number): number {
  const raw = settings[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function bool(settings: Record<string, unknown>, key: string): boolean {
  const raw = settings[key];
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw.toLowerCase() === "true" || raw === "1";
  return false;
}

export function str(settings: Record<string, unknown>, key: string, fallback = ""): string {
  const raw = settings[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : fallback;
}

function brimEnabled(settings: Record<string, unknown>): boolean {
  const type = str(settings, "brim_type", "none").toLowerCase();
  if (type === "no_brim" || type === "no brim") return false;
  if (type && type !== "none" && type !== "") return true;
  return num(settings, "brim_width", 0) > 0;
}

export function runSettingsChecks(ctx: SettingsContext): Issue[] {
  const { settings } = ctx;
  const issues: Issue[] = [];
  const nozzle = num(settings, "nozzle_diameter", RULES.C_NOZZLE_MM.value);
  const layer = num(settings, "layer_height", 0.2);
  const ratio = nozzle > 0 ? layer / nozzle : 0;
  const ratioOk = ratio >= RULES.C1_LAYER_RATIO_MIN.value && ratio <= RULES.C1_LAYER_RATIO_MAX.value;

  issues.push({
    id: "C1",
    category: "settings",
    severity: ratioOk ? "info" : "warning",
    title: ratioOk ? `Altura de camada ${layer} mm é proporcional ao bico` : `Altura de camada fora de 25–75% do bico`,
    detail: `layer_height ${layer} mm ÷ bico ${nozzle} mm = ${(ratio * 100).toFixed(0)}% (faixa 25–75%).`,
    hint: ratioOk
      ? "Nada a fazer."
      : "Aplique um preset (S1): Detalhe 0,12 · Equilibrado 0,2 · Rápido 0,28 — todos dentro da faixa para bico 0,4.",
    source: SOURCES.layerHeight,
    ...(ratioOk ? {} : { fixId: "S1" as const }),
  });

  const walls = num(settings, "wall_loops", 0);
  const wallsOk = walls >= RULES.C2_MIN_WALL_LOOPS.value;
  issues.push({
    id: "C2",
    category: "settings",
    severity: wallsOk ? "info" : "warning",
    title: wallsOk ? `${walls} perímetros de parede` : `Apenas ${walls} perímetro(s) de parede`,
    detail: `wall_loops = ${walls} · parede funcional exige ≥ ${RULES.C2_MIN_WALL_LOOPS.value} perímetros (1,2 mm @ bico 0,4).`,
    hint: wallsOk ? "Nada a fazer." : "Os presets (S1) sobem wall_loops para 3 (1,2 mm de parede).",
    source: SOURCES.wallTolerance,
    ...(wallsOk ? {} : { fixId: "S1" as const }),
  });

  const support = bool(settings, "enable_support");
  const needsSupport = ctx.hasOverhang;
  const supportOk = !needsSupport || support;
  issues.push({
    id: "C3",
    category: "settings",
    severity: supportOk ? "info" : "warning",
    title: supportOk ? "Suportes consistentes com a geometria" : "Overhang sem suporte habilitado",
    detail: `enable_support = ${support ? "true" : "false"} · geometria com overhang: ${needsSupport ? "sim" : "não"}.`,
    hint: supportOk ? "Nada a fazer." : "Ative os suportes com S2 — ou gere a peça sem suporte reduzindo o overhang (B7).",
    source: SOURCES.overhangDesign,
    ...(supportOk ? {} : { fixId: "S2" as const }),
  });

  const elephant = num(settings, "elephant_foot_compensation", 0);
  const elephantOk = !ctx.touchingBed || Math.abs(elephant - RULES.C4_ELEPHANT_FOOT_MM.value) < 0.001;
  issues.push({
    id: "C4",
    category: "settings",
    severity: elephantOk ? "info" : "warning",
    title: elephantOk ? "Compensação de pé de elefante correta" : "Compensação de pé de elefante ausente",
    detail: `elephant_foot_compensation = ${elephant} mm · peça toca a mesa: ${ctx.touchingBed ? "sim" : "não"} · recomendado ${RULES.C4_ELEPHANT_FOOT_MM.value} mm.`,
    hint: elephantOk ? "Nada a fazer." : "S3 grava elephant_foot_compensation = 0.2 (evita barriga na base da peça).",
    source: SOURCES.elephantFoot,
    ...(elephantOk ? {} : { fixId: "S3" as const }),
  });

  const smallBase = ctx.footprint > 0 && ctx.footprint < RULES.C5_SMALL_FOOTPRINT_MM.value;
  const tall = ctx.footprint > 0 && ctx.height > ctx.footprint * 3;
  const needsBrim = smallBase || tall;
  const hasBrim = brimEnabled(settings);
  const brimOk = !needsBrim || hasBrim;
  issues.push({
    id: "C5",
    category: "settings",
    severity: brimOk ? "info" : "warning",
    title: brimOk ? "Aderência de base adequada" : "Base pequena sem brim",
    detail:
      `Base mínima ${ctx.footprint.toFixed(1)} mm · altura ${ctx.height.toFixed(1)} mm · ` +
      `brim_type = ${str(settings, "brim_type", "none")}.`,
    hint: brimOk
      ? "Nada a fazer."
      : "Peça estreita ou alta descola fácil — S5 ativa brim para aumentar a aderência na primeira camada.",
    source: SOURCES.bed,
    ...(brimOk ? {} : { fixId: "S5" as const }),
  });

  const filamentCount = Array.isArray(settings.filament_colour) ? settings.filament_colour.length : 0;
  const modelColors = ctx.modelColors ?? 0;
  const mismatch = filamentCount > 0 && modelColors > 0 && modelColors > filamentCount;
  issues.push({
    id: "C6",
    category: "settings",
    severity: "info",
    title: mismatch ? "Mais cores no modelo que filamentos configurados" : "Filamentos × cores do modelo",
    detail: `${filamentCount} filamento(s) declarado(s) · ${modelColors} cor(es) no modelo` +
      `${ctx.kind === "bambu" ? " · atribuição via AMS" : ""}.`,
    hint: mismatch
      ? "Bambu Studio reordena/repete filamentos ao fatiar — confira as cores antes de imprimir."
      : "Nada a fazer.",
    source: SOURCES.packageStructure,
  });

  return issues;
}
