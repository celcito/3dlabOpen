import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ModelLineart, Path2D, Point2D } from '../types';
import { traceImageToLineart } from '../utils/imageTracer';
import {
  distance,
  snapToGrid,
  isLoopClosed,
  closeLoop,
  simplifyPointsRDP,
  chaikinSmooth,
  catmullRomSpline,
  StrokeStabilizer,
  generateEllipse,
  generateRectangle,
  calculatePolygonArea,
} from '../utils/drawingPrecision';
import {
  BezierAnchor,
  BezierNodeMode,
  evaluateCubicBezier,
  sampleBezierPath,
  polylineToBezierAnchors,
  updateAnchorHandle,
  setAnchorMode,
  insertBezierAnchorOnSegment,
  moveBezierAnchor,
  transformBezierAnchors,
  getPathBounds,
  rotatePoint,
  rotatePath,
  scalePath,
  translatePath,
  flipPath,
  centerPathInCanvas,
  insertNodeOnPath,
  offsetPathVector,
  exportPathsToSVG,
  downloadSVGFile,
  parseSvgStringToPaths,
} from '../utils/vectorStudioUtils';
import {
  X,
  Upload,
  Pen,
  PenTool,
  RotateCcw,
  Sparkles,
  Check,
  Sliders,
  SplitSquareVertical,
  Grid,
  Magnet,
  Undo2,
  Redo2,
  Circle,
  Square,
  Minus,
  Star,
  Heart,
  Eraser,
  Layers,
  Crosshair,
  MousePointer,
  Waypoints,
  Maximize2,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  FileCode,
  Copy,
  Trash2,
  Download as DownloadIcon,
  Spline,
  CornerDownRight,
} from 'lucide-react';

interface LineartEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCustomModel: (model: ModelLineart) => void;
}

type MainTool =
  | 'select' // Selection Tool (V) - move, scale, rotate
  | 'node' // Direct Selection / Bézier Node & Handle Tool (A)
  | 'bezier' // Cubic Bézier Pen Tool (B) - click for corner, drag for handles
  | 'pen' // Freehand pen with stabilizer (P)
  | 'line' // Straight polyline
  | 'circle' // Ellipse / circle
  | 'rect' // Rectangle / box
  | 'star' // Star
  | 'heart' // Heart
  | 'eraser'; // Eraser

type SmoothingLevel = 'none' | 'medium' | 'high';
type GridSpacing = 2 | 5 | 10 | 12.5;

interface StrokeItem {
  id: string;
  points: Point2D[];
  bezierAnchors?: BezierAnchor[];
  isClosed: boolean;
  isOuter: boolean;
}

export const LineartEditor: React.FC<LineartEditorProps> = ({
  isOpen,
  onClose,
  onApplyCustomModel,
}) => {
  const [tab, setTab] = useState<'draw' | 'upload'>('draw');

  // Model Metadata
  const [modelName, setModelName] = useState<string>('Meu Cortador Vetorial');

  // Vector Tools State
  const [activeTool, setActiveTool] = useState<MainTool>('pen');
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);

  // Drawing & Precision Parameters
  const [brushSize, setBrushSize] = useState<number>(4);
  const [smoothingLevel, setSmoothingLevel] = useState<SmoothingLevel>('medium');
  const [autoBezierFreehand, setAutoBezierFreehand] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [enableSnapGrid, setEnableSnapGrid] = useState<boolean>(true);
  const [gridSpacing, setGridSpacing] = useState<GridSpacing>(5);
  const [showCenterGuides, setShowCenterGuides] = useState<boolean>(true);
  const [mirrorMode, setMirrorMode] = useState<boolean>(false);
  const [autoCloseLoop, setAutoCloseLoop] = useState<boolean>(true);

  // Stroke stack & history
  const [strokes, setStrokes] = useState<StrokeItem[]>([]);
  const [undoStack, setUndoStack] = useState<StrokeItem[][]>([]);
  const [redoStack, setRedoStack] = useState<StrokeItem[][]>([]);

  // Active Bézier Pen construction state
  const [bezierDraft, setBezierDraft] = useState<BezierAnchor[]>([]);
  const bezierDraftRef = useRef<BezierAnchor[]>([]);
  const isDraggingBezierHandleRef = useRef<boolean>(false);
  const bezierClosingDragRef = useRef<boolean>(false);

  // Dragging / Transforming State
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const dragModeRef = useRef<
    | 'none'
    | 'draw'
    | 'move-shape'
    | 'move-node'
    | 'move-handle-in'
    | 'move-handle-out'
    | 'scale-handle'
    | 'rotate-handle'
  >('none');
  const activeHandleRef = useRef<string | null>(null);
  const startDragPtRef = useRef<Point2D | null>(null);
  const originalPointsRef = useRef<Point2D[]>([]);
  const originalAnchorsRef = useRef<BezierAnchor[] | undefined>(undefined);
  const currentRawPointsRef = useRef<Point2D[]>([]);
  const stabilizerRef = useRef<StrokeStabilizer>(new StrokeStabilizer(0.35));
  const isAltPressedRef = useRef<boolean>(false);

  // Visual Cursor & Snap Feedback State
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);
  const [rawCursorPos, setRawCursorPos] = useState<Point2D | null>(null);
  const [isNearStart, setIsNearStart] = useState<boolean>(false);
  const [svgModalOpen, setSvgModalOpen] = useState<boolean>(false);
  const [svgTextInput, setSvgTextInput] = useState<string>('');

  // Upload Tab State
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(128);
  const [invert, setInvert] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgFileInputRef = useRef<HTMLInputElement>(null);

  // Keep bezierDraftRef synced
  useEffect(() => {
    bezierDraftRef.current = bezierDraft;
  }, [bezierDraft]);

  // Synchronize stabilizer with smoothing level
  useEffect(() => {
    if (smoothingLevel === 'none') {
      stabilizerRef.current.setWeight(0);
    } else if (smoothingLevel === 'medium') {
      stabilizerRef.current.setWeight(0.35);
    } else {
      stabilizerRef.current.setWeight(0.65);
    }
  }, [smoothingLevel]);

  // History management
  const recordHistory = useCallback(
    (newStrokes: StrokeItem[]) => {
      setUndoStack((prev) => [...prev, strokes]);
      setRedoStack([]);
      setStrokes(newStrokes);
    },
    [strokes]
  );

  const handleUndo = useCallback(() => {
    if (bezierDraftRef.current.length > 0) {
      const nextDraft = bezierDraftRef.current.slice(0, -1);
      setBezierDraft(nextDraft);
      return;
    }
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, strokes]);
    setStrokes(previous);
  }, [undoStack, strokes]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, strokes]);
    setStrokes(next);
  }, [redoStack, strokes]);

  // Recalculate outer vs inner contours automatically
  const reclassifyStrokes = useCallback((strokeList: StrokeItem[]): StrokeItem[] => {
    if (strokeList.length === 0) return [];
    if (strokeList.length === 1) {
      return [{ ...strokeList[0], isOuter: true }];
    }

    const existingOuter = strokeList.find((s) => s.isOuter);
    if (existingOuter) {
      return strokeList;
    }

    let bestIndex = 0;
    let maxScore = -1;

    strokeList.forEach((st, idx) => {
      const area = calculatePolygonArea(st.points);
      const score = st.isClosed ? area * 1.5 : area;
      if (score > maxScore) {
        maxScore = score;
        bestIndex = idx;
      }
    });

    return strokeList.map((st, idx) => ({
      ...st,
      isOuter: idx === bestIndex,
    }));
  }, []);

  // Commit active Bézier draft path into strokes
  const commitBezierDraft = useCallback(
    (closed: boolean) => {
      const draft = bezierDraftRef.current;
      if (draft.length < 2) {
        setBezierDraft([]);
        return;
      }

      const sampled = sampleBezierPath(draft, closed, 20);
      const newId = `bezier_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newStroke: StrokeItem = {
        id: newId,
        points: sampled,
        bezierAnchors: draft,
        isClosed: closed,
        isOuter: false,
      };

      const nextStrokes = [...strokes, newStroke];

      if (mirrorMode) {
        const mirroredAnchors = transformBezierAnchors(draft, ([x, y]) => [
          Math.max(0, Math.min(100, 100 - x)),
          y,
        ]);
        nextStrokes.push({
          id: `bezier_mirror_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          points: sampleBezierPath(mirroredAnchors, closed, 20),
          bezierAnchors: mirroredAnchors,
          isClosed: closed,
          isOuter: false,
        });
      }

      const classified = reclassifyStrokes(nextStrokes);
      recordHistory(classified);
      setSelectedStrokeId(newId);
      setBezierDraft([]);
      setIsNearStart(false);
    },
    [strokes, mirrorMode, reclassifyStrokes, recordHistory]
  );

  // Delete handlers
  const handleDeleteSelectedStroke = useCallback(() => {
    if (!selectedStrokeId) return;
    const updated = strokes.filter((s) => s.id !== selectedStrokeId);
    recordHistory(reclassifyStrokes(updated));
    setSelectedStrokeId(null);
    setSelectedNodeIndex(null);
  }, [selectedStrokeId, strokes, recordHistory, reclassifyStrokes]);

  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedStrokeId || selectedNodeIndex === null) return;
    const active = strokes.find((s) => s.id === selectedStrokeId);
    if (!active) return;

    if (active.bezierAnchors) {
      if (active.bezierAnchors.length <= 2) return;
      const nextAnchors = active.bezierAnchors.filter((_, idx) => idx !== selectedNodeIndex);
      const nextPoints = sampleBezierPath(nextAnchors, active.isClosed, 20);
      const updated = strokes.map((s) =>
        s.id === selectedStrokeId
          ? { ...s, bezierAnchors: nextAnchors, points: nextPoints }
          : s
      );
      recordHistory(updated);
      setSelectedNodeIndex(null);
      return;
    }

    if (active.points.length <= 2) return;
    const nextPoints = active.points.filter((_, idx) => idx !== selectedNodeIndex);
    const updated = strokes.map((s) =>
      s.id === selectedStrokeId ? { ...s, points: nextPoints } : s
    );
    recordHistory(updated);
    setSelectedNodeIndex(null);
  }, [selectedStrokeId, selectedNodeIndex, strokes, recordHistory]);

  // Keyboard shortcuts (V, A, B, P, G, Enter, Esc, Alt, Ctrl+Z, Delete)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        isAltPressedRef.current = true;
      }

      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
        e.preventDefault();
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'a' || e.key === 'A') {
        setActiveTool('node');
      } else if (e.key === 'b' || e.key === 'B') {
        setActiveTool('bezier');
      } else if (e.key === 'p' || e.key === 'P') {
        setActiveTool('pen');
      } else if (e.key === 'g' || e.key === 'G') {
        setEnableSnapGrid((prev) => !prev);
      } else if (e.key === 'Enter' && bezierDraftRef.current.length >= 2) {
        commitBezierDraft(false);
        e.preventDefault();
      } else if (e.key === 'Escape' && bezierDraftRef.current.length > 0) {
        setBezierDraft([]);
        setIsNearStart(false);
        e.preventDefault();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeTool === 'node' && selectedStrokeId && selectedNodeIndex !== null) {
          handleDeleteSelectedNode();
          e.preventDefault();
        } else if (selectedStrokeId) {
          handleDeleteSelectedStroke();
          e.preventDefault();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        isAltPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    isOpen,
    handleUndo,
    handleRedo,
    activeTool,
    selectedStrokeId,
    selectedNodeIndex,
    commitBezierDraft,
    handleDeleteSelectedNode,
    handleDeleteSelectedStroke,
  ]);

  // Coordinate conversion returning both raw and grid-snapped percentage coordinates
  const getCanvasCoords = useCallback(
    (
      e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>,
      forceNoSnap: boolean = false
    ): { raw: Point2D; snapped: Point2D; isSnapped: boolean } => {
      const canvas = drawCanvasRef.current;
      if (!canvas) return { raw: [0, 0], snapped: [0, 0], isSnapped: false };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const rawPctX = Math.max(0, Math.min(100, (x / canvas.width) * 100));
      const rawPctY = Math.max(0, Math.min(100, (y / canvas.height) * 100));
      const raw: Point2D = [rawPctX, rawPctY];

      const shouldSnap = enableSnapGrid && !forceNoSnap && !isAltPressedRef.current && !e.altKey;
      if (shouldSnap) {
        const snapped = snapToGrid(raw, gridSpacing);
        return { raw, snapped, isSnapped: true };
      }

      return { raw, snapped: raw, isSnapped: false };
    },
    [enableSnapGrid, gridSpacing]
  );

  // Redraw canvas
  const redrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Background
    ctx.fillStyle = '#F1F3ED';
    ctx.fillRect(0, 0, w, h);

    // 2. Precision Grid & Magnetic Grid Visuals
    if (showGrid || enableSnapGrid) {
      const stepPct = gridSpacing;
      const stepPx = (stepPct / 100) * w;

      // Minor grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = enableSnapGrid ? '#dde1d8cc' : '#dde1d866';
      ctx.beginPath();
      for (let p = 0; p <= 100.001; p += stepPct) {
        const px = (p / 100) * w;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.moveTo(0, px);
        ctx.lineTo(w, px);
      }
      ctx.stroke();

      // Major grid lines (every 10% or 25% depending on spacing)
      const majorPct = stepPct === 12.5 ? 25 : 10;
      ctx.strokeStyle = enableSnapGrid ? '#cac3d8' : '#cac3d866';
      ctx.beginPath();
      for (let p = 0; p <= 100.001; p += majorPct) {
        const px = (p / 100) * w;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.moveTo(0, px);
        ctx.lineTo(w, px);
      }
      ctx.stroke();

      // Magnetic intersection anchor dots when Magnetic Grid Mode is ON
      if (enableSnapGrid) {
        const dotStep = stepPct < 5 ? stepPct * 2 : stepPct;
        ctx.fillStyle = '#632ce566';
        for (let xPct = dotStep; xPct < 100; xPct += dotStep) {
          for (let yPct = dotStep; yPct < 100; yPct += dotStep) {
            const gx = (xPct / 100) * w;
            const gy = (yPct / 100) * h;
            ctx.fillRect(gx - 1.5, gy - 1.5, 3, 3);
          }
        }

        // Crisp CAD border ticks & labels every 10% / 25%
        ctx.fillStyle = '#687064';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let p = 10; p < 100; p += 10) {
          const px = (p / 100) * w;
          ctx.fillText(`${p}`, px, 4);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let p = 10; p < 100; p += 10) {
          const py = (p / 100) * h;
          ctx.fillText(`${p}`, 5, py);
        }
      }
    }

    // 3. Center axes
    if (showCenterGuides) {
      ctx.strokeStyle = '#7a748780';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Safe margin box
      ctx.strokeStyle = '#cac3d8aa';
      ctx.setLineDash([2, 4]);
      ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
      ctx.setLineDash([]);
    }

    // 4. Mirror Axis
    if (mirrorMode) {
      ctx.strokeStyle = '#632ce5aa';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Render committed strokes
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;

      const isSelected = stroke.id === selectedStrokeId;
      const isOuterBlade = stroke.isOuter;

      ctx.lineWidth = isOuterBlade
        ? Math.max(3.5, brushSize * 1.1)
        : Math.max(2, brushSize * 0.75);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = isOuterBlade ? '#904000' : '#7C4DFF';

      if (isOuterBlade) {
        ctx.shadowColor = 'rgba(144, 64, 0, 0.3)';
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      const first = stroke.points[0];
      ctx.moveTo((first[0] / 100) * w, (first[1] / 100) * h);
      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo((pt[0] / 100) * w, (pt[1] / 100) * h);
      }
      if (stroke.isClosed) {
        ctx.closePath();
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Selection halo
      if (isSelected) {
        ctx.strokeStyle = '#632CE5';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 6. Render Nodes & Bézier Tangent Handles in Node Tool ('node')
      if (activeTool === 'node' && isSelected) {
        if (stroke.bezierAnchors && stroke.bezierAnchors.length > 0) {
          stroke.bezierAnchors.forEach((anc, idx) => {
            const isNodeSelected = idx === selectedNodeIndex;
            const ax = (anc.pos[0] / 100) * w;
            const ay = (anc.pos[1] / 100) * h;

            // Draw tangent arms & handles for selected node or adjacent nodes
            const showHandles =
              isNodeSelected ||
              selectedNodeIndex === null ||
              Math.abs(idx - selectedNodeIndex) <= 1;

            if (showHandles) {
              ctx.strokeStyle = isNodeSelected ? '#7C4DFF' : '#68706480';
              ctx.lineWidth = 1.25;

              if (anc.handleIn) {
                const hx = (anc.handleIn[0] / 100) * w;
                const hy = (anc.handleIn[1] / 100) * h;
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(hx, hy);
                ctx.stroke();

                ctx.fillStyle = isNodeSelected ? '#7C4DFF' : '#7A7487';
                ctx.strokeStyle = '#494455';
                ctx.beginPath();
                ctx.arc(hx, hy, isNodeSelected ? 5.5 : 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              }

              if (anc.handleOut) {
                const hx = (anc.handleOut[0] / 100) * w;
                const hy = (anc.handleOut[1] / 100) * h;
                ctx.strokeStyle = isNodeSelected ? '#7C4DFF' : '#68706480';
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(hx, hy);
                ctx.stroke();

                ctx.fillStyle = isNodeSelected ? '#904000' : '#7A7487';
                ctx.strokeStyle = '#494455';
                ctx.beginPath();
                ctx.arc(hx, hy, isNodeSelected ? 5.5 : 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              }
            }

            // Draw Anchor Node (diamond for corner, circle for smooth/symmetric)
            const size = isNodeSelected ? 6 : 4.5;
            ctx.fillStyle = isNodeSelected ? '#632CE5' : '#ffffff';
            ctx.strokeStyle = '#494455';
            ctx.lineWidth = 1.5;

            if (anc.mode === 'corner') {
              ctx.beginPath();
              ctx.moveTo(ax, ay - size);
              ctx.lineTo(ax + size, ay);
              ctx.lineTo(ax, ay + size);
              ctx.lineTo(ax - size, ay);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.arc(ax, ay, size, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          });
        } else {
          // Standard polyline vertex squares
          stroke.points.forEach((pt, nIdx) => {
            const isNodeSelected = nIdx === selectedNodeIndex;
            const nx = (pt[0] / 100) * w;
            const ny = (pt[1] / 100) * h;
            const nodeSize = isNodeSelected ? 9 : 7;
            ctx.fillStyle = isNodeSelected ? '#632CE5' : '#ffffff';
            ctx.strokeStyle = '#494455';
            ctx.lineWidth = 1.5;
            ctx.fillRect(nx - nodeSize / 2, ny - nodeSize / 2, nodeSize, nodeSize);
            ctx.strokeRect(nx - nodeSize / 2, ny - nodeSize / 2, nodeSize, nodeSize);
          });
        }
      }
    });

    // 7. Bounding Box in Selection Mode ('select')
    const activeStroke = strokes.find((s) => s.id === selectedStrokeId);
    if (activeTool === 'select' && activeStroke && activeStroke.points.length > 0) {
      const b = getPathBounds(activeStroke.points);
      const bx = (b.minX / 100) * w;
      const by = (b.minY / 100) * h;
      const bw = (b.width / 100) * w;
      const bh = (b.height / 100) * h;

      ctx.strokeStyle = '#632CE5';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      const handleSize = 7;
      const handles = [
        { x: bx, y: by },
        { x: bx + bw / 2, y: by },
        { x: bx + bw, y: by },
        { x: bx, y: by + bh / 2 },
        { x: bx + bw, y: by + bh / 2 },
        { x: bx, y: by + bh },
        { x: bx + bw / 2, y: by + bh },
        { x: bx + bw, y: by + bh },
      ];

      handles.forEach((hnd) => {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#632CE5';
        ctx.lineWidth = 1.5;
        ctx.fillRect(hnd.x - handleSize / 2, hnd.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(hnd.x - handleSize / 2, hnd.y - handleSize / 2, handleSize, handleSize);
      });

      const rotY = by - 20;
      ctx.strokeStyle = '#632CE5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + bw / 2, by);
      ctx.lineTo(bx + bw / 2, rotY);
      ctx.stroke();

      ctx.fillStyle = '#7C4DFF';
      ctx.beginPath();
      ctx.arc(bx + bw / 2, rotY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // 8. Active Bézier Draft Construction Preview
    if (bezierDraft.length > 0) {
      // Draw committed segments of draft
      const sampledDraft = sampleBezierPath(bezierDraft, false, 20);
      if (sampledDraft.length >= 2) {
        ctx.strokeStyle = '#7C4DFF';
        ctx.lineWidth = Math.max(2.5, brushSize * 0.9);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo((sampledDraft[0][0] / 100) * w, (sampledDraft[0][1] / 100) * h);
        for (let i = 1; i < sampledDraft.length; i++) {
          ctx.lineTo((sampledDraft[i][0] / 100) * w, (sampledDraft[i][1] / 100) * h);
        }
        ctx.stroke();
      }

      // Live rubber-band preview curve to cursor when not actively dragging handle
      const lastAnc = bezierDraft[bezierDraft.length - 1];
      if (cursorPos && !isDraggingBezierHandleRef.current) {
        const cp1 = lastAnc.handleOut || lastAnc.pos;
        const cp2 = cursorPos;
        ctx.strokeStyle = '#7C4DFF80';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo((lastAnc.pos[0] / 100) * w, (lastAnc.pos[1] / 100) * h);
        for (let s = 1; s <= 16; s++) {
          const pt = evaluateCubicBezier(lastAnc.pos, cp1, cp2, cursorPos, s / 16);
          ctx.lineTo((pt[0] / 100) * w, (pt[1] / 100) * h);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw anchor nodes and handle arms of draft
      bezierDraft.forEach((anc, i) => {
        const ax = (anc.pos[0] / 100) * w;
        const ay = (anc.pos[1] / 100) * h;

        if (anc.handleIn) {
          const hx = (anc.handleIn[0] / 100) * w;
          const hy = (anc.handleIn[1] / 100) * h;
          ctx.strokeStyle = '#7C4DFF';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.fillStyle = '#7C4DFF';
          ctx.beginPath();
          ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (anc.handleOut) {
          const hx = (anc.handleOut[0] / 100) * w;
          const hy = (anc.handleOut[1] / 100) * h;
          ctx.strokeStyle = '#904000';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.fillStyle = '#904000';
          ctx.beginPath();
          ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // First anchor highlights green when closing loop
        if (i === 0 && isNearStart && bezierDraft.length >= 2) {
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(ax, ay, 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#059669';
          ctx.beginPath();
          ctx.arc(ax, ay, 5.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = i === bezierDraft.length - 1 ? '#904000' : '#ffffff';
          ctx.strokeStyle = '#494455';
          ctx.lineWidth = 1.5;
          ctx.fillRect(ax - 4.5, ay - 4.5, 9, 9);
          ctx.strokeRect(ax - 4.5, ay - 4.5, 9, 9);
        }
      });
    }

    // 9. Active freehand / shape drawing in progress
    if (currentRawPointsRef.current.length > 0) {
      const pts = currentRawPointsRef.current;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#7C4DFF';
      ctx.shadowColor = 'rgba(124, 77, 255, 0.35)';
      ctx.shadowBlur = 6;

      ctx.beginPath();
      const p0 = pts[0];
      ctx.moveTo((p0[0] / 100) * w, (p0[1] / 100) * h);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo((pts[i][0] / 100) * w, (pts[i][1] / 100) * h);
      }
      ctx.stroke();

      if (mirrorMode) {
        ctx.strokeStyle = '#632ce5';
        ctx.beginPath();
        ctx.moveTo(((100 - p0[0]) / 100) * w, (p0[1] / 100) * h);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(((100 - pts[i][0]) / 100) * w, (pts[i][1] / 100) * h);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      const startPt = pts[0];
      const startX = (startPt[0] / 100) * w;
      const startY = (startPt[1] / 100) * h;

      if (isNearStart) {
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(startX, startY, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(startX, startY, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#494455';
        ctx.beginPath();
        ctx.arc(startX, startY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 10. Visual Magnetic Grid Snap Reticle & Alignment Hairlines
    if (enableSnapGrid && cursorPos && activeTool !== 'eraser') {
      const sx = (cursorPos[0] / 100) * w;
      const sy = (cursorPos[1] / 100) * h;

      // Full-canvas faint magnetic alignment hairlines
      ctx.strokeStyle = '#632ce538';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Magnetic tether line from raw pointer to snapped grid vertex
      if (rawCursorPos) {
        const rx = (rawCursorPos[0] / 100) * w;
        const ry = (rawCursorPos[1] / 100) * h;
        if (Math.hypot(rx - sx, ry - sy) > 2) {
          ctx.strokeStyle = '#05966980';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(sx, sy);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Snapped target diamond + ring
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx + 4, sy);
      ctx.lineTo(sx, sy + 4);
      ctx.lineTo(sx - 4, sy);
      ctx.closePath();
      ctx.fill();
    }
  }, [
    showGrid,
    enableSnapGrid,
    gridSpacing,
    showCenterGuides,
    mirrorMode,
    brushSize,
    strokes,
    selectedStrokeId,
    selectedNodeIndex,
    activeTool,
    isNearStart,
    bezierDraft,
    cursorPos,
    rawCursorPos,
  ]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Pointer interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const { raw, snapped } = getCanvasCoords(e);
    // Freehand pen keeps smooth continuous raw input (but snaps start/end if Magnetic Grid is on)
    const pt = activeTool === 'pen' ? raw : snapped;

    isPointerDownRef.current = true;
    startDragPtRef.current = pt;
    setIsNearStart(false);

    // MODE 0: Cubic Bézier Pen Tool (B)
    if (activeTool === 'bezier') {
      const draft = bezierDraftRef.current;

      // Check if clicking the start anchor to close the path
      if (draft.length >= 2 && distance(snapped, draft[0].pos) <= Math.max(3.5, gridSpacing * 0.6)) {
        bezierClosingDragRef.current = true;
        isDraggingBezierHandleRef.current = true;
        redrawCanvas();
        return;
      }

      // Otherwise add a new anchor point at snapped coordinates
      const newAnchor: BezierAnchor = {
        pos: snapped,
        handleIn: null,
        handleOut: null,
        mode: 'symmetric',
      };
      setBezierDraft([...draft, newAnchor]);
      isDraggingBezierHandleRef.current = true;
      bezierClosingDragRef.current = false;
      redrawCanvas();
      return;
    }

    // MODE 1: Node & Bézier Handle Tool (A)
    if (activeTool === 'node') {
      const activeStroke = strokes.find((s) => s.id === selectedStrokeId);
      if (activeStroke) {
        if (activeStroke.bezierAnchors && activeStroke.bezierAnchors.length > 0) {
          // 1a. Check if clicking any handleIn or handleOut first
          for (let i = 0; i < activeStroke.bezierAnchors.length; i++) {
            const anc = activeStroke.bezierAnchors[i];
            if (anc.handleIn && distance(raw, anc.handleIn) <= 2.8) {
              setSelectedNodeIndex(i);
              dragModeRef.current = 'move-handle-in';
              originalAnchorsRef.current = activeStroke.bezierAnchors;
              redrawCanvas();
              return;
            }
            if (anc.handleOut && distance(raw, anc.handleOut) <= 2.8) {
              setSelectedNodeIndex(i);
              dragModeRef.current = 'move-handle-out';
              originalAnchorsRef.current = activeStroke.bezierAnchors;
              redrawCanvas();
              return;
            }
          }

          // 1b. Check if clicking an anchor node
          const ancIdx = activeStroke.bezierAnchors.findIndex((a) => distance(raw, a.pos) <= 3.2);
          if (ancIdx !== -1) {
            setSelectedNodeIndex(ancIdx);
            dragModeRef.current = 'move-node';
            originalAnchorsRef.current = activeStroke.bezierAnchors;
            redrawCanvas();
            return;
          }

          // 1c. Check if clicking along a Bézier curve segment to insert a split node
          const splitResult = insertBezierAnchorOnSegment(
            activeStroke.bezierAnchors,
            activeStroke.isClosed,
            raw
          );
          if (splitResult) {
            const sampled = sampleBezierPath(splitResult.anchors, activeStroke.isClosed, 20);
            const updated = strokes.map((s) =>
              s.id === activeStroke.id
                ? { ...s, bezierAnchors: splitResult.anchors, points: sampled }
                : s
            );
            recordHistory(updated);
            setSelectedNodeIndex(splitResult.index);
            dragModeRef.current = 'move-node';
            originalAnchorsRef.current = splitResult.anchors;
            redrawCanvas();
            return;
          }
        } else {
          // Polyline node hit test
          const nodeIdx = activeStroke.points.findIndex((p) => distance(raw, p) <= 3.2);
          if (nodeIdx !== -1) {
            setSelectedNodeIndex(nodeIdx);
            dragModeRef.current = 'move-node';
            originalPointsRef.current = [...activeStroke.points];
            redrawCanvas();
            return;
          }

          const insertResult = insertNodeOnPath(activeStroke.points, raw);
          if (insertResult) {
            const updated = strokes.map((s) =>
              s.id === activeStroke.id ? { ...s, points: insertResult.points } : s
            );
            recordHistory(updated);
            setSelectedNodeIndex(insertResult.index);
            dragModeRef.current = 'move-node';
            originalPointsRef.current = [...insertResult.points];
            redrawCanvas();
            return;
          }
        }
      }

      // Click another stroke to select it
      const clickedStroke = strokes.find((s) => s.points.some((p) => distance(raw, p) <= 4));
      if (clickedStroke) {
        setSelectedStrokeId(clickedStroke.id);
        setSelectedNodeIndex(null);
      } else {
        setSelectedStrokeId(null);
        setSelectedNodeIndex(null);
      }
      redrawCanvas();
      return;
    }

    // MODE 2: Selection / Transform Tool (V)
    if (activeTool === 'select') {
      const activeStroke = strokes.find((s) => s.id === selectedStrokeId);
      if (activeStroke) {
        const b = getPathBounds(activeStroke.points);
        const rotPt: Point2D = [b.centerX, b.minY - 3];
        if (distance(raw, rotPt) <= 4) {
          dragModeRef.current = 'rotate-handle';
          originalPointsRef.current = [...activeStroke.points];
          originalAnchorsRef.current = activeStroke.bezierAnchors;
          redrawCanvas();
          return;
        }

        const handles: { id: string; p: Point2D }[] = [
          { id: 'tl', p: [b.minX, b.minY] },
          { id: 'tr', p: [b.maxX, b.minY] },
          { id: 'bl', p: [b.minX, b.maxY] },
          { id: 'br', p: [b.maxX, b.maxY] },
        ];
        const hMatch = handles.find((h) => distance(raw, h.p) <= 3.5);
        if (hMatch) {
          dragModeRef.current = 'scale-handle';
          activeHandleRef.current = hMatch.id;
          originalPointsRef.current = [...activeStroke.points];
          originalAnchorsRef.current = activeStroke.bezierAnchors;
          redrawCanvas();
          return;
        }

        if (raw[0] >= b.minX && raw[0] <= b.maxX && raw[1] >= b.minY && raw[1] <= b.maxY) {
          dragModeRef.current = 'move-shape';
          originalPointsRef.current = [...activeStroke.points];
          originalAnchorsRef.current = activeStroke.bezierAnchors;
          redrawCanvas();
          return;
        }
      }

      const clickedStroke = strokes.find((s) => s.points.some((p) => distance(raw, p) <= 4));
      if (clickedStroke) {
        setSelectedStrokeId(clickedStroke.id);
        dragModeRef.current = 'move-shape';
        originalPointsRef.current = [...clickedStroke.points];
        originalAnchorsRef.current = clickedStroke.bezierAnchors;
      } else {
        setSelectedStrokeId(null);
        dragModeRef.current = 'none';
      }
      redrawCanvas();
      return;
    }

    // MODE 3: Eraser
    if (activeTool === 'eraser') {
      const clickedIdx = strokes.findIndex((st) => st.points.some((p) => distance(raw, p) <= 4));
      if (clickedIdx !== -1) {
        const next = strokes.filter((_, i) => i !== clickedIdx);
        recordHistory(reclassifyStrokes(next));
        if (selectedStrokeId === strokes[clickedIdx].id) {
          setSelectedStrokeId(null);
        }
      }
      return;
    }

    // MODE 4: Drawing tools (Pen, Line, Shapes)
    dragModeRef.current = 'draw';
    const initialPt = activeTool === 'pen' && enableSnapGrid ? snapped : pt;
    stabilizerRef.current.reset(initialPt[0], initialPt[1]);
    currentRawPointsRef.current = [initialPt];
    redrawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { raw, snapped } = getCanvasCoords(e);
    setRawCursorPos(raw);
    setCursorPos(snapped);

    // Hover feedback for closing Bézier draft loop
    if (activeTool === 'bezier' && !isPointerDownRef.current && bezierDraftRef.current.length >= 2) {
      const startPos = bezierDraftRef.current[0].pos;
      setIsNearStart(distance(snapped, startPos) <= Math.max(3.5, gridSpacing * 0.6));
      redrawCanvas();
      return;
    }

    if (!isPointerDownRef.current) {
      if (enableSnapGrid) redrawCanvas();
      return;
    }

    // Dragging Bézier handles while placing anchor in Bézier Pen Tool
    if (activeTool === 'bezier' && isDraggingBezierHandleRef.current) {
      const draft = bezierDraftRef.current;
      if (draft.length === 0) return;

      if (bezierClosingDragRef.current) {
        // Adjust closing anchor handles (anchor 0)
        const anc0 = draft[0];
        const dx = snapped[0] - anc0.pos[0];
        const dy = snapped[1] - anc0.pos[1];
        if (Math.hypot(dx, dy) > 0.6) {
          const updated0: BezierAnchor = {
            ...anc0,
            mode: 'symmetric',
            handleOut: snapped,
            handleIn: [
              Math.max(0, Math.min(100, anc0.pos[0] - dx)),
              Math.max(0, Math.min(100, anc0.pos[1] - dy)),
            ],
          };
          setBezierDraft([updated0, ...draft.slice(1)]);
        }
      } else {
        const lastIdx = draft.length - 1;
        const lastAnc = draft[lastIdx];
        const dx = snapped[0] - lastAnc.pos[0];
        const dy = snapped[1] - lastAnc.pos[1];
        if (Math.hypot(dx, dy) > 0.6) {
          const updatedLast: BezierAnchor = {
            ...lastAnc,
            mode: 'symmetric',
            handleOut: snapped,
            handleIn: [
              Math.max(0, Math.min(100, lastAnc.pos[0] - dx)),
              Math.max(0, Math.min(100, lastAnc.pos[1] - dy)),
            ],
          };
          setBezierDraft([...draft.slice(0, lastIdx), updatedLast]);
        }
      }
      redrawCanvas();
      return;
    }

    // Dragging Bézier tangent handleIn / handleOut in Node Mode
    if (
      (dragModeRef.current === 'move-handle-in' || dragModeRef.current === 'move-handle-out') &&
      selectedStrokeId &&
      selectedNodeIndex !== null
    ) {
      const which = dragModeRef.current === 'move-handle-in' ? 'in' : 'out';
      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== selectedStrokeId || !s.bezierAnchors) return s;
          const nextAnchors = s.bezierAnchors.map((anc, idx) =>
            idx === selectedNodeIndex ? updateAnchorHandle(anc, which, snapped) : anc
          );
          return {
            ...s,
            bezierAnchors: nextAnchors,
            points: sampleBezierPath(nextAnchors, s.isClosed, 20),
          };
        })
      );
      redrawCanvas();
      return;
    }

    // Moving a single node in Node Mode
    if (dragModeRef.current === 'move-node' && selectedStrokeId && selectedNodeIndex !== null) {
      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== selectedStrokeId) return s;
          if (s.bezierAnchors) {
            const nextAnchors = s.bezierAnchors.map((anc, idx) =>
              idx === selectedNodeIndex ? moveBezierAnchor(anc, snapped) : anc
            );
            return {
              ...s,
              bezierAnchors: nextAnchors,
              points: sampleBezierPath(nextAnchors, s.isClosed, 20),
            };
          }
          const nextPts = [...s.points];
          nextPts[selectedNodeIndex] = snapped;
          return { ...s, points: nextPts };
        })
      );
      redrawCanvas();
      return;
    }

    // Moving entire shape in Select Mode
    if (dragModeRef.current === 'move-shape' && selectedStrokeId && startDragPtRef.current) {
      const dx = snapped[0] - startDragPtRef.current[0];
      const dy = snapped[1] - startDragPtRef.current[1];
      const movedPts = translatePath(originalPointsRef.current, dx, dy);
      const movedAnchors = originalAnchorsRef.current
        ? transformBezierAnchors(originalAnchorsRef.current, ([x, y]) => [
            Math.max(0, Math.min(100, x + dx)),
            Math.max(0, Math.min(100, y + dy)),
          ])
        : undefined;

      setStrokes((prev) =>
        prev.map((s) =>
          s.id === selectedStrokeId
            ? { ...s, points: movedPts, bezierAnchors: movedAnchors }
            : s
        )
      );
      redrawCanvas();
      return;
    }

    // Scaling shape via handle
    if (dragModeRef.current === 'scale-handle' && selectedStrokeId && startDragPtRef.current) {
      const origBounds = getPathBounds(originalPointsRef.current);
      const startW = origBounds.width || 1;
      const startH = origBounds.height || 1;
      const dx = snapped[0] - startDragPtRef.current[0];
      const dy = snapped[1] - startDragPtRef.current[1];

      let scaleFactorX = 1;
      let scaleFactorY = 1;

      if (activeHandleRef.current === 'br') {
        scaleFactorX = Math.max(0.2, (startW + dx) / startW);
        scaleFactorY = Math.max(0.2, (startH + dy) / startH);
      } else if (activeHandleRef.current === 'tl') {
        scaleFactorX = Math.max(0.2, (startW - dx) / startW);
        scaleFactorY = Math.max(0.2, (startH - dy) / startH);
      } else if (activeHandleRef.current === 'tr') {
        scaleFactorX = Math.max(0.2, (startW + dx) / startW);
        scaleFactorY = Math.max(0.2, (startH - dy) / startH);
      } else if (activeHandleRef.current === 'bl') {
        scaleFactorX = Math.max(0.2, (startW - dx) / startW);
        scaleFactorY = Math.max(0.2, (startH + dy) / startH);
      }

      const origin: Point2D = [origBounds.centerX, origBounds.centerY];
      const scaledPts = scalePath(originalPointsRef.current, scaleFactorX, scaleFactorY, origin);
      const scaledAnchors = originalAnchorsRef.current
        ? transformBezierAnchors(originalAnchorsRef.current, ([x, y]) => [
            Math.max(0, Math.min(100, origin[0] + (x - origin[0]) * scaleFactorX)),
            Math.max(0, Math.min(100, origin[1] + (y - origin[1]) * scaleFactorY)),
          ])
        : undefined;

      setStrokes((prev) =>
        prev.map((s) =>
          s.id === selectedStrokeId
            ? { ...s, points: scaledPts, bezierAnchors: scaledAnchors }
            : s
        )
      );
      redrawCanvas();
      return;
    }

    // Rotating shape via lever
    if (dragModeRef.current === 'rotate-handle' && selectedStrokeId) {
      const origBounds = getPathBounds(originalPointsRef.current);
      const angle =
        (Math.atan2(snapped[1] - origBounds.centerY, snapped[0] - origBounds.centerX) * 180) /
          Math.PI +
        90;
      const origin: Point2D = [origBounds.centerX, origBounds.centerY];
      const angleRad = (angle * Math.PI) / 180;
      const rotatedPts = rotatePath(originalPointsRef.current, angle, origin);
      const rotatedAnchors = originalAnchorsRef.current
        ? transformBezierAnchors(originalAnchorsRef.current, (p) => {
            const r = rotatePoint(p, origin, angleRad);
            return [Math.max(0, Math.min(100, r[0])), Math.max(0, Math.min(100, r[1]))];
          })
        : undefined;

      setStrokes((prev) =>
        prev.map((s) =>
          s.id === selectedStrokeId
            ? { ...s, points: rotatedPts, bezierAnchors: rotatedAnchors }
            : s
        )
      );
      redrawCanvas();
      return;
    }

    // Active stroke drawing
    if (dragModeRef.current === 'draw') {
      if (activeTool === 'pen') {
        const [filteredX, filteredY] = stabilizerRef.current.filter(raw[0], raw[1]);
        const currentFiltered: Point2D = [filteredX, filteredY];
        const lastPt = currentRawPointsRef.current[currentRawPointsRef.current.length - 1];

        if (!lastPt || distance(lastPt, currentFiltered) >= 0.4) {
          currentRawPointsRef.current.push(currentFiltered);
        }

        if (autoCloseLoop && currentRawPointsRef.current.length > 10) {
          const start = currentRawPointsRef.current[0];
          setIsNearStart(distance(currentFiltered, start) <= 6);
        }
      } else if (activeTool === 'line') {
        if (startDragPtRef.current) {
          currentRawPointsRef.current = [startDragPtRef.current, snapped];
        }
      } else if (activeTool === 'circle') {
        if (startDragPtRef.current) {
          const center = startDragPtRef.current;
          currentRawPointsRef.current = generateEllipse(
            center,
            Math.abs(snapped[0] - center[0]),
            Math.abs(snapped[1] - center[1]),
            48
          );
        }
      } else if (activeTool === 'rect') {
        if (startDragPtRef.current) {
          currentRawPointsRef.current = generateRectangle(startDragPtRef.current, snapped, 2);
        }
      } else if (activeTool === 'star') {
        if (startDragPtRef.current) {
          const center = startDragPtRef.current;
          const radius = distance(center, snapped);
          const starPts: Point2D[] = [];
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? radius : radius * 0.45;
            const angle = (i * Math.PI) / 5 - Math.PI / 2;
            starPts.push([center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle)]);
          }
          starPts.push([starPts[0][0], starPts[0][1]]);
          currentRawPointsRef.current = starPts;
        }
      } else if (activeTool === 'heart') {
        if (startDragPtRef.current) {
          const center = startDragPtRef.current;
          const radius = distance(center, snapped);
          const heartPts: Point2D[] = [];
          for (let t = 0; t <= Math.PI * 2; t += 0.15) {
            const x = 16 * Math.pow(Math.sin(t), 3);
            const y = -(
              13 * Math.cos(t) -
              5 * Math.cos(2 * t) -
              2 * Math.cos(3 * t) -
              Math.cos(4 * t)
            );
            heartPts.push([center[0] + (x / 18) * radius, center[1] + (y / 18) * radius]);
          }
          heartPts.push([heartPts[0][0], heartPts[0][1]]);
          currentRawPointsRef.current = heartPts;
        }
      }
      redrawCanvas();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    isPointerDownRef.current = false;

    // Finish Bézier anchor placement / handle drag
    if (activeTool === 'bezier') {
      isDraggingBezierHandleRef.current = false;
      if (bezierClosingDragRef.current) {
        bezierClosingDragRef.current = false;
        commitBezierDraft(true);
      }
      return;
    }

    setIsNearStart(false);

    if (
      dragModeRef.current === 'move-shape' ||
      dragModeRef.current === 'scale-handle' ||
      dragModeRef.current === 'rotate-handle' ||
      dragModeRef.current === 'move-node' ||
      dragModeRef.current === 'move-handle-in' ||
      dragModeRef.current === 'move-handle-out'
    ) {
      recordHistory([...strokes]);
      dragModeRef.current = 'none';
      return;
    }

    if (dragModeRef.current === 'draw') {
      let finalPoints = [...currentRawPointsRef.current];
      if (finalPoints.length < 2) {
        currentRawPointsRef.current = [];
        dragModeRef.current = 'none';
        redrawCanvas();
        return;
      }

      let closed = false;
      if (
        activeTool === 'circle' ||
        activeTool === 'rect' ||
        activeTool === 'star' ||
        activeTool === 'heart'
      ) {
        closed = true;
      } else if (activeTool === 'pen') {
        if (autoCloseLoop && isLoopClosed(finalPoints, 7)) {
          finalPoints = closeLoop(finalPoints);
          closed = true;
        } else if (enableSnapGrid) {
          // Snap endpoint to magnetic grid if not closing loop
          finalPoints[finalPoints.length - 1] = snapToGrid(
            finalPoints[finalPoints.length - 1],
            gridSpacing
          );
        }
      }

      let generatedAnchors: BezierAnchor[] | undefined = undefined;

      if (activeTool === 'pen') {
        const eps = smoothingLevel === 'high' ? 0.9 : smoothingLevel === 'medium' ? 0.5 : 0.2;
        let clean = simplifyPointsRDP(finalPoints, eps);
        if (smoothingLevel === 'medium') {
          clean = chaikinSmooth(clean, 2, closed);
        } else if (smoothingLevel === 'high') {
          clean = catmullRomSpline(clean, 3, closed);
        }

        if (autoBezierFreehand && clean.length >= 3) {
          generatedAnchors = polylineToBezierAnchors(clean, closed, 1.5);
          finalPoints = sampleBezierPath(generatedAnchors, closed, 18);
        } else {
          finalPoints = clean;
        }
      }

      const newId = `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newStroke: StrokeItem = {
        id: newId,
        points: finalPoints,
        bezierAnchors: generatedAnchors,
        isClosed: closed,
        isOuter: false,
      };

      const newStrokes = [...strokes, newStroke];

      if (mirrorMode) {
        const mirroredPts: Point2D[] = finalPoints.map(([x, y]) => [
          Math.max(0, Math.min(100, 100 - x)),
          y,
        ]);
        const mirroredAnchors = generatedAnchors
          ? transformBezierAnchors(generatedAnchors, ([x, y]) => [
              Math.max(0, Math.min(100, 100 - x)),
              y,
            ])
          : undefined;
        newStrokes.push({
          id: `stroke_mirror_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          points: mirroredPts,
          bezierAnchors: mirroredAnchors,
          isClosed: closed,
          isOuter: false,
        });
      }

      const classified = reclassifyStrokes(newStrokes);
      recordHistory(classified);
      setSelectedStrokeId(newId);
      currentRawPointsRef.current = [];
      dragModeRef.current = 'none';
      redrawCanvas();
    }
  };

  // Double-click finishes open Bézier path
  const handleDoubleClick = () => {
    if (activeTool === 'bezier' && bezierDraftRef.current.length >= 2) {
      commitBezierDraft(false);
    }
  };

  // Convert selected stroke into editable Bézier anchors
  const handleConvertSelectedToBezier = () => {
    if (!selectedStrokeId) return;
    const target = strokes.find((s) => s.id === selectedStrokeId);
    if (!target || target.bezierAnchors) return;

    const anchors = polylineToBezierAnchors(target.points, target.isClosed, 1.3);
    const sampled = sampleBezierPath(anchors, target.isClosed, 20);
    const updated = strokes.map((s) =>
      s.id === selectedStrokeId
        ? { ...s, bezierAnchors: anchors, points: sampled }
        : s
    );
    recordHistory(updated);
    setActiveTool('node');
    setSelectedNodeIndex(0);
  };

  // Update selected Bézier node mode (corner / smooth / symmetric)
  const handleChangeSelectedAnchorMode = (mode: BezierNodeMode) => {
    if (!selectedStrokeId || selectedNodeIndex === null) return;
    const target = strokes.find((s) => s.id === selectedStrokeId);
    if (!target?.bezierAnchors) return;

    const nextAnchors = setAnchorMode(
      target.bezierAnchors,
      selectedNodeIndex,
      mode,
      target.isClosed
    );
    const nextPoints = sampleBezierPath(nextAnchors, target.isClosed, 20);
    const updated = strokes.map((s) =>
      s.id === selectedStrokeId
        ? { ...s, bezierAnchors: nextAnchors, points: nextPoints }
        : s
    );
    recordHistory(updated);
  };

  // Clear handles on selected Bézier anchor (straight corner)
  const handleFlattenSelectedAnchor = () => {
    if (!selectedStrokeId || selectedNodeIndex === null) return;
    const target = strokes.find((s) => s.id === selectedStrokeId);
    if (!target?.bezierAnchors) return;

    const nextAnchors = target.bezierAnchors.map((a, idx) =>
      idx === selectedNodeIndex
        ? { ...a, handleIn: null, handleOut: null, mode: 'corner' as BezierNodeMode }
        : a
    );
    const nextPoints = sampleBezierPath(nextAnchors, target.isClosed, 20);
    const updated = strokes.map((s) =>
      s.id === selectedStrokeId
        ? { ...s, bezierAnchors: nextAnchors, points: nextPoints }
        : s
    );
    recordHistory(updated);
  };

  // Vector Transformation Operations
  const handleFlipHorizontal = () => {
    if (!selectedStrokeId) return;
    const updated = strokes.map((s) => {
      if (s.id === selectedStrokeId) {
        const bounds = getPathBounds(s.points);
        const flippedPts = flipPath(s.points, true, false, bounds);
        const flippedAnchors = s.bezierAnchors
          ? transformBezierAnchors(s.bezierAnchors, ([x, y]) => [
              bounds.maxX - (x - bounds.minX),
              y,
            ])
          : undefined;
        return { ...s, points: flippedPts, bezierAnchors: flippedAnchors };
      }
      return s;
    });
    recordHistory(updated);
  };

  const handleFlipVertical = () => {
    if (!selectedStrokeId) return;
    const updated = strokes.map((s) => {
      if (s.id === selectedStrokeId) {
        const bounds = getPathBounds(s.points);
        const flippedPts = flipPath(s.points, false, true, bounds);
        const flippedAnchors = s.bezierAnchors
          ? transformBezierAnchors(s.bezierAnchors, ([x, y]) => [
              x,
              bounds.maxY - (y - bounds.minY),
            ])
          : undefined;
        return { ...s, points: flippedPts, bezierAnchors: flippedAnchors };
      }
      return s;
    });
    recordHistory(updated);
  };

  const handleRotate90 = () => {
    if (!selectedStrokeId) return;
    const updated = strokes.map((s) => {
      if (s.id === selectedStrokeId) {
        const bounds = getPathBounds(s.points);
        const origin: Point2D = [bounds.centerX, bounds.centerY];
        const angleRad = (90 * Math.PI) / 180;
        const rotatedPts = rotatePath(s.points, 90, origin);
        const rotatedAnchors = s.bezierAnchors
          ? transformBezierAnchors(s.bezierAnchors, (p) => {
              const r = rotatePoint(p, origin, angleRad);
              return [Math.max(0, Math.min(100, r[0])), Math.max(0, Math.min(100, r[1]))];
            })
          : undefined;
        return { ...s, points: rotatedPts, bezierAnchors: rotatedAnchors };
      }
      return s;
    });
    recordHistory(updated);
  };

  const handleCenterInCanvas = () => {
    if (!selectedStrokeId) return;
    const updated = strokes.map((s) => {
      if (s.id === selectedStrokeId) {
        const bounds = getPathBounds(s.points);
        const dx = 50 - bounds.centerX;
        const dy = 50 - bounds.centerY;
        const centeredPts = centerPathInCanvas(s.points);
        const centeredAnchors = s.bezierAnchors
          ? transformBezierAnchors(s.bezierAnchors, ([x, y]) => [
              Math.max(0, Math.min(100, x + dx)),
              Math.max(0, Math.min(100, y + dy)),
            ])
          : undefined;
        return { ...s, points: centeredPts, bezierAnchors: centeredAnchors };
      }
      return s;
    });
    recordHistory(updated);
  };

  const handleDuplicateSelected = () => {
    if (!selectedStrokeId) return;
    const original = strokes.find((s) => s.id === selectedStrokeId);
    if (!original) return;
    const newId = `stroke_${Date.now()}_dup`;
    const offsetPts = translatePath(original.points, 4, 4);
    const offsetAnchors = original.bezierAnchors
      ? transformBezierAnchors(original.bezierAnchors, ([x, y]) => [
          Math.max(0, Math.min(100, x + 4)),
          Math.max(0, Math.min(100, y + 4)),
        ])
      : undefined;
    const dup: StrokeItem = {
      ...original,
      id: newId,
      points: offsetPts,
      bezierAnchors: offsetAnchors,
      isOuter: false,
    };
    recordHistory([...strokes, dup]);
    setSelectedStrokeId(newId);
  };

  // Smooth Selected Stroke
  const handleSmoothSelectedStroke = () => {
    if (!selectedStrokeId) return;
    const updated = strokes.map((s) => {
      if (s.id === selectedStrokeId) {
        const smoothed = catmullRomSpline(s.points, 3, s.isClosed);
        const anchors = polylineToBezierAnchors(smoothed, s.isClosed, 1.4);
        return {
          ...s,
          points: sampleBezierPath(anchors, s.isClosed, 20),
          bezierAnchors: anchors,
        };
      }
      return s;
    });
    recordHistory(updated);
  };

  // Offset Path (Outset / Inset)
  const handleOffsetPath = (delta: number) => {
    if (!selectedStrokeId) return;
    const target = strokes.find((s) => s.id === selectedStrokeId);
    if (!target) return;

    const offsetPoints = offsetPathVector(target.points, delta);
    const newStroke: StrokeItem = {
      id: `stroke_offset_${Date.now()}`,
      points: offsetPoints,
      isClosed: target.isClosed,
      isOuter: false,
    };
    recordHistory([...strokes, newStroke]);
    setSelectedStrokeId(newStroke.id);
  };

  // SVG Export
  const handleExportSVG = () => {
    if (strokes.length === 0) return;
    const svgCode = exportPathsToSVG(strokes, modelName || 'cortador_vetorial');
    downloadSVGFile(
      svgCode,
      `${modelName.replace(/\s+/g, '_').toLowerCase() || 'cortador'}.svg`
    );
  };

  // SVG Import
  const handleImportSVGCode = (svgCode: string) => {
    try {
      const parsedPaths = parseSvgStringToPaths(svgCode);
      if (parsedPaths.length === 0) {
        alert('Nenhum caminho vetorial válido encontrado no SVG.');
        return;
      }

      const importedStrokes: StrokeItem[] = parsedPaths.map((pts, idx) => {
        const closed = distance(pts[0], pts[pts.length - 1]) <= 2;
        const anchors = polylineToBezierAnchors(pts, closed, 1.2);
        return {
          id: `svg_path_${Date.now()}_${idx}`,
          points: pts,
          bezierAnchors: anchors.length >= 2 ? anchors : undefined,
          isClosed: closed,
          isOuter: idx === 0,
        };
      });

      recordHistory(reclassifyStrokes([...strokes, ...importedStrokes]));
      setSvgModalOpen(false);
      setSvgTextInput('');
    } catch (err) {
      console.error('Erro ao importar SVG:', err);
      alert('Falha ao processar arquivo SVG.');
    }
  };

  const handleSVGFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) handleImportSVGCode(content);
    };
    reader.readAsText(file);
  };

  // Image Upload Tracing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setUploadedImageSrc(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleProcessUploadedImage = async () => {
    if (!uploadedImageSrc) return;
    setIsProcessing(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = uploadedImageSrc;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });

      const { outerPerimeter, innerDetails } = await traceImageToLineart(
        img,
        threshold,
        invert,
        0.55
      );

      const customModel: ModelLineart = {
        id: `custom_upload_${Date.now()}`,
        name: modelName || 'Desenho Personalizado',
        category: 'frames',
        categoryLabel: 'Desenho Próprio',
        description: 'Modelo gerado a partir de imagem lineart vetorizada.',
        iconName: 'Image',
        outerPerimeter,
        innerDetails,
      };

      onApplyCustomModel(customModel);
      onClose();
    } catch (err) {
      console.error('Failed to vectorize image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert drawn lines to 3D Model
  const handleProcessDrawnLines = () => {
    if (strokes.length === 0) return;

    const outerStroke = strokes.find((s) => s.isOuter) || strokes[0];
    let outerPerimeter = outerStroke.points;
    if (!outerStroke.isClosed && outerPerimeter.length >= 3) {
      outerPerimeter = closeLoop(outerPerimeter);
    }

    const innerDetails: Path2D[] = strokes
      .filter((s) => s.id !== outerStroke?.id)
      .map((s) => s.points);

    const customModel: ModelLineart = {
      id: `custom_draw_${Date.now()}`,
      name: modelName || 'Meu Cortador Vetorial',
      category: 'frames',
      categoryLabel: 'Desenho Próprio',
      description: 'Cortador e carimbo gerados com curvas Bézier e grade magnética.',
      iconName: 'PenTool',
      outerPerimeter,
      innerDetails,
    };

    onApplyCustomModel(customModel);
    onClose();
  };

  if (!isOpen) return null;

  const activeStroke = strokes.find((s) => s.id === selectedStrokeId);
  const outerStroke = strokes.find((s) => s.isOuter);
  const selectedAnchor =
    activeStroke?.bezierAnchors && selectedNodeIndex !== null
      ? activeStroke.bezierAnchors[selectedNodeIndex]
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 lg:p-5 bg-[var(--inverse-surface)]/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="p-3.5 px-6 border-b border-[var(--surface-container-high)] flex items-center justify-between bg-[var(--workbench-page)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--primary-fixed)] border border-[var(--primary)] rounded-xl text-[var(--primary)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--on-surface)] flex items-center gap-2">
                <span>Estúdio Vetorial (Curvas Bézier & Grade Magnética)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--primary-fixed)] text-[var(--primary)] border border-[var(--primary)] uppercase">
                  Illustrator / Inkscape
                </span>
              </h2>
              <p className="text-[11px] text-[var(--on-surface-variant)]">
                Desenhe com Caneta Bézier (alças tangentes), edite nós e curvas, alinhe com Grade Magnética ou vetorize imagens.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-xl hover:bg-[var(--surface-container-low)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-[var(--surface-container-high)] bg-[var(--workbench-page)] p-2 gap-2 px-6">
          <button
            onClick={() => setTab('draw')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              tab === 'draw'
                ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-md shadow-none'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]'
            }`}
          >
            <Spline className="w-4 h-4" />
            <span>Editor Vetorial, Bézier & Grade Magnética</span>
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              tab === 'upload'
                ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-md shadow-none'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Vetorizar Imagem (PNG/JPG)</span>
          </button>
        </div>

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-3">
          {/* Top Info / Name / SVG Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--workbench-page)] p-2.5 px-4 rounded-xl border border-[var(--surface-container-high)]">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <span className="text-xs font-medium text-[var(--on-surface-variant)] whitespace-nowrap">Nome:</span>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="flex-1 px-3 py-1 text-xs bg-[var(--workbench-panel)] border border-[var(--surface-container-highest)] rounded-lg text-[var(--on-surface)] focus:outline-none focus:border-[var(--primary)]"
                placeholder="Ex: Cortador Flor Geométrica"
              />
            </div>

            {/* SVG Import & Export Buttons */}
            <div className="flex items-center gap-2">
              <input
                ref={svgFileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                onChange={handleSVGFileUpload}
                className="hidden"
              />
              <button
                onClick={() => svgFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1 text-xs bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--primary)] rounded-lg border border-[var(--surface-container-highest)] transition-colors cursor-pointer"
                title="Abrir arquivo vetorial .SVG do Illustrator, Inkscape ou Corel"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar SVG</span>
              </button>

              <button
                onClick={() => setSvgModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] rounded-lg border border-[var(--surface-container-highest)] transition-colors cursor-pointer"
                title="Colar código SVG XML diretamente"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Colar SVG</span>
              </button>

              <button
                onClick={handleExportSVG}
                disabled={strokes.length === 0}
                className="flex items-center gap-1.5 px-3 py-1 text-xs bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] disabled:opacity-40 text-[var(--primary)] rounded-lg border border-[var(--surface-container-highest)] transition-colors cursor-pointer"
                title="Baixar arquivo .SVG com curvas Bézier reais compatível com Illustrator e Inkscape"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                <span>Exportar SVG</span>
              </button>
            </div>
          </div>

          {tab === 'draw' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left Column: Canvas & Primary Vector Toolbar (8 cols) */}
              <div className="lg:col-span-8 flex flex-col gap-2.5">
                {/* Illustrator/Inkscape Main Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[var(--workbench-page)] rounded-xl border border-[var(--surface-container-high)] text-xs">
                  {/* Vector Tools Group */}
                  <div className="flex flex-wrap items-center gap-1 bg-[var(--workbench-panel)] p-1 rounded-lg border border-[var(--surface-container-high)]">
                    {/* Selection Tool (V) */}
                    <button
                      onClick={() => setActiveTool('select')}
                      className={`p-1.5 px-2.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'select'
                          ? 'bg-[var(--primary)] text-[var(--on-surface)] font-bold shadow'
                          : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                      }`}
                      title="Seleção & Transformação (V) - Mover, redimensionar e girar objeto"
                    >
                      <MousePointer className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Seleção (V)</span>
                    </button>

                    {/* Direct Selection / Node & Handle Tool (A) */}
                    <button
                      onClick={() => setActiveTool('node')}
                      className={`p-1.5 px-2.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'node'
                          ? 'bg-[var(--primary)] text-[var(--on-surface)] font-bold shadow'
                          : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                      }`}
                      title="Editar Nós & Alças Bézier (A) - Ajuste âncoras e tangentes"
                    >
                      <Waypoints className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Nós Bézier (A)</span>
                    </button>

                    <div className="w-[1px] h-5 bg-[var(--surface-container-low)] mx-0.5" />

                    {/* Cubic Bézier Pen Tool (B) */}
                    <button
                      onClick={() => setActiveTool('bezier')}
                      className={`p-1.5 px-2.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'bezier'
                          ? 'bg-emerald-600 text-[var(--on-primary)] font-bold shadow'
                          : 'text-[var(--on-surface-variant)] hover:text-emerald-700'
                      }`}
                      title="Caneta Bézier (B) - Clique para âncora reta, clique e arraste para curvar alças"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Bézier (B)</span>
                    </button>

                    {/* Freehand Pen Tool (P) */}
                    <button
                      onClick={() => setActiveTool('pen')}
                      className={`p-1.5 px-2 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'pen'
                          ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                          : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                      }`}
                      title="Mão Livre com Estabilizador & Auto-Bézier (P)"
                    >
                      <Pen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-[11px]">Livre (P)</span>
                    </button>

                    {/* Line / Polyline */}
                    <button
                      onClick={() => setActiveTool('line')}
                      className={`p-1.5 px-2 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'line'
                          ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                          : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                      }`}
                      title="Linha Reta com Snap na Grade"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    {/* Circle */}
                    <button
                      onClick={() => setActiveTool('circle')}
                      className={`p-1.5 px-2 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'circle'
                          ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                          : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                      }`}
                      title="Círculo ou Elipse Perfeita"
                    >
                      <Circle className="w-3.5 h-3.5" />
                    </button>

                    {/* Rect */}
                    <button
                      onClick={() => setActiveTool('rect')}
                      className={`p-1.5 px-2 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'rect'
                          ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                          : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                      }`}
                      title="Retângulo / Moldura Geométrica"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>

                    {/* Star */}
                    <button
                      onClick={() => setActiveTool('star')}
                      className={`p-1.5 px-2 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'star'
                          ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                          : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                      }`}
                      title="Estrela Geométrica"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>

                    {/* Heart */}
                    <button
                      onClick={() => setActiveTool('heart')}
                      className={`p-1.5 px-2 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'heart'
                          ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                          : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                      }`}
                      title="Coração Orgânico"
                    >
                      <Heart className="w-3.5 h-3.5" />
                    </button>

                    {/* Eraser */}
                    <button
                      onClick={() => setActiveTool('eraser')}
                      className={`p-1.5 px-2 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'eraser'
                          ? 'bg-[var(--error)] text-[var(--on-surface)] font-bold'
                          : 'text-[var(--on-surface-variant)] hover:text-[var(--error)]'
                      }`}
                      title="Borracha de Vetores"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Undo / Redo & Clear */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleUndo}
                      disabled={undoStack.length === 0 && bezierDraft.length === 0}
                      className="p-1.5 px-2 rounded text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-30 transition-colors cursor-pointer"
                      title="Desfazer (Ctrl+Z)"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={redoStack.length === 0}
                      className="p-1.5 px-2 rounded text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-30 transition-colors cursor-pointer"
                      title="Refazer (Ctrl+Y)"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        recordHistory([]);
                        setBezierDraft([]);
                        setSelectedStrokeId(null);
                        setSelectedNodeIndex(null);
                      }}
                      className="p-1.5 px-2 rounded text-[var(--on-surface-variant)] hover:text-[var(--error)] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                      title="Limpar tudo"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Precision Canvas Area */}
                <div className="relative aspect-square w-full max-h-[460px] bg-[var(--workbench-page)] rounded-2xl border-2 border-[var(--surface-container-high)] shadow-inner flex items-center justify-center overflow-hidden touch-none select-none">
                  <canvas
                    ref={drawCanvasRef}
                    width={800}
                    height={800}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onDoubleClick={handleDoubleClick}
                    onPointerLeave={() => {
                      setCursorPos(null);
                      setRawCursorPos(null);
                    }}
                    className="cursor-crosshair w-full h-full block touch-none"
                    style={{ touchAction: 'none' }}
                  />

                  {/* HUD Info Tag */}
                  <div className="absolute top-3 left-3 bg-[var(--workbench-panel)] backdrop-blur-md px-3 py-1.5 rounded-lg border border-[var(--surface-container-highest)] text-[11px] font-mono text-[var(--on-surface-variant)] flex flex-wrap items-center gap-2.5 pointer-events-none">
                    <span className="flex items-center gap-1 text-[var(--primary)]">
                      <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
                      {cursorPos
                        ? `X: ${cursorPos[0].toFixed(1)}% Y: ${cursorPos[1].toFixed(1)}%`
                        : '0.0, 0.0'}
                    </span>
                    <span className="text-[var(--workbench-muted)]">|</span>
                    {enableSnapGrid && (
                      <>
                        <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                          <Magnet className="w-3 h-3" />
                          SNAP {gridSpacing}%
                        </span>
                        <span className="text-[var(--workbench-muted)]">|</span>
                      </>
                    )}
                    <span className="text-[var(--primary)]">
                      {activeTool === 'select'
                        ? 'Seleção (V)'
                        : activeTool === 'node'
                        ? 'Nós & Alças (A)'
                        : activeTool === 'bezier'
                        ? 'Caneta Bézier (B)'
                        : activeTool === 'pen'
                        ? 'Mão Livre (P)'
                        : 'Forma'}
                    </span>
                    {activeStroke && (
                      <>
                        <span className="text-[var(--workbench-muted)]">|</span>
                        <span className="text-[var(--on-surface-variant)]">
                          {activeStroke.bezierAnchors
                            ? `${activeStroke.bezierAnchors.length} âncoras Bézier`
                            : `${activeStroke.points.length} nós`}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Active Bézier Draft Floating Controls */}
                  {bezierDraft.length > 0 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[var(--workbench-panel)] backdrop-blur-md px-3 py-2 rounded-xl border border-emerald-300 shadow-2xl flex flex-wrap items-center justify-center gap-2 text-xs z-10">
                      <span className="text-[11px] text-emerald-700 font-medium px-1">
                        {bezierDraft.length} {bezierDraft.length === 1 ? 'âncora' : 'âncoras'} · Arraste para curvar alças
                      </span>
                      {bezierDraft.length >= 3 && (
                        <button
                          onClick={() => commitBezierDraft(true)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-600 text-[var(--on-primary)] font-bold rounded-lg text-[11px] cursor-pointer"
                        >
                          Fechar Contorno
                        </button>
                      )}
                      {bezierDraft.length >= 2 && (
                        <button
                          onClick={() => commitBezierDraft(false)}
                          className="px-2.5 py-1 bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] font-bold rounded-lg text-[11px] cursor-pointer"
                        >
                          Finalizar Aberto (Enter)
                        </button>
                      )}
                      <button
                        onClick={() => setBezierDraft([])}
                        className="px-2 py-1 bg-[var(--surface-container-low)] hover:bg-[#FEE2E2] text-[var(--on-surface-variant)] hover:text-[var(--error)] rounded-lg text-[11px] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Magnetic snap loop close helper */}
                  {isNearStart && (
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-emerald-600 text-[var(--on-primary)] font-bold text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce pointer-events-none">
                      <Magnet className="w-3.5 h-3.5" />
                      <span>
                        {activeTool === 'bezier'
                          ? 'Clique para Fechar Curva Bézier!'
                          : 'Solte para Fechar o Contorno!'}
                      </span>
                    </div>
                  )}

                  {/* Instructions on empty */}
                  {strokes.length === 0 && bezierDraft.length === 0 && !isPointerDownRef.current && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-[var(--primary-fixed)] border border-[var(--primary)] flex items-center justify-center text-[var(--primary)] mb-3">
                        <Spline className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--on-surface)]">
                        Prancheta Vetorial com Bézier & Grade Magnética
                      </p>
                      <p className="text-xs text-[var(--on-surface-variant)] max-w-md mt-1">
                        Use a <strong>Caneta Bézier (B)</strong> para clicar e arrastar alças de curva, ou desenhe à <strong>Mão Livre (P)</strong> com conversão automática para curvas editáveis. A <strong>Grade Magnética</strong> alinha formas geométricas com precisão.
                      </p>
                    </div>
                  )}
                </div>

                {/* Sub-toolbar: Magnetic Grid Mode & Guides */}
                <div className="p-2.5 bg-[var(--workbench-page)] rounded-xl border border-[var(--surface-container-high)] flex flex-col gap-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <button
                      onClick={() => setEnableSnapGrid(!enableSnapGrid)}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        enableSnapGrid
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300 font-semibold shadow-sm'
                          : 'bg-[var(--workbench-panel)] text-[var(--on-surface-variant)] border-[var(--surface-container-high)] hover:text-[var(--on-surface)]'
                      }`}
                      title="Ativar/Desativar Grade Magnética (Atalho: G · Segure Alt para ignorar temporariamente)"
                    >
                      <Magnet className="w-3.5 h-3.5" />
                      <span>Grade Magnética (G)</span>
                    </button>

                    <button
                      onClick={() => setShowGrid(!showGrid)}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        showGrid
                          ? 'bg-[var(--surface-container-low)] text-[var(--primary)] border-[var(--primary)]'
                          : 'bg-[var(--workbench-panel)] text-[var(--on-surface-variant)] border-[var(--surface-container-high)]'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>Exibir Grade</span>
                    </button>

                    <button
                      onClick={() => setShowCenterGuides(!showCenterGuides)}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        showCenterGuides
                          ? 'bg-[var(--surface-container-low)] text-[var(--primary)] border-[var(--primary)]'
                          : 'bg-[var(--workbench-panel)] text-[var(--on-surface-variant)] border-[var(--surface-container-high)]'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Eixos Centrais</span>
                    </button>

                    <button
                      onClick={() => setMirrorMode(!mirrorMode)}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        mirrorMode
                          ? 'bg-[var(--primary-fixed)] text-[var(--primary)] border-[var(--primary)]'
                          : 'bg-[var(--workbench-panel)] text-[var(--on-surface-variant)] border-[var(--surface-container-high)]'
                      }`}
                    >
                      <SplitSquareVertical className="w-3.5 h-3.5" />
                      <span>Modo Espelho</span>
                    </button>
                  </div>

                  {/* Magnetic Grid Spacing Density Selector */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[var(--surface-container-high)] text-[11px]">
                    <span className="text-[var(--on-surface-variant)] flex items-center gap-1.5">
                      <Magnet className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Passo da Grade Magnética:</span>
                    </span>
                    <div className="flex items-center gap-1 bg-[var(--workbench-panel)] p-0.5 rounded-lg border border-[var(--surface-container-high)]">
                      {(
                        [
                          { value: 2, label: 'Fina (2%)' },
                          { value: 5, label: 'Padrão (5%)' },
                          { value: 10, label: 'Média (10%)' },
                          { value: 12.5, label: 'Oitavos (12.5%)' },
                        ] as { value: GridSpacing; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setGridSpacing(opt.value);
                            if (!showGrid) setShowGrid(true);
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                            gridSpacing === opt.value
                              ? 'bg-emerald-600 text-[var(--on-primary)] font-bold'
                              : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-[var(--workbench-muted)] hidden sm:inline">
                      Segure <kbd className="px-1 py-0.5 bg-[var(--surface-container-low)] rounded text-[var(--on-surface-variant)]">Alt</kbd> para ajuste livre
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Inspector, Bézier Node Controls & Layers (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                {/* Selected Bézier Anchor Controls */}
                {activeTool === 'node' && activeStroke && selectedAnchor && (
                  <div className="p-3.5 bg-[var(--workbench-page)] rounded-2xl border border-[var(--primary)] shadow-lg flex flex-col gap-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--primary)]">
                      <span className="flex items-center gap-1.5">
                        <Spline className="w-4 h-4" />
                        <span>Âncora Bézier #{(selectedNodeIndex ?? 0) + 1}</span>
                      </span>
                      <span className="text-[10px] font-mono uppercase bg-[var(--primary-fixed)] px-2 py-0.5 rounded text-[var(--primary)]">
                        {selectedAnchor.mode === 'corner'
                          ? 'Canto'
                          : selectedAnchor.mode === 'smooth'
                          ? 'Suave'
                          : 'Simétrico'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <button
                        onClick={() => handleChangeSelectedAnchorMode('corner')}
                        className={`py-1.5 px-2 rounded-lg border font-medium transition-colors cursor-pointer ${
                          selectedAnchor.mode === 'corner'
                            ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] font-bold'
                            : 'bg-[var(--workbench-panel)] text-[var(--on-surface-variant)] border-[var(--surface-container-highest)] hover:bg-[var(--surface-container-low)]'
                        }`}
                        title="Canto / Cúspide: Alças independentes para ângulos agudos"
                      >
                        Canto
                      </button>
                      <button
                        onClick={() => handleChangeSelectedAnchorMode('smooth')}
                        className={`py-1.5 px-2 rounded-lg border font-medium transition-colors cursor-pointer ${
                          selectedAnchor.mode === 'smooth'
                            ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] font-bold'
                            : 'bg-[var(--workbench-panel)] text-[var(--on-surface-variant)] border-[var(--surface-container-highest)] hover:bg-[var(--surface-container-low)]'
                        }`}
                        title="Suave: Alças alinhadas com comprimentos independentes"
                      >
                        Suave
                      </button>
                      <button
                        onClick={() => handleChangeSelectedAnchorMode('symmetric')}
                        className={`py-1.5 px-2 rounded-lg border font-medium transition-colors cursor-pointer ${
                          selectedAnchor.mode === 'symmetric'
                            ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] font-bold'
                            : 'bg-[var(--workbench-panel)] text-[var(--on-surface-variant)] border-[var(--surface-container-highest)] hover:bg-[var(--surface-container-low)]'
                        }`}
                        title="Simétrico: Alças alinhadas e espelhadas com mesmo comprimento"
                      >
                        Simétrico
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={handleFlattenSelectedAnchor}
                        className="flex-1 py-1.5 px-2 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded-lg text-[10px] text-[var(--on-surface-variant)] flex items-center justify-center gap-1 cursor-pointer"
                        title="Remover alças de curva deste nó (tornar vértice reto)"
                      >
                        <CornerDownRight className="w-3 h-3 text-[var(--primary)]" />
                        <span>Zerar Alças</span>
                      </button>
                      <button
                        onClick={handleDeleteSelectedNode}
                        className="py-1.5 px-2.5 bg-[#FEE2E2] hover:bg-[#FEE2E2] border border-[var(--error)] rounded-lg text-[10px] text-[var(--error)] flex items-center gap-1 cursor-pointer"
                        title="Excluir este nó (Delete)"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excluir Nó</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Contextual Transform Box (When Shape is Selected) */}
                {activeStroke ? (
                  <div className="p-3.5 bg-[var(--workbench-page)] rounded-2xl border border-[var(--primary)] shadow-lg flex flex-col gap-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--primary)]">
                      <span className="flex items-center gap-1.5">
                        <MousePointer className="w-4 h-4" />
                        <span>Objeto Selecionado</span>
                      </span>
                      <span className="text-[10px] text-[var(--on-surface-variant)] font-mono">
                        {activeStroke.bezierAnchors
                          ? `${activeStroke.bezierAnchors.length} âncoras Bézier`
                          : `${activeStroke.points.length} pontos`}
                      </span>
                    </div>

                    {/* Convert to Bézier button if stroke doesn't have Bézier anchors yet */}
                    {!activeStroke.bezierAnchors && (
                      <button
                        onClick={handleConvertSelectedToBezier}
                        className="w-full py-1.5 px-3 bg-emerald-100 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Converter contorno em âncoras e alças Bézier editáveis"
                      >
                        <Spline className="w-3.5 h-3.5" />
                        <span>Converter em Curvas Bézier Editáveis</span>
                      </button>
                    )}

                    {/* Transform Buttons Grid */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        onClick={handleFlipHorizontal}
                        className="p-1.5 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] text-[var(--on-surface-variant)] transition-colors cursor-pointer"
                        title="Inverter Horizontalmente"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Espelhar H</span>
                      </button>

                      <button
                        onClick={handleFlipVertical}
                        className="p-1.5 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] text-[var(--on-surface-variant)] transition-colors cursor-pointer"
                        title="Inverter Verticalmente"
                      >
                        <FlipVertical className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Espelhar V</span>
                      </button>

                      <button
                        onClick={handleRotate90}
                        className="p-1.5 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] text-[var(--on-surface-variant)] transition-colors cursor-pointer"
                        title="Girar 90 graus"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Girar 90°</span>
                      </button>

                      <button
                        onClick={handleCenterInCanvas}
                        className="p-1.5 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] text-[var(--on-surface-variant)] transition-colors cursor-pointer"
                        title="Centralizar no centro do quadro"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Centralizar</span>
                      </button>
                    </div>

                    {/* Offset Path */}
                    <div className="pt-2 border-t border-[var(--surface-container-high)]">
                      <span className="text-[11px] text-[var(--on-surface-variant)] block mb-1">
                        Deslocamento de Contorno (Offset Path):
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          onClick={() => handleOffsetPath(2)}
                          className="px-2 py-1 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded text-[10px] text-[var(--primary)] transition-colors cursor-pointer"
                        >
                          +2% Out
                        </button>
                        <button
                          onClick={() => handleOffsetPath(4)}
                          className="px-2 py-1 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded text-[10px] text-[var(--primary)] transition-colors cursor-pointer"
                        >
                          +4% Out
                        </button>
                        <button
                          onClick={() => handleOffsetPath(-2)}
                          className="px-2 py-1 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded text-[10px] text-[var(--primary)] transition-colors cursor-pointer"
                        >
                          -2% In
                        </button>
                        <button
                          onClick={() => handleOffsetPath(-4)}
                          className="px-2 py-1 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded text-[10px] text-[var(--primary)] transition-colors cursor-pointer"
                        >
                          -4% In
                        </button>
                      </div>
                    </div>

                    {/* Path Smoothing & Duplication */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleSmoothSelectedStroke}
                        className="flex-1 py-1 px-2 bg-[var(--workbench-panel)] hover:bg-[var(--primary-fixed)] border border-[var(--primary)] rounded text-[10px] text-[var(--primary)] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Suavizar curvas e gerar âncoras Bézier suaves"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Suavizar Bézier</span>
                      </button>

                      <button
                        onClick={handleDuplicateSelected}
                        className="py-1 px-2.5 bg-[var(--workbench-panel)] hover:bg-[var(--surface-container-low)] border border-[var(--surface-container-highest)] rounded text-[10px] text-[var(--on-surface-variant)] transition-colors flex items-center gap-1 cursor-pointer"
                        title="Duplicar Objeto"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Duplicar</span>
                      </button>

                      <button
                        onClick={handleDeleteSelectedStroke}
                        className="p-1 px-2 bg-[#FEE2E2] hover:bg-[#FEE2E2] border border-[var(--error)] rounded text-[var(--error)] transition-colors cursor-pointer"
                        title="Excluir este objeto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-[var(--workbench-page)] rounded-2xl border border-[var(--surface-container-high)] text-xs text-[var(--on-surface-variant)] flex items-start gap-2.5">
                    <PenTool className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      Dica: Use <strong>Bézier (B)</strong> para curvas perfeitas com alças, <strong>Livre (P)</strong> para esboços suaves e <strong>Nós Bézier (A)</strong> para esculpir qualquer ponto ou alça tangente.
                    </span>
                  </div>
                )}

                {/* Precision & Smoothing Engine */}
                <div className="p-3.5 bg-[var(--workbench-page)] rounded-2xl border border-[var(--surface-container-high)] flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--on-surface)]">
                    <Sliders className="w-4 h-4 text-[var(--primary)]" />
                    <span>Motor de Traço & Auto-Bézier</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-[var(--on-surface-variant)] flex items-center justify-between mb-1">
                      <span>Estabilizador Mão Livre:</span>
                      <span className="font-mono text-[var(--primary)] uppercase text-[10px]">
                        {smoothingLevel === 'none'
                          ? 'Bruto'
                          : smoothingLevel === 'medium'
                          ? 'Equilibrado'
                          : 'Ultra'}
                      </span>
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-[var(--workbench-panel)] p-1 rounded-xl border border-[var(--surface-container-high)] text-[11px]">
                      <button
                        onClick={() => setSmoothingLevel('none')}
                        className={`py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          smoothingLevel === 'none'
                            ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                            : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                        }`}
                      >
                        Bruto
                      </button>
                      <button
                        onClick={() => setSmoothingLevel('medium')}
                        className={`py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          smoothingLevel === 'medium'
                            ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                            : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                        }`}
                      >
                        Suave
                      </button>
                      <button
                        onClick={() => setSmoothingLevel('high')}
                        className={`py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          smoothingLevel === 'high'
                            ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                            : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                        }`}
                      >
                        Ultra
                      </button>
                    </div>
                  </div>

                  {/* Auto-convert freehand to Bézier toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-[11px] text-[var(--on-surface-variant)] font-medium">
                        Auto-Bézier no Traço Livre
                      </p>
                      <p className="text-[10px] text-[var(--workbench-muted)]">
                        Gera alças editáveis automaticamente
                      </p>
                    </div>
                    <button
                      onClick={() => setAutoBezierFreehand(!autoBezierFreehand)}
                      className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors cursor-pointer ${
                        autoBezierFreehand
                          ? 'bg-emerald-600 text-[var(--on-primary)] font-bold'
                          : 'bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]'
                      }`}
                    >
                      {autoBezierFreehand ? 'Ativo' : 'Polilinha'}
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--on-surface-variant)] mb-1">
                      <span>Espessura Visual:</span>
                      <span className="font-mono text-[var(--primary)]">{brushSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="12"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full accent-[var(--primary)] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Layer Hierarchy / Contours List */}
                <div className="p-3.5 bg-[var(--workbench-page)] rounded-2xl border border-[var(--surface-container-high)] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--on-surface)]">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[var(--primary)]" />
                      <span>Camadas de Objetos ({strokes.length})</span>
                    </span>
                    <span className="text-[10px] text-[var(--on-surface-variant)]">
                      {outerStroke ? '1 Lâmina Cortador' : '0 Cortador'}
                    </span>
                  </div>

                  <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                    {strokes.length === 0 ? (
                      <div className="p-3 text-center text-[11px] text-[var(--workbench-muted)] border border-dashed border-[var(--surface-container-high)] rounded-xl">
                        Nenhum objeto na prancheta.
                      </div>
                    ) : (
                      strokes.map((st, idx) => {
                        const isSelected = st.id === selectedStrokeId;
                        return (
                          <div
                            key={st.id}
                            onClick={() => {
                              setSelectedStrokeId(st.id);
                              setSelectedNodeIndex(null);
                            }}
                            className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-[var(--primary-fixed)] border-[var(--primary)] text-[var(--primary)]'
                                : st.isOuter
                                ? 'bg-[var(--primary-fixed)] border-[var(--primary)] text-[var(--primary)]'
                                : 'bg-[var(--workbench-panel)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:border-[var(--surface-container-highest)]'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: st.isOuter ? '#904000' : '#7C4DFF' }}
                              />
                              <div className="truncate">
                                <p className="text-[11px] font-medium leading-tight truncate">
                                  {st.isOuter ? 'Lâmina de Corte (Contorno)' : `Carimbo #${idx + 1}`}
                                </p>
                                <p className="text-[9px] text-[var(--on-surface-variant)]">
                                  {st.bezierAnchors
                                    ? `${st.bezierAnchors.length} âncoras Bézier`
                                    : `${st.points.length} nós`}{' '}
                                  • {st.isClosed ? 'Fechado ✓' : 'Aberto'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!st.isOuter && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = strokes.map((s) => ({
                                      ...s,
                                      isOuter: s.id === st.id,
                                    }));
                                    recordHistory(updated);
                                  }}
                                  className="px-1.5 py-0.5 text-[9px] bg-[var(--surface-container-low)] hover:bg-[var(--primary)] hover:text-[var(--on-primary)] rounded text-[var(--on-surface-variant)] transition-colors cursor-pointer"
                                  title="Tornar este contorno a Lâmina do Cortador"
                                >
                                  Lâmina
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = strokes.filter((s) => s.id !== st.id);
                                  recordHistory(reclassifyStrokes(updated));
                                  if (selectedStrokeId === st.id) setSelectedStrokeId(null);
                                }}
                                className="p-1 rounded text-[var(--workbench-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Upload Image Tab */
            <div className="flex flex-col gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              {!uploadedImageSrc ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--surface-container-highest)] hover:border-[var(--primary)] rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[var(--workbench-page)]"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[var(--primary-fixed)] border border-[var(--primary)] flex items-center justify-center text-[var(--primary)] mb-3">
                    <Upload className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--on-surface)]">
                    Clique aqui ou arraste uma imagem lineart
                  </p>
                  <p className="text-xs text-[var(--on-surface-variant)] mt-1 max-w-md">
                    PNG, JPG ou SVG com traços pretos nítidos sobre fundo branco ou transparente
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="relative aspect-video max-h-[280px] bg-[var(--workbench-page)] rounded-xl border border-[var(--surface-container-high)] flex items-center justify-center overflow-hidden p-3">
                    <img
                      src={uploadedImageSrc}
                      alt="Prévia lineart"
                      className="max-h-full max-w-full object-contain filter"
                      style={{
                        filter: `contrast(150%) ${invert ? 'invert(1)' : ''}`,
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute top-3 right-3 text-xs bg-[var(--workbench-panel)] backdrop-blur-md px-3 py-1.5 rounded-lg text-[var(--on-surface)] hover:text-[var(--on-surface)] border border-[var(--surface-container-highest)] shadow cursor-pointer"
                    >
                      Trocar Imagem
                    </button>
                  </div>

                  <div className="p-4 bg-[var(--workbench-page)] rounded-xl border border-[var(--surface-container-high)] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--on-surface-variant)] flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-[var(--primary)]" />
                        <span>Sensibilidade do Traço (Limiar P&B)</span>
                      </span>
                      <span className="text-xs font-mono text-[var(--primary)]">{threshold}</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="225"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="w-full accent-[var(--primary)] cursor-pointer"
                    />

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--surface-container-high)]">
                      <span className="text-xs text-[var(--on-surface-variant)]">
                        Inverter cores (se fundo for escuro)
                      </span>
                      <button
                        onClick={() => setInvert(!invert)}
                        className={`px-3 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                          invert
                            ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                            : 'bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]'
                        }`}
                      >
                        {invert ? 'Invertido' : 'Normal'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-[var(--surface-container-high)] bg-[var(--workbench-page)] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {tab === 'upload' ? (
            <button
              disabled={!uploadedImageSrc || isProcessing}
              onClick={handleProcessUploadedImage}
              className="flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-container)] disabled:opacity-40 text-[var(--on-primary)] font-bold text-xs rounded-xl shadow-lg shadow-none transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isProcessing ? 'Vetorizando...' : 'Gerar Cortador e Carimbo 3D'}</span>
            </button>
          ) : (
            <button
              disabled={strokes.length === 0}
              onClick={handleProcessDrawnLines}
              className="flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-container)] disabled:opacity-40 text-[var(--on-primary)] font-bold text-xs rounded-xl shadow-lg shadow-none transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Transformar em Modelo 3D ({strokes.length} objetos)</span>
            </button>
          )}
        </div>
      </div>

      {/* SVG Paste Modal */}
      {svgModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[var(--inverse-surface)]/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--on-surface)] flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[var(--primary)]" />
                <span>Colar Código SVG (Illustrator / Inkscape)</span>
              </h3>
              <button
                onClick={() => setSvgModalOpen(false)}
                className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--on-surface-variant)]">
              Copie o código SVG do Illustrator ou Inkscape (ou abra o arquivo .svg em um editor de texto) e cole abaixo:
            </p>
            <textarea
              rows={8}
              value={svgTextInput}
              onChange={(e) => setSvgTextInput(e.target.value)}
              placeholder="<svg ...><path d='M10,20 C30,5 60,5 80,20 ...' /></svg>"
              className="w-full p-3 text-xs font-mono bg-[var(--workbench-page)] border border-[var(--surface-container-highest)] rounded-xl text-[var(--on-surface)] focus:outline-none focus:border-[var(--primary)]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSvgModalOpen(false)}
                className="px-4 py-2 text-xs text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleImportSVGCode(svgTextInput)}
                disabled={!svgTextInput.trim()}
                className="px-5 py-2 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-container)] disabled:opacity-40 text-[var(--on-primary)] rounded-xl cursor-pointer"
              >
                Importar Vetor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
