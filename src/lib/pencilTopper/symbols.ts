/**
 * Ícones da ponteira em vetor (viewBox 0..100), desenhados com Path2D.
 * `add` = massa do ícone; `sub` = vaidos (furos) apagados com destination-out.
 * O mesmo dado alimenta o canvas da geometria e o preview SVG do painel.
 */

export interface SymbolShapes {
  add: string[];
  sub: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function ellipsePath(cx: number, cy: number, rx: number, ry: number, rotDeg = 0): string {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x1 = r2(cx + rx * cos);
  const y1 = r2(cy + rx * sin);
  const x2 = r2(cx - rx * cos);
  const y2 = r2(cy - rx * sin);
  const rot = r2(rotDeg);
  return `M${x1} ${y1} A${rx} ${ry} ${rot} 0 1 ${x2} ${y2} A${rx} ${ry} ${rot} 0 1 ${x1} ${y1} Z`;
}

function circlePath(cx: number, cy: number, r: number): string {
  return ellipsePath(cx, cy, r, r);
}

function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M${r2(x + rr)} ${y} H${r2(x + w - rr)} A${rr} ${rr} 0 0 1 ${x + w} ${r2(y + rr)}` +
    ` V${r2(y + h - rr)} A${rr} ${rr} 0 0 1 ${r2(x + w - rr)} ${y + h}` +
    ` H${r2(x + rr)} A${rr} ${rr} 0 0 1 ${x} ${r2(y + h - rr)}` +
    ` V${r2(y + rr)} A${rr} ${rr} 0 0 1 ${r2(x + rr)} ${y} Z`
  );
}

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
  return ellipsePath(50 + 24 * Math.cos(rad), 50 + 24 * Math.sin(rad), 14, 22, angle + 90);
});

const BALL_EDGE_PENTAGONS = [-54, 18, 90, 162, 234].map((angle) => {
  const rad = (angle * Math.PI) / 180;
  return polygonPath(50 + 33 * Math.cos(rad), 50 + 33 * Math.sin(rad), 12, 5, angle);
});

export const SYMBOL_SHAPES: Record<string, SymbolShapes> = {
  heart: {
    add: [
      'M50 88 C24 70 8 54 8 34 C8 20 19 10 31 10 C40 10 47 15 50 22 C53 15 60 10 69 10 C81 10 92 20 92 34 C92 54 76 70 50 88 Z',
    ],
    sub: [],
  },
  star: {
    add: [starPath(50, 50, 46, 20)],
    sub: [],
  },
  crown: {
    add: [
      'M9 68 L13 20 L32 44 L50 12 L68 44 L87 20 L91 68 Z',
      roundRectPath(8, 66, 84, 18, 5),
    ],
    sub: [circlePath(34, 75, 5.5), circlePath(66, 75, 5.5)],
  },
  flower: {
    add: [...FLOWER_PETALS, circlePath(50, 50, 15)],
    sub: [circlePath(50, 50, 6.5)],
  },
  butterfly: {
    add: [
      ellipsePath(31, 38, 26, 20, -22),
      ellipsePath(69, 38, 26, 20, 22),
      ellipsePath(33, 72, 17, 14, 25),
      ellipsePath(67, 72, 17, 14, -25),
      roundRectPath(45, 28, 10, 54, 5),
      circlePath(50, 24, 7),
    ],
    sub: [circlePath(24, 36, 5.5), circlePath(76, 36, 5.5)],
  },
  dino: {
    add: [
      ellipsePath(44, 58, 26, 18),
      'M4 44 C16 46 26 52 34 56 L34 68 C24 66 12 58 4 52 Z',
      'M54 44 C56 30 64 18 76 14 L84 24 C74 30 68 38 66 52 Z',
      'M64 16 C70 8 84 6 92 14 C97 19 96 27 90 30 C82 34 70 31 64 26 Z',
      roundRectPath(30, 66, 11, 20, 5),
      roundRectPath(54, 64, 11, 22, 5),
      ellipsePath(35, 84, 9, 4),
      ellipsePath(59, 84, 9, 4),
    ],
    sub: [circlePath(82, 17, 3.5)],
  },
  gamepad: {
    add: [
      roundRectPath(16, 34, 68, 34, 15),
      ellipsePath(24, 62, 15, 13, 10),
      ellipsePath(76, 62, 15, 13, -10),
    ],
    sub: [
      roundRectPath(26, 45, 20, 10, 2),
      roundRectPath(31, 40, 10, 20, 2),
      circlePath(66, 44, 5),
      circlePath(77, 55, 5),
    ],
  },
  ball: {
    add: [circlePath(50, 50, 44)],
    sub: [polygonPath(50, 50, 15, 5, -90), ...BALL_EDGE_PENTAGONS],
  },
  gradcap: {
    add: [
      'M50 10 L96 34 L50 58 L4 34 Z',
      'M28 44 L72 44 L68 74 C66 82 58 88 50 88 C42 88 34 82 32 74 Z',
      'M93 36 L99 40 L96 66 L88 62 Z',
      circlePath(91, 71, 8),
    ],
    sub: [],
  },
};

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
  const matrix = () => new DOMMatrix().translate(x - size / 2, y - size / 2).scale(k);

  const addPath = new Path2D();
  for (const d of shapes.add) addPath.addPath(new Path2D(d), matrix());

  targetCtx.save();
  targetCtx.lineJoin = 'round';
  targetCtx.lineCap = 'round';
  if (outlinePx > 0) {
    targetCtx.lineWidth = outlinePx * 2;
    targetCtx.stroke(addPath);
  }
  targetCtx.fill(addPath);

  if (shapes.sub.length > 0) {
    targetCtx.globalCompositeOperation = 'destination-out';
    for (const d of shapes.sub) {
      const holePath = new Path2D();
      holePath.addPath(new Path2D(d), matrix());
      targetCtx.fill(holePath);
    }
  }
  targetCtx.restore();
}
