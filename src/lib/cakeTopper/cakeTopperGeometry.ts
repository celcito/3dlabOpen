import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

export const TOPPER_FONTS = [
  { name: "Impact (Grossa)", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/helvetiker_bold.typeface.json" },
  { name: "Sans Regular", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/helvetiker_regular.typeface.json" },
  { name: "Gentilis", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/gentilis_bold.typeface.json" },
  { name: "Optimer", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/optimer_regular.typeface.json" },
  { name: "Gentilis Italic", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/gentilis_regular.typeface.json" },
];

export interface TopperElement {
  id: string;
  type: "text" | "number" | "shape" | "decoration" | "image";
  content: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
  fontSize?: number;
  fontFamily?: string;
  shapeType?: string;
  /** SVG string for traced images or uploaded SVGs */
  svgData?: string;
  /** Bounding dimensions of the traced shape in mm */
  widthMm?: number;
  heightMm?: number;
  zIndex: number;
}

export interface TopperStick {
  id: string;
  x: number;
  height: number;
  thickness: number;
  width: number;
}

export interface TopperConfig {
  text: string;
  fontFamily: string;
  fontSize: number;
  textThickness: number;
  letterSpacing: number;
  alignment: "left" | "center" | "right";
  plateThickness: number;
  plateWidth: number;
  plateHeight: number;
  plateCornerRadius: number;
  plateColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  showBorder: boolean;
  stickCount: number;
  stickHeight: number;
  stickThickness: number;
  stickWidth: number;
  stickColor: string;
  elements: TopperElement[];
  sticks: TopperStick[];
  totalHeight: number;
  totalWidth: number;
  smoothEdges: boolean;
  addReinforcement: boolean;
  reinforcementThickness: number;
  age: string;
  subtitle: string;
  theme: string;
}

export const THEMES: Record<string, { plateColor: string; textColor: string; borderColor: string; elements: Partial<TopperConfig> }> = {
  aniversario: { plateColor: "#FF6B9D", textColor: "#FFFFFF", borderColor: "#FF1A6D", elements: { borderWidth: 2, showBorder: true } },
  casamento: { plateColor: "#F5E6D3", textColor: "#C9A96E", borderColor: "#C9A96E", elements: { borderWidth: 1.5, showBorder: true } },
  infantil: { plateColor: "#7EC8E3", textColor: "#FFFFFF", borderColor: "#FFD93D", elements: { borderWidth: 3, showBorder: true } },
  cha_bebe: { plateColor: "#B8E6D0", textColor: "#5B8C5A", borderColor: "#5B8C5A", elements: { borderWidth: 2, showBorder: true } },
  quinze_anos: { plateColor: "#E8B4F8", textColor: "#FFFFFF", borderColor: "#D68FFF", elements: { borderWidth: 2, showBorder: true } },
  batizado: { plateColor: "#FFFFFF", textColor: "#C9A96E", borderColor: "#C9A96E", elements: { borderWidth: 1, showBorder: true } },
  formatura: { plateColor: "#1A1A2E", textColor: "#FFD700", borderColor: "#FFD700", elements: { borderWidth: 2, showBorder: true } },
  natal: { plateColor: "#CC0000", textColor: "#FFD700", borderColor: "#FFD700", elements: { borderWidth: 3, showBorder: true } },
  personalizado: { plateColor: "#632CE5", textColor: "#FFFFFF", borderColor: "#FFFFFF", elements: { borderWidth: 2, showBorder: true } },
};

export const SHAPE_PRESETS: Record<string, (cx: number, cy: number, size: number) => THREE.Shape> = {
  estrela: (cx, cy, s) => {
    const shape = new THREE.Shape();
    const spikes = 5;
    const outerR = s / 2;
    const innerR = s / 4.5;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  },
  coracao: (cx, cy, s) => {
    const shape = new THREE.Shape();
    const r = s / 4;
    shape.moveTo(cx, cy - r * 0.5);
    shape.bezierCurveTo(cx, cy - r * 1.5, cx - r * 2, cy - r * 1.5, cx - r * 2, cy - r * 0.5);
    shape.bezierCurveTo(cx - r * 2, cy + r * 0.5, cx, cy + r * 1.2, cx, cy + r * 1.8);
    shape.bezierCurveTo(cx, cy + r * 1.2, cx + r * 2, cy + r * 0.5, cx + r * 2, cy - r * 0.5);
    shape.bezierCurveTo(cx + r * 2, cy - r * 1.5, cx, cy - r * 1.5, cx, cy - r * 0.5);
    return shape;
  },
  flor: (cx, cy, s) => {
    const shape = new THREE.Shape();
    const petals = 5;
    const petalR = s / 5;
    const centerR = s / 8;
    for (let i = 0; i < petals; i++) {
      const angle = (i * 2 * Math.PI) / petals - Math.PI / 2;
      const px = cx + petalR * 1.5 * Math.cos(angle);
      const py = cy + petalR * 1.5 * Math.sin(angle);
      const petal = new THREE.Shape();
      petal.absarc(px, py, petalR, 0, Math.PI * 2);
      const holes = shape.holes.length;
      // Merge petal into shape by creating union via simple approach
      // For simplicity, just draw petals as individual shapes
    }
    // Simple 5-petal flower
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? s / 2.5 : s / 6;
      pts.push(new THREE.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
    }
    shape.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
    shape.closePath();
    return shape;
  },
  coroa: (cx, cy, s) => {
    const shape = new THREE.Shape();
    const w = s;
    const h = s * 0.6;
    shape.moveTo(cx - w / 2, cy - h / 3);
    shape.lineTo(cx - w / 2, cy + h / 3);
    shape.lineTo(cx - w / 4, cy);
    shape.lineTo(cx, cy + h / 2);
    shape.lineTo(cx + w / 4, cy);
    shape.lineTo(cx + w / 2, cy + h / 3);
    shape.lineTo(cx + w / 2, cy - h / 3);
    shape.closePath();
    return shape;
  },
  balao: (cx, cy, s) => {
    const shape = new THREE.Shape();
    const r = s / 3;
    shape.absarc(cx, cy + r * 0.3, r, 0, Math.PI * 2);
    // Triangle at bottom
    shape.moveTo(cx - r * 0.3, cy - r * 0.5);
    shape.lineTo(cx, cy - r * 1.2);
    shape.lineTo(cx + r * 0.3, cy - r * 0.5);
    return shape;
  },
  circulo: (cx, cy, s) => {
    const shape = new THREE.Shape();
    shape.absarc(cx, cy, s / 2, 0, Math.PI * 2);
    return shape;
  },
  quadrado: (cx, cy, s) => {
    const shape = new THREE.Shape();
    const hs = s / 2;
    shape.moveTo(cx - hs, cy - hs);
    shape.lineTo(cx + hs, cy - hs);
    shape.lineTo(cx + hs, cy + hs);
    shape.lineTo(cx - hs, cy + hs);
    shape.closePath();
    return shape;
  },
  losango: (cx, cy, s) => {
    const shape = new THREE.Shape();
    const hs = s / 2;
    shape.moveTo(cx, cy + hs);
    shape.lineTo(cx + hs, cy);
    shape.lineTo(cx, cy - hs);
    shape.lineTo(cx - hs, cy);
    shape.closePath();
    return shape;
  },
  triangulo: (cx, cy, s) => {
    const shape = new THREE.Shape();
    const hs = s / 2;
    shape.moveTo(cx, cy + hs);
    shape.lineTo(cx + hs, cy - hs);
    shape.lineTo(cx - hs, cy - hs);
    shape.closePath();
    return shape;
  },
  estrela6: (cx, cy, s) => {
    const shape = new THREE.Shape();
    const spikes = 6;
    const outerR = s / 2;
    const innerR = s / 3.5;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  },
  nuvem: (cx, cy, s) => {
    const shape = new THREE.Shape();
    const r = s / 6;
    shape.absarc(cx - r * 1.5, cy, r, 0, Math.PI * 2);
    const hole1 = new THREE.Path();
    hole1.absarc(cx - r * 1.5, cy, r * 0.95, 0, Math.PI * 2, true);
    // Simple cloud via overlapping circles merged
    const cloud = new THREE.Shape();
    cloud.absarc(cx - r * 1.2, cy - r * 0.2, r * 1.1, 0, Math.PI * 2);
    return cloud;
  },
};

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const hs = w / 2;
  const hh = h / 2;
  r = Math.min(r, hs, hh);
  shape.moveTo(-hs + r, -hh);
  shape.lineTo(hs - r, -hh);
  shape.quadraticCurveTo(hs, -hh, hs, -hh + r);
  shape.lineTo(hs, hh - r);
  shape.quadraticCurveTo(hs, hh, hs - r, hh);
  shape.lineTo(-hs + r, hh);
  shape.quadraticCurveTo(-hs, hh, -hs, hh - r);
  shape.lineTo(-hs, -hh + r);
  shape.quadraticCurveTo(-hs, -hh, -hs + r, -hh);
  return shape;
}

const fontCache = new Map<string, any>();
const fontLoadPromises = new Map<string, Promise<any>>();

export async function loadTopperFont(url: string): Promise<any> {
  if (fontCache.has(url)) return fontCache.get(url);
  if (fontLoadPromises.has(url)) return fontLoadPromises.get(url);

  const promise = new Promise<any>((resolve) => {
    new FontLoader().load(url, (font) => {
      fontCache.set(url, font);
      resolve(font);
    });
  });
  fontLoadPromises.set(url, promise);
  return promise;
}

export async function createTextGeometry(
  text: string,
  fontUrl: string,
  size: number,
  depth: number,
  letterSpacing: number = 0
): Promise<{ geometry: THREE.BufferGeometry; width: number; height: number }> {
  const font = await loadTopperFont(fontUrl);

  // Create individual letter geometries if letterSpacing > 0
  if (letterSpacing > 0 && text.length > 1) {
    const letters: THREE.BufferGeometry[] = [];
    let totalWidth = 0;

    for (const char of text) {
      const geom = new TextGeometry(char, {
        font,
        size: size,
        depth,
        curveSegments: 8,
        bevelEnabled: false,
      });
      geom.computeBoundingBox();
      const bb = geom.boundingBox!;
      const charWidth = bb.max.x - bb.min.x;
      geom.translate(totalWidth, 0, 0);
      letters.push(geom);
      totalWidth += charWidth + letterSpacing;
    }
    totalWidth -= letterSpacing; // Remove last spacing

    const merged = mergeGeoms(letters);
    merged.computeBoundingBox();
    const bb = merged.boundingBox!;
    // Center horizontally
    const offsetX = -(bb.max.x - bb.min.x) / 2 - bb.min.x;
    const offsetY = -(bb.max.y - bb.min.y) / 2 - bb.min.y;
    merged.translate(offsetX, offsetY, 0);

    return {
      geometry: merged,
      width: bb.max.x - bb.min.x,
      height: bb.max.y - bb.min.y,
    };
  }

  // Single text block
  const geom = new TextGeometry(text, {
    font,
    size,
    depth,
    curveSegments: 8,
    bevelEnabled: false,
  });
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const w = bb.max.x - bb.min.x;
  const h = bb.max.y - bb.min.y;
  geom.translate(-w / 2 - bb.min.x, -h / 2 - bb.min.y, 0);

  return { geometry: geom, width: w, height: h };
}

function mergeGeoms(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geoms.length === 0) return new THREE.BufferGeometry();
  if (geoms.length === 1) return geoms[0];

  // Simple merge by combining position arrays
  let totalPositions = 0;
  let totalIndices = 0;

  for (const g of geoms) {
    const pos = g.getAttribute("position");
    if (pos) totalPositions += pos.count;
    const idx = g.getIndex();
    if (idx) totalIndices += idx.count;
    else if (pos) totalIndices += pos.count;
  }

  const positions = new Float32Array(totalPositions * 3);
  const indices: number[] = [];
  let posOffset = 0;
  let idxOffset = 0;

  for (const g of geoms) {
    const pos = g.getAttribute("position");
    if (!pos) continue;
    for (let i = 0; i < pos.count * 3; i++) {
      positions[posOffset * 3 + i] = (pos.array as Float32Array)[i];
    }
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.array[i] + posOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(i + posOffset);
      }
    }
    posOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

export function createPlateGeometry(
  width: number,
  height: number,
  thickness: number,
  cornerRadius: number,
  color: string
): THREE.Mesh {
  const shape = roundedRectShape(width, height, cornerRadius);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });
  geom.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
  return new THREE.Mesh(geom, mat);
}

export function createStickGeometry(
  height: number,
  thickness: number,
  width: number,
  color: string
): THREE.Mesh {
  const shape = new THREE.Shape();
  const ht = thickness / 2;
  const hw = width / 2;
  shape.moveTo(-hw, -ht);
  shape.lineTo(hw, -ht);
  shape.lineTo(hw, ht);
  shape.lineTo(-hw, ht);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geom.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
  return new THREE.Mesh(geom, mat);
}

export function createShapeElement(
  shapeType: string,
  size: number,
  thickness: number,
  color: string
): THREE.Mesh | null {
  const fn = SHAPE_PRESETS[shapeType];
  if (!fn) return null;
  const shape = fn(0, 0, size);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });
  geom.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
  return new THREE.Mesh(geom, mat);
}

export interface PrintIssue {
  type: "error" | "warning";
  message: string;
  elementId?: string;
}

export function validateForPrint(config: TopperConfig): PrintIssue[] {
  const issues: PrintIssue[] = [];
  const MIN_THICKNESS = 0.8;
  const MIN_ELEMENT_SIZE = 3;
  const MIN_DISTANCE = 1.5;

  // Check plate thickness
  if (config.plateThickness < MIN_THICKNESS) {
    issues.push({ type: "error", message: `Espessura da placa muito fina (${config.plateThickness}mm). Mínimo: ${MIN_THICKNESS}mm` });
  }

  // Check text thickness
  if (config.textThickness < MIN_THICKNESS) {
    issues.push({ type: "error", message: `Espessura do texto muito fina (${config.textThickness}mm). Mínimo: ${MIN_THICKNESS}mm` });
  }

  // Check stick dimensions
  if (config.stickThickness < 1.5) {
    issues.push({ type: "warning", message: `Hastes muito finas (${config.stickThickness}mm). Recomendado: mínimo 2mm` });
  }
  if (config.stickWidth < 2) {
    issues.push({ type: "warning", message: `Largura das hastes muito pequena (${config.stickWidth}mm). Recomendado: mínimo 3mm` });
  }
  if (config.stickHeight < 20) {
    issues.push({ type: "warning", message: `Altura das hastes muito curta (${config.stickHeight}mm). Mínimo recomendado: 30mm` });
  }

  // Check total dimensions
  if (config.plateWidth > 200) {
    issues.push({ type: "warning", message: `Largura total (${config.plateWidth}mm) pode ser grande para impressão em maioria de impressoras` });
  }
  if (config.plateHeight > 150) {
    issues.push({ type: "warning", message: `Altura total (${config.plateHeight}mm) pode ser grande para impressão` });
  }

  // Check elements
  for (const el of config.elements) {
    if (el.fontSize && el.fontSize < MIN_ELEMENT_SIZE) {
      issues.push({ type: "warning", message: `Elemento "${el.content}" muito pequeno (${el.fontSize}mm)`, elementId: el.id });
    }
    if (el.scale < 0.3) {
      issues.push({ type: "warning", message: `Elemento "${el.content}" muito reduzido`, elementId: el.id });
    }
  }

  // Check text content
  if (!config.text && config.elements.length === 0) {
    issues.push({ type: "error", message: "Adicione texto ou elementos ao topper" });
  }

  // Check min distance between elements
  for (let i = 0; i < config.elements.length; i++) {
    for (let j = i + 1; j < config.elements.length; j++) {
      const a = config.elements[i];
      const b = config.elements[j];
      const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
      const minDist = ((a.fontSize || 10) + (b.fontSize || 10)) / 2 * 0.3;
      if (dist < MIN_DISTANCE && minDist > MIN_DISTANCE) {
        issues.push({ type: "warning", message: `Elementos "${a.content}" e "${b.content}" muito próximos` });
      }
    }
  }

  return issues;
}

export function estimateModelDimensions(config: TopperConfig): { width: number; height: number; depth: number } {
  return {
    width: config.plateWidth,
    height: config.plateHeight + config.stickHeight,
    depth: Math.max(config.plateThickness, config.textThickness) + config.stickThickness,
  };
}
