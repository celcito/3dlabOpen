import { useState, useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, PerspectiveCamera, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { 
  Box, Download, Settings, Sliders, 
  Trash2, Layers, Move, MousePointer2, 
  Check, Info, Sparkles, 
  Maximize, Minimize, Activity, Cpu,
  Grid3X3, ArrowUpDown, ArrowLeftRight
} from "lucide-react";

interface BinConfig {
  width: number;
  depth: number;
  height: number;
  thickness: number;
  radius: number;
  dividersX: number;
  dividersY: number;
  baseColor: string;
}

export default function BinGenerator() {
  const [config, setConfig] = useState<BinConfig>({
    width: 60,
    depth: 60,
    height: 40,
    thickness: 1.5,
    radius: 4,
    dividersX: 0,
    dividersY: 0,
    baseColor: "#00E5FF"
  });

  const [successMsg, setSuccessMsg] = useState("");

  const handleExportSTL = () => {
    try {
      const exporter = new STLExporter();
      const geometries: THREE.BufferGeometry[] = [];
      
      const { width, depth, height, thickness, radius, dividersX, dividersY } = config;
      const w = width / 10;
      const d = depth / 10;
      const h = height / 10;
      const t = thickness / 10;
      const r = radius / 10;

      // 1. Create Outer Shell
      const outerShape = createRoundedRectShape(w, d, r);
      const outerGeom = new THREE.ExtrudeGeometry(outerShape, { depth: h, bevelEnabled: false });
      
      // 2. Create Inner Cutout
      const innerW = w - t * 2;
      const innerD = d - t * 2;
      const innerR = Math.max(0, r - t);
      const innerShape = createRoundedRectShape(innerW, innerD, innerR);
      const innerGeom = new THREE.ExtrudeGeometry(innerShape, { depth: h - t, bevelEnabled: false });
      innerGeom.translate(0, 0, t);

      // In Three.js for export, we can't easily do CSG subtraction without a library.
      // So we'll build it using walls and a base.
      
      // Base
      const baseGeom = new THREE.ExtrudeGeometry(outerShape, { depth: t, bevelEnabled: false });
      geometries.push(baseGeom);

      // Walls (as a frame)
      const frameShape = outerShape.clone();
      const innerHole = new THREE.Path();
      // Reverse path for hole
      const innerPath = createRoundedRectPath(innerW, innerD, innerR);
      frameShape.holes.push(innerPath);
      
      const wallsGeom = new THREE.ExtrudeGeometry(frameShape, { depth: h - t, bevelEnabled: false });
      wallsGeom.translate(0, 0, t);
      geometries.push(wallsGeom);

      // Dividers X
      for (let i = 1; i <= dividersX; i++) {
        const xPos = -innerW / 2 + (innerW / (dividersX + 1)) * i;
        const divXGeom = new THREE.BoxGeometry(t, innerD, h - t);
        divXGeom.translate(xPos, 0, h / 2 + t / 2);
        geometries.push(divXGeom);
      }

      // Dividers Y
      for (let i = 1; i <= dividersY; i++) {
        const yPos = -innerD / 2 + (innerD / (dividersY + 1)) * i;
        const divYGeom = new THREE.BoxGeometry(innerW, t, h - t);
        divYGeom.translate(0, yPos, h / 2 + t / 2);
        geometries.push(divYGeom);
      }

      const merged = BufferGeometryUtils.mergeGeometries(geometries);
      const mesh = new THREE.Mesh(merged);
      // printable orientation
      mesh.rotation.x = -Math.PI / 2;
      mesh.updateMatrixWorld();

      const result = exporter.parse(mesh, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `organizer-bin-${width}x${depth}x${height}.stl`;
      link.click();
      
      showNotification("STL do Organizador exportado!");
    } catch (err) {
      console.error(err);
      alert("Erro ao exportar STL.");
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
              <Box className="w-6 h-6 text-[#00E5FF]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Bin Generator</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Gere organizadores e gaveteiros sob medida.</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Maximize className="w-3.5 h-3.5 text-[#00E5FF]" />
              01. Dimensões Externas (mm)
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Largura (X)</label>
                <input 
                  type="number" value={config.width}
                  onChange={(e) => setConfig({...config, width: parseInt(e.target.value) || 0})}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Profund. (Y)</label>
                <input 
                  type="number" value={config.depth}
                  onChange={(e) => setConfig({...config, depth: parseInt(e.target.value) || 0})}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Altura (Z)</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.height}mm</span>
              </div>
              <input 
                type="range" min="10" max="200" step="1" 
                value={config.height} 
                onChange={(e) => setConfig({...config, height: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
              02. Detalhes de Parede
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Espessura Parede</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.thickness}mm</span>
              </div>
              <input 
                type="range" min="0.8" max="5" step="0.1" 
                value={config.thickness} 
                onChange={(e) => setConfig({...config, thickness: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Canto Arredondado</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.radius}mm</span>
              </div>
              <input 
                type="range" min="0" max="20" step="0.5" 
                value={config.radius} 
                onChange={(e) => setConfig({...config, radius: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Grid3X3 className="w-3.5 h-3.5 text-[#00E5FF]" />
              03. Divisórias Internas
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Colunas (X)</label>
                <div className="flex items-center bg-[#111] border border-zinc-800 rounded-lg overflow-hidden">
                  <button onClick={() => setConfig(c => ({...c, dividersX: Math.max(0, c.dividersX - 1)}))} className="p-2 hover:bg-zinc-800 text-zinc-400"><Minimize className="w-3 h-3" /></button>
                  <div className="flex-1 text-center text-xs font-black text-white">{config.dividersX}</div>
                  <button onClick={() => setConfig(c => ({...c, dividersX: Math.min(10, c.dividersX + 1)}))} className="p-2 hover:bg-zinc-800 text-zinc-400"><Maximize className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Linhas (Y)</label>
                <div className="flex items-center bg-[#111] border border-zinc-800 rounded-lg overflow-hidden">
                  <button onClick={() => setConfig(c => ({...c, dividersY: Math.max(0, c.dividersY - 1)}))} className="p-2 hover:bg-zinc-800 text-zinc-400"><Minimize className="w-3 h-3" /></button>
                  <div className="flex-1 text-center text-xs font-black text-white">{config.dividersY}</div>
                  <button onClick={() => setConfig(c => ({...c, dividersY: Math.min(10, c.dividersY + 1)}))} className="p-2 hover:bg-zinc-800 text-zinc-400"><Maximize className="w-3 h-3" /></button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={handleExportSTL}
              className="w-full bg-[#00E5FF] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] group"
            >
              <Download className="w-4 h-4 group-hover:bounce" />
              Download Organizador STL
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
              <BinMesh config={config} />
            </Center>
            <ContactShadows position={[0, -0.1, 0]} opacity={0.4} scale={20} blur={1} far={10} />
          </Canvas>
        </div>

        {/* HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md border border-zinc-900 p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">3D Bin Configurator</span>
            </div>
            <div className="text-[16px] font-black text-white uppercase tracking-tighter">
              {config.width} x {config.depth} x {config.height} mm
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

function BinMesh({ config }: { config: BinConfig }) {
  const { width, depth, height, thickness, radius, dividersX, dividersY } = config;
  
  const w = width / 10;
  const d = depth / 10;
  const h = height / 10;
  const t = thickness / 10;
  const r = radius / 10;

  const outerShape = useMemo(() => createRoundedRectShape(w, d, r), [w, d, r]);
  const frameShape = useMemo(() => {
    const shape = outerShape.clone();
    const innerW = w - t * 2;
    const innerD = d - t * 2;
    const innerR = Math.max(0, r - t);
    const innerPath = createRoundedRectPath(innerW, innerD, innerR);
    shape.holes.push(innerPath);
    return shape;
  }, [outerShape, w, d, r, t]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Base */}
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[outerShape, { depth: t, bevelEnabled: false }]} />
        <meshStandardMaterial color={config.baseColor} roughness={0.4} />
      </mesh>
      
      {/* Walls */}
      <mesh castShadow receiveShadow position={[0, 0, t]}>
        <extrudeGeometry args={[frameShape, { depth: h - t, bevelEnabled: false }]} />
        <meshStandardMaterial color={config.baseColor} roughness={0.4} />
      </mesh>

      {/* Dividers X */}
      {Array.from({ length: dividersX }).map((_, i) => {
        const innerW = w - t * 2;
        const xPos = -innerW / 2 + (innerW / (dividersX + 1)) * (i + 1);
        return (
          <mesh key={`divx-${i}`} position={[xPos, 0, h / 2 + t / 2]} castShadow>
            <boxGeometry args={[t, d - t * 2, h - t]} />
            <meshStandardMaterial color={config.baseColor} roughness={0.5} opacity={0.8} transparent />
          </mesh>
        );
      })}

      {/* Dividers Y */}
      {Array.from({ length: dividersY }).map((_, i) => {
        const innerD = d - t * 2;
        const yPos = -innerD / 2 + (innerD / (dividersY + 1)) * (i + 1);
        return (
          <mesh key={`divy-${i}`} position={[0, yPos, h / 2 + t / 2]} castShadow>
            <boxGeometry args={[w - t * 2, t, h - t]} />
            <meshStandardMaterial color={config.baseColor} roughness={0.5} opacity={0.8} transparent />
          </mesh>
        );
      })}
    </group>
  );
}

// Utility Helpers
function createRoundedRectShape(w: number, d: number, r: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -d / 2);
  shape.lineTo(w / 2 - r, -d / 2);
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  shape.lineTo(w / 2, d / 2 - r);
  shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  shape.lineTo(-w / 2 + r, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  shape.lineTo(-w / 2, -d / 2 + r);
  shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  return shape;
}

function createRoundedRectPath(w: number, d: number, r: number) {
  const path = new THREE.Path();
  path.moveTo(-w / 2 + r, -d / 2);
  path.lineTo(w / 2 - r, -d / 2);
  path.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  path.lineTo(w / 2, d / 2 - r);
  path.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  path.lineTo(-w / 2 + r, d / 2);
  path.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  path.lineTo(-w / 2, -d / 2 + r);
  path.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  return path;
}
