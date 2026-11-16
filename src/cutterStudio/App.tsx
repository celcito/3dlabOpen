import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { ModelLineart, ModelSettings, ViewMode, FilamentColor, PrintEstimation } from './types';
import { PRESET_MODELS } from './data/presets';
import { TopNav } from './components/TopNav';
import { Viewport3D } from './components/Viewport3D';
import { ControlsPanel } from './components/ControlsPanel';
import { ModelLibraryModal } from './components/ModelLibraryModal';
import { LineartEditor } from './components/LineartEditor';
import { TextPlaqueModal } from './components/TextPlaqueModal';
import { PrintGuideModal } from './components/PrintGuideModal';
import { ExportModal } from './components/ExportModal';
import { GoogleShapeModal } from './components/GoogleShapeModal';
import { PrintBedStudio } from './components/PrintBedStudio';
import { estimatePrintParameters } from './utils/stlExporter';
import { generateCutterMesh, generateStampMesh } from './utils/meshGenerator';

const FILAMENTS: FilamentColor[] = [
  { id: 'mint', name: 'Menta Pastel', hex: '#6ee7b7', roughness: 0.45, metalness: 0.1, type: 'matte' },
  { id: 'pink', name: 'Rosa Chiclete', hex: '#f472b6', roughness: 0.45, metalness: 0.1, type: 'matte' },
  { id: 'silk_gold', name: 'Silk Ouro Nobre', hex: '#fbbf24', roughness: 0.25, metalness: 0.55, type: 'silk' },
  { id: 'sky_blue', name: 'Azul Glaciar', hex: '#38bdf8', roughness: 0.4, metalness: 0.15, type: 'matte' },
  { id: 'cookie_dough', name: 'Creme Baunilha', hex: '#fef08a', roughness: 0.6, metalness: 0.05, type: 'matte' },
  { id: 'terracotta', name: 'Terracota Rust', hex: '#fb923c', roughness: 0.6, metalness: 0.05, type: 'matte' },
  { id: 'white', name: 'Branco Puro', hex: '#f8fafc', roughness: 0.4, metalness: 0.05, type: 'matte' },
  { id: 'obsidian', name: 'Grafite Obsidian', hex: '#334155', roughness: 0.4, metalness: 0.25, type: 'matte' },
];

export default function App() {

  // Current active 3D model
  const [activeModel, setActiveModel] = useState<ModelLineart>(PRESET_MODELS[0]);

  // Model parameters (mm scale)
  const [settings, setSettings] = useState<ModelSettings>({
    targetWidth: 75,
    targetHeight: 75,
    lockAspectRatio: true,

    bladeHeight: 15,
    bladeEdgeThickness: 0.9,
    bladeBaseThickness: 1.8,
    lipWidth: 6,
    lipThickness: 2.5,

    stampPlateThickness: 2.8,
    stampDepth: 3.0,
    stampLineThickness: 1.4,
    stampClearance: 1.2,
    airReleaseHoles: true,
    airHoleDiameter: 2.5,
    handleType: 'knob',
    handleHeight: 22,

    customText: '',
    textFont: 'cursive',
    textSize: 22,
    textOffsetY: 0,
    mirrorText: true,

    infillPercent: 20,
    filamentColor: 'mint',
    stampFilamentColor: 'pink',
    showPrintBed: true,
    showDimensions: true,
    wireframe: false,
  });

  // Undo history state: tracks up to the last 5 changes to settings
  const [history, setHistory] = useState<ModelSettings[]>([]);
  const pendingSnapshotRef = React.useRef<ModelSettings | null>(null);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('combo');
  const [doughMode, setDoughMode] = useState<boolean>(false);

  // Modals state
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [isGoogleShapeOpen, setIsGoogleShapeOpen] = useState(false);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPrintBedStudioOpen, setIsPrintBedStudioOpen] = useState(false);

  // Update settings handler with 5-change history tracking
  const handleUpdateSettings = (newPartial: Partial<ModelSettings>) => {
    // Capture snapshot before this modification if not already captured in current interaction
    if (!pendingSnapshotRef.current) {
      pendingSnapshotRef.current = { ...settings };
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce pushing snapshot so continuous slider drags count as 1 change step in history
    debounceTimerRef.current = setTimeout(() => {
      if (pendingSnapshotRef.current) {
        const snapshot = pendingSnapshotRef.current;
        setHistory((prev) => {
          const next = [...prev, snapshot];
          return next.slice(-5); // Keep strictly the last 5 changes
        });
        pendingSnapshotRef.current = null;
      }
    }, 350);

    setSettings((prev) => ({ ...prev, ...newPartial }));
  };

  // Revert settings to previous state in history
  const handleUndo = () => {
    // If there is an active debounce pending, immediately revert to the snapshot before that action started
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (pendingSnapshotRef.current) {
      const targetState = pendingSnapshotRef.current;
      pendingSnapshotRef.current = null;
      setSettings(targetState);
      return;
    }

    if (history.length === 0) return;

    // Pop the most recent settings state from the history stack
    const previousState = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setSettings(previousState);
  };

  // Global Ctrl+Z / Cmd+Z keyboard shortcut for Undo
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isZ = e.key === 'z' || e.key === 'Z';
      const isModifier = e.ctrlKey || e.metaKey;

      if (isZ && isModifier && !e.shiftKey) {
        // Do not intercept if user is typing in an input or textarea
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }

        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Estimate 3D print metrics (memoized)
  const estimation: PrintEstimation = useMemo(() => {
    try {
      const dummyMat = new THREE.MeshBasicMaterial();
      const cutter = generateCutterMesh(activeModel, settings, dummyMat);
      const stamp = generateStampMesh(activeModel, settings, dummyMat);
      return estimatePrintParameters(cutter, stamp, settings.infillPercent);
    } catch {
      return {
        cutterWeightGrams: 14,
        stampWeightGrams: 18,
        totalWeightGrams: 32,
        printTimeMinutes: 45,
        filamentMeters: 10.5,
        trianglesCount: 4200,
      };
    }
  }, [activeModel, settings]);

  return (
    <div className="flex flex-col h-full w-full min-h-0 overflow-hidden bg-[var(--workbench-page)] text-[var(--on-surface)] relative">
      {/* Top Bar Contract (3 zones) */}
      <TopNav
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenCreator={() => setIsCreatorOpen(true)}
        onOpenGoogleShape={() => setIsGoogleShapeOpen(true)}
        onOpenTextModal={() => setIsTextModalOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenPrintBed={() => setIsPrintBedStudioOpen(true)}
        viewMode={viewMode}
        onChangeViewMode={(mode) => {
          setViewMode(mode);
          setDoughMode(false);
        }}
        doughMode={doughMode}
        onUndo={handleUndo}
        canUndo={history.length > 0 || pendingSnapshotRef.current !== null}
        undoCount={history.length + (pendingSnapshotRef.current ? 1 : 0)}
      />

      {/* Main Workspace Area (3D Viewport + Controls Panel) */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* 3D Viewport Zone */}
        <div className="flex-1 relative h-full">
          <Viewport3D
            model={activeModel}
            settings={settings}
            viewMode={viewMode}
            filamentList={FILAMENTS}
            doughMode={doughMode}
            onToggleDoughMode={() => setDoughMode((prev) => !prev)}
          />

          {/* Quick Preset Selector Floating Bar on bottom center */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 hidden sm:flex items-center gap-1.5 p-1.5 bg-[var(--workbench-panel)] backdrop-blur-md border border-[var(--surface-container-highest)] rounded-xl shadow-2xl max-w-[90vw] overflow-x-auto scrollbar-none">
            <span className="text-[11px] font-medium text-[var(--on-surface-variant)] px-2 whitespace-nowrap">
              Modelos Rápidos:
            </span>
            {PRESET_MODELS.slice(0, 8).map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setActiveModel(preset);
                  setDoughMode(false);
                  setHistory([]);
                  pendingSnapshotRef.current = null;
                }}
                className={`px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                  activeModel.id === preset.id
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] font-semibold shadow'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]'
                }`}
              >
                {preset.name}
              </button>
            ))}
            <button
              onClick={() => setIsLibraryOpen(true)}
              className="px-2.5 py-1 text-xs text-[var(--primary)] hover:text-[var(--primary)] font-medium whitespace-nowrap"
            >
              Ver Todos ({PRESET_MODELS.length}) →
            </button>
          </div>
        </div>

        {/* Right Sidebar Controls Panel */}
        <ControlsPanel
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          filamentList={FILAMENTS}
          estimation={estimation}
          onUndo={handleUndo}
          canUndo={history.length > 0 || pendingSnapshotRef.current !== null}
          undoCount={history.length + (pendingSnapshotRef.current ? 1 : 0)}
          activeModelId={activeModel.id}
          onSelectBaseShape={(model) => {
            setActiveModel(model);
            setDoughMode(false);
          }}
          onOpenCreator={() => setIsCreatorOpen(true)}
          onOpenGoogleShape={() => setIsGoogleShapeOpen(true)}
          onOpenTextModal={() => setIsTextModalOpen(true)}
          onOpenPrintBed={() => setIsPrintBedStudioOpen(true)}
        />
      </main>

      {/* Modals & Dialogs */}
      <ModelLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        activeModelId={activeModel.id}
        onSelectModel={(model) => {
          setActiveModel(model);
          setDoughMode(false);
          setHistory([]);
          pendingSnapshotRef.current = null;
        }}
      />

      <LineartEditor
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onApplyCustomModel={(model) => {
          setActiveModel(model);
          setDoughMode(false);
          setHistory([]);
          pendingSnapshotRef.current = null;
        }}
      />

      <GoogleShapeModal
        isOpen={isGoogleShapeOpen}
        onClose={() => setIsGoogleShapeOpen(false)}
        onApplyCustomModel={(model) => {
          setActiveModel(model);
          setDoughMode(false);
          setHistory([]);
          pendingSnapshotRef.current = null;
        }}
      />

      <TextPlaqueModal
        isOpen={isTextModalOpen}
        onClose={() => setIsTextModalOpen(false)}
        onApplyCustomModel={(model) => {
          setActiveModel(model);
          setDoughMode(false);
          setHistory([]);
          pendingSnapshotRef.current = null;
        }}
        onApplyTextToCurrentStamp={(text, font) => {
          handleUpdateSettings({ customText: text, textFont: font });
          setDoughMode(false);
        }}
        currentModelName={activeModel.name}
      />

      <PrintGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        model={activeModel}
        settings={settings}
        estimation={estimation}
        onOpenPrintBed={() => setIsPrintBedStudioOpen(true)}
      />

      <PrintBedStudio
        isOpen={isPrintBedStudioOpen}
        onClose={() => setIsPrintBedStudioOpen(false)}
        activeModel={activeModel}
        activeSettings={settings}
        filamentList={FILAMENTS}
      />
    </div>
  );
}
