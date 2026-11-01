import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { generatePuzzleGlbBlob } from './puzzleGlbExporter'
import { subdivideFrontFaces } from './puzzleSubdivideFront'

const whitePngUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAFUlEQVR42mNgmAfAAAFAACfAGcM2KwAAAABJRU5ErkJggg=='

const baseMeshGeo = (width=40, height=40, depth=8): THREE.BufferGeometry => {
  const geo = new THREE.PlaneGeometry(width, height, 2, 2)
  geo.rotateX(-Math.PI/2)
  geo.translate(0, 0, depth/2)
  return geo
}

const runTest = async () => {
  // 1) cria uma peça simples para o teste
  const itemGeo = baseMeshGeo(40, 40, 8)

  const blob = await generatePuzzleGlbBlob({
    title: 'teste_GLB_viz',
    items: [
      { geometry: itemGeo, name: 'peca_1', image: whitePngUrl }
    ],
    baseColor: '#000000',
    textureDetail: 'low',
    fallbackPrompt: undefined
  })

  // 2) carrega o GLB via Three.js (mesmo parser)
  const loader = new GLTFLoader()
  const gltf = await loader.parseAsync(await blob.arrayBuffer(), '')

  // 3) percorre a cena e coleta índices de material (mesh nodes)
  const meshes: { name: string; matIdx?: number }[] = []
  gltf.scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    meshes.push({
      name: mesh.name ?? 'unknown',
      matIdx: mesh.material ? (Array.isArray(mesh.material) ? mesh.material[0]?.index : mesh.material.index) : undefined
    })
  })

  return { meshes, gltf }
}

runTest().then(({ meshes, gltf }) => {
  console.log('PECA MESHES:', meshes.map(m => `${m.name} @ idx ${m.matIdx}`).join("\n"))
}).catch(e => {
  console.error('ERRO no teste:', e && e.message || e)
})
