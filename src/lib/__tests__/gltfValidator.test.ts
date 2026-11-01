import { describe, it, expect, beforeAll } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { generatePuzzleGlbBlob } from '../puzzleGlbExporter'
import { subdivideFrontFaces } from '../puzzleSubdivideFront'

describe('GLTF export validation (puzzle)', () => {
  let exportedScene: THREE.Scene

  beforeAll(async () => {
    // Gera um exemplo de peça com geometria e texture UVs
    const geometry = new THREE.PlaneGeometry(40, 40, 2, 2) // 2x2 subdivisions
    geometry.rotateX(-Math.PI / 2) // Pendura a face na horizontal
    geometry.translate(0, 0, 5) // Posiciona a frente acima do eixo XY

    // Aplica subdividida para aumentar a densidade de triângulos
    const subdivided = subdivideFrontFaces(geometry, { maxIterations: 1, maxFrontTriangles: 1000 })

    const textureLoader = new THREE.TextureLoader()
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    ctx?.fillStyle = '#ff0000'
    ctx?.fillRect(0, 0, 128, 128)

    // Lembre-se de converter o canvas em uma data URL ou Blob URL
    const blob = new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
    const imgBlobUrl = URL.createObjectURL((await blob) as Blob)

    const texture = await textureLoader.loadAsync(imgBlobUrl)
    texture.colorSpace = THREE.SRGBColorSpace

    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(subdivided, material)
    mesh.name = 'PuzzlePiece'

    const scene = new THREE.Scene()
    scene.add(mesh)

    exportedScene = scene
  })

  it('exporta a cena como GLB e o parser verifica que os UVs estão presentes', async () => {
    const exporter = new GLTFExporter()
    const glb = await exporter.parseAsync(exportedScene, { binary: true }) as ArrayBuffer

    const loader = new GLTFLoader()
    const loadedScene = await loader.parseAsync(glb, '')

    // Verifica a presença de UVs em todas as geometrias
    let hasUvs = false
    let meshCount = 0

    loadedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      meshCount++
      const geo = (child as THREE.Mesh).geometry
      if (geo.getAttribute('uv')) {
        hasUvs = true
      }
    })

    expect(meshCount).toBeGreaterThan(0)
    expect(hasUvs).toBe(true)
  })

  it('exporta o GLB e o parser verifica a presença de uma textura', async () => {
    const exporter = new GLTFExporter()
    const glb = await exporter.parseAsync(exportedScene, { binary: true }) as ArrayBuffer

    const loader = new GLTFLoader()
    const loadedScene = await loader.parseAsync(glb, '')

    let hasTexture = false

    loadedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const materials = Array.isArray((child as THREE.Mesh).material)
        ? (child as THREE.Mesh).material
        : [(child as THREE.Mesh).material]
      for (const material of materials) {
        if ((material as any).map) {
          hasTexture = true
          break
        }
      }
    })

    expect(hasTexture).toBe(true)
  })
})
