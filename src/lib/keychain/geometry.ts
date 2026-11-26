import * as THREE from 'three';
import type { KeychainConfig, GeneratedKeychain } from '../../types/keychain';
import type { Model3DDimensions } from '../../types/pencilTopper';
import {
  extractContoursFromImageData,
  buildThreeShapes,
  computeEnclosedEmptyMask,
  punchMask,
} from '../pencilTopper/contourExtractor';
import { drawSymbol, drawSymbolSized } from '../pencilTopper/symbols';
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
  config: KeychainConfig,
  side: KeychainConfig['loopSide'],
  rangeMinX = 0,
  rangeMaxX = width - 1
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
  const fromLeft = side === 'left';
  // Limita a busca a uma peça (no modo separado, ícone e nome dividem o canvas).
  const searchMinX = Math.max(0, Math.floor(rangeMinX));
  const searchMaxX = Math.min(width - 1, Math.ceil(rangeMaxX));

  for (let distance = 0; distance <= maxDistance; distance++) {
    const rows = distance === 0 ? [centerRow] : [centerRow - distance, centerRow + distance];
    for (const y of rows) {
      if (y < 0 || y >= height) continue;

      let solidX = -1;
      const rowOffset = y * width * 4;
      if (fromLeft) {
        for (let x = searchMinX; x <= searchMaxX; x++) {
          if (pixels[rowOffset + x * 4 + 3] > CANVAS_ALPHA_THRESHOLD) {
            solidX = x;
            break;
          }
        }
      } else {
        for (let x = searchMaxX; x >= searchMinX; x--) {
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

/**
 * Mede a tinta real do nome rasterizando as letras: a largura de avanço da fonte
 * não bate com o desenho (side bearings negativos), e na tag isso encostaria o
 * relevo na borda.
 */
function measureTextInk(
  fontStyle: string,
  text: string,
  charOffsets: number[],
  width: number,
  height: number,
  baseline: number
): { minX: number; maxX: number; ascent: number; descent: number } | null {
  const probe = document.createElement('canvas');
  probe.width = Math.max(8, Math.ceil(width));
  probe.height = Math.max(8, Math.ceil(height));
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  if (!pctx) return null;

  pctx.font = fontStyle;
  pctx.textBaseline = 'alphabetic';
  pctx.textAlign = 'left';
  pctx.fillStyle = '#000000';
  for (let i = 0; i < text.length; i++) {
    pctx.fillText(text[i], charOffsets[i] + 2, baseline);
  }

  const data = pctx.getImageData(0, 0, probe.width, probe.height).data;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < probe.height; y++) {
    const row = y * probe.width * 4;
    for (let x = 0; x < probe.width; x++) {
      if (data[row + x * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!isFinite(minX)) return null;
  return { minX, maxX, ascent: baseline - minY, descent: maxY - baseline };
}

/** Aba de argola no topo central (tags em formato de osso/peixinho). */
function drawTopLoopTab(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  config: KeychainConfig
): boolean {
  const holeRadiusPx = (config.loopHoleDiameter / 2) * pxPerMm;
  const wallPx = config.loopWallThickness * pxPerMm;
  const outerRadiusPx = holeRadiusPx + wallPx;
  const centerX = Math.round(width / 2);

  let topY = -1;
  for (let y = 0; y < height && topY === -1; y++) {
    const rowOffset = y * width * 4;
    for (let dx = -2; dx <= 2; dx++) {
      const x = centerX + dx;
      if (x >= 0 && x < width && pixels[rowOffset + x * 4 + 3] > CANVAS_ALPHA_THRESHOLD) {
        topY = y;
        break;
      }
    }
  }
  if (topY === -1) return false;

  const cx = centerX;
  // Furo inteiro acima da borda, com a parede da aba em volta.
  const cy = topY - holeRadiusPx;
  if (cy - outerRadiusPx < 0 || cx - outerRadiusPx < 0 || cx + outerRadiusPx > width - 1) {
    return false;
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

export async function generateKeychainModel(config: KeychainConfig): Promise<GeneratedKeychain> {
  // Pular linha empilha até 3 linhas (nome + textos abaixo); linhas vazias são ignoradas.
  const textLines = (config.text.trim() || 'Nome')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);
  if (textLines.length === 0) textLines.push('Nome');
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
  const fontScale = Math.min(2, Math.max(0.5, config.fontWeightScale || 1));
  // "Espessura da Fonte" até 1x (padrão incluso) usa o peso regular (traço fino, melhor
  // leitura); acima de 1x, bold. O Google Fonts só carrega 400 e 700 — pesos
  // intermediários seriam sintetizados e o resultado não seria previsível.
  const fontWeight = isCursiveOrDisplay || fontScale <= 1 ? 'normal' : 'bold';
  const fontStyle = `${fontWeight} ${targetFontHeightPx}px "${config.fontFamily}", sans-serif`;
  mctx.font = fontStyle;

  const letterSpacingPx = Math.max(0.0, config.letterSpacing ?? 1.8) * pxPerMm;
  const textLinesLayout = textLines.map((line) => {
    const charOffsets: number[] = [];
    let widthPx = 0;
    for (let i = 0; i < line.length; i++) {
      charOffsets.push(widthPx);
      widthPx += mctx.measureText(line[i]).width + letterSpacingPx;
    }
    if (line.length > 0) widthPx -= letterSpacingPx;
    return { text: line, charOffsets, widthPx };
  });
  const textWidthPx = Math.max(...textLinesLayout.map((line) => line.widthPx));

  const textHeightPx = targetFontHeightPx;
  const lineSpacingMm = Math.min(12, Math.max(0, config.nameLineSpacing ?? 2.8));
  const linePitchPx = textHeightPx + lineSpacingMm * pxPerMm;
  const textBlockHeightPx = (textLinesLayout.length - 1) * linePitchPx + textHeightPx;
  // Borda da base = outlineSize puro; "Espessura da Fonte" engorda só as letras em relevo.
  const outlinePx = Math.max(1.5, config.outlineSize) * pxPerMm;
  // SEGA: os filetes internos do logo têm 0,25–0,65 mm e estão abertos nas pontas —
  // qualquer dilatação os fecha (o punchMask só restaura contadores fechados). Sem dilatação.
  const reliefDilationMm = config.fontFamily === 'SEGA LOGO FONT' ? 0 : (fontScale - 0.5) * 0.4;

  // Camadas do nome: a camada de base é a cópia mais larga e a de topo é o relevo atual.
  // Assim cada cor extra aparece como um contorno em volta da letra, sem recorte CSG.
  const nameLayerCount = Math.min(3, Math.max(1, Math.round(config.nameLayerCount ?? 1)));
  const requestedLayerStepMm = Math.min(1.5, Math.max(0.2, config.nameLayerStep ?? 0.6));
  // O contorno extra não pode passar da borda do corpo.
  const maxExtraDilationMm = Math.max(0, config.outlineSize - reliefDilationMm - 0.3);
  const layerStepMm =
    nameLayerCount > 1
      ? Math.min(requestedLayerStepMm, maxExtraDilationMm / (nameLayerCount - 1))
      : 0;
  const nameLayerColors = [
    config.reliefColor3 ?? '#632CE5',
    config.reliefColor2 ?? '#F9FAFB',
    config.reliefColor,
  ].slice(3 - nameLayerCount);

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

  // Tag (medalha de identificação): a própria borda é o osso/peixinho e o nome fica dentro.
  const tagShape: 'bone' | 'fish' | null =
    config.tagShape === 'bone' || config.tagShape === 'fish' ? config.tagShape : null;
  const hasCustomIcon = !!iconImage && !tagShape;
  const hasPresetSymbol =
    !tagShape && !hasCustomIcon && !!config.symbolId && config.symbolId !== 'none';
  const hasIcon = hasCustomIcon || hasPresetSymbol;
  const symbolPosition = config.symbolPosition || 'right';
  // Separado, o ícone é sempre a peça do início (esquerda) e o nome termina à direita,
  // com uma argola em cada ponta — por isso a posição escolhida não se aplica aqui.
  const wantsSeparated =
    !!config.symbolSeparated && hasIcon && (symbolPosition === 'left' || symbolPosition === 'right');
  const showIconLeft =
    hasIcon && (wantsSeparated || symbolPosition === 'left' || symbolPosition === 'both');
  const showIconRight =
    hasIcon && !wantsSeparated && (symbolPosition === 'right' || symbolPosition === 'both');
  const iconCount = (showIconLeft ? 1 : 0) + (showIconRight ? 1 : 0);
  // Ícone separado: vira peça própria, com folga de impressão até o nome, e cada
  // peça recebe a sua argola (início do ícone e fim do nome).
  const symbolSeparated = wantsSeparated && iconCount === 1;
  const separationGapPx = 1.2 * pxPerMm;
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
  const loopOuterRadiusPx =
    (config.loopHoleDiameter / 2 + config.loopWallThickness) * pxPerMm;
  // Quanto a aba da argola avança para fora da borda do corpo.
  const loopProtrusionPx = config.loopEnabled
    ? Math.max(0, loopCenterInsetMm(config) * pxPerMm + loopOuterRadiusPx)
    : 0;
  const iconBlockWidthPx = hasCustomIcon ? iconWidthPx : symbolSizePx;
  const iconBlockGapBasePx = hasCustomIcon ? iconGapPx : symbolGapPx;
  // Separado, a folga precisa vencer os dois contornos (nome + ícone) e a aba da
  // argola do começo do nome, que aponta para o ícone.
  const iconBlockGapPx = symbolSeparated
    ? Math.max(iconBlockGapBasePx, outlinePx * 2 + loopProtrusionPx + separationGapPx)
    : iconBlockGapBasePx;
  const iconBlockPx = iconCount * (iconBlockGapPx + iconBlockWidthPx);

  // Proporção interna de cada tag: o nome precisa caber dentro da silhueta.
  // A tinta das maiúsculas ocupa ~74% da caixa da fonte; a folga é a margem até a borda.
  // fx/fy = fração da caixa desenhada que é segura para o nome (haste do osso / corpo do peixe).
  const TAG_FIT = { bone: { fx: 0.74, fy: 0.56 }, fish: { fx: 0.62, fy: 0.48 } } as const;
  const TAG_TOP = { bone: 0.35, fish: 0.32 } as const;
  const tagMarginPx = Math.max(2 * pxPerMm, outlinePx);
  // Na tag o nome é dimensionado pela tinta real das letras, não pelo avanço da fonte.
  const tagInk = tagShape
    ? measureTextInk(
        fontStyle,
        text,
        charOffsets,
        textWidthPx + textHeightPx * 2,
        textHeightPx * 2,
        textHeightPx
      )
    : null;
  const tagInkLeftPx = tagInk ? tagInk.minX - 2 : 0;
  const tagInkWidthPx = tagInk ? tagInk.maxX - tagInk.minX : textWidthPx;
  const tagInkHeightPx = tagInk ? tagInk.ascent + tagInk.descent : textHeightPx * 0.74;
  const tagInkCenterOffsetPx = tagInk ? (tagInk.ascent - tagInk.descent) / 2 : 0;
  const tagInnerWidthPx = tagInkWidthPx + tagMarginPx * 2;
  const tagInnerHeightPx = tagInkHeightPx + tagMarginPx * 2;
  const tagLayout = tagShape
    ? {
        w: tagInnerWidthPx / TAG_FIT[tagShape].fx,
        h: tagInnerHeightPx / TAG_FIT[tagShape].fy,
      }
    : null;
  const totalContentWidthPx = tagLayout ? tagLayout.w : textWidthPx + iconBlockPx;
  const contentHeightPx = tagLayout ? tagLayout.h : textHeightPx;
  // Alcance da aba além da letra: furo + parede + folga (a aba pode sair do corpo).
  const loopReachPx =
    (config.loopHoleDiameter + config.loopWallThickness + resolveLoopGapMm(config)) * pxPerMm;
  // Na tag a argola fica no topo central e avança acima da borda.
  const tagLoopProtrusionPx =
    tagLayout && config.loopEnabled
      ? (config.loopHoleDiameter / 2) * pxPerMm + loopOuterRadiusPx
      : 0;
  // Da borda superior do desenho até o topo da tela + a aba da argola.
  const tagTopReachPx = tagLayout
    ? TAG_TOP[tagShape as 'bone' | 'fish'] * tagLayout.h + tagLoopProtrusionPx
    : 0;
  const paddingPx = Math.ceil(
    Math.max(
      outlinePx * 2.5,
      config.loopEnabled ? Math.max(loopOuterRadiusPx * 1.5, loopReachPx) : 0,
      tagTopReachPx
    ) + 28
  );
  const canvasWidth = Math.ceil(totalContentWidthPx + paddingPx * 2);
  const canvasHeight = Math.ceil(textBlockHeightPx + paddingPx * 2);

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
  // Cada linha é centralizada dentro do bloco de texto; o ícone acompanha o bloco todo.
  const lineStartXPx = (line: { widthPx: number }) => textStartXPx + (textWidthPx - line.widthPx) / 2;
  const lineBaselineY = (index: number) =>
    centerY + textHeightPx * 0.32 + (index - (textLinesLayout.length - 1) / 2) * linePitchPx;
  const contentCenterYPx = centerY + textHeightPx * 0.32 - textHeightPx * 0.28;
  // Fim real da tinta do último caractere (sem side bearing) — sem isso o gap
  // ganha a entreletra e o símbolo/ícone acaba descolado do corpo.
  const textInkRightPx = textLinesLayout.reduce((max, line) => {
    if (line.text.length === 0) return max;
    const measure = mctx.measureText(line.text[line.text.length - 1]);
    const ink =
      line.charOffsets[line.charOffsets.length - 1] +
      Math.max(measure.actualBoundingBoxRight ?? measure.width, 0);
    return Math.max(max, lineStartXPx(line) - textStartXPx + ink);
  }, textWidthPx);
  const textInkEndPx = textStartXPx + textInkRightPx;
  const iconLeftCenterX = contentStartXPx + iconBlockWidthPx / 2;
  const iconRightCenterX = textInkEndPx + iconBlockGapPx + iconBlockWidthPx / 2;
  // Fronteira entre a peça do ícone (início) e a do nome — delimita onde cada argola pode nascer.
  const iconPieceRightPx = contentStartXPx + iconBlockWidthPx + outlinePx;
  const namePieceLeftPx = textStartXPx - outlinePx;
  const pieceSplitXPx = (iconPieceRightPx + namePieceLeftPx) / 2;

  // "Ambos" aceita ícones diferentes: início usa symbolId, fim usa symbolIdRight.
  const symbolIdRight = config.symbolIdRight || config.symbolId;

  const drawIconBlock = (
    targetCtx: CanvasRenderingContext2D,
    x: number,
    symbolId: string,
    outline = 0
  ) => {
    if (hasCustomIcon) {
      if (outline > 0) drawIconDilated(targetCtx, x, contentCenterYPx);
      else drawIcon(targetCtx, x, contentCenterYPx);
    } else if (hasPresetSymbol) {
      drawSymbol(targetCtx, symbolId, x, contentCenterYPx, symbolSizePx, outline);
    }
  };

  const drawIcons = (targetCtx: CanvasRenderingContext2D, outline = 0) => {
    if (showIconLeft) drawIconBlock(targetCtx, iconLeftCenterX, config.symbolId, outline);
    if (showIconRight) drawIconBlock(targetCtx, iconRightCenterX, symbolIdRight, outline);
  };

  const drawText = (targetCtx: CanvasRenderingContext2D) => {
    targetCtx.font = fontStyle;
    targetCtx.textBaseline = 'alphabetic';
    targetCtx.textAlign = 'left';
    textLinesLayout.forEach((line, lineIndex) => {
      const startX = lineStartXPx(line);
      const baselineY = lineBaselineY(lineIndex);
      for (let i = 0; i < line.text.length; i++) {
        targetCtx.fillText(line.text[i], startX + line.charOffsets[i], baselineY);
      }
    });
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

  // 2) Passo base: na tag é a silhueta do osso/peixinho; senão, texto + ícone dilatados.
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
  textLinesLayout.forEach((line, lineIndex) => {
    const startX = lineStartXPx(line);
    const baselineY = lineBaselineY(lineIndex);
    for (let i = 0; i < line.text.length; i++) {
      const cx = startX + line.charOffsets[i];
      ctx.strokeText(line.text[i], cx, baselineY);
      ctx.fillText(line.text[i], cx, baselineY);
    }
  });
  drawIcons(ctx, outlinePx);

  const baseImgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  // Na tag o corpo não tem letra: os contadores do nome só valem para o relevo.
  if (!tagLayout) punchMask(baseImgData, counterMask);
  ctx.putImageData(baseImgData, 0, 0);

  // 3) Argola opcional (sem CSG): disco grudado ao corpo + furo passante.
  if (config.loopEnabled) {
    if (tagLayout) {
      drawTopLoopTab(ctx, baseImgData.data, canvasWidth, canvasHeight, config);
    } else if (symbolSeparated) {
      // Ícone: argola na ponta esquerda. Nome: argola no começo e no fim.
      drawLoopTab(ctx, baseImgData.data, canvasWidth, canvasHeight, config, 'left', 0, pieceSplitXPx);
      drawLoopTab(ctx, baseImgData.data, canvasWidth, canvasHeight, config, 'left', pieceSplitXPx, canvasWidth - 1);
      drawLoopTab(ctx, baseImgData.data, canvasWidth, canvasHeight, config, 'right', pieceSplitXPx, canvasWidth - 1);
    } else {
      drawLoopTab(ctx, baseImgData.data, canvasWidth, canvasHeight, config, config.loopSide);
    }
  }
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

  // 4) Camadas do nome: cada camada é o texto com uma dilatação menor, da base
  // (mais larga, cor de fundo) para o topo (o relevo atual, cor do nome).
  const reliefLayers: { imgData: ImageData; shapes: THREE.Shape[]; color: string }[] = [];
  for (let layerIndex = 0; layerIndex < nameLayerCount; layerIndex++) {
    const dilationMm = reliefDilationMm + layerStepMm * (nameLayerCount - 1 - layerIndex);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    // lineWidth 0 é inválido no canvas (mantém o valor anterior da base); sem dilação, só o fill.
    const reliefStroke = dilationMm > 0.01;
    if (reliefStroke) ctx.lineWidth = dilationMm * 2 * pxPerMm;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.font = fontStyle;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    textLinesLayout.forEach((line, lineIndex) => {
      const startX = lineStartXPx(line);
      const baselineY = lineBaselineY(lineIndex);
      for (let i = 0; i < line.text.length; i++) {
        const cx = startX + line.charOffsets[i];
        if (reliefStroke) ctx.strokeText(line.text[i], cx, baselineY);
        ctx.fillText(line.text[i], cx, baselineY);
      }
    });
    drawIcons(ctx, reliefStroke ? dilationMm * pxPerMm : 0);

    const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    punchMask(imgData, counterMask);
    const contours = extractContoursFromImageData(
      imgData,
      mmPerPixel,
      canvasWidth / 2,
      canvasHeight / 2,
      0.05,
      { resimplifyMm: 0.02 }
    );
    reliefLayers.push({
      imgData,
      shapes: buildThreeShapes(contours.outer, contours.holes),
      color: nameLayerColors[layerIndex],
    });
  }

  const fallbackReliefShapes =
    reliefLayers.find((layer) => layer.shapes.length > 0)?.shapes ?? [];
  const safeBaseShapes = baseShapes.length > 0 ? baseShapes : fallbackReliefShapes;

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

  // Cada camada do nome ocupa uma fatia da espessura do relevo, empilhada a partir do topo do corpo.
  const layerDepth = reliefThickness / nameLayerCount;
  // flattenBottomBevel() deixa o fundo reto em z = 0, então a peça mede
  // layerExtrudeDepth + bevelThickness e precisa caber exatamente no passo
  // layerDepth; um piso fixo no depth empurrava a camada para dentro da de cima.
  const layerBevelThickness = Math.min(reliefBevelThickness, layerDepth * 0.5);
  const layerExtrudeDepth = layerDepth - layerBevelThickness;
  const reliefGeoms = reliefLayers.map((layer, layerIndex) => {
    const shapes = layer.shapes.length > 0 ? layer.shapes : safeBaseShapes;
    const geom = new THREE.ExtrudeGeometry(shapes, {
      depth: layerExtrudeDepth,
      bevelEnabled: true,
      bevelThickness: layerBevelThickness,
      bevelSize: Math.min(0.25, avgLetterHeight * 0.017),
      bevelSegments: 4,
    });
    flattenBottomBevel(geom);
    geom.translate(0, 0, bodyTopZ + layerIndex * layerDepth);
    return geom;
  });
  const layerNames = reliefLayers.map((_, layerIndex) =>
    layerIndex === nameLayerCount - 1
      ? `${layerIndex + 2}_Nome_em_Relevo`
      : `${layerIndex + 2}_Camada_${layerIndex + 1}_do_Nome`
  );

  baseGeom.computeBoundingBox();
  const bbBase = baseGeom.boundingBox || new THREE.Box3();
  const midX = (bbBase.min.x + bbBase.max.x) / 2;
  const midY = (bbBase.min.y + bbBase.max.y) / 2;
  baseGeom.translate(-midX, -midY, 0);
  reliefGeoms.forEach((geom) => {
    geom.translate(-midX, -midY, 0);
    geom.computeBoundingBox();
  });
  baseGeom.computeBoundingBox();

  const totalBox = (baseGeom.boundingBox || new THREE.Box3()).clone();
  reliefGeoms.forEach((geom) => {
    if (geom.boundingBox) totalBox.union(geom.boundingBox);
  });
  const size = new THREE.Vector3();
  totalBox.getSize(size);

  const mm2PerPx = mmPerPixel * mmPerPixel;
  const baseAreaMm2 = countSolidPixels(baseAfterLoop.data) * mm2PerPx;
  const reliefVolumeMm3 =
    reliefLayers.reduce(
      (sum, layer) => sum + countSolidPixels(layer.imgData.data) * mm2PerPx,
      0
    ) * layerDepth;
  const volumeCm3 = Math.max(
    1.0,
    Number(((baseAreaMm2 * bodyThickness + reliefVolumeMm3) / 1000).toFixed(1))
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

  const reliefMeshes = reliefGeoms.map((geom, layerIndex) => {
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(reliefLayers[layerIndex].color),
        roughness: 0.28,
        metalness: 0.12,
      })
    );
    mesh.name = layerNames[layerIndex];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  });

  return { baseMesh, reliefMeshes, dimensions };
}
