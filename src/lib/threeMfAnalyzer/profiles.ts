import type { Issue, MeshStats } from "./types";
import { RULES, SOURCES } from "./rules";
import { bool, num } from "./settingsChecks";

/**
 * C7–C16: perfis de processo do Bambu Studio.
 *
 * Dois modos por perfil (pedido do usuário — "se não houver?"):
 *  - **Detecção**: marcador presente em `Metadata/project_settings.config`
 *    → info "Perfil ativo: …".
 *  - **Recomendação**: a malha/objeto indica o perfil → info
 *    "Perfil recomendado: …".
 *
 * Perfis de cenário (C7–C11) aceitam ambos; os de acabamento (C12–C16) e o
 * Vaso (C9) são só detecção — a geometria sozinha não os justifica.
 * Emite apenas quando existe `project_settings` (mesmo gate de C1–C6).
 */

export interface ProfileContext {
  settings: Record<string, unknown>;
  objects: MeshStats[];
}

interface ProfileDef {
  id: string;
  pt: string;
  en: string;
  desc: string;
  /** Evidência no `project_settings` (null = não ativo). */
  detect: (settings: Record<string, unknown>) => string | null;
  /** Motivo da recomendação pela malha (null = não recomendado). */
  recommend: (ctx: ProfileContext) => string | null;
}

function lower(raw: unknown): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === "string") return v.trim().toLowerCase();
  if (typeof v === "number" || typeof v === "boolean") return String(v).toLowerCase();
  return "";
}

function norm(settings: Record<string, unknown>, key: string): string {
  return lower(settings[key]);
}

/** Valor que desliga a opção (ausente, none, off, 0, false …). */
function off(value: string): boolean {
  return value === "" || value === "none" || value === "off" || value === "0" || value === "false" || value === "no";
}

function fmt(n: number): string {
  return n.toFixed(1);
}

function spanOf(objects: MeshStats[]): { min: number; max: number; maxXY: number } | null {
  if (objects.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of objects) {
    const sx = o.max[0] - o.min[0];
    const sy = o.max[1] - o.min[1];
    const sz = o.max[2] - o.min[2];
    min = Math.min(min, sx, sy, sz);
    max = Math.max(max, sx, sy, sz);
    maxX = Math.max(maxX, sx);
    maxY = Math.max(maxY, sy);
  }
  return { min, max, maxXY: Math.max(maxX, maxY) };
}

const PROFILES: ProfileDef[] = [
  {
    id: "C7",
    pt: "Texto e letras",
    en: "Text and letters",
    desc: "Paredes finas detectadas, ilhas pequenas mais lentas e emenda nas costas: letras nítidas.",
    detect: (s) => {
      const wg = norm(s, "wall_generator");
      if (wg.includes("arachne")) return `wall_generator=${wg}`;
      const seam = norm(s, "seam_position");
      if (seam === "back" || seam === "rear") return `seam_position=${seam}`;
      return null;
    },
    recommend: (ctx) => {
      const span = spanOf(ctx.objects);
      if (span && span.min < RULES.B8_MIN_DIMENSION_MM.value) {
        return `menor eixo de ${fmt(span.min)} mm < ${RULES.B8_MIN_DIMENSION_MM.value} mm (2 perímetros @ bico 0,4)`;
      }
      return null;
    },
  },
  {
    id: "C8",
    pt: "Miniatura",
    en: "Miniature",
    desc: "Camadas de 0,08 mm, paredes lentas e mais tempo por camada: detalhe fino sem derreter.",
    detect: (s) => {
      const layer = num(s, "layer_height", 0);
      if (layer > 0 && layer <= RULES.P_MINIATURE_LAYER_MM.value) return `layer_height=${layer}`;
      return null;
    },
    recommend: (ctx) => {
      const span = spanOf(ctx.objects);
      if (span && span.max <= RULES.P_MINIATURE_MAX_MM.value) {
        return `envolvente de ${fmt(span.max)} mm ≤ ${RULES.P_MINIATURE_MAX_MM.value} mm`;
      }
      return null;
    },
  },
  {
    id: "C9",
    pt: "Vaso",
    en: "Vase",
    desc: "Modo espiral: uma parede contínua, sem topo, sem emenda.",
    detect: (s) => (bool(s, "spiral_mode") ? "spiral_mode=1" : null),
    recommend: () => null,
  },
  {
    id: "C10",
    pt: "Ajuste funcional",
    en: "Functional fit",
    desc: "Furos compensados, parede externa precisa e pé de elefante corrigido: peças que encaixam.",
    detect: (s) => {
      const hole = num(s, "xy_hole_compensation", 0);
      if (Math.abs(hole) > 1e-9) return `xy_hole_compensation=${hole}`;
      const contour = num(s, "xy_contour_compensation", 0);
      if (Math.abs(contour) > 1e-9) return `xy_contour_compensation=${contour}`;
      if (bool(s, "precise_outer_wall")) return "precise_outer_wall=1";
      return null;
    },
    recommend: (ctx) => {
      const torus = ctx.objects.find(
        (o) => o.boundaryEdges === 0 && o.nonManifoldEdges === 0 && o.genus >= RULES.P_MIN_GENUS.value
      );
      if (torus) return `objeto fechado com gênero ${torus.genus} (furo/túnel passante)`;
      return null;
    },
  },
  {
    id: "C11",
    pt: "Placa grande",
    en: "Large plate",
    desc: "Primeira camada lenta e brim externo: peça plana que fica na mesa.",
    detect: (s) => {
      const type = norm(s, "brim_type");
      const hasBrim = type !== "none" && type !== "no_brim" && type !== "no brim" && !off(type);
      if (!hasBrim) return null;
      const raw = s.initial_layer_speed;
      if (raw !== undefined && !(num(s, "initial_layer_speed", NaN) <= RULES.P_SLOW_FIRST_LAYER.value)) return null;
      return `brim_type=${type}${raw === undefined ? "" : `, initial_layer_speed=${num(s, "initial_layer_speed", 0)}`}`;
    },
    recommend: (ctx) => {
      const span = spanOf(ctx.objects);
      if (span && span.maxXY >= RULES.P_LARGE_PLATE_MM.value) {
        return `${fmt(span.maxXY)} mm na cama de ${RULES.B6_BED_MM.value} mm ≥ ${RULES.P_LARGE_PLATE_MM.value} mm`;
      }
      return null;
    },
  },
  {
    id: "C12",
    pt: "Topo liso",
    en: "Smooth top",
    desc: "Passa a biquinha quente sobre a última camada (ironing): um topo liso como vidro.",
    detect: (s) => {
      const it = norm(s, "ironing_type");
      if (off(it) || it.startsWith("no")) return null;
      return `ironing_type=${it}`;
    },
    recommend: () => null,
  },
  {
    id: "C13",
    pt: "Topo Hilbert",
    en: "Hilbert top",
    desc: "Curva de Hilbert na superfície superior: textura uniforme e decorativa.",
    detect: (s) => {
      const p = norm(s, "top_surface_pattern");
      if (p.includes("hilbert")) return `top_surface_pattern=${p}`;
      return null;
    },
    recommend: () => null,
  },
  {
    id: "C14",
    pt: "Textura de parede",
    en: "Wall texture",
    desc: "Pele fuzzy na parede externa: acabamento rugoso que esconde as camadas.",
    detect: (s) => {
      const f = norm(s, "fuzzy_skin");
      return off(f) ? null : `fuzzy_skin=${f}`;
    },
    recommend: () => null,
  },
  {
    id: "C15",
    pt: "Emenda oculta",
    en: "Hidden seam",
    desc: "Emenda alinhada com junta scarf: a linha da emenda desaparece.",
    detect: (s) => {
      if (bool(s, "has_scarf_joint_seam")) return "has_scarf_joint_seam=1";
      const types = s.filament_scarf_seam_type;
      if (Array.isArray(types)) {
        const on = types.find((v) => !off(lower(v)));
        if (on !== undefined) return `filament_scarf_seam_type=${String(on)}`;
      }
      const slope = norm(s, "seam_slope_type");
      if (slope.includes("scarf")) return `seam_slope_type=${slope}`;
      return null;
    },
    recommend: () => null,
  },
  {
    id: "C16",
    pt: "Sem pé de elefante",
    en: "No elephant foot",
    desc: "Compensa a primeira camada esmagada: a base não alarga.",
    detect: (s) => {
      const e = num(s, "elephant_foot_compensation", 0);
      return e > 0 ? `elephant_foot_compensation=${e}` : null;
    },
    recommend: () => null,
  },
];

export function runProfileChecks(ctx: ProfileContext): Issue[] {
  const issues: Issue[] = [];
  for (const p of PROFILES) {
    const ev = p.detect(ctx.settings);
    const rec = p.recommend(ctx);
    if (!ev && !rec) continue;
    issues.push({
      id: p.id,
      category: "settings",
      severity: "info",
      title: ev ? `Perfil ativo: ${p.pt} (${p.en})` : `Perfil recomendado: ${p.pt} (${p.en})`,
      detail:
        `${p.desc}${ev ? ` Ativo no projeto: ${ev}.` : ""}` +
        `${rec ? ` Motivo da recomendação: ${rec}.` : ""}`,
      hint:
        ev && rec
          ? "Perfil ativo e recomendado para este modelo — nada a fazer."
          : ev
            ? "Escolha de perfil ativa no fatiamento — nada a fazer."
            : "Ative o perfil no slicer antes de fatiar (ou mantenha o atual se já atender).",
      source: SOURCES.profiles,
    });
  }
  return issues;
}
