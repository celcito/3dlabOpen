import { describe, it, expect } from 'vitest'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { parse3mf } from '../split3mf/parsers/3mfParser'
import { parseGlb } from '../split3mf/parsers/glbParser'

async function makeGlbBinary(mesh: THREE.Mesh): Promise<ArrayBuffer> {
  const root = new THREE.Group()
  root.add(mesh)
  const exporter = new GLTFExporter()
  const buffer = await exporter.parseAsync(root, { binary: true })
  if (!(buffer instanceof ArrayBuffer)) throw new Error('GLB export failed')
  return buffer
}

describe('split3mf-glb-debug', () => {
  it('inspeciona o que o parser do split3mf extrai do GLB gerado pelo puzzle', async () => {
    const geom = new THREE.BoxGeometry(2, 2, 1)
    const texture = new THREE.CanvasTexture(document.createElement('canvas'))
    const mat = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geom, mat)
    mesh.name = 'Peca_Teste'

    const glb = await makeGlbBinary(mesh)

    // Parse do gluestack: parse3mf espera bytes, então convertemos para Uint8Array
    try {
      const parsed = parse3mf(new Uint8Array(glb))
      // printa o resultado para inspeção manual
      console.log('=== 3MF Parser result ===')
      console.log(JSON.stringify(parsed, (key, val) =>
        typeof val === 'bigint' ? val.toString() : val, 2))
    } catch (e: any) {
      console.warn('parse3mf falhou (provavelmente vazio ou sem textura):', e && e.message)
    }

    try {
      const glbParsed = parseGlb(glb)
      console.log('=== GLB Parser result ===')
      console.log(JSON.stringify(glbParsed, (key, val) =>
        typeof val === 'bigint' ? val.toString() : val, 2))
    } catch (e: any) {
      console.warn('parseGlb falhou:', e && e.message)
    }

    // Reload com three para validar a estrutura depois do parse do split3mf
    const loader = new GLTFLoader()
    const reloaded = await loader.parseAsync(glb, '')
    const meshes: { name: string; count: number; hasUV?: boolean }[] = []
    reloaded.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const m = child as THREE.Mesh
      const geo = m.geometry
      const idx = geo.index
      const triCount = idx ? idx.count / 3 : geo.attributes.position.count / 3
      meshes.push({
        name: m.name || 'Mesh',
        count: Math.round(triCount),
        hasUV: !!geo.getAttribute('uv'),
      })
    })
    console.log('=== Three.js reloaded mesh summary ===')
    console.log(JSON.stringify(meshes, null, 2))
  })
})
