import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { useFidgetClickerMaker, type ClickerConfig } from "../hooks/useFidgetClickerMaker";
import { 
  Gamepad2, Download, Settings, Sliders, 
  Trash2, Layers, Move, MousePointer2, 
  Check, Info, Sparkles, Box, 
  Maximize, Minimize, Activity, Cpu
} from "lucide-react";

export default function FidgetClickerMaker() {
  const generator = useFidgetClickerMaker();
  const { config, setConfig, dimensions, housingShape, extrudeSettings, successMsg } = generator;
  const exportSTL = generator.handleExportSTL;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#F9FAF4]">
      {/* SIDEBAR */}
      <div className="w-full md:w-80 bg-[#F9FAF4] border-r border-[#E2E3DD] overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
              <Gamepad2 className="w-6 h-6 text-[#632CE5]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-[#1A1C19]">Clicker Maker</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Crie seu próprio chaveiro clicky de teclado mecânico.</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#632CE5]" />
              01. Layout de Teclas
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Colunas</label>
                <div className="flex items-center bg-white border border-[#E8E9E3] rounded-lg overflow-hidden">
                  <button 
                    onClick={() => setConfig(c => ({...c, cols: Math.max(1, c.cols - 1)}))}
                    className="p-2 hover:bg-[#F9FAF4] text-zinc-400"
                  >
                    <Minimize className="w-3 h-3" />
                  </button>
                  <div className="flex-1 text-center text-xs font-black text-[#1A1C19]">{config.cols}</div>
                  <button 
                    onClick={() => setConfig(c => ({...c, cols: Math.min(4, c.cols + 1)}))}
                    className="p-2 hover:bg-[#F9FAF4] text-zinc-400"
                  >
                    <Maximize className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Linhas</label>
                <div className="flex items-center bg-white border border-[#E8E9E3] rounded-lg overflow-hidden">
                  <button 
                    onClick={() => setConfig(c => ({...c, rows: Math.max(1, c.rows - 1)}))}
                    className="p-2 hover:bg-[#F9FAF4] text-zinc-400"
                  >
                    <Minimize className="w-3 h-3" />
                  </button>
                  <div className="flex-1 text-center text-xs font-black text-[#1A1C19]">{config.rows}</div>
                  <button 
                    onClick={() => setConfig(c => ({...c, rows: Math.min(4, c.rows + 1)}))}
                    className="p-2 hover:bg-[#F9FAF4] text-zinc-400"
                  >
                    <Maximize className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#632CE5]" />
              02. Ajustes Finos (mm)
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Altura do Case</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.height}mm</span>
              </div>
              <input 
                type="range" min="8" max="25" step="1" 
                value={config.height} 
                onChange={(e) => setConfig({...config, height: parseInt(e.target.value)})}
                className="w-full accent-[#632CE5] h-1.5 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Parede</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.wallThickness}mm</span>
              </div>
              <input 
                type="range" min="1.5" max="5" step="0.1" 
                value={config.wallThickness} 
                onChange={(e) => setConfig({...config, wallThickness: parseFloat(e.target.value)})}
                className="w-full accent-[#632CE5] h-1.5 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Arredondamento</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.cornerRadius}mm</span>
              </div>
              <input 
                type="range" min="0" max="8" step="0.5" 
                value={config.cornerRadius} 
                onChange={(e) => setConfig({...config, cornerRadius: parseFloat(e.target.value)})}
                className="w-full accent-[#632CE5] h-1.5 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
              03. Extras
            </h3>
            <div 
              className="flex items-center justify-between p-3 bg-[#E8E9E3] rounded-lg border border-[#E8E9E3] cursor-pointer hover:border-[#E8E9E3] transition-all"
              onClick={() => setConfig({...config, keychainHole: !config.keychainHole})}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${config.keychainHole ? 'bg-[#632CE5] border-[#632CE5]' : 'border-[#E8E9E3]'}`}>
                  {config.keychainHole && <Check className="w-3 h-3 text-black" />}
                </div>
                <span className="text-[10px] font-black uppercase text-[#1A1C19]">Furo para Chaveiro</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
               onClick={exportSTL}
              className="w-full bg-[#632CE5] text-[#212121] py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_0_20px_rgba(124,58,237,0.2)] group"
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
            <color attach="background" args={["#F3F4EE"]} />
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
            <Scene config={config} dimensions={dimensions} housingShape={housingShape} extrudeSettings={extrudeSettings} />
          </Canvas>
        </div>

        {/* HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-white/80 backdrop-blur-md border border-[#E2E3DD] p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#632CE5] animate-pulse" />
              <span className="text-[10px] font-black text-[#1A1C19] uppercase tracking-widest">3D Real-time Simulator</span>
            </div>
            <div className="text-[16px] font-black text-[#1A1C19] uppercase tracking-tighter">
              {dimensions.width.toFixed(1)} x {dimensions.depth.toFixed(1)} x {dimensions.height.toFixed(1)} mm
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#632CE5] text-white px-6 py-3 rounded-full flex items-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-[#7C4DFF]">
              <Check className="w-4 h-4" />
              {successMsg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Scene({ config, dimensions, housingShape, extrudeSettings }: { config: ClickerConfig; dimensions: any; housingShape: THREE.Shape; extrudeSettings: THREE.ExtrudeGeometryOptions }) {
  const { width, depth, height } = dimensions;
  
  // Create the housing geometry with cutouts for switches
  // For the preview, we'll use a main box and subtract visually by adding "holes" or using a clever shape.
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
