import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCcw, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import type { GeneratedPencilPersonal, PencilPersonalConfig } from '../types/pencilPersonal';
import { transformMatrix, type PencilPackage } from '../lib/pencilPersonal/package';
import {
  axisCenterY,
  faceWidthFor,
  letterPlacementMatrix,
  normalAt,
  surfaceOffset,
} from '../lib/pencilPersonal/geometry';
import { BODY_AXIS, VARIANTS } from '../lib/pencilPersonal/presets';

interface PencilPersonalCanvasProps {
  pkg: PencilPackage | null;
  config: PencilPersonalConfig;
  generated: GeneratedPencilPersonal | null;
  isGenerating: boolean;
}

const OVERLAY_OFFSET = 0.4;

export const PencilPersonalCanvas: React.FC<PencilPersonalCanvasProps> = ({
  pkg,
  config,
  generated,
  isGenerating,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const partsGroupRef = useRef<THREE.Group | null>(null);
  const overlayRef = useRef<THREE.Mesh | null>(null);
  const lettersMeshRef = useRef<THREE.Mesh | null>(null);
  const bodyMeshRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const frameRef = useRef({ radius: 320, target: new THREE.Vector3() });

  const sphericalRef = useRef({ radius: 320, theta: Math.PI / 4, phi: Math.PI / 3.2 });
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  const [showNegative, setShowNegative] = useState(true);
  const variant = VARIANTS[config.variant];

  const updateCameraPosition = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const { radius, theta, phi } = sphericalRef.current;
    const t = frameRef.current.target;
    camera.position.set(
      t.x + radius * Math.sin(phi) * Math.sin(theta),
      t.y + radius * Math.cos(phi),
      t.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(t);
  }, []);

  // Inicialização do Three.js
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4ee);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 6000);
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

    // 3MF é Z-up: vira Y-up para a cena do three
    const pivot = new THREE.Group();
    pivot.rotation.x = -Math.PI / 2;
    const partsGroup = new THREE.Group();
    pivot.add(partsGroup);
    scene.add(pivot);
    pivotRef.current = pivot;
    partsGroupRef.current = partsGroup;

    const overlay = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    overlay.matrixAutoUpdate = false;
    overlay.visible = false;
    pivot.add(overlay);
    overlayRef.current = overlay;

    const lettersMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({
        roughness: 0.5,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    lettersMesh.matrixAutoUpdate = false;
    lettersMesh.visible = false;
    lettersMesh.castShadow = true;
    lettersMesh.receiveShadow = true;
    pivot.add(lettersMesh);
    lettersMeshRef.current = lettersMesh;

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
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
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      pivotRef.current = null;
      partsGroupRef.current = null;
      if (overlayRef.current) overlayRef.current.geometry.dispose();
      overlayRef.current = null;
      if (lettersMeshRef.current) {
        (lettersMeshRef.current.material as THREE.MeshStandardMaterial).dispose();
      }
      lettersMeshRef.current = null;
      bodyMeshRef.current = null;
      gridRef.current = null;
    };
  }, [updateCameraPosition]);

  // Plano tangente: faceWidth (corda no redondo) × altura do corpo da variante
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const faceWidth = generated?.faceWidth ?? faceWidthFor(variant, config.depth);
    const geometry = new THREE.PlaneGeometry(faceWidth, variant.bodyLength);
    const previous = overlay.geometry;
    overlay.geometry = geometry;
    if (previous !== geometry) previous.dispose();
  }, [variant, generated?.faceWidth, config.depth]);

  // Peças posicionadas pelos transforms de <build> (design.md §Viewport)
  useEffect(() => {
    const pivot = pivotRef.current;
    const partsGroup = partsGroupRef.current;
    const scene = sceneRef.current;
    if (!pivot || !partsGroup || !scene || !pkg) return;

    while (partsGroup.children.length > 0) {
      const child = partsGroup.children[0];
      partsGroup.remove(child);
      if (child instanceof THREE.Mesh) child.material.dispose();
    }
    bodyMeshRef.current = null;

    for (const part of pkg.parts) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(pkg.filamentColors[part.extruder - 1] || '#9ca3af'),
        roughness: 0.62,
        metalness: 0.05,
      });
      const mesh = new THREE.Mesh(part.geometry, material);
      mesh.name = part.name;
      mesh.applyMatrix4(transformMatrix(part.buildTransform));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      partsGroup.add(mesh);
      if (part.objectId === pkg.bodyObjectId) bodyMeshRef.current = mesh;
    }

    pivot.position.set(0, 0, 0);
    pivot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivot);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    pivot.position.set(-center.x, -box.min.y, -center.z);

    // Enquadra a esfera delimitadora do conjunto dentro do FOV da câmera.
    const halfFov = (((cameraRef.current?.fov ?? 42) * Math.PI) / 180) / 2;
    frameRef.current.target.set(0, size.y / 2, 0);
    frameRef.current.radius = (size.length() / 2 / Math.sin(halfFov)) * 1.05;
    sphericalRef.current = {
      radius: frameRef.current.radius,
      theta: Math.PI / 4,
      phi: Math.PI / 3.2,
    };
    updateCameraPosition();

    if (gridRef.current) {
      scene.remove(gridRef.current);
      gridRef.current.dispose();
      gridRef.current = null;
    }
    const gridSize = Math.ceil(Math.max(size.x, size.z) / 100) * 100 + 100;
    const grid = new THREE.GridHelper(gridSize, Math.round(gridSize / 25), 0x94a3b8, 0xd1d5db);
    grid.position.y = -0.1;
    scene.add(grid);
    gridRef.current = grid;
  }, [pkg, updateCameraPosition]);

  // Overlay da face ativa
  useEffect(() => {
    const overlay = overlayRef.current;
    const partsGroup = partsGroupRef.current;
    if (!overlay || !partsGroup || !pkg) return;

    const bodyPart = pkg.parts.find((part) => part.objectId === pkg.bodyObjectId);
    if (!bodyPart) return;

    const matrix = transformMatrix(bodyPart.buildTransform);
    const normal = normalAt(config, variant).transformDirection(matrix);
    const axis = BODY_AXIS.clone().transformDirection(matrix);
    const origin = new THREE.Vector3(0, 0, axisCenterY(config))
      .applyMatrix4(matrix)
      .addScaledVector(normal, surfaceOffset(variant) + OVERLAY_OFFSET);

    const localX = new THREE.Vector3().crossVectors(axis, normal);
    if (localX.lengthSq() < 1e-8) return;
    localX.normalize();
    const localY = axis.clone().normalize();
    const localZ = new THREE.Vector3().crossVectors(localX, localY).normalize();

    overlay.matrix.makeBasis(localX, localY, localZ);
    overlay.matrix.setPosition(origin);
    overlay.matrixWorldNeedsUpdate = true;
    overlay.visible = true;
  }, [pkg, config, variant]);

  useEffect(() => {
    const mesh = lettersMeshRef.current;
    if (!mesh) return;
    if (!pkg || !generated || !showNegative) {
      mesh.visible = false;
      return;
    }

    const bodyPart = pkg.parts.find((part) => part.objectId === pkg.bodyObjectId);
    if (!bodyPart) {
      mesh.visible = false;
      return;
    }

    const previous = mesh.geometry;
    mesh.geometry = generated.letters;
    if (previous !== generated.letters) previous.dispose();

    (mesh.material as THREE.MeshStandardMaterial).color.set(
      pkg.filamentColors[config.filamentIndex - 1] || '#9ca3af'
    );

    mesh.matrix
      .copy(transformMatrix(bodyPart.buildTransform))
      .multiply(letterPlacementMatrix(config, generated.clampedDepth));
    mesh.matrixWorldNeedsUpdate = true;
    mesh.visible = true;
  }, [pkg, generated, showNegative, config]);

  // Negativo (corpo rebaixado) × corpo sólido
  useEffect(() => {
    const mesh = bodyMeshRef.current;
    if (!mesh || !pkg) return;
    mesh.geometry = showNegative && generated ? generated.bodyGraved : pkg.bodyPart.geometry;
  }, [pkg, generated, showNegative]);

  // Órbita + zoom
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
    const handleMouseLeave = () => {
      isDraggingRef.current = false;
      container.style.cursor = 'grab';
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(
        40,
        Math.min(2400, sphericalRef.current.radius + e.deltaY * 0.25)
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
  }, [updateCameraPosition]);

  const handleResetCamera = () => {
    sphericalRef.current = {
      radius: frameRef.current.radius,
      theta: Math.PI / 4,
      phi: Math.PI / 3.2,
    };
    updateCameraPosition();
  };

  const wall = generated ? `${generated.wallThickness.toFixed(2)}` : '—';
  const depth = generated ? generated.clampedDepth.toFixed(2) : config.depth.toFixed(2);
  const warn = generated && (generated.textTooWide || generated.textTooLong);

  return (
    <div className="relative w-full h-full bg-[var(--workbench-viewport)] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full outline-none select-none" />

      {!pkg && (
        <div className="absolute inset-0 z-20 flex items-center justify-center text-xs text-[var(--on-surface-variant)]">
          Carregando modelo…
        </div>
      )}

      {isGenerating && (
        <div className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full bg-[var(--workbench-panel)]/90 border border-amber-500/30 shadow-lg backdrop-blur-md flex items-center gap-2 text-xs text-amber-300">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <span>Gerando negativo…</span>
        </div>
      )}

      {warn && generated && (
        <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-full bg-[var(--workbench-panel)]/90 border border-amber-500/40 shadow-lg backdrop-blur-md flex items-center gap-2 text-xs text-amber-300 max-w-[min(90%,26rem)]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {generated.textTooWide
              ? 'Texto mais largo que a face — reduza a altura ou o espaçamento.'
              : 'Texto excede a área de gravação — reduza o texto.'}
          </span>
        </div>
      )}

      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--workbench-panel)]/90 border-[var(--surface-container-high)] backdrop-blur-md shadow-xl">
        <button
          type="button"
          onClick={handleResetCamera}
          className="p-2 rounded-xl text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)] transition-colors"
          title="Restaurar Visão Padrão"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-[var(--surface-container-high)] mx-1" />
        <button
          type="button"
          onClick={() => setShowNegative((value) => !value)}
          className={`p-2 rounded-xl transition-colors ${
            showNegative
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]'
          }`}
          title={showNegative ? 'Ocultar negativo' : 'Mostrar negativo'}
        >
          {showNegative ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      <div className="absolute bottom-5 right-5 z-20 hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[var(--workbench-panel)]/90 border-[var(--surface-container-high)] backdrop-blur-md shadow-xl text-xs text-[var(--on-surface-variant)]">
        <div className="flex items-center gap-1.5">
          <span>Parede:</span>
          <span className="font-mono font-bold text-amber-400">{wall} mm</span>
        </div>
        <div className="w-px h-4 bg-[var(--surface-container-high)]" />
        <div className="flex items-center gap-1.5">
          <span>Prof.:</span>
          <span className="font-mono font-bold text-amber-400">{depth} mm</span>
        </div>
        <div className="w-px h-4 bg-[var(--surface-container-high)]" />
        <div className="flex items-center gap-1.5">
          <span>{variant.placement === 'angle' ? 'Ângulo:' : 'Face:'}</span>
          <span className="font-mono font-bold text-[var(--workbench-text)]">
            {variant.placement === 'angle' ? `${Math.round(config.angleDeg)}°` : config.face}
          </span>
        </div>
      </div>
    </div>
  );
};
