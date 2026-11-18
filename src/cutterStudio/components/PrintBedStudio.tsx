import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  PRINTER_BED_PRESETS,
  PrinterBedPreset,
  BedItem,
  NestingOptions,
  autoNestBedItems,
  exportPlateMeshesToSTL,
} from '../utils/printBedNesting';
import { ModelLineart, ModelSettings, FilamentColor } from '../types';
import { PRESET_MODELS } from '../data/presets';
import { generateCutterMesh, generateStampMesh } from '../utils/meshGenerator';
import { downloadBlob } from '../utils/stlExporter';
import {
  LayoutGrid,
  Printer,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Plus,
  Trash2,
  Copy,
  Download,
  X,
  Maximize2,
  Minimize2,
  Layers,
  Clock,
  Scale,
  RefreshCw,
  FolderOpen,
  Info,
  ChevronRight,
  Move,
} from 'lucide-react';

interface PrintBedStudioProps {
  isOpen: boolean;
  onClose: () => void;
  activeModel: ModelLineart;
  activeSettings: ModelSettings;
  filamentList: FilamentColor[];
}

export const PrintBedStudio: React.FC<PrintBedStudioProps> = ({
  isOpen,
  onClose,
  activeModel,
  activeSettings,
  filamentList,
}) => {
  // Printer Bed Configuration
  const [selectedPresetId, setSelectedPresetId] = useState<string>('bambu_x1');
  const [bedWidth, setBedWidth] = useState<number>(256);
  const [bedDepth, setBedDepth] = useState<number>(256);
  const [spacing, setSpacing] = useState<number>(5);
  const [margin, setMargin] = useState<number>(6);
  const [allowRotation, setAllowRotation] = useState<boolean>(true);

  // Items on Bed
  const [items, setItems] = useState<BedItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Three.js 3D Viewport Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const bedMeshRef = useRef<THREE.Group | null>(null);
  const itemsGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initial population: add 1 pair (cutter + stamp) of current model if empty
  useEffect(() => {
    if (isOpen && items.length === 0) {
      const cutterItem: BedItem = {
        id: `cutter_${Date.now()}_1`,
        model: activeModel,
        settings: { ...activeSettings },
        part: 'cutter',
        label: `${activeModel.name} (Cortador)`,
        widthMm: activeSettings.targetWidth + activeSettings.lipWidth * 2,
        depthMm: activeSettings.targetHeight + activeSettings.lipWidth * 2,
        posX: -45,
        posY: 0,
        rotationDeg: 0,
        isOutOfBounds: false,
        colorHex: '#38bdf8', // Ice blue / cutter
      };

      const stampItem: BedItem = {
        id: `stamp_${Date.now()}_2`,
        model: activeModel,
        settings: { ...activeSettings },
        part: 'stamp',
        label: `${activeModel.name} (Carimbo)`,
        widthMm: activeSettings.targetWidth,
        depthMm: activeSettings.targetHeight,
        posX: 45,
        posY: 0,
        rotationDeg: 0,
        isOutOfBounds: false,
        colorHex: '#f472b6', // Pink / stamp
      };

      setItems([cutterItem, stampItem]);
    }
  }, [isOpen, activeModel, activeSettings]);

  // Handle preset change
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PRINTER_BED_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setBedWidth(preset.widthMm);
      setBedDepth(preset.depthMm);
    }
  };

  // Run Auto-Nesting Optimization
  const handleAutoNest = useCallback(() => {
    if (items.length === 0) return;

    const nestingOpts: NestingOptions = {
      bedWidthMm: bedWidth,
      bedDepthMm: bedDepth,
      spacingMm: spacing,
      marginMm: margin,
      allowRotation,
    };

    const res = autoNestBedItems(items, nestingOpts);
    setItems(res.items);
  }, [items, bedWidth, bedDepth, spacing, margin, allowRotation]);

  // Calculate Nesting Metrics
  const nestingResult = useMemo(() => {
    return autoNestBedItems(items, {
      bedWidthMm: bedWidth,
      bedDepthMm: bedDepth,
      spacingMm: spacing,
      marginMm: margin,
      allowRotation,
    });
  }, [items, bedWidth, bedDepth, spacing, margin, allowRotation]);

  // Add Item to Bed
  const handleAddItem = (model: ModelLineart, part: 'cutter' | 'stamp' | 'both') => {
    const newItems: BedItem[] = [];

    if (part === 'cutter' || part === 'both') {
      newItems.push({
        id: `item_${Date.now()}_c_${Math.random().toString(36).substring(2, 6)}`,
        model,
        settings: { ...activeSettings },
        part: 'cutter',
        label: `${model.name} (Cortador)`,
        widthMm: activeSettings.targetWidth + activeSettings.lipWidth * 2,
        depthMm: activeSettings.targetHeight + activeSettings.lipWidth * 2,
        posX: (Math.random() - 0.5) * 60,
        posY: (Math.random() - 0.5) * 60,
        rotationDeg: 0,
        isOutOfBounds: false,
        colorHex: '#38bdf8',
      });
    }

    if (part === 'stamp' || part === 'both') {
      newItems.push({
        id: `item_${Date.now()}_s_${Math.random().toString(36).substring(2, 6)}`,
        model,
        settings: { ...activeSettings },
        part: 'stamp',
        label: `${model.name} (Carimbo)`,
        widthMm: activeSettings.targetWidth,
        depthMm: activeSettings.targetHeight,
        posX: (Math.random() - 0.5) * 60,
        posY: (Math.random() - 0.5) * 60,
        rotationDeg: 0,
        isOutOfBounds: false,
        colorHex: '#f472b6',
      });
    }

    const updated = [...items, ...newItems];
    // Re-pack automatically for convenience
    const res = autoNestBedItems(updated, {
      bedWidthMm: bedWidth,
      bedDepthMm: bedDepth,
      spacingMm: spacing,
      marginMm: margin,
      allowRotation,
    });
    setItems(res.items);
  };

  // Add Multiple Copies of Current Model
  const handleAddBatchCopies = (copies: number) => {
    const batch: BedItem[] = [];
    for (let i = 0; i < copies; i++) {
      batch.push({
        id: `cutter_batch_${Date.now()}_${i}`,
        model: activeModel,
        settings: { ...activeSettings },
        part: 'cutter',
        label: `${activeModel.name} #${i + 1}`,
        widthMm: activeSettings.targetWidth + activeSettings.lipWidth * 2,
        depthMm: activeSettings.targetHeight + activeSettings.lipWidth * 2,
        posX: 0,
        posY: 0,
        rotationDeg: 0,
        isOutOfBounds: false,
        colorHex: '#38bdf8',
      });
    }

    const updated = [...items, ...batch];
    const res = autoNestBedItems(updated, {
      bedWidthMm: bedWidth,
      bedDepthMm: bedDepth,
      spacingMm: spacing,
      marginMm: margin,
      allowRotation,
    });
    setItems(res.items);
  };

  // Rotate single item 90 degrees
  const handleRotateItem = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const newRot = (it.rotationDeg + 90) % 360;
        // Swap width and depth
        const newW = it.depthMm;
        const newD = it.widthMm;
        return {
          ...it,
          rotationDeg: newRot,
          widthMm: newW,
          depthMm: newD,
        };
      })
    );
  };

  // Duplicate single item
  const handleDuplicateItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const dup: BedItem = {
      ...item,
      id: `dup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      posX: item.posX + 10,
      posY: item.posY + 10,
    };
    const updated = [...items, dup];
    // Repack so the duplicate does not overlap the original and stored
    // positions match the displayed nesting layout.
    const res = autoNestBedItems(updated, {
      bedWidthMm: bedWidth,
      bedDepthMm: bedDepth,
      spacingMm: spacing,
      marginMm: margin,
      allowRotation,
    });
    setItems(res.items);
  };

  // Remove single item
  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    if (selectedItemId === itemId) setSelectedItemId(null);
  };

  // Clear bed
  const handleClearBed = () => {
    setItems([]);
    setSelectedItemId(null);
  };

  // 3D Scene Initialization
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f3ed);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    camera.position.set(0, -320, 360);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;
    controls.minDistance = 80;
    controls.maxDistance = 1200;
    controlsRef.current = controls;

    // Lighting setup for realistic 3D build plate
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight1.position.set(200, -200, 350);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.5);
    dirLight2.position.set(-200, 200, 250);
    scene.add(dirLight2);

    const itemsGroup = new THREE.Group();
    itemsGroup.name = 'itemsGroup';
    scene.add(itemsGroup);
    itemsGroupRef.current = itemsGroup;

    // Render loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      renderer.dispose();
      controls.dispose();
    };
  }, [isOpen]);

  // Build Plate 3D Geometry (Updates when Bed Dimensions change)
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove old bed group
    if (bedMeshRef.current) {
      scene.remove(bedMeshRef.current);
      bedMeshRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      bedMeshRef.current = null;
    }

    const bedGroup = new THREE.Group();
    bedGroup.name = 'bedGroup';

    // 1. Base Plate (Dark textured PEI / Spring Steel sheet)
    const plateGeom = new THREE.BoxGeometry(bedWidth, bedDepth, 3);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xe8e9e3,
      roughness: 0.85,
      metalness: 0.25,
    });
    const plateMesh = new THREE.Mesh(plateGeom, plateMat);
    plateMesh.position.set(0, 0, -1.5);
    plateMesh.receiveShadow = true;
    bedGroup.add(plateMesh);

    // 2. Grid lines
    const gridHelper = new THREE.GridHelper(
      Math.max(bedWidth, bedDepth),
      Math.round(Math.max(bedWidth, bedDepth) / 10),
      0xcac3d8,
      0xdde1d8
    );
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.set(0, 0, 0.05);
    bedGroup.add(gridHelper);

    // 3. Printable area boundary line (shows margin)
    const usableW = bedWidth - margin * 2;
    const usableD = bedDepth - margin * 2;
    const marginGeom = new THREE.BufferGeometry();
    const halfW = usableW / 2;
    const halfD = usableD / 2;
    const points = [
      new THREE.Vector3(-halfW, -halfD, 0.1),
      new THREE.Vector3(halfW, -halfD, 0.1),
      new THREE.Vector3(halfW, halfD, 0.1),
      new THREE.Vector3(-halfW, halfD, 0.1),
      new THREE.Vector3(-halfW, -halfD, 0.1),
    ];
    marginGeom.setFromPoints(points);
    const marginMat = new THREE.LineDashedMaterial({
      color: 0x06b6d4,
      dashSize: 4,
      gapSize: 3,
      linewidth: 1.5,
    });
    const marginLine = new THREE.Line(marginGeom, marginMat);
    marginLine.computeLineDistances();
    bedGroup.add(marginLine);

    // 4. Center Crosshair
    const crossGeom = new THREE.BufferGeometry();
    const crossPts = [
      new THREE.Vector3(-15, 0, 0.15),
      new THREE.Vector3(15, 0, 0.15),
      new THREE.Vector3(0, -15, 0.15),
      new THREE.Vector3(0, 15, 0.15),
    ];
    crossGeom.setFromPoints(crossPts);
    const crossMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
    const crossLine = new THREE.LineSegments(crossGeom, crossMat);
    bedGroup.add(crossLine);

    scene.add(bedGroup);
    bedMeshRef.current = bedGroup;
  }, [bedWidth, bedDepth, margin]);

  // Render 3D Items on Bed
  useEffect(() => {
    if (!itemsGroupRef.current) return;
    const group = itemsGroupRef.current;

    // Clear old items
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    // Build real 3D meshes for each item on bed
    items.forEach((item) => {
      const itemGroup = new THREE.Group();
      itemGroup.position.set(item.posX, item.posY, 0);
      itemGroup.rotation.z = (item.rotationDeg * Math.PI) / 180;
      itemGroup.name = item.id;

      // Base Material
      const isSelected = item.id === selectedItemId;
      const isOut = item.isOutOfBounds;

      let color = isOut ? 0xdc2626 : isSelected ? 0x7c4dff : item.part === 'cutter' ? 0x38bdf8 : 0xf472b6;

      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.15,
        emissive: isSelected ? 0x632ce5 : isOut ? 0xdc2626 : 0x000000,
        emissiveIntensity: isSelected || isOut ? 0.35 : 0,
      });

      let mesh: THREE.Mesh | null = null;
      if (item.part === 'cutter') {
        mesh = generateCutterMesh(item.model, item.settings, mat);
      } else {
        mesh = generateStampMesh(item.model, item.settings, mat);
      }

      if (mesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        itemGroup.add(mesh);
      }

      // Add boundary highlight footprint on bed
      const fpGeom = new THREE.BufferGeometry();
      const hw = item.widthMm / 2;
      const hd = item.depthMm / 2;
      const fpPts = [
        new THREE.Vector3(-hw, -hd, 0.2),
        new THREE.Vector3(hw, -hd, 0.2),
        new THREE.Vector3(hw, hd, 0.2),
        new THREE.Vector3(-hw, hd, 0.2),
        new THREE.Vector3(-hw, -hd, 0.2),
      ];
      fpGeom.setFromPoints(fpPts);
      const fpMat = new THREE.LineBasicMaterial({
        color: isOut ? 0xdc2626 : isSelected ? 0x632ce5 : 0xcac3d8,
        linewidth: isSelected ? 2 : 1,
      });
      const fpLine = new THREE.Line(fpGeom, fpMat);
      itemGroup.add(fpLine);

      group.add(itemGroup);
    });
  }, [items, selectedItemId]);

  // Export Combined Plate STL
  const handleExportPlateSTL = async () => {
    if (items.length === 0) return;
    setIsExporting(true);

    try {
      const meshesToCombine: THREE.Mesh[] = [];

      items.forEach((item) => {
        const dummyMat = new THREE.MeshBasicMaterial();
        let mesh: THREE.Mesh | null = null;
        if (item.part === 'cutter') {
          mesh = generateCutterMesh(item.model, item.settings, dummyMat);
        } else {
          mesh = generateStampMesh(item.model, item.settings, dummyMat);
        }

        if (mesh) {
          mesh.position.set(item.posX, item.posY, 0);
          mesh.rotation.z = (item.rotationDeg * Math.PI) / 180;
          mesh.updateMatrix();
          mesh.updateMatrixWorld(true);
          meshesToCombine.push(mesh);
        }
      });

      const stlBuffer = exportPlateMeshesToSTL(meshesToCombine);
      const blob = new Blob([stlBuffer], { type: 'application/octet-stream' });
      downloadBlob(blob, `Mesa_Cortadores_${items.length}_itens_${bedWidth}x${bedDepth}.stl`);
    } catch (err) {
      console.error('Falha ao exportar STL da mesa:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const currentPreset = PRINTER_BED_PRESETS.find((p) => p.id === selectedPresetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 lg:p-4 bg-[var(--inverse-surface)]/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl h-[94vh] bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 px-6 border-b border-[var(--surface-container-high)] flex items-center justify-between bg-[var(--workbench-page)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--primary-fixed)] border border-[var(--primary)] rounded-xl text-[var(--primary)]">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--on-surface)] flex items-center gap-2">
                <span>Layout de Impressão 3D (Otimizador de Mesa)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--primary-fixed)] text-[var(--primary)] border border-[var(--primary)] uppercase">
                  Nesting Automático
                </span>
              </h2>
              <p className="text-[11px] text-[var(--on-surface-variant)]">
                Organize múltiplos cortadores e carimbos na mesa da sua impressora com máxima economia de espaço e tempo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPlateSTL}
              disabled={items.length === 0 || isExporting}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-container)] disabled:opacity-40 text-[var(--on-primary)] font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Gerando STL...' : `Baixar Mesa STL (${items.length} peças)`}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-xl hover:bg-[var(--surface-container-low)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Workspace */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Center 3D Viewport Area */}
          <div className="flex-1 relative h-full bg-[var(--workbench-page)] flex flex-col">
            <div ref={containerRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

            {/* Viewport Overlay HUD */}
            <div className="absolute top-4 left-4 bg-[var(--workbench-panel)] backdrop-blur-md px-3.5 py-2 rounded-xl border border-[var(--surface-container-high)] text-xs text-[var(--on-surface)] shadow-xl flex items-center gap-3 pointer-events-none">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[var(--primary)]" />
                <span className="font-semibold text-[var(--on-surface)]">
                  {currentPreset?.name || 'Mesa Personalizada'}
                </span>
                <span className="font-mono text-[var(--primary)] text-[11px]">
                  ({bedWidth} x {bedDepth} mm)
                </span>
              </div>
              <span className="text-[var(--workbench-muted)]">|</span>
              <span className="text-[var(--on-surface-variant)]">
                {items.length} {items.length === 1 ? 'peça' : 'peças'} na mesa
              </span>
            </div>

            {/* Status Feedback Banner */}
            <div className="absolute top-4 right-4 max-w-sm pointer-events-none">
              {nestingResult.allFit ? (
                <div className="bg-emerald-100 border border-emerald-300 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs text-emerald-700 shadow-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <p className="font-semibold leading-tight">Todos os cortadores cabem na mesa!</p>
                    <p className="text-[10px] text-emerald-700">
                      Ocupação: {nestingResult.occupancyPercent}% da área útil da impressora.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-[#FEE2E2] border border-[var(--error)] backdrop-blur-md px-3.5 py-2 rounded-xl text-xs text-[var(--error)] shadow-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[var(--error)] shrink-0" />
                  <div>
                    <p className="font-semibold leading-tight">Peças ultrapassam o limite da mesa!</p>
                    <p className="text-[10px] text-[var(--error)]">
                      Reduza o espaçamento ou divida o lote em duas impressões.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Floating Quick Action Bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[var(--workbench-panel)] backdrop-blur-md p-2 px-3 rounded-2xl border border-[var(--surface-container-highest)] shadow-2xl flex items-center gap-2">
              <button
                onClick={handleAutoNest}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                title="Executar algoritmo de organização automática na mesa"
              >
                <Sparkles className="w-4 h-4" />
                <span>Organizar Automaticamente (Nesting)</span>
              </button>

              <button
                onClick={() => handleAddItem(activeModel, 'both')}
                className="flex items-center gap-1 px-3 py-2 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface)] text-xs rounded-xl border border-[var(--surface-container-highest)] transition-colors cursor-pointer"
                title="Adicionar par (Cortador + Carimbo) do modelo ativo"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>+1 Par Atual</span>
              </button>

              <button
                onClick={() => handleAddBatchCopies(4)}
                className="flex items-center gap-1 px-3 py-2 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface)] text-xs rounded-xl border border-[var(--surface-container-highest)] transition-colors cursor-pointer"
                title="Adicionar 4 cópias do cortador na mesa"
              >
                <Copy className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>+4 Cortadores</span>
              </button>

              <button
                onClick={() => setIsLibraryPickerOpen(true)}
                className="flex items-center gap-1 px-3 py-2 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface)] text-xs rounded-xl border border-[var(--surface-container-highest)] transition-colors cursor-pointer"
                title="Escolher outro formato na biblioteca de modelos"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Biblioteca...</span>
              </button>
            </div>
          </div>

          {/* Right Sidebar: Settings, Item Queue & Metrics (400px) */}
          <div className="w-full lg:w-[420px] bg-[var(--workbench-page)] border-l border-[var(--surface-container-high)] flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-[var(--surface-container-high)] flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--on-surface)] uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[var(--primary)]" />
                <span>Configuração da Mesa & Otimização</span>
              </h3>
              <button
                onClick={handleClearBed}
                className="text-[11px] text-[var(--workbench-muted)] hover:text-[var(--error)] transition-colors"
              >
                Limpar Mesa
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Printer Preset Selector */}
              <div className="p-3.5 bg-[var(--workbench-panel)] rounded-xl border border-[var(--surface-container-high)] space-y-3">
                <label className="text-xs font-medium text-[var(--on-surface-variant)] block">
                  Modelo da Impressora 3D:
                </label>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[var(--workbench-page)] border border-[var(--surface-container-highest)] rounded-lg text-[var(--on-surface)] focus:outline-none focus:border-[var(--primary)]"
                >
                  {PRINTER_BED_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.widthMm} x {p.depthMm} mm)
                    </option>
                  ))}
                </select>

                {/* Custom dimensions if needed */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] text-[var(--on-surface-variant)] block mb-1">Largura X (mm):</span>
                    <input
                      type="number"
                      min={100}
                      max={500}
                      value={bedWidth}
                      onChange={(e) => setBedWidth(Math.max(80, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 text-xs bg-[var(--workbench-page)] border border-[var(--surface-container-highest)] rounded-lg text-[var(--on-surface)] font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--on-surface-variant)] block mb-1">Profundidade Y (mm):</span>
                    <input
                      type="number"
                      min={100}
                      max={500}
                      value={bedDepth}
                      onChange={(e) => setBedDepth(Math.max(80, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 text-xs bg-[var(--workbench-page)] border border-[var(--surface-container-highest)] rounded-lg text-[var(--on-surface)] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Nesting Parameters */}
              <div className="p-3.5 bg-[var(--workbench-panel)] rounded-xl border border-[var(--surface-container-high)] space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
                  <span>Espaçamento Entre Peças:</span>
                  <span className="font-mono text-[var(--primary)]">{spacing} mm</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="14"
                  value={spacing}
                  onChange={(e) => setSpacing(Number(e.target.value))}
                  className="w-full accent-[var(--primary)] cursor-pointer"
                />

                <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] pt-2 border-t border-[var(--surface-container-high)]">
                  <span>Margem da Borda da Mesa:</span>
                  <span className="font-mono text-[var(--primary)]">{margin} mm</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="15"
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="w-full accent-[var(--primary)] cursor-pointer"
                />

                <div className="flex items-center justify-between pt-2 border-t border-[var(--surface-container-high)] text-xs">
                  <span className="text-[var(--on-surface-variant)]">Permitir Rotação 90° (Melhor Encaixe)</span>
                  <button
                    onClick={() => setAllowRotation(!allowRotation)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                      allowRotation ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold' : 'bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]'
                    }`}
                  >
                    {allowRotation ? 'Ativo' : 'Desativado'}
                  </button>
                </div>
              </div>

              {/* Batch Print Estimation Metrics */}
              <div className="p-3.5 bg-[var(--workbench-panel)] rounded-xl border border-[var(--surface-container-high)] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--on-surface-variant)] font-medium">Ocupação da Área da Mesa:</span>
                  <span
                    className={`font-mono font-bold ${
                      nestingResult.allFit ? 'text-emerald-700' : 'text-[var(--error)]'
                    }`}
                  >
                    {nestingResult.occupancyPercent}%
                  </span>
                </div>

                <div className="w-full bg-[var(--workbench-page)] h-2 rounded-full overflow-hidden border border-[var(--surface-container-high)]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      nestingResult.allFit ? 'bg-emerald-600' : 'bg-[var(--error)]'
                    }`}
                    style={{ width: `${Math.min(100, nestingResult.occupancyPercent)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2 bg-[var(--workbench-page)] rounded-lg border border-[var(--surface-container-high)]">
                    <span className="text-[10px] text-[var(--on-surface-variant)] flex items-center gap-1 mb-0.5">
                      <Scale className="w-3 h-3 text-[var(--primary)]" />
                      Peso Total Estimado
                    </span>
                    <p className="font-mono font-bold text-[var(--on-surface)]">
                      ~{nestingResult.totalFilamentGrams} g
                    </p>
                  </div>

                  <div className="p-2 bg-[var(--workbench-page)] rounded-lg border border-[var(--surface-container-high)]">
                    <span className="text-[10px] text-[var(--on-surface-variant)] flex items-center gap-1 mb-0.5">
                      <Clock className="w-3 h-3 text-[var(--primary)]" />
                      Tempo Total do Lote
                    </span>
                    <p className="font-mono font-bold text-[var(--on-surface)]">
                      ~{Math.floor(nestingResult.totalTimeMinutes / 60)}h{' '}
                      {nestingResult.totalTimeMinutes % 60}m
                    </p>
                  </div>
                </div>
              </div>

              {/* Items on Bed Queue */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--on-surface-variant)]">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Peças na Mesa ({items.length})</span>
                  </span>
                  <span className="text-[10px] text-[var(--workbench-muted)]">
                    Azul = Cortador | Rosa = Carimbo
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {items.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[var(--workbench-muted)] border border-dashed border-[var(--surface-container-high)] rounded-xl">
                      A mesa está vazia. Adicione cortadores usando os botões rápidos.
                    </div>
                  ) : (
                    items.map((it, idx) => {
                      const isSelected = it.id === selectedItemId;
                      return (
                        <div
                          key={it.id}
                          onClick={() => setSelectedItemId(it.id)}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            it.isOutOfBounds
                              ? 'bg-[#FEE2E2] border-[var(--error)] text-[var(--error)]'
                              : isSelected
                              ? 'bg-[var(--primary-fixed)] border-[var(--primary)] text-[var(--primary)]'
                              : 'bg-[var(--workbench-panel)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:border-[var(--surface-container-highest)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: it.part === 'cutter' ? '#38bdf8' : '#f472b6' }}
                            />
                            <div className="truncate">
                              <p className="font-medium text-[11px] truncate leading-tight">
                                {it.label}
                              </p>
                              <p className="text-[10px] text-[var(--on-surface-variant)] font-mono">
                                {Math.round(it.widthMm)} x {Math.round(it.depthMm)} mm • {it.rotationDeg}°
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRotateItem(it.id);
                              }}
                              className="p-1 hover:bg-[var(--surface-container-low)] rounded text-[var(--on-surface-variant)] hover:text-[var(--primary)] transition-colors"
                              title="Girar 90 graus"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateItem(it.id);
                              }}
                              className="p-1 hover:bg-[var(--surface-container-low)] rounded text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
                              title="Duplicar peça"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveItem(it.id);
                              }}
                              className="p-1 hover:bg-[var(--surface-container-low)] rounded text-[var(--on-surface-variant)] hover:text-[var(--error)] transition-colors"
                              title="Remover peça"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Library Model Picker Modal */}
      {isLibraryPickerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[var(--inverse-surface)]/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-2xl w-full max-w-xl p-5 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--on-surface)] flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[var(--primary)]" />
                <span>Escolher Modelo da Biblioteca para a Mesa</span>
              </h3>
              <button
                onClick={() => setIsLibraryPickerOpen(false)}
                className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--on-surface-variant)]">
              Selecione outro formato para adicionar à mesma impressão:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {PRESET_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    handleAddItem(model, 'both');
                    setIsLibraryPickerOpen(false);
                  }}
                  className="p-2.5 bg-[var(--workbench-page)] border border-[var(--surface-container-high)] hover:border-[var(--primary)] rounded-xl text-left transition-colors flex flex-col gap-1 cursor-pointer"
                >
                  <span className="font-semibold text-xs text-[var(--on-surface)] truncate">
                    {model.name}
                  </span>
                  <span className="text-[10px] text-[var(--workbench-muted)] capitalize">
                    {model.categoryLabel}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
