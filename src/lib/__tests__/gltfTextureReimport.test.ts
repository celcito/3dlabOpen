import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

describe('GLTF exporter puzzle texture', () => {
  it('exporta um cubo com uma textura e reimporta-o como um GLB, verificando a presença da textura', async () => {
    // Cria uma textura de exemplo (um canvas 2D)
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, 64, 64)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    // Cria a geometria do cubo
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'PuzzlePiece'

    const scene = new THREE.Scene()
    scene.add(mesh)

    const exporter = new GLTFExporter()
    const glb = await exporter.parseAsync(scene, { binary: true }) as ArrayBuffer

    // Reimporta o GLB para verificar se a textura está presente
    const loader = new GLTFLoader()
    const gltfScene = await loader.parseAsync(glb, '')

    // Verifica a presença de uma textura no modelo recarregado
    let hasTexture = false
    gltfScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh
        const materials = Array.isArray(m.material) ? m.material : [m.material]
        for (const mat of materials) {
          if ((mat as any).map) {
            hasTexture = true
            break
          }
        }
      }
    })

    expect(hasTexture).toBe(true)
  })
})
