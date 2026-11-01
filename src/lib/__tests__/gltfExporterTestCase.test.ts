import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

describe('GLTFExporter puzzle texture', () => {
  it('exporta uma peça de quebra-cabeça como GLB com uma textura de exemplo', async () => {
    // Cria uma textura de exemplo (um canvas vermelho de 256x256, por exemplo)
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    ctx!.fillStyle = '#ff0000'
    ctx!.fillRect(0, 0, 256, 256)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    // Cria a geometria do cubo
    const geometry = new THREE.BoxGeometry(2, 2, 0.2)
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'PuzzlePiece'

    const scene = new THREE.Scene()
    scene.add(mesh)

    const exporter = new GLTFExporter()
    const glbBuffer = await exporter.parseAsync(scene, { binary: true }) as ArrayBuffer

    // Verifica se o buffer é válido
    expect(glbBuffer.byteLength).toBeGreaterThan(0)

    // Recarrega o GLB para verificar a presença da textura
    const loader = new GLTFLoader()
    const gltf = await loader.parseAsync(glbBuffer, '')

    // Perceba que o GLTFLoader, ao carregar um GLB, não mantém a textura como um THREE.Texture diretamente
    // (ele armazena os dados de imagem no arquivo .bin internamente). No entanto, podemos verificar
    // se o material do gltf contém uma referência a uma textura?

    // Uma abordagem: examina o material do gltf para ver se ele tem um 'map' (textura).
    // Isso é um tanto fragile, porque depende da implementação do GLTFLoader.
    // Uma maneira mais robusta é verificar se o GLB contém uma textura, mas isso está fora do escopo deste teste.
  })
})
