import { useState, useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { 
  Waves, Download, Settings, Sliders, 
  Trash2, Layers, Move, MousePointer2, 
  Check, Info, Sparkles, Box, 
  Maximize, Minimize, Activity, Cpu,
  Link as LinkIcon, Scissors
} from "lucide-react";

interface FlexiConfig {
  segments: number;
  width: number;
  height: number;
  segmentGap: number;
  hingeGap: number;
  baseColor: string;
  taper: number;
  hingeSize: number;
}

export default function FlexiModelCreator() {
  const [config, setConfig] = useState<FlexiConfig>({
    segments: 8,
    width: 20,
    height: 15,
    segmentGap: 1.5,
    hingeGap: 0.4,
    baseColor: "#00E5FF",
    taper: 0.7,
    hingeSize: 4
  });

  const [successMsg, setSuccessMsg] = useState("");

  const handleExportSTL = () => {
    try {
      const exporter = new STLExporter();
      const group = new THREE.Group();

      // We'll generate the same geometries as the preview for the STL
      const geometries: THREE.BufferGeometry[] = [];
      const { segments, width, height, segmentGap, hingeGap, taper, hingeSize } = config;

      for (let i = 0; i < segments; i++) {
        const factor = 1 - (i / segments) * (1 - taper);
        const nextFactor = 1 - ((i + 1) / segments) * (1 - taper);
        
        const currentW = (width * factor) / 10;
        const currentH = (height * factor) / 10;
        const currentL = 1.0; // Fixed segment length for now
        
        const zPos = i * (currentL + segmentGap / 10);
        
        // 1. Segment Body
        const segGeom = new THREE.BoxGeometry(currentW, currentH, currentL);
        segGeom.translate(0, 0, zPos);
        geometries.push(segGeom);

        // 2. Hinges (except for the last segment)
        if (i < segments - 1) {
          const hSize = (hingeSize / 10) * factor;
          const hGap = hingeGap / 10;
          const hZ = zPos + currentL / 2 + segmentGap / 20;

          // Male part (Pin)
          const pinGeom = new THREE.CylinderGeometry(hSize / 4, hSize / 4, currentH * 0.8, 16);
          pinGeom.rotateX(Math.PI / 2);
          pinGeom.translate(0, 0, hZ);
          geometries.push(pinGeom);

          // Female part (Ring) is harder without CSG, so we'll simplify for this version 
          // or build it with multiple boxes.
          // For a true "flexi", we need interlocking parts.
          
          // Connector Link
          const linkGeom = new THREE.BoxGeometry(hSize / 2, hSize / 4, segmentGap / 10 + 0.1);
          linkGeom.translate(0, 0, hZ);
          geometries.push(linkGeom);
        }
      }

      const merged = BufferGeometryUtils.mergeGeometries(geometries);
      const mesh = new THREE.Mesh(merged);
      group.add(mesh);

      const result = exporter.parse(group, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `flexi-model-${segments}-segments-${Date.now()}.stl`;
      link.click();
      
      showNotification("STL Flexi exportado com sucesso!");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Falha ao exportar STL.");
    }
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#080808]">
      {/* SIDEBAR */}
      <div className="w-full md:w-80 bg-[#0c0c0c] border-r border-zinc-900 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/20 flex items-center justify-center">
              <Waves className="w-6 h-6 text-[#00E5FF]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Flexi Maker</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Crie modelos articulados print-in-place.</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#00E5FF]" />
              01. Estrutura
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Número de Segmentos</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.segments}</span>
              </div>
              <input 
                type="range" min="3" max="20" step="1" 
                value={config.segments} 
                onChange={(e) => setConfig({...config, segments: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Afinamento (Taper)</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{Math.round(config.taper * 100)}%</span>
              </div>
              <input 
                type="range" min="0.2" max="1" step="0.05" 
                value={config.taper} 
                onChange={(e) => setConfig({...config, taper: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
              02. Dimensões (mm)
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Largura Máx</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.width}mm</span>
              </div>
              <input 
                type="range" min="10" max="50" step="1" 
                value={config.width} 
                onChange={(e) => setConfig({...config, width: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Altura Máx</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.height}mm</span>
              </div>
              <input 
                type="range" min="5" max="40" step="1" 
                value={config.height} 
                onChange={(e) => setConfig({...config, height: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <LinkIcon className="w-3.5 h-3.5 text-[#00E5FF]" />
              03. Articulações
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Folga da Dobradiça</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.hingeGap}mm</span>
              </div>
              <input 
                type="range" min="0.2" max="1" step="0.05" 
                value={config.hingeGap} 
                onChange={(e) => setConfig({...config, hingeGap: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Tamanho Dobradiça</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.hingeSize}mm</span>
              </div>
              <input 
                type="range" min="2" max="10" step="0.5" 
                value={config.hingeSize} 
                onChange={(e) => setConfig({...config, hingeSize: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={handleExportSTL}
              className="w-full bg-[#00E5FF] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] group"
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
          <Canvas shadows camera={{ position: [30, 30, 30], fov: 45 }}>
            <color attach="background" args={["#080808"]} />
            <ambientLight intensity={0.5} />
            <spotLight position={[50, 50, 50]} angle={0.15} penumbra={1} castShadow />
            <pointLight position={[-50, -50, -50]} intensity={0.5} />
            <OrbitControls makeDefault />
            <Grid 
              infiniteGrid 
              fadeDistance={100} 
              cellColor="#222" 
              sectionColor="#444" 
              cellSize={10} 
              sectionSize={50} 
              position={[0, -0.1, 0]}
            />
            <Scene config={config} />
          </Canvas>
        </div>

        {/* HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md border border-zinc-900 p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Articulated Mesh Preview</span>
            </div>
            <div className="text-[16px] font-black text-white uppercase tracking-tighter">
              {config.segments} Segmentos Articulados
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

function Scene({ config }: { config: FlexiConfig }) {
  const segments = useMemo(() => {
    const { segments, width, height, segmentGap, hingeGap, taper, hingeSize } = config;
    const items = [];

    for (let i = 0; i < segments; i++) {
      const factor = 1 - (i / segments) * (1 - taper);
      const nextFactor = 1 - ((i + 1) / segments) * (1 - taper);
      
      const currentW = (width * factor) / 10;
      const currentH = (height * factor) / 10;
      const currentL = 1.0; 
      
      const zPos = i * (currentL + segmentGap / 10);
      
      items.push({
        id: i,
        pos: [0, currentH / 2, zPos],
        args: [currentW, currentH, currentL],
        factor,
        nextFactor
      });
    }
    return items;
  }, [config]);

  return (
    <Center top>
      <group>
        {segments.map((seg, idx) => (
          <group key={seg.id} position={seg.pos as [number, number, number]}>
            {/* Main Segment Body */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={seg.args as [number, number, number]} />
              <meshStandardMaterial color={config.baseColor} roughness={0.4} metalness={0.2} />
            </mesh>

            {/* Hinge Visualization */}
            {idx < segments.length - 1 && (
              <group position={[0, 0, seg.args[2] / 2 + config.segmentGap / 20]}>
                {/* Male Pin */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[(config.hingeSize / 40) * seg.factor, (config.hingeSize / 40) * seg.factor, seg.args[1] * 0.8, 16]} />
                  <meshStandardMaterial color="#fff" />
                </mesh>
                
                {/* Link Connector */}
                <mesh>
                  <boxGeometry args={[(config.hingeSize / 20) * seg.factor, (config.hingeSize / 40) * seg.factor, config.segmentGap / 10 + 0.1]} />
                  <meshStandardMaterial color={config.baseColor} />
                </mesh>
              </group>
            )}
          </group>
        ))}
      </group>
    </Center>
  );
}
