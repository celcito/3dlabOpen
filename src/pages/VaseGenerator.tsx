import { useState, useRef, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, PerspectiveCamera, ContactShadows, Edges } from "@react-three/drei";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError } from "@/lib/toast";
import { 
  Flower, Download, Settings, Sliders, 
  Trash2, Layers, Move, MousePointer2, 
  Check, Info, Sparkles, Box, 
  Maximize, Minimize, Activity, Cpu,
  RefreshCw, Hash
} from "lucide-react";

interface VaseConfig {
  height: number;
  baseRadius: number;
  midRadius: number;
  topRadius: number;
  midPosition: number; // 0 to 1
  twist: number; // in degrees
  sides: number; // 3 to 64
  waves: number; // number of vertical waves
  waveIntensity: number;
  baseThickness: number;
  wallThickness: number;
  baseColor: string;
}

export default function VaseGenerator() {
  const [config, setConfig] = useState<VaseConfig>({
    height: 120,
    baseRadius: 30,
    midRadius: 45,
    topRadius: 25,
    midPosition: 0.5,
    twist: 45,
    sides: 32,
    waves: 0,
    waveIntensity: 2,
    baseThickness: 2,
    wallThickness: 2,
    baseColor: "#e0e0e0"
  });

  const [successMsg, setSuccessMsg] = useState("");

  const handleExportSTL = () => {
    try {
      const exporter = new STLExporter();
      const geometry = createVaseGeometry(config);
      const mesh = new THREE.Mesh(geometry);
      
      // Printable orientation
      mesh.rotation.x = -Math.PI / 2;
      mesh.updateMatrixWorld();

      const result = exporter.parse(mesh, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `custom-vase-${Date.now()}.stl`;
      link.click();
      
      showNotification("Vaso exportado com sucesso!");
    } catch (err) {
      console.error(err);
      toastExportError();
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
              <Flower className="w-6 h-6 text-[#00E5FF]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Vase Maker</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Crie vasos e recipientes geométricos 3D.</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Maximize className="w-3.5 h-3.5 text-[#00E5FF]" />
              01. Proporções (mm)
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Altura Total</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.height}mm</span>
              </div>
              <input 
                type="range" min="20" max="250" step="1" 
                value={config.height} 
                onChange={(e) => setConfig({...config, height: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Base R</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.baseRadius}mm</span>
              </div>
              <input 
                type="range" min="5" max="150" step="1" 
                value={config.baseRadius}
                onChange={(e) => setConfig({...config, baseRadius: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Meio R</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.midRadius}mm</span>
              </div>
              <input 
                type="range" min="5" max="150" step="1" 
                value={config.midRadius}
                onChange={(e) => setConfig({...config, midRadius: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Topo R</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.topRadius}mm</span>
              </div>
              <input 
                type="range" min="5" max="150" step="1" 
                value={config.topRadius}
                onChange={(e) => setConfig({...config, topRadius: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-[#00E5FF]" />
              02. Geometria & Torção
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Lados (Sides)</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.sides}</span>
              </div>
              <input 
                type="range" min="3" max="64" step="1" 
                value={config.sides} 
                onChange={(e) => setConfig({...config, sides: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Torção (Twist)</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.twist}°</span>
              </div>
              <input 
                type="range" min="-360" max="360" step="5" 
                value={config.twist} 
                onChange={(e) => setConfig({...config, twist: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#00E5FF]" />
              03. Textura de Onda
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Quantidade Ondas</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.waves}</span>
              </div>
              <input 
                type="range" min="0" max="20" step="1" 
                value={config.waves} 
                onChange={(e) => setConfig({...config, waves: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Intensidade</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.waveIntensity}mm</span>
              </div>
              <input 
                type="range" min="0" max="10" step="0.5" 
                value={config.waveIntensity} 
                onChange={(e) => setConfig({...config, waveIntensity: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-[#00E5FF]" />
              04. Parede & Base
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Espessura da Parede</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.wallThickness}mm</span>
              </div>
              <input 
                type="range" min="0.8" max="10" step="0.2" 
                value={config.wallThickness} 
                onChange={(e) => setConfig({...config, wallThickness: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Espessura da Base</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.baseThickness}mm</span>
              </div>
              <input 
                type="range" min="1" max="10" step="0.5" 
                value={config.baseThickness} 
                onChange={(e) => setConfig({...config, baseThickness: parseFloat(e.target.value)})}
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
              Download STL Vaso
            </button>
          </div>
        </section>
      </div>

      {/* VIEWPORT */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <Canvas shadows camera={{ position: [100, 100, 100], fov: 45 }}>
            <color attach="background" args={["#080808"]} />
            <ambientLight intensity={0.5} />
            <spotLight position={[100, 200, 100]} angle={0.15} penumbra={1} castShadow />
            <pointLight position={[-100, -100, -100]} intensity={0.5} />
            <OrbitControls makeDefault />
            <Grid 
              infiniteGrid 
              fadeDistance={300} 
              cellColor="#222" 
              sectionColor="#444" 
              cellSize={10} 
              sectionSize={50} 
              position={[0, -0.1, 0]}
            />
            <Center top>
              <VaseMesh config={config} />
            </Center>
            <ContactShadows position={[0, -0.1, 0]} opacity={0.4} scale={30} blur={1} far={10} />
          </Canvas>
        </div>

        {/* HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md border border-zinc-900 p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Procedural Vase Studio</span>
            </div>
            <div className="text-[16px] font-black text-white uppercase tracking-tighter">
              {config.sides} Lados • {config.height}mm Altura
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

function VaseMesh({ config }: { config: VaseConfig }) {
  const geometry = useMemo(() => createVaseGeometry(config), [config]);

  return (
    <mesh castShadow receiveShadow geometry={geometry}>
      <meshPhysicalMaterial 
        color={config.baseColor} 
        roughness={0.2} 
        metalness={0.1}
        transmission={0.8}
        thickness={0.5}
        ior={1.5}
        clearcoat={1}
        transparent={true}
        opacity={1}
        side={THREE.DoubleSide}
      />
      <Edges scale={1} threshold={15} color="rgba(255,255,255,0.3)" />
    </mesh>
  );
}

function createVaseGeometry(config: VaseConfig) {
  const { height, baseRadius, midRadius, topRadius, midPosition, twist, sides, waves, waveIntensity, baseThickness, wallThickness } = config;
  
  const h = height / 10;
  const br = baseRadius / 10;
  const mr = midRadius / 10;
  const tr = topRadius / 10;
  const bt = baseThickness / 10;
  const wt = wallThickness / 10;
  
  const resolutionY = Math.floor(h * 5); // 5 segments per cm
  const points: THREE.Vector3[] = [];
  const indices: number[] = [];
  
  // Helper to calculate radius at t (0 to 1)
  const getRadius = (t: number) => {
    let r = 0;
    if (t < midPosition) {
      const nt = t / (midPosition || 0.001);
      r = THREE.MathUtils.lerp(br, mr, nt);
    } else {
      const nt = (t - midPosition) / (1 - midPosition || 0.001);
      r = THREE.MathUtils.lerp(mr, tr, nt);
    }
    return r;
  };

  // Generate Vertices
  // Outer shell: y goes 0 to resolutionY
  for (let y = 0; y <= resolutionY; y++) {
    const t = y / resolutionY;
    const currentY = t * h;
    const r = getRadius(t);
    const currentTwist = (t * twist * Math.PI) / 180;

    for (let s = 0; s <= sides; s++) {
      const angle = (s / sides) * Math.PI * 2;
      let waveOffset = 0;
      if (waves > 0) {
        waveOffset = Math.sin(angle * waves) * (waveIntensity / 10);
      }
      const x = Math.cos(angle + currentTwist) * (r + waveOffset);
      const z = Math.sin(angle + currentTwist) * (r + waveOffset);
      points.push(new THREE.Vector3(x, currentY, z));
    }
  }

  // Inner shell: y goes 0 to resolutionY. Note inner base is at y = bt
  const innerResY = resolutionY;
  
  for (let y = 0; y <= innerResY; y++) {
    const t = y / innerResY;
    const currentY = bt + t * (h - bt); // from baseThickness to height
    
    // We sample radius at corresponding global t
    const globalT = currentY / h;
    let r = getRadius(globalT);
    
    const currentTwist = (globalT * twist * Math.PI) / 180;
    
    // we want inner radius
    const innerR = Math.max(0.01, r - wt);

    for (let s = 0; s <= sides; s++) {
      const angle = (s / sides) * Math.PI * 2;
      let waveOffset = 0;
      if (waves > 0) {
        waveOffset = Math.sin(angle * waves) * (waveIntensity / 10);
      }
      const x = Math.cos(angle + currentTwist) * (innerR + waveOffset);
      const z = Math.sin(angle + currentTwist) * (innerR + waveOffset);
      points.push(new THREE.Vector3(x, currentY, z));
    }
  }

  // Faces
  const vertsPerRow = sides + 1;
  const outerOffset = 0;
  const innerOffset = (resolutionY + 1) * vertsPerRow;

  // Outer shell faces
  for (let y = 0; y < resolutionY; y++) {
    for (let s = 0; s < sides; s++) {
      const a = outerOffset + y * vertsPerRow + s;
      const b = outerOffset + y * vertsPerRow + s + 1;
      const c = outerOffset + (y + 1) * vertsPerRow + s;
      const d = outerOffset + (y + 1) * vertsPerRow + s + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  // Inner shell faces (winding reversed)
  for (let y = 0; y < innerResY; y++) {
    for (let s = 0; s < sides; s++) {
      const a = innerOffset + y * vertsPerRow + s;
      const b = innerOffset + y * vertsPerRow + s + 1;
      const c = innerOffset + (y + 1) * vertsPerRow + s;
      const d = innerOffset + (y + 1) * vertsPerRow + s + 1;
      indices.push(a, d, b);
      indices.push(a, c, d);
    }
  }

  // Top lip
  const topOuterY = resolutionY;
  const topInnerY = innerResY;
  for (let s = 0; s < sides; s++) {
    const a = outerOffset + topOuterY * vertsPerRow + s;
    const b = outerOffset + topOuterY * vertsPerRow + s + 1;
    const c = innerOffset + topInnerY * vertsPerRow + s;
    const d = innerOffset + topInnerY * vertsPerRow + s + 1;
    indices.push(a, c, d);
    indices.push(a, d, b);
  }

  // Base Plate (outer bottom)
  // Center vertex
  const bottomOuterCenter = points.length;
  points.push(new THREE.Vector3(0, 0, 0));
  for (let s = 0; s < sides; s++) {
    const a = outerOffset + s;
    const b = outerOffset + s + 1;
    indices.push(bottomOuterCenter, b, a); // facing down
  }

  // Inner Base Plate (inner bottom)
  const bottomInnerCenter = points.length;
  points.push(new THREE.Vector3(0, bt, 0));
  for (let s = 0; s < sides; s++) {
    const a = innerOffset + s;
    const b = innerOffset + s + 1;
    indices.push(bottomInnerCenter, a, b); // facing up
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
