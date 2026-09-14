import React from 'react';
import { LetterBoxConfig, PencilTopperConfig, AppMode } from '../types/letterBox';
import { Download, Layers, Sparkles, Box, Type, PenTool, Check } from 'lucide-react';

interface NavbarProps {
  appMode: AppMode;
  onSelectAppMode: (mode: AppMode) => void;
  letterConfig: LetterBoxConfig;
  onChangeLetterConfig: (newConfig: LetterBoxConfig) => void;
  pencilConfig: PencilTopperConfig;
  onChangePencilConfig: (newConfig: PencilTopperConfig) => void;
  onOpenExportModal: () => void;
  onQuickDownload3MF: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  appMode,
  onSelectAppMode,
  letterConfig,
  onChangeLetterConfig,
  pencilConfig,
  onChangePencilConfig,
  onOpenExportModal,
  onQuickDownload3MF,
}) => {
  const letterWords = ['M2CR', 'HOME', 'MAKER', 'LOVE', 'CAFÉ', '3D'];
  const pencilNames = ['Milene', 'Lucas', 'Maria', 'Sofia', 'Theo', 'Alice'];

  return (
    <header className="h-16 bg-[var(--workbench-panel)] border-b border-[var(--surface-container-high)] px-3 md:px-6 flex items-center justify-between shrink-0 z-20">
      {/* Logotipo & Alternador de Ferramentas / Páginas */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg text-[var(--workbench-text)] font-black text-lg transition-all ${
            appMode === 'letra-caixa'
              ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 shadow-purple-500/25'
              : 'bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 shadow-amber-500/25'
          }`}
        >
          {appMode === 'letra-caixa' ? '3L' : '✏️'}
        </div>

        {/* Seletor de Páginas / Guias */}
        <div className="flex items-center bg-[var(--workbench-page)]/80 p-1 rounded-xl border border-[var(--surface-container-high)]">
          <button
            type="button"
            onClick={() => onSelectAppMode('letra-caixa')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              appMode === 'letra-caixa'
                ? 'bg-purple-600 text-[var(--workbench-text)] shadow-sm shadow-purple-600/30'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Letra Caixa 3D</span>
            <span className="sm:hidden">Letras</span>
            <span className="hidden lg:inline text-[9px] px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-400/40 text-purple-200">
              3 Camadas
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectAppMode('ponteira-lapis')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              appMode === 'ponteira-lapis'
                ? 'bg-amber-500 text-[var(--workbench-text)] shadow-sm shadow-amber-500/30'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]/60'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ponteira de Lápis 3D</span>
            <span className="sm:hidden">Ponteiras</span>
            <span className="hidden lg:inline text-[9px] px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-400/40 text-amber-200">
              Paramétrico
            </span>
          </button>
        </div>
      </div>

      {/* Atalhos Rápidos de Nomes / Palavras */}
      <div className="hidden xl:flex items-center gap-1.5 bg-[var(--workbench-page)]/60 p-1 rounded-xl border border-[var(--surface-container-high)]">
        <span className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider px-2">
          Exemplos:
        </span>
        {appMode === 'letra-caixa'
          ? letterWords.map((word) => {
              const isSelected = letterConfig.text.toUpperCase() === word;
              return (
                <button
                  key={`nav-letter-${word}`}
                  type="button"
                  onClick={() => onChangeLetterConfig({ ...letterConfig, text: word })}
                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 text-[var(--workbench-text)] shadow-sm'
                      : 'text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  {word}
                </button>
              );
            })
          : pencilNames.map((name) => {
              const isSelected = pencilConfig.text.toLowerCase() === name.toLowerCase();
              return (
                <button
                  key={`nav-pencil-${name}`}
                  type="button"
                  onClick={() => onChangePencilConfig({ ...pencilConfig, text: name })}
                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-[var(--workbench-text)] font-bold shadow-sm'
                      : 'text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  {name}
                </button>
              );
            })}
      </div>

      {/* Ações de Download */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onQuickDownload3MF}
          className={`py-2 px-3.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md cursor-pointer ${
            appMode === 'letra-caixa'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-[var(--workbench-text)] shadow-purple-600/30'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[var(--workbench-text)] shadow-amber-500/30'
          }`}
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          <span>Baixar 3MF</span>
        </button>

        <button
          type="button"
          onClick={onOpenExportModal}
          className="py-2 px-3 rounded-xl bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-high)] text-[var(--workbench-text)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Box className="w-4 h-4" />
          <span className="hidden sm:inline">Mais Formatos</span>
        </button>
      </div>
    </header>
  );
};
