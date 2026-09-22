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
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-zinc-600 block">Ícone</label>
                  <select value={config.icon} onChange={(e) => setConfig({ ...config, icon: e.target.value })}
                    className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold">
                    {ICON_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                {config.icon !== "none" && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-zinc-600 block">Posição Ícone</label>
                      <select value={config.iconPosition} onChange={(e) => setConfig({ ...config, iconPosition: e.target.value })}
                        className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold">
                        <option value="right">Direita do texto →</option>
                        <option value="left">Esquerda do texto ←</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-zinc-600 block">Tamanho Ícone</label>
                      <input type="number" min="2" step="1" value={config.iconSize} {...numInput("iconSize", 2, 30)}
                        className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold" />
                    </div>
                  </>
                )}
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

/* ─── SVG PATH PARSER ─── */
function svgPath(d: string, vbW: number, vbH: number, scale: number): THREE.Shape {
  const shape = new THREE.Shape();
  const tokens = d.match(/[MmLlCcQqSsTtHhVvAaZz]|[-+]?\d*\.?\d+/g) || [];
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
  const g = () => parseFloat(tokens[i++]);
  const mapX = (x: number) => (x / vbW - 0.5) * scale;
  const mapY = (y: number) => -(y / vbH - 0.5) * scale;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': cx = mapX(g()); cy = mapY(g()); shape.moveTo(cx, cy); sx = cx; sy = cy; break;
      case 'm': cx += g() * scale / vbW; cy -= g() * scale / vbH; shape.moveTo(cx, cy); sx = cx; sy = cy; break;
      case 'L': cx = mapX(g()); cy = mapY(g()); shape.lineTo(cx, cy); break;
      case 'l': cx += g() * scale / vbW; cy -= g() * scale / vbH; shape.lineTo(cx, cy); break;
      case 'H': cx = mapX(g()); shape.lineTo(cx, cy); break;
      case 'h': cx += g() * scale / vbW; shape.lineTo(cx, cy); break;
      case 'V': cy = mapY(g()); shape.lineTo(cx, cy); break;
      case 'v': cy -= g() * scale / vbH; shape.lineTo(cx, cy); break;
      case 'C': {
        const x1 = mapX(g()), y1 = mapY(g()), x2 = mapX(g()), y2 = mapY(g());
        cx = mapX(g()); cy = mapY(g());
        shape.bezierCurveTo(x1, y1, x2, y2, cx, cy); break;
      }
      case 'c': {
        const dx1 = g(), dy1 = g(), dx2 = g(), dy2 = g(), dx = g(), dy = g();
        shape.bezierCurveTo(cx + dx1 * scale / vbW, cy - dy1 * scale / vbH,
          cx + dx2 * scale / vbW, cy - dy2 * scale / vbH,
          cx + dx * scale / vbW, cy - dy * scale / vbH);
        cx += dx * scale / vbW; cy -= dy * scale / vbH; break;
      }
      case 'Q': {
        const x1 = mapX(g()), y1 = mapY(g());
        cx = mapX(g()); cy = mapY(g());
        shape.quadraticCurveTo(x1, y1, cx, cy); break;
      }
      case 'q': {
        const dx1 = g(), dy1 = g(), dx = g(), dy = g();
        shape.quadraticCurveTo(cx + dx1 * scale / vbW, cy - dy1 * scale / vbH,
          cx + dx * scale / vbW, cy - dy * scale / vbH);
        cx += dx * scale / vbW; cy -= dy * scale / vbH; break;
      }
      case 'S': {
        const x2 = mapX(g()), y2 = mapY(g());
        cx = mapX(g()); cy = mapY(g());
        shape.bezierCurveTo(cx, cy, x2, y2, cx, cy); break;
      }
      case 'A': {
        const rx = g() * scale / vbW, ry = g() * scale / vbH, rot = g();
        const large = g(), sweep = g();
        cx = mapX(g()); cy = mapY(g());
        shape.lineTo(cx, cy); break;
      }
      case 'Z': case 'z': cx = sx; cy = sy; shape.closePath(); break;
    }
  }
  return shape;
}

/* ─── SVG ICON DEFINITIONS ─── */
// SVGs from: pix-106.svg, instagram-logo-facebook-svgrepo-com.svg, whatsapp-svgrepo-com.svg
const SVG_ICONS: Record<string, { paths: string[]; vb: [number, number]; fills?: string[] }> = {
  instagram: {
    vb: [32, 32],
    paths: [
      // Outer rounded rect
      "M6,2h20c2.2,0,4,1.8,4,4v20c0,2.2-1.8,4-4,4H6c-2.2,0-4-1.8-4-4V6C2,3.8,3.8,2,6,2z",
      // Inner rounded rect (cutout)
      "M20,6h-8c-3.3,0-6,2.7-6,6v8c0,3.3,2.7,6,6,6h8c3.3,0,6-2.7,6-6v-8C26,8.7,23.3,6,20,6z",
      // Circle (cutout)
      "M16,11.2c-2.7,0-4.9,2.2-4.9,4.9c0,2.7,2.2,4.9,4.9,4.9s4.9-2.2,4.9-4.9C21,13.4,18.8,11.2,16,11.2z",
      // Dot (cutout)
      "M21.3,9.7c-0.6,0-1.2,0.5-1.2,1.2c0,0.7,0.5,1.2,1.2,1.2c0.7,0,1.2-0.5,1.2-1.2C22.4,10.2,21.9,9.7,21.3,9.7z",
    ],
  },
  whatsapp: {
    vb: [24, 24],
    paths: [
      // Speech bubble + phone outline
      "M12,23C10.7764,23,10.0994,22.8687,9,22.5L6.89443,23.5528C5.56462,24.2177,4,23.2507,4,21.7639V19.5C1.84655,17.492,1,15.1767,1,12C1,5.92487,5.92487,1,12,1C18.0751,1,23,5.92487,23,12C23,18.0751,18.0751,23,12,23Z",
      // Phone handset cutout
      "M6.014,8.00613C6.12827,7.1024,7.30277,5.87414,8.23488,6.01043C9.14051,6.18132,9.85859,7.74261,10.2635,8.44465C10.5504,8.95402,10.3641,9.4701,10.0965,9.68787C9.7355,9.97883,9.17099,10.3803,9.28943,10.7834C9.5,11.5,12,14,13.2296,14.7107C13.695,14.9797,14.0325,14.2702,14.3207,13.9067C14.5301,13.6271,15.0466,13.46,15.5548,13.736C16.3138,14.178,17.0288,14.6917,17.69,15.27C18.0202,15.546,18.0977,15.9539,17.8689,16.385C17.4659,17.1443,16.3003,18.1456,15.4542,17.9421C13.9764,17.5868,8,15.27,6.08033,8.55801C5.97237,8.24048,5.99955,8.12044,6.014,8.00613Z",
    ],
  },
};

/* ─── SIMPLE ICON SHAPES (non-SVG) ─── */
const SIMPLE_ICONS: Record<string, (s: number) => THREE.Shape> = {
  pix: (s) => {
    // Simplified PIX diamond logo
    const shape = new THREE.Shape();
    shape.moveTo(0, s * 0.45);
    shape.lineTo(s * 0.45, 0);
    shape.lineTo(0, -s * 0.45);
    shape.lineTo(-s * 0.45, 0);
    shape.closePath();
    // Inner diamond cutout
    const hole = new THREE.Path();
    hole.moveTo(0, s * 0.2);
    hole.lineTo(s * 0.2, 0);
    hole.lineTo(0, -s * 0.2);
    hole.lineTo(-s * 0.2, 0);
    hole.closePath();
    shape.holes.push(hole);
    return shape;
  },
  email: (s) => {
    const shape = new THREE.Shape();
    const w = s * 0.45, h = s * 0.32;
    shape.moveTo(-w, -h);
    shape.lineTo(w, -h);
    shape.lineTo(w, h);
    shape.lineTo(-w, h);
    shape.closePath();
    const flap = new THREE.Path();
    flap.moveTo(-w, h);
    flap.lineTo(0, 0);
    flap.lineTo(w, h);
    shape.holes.push(flap);
    return shape;
  },
};

/* ─── ICON SHAPES (merged) ─── */
const ICON_SHAPES: Record<string, (s: number) => THREE.Shape> = {
  ...SIMPLE_ICONS,
  instagram: (s) => {
    const shape = svgPath(SVG_ICONS.instagram.paths[0], 32, 32, s);
    // Add inner rounded rect as hole
    const hole1 = svgPath(SVG_ICONS.instagram.paths[1], 32, 32, s);
    shape.holes.push(hole1);
    // Add circle as hole
    const hole2 = svgPath(SVG_ICONS.instagram.paths[2], 32, 32, s);
    shape.holes.push(hole2);
    // Add dot as hole
    const hole3 = svgPath(SVG_ICONS.instagram.paths[3], 32, 32, s);
    shape.holes.push(hole3);
    return shape;
  },
  whatsapp: (s) => {
    const shape = svgPath(SVG_ICONS.whatsapp.paths[0], 24, 24, s);
    const hole = svgPath(SVG_ICONS.whatsapp.paths[1], 24, 24, s);
    shape.holes.push(hole);
    return shape;
  },
  none: () => new THREE.Shape(),
};

const ICON_OPTIONS = [
  { id: "none", label: "Nenhum" },
  { id: "pix", label: "PIX" },
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "E-mail" },
];

/* ─── ICON 3D ─── */
function Icon3D({ iconName, iconSize, color, position }: {
  iconName: string; iconSize: number; color: string; position: [number, number, number];
}) {
  const geometry = useMemo(() => {
    const shapeFn = ICON_SHAPES[iconName];
    if (!shapeFn || iconName === "none") return null;
    const shape = shapeFn(iconSize / 10);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
  }, [iconName, iconSize]);

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

  // Icon position: same line as label, left or right on X axis
  const labelHalfW = config.label.length * config.labelSize / 20;
  const iconHalfW = config.iconSize / 20;
  const iconGap = 0.3;
  const iconX = config.iconPosition === "left"
    ? -(labelHalfW + iconHalfW + iconGap)
    : (labelHalfW + iconHalfW + iconGap);

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

      {/* ICON */}
      {config.icon !== "none" && (
        <Icon3D
          iconName={config.icon}
          iconSize={config.iconSize}
          color={config.labelColor}
          position={[iconX, labelAreaCenter, config.thickness / 10 + config.labelDepth / 20]}
        />
      )}
    </group>
  );
}
