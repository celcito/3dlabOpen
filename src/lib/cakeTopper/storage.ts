import type { KeychainConfig } from "../../types/keychain";
import { DEFAULT_KEYCHAIN_CONFIG } from "../keychain/presets";
import {
  DEFAULT_TOPPER_CONFIG,
  isPlateShapeId,
  type TopperConfig,
  type TopperElement,
  type TopperStick,
} from "./cakeTopperGeometry";
import { isPlaqueStyle, type Plaque } from "./plaque";

const STORAGE_KEY = "topo_bolo_placas_v1";

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readColor(value: unknown, fallback: string): string {
  return typeof value === "string" && value.startsWith("#") ? value : fallback;
}

function sanitizeStick(raw: unknown, def: TopperStick): TopperStick {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<TopperStick>;
  return {
    id: readString(s.id, def.id),
    x: clamp(s.x, -500, 500, def.x),
    height: clamp(s.height, 5, 300, def.height),
    thickness: clamp(s.thickness, 0.5, 10, def.thickness),
    width: clamp(s.width, 1, 20, def.width),
  };
}

function sanitizeElement(raw: unknown): TopperElement | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Partial<TopperElement>;
  if (typeof e.content !== "string") return null;
  const type: TopperElement["type"] =
    e.type === "text" || e.type === "number" || e.type === "shape" || e.type === "image" || e.type === "decoration"
      ? e.type
      : "text";
  return {
    id: readString(e.id, Math.random().toString(36).slice(2, 10)),
    type,
    content: e.content,
    x: clamp(e.x, -500, 500, 0),
    y: clamp(e.y, -500, 500, 0),
    scale: clamp(e.scale, 0.1, 5, 1),
    rotation: clamp(e.rotation, -360, 360, 0),
    color: readColor(e.color, DEFAULT_TOPPER_CONFIG.textColor),
    fontSize: e.fontSize !== undefined ? clamp(e.fontSize, 3, 60, DEFAULT_TOPPER_CONFIG.fontSize) : undefined,
    fontFamily: typeof e.fontFamily === "string" ? e.fontFamily : undefined,
    shapeType: typeof e.shapeType === "string" ? e.shapeType : undefined,
    svgData: typeof e.svgData === "string" ? e.svgData : undefined,
    widthMm: e.widthMm !== undefined ? clamp(e.widthMm, 1, 500, 30) : undefined,
    heightMm: e.heightMm !== undefined ? clamp(e.heightMm, 1, 500, 30) : undefined,
    zIndex: clamp(e.zIndex, 0, 500, 0),
  };
}

function sanitizeTopper(raw: unknown): TopperConfig {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<TopperConfig>;
  const def = DEFAULT_TOPPER_CONFIG;
  const plateWidth = clamp(t.plateWidth, 20, 400, def.plateWidth);
  const stickHeight = clamp(t.stickHeight, 10, 300, def.stickHeight);
  const stickThickness = clamp(t.stickThickness, 0.5, 10, def.stickThickness);
  const stickWidth = clamp(t.stickWidth, 1, 20, def.stickWidth);
  const stickCount = clamp(t.stickCount, 0, 8, def.stickCount);
  const sticks = Array.isArray(t.sticks) && t.sticks.length > 0
    ? t.sticks.map((s, i) => sanitizeStick(s, def.sticks[i] ?? def.sticks[0]))
    : def.sticks;
  const elements = Array.isArray(t.elements)
    ? t.elements.map(sanitizeElement).filter((el): el is TopperElement => el !== null)
    : [];
  // SVG da forma da placa: só string plausível e até 100KB (quota do storage).
  const plateShapeSvg =
    typeof t.plateShapeSvg === "string" &&
    t.plateShapeSvg.length <= 100_000 &&
    t.plateShapeSvg.trim().startsWith("<")
      ? t.plateShapeSvg
      : null;
  const plateShape =
    isPlateShapeId(t.plateShape) && !(t.plateShape === "svg" && !plateShapeSvg)
      ? t.plateShape
      : def.plateShape;
  return {
    ...def,
    ...t,
    text: readString(t.text, def.text),
    fontFamily: readString(t.fontFamily, def.fontFamily),
    fontSize: clamp(t.fontSize, 4, 60, def.fontSize),
    textThickness: clamp(t.textThickness, 0.4, 12, def.textThickness),
    letterSpacing: clamp(t.letterSpacing, 0, 10, def.letterSpacing),
    alignment: t.alignment === "left" || t.alignment === "right" ? t.alignment : "center",
    plateThickness: clamp(t.plateThickness, 0.4, 12, def.plateThickness),
    plateWidth,
    plateHeight: clamp(t.plateHeight, 10, 300, def.plateHeight),
    plateCornerRadius: clamp(t.plateCornerRadius, 0, 50, def.plateCornerRadius),
    plateShape,
    plateShapeSvg,
    plateColor: readColor(t.plateColor, def.plateColor),
    textColor: readColor(t.textColor, def.textColor),
    borderColor: readColor(t.borderColor, def.borderColor),
    borderWidth: clamp(t.borderWidth, 0, 10, def.borderWidth),
    showBorder: typeof t.showBorder === "boolean" ? t.showBorder : def.showBorder,
    stickCount,
    stickHeight,
    stickThickness,
    stickWidth,
    stickColor: readColor(t.stickColor, def.stickColor),
    stickZOffset: clamp(t.stickZOffset, -30, 30, def.stickZOffset),
    stickSpacing:
      typeof t.stickSpacing === "number" && Number.isFinite(t.stickSpacing)
        ? Math.min(500, Math.max(5, t.stickSpacing))
        : null,
    elements,
    sticks,
    totalHeight: clamp(t.totalHeight, 10, 600, def.totalHeight),
    totalWidth: clamp(t.totalWidth, 10, 600, def.totalWidth),
    smoothEdges: typeof t.smoothEdges === "boolean" ? t.smoothEdges : def.smoothEdges,
    addReinforcement: typeof t.addReinforcement === "boolean" ? t.addReinforcement : def.addReinforcement,
    reinforcementThickness: clamp(t.reinforcementThickness, 0.5, 10, def.reinforcementThickness),
    age: readString(t.age, def.age),
    subtitle: readString(t.subtitle, def.subtitle),
    theme: readString(t.theme, def.theme),
  };
}

function sanitizeName(raw: unknown): KeychainConfig {
  const n = (raw && typeof raw === "object" ? raw : {}) as Partial<KeychainConfig>;
  const def = DEFAULT_KEYCHAIN_CONFIG;
  return {
    ...def,
    ...n,
    text: readString(n.text, def.text),
    fontFamily: readString(n.fontFamily, def.fontFamily),
    customFontName: typeof n.customFontName === "string" ? n.customFontName : undefined,
    customFontBase64: typeof n.customFontBase64 === "string" ? n.customFontBase64 : undefined,
    customIconUrl: typeof n.customIconUrl === "string" ? n.customIconUrl : undefined,
    letterHeight: clamp(n.letterHeight, 8, 40, def.letterHeight),
    letterSpacing: clamp(n.letterSpacing, 0, 5, def.letterSpacing),
    fontWeightScale: clamp(n.fontWeightScale, 0.5, 2.0, def.fontWeightScale),
    symbolId: readString(n.symbolId, "none"),
    symbolPosition: n.symbolPosition === "left" || n.symbolPosition === "both" ? n.symbolPosition : "right",
    outlineSize: clamp(n.outlineSize, 0.8, 10, def.outlineSize),
    bodyThickness: clamp(n.bodyThickness, 1.0, 8, def.bodyThickness),
    reliefThickness: clamp(n.reliefThickness, 0.6, 5, def.reliefThickness),
    baseColor: readColor(n.baseColor, def.baseColor),
    reliefColor: readColor(n.reliefColor, def.reliefColor),
    // Peça de bolo nunca tem argola.
    loopEnabled: false,
    loopSide: n.loopSide === "right" ? "right" : "left",
    loopHoleDiameter: clamp(n.loopHoleDiameter, 3, 10, def.loopHoleDiameter),
    loopWallThickness: clamp(n.loopWallThickness, 1.2, 4, def.loopWallThickness),
  };
}

function sanitizePlaque(raw: unknown, index: number): Plaque | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<Plaque>;
  if (!isPlaqueStyle(p.style)) return null;
  return {
    id: readString(p.id, `restored-${index}`),
    label: readString(p.label, `plaquinha-${index + 1}`),
    style: p.style,
    topper: sanitizeTopper(p.topper),
    name: sanitizeName(p.name),
  };
}

export function loadPlaqueCollection(): Plaque[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizePlaque).filter((p): p is Plaque => p !== null);
  } catch (err) {
    console.warn("Erro ao carregar coleção de plaquinhas:", err);
    return [];
  }
}

export function savePlaqueCollection(plaques: Plaque[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plaques));
    return true;
  } catch (err) {
    // Quota: tenta sem as fontes base64 (as maiores).
    try {
      const slim = plaques.map((p) => ({
        ...p,
        name: { ...p.name, customFontBase64: undefined },
      }));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      return true;
    } catch (fallbackErr) {
      console.warn("Erro ao salvar coleção de plaquinhas:", fallbackErr);
      return false;
    }
  }
}
