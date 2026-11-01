import { useState, useCallback, useRef } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { traceImage } from "../lib/imageTools/traceImage";
import {
  TopperConfig,
  TopperElement,
  THEMES,
  validateForPrint,
  PrintIssue,
  defaultSticks,
  DEFAULT_TOPPER_CONFIG,
} from "../lib/cakeTopper/cakeTopperGeometry";
import { validatePlaqueForPrint } from "../lib/cakeTopper/plaqueGeometry";
import type { PlaqueStyle } from "../lib/cakeTopper/plaque";
import type { KeychainConfig } from "../types/keychain";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const defaultConfig: TopperConfig = DEFAULT_TOPPER_CONFIG;

interface HistoryEntry {
  config: TopperConfig;
  selectedElementId: string | null;
}

export function useCakeTopperCreator() {
  const [config, setConfig] = useState<TopperConfig>(defaultConfig);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [printIssues, setPrintIssues] = useState<PrintIssue[]>([]);
  const [showIssues, setShowIssues] = useState(false);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showCakePreview, setShowCakePreview] = useState(false);
  const [modelColor, setModelColor] = useState("#FF6B9D");

  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isHistoryAction = useRef(false);

  const pushHistory = useCallback((cfg: TopperConfig, selId: string | null) => {
    if (isHistoryAction.current) return;
    const entry: HistoryEntry = { config: { ...cfg, elements: [...cfg.elements], sticks: [...cfg.sticks] }, selectedElementId: selId };
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    history.splice(idx + 1, history.length, entry);
    historyIndexRef.current = history.length - 1;
    if (history.length > 50) {
      history.shift();
      historyIndexRef.current--;
    }
  }, []);

  const updateConfig = useCallback((patch: Partial<TopperConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      if (patch.plateWidth !== undefined || patch.stickCount !== undefined || patch.stickHeight !== undefined || patch.stickThickness !== undefined || patch.stickWidth !== undefined || patch.stickSpacing !== undefined) {
        next.sticks = defaultSticks(
          patch.stickCount ?? prev.stickCount,
          patch.plateWidth ?? prev.plateWidth,
          patch.stickHeight ?? prev.stickHeight,
          patch.stickThickness ?? prev.stickThickness,
          patch.stickWidth ?? prev.stickWidth,
          patch.stickSpacing !== undefined ? patch.stickSpacing : prev.stickSpacing
        );
      }
      next.totalHeight = (patch.plateHeight ?? prev.plateHeight) + (patch.stickHeight ?? prev.stickHeight);
      next.totalWidth = patch.plateWidth ?? prev.plateWidth;
      pushHistory(next, selectedElementId);
      return next;
    });
  }, [selectedElementId, pushHistory]);

  const applyTheme = useCallback((themeName: string) => {
    const theme = THEMES[themeName];
    if (!theme) return;
    setConfig((prev) => {
      const next = {
        ...prev,
        ...theme.elements,
        plateColor: theme.plateColor,
        textColor: theme.textColor,
        borderColor: theme.borderColor,
        stickColor: theme.plateColor,
        theme: themeName,
      };
      pushHistory(next, null);
      return next;
    });
    setSelectedElementId(null);
  }, [pushHistory]);

  const addElement = useCallback((type: TopperElement["type"], content: string, shapeType?: string) => {
    const el: TopperElement = {
      id: uid(),
      type,
      content,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      color: config.textColor,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      shapeType,
      zIndex: config.elements.length,
    };
    setConfig((prev) => {
      const next = { ...prev, elements: [...prev.elements, el] };
      pushHistory(next, el.id);
      return next;
    });
    setSelectedElementId(el.id);
  }, [config.textColor, config.fontSize, config.fontFamily, pushHistory]);

  const updateElement = useCallback((id: string, patch: Partial<TopperElement>) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        elements: prev.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      };
      pushHistory(next, selectedElementId);
      return next;
    });
  }, [selectedElementId, pushHistory]);

  const removeElement = useCallback((id: string) => {
    setConfig((prev) => {
      const next = { ...prev, elements: prev.elements.filter((el) => el.id !== id) };
      pushHistory(next, null);
      return next;
    });
    setSelectedElementId(null);
  }, [pushHistory]);

  const duplicateElement = useCallback((id: string) => {
    setConfig((prev) => {
      const el = prev.elements.find((e) => e.id === id);
      if (!el) return prev;
      const newEl = { ...el, id: uid(), x: el.x + 5, y: el.y + 5, zIndex: prev.elements.length };
      const next = { ...prev, elements: [...prev.elements, newEl] };
      pushHistory(next, newEl.id);
      return next;
    });
  }, [pushHistory]);

  const groupElements = useCallback((ids: string[]) => {
    // Simple grouping: move all to center of bounding box
    setConfig((prev) => {
      const els = prev.elements.filter((e) => ids.includes(e.id));
      if (els.length < 2) return prev;
      const cx = els.reduce((s, e) => s + e.x, 0) / els.length;
      const cy = els.reduce((s, e) => s + e.y, 0) / els.length;
      const next = {
        ...prev,
        elements: prev.elements.map((e) =>
          ids.includes(e.id) ? { ...e, x: e.x - cx, y: e.y - cy } : e
        ),
      };
      pushHistory(next, selectedElementId);
      return next;
    });
  }, [selectedElementId, pushHistory]);

  /** Trace a raster image (PNG, JPG, etc.) into a silhouette shape and add as element */
  const uploadImageFile = useCallback(async (file: File, targetWidthMm?: number) => {
    const width = targetWidthMm || 30;
    try {
      const traced = await traceImage(file, width, {
        numberOfColors: 3,
        pathOmit: 32,
        removeBackground: true,
      });
      // Serialize the outer shape to SVG string for storage
      const svgStr = traced.svg;
      const el: TopperElement = {
        id: uid(),
        type: "image",
        content: file.name.replace(/\.[^.]+$/, ""),
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        color: config.textColor,
        svgData: svgStr,
        widthMm: traced.widthMm,
        heightMm: traced.heightMm,
        zIndex: config.elements.length,
      };
      setConfig((prev) => {
        const next = { ...prev, elements: [...prev.elements, el] };
        pushHistory(next, el.id);
        return next;
      });
      setSelectedElementId(el.id);
    } catch (err) {
      console.error("Image trace error:", err);
    }
  }, [config.textColor, config.elements.length, pushHistory]);

  /** Parse an SVG file into shapes and add as element */
  const uploadSvgFile = useCallback(async (file: File, targetWidthMm?: number) => {
    const text = await file.text();
    const width = targetWidthMm || 30;
    try {
      const parser = new SVGLoader();
      const svgData = parser.parse(text);
      // Compute bounding box of all paths
      const allPoints: THREE.Vector2[] = [];
      for (const path of svgData.paths) {
        for (const sub of path.subPaths) {
          const pts = sub.getPoints(20);
          pts.forEach((p) => allPoints.push(p));
        }
      }
      if (allPoints.length === 0) return;
      const box = new THREE.Box2();
      allPoints.forEach((p) => box.expandByPoint(p));
      const sizeX = box.max.x - box.min.x;
      const sizeY = box.max.y - box.min.y;
      const maxDim = Math.max(sizeX, sizeY) || 1;
      const scale = width / maxDim;
      const centerX = (box.min.x + box.max.x) / 2;
      const centerY = (box.min.y + box.max.y) / 2;

      // Build outer shape from the largest filled path
      const shapes: THREE.Shape[] = [];
      for (const path of svgData.paths) {
        const isFilled = !!(path.userData as any)?.style?.fill;
        if (!isFilled) continue;
        for (const sub of path.subPaths) {
          const pts = sub.getPoints(20);
          if (pts.length < 3) continue;
          const shape = new THREE.Shape();
          shape.moveTo((pts[0].x - centerX) * scale, -(pts[0].y - centerY) * scale);
          for (let i = 1; i < pts.length; i++) {
            shape.lineTo((pts[i].x - centerX) * scale, -(pts[i].y - centerY) * scale);
          }
          shape.closePath();
          shapes.push(shape);
        }
      }

      // Pick the largest shape as the outer
      const outer = shapes.length > 0
        ? shapes.reduce((a, b) => {
            const areaA = Math.abs(new THREE.Shape().copy(a).getPoints().length);
            const areaB = Math.abs(new THREE.Shape().copy(b).getPoints().length);
            return areaA > areaB ? a : b;
          })
        : shapes[0];

      if (!outer) return;

      const svgStr = text;
      const finalW = width;
      const finalH = (sizeY / maxDim) * width;
      const el: TopperElement = {
        id: uid(),
        type: "image",
        content: file.name.replace(/\.[^.]+$/, ""),
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        color: config.textColor,
        svgData: svgStr,
        widthMm: finalW,
        heightMm: finalH,
        zIndex: config.elements.length,
      };
      setConfig((prev) => {
        const next = { ...prev, elements: [...prev.elements, el] };
        pushHistory(next, el.id);
        return next;
      });
      setSelectedElementId(el.id);
    } catch (err) {
      console.error("SVG parse error:", err);
    }
  }, [config.textColor, config.elements.length, pushHistory]);

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    isHistoryAction.current = true;
    historyIndexRef.current = idx - 1;
    const entry = historyRef.current[idx - 1];
    setConfig(entry.config);
    setSelectedElementId(entry.selectedElementId);
    isHistoryAction.current = false;
  }, []);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;
    isHistoryAction.current = true;
    historyIndexRef.current = idx + 1;
    const entry = historyRef.current[idx + 1];
    setConfig(entry.config);
    setSelectedElementId(entry.selectedElementId);
    isHistoryAction.current = false;
  }, []);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  /**
   * Contexto por estilo da plaquinha (T6): estilos de nome validam pelo ramo
   * do chaveiro + fit check; `placa` mantém o `validateForPrint` original.
   */
  const runValidation = useCallback(
    (ctx?: { style?: PlaqueStyle; name?: KeychainConfig; nameWidthMm?: number | null }) => {
      const issues =
        ctx?.style && ctx.style !== "placa" && ctx.name
          ? validatePlaqueForPrint(ctx.style, config, ctx.name, ctx.nameWidthMm)
          : validateForPrint(config);
      setPrintIssues(issues);
      setShowIssues(true);
      return issues;
    },
    [config]
  );

  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
    setSelectedElementId(null);
    historyRef.current = [];
    historyIndexRef.current = -1;
  }, []);

  const loadTemplate = useCallback((template: Partial<TopperConfig>) => {
    const next = { ...defaultConfig, ...template, sticks: defaultSticks(template.stickCount ?? 2, template.plateWidth ?? 120, template.stickHeight ?? 80, template.stickThickness ?? 2, template.stickWidth ?? 4) };
    setConfig(next);
    setSelectedElementId(null);
    historyRef.current = [];
    historyIndexRef.current = -1;
    pushHistory(next, null);
  }, [pushHistory]);

  /** Substituição completa (carregar plaquinha da coleção). */
  const replaceConfig = useCallback((next: TopperConfig) => {
    setConfig(next);
    setSelectedElementId(null);
    historyRef.current = [];
    historyIndexRef.current = -1;
    pushHistory(next, null);
  }, [pushHistory]);

  const selectedElement = config.elements.find((el) => el.id === selectedElementId) || null;

  return {
    config,
    updateConfig,
    selectedElementId,
    setSelectedElementId,
    selectedElement,
    addElement,
    updateElement,
    removeElement,
    duplicateElement,
    groupElements,
    printIssues,
    showIssues,
    setShowIssues,
    runValidation,
    viewMode,
    setViewMode,
    showGrid,
    setShowGrid,
    showDimensions,
    setShowDimensions,
    showCakePreview,
    setShowCakePreview,
    modelColor,
    setModelColor,
    undo,
    redo,
    canUndo,
    canRedo,
    resetConfig,
    loadTemplate,
    replaceConfig,
    applyTheme,
    uploadImageFile,
    uploadSvgFile,
  };
}
