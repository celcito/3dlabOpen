import { useState, useCallback } from 'react';
import type { PencilTopperConfig, Model3DDimensions } from '../types/pencilTopper';
import { loadSavedPencilConfig, savePencilConfigToStorage } from '../lib/pencilTopper/storage';
import { exportPencilTopper3MF } from '../lib/pencilTopper/threeMfExporter';
import { downloadBlob } from '../lib/pencilTopper/stlExporter';
import { generatePencilTopperModel } from '../lib/pencilTopper/geometry';
import { PencilCanvas } from '../components/PencilCanvas';
import { PencilTopperControls } from '../components/PencilTopperControls';
import { PencilExportModal } from '../components/PencilExportModal';
import { SvgConverterModal } from '../components/SvgConverterModal';

export default function PencilTopperCreator() {
  const [config, setConfig] = useState<PencilTopperConfig>(loadSavedPencilConfig);
  const [dimensions, setDimensions] = useState<Model3DDimensions>({
    dimX: 0, dimY: 0, dimZ: 0, volumeCm3: 0, weightGrams: 0, printTimeMinutes: 0,
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSvgModalOpen, setIsSvgModalOpen] = useState(false);

  const handleChange = useCallback((newConfig: PencilTopperConfig) => {
    setConfig(newConfig);
    savePencilConfigToStorage(newConfig);
  }, []);

  const handleQuickDownload3MF = useCallback(async () => {
    try {
      const model = await generatePencilTopperModel(config);
      const safeText = config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'Ponteira';
      const filename = `Ponteira_Lapis_${safeText}_Multicolor.3mf`;

      const blob = await exportPencilTopper3MF(
        model.baseMesh.geometry,
        model.reliefMesh.geometry,
        config.baseColor,
        config.reliefColor,
        filename
      );

      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Erro ao exportar 3MF:', err);
    }
  }, [config]);

  const handleApplyIcon = useCallback((svgDataUrl: string, _name: string) => {
    handleChange({ ...config, customIconUrl: svgDataUrl });
  }, [config, handleChange]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      <div className="flex-1 min-w-0">
        <PencilCanvas
          config={config}
          onDimensionsChange={setDimensions}
          onOpenExportModal={() => setIsExportModalOpen(true)}
        />
      </div>
      <PencilTopperControls
        config={config}
        onChange={handleChange}
        dimensions={dimensions}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onQuickDownload3MF={handleQuickDownload3MF}
        onOpenSvgConverter={() => setIsSvgModalOpen(true)}
      />
      <PencilExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        config={config}
        dimensions={dimensions}
      />
      <SvgConverterModal
        isOpen={isSvgModalOpen}
        onClose={() => setIsSvgModalOpen(false)}
        onApplyIcon={handleApplyIcon}
      />
    </div>
  );
}
