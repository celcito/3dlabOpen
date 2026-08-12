import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, PerspectiveCamera, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useFace3DGenerator, useFaceMeshGeometry, type FaceConfig } from "../hooks/useFace3DGenerator";
import { 
  UserCircle2, Download, Settings, Sliders, 
  Trash2, Layers, Move, MousePointer2, 
  Check, Info, Sparkles, Box, 
  Maximize, Minimize, Activity, Cpu,
  Image as ImageIcon, Camera, RefreshCw
} from "lucide-react";

export default function Face3DGenerator() {
  const generator = useFace3DGenerator();
  const { config, setConfig, image, setImage, heightData, isProcessing, successMsg, handleImageUpload } = generator;
  const exportSTL = generator.handleExportSTL;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#F9FAF4]">
      {/* SIDEBAR */}
      <div className="w-full md:w-80 bg-[#F9FAF4] border-r border-[#E2E3DD] overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
              <UserCircle2 className="w-6 h-6 text-[#632CE5]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-[#1A1C19]">Face 3D</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Transforme fotos em relevos 3D imprimíveis.</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-[#632CE5]" />
              01. Foto Fonte
            </h3>
            
            {!image ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-[#E8E9E3] rounded-2xl hover:border-[#632CE5]/40 hover:bg-[#632CE5]/5 transition-all cursor-pointer group">
                <Camera className="w-8 h-8 text-zinc-600 group-hover:text-[#632CE5] mb-2" />
                <span className="text-[10px] font-black uppercase text-zinc-500 group-hover:text-[#1A1C19] tracking-widest">Carregar Foto</span>
                <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
              </label>
            ) : (
              <div className="relative group">
                <img src={image} className="w-full h-40 object-cover rounded-xl border border-[#E8E9E3]" />
                <button 
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 p-2 bg-white/60 backdrop-blur-md rounded-lg text-[#212121] hover:bg-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#632CE5]" />
              02. Parâmetros 3D
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Intensidade do Relevo</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.intensity}mm</span>
              </div>
              <input 
                type="range" min="1" max="30" step="1" 
                value={config.intensity} 
                onChange={(e) => setConfig({...config, intensity: parseInt(e.target.value)})}
                className="w-full accent-[#632CE5] h-1.5 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Contraste</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.contrast.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0.5" max="3" step="0.1" 
                value={config.contrast} 
                onChange={(e) => setConfig({...config, contrast: parseFloat(e.target.value)})}
                className="w-full accent-[#632CE5] h-1.5 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Resolução</label>
                <select 
                  value={config.resolution}
                  onChange={(e) => setConfig({...config, resolution: parseInt(e.target.value)})}
                  className="w-full bg-white border border-[#E8E9E3] p-2 rounded text-[10px] text-[#212121] font-bold"
                >
                  <option value={64}>Baixa (64px)</option>
                  <option value={128}>Média (128px)</option>
                  <option value={256}>Alta (256px)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Tamanho (mm)</label>
                <input 
                  type="number" value={config.size}
                  onChange={(e) => setConfig({...config, size: parseInt(e.target.value) || 0})}
                  className="w-full bg-white border border-[#E8E9E3] p-2 rounded text-[10px] text-[#212121] font-bold"
                />
              </div>
            </div>

            <button 
              onClick={() => setConfig({...config, invert: !config.invert})}
              className={`w-full flex items-center justify-center gap-2 py-3 border rounded text-[9px] font-black uppercase tracking-widest transition-all ${config.invert ? 'bg-[#632CE5] text-[#212121] border-[#632CE5]' : 'bg-[#E8E9E3] text-zinc-500 border-[#E8E9E3]'}`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Inverter Relevo
            </button>
          </div>

          <div className="pt-6">
            <button
               onClick={exportSTL}
              disabled={!heightData}
              className="w-full bg-[#632CE5] text-[#212121] py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_0_20px_rgba(124,58,237,0.2)] group disabled:opacity-50"
            >
              <Download className="w-4 h-4 group-hover:bounce" />
              Exportar Face STL
            </button>
          </div>
        </section>
      </div>

      {/* VIEWPORT */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <Canvas shadows camera={{ position: [0, 40, 80], fov: 45 }}>
            <color attach="background" args={["#F3F4EE"]} />
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
              {heightData && (
                <FaceMesh 
                  heightData={heightData} 
                  config={config} 
                />
              )}
            </Center>
            <ContactShadows position={[0, -0.1, 0]} opacity={0.4} scale={15} blur={1} far={10} />
          </Canvas>
        </div>

        {/* HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-white/80 backdrop-blur-md border border-[#E2E3DD] p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-500' : 'bg-[#632CE5]'} animate-pulse`} />
              <span className="text-[10px] font-black text-[#1A1C19] uppercase tracking-widest">
                {isProcessing ? 'Processando Foto...' : 'Previsão de Relevo'}
              </span>
            </div>
            <div className="text-[16px] font-black text-[#1A1C19] uppercase tracking-tighter">
              {config.size} x {config.size} mm
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

function FaceMesh({ heightData, config }: { heightData: Float32Array; config: FaceConfig }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const res = config.resolution;
  const size = config.size / 10;
  const intensity = config.intensity / 10;
  const base = config.baseThickness / 10;

  useFaceMeshGeometry(meshRef, heightData, intensity, res);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* The actual relief mesh */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <planeGeometry args={[size, size, res - 1, res - 1]} />
        <meshStandardMaterial 
          color="#ffffff" 
          roughness={0.6} 
          metalness={0.1}
          flatShading={false}
        />
      </mesh>

      {/* Base thickness */}
      <mesh position={[0, 0, -base / 2]}>
        <boxGeometry args={[size, size, base]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>
    </group>
  );
}
