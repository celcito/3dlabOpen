import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

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
}

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

  for (const item of options.items) {
    const geometry = item.geometry.clone();
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();

    const hasUV = !!geometry.getAttribute("uv");
    const texture = hasUV && item.image ? await loadTexture(item.image) : null;
    const front = texture
      ? new THREE.MeshBasicMaterial({ map: texture })
      : new THREE.MeshBasicMaterial({ color: options.baseColor });
    const side = new THREE.MeshBasicMaterial({ color: options.baseColor });

    // `preparePieceGeometryWithMaterials` define o grupo 0 = face frontal (arte)
    // e o grupo 1 = laterais/fundo; sem grupos a peça foi gerada toda plana.
    const material = geometry.groups.length > 0 ? [front, side] : front;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = item.name;
    root.add(mesh);
  }

  const exporter = new GLTFExporter();
  const buffer = await exporter.parseAsync(root, { binary: true });
  if (!(buffer instanceof ArrayBuffer)) throw new Error("Falha ao gerar o GLB binário");
  return new Blob([buffer], { type: "model/gltf-binary" });
}
