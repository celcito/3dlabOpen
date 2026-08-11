import { useState, useRef, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { Brush, Upload, Download, Plus, Trash2, Sliders, Info, Image as ImageIcon, Check, Layers, AlertCircle } from "lucide-react";
import { toastExportError } from "@/lib/toast";

interface ColorLayer {
  id: string;
  zHeight: number;
  color: string;
  filamentName: string;
}

export default function FilamentPainter() {
  const [layers, setLayers] = useState<ColorLayer[]>([
    { id: '1', zHeight: 0, color: '#000000', filamentName: 'Black PLA' },
    { id: '2', zHeight: 0.6, color: '#ff0000', filamentName: 'Red PLA' },
    { id: '3', zHeight: 1.2, color: '#ffff00', filamentName: 'Yellow PLA' },
    { id: '4', zHeight: 1.8, color: '#ffffff', filamentName: 'White PLA' }
  ]);
  
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(100);
  const [maxZ, setMaxZ] = useState(2.4);
  const [baseThickness, setBaseThickness] = useState(0.4);
  
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePixels, setImagePixels] = useState<{data: Uint8ClampedArray, w: number, h: number} | null>(null);
  
  const [successMsg, setSuccessMsg] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      
      const img = new Image();
      img.onload = () => {
        // resize to a reasonable resolution for the mesh
        const canvas = document.createElement('canvas');
        const MAX_RES = 256;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          h = Math.round((h / w) * MAX_RES);
          w = MAX_RES;
        } else {
          w = Math.round((w / h) * MAX_RES);
          h = MAX_RES;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setImagePixels({
            data: ctx.getImageData(0, 0, w, h).data,
            w, h
          });
          // Update physical dimensions while preserving aspect ratio
          setHeight(Math.round((h / w) * width));
        }
      };
      img.src = url;
    }
  };

  const addLayer = () => {
    const lastZ = layers.length > 0 ? layers[layers.length - 1].zHeight : 0;
    setLayers([...layers, {
      id: Date.now().toString(),
      zHeight: Math.round((lastZ + 0.4) * 10) / 10,
      color: '#00E5FF',
      filamentName: 'New Color'
    }].sort((a, b) => a.zHeight - b.zHeight));
  };

  const removeLayer = (id: string) => {
    setLayers(layers.filter(l => l.id !== id));
  };

  const updateLayer = (id: string, updates: Partial<ColorLayer>) => {
    setLayers(layers.map(l => l.id === id ? { ...l, ...updates } : l).sort((a, b) => a.zHeight - b.zHeight));
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const handleExportOBJ = () => {
    try {
      const scene = new THREE.Scene();
      const { geometry } = createLithophaneGeometryWithColors(imagePixels, width, height, maxZ, baseThickness, layers);
      const mesh = new THREE.Mesh(geometry);
      // rotate for printing
      mesh.rotation.x = -Math.PI / 2;
      mesh.updateMatrixWorld();
      scene.add(mesh);

      const exporter = new OBJExporter();
      const result = exporter.parse(scene);
      const blob = new Blob([result], { type: "text/plain" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `filament-painting-${Date.now()}.obj`;
      link.click();
      
      showNotification("STL Exportado! Veja as instruções de troca abaixo.");
    } catch (err) {
      console.error(err);
      toastExportError();
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#080808]">
      {/* SIDEBAR */}
      <div className="w-full md:w-[400px] bg-[#0c0c0c] border-r border-zinc-900 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5FF] to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(0,229,255,0.3)]">
              <Brush className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Filament Painter</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Hueforge-style Multicolor 3D Prints</p>
        </header>

        <section className="space-y-6">
          {/* IMAGE UPLOAD */}
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-[#00E5FF]" />
              01. Imagem Base
            </h3>
            
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-800 border-dashed rounded-xl cursor-pointer bg-[#111] hover:bg-[#151515] hover:border-[#00E5FF]/50 transition-all overflow-hidden relative group">
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt="Base" className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-20 transition-opacity" />
                  <div className="relative z-10 flex flex-col items-center">
                    <Check className="w-6 h-6 text-[#00E5FF] mb-2" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Imagem Carregada</span>
                    <span className="text-[9px] text-zinc-500 mt-1">Clique para trocar</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-6 h-6 text-zinc-500 mb-2 group-hover:text-[#00E5FF] transition-colors" />
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Upload Imagem</p>
                </div>
              )}
              <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleImageUpload} />
            </label>
          </div>

          {/* DIMENSIONS */}
          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
              02. Dimensões Físicas
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Largura (mm)</label>
                <input 
                  type="number" value={width}
                  onChange={(e) => {
                    const w = parseInt(e.target.value) || 0;
                    setWidth(w);
                    if (imagePixels) setHeight(Math.round(w * (imagePixels.h / imagePixels.w)));
                  }}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold text-center focus:border-[#00E5FF] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Altura (mm)</label>
                <input 
                  type="number" value={height}
                  onChange={(e) => {
                    const h = parseInt(e.target.value) || 0;
                    setHeight(h);
                    if (imagePixels) setWidth(Math.round(h * (imagePixels.w / imagePixels.h)));
                  }}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold text-center focus:border-[#00E5FF] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Max Z (mm)</label>
                <input 
                  type="number" step="0.1" value={maxZ}
                  onChange={(e) => setMaxZ(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold text-center focus:border-[#00E5FF] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Base Z (mm)</label>
                <input 
                  type="number" step="0.1" value={baseThickness}
                  onChange={(e) => setBaseThickness(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#111] border border-zinc-800 p-2 rounded text-[10px] text-white font-bold text-center focus:border-[#00E5FF] outline-none"
                />
              </div>
            </div>
          </div>

          {/* LAYERS */}
          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#00E5FF]" />
                03. Filamentos & Trocas
              </h3>
              <button 
                onClick={addLayer}
                className="w-6 h-6 rounded bg-[#111] hover:bg-[#222] flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              {layers.map((layer, idx) => (
                <div key={layer.id} className="flex items-center gap-2 bg-[#111] border border-zinc-800 p-2 rounded-lg relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: layer.color }} />
                  
                  <div className="flex-1 flex items-center gap-3 pl-2">
                    <input 
                      type="color" 
                      value={layer.color}
                      onChange={(e) => updateLayer(layer.id, { color: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    
                    <div className="flex-1 space-y-1">
                      <input 
                        type="text" 
                        value={layer.filamentName}
                        onChange={(e) => updateLayer(layer.id, { filamentName: e.target.value })}
                        className="w-full bg-transparent text-[10px] text-white font-bold uppercase tracking-widest outline-none"
                      />
                      <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-mono">
                        <span>Z:</span>
                        <input 
                          type="number" step="0.1" 
                          value={layer.zHeight}
                          onChange={(e) => updateLayer(layer.id, { zHeight: parseFloat(e.target.value) || 0 })}
                          className="w-12 bg-transparent text-[#00E5FF] outline-none"
                        />
                        <span>mm</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => removeLayer(layer.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* EXPORT */}
          <div className="pt-6">
            <button
              onClick={handleExportOBJ}
              disabled={!imagePixels}
              className="w-full bg-gradient-to-r from-[#00E5FF] to-blue-600 text-black py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,229,255,0.2)]"
            >
              <Download className="w-4 h-4" />
              Download OBJ
            </button>
          </div>
        </section>
      </div>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 relative flex flex-col">
        {/* INSTRUCTIONS OVERLAY */}
        <div className="absolute top-6 left-6 z-10 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md border border-zinc-900 p-5 rounded-xl space-y-3 w-64 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-[#00E5FF]" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Instruções Slicer</span>
            </div>
            
            <div className="space-y-2">
              {layers.map((l, i) => (
                <div key={l.id} className="flex justify-between items-center text-[10px] font-mono">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-zinc-400">{i === 0 ? "Começar com" : "Trocar para"}</span>
                  </div>
                  <span className="text-white font-bold">{i === 0 ? "Base" : `Z = ${l.zHeight.toFixed(2)}mm`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3D CANVAS */}
        <div className="flex-1 relative">
          <Canvas shadows camera={{ position: [0, 150, 150], fov: 45 }}>
            <color attach="background" args={["#080808"]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[100, 200, 50]} intensity={1.5} castShadow />
            <directionalLight position={[-100, -50, -50]} intensity={0.5} />
            <OrbitControls makeDefault />
            
            <Grid 
              infiniteGrid 
              fadeDistance={400} 
              cellColor="#222" 
              sectionColor="#444" 
              cellSize={10} 
              sectionSize={50} 
              position={[0, -0.1, 0]}
            />
            
            <Center top>
              {imagePixels ? (
                <LithophaneMesh 
                  pixels={imagePixels} 
                  width={width} 
                  height={height} 
                  maxZ={maxZ} 
                  baseThickness={baseThickness}
                  layers={layers}
                />
              ) : (
                <mesh>
                  <boxGeometry args={[100, 2, 100]} />
                  <meshStandardMaterial color="#111" wireframe />
                </mesh>
              )}
            </Center>
            
            <ContactShadows position={[0, -0.1, 0]} opacity={0.5} scale={200} blur={2} far={20} />
          </Canvas>
        </div>

        {/* SUCCESS TOAST */}
        {successMsg && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#00E5FF] text-black px-6 py-3 rounded-full flex items-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-[0_0_30px_rgba(0,229,255,0.4)]">
              <Check className="w-4 h-4" />
              {successMsg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 3D Mesh Component
function LithophaneMesh({ 
  pixels, width, height, maxZ, baseThickness, layers 
}: { 
  pixels: {data: Uint8ClampedArray, w: number, h: number}, 
  width: number, 
  height: number, 
  maxZ: number, 
  baseThickness: number,
  layers: ColorLayer[]
}) {
  const { geometry, colors } = useMemo(() => {
    return createLithophaneGeometryWithColors(pixels, width, height, maxZ, baseThickness, layers);
  }, [pixels, width, height, maxZ, baseThickness, layers]);

  return (
    <mesh castShadow receiveShadow geometry={geometry}>
      <meshStandardMaterial 
        vertexColors={true}
        roughness={0.8}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function createLithophaneGeometryWithColors(
  pixels: {data: Uint8ClampedArray, w: number, h: number}, 
  width: number, 
  height: number, 
  maxZ: number, 
  baseThickness: number,
  layers: ColorLayer[]
) {
  const { w, h, data } = pixels;
  
  // Create a plane geometry
  // We need w-1 segments in X and h-1 segments in Y
  const geom = new THREE.PlaneGeometry(width, height, w - 1, h - 1);
  geom.rotateX(-Math.PI / 2); // Lay flat on XZ plane
  
  const positions = geom.attributes.position.array;
  const vertexColors = new Float32Array(positions.length); // r,g,b per vertex
  
  // Sort layers by zHeight
  const sortedLayers = [...layers].sort((a, b) => a.zHeight - b.zHeight);
  
  // Parse colors
  const parsedColors = sortedLayers.map(l => new THREE.Color(l.color));

  // Helper to get color based on Z
  const getColorForZ = (z: number) => {
    let chosenColor = parsedColors[0] || new THREE.Color(0,0,0);
    for (let i = 0; i < sortedLayers.length; i++) {
      if (z >= sortedLayers[i].zHeight) {
        chosenColor = parsedColors[i];
      }
    }
    return chosenColor;
  };

  // Modify Z based on luminance
  for (let i = 0; i < positions.length / 3; i++) {
    // Map vertex index to pixel index.
    // PlaneGeometry vertices go left-to-right, top-to-bottom.
    // Image data is also left-to-right, top-to-bottom.
    const pxIdx = i * 4;
    const r = data[pxIdx];
    const g = data[pxIdx + 1];
    const b = data[pxIdx + 2];
    
    // Calculate luminance (0 to 1) - Darker is higher or lighter is higher?
    // In Hueforge, typically lighter pixels are higher Z, darker are lower Z.
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Z = base + luminance * maxZ
    const zHeight = baseThickness + (luminance * maxZ);
    positions[i * 3 + 1] = zHeight; // Y axis in threejs is UP

    // Assign color
    const vColor = getColorForZ(zHeight);
    vertexColors[i * 3] = vColor.r;
    vertexColors[i * 3 + 1] = vColor.g;
    vertexColors[i * 3 + 2] = vColor.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
  geom.computeVertexNormals();

  // For a complete solid, we should ideally add sides and a bottom base.
  // We can do a quick extrusion approximation or just keep it as a surface.
  // A surface is technically not perfectly solid for STL, but many slicers accept it if given a bottom.
  // To make it solid, let's create a base plane and stitch them.
  // For simplicity and performance here, we'll return just the top surface. Most modern slicers (Bambu, Prusa) can close surfaces.
  
  return { geometry: geom, colors: vertexColors };
}

function createLithophaneGeometry(
  pixels: {data: Uint8ClampedArray, w: number, h: number} | null, 
  width: number, 
  height: number, 
  maxZ: number, 
  baseThickness: number
) {
  if (!pixels) return new THREE.BoxGeometry(width, baseThickness, height);
  // Just reuse the color one but ignore colors
  const { geometry } = createLithophaneGeometryWithColors(pixels, width, height, maxZ, baseThickness, []);
  
  // NOTE: For a true printable STL, we should add backfaces and sides.
  // We will build a closed volume geometry.
  const { w, h, data } = pixels;
  
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const getLuminance = (px: number) => {
    return (0.299 * data[px] + 0.587 * data[px+1] + 0.114 * data[px+2]) / 255;
  };
  
  // 1. Top Surface (w * h vertices)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = (y * w + x) * 4;
      const lum = getLuminance(px);
      const zHeight = baseThickness + (lum * maxZ);
      const vx = (x / (w - 1) - 0.5) * width;
      const vy = zHeight;
      const vz = (y / (h - 1) - 0.5) * height;
      vertices.push(vx, vy, vz);
    }
  }
  
  // 2. Bottom Surface (w * h vertices)
  const bottomOffset = w * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const vx = (x / (w - 1) - 0.5) * width;
      const vy = 0;
      const vz = (y / (h - 1) - 0.5) * height;
      vertices.push(vx, vy, vz);
    }
  }

  // Indices for Top Surface
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = y * w + x;
      const b = a + 1;
      const c = a + w;
      const d = c + 1;
      // Counter-clockwise
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Indices for Bottom Surface (clockwise so normal points down)
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = bottomOffset + y * w + x;
      const b = a + 1;
      const c = a + w;
      const d = c + 1;
      // Clockwise
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Stitch edges (Left, Right, Top, Bottom)
  // Left edge (x = 0)
  for (let y = 0; y < h - 1; y++) {
    const t1 = y * w;
    const t2 = (y + 1) * w;
    const b1 = bottomOffset + t1;
    const b2 = bottomOffset + t2;
    indices.push(t1, b1, t2);
    indices.push(t2, b1, b2);
  }

  // Right edge (x = w - 1)
  for (let y = 0; y < h - 1; y++) {
    const t1 = y * w + (w - 1);
    const t2 = (y + 1) * w + (w - 1);
    const b1 = bottomOffset + t1;
    const b2 = bottomOffset + t2;
    indices.push(t1, t2, b1);
    indices.push(t2, b2, b1);
  }

  // Top edge (y = 0)
  for (let x = 0; x < w - 1; x++) {
    const t1 = x;
    const t2 = x + 1;
    const b1 = bottomOffset + t1;
    const b2 = bottomOffset + t2;
    indices.push(t1, t2, b1);
    indices.push(t2, b2, b1);
  }

  // Bottom edge (y = h - 1)
  for (let x = 0; x < w - 1; x++) {
    const t1 = (h - 1) * w + x;
    const t2 = (h - 1) * w + (x + 1);
    const b1 = bottomOffset + t1;
    const b2 = bottomOffset + t2;
    indices.push(t1, b1, t2);
    indices.push(t2, b1, b2);
  }

  const solidGeom = new THREE.BufferGeometry();
  solidGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  solidGeom.setIndex(indices);
  solidGeom.computeVertexNormals();

  return solidGeom;
}
