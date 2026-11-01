import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { generateProceduralPuzzleArtwork } from "../server/ProceduralArt";
import { subdivideFrontFaces } from "./puzzleSubdivideFront";

export type GlbTextureDetail = "low" | "medium" | "high" | "ultra";

export interface PuzzleGlbMeshItem {
  geometry: THREE.BufferGeometry;
  name: string;
  /** Arte desta peça (data:, blob: ou http). Sem imagem a frente sai na cor base. */
  image?: string;
}

export interface PuzzleGlbExportOptions {
  title: string;
  items: PuzzleGlbMeshItem[];
  /** Cor das laterais/fundo (e da frente quando a peça não tem imagem). */
  baseColor: string;
  /** Quando as peças não têm imagem individual, buscar uma arte pr procedural a partir deste prompt. */
  fallbackPrompt?: string;
  /** Detalhe da textura: mais iterações = malha mais fina na face frontal = arte mais fiel no Texture-to-Color do Bambu. */
  textureDetail?: GlbTextureDetail;
}

export const TEXTURE_DETAIL_OPTIONS: Map<GlbTextureDetail, Parameters<typeof subdivideFrontFaces>[1]> = new Map([
  ["low",    { maxIterations: 1, maxFrontTriangles: 1500 }],
  ["medium", { maxIterations: 2, maxFrontTriangles: 4000 }],
  ["high",   { maxIterations: 3, maxFrontTriangles: 12000 }],
  ["ultra",  { maxIterations: 4, maxFrontTriangles: 30000 }],
]);

/**
 * Exporta as peças como .GLB binário com a imagem embutida.
 *
 * O 3MF padrão só transporta a arte como textura UV (extensão de materiais:
 * `m:texture2d` + `m:texture2dgroup`) e o Bambu Studio não renderiza mapeamento
 * de textura — ele ignora a imagem e mostra apenas a mesh (documentado em
 * "Standard 3MF File Color Parsing"). Os formatos que ele aceita com textura são
 * OBJ, glTF, GLB e FBX: ao importar um deles abre a janela
 * "Texture to Color Painting" (Bambu Studio 2.7.1+), que converte a imagem em
 * pintura de cores imprimível.
 */
export async function generatePuzzleGlbBlob(options: PuzzleGlbExportOptions): Promise<Blob> {
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
      console.warn(`GLB export: não foi possível carregar a arte de ${url.slice(0, 80)}`);
      return null;
    }
  };

  const root = new THREE.Group();
  root.name = options.title;

  const subdivideOpts = TEXTURE_DETAIL_OPTIONS.get(options.textureDetail ?? "medium")!;

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

    const front = texture
      ? new THREE.MeshBasicMaterial({ map: texture, name: imageLabel })
      : new THREE.MeshBasicMaterial({ color: options.baseColor, name: "base_color" });
    const side = new THREE.MeshBasicMaterial({ color: options.baseColor, name: "base_color" });

    // Após subdivisão a geometria não mantém grupos; usa material único no plano
    // quando não há front/back distinguível, duas materiais quando o grupo 0/1 subsiste.
    const material =
      geometry.groups.length > 0 && geometry.groups[0]?.material === 0
        ? [front, side]
        : front;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = item.name;
    root.add(mesh);
  }

  const exporter = new GLTFExporter();
  const buffer = await exporter.parseAsync(root, { binary: true });
  if (!(buffer instanceof ArrayBuffer)) throw new Error("Falha ao gerar o GLB binário");
  return new Blob([buffer], { type: "model/gltf-binary" });
}
