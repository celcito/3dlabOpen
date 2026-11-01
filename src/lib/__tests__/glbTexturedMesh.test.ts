import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { subdivideFrontFaces } from '../puzzleSubdivideFront'

describe('GLTFExporter (quebra-cabeça)', () => {
  it('exports a textured mesh and verifies the texture is embedded in the GLB', async () => {
    // Criação de uma textura de teste (imagem simples)
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

    // Cria uma geometria de peça (exemplo simples: um cubo)
    const geometry = new THREE.BoxGeometry(10, 10, 2, 4, 4, 1)
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }))
    mesh.name = 'PuzzlePiece'

    // Subdivide a face frontal (opcional)
    const subdivided = subdivideFrontFaces(geometry, { maxIterations: 1, maxFrontTriangles: 500 })

    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(subdivided, new THREE.MeshBasicMaterial({ map: texture })))

    // Exporta como GLB
    const exporter = new GLTFExporter()
    const binaryData = await exporter.parseAsync(scene, { binary: true }) as ArrayBuffer
    const glb = new Blob([binaryData], { type: 'model/gltf-binary' })

    // Carrega novamente para verificar a presença do material/textura
    const loader = new GLTFLoader()
    const gltf = await loader.parseAsync(glb, '')

    let hasTexturedMaterial = false
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        const m = child as THREE.Mesh
        const mat = Array.isArray(m.material) ? m.material[0] : m.material
        if (mat && (mat as any).map) {
          hasTexturedMaterial = true
        }
      }
    })

    expect(hasTexturedMaterial).toBe(true)
  })
})
