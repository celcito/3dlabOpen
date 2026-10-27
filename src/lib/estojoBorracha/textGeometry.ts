import * as THREE from 'three';
import { ensureGoogleFont } from '../fonts/googleFonts';
import { extractContoursFromImageData, buildThreeShapes } from '../pencilTopper/contourExtractor';

const pxPerMm = 20;
const mmPerPixel = 1 / pxPerMm;

export interface CapaTextOptions {
  fontFamily: string;
  height: number;
  fontWeightScale: number;
  /** Centro do nome no eixo Y (comprimento da caixa). */
  centerX: number;
  /** Centro do nome no eixo Z (altura). */
  centerZ: number;
  /** X da face frontal da parede da capa (extrusão sai para -X, p/ fora). */
  faceX: number;
}

/**
 * Desenha o nome num canvas, extrai contornos e extrude ao longo de X.
 * O contorno vive no plano (y, z); a extrusão (-X) aponta para fora da parede.
 * Retorna null se o nome estiver vazio ou o texto não gerar contorno.
 */
export async function buildTextExtrusion(
  text: string,
  opts: CapaTextOptions
): Promise<THREE.BufferGeometry | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    await ensureGoogleFont(opts.fontFamily);
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.load(`${opts.height * pxPerMm}px "${opts.fontFamily}"`);
      await document.fonts.load(`bold ${opts.height * pxPerMm}px "${opts.fontFamily}"`);
    }
  } catch {
    // fallback
  }

  const targetFontHeightPx = Math.max(6, opts.height) * pxPerMm;
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) return null;

  // SEGA LOGO FONT tem um único peso; bold sintético engrossa os traços e fecha os filetes internos do logo.
  const isCursiveOrDisplay = ['Pacifico', 'Lobster', 'Dancing Script', 'Chewy', 'Bangers', 'SEGA LOGO FONT'].includes(
    opts.fontFamily
  );
  const fontWeight = isCursiveOrDisplay ? 'normal' : 'bold';
  const fontStyle = `${fontWeight} ${targetFontHeightPx}px "${opts.fontFamily}", sans-serif`;
  mctx.font = fontStyle;

  let textWidthPx = 0;
  const charOffsets: number[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    charOffsets.push(textWidthPx);
    textWidthPx += mctx.measureText(trimmed[i]).width;
  }

  if (textWidthPx <= 0) return null;

  const paddingPx = Math.ceil(targetFontHeightPx);
  const canvasWidth = Math.ceil(textWidthPx + paddingPx * 2);
  const canvasHeight = Math.ceil(targetFontHeightPx + paddingPx * 2);

  const drawCanvas = document.createElement('canvas');
  drawCanvas.width = canvasWidth;
  drawCanvas.height = canvasHeight;
  const ctx = drawCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000';

  const textStartXPx = paddingPx;
  const baselineY = paddingPx + targetFontHeightPx * 0.8;
  for (let i = 0; i < trimmed.length; i++) {
    ctx.fillText(trimmed[i], textStartXPx + charOffsets[i], baselineY);
  }

  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const centerXpx = canvasWidth / 2;
  const centerYpx = canvasHeight / 2;
  const contours = extractContoursFromImageData(imageData, mmPerPixel, centerXpx, centerYpx, 0.2);
  if (contours.outer.length === 0) return null;

  const shapes = buildThreeShapes(contours.outer, contours.holes);
  if (shapes.length === 0) return null;

  // Extrusão ao longo de +Z local; depois rotacionamos para -X (face frontal).
  const depth = 1.4;
  const geom = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 10 });

  // Plano local (x,y) = (Y, Z) do mundo; extrusão +Z local = -X do mundo.
  // rotateY(-90°): (X,Y,Z)->(Z,Y,-X). Depois translada para faceX.
  geom.rotateY(-Math.PI / 2);
  // Após rotateY(-90°): localZ (0..depth) → mundo -X (0..-depth). Centro em Y/Z:
  geom.translate(opts.faceX, opts.centerX, opts.centerZ);

  return geom;
}
