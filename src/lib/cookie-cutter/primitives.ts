import * as THREE from "three";

export type PrimitiveShape =
  | "circle"
  | "rect"
  | "rounded-rect"
  | "triangle"
  | "star"
  | "polygon"
  | "heart";

export interface PrimitiveParams {
  circle: { radius: number };
  rect: { width: number; height: number; cornerRadius?: number };
  "rounded-rect": { width: number; height: number; cornerRadius: number };
  triangle: { side: number };
  star: { outerRadius: number; innerRadius: number; points: number };
  polygon: { sides: number; radius: number };
  heart: { size: number };
}

export const PRIMITIVE_DEFAULTS: Record<PrimitiveShape, Record<string, number>> = {
  circle: { radius: 15 },
  rect: { width: 30, height: 20, cornerRadius: 0 },
  "rounded-rect": { width: 30, height: 20, cornerRadius: 4 },
  triangle: { side: 30 },
  star: { outerRadius: 20, innerRadius: 10, points: 5 },
  polygon: { sides: 6, radius: 20 },
  heart: { size: 25 },
};

export const PRIMITIVE_METADATA: Record<PrimitiveShape, { name: string; icon: string; description: string }> = {
  circle: { name: "Círculo", icon: "⭕", description: "Círculo perfeito" },
  rect: { name: "Retângulo", icon: "▭", description: "Retângulo com cantos retos" },
  "rounded-rect": { name: "Ret. Arredondado", icon: "⬜", description: "Retângulo com cantos arredondados" },
  triangle: { name: "Triângulo", icon: "△", description: "Triângulo equilátero" },
  star: { name: "Estrela", icon: "★", description: "Estrela de 5 pontas" },
  polygon: { name: "Polígono", icon: "⬟", description: "Polígono regular (3-12 lados)" },
  heart: { name: "Coração", icon: "♥", description: "Forma de coração" },
}

const D: Record<string, Record<string, number>> = {
  circle: { radius: 15 },
  rect: { width: 30, height: 20, cornerRadius: 0 },
  "rounded-rect": { width: 30, height: 20, cornerRadius: 4 },
  triangle: { side: 30 },
  star: { outerRadius: 20, innerRadius: 10, points: 5 },
  polygon: { sides: 6, radius: 20 },
  heart: { size: 25 },
};

export function primitiveToShape(shape: string, params: Record<string, number>): THREE.Shape {
  const s = new THREE.Shape();
  const p = params as any;
  const D = PRIMITIVE_DEFAULTS as any;

  switch (shape) {
    case "circle": {
      const r = p.radius ?? 15;
      s.absarc(0, 0, r, 0, Math.PI * 2, false);
      break;
    }
    case "rect": {
      const w = p.width ?? 30;
      const h = p.height ?? 20;
      const cr = p.cornerRadius ?? 0;
      const hw = w / 2, hh = h / 2;
      if (cr > 0) {
        const r = Math.min(cr, hw, hh);
        s.moveTo(-hw + r, -hh);
        s.lineTo(hw - r, -hh);
        s.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
        s.lineTo(hw, hh - r);
        s.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
        s.lineTo(-hw + r, hh);
        s.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
        s.lineTo(-hw, -hh + r);
        s.absarc(-hw + r, -hh + r, r, Math.PI, 3 * Math.PI / 2, false);
      } else {
        s.moveTo(-hw, -hh);
        s.lineTo(hw, -hh);
        s.lineTo(hw, hh);
        s.lineTo(-hw, hh);
      }
      break;
    }
    case "rounded-rect": {
      const w = p.width ?? 30;
      const h = p.height ?? 20;
      const cr = p.cornerRadius ?? 4;
      const hw = w / 2, hh = h / 2;
      const r = Math.min(cr, hw, hh);
      s.moveTo(-hw + r, -hh);
      s.lineTo(hw - r, -hh);
      s.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
      s.lineTo(hw, hh - r);
      s.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
      s.lineTo(-hw + r, hh);
      s.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
      s.lineTo(-hw, -hh + r);
      s.absarc(-hw + r, -hh + r, r, Math.PI, 3 * Math.PI / 2, false);
      break;
    }
    case "triangle": {
      const side = p.side ?? 30;
      const h = side * Math.sqrt(3) / 2;
      s.moveTo(0, -2 * h / 3);
      s.lineTo(-side / 2, h / 3);
      s.lineTo(side / 2, h / 3);
      break;
    }
    case "star": {
      const outerR = p.outerRadius ?? 20;
      const innerR = p.innerRadius ?? 10;
      const points = p.points ?? 5;
      for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      break;
    }
    case "polygon": {
      const sides = p.sides ?? 6;
      const r = p.radius ?? 20;
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      break;
    }
    case "heart": {
      const size = p.size ?? 25;
      s.moveTo(0, size * 0.3);
      s.bezierCurveTo(size * 0.5, -size * 0.2, size * 1.2, -size * 0.2, 0, size * 0.8);
      s.bezierCurveTo(-size * 1.2, -size * 0.2, -size * 0.5, -size * 0.2, 0, size * 0.3);
      break;
    }
  }
  return s;
}

export function primitiveToPathData(shape: string, params: Record<string, number>): string {
  const s = primitiveToShape(shape, params);
  return shapeToPathData(s);
}

function shapeToPathData(shape: THREE.Shape): string {
  let d = "";
  const curves = shape.curves;
  if (curves.length === 0) return "";
  d += `M ${curves[0].getPoint(0).x} ${curves[0].getPoint(0).y} `;
  for (const curve of curves) {
    const ctorName = curve.constructor.name;
    if (ctorName === "LineCurve" || ctorName === "LineCurve3") {
      const p = curve.getPoint(1);
      d += `L ${p.x} ${p.y} `;
    } else if (ctorName === "QuadraticBezierCurve" || ctorName === "QuadraticBezierCurve3") {
      const cp = (curve as any).v1;
      const p = curve.getPoint(1);
      d += `Q ${cp.x} ${cp.y} ${p.x} ${p.y} `;
    } else if (ctorName === "CubicBezierCurve" || ctorName === "CubicBezierCurve3") {
      const cp1 = (curve as any).v1;
      const cp2 = (curve as any).v2;
      const p = curve.getPoint(1);
      d += `C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p.x} ${p.y} `;
    } else if (ctorName === "EllipseCurve" || ctorName === "ArcCurve") {
      const points = curve.getPoints(12);
      for (let i = 1; i < points.length; i++) {
        d += `L ${points[i].x} ${points[i].y} `;
      }
    } else {
      const points = curve.getPoints(12);
      for (let i = 1; i < points.length; i++) {
        d += `L ${points[i].x} ${points[i].y} `;
      }
    }
  }
  d += "Z";
  return d;
}

export function primitiveBounds(shape: string, params: Record<string, number>): { minX: number; minY: number; maxX: number; maxY: number } {
  switch (shape) {
    case "circle": {
      const r = (params as any).radius ?? 15;
      return { minX: -r, minY: -r, maxX: r, maxY: r };
    }
    case "rect":
    case "rounded-rect": {
      const w = (params as any).width ?? 30;
      const h = (params as any).height ?? 20;
      return { minX: -w / 2, minY: -h / 2, maxX: w / 2, maxY: h / 2 };
    }
    case "triangle": {
      const side = (params as any).side ?? 30;
      const h = side * Math.sqrt(3) / 2;
      return { minX: -side / 2, minY: -h / 3, maxX: side / 2, maxY: 2 * h / 3 };
    }
    case "star": {
      const r = (params as any).outerRadius ?? 20;
      return { minX: -r, minY: -r, maxX: r, maxY: r };
    }
    case "polygon": {
      const r = (params as any).radius ?? 20;
      return { minX: -r, minY: -r, maxX: r, maxY: r };
    }
    case "heart": {
      const s = (params as any).size ?? 25;
      return { minX: -s, minY: -s * 1.2, maxX: s, maxY: s * 0.8 };
    }
    default:
      return { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  }
}

export function getPrimitiveParams(shape: string): Record<string, number> {
  const defaults: Record<string, Record<string, number>> = {
    circle: { radius: 15 },
    rect: { width: 30, height: 20, cornerRadius: 0 },
    "rounded-rect": { width: 30, height: 20, cornerRadius: 4 },
    triangle: { side: 30 },
    star: { outerRadius: 20, innerRadius: 10, points: 5 },
    polygon: { sides: 6, radius: 20 },
    heart: { size: 25 },
  };
  return { ...(defaults[shape] || {}) };
}