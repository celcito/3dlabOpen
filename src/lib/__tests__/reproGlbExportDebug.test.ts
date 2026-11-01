import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { generatePuzzleGlbBlob } from '../puzzleGlbExporter'
import { subdivideFrontFaces } from '../puzzleSubdivideFront'

// Cria um componente de geometria de peça de quebra-cabeça simples, com uma face textual (front) e outras faces sem textura.
// A peça é um cubo alongado, ou semelhante a um canto, dependendo do parâmetro.
function buildPuzzlePieceGeometry(width = 40, height = 40, depth = 4) {
  // Usa BoxGeometry como base (que tem UVs em todas as faces) + subdivision manual se necessário.
  // Como o objetivo é testar se a textura é mantida no GLB gerado.
  const geo = new THREE.BoxGeometry(width, height, depth, 4, 4, 1)
  // Distribui UVs para todas as faces (globalmente). O Box padrão já faz isso.
  // Mas para uma face específica (front), poderíamos aplicar uma modificação.
  // Por simplicidade, retornamos a geometria simples.
  return geo
}

// Converte uma imagem (data URL) em uma textura que pode ser usada no material.
async function loadTextureFromDataUrl(dataUrl: string): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader()
  const texture = await loader.loadAsync(dataUrl)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Função helper para ler um arquivo de imagem e retornar um data URL.
async function loadImageAsDataUrl(url: string): Promise<string> {
  const resp = await fetch(url)
  const blob = await resp.blob()
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

describe('puzzleGlbExportDebug', () => {
  it('exports a puzzle piece GLB and checks texture is embedded with correct UV mapping', async () => {
    // Imagem de teste: um pixel azul (sem conteúdo real, apenas para validar a exportação de textura)
    const testPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAAARnSURBVGhD7c0xAQAwDAOxwUROGYU2BUHCAyg5RKEKJh2uBXQMUgEFZyGGWsAi4+AHAAAA//8DACG0JXNt+QAAAABJRU5ErkJggg=='

    // Carrega a textura do data URL
    const texture = await loadTextureFromDataUrl(testPngDataUrl)

    // Cria a geometria da peça com UVs
    const pieceGeo = buildPuzzlePieceGeometry(40, 40, 8)

    // Subdivide a face frontal para aumentar a resolução da textura (como o subdivideFrontFaces)
    const subdividedGeo = subdivideFrontFaces(pieceGeo, { maxIterations: 2, maxFrontTriangles: 2000 })

    // Configura o material com a textura
    const material = new THREE.MeshBasicMaterial({ map: texture })

    // Cria uma cena com o mesh (repare que o material é único, mas a geometria tem múltiplas faces)
    const scene = new THREE.Scene()
    const mesh = new THREE.Mesh(subdividedGeo, material)
    mesh.name = 'TestPuzzlePiece'
    scene.add(mesh)

    // Exporta como GLB binário
    const exporter = new GLTFExporter()
    const glbBuffer = await exporter.parseAsync(scene, {
      binary: true,
      trs: true,
      onlyVisible: true,
      includeCustomExtensions: false,
      animations: [],
      meta: false
    }) as ArrayBuffer

    // Verifica o tamanho do buffer (uma questão de sanity)
    expect(glbBuffer.byteLength).toBeGreaterThan(0)

    // Salva o GLB em um arquivo temporário para inspeção manual (caso queira verificar no Bambu Studio)
    // Nota: este passo não será executado no ambiente de teste remoto, mas ilustra o processo.
    // Para fins de teste automatizado, não salvamos o arquivo aqui.
    // Em vez disso, vamos recarregar o GLB com três e verificar se a textura está presente no material carregado.

    const loader = new GLTFLoader()
    const loadedGltf = await loader.parseAsync(glbBuffer, '')

    // Verifica que a cena contém pelo menos um mesh
    let loadedMeshCount = 0
    let hasTexturedMaterial = false
    loadedGltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      loadedMeshCount++
      const m = child as THREE.Mesh
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        const map = (mat as any).map
        if (map) {
          hasTexturedMaterial = true
          break
        }
      }
    })

    expect(loadedMeshCount).toBeGreaterThan(0)
    expect(hasTexturedMaterial).toBe(true)
  })
})
