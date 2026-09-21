import React, { useState, useRef } from 'react';
import type { LetterBoxConfig, Model3DDimensions } from '../types/letterBox';
import { FONT_CATALOG, COLOR_PALETTES, DEFAULT_CONFIG } from '../lib/letterBox/presets';
import { clearSavedConfig } from '../lib/letterBox/storage';
import {
  Type,
  Sliders,
  Palette,
  Layers,
  Upload,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Check,
  RotateCcw,
  Box,
  CornerDownRight,
  Save,
} from 'lucide-react';

interface SidebarControlsProps {
  config: LetterBoxConfig;
  onChange: (newConfig: LetterBoxConfig) => void;
  dimensions: Model3DDimensions;
  onOpenExportModal: () => void;
  onQuickDownload3MF: () => void;
}

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  config,
  onChange,
  dimensions,
  onOpenExportModal,
  onQuickDownload3MF,
}) => {
  // Estados de acordeão / seções recolhíveis (todas abertas por padrão como na UI do MakerWorld)
  const [openSection, setOpenSection] = useState<{ [key: string]: boolean }>({
    params: true,
    fineTune: true,
    base: true,
    colors: true,
  });

  const [fontSearch, setFontSearch] = useState('');
  const [fontCategoryFilter, setFontCategoryFilter] = useState<string>('all');
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (section: string) => {
    setOpenSection((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Upload de Fonte Customizada (.ttf, .otf, .woff)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const customName = file.name.replace(/\.[^/.]+$/, '').trim() || 'Fonte_Customizada';

      const fontFace = new FontFace(customName, buffer);
      await fontFace.load();
      document.fonts.add(fontFace);

      // Converte para base64 se o arquivo for razoável (<2.5MB) para persistir no localStorage
      let base64String: string | undefined = undefined;
      if (file.size < 2.5 * 1024 * 1024) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64String = window.btoa(binary);
      }

      onChange({
        ...config,
        fontFamily: customName,
        customFontName: customName,
        customFontBase64: base64String,
      });
      setIsFontDropdownOpen(false);
    } catch (err) {
      console.error('Erro ao carregar fonte:', err);
      alert('Não foi possível carregar o arquivo de fonte. Tente outro arquivo .ttf ou .otf.');
    }
  };

  // Filtragem do catálogo de fontes
  const filteredFonts = FONT_CATALOG.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(fontSearch.toLowerCase()) ||
      f.description.toLowerCase().includes(fontSearch.toLowerCase());
    const matchesCat = fontCategoryFilter === 'all' || f.category === fontCategoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <aside className="w-full md:w-[400px] h-full bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] flex flex-col shrink-0 overflow-hidden select-none">
      {/* Cabeçalho da Barra Lateral */}
      <div className="p-4 border-b border-[var(--surface-container-high)] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
            <h2 className="text-sm font-bold text-[var(--workbench-text)] uppercase tracking-wider">
              Painel Paramétrico
            </h2>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-[var(--on-surface-variant)]">
              Letra Caixa 3D • 3 Camadas
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded-md">
              <Check className="w-2.5 h-2.5" />
              Salvo no navegador
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            clearSavedConfig();
            onChange(DEFAULT_CONFIG);
          }}
          title="Restaurar Parâmetros Padrão de Fábrica"
          className="p-1.5 rounded-lg text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Conteúdo Rolável de Parâmetros */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ========================================================================= */}
        {/* SEÇÃO 1: PARÂMETROS PRINCIPAIS */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-[var(--surface-container-high)] bg-[var(--workbench-viewport)] overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('params')}
            className="w-full p-3.5 flex items-center justify-between bg-[var(--workbench-viewport)] hover:bg-[var(--surface-container-high)] text-left transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold text-[var(--workbench-text)] uppercase tracking-wider flex items-center gap-2">
              <Type className="w-4 h-4 text-[#632CE5]" />
              Parâmetros Principais
            </span>
            {openSection.params ? (
              <ChevronUp className="w-4 h-4 text-[var(--on-surface-variant)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)]" />
            )}
          </button>

          {openSection.params && (
            <div className="p-4 space-y-4 border-t border-[var(--surface-container-high)]/80">
              {/* Texto do Nome */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="input-text" className="text-xs font-semibold text-[var(--workbench-text)]">
                    Texto do Nome
                  </label>
                  <span className="text-[11px] text-[var(--on-surface-variant)] font-medium">
                    (1 por linha)
                  </span>
                </div>
                <textarea
                  id="input-text"
                  rows={2}
                  value={config.text}
                  onChange={(e) => onChange({ ...config, text: e.target.value })}
                  placeholder="Ex: M2CR ou Nomes"
                  className="w-full px-3 py-2 bg-white border border-[var(--surface-container-high)] rounded-xl text-sm font-bold text-[var(--workbench-text)] focus:outline-none focus:border-[#632CE5] transition-colors resize-none uppercase"
                />
              </div>

              {/* Família da Fonte */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[var(--workbench-text)]">
                    Família da Fonte
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] text-[#632CE5] hover:text-purple-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    Upload Fonte (.ttf)
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {/* Botão Seletor de Fonte */}
                <button
                  type="button"
                  onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                  className="w-full px-3.5 py-2.5 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] hover:border-slate-600 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex flex-col truncate pr-2">
                    <span
                      className="text-sm font-bold text-[var(--workbench-text)] truncate"
                      style={{ fontFamily: config.fontFamily }}
                    >
                      {config.customFontName || config.fontFamily}
                    </span>
                    <span className="text-[10px] text-[var(--on-surface-variant)] truncate">
                      {config.customFontName
                        ? 'Fonte Personalizada Carregada'
                        : FONT_CATALOG.find((f) => f.id === config.fontFamily)?.description ||
                          'Fonte Selecionada'}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)] shrink-0" />
                </button>

                {/* Menu Suspenso de Fontes com Busca e Filtros */}
                {isFontDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-2.5 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-2xl shadow-2xl z-30 space-y-2 max-h-80 overflow-y-auto">
                    <input
                      type="text"
                      placeholder="Buscar fonte..."
                      value={fontSearch}
                      onChange={(e) => setFontSearch(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[var(--surface-container-high)] rounded-lg text-xs text-[var(--workbench-text)] placeholder-slate-500 focus:outline-none focus:border-[#632CE5]"
                    />

                    {/* Filtro por Categoria */}
                    <div className="flex gap-1 overflow-x-auto pb-1 text-[10px]">
                      {[
                        { id: 'all', label: 'Todas (50+)' },
                        { id: 'geom', label: 'Geométrica' },
                        { id: 'bold', label: 'Destaque 3D' },
                        { id: 'condensed', label: 'Condensada' },
                        { id: 'fun', label: 'Divertida' },
                        { id: 'script', label: 'Script' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setFontCategoryFilter(cat.id)}
                          className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
                            fontCategoryFilter === cat.id
                              ? 'bg-[#632CE5] text-[var(--workbench-text)] font-bold'
                              : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)]'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      {filteredFonts.map((font) => {
                        const isSelected = config.fontFamily === font.id;
                        return (
                          <button
                            key={font.id}
                            type="button"
                            onClick={() => {
                              onChange({
                                ...config,
                                fontFamily: font.id,
                                customFontName: undefined,
                              });
                              setIsFontDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-[#632CE5]/30 border border-[#632CE5] text-[var(--workbench-text)]'
                                : 'hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]'
                            }`}
                          >
                            <div>
                              <div
                                className="text-sm font-semibold"
                                style={{ fontFamily: font.id }}
                              >
                                {font.name}
                              </div>
                              <div className="text-[10px] text-[var(--on-surface-variant)]">
                                {font.description}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#632CE5] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Tamanho da Letra (mm) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="slider-letter-height" className="text-xs font-semibold text-[var(--workbench-text)]">
                    Tamanho da Letra (mm)
                  </label>
                  <span className="text-xs font-mono font-bold text-[#632CE5]">
                    {config.letterHeight} mm
                  </span>
                </div>
                <p className="text-[11px] text-[var(--on-surface-variant)] mb-2">
                  Altura principal da letra em milímetros
                </p>
                <div className="flex items-center gap-3">
                  <input
                    id="slider-letter-height"
                    type="range"
                    min="20"
                    max="140"
                    step="1"
                    value={config.letterHeight}
                    onChange={(e) => onChange({ ...config, letterHeight: Number(e.target.value) })}
                    className="flex-1 h-2 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <input
                    type="number"
                    min="20"
                    max="140"
                    value={config.letterHeight}
                    onChange={(e) => onChange({ ...config, letterHeight: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-lg text-xs font-mono text-center text-[var(--workbench-text)] focus:outline-none focus:border-[#632CE5]"
                  />
                </div>
              </div>

              {/* Profundidade da Caixa (Eixo Z) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="slider-back-depth" className="text-xs font-semibold text-[var(--workbench-text)]">
                    Profundidade da Caixa (Eixo Z)
                  </label>
                  <span className="text-xs font-mono font-bold text-[#632CE5]">
                    {config.backDepth} mm
                  </span>
                </div>
                <p className="text-[11px] text-[var(--on-surface-variant)] mb-2">
                  Espessura da camada traseira (volume 3D)
                </p>
                <div className="flex items-center gap-3">
                  <input
                    id="slider-back-depth"
                    type="range"
                    min="6"
                    max="50"
                    step="1"
                    value={config.backDepth}
                    onChange={(e) => onChange({ ...config, backDepth: Number(e.target.value) })}
                    className="flex-1 h-2 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <input
                    type="number"
                    min="6"
                    max="50"
                    value={config.backDepth}
                    onChange={(e) => onChange({ ...config, backDepth: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-lg text-xs font-mono text-center text-[var(--workbench-text)] focus:outline-none focus:border-[#632CE5]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 2: AJUSTES FINOS & ESPAÇAMENTO */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-[var(--surface-container-high)] bg-white/40 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('fineTune')}
            className="w-full p-3.5 flex items-center justify-between bg-[var(--workbench-panel)]/60 hover:bg-[var(--surface-container-high)] text-left transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold text-[var(--workbench-text)] uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#632CE5]" />
              Ajustes Finos & Espaçamento
            </span>
            {openSection.fineTune ? (
              <ChevronUp className="w-4 h-4 text-[var(--on-surface-variant)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)]" />
            )}
          </button>

          {openSection.fineTune && (
            <div className="p-4 space-y-4 border-t border-[var(--surface-container-high)]/80">
              {/* Espaçamento entre Letras */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="slider-letter-spacing" className="text-xs font-semibold text-[var(--workbench-text)]">
                    Espaçamento entre Letras
                  </label>
                  <span className="text-xs font-mono font-bold text-[var(--on-surface-variant)]">
                    {config.letterSpacing} mm
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="slider-letter-spacing"
                    type="range"
                    min="-1"
                    max="10"
                    step="0.5"
                    value={config.letterSpacing}
                    onChange={(e) => onChange({ ...config, letterSpacing: Number(e.target.value) })}
                    className="flex-1 h-2 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={config.letterSpacing}
                    onChange={(e) => onChange({ ...config, letterSpacing: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-lg text-xs font-mono text-center text-[var(--workbench-text)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Contorno Traseiro (Borda Externa) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="slider-back-contour" className="text-xs font-semibold text-[var(--workbench-text)]">
                    Contorno Traseiro (Borda Externa)
                  </label>
                  <span className="text-xs font-mono font-bold text-[#632CE5]">
                    {config.backContour} mm
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="slider-back-contour"
                    type="range"
                    min="4"
                    max="22"
                    step="0.5"
                    value={config.backContour}
                    onChange={(e) => onChange({ ...config, backContour: Number(e.target.value) })}
                    className="flex-1 h-2 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={config.backContour}
                    onChange={(e) => onChange({ ...config, backContour: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-lg text-xs font-mono text-center text-[var(--workbench-text)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Contorno Intermediário */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="slider-mid-contour" className="text-xs font-semibold text-[var(--workbench-text)]">
                    Contorno Intermediário
                  </label>
                  <span className="text-xs font-mono font-bold text-pink-400">
                    {config.midContour} mm
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="slider-mid-contour"
                    type="range"
                    min="1.5"
                    max="10"
                    step="0.5"
                    value={config.midContour}
                    onChange={(e) => onChange({ ...config, midContour: Number(e.target.value) })}
                    className="flex-1 h-2 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={config.midContour}
                    onChange={(e) => onChange({ ...config, midContour: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-lg text-xs font-mono text-center text-[var(--workbench-text)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Espessura Frontal */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="slider-front-thickness" className="text-xs font-semibold text-[var(--workbench-text)]">
                    Espessura Frontal
                  </label>
                  <span className="text-xs font-mono font-bold text-[var(--workbench-text)]">
                    {config.frontThickness} mm
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="slider-front-thickness"
                    type="range"
                    min="1.0"
                    max="8.0"
                    step="0.2"
                    value={config.frontThickness}
                    onChange={(e) => onChange({ ...config, frontThickness: Number(e.target.value) })}
                    className="flex-1 h-2 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <input
                    type="number"
                    step="0.2"
                    value={config.frontThickness}
                    onChange={(e) => onChange({ ...config, frontThickness: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-lg text-xs font-mono text-center text-[var(--workbench-text)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Espessura Média */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="slider-mid-thickness" className="text-xs font-semibold text-[var(--workbench-text)]">
                    Espessura Média
                  </label>
                  <span className="text-xs font-mono font-bold text-purple-300">
                    {config.midThickness} mm
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="slider-mid-thickness"
                    type="range"
                    min="1.0"
                    max="8.0"
                    step="0.2"
                    value={config.midThickness}
                    onChange={(e) => onChange({ ...config, midThickness: Number(e.target.value) })}
                    className="flex-1 h-2 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <input
                    type="number"
                    step="0.2"
                    value={config.midThickness}
                    onChange={(e) => onChange({ ...config, midThickness: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-lg text-xs font-mono text-center text-[var(--workbench-text)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 3: BASE DE APOIO (FICAR EM PÉ) */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-[var(--surface-container-high)] bg-white/40 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('base')}
            className="w-full p-3.5 flex items-center justify-between bg-[var(--workbench-panel)]/60 hover:bg-[var(--surface-container-high)] text-left transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold text-[var(--workbench-text)] uppercase tracking-wider flex items-center gap-2">
              <Box className="w-4 h-4 text-[#632CE5]" />
              Base de Apoio (Ficar em Pé)
            </span>
            {openSection.base ? (
              <ChevronUp className="w-4 h-4 text-[var(--on-surface-variant)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)]" />
            )}
          </button>

          {openSection.base && (
            <div className="p-4 space-y-3 border-t border-[var(--surface-container-high)]/80">
              <label className="flex items-start gap-3 p-3 rounded-xl bg-[var(--workbench-panel)]/80 border border-[var(--surface-container-high)] hover:border-[var(--surface-container-high)] transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.flatBase}
                  onChange={(e) => onChange({ ...config, flatBase: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-[var(--surface-container-high)] bg-[var(--surface-container-high)] text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
                <div className="flex-1">
                  <div className="text-xs font-bold text-[var(--workbench-text)]">
                    Ativar Base Reta de Apoio
                  </div>
                  <p className="text-[11px] text-[var(--on-surface-variant)] mt-0.5 leading-relaxed">
                    Permite que a letra fique em pé em mesas e prateleiras com estabilidade perfeita
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 4: CORES DAS 3 CAMADAS */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-[var(--surface-container-high)] bg-white/40 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('colors')}
            className="w-full p-3.5 flex items-center justify-between bg-[var(--workbench-panel)]/60 hover:bg-[var(--surface-container-high)] text-left transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold text-[var(--workbench-text)] uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#632CE5]" />
              Cores das 3 Camadas
            </span>
            {openSection.colors ? (
              <ChevronUp className="w-4 h-4 text-[var(--on-surface-variant)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)]" />
            )}
          </button>

          {openSection.colors && (
            <div className="p-4 space-y-4 border-t border-[var(--surface-container-high)]/80">
              {/* 1. Camada Traseira (Caixa) */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--workbench-panel)] border border-[var(--surface-container-high)]">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-6 h-6 rounded-lg border border-white/20 shadow-inner"
                    style={{ backgroundColor: config.backColor }}
                  />
                  <div>
                    <div className="text-xs font-semibold text-[var(--workbench-text)]">
                      1. Camada Traseira (Caixa)
                    </div>
                    <div className="text-[10px] text-[var(--on-surface-variant)] font-mono">
                      {config.backColor}
                    </div>
                  </div>
                </div>
                <input
                  type="color"
                  value={config.backColor}
                  onChange={(e) => onChange({ ...config, backColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
              </div>

              {/* 2. Camada Intermediária */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--workbench-panel)] border border-[var(--surface-container-high)]">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-6 h-6 rounded-lg border border-white/20 shadow-inner"
                    style={{ backgroundColor: config.midColor }}
                  />
                  <div>
                    <div className="text-xs font-semibold text-[var(--workbench-text)]">
                      2. Camada Intermediária
                    </div>
                    <div className="text-[10px] text-[var(--on-surface-variant)] font-mono">
                      {config.midColor}
                    </div>
                  </div>
                </div>
                <input
                  type="color"
                  value={config.midColor}
                  onChange={(e) => onChange({ ...config, midColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
              </div>

              {/* 3. Texto Frontal */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--workbench-panel)] border border-[var(--surface-container-high)]">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-6 h-6 rounded-lg border border-white/20 shadow-inner"
                    style={{ backgroundColor: config.frontColor }}
                  />
                  <div>
                    <div className="text-xs font-semibold text-[var(--workbench-text)]">
                      3. Texto Frontal
                    </div>
                    <div className="text-[10px] text-[var(--on-surface-variant)] font-mono">
                      {config.frontColor}
                    </div>
                  </div>
                </div>
                <input
                  type="color"
                  value={config.frontColor}
                  onChange={(e) => onChange({ ...config, frontColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
              </div>

              {/* Paletas Recomendadas */}
              <div className="pt-2">
                <div className="text-xs font-semibold text-[var(--on-surface-variant)] mb-2">
                  Paletas Recomendadas:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {COLOR_PALETTES.map((pal) => (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...config,
                          backColor: pal.backColor,
                          midColor: pal.midColor,
                          frontColor: pal.frontColor,
                        })
                      }
                      className="p-2 rounded-xl bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-high)] border border-[var(--surface-container-high)] hover:border-[var(--surface-container-high)] flex items-center justify-between transition-all group"
                    >
                      <span className="text-xs font-medium text-[var(--on-surface-variant)] group-hover:text-[var(--workbench-text)]">
                        {pal.name}
                      </span>
                      <div className="flex -space-x-1.5">
                        <div
                          className="w-4 h-4 rounded-full border border-slate-900 shadow-sm"
                          style={{ backgroundColor: pal.backColor }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border border-slate-900 shadow-sm"
                          style={{ backgroundColor: pal.midColor }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border border-slate-900 shadow-sm"
                          style={{ backgroundColor: pal.frontColor }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé Fixo com Dimensões 3D & Botão Principal "Baixar 3MF" */}
      <div className="p-4 bg-white border-t border-[var(--surface-container-high)] space-y-3">
        {/* Dimensões em Linha */}
        <div className="flex items-center justify-between text-xs px-1 text-[var(--on-surface-variant)]">
          <span className="font-semibold text-[var(--on-surface-variant)]">Dimensões 3D:</span>
          <span className="font-mono text-purple-300 font-bold">
            X {dimensions.dimX} Y {dimensions.dimY} Z {dimensions.dimZ} mm
          </span>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2">
          <button
            id="btn-main-download-3mf"
            type="button"
            onClick={onQuickDownload3MF}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-[var(--workbench-text)] text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Baixar 3MF</span>
          </button>

          <button
            type="button"
            onClick={onOpenExportModal}
            title="Mais Opções de Exportação (STL, ZIP, Dicas de Impressão)"
            className="py-3 px-3.5 rounded-xl bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] transition-colors"
          >
            <Box className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
