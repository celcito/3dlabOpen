import React, { useState, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center } from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError, toastActionSuccess } from "@/lib/toast";
import { 
  Settings2, Download, Code, Play, Settings, 
  Layers, Sparkles, Copy
} from "lucide-react";

import type { FastenerConfig, FastenerType, System } from "@/src/lib/fastener/types";
import { getSizeLabels, getFastenerSize } from "@/src/lib/fastener/sizes";
import { generateFastenerGeometry, segmentsForQuality, stepsForQuality } from "@/src/lib/fastener/geometry";
import { generateScad } from "@/src/lib/fastener/scad";

export default function ScrewGenerator() {
  const [config, setConfig] = useState<FastenerConfig>({
    type: 'screw',
    system: 'metric',
    size: 'M5',
    
    length: 20,
    headType: 'socket',
    driveType: 'hex',
    fullThread: true,
    threadLength: 10,
    splitScrew: false,

    nutShape: 'hex',
    nutThicknessOverride: 0,
    clearance: 0.1,
    bevelNut: true,

    washerType: 'standard',
    washerChamfer: false,

    quality: 1,
    debugMode: false,
  });

  const [activeTab, setActiveTab] = useState<'info' | 'settings' | 'materials'>('info');

  const spec = useMemo(() => getFastenerSize(config.system, config.size), [config.system, config.size]);

  const scadCode = useMemo(() => generateScad(config, spec), [config, spec]);

  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGeometry(null);
    setGeometryError(null);
    generateFastenerGeometry(config)
      .then((g) => {
        if (cancelled) return;
        setGeometry(g);
      })
      .catch((err) => {
        if (!cancelled) setGeometryError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [config]);

  const handleCopyScad = () => {
    navigator.clipboard.writeText(scadCode).then(
      () => toastActionSuccess("OpenSCAD copiado para a área de transferência!"),
      () => toastExportError()
    );
  };

  const handleDownloadScad = () => {
    const blob = new Blob([scadCode], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fastener_${config.type}_${config.size}_${Date.now()}.scad`;
    link.click();
  };

  const handleExportSTL = async () => {
    try {
      const geom = await generateFastenerGeometry(config, {
        segments: segmentsForQuality(2),
        stepsPerPitch: stepsForQuality(2),
      });
      const mesh = new THREE.Mesh(geom);
      const exporter = new STLExporter();
      const result = exporter.parse(mesh, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `fastener_${config.type}_${config.size}_${Date.now()}.stl`;
      link.click();
      toastActionSuccess("STL exportado com sucesso!");
    } catch (err) {
      console.error(err);
      toastExportError();
    }
  }

  const sizes = config.system === 'metric' ? getSizeLabels('metric') : getSizeLabels('uts');

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#F9FAF4]">
      <div className="w-full md:w-[400px] bg-[#F9FAF4] border-r border-[#E2E3DD] flex flex-col">
        <header className="p-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
              <Settings className="w-6 h-6 text-[#632CE5]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-[#1A1C19]">Screw Gen</h1>
          </div>
          <p className="text-[10px] text-[#687064] font-bold tracking-widest uppercase leading-relaxed">
            Parametric ISO/DIN & UTS Fasteners
          </p>
        </header>

        <div className="px-6 pb-2 shrink-0">
          <div className="flex bg-white p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all \${
                activeTab === 'info' ? "bg-[#E2E3DD] text-[#1A1C19] shadow" : "text-[#687064] hover:text-[#1A1C19]"
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all \${
                activeTab === 'settings' ? "bg-[#E2E3DD] text-[#1A1C19] shadow" : "text-[#687064] hover:text-[#1A1C19]"
              }`}
            >
              Config
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all \${
                activeTab === 'materials' ? "bg-[#E2E3DD] text-[#1A1C19] shadow" : "text-[#687064] hover:text-[#1A1C19]"
              }`}
            >
              Print
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pt-2">
          {activeTab === 'info' ? (
            <section className="space-y-6 pb-10">
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-[#632CE5]" />
                  Quick Start
                </h3>
                
                <div className="bg-white p-4 rounded-xl border border-[#E2E3DD]">
                  <h4 className="text-[12px] font-black text-[#1A1C19] mb-2">1. Select a Fastener Type</h4>
                  <p className="text-[10px] text-[#494455] leading-relaxed">
                    Choose between screws, nuts, or washers. Adjust general parameters like diameter, thread type, and length.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E2E3DD]">
                  <h4 className="text-[12px] font-black text-[#1A1C19] mb-2">2. Customize Your Fastener</h4>
                  <ul className="text-[10px] text-[#687064] space-y-1 ml-4 list-disc marker:text-[#632CE5] mb-2">
                    <li><strong className="text-[#1A1C19]">Screws:</strong> Length, head type (Hex, Pan, Socket, etc.), drive type.</li>
                    <li><strong className="text-[#1A1C19]">Nuts:</strong> Hex or square, custom thickness, and clearance.</li>
                    <li><strong className="text-[#1A1C19]">Washers:</strong> Standard (ISO 7089) or large (ISO 7093) sizes.</li>
                  </ul>
                  <p className="text-[10px] text-[#687064] leading-relaxed border-t border-[#E2E3DD] pt-2">
                    Not all combinations (e.g., a 'slot' drive on a 'hex' head) are supported by known specifications.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E2E3DD]">
                  <h4 className="text-[12px] font-black text-[#1A1C19] mb-2">3. Render and Export</h4>
                  <p className="text-[10px] text-[#494455] leading-relaxed">
                    Generate your fastener at the desired resolution and export it for slicing. For small screws, use a (extra) fine layer height.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#632CE5]" />
                  Features
                </h3>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-[#F3F4EE] p-3 rounded-lg border border-[#E2E3DD]/50">
                    <h5 className="text-[10px] font-bold text-[#1A1C19] mb-1">Multiple Fastener Types</h5>
                    <p className="text-[9px] text-[#687064]">ISO/DIN/UTS screws, nuts, and washers.</p>
                  </div>
                  <div className="bg-[#F3F4EE] p-3 rounded-lg border border-[#E2E3DD]/50">
                    <h5 className="text-[10px] font-bold text-[#1A1C19] mb-1">Precision Modeling</h5>
                    <p className="text-[9px] text-[#687064]">Follows ISO 4017 (DIN 933), ISO 4032, ISO 7089/7093.</p>
                  </div>
                </div>
              </div>
            </section>
          ) : activeTab === 'settings' ? (
            <section className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5 text-[#632CE5]" />
                  01. Fastener Type
                </h3>
                
                <div className="grid grid-cols-3 gap-2">
                  {(['screw', 'nut', 'washer'] as FastenerType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setConfig({...config, type: t})}
                      className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all \${
                        config.type === t
                          ? "bg-orange-500/10 border-orange-500/50 text-[#632CE5]"
                          : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                  02. System & Size
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'metric', label: 'Metric (ISO/DIN)' },
                    { id: 'uts', label: 'UTS (Inch)' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setConfig({
                        ...config, 
                        system: t.id as System, 
                        size: t.id === 'metric' ? 'M5' : '1/4'
                      })}
                      className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all \${
                        config.system === t.id
                          ? "bg-orange-500/10 border-orange-500/50 text-[#632CE5]"
                          : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 mt-4">
                  <label className="text-[9px] uppercase font-bold text-[#494455] block">Select Size</label>
                  <select 
                    value={config.size}
                    onChange={(e) => setConfig({...config, size: e.target.value})}
                    className="w-full bg-white border border-[#E2E3DD] rounded-lg p-2 text-[11px] text-[#1A1C19] outline-none focus:border-[#632CE5]"
                  >
                    {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {config.type === 'screw' && (
                <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                    03. Screw Settings
                    </h3>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <label className="text-[9px] uppercase font-bold text-[#494455]">Length (L)</label>
                            <span className="text-[10px] font-mono text-[#632CE5]">{config.length}mm</span>
                        </div>
                        <input 
                            type="range" min="5" max="150" step="1" 
                            value={config.length}
                            onChange={(e) => setConfig({...config, length: parseInt(e.target.value)})}
                            className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[9px] uppercase font-bold text-[#494455] block">Head Type</label>
                        <select 
                            value={config.headType}
                            onChange={(e) => setConfig({...config, headType: e.target.value as any})}
                            className="w-full bg-white border border-[#E2E3DD] rounded-lg p-2 text-[11px] text-[#1A1C19] outline-none focus:border-[#632CE5]"
                        >
                            <option value="hex">Hex</option>
                            <option value="pan">Pan</option>
                            <option value="flat">Flat</option>
                            <option value="button">Button</option>
                            <option value="socket">Socket</option>
                            <option value="ribbed_socket">Ribbed Socket</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[9px] uppercase font-bold text-[#494455] block">Drive Type</label>
                        <select 
                            value={config.driveType}
                            onChange={(e) => setConfig({...config, driveType: e.target.value as any})}
                            className="w-full bg-white border border-[#E2E3DD] rounded-lg p-2 text-[11px] text-[#1A1C19] outline-none focus:border-[#632CE5]"
                        >
                            <option value="none">None</option>
                            <option value="phillips">Phillips</option>
                            <option value="torx">Torx</option>
                            <option value="slot">Slot</option>
                            <option value="hex">Hex</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <label className="text-[10px] font-bold text-[#494455]">Full Thread</label>
                        <input 
                            type="checkbox" 
                            checked={config.fullThread}
                            onChange={(e) => setConfig({...config, fullThread: e.target.checked})}
                            className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[#E2E3DD]"
                        />
                    </div>

                    {!config.fullThread && (
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <label className="text-[9px] uppercase font-bold text-[#494455]">Thread Length</label>
                                <span className="text-[10px] font-mono text-[#632CE5]">{config.threadLength}mm</span>
                            </div>
                            <input 
                                type="range" min="1" max={config.length} step="1" 
                                value={config.threadLength}
                                onChange={(e) => setConfig({...config, threadLength: parseInt(e.target.value)})}
                                className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                        <label className="text-[10px] font-bold text-[#494455]">Split Screw (Flat Printing)</label>
                        <input 
                            type="checkbox" 
                            checked={config.splitScrew}
                            onChange={(e) => setConfig({...config, splitScrew: e.target.checked})}
                            className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[#E2E3DD]"
                        />
                    </div>
                </div>
              )}

              {config.type === 'nut' && (
                <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                    03. Nut Settings
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'hex', label: 'Hex' },
                        { id: 'square', label: 'Square' }
                    ].map(t => (
                        <button
                        key={t.id}
                        onClick={() => setConfig({...config, nutShape: t.id as any})}
                        className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all \${
                            config.nutShape === t.id
                            ? "bg-orange-500/10 border-orange-500/50 text-[#632CE5]"
                            : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                        }`}
                        >
                        {t.label}
                        </button>
                    ))}
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="flex justify-between">
                            <label className="text-[9px] uppercase font-bold text-[#494455]">Thickness Override (0=Auto)</label>
                            <span className="text-[10px] font-mono text-[#632CE5]">{config.nutThicknessOverride}</span>
                        </div>
                        <input 
                            type="range" min="0" max="20" step="0.5" 
                            value={config.nutThicknessOverride}
                            onChange={(e) => setConfig({...config, nutThicknessOverride: parseFloat(e.target.value)})}
                            className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <label className="text-[9px] uppercase font-bold text-[#494455]">Clearance</label>
                            <span className="text-[10px] font-mono text-[#632CE5]">{config.clearance}</span>
                        </div>
                        <input 
                            type="range" min="-0.5" max="1" step="0.05" 
                            value={config.clearance}
                            onChange={(e) => setConfig({...config, clearance: parseFloat(e.target.value)})}
                            className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <label className="text-[10px] font-bold text-[#494455]">Bevel Nut</label>
                        <input 
                            type="checkbox" 
                            checked={config.bevelNut}
                            onChange={(e) => setConfig({...config, bevelNut: e.target.checked})}
                            className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[#E2E3DD]"
                        />
                    </div>
                </div>
              )}

              {config.type === 'washer' && (
                <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                    03. Washer Settings
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'standard', label: 'Standard (ISO 7089)' },
                        { id: 'large', label: 'Large (ISO 7093)' },
                        { id: 'spring', label: 'Spring (DIN 127)' }
                    ].map(t => (
                        <button
                        key={t.id}
                        onClick={() => setConfig({...config, washerType: t.id as any})}
                        className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all \${
                            config.washerType === t.id
                            ? "bg-orange-500/10 border-orange-500/50 text-[#632CE5]"
                            : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                        }`}
                        >
                        {t.label}
                        </button>
                    ))}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <label className="text-[10px] font-bold text-[#494455]">Chamfer</label>
                        <input 
                            type="checkbox" 
                            checked={config.washerChamfer}
                            onChange={(e) => setConfig({...config, washerChamfer: e.target.checked})}
                            className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[#E2E3DD]"
                        />
                    </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                  04. Quality
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 1, label: 'Low (Preview)' },
                    { id: 2, label: 'High (Export)' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setConfig({...config, quality: t.id})}
                      className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                        config.quality === t.id
                          ? "bg-orange-500/10 border-orange-500/50 text-[#632CE5]"
                          : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E2E3DD] pb-10">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleExportSTL}
                    className="w-full bg-[#632CE5] text-white py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#7C4DFF] transition-all shadow-md group"
                  >
                    <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                    Download STL (.stl)
                  </button>
                  <button
                    onClick={handleDownloadScad}
                    className="w-full bg-[#F3F4EE] text-[#1A1C19] py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-[#CAC3D8] transition-all group"
                  >
                    <Code className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                    Download OpenSCAD (.scad)
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-6 pb-10">
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                  Print Recommendations
                </h3>
                
                <div className="bg-white p-4 rounded-xl border border-[#E2E3DD] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 blur-2xl rounded-full" />
                  <h4 className="text-[12px] font-black text-[#1A1C19] mb-3">Material Settings</h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] text-[#494455] font-mono mb-3">
                    <div>Layer Height: <span className="text-[#632CE5]">0.08 - 0.12mm</span></div>
                    <div>Infill: <span className="text-[#632CE5]">100% (Solid)</span></div>
                    <div>Perimeters: <span className="text-[#632CE5]">Min 4</span></div>
                    <div>Material: <span className="text-[#632CE5]">PETG, ABS, PC</span></div>
                  </div>
                  <p className="text-[10px] text-[#687064] leading-relaxed border-t border-[#E2E3DD]/50 pt-2">
                    For threaded functional parts, high strength materials like PETG or ABS are recommended. A very fine layer height (0.08mm) is crucial for small threads to engage properly.
                  </p>
                </div>

                <div className="bg-[#632CE5]/10 border border-[#632CE5]/20 p-4 rounded-xl flex gap-3 items-start">
                  <Settings className="w-4 h-4 text-[#632CE5] shrink-0 mt-0.5" />
                  <div className="text-[10px] text-[#494455] leading-relaxed">
                    <strong className="text-[#632CE5] block mb-1">Clearance Tip</strong>
                    If your printed nuts are too tight, increase the clearance setting (e.g. 0.15mm or 0.2mm). All printers differ slightly in their dimensional accuracy.
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-[#F1F3ED] relative">
        <div className="h-2/5 md:h-1/3 border-b border-[#E2E3DD] bg-white relative flex flex-col">
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
            <Code className="w-4 h-4 text-[#632CE5]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#494455]">OpenSCAD Code</span>
          </div>
          <button
            onClick={handleCopyScad}
            className="absolute top-4 right-6 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E2E3DD] bg-white text-[#494455] hover:text-[#632CE5] hover:border-[#632CE5]/40 text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>
          <div className="flex-1 overflow-auto p-6 pt-12 custom-scrollbar">
            <pre className="text-[11px] font-mono text-[#1A1C19] leading-relaxed">
              {scadCode}
            </pre>
          </div>
        </div>

        <div className="flex-1 relative">
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
            <Play className="w-4 h-4 text-[#632CE5]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#494455]">Preview 3D Real</span>
          </div>
          <Canvas shadows camera={{ position: [0, 40, 60], fov: 45 }}>
            <color attach="background" args={["#F1F3ED"]} />
            <ambientLight intensity={0.6} />
            <hemisphereLight args={["#ffffff", "#444455", 0.6]} />
            <spotLight position={[50, 50, 50]} angle={0.2} penumbra={1} intensity={1.2} castShadow />
            <pointLight position={[-50, -50, -50]} intensity={0.8} />
            <OrbitControls makeDefault />
            
            <Grid 
              infiniteGrid 
              fadeDistance={100} 
              sectionColor="#632CE5" 
              cellColor="#E2E3DD" 
              cellSize={2} 
              sectionSize={10} 
            />

            {geometryError ? (
              <Center>
                <mesh>
                  <boxGeometry args={[10, 10, 10]} />
                  <meshStandardMaterial color="#ef4444" wireframe />
                </mesh>
              </Center>
            ) : (
              <Center>
                <group rotation={[0, 0, Math.PI / 2]}>
                  {geometry && (
                    <mesh geometry={geometry} castShadow receiveShadow>
                      <meshStandardMaterial color="#e8e8e8" metalness={0.35} roughness={0.35} />
                    </mesh>
                  )}
                </group>
              </Center>
            )}
          </Canvas>
          {geometryError && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-[#FEE2E2] text-[#991B1B] text-[10px] font-bold px-4 py-2 rounded-lg border border-[#FCA5A5]">
              Falha ao gerar geometria: {geometryError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
