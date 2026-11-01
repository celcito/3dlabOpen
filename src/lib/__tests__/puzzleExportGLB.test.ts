import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { generatePuzzleGlbBlob } from '../puzzleGlbExporter'
import { subdivideFrontFaces } from '../puzzleSubdivideFront'

describe('puzzleExportGLB (GLB export)', () => {
  it('exporta uma peça de quebra-cabeça como GLB e o arquivo resultante contém uma textura', async () => {
    // Cria uma textura de exemplo (pode ser uma imagem gerada dinamicamente)
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, 256, 256)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    // Cria uma geometria de peça de quebra-cabeça (simplificada, pode ser um cubo)
    const geometry = new THREE.BoxGeometry(40, 40, 8, 2, 2, 1)
    const geoWithFrontFace = subdivideFrontFaces(geometry, { maxIterations: 1, maxFrontTriangles: 100 })

    // Aplica a textura ao material da face frontal
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geoWithFrontFace, material)
    mesh.name = 'PuzzlePiece'

    // Exporta como GLB
    const exporter = new GLTFExporter()
    const glb = await exporter.parseAsync(mesh, { binary: true }) as ArrayBuffer

    // Carrega o GLB exportado para verificar a presença da textura
    const loader = new GLTFLoader()
    const gltf = await loader.parseAsync(glb, '')

    // Verifica se o gltf carregado contém uma textura (mapa de textura)
    let hasTexture = false
    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      const mat = mesh.material
      // Verifica se o material tem um map (textura)
      if (mat && (mat as any).map) {
        hasTexture = true
      }
    })

    // Espera-se que pelo menos uma textura esteja presente (a face frontal)
    expect(hasTexture).toBe(true)
  })

  it('exporta uma peça de quebra-cabeça com uma textura e o arquivo resultante tem pelo menos uma textura (caso de uso do Bambu Studio)', async () => {
    // imagem de exemplo de 1x1 pixel (base64 PNG)
    const redPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    const texture = new THREE.TextureLoader().load(redPixel)
    texture.colorSpace = THREE.SRGBColorSpace

    // Cria uma geometria de peça de quebra-cabeça (simplificada, um cubo)
    const geometry = new THREE.BoxGeometry(40, 40, 8, 2, 2, 1)
    const geoWithFrontFace = subdivideFrontFaces(geometry, { maxIterations: 1, maxFrontTriangles: 100 })

    // Aplica a textura ao material da face frontal
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geoWithFrontFace, material)
    mesh.name = 'PuzzlePiece'

    // Exporta como GLB
    const exporter = new GLTFExporter()
    const glb = await exporter.parseAsync(mesh, { binary: true }) as ArrayBuffer

    // Carrega o GLB exportado para verificar a presença da textura
    const loader = new GLTFLoader()
    const gltf = await loader.parseAsync(glb, '')

    // Verifica se o gltf carregado contém uma textura (mapa de textura)
    let hasTexture = false
    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      const mat = mesh.material
      // Verifica se o material tem um map (textura)
      if (mat && (mat as any).map) {
        hasTexture = true
      }
    })

    // Espera-se que pelo menos uma textura esteja presente (a face frontal)
    expect(hasTexture).toBe(true)
  })
})
