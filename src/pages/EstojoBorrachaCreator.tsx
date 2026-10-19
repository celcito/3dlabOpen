import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { EstojoBorrachaConfig, EstojoDimensions } from '../types/estojoBorracha';
import { loadSavedEstojoConfig, saveEstojoConfigToStorage } from '../lib/estojoBorracha/storage';
import { generateEstojoModel } from '../lib/estojoBorracha/geometry';
import { exportEstojo3MF } from '../lib/estojoBorracha/threeMfExporter';
import { exportToBinarySTL, downloadBlob } from '../lib/pencilTopper/stlExporter';
import { EstojoBorrachaCanvas } from '../components/EstojoBorrachaCanvas';
import { EstojoBorrachaControls } from '../components/EstojoBorrachaControls';

function safeName(config: EstojoBorrachaConfig): string {
  return config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'Estojo';
}

export default function EstojoBorrachaCreator() {
  const [config, setConfig] = useState<EstojoBorrachaConfig>(loadSavedEstojoConfig);
  const [dimensions, setDimensions] = useState<EstojoDimensions>({
    dimX: 0, dimY: 0, dimZ: 0, volumeCm3: 0, weightGrams: 0, printTimeMinutes: 0, cursoMax: 0, nameWidthMm: 0,
  });
  const [exporting, setExporting] = useState<'stl' | '3mf' | null>(null);

  const handleChange = useCallback((newConfig: EstojoBorrachaConfig) => {
    setConfig(newConfig);
    saveEstojoConfigToStorage(newConfig);
  }, []);

  const handleDownloadSTL = useCallback(async () => {
    if (exporting) return;
    flushSync(() => setExporting('stl'));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 0));
      setTimeout(resolve, 250);
    });
    try {
      const model = await generateEstojoModel(config);
      const name = safeName(config);
      const parts: Array<[string, import('three').BufferGeometry]> = [
        ['Caixa', model.caixaMesh.geometry],
        ['Porta', model.portaMesh.geometry],
        ['Plugue', model.plugueMesh.geometry],
        ['Capa', model.capaMesh.geometry],
      ];
      for (const [part, geom] of parts) {
        const buffer = exportToBinarySTL([geom]);
        downloadBlob(new Blob([buffer], { type: 'model/stl' }), `Estojo_${name}_${part}.stl`);
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (err) {
      console.error('Erro ao exportar STL:', err);
    } finally {
      setExporting(null);
    }
  }, [config, exporting]);

  const handleDownload3MF = useCallback(async () => {
    if (exporting) return;
    flushSync(() => setExporting('3mf'));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 0));
      setTimeout(resolve, 250);
    });
    try {
      const model = await generateEstojoModel(config);
      const filename = `Estojo_${safeName(config)}_Multicolor.3mf`;
      const blob = exportEstojo3MF(
        {
          caixa: model.caixaMesh.geometry,
          porta: model.portaMesh.geometry,
          plugue: model.plugueMesh.geometry,
          capa: model.capaMesh.geometry,
        },
        config.caixaColor,
        config.capaColor,
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
        <EstojoBorrachaCanvas config={config} onDimensionsChange={setDimensions} />
      </div>
      <EstojoBorrachaControls
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
