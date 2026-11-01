import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { generatePuzzleGlbBlob } from '../puzzleGlbExporter'
import { subdivideFrontFaces } from '../puzzleSubdivideFront'

// Imagem de 1x1 pixel em branco, codificada como data URL PNG (base64)
const WHITE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFElEQVR42mNk+M9QzwAEjHIoQGcLivAATxGVE0EBVCcAgbNPAQAA//8DAJb5pF9W0wMAAAAASUVORK5CYII='

// Cria uma geometria de peça de quebra-cabeça simples com uma face frontal
// (a face frontal é a única que terá textura)
function createTestPieceGeometry(width = 40, height = 40, depth = 6) {
  const position = [
    // Face frontal (topo)
    -width / 2, -height / 2, depth / 2,
    width / 2, -height / 2, depth / 2,
    width / 2, height / 2, depth / 2,
    -width / 2, -height / 2, depth / 2,
    width / 2, height / 2, depth / 2,
    -width / 2, height / 2, depth / 2,
    // Face traseira (base)
    -width / 2, -height / 2, -depth / 2,
    width / 2, -height / 2, -depth / 2,
    width / 2, height / 2, -depth / 2,
    -width / 2, -height / 2, -depth / 2,
    width / 2, height / 2, -depth / 2,
    -width / 2, height / 2, -depth / 2,
    // Faces laterais (direita, esquerda, frente, trás)
    width / 2, -height / 2, depth / 2,
    width / 2, -height / 2, -depth / 2,
    width / 2, height / 2, -depth / 2,
    width / 2, -height / 2, depth / 2,
    width / 2, height / 2, -depth / 2,
    width / 2, height / 2, depth / 2,
    -width / 2, -height / 2, depth / 2,
    -width / 2, -height / 2, -depth / 2,
    -width / 2, height / 2, -depth / 2,
    -width / 2, -height / 2, depth / 2,
    -width / 2, height / 2, -depth / 2,
    -width / 2, height / 2, depth / 2,
    -width / 2, -height / 2, depth / 2, // topo
    width / 2, -height / 2, depth / 2, // topo
    width / 2, height / 2, depth / 2, // topo
    -width / 2, -height / 2, depth / 2, // topo
    width / 2, height / 2, depth / 2, // topo
    -width / 2, height / 2, depth / 2, // topo
  ]

  // Normalizamos as coordenadas
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geo.computeVertexNormals()
  // UVs para a face frontal (coordenadas 0-1)
  const uv = [
    0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, // face traseira (sem textura)
    0, 0, 1, 0, 1, 1, // lateral direita
    0, 0, 1, 0, 1, 1, // lateral esquerda
    0, 0, 1, 0, 1, 1, // topo (sem textura)
    0, 0, 1, 0, 1, 1,
  ]
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return geo
}

describe('GLTFExporter (imagem embutida)', () => {
  it('exporta o GLB binário com uma face frontal com textura', async () => {
    // Para o teste, usamos a imagem de 1x1 pixel em branco
    // e verificamos se o GLTFExporter exporta a textura como parte do GLB.
    const geometry = createTestPieceGeometry()
    const texture = new THREE.TextureLoader().load(WHITE_PIXEL_PNG)
    texture.colorSpace = THREE.SRGBColorSpace

    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }))
    const scene = new THREE.Scene()
    scene.add(mesh)

    const exporter = new GLTFExporter()
    const binaryBuffer = await exporter.parseAsync(scene, { binary: true })

    // O buffer retornado é um ArrayBuffer contendo o GLB completo (com a textura embutida)
    // Podemos verificar se ele tem conteúdo e, em seguida, reimportar com GLTFLoader para validar.
    const glbBuffer = binaryBuffer as ArrayBuffer
    expect(glbBuffer.byteLength).toBeGreaterThan(0)

    const loader = new GLTFLoader()
    const gltf = await loader.parseAsync(glbBuffer, '')
    // O modelo carregado (gltf) tem a textura? O GLTFLoader retorna uma estrutura de cena (THREE.Group)
    // com os nós, materiais e texturas. Vamos percorrer a cena e verificar se a textura está presente.
    let foundTexture = false
    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const m = child as THREE.Mesh
      const material = m.material
      // Verifica se o material tem uma textura mapeada (map)
      if (material && (material as any).map) {
        foundTexture = true
      }
    })
    // A textura está presente? Sim, pois a exportamos com o GLTFExporter.
    // No entanto, no GLB resultante, a textura é embutida no arquivo binário (glb) como um bufferView.
    // O GLTFLoader, ao carregar o GLB, reconstrói a textura (THREE.Texture) e a atribui ao material.
    expect(foundTexture).toBe(true)

    return gltf
  })
})
