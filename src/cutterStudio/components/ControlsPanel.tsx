import React, { useState } from 'react';
import { ModelSettings, FilamentColor, PrintEstimation, ModelLineart } from '../types';
import { PREDEFINED_TEXT_SHAPES } from '../data/textShapes';
import { PRESET_MODELS } from '../data/presets';
import {
  Sliders,
  Scissors,
  Stamp,
  Palette,
  Maximize2,
  Lock,
  Unlock,
  Wind,
  Layers,
  Clock,
  Scale,
  Undo2,
  Type,
  Trash2,
  FlipHorizontal,
  HelpCircle,
  PenTool,
  Sparkles,
  Box,
  Upload,
  LayoutGrid,
} from 'lucide-react';

/**
 * Contextual Tooltip component for 3D printing beginner guidance
 */
const ParamTooltip: React.FC<{ text: string; technical?: string }> = ({ text, technical }) => {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex items-center ml-1"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <button
        type="button"
        className="text-[var(--on-surface-variant)] hover:text-[var(--primary)] focus:outline-none focus:text-[var(--primary)] transition-colors cursor-help p-0.5 rounded"
        aria-label="Informação técnica"
        onClick={(e) => {
          e.preventDefault();
          setShow((prev) => !prev);
        }}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {show && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-60 sm:w-64 p-2.5 bg-[var(--workbench-panel)] border border-[var(--surface-container-highest)] rounded-lg shadow-2xl text-[11px] text-[var(--on-surface)] leading-relaxed pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <p className="font-normal text-[var(--on-surface-variant)]">{text}</p>
          {technical && (
            <div className="mt-1.5 pt-1.5 border-t border-[var(--surface-container-high)] text-[10px] text-[var(--primary)] font-mono">
              💡 Dica 3D: {technical}
            </div>
          )}
          <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 w-2 h-2 bg-[var(--workbench-panel)] border-r border-b border-[var(--surface-container-highest)] rotate-45" />
        </div>
      )}
    </div>
  );
};

interface ControlsPanelProps {
  settings: ModelSettings;
  onUpdateSettings: (newSettings: Partial<ModelSettings>) => void;
  filamentList: FilamentColor[];
  estimation: PrintEstimation;
  onUndo?: () => void;
  canUndo?: boolean;
  undoCount?: number;
  onSelectBaseShape?: (model: ModelLineart) => void;
  activeModelId?: string;
  onOpenCreator?: () => void;
  onOpenGoogleShape?: () => void;
  onOpenTextModal?: () => void;
  onOpenMoldStudio?: () => void;
  onUploadSTLForMold?: (file: File) => void;
  onOpenPrintBed?: () => void;
  onOpenLibrary?: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  settings,
  onUpdateSettings,
  filamentList,
  estimation,
  onUndo,
  canUndo = false,
  undoCount = 0,
  onSelectBaseShape,
  activeModelId,
  onOpenCreator,
  onOpenGoogleShape,
  onOpenTextModal,
  onOpenMoldStudio,
  onUploadSTLForMold,
  onOpenPrintBed,
  onOpenLibrary,
}) => {
  const [activeTab, setActiveTab] = useState<'dimensions' | 'cutter' | 'stamp' | 'text' | 'filament'>('dimensions');

  // Handle proportional dimension resize
  const handleWidthChange = (newWidth: number) => {
    if (settings.lockAspectRatio) {
      const ratio = settings.targetHeight / settings.targetWidth;
      onUpdateSettings({
        targetWidth: newWidth,
        targetHeight: Math.round(newWidth * ratio),
      });
    } else {
      onUpdateSettings({ targetWidth: newWidth });
    }
  };

  const handleHeightChange = (newHeight: number) => {
    if (settings.lockAspectRatio) {
      const ratio = settings.targetWidth / settings.targetHeight;
      onUpdateSettings({
        targetHeight: newHeight,
        targetWidth: Math.round(newHeight * ratio),
      });
    } else {
      onUpdateSettings({ targetHeight: newHeight });
    }
  };

  return (
    <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[var(--surface-container-high)] bg-[var(--workbench-panel)] flex flex-col shrink-0 select-none overflow-hidden h-full">
      {/* Top Header: Title and Undo Button */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--surface-container-high)] bg-[var(--workbench-page)] shrink-0">
        <span className="text-xs font-semibold text-[var(--on-surface)]">Parâmetros 3D</span>
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              canUndo
                ? 'bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--primary)] hover:text-[var(--primary)] border border-[var(--surface-container-highest)] shadow-sm cursor-pointer'
                : 'text-[var(--workbench-muted)] border border-[var(--surface-container-high)] opacity-40 cursor-not-allowed'
            }`}
            title={
              canUndo
                ? `Desfazer última alteração (${undoCount}/5 no histórico) · Atalho: Ctrl+Z`
                : 'Nenhuma alteração para desfazer'
            }
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Desfazer</span>
            {canUndo && undoCount > 0 && (
              <span className="text-[10px] font-mono text-[var(--primary)]">({undoCount}/5)</span>
            )}
          </button>
        )}
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-[var(--surface-container-high)] bg-[var(--workbench-page)] p-1.5 gap-1 shrink-0 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('dimensions')}
          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'dimensions'
              ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm'
              : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
          }`}
          title="Dimensões (mm)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Tamanho</span>
        </button>

        <button
          onClick={() => setActiveTab('cutter')}
          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'cutter'
              ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm'
              : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
          }`}
          title="Ajustes da lâmina do cortador"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Cortador</span>
        </button>

        <button
          onClick={() => setActiveTab('stamp')}
          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'stamp'
              ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm'
              : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
          }`}
          title="Ajustes do carimbo e puxador"
        >
          <Stamp className="w-3.5 h-3.5" />
          <span>Carimbo</span>
        </button>

        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 relative ${
            activeTab === 'text'
              ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm'
              : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
          }`}
          title="Adicionar ou editar texto gravado no carimbo"
        >
          <Type className="w-3.5 h-3.5" />
          <span>Texto</span>
          {settings.customText && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)] absolute top-1 right-1" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('filament')}
          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'filament'
              ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm'
              : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
          }`}
          title="Configurações técnicas de fatiamento (infill), mesa e filamento"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Técnico & Cor</span>
        </button>
      </div>

      {/* Tab Panels Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Modelos prontos */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
              Modelos prontos
            </span>
            {onOpenLibrary && (
              <button
                onClick={onOpenLibrary}
                className="font-mono text-[10px] text-[var(--primary)] transition-colors hover:text-[var(--primary-container)]"
              >
                Ver todos ({PRESET_MODELS.length}) →
              </button>
            )}
          </div>
          <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-[var(--surface-container-high)] p-1 scrollbar-none">
            {PRESET_MODELS.slice(0, 8).map((preset) => {
              const isActive = activeModelId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => onSelectBaseShape?.(preset)}
                  aria-pressed={isActive}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left font-mono text-[11px] tracking-[0.02em] transition-colors ${
                    isActive
                      ? 'bg-[var(--primary-fixed)] text-[var(--primary)]'
                      : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)]'
                  }`}
                >
                  <span className="truncate">{preset.name}</span>
                  {isActive && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: DIMENSIONS */}
        {activeTab === 'dimensions' && (
          <div className="space-y-4">
            {/* Quick Custom Shape Creation Callout */}
            <div className="p-3 bg-gradient-to-r from-[var(--primary)]/10 via-[var(--primary-fixed)] to-[var(--primary-fixed)] border border-[var(--primary)] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--on-surface)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Crie com Sua Própria Imagem ou Desenho</span>
                </span>
              </div>
              <p className="text-[11px] text-[var(--on-surface-variant)] leading-snug">
                Você não precisa usar apenas os modelos prontos! Envie qualquer foto da internet, faça um desenho à mão ou gere uma silhueta com IA:
              </p>
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                {onOpenCreator && (
                  <button
                    onClick={onOpenCreator}
                    className="p-2 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] hover:border-[var(--primary)] rounded-lg text-left transition-colors flex items-center gap-1.5 cursor-pointer text-xs text-[var(--primary)]"
                    title="Importar imagem (PNG, JPG, SVG) ou desenhar à mão livre"
                  >
                    <PenTool className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                    <span className="font-semibold text-[11px]">Enviar Imagem / Desenhar</span>
                  </button>
                )}
                {onOpenGoogleShape && (
                  <button
                    onClick={onOpenGoogleShape}
                    className="p-2 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] hover:border-[var(--primary)] rounded-lg text-left transition-colors flex items-center gap-1.5 cursor-pointer text-xs text-[var(--primary)]"
                    title="Gerar silhuetas vetoriais de qualquer tema"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                    <span className="font-semibold text-[11px]">Buscar Silhuetas com IA</span>
                  </button>
                )}
              </div>

              {onOpenMoldStudio && (
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <button
                    onClick={onOpenMoldStudio}
                    className="p-2 bg-[var(--primary-fixed)] hover:bg-[var(--primary-fixed)] border border-[var(--primary)] rounded-lg text-left transition-all flex items-center justify-between cursor-pointer text-xs text-[var(--primary)] shadow-xs"
                    title="Abrir o Criador de Moldes 3D para gerar molde a partir de modelo 3D"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Box className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                      <span className="font-semibold text-[11px] truncate">Moldes 3D</span>
                    </div>
                    <span className="text-[10px] text-[var(--primary)] font-mono">Abrir →</span>
                  </button>

                  {onUploadSTLForMold && (
                    <label
                      className="p-2 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] hover:border-[var(--primary)] rounded-lg text-left transition-all flex items-center justify-between cursor-pointer text-xs text-[var(--on-surface)] shadow-xs"
                      title="Enviar arquivo STL do computador diretamente para o gerador de moldes"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Upload className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                        <span className="font-semibold text-[11px] truncate">Enviar STL</span>
                      </div>
                      <span className="text-[10px] text-[var(--primary)] font-mono font-bold">+</span>
                      <input
                        type="file"
                        accept=".stl,.obj"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            onUploadSTLForMold(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {onOpenPrintBed && (
                <div className="mt-1.5 pt-1.5 border-t border-[var(--surface-container-high)]">
                  <button
                    onClick={onOpenPrintBed}
                    className="w-full p-2 bg-[var(--primary-fixed)] hover:bg-[var(--primary-fixed)] border border-[var(--primary)] hover:border-[var(--primary)] rounded-lg text-left transition-all flex items-center justify-between cursor-pointer text-xs text-[var(--primary)] shadow-xs"
                    title="Organizar múltiplos cortadores na mesa virtual 3D com nesting automático"
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                      <div>
                        <span className="font-semibold text-[11px] block text-[var(--primary)] leading-tight">
                          Layout de Impressão (Nesting de Mesa)
                        </span>
                        <span className="text-[10px] text-[var(--on-surface-variant)] block leading-tight">
                          Encaixe automático de múltiplos cortadores na mesma mesa
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--primary)] bg-[var(--primary-fixed)] px-1.5 py-0.5 rounded border border-[var(--primary)]">
                      Abrir 3D →
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Standard Cookie Size Presets (Quick Buttons) */}
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-2">
                <span className="font-semibold text-[var(--on-surface)]">Tamanhos Padrão de Biscoito:</span>
                <span className="text-[11px] text-[var(--on-surface-variant)]">Largura × Altura</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: 'Mini / Docinho', size: 50, desc: '50 × 50 mm' },
                  { label: 'Padrão / Médio', size: 75, desc: '75 × 75 mm' },
                  { label: 'Grande / Cookie', size: 100, desc: '100 × 100 mm' },
                ].map((preset) => {
                  const isActive = settings.targetWidth === preset.size && settings.targetHeight === preset.size;
                  return (
                    <button
                      key={preset.size}
                      onClick={() => {
                        onUpdateSettings({
                          targetWidth: preset.size,
                          targetHeight: preset.size,
                        });
                      }}
                      className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                        isActive
                          ? 'bg-[var(--primary-fixed)] border-[var(--primary)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)] font-semibold'
                          : 'bg-[var(--workbench-page)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:border-[var(--surface-container-highest)] hover:bg-[var(--workbench-panel)]'
                      }`}
                    >
                      <div className="font-bold text-sm tracking-tight text-[var(--primary)]">{preset.size} mm</div>
                      <div className="text-[10px] text-[var(--on-surface-variant)] truncate w-full">{preset.label}</div>
                      <div className="text-[9px] text-[var(--workbench-muted)] font-mono">{preset.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Quick secondary sizes chips */}
              <div className="flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-none py-0.5">
                <span className="text-[10px] text-[var(--on-surface-variant)] shrink-0">Mais medidas:</span>
                {[45, 60, 85, 110, 120].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onUpdateSettings({
                        targetWidth: s,
                        targetHeight: s,
                      });
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors shrink-0 cursor-pointer ${
                      settings.targetWidth === s && settings.targetHeight === s
                        ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold border-[var(--primary)]'
                        : 'bg-[var(--workbench-page)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:border-[var(--surface-container-highest)]'
                    }`}
                  >
                    {s}mm
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--surface-container-high)]">
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Largura Customizada (X)</span>
                  <ParamTooltip
                    text="Largura horizontal máxima do cortador e carimbo em milímetros."
                    technical="50mm para mini doces; 75mm para tamanho clássico de confeitaria; 100mm para cookies gourmet."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.targetWidth} mm
                </span>
              </div>
              <input
                type="range"
                min="35"
                max="130"
                step="1"
                value={settings.targetWidth}
                onChange={(e) => handleWidthChange(Number(e.target.value))}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Altura Customizada (Y)</span>
                  <ParamTooltip
                    text="Altura vertical máxima da peça em milímetros."
                    technical="Mantenha a proporção travada para preservar a curvatura exata do desenho."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.targetHeight} mm
                </span>
              </div>
              <input
                type="range"
                min="35"
                max="130"
                step="1"
                value={settings.targetHeight}
                onChange={(e) => handleHeightChange(Number(e.target.value))}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
            </div>

            {/* Lock aspect ratio */}
            <div className="flex items-center justify-between p-2.5 bg-[var(--workbench-page)] rounded-lg border border-[var(--surface-container-high)] text-xs text-[var(--on-surface-variant)]">
              <span className="flex items-center gap-2">
                {settings.lockAspectRatio ? (
                  <Lock className="w-3.5 h-3.5 text-[var(--primary)]" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-[var(--workbench-muted)]" />
                )}
                <span className="flex items-center">
                  <span>Manter Proporção (Trava 1:1)</span>
                  <ParamTooltip
                    text="Bloqueia a relação entre largura e altura para que a peça não fique achatada ou esticada."
                    technical="Ao alterar X, Y é recalculado automaticamente de forma proporcional."
                  />
                </span>
              </span>
              <button
                onClick={() =>
                  onUpdateSettings({ lockAspectRatio: !settings.lockAspectRatio })
                }
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  settings.lockAspectRatio
                    ? 'bg-[var(--primary-fixed)] text-[var(--primary)] border border-[var(--primary)] font-medium'
                    : 'bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]'
                }`}
              >
                {settings.lockAspectRatio ? 'Ativado' : 'Livre'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: CUTTER BLADE */}
        {activeTab === 'cutter' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Altura da Lâmina (Profundidade)</span>
                  <ParamTooltip
                    text="Distância vertical da ponta cortante até o topo. Define a espessura máxima de massa que o cortador corta sem encostar a base na massa."
                    technical="14 a 16 mm é a altura padrão recomendada para massas de 5-6 mm de espessura."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.bladeHeight} mm
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="24"
                step="1"
                value={settings.bladeHeight}
                onChange={(e) => onUpdateSettings({ bladeHeight: Number(e.target.value) })}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
              <span className="text-[10px] text-[var(--workbench-muted)] block mt-0.5">
                Padrão confeitaria: 15mm para massas de 5-6mm
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Espessura do Fio da Lâmina</span>
                  <ParamTooltip
                    text="Espessura da borda afiada que penetra e corta a massa. Um fio fino produz bordas nítidas sem amassar ou deformar o desenho."
                    technical="0.8 a 0.9 mm é o padrão de excelência para bicos 0.4mm (2 perímetros de extrusão sem emendas)."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.bladeEdgeThickness} mm
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.1"
                value={settings.bladeEdgeThickness}
                onChange={(e) =>
                  onUpdateSettings({ bladeEdgeThickness: Number(e.target.value) })
                }
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
              <span className="text-[10px] text-[var(--workbench-muted)] block mt-0.5">
                0.9mm corta massas e pasta americana sem quebrar
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Espessura da Base da Parede</span>
                  <ParamTooltip
                    text="Espessura da seção superior que ancora a lâmina no flange de apoio."
                    technical="1.8 a 2.0 mm evita que o cortador entorte ao aplicar força sobre massas mais densas ou geladas."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.bladeBaseThickness} mm
                </span>
              </div>
              <input
                type="range"
                min="1.4"
                max="2.6"
                step="0.1"
                value={settings.bladeBaseThickness}
                onChange={(e) =>
                  onUpdateSettings({ bladeBaseThickness: Number(e.target.value) })
                }
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Aba Superior de Apoio (Pega)</span>
                  <ParamTooltip
                    text="Borda horizontal alargada no topo do cortador onde a palma da mão ou os dedos apoiam para fazer pressão."
                    technical="5 a 7 mm distribui a carga confortavelmente e evita fadiga muscular durante cortes contínuos."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.lipWidth} mm
                </span>
              </div>
              <input
                type="range"
                min="4"
                max="8"
                step="0.5"
                value={settings.lipWidth}
                onChange={(e) => onUpdateSettings({ lipWidth: Number(e.target.value) })}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
              <span className="text-[10px] text-[var(--workbench-muted)] block mt-0.5">
                Borda larga para as mãos pressionarem sem machucar
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Espessura da Aba Superior</span>
                  <ParamTooltip
                    text="Altura vertical da aba de apoio para resistir à pressão repetida sem trincar."
                    technical="2.5 mm oferece alta rigidez com excelente aderência de camadas no fatiador."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.lipThickness} mm
                </span>
              </div>
              <input
                type="range"
                min="1.8"
                max="3.5"
                step="0.1"
                value={settings.lipThickness}
                onChange={(e) => onUpdateSettings({ lipThickness: Number(e.target.value) })}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 3: STAMP EMBOSSER */}
        {activeTab === 'stamp' && (
          <div className="space-y-4">
            {/* stampClearance - Tolerância Mecânica */}
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Folga Carimbo-Cortador (Clearance)</span>
                  <ParamTooltip
                    text="Espaço livre de segurança entre a borda externa do carimbo e a parede interna da lâmina do cortador."
                    technical="Tolerância mecânica essencial: 1.0mm a 1.2mm permite que o carimbo deslize livremente sem travar devido à dilatação natural do filamento PLA impresso."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.stampClearance} mm
                </span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.8"
                step="0.1"
                value={settings.stampClearance}
                onChange={(e) => onUpdateSettings({ stampClearance: Number(e.target.value) })}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
              <span className="text-[10px] text-[var(--workbench-muted)] block mt-0.5">
                Padrão 1.0mm: deslize suave sem prender no cortador
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Profundidade do Relevo (Gravação)</span>
                  <ParamTooltip
                    text="Altura em milímetros que as lâminas em relevo se projetam da placa base para marcar a massa."
                    technical="2.5 a 3.5 mm marca com excelente contraste visual sem furar a base do biscoito."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.stampDepth} mm
                </span>
              </div>
              <input
                type="range"
                min="2.0"
                max="5.0"
                step="0.5"
                value={settings.stampDepth}
                onChange={(e) => onUpdateSettings({ stampDepth: Number(e.target.value) })}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Espessura dos Traços Lineart</span>
                  <ParamTooltip
                    text="Largura das nervuras que formam os detalhes do desenho ou carimbo."
                    technical="1.2 a 1.5 mm garante linhas sólidas e contínuas na impressora 3D (3 passes de extrusão)."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.stampLineThickness} mm
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.2"
                step="0.1"
                value={settings.stampLineThickness}
                onChange={(e) =>
                  onUpdateSettings({ stampLineThickness: Number(e.target.value) })
                }
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Espessura da Placa Base</span>
                  <ParamTooltip
                    text="Espessura da placa plana que ancora os relevos e o puxador."
                    technical="2.5 a 3.0 mm assegura 100% de rigidez na prensagem contra a bancada sem envergar."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.stampPlateThickness} mm
                </span>
              </div>
              <input
                type="range"
                min="2.0"
                max="4.0"
                step="0.2"
                value={settings.stampPlateThickness}
                onChange={(e) =>
                  onUpdateSettings({ stampPlateThickness: Number(e.target.value) })
                }
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
            </div>

            {/* Handle Type */}
            <div>
              <div className="flex items-center mb-1.5">
                <span className="text-xs text-[var(--on-surface-variant)]">
                  Modelo do Puxador / Pegador
                </span>
                <ParamTooltip
                  text="Formato anatômico do puxador na traseira do carimbo para apoio dos dedos."
                  technical="Knob ou Argola facilitam desmoldar o biscoito puxando em linha reta para cima sem borrar a estampa."
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: 'knob', label: 'Knob Anatômico' },
                  { id: 'bar', label: 'Barra Rígida' },
                  { id: 'ring', label: 'Argola' },
                ].map((h) => (
                  <button
                    key={h.id}
                    onClick={() => onUpdateSettings({ handleType: h.id as any })}
                    className={`p-2 rounded-lg border text-center transition-colors cursor-pointer ${
                      settings.handleType === h.id
                        ? 'bg-[var(--primary-fixed)] border-[var(--primary)] text-[var(--primary)] font-semibold'
                        : 'bg-[var(--workbench-page)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Handle Height */}
            {settings.handleType !== 'none' && (
              <div>
                <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                  <span className="flex items-center">
                    <span>Altura do Puxador</span>
                    <ParamTooltip
                      text="Comprimento vertical do puxador traseiro para pegada confortável."
                      technical="20 a 24 mm é o tamanho ergonômico padrão para pinça dos dedos indicador e polegar."
                    />
                  </span>
                  <span className="font-mono text-[var(--primary)] tabular-nums">
                    {settings.handleHeight} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="30"
                  step="1"
                  value={settings.handleHeight}
                  onChange={(e) =>
                    onUpdateSettings({ handleHeight: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--primary)] cursor-pointer"
                />
              </div>
            )}

            {/* Air Release Holes (Anti-vacuum) */}
            <div className="p-3 bg-[var(--workbench-page)] rounded-lg border border-[var(--surface-container-high)] space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
                <span className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span className="flex items-center">
                    <span>Furos de Escape de Ar</span>
                    <ParamTooltip
                      text="Orifícios na placa base que permitem a entrada de ar no momento de retirar o carimbo da massa."
                      technical="Elimina o efeito de sucção (vácuo) que faz a massa mole grudar e despedaçar ao subir o carimbo."
                    />
                  </span>
                </span>
                <button
                  onClick={() =>
                    onUpdateSettings({ airReleaseHoles: !settings.airReleaseHoles })
                  }
                  className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                    settings.airReleaseHoles
                      ? 'bg-[var(--primary-fixed)] text-[var(--primary)] border border-[var(--primary)] font-medium'
                      : 'bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]'
                  }`}
                >
                  {settings.airReleaseHoles ? 'Ativo' : 'Desativado'}
                </button>
              </div>
              <p className="text-[10px] text-[var(--workbench-muted)]">
                Evita o efeito de sucção (vácuo) que faz a massa grudar no carimbo ao levantar.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: TEXT ON STAMP */}
        {activeTab === 'text' && (
          <div className="space-y-4">
            {/* PRE-DEFINED CUTTER SHAPES FOR TEXT */}
            <div className="bg-[var(--workbench-page)] p-3 rounded-xl border border-[var(--surface-container-high)]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[var(--on-surface)] flex items-center gap-1.5">
                  <Stamp className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span className="flex items-center">
                    <span>Formas Pré-definidas para Cortador</span>
                    <ParamTooltip
                      text="Escolha uma destas placas limpas (Coração, Festonado, Círculo, Retângulo, Estrela, etc.) para servir de base para o seu cortador e carimbo com texto."
                      technical="Todas as formas possuem bordas perfeitamente chanfradas e contornos fechados, garantindo modelos manifold 100% à prova de erro para fatiamento 3D."
                    />
                  </span>
                </span>
                <span className="text-[10px] text-[var(--primary)] font-mono">10 modelos</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {PREDEFINED_TEXT_SHAPES.map((shape) => {
                  const isSelected = activeModelId === shape.model.id;
                  return (
                    <button
                      key={shape.id}
                      onClick={() => {
                        if (onSelectBaseShape) {
                          onSelectBaseShape(shape.model);
                          if (!settings.customText) {
                            onUpdateSettings({ customText: 'Parabéns' });
                          }
                        }
                      }}
                      className={`p-1.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--primary-fixed)] border-[var(--primary)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)] font-semibold'
                          : 'bg-[var(--workbench-panel)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:border-[var(--surface-container-highest)] hover:bg-[var(--workbench-panel)]'
                      }`}
                      title={`${shape.name} - ${shape.description}`}
                    >
                      <svg viewBox="0 0 100 100" className="w-5 h-5 overflow-visible">
                        <polygon
                          points={shape.model.outerPerimeter.map(([x, y]) => `${x},${y}`).join(' ')}
                          className={isSelected ? 'fill-[var(--primary-fixed)] stroke-[var(--primary)]' : 'fill-[var(--surface-container-high)] stroke-[var(--on-surface-variant)]'}
                          strokeWidth="4"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-[9px] font-medium truncate w-full text-center leading-tight">
                        {shape.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[var(--on-surface-variant)]">
                Clique numa forma acima para trocar a silhueta do cortador instantaneamente mantendo o seu texto!
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1.5">
                <span className="font-semibold flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span className="flex items-center">
                    <span>Texto no Carimbo</span>
                    <ParamTooltip
                      text="Palavra, frase, nome ou data gravada em alto-relevo na placa do carimbo em tempo real."
                      technical="O texto é automaticamente vetorizado e extrudado em nervuras chanfradas para fácil desmoldagem."
                    />
                  </span>
                </span>
                {settings.customText && (
                  <button
                    onClick={() => onUpdateSettings({ customText: '' })}
                    className="text-[11px] text-[var(--error)] hover:text-[var(--error)] flex items-center gap-1 transition-colors cursor-pointer"
                    title="Remover texto do carimbo"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Limpar</span>
                  </button>
                )}
              </div>
              <textarea
                rows={2}
                value={settings.customText}
                onChange={(e) => onUpdateSettings({ customText: e.target.value })}
                placeholder="Digite uma palavra, frase ou nome (Ex: Parabéns, Amor, 15 Anos)..."
                className="w-full px-3 py-2 text-xs bg-[var(--workbench-page)] border border-[var(--surface-container-highest)] rounded-lg text-[var(--on-surface)] placeholder:text-[var(--workbench-muted)] focus:outline-none focus:border-[var(--primary)] resize-none font-medium"
              />
              <span className="text-[10px] text-[var(--workbench-muted)] block mt-0.5">
                O texto é gravado diretamente no relevo do carimbo 3D em tempo real.
              </span>
            </div>

            {/* Font Style */}
            <div>
              <div className="flex items-center mb-1.5">
                <span className="text-xs text-[var(--on-surface-variant)] font-medium">
                  Estilo da Tipografia
                </span>
                <ParamTooltip
                  text="Escolha a família visual das letras: Cursiva (elegante para casamentos), Bold (robusta para nomes infantis), Romana (clássica) ou Arredondada (fofa)."
                  technical="Fontes como Cursiva e Bold têm largura de haste superior a 1.2mm, ideais para o bico 0.4mm."
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'cursive', label: 'Cursiva', sub: 'Caligráfica Elegante', sample: 'Amor' },
                  { id: 'bold', label: 'Moderna Bold', sub: 'Sem serifa limpa', sample: 'AMOR' },
                  { id: 'serif', label: 'Romana Serif', sub: 'Clássica Vintage', sample: 'Amor' },
                  { id: 'rounded', label: 'Arredondada', sub: 'Kawaii / Fofa', sample: 'Amor' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onUpdateSettings({ textFont: f.id as any })}
                    className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col justify-between cursor-pointer ${
                      settings.textFont === f.id
                        ? 'bg-[var(--primary-fixed)] border-[var(--primary)] text-[var(--primary)] shadow-sm'
                        : 'bg-[var(--workbench-page)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:border-[var(--surface-container-highest)]'
                    }`}
                  >
                    <div className="font-semibold text-xs text-[var(--on-surface)]">{f.label}</div>
                    <div className="text-[10px] text-[var(--workbench-muted)]">{f.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Text Size Slider */}
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Tamanho da Letra</span>
                  <ParamTooltip
                    text="Escala da fonte do texto impresso na estampa."
                    technical="Tamanhos a partir de 18pt garantem letras legíveis mesmo após o biscoito crescer no forno."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.textSize} pt
                </span>
              </div>
              <input
                type="range"
                min="14"
                max="36"
                step="1"
                value={settings.textSize}
                onChange={(e) => onUpdateSettings({ textSize: Number(e.target.value) })}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
            </div>

            {/* Text Vertical Offset */}
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                <span className="flex items-center">
                  <span>Posição Vertical (Subir / Descer)</span>
                  <ParamTooltip
                    text="Desloca o texto para cima ou para baixo para centralizar ou deixar espaço para outros desenhos."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] tabular-nums">
                  {settings.textOffsetY > 0 ? `+${settings.textOffsetY}` : settings.textOffsetY} mm
                </span>
              </div>
              <input
                type="range"
                min="-28"
                max="28"
                step="2"
                value={settings.textOffsetY}
                onChange={(e) => onUpdateSettings({ textOffsetY: Number(e.target.value) })}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--workbench-muted)] mt-0.5">
                <span>Mais abaixo</span>
                <span>Centro (0)</span>
                <span>Mais acima</span>
              </div>
            </div>

            {/* Mirror text toggle for stamps */}
            <div className="p-3 bg-[var(--workbench-page)] rounded-lg border border-[var(--surface-container-high)] space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
                <span className="flex items-center gap-1.5 font-medium">
                  <FlipHorizontal className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span className="flex items-center">
                    <span>Espelhar Texto para Carimbo</span>
                    <ParamTooltip
                      text="Inverte horizontalmente as letras na peça 3D do carimbo."
                      technical="Obrigatório para carimbos de biscoito: a peça carimba a massa em negativo, portanto a escrita deve ser espelhada para que na massa saia legível da esquerda para a direita!"
                    />
                  </span>
                </span>
                <button
                  onClick={() => onUpdateSettings({ mirrorText: !settings.mirrorText })}
                  className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                    settings.mirrorText
                      ? 'bg-[var(--primary-fixed)] text-[var(--primary)] border border-[var(--primary)] font-medium'
                      : 'bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]'
                  }`}
                >
                  {settings.mirrorText ? 'Espelhado' : 'Normal'}
                </button>
              </div>
              <p className="text-[10px] text-[var(--workbench-muted)]">
                {settings.mirrorText
                  ? 'Ativado: O carimbo físico sai espelhado para que, ao carimbar a massa do biscoito, as letras fiquem perfeitamente legíveis da esquerda para a direita!'
                  : 'Desativado: O texto fica na orientação normal de leitura diretamente na peça.'}
              </p>
            </div>

            {/* Quick Text Suggestions */}
            <div>
              <span className="text-[11px] text-[var(--on-surface-variant)] block mb-1.5">
                Sugestões Rápidas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['Parabéns!', 'Com Amor', '1 Aninho', 'Feito com Amor', 'Gratidão', 'Baby Shower', 'Feliz Natal'].map(
                  (phrase) => (
                    <button
                      key={phrase}
                      onClick={() => onUpdateSettings({ customText: phrase })}
                      className="px-2 py-1 text-[11px] bg-[var(--workbench-page)] border border-[var(--surface-container-high)] hover:border-[var(--primary)] text-[var(--on-surface-variant)] hover:text-[var(--primary)] rounded transition-colors cursor-pointer"
                    >
                      {phrase}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TECHNICAL PRINT SETTINGS & FILAMENT */}
        {activeTab === 'filament' && (
          <div className="space-y-4">
            {/* INFILL % (PREENCHIMENTO INTERNO PARA IMPRESSÃO 3D) */}
            <div className="bg-[var(--workbench-page)] p-3 rounded-xl border border-[var(--surface-container-high)] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--on-surface)] flex items-center">
                  <span>Preenchimento (Infill %)</span>
                  <ParamTooltip
                    text="Densidade percentual de material que preenche o núcleo interno das peças (cortador e carimbo). Altera diretamente o consumo de filamento (gramas) e o tempo total de impressão."
                    technical="20% (padrão Gyroid ou Grade) é o valor ideal para cortadores: economiza plástico e reduz tempo mantendo a resistência estrutural necessária para corte de massas. Use 40% a 100% caso necessite de rigidez extrema para argilas ou massas duras."
                  />
                </span>
                <span className="font-mono text-[var(--primary)] font-bold text-xs tabular-nums">
                  {settings.infillPercent}%
                </span>
              </div>

              {/* Infill Slider */}
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={settings.infillPercent}
                onChange={(e) => onUpdateSettings({ infillPercent: Number(e.target.value) })}
                className="w-full accent-[var(--primary)] cursor-pointer"
              />

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {[
                  { val: 15, label: '15% Leve' },
                  { val: 20, label: '20% Ideal' },
                  { val: 40, label: '40% Forte' },
                  { val: 100, label: '100% Sólido' },
                ].map((chip) => {
                  const isActive = settings.infillPercent === chip.val;
                  return (
                    <button
                      key={chip.val}
                      onClick={() => onUpdateSettings({ infillPercent: chip.val })}
                      className={`py-1 rounded text-center font-medium border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[var(--primary-fixed)] border-[var(--primary)] text-[var(--primary)] font-bold shadow-sm'
                          : 'bg-[var(--workbench-panel)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:border-[var(--surface-container-highest)]'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {/* Feedback description badge */}
              <div className="text-[10px] text-[var(--on-surface-variant)] pt-1 border-t border-[var(--surface-container-high)] flex items-center justify-between">
                <span>
                  {settings.infillPercent <= 15 && '⚡ Econômico: Impressão rápida e baixo peso'}
                  {settings.infillPercent > 15 && settings.infillPercent <= 25 && '⭐ Recomendado: Equilíbrio ideal entre força e tempo'}
                  {settings.infillPercent > 25 && settings.infillPercent <= 50 && '🛡️ Reforçado: Alta rigidez para massas densas'}
                  {settings.infillPercent > 50 && '💎 Maciço: 100% plástico sólido para uso industrial'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs text-[var(--on-surface-variant)] block mb-2">Cor do Cortador:</span>
              <div className="grid grid-cols-4 gap-2">
                {filamentList.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onUpdateSettings({ filamentColor: f.id })}
                    className={`p-2 rounded-lg border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      settings.filamentColor === f.id
                        ? 'border-[var(--primary)] bg-[var(--surface-container-low)]'
                        : 'border-[var(--surface-container-high)] hover:border-[var(--surface-container-highest)] bg-[var(--workbench-page)]'
                    }`}
                    title={f.name}
                  >
                    <span
                      className="w-5 h-5 rounded-full shadow-inner border border-[var(--on-primary)]/20"
                      style={{ backgroundColor: f.hex }}
                    />
                    <span className="text-[10px] text-[var(--on-surface-variant)] truncate w-full text-center">
                      {f.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs text-[var(--on-surface-variant)] block mb-2">Cor do Carimbo:</span>
              <div className="grid grid-cols-4 gap-2">
                {filamentList.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onUpdateSettings({ stampFilamentColor: f.id })}
                    className={`p-2 rounded-lg border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      settings.stampFilamentColor === f.id
                        ? 'border-[var(--primary)] bg-[var(--surface-container-low)]'
                        : 'border-[var(--surface-container-high)] hover:border-[var(--surface-container-highest)] bg-[var(--workbench-page)]'
                    }`}
                    title={f.name}
                  >
                    <span
                      className="w-5 h-5 rounded-full shadow-inner border border-[var(--on-primary)]/20"
                      style={{ backgroundColor: f.hex }}
                    />
                    <span className="text-[10px] text-[var(--on-surface-variant)] truncate w-full text-center">
                      {f.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Visual helpers */}
            <div className="space-y-2 pt-2 border-t border-[var(--surface-container-high)]">
              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
                <span className="flex items-center">
                  <span>Mesa de Impressão (Grade mm)</span>
                  <ParamTooltip
                    text="Grelha de referência milimétrica da mesa (220x220 mm)."
                    technical="Corresponde ao leito aquecido de impressoras populares como Bambu Lab A1, Ender 3 e Prusa MK4."
                  />
                </span>
                <input
                  type="checkbox"
                  checked={settings.showPrintBed}
                  onChange={(e) => onUpdateSettings({ showPrintBed: e.target.checked })}
                  className="rounded accent-[var(--primary)] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
                <span className="flex items-center">
                  <span>Modo Aramado (Wireframe 3D)</span>
                  <ParamTooltip
                    text="Exibe a malha poligonal de triângulos da geometria 3D."
                    technical="Permite inspecionar a topologia da malha manifold e verificar se o fatiador 3D terá camadas lisas sem sobreposições."
                  />
                </span>
                <input
                  type="checkbox"
                  checked={settings.wireframe}
                  onChange={(e) => onUpdateSettings({ wireframe: e.target.checked })}
                  className="rounded accent-[var(--primary)] cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Card: Print Estimation (Estimativa de Impressão) */}
      <div className="p-3.5 border-t border-[var(--surface-container-high)] bg-[var(--workbench-page)] shrink-0">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--on-surface)] mb-2">
          <span className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Estimativa de Impressão 3D</span>
          </span>
          <span className="text-[11px] font-mono text-[var(--on-surface-variant)] tabular-nums">
            PLA 1.75mm · Infill {settings.infillPercent}%
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs bg-[var(--workbench-panel)] p-2.5 rounded-lg border border-[var(--surface-container-high)]">
          <div>
            <span className="text-[10px] text-[var(--on-surface-variant)] block">Tempo Estimado</span>
            <span className="font-semibold text-[var(--on-surface)] flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-emerald-700" />
              <span>~{estimation.printTimeMinutes} min</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[var(--on-surface-variant)] block">Material / Peso</span>
            <span className="font-semibold text-[var(--on-surface)] flex items-center gap-1 mt-0.5">
              <Layers className="w-3 h-3 text-[var(--primary)]" />
              <span>~{estimation.totalWeightGrams} g ({estimation.filamentMeters}m)</span>
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
