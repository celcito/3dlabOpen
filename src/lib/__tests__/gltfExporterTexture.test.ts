import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { subdivideFrontFaces } from '../puzzleSubdivideFront'

describe('GLTFExporter Texture', () => {
  it('exporta um GLB com uma textura de exemplo e o parser do Bambu reconhece a textura', async () => {
    // Criação de uma imagem de exemplo (um canvas 2D simples)
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, 64, 64)
    }

    // Cria uma textura com base no canvas
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    // Cria uma geometria de peça de quebra-cabeça
    const geometry = new THREE.BoxGeometry(10, 10, 2, 4, 4, 1)
    const geoWithFrontFace = subdivideFrontFaces(geometry, { maxIterations: 2, maxFrontTriangles: 100 })

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
      const m = child as THREE.Mesh
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        if ((mat as any).map) {
          hasTexture = true
          break
        }
      }
    })

    // Espera-se que pelo menos uma textura esteja presente (a face frontal)
    expect(hasTexture).toBe(true)
  })
})
