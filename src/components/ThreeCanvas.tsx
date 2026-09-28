import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { LetterBoxConfig, Model3DDimensions } from '../types/letterBox';
import { generateLetterBoxModel, type GeneratedLetterBox } from '../lib/letterBox/geometry';
import {
  RotateCcw,
  Eye,
  Layers,
  Sparkles,
  Maximize2,
  Box,
  Sliders,
  Download,
  Check,
  Camera,
  MousePointer,
} from 'lucide-react';

interface ThreeCanvasProps {
  config: LetterBoxConfig;
  onDimensionsChange: (dimensions: Model3DDimensions) => void;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  config,
  onDimensionsChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const currentModelRef = useRef<GeneratedLetterBox | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [dimensions, setDimensions] = useState<Model3DDimensions>({
    dimX: 195.9,
    dimY: 58.6,
    dimZ: 26.7,
    volumeCm3: 82.4,
    weightGrams: 75.2,
    printTimeMinutes: 105,
  });
  const [explodedView, setExplodedView] = useState(0); // 0 a 50mm de afastamento
  const [autoRotate, setAutoRotate] = useState(false);
  const [viewMode, setViewMode] = useState<'plate' | 'desk'>('plate');
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureToast, setCaptureToast] = useState(false);
  const [isHoveringObject, setIsHoveringObject] = useState(false);
  const [hoveredPartName, setHoveredPartName] = useState<string | null>(null);

  // Rastreamento de interação do mouse / órbita manual
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraTargetRef = useRef(new THREE.Vector3(0, 20, 0));
  const cameraDistanceRef = useRef(240);
  const sphericalRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3.2 });
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());

  // Helper para criar sobreposição de wireframe com transparência
  const attachWireframeOverlay = useCallback((mesh: THREE.Mesh, name: string) => {
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#38bdf8'),
      wireframe: true,
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const wireMesh = new THREE.Mesh(mesh.geometry, wireMaterial);
    wireMesh.name = `Wire_${name}`;
    wireMesh.visible = false;
    wireMesh.castShadow = false;
    wireMesh.receiveShadow = false;
    wireMesh.raycast = () => {}; // Evita interceptação duplicada pelo raycaster
    mesh.add(wireMesh);
    return wireMesh;
  }, []);

  // Helper para resetar highlight e transparência aos valores padrão
  const resetHoverState = useCallback(() => {
    if (!currentModelRef.current) return;
    const { backMesh, midMesh, frontMesh } = currentModelRef.current;
    const meshes = [backMesh, midMesh, frontMesh];

    meshes.forEach((mesh) => {
      if (mesh) {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.transparent = false;
          mesh.material.opacity = 1.0;
          mesh.material.emissive.setHex(0x000000);
          mesh.material.emissiveIntensity = 0;
          mesh.material.needsUpdate = true;
        }
        const wire = mesh.children.find((c) => c.name.startsWith('Wire_')) as THREE.Mesh | undefined;
        if (wire && wire.material instanceof THREE.MeshBasicMaterial) {
          wire.visible = false;
          wire.material.opacity = 0;
        }
      }
    });

    hoveredMeshRef.current = null;
    setIsHoveringObject(false);
    setHoveredPartName(null);
  }, []);

  // Helper para aplicar highlight com wireframe em transparência na camada sob o cursor
  const applyHoverHighlight = useCallback((hitMesh: THREE.Mesh) => {
    if (!currentModelRef.current) return;
    const { backMesh, midMesh, frontMesh } = currentModelRef.current;
    const meshes = [backMesh, midMesh, frontMesh];

    meshes.forEach((mesh) => {
      if (!mesh) return;
      const isPrimary = mesh === hitMesh;
      const wire = mesh.children.find((c) => c.name.startsWith('Wire_')) as THREE.Mesh | undefined;

      // Deixa o corpo do objeto com transparência elegante para revelar a estrutura interna
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.transparent = true;
        mesh.material.opacity = isPrimary ? 0.78 : 0.88;
        mesh.material.emissive.setHex(isPrimary ? 0x0284c7 : 0x0f172a);
        mesh.material.emissiveIntensity = isPrimary ? 0.45 : 0.15;
        mesh.material.needsUpdate = true;
      }

      // Exibe a malha wireframe translúcida brilhante
      if (wire && wire.material instanceof THREE.MeshBasicMaterial) {
        wire.visible = true;
        wire.material.opacity = isPrimary ? 0.85 : 0.35;
        wire.material.color.set(isPrimary ? '#38bdf8' : '#60a5fa');
      }
    });

    hoveredMeshRef.current = hitMesh;
    setIsHoveringObject(true);

    if (hitMesh.name.includes('Texto_Frontal') || hitMesh.name.includes('Camada_3')) {
      setHoveredPartName('Camada Frontal (Texto)');
    } else if (hitMesh.name.includes('Intermediaria') || hitMesh.name.includes('Camada_2')) {
      setHoveredPartName('Camada Intermediária (Corpo da Caixa)');
    } else if (hitMesh.name.includes('Traseira') || hitMesh.name.includes('Camada_1')) {
      setHoveredPartName('Camada Traseira (Fundo da Caixa)');
    } else {
      setHoveredPartName('Letra Caixa 3D');
    }
  }, []);

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;
    const { theta, phi } = sphericalRef.current;
    const r = cameraDistanceRef.current;

    camera.position.x = cameraTargetRef.current.x + r * Math.sin(phi) * Math.sin(theta);
    camera.position.y = cameraTargetRef.current.y + r * Math.cos(phi);
    camera.position.z = cameraTargetRef.current.z + r * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(cameraTargetRef.current);
  }, []);

  // Inicialização Three.js
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Cena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f3f4ee');
    sceneRef.current = scene;

    // Câmera
    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 3000);
    cameraRef.current = camera;
    updateCameraPosition();

    // Renderer WebGL
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Iluminação Profissional de Estúdio
    const ambientLight = new THREE.AmbientLight('#ffffff', 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight('#ffffff', 2.0);
    mainLight.position.set(120, 220, 160);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 10;
    mainLight.shadow.camera.far = 1000;
    mainLight.shadow.bias = -0.0003;
    const d = 160;
    mainLight.shadow.camera.left = -d;
    mainLight.shadow.camera.right = d;
    mainLight.shadow.camera.top = d;
    mainLight.shadow.camera.bottom = -d;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight('#a5b4fc', 0.9);
    fillLight.position.set(-140, 100, -80);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#e0e7ff', 0.7);
    rimLight.position.set(0, -80, -150);
    scene.add(rimLight);

    // Luz inferior para iluminar a parte de baixo (fundo da letra na vista inferior)
    const bottomLight = new THREE.DirectionalLight('#f8fafc', 0.85);
    bottomLight.position.set(0, -180, 0);
    scene.add(bottomLight);

    // Chapa de Impressão (Build Plate) estilizada
    const plateGroup = new THREE.Group();
    plateGroup.name = 'PlateGroup';

    // Base quadrada da chapa 256x256mm (estilo Bambu Lab)
    const plateGeo = new THREE.BoxGeometry(260, 2, 260);
    const plateMat = new THREE.MeshStandardMaterial({
      color: '#e5e7eb',
      roughness: 0.8,
      metalness: 0.2,
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.y = -1;
    plateMesh.receiveShadow = true;
    plateGroup.add(plateMesh);

    // Grid sobre a chapa
    const grid = new THREE.GridHelper(250, 25, '#94a3b8', '#d1d5db');
    grid.position.y = 0.1;
    plateGroup.add(grid);

    scene.add(plateGroup);

    // Grupo do Modelo Letra Caixa 3D
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Loop de Animação
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (autoRotate && !isDraggingRef.current) {
        sphericalRef.current.theta += 0.006;
        updateCameraPosition();
      }

      renderer.render(scene, camera);
    };
    animate();

    // Redimensionamento
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [updateCameraPosition, autoRotate]);

  // Controles de mouse / toque com Raycasting para Hover e Órbita 3D
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
        // Órbita da câmera
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
        // Detecção de Hover no Objeto 3D via Raycaster
        if (!cameraRef.current || !currentModelRef.current) return;
        const rect = container.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
        const targetMeshes = [
          currentModelRef.current.frontMesh,
          currentModelRef.current.midMesh,
          currentModelRef.current.backMesh,
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

    const handleMouseUp = (e: MouseEvent) => {
      isDraggingRef.current = false;
      // Reavalia o cursor e hover ao soltar o clique
      if (cameraRef.current && currentModelRef.current) {
        const rect = container.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
        const targetMeshes = [
          currentModelRef.current.frontMesh,
          currentModelRef.current.midMesh,
          currentModelRef.current.backMesh,
        ].filter(Boolean);
        const intersects = raycasterRef.current.intersectObjects(targetMeshes, false);
        if (intersects.length > 0) {
          container.style.cursor = 'pointer';
          applyHoverHighlight(intersects[0].object as THREE.Mesh);
        } else {
          container.style.cursor = 'grab';
          resetHoverState();
        }
      } else {
        container.style.cursor = 'grab';
      }
    };

    const handleMouseLeave = () => {
      isDraggingRef.current = false;
      resetHoverState();
      container.style.cursor = 'grab';
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistanceRef.current = Math.max(
        70,
        Math.min(650, cameraDistanceRef.current + e.deltaY * 0.25)
      );
      updateCameraPosition();
    };

    // Suporte a Toque (Mobile / Tablets)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePositionRef.current.x;
      const deltaY = e.touches[0].clientY - previousMousePositionRef.current.y;

      sphericalRef.current.theta -= deltaX * 0.008;
      sphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI - 0.05, sphericalRef.current.phi - deltaY * 0.008)
      );

      updateCameraPosition();
      previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('wheel', handleWheel, { passive: false });

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('wheel', handleWheel);

      container.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [updateCameraPosition, applyHoverHighlight, resetHoverState]);

  // Regenera o modelo 3D quando as propriedades mudarem
  useEffect(() => {
    let isCancelled = false;

    const buildModel = async () => {
      if (!modelGroupRef.current) return;
      setIsLoading(true);

      try {
        const model = await generateLetterBoxModel(config);
        if (isCancelled) return;

        currentModelRef.current = model;
        setDimensions(model.dimensions);
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

        // Vincula as sobreposições de wireframe em cada camada para feedback de transparência no hover
        attachWireframeOverlay(model.backMesh, 'Traseira');
        attachWireframeOverlay(model.midMesh, 'Intermediaria');
        attachWireframeOverlay(model.frontMesh, 'Frontal');

        // Posiciona a letra deitada sobre a mesa (pronta para imprimir) ou em pé
        // Para impressão 3D (padrão): o fundo da caixa fica apoiado no chão Z=0
        // No Three.js, o chão é Y=0. Então rotacionamos -90 deg no X para apoiar no chão da mesa!
        const letterAssembly = new THREE.Group();

        letterAssembly.add(model.backMesh);
        letterAssembly.add(model.midMesh);
        letterAssembly.add(model.frontMesh);

        // Aplica rotação para ficar deitado de costas na chapa (Face para cima)
        letterAssembly.rotation.x = -Math.PI / 2;
        letterAssembly.position.y = 0.5; // leve elevação sobre o grid

        group.add(letterAssembly);

        // Ajusta distância da câmera para enquadrar perfeitamente
        const targetDist = Math.max(160, model.dimensions.dimX * 1.25);
        cameraDistanceRef.current = targetDist;
        cameraTargetRef.current.set(0, 10, 0);
        updateCameraPosition();
      } catch (err) {
        console.error('Erro ao gerar modelo 3D:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    buildModel();

    return () => {
      isCancelled = true;
    };
  }, [
    config.text,
    config.fontFamily,
    config.letterHeight,
    config.backDepth,
    config.letterSpacing,
    config.backContour,
    config.midContour,
    config.frontThickness,
    config.midThickness,
    config.flatBase,
    config.backColor,
    config.midColor,
    config.frontColor,
    config.bevelFront,
    config.bevelSize,
    onDimensionsChange,
    updateCameraPosition,
  ]);

  // Atualiza cores dinamicamente sem reconstruir geometria inteira
  useEffect(() => {
    if (!currentModelRef.current) return;
    const { backMesh, midMesh, frontMesh } = currentModelRef.current;
    if (backMesh.material instanceof THREE.MeshStandardMaterial) {
      backMesh.material.color.set(config.backColor);
    }
    if (midMesh.material instanceof THREE.MeshStandardMaterial) {
      midMesh.material.color.set(config.midColor);
    }
    if (frontMesh.material instanceof THREE.MeshStandardMaterial) {
      frontMesh.material.color.set(config.frontColor);
    }
  }, [config.backColor, config.midColor, config.frontColor]);

  // Atualiza a vista explodida
  useEffect(() => {
    if (!currentModelRef.current) return;
    const { midMesh, frontMesh } = currentModelRef.current;

    // Afastamento suave no eixo Z original da geometria
    const midExplodeZ = config.backDepth + (explodedView * 0.7);
    const frontExplodeZ = config.backDepth + config.midThickness + (explodedView * 1.8);

    midMesh.position.z = midExplodeZ;
    frontMesh.position.z = frontExplodeZ;
  }, [explodedView, config.backDepth, config.midThickness]);

  // Presets de Câmera
  const setCameraPreset = (preset: 'front' | 'top' | 'isometric' | 'side' | 'bottom') => {
    if (preset === 'front') {
      sphericalRef.current = { theta: 0, phi: Math.PI / 2.05 };
    } else if (preset === 'top') {
      sphericalRef.current = { theta: 0, phi: 0.05 };
    } else if (preset === 'isometric') {
      sphericalRef.current = { theta: Math.PI / 4, phi: Math.PI / 3.2 };
    } else if (preset === 'side') {
      sphericalRef.current = { theta: Math.PI / 2, phi: Math.PI / 2.1 };
    } else if (preset === 'bottom') {
      sphericalRef.current = { theta: 0, phi: Math.PI - 0.08 };
    }
    updateCameraPosition();
  };

  // Capturar e Salvar Imagem em Alta Resolução da Visão Atual
  const handleCaptureScreenshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    try {
      setIsCapturing(true);

      // Desativa temporariamente o hover para captura com render limpo
      const previouslyHovered = hoveredMeshRef.current;
      if (previouslyHovered) {
        resetHoverState();
      }

      // Renderiza o frame imediatamente para garantir o buffer limpo e atualizado
      rendererRef.current.render(sceneRef.current, cameraRef.current);

      const canvas = rendererRef.current.domElement;
      const dataUrl = canvas.toDataURL('image/png', 1.0);

      // Restaura highlight após a captura
      if (previouslyHovered) {
        applyHoverHighlight(previouslyHovered);
      }

      const safeText = config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'LetraCaixa';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `LetraCaixa3D_${safeText}_${config.letterHeight}mm_${timestamp}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setCaptureToast(true);
      setTimeout(() => setCaptureToast(false), 3000);
    } catch (err) {
      console.error('Erro ao capturar screenshot:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[var(--workbench-viewport)]">
      {/* Área WebGL */}
      <div
        ref={containerRef}
        className="w-full h-full outline-none select-none"
      />

      {/* Indicador Flutuante de Inspeção / Wireframe Translúcido no Hover */}
      {isHoveringObject && hoveredPartName && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-[var(--workbench-panel)]/95 border border-cyan-500/50 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs text-cyan-300 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-semibold">{hoveredPartName}</span>
          <span className="text-[10px] text-cyan-200 font-mono px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 flex items-center gap-1">
            <MousePointer className="w-2.5 h-2.5" />
            Wireframe Translúcido
          </span>
        </div>
      )}

      {/* Toast de Captura Salva com Sucesso */}
      {captureToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl bg-[var(--workbench-panel)]/95 border border-emerald-500/50 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in slide-in-from-top-2 duration-300">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">Imagem PNG da visão atual salva com sucesso!</span>
        </div>
      )}

      {/* Indicador de Carregamento */}
      {isLoading && (
        <div className="absolute top-4 left-4 z-20 px-3.5 py-2 rounded-xl bg-[var(--workbench-panel)]/90 border border-blue-500/40 backdrop-blur-md flex items-center gap-2.5 text-xs text-blue-300 shadow-xl animate-pulse">
          <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span>Calculando camadas 3D MakerWorld...</span>
        </div>
      )}

      {/* Barra Flutuante de Dimensões 3D Reais (Exatamente como especificado no prompt: X 195.9 Y 58.6 Z 26.7 mm) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="bg-[var(--workbench-panel)]/90 backdrop-blur-md border border-[var(--surface-container-high)] rounded-2xl p-3 shadow-2xl flex flex-col gap-2 min-w-[210px]">
          <div className="flex items-center justify-between border-b border-[var(--surface-container-high)]/80 pb-2">
            <span className="text-[11px] font-bold tracking-wider text-[var(--on-surface-variant)] uppercase flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-blue-400" />
              Dimensões 3D:
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Escala 1:1
            </span>
          </div>

          <div className="flex items-baseline justify-between text-xs font-mono text-[var(--workbench-text)]">
            <div className="flex items-center gap-1.5">
              <span className="text-blue-400 font-bold">X</span>
              <span>{dimensions.dimX}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">Y</span>
              <span>{dimensions.dimY}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-purple-400 font-bold">Z</span>
              <span>{dimensions.dimZ}</span>
              <span className="text-[10px] text-[var(--on-surface-variant)] font-sans">mm</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-[var(--surface-container-high)]/60 flex items-center justify-between text-[11px] text-[var(--on-surface-variant)]">
            <span>Volume: {dimensions.volumeCm3} cm³</span>
            <span>~{dimensions.weightGrams}g PLA</span>
          </div>

          <button
            type="button"
            id="btn-quick-capture-screenshot"
            disabled={isCapturing}
            onClick={handleCaptureScreenshot}
            className="mt-1 w-full py-1.5 px-2.5 rounded-xl bg-[var(--surface-container-high)]/80 hover:bg-[var(--surface-container-high)]/80 text-[var(--on-surface-variant)] hover:text-white border border-slate-700/60 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5 text-purple-400" />
            <span>Salvar Foto 3D (PNG)</span>
          </button>
        </div>
      </div>

      {/* Barra Inferior: Controle da Vista Explodida (Exploded View) & Ângulos de Câmera */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        {/* Controle Deslizante de Vista Explodida */}
        <div className="bg-[var(--workbench-panel)]/90 backdrop-blur-md border border-[var(--surface-container-high)] rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-3">
          <Layers className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="flex flex-col">
            <div className="flex items-center justify-between text-[11px] text-[var(--on-surface-variant)] font-medium">
              <span>Vista Explodida</span>
              <span className="text-blue-400 font-mono text-[10px] ml-2">{explodedView} mm</span>
            </div>
            <input
              id="slider-exploded-view"
              type="range"
              min="0"
              max="50"
              step="1"
              value={explodedView}
              onChange={(e) => setExplodedView(Number(e.target.value))}
              className="w-28 sm:w-36 h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          {explodedView > 0 && (
            <button
              type="button"
              onClick={() => setExplodedView(0)}
              className="text-[10px] text-[var(--on-surface-variant)] hover:text-white px-1.5 py-0.5 rounded bg-[var(--surface-container-high)]"
            >
              Reset
            </button>
          )}
        </div>

        {/* Botões de Vistas Rápidas da Câmera & Ações Rápidas */}
        <div className="flex items-center gap-1.5 bg-[var(--workbench-panel)]/90 backdrop-blur-md border border-[var(--surface-container-high)] p-1.5 rounded-2xl shadow-xl">
          <button
            type="button"
            title="Vista Isométrica"
            onClick={() => setCameraPreset('isometric')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-[var(--on-surface-variant)] hover:text-white hover:bg-[var(--surface-container-high)] transition-colors"
          >
            Iso
          </button>
          <button
            type="button"
            title="Vista Frontal / Topo da Peça"
            onClick={() => setCameraPreset('top')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-[var(--on-surface-variant)] hover:text-white hover:bg-[var(--surface-container-high)] transition-colors"
          >
            Frente
          </button>
          <button
            type="button"
            title="Vista de Perfil das 3 Camadas"
            onClick={() => setCameraPreset('side')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-[var(--on-surface-variant)] hover:text-white hover:bg-[var(--surface-container-high)] transition-colors"
          >
            Perfil
          </button>
          <button
            type="button"
            title="Vista Embaixo (Fundo da Caixa)"
            onClick={() => setCameraPreset('bottom')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-[var(--on-surface-variant)] hover:text-white hover:bg-[var(--surface-container-high)] transition-colors"
          >
            Embaixo
          </button>
          <div className="w-[1px] h-4 bg-[var(--surface-container-high)] mx-0.5" />
          <button
            type="button"
            title={autoRotate ? 'Parar Rotação' : 'Giro 360° Automático'}
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-xl text-xs font-medium transition-colors ${
              autoRotate ? 'bg-blue-600 text-white' : 'text-[var(--on-surface-variant)] hover:text-white hover:bg-[var(--surface-container-high)]'
            }`}
          >
            <RotateCcw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
          </button>
          <div className="w-[1px] h-4 bg-[var(--surface-container-high)] mx-0.5" />
          <button
            id="btn-save-canvas-snapshot"
            type="button"
            title="Salvar Imagem (Screenshot HD do ângulo atual)"
            disabled={isCapturing}
            onClick={handleCaptureScreenshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-purple-300 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 hover:border-purple-500/60 transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5 text-purple-400" />
            <span>Salvar Imagem</span>
          </button>
        </div>
      </div>
    </div>
  );
};
