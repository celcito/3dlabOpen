import * as THREE from 'three';
import { csgSubtract } from '../fastener/boolean';
import type { GeneratedPencilPersonal, PencilPersonalConfig, PencilFace } from '../../types/pencilPersonal';
import {
  buildThreeShapes,
  computeEnclosedEmptyMask,
  extractContoursFromImageData,
  punchMask,
} from '../pencilTopper/contourExtractor';
import { ensureGoogleFont } from '../fonts/googleFonts';
import {
  BODY_AXIS,
  BODY_HALF_LENGTH,
  ENGRAVE_MAX_Y,
  ENGRAVE_MIN_Y,
  FACE_NORMAL_ANGLE_DEG,
  HEX_APOTHEM,
  HEX_FACE_WIDTH,
  LETTER_RELIEF,
  MIN_LETTER_THICKNESS,
  WALL_RESERVE,
  WALL_THICKNESS,
} from './presets';

const PX_PER_MM = 20;
const ENGRAVE_RANGE_MIN = ENGRAVE_MIN_Y + BODY_HALF_LENGTH;
const ENGRAVE_RANGE_MAX = ENGRAVE_MAX_Y + BODY_HALF_LENGTH;

export interface TextShapes {
  shapes: THREE.Shape[];
  /** extensão da leitura (ao longo do corpo) em mm */
  widthMm: number;
  /** altura da caixa alta (através da face) em mm */
  heightMm: number;
}

export function faceNormal(face: PencilFace): THREE.Vector3 {
  const angle = (FACE_NORMAL_ANGLE_DEG[face] * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
}

export function faceTangent(face: PencilFace): THREE.Vector3 {
  const angle = (FACE_NORMAL_ANGLE_DEG[face] * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(angle), -Math.cos(angle), 0);
}

/** Centro do texto ao longo do eixo local do corpo. */
export function axisCenterY(config: PencilPersonalConfig): number {
  return config.positionAlongAxis - BODY_HALF_LENGTH;
}

/**
 * Matriz (corpo-local → prancha) que assenta a peça das letras sobre o bolso:
 * `z = 0` da malha no fundo do bolso (`apotema − profundidade`), de modo que a
 * peça se projeta `LETTER_RELIEF` acima da face.
 */
export function letterPlacementMatrix(config: PencilPersonalConfig, depth: number): THREE.Matrix4 {
  const normal = faceNormal(config.face);
  const tangent = faceTangent(config.face);
  const translation = BODY_AXIS.clone()
    .multiplyScalar(axisCenterY(config))
    .addScaledVector(normal, HEX_APOTHEM - depth);

  return new THREE.Matrix4().set(
    BODY_AXIS.x, tangent.x, normal.x, translation.x,
    BODY_AXIS.y, tangent.y, normal.y, translation.y,
    BODY_AXIS.z, tangent.z, normal.z, translation.z,
    0, 0, 0, 1
  );
}

export async function buildTextShapes(config: PencilPersonalConfig): Promise<TextShapes> {
  const text = config.text.trim() || 'Nome';
  const fontHeightPx = Math.max(6, config.letterHeight) * PX_PER_MM;

  try {
    if (!config.customFontName) await ensureGoogleFont(config.fontFamily);
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.load(`${fontHeightPx}px "${config.fontFamily}"`);
    }
  } catch {
    // fallback para a fonte do sistema
  }

  const measure = document.createElement('canvas');
  const mctx = measure.getContext('2d');
  if (!mctx) throw new Error('Falha ao inicializar Canvas 2D');

  const fontStyle = `${fontHeightPx}px "${config.fontFamily}", sans-serif`;
  mctx.font = fontStyle;

  const letterSpacingPx = Math.max(0, config.letterSpacing) * PX_PER_MM;
  const offsets: number[] = [];
  let textWidthPx = 0;
  for (let i = 0; i < text.length; i++) {
    offsets.push(textWidthPx);
    textWidthPx += mctx.measureText(text[i]).width + letterSpacingPx;
  }
  if (text.length > 0) textWidthPx -= letterSpacingPx;

  const outlinePx = Math.max(0.6, (config.fontWeightScale || 1) * 1.2) * PX_PER_MM;
  const paddingPx = Math.ceil(outlinePx * 2 + 12);

  const canvasWidth = Math.ceil(textWidthPx + paddingPx * 2);
  const canvasHeight = Math.ceil(fontHeightPx + paddingPx * 2);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Erro ao inicializar contexto 2D');

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const textStartX = centerX - textWidthPx / 2;
  const baselineY = centerY + fontHeightPx * 0.32;

  ctx.fillStyle = '#000000';
  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], textStartX + offsets[i], baselineY);
  }
  const counterMask = computeEnclosedEmptyMask(ctx.getImageData(0, 0, canvasWidth, canvasHeight));

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = outlinePx * 2;
  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    const cx = textStartX + offsets[i];
    ctx.strokeText(text[i], cx, baselineY);
    ctx.fillText(text[i], cx, baselineY);
  }

  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  punchMask(imageData, counterMask);

  const mmPerPixel = 1 / PX_PER_MM;
  const contours = extractContoursFromImageData(
    imageData,
    mmPerPixel,
    canvasWidth / 2,
    canvasHeight / 2,
    0.1,
    { resimplifyMm: 0.01 }
  );
  const shapes = buildThreeShapes(contours.outer, contours.holes);
  if (shapes.length === 0) throw new Error('Não foi possível extrair os contornos do texto');

  const box = new THREE.Box3();
  for (const shape of shapes) {
    for (const point of shape.getPoints(8)) {
      box.expandByPoint(new THREE.Vector3(point.x, point.y, 0));
    }
  }
  const size = box.getSize(new THREE.Vector3());

  return { shapes, widthMm: size.x, heightMm: size.y };
}

/** Espessura da parede ao longo da normal da face (do exterior ao interior). */
export function measureWallThickness(
  bodyGeometry: THREE.BufferGeometry,
  face: PencilFace,
  yCenter: number
): number {
  const normal = faceNormal(face);
  const raycaster = new THREE.Raycaster();
  const mesh = new THREE.Mesh(bodyGeometry);
  const samples: number[] = [];

  for (const dy of [-12, 0, 12]) {
    const origin = normal
      .clone()
      .multiplyScalar(HEX_APOTHEM + 20)
      .add(BODY_AXIS.clone().multiplyScalar(yCenter + dy));
    raycaster.set(origin, normal.clone().negate());
    const hits = raycaster.intersectObject(mesh, false);
    if (hits.length < 2) continue;
    const thickness = hits[1].distance - hits[0].distance;
    if (thickness > 0.1 && thickness < 15) samples.push(thickness);
  }

  if (samples.length === 0) return WALL_THICKNESS;
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

/**
 * Sólido de corte: Shapes na face, radialmente de `apotema − profundidade`
 * até `apotema + 1`. Shape X → eixo do corpo, shape Y → tangente da face.
 */
function buildCutSolid(
  shapes: THREE.Shape[],
  face: PencilFace,
  yCenter: number,
  depth: number
): THREE.ExtrudeGeometry {
  const normal = faceNormal(face);
  const tangent = faceTangent(face);
  const radiusStart = HEX_APOTHEM - depth;
  const extrudeDepth = depth + 1;

  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: extrudeDepth, bevelEnabled: false });
  geometry.computeBoundingBox();
  const center = (geometry.boundingBox || new THREE.Box3()).getCenter(new THREE.Vector3());

  const translation = BODY_AXIS.clone()
    .multiplyScalar(yCenter - center.x)
    .addScaledVector(tangent, -center.y)
    .addScaledVector(normal, radiusStart);

  geometry.applyMatrix4(
    new THREE.Matrix4().set(
      BODY_AXIS.x, tangent.x, normal.x, translation.x,
      BODY_AXIS.y, tangent.y, normal.y, translation.y,
      BODY_AXIS.z, tangent.z, normal.z, translation.z,
      0, 0, 0, 1
    )
  );
  geometry.computeBoundingBox();
  return geometry;
}

export async function generatePencilPersonal(
  bodyGeometry: THREE.BufferGeometry,
  config: PencilPersonalConfig
): Promise<GeneratedPencilPersonal> {
  const text = await buildTextShapes(config);
  const yCenter = axisCenterY(config);
  const wallThickness = measureWallThickness(bodyGeometry, config.face, yCenter);
  const maxDepth = Math.max(MIN_LETTER_THICKNESS, wallThickness - WALL_RESERVE);
  const clampedDepth = Math.min(Math.max(config.depth, MIN_LETTER_THICKNESS), maxDepth);

  const cutGeometry = buildCutSolid(text.shapes, config.face, yCenter, clampedDepth);

  const { geometry: bodyGraved } = await csgSubtract(bodyGeometry, cutGeometry);
  bodyGraved.computeVertexNormals();
  bodyGraved.computeBoundingBox();

  const letterThickness = clampedDepth + LETTER_RELIEF;
  const letters = new THREE.ExtrudeGeometry(text.shapes, {
    depth: letterThickness,
    bevelEnabled: false,
  });
  letters.computeBoundingBox();
  const letterBox = letters.boundingBox || new THREE.Box3();
  letters.translate(
    -(letterBox.min.x + letterBox.max.x) / 2,
    -(letterBox.min.y + letterBox.max.y) / 2,
    -letterBox.min.z
  );
  letters.computeBoundingBox();
  letters.computeVertexNormals();

  return {
    bodyGraved,
    letters,
    wallThickness,
    faceWidth: HEX_FACE_WIDTH,
    engraveRangeMin: ENGRAVE_RANGE_MIN,
    engraveRangeMax: ENGRAVE_RANGE_MAX,
    clampedDepth,
    textWidth: text.widthMm,
    textTooWide: text.heightMm > HEX_FACE_WIDTH,
    textTooLong:
      yCenter - text.widthMm / 2 < ENGRAVE_MIN_Y || yCenter + text.widthMm / 2 > ENGRAVE_MAX_Y,
  };
}
