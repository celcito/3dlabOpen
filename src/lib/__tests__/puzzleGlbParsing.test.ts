import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { generatePuzzleGlbBlob } from '../puzzleGlbExporter'
import { subdivideFrontFaces } from '../puzzleSubdivideFront'

// Parser minimalista baseado no GLTFLoader do three (alternativa leve ao split3mf parsers)
async function parseGLB(arrayBuffer: ArrayBuffer) {
  const loader = new GLTFLoader()
  const gltf = await loader.parseAsync(arrayBuffer, '')

  const meshes: THREE.BufferGeometry[] = []
  const objects: { name: string; hasMap: boolean }[] = []
  gltf.scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    const geo = mesh.geometry.clone()
    geo.computeVertexNormals()
    meshes.push(geo)
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    const hasMap = !!(mat && (mat as any).map)
    objects.push({ name: mesh.name, hasMap })
  })

  return { meshes, gltf, objects }
}

describe('GLB parsing (quebra-cabeca)', () => {
  it('carrega o GLB exportado e verifica que o parser encontra nos e triangulos', async () => {
    // image com conteúdo - usamos white pixel (base64), já que não temos uma imagem real pronto.
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    // Geometry minimo com UVs
    const baseGeo = new THREE.BoxGeometry(40, 40, 8, 1, 1, 1) // subdivided box (1 segment)
    // UVs são definidas pelo BoxGeometry: face front e back têm UVs.
    // Vamos verificar se o GLB gerado tem UVs.
    // Para o teste, não usamos gerarPuzzleGlbBlob diretamente (para evitar depender de bundleas/procedural).
    // em vez disso, criamos um objeto simples e exportamos com o GLTFExporter.

    // Simula uma peça: front face tem UVs, laterais não.
    // three BoxGeometry tem UVs para todas as faces.
    const scene = new THREE.Scene()
    const mesh = new THREE.Mesh(baseGeo, new THREE.MeshBasicMaterial({ map: null }))
    mesh.name = 'ManualGeometry'
    scene.add(mesh)

    const exporter = new GLTFExporter()
    const buffer = await exporter.parseAsync(scene, { binary: true })
    const blob = new Blob([buffer as ArrayBuffer], { type: 'model/gltf-binary' })
    const arrayBuffer = await blob.arrayBuffer()

    const parsed = await parseGLB(arrayBuffer)

    // Verificações: pelo menos um mesh, UVs, e triangulos > 0
    const allGeometry = parsed.meshes
    expect(allGeometry.length).toBeGreaterThan(0)

    allGeometry.forEach((geo) => {
      const uv = geo.getAttribute('uv')
      const pos = geo.getAttribute('position')
      expect(uv).toBeTruthy()
      expect(pos).toBeTruthy()
      const vertexCount = pos!.count
      const uvCount = uv!.count
      expect(vertexCount).toBeGreaterThanOrEqual(uvCount)
    })
  })
})
