import { useState, useRef, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, PerspectiveCamera, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
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
    baseColor: "#00E5FF"
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

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <label className="text-[8px] uppercase font-bold text-zinc-600 block text-center">Base R</label>
                <input 
                  type="number" value={config.baseRadius}
                  onChange={(e) => setConfig({...config, baseRadius: parseInt(e.target.value) || 0})}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold text-center"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] uppercase font-bold text-zinc-600 block text-center">Meio R</label>
                <input 
                  type="number" value={config.midRadius}
                  onChange={(e) => setConfig({...config, midRadius: parseInt(e.target.value) || 0})}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold text-center"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] uppercase font-bold text-zinc-600 block text-center">Topo R</label>
                <input 
                  type="number" value={config.topRadius}
                  onChange={(e) => setConfig({...config, topRadius: parseInt(e.target.value) || 0})}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold text-center"
                />
              </div>
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
      <meshStandardMaterial 
        color={config.baseColor} 
        roughness={0.4} 
        metalness={0.3} 
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function createVaseGeometry(config: VaseConfig) {
  const { height, baseRadius, midRadius, topRadius, midPosition, twist, sides, waves, waveIntensity, baseThickness } = config;
  
  const h = height / 10;
  const br = baseRadius / 10;
  const mr = midRadius / 10;
  const tr = topRadius / 10;
  const bt = baseThickness / 10;
  
  const resolutionY = Math.floor(h * 5); // 5 segments per cm
  const points: THREE.Vector3[] = [];
  const indices: number[] = [];

  // Generate Vertices
  for (let y = 0; y <= resolutionY; y++) {
    const t = y / resolutionY;
    const currentY = t * h;
    
    // Interpolate Radius using quadratic bezier for smoothness
    // B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
    // We adjust this to use midPosition
    let r = 0;
    if (t < midPosition) {
      const nt = t / midPosition;
      r = THREE.MathUtils.lerp(br, mr, nt);
    } else {
      const nt = (t - midPosition) / (1 - midPosition);
      r = THREE.MathUtils.lerp(mr, tr, nt);
    }

    const currentTwist = (t * twist * Math.PI) / 180;

    for (let s = 0; s <= sides; s++) {
      const angle = (s / sides) * Math.PI * 2;
      
      // Apply Waves
      let waveOffset = 0;
      if (waves > 0) {
        waveOffset = Math.sin(angle * waves) * (waveIntensity / 10);
      }

      const x = Math.cos(angle + currentTwist) * (r + waveOffset);
      const z = Math.sin(angle + currentTwist) * (r + waveOffset);
      points.push(new THREE.Vector3(x, currentY, z));
    }
  }

  // Generate Faces
  for (let y = 0; y < resolutionY; y++) {
    for (let s = 0; s < sides; s++) {
      const row1 = y * (sides + 1);
      const row2 = (y + 1) * (sides + 1);

      const a = row1 + s;
      const b = row1 + s + 1;
      const c = row2 + s;
      const d = row2 + s + 1;

      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Add a base plate for 3D printing
  const basePoints: THREE.Vector3[] = [];
  const baseIndices: number[] = [];
  
  // Center of base
  basePoints.push(new THREE.Vector3(0, 0, 0));
  // Loop through first row of vertices
  for (let s = 0; s <= sides; s++) {
    basePoints.push(points[s]);
  }
  
  for (let s = 0; s < sides; s++) {
    baseIndices.push(0, s + 2, s + 1);
  }

  const baseGeom = new THREE.BufferGeometry().setFromPoints(basePoints);
  baseGeom.setIndex(baseIndices);
  baseGeom.computeVertexNormals();

  return BufferGeometryUtils.mergeGeometries([geometry, baseGeom]);
}
