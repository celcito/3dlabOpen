import { useState, useRef, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, Text, Float } from "@react-three/drei";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { 
  Type, Download, Settings, Sliders, 
  Layers, Move, MousePointer2, 
  Check, Info, Sparkles, Box, 
  Maximize, Minimize, Layout, 
  Baseline, AlignCenter, MoreVertical
} from "lucide-react";

interface SignConfig {
  text: string;
  font: string;
  fontSize: number;
  textHeight: number;
  letterSpacing: number;
  plateThickness: number;
  paddingX: number;
  paddingY: number;
  borderRadius: number;
  baseColor: string;
  textColor: string;
  mountingHoles: boolean;
  holeSize: number;
  holePadding: number;
}

const FONTS = [
  { name: "Inter Black", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/helvetiker_bold.typeface.json" },
  { name: "Modern Sans", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/helvetiker_regular.typeface.json" },
  { name: "Gentilis", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/gentilis_bold.typeface.json" }
];

export default function NameSignGenerator() {
  const [config, setConfig] = useState<SignConfig>({
    text: "VERTICE",
    font: FONTS[0].url,
    fontSize: 20,
    textHeight: 4,
    letterSpacing: 1,
    plateThickness: 3,
    paddingX: 10,
    paddingY: 10,
    borderRadius: 5,
    baseColor: "#121212",
    textColor: "#00E5FF",
    mountingHoles: true,
    holeSize: 4,
    holePadding: 6
  });

  const [successMsg, setSuccessMsg] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const plateDimensions = useMemo(() => {
    // Rough estimate for the UI HUD, the actual scene uses Three.js measurements
    const charWidth = config.fontSize * 0.7;
    const textW = config.text.length * (charWidth + config.letterSpacing);
    const textH = config.fontSize;
    
    return {
      width: textW + (config.paddingX * 2),
      height: textH + (config.paddingY * 2)
    };
  }, [config]);

  const handleExportSTL = async () => {
    setIsExporting(true);
    try {
      const exporter = new STLExporter();
      const loader = new FontLoader();
      
      // We need to load the font as a promise to use in the exporter
      const font = await new Promise<any>((resolve) => {
        loader.load(config.font, (f) => resolve(f));
      });

      const group = new THREE.Group();

      // 1. Text Geometry
      const textGeom = new TextGeometry(config.text, {
        font: font,
        size: config.fontSize / 10,
        depth: config.textHeight / 10,
        curveSegments: 12,
        bevelEnabled: false
      });
      
      textGeom.computeBoundingBox();
      const bbox = textGeom.boundingBox!;
      const textW = bbox.max.x - bbox.min.x;
      const textH = bbox.max.y - bbox.min.y;
      
      // Center the text geometry
      textGeom.translate(-textW / 2, -textH / 2, config.plateThickness / 10);
      
      // 2. Plate Geometry
      const pW = textW + (config.paddingX / 5);
      const pH = textH + (config.paddingY / 5);
      const pR = config.borderRadius / 10;
      const pT = config.plateThickness / 10;
      
      const plateShape = new THREE.Shape();
      plateShape.moveTo(-pW / 2 + pR, -pH / 2);
      plateShape.lineTo(pW / 2 - pR, -pH / 2);
      plateShape.quadraticCurveTo(pW / 2, -pH / 2, pW / 2, -pH / 2 + pR);
      plateShape.lineTo(pW / 2, pH / 2 - pR);
      plateShape.quadraticCurveTo(pW / 2, pH / 2, pW / 2 - pR, pH / 2);
      plateShape.lineTo(-pW / 2 + pR, pH / 2);
      plateShape.quadraticCurveTo(-pW / 2, pH / 2, -pW / 2, pH / 2 - pR);
      plateShape.lineTo(-pW / 2, -pH / 2 + pR);
      plateShape.quadraticCurveTo(-pW / 2, -pH / 2, -pW / 2 + pR, -pH / 2);

      if (config.mountingHoles) {
        const hR = config.holeSize / 20;
        const hPad = config.holePadding / 10;
        
        // Add 4 holes
        const holes = [
          [-pW / 2 + hPad, -pH / 2 + hPad],
          [pW / 2 - hPad, -pH / 2 + hPad],
          [pW / 2 - hPad, pH / 2 - hPad],
          [-pW / 2 + hPad, pH / 2 - hPad]
        ];
        
        holes.forEach(([hx, hy]) => {
          const hole = new THREE.Path();
          hole.absarc(hx, hy, hR, 0, Math.PI * 2, true);
          plateShape.holes.push(hole);
        });
      }

      const plateGeom = new THREE.ExtrudeGeometry(plateShape, {
        depth: pT,
        bevelEnabled: false
      });

      const merged = BufferGeometryUtils.mergeGeometries([plateGeom, textGeom]);
      const mesh = new THREE.Mesh(merged);
      
      const result = exporter.parse(mesh, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `name-sign-${config.text.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.stl`;
      link.click();
      
      showNotification("STL exportado com sucesso!");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Falha ao exportar STL.");
    } finally {
      setIsExporting(false);
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
              onClick={handleExportSTL}
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
              <Scene config={config} />
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

function Scene({ config }: { config: SignConfig }) {
  // We use Text from drei for the preview as it's much faster than re-extruding real 3D geometry every frame.
  // The STL export uses the actual TextGeometry.
  
  // Estimate dimensions for the base plate
  // In a more robust version, we'd use a ref to measure the Text component
  const textW = config.text.length * (config.fontSize * 0.6) / 10;
  const textH = (config.fontSize / 10);
  
  const pW = textW + (config.paddingX / 5);
  const pH = textH + (config.paddingY / 5);
  const pR = config.borderRadius / 10;
  const pT = config.plateThickness / 10;

  const plateShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-pW / 2 + pR, -pH / 2);
    shape.lineTo(pW / 2 - pR, -pH / 2);
    shape.quadraticCurveTo(pW / 2, -pH / 2, pW / 2, -pH / 2 + pR);
    shape.lineTo(pW / 2, pH / 2 - pR);
    shape.quadraticCurveTo(pW / 2, pH / 2, pW / 2 - pR, pH / 2);
    shape.lineTo(-pW / 2 + pR, pH / 2);
    shape.quadraticCurveTo(-pW / 2, pH / 2, -pW / 2, pH / 2 - pR);
    shape.lineTo(-pW / 2, -pH / 2 + pR);
    shape.quadraticCurveTo(-pW / 2, -pH / 2, -pW / 2 + pR, -pH / 2);

    if (config.mountingHoles) {
      const hR = config.holeSize / 20;
      const hPad = config.holePadding / 10;
      
      const holes = [
        [-pW / 2 + hPad, -pH / 2 + hPad],
        [pW / 2 - hPad, -pH / 2 + hPad],
        [pW / 2 - hPad, pH / 2 - hPad],
        [-pW / 2 + hPad, pH / 2 - hPad]
      ];
      
      holes.forEach(([hx, hy]) => {
        const hole = new THREE.Path();
        hole.absarc(hx, hy, hR, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      });
    }

    return shape;
  }, [pW, pH, pR, config.mountingHoles, config.holeSize, config.holePadding]);

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
