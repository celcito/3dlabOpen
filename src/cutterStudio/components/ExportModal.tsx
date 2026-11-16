import React, { useState } from 'react';
import * as THREE from 'three';
import { ModelLineart, ModelSettings, PrintEstimation } from '../types';
import {
  downloadMeshSTL,
  downloadCompleteKitZip,
} from '../utils/stlExporter';
import {
  generateCutterMesh,
  generateStampMesh,
} from '../utils/meshGenerator';
import {
  downloadProductionReportPDF,
  getProductionReportPDFBlob,
} from '../utils/productionReportPdf';
import {
  X,
  Download,
  CheckCircle,
  Archive,
  Layers,
  FileCheck,
  Printer,
  Sparkles,
  FileText,
  LayoutGrid,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: ModelLineart;
  settings: ModelSettings;
  estimation: PrintEstimation;
  onOpenPrintBed?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  model,
  settings,
  estimation,
  onOpenPrintBed,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const getMeshes = () => {
    const dummyMat = new THREE.MeshBasicMaterial();
    const cutterMesh = generateCutterMesh(model, settings, dummyMat);
    const stampMesh = generateStampMesh(model, settings, dummyMat);
    return { cutterMesh, stampMesh };
  };

  const handleDownloadCutterSTL = () => {
    try {
      const { cutterMesh } = getMeshes();
      downloadMeshSTL(cutterMesh, `Cortador_${model.name}_${settings.targetWidth}mm.stl`);
      setDownloadSuccessMessage('Arquivo Cortador STL baixado com sucesso!');
      setTimeout(() => setDownloadSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadStampSTL = () => {
    try {
      const { stampMesh } = getMeshes();
      downloadMeshSTL(stampMesh, `Carimbo_${model.name}_${settings.targetWidth}mm.stl`);
      setDownloadSuccessMessage('Arquivo Carimbo STL baixado com sucesso!');
      setTimeout(() => setDownloadSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadProductionPDF = () => {
    try {
      downloadProductionReportPDF(model, settings, estimation);
      setDownloadSuccessMessage('Ficha de Produção em PDF gerada com sucesso! Ideal para registro de oficina.');
      setTimeout(() => setDownloadSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Erro gerando PDF de produção:', err);
    }
  };

  const handleDownloadZipKit = async () => {
    setIsExporting(true);
    try {
      const { cutterMesh, stampMesh } = getMeshes();
      const settingsSummary = `
- Dimensões: ${settings.targetWidth} x ${settings.targetHeight} mm
- Altura da Lâmina: ${settings.bladeHeight} mm
- Fio de Corte: ${settings.bladeEdgeThickness} mm
- Borda de Apoio: ${settings.lipWidth} mm
- Relevo do Carimbo: ${settings.stampDepth} mm
- Puxador: ${settings.handleType}
- Furos de ar: ${settings.airReleaseHoles ? 'Sim' : 'Não'}
- Preenchimento (Infill): ${settings.infillPercent}%
- Estimativa: ~${estimation.totalWeightGrams}g (${estimation.filamentMeters}m) · ~${estimation.printTimeMinutes} min
`;
      const pdfBlob = getProductionReportPDFBlob(model, settings, estimation);
      await downloadCompleteKitZip(cutterMesh, stampMesh, model.name, settingsSummary, pdfBlob);
      setDownloadSuccessMessage('Kit completo (Cortador + Carimbo + Ficha PDF + Dicas) baixado em ZIP!');
      setTimeout(() => setDownloadSuccessMessage(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--inverse-surface)]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[var(--surface-container-high)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--primary-fixed)] border border-[var(--primary)] text-[var(--primary)]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--on-surface)]">
                Exportar Arquivos para Impressão 3D
              </h2>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Formatos compatíveis com Bambu Studio, OrcaSlicer, PrusaSlicer e Cura
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-lg hover:bg-[var(--surface-container-low)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Success Banner */}
          {downloadSuccessMessage && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-2 text-emerald-700 text-xs">
              <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{downloadSuccessMessage}</span>
            </div>
          )}

          {/* Model Technical Specs Card */}
          <div className="bg-[var(--workbench-page)] p-4 rounded-xl border border-[var(--surface-container-high)] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--on-surface-variant)]">Modelo Selecionado:</span>
              <span className="font-semibold text-[var(--on-surface)]">{model.name}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--on-surface-variant)]">Dimensões Finais (X / Y):</span>
              <span className="font-mono text-[var(--primary)] tabular-nums">
                {settings.targetWidth} × {settings.targetHeight} mm
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--on-surface-variant)]">Preenchimento Interno (Infill):</span>
              <span className="font-mono text-[var(--primary)] tabular-nums">
                {settings.infillPercent}% ({settings.infillPercent <= 15 ? 'Leve' : settings.infillPercent <= 25 ? 'Padrão' : settings.infillPercent <= 50 ? 'Reforçado' : 'Sólido'})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--on-surface-variant)]">Profundidade da Lâmina:</span>
              <span className="font-mono text-[var(--on-surface)] tabular-nums">
                {settings.bladeHeight} mm (Fio {settings.bladeEdgeThickness}mm)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--on-surface-variant)]">Qualidade de Malha (Triângulos):</span>
              <span className="font-mono text-emerald-700 tabular-nums flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5" />
                <span>{estimation.trianglesCount.toLocaleString('pt-BR')} faces (Sólido Manifold)</span>
              </span>
            </div>
          </div>

          {/* Primary Action: Download complete ZIP */}
          <button
            onClick={handleDownloadZipKit}
            disabled={isExporting}
            className="w-full py-3 px-4 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-container)] hover:from-[var(--primary)] hover:to-[var(--primary-container)] text-[var(--on-primary)] font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <Archive className="w-5 h-5" />
            <span>
              {isExporting ? 'Compactando Pacote...' : 'Baixar Kit Completo em ZIP (Cortador + Carimbo + Ficha PDF)'}
            </span>
          </button>

          {/* NOVO: Ficha Técnica e Ordem de Serviço em PDF */}
          <div className="p-3.5 bg-gradient-to-r from-[var(--primary)]/10 via-[var(--workbench-panel)] to-[var(--workbench-panel)] border border-[var(--primary)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-[var(--primary-fixed)] text-[var(--primary)] shrink-0 mt-0.5">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs font-bold text-[var(--on-surface)]">
                    Ficha de Produção 3D (PDF)
                  </h3>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-[var(--primary-fixed)] text-[var(--primary)] border border-[var(--primary)]">
                    Ordem de Serviço
                  </span>
                </div>
                <p className="text-[11px] text-[var(--on-surface-variant)] mt-0.5 leading-snug">
                  Configurações de fatiamento, consumo (~{estimation.totalWeightGrams}g / {estimation.filamentMeters}m), tempo (~{estimation.printTimeMinutes} min) e checklist para registro de oficina.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadProductionPDF}
              className="shrink-0 px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Baixar documento PDF formatado em A4 pronto para impressão ou arquivamento"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Ficha PDF</span>
            </button>
          </div>

          {/* Secondary Individual STL Downloads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleDownloadCutterSTL}
              className="p-3 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-low)] text-[var(--on-surface)] rounded-lg border border-[var(--surface-container-highest)] hover:border-[var(--primary)] transition-colors flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4 text-[var(--primary)]" />
              <span>Baixar Apenas Cortador (.stl)</span>
            </button>

            <button
              onClick={handleDownloadStampSTL}
              className="p-3 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-low)] text-[var(--on-surface)] rounded-lg border border-[var(--surface-container-highest)] hover:border-[var(--primary)] transition-colors flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4 text-[var(--primary)]" />
              <span>Baixar Apenas Carimbo (.stl)</span>
            </button>
          </div>

          {/* Batch Print Bed Layout link */}
          {onOpenPrintBed && (
            <div className="p-3 bg-[var(--primary-fixed)] border border-[var(--primary)] rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[var(--primary)] shrink-0" />
                <div>
                  <p className="font-semibold text-[var(--primary)]">
                    Quer imprimir múltiplos cortadores na mesma mesa?
                  </p>
                  <p className="text-[11px] text-[var(--on-surface-variant)]">
                    Use o Layout de Impressão para organizar e baixar um único STL de mesa completa.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenPrintBed();
                }}
                className="shrink-0 px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Organizar Mesa →
              </button>
            </div>
          )}

          {/* Slicer Compatibility Badge List */}
          <div className="pt-2 text-center">
            <span className="text-[11px] text-[var(--workbench-muted)] block mb-1">
              Pronto para fatiamento direto em:
            </span>
            <div className="flex items-center justify-center gap-3 text-xs text-[var(--on-surface-variant)]">
              <span>Bambu Studio</span>
              <span>·</span>
              <span>OrcaSlicer</span>
              <span>·</span>
              <span>PrusaSlicer</span>
              <span>·</span>
              <span>UltiMaker Cura</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--surface-container-high)] bg-[var(--workbench-page)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface)] text-xs rounded-md transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
