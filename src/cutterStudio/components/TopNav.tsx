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
    <header className="relative border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-4 lg:px-6 z-20 shrink-0">
      <div className="h-14 flex items-center justify-between">
        {/* Zone 1: Wordmark & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Abrir menu de criação"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
          </button>

          <a href="/" className="text-sm sm:text-base lg:text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
            <span>Cookie3D Studio</span>
          </a>
        </div>

      {/* Zone 2: 4-6 clean text navigation links / actions */}
      <nav className="hidden md:flex items-center gap-1 lg:gap-2">
        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-md hover:bg-slate-800/60 transition-colors whitespace-nowrap cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Modelos Prontos</span>
        </button>

        <button
          onClick={onOpenGoogleShape}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-md hover:bg-slate-800/60 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Silhuetas (Google API)</span>
        </button>

        <button
          onClick={onOpenCreator}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-md hover:bg-slate-800/60 transition-colors whitespace-nowrap cursor-pointer"
        >
          <PenTool className="w-3.5 h-3.5 text-cyan-400" />
          <span>Importar Imagem / Desenhar</span>
        </button>

        <button
          onClick={onOpenTextModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-md hover:bg-slate-800/60 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Type className="w-3.5 h-3.5 text-emerald-400" />
          <span>Criar Frase / Placa</span>
        </button>

        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-md hover:bg-slate-800/60 transition-colors whitespace-nowrap cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Dicas de Impressão</span>
        </button>

        {onOpenPrintBed && (
          <button
            onClick={onOpenPrintBed}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:text-white rounded-md bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/35 transition-all whitespace-nowrap cursor-pointer shadow-xs"
            title="Organizar múltiplos cortadores na mesa virtual 3D com nesting automático"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
            <span>Layout de Impressão</span>
          </button>
        )}

        {onOpenMoldStudio && (
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenMoldStudio}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-sky-300 hover:text-white rounded-md bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/35 transition-all whitespace-nowrap cursor-pointer shadow-xs"
              title="Abrir o Criador de Moldes 3D"
            >
              <Box className="w-3.5 h-3.5 text-sky-400" />
              <span>Criador de Moldes 3D</span>
            </button>

            {onUploadSTLForMold && (
              <label
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-sky-300 rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all whitespace-nowrap cursor-pointer shadow-xs"
                title="Enviar arquivo STL ou OBJ do seu computador para gerar molde 3D"
              >
                <Upload className="w-3.5 h-3.5 text-sky-400" />
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
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 hover:text-amber-300 cursor-pointer shadow-sm'
                : 'text-slate-600 border border-slate-800/60 opacity-40 cursor-not-allowed'
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
              <span className="text-[10px] font-mono text-amber-500/80">({undoCount})</span>
            )}
          </button>
        )}

        {/* Assembly view segmented toggle */}
        {!doughMode && (
          <div className="hidden sm:flex items-center p-1 bg-slate-950/70 border border-slate-800 rounded-lg text-xs">
            <button
              onClick={() => onChangeViewMode('combo')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'combo' ? 'bg-slate-800 text-amber-400 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Cortador e Carimbo lado a lado na mesa"
            >
              Kit Duplo
            </button>
            <button
              onClick={() => onChangeViewMode('cutter_only')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'cutter_only' ? 'bg-slate-800 text-amber-400 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Apenas lâmina de corte"
            >
              Cortador
            </button>
            <button
              onClick={() => onChangeViewMode('stamp_only')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'stamp_only' ? 'bg-slate-800 text-amber-400 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Apenas carimbo com puxador"
            >
              Carimbo
            </button>
          </div>
        )}

        <button
          onClick={onOpenExport}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-lg shadow-md transition-all whitespace-nowrap cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Exportar 3D (STL)</span>
        </button>
      </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden py-3 px-2 border-t border-slate-800 bg-slate-950/95 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenLibrary();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:text-amber-400 hover:bg-slate-900 rounded-lg transition-colors text-left"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span>Biblioteca de Modelos Prontos</span>
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenCreator();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:text-cyan-400 hover:bg-slate-900 rounded-lg transition-colors text-left"
          >
            <PenTool className="w-4 h-4 text-cyan-400" />
            <span>Importar Imagem / Desenhar Forma Livre</span>
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenGoogleShape();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:text-purple-400 hover:bg-slate-900 rounded-lg transition-colors text-left"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Gerar Silhuetas com IA (Google API)</span>
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenTextModal();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:text-emerald-400 hover:bg-slate-900 rounded-lg transition-colors text-left"
          >
            <Type className="w-4 h-4 text-emerald-400" />
            <span>Criar Frase / Placa com Texto</span>
          </button>

          {onOpenPrintBed && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenPrintBed();
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors text-left"
            >
              <LayoutGrid className="w-4 h-4 text-cyan-400" />
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
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg transition-colors text-left"
              >
                <Box className="w-4 h-4 text-sky-400" />
                <span>Criador de Moldes 3D (Novo!)</span>
              </button>

              {onUploadSTLForMold && (
                <label className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors text-left cursor-pointer">
                  <Upload className="w-4 h-4 text-sky-400" />
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
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors text-left border-t border-slate-900 pt-2"
          >
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>Dicas e Parâmetros de Impressão 3D</span>
          </button>
        </div>
      )}
    </header>
  );
};
