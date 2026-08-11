import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Text, Center } from "@react-three/drei";
import * as THREE from "three";
import { useQrGenerator, type QrConfig } from "../hooks/useQrGenerator";
import { 
  QrCode, Download, Settings, RefreshCcw, 
  Trash2, Sliders, Type, Info, Layers, 
  Move, ArrowUpDown, Check, AlertTriangle,
  Play, Save, FileDown, Undo, Sparkles
} from "lucide-react";

export default function QrGenerator() {
  const generator = useQrGenerator();
  const { config, setConfig, qrMatrix, plateDimensions, previewGeometry, successMsg } = generator;
  const exportSTL = generator.handleExportSTL;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#080808]">
      {/* LEFT PANEL: SETTINGS */}
      <div className="w-full md:w-96 bg-[#0c0c0c] border-r border-zinc-900 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <QrCode className="w-6 h-6 text-[#00E5FF]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">QR 3D Designer</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Gere placas 3D personalizadas com QR Codes funcionais.</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-[#00E5FF]" />
              01. Conteúdo do QR
            </h3>
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Texto ou URL</label>
              <textarea
                value={config.text}
                onChange={(e) => setConfig({ ...config, text: e.target.value })}
                placeholder="Insira o link ou texto aqui..."
                className="w-full bg-[#111] border border-zinc-800 p-3 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-[#00E5FF] min-h-[80px] resize-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
              02. Geometria 3D
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">Tamanho Módulo (mm)</label>
                <input
                  type="number"
                  value={config.size}
                  onChange={(e) => setConfig({ ...config, size: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">Padding (mm)</label>
                <input
                  type="number"
                  value={config.padding}
                  onChange={(e) => setConfig({ ...config, padding: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">Espessura Base (mm)</label>
                <input
                  type="number"
                  value={config.thickness}
                  onChange={(e) => setConfig({ ...config, thickness: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">Altura QR (mm)</label>
                <input
                  type="number"
                  value={config.qrHeight}
                  onChange={(e) => setConfig({ ...config, qrHeight: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-zinc-600 block">Arredondamento Bordas (mm)</label>
              <input
                type="range"
                min="0"
                max="20"
                value={config.borderRadius}
                onChange={(e) => setConfig({ ...config, borderRadius: parseFloat(e.target.value) })}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-zinc-700 font-black">
                <span>0mm</span>
                <span>{config.borderRadius}mm</span>
                <span>20mm</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#00E5FF]" />
              03. Identificação / Label
            </h3>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={config.includeText}
                onChange={(e) => setConfig({ ...config, includeText: e.target.checked })}
                className="w-4 h-4 accent-[#00E5FF]"
              />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Incluir Texto na Placa</span>
            </div>

            {config.includeText && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-zinc-600 block">Texto da Etiqueta</label>
                  <input
                    type="text"
                    value={config.label}
                    onChange={(e) => setConfig({ ...config, label: e.target.value })}
                    className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-zinc-600 block">Tamanho Texto</label>
                    <input
                      type="number"
                      value={config.labelSize}
                      onChange={(e) => setConfig({ ...config, labelSize: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-zinc-600 block">Relevo Texto</label>
                    <input
                      type="number"
                      value={config.labelDepth}
                      onChange={(e) => setConfig({ ...config, labelDepth: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6">
            <button
               onClick={exportSTL}
              disabled={qrMatrix.length === 0}
              className="w-full bg-[#00E5FF] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <Download className="w-4 h-4 group-hover:bounce" />
              Exportar para STL
            </button>
            <p className="text-[8px] text-zinc-600 text-center mt-3 uppercase font-bold tracking-tighter">
              * O modelo gerado é otimizado para impressão 3D (FDM ou SLA).
            </p>
          </div>
        </section>
      </div>

      {/* CENTER: 3D PREVIEW */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <Canvas shadows camera={{ position: [50, 50, 50], fov: 45 }} gl={{ antialias: true }}>
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

             <Scene config={config} qrMatrix={qrMatrix} plateDimensions={plateDimensions} previewGeometry={previewGeometry} />
          </Canvas>
        </div>

        {/* HUD OVERLAYS */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md border border-zinc-900 p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">3D Real-time Preview</span>
            </div>
            <div className="text-[16px] font-black text-white uppercase tracking-tighter">
              {plateDimensions.width.toFixed(1)} x {plateDimensions.height.toFixed(1)} mm
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

        <div className="absolute bottom-6 right-6">
          <div className="bg-zinc-950/80 backdrop-blur-md border border-zinc-900 p-3 rounded-lg flex gap-4 text-[8px] text-zinc-500 font-black uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <Move className="w-3 h-3" /> Orbit
            </div>
            <div className="flex items-center gap-2">
              <Sliders className="w-3 h-3" /> Zoom
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene({ config, qrMatrix, plateDimensions, previewGeometry }: { config: QrConfig; qrMatrix: number[][]; plateDimensions: { width: number; height: number }; previewGeometry: { shape: THREE.Shape; extrudeSettings: THREE.ExtrudeGeometryOptions } }) {
  const { width, height } = plateDimensions;
  
  const { shape: plateShape, extrudeSettings } = previewGeometry;

  const moduleSize = config.size / 10;
  const qrSize = qrMatrix.length;
  const qrOffset = -(qrSize * moduleSize) / 2;
  const yShift = config.includeText ? config.labelSize / 10 : 0;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* PLATE BASE */}
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[plateShape, extrudeSettings]} />
        <meshStandardMaterial color={config.baseColor} roughness={0.4} metalness={0.2} />
      </mesh>

      {/* QR CODE MODULES */}
      {qrMatrix.map((row, y) => (
        row.map((active, x) => (
          active ? (
            <mesh 
              key={`${x}-${y}`} 
              position={[
                qrOffset + (x * moduleSize) + (moduleSize / 2), 
                - (qrOffset + (y * moduleSize) + (moduleSize / 2)) + yShift, 
                (config.thickness / 10) + (config.qrHeight / 20)
              ]}
              castShadow
            >
              <boxGeometry args={[moduleSize, moduleSize, config.qrHeight / 10]} />
              <meshStandardMaterial color={config.qrColor} roughness={0.3} metalness={0.1} />
            </mesh>
          ) : null
        ))
      ))}

      {/* LABEL TEXT */}
      {config.includeText && (
        <Center top position={[0, - (height / 20) + (config.padding / 10) + (config.labelSize / 20), (config.thickness / 10) + (config.labelDepth / 20)]}>
          <Text
            fontSize={config.labelSize / 10}
            color={config.qrColor}
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGkyMZhrib2Bg-4.woff"
          >
            {config.label}
            <meshStandardMaterial color={config.qrColor} roughness={0.3} />
          </Text>
        </Center>
      )}
    </group>
  );
}
