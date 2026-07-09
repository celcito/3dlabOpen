import { useState, useRef, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, PerspectiveCamera, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { 
  UserCircle2, Download, Settings, Sliders, 
  Trash2, Layers, Move, MousePointer2, 
  Check, Info, Sparkles, Box, 
  Maximize, Minimize, Activity, Cpu,
  Image as ImageIcon, Camera, RefreshCw
} from "lucide-react";

interface FaceConfig {
  intensity: number;
  baseThickness: number;
  size: number;
  resolution: number;
  invert: boolean;
  contrast: number;
  baseColor: string;
}

export default function Face3DGenerator() {
  const [config, setConfig] = useState<FaceConfig>({
    intensity: 8,
    baseThickness: 3,
    size: 100,
    resolution: 128,
    invert: false,
    contrast: 1.2,
    baseColor: "#ffffff"
  });

  const [image, setImage] = useState<string | null>(null);
  const [heightData, setHeightData] = useState<Float32Array | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (f) => {
      setImage(f.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!image) return;
    processImage();
  }, [image, config.resolution, config.contrast, config.invert]);

  const processImage = () => {
    setIsProcessing(true);
    const img = new Image();
    img.src = image!;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const res = config.resolution;
      canvas.width = res;
      canvas.height = res;

      // Draw image to fit canvas
      ctx.drawImage(img, 0, 0, res, res);
      const imageData = ctx.getImageData(0, 0, res, res);
      const data = imageData.data;
      const heights = new Float32Array(res * res);

      for (let i = 0; i < data.length; i += 4) {
        // Simple grayscale: (R+G+B)/3
        let avg = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
        
        // Apply contrast
        avg = (avg - 0.5) * config.contrast + 0.5;
        avg = Math.max(0, Math.min(1, avg));

        if (config.invert) avg = 1 - avg;
        
        heights[i / 4] = avg;
      }

      setHeightData(heights);
      setIsProcessing(false);
    };
  };

  const handleExportSTL = () => {
    if (!heightData) return;
    
    try {
      const exporter = new STLExporter();
      const res = config.resolution;
      const size = config.size / 10;
      const intensity = config.intensity / 10;
      const base = config.baseThickness / 10;

      // Create relief geometry
      const reliefGeom = new THREE.PlaneGeometry(size, size, res - 1, res - 1);
      const positions = reliefGeom.attributes.position.array as Float32Array;

      for (let i = 0; i < res * res; i++) {
        positions[i * 3 + 2] = heightData[i] * intensity;
      }
      reliefGeom.computeVertexNormals();

      // Create base geometry
      const baseGeom = new THREE.BoxGeometry(size, size, base);
      baseGeom.translate(0, 0, -base / 2);

      // Group them for export
      const group = new THREE.Group();
      const reliefMesh = new THREE.Mesh(reliefGeom);
      const baseMesh = new THREE.Mesh(baseGeom);
      
      group.add(reliefMesh);
      group.add(baseMesh);

      // Rotate group for printable orientation (Z up usually for slicers, but Three.js Y up)
      group.rotation.x = -Math.PI / 2;
      group.updateMatrixWorld();

      const result = exporter.parse(group, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `face-3d-${Date.now()}.stl`;
      link.click();
      
      showNotification("STL da Face exportado!");
    } catch (err) {
      console.error(err);
      alert("Erro ao exportar.");
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
              <UserCircle2 className="w-6 h-6 text-[#00E5FF]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Face 3D</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Transforme fotos em relevos 3D imprimíveis.</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-[#00E5FF]" />
              01. Foto Fonte
            </h3>
            
            {!image ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-zinc-800 rounded-2xl hover:border-[#00E5FF]/40 hover:bg-[#00E5FF]/5 transition-all cursor-pointer group">
                <Camera className="w-8 h-8 text-zinc-600 group-hover:text-[#00E5FF] mb-2" />
                <span className="text-[10px] font-black uppercase text-zinc-500 group-hover:text-white tracking-widest">Carregar Foto</span>
                <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
              </label>
            ) : (
              <div className="relative group">
                <img src={image} className="w-full h-40 object-cover rounded-xl border border-zinc-800" />
                <button 
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-md rounded-lg text-white hover:bg-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
              02. Parâmetros 3D
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Intensidade do Relevo</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.intensity}mm</span>
              </div>
              <input 
                type="range" min="1" max="30" step="1" 
                value={config.intensity} 
                onChange={(e) => setConfig({...config, intensity: parseInt(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Contraste</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.contrast.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0.5" max="3" step="0.1" 
                value={config.contrast} 
                onChange={(e) => setConfig({...config, contrast: parseFloat(e.target.value)})}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Resolução</label>
                <select 
                  value={config.resolution}
                  onChange={(e) => setConfig({...config, resolution: parseInt(e.target.value)})}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
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
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold"
                />
              </div>
            </div>

            <button 
              onClick={() => setConfig({...config, invert: !config.invert})}
              className={`w-full flex items-center justify-center gap-2 py-3 border rounded text-[9px] font-black uppercase tracking-widest transition-all ${config.invert ? 'bg-[#00E5FF] text-black border-[#00E5FF]' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Inverter Relevo
            </button>
          </div>

          <div className="pt-6">
            <button
              onClick={handleExportSTL}
              disabled={!heightData}
              className="w-full bg-[#00E5FF] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] group disabled:opacity-50"
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
          <div className="bg-black/80 backdrop-blur-md border border-zinc-900 p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-500' : 'bg-[#00E5FF]'} animate-pulse`} />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">
                {isProcessing ? 'Processando Foto...' : 'Previsão de Relevo'}
              </span>
            </div>
            <div className="text-[16px] font-black text-white uppercase tracking-tighter">
              {config.size} x {config.size} mm
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

function FaceMesh({ heightData, config }: { heightData: Float32Array; config: FaceConfig }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const res = config.resolution;
  const size = config.size / 10;
  const intensity = config.intensity / 10;
  const base = config.baseThickness / 10;

  useEffect(() => {
    if (!meshRef.current) return;
    
    const positions = meshRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < res * res; i++) {
      positions[i * 3 + 2] = heightData[i] * intensity;
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  }, [heightData, intensity, res]);

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
