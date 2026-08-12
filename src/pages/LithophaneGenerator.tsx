import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center } from "@react-three/drei";
import * as THREE from "three";
import { Download, Upload, Sliders, Image as ImageIcon, Box, Cylinder, AlertCircle } from "lucide-react";
import { useLithophaneGenerator, type ImagePixels } from "../hooks/useLithophaneGenerator";

export default function LithophaneGenerator() {
  const generator = useLithophaneGenerator(createLithophaneGeometry);
  const { imageUrl, imagePixels, shape, setShape, width, setWidth, height, minThick, setMinThick, maxThick, setMaxThick, curveAngle, setCurveAngle, isLoading, geometry, handleImageUpload, handleExportSTL } = generator;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#F9FAF4]">
      {/* SIDEBAR */}
      <div className="w-full md:w-80 bg-[#F9FAF4] border-r border-[#E2E3DD] overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#632CE5]/20 flex items-center justify-center border border-[#632CE5]/30">
              <ImageIcon className="w-4 h-4 text-[#632CE5]" />
            </div>
            <h1 className="text-[13px] font-black uppercase tracking-widest text-[#1A1C19]">
              Lithophane<br/><span className="text-[#632CE5]">Generator</span>
            </h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
            Transforme fotos em painéis 3D
          </p>
        </header>

        <section className="space-y-4 pt-4 border-t border-[#E2E3DD]">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-[#632CE5]" />
            01. Imagem
          </h3>
          <div className="space-y-2">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#E8E9E3] rounded-xl hover:bg-[#E8E9E3]/50 hover:border-[#E8E9E3] transition-colors cursor-pointer relative overflow-hidden group">
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt="Upload" className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-10 transition-opacity" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                    <ImageIcon className="w-6 h-6 text-[#1A1C19]" />
                    <span className="text-[9px] uppercase font-bold text-[#1A1C19] tracking-widest">Trocar Imagem</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload className="w-6 h-6 text-zinc-600" />
                  <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest">Upload JPG/PNG</span>
                </div>
              )}
            </label>
          </div>
        </section>

        <section className="space-y-4 pt-4 border-t border-[#E2E3DD]">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
            <Box className="w-3.5 h-3.5 text-[#632CE5]" />
            02. Formato
          </h3>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setShape("flat")}
              className={`py-3 rounded-lg border ${shape === "flat" ? "border-[#632CE5] bg-[#632CE5]/10 text-[#212121]" : "border-[#E8E9E3] bg-[#E8E9E3] text-zinc-500"} transition-all flex flex-col items-center gap-2`}
            >
              <Box className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase tracking-widest">Plano</span>
            </button>
            <button 
              onClick={() => setShape("curved")}
              className={`py-3 rounded-lg border ${shape === "curved" ? "border-[#632CE5] bg-[#632CE5]/10 text-[#212121]" : "border-[#E8E9E3] bg-[#E8E9E3] text-zinc-500"} transition-all flex flex-col items-center gap-2`}
            >
              <Cylinder className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase tracking-widest">Curvo</span>
            </button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-[9px] uppercase font-bold text-zinc-600">Largura Máx.</label>
              <span className="text-[10px] font-mono text-[#632CE5]">{width}mm</span>
            </div>
            <input type="range" min="50" max="250" value={width} onChange={(e) => setWidth(parseInt(e.target.value))} className="w-full accent-[#632CE5] h-1.5 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer" />
          </div>
          
          {shape === "curved" && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Ângulo da Curva</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{curveAngle}°</span>
              </div>
              <input type="range" min="60" max="360" value={curveAngle} onChange={(e) => setCurveAngle(parseInt(e.target.value))} className="w-full accent-[#632CE5] h-1.5 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer" />
            </div>
          )}
        </section>

        <section className="space-y-4 pt-4 border-t border-[#E2E3DD]">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[#632CE5]" />
            03. Espessura (Z)
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-[9px] uppercase font-bold text-zinc-600">Espessura Mín. (Branco)</label>
              <span className="text-[10px] font-mono text-[#632CE5]">{minThick.toFixed(1)}mm</span>
            </div>
            <input type="range" min="0.4" max="1.6" step="0.1" value={minThick} onChange={(e) => setMinThick(parseFloat(e.target.value))} className="w-full accent-[#632CE5] h-1.5 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer" />
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-[9px] uppercase font-bold text-zinc-600">Espessura Máx. (Preto)</label>
              <span className="text-[10px] font-mono text-[#632CE5]">{maxThick.toFixed(1)}mm</span>
            </div>
            <input type="range" min="1.0" max="5.0" step="0.1" value={maxThick} onChange={(e) => setMaxThick(parseFloat(e.target.value))} className="w-full accent-[#632CE5] h-1.5 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer" />
          </div>
        </section>

        <section className="pt-6 border-t border-[#E2E3DD]">
          <button 
            onClick={handleExportSTL}
            disabled={!imagePixels || isLoading}
            className="w-full bg-gradient-to-r from-[#632CE5] to-blue-600 text-black py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(124,58,237,0.2)]"
          >
            {isLoading ? (
              <span className="animate-pulse">Processando...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download STL
              </>
            )}
          </button>
        </section>
      </div>

      {/* VIEWPORT */}
      <div className="flex-1 relative flex flex-col">
        <div className="absolute top-6 left-6 z-10 pointer-events-none">
          <div className="bg-white/80 backdrop-blur-md border border-[#E2E3DD] p-5 rounded-xl space-y-3 w-64 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-[#632CE5]" />
              <span className="text-[10px] font-black text-[#1A1C19] uppercase tracking-widest">Dicas de Impressão</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400 space-y-1">
              <p>• Use 100% Infill</p>
              <p>• Altura da camada: 0.12mm ou menor</p>
              <p>• Imprima de pé para melhor resolução (no eixo Z da impressora)</p>
              <p>• Filamento branco ou claro funciona melhor</p>
            </div>
          </div>
        </div>

        <div className="flex-1 relative">
          <Canvas shadows camera={{ position: [0, 0, 150], fov: 45 }}>
            <color attach="background" args={["#F3F4EE"]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[100, 200, 100]} intensity={1.5} castShadow />
            <directionalLight position={[-100, -100, -100]} intensity={0.5} />
            <OrbitControls makeDefault />
            
            <Grid 
              infiniteGrid 
              fadeDistance={400} 
              cellColor="#222" 
              sectionColor="#444" 
              position={[0, -Math.max(width, height) / 2, 0]} 
            />

            <Center>
              {imagePixels && (
                 <LithophanePreview geometry={geometry} />
              )}
            </Center>
          </Canvas>
        </div>
      </div>
    </div>
  );
}

function LithophanePreview({ geometry }: { geometry: THREE.BufferGeometry | null }) {
  return (
    <mesh geometry={geometry ?? undefined} castShadow receiveShadow>
      <meshStandardMaterial color="#ffffff" roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
}

function createLithophaneGeometry(
  pixels: {data: Uint8ClampedArray, w: number, h: number},
  shape: "flat" | "curved",
  targetWidth: number,
  targetHeight: number,
  minThick: number,
  maxThick: number,
  curveAngle: number
) {
  const { w, h, data } = pixels;
  
  // Calculate aspect ratio 
  let width = targetWidth;
  let height = targetHeight;

  // For geometry, we map each pixel to a vertex
  const geom = new THREE.PlaneGeometry(width, height, w - 1, h - 1);
  const pos = geom.attributes.position.array;

  for (let i = 0; i < pos.length / 3; i++) {
    const pxIdx = i * 4;
    const r = data[pxIdx];
    const g = data[pxIdx + 1];
    const b = data[pxIdx + 2];
    
    // Luminance formula (0 to 1) - Darker is thicker
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const thickness = minThick + ((1 - luminance) * (maxThick - minThick));
    
    pos[i * 3 + 2] = thickness; // Z
  }

  geom.computeVertexNormals();

  // If curved, deform the plane into a cylinder segment
  if (shape === "curved") {
    const angleRad = (curveAngle * Math.PI) / 180;
    // The width is mapped to the arc length: arc = angle * radius => radius = arc / angle
    const radius = width / angleRad;
    
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3];
      const z = pos[i * 3 + 2]; // thickness
      
      // X goes from -width/2 to width/2
      // Angle goes from -angleRad/2 to angleRad/2
      const angle = (x / width) * angleRad;
      
      const newRadius = radius + z;
      const newX = newRadius * Math.sin(angle);
      const newZ = newRadius * Math.cos(angle) - radius; // Center it somewhat
      
      pos[i * 3] = newX;
      pos[i * 3 + 2] = newZ;
    }
    
    geom.computeVertexNormals();
  }

  // To make it a solid object for 3D printing, we need a back face and sides.
  // We can duplicate the geometry, flip normals for the back, set Z=0, and stitch edges.
  // However, BufferGeometryUtils.mergeGeometries and manual stitching is complex.
  // Instead, we will construct a solid custom BufferGeometry from scratch.
  
  const vertices = [];
  const indices = [];
  const segmentsX = w - 1;
  const segmentsY = h - 1;
  const numVertices = w * h;

  // Front face (index 0 to numVertices - 1)
  for (let i = 0; i < pos.length / 3; i++) {
    vertices.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  }
  
  // Back face (index numVertices to 2 * numVertices - 1)
  // Back face is smooth, thickness = 0 (or some small value if we want, but let's say base Z is 0)
  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    
    let backZ = 0;
    let backX = pos[i * 3]; // Default for flat
    
    if (shape === "curved") {
      const angleRad = (curveAngle * Math.PI) / 180;
      const originalX = (x % width); // approximation, need to calculate from indices
      
      // Better to recalculate based on grid indices
      const ix = i % w;
      const originalFlatX = (ix / segmentsX - 0.5) * width;
      const angle = (originalFlatX / width) * angleRad;
      const radius = width / angleRad;
      
      backX = radius * Math.sin(angle);
      backZ = radius * Math.cos(angle) - radius;
    } else {
      backZ = 0;
    }
    
    vertices.push(backX, y, backZ);
  }

  // Indices for Front face (Counter-clockwise)
  for (let iy = 0; iy < segmentsY; iy++) {
    for (let ix = 0; ix < segmentsX; ix++) {
      const a = ix + segmentsX + 1 + iy * (segmentsX + 1);
      const b = ix + iy * (segmentsX + 1);
      const c = ix + 1 + iy * (segmentsX + 1);
      const d = ix + 1 + segmentsX + 1 + iy * (segmentsX + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }
  
  // Indices for Back face (Clockwise)
  const offset = numVertices;
  for (let iy = 0; iy < segmentsY; iy++) {
    for (let ix = 0; ix < segmentsX; ix++) {
      const a = offset + ix + segmentsX + 1 + iy * (segmentsX + 1);
      const b = offset + ix + iy * (segmentsX + 1);
      const c = offset + ix + 1 + iy * (segmentsX + 1);
      const d = offset + ix + 1 + segmentsX + 1 + iy * (segmentsX + 1);

      indices.push(d, b, a);
      indices.push(d, c, b);
    }
  }
  
  // Stitch sides
  // Top edge (iy = 0)
  for (let ix = 0; ix < segmentsX; ix++) {
    const a = ix;
    const b = ix + 1;
    const c = offset + ix + 1;
    const d = offset + ix;
    indices.push(a, b, d);
    indices.push(b, c, d);
  }
  
  // Bottom edge (iy = segmentsY)
  const bottomRowOffset = segmentsY * w;
  for (let ix = 0; ix < segmentsX; ix++) {
    const a = bottomRowOffset + ix;
    const b = offset + bottomRowOffset + ix;
    const c = offset + bottomRowOffset + ix + 1;
    const d = bottomRowOffset + ix + 1;
    indices.push(a, b, d);
    indices.push(b, c, d);
  }
  
  // Left edge (ix = 0)
  for (let iy = 0; iy < segmentsY; iy++) {
    const a = iy * w;
    const b = offset + iy * w;
    const c = offset + (iy + 1) * w;
    const d = (iy + 1) * w;
    indices.push(a, b, d);
    indices.push(b, c, d);
  }
  
  // Right edge (ix = segmentsX)
  for (let iy = 0; iy < segmentsY; iy++) {
    const a = segmentsX + iy * w;
    const b = segmentsX + (iy + 1) * w;
    const c = offset + segmentsX + (iy + 1) * w;
    const d = offset + segmentsX + iy * w;
    indices.push(a, b, d);
    indices.push(b, c, d);
  }

  const solidGeom = new THREE.BufferGeometry();
  solidGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  solidGeom.setIndex(indices);
  solidGeom.computeVertexNormals();

  return solidGeom;
}
