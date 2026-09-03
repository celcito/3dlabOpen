import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * Ponte "Design Editor -> Plate Creator".
 * Converte marcação SVG (ex: exportada do editor 2D/fabric.js) em shapes do Three.js,
 * respeitando furos de letras/ícones (SVGLoader.createShapes já resolve fill-rule).
 */
export function parseSvgShapes(svgMarkup: string): THREE.Shape[] {
  // Pre-process SVG: convert strokes to fills for paths that have stroke but no fill
  const processed = preprocessSvgStrokes(svgMarkup);
  const data = new SVGLoader().parse(processed);
  const shapes: THREE.Shape[] = [];
  data.paths.forEach((path) => {
    SVGLoader.createShapes(path).forEach((s) => shapes.push(s));
  });
  return shapes;
}

/**
 * Pre-process SVG markup to convert stroked paths into filled paths.
 * SVGLoader renders strokes as thin lines with zero area — this converts them
 * to expanded filled shapes so they extrude properly for 3D.
 */
function preprocessSvgStrokes(svgMarkup: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgMarkup;

    // Ensure viewBox is set for proper coordinate normalization
    if (!svg.getAttribute("viewBox")) {
      const width = svg.getAttribute("width");
      const height = svg.getAttribute("height");
      if (width && height) {
        const w = parseFloat(width) || 100;
        const h = parseFloat(height) || 100;
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      } else {
        svg.setAttribute("viewBox", "0 0 100 100");
      }
    }

    // Process all path, line, rect, circle, ellipse elements
    const elements = svg.querySelectorAll("path, line, rect, circle, ellipse, polyline, polygon");
    elements.forEach((el) => {
      const stroke = el.getAttribute("stroke");
      const strokeWidth = el.getAttribute("stroke-width");
      const fill = el.getAttribute("fill");
      const computedFill = fill || (el.parentElement ? getEffectiveFill(el.parentElement as Element) : null);

      // If element has a stroke with width but no fill (or fill="none"), expand stroke to fill
      if (stroke && stroke !== "none" && strokeWidth && parseFloat(strokeWidth) > 0 && (!computedFill || computedFill === "none")) {
        el.setAttribute("fill", stroke);
        el.setAttribute("stroke", "none");
        el.removeAttribute("stroke-width");
        el.removeAttribute("stroke-linecap");
        el.setAttribute("stroke-width", "0");
      }
    });

    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  } catch {
    return svgMarkup;
  }
}

/** Walk up the DOM tree to find the effective fill color */
function getEffectiveFill(el: Element): string | null {
  const fill = el.getAttribute("fill");
  if (fill) return fill;
  if (el.parentElement) return getEffectiveFill(el.parentElement);
  return null;
}

/**
 * Um scale negativo em um eixo (usado abaixo para inverter Y) inverte o "winding order"
 * dos triângulos, o que deixa as normais apontando pra dentro. Isso corrige isso trocando
 * o 2º e 3º vértice de cada triângulo — necessário pra o STL sair com normais corretas.
 */
function reverseTriangleWinding(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute("position");
  const arr = pos.array as Float32Array;
  for (let i = 0; i < arr.length; i += 9) {
    for (let c = 0; c < 3; c++) {
      const a = i + 3 + c;
      const b = i + 6 + c;
      const tmp = arr[a];
      arr[a] = arr[b];
      arr[b] = tmp;
    }
  }
  pos.needsUpdate = true;
}

function mergeToNonIndexed(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  parts.forEach((g) => (total += g.getAttribute("position").count));

  const positions = new Float32Array(total * 3);
  let offset = 0;
  parts.forEach((g) => {
    const arr = g.getAttribute("position").array as Float32Array;
    positions.set(arr, offset * 3);
    offset += g.getAttribute("position").count;
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return merged;
}

export interface SvgExtrudeOptions {
  /** Profundidade de extrusão, em unidades de mundo (já dividido por 10, mesma escala do resto da cena) */
  depth: number;
  /** Tamanho alvo (maior lado do bounding box) após normalização, em unidades de mundo */
  targetSize: number;
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
  bevelSegments?: number;
}

/**
 * Constrói uma única BufferGeometry mesclada, centralizada e com escala normalizada a
 * partir de SVG bruto — pronta para <mesh geometry={...}> ou para STLExporter.
 * Retorna null se o SVG não tiver nenhum path desenhável.
 */
export function svgToExtrudedGeometry(
  svgMarkup: string,
  opts: SvgExtrudeOptions
): THREE.BufferGeometry | null {
  if (!svgMarkup || !svgMarkup.trim()) return null;

  let shapes: THREE.Shape[];
  try {
    shapes = parseSvgShapes(svgMarkup);
  } catch (err) {
    console.error("Falha ao interpretar SVG importado:", err);
    return null;
  }
  if (shapes.length === 0) return null;

  const extrudeSettings = {
    steps: 1,
    depth: opts.depth,
    bevelEnabled: opts.bevelEnabled ?? true,
    bevelThickness: opts.bevelThickness ?? 0.03,
    bevelSize: opts.bevelSize ?? 0.015,
    bevelSegments: opts.bevelSegments ?? 2,
  };

  const parts = shapes.map((shape) => new THREE.ExtrudeGeometry(shape, extrudeSettings));
  const merged = parts.length === 1 ? parts[0].toNonIndexed() : mergeToNonIndexed(parts);

  merged.computeBoundingBox();
  const bbox = merged.boundingBox!;
  const cx = (bbox.min.x + bbox.max.x) / 2;
  const cy = (bbox.min.y + bbox.max.y) / 2;
  merged.translate(-cx, -cy, 0);

  const w = bbox.max.x - bbox.min.x;
  const h = bbox.max.y - bbox.min.y;
  const longest = Math.max(w, h, 1e-6);
  const scale = opts.targetSize / longest;

  // Inverte Y (SVG é y-para-baixo, three.js é y-para-cima) e normaliza tamanho de uma vez
  merged.scale(scale, -scale, 1);
  reverseTriangleWinding(merged);
  merged.computeVertexNormals();

  return merged;
}