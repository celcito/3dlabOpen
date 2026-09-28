import { useState, useCallback } from 'react';
import type { LetterBoxConfig, Model3DDimensions } from '../types/letterBox';
import { loadSavedConfig, saveConfigToStorage } from '../lib/letterBox/storage';
import { generateLetterBoxModel } from '../lib/letterBox/geometry';
import { exportToMulticolor3MF } from '../lib/letterBox/threeMfExporter';
import { downloadBlob } from '../lib/pencilTopper/stlExporter';
import { ThreeCanvas } from '../components/ThreeCanvas';
import { SidebarControls } from '../components/SidebarControls';

export default function LetterBoxCreator() {
  const [config, setConfig] = useState<LetterBoxConfig>(loadSavedConfig);
  const [dimensions, setDimensions] = useState<Model3DDimensions>({
    dimX: 0, dimY: 0, dimZ: 0, volumeCm3: 0, weightGrams: 0, printTimeMinutes: 0,
  });

  const handleChange = useCallback((newConfig: LetterBoxConfig) => {
    setConfig(newConfig);
    saveConfigToStorage(newConfig);
  }, []);

  const handleQuickDownload3MF = useCallback(async () => {
    try {
      const model = await generateLetterBoxModel(config);
      const safeText = config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'LetraCaixa';
      const filename = `LetraCaixa3D_${safeText}_${config.letterHeight}mm_Multicolor.3mf`;

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
    } catch (err) {
      console.error('Erro ao exportar 3MF:', err);
    }
  }, [config]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      <div className="flex-1 min-w-0">
        <ThreeCanvas
          config={config}
          onDimensionsChange={setDimensions}
        />
      </div>
      <SidebarControls
        config={config}
        onChange={handleChange}
        dimensions={dimensions}
        onQuickDownload3MF={handleQuickDownload3MF}
      />
    </div>
  );
}
