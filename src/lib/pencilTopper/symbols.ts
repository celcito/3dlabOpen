/**
 * Ícones da ponteira e do personalizador em vetor (viewBox 0..100).
 * Cada ícone é uma lista de primitivas (`path` | `ellipse` | `rect`), com
 * `add` = massa e `sub` = vazados apagados com destination-out. O mesmo dado
 * alimenta o canvas da geometria e o preview SVG do painel.
 *
 * Sem Path2D/DOMMatrix de propósito: o mesmo código tem que rodar no jsdom
 * dos testes, onde só existe o contexto 2D.
 */

export type SymbolPart =
  | { kind: 'path'; d: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number };

export interface SymbolShapes {
  add: SymbolPart[];
  sub: SymbolPart[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const ellipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot = 0
): SymbolPart => ({ kind: 'ellipse', cx, cy, rx, ry, rot });

const rect = (x: number, y: number, w: number, h: number, r = 0): SymbolPart => ({
  kind: 'rect',
  x,
  y,
  w,
  h,
  r,
});

function polygonPath(cx: number, cy: number, r: number, sides: number, rotDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = ((rotDeg + (i * 360) / sides) * Math.PI) / 180;
    pts.push(`${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}

function starPath(cx: number, cy: number, rOut: number, rIn: number, points = 5, rotDeg = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = ((rotDeg + (i * 180) / points) * Math.PI) / 180;
    pts.push(`${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}

const FLOWER_PETALS = [-90, -18, 54, 126, 198].map((angle) => {
  const rad = (angle * Math.PI) / 180;
  return ellipse(50 + 24 * Math.cos(rad), 50 + 24 * Math.sin(rad), 14, 22, angle + 90);
});

const BALL_EDGE_PENTAGONS = [-54, 18, 90, 162, 234].map((angle) => {
  const rad = (angle * Math.PI) / 180;
  return { kind: 'path', d: polygonPath(50 + 33 * Math.cos(rad), 50 + 33 * Math.sin(rad), 12, 5, angle) } as SymbolPart;
});

export const SYMBOL_SHAPES: Record<string, SymbolShapes> = {
  heart: {
    add: [
      {
        kind: 'path',
        d: 'M50 88 C24 70 8 54 8 34 C8 20 19 10 31 10 C40 10 47 15 50 22 C53 15 60 10 69 10 C81 10 92 20 92 34 C92 54 76 70 50 88 Z',
      },
    ],
    sub: [],
  },
  star: {
    add: [{ kind: 'path', d: starPath(50, 50, 46, 20) }],
    sub: [],
  },
  bone: {
    add: [
      rect(18, 38, 64, 24, 12),
      ellipse(24, 32, 14, 12),
      ellipse(24, 68, 14, 12),
      ellipse(76, 32, 14, 12),
      ellipse(76, 68, 14, 12),
    ],
    sub: [],
  },
  fish: {
    add: [
      ellipse(44, 50, 32, 19),
      { kind: 'path', d: 'M72 50 L96 28 L96 72 Z' },
      { kind: 'path', d: 'M38 34 L52 16 L62 34 Z' },
    ],
    sub: [ellipse(30, 44, 4.5, 4.5)],
  },
  crown: {
    add: [
      { kind: 'path', d: 'M9 68 L13 20 L32 44 L50 12 L68 44 L87 20 L91 68 Z' },
      rect(8, 66, 84, 18, 5),
    ],
    sub: [ellipse(34, 75, 5.5, 5.5), ellipse(66, 75, 5.5, 5.5)],
  },
  flower: {
    add: [...FLOWER_PETALS, ellipse(50, 50, 15, 15)],
    sub: [ellipse(50, 50, 6.5, 6.5)],
  },
  butterfly: {
    add: [
      ellipse(31, 38, 26, 20, -22),
      ellipse(69, 38, 26, 20, 22),
      ellipse(33, 72, 17, 14, 25),
      ellipse(67, 72, 17, 14, -25),
      rect(45, 28, 10, 54, 5),
      ellipse(50, 24, 7, 7),
    ],
    sub: [ellipse(24, 36, 5.5, 5.5), ellipse(76, 36, 5.5, 5.5)],
  },
  dino: {
    add: [
      ellipse(44, 58, 26, 18),
      { kind: 'path', d: 'M4 44 C16 46 26 52 34 56 L34 68 C24 66 12 58 4 52 Z' },
      { kind: 'path', d: 'M54 44 C56 30 64 18 76 14 L84 24 C74 30 68 38 66 52 Z' },
      { kind: 'path', d: 'M64 16 C70 8 84 6 92 14 C97 19 96 27 90 30 C82 34 70 31 64 26 Z' },
      rect(30, 66, 11, 20, 5),
      rect(54, 64, 11, 22, 5),
      ellipse(35, 84, 9, 4),
      ellipse(59, 84, 9, 4),
    ],
    sub: [ellipse(82, 17, 3.5, 3.5)],
  },
  gamepad: {
    add: [
      rect(16, 34, 68, 34, 15),
      ellipse(24, 62, 15, 13, 10),
      ellipse(76, 62, 15, 13, -10),
    ],
    sub: [
      rect(26, 45, 20, 10, 2),
      rect(31, 40, 10, 20, 2),
      ellipse(66, 44, 5, 5),
      ellipse(77, 55, 5, 5),
    ],
  },
  ball: {
    add: [ellipse(50, 50, 44, 44)],
    sub: [
      { kind: 'path', d: polygonPath(50, 50, 15, 5, -90) },
      ...BALL_EDGE_PENTAGONS,
    ],
  },
  gradcap: {
    add: [
      { kind: 'path', d: 'M50 10 L96 34 L50 58 L4 34 Z' },
      { kind: 'path', d: 'M28 44 L72 44 L68 74 C66 82 58 88 50 88 C42 88 34 82 32 74 Z' },
      { kind: 'path', d: 'M93 36 L99 40 L96 66 L88 62 Z' },
      ellipse(91, 71, 8, 8),
    ],
    sub: [],
  },
};

/** Reproduz um caminho absoluto (M/L/H/V/C/Z) no contexto 2D. */
function tracePath(ctx: CanvasRenderingContext2D, d: string): void {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return;

  let index = 0;
  let command = '';
  let x = 0;
  let y = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    if (/[A-Za-z]/.test(token)) {
      command = token.toUpperCase();
      index += 1;
      if (command === 'Z') {
        ctx.closePath();
        continue;
      }
    }
    if (index >= tokens.length) break;

    switch (command) {
      case 'M':
        x = Number(tokens[index++]);
        y = Number(tokens[index++]);
        ctx.moveTo(x, y);
        command = 'L';
        break;
      case 'L':
        x = Number(tokens[index++]);
        y = Number(tokens[index++]);
        ctx.lineTo(x, y);
        break;
      case 'H':
        x = Number(tokens[index++]);
        ctx.lineTo(x, y);
        break;
      case 'V':
        y = Number(tokens[index++]);
        ctx.lineTo(x, y);
        break;
      case 'C': {
        const x1 = Number(tokens[index++]);
        const y1 = Number(tokens[index++]);
        const x2 = Number(tokens[index++]);
        const y2 = Number(tokens[index++]);
        x = Number(tokens[index++]);
        y = Number(tokens[index++]);
        ctx.bezierCurveTo(x1, y1, x2, y2, x, y);
        break;
      }
      default:
        index += 1;
    }
  }
}

function tracePart(ctx: CanvasRenderingContext2D, part: SymbolPart): void {
  ctx.beginPath();
  if (part.kind === 'path') {
    tracePath(ctx, part.d);
    return;
  }
  if (part.kind === 'ellipse') {
    ctx.ellipse(part.cx, part.cy, part.rx, part.ry, ((part.rot ?? 0) * Math.PI) / 180, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }

  const { x, y, w, h } = part;
  const r = Math.min(part.r ?? 0, w / 2, h / 2);
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    ctx.closePath();
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Desenha um ícone centrado em (x, y) com `size` px de lado.
 * `outlinePx` engorda o traçado igual ao stroke das letras (borda da base).
 */
export function drawSymbol(
  targetCtx: CanvasRenderingContext2D,
  symbolId: string,
  x: number,
  y: number,
  size: number,
  outlinePx = 0
): void {
  const shapes = SYMBOL_SHAPES[symbolId];
  if (!shapes) return;

  const k = size / 100;

  targetCtx.save();
  targetCtx.translate(x - size / 2, y - size / 2);
  targetCtx.scale(k, k);
  targetCtx.lineJoin = 'round';
  targetCtx.lineCap = 'round';

  for (const part of shapes.add) {
    tracePart(targetCtx, part);
    if (outlinePx > 0) {
      targetCtx.lineWidth = (outlinePx * 2) / k;
      targetCtx.stroke();
    }
    targetCtx.fill();
  }

  if (shapes.sub.length > 0) {
    targetCtx.globalCompositeOperation = 'destination-out';
    for (const part of shapes.sub) {
      tracePart(targetCtx, part);
      targetCtx.fill();
    }
  }
  targetCtx.restore();
}

/** Markup SVG de uma primitiva (preview do painel). */
export function symbolPartToSvg(part: SymbolPart): string {
  if (part.kind === 'path') return `<path d="${part.d}" />`;
  if (part.kind === 'ellipse') {
    const rotate =
      part.rot && part.rot !== 0 ? ` transform="rotate(${r2(part.rot)} ${part.cx} ${part.cy})"` : '';
    return `<ellipse cx="${part.cx}" cy="${part.cy}" rx="${part.rx}" ry="${part.ry}"${rotate} />`;
  }
  const rx = part.r && part.r > 0 ? ` rx="${part.r}" ry="${part.r}"` : '';
  return `<rect x="${part.x}" y="${part.y}" width="${part.w}" height="${part.h}"${rx} />`;
}
