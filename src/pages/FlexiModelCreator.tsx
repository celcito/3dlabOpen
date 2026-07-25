import { useState, useRef, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { Evaluator, Brush, SUBTRACTION, INTERSECTION, ADDITION } from 'three-bvh-csg';
import { 
  Waves, Download, Settings, Sliders, 
  Trash2, Layers, Move, MousePointer2, 
  Check, Info, Sparkles, Box, 
  Maximize, Minimize, Activity, Cpu,
  Link as LinkIcon, Scissors, Upload, Wand2, Loader2
} from "lucide-react";

// Setup three-mesh-bvh
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

interface FlexiConfig {
  segments: number;
  width: number;
  height: number;
  segmentGap: number;
  hingeGap: number;
  baseColor: string;
  hingeSize: number;
  pinWidth: number;
}

export default function FlexiModelCreator() {
  const [config, setConfig] = useState<FlexiConfig>({
    segments: 8,
    width: 25,
    height: 10,
    segmentGap: 1.2,
    hingeGap: 0.5,
    baseColor: "#e0e0e0",
    hingeSize: 2.5,
    pinWidth: 8
  });

  const [baseGeom, setBaseGeom] = useState<THREE.BufferGeometry | null>(null);
  const [slicedMeshes, setSlicedMeshes] = useState<THREE.BufferGeometry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Default geometry if none loaded
  useEffect(() => {
    if (!baseGeom) {
      const geom = new THREE.BoxGeometry(config.width, config.height, 100);
      setBaseGeom(geom);
    }
  }, [baseGeom, config.width, config.height]);

  // Run CSG when base geometry or config changes
  useEffect(() => {
    if (!baseGeom) return;
    
    let isCancelled = false;
    
    const generateSlices = async () => {
      setIsGenerating(true);
      
      // We yield to the browser so the UI can update the loading state
      await new Promise(r => setTimeout(r, 50));
      
      try {
        const result = buildFlexiModel(baseGeom, config);
        if (!isCancelled) {
          setSlicedMeshes(result);
          setIsGenerating(false);
        }
      } catch (err) {
        console.error("CSG Error:", err);
        if (!isCancelled) setIsGenerating(false);
      }
    };
    
    generateSlices();
    
    return () => { isCancelled = true; };
  }, [baseGeom, config]);

  const handleExportSTL = () => {
    try {
      if (slicedMeshes.length === 0) return;
      
      const exporter = new STLExporter();
      const group = new THREE.Group();

      slicedMeshes.forEach((geom) => {
        const mesh = new THREE.Mesh(geom);
        group.add(mesh);
      });

      // Rotate flat for printing
      group.rotation.x = -Math.PI / 2;
      group.updateMatrixWorld(true);

      const result = exporter.parse(group, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `flexi-model-${config.segments}-segments-${Date.now()}.stl`;
      link.click();
      
      showNotification("STL Flexi exportado com sucesso!");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Falha ao exportar STL.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const loader = new STLLoader();
        try {
          const geom = loader.parse(event.target?.result as ArrayBuffer);
          geom.center();
          geom.computeVertexNormals();
          
          // Rotate if necessary (often STLs are Z-up, we need Y-up)
          geom.rotateX(-Math.PI / 2);
          
          // Scale to fit ~100 length
          geom.computeBoundingBox();
          const size = new THREE.Vector3();
          geom.boundingBox!.getSize(size);
          const scale = 100 / size.z;
          geom.scale(scale, scale, scale);
          
          setBaseGeom(geom);
          showNotification("STL carregado!");
        } catch (err) {
          alert("Erro ao ler arquivo STL.");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsAiLoading(true);
    try {
      const res = await fetch("/api/flexi/generate-svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt })
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Authentication error with AI generation. Please reload the app.");
        setIsAiLoading(false);
        return;
      }
      if (data.svgCode) {
        const loader = new SVGLoader();
        const svgData = loader.parse(data.svgCode);
        
        const shapes: THREE.Shape[] = [];
        svgData.paths.forEach((path) => {
          shapes.push(...path.toShapes());
        });
        
        if (shapes.length > 0) {
          const extrudeSettings = {
            depth: config.height,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 1,
            bevelThickness: 1
          };
          const geom = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
          geom.center();
          // Extrude puts depth on Z, but SVG is X/Y.
          // We want the SVG flat on X/Z, with depth on Y.
          geom.rotateX(Math.PI / 2);
          
          // Scale to length 100
          geom.computeBoundingBox();
          const size = new THREE.Vector3();
          geom.boundingBox!.getSize(size);
          const scale = 100 / Math.max(size.z, size.x);
          geom.scale(scale, scale, scale);
          
          setBaseGeom(geom);
          showNotification("Forma gerada por IA!");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar formato via IA.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#080808]">
      {/* SIDEBAR */}
      <div className="w-full md:w-[350px] bg-[#0c0c0c] border-r border-zinc-900 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5FF] to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(0,229,255,0.3)]">
              <Waves className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Flexi Maker</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Crie modelos articulados print-in-place.</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-[#00E5FF]" />
              01. Base / Formato
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-center justify-center w-full py-3 border border-zinc-800 border-dashed rounded-xl cursor-pointer bg-[#111] hover:bg-[#151515] transition-all group">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-zinc-500 group-hover:text-[#00E5FF]" />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Upload STL Base</span>
                </div>
                <input type="file" className="hidden" accept=".stl" onChange={handleFileUpload} />
              </label>

              <div className="flex items-center gap-2">
                <div className="h-[1px] flex-1 bg-zinc-800"></div>
                <span className="text-[9px] text-zinc-600 font-black uppercase">OU</span>
                <div className="h-[1px] flex-1 bg-zinc-800"></div>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ex: lagarto, cobra..."
                  className="flex-1 bg-[#111] border border-zinc-800 p-3 rounded-xl text-[11px] text-white outline-none focus:border-[#00E5FF]"
                />
                <button 
                  onClick={handleAiGenerate}
                  disabled={isAiLoading || !aiPrompt}
                  className="bg-[#1a1a1a] border border-zinc-800 text-[#00E5FF] p-3 rounded-xl hover:bg-[#00E5FF] hover:text-black transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#00E5FF]" />
              02. Fatiamento
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Número de Segmentos</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.segments}</span>
              </div>
              <input 
                type="range" min="3" max="25" step="1" 
                value={config.segments} 
                onChange={(e) => setConfig({...config, segments: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <LinkIcon className="w-3.5 h-3.5 text-[#00E5FF]" />
              03. Dobradiças Print-in-Place
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Espaço Entre Segmentos</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.segmentGap}mm</span>
              </div>
              <input 
                type="range" min="0.5" max="3" step="0.1" 
                value={config.segmentGap} 
                onChange={(e) => setConfig({...config, segmentGap: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[8px] uppercase font-bold text-zinc-600">Tolerância (Gap)</label>
                <input 
                  type="number" step="0.1" value={config.hingeGap}
                  onChange={(e) => setConfig({...config, hingeGap: parseFloat(e.target.value) || 0})}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold text-center"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] uppercase font-bold text-zinc-600">Raio do Pino</label>
                <input 
                  type="number" step="0.1" value={config.hingeSize}
                  onChange={(e) => setConfig({...config, hingeSize: parseFloat(e.target.value) || 0})}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold text-center"
                />
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={handleExportSTL}
              disabled={isGenerating || slicedMeshes.length === 0}
              className="w-full bg-gradient-to-r from-[#00E5FF] to-blue-600 text-black py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] group disabled:opacity-30"
            >
              <Download className="w-4 h-4 group-hover:bounce" />
              Download STL Flexi
            </button>
          </div>
        </section>
      </div>

      {/* VIEWPORT */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <Canvas shadows camera={{ position: [50, 50, 50], fov: 45 }}>
            <color attach="background" args={["#080808"]} />
            <ambientLight intensity={0.5} />
            <spotLight position={[50, 100, 50]} angle={0.15} penumbra={1} castShadow />
            <pointLight position={[-50, -50, -50]} intensity={0.5} />
            <OrbitControls makeDefault />
            <Grid 
              infiniteGrid 
              fadeDistance={200} 
              cellColor="#222" 
              sectionColor="#444" 
              cellSize={10} 
              sectionSize={50} 
              position={[0, -0.1, 0]}
            />
            
            <Center top>
              <group>
                {slicedMeshes.map((geom, idx) => (
                  <mesh key={idx} geometry={geom} castShadow receiveShadow>
                    <meshStandardMaterial 
                      color={idx % 2 === 0 ? config.baseColor : "#00b3cc"} 
                      roughness={0.4} 
                      metalness={0.1} 
                    />
                  </mesh>
                ))}
              </group>
            </Center>
          </Canvas>
        </div>

        {/* HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md border border-zinc-900 p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-yellow-500 animate-pulse' : 'bg-[#00E5FF]'}`} />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">
                {isGenerating ? "Processando CSG..." : "CSG Flexi Slicer"}
              </span>
            </div>
            <div className="text-[16px] font-black text-white uppercase tracking-tighter">
              {config.segments} Segmentos Gerados
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-emerald-500 text-black px-6 py-3 rounded-full flex items-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-2xl">
              <Check className="w-4 h-4" />
              {successMsg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Logic for physical 3D boolean operations to build the flexi
function buildFlexiModel(baseGeom: THREE.BufferGeometry, config: FlexiConfig): THREE.BufferGeometry[] {
  const { segments, segmentGap, hingeGap, hingeSize, pinWidth } = config;
  
  // Make sure baseGeom has BVH for fast CSG
  if (!baseGeom.boundsTree) {
    baseGeom.computeBoundsTree();
  }
  
  baseGeom.computeBoundingBox();
  const box = baseGeom.boundingBox!;
  const minZ = box.min.z;
  const maxZ = box.max.z;
  const totalLength = maxZ - minZ;
  const widthX = box.max.x - box.min.x;
  const heightY = box.max.y - box.min.y;
  
  const evaluator = new Evaluator();
  const baseBrush = new Brush(baseGeom);
  baseBrush.updateMatrixWorld();

  const segmentLength = totalLength / segments;
  const results: THREE.BufferGeometry[] = [];

  for (let i = 0; i < segments; i++) {
    // Determine the raw Z boundaries for this segment
    const segMinZ = minZ + i * segmentLength;
    const segMaxZ = minZ + (i + 1) * segmentLength;
    
    // Create the bounding cutter for this segment (with segmentGap removed from the ends)
    // We remove gap/2 from the start (except first) and gap/2 from the end (except last)
    const actualMinZ = i === 0 ? segMinZ : segMinZ + segmentGap / 2;
    const actualMaxZ = i === segments - 1 ? segMaxZ : segMaxZ - segmentGap / 2;
    const actualLen = actualMaxZ - actualMinZ;

    const cutterGeom = new THREE.BoxGeometry(widthX * 2, heightY * 2, actualLen);
    cutterGeom.translate(
      (box.min.x + box.max.x) / 2,
      (box.min.y + box.max.y) / 2,
      (actualMinZ + actualMaxZ) / 2
    );
    const cutterBrush = new Brush(cutterGeom);
    cutterBrush.updateMatrixWorld();

    // Intersection gives us the sliced body
    let segBrush = evaluator.evaluate(baseBrush, cutterBrush, INTERSECTION);

    // Common center Y for hinges
    const cy = (box.min.y + box.max.y) / 2;

    // Female hole (Receives from previous segment)
    if (i > 0) {
      const jointZ = segMinZ; // The exact plane between i-1 and i
      
      // Female hole needs to carve out space for the pin and the link
      const holePinGeom = new THREE.CylinderGeometry(hingeSize + hingeGap, hingeSize + hingeGap, pinWidth + hingeGap * 2, 16);
      holePinGeom.rotateZ(Math.PI / 2); // Orient along X
      holePinGeom.translate(0, cy, jointZ);
      
      // Slot for the link to move
      const holeSlotGeom = new THREE.BoxGeometry(pinWidth * 0.6, heightY * 0.8, segmentGap * 2 + hingeSize * 2);
      holeSlotGeom.translate(0, cy, jointZ);
      
      const mergedHole = BufferGeometryUtils.mergeGeometries([holePinGeom, holeSlotGeom]);
      if (mergedHole.boundsTree === undefined) mergedHole.computeBoundsTree();
      
      const holeBrush = new Brush(mergedHole);
      holeBrush.updateMatrixWorld();
      
      segBrush = evaluator.evaluate(segBrush, holeBrush, SUBTRACTION);
    }

    // Male pin (Points to next segment)
    if (i < segments - 1) {
      const jointZ = segMaxZ; // The exact plane between i and i+1
      
      const pinGeom = new THREE.CylinderGeometry(hingeSize, hingeSize, pinWidth, 16);
      pinGeom.rotateZ(Math.PI / 2); // Orient along X
      pinGeom.translate(0, cy, jointZ);
      
      // The link connects the body (ends at jointZ - gap/2) to the pin (at jointZ)
      const linkGeom = new THREE.BoxGeometry(pinWidth * 0.5, hingeSize * 1.5, segmentGap);
      linkGeom.translate(0, cy, jointZ - segmentGap / 4);

      const mergedPin = BufferGeometryUtils.mergeGeometries([pinGeom, linkGeom]);
      if (mergedPin.boundsTree === undefined) mergedPin.computeBoundsTree();

      const pinBrush = new Brush(mergedPin);
      pinBrush.updateMatrixWorld();
      
      segBrush = evaluator.evaluate(segBrush, pinBrush, ADDITION);
    }

    results.push(segBrush.geometry);
  }
  
  return results;
}

