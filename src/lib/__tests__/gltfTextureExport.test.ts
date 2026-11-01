import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { generatePuzzleGlbBlob } from '../puzzleGlbExporter'
import { subdivideFrontFaces } from '../puzzleSubdivideFront'

describe('GLTF exporter puzzle', () => {
  it('exporta um GLB com textura e reimporta-o (caso de uso real)', async () => {
    // Cria uma textura a partir de um canvas de exemplo (uma imagem de exemplo)
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

    // Cria uma geometria de peça de quebra-cabeça (uma face simples com UVs)
    const geometry = new THREE.BoxGeometry(20, 20, 4, 2, 2, 1)
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'PuzzlePiece'

    const scene = new THREE.Scene()
    scene.add(mesh)

    // Exporta como GLB
    const exporter = new GLTFExporter()
    const glbBlob = await exporter.parseAsync(scene, { binary: true }) as ArrayBuffer

    // Reimporta o GLB recém-exportado
    const loader = new GLTFLoader()
    const gltf = await loader.parseAsync(glbBlob, '')

    // Verifica se a textura está presente no modelo carregado
    let hasTexturedMesh = false
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        if (mat && (mat as any).map) {
          hasTexturedMesh = true
        }
      }
    })

    expect(hasTexturedMesh).toBe(true)
  })
})
