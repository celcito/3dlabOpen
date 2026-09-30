import * as THREE from 'three';
import type { KeychainConfig, GeneratedKeychain } from '../../types/keychain';
import type { Model3DDimensions } from '../../types/pencilTopper';
import {
  extractContoursFromImageData,
  buildThreeShapes,
  computeEnclosedEmptyMask,
  punchMask,
} from '../pencilTopper/contourExtractor';
import { ensureGoogleFont } from '../fonts/googleFonts';

const pxPerMm = 20;
const mmPerPixel = 1 / pxPerMm;
const CANVAS_ALPHA_THRESHOLD = 120;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem do ícone'));
    img.src = src;
  });
}

/** Recorta a margem transparente para a silhueta ocupar a caixa inteira. */
function trimImageAlpha(img: HTMLImageElement): {
  src: HTMLCanvasElement | HTMLImageElement;
  width: number;
  height: number;
} {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return { src: img, width: w, height: h };

  const probe = document.createElement('canvas');
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  if (!pctx) return { src: img, width: w, height: h };
  pctx.drawImage(img, 0, 0);
  const data = pctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] <= CANVAS_ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0 || (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1)) {
    return { src: img, width: w, height: h };
  }

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const dst = document.createElement('canvas');
  dst.width = cw;
  dst.height = ch;
  const dctx = dst.getContext('2d');
  if (!dctx) return { src: img, width: w, height: h };
  dctx.drawImage(img, -minX, -minY);
  return { src: dst, width: cw, height: ch };
}

function countSolidPixels(data: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > CANVAS_ALPHA_THRESHOLD) count++;
  }
  return count;
}

/** Aba de argola impressa: disco sólido grudado ao corpo + furo removido no canvas 2D. */
function drawLoopTab(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  config: KeychainConfig
): boolean {
  const holeRadiusMm = config.loopHoleDiameter / 2;
  const outerRadiusMm = holeRadiusMm + config.loopWallThickness;
  const outerRadiusPx = outerRadiusMm * pxPerMm;
  const holeRadiusPx = holeRadiusMm * pxPerMm;

  let minY = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (pixels[rowOffset + x * 4 + 3] > CANVAS_ALPHA_THRESHOLD) {
        if (minY === -1) minY = y;
        maxY = y;
        break;
      }
    }
  }
  if (minY === -1) return false;

  const centerRow = Math.round((minY + maxY) / 2);
  const maxDistance = Math.max(centerRow - minY, maxY - centerRow);
  const fromLeft = config.loopSide === 'left';

  for (let distance = 0; distance <= maxDistance; distance++) {
    const rows = distance === 0 ? [centerRow] : [centerRow - distance, centerRow + distance];
    for (const y of rows) {
      if (y < 0 || y >= height) continue;

      let solidX = -1;
      const rowOffset = y * width * 4;
      if (fromLeft) {
        for (let x = 0; x < width; x++) {
          if (pixels[rowOffset + x * 4 + 3] > CANVAS_ALPHA_THRESHOLD) {
            solidX = x;
            break;
          }
        }
      } else {
        for (let x = width - 1; x >= 0; x--) {
          if (pixels[rowOffset + x * 4 + 3] > CANVAS_ALPHA_THRESHOLD) {
            solidX = x;
            break;
          }
        }
      }
      if (solidX === -1) continue;

      const offsetX = fromLeft ? 0.45 * outerRadiusPx : -0.45 * outerRadiusPx;
      const cx = solidX + offsetX;
      const cy = y;
      if (
        cx - outerRadiusPx < 0 ||
        cx + outerRadiusPx > width - 1 ||
        cy - outerRadiusPx < 0 ||
        cy + outerRadiusPx > height - 1
      ) {
        continue;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, holeRadiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    }
  }

  return false;
}

export async function generateKeychainModel(config: KeychainConfig): Promise<GeneratedKeychain> {
  const text = config.text.trim() || 'Nome';
  const targetFontHeightPx = Math.max(10, config.letterHeight) * pxPerMm;

  try {
    if (!config.customFontName) await ensureGoogleFont(config.fontFamily);
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

  const letterSpacingPx = Math.max(0.0, config.letterSpacing ?? 1.8) * pxPerMm;
  let textWidthPx = 0;
  const charOffsets: number[] = [];
  for (let i = 0; i < text.length; i++) {
    charOffsets.push(textWidthPx);
    textWidthPx += mctx.measureText(text[i]).width + letterSpacingPx;
  }
  if (text.length > 0) textWidthPx -= letterSpacingPx;

  const textHeightPx = targetFontHeightPx;
  const outlinePx = Math.max(1.5, config.outlineSize * (config.fontWeightScale || 1.0)) * pxPerMm;

  let iconImage: CanvasImageSource | null = null;
  let iconNaturalWidth = 256;
  let iconNaturalHeight = 256;
  if (config.customIconUrl) {
    try {
      const trimmed = trimImageAlpha(await loadImage(config.customIconUrl));
      iconImage = trimmed.src;
      iconNaturalWidth = trimmed.width;
      iconNaturalHeight = trimmed.height;
    } catch (err) {
      console.warn('Ícone customizado indisponível, usando símbolo preset:', err);
      iconImage = null;
    }
  }

  const hasCustomIcon = !!iconImage;
  const hasSymbol = !hasCustomIcon && !!config.symbolId && config.symbolId !== 'none';
  const symbolSizePx = targetFontHeightPx * 0.85;
  const symbolGapPx = Math.min(symbolSizePx * 0.35, outlinePx);
  const iconGapPx = Math.min(symbolGapPx, outlinePx);

  let iconWidthPx = symbolSizePx;
  let iconHeightPx = symbolSizePx;
  if (iconImage) {
    const scale = Math.min(symbolSizePx / iconNaturalWidth, symbolSizePx / iconNaturalHeight);
    iconWidthPx = iconNaturalWidth * scale;
    iconHeightPx = iconNaturalHeight * scale;
  }

  let totalContentWidthPx = textWidthPx;
  if (hasCustomIcon) totalContentWidthPx += iconGapPx + iconWidthPx;
  else if (hasSymbol) totalContentWidthPx += symbolGapPx + symbolSizePx;

  const loopOuterRadiusPx =
    (config.loopHoleDiameter / 2 + config.loopWallThickness) * pxPerMm;
  const paddingPx = Math.ceil(
    Math.max(outlinePx * 2.5, config.loopEnabled ? loopOuterRadiusPx * 1.5 : 0) + 28
  );
  const canvasWidth = Math.ceil(totalContentWidthPx + paddingPx * 2);
  const canvasHeight = Math.ceil(textHeightPx + paddingPx * 2);

  const drawCanvas = document.createElement('canvas');
  drawCanvas.width = canvasWidth;
  drawCanvas.height = canvasHeight;
  const ctx = drawCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Erro ao inicializar contexto 2D');

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const textStartXPx = centerX - totalContentWidthPx / 2;
  const textBaselineY = centerY + textHeightPx * 0.32;
  const contentCenterYPx = textBaselineY - textHeightPx * 0.28;
  // Fim real da tinta do último caractere (sem side bearing) — sem isso o gap
  // ganha a entreletra e o símbolo/ícone acaba descolado do corpo.
  const lastCharMeasure = text.length > 0 ? mctx.measureText(text[text.length - 1]) : null;
  const lastCharInkRightPx = lastCharMeasure
    ? charOffsets[text.length - 1] + Math.max(lastCharMeasure.actualBoundingBoxRight ?? lastCharMeasure.width, 0)
    : textWidthPx;
  const textInkEndPx = textStartXPx + lastCharInkRightPx;
  const symbolX = textInkEndPx + symbolGapPx + symbolSizePx / 2;
  const iconCenterX = textInkEndPx + iconGapPx + iconWidthPx / 2;

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

  const drawIcon = (targetCtx: CanvasRenderingContext2D, x: number, y: number) => {
    if (!iconImage) return;
    targetCtx.save();
    targetCtx.drawImage(iconImage, x - iconWidthPx / 2, y - iconHeightPx / 2, iconWidthPx, iconHeightPx);
    targetCtx.restore();
  };

  const drawIconDilated = (targetCtx: CanvasRenderingContext2D, x: number, y: number) => {
    if (!iconImage) return;
    const dx = x - iconWidthPx / 2;
    const dy = y - iconHeightPx / 2;
    // Dilatação por deslocamentos circulares: blur(σ=outlinePx) erosiona traços
    // finos em vez de dilatar (conserva massa), deixando a base menor que o relevo.
    const steps = 16;
    targetCtx.save();
    targetCtx.drawImage(iconImage, dx, dy);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      targetCtx.drawImage(
        iconImage,
        dx + Math.cos(angle) * outlinePx,
        dy + Math.sin(angle) * outlinePx
      );
    }
    targetCtx.restore();
  };

  const drawText = (targetCtx: CanvasRenderingContext2D) => {
    targetCtx.font = fontStyle;
    targetCtx.textBaseline = 'alphabetic';
    targetCtx.textAlign = 'left';
    for (let i = 0; i < text.length; i++) {
      targetCtx.fillText(text[i], textStartXPx + charOffsets[i], textBaselineY);
    }
  };

  // 1) Máscara dos contadores (sem dilatação) — mantém buracos de letras/ícone abertos.
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  drawText(ctx);
  if (hasCustomIcon) drawIcon(ctx, iconCenterX, contentCenterYPx);
  else if (hasSymbol) drawPresetSymbol(ctx, symbolX, contentCenterYPx, symbolSizePx);
  const counterMask = computeEnclosedEmptyMask(ctx.getImageData(0, 0, canvasWidth, canvasHeight));

  // 2) Passo base: silhueta do texto com contorno grosso + símbolo/ícone dilatado.
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
    const cx = textStartXPx + charOffsets[i];
    ctx.strokeText(text[i], cx, textBaselineY);
    ctx.fillText(text[i], cx, textBaselineY);
  }
  if (hasCustomIcon) drawIconDilated(ctx, iconCenterX, contentCenterYPx);
  else if (hasSymbol) drawPresetSymbol(ctx, symbolX, contentCenterYPx, symbolSizePx + outlinePx * 1.5);

  const baseImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  punchMask(baseImgData, counterMask);
  ctx.putImageData(baseImgData, 0, 0);

  // 3) Argola opcional (sem CSG): disco grudado ao corpo + furo passante.
  if (config.loopEnabled) drawLoopTab(ctx, baseImgData.data, canvasWidth, canvasHeight, config);
  const baseAfterLoop = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

  const baseContours = extractContoursFromImageData(baseAfterLoop, mmPerPixel, canvasWidth / 2, canvasHeight / 2, 0.2);
  const baseShapes = buildThreeShapes(baseContours.outer, baseContours.holes);

  // 4) Relevo: mesmo conteúdo sem dilatação.
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
  if (hasCustomIcon) drawIcon(ctx, iconCenterX, contentCenterYPx);
  else if (hasSymbol) drawPresetSymbol(ctx, symbolX, contentCenterYPx, symbolSizePx);

  const reliefImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  punchMask(reliefImgData, counterMask);
  const reliefContours = extractContoursFromImageData(reliefImgData, mmPerPixel, canvasWidth / 2, canvasHeight / 2, 0.15);
  const reliefShapes = buildThreeShapes(reliefContours.outer, reliefContours.holes);

  const safeBaseShapes = baseShapes.length > 0 ? baseShapes : reliefShapes;
  const safeReliefShapes = reliefShapes.length > 0 ? reliefShapes : safeBaseShapes;

  const bodyThickness = Math.max(1.5, config.bodyThickness);
  const reliefThickness = Math.max(0.8, config.reliefThickness);
  const avgLetterHeight = config.letterHeight || 15;

  const baseGeom = new THREE.ExtrudeGeometry(safeBaseShapes, {
    depth: bodyThickness,
    bevelEnabled: true,
    bevelThickness: Math.min(0.4, avgLetterHeight * 0.025),
    bevelSize: Math.min(0.3, avgLetterHeight * 0.02),
    bevelSegments: 4,
  });

  const reliefGeom = new THREE.ExtrudeGeometry(safeReliefShapes, {
    depth: reliefThickness,
    bevelEnabled: true,
    bevelThickness: Math.min(0.3, avgLetterHeight * 0.02),
    bevelSize: Math.min(0.25, avgLetterHeight * 0.017),
    bevelSegments: 4,
  });
  reliefGeom.translate(0, 0, bodyThickness);

  baseGeom.computeBoundingBox();
  const bbBase = baseGeom.boundingBox || new THREE.Box3();
  const midX = (bbBase.min.x + bbBase.max.x) / 2;
  const midY = (bbBase.min.y + bbBase.max.y) / 2;
  baseGeom.translate(-midX, -midY, 0);
  reliefGeom.translate(-midX, -midY, 0);
  baseGeom.computeBoundingBox();
  reliefGeom.computeBoundingBox();

  const totalBox = (baseGeom.boundingBox || new THREE.Box3()).clone().union(reliefGeom.boundingBox || new THREE.Box3());
  const size = new THREE.Vector3();
  totalBox.getSize(size);

  const mm2PerPx = mmPerPixel * mmPerPixel;
  const baseAreaMm2 = countSolidPixels(baseAfterLoop.data) * mm2PerPx;
  const reliefAreaMm2 = countSolidPixels(reliefImgData.data) * mm2PerPx;
  const volumeCm3 = Math.max(
    1.0,
    Number(((baseAreaMm2 * bodyThickness + reliefAreaMm2 * reliefThickness) / 1000).toFixed(1))
  );
  const weightGrams = Number((volumeCm3 * 1.24).toFixed(1));
  const printTimeMinutes = Math.max(12, Math.round(weightGrams * 2.8 + 8));

  const dimensions: Model3DDimensions = {
    dimX: Number(size.x.toFixed(1)),
    dimY: Number(size.y.toFixed(1)),
    dimZ: Number(size.z.toFixed(1)),
    volumeCm3,
    weightGrams,
    printTimeMinutes,
  };

  const baseMesh = new THREE.Mesh(
    baseGeom,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.baseColor),
      roughness: 0.35,
      metalness: 0.08,
    })
  );
  baseMesh.name = '1_Corpo_do_Chaveiro';
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;

  const reliefMesh = new THREE.Mesh(
    reliefGeom,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.reliefColor),
      roughness: 0.28,
      metalness: 0.12,
    })
  );
  reliefMesh.name = '2_Nome_em_Relevo';
  reliefMesh.castShadow = true;
  reliefMesh.receiveShadow = true;

  return { baseMesh, reliefMesh, dimensions };
}
