import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ThermoformConfig, ThermoformKitDimensions } from '../types/thermoform';
import { generateThermoformKit } from '../lib/thermoform/geometry';
import {
  RotateCcw,
  RotateCw,
  Maximize2,
  Camera,
} from 'lucide-react';

interface ThermoformCanvasProps {
  config: ThermoformConfig;
  onDimensionsChange: (dims: ThermoformKitDimensions) => void;
}

export const ThermoformCanvas: React.FC<ThermoformCanvasProps> = ({
  config,
  onDimensionsChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group>(new THREE.Group());

  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [captureToast, setCaptureToast] = useState<string | null>(null);
  const [activeParts, setActiveParts] = useState<string>('');

  const sphericalRef = useRef({
    radius: 320,
    theta: Math.PI / 4,
    phi: Math.PI / 3.2,
  });

  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    cameraRef.current.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta)
    );
    cameraRef.current.lookAt(0, 0, 0);
  }, []);

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

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe5e7eb, 1.3);
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(90, 140, 100);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.bias = -0.0001;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xfef08a, 1.2);
    dirLight2.position.set(-90, 60, -70);
    scene.add(dirLight2);

    // Kit cabe ~ (40–200)×3 + margens → grade grande
    const grid = new THREE.GridHelper(600, 60, 0x94a3b8, 0xd1d5db);
    grid.position.y = -0.1;
    scene.add(grid);

    scene.add(modelGroupRef.current);

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
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
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

  // Orbit simples (mesmo padrão do PenHolderCanvas)
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
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;
      sphericalRef.current.theta -= deltaX * 0.008;
      sphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI - 0.05, sphericalRef.current.phi - deltaY * 0.008)
      );
      updateCameraPosition();
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      container.style.cursor = 'grab';
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(
        80,
        Math.min(900, sphericalRef.current.radius + e.deltaY * 0.15)
      );
      updateCameraPosition();
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [updateCameraPosition]);

  // Regenera o kit quando a config muda
  useEffect(() => {
    let isCancelled = false;

    const buildKit = () => {
      try {
        setIsGenerating(true);
        const kit = generateThermoformKit(config);
        if (isCancelled) return;

        const group = modelGroupRef.current;
        while (group.children.length > 0) {
          const child = group.children[0] as THREE.Object3D;
          group.remove(child);
          child.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.geometry?.dispose();
              (obj.material as THREE.Material)?.dispose();
            }
          });
        }

        if (!kit) {
          onDimensionsChange({ dimX: 0, dimY: 0, dimZ: 0, partCount: 0 });
          setActiveParts('');
          setIsGenerating(false);
          return;
        }

        onDimensionsChange(kit.dimensions);
        setActiveParts(kit.parts.map((p) => p.id).join(' · '));

        const colorById: Record<string, string> = {
          mold: config.moldColor,
          press: config.pressColor,
          folha: config.folhaColor,
          encaixe: config.clipColor,
          cabo: config.caboColor,
        };

        for (const part of kit.parts) {
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorById[part.id] ?? '#888888'),
            roughness: 0.45,
            metalness: 0.05,
          });
          for (const geom of part.geoms) {
            const mesh = new THREE.Mesh(geom, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
          }
        }

        // Geometria é z-up (espaço do fatiador); rotaciona para y-up e centraliza.
        group.rotation.x = -Math.PI / 2;
        group.position.set(-kit.dimensions.dimX / 2, 0, kit.dimensions.dimY / 2);

        setIsGenerating(false);
      } catch (err) {
        console.error('Erro ao gerar kit termoformado:', err);
        setIsGenerating(false);
      }
    };

    const timeout = setTimeout(buildKit, 40);
    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [
    config.preset,
    config.svgPathData,
    config.sizeMm,
    config.baseThickness,
    config.domeHeight,
    config.flangeThickness,
    config.ringWallThickness,
    config.ringHeight,
    config.floorThickness,
    config.rimWidth,
    config.rimHeight,
    config.clipCount,
    config.clipLength,
    config.clipWidth,
    config.clipGap,
    config.clipThickness,
    config.parts.mold,
    config.parts.press,
    config.parts.folha,
    config.parts.encaixe,
    config.parts.cabo,
    config.moldColor,
    config.pressColor,
    config.folhaColor,
    config.clipColor,
    config.caboColor,
    onDimensionsChange,
  ]);

  const handleCaptureScreenshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    try {
      setIsCapturing(true);
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      const dataUrl = rendererRef.current.domElement.toDataURL('image/png', 1.0);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `Termoformado_${config.svgPathData ? 'custom' : config.preset}_${timestamp}.png`;
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

  return (
    <div className="relative w-full h-full bg-[var(--workbench-viewport)] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full outline-none select-none" />

      {captureToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl bg-[var(--workbench-panel)]/95 border border-emerald-500/50 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs text-emerald-300">
          <span>{captureToast}</span>
        </div>
      )}

      {isGenerating && (
        <div className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full bg-[var(--workbench-panel)]/90 border border-amber-500/30 shadow-lg backdrop-blur-md flex items-center gap-2 text-xs text-amber-300">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <span>Recalculando kit…</span>
        </div>
      )}

      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--workbench-panel)]/90 border-[var(--surface-container-high)] backdrop-blur-md shadow-xl">
        <button
          type="button"
          onClick={() => {
            sphericalRef.current = { radius: 320, theta: Math.PI / 4, phi: Math.PI / 3.2 };
            updateCameraPosition();
          }}
          className="p-2 rounded-xl text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)] transition-colors"
          title="Restaurar Visão Padrão"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            sphericalRef.current = { radius: 320, theta: 0, phi: 0.08 };
            updateCameraPosition();
          }}
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
          title="Capturar Foto HD do Kit (PNG)"
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>

      {/* Readout mm (canto inferior direito) */}
      <div className="absolute bottom-5 right-5 z-20 hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[var(--workbench-panel)]/90 border-[var(--surface-container-high)] backdrop-blur-md shadow-xl text-xs text-[var(--on-surface-variant)]">
        <div className="flex items-center gap-1.5">
          <span>Kit:</span>
          <span className="font-mono font-bold text-amber-400">
            {(config.svgPathData ? 'SVG' : config.preset)} · {config.sizeMm.toFixed(0)} mm
          </span>
        </div>
        <div className="w-px h-4 bg-[var(--surface-container-high)]" />
        <div className="flex items-center gap-1.5">
          <span>Layout:</span>
          <span className="font-mono font-bold text-[var(--workbench-text)]">
            {activeParts || '—'}
          </span>
        </div>
      </div>
    </div>
  );
};
