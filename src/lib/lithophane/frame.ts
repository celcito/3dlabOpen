import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Medidas padrão de porta-retrato (mm). A abertura = tamanho da foto. */
export interface PortraitPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

/** Presets de foto (retrato: altura ≥ largura). */
export const PORTRAIT_PRESETS: PortraitPreset[] = [
  { id: "10x15", label: "10 × 15 cm", width: 100, height: 150 },
  { id: "13x18", label: "13 × 18 cm", width: 130, height: 180 },
  { id: "15x21", label: "15 × 21 cm", width: 150, height: 210 },
  { id: "20x25", label: "20 × 25 cm", width: 200, height: 250 },
  { id: "20x30", label: "20 × 30 cm", width: 200, height: 300 },
  { id: "30x40", label: "30 × 40 cm", width: 300, height: 400 },
  { id: "a4", label: "A4 (21 × 29,7)", width: 210, height: 297 },
  { id: "quadrado", label: "Quadrado 20 × 20", width: 200, height: 200 },
];

/** Id usado quando a medida não vem de um preset. */
export const CUSTOM_PRESET_ID = "custom";

export interface FrameOptions {
  /** Abertura da moldura (mm) — o tamanho da litofania. */
  openingWidth: number;
  openingHeight: number;
  /** Largura do aro (mm). */
  border: number;
  /** Profundidade total da moldura (mm). */
  depth: number;
  /** Raio do canto externo (mm). */
  radius: number;
  /** Folga entre litofania e aro (mm). */
  clearance?: number;
  /** Espessura da litofania (mm) — define a profundidade do rebaixo traseiro. */
  panelThickness?: number;
  /** Largura do batente que segura a litofania no rebaixo (mm). */
  lip?: number;
}

/** Contorno retangular arredondado, centrado na origem. */
function roundedRect(w: number, h: number, radius: number): THREE.Shape {
  const r = Math.min(Math.max(radius, 0), Math.min(w, h) / 2);
  const x = -w / 2;
  const y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  shape.closePath();
  return shape;
}

export interface FrameParts {
  /** Aro frontal (z ∈ [rebate, depth]). */
  front: THREE.BufferGeometry;
  /** Rebaixo traseiro, mais largo, onde a litofania entra (z ∈ [0, rebate]). */
  recess: THREE.BufferGeometry;
  /** Externos da moldura (mm). */
  outerWidth: number;
  outerHeight: number;
  depth: number;
  /** Profundidade do rebaixo traseiro (mm). */
  rebate: number;
  /** Folga usada no encaixe (mm). */
  clearance: number;
  lip: number;
}

/**
 * Moldura com rebaixo traseiro: a litofania entra por trás, encosta no batente
 * do aro frontal e fica visível pela abertura. Duas cascas fechadas (aro +
 * rebaixo) num único BufferGeometry — sem CSG.
 */
export function buildFrameParts(opts: FrameOptions): FrameParts | null {
  const {
    openingWidth,
    openingHeight,
    border,
    depth,
    radius,
    clearance = 0.3,
    panelThickness = 1,
    lip: lipOpt,
  } = opts;

  if (
    !Number.isFinite(openingWidth) ||
    !Number.isFinite(openingHeight) ||
    !Number.isFinite(border) ||
    !Number.isFinite(depth) ||
    openingWidth <= 0 ||
    openingHeight <= 0 ||
    border <= 0 ||
    depth <= 0
  ) {
    return null;
  }

  const outerWidth = openingWidth + 2 * border;
  const outerHeight = openingHeight + 2 * border;

  // Batente mínimo de 2mm, nunca maior que o aro.
  const lip = Math.min(border, Math.max(Math.min(border, 2), lipOpt ?? border * 0.5));
  const rebate = Math.min(Math.max(0.6, panelThickness + 0.4), Math.max(0, depth - 0.4));
  const frontDepth = depth - rebate;
  if (rebate <= 0 || frontDepth <= 0) return null;

  // A litofania é retangular (cantos retos): o furo interno não pode ser
  // arredondado, senão o painel colide no canto da abertura.
  const frontShape = roundedRect(outerWidth, outerHeight, radius);
  const frontHole = new THREE.Path(
    roundedRect(openingWidth + 2 * clearance, openingHeight + 2 * clearance, 0).getPoints()
  );
  frontShape.holes.push(frontHole);

  const recessShape = roundedRect(outerWidth, outerHeight, radius);
  const recessHole = new THREE.Path(
    roundedRect(
      openingWidth + 2 * clearance + 2 * lip,
      openingHeight + 2 * clearance + 2 * lip,
      0
    ).getPoints()
  );
  recessShape.holes.push(recessHole);

  const extrude = (shape: THREE.Shape, d: number) => {
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: d,
      bevelEnabled: false,
      curveSegments: 12,
    });
    geom.computeVertexNormals();
    return geom;
  };

  const front = extrude(frontShape, frontDepth);
  front.translate(0, 0, rebate);
  const recess = extrude(recessShape, rebate);

  return { front, recess, outerWidth, outerHeight, depth, rebate, clearance, lip };
}

/**
 * Geometria única da moldura (aro + rebaixo mesclados), z ∈ [0, depth].
 * Retorna `null` para medidas inválidas.
 */
export function buildFrameGeometry(opts: FrameOptions): THREE.BufferGeometry | null {
  const parts = buildFrameParts(opts);
  if (!parts) return null;

  const merged = BufferGeometryUtils.mergeGeometries([parts.front, parts.recess], false);
  parts.front.dispose();
  parts.recess.dispose();
  if (!merged) return null;

  merged.computeVertexNormals();
  merged.computeBoundingBox();
  return merged;
}
