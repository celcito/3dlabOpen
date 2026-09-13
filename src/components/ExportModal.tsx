import React, { useState } from 'react';
import JSZip from 'jszip';
import type { LetterBoxConfig, Model3DDimensions } from '../types/letterBox';
import { generateLetterBoxModel } from '../lib/letterBox/geometry';
import { exportToBinarySTL, downloadBlob } from '../lib/pencilTopper/stlExporter';
import { exportToMulticolor3MF } from '../lib/letterBox/threeMfExporter';
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
  Camera,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LetterBoxConfig;
  dimensions: Model3DDimensions;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  config,
  dimensions,
}) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const getCleanFilename = (suffix: string, ext: string) => {
    const safeText = config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'LetraCaixa';
    return `LetraCaixa3D_${safeText}_${config.letterHeight}mm_${suffix}.${ext}`;
  };

  // 1. Exporta .3MF Multicolor com as 3 Camadas
  const handleExport3MF = async () => {
    try {
      setIsExporting('3mf');
      const model = await generateLetterBoxModel(config);
      const filename = getCleanFilename('3Camadas_Multicolor', '3mf');

      const blob = await exportToMulticolor3MF(
        model.backMesh.geometry,
        model.midMesh.geometry,
        model.frontMesh.geometry,
        config.backColor,
        config.midColor,
        config.frontColor,
        config.backDepth,
        config.midThickness,
        filename
      );

      downloadBlob(blob, filename);
      setSuccessMessage('Arquivo .3MF Multicolor gerado com sucesso para Bambu Studio / OrcaSlicer!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao exportar 3MF:', err);
    } finally {
      setIsExporting(null);
    }
  };

  // 2. Exporta STL Único com todas as 3 camadas unificadas
  const handleExportSingleSTL = async () => {
    try {
      setIsExporting('stl-single');
      const model = await generateLetterBoxModel(config);
      const filename = getCleanFilename('Unico_3D', 'stl');

      const arrayBuffer = exportToBinarySTL([
        { geom: model.backMesh.geometry, zOffset: 0 },
        { geom: model.midMesh.geometry, zOffset: config.backDepth },
        { geom: model.frontMesh.geometry, zOffset: config.backDepth + config.midThickness },
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

  // 3. Exporta 3 STLs Separados em arquivo ZIP
  const handleExportSeparatedSTL = async () => {
    try {
      setIsExporting('stl-zip');
      const model = await generateLetterBoxModel(config);

      const backBuffer = exportToBinarySTL([
        { geom: model.backMesh.geometry, zOffset: 0 },
      ]);
      const midBuffer = exportToBinarySTL([
        { geom: model.midMesh.geometry, zOffset: config.backDepth },
      ]);
      const frontBuffer = exportToBinarySTL([
        { geom: model.frontMesh.geometry, zOffset: config.backDepth + config.midThickness },
      ]);

      const zip = new JSZip();
      zip.file('1_Camada_Traseira_Caixa.stl', backBuffer);
      zip.file('2_Camada_Intermediaria.stl', midBuffer);
      zip.file('3_Texto_Frontal.stl', frontBuffer);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipName = getCleanFilename('3_Camadas_Separadas', 'zip');
      downloadBlob(zipBlob, zipName);

      setSuccessMessage('Pacote ZIP com os 3 STLs individuais baixado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao exportar STLs separados:', err);
    } finally {
      setIsExporting(null);
    }
  };

  // 4. Salvar Imagem Renderizada em Alta Resolução da Visualização
  const handleSaveImageSnapshot = () => {
    try {
      setIsExporting('image');
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas) {
        throw new Error('Canvas 3D não encontrado');
      }

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const safeText = config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'LetraCaixa';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `LetraCaixa3D_${safeText}_${config.letterHeight}mm_${timestamp}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage('Imagem renderizada da visão atual salva em alta resolução!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao salvar imagem do canvas:', err);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-[var(--surface-container-high)] flex items-center justify-between bg-[var(--workbench-page)]/50">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-purple-400" />
              Exportar Letra Caixa 3D
            </h2>
            <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
              Dimensões calculadas: X {dimensions.dimX} • Y {dimensions.dimY} • Z {dimensions.dimZ} mm (~{dimensions.weightGrams}g PLA)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--on-surface-variant)] hover:text-white hover:bg-[var(--surface-container-high)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de sucesso */}
        {successMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Opções de Exportação */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Opção 1: 3MF Multicolor (Destaque MakerWorld) */}
          <div className="p-4 rounded-2xl border-2 border-purple-500/60 bg-purple-950/20 hover:bg-purple-950/30 transition-all relative overflow-hidden">
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-purple-500 text-[10px] font-bold text-white uppercase tracking-wider">
              Recomendado MakerWorld
            </div>
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">
                  Arquivo .3MF Multicolor (Bambu Studio / Orca / Prusa)
                </h3>
                <p className="text-xs text-[var(--on-surface-variant)] mt-1 leading-relaxed">
                  Arquivo montado com as 3 camadas em objetos separados e materiais com cores
                  pré-configuradas. Abre diretamente no fatiador pronto para AMS ou troca de filamento.
                </p>
                <div className="mt-3">
                  <button
                    id="btn-modal-export-3mf"
                    type="button"
                    disabled={isExporting !== null}
                    onClick={handleExport3MF}
                    className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-purple-600/30"
                  >
                    {isExporting === '3mf' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Baixar .3MF Multicolor
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Opção 2: STL Único */}
          <div className="p-4 rounded-2xl border border-[var(--surface-container-high)] bg-[var(--workbench-page)]/40 hover:border-slate-700 transition-all flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] shrink-0">
              <FileBox className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">STL Único (Sólido Unificado)</h3>
              <p className="text-xs text-[var(--on-surface-variant)] mt-1 leading-relaxed">
                Todas as 3 camadas fundidas em um único arquivo sólido, ideal para impressão em cor
                única ou para troca manual de filamento por altura de camada (pause at layer).
              </p>
              <div className="mt-3">
                <button
                  id="btn-modal-export-single-stl"
                  type="button"
                  disabled={isExporting !== null}
                  onClick={handleExportSingleSTL}
                  className="py-2 px-4 rounded-xl bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-high)] text-[var(--workbench-text)] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isExporting === 'stl-single' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Baixar STL Único (.stl)
                </button>
              </div>
            </div>
          </div>

          {/* Opção 3: STLs Separados (ZIP) */}
          <div className="p-4 rounded-2xl border border-[var(--surface-container-high)] bg-[var(--workbench-page)]/40 hover:border-slate-700 transition-all flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">3 STLs Individuais (ZIP)</h3>
              <p className="text-xs text-[var(--on-surface-variant)] mt-1 leading-relaxed">
                Três arquivos STL separados (Traseira, Intermediária e Frontal) perfeitamente
                alinhados na mesma origem de coordenadas para fatiadores clássicos.
              </p>
              <div className="mt-3">
                <button
                  id="btn-modal-export-zip-stl"
                  type="button"
                  disabled={isExporting !== null}
                  onClick={handleExportSeparatedSTL}
                  className="py-2 px-4 rounded-xl bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-high)] text-[var(--workbench-text)] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isExporting === 'stl-zip' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Baixar Pacote ZIP (.zip)
                </button>
              </div>
            </div>
          </div>

          {/* Opção 4: Salvar Imagem da Visualização Atual (PNG) */}
          <div className="p-4 rounded-2xl border border-[var(--surface-container-high)] bg-[var(--workbench-page)]/40 hover:border-slate-700 transition-all flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-purple-950/40 text-purple-400 border border-purple-500/20 shrink-0">
              <Camera className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Salvar Imagem Atual (Render HD .PNG)</h3>
              <p className="text-xs text-[var(--on-surface-variant)] mt-1 leading-relaxed">
                Gera um arquivo de imagem em alta definição no formato PNG exatamente na perspectiva,
                cores e iluminação que você está visualizando no momento. Perfeito para fotos de catálogo ou apresentação para clientes.
              </p>
              <div className="mt-3">
                <button
                  id="btn-modal-export-png-image"
                  type="button"
                  disabled={isExporting !== null}
                  onClick={handleSaveImageSnapshot}
                  className="py-2 px-4 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 border border-purple-500/40 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isExporting === 'image' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-purple-400" />
                  )}
                  Salvar Imagem Visualizada (.png)
                </button>
              </div>
            </div>
          </div>

          {/* Dicas de Fatiamento para MakerWorld */}
          <div className="p-4 rounded-xl bg-[var(--workbench-page)]/80 border border-[var(--surface-container-high)]/80 space-y-2">
            <h4 className="text-xs font-semibold text-[var(--on-surface-variant)] flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
              Recomendações de Impressão 3D
            </h4>
            <ul className="text-[11px] text-[var(--on-surface-variant)] space-y-1 list-disc list-inside">
              <li>
                <strong>Orientação na Mesa:</strong> Imprima deitado com a parte traseira lisa apoiada
                na chapa. <strong>Não necessita de nenhum suporte!</strong>
              </li>
              <li>
                <strong>Altura de Camada:</strong> 0.20mm (Standard) ou 0.16mm (Fine para relevos nítidos).
              </li>
              <li>
                <strong>Paredes e Topo:</strong> 3 a 4 paredes (perímetros) e 4 camadas superiores para
                letras bem sólidas e sem frestas.
              </li>
              <li>
                <strong>Preenchimento (Infill):</strong> 12% a 15% Gyroid para resistência uniforme.
              </li>
            </ul>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-[var(--workbench-page)] border-t border-[var(--surface-container-high)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-high)] text-xs font-semibold text-white transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
