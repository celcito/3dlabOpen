import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ThermoformConfig, ThermoformKitDimensions } from '../types/thermoform';
import { loadSavedThermoformConfig, saveThermoformConfigToStorage } from '../lib/thermoform/storage';
import { generateThermoformKit } from '../lib/thermoform/geometry';
import { SHEET_SLICER_OVERRIDES, exportThermoform3MF, type Thermoform3MFItem } from '../lib/thermoform/threeMfExporter';
import { exportThermoformStlZip } from '../lib/thermoform/stlKit';
import { downloadBlob } from '../lib/pencilTopper/stlExporter';
import { ThermoformCanvas } from '../components/ThermoformCanvas';
import { ThermoformControls } from '../components/ThermoformControls';

const PART_LABELS: Record<string, string> = {
  mold: 'Molde',
  press: 'Prensa',
  folha: 'Folha',
  encaixe: 'Encaixe',
  cabo: 'Cabo',
};

function partColor(config: ThermoformConfig, partId: string): string {
  switch (partId) {
    case 'mold':
      return config.moldColor;
    case 'press':
      return config.pressColor;
    case 'folha':
      return config.folhaColor;
    case 'cabo':
      return config.caboColor;
    default:
      return config.clipColor;
  }
}

export default function ThermoformCreator() {
  const [config, setConfig] = useState<ThermoformConfig>(loadSavedThermoformConfig);
  const [dimensions, setDimensions] = useState<ThermoformKitDimensions>({
    dimX: 0,
    dimY: 0,
    dimZ: 0,
    partCount: 0,
  });
  const [exporting, setExporting] = useState<'stl' | '3mf' | null>(null);

  const handleChange = useCallback((newConfig: ThermoformConfig) => {
    setConfig(newConfig);
    saveThermoformConfigToStorage(newConfig);
  }, []);

  const handleDownloadSTL = useCallback(async () => {
    if (exporting) return;
    flushSync(() => setExporting('stl'));
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      requestAnimationFrame(() => setTimeout(finish, 0));
      setTimeout(finish, 250);
    });
    try {
      const kit = generateThermoformKit(config);
      if (!kit) return;
      const blob = exportThermoformStlZip(
        kit.parts.map((part) => ({ id: part.id, geoms: part.geoms }))
      );
      downloadBlob(blob, `Termoformado_${config.svgPathData ? 'custom' : config.preset}_STL.zip`);
    } catch (err) {
      console.error('Erro ao exportar STL zip:', err);
    } finally {
      setExporting(null);
    }
  }, [config, exporting]);

  const handleDownload3MF = useCallback(async () => {
    if (exporting) return;
    flushSync(() => setExporting('3mf'));
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      requestAnimationFrame(() => setTimeout(finish, 0));
      setTimeout(finish, 250);
    });
    try {
      const kit = generateThermoformKit(config);
      if (!kit) return;
      const items: Thermoform3MFItem[] = kit.parts.map((part) => ({
        geoms: part.geoms,
        name: PART_LABELS[part.id] ?? part.id,
        color: partColor(config, part.id),
        // A folha recebe a malha honeycomb/shells 0 do fatiador (D2).
        overrides: part.id === 'folha' ? SHEET_SLICER_OVERRIDES : undefined,
      }));
      const filename = `Termoformado_${config.svgPathData ? 'custom' : config.preset}_Bambu.3mf`;
      downloadBlob(exportThermoform3MF(items, filename), filename);
    } catch (err) {
      console.error('Erro ao exportar 3MF:', err);
    } finally {
      setExporting(null);
    }
  }, [config, exporting]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      <div className="flex-1 min-w-0">
        <ThermoformCanvas config={config} onDimensionsChange={setDimensions} />
      </div>
      <ThermoformControls
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
