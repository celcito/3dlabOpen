import React, { useState } from 'react';
import JSZip from 'jszip';
import type { PencilTopperConfig, Model3DDimensions } from '../types/pencilTopper';
import { generatePencilTopperModel } from '../lib/pencilTopper/geometry';
import { exportToBinarySTL, downloadBlob } from '../lib/pencilTopper/stlExporter';
import { exportPencilTopper3MF } from '../lib/pencilTopper/threeMfExporter';
import {
  X,
  Download,
  Layers,
  FileBox,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Loader2,
  Box,
} from 'lucide-react';

interface PencilExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PencilTopperConfig;
  dimensions: Model3DDimensions;
}

export const PencilExportModal: React.FC<PencilExportModalProps> = ({
  isOpen,
  onClose,
  config,
  dimensions,
}) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const getCleanFilename = (suffix: string, ext: string) => {
    const safeText = config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'Ponteira';
    return `Ponteira_Lapis_${safeText}_${suffix}.${ext}`;
  };

  // 1. Exporta .3MF Multicolor (2 Cores)
  const handleExport3MF = async () => {
    try {
      setIsExporting('3mf');
      const model = await generatePencilTopperModel(config);
      const filename = getCleanFilename('Multicolor_2Cores', '3mf');

      const blob = await exportPencilTopper3MF(
        model.baseMesh.geometry,
        model.reliefMesh.geometry,
        config.baseColor,
        config.reliefColor,
        filename
      );

      downloadBlob(blob, filename);
      setSuccessMessage('Arquivo .3MF Multicolor gerado com sucesso para Bambu Studio / AMS!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao exportar 3MF:', err);
    } finally {
      setIsExporting(null);
    }
  };

  // 2. Exporta STL Único Unificado
  const handleExportSingleSTL = async () => {
    try {
      setIsExporting('stl-single');
      const model = await generatePencilTopperModel(config);
      const filename = getCleanFilename('Unico_3D', 'stl');

      const arrayBuffer = exportToBinarySTL([
        { geom: model.baseMesh.geometry, zOffset: 0 },
        { geom: model.reliefMesh.geometry, zOffset: 0 },
      ]);

      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
      downloadBlob(blob, filename);
      setSuccessMessage('Arquivo STL Único baixado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao exportar STL único:', err);
    } finally {
      setIsExporting(null);
    }
  };

  // 3. Exporta 2 STLs Separados em arquivo ZIP
  const handleExportSeparatedSTL = async () => {
    try {
      setIsExporting('stl-zip');
      const model = await generatePencilTopperModel(config);
      const zip = new JSZip();

      const baseBuffer = exportToBinarySTL([{ geom: model.baseMesh.geometry, zOffset: 0 }]);
      zip.file('1_Corpo_da_Base_e_Encaixe.stl', baseBuffer);

      const reliefBuffer = exportToBinarySTL([{ geom: model.reliefMesh.geometry, zOffset: 0 }]);
      zip.file('2_Letras_em_Relevo.stl', reliefBuffer);

      // Guia de Fatiamento em Markdown
      const readme = `# Ponteira de Lápis & Caneta 3D Paramétrica
Nome: ${config.text}
Modelo do Lápis: ${config.pencilModel}
Diâmetro do Lápis: ${config.pencilDiameter} mm
Folga de Encaixe: ${config.clearance} mm
Formato do Furo: ${config.holeShape}
Altura Total (Z): ${dimensions.dimZ} mm
Dimensões Totais: X ${dimensions.dimX} × Y ${dimensions.dimY} × Z ${dimensions.dimZ} mm

Arquivos inclusos:
1. 1_Corpo_da_Base_e_Encaixe.stl (Cor: ${config.baseColor})
2. 2_Letras_em_Relevo.stl (Cor: ${config.reliefColor})
`;
      zip.file('LEIA-ME_CONFIGURACOES.txt', readme);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFilename = getCleanFilename('STLs_Separados_2Cores', 'zip');
      downloadBlob(zipBlob, zipFilename);

      setSuccessMessage('Pacote ZIP com STLs separados baixado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao gerar ZIP de STLs:', err);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--workbench-page)]/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--surface-container-high)] bg-[var(--workbench-panel)]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Exportar Ponteira de Lápis 3D
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Pronto para Impressão
                </span>
              </h3>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Escolha o formato ideal para seu fatiador (Bambu AMS, Orca, Prusa, etc.)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--on-surface-variant)] hover:text-white hover:bg-[var(--surface-container-high)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem Flutuante de Sucesso */}
        {successMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Opções de Exportação */}
        <div className="p-5 overflow-y-auto space-y-3.5">
          {/* Opção 1: 3MF Multicolor (Recomendado) */}
          <div className="p-4 rounded-xl border border-purple-500/40 bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">.3MF Multicolor (2 Cores)</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded-full bg-purple-600 text-white">
                  Recomendado
                </span>
              </div>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Objetos separados e cores pré-atribuídas para Bambu Studio AMS, OrcaSlicer e PrusaSlicer.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport3MF}
              disabled={isExporting !== null}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-500/20 shrink-0 cursor-pointer"
            >
              {isExporting === '3mf' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Baixar .3MF</span>
            </button>
          </div>

          {/* Opção 2: STL Único */}
          <div className="p-4 rounded-xl border border-[var(--surface-container-high)] bg-[var(--workbench-page)]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">.STL Peça Única</span>
                <span className="text-[10px] font-semibold text-[var(--on-surface-variant)]">1 Cor / Pintura</span>
              </div>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Todas as geometrias unificadas em uma malha sólida para impressão em uma única cor.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportSingleSTL}
              disabled={isExporting !== null}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-high)] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              {isExporting === 'stl-single' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileBox className="w-4 h-4" />
              )}
              <span>Baixar STL Único</span>
            </button>
          </div>

          {/* Opção 3: STLs Separados (ZIP) */}
          <div className="p-4 rounded-xl border border-[var(--surface-container-high)] bg-[var(--workbench-page)]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">STLs Separados (.ZIP)</span>
                <span className="text-[10px] font-semibold text-[var(--on-surface-variant)]">Multi-extrusor</span>
              </div>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Arquivo .ZIP com Base.stl e Letras.stl para fatiadores convencionais.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportSeparatedSTL}
              disabled={isExporting !== null}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-high)] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              {isExporting === 'stl-zip' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
              <span>Baixar ZIP</span>
            </button>
          </div>

          {/* Resumo Técnico das Dimensões */}
          <div className="p-3 rounded-xl bg-[var(--workbench-page)]/80 border border-[var(--surface-container-high)] text-xs text-[var(--on-surface-variant)] flex flex-wrap items-center justify-between gap-2">
            <span>Dimensões: <strong className="text-white font-mono">{dimensions.dimX} × {dimensions.dimY} × {dimensions.dimZ} mm</strong></span>
            <span>Peso PLA: <strong className="text-emerald-400 font-mono">~{dimensions.weightGrams}g</strong></span>
            <span>Tempo estimado: <strong className="text-orange-400 font-mono">~{dimensions.printTimeMinutes} min</strong></span>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-[var(--surface-container-high)] bg-[var(--workbench-panel)]/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--on-surface-variant)] hover:text-white hover:bg-[var(--surface-container-high)] transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
