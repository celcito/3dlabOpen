import * as THREE from 'three';
import type { LetterBoxConfig, Model3DDimensions } from '../../types/letterBox';
import { extractContoursFromImageData, buildThreeShapes } from '../pencilTopper/contourExtractor';
import { ensureGoogleFont } from '../fonts/googleFonts';

export interface GeneratedLetterBox {
  backMesh: THREE.Mesh;
  midMesh: THREE.Mesh;
  frontMesh: THREE.Mesh;
  dimensions: Model3DDimensions;
}

export async function generateLetterBoxModel(
  config: LetterBoxConfig
): Promise<GeneratedLetterBox> {
  const textLines = config.text.trim().split('\n').filter((l) => l.length > 0);
  const displayTextLines = textLines.length > 0 ? textLines : ['M2CR'];

  const pxPerMm = 8;
  const targetFontHeightPx = Math.max(20, config.letterHeight) * pxPerMm;

  try {
    if (!config.customFontName) await ensureGoogleFont(config.fontFamily);
    if (document.fonts) {
      await document.fonts.load(`bold ${targetFontHeightPx}px "${config.fontFamily}"`);
    }
  } catch {
    // fallback
  }

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('Falha ao inicializar Canvas 2D');

  const fontStyle = `bold ${targetFontHeightPx}px "${config.fontFamily}", "Poppins", sans-serif`;
  mctx.font = fontStyle;

  const letterSpacingPx = config.letterSpacing * pxPerMm;
  const lineSpacingRatio = 1.15;

  let maxLineWidthPx = 0;
  const lineMetrics: { text: string; width: number; charOffsets: number[] }[] = [];

  for (const line of displayTextLines) {
    let currentX = 0;
    const charOffsets: number[] = [];
    for (let i = 0; i < line.length; i++) {
      charOffsets.push(currentX);
      const charWidth = mctx.measureText(line[i]).width;
      currentX += charWidth + letterSpacingPx;
    }
    const lineWidth = currentX > 0 ? currentX - letterSpacingPx : 0;
    maxLineWidthPx = Math.max(maxLineWidthPx, lineWidth);
    lineMetrics.push({ text: line, width: lineWidth, charOffsets });
  }

  const totalLines = displayTextLines.length;
  const totalTextHeightPx = targetFontHeightPx + (totalLines - 1) * targetFontHeightPx * lineSpacingRatio;

  const maxContourPx = Math.max(config.backContour, config.midContour) * pxPerMm;
  const paddingPx = Math.ceil(maxContourPx + 30);

  const canvasWidth = Math.ceil(maxLineWidthPx + paddingPx * 2);
  const canvasHeight = Math.ceil(totalTextHeightPx + paddingPx * 2);

  const drawCanvas = document.createElement('canvas');
  drawCanvas.width = canvasWidth;
  drawCanvas.height = canvasHeight;
  const ctx = drawCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Não foi possível inicializar o contexto de desenho');

  const startY = paddingPx + targetFontHeightPx * 0.82;

  const renderTextToContext = (
    targetCtx: CanvasRenderingContext2D,
    mode: 'fill' | 'stroke_and_fill',
    strokeWidthPx: number,
    withFlatBase: boolean
  ) => {
    targetCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    targetCtx.font = fontStyle;
    targetCtx.textBaseline = 'alphabetic';
    targetCtx.textAlign = 'left';
    targetCtx.lineJoin = 'round';
    targetCtx.lineCap = 'round';
    targetCtx.fillStyle = '#000000';
    targetCtx.strokeStyle = '#000000';
    targetCtx.lineWidth = strokeWidthPx;

    let lowestY = 0;

    for (let l = 0; l < totalLines; l++) {
      const lineY = startY + l * targetFontHeightPx * lineSpacingRatio;
      const { text, charOffsets } = lineMetrics[l];
      const lineX = paddingPx;

      for (let i = 0; i < text.length; i++) {
        const charX = lineX + charOffsets[i];
        if (mode === 'stroke_and_fill') {
          targetCtx.strokeText(text[i], charX, lineY);
        }
        targetCtx.fillText(text[i], charX, lineY);
      }

      lowestY = Math.max(lowestY, lineY);
    }

    if (withFlatBase) {
      const baseTopY = lowestY + (strokeWidthPx > 0 ? strokeWidthPx * 0.45 : 0) - (2 * pxPerMm);
      const baseHeightPx = Math.max(6 * pxPerMm, strokeWidthPx * 0.5);
      const baseLeftX = paddingPx - (strokeWidthPx > 0 ? strokeWidthPx * 0.45 : 0);
      const baseWidthPx = maxLineWidthPx + (strokeWidthPx > 0 ? strokeWidthPx * 0.9 : 0);

      targetCtx.fillRect(baseLeftX, baseTopY, baseWidthPx, baseHeightPx);
    }
  };

  const mmPerPixel = 1 / pxPerMm;

  const backStrokePx = Math.max(1, config.backContour * 2 * pxPerMm);
  renderTextToContext(ctx, 'stroke_and_fill', backStrokePx, config.flatBase);
  const backImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const backContours = extractContoursFromImageData(backImgData, mmPerPixel, canvasWidth / 2, canvasHeight / 2, 0.45);
  const backShapes = buildThreeShapes(backContours.outer, backContours.holes);

  const midStrokePx = Math.max(1, config.midContour * 2 * pxPerMm);
  renderTextToContext(ctx, 'stroke_and_fill', midStrokePx, config.flatBase);
  const midImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const midContours = extractContoursFromImageData(midImgData, mmPerPixel, canvasWidth / 2, canvasHeight / 2, 0.4);
  const midShapes = buildThreeShapes(midContours.outer, midContours.holes);

  renderTextToContext(ctx, 'fill', 0, false);
  const frontImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const frontContours = extractContoursFromImageData(frontImgData, mmPerPixel, canvasWidth / 2, canvasHeight / 2, 0.3);
  const frontShapes = buildThreeShapes(frontContours.outer, frontContours.holes);

  const safeBackShapes = backShapes.length > 0 ? backShapes : (midShapes.length > 0 ? midShapes : frontShapes);
  const safeMidShapes = midShapes.length > 0 ? midShapes : safeBackShapes;
  const safeFrontShapes = frontShapes.length > 0 ? frontShapes : safeMidShapes;

  const backGeom = new THREE.ExtrudeGeometry(safeBackShapes, {
    depth: Math.max(1, config.backDepth),
    bevelEnabled: true,
    bevelThickness: 0.8,
    bevelSize: 0.6,
    bevelSegments: 2,
    curveSegments: 12,
  });

  const midGeom = new THREE.ExtrudeGeometry(safeMidShapes, {
    depth: Math.max(0.6, config.midThickness),
    bevelEnabled: true,
    bevelThickness: 0.4,
    bevelSize: 0.3,
    bevelSegments: 2,
    curveSegments: 12,
  });

  const frontGeom = new THREE.ExtrudeGeometry(safeFrontShapes, {
    depth: Math.max(0.6, config.frontThickness),
    bevelEnabled: config.bevelFront,
    bevelThickness: config.bevelFront ? Math.min(0.8, config.bevelSize) : 0,
    bevelSize: config.bevelFront ? Math.min(0.6, config.bevelSize * 0.8) : 0,
    bevelSegments: 3,
    curveSegments: 12,
  });

  const backMaterial = new THREE.MeshStandardMaterial({
    color: config.backColor,
    roughness: 0.45,
    metalness: 0.05,
  });

  const midMaterial = new THREE.MeshStandardMaterial({
    color: config.midColor,
    roughness: 0.42,
    metalness: 0.05,
  });

  const frontMaterial = new THREE.MeshStandardMaterial({
    color: config.frontColor,
    roughness: 0.35,
    metalness: 0.05,
  });

  const backMesh = new THREE.Mesh(backGeom, backMaterial);
  backMesh.name = 'Camada_1_Traseira_Caixa';
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;

  const midMesh = new THREE.Mesh(midGeom, midMaterial);
  midMesh.name = 'Camada_2_Intermediaria';
  midMesh.castShadow = true;
  midMesh.receiveShadow = true;

  const frontMesh = new THREE.Mesh(frontGeom, frontMaterial);
  frontMesh.name = 'Camada_3_Texto_Frontal';
  frontMesh.castShadow = true;
  frontMesh.receiveShadow = true;

  backMesh.position.set(0, 0, 0);
  midMesh.position.set(0, 0, config.backDepth);
  frontMesh.position.set(0, 0, config.backDepth + config.midThickness);

  backGeom.computeBoundingBox();
  midGeom.computeBoundingBox();
  frontGeom.computeBoundingBox();

  const overallBox = new THREE.Box3();
  overallBox.union(backGeom.boundingBox!);
  overallBox.union(midGeom.boundingBox!);
  overallBox.union(frontGeom.boundingBox!);

  const size = new THREE.Vector3();
  overallBox.getSize(size);

  const dimX = Number(size.x.toFixed(1));
  const dimY = Number(size.y.toFixed(1));
  const dimZ = Number((config.backDepth + config.midThickness + config.frontThickness).toFixed(1));

  const baseAreaCm2 = (dimX * dimY * 0.42) / 100;
  const volumeCm3 = Number(
    (
      (baseAreaCm2 * (config.backDepth * 0.2 + config.midThickness * 0.8 + config.frontThickness * 0.9)) / 10
    ).toFixed(1)
  );
  const weightGrams = Math.max(6, Number((volumeCm3 * 1.24 * 0.35 + 8).toFixed(1)));
  const printTimeMinutes = Math.max(15, Math.round(weightGrams * 2.1 + 10));

  const dimensions: Model3DDimensions = {
    dimX,
    dimY,
    dimZ,
    volumeCm3,
    weightGrams,
    printTimeMinutes,
  };

  return {
    backMesh,
    midMesh,
    frontMesh,
    dimensions,
  };
}
