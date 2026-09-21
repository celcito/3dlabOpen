import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import QRCodeLib from "qrcode";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { useQrGenerator, type QrConfig } from "../hooks/useQrGenerator";
import {
  QrCode, Download, Sliders, Type, Layers, Palette,
  Move, Check, ZoomIn, AlertTriangle
} from "lucide-react";

export default function QrGenerator() {
  const generator = useQrGenerator();
  const { config, setConfig, qrMatrix, plateDimensions, previewGeometry, successMsg } = generator;
  const exportSTL = generator.handleExportSTL;

  const [qrDataUrl, setQrDataUrl] = useState("");
  useEffect(() => {
    if (!config.text) { setQrDataUrl(""); return; }
    QRCodeLib.toDataURL(config.text, {
      width: 160,
      margin: 2,
      color: { dark: config.qrColor, light: config.baseColor },
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [config.text, config.qrColor, config.baseColor]);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
  const numInput = (field: keyof QrConfig, min: number, max: number) => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v)) setConfig({ ...config, [field]: clamp(v, min, max) });
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      if (isNaN(v) || v < min) setConfig({ ...config, [field]: min });
    },
  });

  const hasQuietZone = config.padding >= config.size * 4;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      {/* LEFT PANEL */}
      <div className="w-full md:w-96 bg-[var(--workbench-viewport)] border-r border-[var(--surface-container-high)] overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <QrCode className="w-6 h-6 text-[#632CE5]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">QR 3D Designer</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Gere placas 3D personalizadas com QR Codes funcionais.</p>
        </header>

        <section className="space-y-6">
          {/* 01. Conteúdo */}
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-[#632CE5]" />
              01. Conteúdo do QR
            </h3>
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold text-zinc-600 block px-1">Texto ou URL</label>
              <textarea
                value={config.text}
                onChange={(e) => setConfig({ ...config, text: e.target.value })}
                placeholder="Insira o link ou texto aqui..."
                className="w-full bg-white border border-[var(--surface-container-high)] p-3 rounded-lg text-xs text-[var(--workbench-text)] font-mono focus:outline-none focus:border-[#632CE5] min-h-[80px] resize-none transition-all"
              />
            </div>
          </div>

          {/* 02. Geometria */}
          <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#632CE5]" />
              02. Geometria 3D
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">Tamanho Módulo (mm)</label>
                <input type="number" min="0.5" step="0.5" value={config.size} {...numInput("size", 0.5, 20)}
                  className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">Padding (mm)</label>
                <input type="number" min="0" step="1" value={config.padding} {...numInput("padding", 0, 50)}
                  className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold" />
              </div>
            </div>
            {!hasQuietZone && config.text && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-[9px] text-amber-700 leading-tight">
                  Quiet zone insuficiente. Recomenda-se padding ≥ {config.size * 4}mm (4 módulos) para leitura confiável.
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">Espessura Base (mm)</label>
                <input type="number" min="0.5" step="0.5" value={config.thickness} {...numInput("thickness", 0.5, 50)}
                  className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">Altura QR (mm)</label>
                <input type="number" min="0.5" step="0.5" value={config.qrHeight} {...numInput("qrHeight", 0.5, 20)}
                  className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-zinc-600 block">Arredondamento Bordas (mm)</label>
              <input type="range" min="0" max={Math.min(plateDimensions.width, plateDimensions.height) / 2 || 20}
                value={config.borderRadius}
                onChange={(e) => setConfig({ ...config, borderRadius: parseFloat(e.target.value) })}
                className="w-full accent-[#632CE5] h-1.5 bg-[var(--workbench-viewport)] rounded-lg appearance-none cursor-pointer" />
              <div className="flex justify-between text-[8px] text-zinc-700 font-black">
                <span>0mm</span>
                <span>{config.borderRadius}mm</span>
                <span>{Math.min(plateDimensions.width, plateDimensions.height) / 2 || 20}mm</span>
              </div>
            </div>
          </div>

          {/* 03. Cores */}
          <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-[#632CE5]" />
              03. Cores
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {([
                ["Placa", "baseColor"],
                ["QR Code", "qrColor"],
                ["Texto", "labelColor"],
              ] as const).map(([label, field]) => (
                <div key={field} className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-zinc-600 block">{label}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config[field]} onChange={(e) => setConfig({ ...config, [field]: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                    <span className="text-[9px] font-mono text-zinc-500">{config[field]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 04. Label */}
          <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
              04. Identificação / Label
            </h3>
            <div className="flex items-center gap-3 mb-2">
              <input type="checkbox" checked={config.includeText}
                onChange={(e) => setConfig({ ...config, includeText: e.target.checked })}
                className="w-4 h-4 accent-[#632CE5]" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Incluir Texto na Placa</span>
            </div>
            {config.includeText && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-zinc-600 block">Texto da Etiqueta</label>
                  <input type="text" value={config.label}
                    onChange={(e) => setConfig({ ...config, label: e.target.value })}
                    className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-zinc-600 block">Tamanho Texto</label>
                    <input type="number" min="1" step="1" value={config.labelSize} {...numInput("labelSize", 1, 30)}
                      className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-zinc-600 block">Relevo Texto</label>
                    <input type="number" min="0.1" step="0.1" value={config.labelDepth} {...numInput("labelDepth", 0.1, 10)}
                      className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-zinc-600 block">Posição Vertical</label>
                  <input type="range" min="-10" max="10" step="0.5" value={config.labelOffset}
                    onChange={(e) => setConfig({ ...config, labelOffset: parseFloat(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--workbench-viewport)] rounded-lg appearance-none cursor-pointer" />
                  <div className="flex justify-between text-[8px] text-zinc-700 font-black">
                    <span>↑ Cima</span>
                    <span>{config.labelOffset}mm</span>
                    <span>Baixo ↓</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="pt-6 space-y-3">
            <button onClick={exportSTL} disabled={qrMatrix.length === 0} className="btn-primary">
              <Download className="w-4 h-4" />
              Exportar para STL
            </button>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
              <p className="text-[9px] font-bold text-blue-700 uppercase tracking-wider">Dicas de Escaneabilidade</p>
              <ul className="text-[8px] text-blue-600 space-y-1 leading-relaxed">
                <li>• O preview 3D pode não escanear na tela — <strong>imprima para testar</strong></li>
                <li>• Contraste preto/branco é o mais confiável</li>
                <li>• Quiet zone mínima: 4 módulos (padding ≥ {config.size * 4}mm)</li>
                <li>• Altura ≥ 1mm para FDM, ≥ 0.5mm para SLA</li>
                <li>• Evite brilho (PETG/ABS glossy) — lixe a superfície</li>
              </ul>
            </div>
            <p className="text-[8px] text-zinc-600 text-center uppercase font-bold tracking-tighter">
              * O modelo gerado é otimizado para impressão 3D (FDM ou SLA).
            </p>
          </div>
        </section>
      </div>

      {/* CENTER: 3D PREVIEW */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <Canvas dpr={[1, 1.5]} camera={{ position: [50, 50, 50], fov: 45 }} gl={{ antialias: true }}>
            <color attach="background" args={["#F3F4EE"]} />
            <ambientLight intensity={0.5} />
            <spotLight position={[50, 50, 50]} angle={0.15} penumbra={1} />
            <pointLight position={[-50, -50, -50]} intensity={0.5} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
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

        {/* HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-white/80 backdrop-blur-md border border-[var(--surface-container-high)] p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#632CE5] animate-pulse" />
              <span className="text-[10px] font-black text-[var(--workbench-text)] uppercase tracking-widest">3D Real-time Preview</span>
            </div>
            <div className="text-[16px] font-black text-[var(--workbench-text)] uppercase tracking-tighter">
              {plateDimensions.width.toFixed(1)} x {plateDimensions.height.toFixed(1)} mm
            </div>
          </div>
        </div>

        {/* 2D QR SCANNABLE PREVIEW */}
        {qrDataUrl && (
          <div className="absolute top-6 right-6 pointer-events-auto">
            <div className="bg-white/90 backdrop-blur-md border border-[var(--surface-container-high)] p-3 rounded-xl space-y-1.5">
              <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest text-center">Escaneie para testar</p>
              <img src={qrDataUrl} alt="QR Code preview" className="w-[160px] h-[160px] rounded-lg" />
            </div>
          </div>
        )}

        {successMsg && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#632CE5] text-white px-6 py-3 rounded-full flex items-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-lg">
              <Check className="w-4 h-4" />
              {successMsg}
            </div>
          </div>
        )}

        <div className="absolute bottom-6 right-6">
          <div className="bg-[var(--surface-container-high)]/80 backdrop-blur-md border border-[var(--surface-container-high)] p-3 rounded-lg flex gap-4 text-[8px] text-zinc-500 font-black uppercase tracking-widest">
            <div className="flex items-center gap-2"><Move className="w-3 h-3" /> Orbit</div>
            <div className="flex items-center gap-2"><ZoomIn className="w-3 h-3" /> Zoom</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 3D LABEL (TextGeometry, async font load) ─── */
function Label3D({ text, fontSize, color, depth, position }: {
  text: string; fontSize: number; color: string; depth: number; position: [number, number, number];
}) {
  const [font, setFont] = useState<THREE.Font | null>(null);

  useEffect(() => {
    let cancelled = false;
    new FontLoader().load("/roboto-three.json", (f) => {
      if (!cancelled) setFont(f);
    });
    return () => { cancelled = true; };
  }, []);

  const geometry = useMemo(() => {
    if (!font || !text) return null;
    const geo = new TextGeometry(text, {
      font,
      size: fontSize,
      depth,
      curveSegments: 4,
    });
    geo.computeBoundingBox();
    if (geo.boundingBox) {
      const bb = geo.boundingBox;
      // Center horizontally and vertically on baseline
      geo.translate(
        -(bb.max.x - bb.min.x) / 2,
        -(bb.min.y + (bb.max.y - bb.min.y) / 2),
        0
      );
    }
    return geo;
  }, [text, font, fontSize, depth]);

  useEffect(() => () => { geometry?.dispose(); }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={position}>
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

/* ─── INSTANCED QR MODULES ─── */
function QrModules({ qrMatrix, moduleSize, qrOffset, yShift, config }: {
  qrMatrix: number[][]; moduleSize: number; qrOffset: number; yShift: number; config: QrConfig;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = useMemo(
    () => qrMatrix.reduce((acc, row) => acc + row.filter(Boolean).length, 0),
    [qrMatrix]
  );

  const geometry = useMemo(
    () => new THREE.BoxGeometry(moduleSize, moduleSize, config.qrHeight / 10),
    [moduleSize, config.qrHeight]
  );

  const z = config.thickness / 10 + config.qrHeight / 20;

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let y = 0; y < qrMatrix.length; y++) {
      for (let x = 0; x < qrMatrix[y].length; x++) {
        if (!qrMatrix[y][x]) continue;
        dummy.position.set(
          qrOffset + x * moduleSize + moduleSize / 2,
          -(qrOffset + y * moduleSize + moduleSize / 2) + yShift,
          z
        );
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx++, dummy.matrix);
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
  }, [qrMatrix, moduleSize, qrOffset, yShift, z]);

  useEffect(() => () => { geometry.dispose(); }, [geometry]);

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color={config.qrColor} roughness={0.8} />
    </instancedMesh>
  );
}

/* ─── SCENE ─── */
function Scene({ config, qrMatrix, plateDimensions, previewGeometry }: {
  config: QrConfig; qrMatrix: number[][];
  plateDimensions: { width: number; height: number; qrDim: number };
  previewGeometry: { shape: THREE.Shape; extrudeSettings: THREE.ExtrudeGeometryOptions };
}) {
  const { shape: plateShape, extrudeSettings } = previewGeometry;
  const moduleSize = config.size / 10;
  const qrSize = qrMatrix.length;
  const qrOffset = -(qrSize * moduleSize) / 2;
  // Center QR in the upper portion, leaving room for label below
  const yShift = config.includeText ? config.labelSize / 10 : 0;

  // Label position: just below QR area, adjustable offset
  const labelAreaCenter = -(plateDimensions.qrDim / 20 + config.padding / 10 + config.labelSize / 20) - config.labelOffset / 10;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* PLATE */}
      <mesh>
        <extrudeGeometry args={[plateShape, extrudeSettings]} />
        <meshStandardMaterial color={config.baseColor} roughness={0.8} />
      </mesh>

      {/* QR MODULES */}
      <QrModules
        qrMatrix={qrMatrix}
        moduleSize={moduleSize}
        qrOffset={qrOffset}
        yShift={yShift}
        config={config}
      />

      {/* LABEL */}
      {config.includeText && config.label && (
        <Label3D
          text={config.label}
          fontSize={config.labelSize / 10}
          color={config.labelColor}
          depth={config.labelDepth / 10}
          position={[0, labelAreaCenter, config.thickness / 10 + config.labelDepth / 20]}
        />
      )}
    </group>
  );
}
