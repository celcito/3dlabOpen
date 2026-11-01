import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { KeychainConfig } from "../../types/keychain";
import { generateKeychainModel } from "../keychain/geometry";
import {
  createPlateGeometry,
  createShapeElement,
  createStickGeometry,
  createTextGeometry,
  plateShapeBottomYAt,
  plateShapeShape,
  validateForPrint,
  type PrintIssue,
  type TopperConfig,
} from "./cakeTopperGeometry";
import type { Plaque, PlaquePart, PlaqueStyle } from "./plaque";

/**
 * Tudo em **mm** (unidade do config e do export). O preview da página trabalha em
 * cenas de 1 unidade = 10 mm — ao portar fórmulas do preview, multiplicar por 10.
 */

/** Empenamento da haste dentro da placa/corpo (sólido único no fatiador). */
const STICK_EMBED_MM = 1;

function colorsMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Geometrias das hastes penduradas para baixo (-Y) a partir da aresta
 * `anchorY + stickZOffset` (ajuste subir/descer), com a espessura alinhada em
 * z ∈ [0, thickness].
 *
 * A rotação antiga era `-π/2` (haste apontava para **cima**, y ∈ [-30, +50] com
 * defaults — furava por cima da placa). Corrigido para `+π/2` em preview e export.
 *
 * Com `shape` (contorno da placa), cada haste ancora na borda inferior real da
 * forma na posição x dela (`plateShapeBottomYAt`); fora da forma usa `anchorY`.
 */
export function buildStickGeometries(
  topper: TopperConfig,
  anchorY: number,
  shape?: THREE.Shape | null
): THREE.BufferGeometry[] {
  const geoms: THREE.BufferGeometry[] = [];
  const embed = Math.min(STICK_EMBED_MM, Math.max(0, topper.stickHeight * 0.1));
  for (const stick of topper.sticks) {
    const geom = createStickGeometry(stick.height, stick.thickness, stick.width, topper.stickColor).geometry;
    geom.rotateX(Math.PI / 2); // haste desce: y ∈ [-h, 0]
    const edgeY = (shape ? plateShapeBottomYAt(shape, stick.x) : null) ?? anchorY;
    geom.translate(stick.x, edgeY + embed + topper.stickZOffset, stick.thickness / 2);
    geoms.push(geom);
  }
  return geoms;
}

/** Maior contorno preenchido de um SVG (mesma lógica do preview/export antigo). */
function extractSvgShape(svgData: string, targetSizeMm: number): THREE.Shape | null {
  const parser = new SVGLoader();
  const parsed = parser.parse(svgData);
  const allPoints: THREE.Vector2[] = [];
  for (const path of parsed.paths) {
    for (const sub of path.subPaths) {
      const pts = sub.getPoints(20);
      pts.forEach((p) => allPoints.push(p));
    }
  }
  if (allPoints.length === 0) return null;

  const box = new THREE.Box2();
  allPoints.forEach((p) => box.expandByPoint(p));
  const sizeX = box.max.x - box.min.x;
  const sizeY = box.max.y - box.min.y;
  const maxDim = Math.max(sizeX, sizeY) || 1;
  const scale = targetSizeMm / maxDim;
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;

  let bestShape: THREE.Shape | null = null;
  let bestArea = 0;
  for (const path of parsed.paths) {
    const isFilled = !!(path.userData as any)?.style?.fill;
    if (!isFilled) continue;
    for (const sub of path.subPaths) {
      const pts = sub.getPoints(20);
      if (pts.length < 3) continue;
      const shape = new THREE.Shape();
      shape.moveTo((pts[0].x - cx) * scale, -(pts[0].y - cy) * scale);
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo((pts[i].x - cx) * scale, -(pts[i].y - cy) * scale);
      }
      shape.closePath();
      const bbox = new THREE.Box2();
      shape.getPoints().forEach((p) => bbox.expandByPoint(p));
      const sz = new THREE.Vector2();
      bbox.getSize(sz);
      const area = sz.x * sz.y;
      if (area > bestArea) {
        bestArea = area;
        bestShape = shape;
      }
    }
  }
  return bestShape;
}

/** Estilo `placa`: pipeline atual da página, em mm (corrige o bug de escala). */
async function buildPlacaParts(topper: TopperConfig): Promise<PlaquePart[]> {
  const parts: PlaquePart[] = [];

  const plateShape = plateShapeShape(
    topper.plateWidth,
    topper.plateHeight,
    topper.plateCornerRadius,
    topper.plateShape,
    topper.plateShapeSvg
  );
  const plate = createPlateGeometry(
    topper.plateWidth,
    topper.plateHeight,
    topper.plateThickness,
    topper.plateCornerRadius,
    topper.plateColor,
    plateShape
  );
  parts.push({ geoms: [plate.geometry], name: "placa", color: topper.plateColor });

  if (topper.showBorder && topper.borderWidth > 0) {
    const borderShape = plateShapeShape(
      topper.plateWidth + topper.borderWidth * 2,
      topper.plateHeight + topper.borderWidth * 2,
      topper.plateCornerRadius + topper.borderWidth,
      topper.plateShape,
      topper.plateShapeSvg
    );
    const border = createPlateGeometry(
      topper.plateWidth + topper.borderWidth * 2,
      topper.plateHeight + topper.borderWidth * 2,
      topper.plateThickness,
      topper.plateCornerRadius + topper.borderWidth,
      topper.borderColor,
      borderShape
    );
    border.geometry.translate(0, 0, -topper.borderWidth / 2);
    parts.push({ geoms: [border.geometry], name: "borda", color: topper.borderColor });
  }

  // Texto + subtítulo + elementos da mesma cor → uma part colorida.
  const textGeoms: THREE.BufferGeometry[] = [];
  const elementGeoms = new Map<string, THREE.BufferGeometry[]>(); // por cor

  const pushElement = (color: string, geom: THREE.BufferGeometry) => {
    if (colorsMatch(color, topper.textColor)) {
      textGeoms.push(geom);
      return;
    }
    const key = color.toLowerCase();
    const list = elementGeoms.get(key) ?? [];
    list.push(geom);
    elementGeoms.set(key, list);
  };

  if (topper.text) {
    try {
      const { geometry } = await createTextGeometry(
        topper.text,
        topper.fontFamily,
        topper.fontSize,
        topper.textThickness,
        topper.letterSpacing
      );
      geometry.translate(0, 0, topper.plateThickness);
      textGeoms.push(geometry);
    } catch (err) {
      console.warn("Falha ao gerar texto (fonte indisponível):", err);
    }
  }

  if (topper.subtitle) {
    try {
      const { geometry } = await createTextGeometry(
        topper.subtitle,
        topper.fontFamily,
        topper.fontSize * 0.6,
        topper.textThickness,
        topper.letterSpacing
      );
      geometry.translate(0, -topper.plateHeight * 0.3, topper.plateThickness);
      textGeoms.push(geometry);
    } catch (err) {
      console.warn("Falha ao gerar subtítulo (fonte indisponível):", err);
    }
  }

  for (const el of topper.elements) {
    try {
      if (el.type === "shape" && el.shapeType) {
        const mesh = createShapeElement(el.shapeType, el.fontSize || 10, topper.textThickness, el.color);
        if (mesh) {
          mesh.geometry.translate(el.x, el.y, topper.plateThickness);
          mesh.geometry.rotateZ((el.rotation * Math.PI) / 180);
          mesh.geometry.scale(el.scale, el.scale, el.scale);
          pushElement(el.color, mesh.geometry);
        }
      } else if (el.type === "text" || el.type === "number") {
        const { geometry } = await createTextGeometry(
          el.content,
          el.fontFamily || topper.fontFamily,
          el.fontSize || topper.fontSize,
          topper.textThickness,
          0
        );
        geometry.translate(el.x, el.y, topper.plateThickness);
        geometry.rotateZ((el.rotation * Math.PI) / 180);
        geometry.scale(el.scale, el.scale, el.scale);
        pushElement(el.color, geometry);
      } else if (el.type === "image" && el.svgData) {
        const shape = extractSvgShape(el.svgData, el.widthMm || 30);
        if (shape) {
          const geom = new THREE.ExtrudeGeometry(shape, {
            depth: topper.textThickness,
            bevelEnabled: false,
          });
          geom.computeVertexNormals();
          geom.translate(el.x, el.y, topper.plateThickness);
          geom.rotateZ((el.rotation * Math.PI) / 180);
          geom.scale(el.scale, el.scale, el.scale);
          pushElement(el.color, geom);
        }
      }
    } catch (err) {
      console.warn(`Falha ao gerar elemento "${el.content}":`, err);
    }
  }

  if (textGeoms.length > 0) {
    parts.push({ geoms: textGeoms, name: "texto", color: topper.textColor });
  }
  let extra = 0;
  for (const [color, geoms] of elementGeoms) {
    extra += 1;
    parts.push({ geoms, name: `elemento-${extra}`, color });
  }

  const stickGeoms = buildStickGeometries(topper, -topper.plateHeight / 2, plateShape);
  if (stickGeoms.length > 0) {
    parts.push({ geoms: stickGeoms, name: "hastes", color: topper.stickColor });
  }

  return parts;
}

/** Estilos de nome: reuso do `generateKeychainModel` do chaveiro (sem argola). */
async function buildNomeParts(plaque: Plaque): Promise<PlaquePart[]> {
  const nameConfig: KeychainConfig = { ...plaque.name, loopEnabled: false };
  const model = await generateKeychainModel(nameConfig);
  const baseGeom = model.baseMesh.geometry;
  const reliefGeom = model.reliefMesh.geometry;

  baseGeom.computeBoundingBox();
  const baseBox = baseGeom.boundingBox || new THREE.Box3();

  const parts: PlaquePart[] = [];
  let anchorY: number;
  let zLift = 0;
  let plateShape: THREE.Shape | null = null;

  if (plaque.style === "nome-placa") {
    const topper = plaque.topper;
    plateShape = plateShapeShape(
      topper.plateWidth,
      topper.plateHeight,
      topper.plateCornerRadius,
      topper.plateShape,
      topper.plateShapeSvg
    );
    const plate = createPlateGeometry(
      topper.plateWidth,
      topper.plateHeight,
      topper.plateThickness,
      topper.plateCornerRadius,
      topper.plateColor,
      plateShape
    );
    parts.push({ geoms: [plate.geometry], name: "placa", color: topper.plateColor });
    // Bloco do nome sobe para cima da placa (z ∈ [plateThickness …]).
    baseGeom.translate(0, 0, topper.plateThickness);
    reliefGeom.translate(0, 0, topper.plateThickness);
    anchorY = -topper.plateHeight / 2;
  } else {
    anchorY = baseBox.min.y;
  }

  parts.push({ geoms: [baseGeom], name: "corpo", color: nameConfig.baseColor });
  parts.push({ geoms: [reliefGeom], name: "relevo", color: nameConfig.reliefColor });

  const stickGeoms = buildStickGeometries(plaque.topper, anchorY, plateShape);
  if (stickGeoms.length > 0) {
    parts.push({ geoms: stickGeoms, name: "hastes", color: plaque.topper.stickColor });
  }

  return parts;
}

/** Gera as cascas fechadas (mm) de uma plaquinha, agrupadas por cor. */
export async function buildPlaqueParts(plaque: Plaque): Promise<PlaquePart[]> {
  if (plaque.style === "placa") {
    return buildPlacaParts(plaque.topper);
  }
  return buildNomeParts(plaque);
}

/** Bounding box XY da plaquinha inteira (union de todas as parts). */
export function getPlaqueBounds(parts: PlaquePart[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const box = new THREE.Box3();
  for (const part of parts) {
    for (const geom of part.geoms) {
      geom.computeBoundingBox();
      if (geom.boundingBox) box.union(geom.boundingBox);
    }
  }
  if (box.isEmpty()) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y };
}

/**
 * Encaixe do nome na placa (estilo `nome-placa`): usa a largura gerada do nome
 * contra a área útil da placa. `nameWidthMm` vem do preview (dimensions.dimX).
 */
export function checkNameFitsPlate(nameWidthMm: number, topper: TopperConfig): boolean {
  const usable = topper.plateWidth - 2 * Math.max(topper.plateCornerRadius, 4);
  return nameWidthMm <= usable;
}

/**
 * Validação por estilo `[V1, V2]`:
 * - `placa`: mesmo `validateForPrint` de antes (regressão intacta);
 * - estilos de nome: espessuras mínimas do chaveiro + hastes + (nome-placa)
 *   checks da placa e o fit check do nome.
 */
export function validatePlaqueForPrint(
  style: PlaqueStyle,
  topper: TopperConfig,
  name: KeychainConfig,
  nameWidthMm?: number | null
): PrintIssue[] {
  if (style === "placa") return validateForPrint(topper);

  const issues: PrintIssue[] = [];

  // Hastes — mesmos critérios do estilo placa.
  if (topper.stickThickness < 1.5) {
    issues.push({ type: "warning", message: `Hastes muito finas (${topper.stickThickness}mm). Recomendado: mínimo 2mm` });
  }
  if (topper.stickWidth < 2) {
    issues.push({ type: "warning", message: `Largura das hastes muito pequena (${topper.stickWidth}mm). Recomendado: mínimo 3mm` });
  }
  if (topper.stickHeight < 20) {
    issues.push({ type: "warning", message: `Altura das hastes muito curta (${topper.stickHeight}mm). Mínimo recomendado: 30mm` });
  }

  if (style === "nome-placa") {
    if (topper.plateThickness < 0.8) {
      issues.push({ type: "error", message: `Espessura da placa muito fina (${topper.plateThickness}mm). Mínimo: 0.8mm` });
    }
    if (nameWidthMm != null && nameWidthMm > 0 && !checkNameFitsPlate(nameWidthMm, topper)) {
      issues.push({
        type: "warning",
        message: `Nome (${nameWidthMm}mm) mais largo que a placa — aumente a largura ou reduza o tamanho da letra`,
      });
    }
  }

  // Nome — espessuras mínimas do chaveiro.
  if (!name.text.trim()) {
    issues.push({ type: "error", message: "Adicione um nome" });
  }
  if (name.bodyThickness < 1.5) {
    issues.push({ type: "error", message: `Corpo do nome muito fino (${name.bodyThickness}mm). Mínimo: 1.5mm` });
  }
  if (name.reliefThickness < 0.8) {
    issues.push({ type: "error", message: `Relevo do nome muito fino (${name.reliefThickness}mm). Mínimo: 0.8mm` });
  }

  return issues;
}
