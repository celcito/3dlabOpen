import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

describe('GLTFExporter texture embedding', () => {
  it('exporta um GLB binário com a textura do material (imagem embutida no arquivo .glb)', async () => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 4
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 4, 4)

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    const url = URL.createObjectURL(await new Promise<Blob>((res) => res(blob!)))

    const texture = new THREE.TextureLoader().load(url)
    texture.colorSpace = THREE.SRGBColorSpace

    const geom = new THREE.BoxGeometry(1, 1, 0.2, 4, 4, 1)
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ map: texture }))
    const scene = new THREE.Scene()
    scene.add(mesh)

    const exporter = new GLTFExporter()
    const buffer = await exporter.parseAsync(scene, { binary: true, includeCustomExtensions: false, animations: [] })
    const arrayBuffer = buffer as ArrayBuffer

    // Nesse ponto, o arrayBuffer contém um GLB completo, e a textura está embutida (como uma imagem binária no .glb).
    // Agora, para verificar que a textura está presentes: recarregamos o GLB com GLTFLoader.
    const loader = new GLTFLoader()
    const gltf = await loader.parseAsync(arrayBuffer, '')

    // Sanctum do gltf: verificar que o arquivo de imagem está presente?
    // No glTF, a textura é representada como um Sampler + Image. O Image pode ter o uri (data URI) ou o bufferView.
    // Para um GLB, a imagem está presente como um bufferView no .bin (a parte binária do GLB).
    // A presença de uma textura é verificada pela existência de um sampler e image.
    
    expect(gltf).toBeTruthy()

    // Verificando as texturas: cada material tem um map? Se sim, o materialOverrides? Mas o material é exportado?
    // O GLTFExporter exporta o material com o map. Podemos verificar o material do gltf.
    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const m = child as THREE.Mesh
      if (m.material) {
        const mat = Array.isArray(m.material) ? m.material[0] : m.material
        const hasMap = (mat as any).map
        // Se o material tiver um map (textura), ele está presente no glTF exportado.
        // Mas na prática, o map é uma referência ao texture, e a textura está embutida no GLB (no .bin ou como URI).
        // Portanto, a presença do material no glTF com map é o indicativo de que a textura está no arquivo exportado.
        expect(hasMap).toBe(true)
      }
    })

    // Teste a lógica: a imagem foi redimensionada para o formato de 4x4 pixels, e está embutida no arquivo GLB.
    // Com o Bambu Studio, ao importar um GLB com textura, ele reconhece a textura? Isso depende da implementação do Bambu.
    // Se o Bambu Studio não suportar texturas embutidas diretamente, precisamos exportar como .glb com uma textura externa?
    // A documentação do Bambu Studio sugere que ele suporta texturas em .glb através de .jpg/.png incorporados?
    // Não tenho certeza, então esse teste é apenas um boilerplate para verificar se a textura está presente.
  })
})
