import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

describe('GLTFExporter básico para Bambu Studio', () => {
  it('exporta um cubo simples com uma textura e importa-no como GLB', async () => {
    // Criamos um canvas com uma imagem simples (textura)
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, 64, 64)
    }

    // Carregamos a textura a partir do canvas
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    // Criamos a geometria do cubo
    const geometry = new THREE.BoxGeometry(2, 2, 2)
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geometry, material)
    const scene = new THREE.Scene()
    scene.add(mesh)

    // Exportamos como GLB
    const exporter = new GLTFExporter()
    const glbBuffer = await exporter.parseAsync(scene, { binary: true }) as ArrayBuffer

    // Agora, testamos se o buffer contém o GLB esperado
    // Podemos comparar com um array de bytes previamente gerado.
    // Por simplicidade, apenas verificamos que o tamanho do buffer é maior que zero.
    expect(glbBuffer.byteLength).toBeGreaterThan(0)

    // Também podemos verificar a presença do material com a textura ao recarregar o GLB
    const loader = new GLTFLoader()
    const gltf = await loader.parseAsync(glbBuffer, '')

    // Para verificar se a textura está presente no arquivo GLB exportado,
    // examinamos os materiais do glTF carregado.
    let hasTexturedMaterial = false
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        const mesh = child as THREE.Mesh
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        if (mat) {
          // Verificação de presença de mapa de textura
          // No GLTFLoader, o map é um THREE.Texture
          // Quando o material é carregado a partir de um arquivo GLB, o map pode estar presente.
          // Tipicamente, após o parseAsync, o map está disponível.
          if ((mat as any).map) {
            hasTexturedMaterial = true
          }
        }
      }
    })

    // Espera-se que pelo menos um material com textura esteja presente
    expect(hasTexturedMaterial).toBe(true)
  })
})
