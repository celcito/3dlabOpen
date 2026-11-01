import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { subdivideFrontFaces } from '../puzzleSubdivideFront'

// Configurações de subdivisão para a textura
const SUBDIVISION_CONFIG = {
  maxIterations: 3,
  maxFrontTriangles: 1500,
} as const

describe('GLTFExporter com textura para Bambu Studio', () => {
  it('exporta um GLB contendo uma textura embutida para a face frontal da peça de quebra-cabeça', async () => {
    // Lê a imagem de exemplo (pode ser um retângulo vermelho simples)
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

    // Cria uma geometria de peça de quebra-cabeça (face frontal + laterais)
    const baseGeo = new THREE.BoxGeometry(40, 40, 10, 2, 2, 1)
    const geoWithFrontFace = subdivideFrontFaces(baseGeo, SUBDIVISION_CONFIG)

    // Aplica a textura como material
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(geoWithFrontFace, material)
    mesh.name = 'PuzzlePiece'

    const scene = new THREE.Scene()
    scene.add(mesh)

    // Exporta como GLB
    const exporter = new GLTFExporter()
    const glbBuffer = await exporter.parseAsync(scene, {
      binary: true,
      trs: false,
      onlyVisible: true,
      includeCustomExtensions: false,
      animations: [],
    }) as ArrayBuffer

    // Reimporta o GLB para verificar se a textura está presente
    const loader = new GLTFLoader()
    const gltfScene = await loader.parseAsync(glbBuffer, '')

    // Verifica se a textura (map) está presente no material de pelo menos um mesh
    let hasTexturedMaterial = false
    gltfScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of mats) {
          if ((mat as any).map) {
            hasTexturedMaterial = true
            break
          }
        }
      }
    })

    expect(hasTexturedMaterial).toBe(true)
  })
})
