import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { generateProceduralPuzzleArtwork } from "../server/ProceduralArt";
import { subdivideFrontFaces } from "./puzzleSubdivideFront";
import { generate3MfBlob, ThreeMfExportOptions, ThreeMfMeshItem, FilamentDefinition } from "./threeMfExporter";

export type GlmfTextureDetail = "low" | "medium" | "high" | "ultra";

export interface PuzzleGlmfMeshItem {
  geometry: THREE.BufferGeometry;
  name: string;
  /** Arte desta peça (data:, blob: ou http). Sem imagem a frente sai na cor base. */
  image?: string;
}

export interface PuzzleGlmfExportOptions {
  title: string;
  items: PuzzleGlmfMeshItem[];
  /** Cor das laterais/fundo (e da frente quando a peça não tem imagem). */
  baseColor: string;
  /** Quando as peças não têm imagem individual, buscar uma arte pr procedural a partir deste prompt. */
  fallbackPrompt?: string;
  /** Detalhe da textura: mais iterações = malha mais fina na face frontal = arte mais fiel no Texture-to-Color do Bambu. */
  textureDetail?: GlmfTextureDetail;
  /** Configuração de filamentos para impressão 3MF */
  filaments?: FilamentDefinition[];
}

/** Mapeamento de detalhe de textura para opções de subdivisão */
const TEXTURE_DETAIL_OPTIONS: Map<GlmfTextureDetail, Parameters<typeof subdivideFrontFaces>[1]> = new Map([
  ["low", { maxIterations: 1, maxFrontTriangles: 1500 }],
  ["medium", { maxIterations: 2, maxFrontTriangles: 4000 }],
  ["high", { maxIterations: 3, maxFrontTriangles: 12000 }],
  ["ultra", { maxIterations: 4, maxFrontTriangles: 30000 }],
]);

/**
 * Exporta as peças como .3MF binário com a imagem embutida.
 * Formato compatível com Bambu Studio, OrcaSlicer, PrusaSlicer.
 * O 3MF transporta a arte como textura UV (m:texture2d + m:texture2dgroup)
 * e suporta múltiplos filamentos com cores diferentes por peça.
 */
export async function generatePuzzleGlmfBlob(options: PuzzleGlmfExportOptions): Promise<Blob> {
  const textures = new Map<string, THREE.Texture>();

  const loadTexture = async (url: string): Promise<THREE.Texture | null> => {
    const cached = textures.get(url);
    if (cached) return cached;
    try {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.set(url, texture);
      return texture;
    } catch {
      console.warn(`glTF export: não foi possível carregar a arte de ${url.slice(0, 80)}`);
      return null;
    }
  };

  const root = new THREE.Group();
  root.name = options.title;

  const subdivideOpts = TEXTURE_DETAIL_OPTIONS.get(options.textureDetail ?? "medium")!;

  // Coletar geometries e texturas para o exporter 3MF
  const glmfItems: ThreeMfMeshItem[] = [];

  for (const item of options.items) {
    let geometry = item.geometry.clone();
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();

    const hasUV = !!geometry.getAttribute("uv");
    let texture = hasUV && item.image ? await loadTexture(item.image) : null;

    let imageLabel: string;
    if (!texture && options.fallbackPrompt) {
      const art = generateProceduralPuzzleArtwork(options.fallbackPrompt, "Desenho infantil");
      texture = await loadTexture(art);
      imageLabel = `procedural_${options.fallbackPrompt.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, " ").trim()}`;
    } else {
      imageLabel = item.image ? `puzzle_artwork` : "base_color";
    }

    // Subdivide only the front (textured shell) so Bambu's Texture-to-Color
    // per-triangle color sampling resolves the artwork instead of a coarse blob.
    if (hasUV && (texture || options.fallbackPrompt)) {
      geometry = subdivideFrontFaces(geometry, subdivideOpts);
    } else {
      geometry.computeVertexNormals();
    }

    // Determinar índice de filamento (usar primeiro ou o informado)
    const filIdx = options.filaments && options.filaments.length > 0 ? 0 : undefined;

    glmfItems.push({
      geometry,
      name: item.name,
      filamentIndex: filIdx,
      textureImage: item.image,
      textureName: item.image ? `puzzle_artwork_${item.name}` : undefined,
      textureFormat: item.image ? "png" : undefined,
    });

    // Criar material para o grupo THREE.js (necessário para GLTFExporter opcional)
    const front = texture
      ? new THREE.MeshBasicMaterial({ map: texture, name: imageLabel })
      : new THREE.MeshBasicMaterial({ color: options.baseColor, name: "base_color" });
    const side = new THREE.MeshBasicMaterial({ color: options.baseColor, name: "base_color" });

    // Após subdivisão a geometria não mantém grupos; usa material único no plano
    // quando não há front/back distinguível, dois materiais quando o grupo 0/1 subsiste.
    const material =
      geometry.groups.length > 0 && geometry.groups[0]?.material === 0
        ? [front, side]
        : front;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = item.name;
    root.add(mesh);
  }

  // Agora usar o gerador 3MF real
  const exportOptions: ThreeMfExportOptions = {
    title: options.title,
    filaments: options.filaments || [{ name: "Filamento 1", color: "#D4B996" }],
    items: glmfItems,
    unit: "millimeter",
  };

  const blob = await generate3MfBlob(exportOptions);
  return blob;
}