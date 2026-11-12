import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { KeychainConfig, Model3DDimensions } from '../types/keychain';
import { loadSavedKeychainConfig, saveKeychainConfigToStorage } from '../lib/keychain/storage';
import { exportPencilTopper3MF } from '../lib/pencilTopper/threeMfExporter';
import { exportToBinarySTL, downloadBlob } from '../lib/pencilTopper/stlExporter';
import { generateKeychainModel } from '../lib/keychain/geometry';
import { KeychainCanvas } from '../components/KeychainCanvas';
import { KeychainControls } from '../components/KeychainControls';
import { SvgConverterModal } from '../components/SvgConverterModal';

const KEYCHAIN_3MF_META = {
  application: '3D Lab Open Chaveiro Personalizado 3D Parametrico',
  baseObjectName: '1_Corpo_do_Chaveiro',
  reliefObjectName: '2_Nome_em_Relevo',
  singleColor: true,
};

function safeName(config: KeychainConfig): string {
  return config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'Chaveiro';
}

export default function KeychainCreator() {
  const [config, setConfig] = useState<KeychainConfig>(loadSavedKeychainConfig);
  const [dimensions, setDimensions] = useState<Model3DDimensions>({
    dimX: 0, dimY: 0, dimZ: 0, volumeCm3: 0, weightGrams: 0, printTimeMinutes: 0,
  });
  const [isSvgModalOpen, setIsSvgModalOpen] = useState(false);
  const [exporting, setExporting] = useState<'stl' | '3mf' | null>(null);

  const handleChange = useCallback((newConfig: KeychainConfig) => {
    setConfig(newConfig);
    saveKeychainConfigToStorage(newConfig);
  }, []);

  const handleDownloadSTL = useCallback(async () => {
    if (exporting) return;
    // Commit síncrono: o rótulo "Gerando…" precisa estar no DOM antes do rAF abaixo
    flushSync(() => setExporting('stl'));
    // Pinta o rótulo "Gerando…" antes de bloquear a main thread com o CSG
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      requestAnimationFrame(() => setTimeout(finish, 0));
      setTimeout(finish, 250);
    });
    try {
      const model = await generateKeychainModel(config);
      const buffer = exportToBinarySTL([model.baseMesh.geometry, model.reliefMesh.geometry]);
      const filename = `Chaveiro_${safeName(config)}.stl`;
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
    // Pinta o rótulo "Gerando…" antes de bloquear a main thread com o CSG
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      requestAnimationFrame(() => setTimeout(finish, 0));
      setTimeout(finish, 250);
    });
    try {
      const model = await generateKeychainModel(config);
      const filename = `Chaveiro_${safeName(config)}.3mf`;

      const blob = await exportPencilTopper3MF(
        model.baseMesh.geometry,
        model.reliefMesh.geometry,
        config.baseColor,
        config.reliefColor,
        filename,
        KEYCHAIN_3MF_META
      );

      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Erro ao exportar 3MF:', err);
    } finally {
      setExporting(null);
    }
  }, [config, exporting]);

  const handleApplyIcon = useCallback((svgDataUrl: string, _name: string) => {
    handleChange({ ...config, customIconUrl: svgDataUrl });
  }, [config, handleChange]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      <div className="flex-1 min-w-0">
        <KeychainCanvas
          config={config}
          dimensions={dimensions}
          onDimensionsChange={setDimensions}
        />
      </div>
      <KeychainControls
        config={config}
        onChange={handleChange}
        dimensions={dimensions}
        onQuickDownloadSTL={handleDownloadSTL}
        onQuickDownload3MF={handleDownload3MF}
        onOpenSvgConverter={() => setIsSvgModalOpen(true)}
        exporting={exporting}
      />
      <SvgConverterModal
        isOpen={isSvgModalOpen}
        onClose={() => setIsSvgModalOpen(false)}
        onApplyIcon={handleApplyIcon}
      />
    </div>
  );
}
