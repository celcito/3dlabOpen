import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import type { PencilTopperConfig, Model3DDimensions } from '../../types/pencilTopper';
import { extractContoursFromImageData, buildThreeShapes, computeEnclosedEmptyMask, punchMask } from './contourExtractor';
import { ensureGoogleFont } from '../fonts/googleFonts';

export interface GeneratedPencilTopper {
  baseMesh: THREE.Mesh;
  reliefMesh: THREE.Mesh;
  guideGroup: THREE.Group;
  dimensions: Model3DDimensions;
}

export async function generatePencilTopperModel(
  config: PencilTopperConfig
): Promise<GeneratedPencilTopper> {
  const text = config.text.trim() || 'Milene';
  const effectiveDiameter = Math.max(4.0, config.pencilDiameter + config.clearance);
  const pxPerMm = 20;
  const targetFontHeightPx = Math.max(10, config.letterHeight) * pxPerMm;

  try {
    await ensureGoogleFont(config.fontFamily);
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.load(`${targetFontHeightPx}px "${config.fontFamily}"`);
      await document.fonts.load(`bold ${targetFontHeightPx}px "${config.fontFamily}"`);
    }
  } catch {
    // fallback
  }

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('Falha ao inicializar Canvas 2D');

  const isCursiveOrDisplay = ['Pacifico', 'Lobster', 'Dancing Script', 'Chewy', 'Bangers'].includes(config.fontFamily);
  const fontWeight = isCursiveOrDisplay ? 'normal' : 'bold';
  const fontStyle = `${fontWeight} ${targetFontHeightPx}px "${config.fontFamily}", sans-serif`;
  mctx.font = fontStyle;

  const letterSpacingMm = Math.max(0.0, config.letterSpacing ?? 1.8);
  const letterSpacingPx = letterSpacingMm * pxPerMm;
  let textWidthPx = 0;
  const charOffsets: number[] = [];

  for (let i = 0; i < text.length; i++) {
    charOffsets.push(textWidthPx);
    const w = mctx.measureText(text[i]).width;
    textWidthPx += w + letterSpacingPx;
  }
  if (text.length > 0) {
    textWidthPx -= letterSpacingPx;
  }

  const textHeightPx = targetFontHeightPx;
  const outlinePx = Math.max(1.5, config.outlineSize * (config.fontWeightScale || 1.0)) * pxPerMm;

  const innerRadiusMm = effectiveDiameter / 2;
  const socketOuterRadiusMm = innerRadiusMm + Math.max(1.5, config.baseWallThickness);
  const socketOuterRadiusPx = socketOuterRadiusMm * pxPerMm;

  const baseHeightMm = Math.max(config.socketHeight || 12.5, socketOuterRadiusMm * 2);

  const hasSymbol = config.symbolId && config.symbolId !== 'none';
  const symbolSizePx = targetFontHeightPx * 0.85;
  const symbolGapPx = symbolSizePx * 0.35;

  let totalContentWidthPx = textWidthPx;
  if (hasSymbol) {
    totalContentWidthPx += symbolGapPx + symbolSizePx;
  }

  const paddingPx = Math.ceil(Math.max(outlinePx * 2.5, socketOuterRadiusPx * 2) + 28);
  const canvasWidth = Math.ceil(totalContentWidthPx + paddingPx * 2);
  const canvasHeight = Math.ceil(Math.max(textHeightPx, socketOuterRadiusPx * 2) + paddingPx * 2);

  const drawCanvas = document.createElement('canvas');
  drawCanvas.width = canvasWidth;
  drawCanvas.height = canvasHeight;
  const ctx = drawCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Erro ao inicializar contexto 2D');

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const textStartXPx = centerX - totalContentWidthPx / 2;
  const textBaselineY = centerY + textHeightPx * 0.32;
  const symbolX = textStartXPx + textWidthPx + symbolGapPx + symbolSizePx / 2;
  const tunnelCenterYPx = textBaselineY - textHeightPx * 0.28;

  const drawPresetSymbol = (
    targetCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ) => {
    targetCtx.save();
    targetCtx.translate(x, y);
    const s = size / 2;

    switch (config.symbolId) {
      case 'heart': {
        targetCtx.beginPath();
        targetCtx.moveTo(0, s * 0.3);
        targetCtx.bezierCurveTo(-s, -s * 0.6, -s * 1.1, s * 0.3, 0, s * 1.1);
        targetCtx.bezierCurveTo(s * 1.1, s * 0.3, s, -s * 0.6, 0, s * 0.3);
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      case 'star': {
        targetCtx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? s * 1.1 : s * 0.45;
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) targetCtx.moveTo(px, py);
          else targetCtx.lineTo(px, py);
        }
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      case 'crown': {
        targetCtx.beginPath();
        targetCtx.moveTo(-s * 0.9, s * 0.7);
        targetCtx.lineTo(-s * 0.9, -s * 0.3);
        targetCtx.lineTo(-s * 0.4, s * 0.1);
        targetCtx.lineTo(0, -s * 0.7);
        targetCtx.lineTo(s * 0.4, s * 0.1);
        targetCtx.lineTo(s * 0.9, -s * 0.3);
        targetCtx.lineTo(s * 0.9, s * 0.7);
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      case 'flower': {
        targetCtx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI) / 5;
          const px = Math.cos(angle) * s * 0.55;
          const py = Math.sin(angle) * s * 0.55;
          targetCtx.arc(px, py, s * 0.45, 0, Math.PI * 2);
        }
        targetCtx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
        targetCtx.fill();
        break;
      }
      case 'butterfly': {
        targetCtx.beginPath();
        targetCtx.ellipse(-s * 0.5, -s * 0.4, s * 0.45, s * 0.65, -0.4, 0, Math.PI * 2);
        targetCtx.ellipse(s * 0.5, -s * 0.4, s * 0.45, s * 0.65, 0.4, 0, Math.PI * 2);
        targetCtx.ellipse(-s * 0.4, s * 0.4, s * 0.35, s * 0.45, 0.3, 0, Math.PI * 2);
        targetCtx.ellipse(s * 0.4, s * 0.4, s * 0.35, s * 0.45, -0.3, 0, Math.PI * 2);
        targetCtx.rect(-s * 0.1, -s * 0.7, s * 0.2, s * 1.4);
        targetCtx.fill();
        break;
      }
      case 'dino': {
        targetCtx.beginPath();
        targetCtx.arc(s * 0.3, -s * 0.5, s * 0.4, 0, Math.PI * 2);
        targetCtx.rect(-s * 0.5, -s * 0.2, s * 0.9, s * 0.8);
        targetCtx.rect(-s * 0.4, s * 0.5, s * 0.2, s * 0.4);
        targetCtx.rect(s * 0.1, s * 0.5, s * 0.2, s * 0.4);
        targetCtx.fill();
        break;
      }
      case 'gamepad': {
        targetCtx.beginPath();
        targetCtx.roundRect(-s * 0.9, -s * 0.4, s * 1.8, s * 0.8, s * 0.3);
        targetCtx.fill();
        break;
      }
      case 'ball': {
        targetCtx.beginPath();
        targetCtx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
        targetCtx.fill();
        break;
      }
      case 'gradcap': {
        targetCtx.beginPath();
        targetCtx.moveTo(0, -s * 0.7);
        targetCtx.lineTo(s * 0.9, -s * 0.1);
        targetCtx.lineTo(0, s * 0.3);
        targetCtx.lineTo(-s * 0.9, -s * 0.1);
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      default:
        break;
    }
    targetCtx.restore();
  };

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], textStartXPx + charOffsets[i], textBaselineY);
  }
  if (hasSymbol) {
    drawPresetSymbol(ctx, symbolX, tunnelCenterYPx, symbolSizePx);
  }
  const counterMask = computeEnclosedEmptyMask(
    ctx.getImageData(0, 0, canvasWidth, canvasHeight)
  );

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const orientation = config.holeOrientation || 'horizontal';

  if (orientation === 'horizontal') {
    const capLeft = textStartXPx - outlinePx;
    const capRight = textStartXPx + totalContentWidthPx + outlinePx;
    const capWidth = capRight - capLeft;
    const capHeight = socketOuterRadiusPx * 2;
    const capY = tunnelCenterYPx - capHeight / 2;
    ctx.beginPath();
    ctx.roundRect(capLeft, capY, capWidth, capHeight, socketOuterRadiusPx);
    ctx.fill();
  } else if (orientation === 'vertical') {
    const textCenterX = textStartXPx + totalContentWidthPx / 2;
    const capTop = centerY - textHeightPx * 0.6;
    const capBottom = centerY + textHeightPx * 0.6;
    const capWidth = socketOuterRadiusPx * 2;
    const capHeight = capBottom - capTop;
    ctx.beginPath();
    ctx.roundRect(textCenterX - capWidth / 2, capTop, capWidth, capHeight, socketOuterRadiusPx);
    ctx.fill();
  } else {
    const textCenterX = textStartXPx + totalContentWidthPx / 2;
    ctx.beginPath();
    ctx.arc(textCenterX, centerY, socketOuterRadiusPx, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = outlinePx * 2;
  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  for (let i = 0; i < text.length; i++) {
    const cx = textStartXPx + charOffsets[i];
    ctx.strokeText(text[i], cx, textBaselineY);
    ctx.fillText(text[i], cx, textBaselineY);
  }

  if (hasSymbol) {
    drawPresetSymbol(ctx, symbolX, tunnelCenterYPx, symbolSizePx + outlinePx * 1.5);
  }

  const baseImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  punchMask(baseImgData, counterMask);
  const mmPerPixel = 1 / pxPerMm;
  const baseContours = extractContoursFromImageData(baseImgData, mmPerPixel, canvasWidth / 2, canvasHeight / 2, 0.2);
  const baseShapes = buildThreeShapes(baseContours.outer, baseContours.holes);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.0 * pxPerMm;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  for (let i = 0; i < text.length; i++) {
    const cx = textStartXPx + charOffsets[i];
    ctx.strokeText(text[i], cx, textBaselineY);
    ctx.fillText(text[i], cx, textBaselineY);
  }

  if (hasSymbol) {
    drawPresetSymbol(ctx, symbolX, tunnelCenterYPx, symbolSizePx);
  }

  const reliefImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  punchMask(reliefImgData, counterMask);
  const reliefContours = extractContoursFromImageData(reliefImgData, mmPerPixel, canvasWidth / 2, canvasHeight / 2, 0.15);
  const reliefShapes = buildThreeShapes(reliefContours.outer, reliefContours.holes);

  const safeBaseShapes = baseShapes.length > 0 ? baseShapes : reliefShapes;
  const safeReliefShapes = reliefShapes.length > 0 ? reliefShapes : safeBaseShapes;

  const avgLetterHeight = config.letterHeight || 15;
  const bevelScale = Math.min(1.0, avgLetterHeight / 15);

  const baseExtrudeGeom = new THREE.ExtrudeGeometry(safeBaseShapes, {
    depth: baseHeightMm,
    bevelEnabled: true,
    bevelThickness: Math.min(0.4, avgLetterHeight * 0.025),
    bevelSize: Math.min(0.3, avgLetterHeight * 0.02),
    bevelSegments: 4,
  });

  baseExtrudeGeom.computeBoundingBox();
  const bbBaseInit = baseExtrudeGeom.boundingBox || new THREE.Box3();
  const centerMmX = (bbBaseInit.min.x + bbBaseInit.max.x) / 2;
  const centerTunnelMmY = -(tunnelCenterYPx - canvasHeight / 2) * mmPerPixel;
  const totalLengthMm = bbBaseInit.max.x - bbBaseInit.min.x;
  const totalHeightMm = bbBaseInit.max.y - bbBaseInit.min.y;

  const holeRadius = innerRadiusMm;
  const holeSegs = config.holeShape === 'hexagonal' ? 6 : 32;

  let holeGeom: THREE.CylinderGeometry;
  if (orientation === 'horizontal') {
    const holeLength = totalLengthMm + 30;
    holeGeom = new THREE.CylinderGeometry(holeRadius, holeRadius, holeLength, holeSegs);
    holeGeom.rotateZ(Math.PI / 2);
    holeGeom.translate(centerMmX, centerTunnelMmY, baseHeightMm / 2);
  } else if (orientation === 'vertical') {
    const holeHeight = totalHeightMm + 30;
    holeGeom = new THREE.CylinderGeometry(holeRadius, holeRadius, holeHeight, holeSegs);
    holeGeom.translate(centerMmX, centerTunnelMmY, baseHeightMm / 2);
  } else {
    const holeDepth = baseHeightMm + 20;
    holeGeom = new THREE.CylinderGeometry(holeRadius, holeRadius, holeDepth, holeSegs);
    holeGeom.rotateX(Math.PI / 2);
    holeGeom.translate(centerMmX, centerTunnelMmY, baseHeightMm / 2);
  }

  let finalBaseGeom: THREE.BufferGeometry;
  try {
    const baseBrush = new Brush(baseExtrudeGeom);
    const holeBrush = new Brush(holeGeom);
    baseBrush.updateMatrixWorld();
    holeBrush.updateMatrixWorld();

    const evaluator = new Evaluator();
    const csgResult = evaluator.evaluate(baseBrush, holeBrush, SUBTRACTION);
    finalBaseGeom = csgResult.geometry;
    finalBaseGeom.computeVertexNormals();
  } catch (csgErr) {
    console.warn('Fallback CSG:', csgErr);
    finalBaseGeom = baseExtrudeGeom;
  }

  const reliefGeom = new THREE.ExtrudeGeometry(safeReliefShapes, {
    depth: Math.max(0.8, config.reliefThickness),
    bevelEnabled: true,
    bevelThickness: Math.min(0.3, avgLetterHeight * 0.02),
    bevelSize: Math.min(0.25, avgLetterHeight * 0.017),
    bevelSegments: 4,
  });
  reliefGeom.translate(0, 0, baseHeightMm);

  finalBaseGeom.computeBoundingBox();
  const bbFinal = finalBaseGeom.boundingBox || new THREE.Box3();
  const midX = (bbFinal.min.x + bbFinal.max.x) / 2;
  const midY = (bbFinal.min.y + bbFinal.max.y) / 2;

  finalBaseGeom.translate(-midX, -midY, 0);
  reliefGeom.translate(-midX, -midY, 0);

  finalBaseGeom.computeBoundingBox();
  reliefGeom.computeBoundingBox();

  const finalBbBase = finalBaseGeom.boundingBox || new THREE.Box3();
  const finalBbRelief = reliefGeom.boundingBox || new THREE.Box3();
  const totalBox = finalBbBase.clone().union(finalBbRelief);

  const size = new THREE.Vector3();
  totalBox.getSize(size);

  const dimX = Number(size.x.toFixed(1));
  const dimY = Number(size.y.toFixed(1));
  const dimZ = Number(size.z.toFixed(1));

  const estimatedVolCm3 = Number(
    (
      (dimX * dimY * 0.45 * baseHeightMm -
        Math.PI * Math.pow(innerRadiusMm, 2) * dimX +
        dimX * dimY * 0.25 * config.reliefThickness) /
      1000
    ).toFixed(1)
  );
  const safeVol = Math.max(2.0, estimatedVolCm3);
  const weightGrams = Number((safeVol * 1.24).toFixed(1));
  const printTimeMinutes = Math.max(12, Math.round(weightGrams * 2.8 + 8));

  const dimensions: Model3DDimensions = {
    dimX,
    dimY,
    dimZ,
    volumeCm3: safeVol,
    weightGrams,
    printTimeMinutes,
  };

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.baseColor),
    roughness: 0.35,
    metalness: 0.08,
  });

  const reliefMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.reliefColor),
    roughness: 0.28,
    metalness: 0.12,
  });

  const baseMesh = new THREE.Mesh(finalBaseGeom, baseMaterial);
  baseMesh.name = '1_Corpo_da_Base';
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;

  const reliefMesh = new THREE.Mesh(reliefGeom, reliefMaterial);
  reliefMesh.name = '2_Letras_em_Relevo';
  reliefMesh.castShadow = true;
  reliefMesh.receiveShadow = true;

  const guideGroup = new THREE.Group();
  guideGroup.name = 'Guia_Vazia';

  return {
    baseMesh,
    reliefMesh,
    guideGroup,
    dimensions,
  };
}
