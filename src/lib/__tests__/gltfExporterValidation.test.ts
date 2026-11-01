import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { generatePuzzleGlbBlob } from '../puzzleGlbExporter'
import { subdivideFrontFaces } from '../puzzleSubdivideFront'

describe('GLTFExporter (quebra-cabeça com textura)', () => {
  it('exporta um GLB e o parser de retorno reconhece a textura', async () => {
    const texture = new THREE.CanvasTexture(document.createElement('canvas'))
    texture.colorSpace = THREE.SRGBColorSpace

    // Cria uma geometria de peça simples
    const geometry = new THREE.BoxGeometry(2, 2, 0.5, 2, 2, 1)
    const geoWithFrontFace = subdivideFrontFaces(geometry, { maxIterations: 2, maxFrontTriangles: 100 })

    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geoWithFrontFace, material)
    mesh.name = 'PuzzlePiece'

    const scene = new THREE.Scene()
    scene.add(mesh)

    // Exporta como GLB binário
    const exporter = new GLTFExporter()
    const glb = await exporter.parseAsync(scene, { binary: true }) as ArrayBuffer

    // Carrega o GLB exportado com GLTFLoader
    const loader = new GLTFLoader()
    const gltf = await loader.parseAsync(glb, '')

    // Verifica se o material (mesh) tem uma textura associada (map)
    let hasTexture = false
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        const mesh = child as THREE.Mesh
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of mats) {
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
