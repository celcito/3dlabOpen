import React, { useState } from 'react';
import type { PencilTopperConfig, Model3DDimensions } from '../types/pencilTopper';
import { PENCIL_MODELS, PENCIL_COLOR_PALETTES, PRESET_SYMBOLS } from '../lib/pencilTopper/presets';
import { FONT_CATALOG } from '../lib/letterBox/presets';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Sparkles,
  Upload,
  Layers,
  Circle,
  Hexagon,
  Eye,
  Box,
  Sliders,
  Check,
  Type,
  Maximize2
} from 'lucide-react';

interface PencilTopperControlsProps {
  config: PencilTopperConfig;
  onChange: (newConfig: PencilTopperConfig) => void;
  dimensions: Model3DDimensions;
  onOpenExportModal: () => void;
  onQuickDownload3MF: () => void;
  onOpenSvgConverter: () => void;
}

export const PencilTopperControls: React.FC<PencilTopperControlsProps> = ({
  config,
  onChange,
  dimensions,
  onOpenExportModal,
  onQuickDownload3MF,
  onOpenSvgConverter,
}) => {
  // Estados de acordeão para cada seção
  const [openSections, setOpenSections] = useState({
    diameter: true,
    typography: true,
    symbol: true,
    base: true,
    colors: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const effectiveDiameter = Number((config.pencilDiameter + config.clearance).toFixed(1));

  // Seleciona um modelo pré-definido de lápis / caneta
  const handleSelectModel = (modelId: PencilTopperConfig['pencilModel']) => {
    const selected = PENCIL_MODELS.find((m) => m.id === modelId);
    if (!selected) return;

    onChange({
      ...config,
      pencilModel: selected.id,
      pencilDiameter: selected.defaultDiameter,
      holeShape: selected.defaultHoleShape,
    });
  };

  // Aplica paleta recomendada de 2 cores
  const handleApplyPalette = (palette: (typeof PENCIL_COLOR_PALETTES)[0]) => {
    onChange({
      ...config,
      baseColor: palette.baseColor,
      reliefColor: palette.reliefColor,
    });
  };

  return (
    <aside className="w-full lg:w-[410px] xl:w-[430px] bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] flex flex-col h-full overflow-hidden select-none">
      {/* Cabeçalho do Painel Lateral */}
      <div className="p-4 border-b border-[var(--surface-container-high)] bg-[var(--workbench-page)]/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--workbench-text)] tracking-tight">
                Ponteira de Lápis 3D
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Paramétrico
              </span>
            </div>
            <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
              Clips de Lápis & Canetas em 2 Cores
            </p>
          </div>

          {/* Indicador de Furo Integrado no Texto */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--surface-container-high)]/80 border border-[var(--surface-container-high)] text-[11px] text-purple-300">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-semibold">Furo no Texto</span>
          </div>
        </div>
      </div>

      {/* Corpo Rolável com as Seções Sanfonadas */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--surface-container-high)]/80 p-4 space-y-4">
        {/* SEÇÃO 1: Diâmetro & Encaixe */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => toggleSection('diameter')}
            className="w-full flex items-center justify-between py-1 text-sm font-bold text-[var(--workbench-text)] group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Diâmetro & Encaixe
            </span>
            {openSections.diameter ? (
              <ChevronUp className="w-4 h-4 text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)] transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)] transition-colors" />
            )}
          </button>

          {openSections.diameter && (
            <div className="mt-3 space-y-3.5 animate-in fade-in duration-200">
              <label className="text-xs font-semibold text-[var(--on-surface-variant)] block">
                Escolha o Modelo do Lápis / Caneta
              </label>

              {/* Grid de Modelos Pré-definidos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PENCIL_MODELS.map((model) => {
                  const isSelected = config.pencilModel === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => handleSelectModel(model.id)}
                      className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-purple-500/15 border-purple-500/50 shadow-sm shadow-purple-500/10'
                          : 'bg-[var(--surface-container-high)]/60 border-[var(--surface-container-high)]/60 hover:bg-[var(--surface-container-high)] hover:border-[var(--surface-container-high)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{model.emoji}</span>
                        <span className="text-xs font-bold text-[var(--workbench-text)] truncate">
                          {model.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--on-surface-variant)] mt-1 leading-snug line-clamp-2">
                        {model.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Slider Diâmetro do Lápis/Caneta */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-[var(--on-surface-variant)] mb-1.5">
                  <span>Diâmetro do Lápis/Caneta</span>
                  <div className="flex items-center gap-1 font-mono text-purple-400 bg-[var(--workbench-page)] px-2 py-0.5 rounded border border-[var(--surface-container-high)]">
                    <input
                      type="number"
                      step="0.1"
                      min="5.0"
                      max="15.0"
                      value={config.pencilDiameter}
                      onChange={(e) =>
                        onChange({
                          ...config,
                          pencilDiameter: Math.max(5.0, Math.min(15.0, Number(e.target.value) || 5.0)),
                          pencilModel: 'personalizado',
                        })
                      }
                      className="w-12 bg-transparent text-right outline-none font-bold"
                    />
                    <span>mm</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="5.0"
                  max="15.0"
                  step="0.1"
                  value={config.pencilDiameter}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      pencilDiameter: Number(e.target.value),
                      pencilModel: 'personalizado',
                    })
                  }
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Slider Folga de Encaixe (Clearance) */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-[var(--on-surface-variant)] mb-1.5">
                  <span>Folga de Encaixe (Clearance)</span>
                  <div className="flex items-center gap-1 font-mono text-purple-400 bg-[var(--workbench-page)] px-2 py-0.5 rounded border border-[var(--surface-container-high)]">
                    <input
                      type="number"
                      step="0.1"
                      min="0.0"
                      max="1.5"
                      value={config.clearance}
                      onChange={(e) =>
                        onChange({
                          ...config,
                          clearance: Math.max(0, Math.min(1.5, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-10 bg-transparent text-right outline-none font-bold"
                    />
                    <span>mm</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.05"
                  value={config.clearance}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      clearance: Number(e.target.value),
                    })
                  }
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Tag com o Diâmetro Interno Efetivo */}
              <div className="p-2.5 rounded-xl bg-[var(--workbench-page)]/80 border border-[var(--surface-container-high)] text-xs text-[var(--on-surface-variant)] flex items-center justify-between">
                <span className="text-[var(--on-surface-variant)]">Diâmetro interno do furo:</span>
                <span className="font-mono font-bold text-purple-300">
                  {effectiveDiameter} mm <span className="text-[var(--on-surface-variant)] font-normal">(+{config.clearance.toFixed(1)}mm folga)</span>
                </span>
              </div>

              {/* Formato do Furo */}
              <div>
                <label className="text-xs font-semibold text-[var(--on-surface-variant)] block mb-1.5">
                  Formato do Furo:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, holeShape: 'round' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      config.holeShape === 'round'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-[var(--surface-container-high)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <Circle className="w-3.5 h-3.5" />
                    <span>Redondo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, holeShape: 'hexagonal' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      config.holeShape === 'hexagonal'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-[var(--surface-container-high)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <Hexagon className="w-3.5 h-3.5" />
                    <span>Hexagonal</span>
                  </button>
                </div>
              </div>

              {/* Passagem / Orientação do Lápis no Texto */}
              <div>
                <label className="text-xs font-semibold text-[var(--on-surface-variant)] block mb-1.5">
                  Como o Lápis Atravessa o Texto:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, holeOrientation: 'horizontal' })}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                      (config.holeOrientation || 'horizontal') === 'horizontal'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-[var(--surface-container-high)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]'
                    }`}
                    title="O lápis desliza pelo comprimento do nome através de túnel tubular integrado"
                  >
                    <span className="text-sm">↔️</span>
                    <span className="text-center leading-tight">Ao Longo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, holeOrientation: 'vertical' })}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                      config.holeOrientation === 'vertical'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-[var(--surface-container-high)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]'
                    }`}
                    title="O lápis entra por baixo e atravessa o texto verticalmente para cima"
                  >
                    <span className="text-sm">↕️</span>
                    <span className="text-center leading-tight">Vertical</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, holeOrientation: 'through-center' })}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                      config.holeOrientation === 'through-center'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-[var(--surface-container-high)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]'
                    }`}
                    title="O furo atravessa perpendicularmente o centro do texto"
                  >
                    <span className="text-sm">⊙</span>
                    <span className="text-center leading-tight">Central</span>
                  </button>
                </div>
                <p className="text-[10px] text-[var(--on-surface-variant)] mt-1.5 leading-snug">
                  {(config.holeOrientation || 'horizontal') === 'horizontal'
                    ? 'Túnel passante pelo comprimento do texto: o lápis desliza por dentro do nome.'
                    : config.holeOrientation === 'vertical'
                    ? 'O lápis entra por baixo e atravessa o texto na vertical (ponteira no topo).'
                    : 'Furo passante central cortado direto através do corpo das letras.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO 2: Texto & Tipografia */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => toggleSection('typography')}
            className="w-full flex items-center justify-between py-1 text-sm font-bold text-[var(--workbench-text)] group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Texto & Tipografia
            </span>
            {openSections.typography ? (
              <ChevronUp className="w-4 h-4 text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)] transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)] transition-colors" />
            )}
          </button>

          {openSections.typography && (
            <div className="mt-3 space-y-3.5 animate-in fade-in duration-200">
              {/* Texto / Nomes */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-[var(--on-surface-variant)] mb-1">
                  <span>Texto / Nomes</span>
                  <span className="text-[11px] text-purple-400 font-mono">
                    1 nome ({config.text})
                  </span>
                </div>
                <input
                  type="text"
                  value={config.text}
                  onChange={(e) => onChange({ ...config, text: e.target.value.substring(0, 18) })}
                  placeholder="Nome na ponteira (ex: Helena)"
                   className="w-full px-3.5 py-2 rounded-xl bg-[var(--workbench-page)] border border-[var(--surface-container-high)] text-sm text-[var(--workbench-text)] font-bold tracking-wide focus:border-purple-500 outline-none transition-colors"
                />
              </div>

              {/* Família da Fonte */}
              <div>
                <label className="text-xs font-semibold text-[var(--on-surface-variant)] block mb-1">
                  Família da Fonte
                </label>
                <select
                  value={config.fontFamily}
                  onChange={(e) => onChange({ ...config, fontFamily: e.target.value })}
                   className="w-full px-3 py-2 rounded-xl bg-[var(--workbench-page)] border border-[var(--surface-container-high)] text-xs text-[var(--workbench-text)] font-semibold focus:border-purple-500 outline-none cursor-pointer"
                >
                  <option value="Pacifico">Pacifico (Cursiva / Manuscrita - Modelo Helena)</option>
                  <option value="Dancing Script">Dancing Script (Caligrafia Fluida)</option>
                  <option value="Lobster">Lobster (Cursiva Espessa)</option>
                  <option value="Anton">Anton (Impactante e reta)</option>
                  <option value="Poppins">Poppins (Moderna & Geométrica)</option>
                  <option value="Lilita One">Lilita One (Gordinha e volumosa)</option>
                  <option value="Fredoka">Fredoka (Arredondada e lúdica)</option>
                  <option value="Bebas Neue">Bebas Neue (Alta e condensada)</option>
                  <option value="Chewy">Chewy (Divertida e animada)</option>
                  <option value="Archivo Black">Archivo Black (Ultra pesada)</option>
                  <option value="Bangers">Bangers (Estilo Gibi/HQ)</option>
                  <option value="Orbitron">Orbitron (Tecnológica)</option>
                </select>
              </div>

              {/* Tamanho da Letra (Text Size) */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-[var(--on-surface-variant)] mb-1">
                  <span>Tamanho da Letra (Text Size)</span>
                  <span className="font-mono text-purple-400 bg-[var(--workbench-page)] px-2 py-0.5 rounded border border-[var(--surface-container-high)]">
                    {config.letterHeight} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="28"
                  step="1"
                  value={config.letterHeight}
                  onChange={(e) => onChange({ ...config, letterHeight: Number(e.target.value) })}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Espaçamento entre Letras (Letter Gap) */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-[var(--on-surface-variant)] mb-1">
                  <span>Espaçamento entre Letras (Letter Gap)</span>
                  <span className="font-mono text-purple-400 bg-[var(--workbench-page)] px-2 py-0.5 rounded border border-[var(--surface-container-high)]">
                    {config.letterSpacing.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.5"
                  step="0.1"
                  value={config.letterSpacing}
                  onChange={(e) => onChange({ ...config, letterSpacing: Number(e.target.value) })}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO 3: Ícone Lateral / Símbolo */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => toggleSection('symbol')}
            className="w-full flex items-center justify-between py-1 text-sm font-bold text-[var(--workbench-text)] group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Ícone Lateral / Símbolo
            </span>
            {openSections.symbol ? (
              <ChevronUp className="w-4 h-4 text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)] transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)] transition-colors" />
            )}
          </button>

          {openSections.symbol && (
            <div className="mt-3 space-y-3.5 animate-in fade-in duration-200">
              {/* Carrossel de Ícones Pré-definidos */}
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_SYMBOLS.map((sym) => {
                  const isSelected = config.symbolId === sym.id;
                  return (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => onChange({ ...config, symbolId: sym.id })}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm'
                          : 'bg-[var(--surface-container-high)]/60 border-[var(--surface-container-high)]/60 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--workbench-text)]'
                      }`}
                      title={sym.name}
                    >
                      <span className="text-xl">{sym.emoji}</span>
                      <span className="text-[9px] truncate w-full text-center mt-0.5">{sym.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Botão de Upload de Ícone */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenSvgConverter}
                  className="flex-1 py-2 px-3 rounded-xl bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-high)] border border-[var(--surface-container-high)] text-xs font-semibold text-[var(--workbench-text)] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  <span>Upload Ícone (PNG/JPG/SVG)</span>
                </button>
              </div>

              {/* Chamada para o Conversor de SVG 3D */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/30 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-orange-300">
                  <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Conversor de SVG 3D</span>
                </div>
                <p className="text-[11px] text-[var(--on-surface-variant)] leading-relaxed">
                  <strong>DICA:</strong> Deseja transformar um desenho ou imagem em vetor com linhas reforçadas e prontas para impressão 3D?
                </p>
                <button
                  type="button"
                  onClick={onOpenSvgConverter}
                  className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Abrir Conversor de SVG →</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO 4: Base & Espessura */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => toggleSection('base')}
            className="w-full flex items-center justify-between py-1 text-sm font-bold text-[var(--workbench-text)] group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Base & Espessura
            </span>
            {openSections.base ? (
              <ChevronUp className="w-4 h-4 text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)] transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)] transition-colors" />
            )}
          </button>

          {openSections.base && (
            <div className="mt-3 space-y-3.5 animate-in fade-in duration-200">
              {/* Borda / Contorno da Base (Outline Size) */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-[var(--on-surface-variant)] mb-1">
                  <span>Borda / Contorno da Base (Outline Size)</span>
                  <span className="font-mono text-purple-400 bg-[var(--workbench-page)] px-2 py-0.5 rounded border border-[var(--surface-container-high)]">
                    {config.outlineSize.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="6.0"
                  step="0.2"
                  value={config.outlineSize}
                  onChange={(e) => onChange({ ...config, outlineSize: Number(e.target.value) })}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Espessura da Parede da Base */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-[var(--on-surface-variant)] mb-1">
                  <span>Espessura da Parede da Base</span>
                  <span className="font-mono text-purple-400 bg-[var(--workbench-page)] px-2 py-0.5 rounded border border-[var(--surface-container-high)]">
                    {config.baseWallThickness.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="4.5"
                  step="0.2"
                  value={config.baseWallThickness}
                  onChange={(e) => onChange({ ...config, baseWallThickness: Number(e.target.value) })}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Espessura das Letras em Relevo */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-[var(--on-surface-variant)] mb-1">
                  <span>Espessura das Letras em Relevo</span>
                  <span className="font-mono text-purple-400 bg-[var(--workbench-page)] px-2 py-0.5 rounded border border-[var(--surface-container-high)]">
                    {config.reliefThickness.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="4.0"
                  step="0.2"
                  value={config.reliefThickness}
                  onChange={(e) => onChange({ ...config, reliefThickness: Number(e.target.value) })}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Caixa de Dimensões Técnicas Calculadas */}
              <div className="p-3 rounded-xl bg-[var(--workbench-page)] border border-[var(--surface-container-high)] space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
                  <span>Altura total calculada do modelo (Z):</span>
                  <span className="font-mono font-bold text-purple-300">
                    {dimensions.dimZ} mm
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
                  <span>Dimensões estimadas 3D:</span>
                  <span className="font-mono text-[var(--workbench-text)]">
                    X {dimensions.dimX} × Y {dimensions.dimY} × Z {dimensions.dimZ} mm
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--on-surface-variant)] pt-1 border-t border-[var(--surface-container-high)]/80">
                  <span>Volume & Peso estimado:</span>
                  <span className="font-mono text-emerald-400">
                    {dimensions.volumeCm3} cm³ • ~{dimensions.weightGrams}g PLA
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO 5: Cores do Modelo (2 Cores) */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => toggleSection('colors')}
            className="w-full flex items-center justify-between py-1 text-sm font-bold text-[var(--workbench-text)] group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Cores do Modelo
            </span>
            {openSections.colors ? (
              <ChevronUp className="w-4 h-4 text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)] transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)] transition-colors" />
            )}
          </button>

          {openSections.colors && (
            <div className="mt-3 space-y-3.5 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 gap-2.5">
                {/* Cor 1: Corpo da Base */}
                <div className="p-2.5 rounded-xl bg-[var(--workbench-page)] border border-[var(--surface-container-high)] flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--on-surface-variant)]">
                    1. Corpo da Base
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.baseColor}
                      onChange={(e) => onChange({ ...config, baseColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-xs font-mono font-bold text-[var(--workbench-text)] uppercase">
                      {config.baseColor}
                    </span>
                  </div>
                </div>

                {/* Cor 2: Letras em Relevo */}
                <div className="p-2.5 rounded-xl bg-[var(--workbench-page)] border border-[var(--surface-container-high)] flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--on-surface-variant)]">
                    2. Letras em Relevo
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.reliefColor}
                      onChange={(e) => onChange({ ...config, reliefColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-xs font-mono font-bold text-[var(--workbench-text)] uppercase">
                      {config.reliefColor}
                    </span>
                  </div>
                </div>
              </div>

              {/* Paletas Recomendadas */}
              <div>
                <label className="text-xs font-semibold text-[var(--on-surface-variant)] block mb-2">
                  Paletas Recomendadas
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {PENCIL_COLOR_PALETTES.map((palette) => {
                    const isSelected =
                      config.baseColor.toLowerCase() === palette.baseColor.toLowerCase() &&
                      config.reliefColor.toLowerCase() === palette.reliefColor.toLowerCase();

                    return (
                      <button
                        key={palette.id}
                        type="button"
                        onClick={() => handleApplyPalette(palette)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                          isSelected
                            ? 'bg-purple-500/15 border-purple-500 shadow-sm'
                            : 'bg-[var(--surface-container-high)]/60 border-[var(--surface-container-high)]/60 hover:bg-[var(--surface-container-high)] hover:border-[var(--surface-container-high)]'
                        }`}
                      >
                        <div className="flex items-center -space-x-1.5">
                          <span
                            className="w-4 h-4 rounded-full border border-[var(--surface-container-high)] shadow-sm"
                            style={{ backgroundColor: palette.baseColor }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-[var(--surface-container-high)] shadow-sm"
                            style={{ backgroundColor: palette.reliefColor }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--on-surface-variant)] truncate w-full">
                          {palette.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé de Ações com Baixar 3MF (Multicolor) */}
      <div className="p-4 border-t border-[var(--surface-container-high)] bg-[var(--workbench-panel)]/90 backdrop-blur-sm space-y-2 shrink-0">
        <button
          type="button"
          onClick={onQuickDownload3MF}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25 active:scale-[0.99] cursor-pointer"
        >
          <Download className="w-5 h-5 stroke-[2.5]" />
          <span>Baixar 3MF (Multicolor)</span>
        </button>

        <button
          type="button"
          onClick={onOpenExportModal}
          className="w-full py-2 px-3 rounded-xl bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Box className="w-4 h-4" />
          <span>Mais Opções de Exportação (STL)</span>
        </button>
      </div>
    </aside>
  );
};
