import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { PencilTopperConfig, Model3DDimensions } from '../types/pencilTopper';
import { generatePencilTopperModel, type GeneratedPencilTopper } from '../lib/pencilTopper/geometry';
import {
  RotateCcw,
  RotateCw,
  Camera,
  Maximize2,
  Sliders,
  Sparkles,
  Download,
  Eye,
  Layers,
  MousePointer,
  CheckCircle2
} from 'lucide-react';

interface PencilCanvasProps {
  config: PencilTopperConfig;
  onDimensionsChange: (dims: Model3DDimensions) => void;
}

export const PencilCanvas: React.FC<PencilCanvasProps> = ({
  config,
  onDimensionsChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group>(new THREE.Group());
  const currentModelRef = useRef<GeneratedPencilTopper | null>(null);

  // Referências para hover e raycasting
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null);
  const originalMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());

  // Estado para feedback na UI
  const [isHoveringObject, setIsHoveringObject] = useState<boolean>(false);
  const [hoveredPartName, setHoveredPartName] = useState<string | null>(null);

  // Estados de controle da câmera
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [captureToast, setCaptureToast] = useState<string | null>(null);

  // Esfera de órbita da câmera
  const sphericalRef = useRef({
    radius: 120,
    theta: Math.PI / 4,
    phi: Math.PI / 3.2,
  });

  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  // Atualiza posição da câmera
  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(0, 0, 0);
  }, []);

  // Reseta estado de hover
  const resetHoverState = useCallback(() => {
    if (!hoveredMeshRef.current && originalMaterialsRef.current.size === 0) return;

    originalMaterialsRef.current.forEach((originalMat, mesh) => {
      mesh.material = originalMat;
      const wire = mesh.getObjectByName('__wireframe_overlay');
      if (wire) wire.visible = false;
    });

    originalMaterialsRef.current.clear();
    hoveredMeshRef.current = null;
    setIsHoveringObject(false);
    setHoveredPartName(null);
  }, []);

  // Aplica highlight de wireframe translúcido
  const applyHoverHighlight = useCallback((hitMesh: THREE.Mesh) => {
    if (hoveredMeshRef.current === hitMesh) return;
    resetHoverState();

    hoveredMeshRef.current = hitMesh;
    setIsHoveringObject(true);

    const partDisplayName =
      hitMesh.name === '1_Corpo_da_Base'
        ? 'Corpo da Base & Encaixe'
        : 'Letras em Relevo';
    setHoveredPartName(partDisplayName);

    if (currentModelRef.current) {
      const allMeshes = [
        currentModelRef.current.baseMesh,
        currentModelRef.current.reliefMesh,
      ].filter(Boolean);

      allMeshes.forEach((mesh) => {
        if (!originalMaterialsRef.current.has(mesh)) {
          originalMaterialsRef.current.set(mesh, mesh.material);
        }

        const isDirectHit = mesh === hitMesh;
        const currentMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;

        const translucentMat = new THREE.MeshStandardMaterial({
          color: currentMat.color,
          roughness: 0.2,
          metalness: 0.1,
          transparent: true,
          opacity: isDirectHit ? 0.78 : 0.45,
          emissive: isDirectHit ? new THREE.Color('#f59e0b') : new THREE.Color(0x000000),
          emissiveIntensity: isDirectHit ? 0.25 : 0.0,
          depthWrite: true,
        });

        mesh.material = translucentMat;

        const wire = mesh.getObjectByName('__wireframe_overlay') as THREE.Mesh;
        if (wire) {
          wire.visible = true;
          const wireMat = wire.material as THREE.MeshBasicMaterial;
          wireMat.opacity = isDirectHit ? 0.9 : 0.35;
          wireMat.color = new THREE.Color(isDirectHit ? '#fbbf24' : '#64748b');
        }
      });
    }
  }, [resetHoverState]);

  // Cria sobreposição de wireframe
  const attachWireframeOverlay = (mesh: THREE.Mesh) => {
    if (!mesh || !mesh.geometry) return;
    const wireGeom = new THREE.WireframeGeometry(mesh.geometry);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.0,
      depthTest: true,
    });
    const wire = new THREE.LineSegments(wireGeom, wireMat);
    wire.name = '__wireframe_overlay';
    wire.visible = false;
    mesh.add(wire);
  };

  // Inicialização do Three.js
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4ee);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Iluminação PBR de Estúdio
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe5e7eb, 1.3);
    hemiLight.position.set(0, 80, 0);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(60, 90, 70);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.bias = -0.0001;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xfef08a, 1.2);
    dirLight2.position.set(-60, 40, -50);
    scene.add(dirLight2);

    // Grade / Chapa de Impressão 3D estilizada
    const grid = new THREE.GridHelper(160, 32, 0x94a3b8, 0xd1d5db);
    grid.position.y = -0.1;
    scene.add(grid);

    // Adiciona grupo do modelo
    scene.add(modelGroupRef.current);

    // Loop de renderização
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (autoRotate && !isDraggingRef.current) {
        sphericalRef.current.theta += 0.006;
        updateCameraPosition();
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [updateCameraPosition, autoRotate]);

  // Controles de mouse com Raycasting
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.style.cursor = 'grab';

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      container.style.cursor = 'grabbing';
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const deltaX = e.clientX - previousMousePositionRef.current.x;
        const deltaY = e.clientY - previousMousePositionRef.current.y;

        sphericalRef.current.theta -= deltaX * 0.008;
        sphericalRef.current.phi = Math.max(
          0.05,
          Math.min(Math.PI - 0.05, sphericalRef.current.phi - deltaY * 0.008)
        );

        updateCameraPosition();
        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
      } else {
        if (!cameraRef.current || !currentModelRef.current) return;
        const rect = container.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
        const targetMeshes = [
          currentModelRef.current.baseMesh,
          currentModelRef.current.reliefMesh,
        ].filter(Boolean);

        const intersects = raycasterRef.current.intersectObjects(targetMeshes, false);

        if (intersects.length > 0) {
          container.style.cursor = 'pointer';
          const hitMesh = intersects[0].object as THREE.Mesh;
          if (hoveredMeshRef.current !== hitMesh) {
            applyHoverHighlight(hitMesh);
          }
        } else {
          container.style.cursor = 'grab';
          if (hoveredMeshRef.current) {
            resetHoverState();
          }
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      container.style.cursor = 'grab';
    };

    const handleMouseLeave = () => {
      isDraggingRef.current = false;
      resetHoverState();
      container.style.cursor = 'grab';
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(
        35,
        Math.min(320, sphericalRef.current.radius + e.deltaY * 0.1)
      );
      updateCameraPosition();
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [updateCameraPosition, applyHoverHighlight, resetHoverState]);

  // Regenera modelo 3D quando as propriedades mudarem
  useEffect(() => {
    let isCancelled = false;

    const buildModel = async () => {
      try {
        setIsGenerating(true);
        const model = await generatePencilTopperModel(config);
        if (isCancelled) return;

        currentModelRef.current = model;
        onDimensionsChange(model.dimensions);

        // Limpa geometrias anteriores
        resetHoverState();
        const group = modelGroupRef.current;
        while (group.children.length > 0) {
          const child = group.children[0] as THREE.Object3D;
          group.remove(child);
          child.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              if (obj.geometry) obj.geometry.dispose();
              if (Array.isArray(obj.material)) {
                obj.material.forEach((m) => m.dispose());
              } else if (obj.material) {
                obj.material.dispose();
              }
            }
          });
        }

        // Anexa wireframe overlays
        attachWireframeOverlay(model.baseMesh);
        attachWireframeOverlay(model.reliefMesh);

        // Centraliza sobre a mesa de impressão
        model.baseMesh.geometry.computeBoundingBox();
        const bbox = model.baseMesh.geometry.boundingBox || new THREE.Box3();
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        // Alinha na base Z=0
        const minZ = bbox.min.z;
        model.baseMesh.position.set(-center.x, -center.y, -minZ);
        model.reliefMesh.position.set(-center.x, -center.y, -minZ);
        model.guideGroup.position.set(-center.x, -center.y, -minZ);

        // Deita na mesa de impressão 3D plana (Z do fatiador apontando para cima Y na cena)
        group.rotation.x = -Math.PI / 2;
        group.add(model.baseMesh);
        group.add(model.reliefMesh);
        group.add(model.guideGroup);

        setIsGenerating(false);
      } catch (err) {
        console.error('Erro ao gerar modelo 3D da ponteira:', err);
        setIsGenerating(false);
      }
    };

    const timeout = setTimeout(buildModel, 40);
    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [
    config.pencilModel,
    config.pencilDiameter,
    config.clearance,
    config.holeShape,
    config.holeOrientation,
    config.socketHeight,
    config.text,
    config.fontFamily,
    config.letterHeight,
    config.letterSpacing,
    config.fontWeightScale,
    config.symbolId,
    config.symbolPosition,
    config.symbolGap,
    config.outlineSize,
    config.baseWallThickness,
    config.reliefThickness,
    config.baseColor,
    config.reliefColor,
    config.showPencilGuide,
    onDimensionsChange,
    resetHoverState,
  ]);

  // Captura de screenshot HD em PNG
  const handleCaptureScreenshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    try {
      setIsCapturing(true);
      const previouslyHovered = hoveredMeshRef.current;
      if (previouslyHovered) resetHoverState();

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      const dataUrl = rendererRef.current.domElement.toDataURL('image/png', 1.0);

      if (previouslyHovered) applyHoverHighlight(previouslyHovered);

      const safeText = config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'Ponteira';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `Ponteira_Lapis_${safeText}_${timestamp}.png`;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setCaptureToast(`Screenshot salvo: ${filename}`);
      setTimeout(() => setCaptureToast(null), 3500);
    } catch (e) {
      console.error('Erro ao capturar screenshot:', e);
    } finally {
      setIsCapturing(false);
    }
  };

  // Reset de câmera
  const handleResetCamera = () => {
    sphericalRef.current = {
      radius: 120,
      theta: Math.PI / 4,
      phi: Math.PI / 3.2,
    };
    updateCameraPosition();
  };

  // Vista Superior (Top View)
  const handleTopView = () => {
    sphericalRef.current = {
      radius: 120,
      theta: 0,
      phi: 0.08,
    };
    updateCameraPosition();
  };

  return (
    <div className="relative w-full h-full bg-[var(--workbench-viewport)] overflow-hidden select-none">
      {/* Área WebGL */}
      <div ref={containerRef} className="w-full h-full outline-none select-none" />

      {/* Indicador Flutuante de Inspeção / Wireframe Translúcido */}
      {isHoveringObject && hoveredPartName && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-[var(--workbench-panel)]/95 border border-amber-500/50 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs text-amber-300 pointer-events-none animate-in fade-in duration-200">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="font-semibold">{hoveredPartName}</span>
          <span className="text-[10px] text-amber-200 font-mono px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-500/30 flex items-center gap-1">
            <MousePointer className="w-2.5 h-2.5" />
            Wireframe Translúcido
          </span>
        </div>
      )}

      {/* Toast de Captura Salva */}
      {captureToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl bg-[var(--workbench-panel)]/95 border border-emerald-500/50 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{captureToast}</span>
        </div>
      )}

      {/* Spinner de Geração 3D */}
      {isGenerating && (
        <div className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full bg-[var(--workbench-panel)]/90 border border-amber-500/30 shadow-lg backdrop-blur-md flex items-center gap-2 text-xs text-amber-300">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <span>Recalculando malha 3D...</span>
        </div>
      )}

      {/* Barra de Controles Rápidos da Câmera (Canto Inferior Esquerdo) */}
      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--workbench-panel)]/90 border-[var(--surface-container-high)] backdrop-blur-md shadow-xl">
        <button
          type="button"
          onClick={handleResetCamera}
          className="p-2 rounded-xl text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)] transition-colors"
          title="Restaurar Visão Padrão (Perspectiva 3D)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleTopView}
          className="p-2 rounded-xl text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)] transition-colors"
          title="Vista Superior (Plano XY)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-2 rounded-xl transition-colors ${
            autoRotate
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]'
          }`}
          title="Giro Automático 360°"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-[var(--surface-container-high)] mx-1" />
        <button
          type="button"
          onClick={handleCaptureScreenshot}
          disabled={isCapturing}
          className="p-2 rounded-xl text-[var(--on-surface-variant)] hover:text-amber-400 hover:bg-[var(--surface-container-high)] transition-colors"
          title="Capturar Foto HD da Ponteira (PNG)"
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>

      {/* Dimensões em Tempo Real (Canto Inferior Direito) */}
      <div className="absolute bottom-5 right-5 z-20 hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[var(--workbench-panel)]/90 border-[var(--surface-container-high)] backdrop-blur-md shadow-xl text-xs text-[var(--on-surface-variant)]">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--on-surface-variant)]">Encaixe:</span>
          <span className="font-mono font-bold text-amber-400">
            {config.holeShape === 'hexagonal' ? '⬡ Hex' : '⚪ Redondo'} {Number((config.pencilDiameter + config.clearance).toFixed(1))}mm
          </span>
        </div>
        <div className="w-px h-4 bg-[var(--surface-container-high)]" />
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--on-surface-variant)]">Nome:</span>
          <span className="font-mono font-bold text-[var(--workbench-text)]">
            {config.text || 'Milene'}
          </span>
        </div>
      </div>
    </div>
  );
};
