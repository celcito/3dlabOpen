import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { PenHolderConfig, PenHolderDimensions } from '../types/penHolder';
import { loadSavedPenHolderConfig, savePenHolderConfigToStorage } from '../lib/penHolder/storage';
import { exportPenHolder3MF } from '../lib/penHolder/threeMfExporter';
import { exportToBinarySTL, downloadBlob } from '../lib/pencilTopper/stlExporter';
import { generatePenHolder } from '../lib/penHolder/nameTray';
import { PenHolderCanvas } from '../components/PenHolderCanvas';
import { PenHolderControls } from '../components/PenHolderControls';

function safeName(config: PenHolderConfig): string {
  return config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'Porta_Canetas';
}

export default function PenHolderCreator() {
  const [config, setConfig] = useState<PenHolderConfig>(loadSavedPenHolderConfig);
  const [dimensions, setDimensions] = useState<PenHolderDimensions>({
    dimX: 0, dimY: 0, dimZ: 0, volumeCm3: 0, weightGrams: 0, printTimeMinutes: 0,
    nameWidthMm: 0, bodyCount: 0, cavityMarginMm: 0,
  });
  const [exporting, setExporting] = useState<'stl' | '3mf' | null>(null);

  const handleChange = useCallback((newConfig: PenHolderConfig) => {
    setConfig(newConfig);
    savePenHolderConfigToStorage(newConfig);
  }, []);

  const handleDownloadSTL = useCallback(async () => {
    if (exporting) return;
    // Commit síncrono: o rótulo "Gerando…" precisa estar no DOM antes do rAF abaixo
    flushSync(() => setExporting('stl'));
    // Pinta o rótulo "Gerando…" antes de bloquear a main thread
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      requestAnimationFrame(() => setTimeout(finish, 0));
      setTimeout(finish, 250);
    });
    try {
      const model = await generatePenHolder(config);
      const buffer = exportToBinarySTL([model.corpoMesh.geometry, model.rimMesh.geometry]);
      const filename = `Porta_Canetas_${safeName(config)}.stl`;
      downloadBlob(new Blob([buffer], { type: 'model/stl' }), filename);
    } catch (err) {
      console.error('Erro ao exportar STL:', err);
    } finally {
      setExporting(null);
    }
  }, [config, exporting]);

  const handleDownload3MF = useCallback(async () => {
    if (exporting) return;
    // Commit síncrono: o rótulo "Gerando…" precisa estar no DOM antes do rAF abaixo
    flushSync(() => setExporting('3mf'));
    // Pinta o rótulo "Gerando…" antes de bloquear a main thread
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      requestAnimationFrame(() => setTimeout(finish, 0));
      setTimeout(finish, 250);
    });
    try {
      const model = await generatePenHolder(config);
      const filename = `Porta_Canetas_${safeName(config)}_Multicolor.3mf`;

      const blob = exportPenHolder3MF(
        model.corpoMesh.geometry,
        model.rimMesh.geometry,
        config.baseColor,
        config.reliefColor,
        filename
      );

      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Erro ao exportar 3MF:', err);
    } finally {
      setExporting(null);
    }
  }, [config, exporting]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      <div className="flex-1 min-w-0">
        <PenHolderCanvas
          config={config}
          dimensions={dimensions}
          onDimensionsChange={setDimensions}
        />
      </div>
      <PenHolderControls
        config={config}
        onChange={handleChange}
        dimensions={dimensions}
        onQuickDownloadSTL={handleDownloadSTL}
        onQuickDownload3MF={handleDownload3MF}
        exporting={exporting}
      />
    </div>
  );
}
