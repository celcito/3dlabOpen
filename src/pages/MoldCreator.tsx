import { useCallback, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import type {
  MoldBounds,
  MoldBuildResult,
  MoldConfig,
  MoldModelInfo,
  MoldSampleId,
  MoldViewMode,
} from '../types/mold';
import { MOLD_SAMPLES } from '../types/mold';
import { createSampleModel, geometryStats, prepareTargetGeometry } from '../lib/mold/generator';
import { parseModelFile } from '../lib/mold/loader';
import { exportMold3MF, exportMoldPackage } from '../lib/mold/exportKit';
import { loadSavedMoldState, saveMoldStateToStorage } from '../lib/mold/storage';
import { downloadBlob } from '../lib/pencilTopper/stlExporter';
import { MoldCanvas } from '../components/MoldCanvas';
import { MoldControls } from '../components/MoldControls';

const EMPTY_BOUNDS: MoldBounds & { triangles: number } = {
  width: 0,
  height: 0,
  depth: 0,
  triangles: 0,
};

function sampleInfo(sample: MoldSampleId, targetSizeMm: number): MoldModelInfo {
  const label = MOLD_SAMPLES.find((item) => item.id === sample)?.label ?? 'Amostra';
  const stats = geometryStats(prepareTargetGeometry(createSampleModel(sample), targetSizeMm));
  return {
    name: label,
    sizeLabel: 'amostra',
    triangles: stats.triangles,
    dimensions: { width: stats.width, height: stats.height, depth: stats.depth },
  };
}

export default function MoldCreator() {
  const [initial] = useState(loadSavedMoldState);
  const [sample] = useState<MoldSampleId>('urso');
  const [rawGeometry, setRawGeometry] = useState<THREE.BufferGeometry>(() =>
    createSampleModel('urso')
  );
  const [targetSizeMm, setTargetSizeMm] = useState(initial.targetSizeMm);
  const [config, setConfig] = useState<MoldConfig>(initial.config);
  const [viewMode, setViewMode] = useState<MoldViewMode>('mold');
  const [modelInfo, setModelInfo] = useState<MoldModelInfo | null>(() =>
    sampleInfo(sample, initial.targetSizeMm)
  );
  const [build, setBuild] = useState<MoldBuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'stl' | '3mf' | null>(null);
  const buildRef = useRef<MoldBuildResult | null>(null);

  const targetGeometry = useMemo(
    () => prepareTargetGeometry(rawGeometry, targetSizeMm),
    [rawGeometry, targetSizeMm]
  );

  const handleBuildChange = useCallback((nextBuild: MoldBuildResult | null) => {
    buildRef.current = nextBuild;
    setBuild(nextBuild);
  }, []);

  const handleError = useCallback((message: string | null) => setError(message), []);

  const handleConfigChange = useCallback(
    (nextConfig: MoldConfig) => {
      setConfig(nextConfig);
      saveMoldStateToStorage({ config: nextConfig, targetSizeMm });
    },
    [targetSizeMm]
  );

  const handleTargetSizeChange = useCallback(
    (size: number) => {
      setTargetSizeMm(size);
      saveMoldStateToStorage({ config, targetSizeMm: size });
    },
    [config]
  );

  const handleSelectSample = useCallback(
    (nextSample: MoldSampleId) => {
      const geometry = createSampleModel(nextSample);
      setRawGeometry(geometry);
      const prepared = prepareTargetGeometry(geometry, targetSizeMm);
      const stats = geometryStats(prepared);
      setModelInfo({
        name: MOLD_SAMPLES.find((item) => item.id === nextSample)?.label ?? 'Amostra',
        sizeLabel: 'amostra',
        triangles: stats.triangles,
        dimensions: { width: stats.width, height: stats.height, depth: stats.depth },
      });
    },
    [targetSizeMm]
  );

  const handleUploadFile = useCallback(
    async (file: File) => {
      try {
        const parsed = await parseModelFile(file);
        setRawGeometry(parsed.geometry);
        setModelInfo({
          name: parsed.fileName,
          sizeLabel: parsed.sizeLabel,
          triangles: parsed.triangles,
          dimensions: parsed.dimensions,
        });
        setError(null);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : 'Não foi possível ler o arquivo enviado.'
        );
      }
    },
    []
  );

  const handleDownloadSTL = useCallback(async () => {
    const current = buildRef.current;
    if (!current || exporting) return;
    setExporting('stl');
    try {
      const { blob, filename } = exportMoldPackage(
        modelInfo?.name ?? 'modelo',
        config,
        current
      );
      downloadBlob(blob, filename);
    } catch (exportError) {
      console.error('Erro ao exportar molde:', exportError);
      setError('Falha ao montar o pacote STL. Tente um modelo com menos triângulos.');
    } finally {
      setExporting(null);
    }
  }, [config, exporting, modelInfo]);

  const handleDownload3MF = useCallback(async () => {
    const current = buildRef.current;
    if (!current || exporting) return;
    setExporting('3mf');
    try {
      const { blob, filename } = exportMold3MF(modelInfo?.name ?? 'modelo', config, current);
      downloadBlob(blob, filename);
    } catch (exportError) {
      console.error('Erro ao exportar 3MF:', exportError);
      setError('Falha ao montar o 3MF. Tente um modelo com menos triângulos.');
    } finally {
      setExporting(null);
    }
  }, [config, exporting, modelInfo]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      <div className="flex-1 min-w-0">
        <MoldCanvas
          targetGeometry={targetGeometry}
          config={config}
          viewMode={viewMode}
          onBuildChange={handleBuildChange}
          onError={handleError}
        />
      </div>
      <MoldControls
        config={config}
        onChange={handleConfigChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        targetSizeMm={targetSizeMm}
        onTargetSizeChange={handleTargetSizeChange}
        onSelectSample={handleSelectSample}
        onUploadFile={handleUploadFile}
        modelInfo={modelInfo}
        bounds={build?.bounds ? { ...build.bounds, triangles: build.triangles } : EMPTY_BOUNDS}
        exporting={exporting}
        onDownloadSTL={handleDownloadSTL}
        onDownload3MF={handleDownload3MF}
        error={error}
      />
    </div>
  );
}
