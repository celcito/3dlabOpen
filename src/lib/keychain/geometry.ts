import * as THREE from 'three';
import type { KeychainConfig, GeneratedKeychain } from '../../types/keychain';
import type { Model3DDimensions } from '../../types/pencilTopper';
import {
  extractContoursFromImageData,
  buildThreeShapes,
  computeEnclosedEmptyMask,
  punchMask,
} from '../pencilTopper/contourExtractor';
import { drawSymbol } from '../pencilTopper/symbols';
import { ensureGoogleFont } from '../fonts/googleFonts';
import { flattenBottomBevel } from './bevel';
import { loopCenterInsetMm, resolveLoopGapMm } from './loop';
import { SYMBOL_GAP_FACTOR_MIN, SYMBOL_GAP_FACTOR_MAX } from './storage';

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

      // Centro do furo: a `loopLetterGap` mm da letra (antes era fixo em 0,45·raio, o que
      // deixava o furo colado — ou até invadindo — a inicial).
      const insetPx = loopCenterInsetMm(config) * pxPerMm;
      const offsetX = fromLeft ? insetPx : -insetPx;
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

  // SEGA LOGO FONT tem um único peso; bold sintético engrossa os traços e fecha os filetes internos do logo.
  const isCursiveOrDisplay = ['Pacifico', 'Lobster', 'Dancing Script', 'Chewy', 'Bangers', 'SEGA LOGO FONT'].includes(config.fontFamily);
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
  // Borda da base = outlineSize puro; "Espessura da Fonte" engorda só as letras em relevo.
  const outlinePx = Math.max(1.5, config.outlineSize) * pxPerMm;
  const fontScale = Math.min(2, Math.max(0.5, config.fontWeightScale || 1));
  // SEGA: os filetes internos do logo têm 0,25–0,65 mm e estão abertos nas pontas —
  // qualquer dilatação os fecha (o punchMask só restaura contadores fechados). Sem dilatação.
  const reliefDilationMm = config.fontFamily === 'SEGA LOGO FONT' ? 0 : (fontScale - 0.5) * 0.4;

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
  const hasPresetSymbol = !hasCustomIcon && !!config.symbolId && config.symbolId !== 'none';
  const hasIcon = hasCustomIcon || hasPresetSymbol;
  const symbolPosition = config.symbolPosition || 'right';
  const showIconLeft = hasIcon && (symbolPosition === 'left' || symbolPosition === 'both');
  const showIconRight = hasIcon && (symbolPosition === 'right' || symbolPosition === 'both');
  const iconCount = (showIconLeft ? 1 : 0) + (showIconRight ? 1 : 0);
  const symbolSizePx = targetFontHeightPx * 0.85;
  const symbolGapFactor = Math.max(SYMBOL_GAP_FACTOR_MIN, config.symbolGapFactor ?? SYMBOL_GAP_FACTOR_MIN);
  const symbolGapPx = Math.min(symbolSizePx * symbolGapFactor, outlinePx);
  const iconGapPx = Math.min(symbolGapPx, outlinePx);

  let iconWidthPx = symbolSizePx;
  let iconHeightPx = symbolSizePx;
  if (iconImage) {
    const scale = Math.min(symbolSizePx / iconNaturalWidth, symbolSizePx / iconNaturalHeight);
    iconWidthPx = iconNaturalWidth * scale;
    iconHeightPx = iconNaturalHeight * scale;
  }
  const iconBlockWidthPx = hasCustomIcon ? iconWidthPx : symbolSizePx;
  const iconBlockGapPx = hasCustomIcon ? iconGapPx : symbolGapPx;
  const iconBlockPx = iconCount * (iconBlockGapPx + iconBlockWidthPx);

  const totalContentWidthPx = textWidthPx + iconBlockPx;

  const loopOuterRadiusPx =
    (config.loopHoleDiameter / 2 + config.loopWallThickness) * pxPerMm;
  // Alcance da aba além da letra: furo + parede + folga (a aba pode sair do corpo).
  const loopReachPx =
    (config.loopHoleDiameter + config.loopWallThickness + resolveLoopGapMm(config)) * pxPerMm;
  const paddingPx = Math.ceil(
    Math.max(
      outlinePx * 2.5,
      config.loopEnabled ? Math.max(loopOuterRadiusPx * 1.5, loopReachPx) : 0
    ) + 28
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
  const contentStartXPx = centerX - totalContentWidthPx / 2;
  const leftBlockPx = showIconLeft ? iconBlockGapPx + iconBlockWidthPx : 0;
  const textStartXPx = contentStartXPx + leftBlockPx;
  const textBaselineY = centerY + textHeightPx * 0.32;
  const contentCenterYPx = textBaselineY - textHeightPx * 0.28;
  // Fim real da tinta do último caractere (sem side bearing) — sem isso o gap
  // ganha a entreletra e o símbolo/ícone acaba descolado do corpo.
  const lastCharMeasure = text.length > 0 ? mctx.measureText(text[text.length - 1]) : null;
  const lastCharInkRightPx = lastCharMeasure
    ? charOffsets[text.length - 1] + Math.max(lastCharMeasure.actualBoundingBoxRight ?? lastCharMeasure.width, 0)
    : textWidthPx;
  const textInkEndPx = textStartXPx + lastCharInkRightPx;
  const iconLeftCenterX = contentStartXPx + iconBlockWidthPx / 2;
  const iconRightCenterX = textInkEndPx + iconBlockGapPx + iconBlockWidthPx / 2;

  const drawIconBlock = (targetCtx: CanvasRenderingContext2D, x: number, outline = 0) => {
    if (hasCustomIcon) {
      if (outline > 0) drawIconDilated(targetCtx, x, contentCenterYPx);
      else drawIcon(targetCtx, x, contentCenterYPx);
    } else if (hasPresetSymbol) {
      drawSymbol(targetCtx, config.symbolId, x, contentCenterYPx, symbolSizePx, outline);
    }
  };

  const drawIcons = (targetCtx: CanvasRenderingContext2D, outline = 0) => {
    if (showIconLeft) drawIconBlock(targetCtx, iconLeftCenterX, outline);
    if (showIconRight) drawIconBlock(targetCtx, iconRightCenterX, outline);
  };

  const drawText = (targetCtx: CanvasRenderingContext2D) => {
    targetCtx.font = fontStyle;
    targetCtx.textBaseline = 'alphabetic';
    targetCtx.textAlign = 'left';
    for (let i = 0; i < text.length; i++) {
      targetCtx.fillText(text[i], textStartXPx + charOffsets[i], textBaselineY);
    }
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

  // 1) Máscara dos contadores (sem dilatação) — mantém buracos de letras/ícone abertos.
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  drawText(ctx);
  drawIcons(ctx);
  const counterMask = computeEnclosedEmptyMask(ctx.getImageData(0, 0, canvasWidth, canvasHeight));

  // 2) Passo base: silhueta do texto com contorno grosso + ícone dilatado.
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  // Contorno da base acompanha o desenho da fonte: quina em bissetriz (paralela ao
  // glifo) em vez de arco, que transformava tudo em "nuvem". miterLimit corta as
  // pontas agudas demais (bevel) para a borda não espetar.
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 3;
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
  drawIcons(ctx, outlinePx);

  const baseImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  punchMask(baseImgData, counterMask);
  ctx.putImageData(baseImgData, 0, 0);

  // 3) Argola opcional (sem CSG): disco grudado ao corpo + furo passante.
  if (config.loopEnabled) drawLoopTab(ctx, baseImgData.data, canvasWidth, canvasHeight, config);
  const baseAfterLoop = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

  const baseContours = extractContoursFromImageData(
    baseAfterLoop,
    mmPerPixel,
    canvasWidth / 2,
    canvasHeight / 2,
    0.07,
    { resimplifyMm: 0.03 }
  );
  const baseShapes = buildThreeShapes(baseContours.outer, baseContours.holes);

  // 4) Relevo: texto com dilatação controlada pela "Espessura da Fonte" + ícone sem dilatação.
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  // lineWidth 0 é inválido no canvas (mantém o valor anterior da base); sem dilação, só o fill.
  const reliefStroke = reliefDilationMm > 0.01;
  if (reliefStroke) ctx.lineWidth = reliefDilationMm * 2 * pxPerMm;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    const cx = textStartXPx + charOffsets[i];
    if (reliefStroke) ctx.strokeText(text[i], cx, textBaselineY);
    ctx.fillText(text[i], cx, textBaselineY);
  }
  drawIcons(ctx, reliefStroke ? reliefDilationMm * pxPerMm : 0);

  const reliefImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  punchMask(reliefImgData, counterMask);
  const reliefContours = extractContoursFromImageData(
    reliefImgData,
    mmPerPixel,
    canvasWidth / 2,
    canvasHeight / 2,
    0.05,
    { resimplifyMm: 0.02 }
  );
  const reliefShapes = buildThreeShapes(reliefContours.outer, reliefContours.holes);

  const safeBaseShapes = baseShapes.length > 0 ? baseShapes : reliefShapes;
  const safeReliefShapes = reliefShapes.length > 0 ? reliefShapes : safeBaseShapes;

  const bodyThickness = Math.max(1.5, config.bodyThickness);
  const reliefThickness = Math.max(0.8, config.reliefThickness);
  const avgLetterHeight = config.letterHeight || 15;

  // O ExtrudeGeometry com bevel ocupa [-bevelThickness, depth + bevelThickness] em Z.
  const baseBevelThickness = Math.min(0.4, avgLetterHeight * 0.025);
  const reliefBevelThickness = Math.min(0.3, avgLetterHeight * 0.02);

  const baseGeom = new THREE.ExtrudeGeometry(safeBaseShapes, {
    depth: bodyThickness,
    bevelEnabled: true,
    bevelThickness: baseBevelThickness,
    bevelSize: Math.min(0.3, avgLetterHeight * 0.02),
    bevelSegments: 4,
  });
  // Corpo apoiado na mesa: z mínimo = 0 (antes ficava em -bevelThickness, abaixo da mesa).
  baseGeom.translate(0, 0, baseBevelThickness);
  const bodyTopZ = bodyThickness + 2 * baseBevelThickness;

  // Relevo: a altura total (topo) é a mesma de antes, mas o fundo é reto e começa
  // exatamente no topo do corpo — sem a parte enterrada que sobrepunha as duas cores.
  // Mantém o topo em bodyThickness + baseBevelThickness + reliefThickness.
  const reliefDepth = Math.max(0.2, reliefThickness - baseBevelThickness);
  const reliefGeom = new THREE.ExtrudeGeometry(safeReliefShapes, {
    depth: reliefDepth,
    bevelEnabled: true,
    bevelThickness: reliefBevelThickness,
    bevelSize: Math.min(0.25, avgLetterHeight * 0.017),
    bevelSegments: 4,
  });
  flattenBottomBevel(reliefGeom);
  reliefGeom.translate(0, 0, bodyTopZ);

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
