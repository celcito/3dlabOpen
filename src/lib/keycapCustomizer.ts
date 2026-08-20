import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import ImageTracer from "imagetracerjs";
import { Brush, Evaluator, ADDITION, SUBTRACTION } from "three-bvh-csg";

export type CustomizationMode = "emboss" | "engrave";
export type CustomizationInputType = "image" | "svg" | "model";

export interface TopFootprint {
  width: number;
  depth: number;
  surfaceY: number;
}

export interface CustomizationOptions {
  mode: CustomizationMode;
  reliefHeight: number;
  scale: number;
  invertImage?: boolean;
  imageThreshold?: number;
}

async function loadImageBitmapFromFile(file: File): Promise<ImageData> {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.drawImage(image, 0, 0);
  image.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

async function rasterFileToSVGText(file: File, { invert = false, threshold = 128 }: { invert?: boolean; threshold?: number }) {
  const imageData = await loadImageBitmapFromFile(file);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const foreground = invert ? gray > threshold : gray < threshold;
    const value = foreground ? 0 : 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  return ImageTracer.imagedataToSVG(imageData, {
    numberofcolors: 2,
    pathomit: 8,
    ltres: 1,
    qtres: 1,
    strokewidth: 0,
  });
}

function svgTextToShapes(svgText: string): THREE.Shape[] {
  const data = new SVGLoader().parse(svgText);
  return data.paths.flatMap((path) => SVGLoader.createShapes(path));
}

function shapesToReliefGeometry(shapes: THREE.Shape[], reliefHeight: number) {
  if (shapes.length === 0) throw new Error("Nenhum contorno encontrado na arte.");
  const geometries = shapes.map((shape) => new THREE.ExtrudeGeometry(shape, { depth: reliefHeight, bevelEnabled: false }));
  const merged = geometries.length === 1 ? geometries[0] : BufferGeometryUtils.mergeGeometries(geometries, false);
  if (!merged) throw new Error("Não foi possível unir os contornos da arte.");
  merged.rotateX(-Math.PI / 2);
  merged.scale(1, 1, -1);
  return merged;
}

async function loadMeshGeometryFromFile(file: File) {
  const url = URL.createObjectURL(file);
  const ext = file.name.split(".").pop()?.toLowerCase();
  const extractGeometry = (object: THREE.Object3D) => {
    const geometries: THREE.BufferGeometry[] = [];
    object.updateMatrixWorld(true);
    object.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      geometries.push(geometry);
    });
    if (geometries.length === 0) throw new Error("Nenhuma malha encontrada no arquivo.");
    return geometries.length === 1 ? geometries[0] : BufferGeometryUtils.mergeGeometries(geometries, false)!;
  };
  try {
    if (ext === "glb" || ext === "gltf") return extractGeometry((await new GLTFLoader().loadAsync(url)).scene);
    if (ext === "obj") return extractGeometry(await new OBJLoader().loadAsync(url));
    throw new Error(`Formato não suportado: .${ext}`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fitGeometryToFootprint(geometry: THREE.BufferGeometry, footprint: TopFootprint, options: CustomizationOptions) {
  const geo = geometry.clone();
  geo.center();
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const sizeX = box.max.x - box.min.x || 1;
  const sizeZ = box.max.z - box.min.z || 1;
  const sizeY = box.max.y - box.min.y || 1;
  const scaleXZ = Math.min((footprint.width * options.scale) / sizeX, (footprint.depth * options.scale) / sizeZ);
  geo.scale(scaleXZ, options.reliefHeight / sizeY || 1, scaleXZ);
  geo.computeBoundingBox();
  const minY = geo.boundingBox!.min.y;
  const overlap = options.mode === "engrave" ? options.reliefHeight * 0.3 : 0;
  geo.translate(0, footprint.surfaceY - minY - overlap, 0);
  return geo;
}

function applyCustomizationToKeycap(keycapGeometry: THREE.BufferGeometry, artGeometry: THREE.BufferGeometry, mode: CustomizationMode) {
  const evaluator = new Evaluator();
  const keycapBrush = new Brush(keycapGeometry);
  const artBrush = new Brush(artGeometry);
  keycapBrush.updateMatrixWorld();
  artBrush.updateMatrixWorld();
  const result = evaluator.evaluate(keycapBrush, artBrush, mode === "emboss" ? ADDITION : SUBTRACTION);
  result.geometry.computeVertexNormals();
  return result.geometry;
}

export async function buildCustomizedKeycap(
  file: File,
  inputType: CustomizationInputType,
  keycapGeometry: THREE.BufferGeometry,
  footprint: TopFootprint,
  options: CustomizationOptions,
): Promise<{ geometry: THREE.BufferGeometry; artPreview: THREE.BufferGeometry }> {
  let rawGeometry: THREE.BufferGeometry;
  if (inputType === "image") {
    const svg = await rasterFileToSVGText(file, { invert: options.invertImage, threshold: options.imageThreshold ?? 128 });
    rawGeometry = shapesToReliefGeometry(svgTextToShapes(svg), options.reliefHeight);
  } else if (inputType === "svg") {
    rawGeometry = shapesToReliefGeometry(svgTextToShapes(await file.text()), options.reliefHeight);
  } else {
    rawGeometry = await loadMeshGeometryFromFile(file);
  }
  const fitted = fitGeometryToFootprint(rawGeometry, footprint, options);
  return { geometry: applyCustomizationToKeycap(keycapGeometry, fitted, options.mode), artPreview: fitted };
}
