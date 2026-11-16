import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ModelLineart, ModelSettings, ViewMode, FilamentColor } from '../types';
import {
  generateCutterMesh,
  generateStampMesh,
  generateDoughMesh,
} from '../utils/meshGenerator';
import {
  RotateCcw,
  Eye,
  Maximize2,
  Box,
  Layers,
  Sparkles,
  Compass,
} from 'lucide-react';

interface Viewport3DProps {
  model: ModelLineart;
  settings: ModelSettings;
  viewMode: ViewMode;
  filamentList: FilamentColor[];
  doughMode: boolean;
  onToggleDoughMode: () => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  model,
  settings,
  viewMode,
  filamentList,
  doughMode,
  onToggleDoughMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshesGroupRef = useRef<THREE.Group | null>(null);

  // Orbit control state (custom responsive implementation without external dependency)
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraTargetRef = useRef(new THREE.Vector3(0, 0, 8));
  const sphericalRef = useRef({ radius: 140, theta: Math.PI / 4, phi: Math.PI / 3 });

  const [activeCameraView, setActiveCameraView] = useState<'iso' | 'top' | 'front' | 'side'>('iso');

  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(
      cameraTargetRef.current.x + x,
      cameraTargetRef.current.y + y,
      cameraTargetRef.current.z + z
    );
    cameraRef.current.lookAt(cameraTargetRef.current);
  };

  // Set camera predefined views
  const setCameraView = (view: 'iso' | 'top' | 'front' | 'side') => {
    setActiveCameraView(view);
    if (view === 'iso') {
      sphericalRef.current = { radius: 150, theta: Math.PI / 4, phi: Math.PI / 3 };
    } else if (view === 'top') {
      sphericalRef.current = { radius: 160, theta: 0, phi: 0.05 };
    } else if (view === 'front') {
      sphericalRef.current = { radius: 150, theta: 0, phi: Math.PI / 2 };
    } else if (view === 'side') {
      sphericalRef.current = { radius: 150, theta: Math.PI / 2, phi: Math.PI / 2 };
    }
    updateCameraPosition();
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f3ed); // Deep obsidian studio slate
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    // 4. Lighting (Three-Point Studio Setup per guidelines)
    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Warm Key Light (casts sharp shadows)
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    keyLight.position.set(80, 120, 100);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 400;
    const d = 110;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Cool Fill Light
    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.6);
    fillLight.position.set(-80, 60, -60);
    scene.add(fillLight);

    // Rim Highlight
    const rimLight = new THREE.DirectionalLight(0xec4899, 0.25);
    rimLight.position.set(0, -100, 60);
    scene.add(rimLight);

    // 5. Build Plate (3D Printer PEI Bed 220x220mm)
    const bedGroup = new THREE.Group();
    bedGroup.name = 'print_bed';

    // Base plate surface
    const bedGeo = new THREE.PlaneGeometry(220, 220);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0xe8e9e3,
      roughness: 0.85,
      metalness: 0.1,
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.receiveShadow = true;
    bedGroup.add(bedMesh);

    // Grid lines (10mm intervals, accented at 50mm)
    const gridHelper = new THREE.GridHelper(220, 22, 0x632ce5, 0xdde1d8);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = 0.1;
    bedGroup.add(gridHelper);

    // Build plate border notch / notch marker
    const borderGeo = new THREE.RingGeometry(110, 111, 4);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xcac3d8, side: THREE.DoubleSide });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.rotation.z = Math.PI / 4;
    borderMesh.position.z = 0.15;
    bedGroup.add(borderMesh);

    scene.add(bedGroup);

    // 6. Meshes container group
    const meshesGroup = new THREE.Group();
    meshesGroup.name = 'model_meshes';
    scene.add(meshesGroup);
    meshesGroupRef.current = meshesGroup;

    // Render loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, []);

  // Update 3D Geometry and Materials when model, settings, or viewMode change
  useEffect(() => {
    if (!meshesGroupRef.current || !sceneRef.current) return;

    // Clear previous model meshes
    while (meshesGroupRef.current.children.length > 0) {
      const child = meshesGroupRef.current.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      meshesGroupRef.current.remove(child);
    }

    // Material setups
    const filamentCutterConfig = filamentList.find(f => f.id === settings.filamentColor) || filamentList[0];
    const filamentStampConfig = filamentList.find(f => f.id === settings.stampFilamentColor) || filamentList[1] || filamentList[0];

    const cutterMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(filamentCutterConfig.hex),
      roughness: filamentCutterConfig.roughness,
      metalness: filamentCutterConfig.metalness,
      wireframe: settings.wireframe,
      side: THREE.DoubleSide,
    });

    const stampMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(filamentStampConfig.hex),
      roughness: filamentStampConfig.roughness,
      metalness: filamentStampConfig.metalness,
      wireframe: settings.wireframe,
      side: THREE.DoubleSide,
    });

    const doughMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#eab308'), // Warm golden baked butter cookie
      roughness: 0.9,
      metalness: 0.05,
      wireframe: settings.wireframe,
      side: THREE.DoubleSide,
    });

    // Toggle Print Bed visibility
    const bed = sceneRef.current.getObjectByName('print_bed');
    if (bed) {
      bed.visible = settings.showPrintBed && !doughMode;
    }

    try {
      if (doughMode) {
        // Dough simulation mode: Golden cookie with debossed stamp marks
        const doughMesh = generateDoughMesh(model, settings, doughMaterial);
        meshesGroupRef.current.add(doughMesh);
      } else {
        // Normal 3D Printing mode
        if (viewMode === 'combo') {
          // Display cutter and stamp side-by-side on the build plate
          const cutterMesh = generateCutterMesh(model, settings, cutterMaterial);
          cutterMesh.position.x = -settings.targetWidth * 0.58;
          meshesGroupRef.current.add(cutterMesh);

          const stampMesh = generateStampMesh(model, settings, stampMaterial);
          stampMesh.position.x = settings.targetWidth * 0.58;
          meshesGroupRef.current.add(stampMesh);
        } else if (viewMode === 'cutter_only') {
          const cutterMesh = generateCutterMesh(model, settings, cutterMaterial);
          meshesGroupRef.current.add(cutterMesh);
        } else if (viewMode === 'stamp_only') {
          const stampMesh = generateStampMesh(model, settings, stampMaterial);
          meshesGroupRef.current.add(stampMesh);
        } else if (viewMode === 'integrated') {
          // Both centered together in stacked arrangement
          const cutterMesh = generateCutterMesh(model, settings, cutterMaterial);
          const stampMesh = generateStampMesh(model, settings, stampMaterial);
          meshesGroupRef.current.add(cutterMesh);
          meshesGroupRef.current.add(stampMesh);
        }
      }
    } catch (err) {
      console.error('Error generating 3D meshes:', err);
    }
  }, [model, settings, viewMode, filamentList, doughMode]);

  // Mouse & Touch Orbit Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      isPanningRef.current = true;
    } else {
      isDraggingRef.current = true;
    }
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

    if (isDraggingRef.current) {
      sphericalRef.current.theta -= deltaX * 0.008;
      sphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI / 2 - 0.02, sphericalRef.current.phi - deltaY * 0.008)
      );
      updateCameraPosition();
    } else if (isPanningRef.current) {
      cameraTargetRef.current.x -= deltaX * 0.2;
      cameraTargetRef.current.y += deltaY * 0.2;
      updateCameraPosition();
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    sphericalRef.current.radius = Math.max(
      35,
      Math.min(320, sphericalRef.current.radius + e.deltaY * 0.12)
    );
    updateCameraPosition();
  };

  // Touch support for mobile & tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDraggingRef.current && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - previousMousePositionRef.current.x;
      const deltaY = e.touches[0].clientY - previousMousePositionRef.current.y;
      previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      sphericalRef.current.theta -= deltaX * 0.008;
      sphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI / 2 - 0.02, sphericalRef.current.phi - deltaY * 0.008)
      );
      updateCameraPosition();
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  const resetCamera = () => {
    cameraTargetRef.current.set(0, 0, 8);
    setCameraView('iso');
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[460px] bg-[var(--workbench-page)] overflow-hidden select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating HUD Top-Left: Model Name, Dimensions & Mode */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none flex flex-col gap-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--workbench-panel)] backdrop-blur-md border border-[var(--surface-container-highest)] shadow-lg text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span className="font-semibold text-[var(--on-surface)]">{model.name}</span>
          <span className="text-[var(--workbench-muted)]">·</span>
          <span className="text-[var(--primary)] font-mono tabular-nums">
            {settings.targetWidth} × {settings.targetHeight} mm
          </span>
          <span className="text-[var(--workbench-muted)]">·</span>
          <span className="text-[var(--on-surface-variant)]">
            Lâmina: {settings.bladeHeight}mm
          </span>
        </div>

        {doughMode && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--primary-fixed)] backdrop-blur-md border border-[var(--primary)] text-[var(--primary)] text-xs">
            <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Simulação de Biscoito Assado (Visualização do Resultado)</span>
          </div>
        )}
      </div>

      {/* Floating HUD Top-Right: Quick Camera Presets & Reset */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 p-1 bg-[var(--workbench-panel)] backdrop-blur-md border border-[var(--surface-container-highest)] rounded-lg shadow-lg">
        <button
          onClick={() => setCameraView('iso')}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            activeCameraView === 'iso' ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
          }`}
          title="Vista Perspectiva Isométrica"
        >
          3D Iso
        </button>
        <button
          onClick={() => setCameraView('top')}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            activeCameraView === 'top' ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
          }`}
          title="Vista Superior 2D (Topo)"
        >
          Topo
        </button>
        <button
          onClick={() => setCameraView('front')}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            activeCameraView === 'front' ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
          }`}
          title="Vista Frontal"
        >
          Frente
        </button>
        <button
          onClick={() => setCameraView('side')}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            activeCameraView === 'side' ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
          }`}
          title="Vista Lateral"
        >
          Lateral
        </button>
        <div className="w-[1px] h-4 bg-[var(--surface-container-high)] mx-0.5" />
        <button
          onClick={resetCamera}
          className="p-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
          title="Centralizar e resetar câmera"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating HUD Bottom-Left: Interactive Toggles (Dough mode, Print Bed, Wireframe) */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
        <button
          onClick={onToggleDoughMode}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-md ${
            doughMode
              ? 'bg-[var(--primary)] text-[var(--on-primary)] font-semibold'
              : 'bg-[var(--workbench-panel)] backdrop-blur-md border border-[var(--surface-container-highest)] text-[var(--on-surface-variant)] hover:text-[var(--primary)]'
          }`}
          title="Ver como o biscoito real ficará cortado e estampado!"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{doughMode ? 'Voltar para Impressão 3D' : 'Simular Biscoito Assado'}</span>
        </button>
      </div>

      {/* Floating HUD Bottom-Right: Viewport Interaction Tip */}
      <div className="absolute bottom-4 right-4 z-10 pointer-events-none hidden md:flex items-center gap-3 text-[11px] text-[var(--on-surface-variant)] bg-[var(--workbench-panel)] backdrop-blur-md px-3 py-1 rounded-md border border-[var(--surface-container-high)]">
        <span>Girar: Botão esquerdo</span>
        <span>·</span>
        <span>Mover: Botão direito</span>
        <span>·</span>
        <span>Zoom: Roda do mouse</span>
      </div>
    </div>
  );
};
