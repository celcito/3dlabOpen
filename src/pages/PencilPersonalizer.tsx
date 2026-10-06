import { useState, useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { GeneratedPencilPersonal, PencilPersonalConfig } from '../types/pencilPersonal';
import {
  loadSavedPencilPersonalConfig,
  savePencilPersonalConfigToStorage,
} from '../lib/pencilPersonal/storage';
import { fetchPencilPackage, type PencilPackage } from '../lib/pencilPersonal/package';
import { generatePencilPersonal } from '../lib/pencilPersonal/geometry';
import { exportPersonalizedPencil } from '../lib/pencilPersonal/exporter';
import { downloadBlob } from '../lib/pencilTopper/stlExporter';
import { PencilPersonalCanvas } from '../components/PencilPersonalCanvas';
import { PencilPersonalControls } from '../components/PencilPersonalControls';

function safeName(config: PencilPersonalConfig): string {
  return config.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'Lapis';
}

const DEBOUNCE_MS = 320;

export default function PencilPersonalizer() {
  const [config, setConfig] = useState<PencilPersonalConfig>(loadSavedPencilPersonalConfig);
  const [pkg, setPkg] = useState<PencilPackage | null>(null);
  const [generated, setGenerated] = useState<GeneratedPencilPersonal | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const generatedRef = useRef<GeneratedPencilPersonal | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPencilPackage()
      .then((loaded) => {
        if (!cancelled) setPkg(loaded);
      })
      .catch((err) => {
        console.error('Erro ao carregar o modelo do lápis:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback((newConfig: PencilPersonalConfig) => {
    setConfig(newConfig);
    savePencilPersonalConfigToStorage(newConfig);
  }, []);

  // CSG com debounce; a geometria anterior só é descartada depois do canvas trocar
  useEffect(() => {
    if (!pkg) return;
    let cancelled = false;
    setIsGenerating(true);
    const timeout = setTimeout(() => {
      generatePencilPersonal(pkg.bodyPart.geometry, config)
        .then((result) => {
          if (cancelled) return;
          const previous = generatedRef.current;
          generatedRef.current = result;
          setGenerated(result);
          if (previous) previous.letters.dispose();
        })
        .catch((err) => {
          console.error('Erro ao gerar a gravação do lápis:', err);
          if (!cancelled) setIsGenerating(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [pkg, config]);

  // Limpa o rótulo assim que o resultado chega
  useEffect(() => {
    if (generated) setIsGenerating(false);
  }, [generated]);

  const handleExport = useCallback(async () => {
    if (exporting || !pkg) return;
    // Commit síncrono: o rótulo "Gerando…" precisa estar no DOM antes do rAF abaixo
    flushSync(() => setExporting(true));
    // Pinta o rótulo "Gerando…" antes de bloquear a main thread com o CSG
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      requestAnimationFrame(() => setTimeout(finish, 0));
      setTimeout(finish, 250);
    });
    try {
      const result = generatedRef.current || (await generatePencilPersonal(pkg.bodyPart.geometry, config));
      const blob = exportPersonalizedPencil({
        source: pkg.source,
        bodyGraved: result.bodyGraved,
        letters: result.letters,
        filamentIndex: config.filamentIndex,
        text: config.text.trim() || 'Nome',
      });
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      downloadBlob(blob, `Lapis_${safeName(config)}_${timestamp}.3mf`);
    } catch (err) {
      console.error('Erro ao exportar 3MF:', err);
    } finally {
      setExporting(false);
    }
  }, [config, exporting, pkg]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      <div className="flex-1 min-w-0">
        <PencilPersonalCanvas
          pkg={pkg}
          config={config}
          generated={generated}
          isGenerating={isGenerating}
        />
      </div>
      <PencilPersonalControls
        config={config}
        onChange={handleChange}
        generated={generated}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}
