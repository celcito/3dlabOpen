import React, { useState, useRef } from 'react';
import type { LetterBoxConfig, Model3DDimensions } from '../types/letterBox';
import { FONT_CATALOG, COLOR_PALETTES, DEFAULT_CONFIG } from '../lib/letterBox/presets';
import { clearSavedConfig } from '../lib/letterBox/storage';
import { Type, Sliders, Palette, Upload, ChevronDown, Download, RotateCcw, Box } from 'lucide-react';

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
  const [fontSearch, setFontSearch] = useState('');
  const [fontCategoryFilter, setFontCategoryFilter] = useState<string>('all');
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <aside className="w-full md:w-[400px] h-full bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] overflow-y-auto p-6 space-y-8 scrollbar-hide shrink-0 select-none">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
              <Type className="w-6 h-6 text-[#632CE5]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">
              Letra Caixa 3D
            </h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            Placas 3D em 3 camadas multicor.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            clearSavedConfig();
            onChange(DEFAULT_CONFIG);
          }}
          title="Restaurar Parâmetros Padrão de Fábrica"
          className="p-2 rounded-lg border border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/50 hover:text-[#632CE5] transition-colors cursor-pointer shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* 01. Parâmetros Principais */}
      <section className="space-y-4">
        <SectionTitle icon={<Type className="w-3.5 h-3.5 text-[#632CE5]" />}>
          01. Parâmetros Principais
        </SectionTitle>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="input-text" className="text-[9px] uppercase font-bold text-zinc-600">
              Texto do Nome
            </label>
            <span className="text-[10px] font-mono text-[#632CE5]">1 por linha</span>
          </div>
          <textarea
            id="input-text"
            rows={2}
            value={config.text}
            onChange={(e) => onChange({ ...config, text: e.target.value })}
            placeholder="Ex: M2CR ou Nomes"
            className="w-full px-3 py-2 bg-white border border-[var(--surface-container-high)] rounded text-[10px] font-bold text-[var(--workbench-text)] focus:outline-none focus:border-[#632CE5] transition-colors resize-none uppercase"
          />
        </div>

        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[9px] uppercase font-bold text-zinc-600">Família da Fonte</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[9px] font-black uppercase tracking-wide text-[#632CE5] hover:text-purple-400 flex items-center gap-1 transition-colors"
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

          <button
            type="button"
            onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
            className="w-full px-3 py-2.5 bg-white border border-[var(--surface-container-high)] hover:border-[#632CE5]/40 rounded flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex flex-col truncate pr-2">
              <span
                className="text-[11px] font-bold text-[var(--workbench-text)] truncate"
                style={{ fontFamily: config.fontFamily }}
              >
                {config.customFontName || config.fontFamily}
              </span>
              <span className="text-[9px] uppercase font-bold text-zinc-600 truncate">
                {config.customFontName
                  ? 'Fonte Personalizada Carregada'
                  : FONT_CATALOG.find((f) => f.id === config.fontFamily)?.description ||
                    'Fonte Selecionada'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)] shrink-0" />
          </button>

          {isFontDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 p-2.5 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-xl shadow-2xl z-30 space-y-2 max-h-80 overflow-y-auto">
              <input
                type="text"
                placeholder="Buscar fonte..."
                value={fontSearch}
                onChange={(e) => setFontSearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-[var(--surface-container-high)] rounded text-[10px] text-[var(--workbench-text)] placeholder-slate-500 focus:outline-none focus:border-[#632CE5]"
              />

              <div className="flex gap-1 overflow-x-auto pb-1">
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
                    className={`px-2 py-0.5 rounded whitespace-nowrap transition-all text-[9px] font-black uppercase tracking-wide ${
                      fontCategoryFilter === cat.id
                        ? 'border border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                        : 'border border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
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
                      className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'border border-[#632CE5] bg-[#632CE5]/10 text-[var(--workbench-text)]'
                          : 'border border-transparent hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]'
                      }`}
                    >
                      <div>
                        <div className="text-[11px] font-semibold" style={{ fontFamily: font.id }}>
                          {font.name}
                        </div>
                        <div className="text-[10px] text-[var(--on-surface-variant)]">
                          {font.description}
                        </div>
                      </div>
                      {isSelected && <Type className="w-3.5 h-3.5 text-[#632CE5] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <RangeControl
          label="Tamanho da Letra"
          unit="mm"
          min="20"
          max="140"
          step="1"
          number={config.letterHeight}
          onChange={(value) => onChange({ ...config, letterHeight: value })}
        />

        <RangeControl
          label="Profundidade da Caixa"
          unit="mm"
          min="6"
          max="50"
          step="1"
          number={config.backDepth}
          onChange={(value) => onChange({ ...config, backDepth: value })}
        />
      </section>

      {/* 02. Ajustes Finos & Espaçamento */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Sliders className="w-3.5 h-3.5 text-[#632CE5]" />}>
          02. Ajustes Finos & Espaçamento
        </SectionTitle>

        <RangeControl
          label="Espaçamento entre Letras"
          unit="mm"
          min="-1"
          max="10"
          step="0.5"
          number={config.letterSpacing}
          onChange={(value) => onChange({ ...config, letterSpacing: value })}
        />

        <RangeControl
          label="Contorno Traseiro (Borda Externa)"
          unit="mm"
          min="4"
          max="22"
          step="0.5"
          number={config.backContour}
          onChange={(value) => onChange({ ...config, backContour: value })}
        />

        <RangeControl
          label="Contorno Intermediário"
          unit="mm"
          min="1.5"
          max="10"
          step="0.5"
          number={config.midContour}
          onChange={(value) => onChange({ ...config, midContour: value })}
        />

        <RangeControl
          label="Espessura Frontal"
          unit="mm"
          min="1.0"
          max="8.0"
          step="0.2"
          number={config.frontThickness}
          onChange={(value) => onChange({ ...config, frontThickness: value })}
        />

        <RangeControl
          label="Espessura Média"
          unit="mm"
          min="1.0"
          max="8.0"
          step="0.2"
          number={config.midThickness}
          onChange={(value) => onChange({ ...config, midThickness: value })}
        />
      </section>

      {/* 03. Base de Apoio */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Box className="w-3.5 h-3.5 text-[#632CE5]" />}>
          03. Base de Apoio (Ficar em Pé)
        </SectionTitle>

        <label className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)] transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={config.flatBase}
            onChange={(e) => onChange({ ...config, flatBase: e.target.checked })}
            className="mt-0.5 w-4 h-4 accent-[#632CE5]"
          />
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase text-[var(--workbench-text)]">
              Ativar Base Reta de Apoio
            </div>
            <p className="text-[10px] text-[var(--on-surface-variant)] mt-0.5 leading-relaxed">
              Permite que a letra fique em pé em mesas e prateleiras com estabilidade perfeita
            </p>
          </div>
        </label>
      </section>

      {/* 04. Cores das 3 Camadas */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Palette className="w-3.5 h-3.5 text-[#632CE5]" />}>
          04. Cores das 3 Camadas
        </SectionTitle>

        <div className="grid grid-cols-3 gap-2">
          <ColorField
            label="1. Traseira"
            value={config.backColor}
            onChange={(color) => onChange({ ...config, backColor: color })}
          />
          <ColorField
            label="2. Intermediária"
            value={config.midColor}
            onChange={(color) => onChange({ ...config, midColor: color })}
          />
          <ColorField
            label="3. Texto"
            value={config.frontColor}
            onChange={(color) => onChange({ ...config, frontColor: color })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[9px] uppercase font-bold text-zinc-600 block">
            Paletas Recomendadas
          </label>
          <div className="grid grid-cols-2 gap-2">
            {COLOR_PALETTES.map((pal) => {
              const isSelected =
                config.backColor.toLowerCase() === pal.backColor.toLowerCase() &&
                config.midColor.toLowerCase() === pal.midColor.toLowerCase() &&
                config.frontColor.toLowerCase() === pal.frontColor.toLowerCase();

              return (
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
                  className={`p-2 rounded-lg border flex items-center justify-between transition-all ${
                    isSelected
                      ? 'border-[#632CE5] bg-[#632CE5]/10'
                      : 'border-[var(--workbench-line)] hover:border-[#632CE5]/40'
                  }`}
                >
                  <span className="text-[9px] font-black uppercase text-[var(--on-surface-variant)] truncate">
                    {pal.name}
                  </span>
                  <div className="flex -space-x-1.5 shrink-0">
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: pal.backColor }}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: pal.midColor }}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: pal.frontColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dimensões & Exportação */}
      <section className="space-y-3 pt-4 border-t border-[var(--surface-container-high)]">
        <div className="p-3 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)] flex items-center justify-between">
          <span className="text-[9px] uppercase font-bold text-zinc-600">Dimensões 3D</span>
          <span className="text-[14px] font-black text-[#632CE5] tracking-tighter font-mono">
            {dimensions.dimX} <span className="text-[10px] text-zinc-600 font-bold">×</span>{' '}
            {dimensions.dimY} <span className="text-[10px] text-zinc-600 font-bold">×</span>{' '}
            {dimensions.dimZ} <span className="text-[10px] text-zinc-600 font-bold">mm</span>
          </span>
        </div>

        <button id="btn-main-download-3mf" type="button" onClick={onQuickDownload3MF} className="btn-primary">
          <Download className="w-4 h-4" />
          Baixar 3MF (Multicolor)
        </button>

        <button
          type="button"
          onClick={onOpenExportModal}
          title="Mais Opções de Exportação (STL, ZIP, Dicas de Impressão)"
          className="w-full py-3 rounded-lg border border-[var(--workbench-line)] text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-variant)] hover:border-[#632CE5]/50 hover:text-[#632CE5] flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Box className="w-4 h-4" />
          Mais Opções de Exportação (STL)
        </button>
      </section>
    </aside>
  );
};

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
      {icon}
      {children}
    </h3>
  );
}

function RangeControl({
  label,
  unit,
  min,
  max,
  step,
  number,
  onChange,
}: {
  label: string;
  unit: string;
  min: string;
  max: string;
  step: string;
  number: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-3">
        <label className="text-[9px] uppercase font-bold text-zinc-600">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={number}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-16 px-2 py-1 bg-white border border-[var(--surface-container-high)] rounded text-[10px] font-mono text-right text-[#632CE5] focus:outline-none focus:border-[#632CE5] transition-colors"
          />
          <span className="text-[10px] font-mono text-[#632CE5]">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={number}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#632CE5] h-1.5 bg-[var(--workbench-viewport)] rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="p-2 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)] flex flex-col gap-1.5 items-center">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
      />
      <span className="text-[9px] uppercase font-bold text-zinc-600 text-center leading-tight">
        {label}
      </span>
      <span className="text-[9px] font-mono font-bold text-[#632CE5] uppercase">{value}</span>
    </div>
  );
}
