import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { EstojoBorrachaConfig, GeneratedEstojo, EstojoDimensions } from '../types/estojoBorracha';
import { generateEstojoModel } from '../lib/estojoBorracha/geometry';
import { RotateCcw, RotateCw, Camera, MousePointer } from 'lucide-react';

interface Props {
  config: EstojoBorrachaConfig;
  onDimensionsChange: (dims: EstojoDimensions) => void;
}

const PART_LABELS: Record<string, string> = {
  '1_Caixa': 'Caixa',
  '2_Porta': 'Porta (print-in-place)',
  '3_Plugue': 'Plugue',
  '4_Capa': 'Capa (2ª cor)',
};

export const EstojoBorrachaCanvas: React.FC<Props> = ({ config, onDimensionsChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group>(new THREE.Group());
  const currentModelRef = useRef<GeneratedEstojo | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const hoveredRef = useRef<THREE.Mesh | null>(null);
  const prevMaterialRef = useRef<THREE.Material | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);

  const sphericalRef = useRef({ radius: 320, theta: Math.PI / 4, phi: Math.PI / 3.1 });
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });

  const updateCamera = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    cameraRef.current.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta)
    );
    cameraRef.current.lookAt(0, 0, 0);
  }, []);

  const resetHover = useCallback(() => {
    if (hoveredRef.current && prevMaterialRef.current) {
      hoveredRef.current.material = prevMaterialRef.current;
    }
    hoveredRef.current = null;
    prevMaterialRef.current = null;
    setHoveredLabel(null);
  }, []);

  // Init scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4ee);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2000);
    cameraRef.current = camera;
    updateCamera();

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xe5e7eb, 1.3));
    const dir1 = new THREE.DirectionalLight(0xffffff, 2.0);
    dir1.position.set(80, 120, 90);
    dir1.castShadow = true;
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xfef08a, 1.0);
    dir2.position.set(-70, 50, -60);
    scene.add(dir2);

    const grid = new THREE.GridHelper(400, 40, 0x94a3b8, 0xd1d5db);
    grid.position.y = -0.1;
    scene.add(grid);
    scene.add(modelGroupRef.current);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotate && !isDraggingRef.current) {
        sphericalRef.current.theta += 0.006;
        updateCamera();
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [updateCamera, autoRotate]);

  // Mouse controls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.cursor = 'grab';

    const onDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      container.style.cursor = 'grabbing';
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - prevMouseRef.current.x;
        const dy = e.clientY - prevMouseRef.current.y;
        sphericalRef.current.theta -= dx * 0.008;
        sphericalRef.current.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sphericalRef.current.phi - dy * 0.008));
        updateCamera();
        prevMouseRef.current = { x: e.clientX, y: e.clientY };
      } else {
        if (!cameraRef.current || !currentModelRef.current) return;
        const rect = container.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.current.setFromCamera(new THREE.Vector2(mx, my), cameraRef.current);
        const meshes = allMeshes().filter(Boolean);
        const hits = raycasterRef.current.intersectObjects(meshes, false);
        if (hits.length > 0) {
          container.style.cursor = 'pointer';
          const hit = hits[0].object as THREE.Mesh;
          if (hoveredRef.current !== hit) {
            resetHover();
            hoveredRef.current = hit;
            prevMaterialRef.current = hit.material as THREE.Material;
            hit.material = new THREE.MeshStandardMaterial({
              color: (hit.material as THREE.MeshStandardMaterial).color,
              emissive: new THREE.Color('#f59e0b'),
              emissiveIntensity: 0.35,
              roughness: 0.3,
            });
            setHoveredLabel(PART_LABELS[hit.name] || hit.name);
          }
        } else {
          container.style.cursor = 'grab';
          if (hoveredRef.current) resetHover();
        }
      }
    };
    const onUp = () => {
      isDraggingRef.current = false;
      container.style.cursor = 'grab';
    };
    const onLeave = () => {
      isDraggingRef.current = false;
      resetHover();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(80, Math.min(700, sphericalRef.current.radius + e.deltaY * 0.15));
      updateCamera();
    };

    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('mouseleave', onLeave);
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      container.removeEventListener('mouseleave', onLeave);
      container.removeEventListener('wheel', onWheel);
    };
  }, [updateCamera, resetHover]);

  const allMeshes = (): THREE.Mesh[] => {
    const m = currentModelRef.current;
    if (!m) return [];
    return [m.caixaMesh, m.portaMesh, m.plugueMesh, m.capaMesh].filter(Boolean);
  };

  // Regenerate on config change
  useEffect(() => {
    let cancelled = false;
    const build = async () => {
      try {
        setIsGenerating(true);
        const model = await generateEstojoModel(config);
        if (cancelled) return;
        currentModelRef.current = model;
        onDimensionsChange(model.dimensions);

        resetHover();
        const group = modelGroupRef.current;
        while (group.children.length > 0) {
          const child = group.children[0] as THREE.Object3D;
          group.remove(child);
          child.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.geometry?.dispose();
              if (Array.isArray(obj.material)) obj.material.forEach((mm) => mm.dispose());
              else obj.material?.dispose();
            }
          });
        }

        // The .scad model lives with X=depth, Y=length (long axis), Z=height.
        // Re-orient parts so length runs horizontally (world X), height points up
        // (world Y) and depth goes into the screen (world Z) — a natural box view.
        const natural = new THREE.Matrix4().makeBasis(
          new THREE.Vector3(0, 0, 1), // model X (depth)  -> world Z
          new THREE.Vector3(1, 0, 0), // model Y (length) -> world X
          new THREE.Vector3(0, 1, 0), // model Z (height) -> world Y
        );
        const parts = [model.caixaMesh, model.portaMesh, model.plugueMesh, model.capaMesh];
        for (const mesh of parts) {
          mesh.geometry.applyMatrix4(natural);
        }

        // The capa carries the name on its model -X face. After the natural
        // orientation that face points out of screen (-Z). Swing it -90° about
        // the up (Y) axis so the name faces the camera (+X) and stays upright.
        const nameToFront = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
        model.capaMesh.geometry.applyMatrix4(nameToFront);

        // Layout: the 3 functional parts in a row in the background, the named
        // capa brought to the foreground so it is the focal, clearly readable piece.
        const rowParts = [model.caixaMesh, model.portaMesh, model.plugueMesh];
        let cursorX = -150;
        let rowEndX = cursorX;
        for (const mesh of rowParts) {
          mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox || new THREE.Box3();
          const size = new THREE.Vector3();
          bb.getSize(size);
          const center = new THREE.Vector3();
          bb.getCenter(center);
          mesh.position.set(cursorX - center.x + size.x / 2, -bb.min.y, -center.z - 30);
          cursorX += size.x + 12;
          rowEndX = cursorX;
          group.add(mesh);
        }

        // Capa in front (towards camera, +X/+Z), centered and grounded.
        {
          const capa = model.capaMesh;
          capa.geometry.computeBoundingBox();
          const bb = capa.geometry.boundingBox || new THREE.Box3();
          const center = new THREE.Vector3();
          bb.getCenter(center);
          const rowCenterX = (-150 + rowEndX) / 2;
          capa.position.set(rowCenterX - center.x + 45, -bb.min.y, -center.z + 85);
          group.add(capa);
        }
        setIsGenerating(false);
      } catch (err) {
        console.error('Erro ao gerar estojo:', err);
        setIsGenerating(false);
      }
    };
    const t = setTimeout(build, 40);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    config.text,
    config.fontFamily,
    config.letterHeight,
    config.fontWeightScale,
    config.compInterno,
    config.alturaTotal,
    config.nRipas,
    config.raioCanto,
    config.capaLarg,
    config.textoProf,
    config.caixaColor,
    config.capaColor,
    onDimensionsChange,
    resetHover,
  ]);

  const capture = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    resetHover();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const url = rendererRef.current.domElement.toDataURL('image/png', 1.0);
    const safe = config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'Estojo';
    const link = document.createElement('a');
    link.href = url;
    link.download = `Estojo_${safe}.png`;
    link.click();
  };

  const resetCamera = () => {
    sphericalRef.current = { radius: 320, theta: Math.PI / 4, phi: Math.PI / 3.1 };
    updateCamera();
  };

  return (
    <div className="relative w-full h-full bg-[var(--workbench-viewport)] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full outline-none select-none" />

      {hoveredLabel && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-[var(--workbench-panel)]/95 border border-amber-500/50 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs text-amber-300 pointer-events-none">
          <MousePointer className="w-2.5 h-2.5" />
          <span className="font-semibold">{hoveredLabel}</span>
        </div>
      )}

      {isGenerating && (
        <div className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full bg-[var(--workbench-panel)]/90 border border-amber-500/30 shadow-lg backdrop-blur-md flex items-center gap-2 text-xs text-amber-300">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <span>Calculando malha 3D...</span>
        </div>
      )}

      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--workbench-panel)]/90 border-[var(--surface-container-high)] backdrop-blur-md shadow-xl">
        <button
          type="button"
          onClick={resetCamera}
          className="p-2 rounded-xl text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)] transition-colors"
          title="Restaurar Visão"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-2 rounded-xl transition-colors ${
            autoRotate
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]'
          }`}
          title="Giro Automático"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-[var(--surface-container-high)] mx-1" />
        <button
          type="button"
          onClick={capture}
          className="p-2 rounded-xl text-[var(--on-surface-variant)] hover:text-amber-400 hover:bg-[var(--surface-container-high)] transition-colors"
          title="Capturar Foto (PNG)"
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute bottom-5 right-5 z-20 hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[var(--workbench-panel)]/90 border-[var(--surface-container-high)] backdrop-blur-md shadow-xl text-xs text-[var(--on-surface-variant)]">
        <div className="flex items-center gap-1.5">
          <span>Lápis:</span>
          <span className="font-mono font-bold text-amber-400">{config.compInterno} mm</span>
        </div>
        <div className="w-px h-4 bg-[var(--surface-container-high)]" />
        <div className="flex items-center gap-1.5">
          <span>Curso:</span>
          <span className="font-mono font-bold text-emerald-400">{config.alturaTotal - 24} mm</span>
        </div>
      </div>
    </div>
  );
};
