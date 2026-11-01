import { beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import * as THREE from 'three'
import { generatePuzzleGlmfBlob } from '../../puzzle3mfExporter'
import { subdivideFrontFaces } from '../../puzzleSubdivideFront'

/** O blob é um zip: o XML 3MF só aparece depois de descompactar. */
async function readModelXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return zip.file('3D/3dmodel.model')!.async('string')
}

describe('puzzleGlmfExporter', () => {
  beforeEach(() => {
    // jsdom não decodifica imagens: sem o mock, loadAsync nunca resolveria
    THREE.TextureLoader.prototype.loadAsync = vi.fn(async () => new THREE.Texture()) as unknown as typeof THREE.TextureLoader.prototype.loadAsync
  })

  it('exporta peças de quebra-cabeça como 3MF com textura e filamento', async () => {
    // Imagem de teste (retângulo vermelho 1x1)
    const redPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    // Geometria de peça simples (BoxGeometry com UVs)
    const geometry = new THREE.BoxGeometry(40, 40, 8, 2, 2, 1)
    const geoWithFrontFace = subdivideFrontFaces(geometry, { maxIterations: 1, maxFrontTriangles: 100 })

    const items = [
      {
        geometry: geoWithFrontFace,
        name: 'Peca_1',
        image: redPixel,
      },
    ]

    const blob = await generatePuzzleGlmfBlob({
      title: 'Teste Puzzle 3MF',
      items,
      baseColor: '#D4B996',
      textureDetail: 'medium',
      fallbackPrompt: undefined,
      filaments: [
        { name: 'PLA', color: '#D4B996' },
      ],
    })

    // Verificar que o blob é válido e do tipo 3MF
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/vnd.ms-package.3dmanufacturing-3dmodel+xml')

    // Verificar que contém XML 3MF
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(zip.file('3D/3dmodel.model')).not.toBeNull()
    const model = await readModelXml(blob)
    expect(model).toContain('<?xml')
    expect(model).toContain('<model')

    console.log('3MF exportado com sucesso, tamanho:', model.length, 'caracteres')
  })

  it('exporta peças sem textura (apenas cores de filamento)', async () => {
    const items = [
      {
        geometry: new THREE.BoxGeometry(40, 40, 8, 2, 2, 1),
        name: 'Peca_Sem_Textura',
      },
    ]

    const blob = await generatePuzzleGlmfBlob({
      title: 'Puzzle Sem Textura',
      items,
      baseColor: '#D4B996',
      textureDetail: 'low',
      filaments: [
        { name: 'PLA', color: '#D4B996' },
        { name: 'PLA Preto', color: '#000000' },
      ],
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/vnd.ms-package.3dmanufacturing-3dmodel+xml')

    const model = await readModelXml(blob)
    expect(model).toContain('<model')
    expect(model).toContain('basematerials')
    console.log('3MF sem textura exportado, tamanho:', model.length, 'caracteres')
  })
})
