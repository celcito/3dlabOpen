/**
 * Limites do analisador. Cada valor cita a skill de onde veio — o relatório
 * exibe essa fonte ao lado de cada problema.
 *
 * Skills:
 *  - `3d-print` → references/formats.md · design-rules.md · tolerances.md
 *  - `bambu-labs` → estrutura do `.gcode.3mf` e regra do G-code embutido
 */

const PRINT = "skill 3d-print";
const BAMBU = "skill bambu-labs";

export const SOURCES = {
  formats: `${PRINT} · references/formats.md`,
  manifold: `${PRINT} · references/design-rules.md — Manifold Requirements`,
  antiPatterns: `${PRINT} · references/design-rules.md — Common Geometry Anti-patterns`,
  overhangDesign: `${PRINT} · references/design-rules.md — Overhang Management`,
  overhangTolerance: `${PRINT} · references/tolerances.md — Overhang Limits`,
  wallDesign: `${PRINT} · references/design-rules.md — Wall Thickness`,
  wallTolerance: `${PRINT} · references/tolerances.md — Wall Thickness Minimums`,
  layerHeight: `${PRINT} · references/tolerances.md — Layer Height`,
  elephantFoot: `${PRINT} · references/design-rules.md — Elephant Foot`,
  bed: `${BAMBU} · estrutura do projeto (256×256 A1/P1/X1, 180×180 A1 mini)`,
  slicedGcode: `${BAMBU} · regra de segurança do G-code embutido`,
  packageStructure: `${BAMBU} + ${PRINT} · references/formats.md`,
  profiles: `${BAMBU} · Wiki Bambu Studio — parâmetros de processo (perfis)`,
} as const;

export const RULES = {
  /** A3: unidade ≠ mm implica escala linear (inch = 25,4×). */
  A3_UNIT_SCALE: { value: 25.4, source: SOURCES.formats },
  /** A2: marcadores de projeto Bambu fatiado. */
  A2_BAMBU_MARKERS: { value: ["Metadata/project_settings.config", "SliceInfo"], source: SOURCES.packageStructure },
  /** B1: toda aresta deve ser compartilhada por exatamente 2 faces. */
  B1_MAX_BOUNDARY_EDGES: { value: 0, source: SOURCES.manifold },
  /** B2: aresta com mais de 2 faces é non-manifold. */
  B2_MAX_FACES_PER_EDGE: { value: 2, source: SOURCES.manifold },
  /** B3: triângulo degenerado/duplicado não pode existir. */
  B3_MAX_BAD_TRIANGLES: { value: 0, source: SOURCES.manifold },
  /** B5: decimar acima disso (anti-pattern "too many triangles"). */
  B5_MAX_TRIANGLES: { value: 500_000, source: SOURCES.antiPatterns },
  /** B6: cama da família A1/P1/X1; A1 mini é 180×180. */
  B6_BED_MM: { value: 256, source: SOURCES.bed },
  B6_SMALL_BED_MM: { value: 180, source: SOURCES.bed },
  /** B6: tolerância para "flutuando" / "abaixo da mesa". */
  B6_Z_TOLERANCE: { value: 0.5, source: SOURCES.bed },
  /** B7: overhang máximo sem suporte. */
  B7_OVERHANG_PLA_DEG: { value: 50, source: SOURCES.overhangDesign },
  B7_OVERHANG_PETG_DEG: { value: 45, source: SOURCES.overhangTolerance },
  /** B8: parede mínima decorativa = 2 perímetros @ bico 0,4 mm. */
  B8_MIN_DIMENSION_MM: { value: 0.8, source: SOURCES.wallDesign },
  /** C1: altura de camada ótima = 25–75% do bico. */
  C1_LAYER_RATIO_MIN: { value: 0.25, source: SOURCES.layerHeight },
  C1_LAYER_RATIO_MAX: { value: 0.75, source: SOURCES.layerHeight },
  /** C2: parede funcional = 3 perímetros (1,2 mm). */
  C2_MIN_WALL_LOOPS: { value: 3, source: SOURCES.wallTolerance },
  /** C3/C7: bico padrão 0,4 mm. */
  C_NOZZLE_MM: { value: 0.4, source: SOURCES.layerHeight },
  /** C4: compensação de pé de elefante recomendada. */
  C4_ELEPHANT_FOOT_MM: { value: 0.2, source: SOURCES.elephantFoot },
  /** C5: base pequena precisa de brim para aderência. */
  C5_SMALL_FOOTPRINT_MM: { value: 20, source: SOURCES.bed },
  /** C7–C16: perfis de processo — limiares de detecção/recomendação. */
  P_MINIATURE_LAYER_MM: { value: 0.08, source: SOURCES.profiles },
  P_MINIATURE_MAX_MM: { value: 30, source: SOURCES.profiles },
  P_LARGE_PLATE_MM: { value: 150, source: SOURCES.profiles },
  P_SLOW_FIRST_LAYER: { value: 30, source: SOURCES.profiles },
  P_MIN_GENUS: { value: 1, source: SOURCES.profiles },
  /** M1: snap do weld — 0,1 µm = 1e-4 mm. */
  M1_WELD_SNAP_MM: { value: 1e-4, source: SOURCES.manifold },
  /** M6: profundidade de assentamento em Z=0. */
  M6_Z_EPSILON_MM: { value: 0.01, source: SOURCES.bed },
} as const;

export type RuleId = keyof typeof RULES;

/** Fatores de unidade 3MF → milímetro (`<model unit="…">`). */
export const UNIT_TO_MM: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

export function unitToMm(unit: string): number {
  return UNIT_TO_MM[unit] ?? 1;
}
