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

/** Acabamento da frente do aro. */
export type FrameTexture = "smooth" | "molded" | "carved";

export const FRAME_TEXTURES: { id: FrameTexture; label: string }[] = [
  { id: "smooth", label: "Liso" },
  { id: "molded", label: "Moldado" },
  { id: "carved", label: "Entalhado" },
];

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
  /** Acabamento da frente do aro. */
  texture?: FrameTexture;
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
  border: number;
  depth: number;
  radius: number;
  /** Profundidade do rebaixo traseiro (mm). */
  rebate: number;
  /** Folga usada no encaixe (mm). */
  clearance: number;
  lip: number;
  texture: FrameTexture;
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
    texture = "smooth",
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

  return {
    front,
    recess,
    outerWidth,
    outerHeight,
    border,
    depth,
    radius,
    rebate,
    clearance,
    lip,
    texture,
  };
}

/**
 * Relevo na frente do aro. "Moldado" levanta uma faixa larga junto à abertura;
 * "Entalhado" desenha filetes finos no meio do aro. Sempre dentro do aro, para
 * não mudar a medida externa da moldura.
 */
function faceRelief(parts: FrameParts): THREE.BufferGeometry[] {
  if (parts.texture === "smooth") return [];
  const { outerWidth, outerHeight, border, lip, radius, depth } = parts;
  const band = border - lip;

  const rings: { dist: number; width: number }[] = [];
  if (parts.texture === "molded") {
    rings.push({ dist: lip + band * 0.5, width: Math.max(1.5, band * 0.55) });
  } else {
    const count = Math.max(1, Math.min(3, Math.floor(band / 5)));
    for (let i = 0; i < count; i++) {
      rings.push({ dist: lip + (band * (i + 1)) / (count + 1), width: 1.2 });
    }
  }

  const relief = parts.texture === "molded" ? 1.2 : 0.6;
  const geoms: THREE.BufferGeometry[] = [];
  for (const ring of rings) {
    const outerInset = Math.max(0, border - ring.dist - ring.width / 2);
    const innerInset = Math.max(0.2, border - ring.dist + ring.width / 2);
    if (outerInset >= innerInset) continue;

    const shape = roundedRect(
      outerWidth - 2 * outerInset,
      outerHeight - 2 * outerInset,
      radius - outerInset
    );
    shape.holes.push(
      new THREE.Path(
        roundedRect(
          outerWidth - 2 * innerInset,
          outerHeight - 2 * innerInset,
          radius - innerInset
        ).getPoints()
      )
    );

    const geom = new THREE.ExtrudeGeometry(shape, { depth: relief, bevelEnabled: false, curveSegments: 12 });
    geom.translate(0, 0, depth);
    geom.computeVertexNormals();
    geoms.push(geom);
  }
  return geoms;
}

/**
 * Geometria única da moldura (aro + rebaixo mesclados), z ∈ [0, depth].
 * Retorna `null` para medidas inválidas.
 */
export function buildFrameGeometry(opts: FrameOptions): THREE.BufferGeometry | null {
  const parts = buildFrameParts(opts);
  if (!parts) return null;

  const pieces = [parts.front, parts.recess, ...faceRelief(parts)];

  const merged = BufferGeometryUtils.mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  if (!merged) return null;

  merged.computeVertexNormals();
  merged.computeBoundingBox();
  return merged;
}

export interface StandOptions {
  /** Largura externa da moldura (mm). */
  frameWidth: number;
  /** Altura externa da moldura (mm). */
  frameHeight: number;
  /** Profundidade da moldura (mm) — define a largura do encaixe. */
  frameDepth: number;
  /** Folga do encaixe (mm). */
  clearance?: number;
}

/**
 * Cavalete impresso à parte: base com encaixe vertical onde a moldura entra de
 * pé. O fundo do encaixe fica na altura da base da moldura, então as duas peças
 * se alinham sem colisão.
 */
export function buildStandGeometry(opts: StandOptions): THREE.BufferGeometry | null {
  const { frameWidth, frameHeight, frameDepth, clearance = 0.6 } = opts;
  if (
    !Number.isFinite(frameWidth) ||
    !Number.isFinite(frameHeight) ||
    !Number.isFinite(frameDepth) ||
    frameWidth <= 10 ||
    frameHeight <= 10 ||
    frameDepth <= 0
  ) {
    return null;
  }

  const width = Math.min(frameWidth, 200);
  const groove = frameDepth + clearance;
  const foot = 18;
  const baseDepth = groove + 2 * foot;
  const wall = Math.min(18, Math.max(8, frameHeight * 0.12));
  const floor = 3;

  const d = baseDepth / 2;
  const g = groove / 2;
  const profile = new THREE.Shape();
  profile.moveTo(-d, 0);
  profile.lineTo(d, 0);
  profile.lineTo(d, wall);
  profile.lineTo(g, wall);
  profile.lineTo(g, floor);
  profile.lineTo(-g, floor);
  profile.lineTo(-g, wall);
  profile.lineTo(-d, wall);
  profile.closePath();

  const geom = new THREE.ExtrudeGeometry(profile, {
    depth: width,
    bevelEnabled: false,
    curveSegments: 8,
  });
  // Perfil (profundidade × altura) extrudado na largura: x → z, z → x.
  geom.rotateY(Math.PI / 2);
  geom.translate(-width / 2, -frameHeight / 2 - floor, frameDepth / 2);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  return geom;
}
