import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Upload,
  Layers,
  Settings,
  Download,
  Eye,
  Sliders,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Box,
  Split,
  ChevronRight,
  Maximize2,
  FileCheck,
  Flame,
  PackageCheck,
  RotateCw,
  Info,
  FileUp,
  CheckCircle2,
  Scale,
  X,
} from 'lucide-react';
import {
  MoldConfig,
  MoldType,
  MoldShape,
  createSample3DModel,
  prepareTargetGeometry,
  generateMoldFromObject,
  GeneratedMoldResult,
} from '../utils/moldGenerator';
import {
  parse3DModelFile,
  Parsed3DModelInfo,
  exportMeshToSTL,
  downloadBlob,
  exportMoldPackageZip,
} from '../utils/model3DLoader';

interface MoldStudioPageProps {
  onBackToCutters: () => void;
  initialFile?: File | null;
}

export const MoldStudioPage: React.FC<MoldStudioPageProps> = ({ onBackToCutters, initialFile }) => {
  // Model state
  const [modelName, setModelName] = useState<string>('Ursinho_Mascote');
  const [targetGeometry, setTargetGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [rawGeometry, setRawGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [targetSizeMm, setTargetSizeMm] = useState<number>(50);
  const [scaleMode, setScaleMode] = useState<'fit' | 'original'>('fit');
  const [isCustomUpload, setIsCustomUpload] = useState<boolean>(false);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    name: string;
    sizeFormatted: string;
    triangles: number;
    origDimensions: { width: number; height: number; depth: number };
  } | null>(null);

  const [modelStats, setModelStats] = useState<{
    width: number;
    height: number;
    depth: number;
    triangles: number;
  }>({ width: 45, height: 42, depth: 38, triangles: 3400 });

  // Drag and drop state
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Mold Configuration state
  const [config, setConfig] = useState<MoldConfig>({
    type: 'two_part',
    shape: 'box',
    wallThickness: 10,
    floorThickness: 8,
    splitPlaneRatio: 0.5,
    pourSpout: true,
    pourSpoutDiameter: 12,
    airVents: true,
    airVentDiameter: 3.5,
    alignmentPins: true,
    pinSize: 6,
    draftAngle: 2,
    scale: 1,
    explodeDistance: 0,
  });

  // Display and preview modes
  const [viewMode, setViewMode] = useState<'mold' | 'xray' | 'cast' | 'original'>('mold');
  const [moldColor, setMoldColor] = useState<string>('#38bdf8'); // sky blue
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  // Three.js refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const moldResultRef = useRef<GeneratedMoldResult | null>(null);
  const moldGroupRef = useRef<THREE.Group | null>(null);

  // Load initial file if provided, otherwise default sample model on mount
  useEffect(() => {
    if (initialFile) {
      processUploaded3DFile(initialFile);
      return;
    }

    const sample = createSample3DModel('bear');
    setRawGeometry(sample);
    const defaultGeo = prepareTargetGeometry(sample, targetSizeMm);
    setTargetGeometry(defaultGeo);

    defaultGeo.computeBoundingBox();
    const box = defaultGeo.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const triCount = defaultGeo.index
      ? defaultGeo.index.count / 3
      : (defaultGeo.attributes.position?.count || 0) / 3;

    setModelStats({
      width: Math.round(size.x * 10) / 10,
      height: Math.round(size.y * 10) / 10,
      depth: Math.round(size.z * 10) / 10,
      triangles: Math.round(triCount),
    });
  }, [initialFile]);

  // Initialize Three.js viewport
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(100, -110, 95);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0, 15);
    controlsRef.current = controls;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xfff5e6, 1.8);
    dirLight1.position.set(60, -70, 120);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x99ccff, 1.1);
    dirLight2.position.set(-80, 80, 70);
    scene.add(dirLight2);

    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.6);
    rimLight.position.set(0, 0, -80);
    scene.add(rimLight);

    // Build Plate Grid
    const grid = new THREE.GridHelper(180, 18, 0x334155, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.1;
    scene.add(grid);

    // Group for mold meshes
    const moldGroup = new THREE.Group();
    scene.add(moldGroup);
    moldGroupRef.current = moldGroup;

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
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
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Compute 3D Mold whenever targetGeometry or config changes
  useEffect(() => {
    if (!targetGeometry || !sceneRef.current || !moldGroupRef.current) return;

    let isMounted = true;
    setIsProcessing(true);
    setProgressMsg('Calculando cavidade 3D com corte Booleano CSG...');

    const timer = setTimeout(async () => {
      try {
        // Prepare Materials
        const moldMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(moldColor),
          roughness: 0.28,
          metalness: 0.08,
          transparent: viewMode === 'xray',
          opacity: viewMode === 'xray' ? 0.35 : 1.0,
          depthWrite: viewMode !== 'xray',
        });

        const partAMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(moldColor),
          roughness: 0.32,
          metalness: 0.05,
          transparent: viewMode === 'xray',
          opacity: viewMode === 'xray' ? 0.35 : 1.0,
        });

        const partBMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#3b82f6'), // slightly deeper blue for top part
          roughness: 0.32,
          metalness: 0.05,
          transparent: viewMode === 'xray',
          opacity: viewMode === 'xray' ? 0.35 : 1.0,
        });

        const refMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b, // Warm Amber
          roughness: 0.35,
          metalness: 0.2,
        });

        const result = await generateMoldFromObject(
          targetGeometry,
          config,
          moldMat,
          partAMat,
          partBMat,
          refMat
        );

        if (!isMounted) return;

        moldResultRef.current = result;

        // Clear existing mold meshes from group
        const group = moldGroupRef.current!;
        while (group.children.length > 0) {
          group.remove(group.children[0]);
        }

        // Add meshes depending on view mode
        if (viewMode === 'original') {
          group.add(result.originalObjectMesh);
        } else if (viewMode === 'cast') {
          // Render molded cast simulation (chocolate or resin look)
          const castMat = new THREE.MeshStandardMaterial({
            color: 0x451a03, // chocolate
            roughness: 0.15,
            metalness: 0.05,
          });
          const castMesh = new THREE.Mesh(targetGeometry.clone(), castMat);
          castMesh.castShadow = true;
          castMesh.receiveShadow = true;
          group.add(castMesh);
        } else {
          // Mold view or X-ray view
          if (result.moldMesh) {
            group.add(result.moldMesh);
          }
          if (result.partAMesh) {
            group.add(result.partAMesh);
          }
          if (result.partBMesh) {
            group.add(result.partBMesh);
          }
          if (viewMode === 'xray') {
            // Also add original object inside mold
            group.add(result.originalObjectMesh);
          }
        }

        setIsProcessing(false);
      } catch (err) {
        console.error('Erro gerando molde 3D:', err);
        setIsProcessing(false);
      }
    }, 40);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [targetGeometry, config, viewMode, moldColor]);

  // Handle Explode Distance changes without full CSG recalculation
  const handleExplodeChange = (dist: number) => {
    setConfig((prev) => ({ ...prev, explodeDistance: dist }));
    if (moldResultRef.current?.partAMesh && moldResultRef.current?.partBMesh) {
      moldResultRef.current.partAMesh.position.z = -dist;
      moldResultRef.current.partBMesh.position.z = dist;
    }
  };

  // Process uploaded 3D file (.STL or .OBJ)
  const processUploaded3DFile = async (file: File) => {
    setIsProcessing(true);
    setProgressMsg(`Analisando arquivo 3D: ${file.name}...`);

    try {
      const parsed = await parse3DModelFile(file);
      const raw = parsed.geometry.clone();
      setRawGeometry(raw);
      setIsCustomUpload(true);

      const sizeFormatted =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
          : `${(file.size / 1024).toFixed(1)} KB`;

      setUploadedFileInfo({
        name: file.name,
        sizeFormatted,
        triangles: parsed.faceCount,
        origDimensions: { ...parsed.dimensions },
      });

      // Prepare geometry according to scaleMode
      let appliedGeo: THREE.BufferGeometry;
      if (scaleMode === 'original') {
        const cloned = raw.clone();
        cloned.computeVertexNormals();
        cloned.computeBoundingBox();
        cloned.center();
        if (cloned.boundingBox) {
          cloned.translate(0, 0, -cloned.boundingBox.min.z);
        }
        appliedGeo = cloned;
      } else {
        appliedGeo = prepareTargetGeometry(raw, targetSizeMm);
      }

      setModelName(file.name.replace(/\.[^/.]+$/, ''));
      setTargetGeometry(appliedGeo);

      appliedGeo.computeBoundingBox();
      const box = appliedGeo.boundingBox!;
      const size = new THREE.Vector3();
      box.getSize(size);

      setModelStats({
        width: Math.round(size.x * 10) / 10,
        height: Math.round(size.y * 10) / 10,
        depth: Math.round(size.z * 10) / 10,
        triangles: parsed.faceCount,
      });

      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      alert(`Falha ao carregar arquivo 3D: ${err.message || 'Arquivo corrompido ou formato não suportado.'}`);
      setIsProcessing(false);
    }
  };

  // Handle File Input (.STL or .OBJ)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploaded3DFile(file);
    e.target.value = ''; // Reset input to allow selecting same file again
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'stl' || ext === 'obj') {
        await processUploaded3DFile(file);
      } else {
        alert('Por favor, envie um arquivo 3D com extensão .STL ou .OBJ.');
      }
    }
  };

  // Change target size in mm (e.g. 50mm, 70mm, 90mm)
  const handleTargetSizeChange = (newSize: number) => {
    setTargetSizeMm(newSize);
    setScaleMode('fit');

    const source = rawGeometry || targetGeometry;
    if (source) {
      const resized = prepareTargetGeometry(source, newSize);
      setTargetGeometry(resized);

      resized.computeBoundingBox();
      const size = new THREE.Vector3();
      resized.boundingBox!.getSize(size);

      setModelStats((prev) => ({
        ...prev,
        width: Math.round(size.x * 10) / 10,
        height: Math.round(size.y * 10) / 10,
        depth: Math.round(size.z * 10) / 10,
      }));
    }
  };

  // Switch to exact 1:1 original CAD scale from the imported STL
  const handleToggleOriginalScale = () => {
    if (!rawGeometry) return;
    setScaleMode('original');

    const cloned = rawGeometry.clone();
    cloned.computeVertexNormals();
    cloned.computeBoundingBox();
    cloned.center();
    if (cloned.boundingBox) {
      cloned.translate(0, 0, -cloned.boundingBox.min.z);
    }
    setTargetGeometry(cloned);

    cloned.computeBoundingBox();
    const size = new THREE.Vector3();
    cloned.boundingBox!.getSize(size);

    setModelStats((prev) => ({
      ...prev,
      width: Math.round(size.x * 10) / 10,
      height: Math.round(size.y * 10) / 10,
      depth: Math.round(size.z * 10) / 10,
    }));
  };

  // Rotate Geometry on X, Y, or Z by 90 degrees
  const handleRotateModel = (axis: 'x' | 'y' | 'z') => {
    if (!targetGeometry) return;
    const cloned = targetGeometry.clone();
    if (axis === 'x') cloned.rotateX(Math.PI / 2);
    if (axis === 'y') cloned.rotateY(Math.PI / 2);
    if (axis === 'z') cloned.rotateZ(Math.PI / 2);

    // Keep same scale
    let prepared: THREE.BufferGeometry;
    if (scaleMode === 'original') {
      cloned.computeVertexNormals();
      cloned.computeBoundingBox();
      cloned.center();
      if (cloned.boundingBox) {
        cloned.translate(0, 0, -cloned.boundingBox.min.z);
      }
      prepared = cloned;
    } else {
      prepared = prepareTargetGeometry(cloned, targetSizeMm);
    }

    setTargetGeometry(prepared);
  };

  // Quick preset sample selector
  const handleSelectSample = (sampleKey: 'bear' | 'heart' | 'gem' | 'star' | 'skull', label: string) => {
    const raw = createSample3DModel(sampleKey);
    setRawGeometry(raw);
    setIsCustomUpload(false);
    setUploadedFileInfo(null);
    setScaleMode('fit');

    const geo = prepareTargetGeometry(raw, targetSizeMm);
    setModelName(label);
    setTargetGeometry(geo);

    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const triCount = geo.index ? geo.index.count / 3 : (geo.attributes.position?.count || 0) / 3;

    setModelStats({
      width: Math.round(size.x * 10) / 10,
      height: Math.round(size.y * 10) / 10,
      depth: Math.round(size.z * 10) / 10,
      triangles: Math.round(triCount),
    });
  };

  // Export handlers
  const handleExportSinglePart = (partKey: 'single' | 'partA' | 'partB') => {
    const res = moldResultRef.current;
    if (!res) return;

    if (partKey === 'single' && res.moldMesh) {
      const blob = exportMeshToSTL(res.moldMesh);
      downloadBlob(blob, `Molde_${modelName}_Cavidade_Unica.stl`);
    } else if (partKey === 'partA' && res.partAMesh) {
      const blob = exportMeshToSTL(res.partAMesh);
      downloadBlob(blob, `Molde_${modelName}_Parte_A_Base.stl`);
    } else if (partKey === 'partB' && res.partBMesh) {
      const blob = exportMeshToSTL(res.partBMesh);
      downloadBlob(blob, `Molde_${modelName}_Parte_B_Tampa.stl`);
    }
  };

  const handleExportAllZip = () => {
    const res = moldResultRef.current;
    if (!res) return;

    exportMoldPackageZip(
      modelName,
      {
        singleMold: res.moldMesh,
        partA: res.partAMesh,
        partB: res.partBMesh,
        originalRef: res.originalObjectMesh,
      },
      res.bounds
    );
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans relative"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-4 bg-slate-950/92 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 border-3 border-dashed border-sky-400 rounded-3xl animate-in fade-in duration-150 pointer-events-none shadow-2xl">
          <div className="p-5 rounded-2xl bg-sky-500/20 border border-sky-400/50 mb-4 animate-bounce">
            <FileUp className="w-12 h-12 text-sky-300" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Solte seu arquivo .STL ou .OBJ aqui</h3>
          <p className="text-xs sm:text-sm text-sky-200 text-center max-w-md leading-relaxed">
            O Cookie3D Studio vai carregar seu modelo 3D e gerar automaticamente a cavidade negativa, pinos cónicos e plano de partição!
          </p>
          <span className="mt-4 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-mono font-semibold">
            Formatos aceitos: .STL (binário ou ASCII) e .OBJ
          </span>
        </div>
      )}

      {/* Top Header Navigation */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToCutters}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer border border-slate-700/80"
          >
            <span>← Voltar aos Cortadores</span>
          </button>
          <div className="h-5 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
            <h1 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5">
              <span>Criador de Moldes 3D</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                PRO
              </span>
            </h1>
          </div>
        </div>

        {/* View Mode Pill Switcher */}
        <div className="hidden md:flex items-center p-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setViewMode('mold')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              viewMode === 'mold' ? 'bg-slate-800 text-sky-400 font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Molde 3D
          </button>
          <button
            onClick={() => setViewMode('xray')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              viewMode === 'xray' ? 'bg-slate-800 text-amber-400 font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Raio-X (Cavidade)
          </button>
          <button
            onClick={() => setViewMode('cast')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              viewMode === 'cast' ? 'bg-slate-800 text-amber-300 font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Peça Fundida
          </button>
          <button
            onClick={() => setViewMode('original')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              viewMode === 'original' ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Objeto Importado
          </button>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2">
          {/* Quick Upload Button in Header */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs">
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Enviar Arquivo STL</span>
            <span className="sm:hidden">STL</span>
            <input
              type="file"
              accept=".stl,.obj"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={handleExportAllZip}
            disabled={isProcessing}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Baixar Molde STL (ZIP)</span>
            <span className="sm:hidden">Baixar ZIP</span>
          </button>
        </div>
      </header>

      {/* Main Workspace (Viewport + Sidebar) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left / Center 3D Viewport */}
        <div className="flex-1 relative h-[50vh] lg:h-full bg-gradient-to-b from-slate-950 via-slate-900/90 to-slate-950">
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Processing Spinner Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-30 pointer-events-none">
              <div className="w-9 h-9 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium text-sky-200 tracking-wide">{progressMsg}</p>
            </div>
          )}

          {/* Floating Viewport Quick Controls */}
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 z-10">
            {/* Quick Upload Button */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-sky-500/60 rounded-lg text-xs font-semibold text-slate-200 hover:text-sky-300 shadow-lg backdrop-blur-md transition-all cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Enviar Arquivo 3D (STL / OBJ)</span>
              <input
                type="file"
                accept=".stl,.obj"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Rotation Helpers */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 text-[11px] backdrop-blur-md shadow-lg">
              <span className="text-slate-400 px-1 text-[10px] font-mono">Girar 90°:</span>
              <button
                onClick={() => handleRotateModel('x')}
                className="px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-sky-400 cursor-pointer"
                title="Girar no eixo X"
              >
                X
              </button>
              <button
                onClick={() => handleRotateModel('y')}
                className="px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-sky-400 cursor-pointer"
                title="Girar no eixo Y"
              >
                Y
              </button>
              <button
                onClick={() => handleRotateModel('z')}
                className="px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-sky-400 cursor-pointer"
                title="Girar no eixo Z"
              >
                Z
              </button>
            </div>
          </div>

          {/* Floating Explode Slider (for 2-part molds) */}
          {config.type === 'two_part' && viewMode !== 'original' && viewMode !== 'cast' && (
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-80 p-3 bg-slate-900/90 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md z-10 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Split className="w-3.5 h-3.5 text-sky-400" />
                  <span>Separar Metades (Visão Explodida)</span>
                </span>
                <span className="font-mono text-sky-400 font-bold">{config.explodeDistance} mm</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={config.explodeDistance}
                onChange={(e) => handleExplodeChange(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Fechado (0 mm)</span>
                <span>Molde Aberto (40 mm)</span>
              </div>
            </div>
          )}

          {/* Model Stats Pill */}
          <div className="absolute bottom-4 right-4 hidden sm:flex items-center gap-3 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-[11px] text-slate-300 backdrop-blur-md shadow-lg z-10 font-mono">
            <span>
              📦 {modelStats.width} × {modelStats.height} × {modelStats.depth} mm
            </span>
            <span className="text-slate-600">|</span>
            <span>🔺 {modelStats.triangles.toLocaleString()} polígonos</span>
          </div>
        </div>

        {/* Right Configuration Sidebar */}
        <aside className="w-full lg:w-[410px] bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-[50vh] lg:h-full z-10 shrink-0">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-sky-400" />
                <span>Parâmetros de Molde</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Ajuste paredes, encaixes, canais de injeção e respiros
              </p>
            </div>
            <button
              onClick={() => {
                // Trigger recalculation
                setConfig({ ...config });
              }}
              className="p-1.5 text-slate-400 hover:text-sky-400 rounded-md hover:bg-slate-800 transition-colors"
              title="Recalcular molde 3D"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Sidebar Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* 1. SEÇÃO DE ENVIO DE ARQUIVO STL / OBJ */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-100 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sky-300">
                  <FileUp className="w-4 h-4 text-sky-400" />
                  <span>Enviar Modelo 3D (STL / OBJ)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Arraste ou Selecione</span>
              </label>

              {isCustomUpload && uploadedFileInfo ? (
                /* Card do Arquivo STL Carregado com Sucesso */
                <div className="p-3 bg-gradient-to-br from-sky-950/60 to-slate-900/90 border border-sky-500/40 rounded-xl space-y-2.5 shadow-md">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-100 truncate text-[12px]" title={uploadedFileInfo.name}>
                          {uploadedFileInfo.name}
                        </p>
                        <p className="text-[10px] text-sky-300 font-mono">
                          {uploadedFileInfo.sizeFormatted} • {uploadedFileInfo.triangles.toLocaleString()} polígonos
                        </p>
                      </div>
                    </div>

                    <label className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white rounded text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer whitespace-nowrap">
                      Trocar
                      <input
                        type="file"
                        accept=".stl,.obj"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Dimensões em Milímetros */}
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Dimensões do Objeto:</span>
                      <span className="font-mono text-sky-300 font-bold">
                        {modelStats.width} × {modelStats.height} × {modelStats.depth} mm
                      </span>
                    </div>

                    {/* Escala 1:1 original vs Ajuste em mm */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => handleTargetSizeChange(targetSizeMm)}
                        className={`flex-1 py-1 px-2 rounded text-[10px] font-medium transition-colors cursor-pointer text-center ${
                          scaleMode === 'fit'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Escalar (mm)
                      </button>
                      <button
                        onClick={handleToggleOriginalScale}
                        className={`flex-1 py-1 px-2 rounded text-[10px] font-medium transition-colors cursor-pointer text-center ${
                          scaleMode === 'original'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Mantém exatamente as dimensões originais do arquivo CAD exportado"
                      >
                        Escala Real 1:1
                      </button>
                    </div>
                  </div>

                  {/* Controle de Tamanho quando em modo 'fit' */}
                  {scaleMode === 'fit' && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300">Tamanho Alvo (Maior Dimensão):</span>
                        <span className="font-mono text-sky-400 font-bold">{targetSizeMm} mm</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="130"
                        step="5"
                        value={targetSizeMm}
                        onChange={(e) => handleTargetSizeChange(Number(e.target.value))}
                        className="w-full accent-sky-500 cursor-pointer"
                      />
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {[35, 50, 65, 80, 100].map((sz) => (
                          <button
                            key={sz}
                            onClick={() => handleTargetSizeChange(sz)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                              targetSizeMm === sz
                                ? 'bg-sky-500 text-slate-950 font-bold'
                                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {sz}mm
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Card Dropzone para Envio de STL */
                <label className="group relative block p-4 bg-gradient-to-b from-sky-500/10 via-slate-900/80 to-slate-950 border-2 border-dashed border-sky-500/40 hover:border-sky-400 rounded-xl cursor-pointer transition-all hover:bg-sky-500/15 shadow-sm">
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    <div className="p-3 rounded-full bg-sky-500/20 group-hover:bg-sky-500/30 text-sky-400 transition-colors">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-100 text-xs">
                        Clique aqui para enviar arquivo <span className="text-sky-400 font-mono">.STL</span> ou <span className="text-sky-400 font-mono">.OBJ</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        ou arraste e solte seu modelo 3D em qualquer lugar
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-sky-300 font-medium bg-sky-950/60 px-2.5 py-1 rounded-md border border-sky-800/60 mt-1">
                      <span>✓ Geração Automática de Fôrma Negativa</span>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".stl,.obj"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* 2. Modelos 3D de Exemplo (Clique para Testar) */}
            <div className="space-y-1.5 pt-1">
              <label className="font-semibold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Modelos de Exemplo:</span>
                </span>
                {isCustomUpload && (
                  <button
                    onClick={() => handleSelectSample('bear', 'Ursinho')}
                    className="text-[10px] text-slate-400 hover:text-amber-400 cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                )}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'bear', label: 'Ursinho', icon: '🧸' },
                  { key: 'heart', label: 'Coração', icon: '💖' },
                  { key: 'gem', label: 'Gema 3D', icon: '💎' },
                  { key: 'star', label: 'Estrela', icon: '⭐' },
                  { key: 'skull', label: 'Máscara', icon: '🎭' },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => handleSelectSample(s.key as any, s.label)}
                    className={`p-2 rounded-lg border text-left flex items-center gap-1.5 transition-colors cursor-pointer ${
                      modelName === s.label && !isCustomUpload
                        ? 'bg-sky-500/15 border-sky-500 text-sky-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span>{s.icon}</span>
                    <span className="truncate">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Tipo de Molde */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Tipo de Peça de Molde:</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfig({ ...config, type: 'two_part' })}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    config.type === 'two_part'
                      ? 'bg-sky-500/15 border-sky-500 text-sky-200 shadow-sm ring-1 ring-sky-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-slate-100">
                    <Split className="w-4 h-4 text-sky-400" />
                    <span>Molde Bipartido</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    2 metades (Base + Tampa) com pinos cónicos de encaixe e funil de injeção.
                  </span>
                </button>

                <button
                  onClick={() => setConfig({ ...config, type: 'single_open' })}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    config.type === 'single_open'
                      ? 'bg-sky-500/15 border-sky-500 text-sky-200 shadow-sm ring-1 ring-sky-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-slate-100">
                    <Box className="w-4 h-4 text-amber-400" />
                    <span>Cavidade Única</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Fôrma aberta para sabonetes, chocolate, gesso ou carimbos de prensa.
                  </span>
                </button>
              </div>
            </div>

            {/* 3. Formato do Molde */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-200">Formato Externo da Caixa do Molde:</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'box', label: 'Retangular' },
                  { id: 'rounded', label: 'Arredondado' },
                  { id: 'cylinder', label: 'Cilíndrico' },
                ].map((sh) => (
                  <button
                    key={sh.id}
                    onClick={() => setConfig({ ...config, shape: sh.id as any })}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                      config.shape === sh.id
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sh.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Espessura das Paredes e Fundo */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-300">Margem das Paredes Laterais:</span>
                  <span className="font-mono text-sky-400 font-semibold">{config.wallThickness} mm</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="25"
                  step="1"
                  value={config.wallThickness}
                  onChange={(e) => setConfig({ ...config, wallThickness: Number(e.target.value) })}
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block">
                  Espessura estrutural para suportar a pressão do material fundido.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-300">Espessura do Fundo / Base:</span>
                  <span className="font-mono text-sky-400 font-semibold">{config.floorThickness} mm</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="20"
                  step="1"
                  value={config.floorThickness}
                  onChange={(e) => setConfig({ ...config, floorThickness: Number(e.target.value) })}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>

            {/* 5. Controles específicos do Molde Bipartido */}
            {config.type === 'two_part' && (
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <div className="font-semibold text-sky-300 flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                  <Split className="w-3.5 h-3.5" />
                  <span>Recursos de Injeção e Encaixe</span>
                </div>

                {/* Plano de Partição */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-300">Altura do Corte (Plano de Partição):</span>
                    <span className="font-mono text-sky-400 font-semibold">
                      {Math.round(config.splitPlaneRatio * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="0.8"
                    step="0.05"
                    value={config.splitPlaneRatio}
                    onChange={(e) => setConfig({ ...config, splitPlaneRatio: Number(e.target.value) })}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Base Baixa (20%)</span>
                    <span>Meio (50%)</span>
                    <span>Base Alta (80%)</span>
                  </div>
                </div>

                {/* Pinos de Alinhamento */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="font-medium text-slate-200 block">Pinos Guia (Macho / Fêmea)</span>
                    <span className="text-[10px] text-slate-500">Trava as duas metades sem desalinhamento</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.alignmentPins}
                    onChange={(e) => setConfig({ ...config, alignmentPins: e.target.checked })}
                    className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                  />
                </div>

                {/* Funil de Despejo */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="font-medium text-slate-200 block">Canal de Injeção / Despejo</span>
                    <span className="text-[10px] text-slate-500">Funil superior para verter resina/chocolate</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.pourSpout}
                    onChange={(e) => setConfig({ ...config, pourSpout: e.target.checked })}
                    className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                  />
                </div>

                {/* Respiros de Ar */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="font-medium text-slate-200 block">Saídas de Ar (Air Vents)</span>
                    <span className="text-[10px] text-slate-500">Canais finos que impedem bolhas de ar</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.airVents}
                    onChange={(e) => setConfig({ ...config, airVents: e.target.checked })}
                    className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* 6. Dicas de Impressão e Aplicação */}
            <div className="p-3 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-sky-300 text-xs">
                <Info className="w-3.5 h-3.5" />
                <span>Dica para Desmoldagem Fácil:</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Para alimentos (chocolate/gelatina), imprima em <strong>PLA Food-Safe</strong> ou use celofane.
                Para resina e gesso, aplique spray desmoldante de silicone antes do primeiro despejo.
              </p>
            </div>
          </div>

          {/* Sidebar Footer with Individual Part Downloads */}
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Exportar Peças Individuais:</span>
            </div>
            {config.type === 'two_part' ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleExportSinglePart('partA')}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 hover:text-sky-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Parte A (Base)</span>
                </button>
                <button
                  onClick={() => handleExportSinglePart('partB')}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 hover:text-blue-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Parte B (Tampa)</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleExportSinglePart('single')}
                className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 hover:text-sky-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Baixar Molde de Cavidade Única (.STL)</span>
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
