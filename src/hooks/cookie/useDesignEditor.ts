import { useState, useCallback, useRef } from "react";
import {
  DesignElement,
  ElementRole,
  Transform,
  createId,
  defaultTransform,
  createPathElement,
  createTextElement,
  createPrimitiveElement,
  createGroupElement,
  toPathData,
  migrateLegacy,
} from "../../lib/cookie-cutter/designElements";
import { PrimitiveShape } from "../../lib/cookie-cutter/primitives";
import { booleanOperation, BooleanOp } from "../../lib/cookie-cutter/booleanOps";

interface HistoryEntry {
  elements: DesignElement[];
  selectedIds: string[];
}

interface ClipboardEntry {
  elements: DesignElement[];
  type: "copy" | "cut";
}

interface DesignEditorState {
  elements: DesignElement[];
  selectedIds: string[];
  canUndo: boolean;
  canRedo: boolean;
  clipboard: ClipboardEntry | null;
}

const MAX_HISTORY = 50;
const COALESCE_MS = 100;

export function useDesignEditor(initialElements: DesignElement[] = []) {
  const [elements, setElements] = useState<DesignElement[]>(initialElements);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardEntry | null>(null);

  const historyRef = useRef<HistoryEntry[]>([{ elements: initialElements, selectedIds: [] }]);
  const historyIndexRef = useRef(0);
  const lastActionTimeRef = useRef(0);
  const coalesceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const pushHistory = useCallback((newElements: DesignElement[], newSelectedIds: string[], coalesce = false) => {
    const now = Date.now();
    const timeSinceLastAction = now - lastActionTimeRef.current;

    if (coalesce && timeSinceLastAction < COALESCE_MS && historyIndexRef.current > 0) {
      historyRef.current[historyIndexRef.current] = { elements: newElements, selectedIds: newSelectedIds };
    } else {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push({ elements: newElements, selectedIds: newSelectedIds });
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift();
      } else {
        historyIndexRef.current++;
      }
    }
    lastActionTimeRef.current = now;
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const entry = historyRef.current[historyIndexRef.current];
    setElements(entry.elements);
    setSelectedIds(entry.selectedIds);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const entry = historyRef.current[historyIndexRef.current];
    setElements(entry.elements);
    setSelectedIds(entry.selectedIds);
  }, []);

  const updateElements = useCallback((updater: (prev: DesignElement[]) => DesignElement[], coalesce = false) => {
    setElements(prev => {
      const next = updater(prev);
      pushHistory(next, selectedIds, coalesce);
      return next;
    });
  }, [selectedIds, pushHistory]);

  const addPath = useCallback((pathData: string, role: ElementRole = "stamp", name?: string) => {
    const element = createPathElement(pathData, name, role);
    updateElements(prev => [...prev, element]);
    setSelectedIds([element.id]);
    return element;
  }, [updateElements]);

  const addPrimitive = useCallback((shape: PrimitiveShape, params: Record<string, number>, name?: string) => {
    const element = createPrimitiveElement(shape, params, name);
    updateElements(prev => [...prev, element]);
    setSelectedIds([element.id]);
    return element;
  }, [updateElements]);

  const addText = useCallback((text: string, font: string = "Arial", fontSize: number = 16) => {
    const element = createTextElement(text, font, fontSize);
    updateElements(prev => [...prev, element]);
    setSelectedIds([element.id]);
    return element;
  }, [updateElements]);

  const addGroup = useCallback((ids: string[]) => {
    const groupElements = elements.filter(e => ids.includes(e.id));
    if (groupElements.length < 2) return;
    const group = createGroupElement(groupElements);
    updateElements(prev => {
      const withoutSelected = prev.filter(e => !ids.includes(e.id));
      return [...withoutSelected, group];
    });
    setSelectedIds([group.id]);
    return group;
  }, [elements, updateElements]);

  const ungroup = useCallback((id: string) => {
    const element = elements.find(e => e.id === id);
    if (!element || element.type !== "group") return;
    updateElements(prev => {
      const withoutGroup = prev.filter(e => e.id !== id);
      return [...withoutGroup, ...element.children];
    });
  }, [elements, updateElements]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    updateElements(prev => prev.filter(e => !selectedIds.includes(e.id)));
    setSelectedIds([]);
  }, [selectedIds, updateElements]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selected = elements.filter(e => selectedIds.includes(e.id));
    const duplicates = selected.map(el => {
      const clone = { ...el, id: createId(), transform: { ...el.transform, x: el.transform.x + 5, y: el.transform.y + 5 } };
      if (clone.type === "group" && "children" in clone) {
        (clone as any).children = clone.children.map(c => ({ ...c, id: createId() }));
      }
      return clone;
    }) as DesignElement[];
    updateElements(prev => [...prev, ...duplicates]);
    setSelectedIds(duplicates.map(d => d.id));
  }, [elements, selectedIds, updateElements]);

  const copySelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selected = elements.filter(e => selectedIds.includes(e.id));
    setClipboard({ elements: selected, type: "copy" });
  }, [elements, selectedIds]);

  const cutSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selected = elements.filter(e => selectedIds.includes(e.id));
    setClipboard({ elements: selected, type: "cut" });
    updateElements(prev => prev.filter(e => !selectedIds.includes(e.id)));
    setSelectedIds([]);
  }, [elements, selectedIds, updateElements]);

  const paste = useCallback(() => {
    if (!clipboard) return;
    const pasted = clipboard.elements.map(el => ({
      ...el,
      id: createId(),
      transform: { ...el.transform, x: el.transform.x + 5, y: el.transform.y + 5 },
    })) as DesignElement[];
    updateElements(prev => [...prev, ...pasted]);
    setSelectedIds(pasted.map(p => p.id));
    if (clipboard.type === "cut") setClipboard(null);
  }, [clipboard, updateElements]);

  const updateTransform = useCallback((id: string, transform: Partial<Transform>, coalesce = false) => {
    updateElements(prev =>
      prev.map(el => el.id === id ? { ...el, transform: { ...el.transform, ...transform } } : el),
      coalesce
    );
  }, [updateElements]);

  const commitTransform = useCallback((id: string, transform: Transform) => {
    updateElements(prev =>
      prev.map(el => el.id === id ? { ...el, transform } : el)
    );
  }, [updateElements]);

  const updateTextData = useCallback((id: string, textData: { text: string; font: string; fontSize: number; align: "left" | "center" | "right" }) => {
    updateElements(prev =>
      prev.map(el => el.type === "text" && el.id === id ? { ...el, textData } : el)
    );
  }, [updateElements]);

  const updatePrimitiveData = useCallback((id: string, primitiveData: { shape: PrimitiveShape; params: Record<string, number> }) => {
    updateElements(prev =>
      prev.map(el => el.type === "primitive" && el.id === id ? { ...el, primitiveData } : el)
    );
  }, [updateElements]);

  const updateRole = useCallback((id: string, role: ElementRole) => {
    updateElements(prev =>
      prev.map(el => el.id === id ? { ...el, role } : el)
    );
  }, [updateElements]);

  const updateVisibility = useCallback((id: string) => {
    updateElements(prev =>
      prev.map(el => el.id === id ? { ...el, visible: !el.visible } : el)
    );
  }, [updateElements]);

  const updateLock = useCallback((id: string) => {
    updateElements(prev =>
      prev.map(el => el.id === id ? { ...el, locked: !el.locked } : el)
    );
  }, [updateElements]);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    updateElements(prev => {
      const visibleElements = prev.filter(e => e.role !== "ignore");
      const ignoredElements = prev.filter(e => e.role === "ignore");
      const [moved] = visibleElements.splice(fromIndex, 1);
      visibleElements.splice(toIndex, 0, moved);
      return [...visibleElements, ...ignoredElements];
    });
  }, [updateElements]);

  const alignElements = useCallback((align: "left" | "center" | "right" | "top" | "middle" | "bottom" | "distribute-h" | "distribute-v") => {
    if (selectedIds.length < 2) return;
    const selected = elements.filter(e => selectedIds.includes(e.id));
    const bounds = selected.map(el => {
      const b = { minX: el.transform.x, minY: el.transform.y, maxX: el.transform.x, maxY: el.transform.y };
      return { id: el.id, bounds: b };
    });

    const allMinX = Math.min(...bounds.map(b => b.bounds.minX));
    const allMaxX = Math.max(...bounds.map(b => b.bounds.maxX));
    const allMinY = Math.min(...bounds.map(b => b.bounds.minY));
    const allMaxY = Math.max(...bounds.map(b => b.bounds.maxY));
    const centerX = (allMinX + allMaxX) / 2;
    const centerY = (allMinY + allMaxY) / 2;

    updateElements(prev =>
      prev.map(el => {
        const b = bounds.find(bb => bb.id === el.id);
        if (!b) return el;
        let newTransform = { ...el.transform };
        switch (align) {
          case "left": newTransform.x = allMinX; break;
          case "center": newTransform.x = centerX; break;
          case "right": newTransform.x = allMaxX; break;
          case "top": newTransform.y = allMinY; break;
          case "middle": newTransform.y = centerY; break;
          case "bottom": newTransform.y = allMaxY; break;
          case "distribute-h": {
            const sorted = [...bounds].sort((a, b) => a.bounds.minX - b.bounds.minX);
            const step = (allMaxX - allMinX) / (sorted.length - 1);
            const idx = sorted.findIndex(s => s.id === el.id);
            newTransform.x = allMinX + step * idx;
            break;
          }
          case "distribute-v": {
            const sorted = [...bounds].sort((a, b) => a.bounds.minY - b.bounds.minY);
            const step = (allMaxY - allMinY) / (sorted.length - 1);
            const idx = sorted.findIndex(s => s.id === el.id);
            newTransform.y = allMinY + step * idx;
            break;
          }
        }
        return { ...el, transform: newTransform };
      })
    );
  }, [elements, selectedIds, updateElements]);

  const booleanOp = useCallback(async (op: BooleanOp) => {
    const selected = elements.filter(e => selectedIds.includes(e.id));
    try {
      const result = await booleanOperation(selected, op);
      const newElement = createPathElement(result.pathData, `Boolean ${op}`);
      updateElements(prev => {
        const withoutSelected = prev.filter(e => !result.originalIds.includes(e.id));
        return [...withoutSelected, newElement];
      });
      setSelectedIds([newElement.id]);
    } catch (e) {
      console.error("Boolean operation failed:", e);
    }
  }, [elements, selectedIds, updateElements]);

  const loadFromLegacy = useCallback((layers: any[], textObjects: any[]) => {
    const migrated = migrateLegacy(layers, textObjects);
    setElements(migrated);
    setSelectedIds([]);
    historyRef.current = [{ elements: migrated, selectedIds: [] }];
    historyIndexRef.current = 0;
  }, []);

  const setElementsDirect = useCallback((newElements: DesignElement[]) => {
    setElements(newElements);
    setSelectedIds([]);
    historyRef.current = [{ elements: newElements, selectedIds: [] }];
    historyIndexRef.current = 0;
  }, []);

  return {
    elements,
    selectedIds,
    setSelectedIds,
    canUndo,
    canRedo,
    clipboard,
    undo,
    redo,
    addPath,
    addPrimitive,
    addText,
    addGroup,
    ungroup,
    deleteSelected,
    duplicateSelected,
    copySelected,
    cutSelected,
    paste,
    updateTransform,
    commitTransform,
    updateTextData,
    updatePrimitiveData,
    updateRole,
    updateVisibility,
    updateLock,
    reorder,
    alignElements,
    booleanOp,
    loadFromLegacy,
    setElementsDirect,
  };
}
