import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center } from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError, toastActionSuccess } from "@/lib/toast";
import {
  Settings2, Download, Code, Play, Settings,
  Layers, Sparkles, Copy, Circle, Square, RectangleHorizontal
} from "lucide-react";

import type { FitConfig, FitShape } from "@/src/lib/fit/types";
import { resolveFitPair } from "@/src/lib/fit/fit";
import { lidToPrimitive } from "@/src/lib/fit/lid";
import { buildContainerGeometry } from "@/src/lib/fit/container";
import { generateFitScad } from "@/src/lib/fit/scad";
import { buildPrimitiveGeometry } from "@/src/lib/primitives/geometry";

type FitView = "assembly" | "lid" | "container" | "exploded";

export default function FitConfigurator() {
  const [config, setConfig] = useState<FitConfig>({
    shape: "cylinder",
    diameter: 60,
    width: 50,
    depth: 50,
    containerHeight: 40,
    wall: 2.5,
    floor: 2.5,

    lidPlate: 4,
    lidSkirt: 10,
    clearance: 0.4,

    chamfer: true,
    chamferSize: 2,

    quality: 1,
  });

  const [activeTab, setActiveTab] = useState<'info' | 'settings' | 'materials'>('info');
  const [view, setView] = useState<FitView>("assembly");

  const fit = useMemo(() => resolveFitPair(config), [config]);
  const lidConfig = useMemo(() => lidToPrimitive(config), [config]);
  const containerGeometry = useMemo(() => buildContainerGeometry(config), [config]);
  const lidGeometry = useMemo(() => buildPrimitiveGeometry(lidConfig), [lidConfig]);
  const skirtGeometry = useMemo(() => buildPrimitiveGeometry(lidConfig, { part: "spigot" }), [lidConfig]);
  const plateGeometry = useMemo(() => buildPrimitiveGeometry(lidConfig, { part: "flange" }), [lidConfig]);
  const scadCode = useMemo(() => generateFitScad(config), [config]);

  const axis = (value: number) => Math.round(value * 10) / 10;
  const openingLabel = fit.circular
    ? `Ø${axis(fit.innerHalfW * 2)}`
    : `${axis(fit.innerHalfW * 2)} × ${axis(fit.innerHalfD * 2)}`;
  const skirtLabel = fit.circular
    ? `Ø${axis(fit.skirtHalfW * 2)} × ${axis(fit.skirt)} mm`
    : `${axis(fit.skirtHalfW * 2)} × ${axis(fit.skirtHalfD * 2)} × ${axis(fit.skirt)} mm`;
  const sizeLabel = fit.circular
    ? `Ø${axis(fit.outerHalfW * 2)} × ${axis(fit.height)} mm`
    : `${axis(fit.outerHalfW * 2)} × ${axis(fit.outerHalfD * 2)} × ${axis(fit.height)} mm`;

  const containerOffset = fit.height + 10;
  const plateOffset = fit.height + 10;

  const setShape = (shape: FitShape) => {
    setConfig((prev) => ({
      ...prev,
      shape,
      // A square keeps width and depth equal from the moment it is selected.
      depth: shape === "square" ? prev.width : prev.depth,
    }));
  };

  const setWidth = (width: number) =>
    setConfig((prev) => ({ ...prev, width, depth: prev.shape === "square" ? width : prev.depth }));

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
    link.download = `encaixe_${config.shape}_${Date.now()}.scad`;
    link.click();
  };

  const downloadStl = (geometry: THREE.BufferGeometry, name: string) => {
    const exporter = new STLExporter();
    const result = exporter.parse(new THREE.Mesh(geometry), { binary: true });
    const blob = new Blob([result], { type: "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name}_${config.shape}_${Date.now()}.stl`;
    link.click();
  };

  const handleExportLid = () => {
    try {
      downloadStl(buildPrimitiveGeometry({ ...lidConfig, quality: 2 }), "tampa");
      toastActionSuccess("STL da tampa exportado!");
    } catch (err) {
      console.error(err);
      toastExportError();
    }
  };

  const handleExportContainer = () => {
    try {
      downloadStl(buildContainerGeometry({ ...config, quality: 2 }), "recipiente");
      toastActionSuccess("STL do recipiente exportado!");
    } catch (err) {
      console.error(err);
      toastExportError();
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      <div className="w-full md:w-[400px] bg-[var(--workbench-panel)] border-r border-[var(--surface-container-high)] flex flex-col">
        <header className="p-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
              <Settings className="w-6 h-6 text-[#632CE5]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">Fit Lid</h1>
          </div>
          <p className="text-[10px] text-[var(--on-surface-variant)] font-bold tracking-widest uppercase leading-relaxed">
            Tampa & Recipiente Encaixados
          </p>
        </header>

        <div className="px-6 pb-2 shrink-0">
          <div className="flex bg-white p-1 rounded-lg">
            {[
              { id: 'info', label: 'Info' },
              { id: 'settings', label: 'Config' },
              { id: 'materials', label: 'Print' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                  activeTab === tab.id
                    ? "bg-[var(--surface-container-high)] text-[var(--workbench-text)] shadow"
                    : "text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pt-2">
          {activeTab === 'info' ? (
            <section className="space-y-6 pb-10">
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-[#632CE5]" />
                  Como usar
                </h3>

                <div className="bg-white p-4 rounded-xl border border-[var(--surface-container-high)]">
                  <h4 className="text-[12px] font-black text-[var(--workbench-text)] mb-2">1. Forma do encaixe</h4>
                  <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
                    Cilíndrico, quadrado ou retangular. As duas peças — recipiente e tampa — saem sempre na mesma forma.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[var(--surface-container-high)]">
                  <h4 className="text-[12px] font-black text-[var(--workbench-text)] mb-2">2. Recipiente</h4>
                  <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
                    Informe a medida <strong className="text-[var(--workbench-text)]">externa</strong> do recipiente. A parede define a abertura interna e o fundo define a profundidade útil.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[var(--surface-container-high)]">
                  <h4 className="text-[12px] font-black text-[var(--workbench-text)] mb-2">3. Tampa</h4>
                  <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
                    A tampa tem uma placa apoiada na borda e uma saia que entra na abertura com a folga configurada por lado.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[var(--surface-container-high)]">
                  <h4 className="text-[12px] font-black text-[var(--workbench-text)] mb-2">4. Renderize e exporte</h4>
                  <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
                    No preview você alterna entre conjunto, tampa, recipiente e vista explodida. Exporte cada peça em STL ou o par completo em OpenSCAD.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#632CE5]" />
                  Recursos
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)]/50">
                    <h5 className="text-[10px] font-bold text-[var(--workbench-text)] mb-1">Três formas</h5>
                    <p className="text-[9px] text-[var(--on-surface-variant)]">Cilindro, quadrado (L = P travado) e retângulo livre.</p>
                  </div>
                  <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)]/50">
                    <h5 className="text-[10px] font-bold text-[var(--workbench-text)] mb-1">Encaixe por dentro</h5>
                    <p className="text-[9px] text-[var(--on-surface-variant)]">A saia da tampa entra na abertura com folga ajustável.</p>
                  </div>
                  <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)]/50">
                    <h5 className="text-[10px] font-bold text-[var(--workbench-text)] mb-1">Chanfro 45°</h5>
                    <p className="text-[9px] text-[var(--on-surface-variant)]">Borda do recipiente e entrada da saia.</p>
                  </div>
                  <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)]/50">
                    <h5 className="text-[10px] font-bold text-[var(--workbench-text)] mb-1">Vista explodida</h5>
                    <p className="text-[9px] text-[var(--on-surface-variant)]">Saia, placa e recipiente separados para conferir o encaixe.</p>
                  </div>
                </div>
              </div>
            </section>
          ) : activeTab === 'settings' ? (
            <section className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5 text-[#632CE5]" />
                  01. Forma
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'cylinder', label: 'Cilindro', icon: Circle },
                    { id: 'square', label: 'Quadrado', icon: Square },
                    { id: 'rectangle', label: 'Retangular', icon: RectangleHorizontal },
                  ] as { id: FitShape; label: string; icon: any }[]).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setShape(t.id)}
                      className={`py-2 px-2 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                        config.shape === t.id
                          ? "bg-[#632CE5]/10 border-[#632CE5]/50 text-[#632CE5]"
                          : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                  02. Recipiente
                </h3>

                <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[9px] text-[var(--on-surface-variant)] font-bold uppercase">Externo</span>
                    <span className="text-[10px] text-[var(--workbench-text)] font-mono">{sizeLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] text-[var(--on-surface-variant)] font-bold uppercase">Abertura</span>
                    <span className="text-[10px] text-[#632CE5] font-mono">{openingLabel}</span>
                  </div>
                </div>

                {config.shape === 'cylinder' ? (
                  <NumberSlider
                    label="Diâmetro Externo (D)"
                    value={config.diameter}
                    min={10} max={200} step={1}
                    unit="mm"
                    onChange={(v) => setConfig({ ...config, diameter: v })}
                  />
                ) : (
                  <>
                    <NumberSlider
                      label="Largura (L)"
                      value={config.width}
                      min={10} max={200} step={1}
                      unit="mm"
                      onChange={setWidth}
                    />
                    {config.shape === 'rectangle' && (
                      <NumberSlider
                        label="Profundidade (P)"
                        value={config.depth}
                        min={10} max={200} step={1}
                        unit="mm"
                        onChange={(v) => setConfig({ ...config, depth: v })}
                      />
                    )}
                  </>
                )}
                <NumberSlider
                  label="Altura (H)"
                  value={config.containerHeight}
                  min={10} max={200} step={1}
                  unit="mm"
                  onChange={(v) => setConfig({ ...config, containerHeight: v })}
                />
                <NumberSlider
                  label="Parede"
                  value={config.wall}
                  min={0.8} max={8} step={0.1}
                  unit="mm"
                  onChange={(v) => setConfig({ ...config, wall: v })}
                />
                <NumberSlider
                  label="Fundo"
                  value={config.floor}
                  min={0.5} max={10} step={0.5}
                  unit="mm"
                  onChange={(v) => setConfig({ ...config, floor: v })}
                />
                {config.wall !== fit.wall && (
                  <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                    Parede limitada a {fit.wall.toFixed(1)} mm para não fechar a abertura.
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                  03. Tampa
                </h3>

                <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)] flex justify-between">
                  <span className="text-[9px] text-[var(--on-surface-variant)] font-bold uppercase">Saia</span>
                  <span className="text-[10px] text-[var(--workbench-text)] font-mono">{skirtLabel}</span>
                </div>

                <NumberSlider
                  label="Espessura da Placa"
                  value={config.lidPlate}
                  min={0.8} max={20} step={0.2}
                  unit="mm"
                  onChange={(v) => setConfig({ ...config, lidPlate: v })}
                />
                <NumberSlider
                  label="Altura da Saia"
                  value={config.lidSkirt}
                  min={1} max={80} step={0.5}
                  unit="mm"
                  onChange={(v) => setConfig({ ...config, lidSkirt: v })}
                />
                <NumberSlider
                  label="Folga por Lado"
                  value={config.clearance}
                  min={0.05} max={2} step={0.05}
                  unit="mm"
                  onChange={(v) => setConfig({ ...config, clearance: v })}
                />
                <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                  A placa apoia na borda e a saia entra {axis(Math.min(fit.skirt, fit.height - fit.floor))} mm na abertura.
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                    04. Chanfro
                  </h3>
                  <Toggle on={config.chamfer} onClick={() => setConfig({ ...config, chamfer: !config.chamfer })} />
                </div>

                {config.chamfer ? (
                  <>
                    <NumberSlider
                      label="Tamanho do Chanfro"
                      value={config.chamferSize}
                      min={0.5} max={10} step={0.5}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, chamferSize: v })}
                    />
                    <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                      {fit.chamfer < config.chamferSize
                        ? `Recipiente limitado a ${fit.chamfer.toFixed(1)} mm pela espessura da parede.`
                        : 'Chanfro de 45° na base e na borda do recipiente, e na entrada da saia.'}
                    </p>
                  </>
                ) : (
                  <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                    Bordas retas, sem quebra de canto.
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                  05. Qualidade
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 1, label: 'Baixa (Prévia)' },
                    { id: 2, label: 'Alta (Export)' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setConfig({ ...config, quality: t.id })}
                      className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                        config.quality === t.id
                          ? "bg-[#632CE5]/10 border-[#632CE5]/50 text-[#632CE5]"
                          : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--surface-container-high)] pb-10">
                <div className="flex flex-col gap-2">
                  <button onClick={handleExportLid} className="btn-primary">
                    <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                    Download STL da Tampa
                  </button>
                  <button
                    onClick={handleExportContainer}
                    className="w-full bg-[var(--surface-container-low)] text-[var(--workbench-text)] py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-[var(--outline-variant)] transition-all group"
                  >
                    <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                    Download STL do Recipiente
                  </button>
                  <button
                    onClick={handleDownloadScad}
                    className="w-full bg-[var(--surface-container-low)] text-[var(--workbench-text)] py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-[var(--outline-variant)] transition-all group"
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
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                  Recomendações de Impressão
                </h3>

                <div className="bg-white p-4 rounded-xl border border-[var(--surface-container-high)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 blur-2xl rounded-full" />
                  <h4 className="text-[12px] font-black text-[var(--workbench-text)] mb-3">Material</h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] text-[var(--on-surface-variant)] font-mono mb-3">
                    <div>Layer Height: <span className="text-[#632CE5]">0.12 - 0.20mm</span></div>
                    <div>Infill: <span className="text-[#632CE5]">15 - 30%</span></div>
                    <div>Perimeters: <span className="text-[#632CE5]">Min 3</span></div>
                    <div>Material: <span className="text-[#632CE5]">PLA, PETG, ABS</span></div>
                  </div>
                  <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed border-t border-[var(--surface-container-high)]/50 pt-2">
                    Imprima o recipiente com o fundo na mesa e a tampa com a placa para cima — a saia fica sem suporte.
                  </p>
                </div>

                <div className="bg-[#632CE5]/10 border border-[#632CE5]/20 p-4 rounded-xl flex gap-3 items-start">
                  <Settings className="w-4 h-4 text-[#632CE5] shrink-0 mt-0.5" />
                  <div className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
                    <strong className="text-[#632CE5] block mb-1">Dica de folga</strong>
                    Folgas abaixo de 0,3 mm costumam ficar apertadas em FDM. Para PETG, use 0,4 - 0,6 mm por lado.
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-[var(--workbench-viewport)] relative">
        <div className="h-2/5 md:h-1/3 border-b border-[var(--surface-container-high)] bg-white relative flex flex-col">
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
            <Code className="w-4 h-4 text-[#632CE5]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">OpenSCAD Code</span>
          </div>
          <button
            onClick={handleCopyScad}
            className="absolute top-4 right-6 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--surface-container-high)] bg-white text-[var(--on-surface-variant)] hover:text-[#632CE5] hover:border-[#632CE5]/40 text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>
          <div className="flex-1 overflow-auto p-6 pt-12 custom-scrollbar">
            <pre className="text-[11px] font-mono text-[var(--workbench-text)] leading-relaxed">
              {scadCode}
            </pre>
          </div>
        </div>

        <div className="flex-1 relative">
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
            <Play className="w-4 h-4 text-[#632CE5]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">Preview 3D Real</span>
          </div>

          <div className="absolute top-3 right-6 z-10 flex bg-white p-1 rounded-lg border border-[var(--surface-container-high)]">
            {([
              { id: 'assembly', label: 'Conjunto' },
              { id: 'lid', label: 'Tampa' },
              { id: 'container', label: 'Recipiente' },
              { id: 'exploded', label: 'Explodida' },
            ] as { id: FitView; label: string }[]).map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${
                  view === v.id
                    ? "bg-[var(--surface-container-high)] text-[var(--workbench-text)] shadow"
                    : "text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)]"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 40, 60], fov: 45 }}>
            <color attach="background" args={["#F1F3ED"]} />
            <ambientLight intensity={0.8} />
            <pointLight position={[10, 10, 10]} intensity={1.5} />
            <pointLight position={[-10, 5, -10]} intensity={0.8} color="#632CE5" />
            <directionalLight position={[5, 10, 5]} intensity={2.0} castShadow />
            <directionalLight position={[-5, -10, -5]} intensity={0.6} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.05} />

            <Grid
              infiniteGrid
              fadeDistance={100}
              sectionColor="#632CE5"
              cellColor="#E2E3DD"
              cellSize={2}
              sectionSize={10}
            />

            <Center>
              {view === 'container' ? (
                <mesh geometry={containerGeometry} castShadow receiveShadow>
                  <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
                </mesh>
              ) : view === 'lid' ? (
                <mesh geometry={lidGeometry} castShadow receiveShadow>
                  <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
                </mesh>
              ) : view === 'exploded' ? (
                <group>
                  <mesh geometry={containerGeometry} castShadow receiveShadow>
                    <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
                  </mesh>
                  <mesh geometry={skirtGeometry} position={[0, containerOffset, 0]} castShadow receiveShadow>
                    <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
                  </mesh>
                  <mesh
                    geometry={plateGeometry}
                    position={[0, containerOffset + fit.skirt + 12, 0]}
                    castShadow
                    receiveShadow
                  >
                    <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
                  </mesh>
                </group>
              ) : (
                <group>
                  <mesh geometry={containerGeometry} castShadow receiveShadow>
                    <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
                  </mesh>
                  <mesh geometry={lidGeometry} position={[0, plateOffset, 0]} castShadow receiveShadow>
                    <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
                  </mesh>
                </group>
              )}
            </Center>
          </Canvas>
        </div>
      </div>
    </div>
  );
}

function NumberSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">{label}</label>
        <span className="text-[10px] font-mono text-[#632CE5]">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`w-9 h-4 rounded-full transition-colors relative ${on ? "bg-[#632CE5]" : "bg-[var(--outline-variant)]"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}
