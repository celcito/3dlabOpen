import * as THREE from 'three';
import { csgSubtract } from '../fastener/boolean';
import type {
  GeneratedPencilPersonal,
  PencilPersonalConfig,
  PencilFace,
  PencilVariant,
} from '../../types/pencilPersonal';
import {
  buildThreeShapes,
  computeEnclosedEmptyMask,
  extractContoursFromImageData,
  punchMask,
} from '../pencilTopper/contourExtractor';
import { ensureGoogleFont } from '../fonts/googleFonts';
import { drawSymbol } from '../pencilTopper/symbols';
import {
  BODY_AXIS,
  HEX_FACE_WIDTH,
  LETTER_RELIEF,
  MIN_LETTER_THICKNESS,
  VARIANTS,
  WALL_RESERVE,
  FACE_NORMAL_ANGLE_DEG,
} from './presets';

const PX_PER_MM = 20;

function variantOf(config: PencilPersonalConfig): PencilVariant {
  return VARIANTS[config.variant];
}

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

/** Única fonte de orientação da superfície de gravação (`[G1]`). */
export function normalAt(config: PencilPersonalConfig, variant: PencilVariant): THREE.Vector3 {
  if (variant.placement === 'angle') {
    const angle = (config.angleDeg * Math.PI) / 180;
    return new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
  }
  return faceNormal(config.face);
}

/**
 * Tangente da superfície, na mesma convenção do hex (`faceTangent`): `normal × BODY_AXIS`.
 * [G1] escreve `BODY_AXIS × normal`, que é o vetor oposto e deixaria as letras
 * de cabeça para baixo — os dois operandos trocados são o desvio registrado.
 */
export function tangentAt(config: PencilPersonalConfig, variant: PencilVariant): THREE.Vector3 {
  if (variant.placement === 'angle') {
    return new THREE.Vector3().crossVectors(normalAt(config, variant), BODY_AXIS);
  }
  return faceTangent(config.face);
}

/** Raio/apotema da superfície de gravação (`[G2]`). */
export function surfaceOffset(variant: PencilVariant): number {
  return variant.surfaceRadius;
}

/** Centro do texto ao longo do eixo local do corpo. */
export function axisCenterY(config: PencilPersonalConfig): number {
  return config.positionAlongAxis - variantOf(config).bodyLength / 2;
}

/**
 * Matriz (corpo-local → prancha) que assenta a peça das letras sobre o bolso:
 * `z = 0` da malha no fundo do bolso (`superfície − profundidade`), de modo que a
 * peça se projeta `LETTER_RELIEF` acima da face.
 */
export function letterPlacementMatrix(
  config: PencilPersonalConfig,
  depth: number,
  /** centro efetivo já contido na área de gravação (padrão: o pedido em config) */
  yCenter: number = axisCenterY(config)
): THREE.Matrix4 {
  const variant = variantOf(config);
  const normal = normalAt(config, variant);
  const tangent = tangentAt(config, variant);
  const translation = BODY_AXIS.clone()
    .multiplyScalar(yCenter)
    .addScaledVector(normal, surfaceOffset(variant) - depth);

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

  const hasSymbol = !!config.symbolId && config.symbolId !== 'none';
  const symbolPosition = config.symbolPosition || 'left';
  const showSymbolLeft = hasSymbol && (symbolPosition === 'left' || symbolPosition === 'both');
  const showSymbolRight = hasSymbol && (symbolPosition === 'right' || symbolPosition === 'both');
  const symbolCount = (showSymbolLeft ? 1 : 0) + (showSymbolRight ? 1 : 0);
  const symbolSizePx = fontHeightPx * 0.85;
  const symbolGapPx = symbolSizePx * 0.35;
  const symbolBlockPx = symbolCount * (symbolGapPx + symbolSizePx);
  const totalContentWidthPx = textWidthPx + symbolBlockPx;

  const outlinePx = Math.max(0.6, (config.fontWeightScale || 1) * 1.2) * PX_PER_MM;
  const paddingPx = Math.ceil(outlinePx * 2 + 12);

  const canvasWidth = Math.ceil(totalContentWidthPx + paddingPx * 2);
  const canvasHeight = Math.ceil(fontHeightPx + paddingPx * 2);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Erro ao inicializar contexto 2D');

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const contentStartX = centerX - totalContentWidthPx / 2;
  const leftBlockPx = showSymbolLeft ? symbolGapPx + symbolSizePx : 0;
  const textStartX = contentStartX + leftBlockPx;
  const baselineY = centerY + fontHeightPx * 0.32;
  const symbolLeftX = contentStartX + symbolSizePx / 2;
  const symbolRightX = contentStartX + leftBlockPx + textWidthPx + symbolGapPx + symbolSizePx / 2;
  const symbolCenterY = centerY + fontHeightPx * 0.04;
  const drawSymbols = (target: CanvasRenderingContext2D, outline = 0) => {
    if (showSymbolLeft) drawSymbol(target, config.symbolId, symbolLeftX, symbolCenterY, symbolSizePx, outline);
    if (showSymbolRight) drawSymbol(target, config.symbolId, symbolRightX, symbolCenterY, symbolSizePx, outline);
  };

  ctx.fillStyle = '#000000';
  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], textStartX + offsets[i], baselineY);
  }
  if (hasSymbol) drawSymbols(ctx);
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
  if (hasSymbol) drawSymbols(ctx, outlinePx);

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

/**
 * Espessura da parede ao longo da normal da face (do exterior ao interior).
 * `tangent` completa a base local (mesma tripla de `normalAt`/`tangentAt`); o
 * raycast em si só anda pela normal, que é o suficiente em cilindro (`[G2]`).
 */
export function measureWallThickness(
  bodyGeometry: THREE.BufferGeometry,
  normal: THREE.Vector3,
  tangent: THREE.Vector3,
  yCenter: number,
  variant: PencilVariant
): number {
  const offset = surfaceOffset(variant);
  const raycaster = new THREE.Raycaster();
  const mesh = new THREE.Mesh(bodyGeometry);
  const samples: number[] = [];
  void tangent;

  for (const dy of [-12, 0, 12]) {
    const origin = normal
      .clone()
      .multiplyScalar(offset + 20)
      .add(BODY_AXIS.clone().multiplyScalar(yCenter + dy));
    raycaster.set(origin, normal.clone().negate());
    const hits = raycaster.intersectObject(mesh, false);
    if (hits.length < 2) continue;
    const thickness = hits[1].distance - hits[0].distance;
    if (thickness > 0.1 && thickness < 15) samples.push(thickness);
  }

  if (samples.length === 0) return variant.wallThickness;
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

/**
 * Sólido de corte: Shapes na face, radialmente de `superfície − profundidade`
 * até `superfície + 1`. Shape X → eixo do corpo, shape Y → tangente da face.
 */
function buildCutSolid(
  shapes: THREE.Shape[],
  normal: THREE.Vector3,
  tangent: THREE.Vector3,
  yCenter: number,
  depth: number,
  surfaceRadius: number
): THREE.ExtrudeGeometry {
  const radiusStart = surfaceRadius - depth;
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

/**
 * Largura disponível na direção tangencial: no hex é a face plana; no redondo é
 * a corda que a profundidade permite dentro do cilindro (`[G3]`).
 */
export function faceWidthFor(variant: PencilVariant, depth: number): number {
  if (variant.placement === 'angle') {
    return 2 * Math.sqrt(2 * surfaceOffset(variant) * (depth + LETTER_RELIEF));
  }
  return HEX_FACE_WIDTH;
}

/**
 * Escala os Shapes do texto pelo plano da face. Os contornos vêm como polígonos
 * (`LineCurve`, montados em `buildThreeShapes`), então escala os pontos das retas
 * — inclusive os dos vazados — mantendo a forma intacta.
 */
function scaleShapes(shapes: THREE.Shape[], scale: number): void {
  if (scale >= 1) return;
  const scalePath = (path: THREE.Path) => {
    for (const curve of path.curves) {
      if (curve instanceof THREE.LineCurve) {
        curve.v1.multiplyScalar(scale);
        curve.v2.multiplyScalar(scale);
      }
    }
  };
  for (const shape of shapes) {
    scalePath(shape);
    for (const hole of shape.holes) scalePath(hole);
  }
}

export async function generatePencilPersonal(
  bodyGeometry: THREE.BufferGeometry,
  config: PencilPersonalConfig
): Promise<GeneratedPencilPersonal> {
  const variant = variantOf(config);
  const normal = normalAt(config, variant);
  const tangent = tangentAt(config, variant);

  const text = await buildTextShapes(config);
  const requestedCenter = axisCenterY(config);
  const wallThickness = measureWallThickness(bodyGeometry, normal, tangent, requestedCenter, variant);
  const maxDepth = Math.max(MIN_LETTER_THICKNESS, wallThickness - WALL_RESERVE);
  const clampedDepth = Math.min(Math.max(config.depth, MIN_LETTER_THICKNESS), maxDepth);
  const faceWidth = faceWidthFor(variant, clampedDepth);

  // Contém o texto na peça: reduz a escala até caber na face e na área de
  // gravação, e trava o centro para que as extremidades não saiam do corpo.
  const engraveLength = variant.engraveMaxY - variant.engraveMinY;
  const requestedWidth = text.widthMm;
  const requestedHeight = text.heightMm;
  const fitScale = Math.min(1, faceWidth / requestedHeight, engraveLength / requestedWidth);
  scaleShapes(text.shapes, fitScale);
  const textWidth = requestedWidth * fitScale;

  const minCenter = variant.engraveMinY + textWidth / 2;
  const maxCenter = variant.engraveMaxY - textWidth / 2;
  const yCenter =
    minCenter <= maxCenter
      ? Math.min(Math.max(requestedCenter, minCenter), maxCenter)
      : (variant.engraveMinY + variant.engraveMaxY) / 2;

  const cutGeometry = buildCutSolid(
    text.shapes,
    normal,
    tangent,
    yCenter,
    clampedDepth,
    surfaceOffset(variant)
  );

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
    faceWidth,
    engraveRangeMin: variant.engraveMinY + variant.bodyLength / 2,
    engraveRangeMax: variant.engraveMaxY + variant.bodyLength / 2,
    clampedDepth,
    yCenter,
    textWidth,
    textTooWide: requestedHeight > faceWidth,
    textTooLong:
      requestedWidth > engraveLength ||
      requestedCenter - requestedWidth / 2 < variant.engraveMinY ||
      requestedCenter + requestedWidth / 2 > variant.engraveMaxY,
  };
}
