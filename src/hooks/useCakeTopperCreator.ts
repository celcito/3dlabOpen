import { useState, useCallback, useRef } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { traceImage } from "../lib/imageTools/traceImage";
import {
  TopperConfig,
  TopperElement,
  TopperStick,
  THEMES,
  createTextGeometry,
  createPlateGeometry,
  createStickGeometry,
  createShapeElement,
  validateForPrint,
  PrintIssue,
  loadTopperFont,
  TOPPER_FONTS,
} from "../lib/cakeTopper/cakeTopperGeometry";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultSticks(count: number, plateWidth: number, stickHeight: number, stickThickness: number, stickWidth: number): TopperStick[] {
  const sticks: TopperStick[] = [];
  const spacing = plateWidth / (count + 1);
  for (let i = 0; i < count; i++) {
    sticks.push({
      id: uid(),
      x: -plateWidth / 2 + spacing * (i + 1),
      height: stickHeight,
      thickness: stickThickness,
      width: stickWidth,
    });
  }
  return sticks;
}

const defaultConfig: TopperConfig = {
  text: "Feliz Aniversário",
  fontFamily: TOPPER_FONTS[0].url,
  fontSize: 14,
  textThickness: 2,
  letterSpacing: 0.5,
  alignment: "center",
  plateThickness: 2,
  plateWidth: 120,
  plateHeight: 60,
  plateCornerRadius: 5,
  plateColor: "#FF6B9D",
  textColor: "#FFFFFF",
  borderColor: "#FF1A6D",
  borderWidth: 2,
  showBorder: true,
  stickCount: 2,
  stickHeight: 80,
  stickThickness: 2,
  stickWidth: 4,
  stickColor: "#FF6B9D",
  elements: [],
  sticks: defaultSticks(2, 120, 80, 2, 4),
  totalHeight: 140,
  totalWidth: 120,
  smoothEdges: true,
  addReinforcement: false,
  reinforcementThickness: 2,
  age: "",
  subtitle: "",
  theme: "aniversario",
};

interface HistoryEntry {
  config: TopperConfig;
  selectedElementId: string | null;
}

export function useCakeTopperCreator() {
  const [config, setConfig] = useState<TopperConfig>(defaultConfig);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
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
      if (patch.plateWidth !== undefined || patch.stickCount !== undefined || patch.stickHeight !== undefined || patch.stickThickness !== undefined || patch.stickWidth !== undefined) {
        next.sticks = defaultSticks(
          patch.stickCount ?? prev.stickCount,
          patch.plateWidth ?? prev.plateWidth,
          patch.stickHeight ?? prev.stickHeight,
          patch.stickThickness ?? prev.stickThickness,
          patch.stickWidth ?? prev.stickWidth
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

  const runValidation = useCallback(() => {
    const issues = validateForPrint(config);
    setPrintIssues(issues);
    setShowIssues(true);
    return issues;
  }, [config]);

  const exportSTL = useCallback(async () => {
    setIsExporting(true);
    try {
      const group = new THREE.Group();
      const plateMesh = createPlateGeometry(config.plateWidth, config.plateHeight, config.plateThickness, config.plateCornerRadius, config.plateColor);
      group.add(plateMesh);

      // Text
      if (config.text) {
        try {
          const { geometry: textGeom } = await createTextGeometry(
            config.text,
            config.fontFamily,
            config.fontSize / 10,
            config.textThickness / 10,
            config.letterSpacing / 10
          );
          textGeom.translate(0, 0, config.plateThickness / 10);
          const textMesh = new THREE.Mesh(textGeom, new THREE.MeshStandardMaterial({ color: config.textColor }));
          group.add(textMesh);
        } catch { /* font load failed */ }
      }

      // Subtitle
      if (config.subtitle) {
        try {
          const { geometry: subGeom } = await createTextGeometry(
            config.subtitle,
            config.fontFamily,
            (config.fontSize * 0.6) / 10,
            config.textThickness / 10,
            config.letterSpacing / 10
          );
          subGeom.translate(0, -config.plateHeight / 20, config.plateThickness / 10);
          const subMesh = new THREE.Mesh(subGeom, new THREE.MeshStandardMaterial({ color: config.textColor }));
          group.add(subMesh);
        } catch { /* font load failed */ }
      }

      // Elements
      for (const el of config.elements) {
        if (el.type === "shape" && el.shapeType) {
          const mesh = createShapeElement(el.shapeType, el.fontSize || 10, config.textThickness / 10, el.color);
          if (mesh) {
            mesh.position.set(el.x / 10, el.y / 10, config.plateThickness / 10);
            mesh.scale.setScalar(el.scale);
            mesh.rotation.z = (el.rotation * Math.PI) / 180;
            group.add(mesh);
          }
        } else if (el.type === "text" || el.type === "number") {
          try {
            const { geometry: elGeom } = await createTextGeometry(
              el.content,
              el.fontFamily || config.fontFamily,
              (el.fontSize || config.fontSize) / 10,
              config.textThickness / 10,
              0
            );
            elGeom.translate(el.x / 10, el.y / 10, config.plateThickness / 10);
            const elMesh = new THREE.Mesh(elGeom, new THREE.MeshStandardMaterial({ color: el.color }));
            elMesh.rotation.z = (el.rotation * Math.PI) / 180;
            elMesh.scale.setScalar(el.scale);
            group.add(elMesh);
          } catch { /* font load failed */ }
        } else if (el.type === "image" && el.svgData) {
          try {
            const parser = new SVGLoader();
            const svgData = parser.parse(el.svgData);
            const allPoints: THREE.Vector2[] = [];
            for (const path of svgData.paths) {
              for (const sub of path.subPaths) {
                const pts = sub.getPoints(20);
                pts.forEach((p) => allPoints.push(p));
              }
            }
            if (allPoints.length > 0) {
              const box = new THREE.Box2();
              allPoints.forEach((p) => box.expandByPoint(p));
              const sizeX = box.max.x - box.min.x;
              const sizeY = box.max.y - box.min.y;
              const maxDim = Math.max(sizeX, sizeY) || 1;
              const targetSize = (el.widthMm || 30) / 10;
              const sc = targetSize / maxDim;
              const centerX = (box.min.x + box.max.x) / 2;
              const centerY = (box.min.y + box.max.y) / 2;

              let bestShape: THREE.Shape | null = null;
              let bestArea = 0;
              for (const path of svgData.paths) {
                const isFilled = !!(path.userData as any)?.style?.fill;
                if (!isFilled) continue;
                for (const sub of path.subPaths) {
                  const pts = sub.getPoints(20);
                  if (pts.length < 3) continue;
                  const shape = new THREE.Shape();
                  shape.moveTo((pts[0].x - centerX) * sc, -(pts[0].y - centerY) * sc);
                  for (let i = 1; i < pts.length; i++) {
                    shape.lineTo((pts[i].x - centerX) * sc, -(pts[i].y - centerY) * sc);
                  }
                  shape.closePath();
                  const bbox = new THREE.Box2();
                  shape.getPoints().forEach((p) => bbox.expandByPoint(p));
                  const sz = new THREE.Vector2();
                  bbox.getSize(sz);
                  const area = sz.x * sz.y;
                  if (area > bestArea) { bestArea = area; bestShape = shape; }
                }
              }
              if (bestShape) {
                const geom = new THREE.ExtrudeGeometry(bestShape, {
                  depth: config.textThickness / 10,
                  bevelEnabled: false,
                });
                geom.computeVertexNormals();
                geom.translate(el.x / 10, el.y / 10, config.plateThickness / 10);
                const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: el.color, side: THREE.DoubleSide }));
                mesh.rotation.z = (el.rotation * Math.PI) / 180;
                mesh.scale.setScalar(el.scale);
                group.add(mesh);
              }
            }
          } catch { /* SVG parse failed */ }
        }
      }

      // Sticks
      for (const stick of config.sticks) {
        const stickMesh = createStickGeometry(stick.height, stick.thickness, stick.width, config.stickColor);
        stickMesh.position.set(stick.x / 10, -config.plateHeight / 20, 0);
        stickMesh.rotation.x = -Math.PI / 2;
        group.add(stickMesh);
      }

      // Export
      const exporter = new STLExporter();
      const result = exporter.parse(group, { binary: true });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" }));
      link.download = `topper-${config.text.toLowerCase().replace(/\s+/g, "-").slice(0, 30) || "custom"}.stl`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [config]);

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
    isExporting,
    exportSTL,
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
    applyTheme,
    uploadImageFile,
    uploadSvgFile,
  };
}
