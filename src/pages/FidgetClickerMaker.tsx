import { useState, useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { 
  Gamepad2, Download, Settings, Sliders, 
  Trash2, Layers, Move, MousePointer2, 
  Check, Info, Sparkles, Box, 
  Maximize, Minimize, Activity, Cpu
} from "lucide-react";

interface ClickerConfig {
  rows: number;
  cols: number;
  switchSize: number; // 14mm standard
  wallThickness: number;
  height: number;
  plateThickness: number;
  cornerRadius: number;
  keychainHole: boolean;
  holeDiameter: number;
  baseColor: string;
}

export default function FidgetClickerMaker() {
  const [config, setConfig] = useState<ClickerConfig>({
    rows: 1,
    cols: 1,
    switchSize: 14,
    wallThickness: 2.5,
    height: 12,
    plateThickness: 1.5,
    cornerRadius: 3,
    keychainHole: true,
    holeDiameter: 4,
    baseColor: "#00E5FF"
  });

  const [successMsg, setSuccessMsg] = useState("");

  const dimensions = useMemo(() => {
    const width = (config.cols * config.switchSize) + ((config.cols + 1) * config.wallThickness);
    const depth = (config.rows * config.switchSize) + ((config.rows + 1) * config.wallThickness);
    return { width, depth, height: config.height };
  }, [config]);

  const handleExportSTL = () => {
    try {
      const exporter = new STLExporter();
      const { width, depth, height } = dimensions;
      const w = width / 10;
      const d = depth / 10;
      const h = height / 10;
      const r = config.cornerRadius / 10;
      const sw = config.switchSize / 10;
      const t = config.wallThickness / 10;
      const pt = config.plateThickness / 10;

      // 1. Create main outer shape
      const outerShape = new THREE.Shape();
      outerShape.moveTo(-w / 2 + r, -d / 2);
      outerShape.lineTo(w / 2 - r, -d / 2);
      outerShape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
      outerShape.lineTo(w / 2, d / 2 - r);
      outerShape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
      outerShape.lineTo(-w / 2 + r, d / 2);
      outerShape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
      outerShape.lineTo(-w / 2, -d / 2 + r);
      outerShape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);

      // 2. Create switch holes as holes in the shape
      // We'll create the plate first
      const plateShape = outerShape.clone();
      for (let rIdx = 0; rIdx < config.rows; rIdx++) {
        for (let cIdx = 0; cIdx < config.cols; cIdx++) {
          const x = (-(width / 10) / 2) + t + (cIdx * (sw + t));
          const y = (-(depth / 10) / 2) + t + (rIdx * (sw + t));
          
          const holePath = new THREE.Path();
          holePath.moveTo(x, y);
          holePath.lineTo(x + sw, y);
          holePath.lineTo(x + sw, y + sw);
          holePath.lineTo(x, y + sw);
          holePath.lineTo(x, y);
          plateShape.holes.push(holePath);
        }
      }

      // Keychain hole
      if (config.keychainHole) {
        const khRadius = config.holeDiameter / 20;
        const khX = (width / 20) - (config.wallThickness / 10);
        const khY = (depth / 20) - (config.wallThickness / 10);
        const khHole = new THREE.Path();
        khHole.absarc(khX, khY, khRadius, 0, Math.PI * 2, true);
        plateShape.holes.push(khHole);
      }

      const geometries: THREE.BufferGeometry[] = [];

      // Base (0.2cm = 2mm)
      const baseGeom = new THREE.ExtrudeGeometry(outerShape, { depth: 0.2, bevelEnabled: false });
      geometries.push(baseGeom);

      // Plate with holes at the top
      const plateGeom = new THREE.ExtrudeGeometry(plateShape, { depth: pt, bevelEnabled: false });
      plateGeom.translate(0, 0, h - pt);
      geometries.push(plateGeom);

      // Walls
      // We can create walls by extruding a frame
      const frameShape = outerShape.clone();
      const innerW = w - (t * 2);
      const innerD = d - (t * 2);
      const innerR = Math.max(0, r - t);
      const innerPath = new THREE.Path();
      innerPath.moveTo(-innerW / 2 + innerR, -innerD / 2);
      innerPath.lineTo(innerW / 2 - innerR, -innerD / 2);
      innerPath.quadraticCurveTo(innerW / 2, -innerD / 2, innerW / 2, -innerD / 2 + innerR);
      innerPath.lineTo(innerW / 2, innerD / 2 - innerR);
      innerPath.quadraticCurveTo(innerW / 2, innerD / 2, innerW / 2 - innerR, innerD / 2);
      innerPath.lineTo(-innerW / 2 + innerR, innerD / 2);
      innerPath.quadraticCurveTo(-innerW / 2, innerD / 2, -innerW / 2, innerD / 2 - innerR);
      innerPath.lineTo(-innerW / 2, -innerD / 2 + innerR);
      innerPath.quadraticCurveTo(-innerW / 2, -innerD / 2, -innerW / 2 + innerR, -innerD / 2);
      frameShape.holes.push(innerPath);

      const wallsGeom = new THREE.ExtrudeGeometry(frameShape, { depth: h - 0.2, bevelEnabled: false });
      wallsGeom.translate(0, 0, 0.2);
      geometries.push(wallsGeom);

      const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
      const mesh = new THREE.Mesh(mergedGeometry);

      const result = exporter.parse(mesh, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `fidget-clicker-${config.cols}x${config.rows}-${Date.now()}.stl`;
      link.click();
      
      showNotification("STL exportado com sucesso!");
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
              <Gamepad2 className="w-6 h-6 text-[#00E5FF]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Clicker Maker</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Crie seu próprio chaveiro clicky de teclado mecânico.</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#00E5FF]" />
              01. Layout de Teclas
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Colunas</label>
                <div className="flex items-center bg-[#111] border border-zinc-800 rounded-lg overflow-hidden">
                  <button 
                    onClick={() => setConfig(c => ({...c, cols: Math.max(1, c.cols - 1)}))}
                    className="p-2 hover:bg-zinc-800 text-zinc-400"
                  >
                    <Minimize className="w-3 h-3" />
                  </button>
                  <div className="flex-1 text-center text-xs font-black text-white">{config.cols}</div>
                  <button 
                    onClick={() => setConfig(c => ({...c, cols: Math.min(4, c.cols + 1)}))}
                    className="p-2 hover:bg-zinc-800 text-zinc-400"
                  >
                    <Maximize className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Linhas</label>
                <div className="flex items-center bg-[#111] border border-zinc-800 rounded-lg overflow-hidden">
                  <button 
                    onClick={() => setConfig(c => ({...c, rows: Math.max(1, c.rows - 1)}))}
                    className="p-2 hover:bg-zinc-800 text-zinc-400"
                  >
                    <Minimize className="w-3 h-3" />
                  </button>
                  <div className="flex-1 text-center text-xs font-black text-white">{config.rows}</div>
                  <button 
                    onClick={() => setConfig(c => ({...c, rows: Math.min(4, c.rows + 1)}))}
                    className="p-2 hover:bg-zinc-800 text-zinc-400"
                  >
                    <Maximize className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
              02. Ajustes Finos (mm)
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Altura do Case</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.height}mm</span>
              </div>
              <input 
                type="range" min="8" max="25" step="1" 
                value={config.height} 
                onChange={(e) => setConfig({...config, height: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Parede</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.wallThickness}mm</span>
              </div>
              <input 
                type="range" min="1.5" max="5" step="0.1" 
                value={config.wallThickness} 
                onChange={(e) => setConfig({...config, wallThickness: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Arredondamento</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.cornerRadius}mm</span>
              </div>
              <input 
                type="range" min="0" max="8" step="0.5" 
                value={config.cornerRadius} 
                onChange={(e) => setConfig({...config, cornerRadius: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#00E5FF]" />
              03. Extras
            </h3>
            <div 
              className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-all"
              onClick={() => setConfig({...config, keychainHole: !config.keychainHole})}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${config.keychainHole ? 'bg-[#00E5FF] border-[#00E5FF]' : 'border-zinc-700'}`}>
                  {config.keychainHole && <Check className="w-3 h-3 text-black" />}
                </div>
                <span className="text-[10px] font-black uppercase text-white">Furo para Chaveiro</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={handleExportSTL}
              className="w-full bg-[#00E5FF] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] group"
            >
              <Download className="w-4 h-4 group-hover:bounce" />
              Download STL
            </button>
          </div>
        </section>
      </div>

      {/* VIEWPORT */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <Canvas shadows camera={{ position: [40, 40, 40], fov: 45 }}>
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
            <Scene config={config} dimensions={dimensions} />
          </Canvas>
        </div>

        {/* HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md border border-zinc-900 p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">3D Real-time Simulator</span>
            </div>
            <div className="text-[16px] font-black text-white uppercase tracking-tighter">
              {dimensions.width.toFixed(1)} x {dimensions.depth.toFixed(1)} x {dimensions.height.toFixed(1)} mm
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

function Scene({ config, dimensions }: { config: ClickerConfig; dimensions: any }) {
  const { width, depth, height } = dimensions;
  
  // Create the housing geometry with cutouts for switches
  // For the preview, we'll use a main box and subtract visually by adding "holes" or using a clever shape.
  const housingShape = useMemo(() => {
    const shape = new THREE.Shape();
    const w = width / 10;
    const d = depth / 10;
    const r = config.cornerRadius / 10;
    
    shape.moveTo(-w/2 + r, -d/2);
    shape.lineTo(w/2 - r, -d/2);
    shape.quadraticCurveTo(w/2, -d/2, w/2, -d/2 + r);
    shape.lineTo(w/2, d/2 - r);
    shape.quadraticCurveTo(w/2, d/2, w/2 - r, d/2);
    shape.lineTo(-w/2 + r, d/2);
    shape.quadraticCurveTo(-w/2, d/2, -w/2, d/2 - r);
    shape.lineTo(-w/2, -d/2 + r);
    shape.quadraticCurveTo(-w/2, -d/2, -w/2 + r, -d/2);
    
    return shape;
  }, [width, depth, config.cornerRadius]);

  const extrudeSettings = useMemo(() => ({
    steps: 1,
    depth: height / 10,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 3
  }), [height]);

  const sw = config.switchSize / 10;
  const t = config.wallThickness / 10;
  const pt = config.plateThickness / 10;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* MAIN CASE */}
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[housingShape, extrudeSettings]} />
        <meshStandardMaterial color={config.baseColor} roughness={0.4} metalness={0.2} transparent opacity={0.9} />
      </mesh>

      {/* SWITCH HOLES (Visual only) */}
      {Array.from({ length: config.rows }).map((_, rIdx) => (
        Array.from({ length: config.cols }).map((_, cIdx) => {
          const x = (-(width/10)/2) + t + (cIdx * (sw + t)) + (sw/2);
          const y = (-(depth/10)/2) + t + (rIdx * (sw + t)) + (sw/2);
          
          return (
            <group key={`${rIdx}-${cIdx}`} position={[x, y, (height/10) - (pt/2)]}>
              {/* Hole visualizer */}
              <mesh>
                <boxGeometry args={[sw, sw, pt + 0.1]} />
                <meshStandardMaterial color="#000" />
              </mesh>
              {/* Switch Placeholder */}
              <mesh position={[0, 0, 0.4]}>
                <boxGeometry args={[sw - 0.1, sw - 0.1, 0.8]} />
                <meshStandardMaterial color="#333" roughness={0.8} />
              </mesh>
              <mesh position={[0, 0, 1]}>
                <boxGeometry args={[sw * 0.8, sw * 0.8, 0.5]} />
                <meshStandardMaterial color="#222" />
              </mesh>
            </group>
          );
        })
      ))}

      {/* KEYCHAIN HOLE VISUAL */}
      {config.keychainHole && (
        <mesh position={[(width/20) - (config.wallThickness/20), (depth/20) - (config.wallThickness/20), (height/20)]}>
          <cylinderGeometry args={[config.holeDiameter/20, config.holeDiameter/20, height/10, 32]} />
          <meshStandardMaterial color="#000" />
        </mesh>
      )}
    </group>
  );
}
