import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { MedalConfig, Model3DDimensions } from '../types/medal';
import { loadSavedMedalConfig, saveMedalConfigToStorage } from '../lib/medal/storage';
import { exportMedal3MF } from '../lib/medal/threeMfExporter';
import { downloadBlob } from '../lib/pencilTopper/stlExporter';
import { generateMedalModel } from '../lib/medal/geometry';
import { MedalCanvas } from '../components/MedalCanvas';
import { MedalControls } from '../components/MedalControls';
import { SvgConverterModal } from '../components/SvgConverterModal';

function safeName(config: MedalConfig): string {
  const text = config.topText || config.centerText || 'Medalha';
  return text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'Medalha';
}

export default function MedalCreator() {
  const [config, setConfig] = useState<MedalConfig>(loadSavedMedalConfig);
  const [dimensions, setDimensions] = useState<Model3DDimensions>({
    dimX: 0, dimY: 0, dimZ: 0, volumeCm3: 0, weightGrams: 0, printTimeMinutes: 0,
  });
  const [isSvgModalOpen, setIsSvgModalOpen] = useState(false);
  const [exporting, setExporting] = useState<'3mf' | null>(null);

  const handleChange = useCallback((newConfig: MedalConfig) => {
    setConfig(newConfig);
    saveMedalConfigToStorage(newConfig);
  }, []);

  const handleQuickDownload3MF = useCallback(async () => {
    if (exporting) return;
    // Commit síncrono: o rótulo "Gerando…" precisa estar no DOM antes do rAF abaixo
    flushSync(() => setExporting('3mf'));
    // Pinta o rótulo antes de bloquear a main thread com a geração da malha
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      requestAnimationFrame(() => setTimeout(finish, 0));
      setTimeout(finish, 250);
    });
    try {
      const model = await generateMedalModel(config);
      const handleColor = config.handleColorSync ? config.rimColor : config.handleColor;
      const items = [
        model.baseMesh
          ? { geom: model.baseMesh.geometry, color: config.backgroundColor, name: '1_Base_da_Medalha' }
          : null,
        model.reliefMesh
          ? { geom: model.reliefMesh.geometry, color: config.rimColor, name: '2_Borda_e_Relevo' }
          : null,
        model.handleMesh
          ? { geom: model.handleMesh.geometry, color: handleColor, name: '3_Passador_de_Fita' }
          : null,
      ].filter(Boolean) as { geom: import('three').BufferGeometry; color: string; name: string }[];

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `Medalha_${safeName(config)}_${timestamp}.3mf`;

      const blob = await exportMedal3MF(items, filename.replace(/\.3mf$/, ''));
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Erro ao exportar 3MF:', err);
    } finally {
      setExporting(null);
    }
  }, [config, exporting]);

  const handleApplyArt = useCallback((svgDataUrl: string, name: string) => {
    handleChange({ ...config, artUrl: svgDataUrl, artName: name });
  }, [config, handleChange]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      <div className="flex-1 min-w-0">
        <MedalCanvas
          config={config}
          onDimensionsChange={setDimensions}
        />
      </div>
      <MedalControls
        config={config}
        onChange={handleChange}
        dimensions={dimensions}
        onQuickDownload3MF={handleQuickDownload3MF}
        onOpenSvgConverter={() => setIsSvgModalOpen(true)}
        exporting={exporting}
      />
      <SvgConverterModal
        isOpen={isSvgModalOpen}
        onClose={() => setIsSvgModalOpen(false)}
        onApplyIcon={handleApplyArt}
      />
    </div>
  );
}
