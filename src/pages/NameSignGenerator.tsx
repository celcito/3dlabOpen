import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, Text, Float } from "@react-three/drei";
import * as THREE from "three";
import { useNameSignGenerator, type SignConfig, FONTS } from "../hooks/useNameSignGenerator";
import { 
  Type, Download, Settings, Sliders, 
  Layers, Move, MousePointer2, 
  Check, Info, Sparkles, Box, 
  Maximize, Minimize, Layout, 
  Baseline, AlignCenter, MoreVertical
} from "lucide-react";

export default function NameSignGenerator() {
  const generator = useNameSignGenerator();
   const { config, setConfig, plateDimensions, previewGeometry, successMsg } = generator;
  const exportSTL = generator.handleExportSTL;
  const { isExporting } = generator;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#080808]">
      {/* SIDEBAR */}
      <div className="w-full md:w-80 bg-[#0c0c0c] border-r border-zinc-900 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/20 flex items-center justify-center">
              <Baseline className="w-6 h-6 text-[#00E5FF]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Name Sign</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Crie placas e letreiros 3D personalizados.</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-[#00E5FF]" />
              01. Texto do Sign
            </h3>
            <input
              type="text"
              value={config.text}
              onChange={(e) => setConfig({ ...config, text: e.target.value.toUpperCase() })}
              className="w-full bg-[#111] border border-zinc-800 p-3 rounded-lg text-sm text-white font-black uppercase focus:outline-none focus:border-[#00E5FF] transition-all"
              placeholder="DIGITE SEU NOME..."
            />
            
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Fonte</label>
              <select 
                value={config.font}
                onChange={(e) => setConfig({...config, font: e.target.value})}
                className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
              >
                {FONTS.map(f => <option key={f.url} value={f.url}>{f.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
              02. Dimensões (mm)
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Tamanho da Fonte</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.fontSize}mm</span>
              </div>
              <input 
                type="range" min="10" max="100" step="1" 
                value={config.fontSize} 
                onChange={(e) => setConfig({...config, fontSize: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Relevo do Texto</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.textHeight}mm</span>
              </div>
              <input 
                type="range" min="1" max="15" step="0.5" 
                value={config.textHeight} 
                onChange={(e) => setConfig({...config, textHeight: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Espessura Base</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.plateThickness}mm</span>
              </div>
              <input 
                type="range" min="1" max="10" step="0.5" 
                value={config.plateThickness} 
                onChange={(e) => setConfig({...config, plateThickness: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Layout className="w-3.5 h-3.5 text-[#00E5FF]" />
              03. Estilo da Placa
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Padding X</label>
                <input 
                  type="number" value={config.paddingX}
                  onChange={(e) => setConfig({...config, paddingX: parseInt(e.target.value) || 0})}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Padding Y</label>
                <input 
                  type="number" value={config.paddingY}
                  onChange={(e) => setConfig({...config, paddingY: parseInt(e.target.value) || 0})}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Bordas</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.borderRadius}mm</span>
              </div>
              <input 
                type="range" min="0" max="40" step="1" 
                value={config.borderRadius} 
                onChange={(e) => setConfig({...config, borderRadius: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-all"
              onClick={() => setConfig({...config, mountingHoles: !config.mountingHoles})}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${config.mountingHoles ? 'bg-[#00E5FF] border-[#00E5FF]' : 'border-zinc-700'}`}>
                  {config.mountingHoles && <Check className="w-3 h-3 text-black" />}
                </div>
                <span className="text-[10px] font-black uppercase text-white">Furos de Fixação</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
               onClick={exportSTL}
              disabled={isExporting}
              className="w-full bg-[#00E5FF] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] group disabled:opacity-50"
            >
              {isExporting ? <span className="animate-pulse">PROCESSANDO...</span> : (
                <>
                  <Download className="w-4 h-4 group-hover:bounce" />
                  Download STL
                </>
              )}
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
             <Scene config={config} previewGeometry={previewGeometry} />
            </Center>
          </Canvas>
        </div>

        {/* HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md border border-zinc-900 p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">3D Real-time Preview</span>
            </div>
            <div className="text-[16px] font-black text-white uppercase tracking-tighter">
              Aprox. {plateDimensions.width.toFixed(0)} x {plateDimensions.height.toFixed(0)} mm
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

function Scene({ config, previewGeometry }: { config: SignConfig; previewGeometry: { shape: THREE.Shape; textW: number; textH: number; pW: number; pT: number } }) {
  // We use Text from drei for the preview as it's much faster than re-extruding real 3D geometry every frame.
  // The STL export uses the actual TextGeometry.
  
  // Estimate dimensions for the base plate
  // In a more robust version, we'd use a ref to measure the Text component
  const { shape: plateShape, textW, textH, pW, pT } = previewGeometry;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* PLATE BASE */}
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[plateShape, { depth: pT, bevelEnabled: false }]} />
        <meshStandardMaterial color={config.baseColor} roughness={0.4} metalness={0.2} />
      </mesh>

      {/* TEXT PREVIEW */}
      <Text
        position={[0, 0, pT + (config.textHeight / 20)]}
        fontSize={config.fontSize / 10}
        color={config.textColor}
        anchorX="center"
        anchorY="middle"
        font={config.font === FONTS[0].url ? undefined : "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGkyMZhrib2Bg-4.woff"}
        maxWidth={pW - 1}
      >
        {config.text}
        <meshStandardMaterial color={config.textColor} roughness={0.3} />
      </Text>
      
      {/* Visual Text Extrusion (Simplified for preview) */}
      <mesh position={[0, 0, pT + (config.textHeight / 20)]}>
        <boxGeometry args={[textW, textH, config.textHeight / 10]} />
        <meshStandardMaterial color={config.textColor} transparent opacity={0.1} />
      </mesh>
    </group>
  );
}
