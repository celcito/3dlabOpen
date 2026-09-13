# CookieCutter Design Editor — Implementation Plan

## Overview
Transform the current CookieCutterMaker from a preset-based generator into a full visual design editor with:
- Primitive shapes (circle, rect, triangle, star, polygon, heart)
- Text objects with font/size editing
- SVG import → editable elements
- Boolean operations (union, subtract, intersect, exclude)
- Viewport manipulation (TransformControls: translate/rotate/scale)
- Layer panel with drag-reorder, visibility, lock, role assignment
- Properties panel with numeric transform inputs
- Undo/redo history (50 steps)
- Export to STL (existing pipeline, new input model)

---

## Phase 1: Core Data Model & Hook Refactor
**Files:** `src/lib/cookie-cutter/designElements.ts` (new), `src/hooks/cookie/useCookieCutterPage.ts`

### Unified `DesignElement` Type
```typescript
type DesignElementType = "path" | "text" | "primitive" | "group";

interface DesignElement {
  id: string;
  type: DesignElementType;
  // Transform (mm, origin at canvas center)
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  // Role in export
  role: "cutter" | "stamp" | "ignore";
  // UI state
  visible: boolean;
  locked: boolean;
  zIndex: number;
  name: string;
  // Type-specific payload
  pathData?: string;                    // SVG path 'd' attribute
  textData?: { text: string; font: string; fontSize: number };
  primitiveData?: { 
    shape: "circle" | "rect" | "rounded-rect" | "triangle" | "star" | "polygon" | "heart";
    params: Record<string, number>;     // e.g. {radius: 20}, {width: 30, height: 20, cornerRadius: 2}
  };
  children?: DesignElement[];           // for "group" type
}
```

### Hook State (`useCookieCutterPage`)
```typescript
elements: DesignElement[];
selectedIds: string[];
history: DesignElement[][];     // max 50, coalesce rapid changes
clipboard: DesignElement[];
```

### Derived Selectors (for export pipeline)
- `getCutterPaths()` → boolean union of all `role === "cutter"` elements → outer outline
- `getStampPaths()` → all `role === "stamp"` elements → detail ribbons + plate
- Text/primitives → `toPath()` conversion at export time

### History Management
- Push on: drag-end, property commit, boolean op, element add/delete
- Coalesce: batch changes within 100ms window

---

## Phase 2: Viewport Editor (R3F + drei)
**Files:** `src/components/cookie-cutter/DesignViewport.tsx` (new)

### TransformControls
- Modes: `translate` | `rotate` | `scale` (toolbar toggle)
- Bounding box for multi-select
- Snap-to-grid: 1mm / 0.5mm / off (config in toolbar)
- Sync: `onChange` → live preview, `onMouseUp` → push to history

### Selection
- Click mesh → select (replace), Shift+click → toggle, drag marquee → multi-select
- Hover highlight, selected outline
- Double-click text → edit in-place (future)

### Coordinate System
- mm units, origin at center (matches `config.size`)
- Three.js scale `sc = 0.1` (1 unit = 10mm)

---

## Phase 3: Primitive Shapes & Palette
**Files:** `src/lib/cookie-cutter/primitives.ts` (new), `src/components/cookie-cutter/ShapePalette.tsx` (new)

| Primitive | Parameters |
|-----------|------------|
| Circle | `radius` |
| Rectangle | `width`, `height`, `cornerRadius` |
| Triangle | `side` (equilateral) |
| Star | `outerRadius`, `innerRadius`, `points` (default 5) |
| Polygon | `sides` (3-12), `radius` |
| Heart | `size` |

### Architecture
- Primitives stored as `primitiveData` (editable params)
- Convert to `THREE.Shape` / SVG path at render/export via `primitiveToPath()`
- Palette: click → add at (0,0), drag → position on drop

---

## Phase 4: Boolean Operations
**Files:** `src/lib/cookie-cutter/booleanOps.ts` (new)

- **Library**: `clipper-lib` (WASM, robust, handles holes/self-intersections)
- **Operations**: Union, Subtract (A-B), Intersect, Exclude (XOR)
- **Input**: Selected elements → convert all to Clipper paths
- **Output**: New compound `path` element (type: "path"), originals preserved for undo
- **Preview**: Show result outline on hover before commit

---

## Phase 5: Panels & Polish
**Files:** `src/components/cookie-cutter/{LayersPanel,PropertiesPanel,Toolbar}.tsx` (new)

### Toolbar (top)
- Tools: Select (V), Rectangle (R), Circle (C), Polygon (P), Star, Text (T)
- Boolean: Union, Subtract, Intersect, Exclude (enabled when ≥2 selected)
- Align: Left/Center/Right, Top/Middle/Bottom, Distribute H/V
- Grid: Toggle, Snap 1mm/0.5mm/Off
- History: Undo (Ctrl+Z), Redo (Ctrl+Shift+Z)
- View: Zoom fit, Wireframe toggle, Exploded view slider

### Layers Panel (left)
- Tree view with drag-reorder (updates `zIndex`)
- Row: visibility (eye), lock, name (editable), role dropdown (cutter/stamp/ignore), type icon
- Context menu: Duplicate (Ctrl+D), Delete, Group (Ctrl+G), Ungroup

### Properties Panel (right)
- Transform: X, Y, Rotation, Width, Height (linked/unlinked scale)
- Text: Font dropdown, Font size, Text content, Alignment
- Primitive: Shape-specific params (radius, cornerRadius, points, etc.)
- Appearance: Role, Opacity, Wireframe override

---

## Phase 6: SVG Import & Export
- **Import**: `SVGLoader` → parse paths → one `DesignElement` per subpath, preserve groups as nested `type: "group"`
- **Export**: Existing STL pipeline, input = derived selectors from Phase 1

---

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `V` | Select tool |
| `R` / `C` / `P` | Rectangle / Circle / Polygon |
| `T` | Text tool |
| `Delete` / `Backspace` | Delete selected |
| `Ctrl+D` | Duplicate |
| `Ctrl+G` / `Ctrl+Shift+G` | Group / Ungroup |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo |
| `Ctrl+C` / `Ctrl+V` | Copy / Paste |
| `+/-` / `Scroll` | Zoom |

---

## File Map
```
src/
├── lib/cookie-cutter/
│   ├── designElements.ts       # types, factories, path conversion
│   ├── primitives.ts           # primitive → path generators
│   ├── booleanOps.ts           # clipper-lib wrapper
│   └── textToShape.ts          # existing (text → ShapeGeometry)
├── hooks/cookie/
│   ├── useCookieCutterPage.ts  # REFACTOR: elements + history + selectors
│   └── useDesignEditor.ts      # viewport interactions, transform sync
├── components/cookie-cutter/
│   ├── DesignViewport.tsx      # Canvas + TransformControls + selection
│   ├── LayersPanel.tsx
│   ├── PropertiesPanel.tsx
│   ├── Toolbar.tsx
│   └── ShapePalette.tsx
└── pages/
    └── CookieCutterMaker.tsx   # THIN orchestrator
```

---

## Decisions Confirmed
| Decision | Choice |
|----------|--------|
| Boolean lib | `clipper-lib` (WASM) |
| Primitive storage | Keep as primitives, convert at export |
| Coordinate system | mm, origin at center |
| History granularity | Per-drag-end / per-command (coalesced) |
| Multi-select transform | Bounding box handles |
| Grouping | Yes — `type: "group"` with children |
| Path editing | Deferred to v2 |
| SVG import fidelity | Editable paths (gradients/fills lost) |
| Performance target | ~100 elements, instancing for repeated primitives |

---

## Preset Migration
- Convert existing 7 presets to `DesignElement[]` format
- Store in localStorage alongside new projects
- Backward compatible: old projects load as read-only, "Edit" converts to new model

---

## Next Steps
1. Create TLC spec with `tlc-spec-driven` skill
2. Initialize Phase 1 implementation