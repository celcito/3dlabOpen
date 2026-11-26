import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center } from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError, toastActionSuccess } from "@/lib/toast";
import {
  Settings2, Download, Code, Play, Settings,
  Layers, Sparkles, Copy, Circle, Square
} from "lucide-react";

import type { PrimitiveConfig, PrimitiveShape } from "@/src/lib/primitives/types";
import { buildPrimitiveGeometry, resolveChamfer, resolveFit, resolveGroove, resolveKnurl } from "@/src/lib/primitives/geometry";
import { generatePrimitiveScad } from "@/src/lib/primitives/scad";

export default function PrimitiveGenerator() {
  const [config, setConfig] = useState<PrimitiveConfig>({
    shape: "cylinder",
    diameter: 40,
    width: 40,
    depth: 40,
    height: 40,

    chamfer: true,
    chamferSize: 2,

    knurl: false,
    knurlRidges: 24,
    knurlDepth: 1,

    fit: false,
    fitHeight: 8,
    fitClearance: 0.4,

    groove: false,
    grooveWidth: 2.5,
    grooveDepth: 1.2,
    grooveHeight: 4,

    quality: 1,
  });

  const [activeTab, setActiveTab] = useState<'info' | 'settings' | 'materials'>('info');

  const geometry = useMemo(() => buildPrimitiveGeometry(config), [config]);
  const scadCode = useMemo(() => generatePrimitiveScad(config), [config]);

  const chamfer = resolveChamfer(config);
  const knurl = resolveKnurl(config);
  const fit = resolveFit(config);
  const fitLabel = fit
    ? config.shape === 'cylinder'
      ? `Ø${(config.diameter - 2 * fit.clearance).toFixed(1)} × ${fit.height} mm`
      : `${(config.width - 2 * fit.clearance).toFixed(1)} × ${(config.depth - 2 * fit.clearance).toFixed(1)} × ${fit.height} mm`
    : '';
  const groove = resolveGroove(config);
  const sizeLabel =
    config.shape === 'cylinder'
      ? `Ø${config.diameter} × ${config.height} mm`
      : `${config.width} × ${config.depth} × ${config.height} mm`;

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
    link.download = `primitive_${config.shape}_${Date.now()}.scad`;
    link.click();
  };

  const handleExportSTL = () => {
    try {
      const geom = buildPrimitiveGeometry({ ...config, quality: 2 });
      const mesh = new THREE.Mesh(geom);
      const exporter = new STLExporter();
      const result = exporter.parse(mesh, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `primitive_${config.shape}_${Date.now()}.stl`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toastActionSuccess("STL exportado com sucesso!");
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
            <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">Primitives</h1>
          </div>
          <p className="text-[10px] text-[var(--on-surface-variant)] font-bold tracking-widest uppercase leading-relaxed">
            Cilindros & Cubos Estriados / Chanfrados
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
                  <h4 className="text-[12px] font-black text-[var(--workbench-text)] mb-2">1. Escolha a forma</h4>
                  <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
                    Cilindro ou cubo. As medidas são informadas em milímetros, direto nos controles de dimensão.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[var(--surface-container-high)]">
                  <h4 className="text-[12px] font-black text-[var(--workbench-text)] mb-2">2. Ajuste as medidas</h4>
                  <ul className="text-[10px] text-[var(--on-surface-variant)] space-y-1 ml-4 list-disc marker:text-[#632CE5] mb-2">
                    <li><strong className="text-[var(--workbench-text)]">Cilindro:</strong> diâmetro (D) e altura (H).</li>
                    <li><strong className="text-[var(--workbench-text)]">Cubo:</strong> largura (L), profundidade (P) e altura (H).</li>
                  </ul>
                  <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed border-t border-[var(--surface-container-high)] pt-2">
                    O modelo é sempre gerado apoiado na base, com as medidas exatas configuradas.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[var(--surface-container-high)]">
                  <h4 className="text-[12px] font-black text-[var(--workbench-text)] mb-2">3. Chanfro e estriado</h4>
                  <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
                    O chanfro corta as bordas de cima e de baixo em 45°. O estriado cria relevos verticais nas laterais — útil para pegada de botões, manípulos e tampas.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[var(--surface-container-high)]">
                  <h4 className="text-[12px] font-black text-[var(--workbench-text)] mb-2">4. Encaixe de tampa</h4>
                  <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
                    Ligando o encaixe a peça vira tampa: a base sai menor (medida nominal menos a folga por lado) e a aba de cima mantém a medida, apoiando na borda do recipiente.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[var(--surface-container-high)]">
                  <h4 className="text-[12px] font-black text-[var(--workbench-text)] mb-2">5. Renderize e exporte</h4>
                  <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
                    A prévia é atualizada em tempo real. Exporte o STL pronto para fatiar ou o código OpenSCAD paramétrico.
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
                    <h5 className="text-[10px] font-bold text-[var(--workbench-text)] mb-1">Formas paramétricas</h5>
                    <p className="text-[9px] text-[var(--on-surface-variant)]">Cilindro e cubo com medidas livres em mm.</p>
                  </div>
                  <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)]/50">
                    <h5 className="text-[10px] font-bold text-[var(--workbench-text)] mb-1">Chanfro 45°</h5>
                    <p className="text-[9px] text-[var(--on-surface-variant)]">Bordas de topo e base arredondadas em ângulo reto.</p>
                  </div>
                  <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)]/50">
                    <h5 className="text-[10px] font-bold text-[var(--workbench-text)] mb-1">Estriado vertical</h5>
                    <p className="text-[9px] text-[var(--on-surface-variant)]">Nº de estrias e profundidade configuráveis.</p>
                  </div>
                  <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)]/50">
                    <h5 className="text-[10px] font-bold text-[var(--workbench-text)] mb-1">Encaixe de tampa</h5>
                    <p className="text-[9px] text-[var(--on-surface-variant)]">Degrau inferior com folga ajustável para tampar cilindros e caixas.</p>
                  </div>
                  <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)]/50">
                    <h5 className="text-[10px] font-bold text-[var(--workbench-text)] mb-1">Rasgo de anel</h5>
                    <p className="text-[9px] text-[var(--on-surface-variant)]">Canal circunferencial para anel elástico, em cilindros.</p>
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

                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'cylinder', label: 'Cilindro', icon: Circle },
                    { id: 'box', label: 'Cubo', icon: Square },
                  ] as { id: PrimitiveShape; label: string; icon: any }[]).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setConfig({ ...config, shape: t.id })}
                      className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all flex items-center justify-center gap-2 ${
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
                  02. Dimensões
                </h3>

                <div className="bg-[var(--surface-container-low)] p-3 rounded-lg border border-[var(--surface-container-high)] flex justify-between">
                  <span className="text-[9px] text-[var(--on-surface-variant)] font-bold uppercase">Medida final</span>
                  <span className="text-[10px] text-[var(--workbench-text)] font-mono">{sizeLabel}</span>
                </div>

                {config.shape === 'cylinder' ? (
                  <>
                    <NumberSlider
                      label="Diâmetro (D)"
                      value={config.diameter}
                      min={5} max={200} step={1}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, diameter: v })}
                    />
                    <NumberSlider
                      label="Altura (H)"
                      value={config.height}
                      min={5} max={200} step={1}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, height: v })}
                    />
                  </>
                ) : (
                  <>
                    <NumberSlider
                      label="Largura (L)"
                      value={config.width}
                      min={5} max={200} step={1}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, width: v })}
                    />
                    <NumberSlider
                      label="Profundidade (P)"
                      value={config.depth}
                      min={5} max={200} step={1}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, depth: v })}
                    />
                    <NumberSlider
                      label="Altura (H)"
                      value={config.height}
                      min={5} max={200} step={1}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, height: v })}
                    />
                  </>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                    03. Chanfro
                  </h3>
                  <Toggle on={config.chamfer} onClick={() => setConfig({ ...config, chamfer: !config.chamfer })} />
                </div>

                {config.chamfer && (
                  <NumberSlider
                    label="Tamanho do Chanfro"
                    value={config.chamferSize}
                    min={0.5} max={10} step={0.5}
                    unit="mm"
                    onChange={(v) => setConfig({ ...config, chamferSize: v })}
                  />
                )}
                {config.chamfer && chamfer < config.chamferSize && (
                  <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                    Limitado a {chamfer.toFixed(1)} mm para não comprometer a peça.
                  </p>
                )}
                {!config.chamfer && (
                  <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                    Bordas retas, sem quebra de canto.
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                    04. Estriado
                  </h3>
                  <Toggle on={config.knurl} onClick={() => setConfig({ ...config, knurl: !config.knurl })} />
                </div>

                {config.knurl && (
                  <>
                    <NumberSlider
                      label={config.shape === 'cylinder' ? "Nº de Estrias" : "Estrias por Face"}
                      value={config.knurlRidges}
                      min={6} max={config.shape === 'cylinder' ? 72 : 40} step={1}
                      unit=""
                      onChange={(v) => setConfig({ ...config, knurlRidges: v })}
                    />
                    <NumberSlider
                      label="Profundidade"
                      value={config.knurlDepth}
                      min={0.2} max={3} step={0.1}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, knurlDepth: v })}
                    />
                    <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                      Relevos verticais nas laterais — {knurl.ridges} estrias, {knurl.depth} mm de profundidade.
                    </p>
                  </>
                )}
                {!config.knurl && (
                  <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                    Laterais lisas.
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                    <Circle className="w-3.5 h-3.5 text-[#632CE5]" />
                    05. Rasgo (Anel)
                  </h3>
                  {config.shape === 'cylinder' && (
                    <Toggle on={config.groove} onClick={() => setConfig({ ...config, groove: !config.groove })} />
                  )}
                </div>

                {config.shape !== 'cylinder' ? (
                  <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                    O rasgo de anel elástico está disponível apenas para cilindros.
                  </p>
                ) : config.groove ? (
                  <>
                    <NumberSlider
                      label="Largura do Rasgo"
                      value={config.grooveWidth}
                      min={0.5} max={10} step={0.1}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, grooveWidth: v })}
                    />
                    <NumberSlider
                      label="Profundidade"
                      value={config.grooveDepth}
                      min={0.1} max={5} step={0.1}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, grooveDepth: v })}
                    />
                    <NumberSlider
                      label="Centro (da base)"
                      value={config.grooveHeight}
                      min={0} max={200} step={0.5}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, grooveHeight: v })}
                    />
                    <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                      {groove
                        ? `Rasgo com ${groove.width.toFixed(1)} mm de largura e ${groove.depth.toFixed(1)} mm de profundidade, a ${groove.bottom.toFixed(1)} mm da base.`
                        : 'Sem espaço para o rasgo com estas medidas.'}
                    </p>
                  </>
                ) : (
                  <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                    Laterais sem canal. O rasgo deixa um rebaixo para prender um anel elástico (O-ring).
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                    06. Encaixe (Tampa)
                  </h3>
                  <Toggle on={config.fit} onClick={() => setConfig({ ...config, fit: !config.fit })} />
                </div>

                {config.fit ? (
                  <>
                    <NumberSlider
                      label="Altura do Encaixe"
                      value={config.fitHeight}
                      min={1} max={60} step={0.5}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, fitHeight: v })}
                    />
                    <NumberSlider
                      label="Folga por Lado"
                      value={config.fitClearance}
                      min={0.05} max={2} step={0.05}
                      unit="mm"
                      onChange={(v) => setConfig({ ...config, fitClearance: v })}
                    />
                    <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                      Encaixe {fitLabel}: a base menor entra no recipiente e a aba de cima fica apoiada na borda.
                    </p>
                  </>
                ) : (
                  <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                    Peça sólida, sem degrau de encaixe.
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                  07. Qualidade
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
                  <button
                    onClick={handleExportSTL}
                    className="btn-primary"
                  >
                    <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                    Download STL (.stl)
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
                    Peças de pegada (manípulos, botões) ficam mais confortáveis com estrias — use camadas finas para os relevos saírem definidos.
                  </p>
                </div>

                <div className="bg-[#632CE5]/10 border border-[#632CE5]/20 p-4 rounded-xl flex gap-3 items-start">
                  <Settings className="w-4 h-4 text-[#632CE5] shrink-0 mt-0.5" />
                  <div className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
                    <strong className="text-[#632CE5] block mb-1">Dica de chanfro</strong>
                    O chanfro é aplicado no topo e na base — com encaixe, ele quebra o canto de entrada da tampa. Ele também corta as estrias nas pontas, deixando o acabamento uniforme.
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
          <button
            onClick={handleExportSTL}
            className="absolute top-4 right-6 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#632CE5]/40 bg-[#632CE5]/10 text-[#632CE5] hover:bg-[#632CE5]/20 text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar STL
          </button>
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
              <mesh geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
              </mesh>
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
