import React, { useState } from 'react';
import { Download, Sparkles, FolderOpen, PenTool, Type, HelpCircle, Undo2, Menu, X, Box, Upload, LayoutGrid } from 'lucide-react';
import { ViewMode } from '../types';

interface TopNavProps {
  onOpenLibrary: () => void;
  onOpenCreator: () => void;
  onOpenGoogleShape: () => void;
  onOpenTextModal: () => void;
  onOpenGuide: () => void;
  onOpenExport: () => void;
  onOpenMoldStudio?: () => void;
  onUploadSTLForMold?: (file: File) => void;
  onOpenPrintBed?: () => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  doughMode: boolean;
  onUndo?: () => void;
  canUndo?: boolean;
  undoCount?: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenLibrary,
  onOpenCreator,
  onOpenGoogleShape,
  onOpenTextModal,
  onOpenGuide,
  onOpenExport,
  onOpenMoldStudio,
  onUploadSTLForMold,
  onOpenPrintBed,
  viewMode,
  onChangeViewMode,
  doughMode,
  onUndo,
  canUndo = false,
  undoCount = 0,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="relative border-b border-[var(--surface-container-high)] bg-[var(--workbench-panel)] backdrop-blur-md px-3 sm:px-4 lg:px-6 z-20 shrink-0">
      <div className="h-14 flex items-center justify-between">
        {/* Zone 1: Wordmark & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] transition-colors cursor-pointer"
            aria-label="Abrir menu de criação"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[var(--primary)]" /> : <Menu className="w-5 h-5" />}
          </button>

          <a href="/" className="text-sm sm:text-base lg:text-lg font-bold tracking-tight text-[var(--on-surface)] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] shadow-sm shadow-none" />
            <span>Cookie3D Studio</span>
          </a>
        </div>

      {/* Zone 2: 4-6 clean text navigation links / actions */}
      <nav className="hidden md:flex items-center gap-1 lg:gap-2">
        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-md hover:bg-[var(--surface-container-low)] transition-colors whitespace-nowrap cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>Modelos Prontos</span>
        </button>

        <button
          onClick={onOpenGoogleShape}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-md hover:bg-[var(--surface-container-low)] transition-colors whitespace-nowrap cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>Silhuetas (Google API)</span>
        </button>

        <button
          onClick={onOpenCreator}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-md hover:bg-[var(--surface-container-low)] transition-colors whitespace-nowrap cursor-pointer"
        >
          <PenTool className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>Importar Imagem / Desenhar</span>
        </button>

        <button
          onClick={onOpenTextModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-md hover:bg-[var(--surface-container-low)] transition-colors whitespace-nowrap cursor-pointer"
        >
          <Type className="w-3.5 h-3.5 text-emerald-700" />
          <span>Criar Frase / Placa</span>
        </button>

        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-md hover:bg-[var(--surface-container-low)] transition-colors whitespace-nowrap cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-[var(--on-surface-variant)]" />
          <span>Dicas de Impressão</span>
        </button>

        {onOpenPrintBed && (
          <button
            onClick={onOpenPrintBed}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--primary)] hover:text-[var(--on-surface)] rounded-md bg-[var(--primary-fixed)] hover:bg-[var(--primary-fixed)] border border-[var(--primary)] transition-all whitespace-nowrap cursor-pointer shadow-xs"
            title="Organizar múltiplos cortadores na mesa virtual 3D com nesting automático"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Layout de Impressão</span>
          </button>
        )}

        {onOpenMoldStudio && (
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenMoldStudio}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--primary)] hover:text-[var(--on-surface)] rounded-md bg-[var(--primary-fixed)] hover:bg-[var(--primary-fixed)] border border-[var(--primary)] transition-all whitespace-nowrap cursor-pointer shadow-xs"
              title="Abrir o Criador de Moldes 3D"
            >
              <Box className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>Criador de Moldes 3D</span>
            </button>

            {onUploadSTLForMold && (
              <label
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[var(--on-surface)] hover:text-[var(--primary)] rounded-md bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] border border-[var(--surface-container-highest)] transition-all whitespace-nowrap cursor-pointer shadow-xs"
                title="Enviar arquivo STL ou OBJ do seu computador para gerar molde 3D"
              >
                <Upload className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Enviar STL</span>
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
      </nav>

      {/* Zone 3: 1-2 primary actions */}
      <div className="flex items-center gap-2">
        {/* Undo action button */}
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              canUndo
                ? 'bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--primary)] border border-[var(--surface-container-highest)] hover:text-[var(--primary)] cursor-pointer shadow-sm'
                : 'text-[var(--workbench-muted)] border border-[var(--surface-container-high)] opacity-40 cursor-not-allowed'
            }`}
            title={
              canUndo
                ? `Desfazer última alteração (${undoCount}/5 no histórico) · Atalho: Ctrl+Z`
                : 'Nenhuma alteração para desfazer (histórico vazio)'
            }
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desfazer</span>
            {canUndo && undoCount > 0 && (
              <span className="text-[10px] font-mono text-[var(--primary)]">({undoCount})</span>
            )}
          </button>
        )}

        {/* Assembly view segmented toggle */}
        {!doughMode && (
          <div className="hidden sm:flex items-center p-1 bg-[var(--workbench-page)] border border-[var(--surface-container-high)] rounded-lg text-xs">
            <button
              onClick={() => onChangeViewMode('combo')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'combo' ? 'bg-[var(--surface-container-low)] text-[var(--primary)] font-medium' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
              }`}
              title="Cortador e Carimbo lado a lado na mesa"
            >
              Kit Duplo
            </button>
            <button
              onClick={() => onChangeViewMode('cutter_only')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'cutter_only' ? 'bg-[var(--surface-container-low)] text-[var(--primary)] font-medium' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
              }`}
              title="Apenas lâmina de corte"
            >
              Cortador
            </button>
            <button
              onClick={() => onChangeViewMode('stamp_only')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'stamp_only' ? 'bg-[var(--surface-container-low)] text-[var(--primary)] font-medium' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
              }`}
              title="Apenas carimbo com puxador"
            >
              Carimbo
            </button>
          </div>
        )}

        <button
          onClick={onOpenExport}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-container)] hover:from-[var(--primary)] hover:to-[var(--primary-container)] text-[var(--on-primary)] font-semibold text-xs rounded-lg shadow-md transition-all whitespace-nowrap cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Exportar 3D (STL)</span>
        </button>
      </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden py-3 px-2 border-t border-[var(--surface-container-high)] bg-[var(--workbench-page)] flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenLibrary();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--on-surface)] hover:text-[var(--primary)] hover:bg-[var(--workbench-panel)] rounded-lg transition-colors text-left"
          >
            <FolderOpen className="w-4 h-4 text-[var(--primary)]" />
            <span>Biblioteca de Modelos Prontos</span>
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenCreator();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--on-surface)] hover:text-[var(--primary)] hover:bg-[var(--workbench-panel)] rounded-lg transition-colors text-left"
          >
            <PenTool className="w-4 h-4 text-[var(--primary)]" />
            <span>Importar Imagem / Desenhar Forma Livre</span>
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenGoogleShape();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--on-surface)] hover:text-[var(--primary)] hover:bg-[var(--workbench-panel)] rounded-lg transition-colors text-left"
          >
            <Sparkles className="w-4 h-4 text-[var(--primary)]" />
            <span>Gerar Silhuetas com IA (Google API)</span>
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenTextModal();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--on-surface)] hover:text-emerald-700 hover:bg-[var(--workbench-panel)] rounded-lg transition-colors text-left"
          >
            <Type className="w-4 h-4 text-emerald-700" />
            <span>Criar Frase / Placa com Texto</span>
          </button>

          {onOpenPrintBed && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenPrintBed();
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[var(--primary)] hover:text-[var(--on-surface)] bg-[var(--primary-fixed)] hover:bg-[var(--primary-fixed)] border border-[var(--primary)] rounded-lg transition-colors text-left"
            >
              <LayoutGrid className="w-4 h-4 text-[var(--primary)]" />
              <span>Layout de Impressão (Nesting de Mesa)</span>
            </button>
          )}

          {onOpenMoldStudio && (
            <>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenMoldStudio();
                }}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[var(--primary)] hover:text-[var(--on-surface)] bg-[var(--primary-fixed)] hover:bg-[var(--primary-fixed)] border border-[var(--primary)] rounded-lg transition-colors text-left"
              >
                <Box className="w-4 h-4 text-[var(--primary)]" />
                <span>Criador de Moldes 3D (Novo!)</span>
              </button>

              {onUploadSTLForMold && (
                <label className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[var(--on-surface)] hover:text-[var(--on-surface)] bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded-lg transition-colors text-left cursor-pointer">
                  <Upload className="w-4 h-4 text-[var(--primary)]" />
                  <span>Enviar Arquivo STL (Gerar Molde)</span>
                  <input
                    type="file"
                    accept=".stl,.obj"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setMobileMenuOpen(false);
                        onUploadSTLForMold(file);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </>
          )}

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenGuide();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--workbench-panel)] rounded-lg transition-colors text-left border-t border-[var(--surface-container-high)] pt-2"
          >
            <HelpCircle className="w-4 h-4 text-[var(--workbench-muted)]" />
            <span>Dicas e Parâmetros de Impressão 3D</span>
          </button>
        </div>
      )}
    </header>
  );
};
