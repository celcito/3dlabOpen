import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { MoldBuildResult, MoldConfig, MoldViewMode } from '../types/mold';
import { generateMold } from '../lib/mold/generator';
import { Maximize2, RotateCcw, RotateCw } from 'lucide-react';

interface MoldCanvasProps {
  targetGeometry: THREE.BufferGeometry | null;
  config: MoldConfig;
  viewMode: MoldViewMode;
  onBuildChange: (build: MoldBuildResult | null) => void;
  onError: (message: string | null) => void;
}

const CAST_COLOR = '#8B5E3C';
const REFERENCE_COLOR = '#F59E0B';

export const MoldCanvas: React.FC<MoldCanvasProps> = ({
  targetGeometry,
  config,
  viewMode,
  onBuildChange,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const moldGroupRef = useRef<THREE.Group>(new THREE.Group());

  const [autoRotate, setAutoRotate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [build, setBuild] = useState<MoldBuildResult | null>(null);

  const sphericalRef = useRef({ radius: 220, theta: Math.PI / 4, phi: Math.PI / 3.2 });
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

  // Cena base
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f3ed);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      3000
    );
    cameraRef.current = camera;
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xe5e7eb, 1.25));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(90, 140, 100);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfef08a, 0.9);
    fillLight.position.set(-90, 60, -70);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(600, 60, 0x94a3b8, 0xd1d5db);
    grid.position.y = -0.1;
    scene.add(grid);

    scene.add(moldGroupRef.current);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotate && !isDraggingRef.current) {
        sphericalRef.current.theta += 0.005;
        updateCameraPosition();
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
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

  // Órbita (mesmo padrão dos outros canvas do Workbench)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.cursor = 'grab';

    const handleMouseDown = (event: MouseEvent) => {
      isDraggingRef.current = true;
      container.style.cursor = 'grabbing';
      previousMousePositionRef.current = { x: event.clientX, y: event.clientY };
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = event.clientX - previousMousePositionRef.current.x;
      const deltaY = event.clientY - previousMousePositionRef.current.y;
      sphericalRef.current.theta -= deltaX * 0.008;
      sphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI - 0.05, sphericalRef.current.phi - deltaY * 0.008)
      );
      updateCameraPosition();
      previousMousePositionRef.current = { x: event.clientX, y: event.clientY };
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      container.style.cursor = 'grab';
    };
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      sphericalRef.current.radius = Math.max(
        60,
        Math.min(1200, sphericalRef.current.radius + event.deltaY * 0.2)
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

  // Recalcula o molde quando o modelo ou a configuração mudam
  useEffect(() => {
    if (!targetGeometry) {
      setBuild(null);
      return;
    }

    let cancelled = false;
    setIsGenerating(true);

    const timeout = setTimeout(() => {
      try {
        const result = generateMold(targetGeometry, config);
        if (cancelled) return;
        setBuild(result);
        onError(null);
      } catch (error) {
        console.error('Erro ao gerar molde:', error);
        if (cancelled) return;
        setBuild(null);
        onError(
          error instanceof Error
            ? error.message
            : 'Não foi possível calcular o molde com esta malha.'
        );
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    }, 40);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    targetGeometry,
    config.type,
    config.shape,
    config.wallThickness,
    config.floorThickness,
    config.splitPlaneRatio,
    config.pourSpout,
    config.pourSpoutDiameter,
    config.airVents,
    config.airVentDiameter,
    config.alignmentPins,
    config.pinSize,
    config.draftAngle,
    onError,
  ]);

  useEffect(() => {
    onBuildChange(build);
  }, [build, onBuildChange]);

  // Desenha o resultado conforme o modo de visualização
  useEffect(() => {
    const group = moldGroupRef.current;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material?.dispose();
        }
      });
    }

    if (!targetGeometry || !build) return;

    const transparent = viewMode === 'xray';
    const makeMaterial = (color: string) =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.45,
        metalness: 0.05,
        transparent,
        opacity: transparent ? 0.35 : 1,
        depthWrite: !transparent,
      });

    if (viewMode === 'cast') {
      const cast = new THREE.Mesh(
        targetGeometry.clone(),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(CAST_COLOR), roughness: 0.35 })
      );
      cast.castShadow = true;
      cast.receiveShadow = true;
      group.add(cast);
    } else if (viewMode === 'original') {
      const reference = new THREE.Mesh(
        targetGeometry.clone(),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(REFERENCE_COLOR),
          roughness: 0.4,
          metalness: 0.15,
        })
      );
      reference.castShadow = true;
      reference.receiveShadow = true;
      group.add(reference);
    } else {
      for (const part of build.parts) {
        const color = part.id === 'partB' ? config.topColor : config.moldColor;
        for (const geometry of part.geoms) {
          const mesh = new THREE.Mesh(geometry.clone(), makeMaterial(color));
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (config.explodeDistance > 0 && build.parts.length > 1) {
            mesh.position.z = part.id === 'partB' ? config.explodeDistance : -config.explodeDistance;
          }
          group.add(mesh);
        }
      }

      if (viewMode === 'xray') {
        const reference = new THREE.Mesh(
          targetGeometry.clone(),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(REFERENCE_COLOR),
            roughness: 0.4,
            metalness: 0.15,
          })
        );
        group.add(reference);
      }
    }

    // Geometria é Z-up: gira para Y-up e apoia na grade.
    group.rotation.x = -Math.PI / 2;
    const box = new THREE.Box3().setFromObject(group);
    if (Number.isFinite(box.min.x)) {
      const center = new THREE.Vector3();
      box.getCenter(center);
      group.position.set(-center.x, -box.min.y, center.z);
    }
  }, [
    targetGeometry,
    build,
    viewMode,
    config.explodeDistance,
    config.moldColor,
    config.topColor,
  ]);

  return (
    <div className="relative w-full h-full bg-[var(--workbench-viewport)] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full outline-none select-none" />

      {isGenerating && (
        <div className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-lg bg-[var(--workbench-panel)] border border-[var(--workbench-line)] flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-variant)]">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          Calculando molde…
        </div>
      )}

      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1 p-1 rounded-lg bg-[var(--workbench-panel)] border border-[var(--workbench-line)]">
        <button
          type="button"
          onClick={() => {
            sphericalRef.current = { radius: 220, theta: Math.PI / 4, phi: Math.PI / 3.2 };
            updateCameraPosition();
          }}
          className="p-2 rounded text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--workbench-text)]"
          title="Restaurar visão padrão"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            sphericalRef.current = { radius: 220, theta: 0, phi: 0.08 };
            updateCameraPosition();
          }}
          className="p-2 rounded text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--workbench-text)]"
          title="Vista superior"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate((value) => !value)}
          className={`p-2 rounded ${
            autoRotate
              ? 'bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]'
              : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--workbench-text)]'
          }`}
          title="Giro automático"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
