import * as THREE from "three";
import { textToShapeGeometry } from "./textToShape";
import { primitiveToShape, primitiveToPathData, primitiveBounds } from "./primitives";

export { primitiveBounds, primitiveToShape } from "./primitives";

export type ElementType = "path" | "text" | "primitive" | "group";
export type ElementRole = "cutter" | "stamp" | "ignore";

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  transform: Transform;
  role: ElementRole;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  name: string;
}

export interface PathElement extends BaseElement {
  type: "path";
  pathData: string;
}

export interface TextElement extends BaseElement {
  type: "text";
  textData: {
    text: string;
    font: string;
    fontSize: number;
    align: "left" | "center" | "right";
  };
}

export interface PrimitiveElement extends BaseElement {
  type: "primitive";
  primitiveData: {
    shape: "circle" | "rect" | "rounded-rect" | "triangle" | "star" | "polygon" | "heart";
    params: Record<string, number>;
  };
}

export interface GroupElement extends BaseElement {
  type: "group";
  children: DesignElement[];
}

export type DesignElement = PathElement | TextElement | PrimitiveElement | GroupElement;

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultTransform(): Transform {
  return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
}

export function createPathElement(pathData: string, name = "Caminho", role: ElementRole = "stamp"): PathElement {
  return {
    id: createId(),
    type: "path",
    transform: defaultTransform(),
    role,
    visible: true,
    locked: false,
    zIndex: 0,
    name,
    pathData,
  };
}

export function createTextElement(text: string, font: string, fontSize: number, name = "Texto"): TextElement {
  return {
    id: createId(),
    type: "text",
    transform: defaultTransform(),
    role: "stamp",
    visible: true,
    locked: false,
    zIndex: 0,
    name,
    textData: { text, font, fontSize, align: "center" },
  };
}

export function createPrimitiveElement(
  shape: PrimitiveElement["primitiveData"]["shape"],
  params: Record<string, number>,
  name?: string
): PrimitiveElement {
  const names: Record<string, string> = {
    circle: "Círculo",
    rect: "Retângulo",
    "rounded-rect": "Ret. Arredondado",
    triangle: "Triângulo",
    star: "Estrela",
    polygon: "Polígono",
    heart: "Coração",
  };
  return {
    id: createId(),
    type: "primitive",
    transform: defaultTransform(),
    role: "stamp",
    visible: true,
    locked: false,
    zIndex: 0,
    name: name || names[shape] || "Primitiva",
    primitiveData: { shape, params },
  };
}

export function createGroupElement(children: DesignElement[], name = "Grupo"): GroupElement {
  return {
    id: createId(),
    type: "group",
    transform: defaultTransform(),
    role: "stamp",
    visible: true,
    locked: false,
    zIndex: 0,
    name,
    children,
  };
}

export function elementBounds(element: DesignElement): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (element.type === "path") {
    return pathBounds(element.pathData);
  }
  if (element.type === "primitive") {
    return primitiveBounds(element.primitiveData.shape, element.primitiveData.params);
  }
  if (element.type === "text") {
    return textBounds(element.textData.text, element.textData.fontSize);
  }
  if (element.type === "group" && element.children) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const child of element.children) {
      const b = elementBounds(child);
      if (b) {
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
    }
    return minX === Infinity ? null : { minX, minY, maxX, maxY };
  }
  return null;
}

function pathBounds(pathData: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const coords: number[] = [];
  const regex = /[-+]?\d*\.?\d+/g;
  let match;
  while ((match = regex.exec(pathData)) !== null) {
    coords.push(parseFloat(match[0]));
  }
  if (coords.length < 2) return null;
  let minX = coords[0], minY = coords[1], maxX = coords[0], maxY = coords[1];
  for (let i = 0; i < coords.length; i += 2) {
    minX = Math.min(minX, coords[i]);
    maxX = Math.max(maxX, coords[i]);
    minY = Math.min(minY, coords[i + 1]);
    maxY = Math.max(maxY, coords[i + 1]);
  }
  return { minX, minY, maxX, maxY };
}

function textBounds(text: string, fontSize: number): { minX: number; minY: number; maxX: number; maxY: number } {
  const w = text.length * fontSize * 0.6;
  const h = fontSize;
  return { minX: -w / 2, minY: -h / 2, maxX: w / 2, maxY: h / 2 };
}

export function applyTransform(element: DesignElement, transform: Partial<Transform>): DesignElement {
  return {
    ...element,
    transform: { ...element.transform, ...transform },
  };
}

export function toPathData(element: DesignElement): string | null {
  if (element.type === "path") return element.pathData;
  if (element.type === "primitive") return primitiveToPathData(element.primitiveData.shape, element.primitiveData.params);
  if (element.type === "text") return null;
  if (element.type === "group" && element.children) {
    const paths = element.children.map(toPathData).filter(Boolean) as string[];
    return paths.length > 0 ? combinePaths(paths) : null;
  }
  return null;
}

function combinePaths(paths: string[]): string {
  return paths.join(" ");
}

export function migrateLegacy(
  layers: { id: string; name: string; type: "cutter" | "stamp" | "ignore"; points: THREE.Vector2[]; isClosed: boolean; length: number }[],
  textObjects: { id: string; text: string; font: string; fontSize: number; x: number; y: number; scale: number }[]
): DesignElement[] {
  const elements: DesignElement[] = [];

  for (const layer of layers) {
    if (layer.points.length < 2) continue;
    const pathData = pointsToPathData(layer.points, layer.isClosed);
    elements.push({
      ...createPathElement(pathData, layer.name, layer.type),
      transform: {
        ...defaultTransform(),
        x: 0,
        y: 0,
      },
    });
  }

  for (const text of textObjects) {
    elements.push(createTextElement(text.text, text.font, text.fontSize, `Texto: ${text.text.slice(0, 20)}`));
    const last = elements[elements.length - 1] as TextElement;
    last.transform.x = text.x;
    last.transform.y = text.y;
    last.transform.scaleX = text.scale;
    last.transform.scaleY = text.scale;
  }

  return elements;
}

function pointsToPathData(points: THREE.Vector2[], isClosed: boolean): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y} `;
  for (let i = 1; i < points.length; i++) {
    d += `L ${points[i].x} ${points[i].y} `;
  }
  if (isClosed) d += "Z";
  return d;
}

export function pathDataToPoints(pathData: string): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  const regex = /([MLCQZ])([^MLCQZ]*)/g;
  let match;
  let currentX = 0, currentY = 0;
  while ((match = regex.exec(pathData)) !== null) {
    const cmd = match[1];
    const coords = match[2].trim().split(/\s+/).filter(Boolean).map(Number);
    if (cmd === "M" || cmd === "L") {
      for (let i = 0; i < coords.length; i += 2) {
        currentX = coords[i];
        currentY = coords[i + 1];
        points.push(new THREE.Vector2(currentX, currentY));
      }
    } else if (cmd === "C") {
      for (let i = 0; i < coords.length; i += 6) {
        currentX = coords[i + 4];
        currentY = coords[i + 5];
        points.push(new THREE.Vector2(currentX, currentY));
      }
    } else if (cmd === "Q") {
      for (let i = 0; i < coords.length; i += 4) {
        currentX = coords[i + 2];
        currentY = coords[i + 3];
        points.push(new THREE.Vector2(currentX, currentY));
      }
    }
  }
  return points;
}