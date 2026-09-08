import { useState, useMemo, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import {
  Download, Layers, Sliders, Trash2, Check, Settings,
  Heart, Star, Hexagon, Circle, Square, Upload, Box,
  Image as ImageIcon, RefreshCw, ChevronRight, Minus, Plus
} from "lucide-react";
import { toastExportError } from "@/lib/toast";

const SCALE = 0.1;

interface FidgetConfig {
  numLayers: number;
  offsetStep: number;
  gap: number;
  wallThickness: number;
  ringHeight: number;
  filletRadius: number;
  keyringHole: boolean;
  keyringDiameter: number;
}

interface TwistConfig {
  shape: "sphere" | "cube";
  numSegments: number;
  twistAngle: number;
  clearance: number;
  ballDiameter: number;
  ballHeight: number;
  resolution: number;
}

interface FidgetPreset {
  id: string;
  name: string;
  icon: string;
  svg: string;
  makeShape: () => THREE.Shape;
}

const PRESETS: FidgetPreset[] = [
  {
    id: "heart",
    name: "Coração",
    icon: "❤️",
    svg: `<svg viewBox="0 0 100 100"><path fill="#E53935" d="M50 88 C25 65 5 50 5 30 C5 14 17 5 30 5 C38 5 46 10 50 18 C54 10 62 5 70 5 C83 5 95 14 95 30 C95 50 75 65 50 88Z"/></svg>`,
    makeShape: () => {
      const s = new THREE.Shape();
      s.moveTo(0, -0.38);
      s.bezierCurveTo(0, -0.38, -0.05, -0.55, -0.25, -0.55);
      s.bezierCurveTo(-0.55, -0.55, -0.55, -0.28, -0.55, -0.28);
      s.bezierCurveTo(-0.55, 0.0, -0.05, 0.32, 0, 0.55);
      s.bezierCurveTo(0.05, 0.32, 0.55, 0.0, 0.55, -0.28);
      s.bezierCurveTo(0.55, -0.28, 0.55, -0.55, 0.25, -0.55);
      s.bezierCurveTo(0.05, -0.55, 0, -0.38, 0, -0.38);
      return s;
    },
  },
  {
    id: "star",
    name: "Estrela",
    icon: "⭐",
    svg: `<svg viewBox="0 0 100 100"><polygon fill="#FDD835" points="50,5 61,35 95,38 70,60 77,93 50,76 23,93 30,60 5,38 39,35"/></svg>`,
    makeShape: () => {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.22;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const x = r * Math.cos(a);
        const y = r * Math.sin(a);
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      s.closePath();
      return s;
    },
  },
  {
    id: "hexagon",
    name: "Hexágono",
    icon: "⬡",
    svg: `<svg viewBox="0 0 100 100"><polygon fill="#7E57C2" points="50,3 93,25 93,75 50,97 7,75 7,25"/></svg>`,
    makeShape: () => {
      const s = new THREE.Shape();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 2;
        const x = 0.5 * Math.cos(a);
        const y = 0.5 * Math.sin(a);
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      s.closePath();
      return s;
    },
  },
  {
    id: "circle",
    name: "Círculo",
    icon: "⭕",
    svg: `<svg viewBox="0 0 100 100"><circle fill="#42A5F5" cx="50" cy="50" r="45"/></svg>`,
    makeShape: () => {
      const s = new THREE.Shape();
      const segs = 64;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const x = 0.5 * Math.cos(a);
        const y = 0.5 * Math.sin(a);
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      s.closePath();
      return s;
    },
  },
  {
    id: "square",
    name: "Quadrado",
    icon: "⬜",
    svg: `<svg viewBox="0 0 100 100"><rect fill="#66BB6A" x="8" y="8" width="84" height="84" rx="4"/></svg>`,
    makeShape: () => {
      const s = new THREE.Shape();
      const h = 0.45;
      const r = 0.03;
      s.moveTo(-h + r, -h);
      s.lineTo(h - r, -h);
      s.quadraticCurveTo(h, -h, h, -h + r);
      s.lineTo(h, h - r);
      s.quadraticCurveTo(h, h, h - r, h);
      s.lineTo(-h + r, h);
      s.quadraticCurveTo(-h, h, -h, h - r);
      s.lineTo(-h, -h + r);
      s.quadraticCurveTo(-h, -h, -h + r, -h);
      return s;
    },
  },
  {
    id: "cat",
    name: "Gato",
    icon: "🐱",
    svg: `<svg viewBox="0 0 100 100"><path fill="#FF8F00" d="M25 85 L15 45 L30 55 L50 20 L70 55 L85 45 L75 85 Z M35 70 A5 5 0 1 1 45 70 A5 5 0 1 1 35 70 M55 70 A5 5 0 1 1 65 70 A5 5 0 1 1 55 70 M45 80 Q50 85 55 80" stroke="#FF8F00" stroke-width="2" fill="none"/></svg>`,
    makeShape: () => {
      const s = new THREE.Shape();
      s.moveTo(-0.35, 0.35);
      s.lineTo(-0.45, -0.05);
      s.lineTo(-0.25, 0.1);
      s.lineTo(0, -0.4);
      s.lineTo(0.25, 0.1);
      s.lineTo(0.45, -0.05);
      s.lineTo(0.35, 0.35);
      s.lineTo(0.2, 0.25);
      s.lineTo(-0.2, 0.25);
      s.closePath();
      return s;
    },
  },
  {
    id: "paw",
    name: "Patinha",
    icon: "🐾",
    svg: `<svg viewBox="0 0 100 100"><ellipse fill="#8D6E63" cx="50" cy="65" rx="22" ry="18"/><ellipse fill="#8D6E63" cx="30" cy="38" rx="10" ry="12" transform="rotate(-15 30 38)"/><ellipse fill="#8D6E63" cx="50" cy="30" rx="9" ry="11"/><ellipse fill="#8D6E63" cx="70" cy="38" rx="10" ry="12" transform="rotate(15 70 38)"/></svg>`,
    makeShape: () => {
      const s = new THREE.Shape();
      const segs = 48;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const rx = 0.3, ry = 0.25;
        const x = rx * Math.cos(a);
        const y = ry * Math.sin(a) - 0.05;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      s.closePath();
      const toe = (cx: number, cy: number, rx: number, ry: number) => {
        const hole = new THREE.Path();
        for (let i = 0; i <= 32; i++) {
          const a = (i / 32) * Math.PI * 2;
          const px = cx + rx * Math.cos(a);
          const py = cy + ry * Math.sin(a);
          if (i === 0) hole.moveTo(px, py);
          else hole.lineTo(px, py);
        }
        hole.closePath();
        s.holes.push(hole);
      };
      return s;
    },
  },
  {
    id: "diamond",
    name: "Diamante",
    icon: "💎",
    svg: `<svg viewBox="0 0 100 100"><polygon fill="#26C6DA" points="50,5 85,35 50,95 15,35"/><polygon fill="#80DEEA" points="50,5 65,35 50,95 35,35" opacity="0.5"/></svg>`,
    makeShape: () => {
      const s = new THREE.Shape();
      s.moveTo(0, -0.5);
      s.lineTo(0.35, -0.1);
      s.lineTo(0.2, -0.1);
      s.lineTo(0, 0.45);
      s.lineTo(-0.2, -0.1);
      s.lineTo(-0.35, -0.1);
      s.closePath();
      return s;
    },
  },
];

function insetPolygon(points: THREE.Vector2[], dist: number): THREE.Vector2[] | null {
  if (points.length < 3) return null;
  const result: THREE.Vector2[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    if (len1 < 1e-10) { result.push(curr.clone()); continue; }
    const nx1 = -dy1 / len1, ny1 = dx1 / len1;
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (len2 < 1e-10) { result.push(curr.clone()); continue; }
    const nx2 = -dy2 / len2, ny2 = dx2 / len2;
    const nx = nx1 + nx2, ny = ny1 + ny2;
    const nl = Math.sqrt(nx * nx + ny * ny);
    if (nl < 1e-10) { result.push(curr.clone()); continue; }
    const d = dx1 * ny2 - dy1 * nx2;
    const sign = d > 0 ? 1 : d < 0 ? -1 : 1;
    const miter = dist / (nl * sign);
    result.push(new THREE.Vector2(curr.x + nx * miter, curr.y + ny * miter));
  }
  return result;
}

function pointsToShape(points: THREE.Vector2[]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i].x, points[i].y);
  s.closePath();
  return s;
}

function shapeToPoints(shape: THREE.Shape): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const p = shape.getPoints(64);
  for (const v of p) pts.push(new THREE.Vector2(v.x, v.y));
  return pts;
}

function reversePoints(pts: THREE.Vector2[]): THREE.Vector2[] {
  const r: THREE.Vector2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) r.push(pts[i].clone());
  return r;
}

function parseSvgShape(svgStr: string): THREE.Shape | null {
  try {
    const parsed = new SVGLoader().parse(svgStr);
    if (!parsed.paths.length) return null;
    const path = parsed.paths[0];
    const shapes = path.toShapes();
    return shapes.length > 0 ? shapes[0] : null;
  } catch { return null; }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildFidgetGeometry(baseShape: THREE.Shape, cfg: FidgetConfig): THREE.BufferGeometry | null {
  const { numLayers, offsetStep, wallThickness, ringHeight, filletRadius, keyringHole, keyringDiameter } = cfg;
  const meshes: THREE.Mesh[] = [];
  const rawPoints = shapeToPoints(baseShape);
  const SCALE_FACTOR = 50;
  const basePoints = rawPoints.map(p => new THREE.Vector2(p.x * SCALE_FACTOR, p.y * SCALE_FACTOR));

  for (let i = 0; i < numLayers; i++) {
    const offset = i * offsetStep;
    const outerPoints = insetPolygon(basePoints, offset);
    if (!outerPoints) continue;
    const innerPoints = insetPolygon(basePoints, offset + wallThickness);
    if (!innerPoints) continue;

    const outerShape = pointsToShape(outerPoints);
    const innerShape = pointsToShape(reversePoints(innerPoints));
    outerShape.holes.push(innerShape);

    if (i === 0 && keyringHole) {
      const maxDim = Math.max(
        ...outerPoints.map(p => Math.abs(p.x)),
        ...outerPoints.map(p => Math.abs(p.y))
      );
      const holeRadius = (keyringDiameter / 2) / (maxDim * 2.2);
      const holeCenter = outerPoints.reduce(
        (acc, p) => ({ x: acc.x + p.x / outerPoints.length, y: acc.y + p.y / outerPoints.length }),
        { x: 0, y: 0 }
      );
      const topY = Math.max(...outerPoints.map(p => p.y));
      const holeY = topY - holeRadius * 1.5;
      const holePath = new THREE.Path();
      const segs = 32;
      for (let j = 0; j <= segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        const px = holeCenter.x + holeRadius * Math.cos(a);
        const py = holeY + holeRadius * Math.sin(a);
        if (j === 0) holePath.moveTo(px, py);
        else holePath.lineTo(px, py);
      }
      holePath.closePath();
      outerShape.holes.push(holePath);
    }

    const bevelSegs = filletRadius > 0 ? 3 : 0;
    const geom = new THREE.ExtrudeGeometry(outerShape, {
      depth: ringHeight,
      bevelEnabled: filletRadius > 0,
      bevelThickness: filletRadius,
      bevelSize: filletRadius,
      bevelSegments: bevelSegs,
      steps: 1,
    });

    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = i * (ringHeight + cfg.gap);
    mesh.updateMatrixWorld(true);
    meshes.push(mesh);
  }

  if (meshes.length === 0) return null;
  if (meshes.length === 1) return meshes[0].geometry.clone();

  const merged = new THREE.BufferGeometry();
  const allPos: number[] = [];
  const allIdx: number[] = [];
  let offset2 = 0;
  for (const m of meshes) {
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    const pos = g.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i++) allPos.push(pos[i]);
    const idx = g.index;
    if (idx) {
      for (let i = 0; i < idx.count; i++) allIdx.push(idx.array[i] + offset2);
      offset2 += g.attributes.position.count;
    }
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(allPos, 3));
  merged.setIndex(allIdx);
  merged.computeVertexNormals();
  return merged;
}

function buildTwistBallGeometry(cfg: TwistConfig): THREE.BufferGeometry | null {
  const { shape, numSegments, twistAngle, clearance, ballDiameter, ballHeight, resolution } = cfg;
  if (numSegments < 2) return null;

  const radius = ballDiameter / 2;
  const halfH = ballHeight / 2;
  const segAngle = (2 * Math.PI / numSegments) - (clearance * Math.PI / 180);
  if (segAngle <= 0) return null;

  const allPositions: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  for (let seg = 0; seg < numSegments; seg++) {
    const baseAngle = seg * (2 * Math.PI / numSegments);

    const verts: THREE.Vector3[] = [];
    for (let ih = 0; ih <= resolution; ih++) {
      const t = ih / resolution;
      const h = -halfH + t * ballHeight;
      let rH: number;
      if (shape === "cube") {
        rH = radius;
      } else {
        rH = Math.max(0, Math.sqrt(Math.max(0, 1 - (h * h) / (halfH * halfH)))) * radius;
      }
      const twistRad = (t - 0.5) * (twistAngle * Math.PI / 180);
      const angularRes = Math.max(4, Math.ceil(resolution * 0.6));

      for (let ia = 0; ia <= angularRes; ia++) {
        const a = (ia / angularRes) * segAngle;
        const helixA = baseAngle + a + twistRad;
        const cosA = Math.cos(helixA);
        const sinA = Math.sin(helixA);
        let x: number, y: number;
        if (shape === "cube") {
          const maxAbs = Math.max(Math.abs(cosA), Math.abs(sinA));
          x = (cosA / maxAbs) * rH;
          y = (sinA / maxAbs) * rH;
        } else {
          x = rH * cosA;
          y = rH * sinA;
        }
        verts.push(new THREE.Vector3(x, y, h));
      }
    }

    const angularRes = Math.max(4, Math.ceil(resolution * 0.6));
    const segIndices: number[] = [];
    for (let ih = 0; ih < resolution; ih++) {
      for (let ia = 0; ia < angularRes; ia++) {
        const i0 = ih * (angularRes + 1) + ia;
        const i1 = i0 + 1;
        const i2 = i0 + (angularRes + 1);
        const i3 = i2 + 1;
        segIndices.push(i0, i2, i1);
        segIndices.push(i1, i2, i3);
      }
    }

    for (const p of verts) {
      allPositions.push(p.x, p.y, p.z);
    }
    for (const idx of segIndices) {
      allIndices.push(idx + vertexOffset);
    }
    vertexOffset += verts.length;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(allPositions, 3));
  geom.setIndex(allIndices);
  geom.computeVertexNormals();
  return geom;
}

export default function FidgetMaker() {
  const [mode, setMode] = useState<"layers" | "twist" | "twistCube">("layers");
  const [activePreset, setActivePreset] = useState("heart");
  const [uploadedSvg, setUploadedSvg] = useState<string | null>(null);
  const [tab, setTab] = useState<"shape" | "config">("shape");
  const [cfg, setCfg] = useState<FidgetConfig>({
    numLayers: 5, offsetStep: 2.5, gap: 0.4, wallThickness: 2.0,
    ringHeight: 3.0, filletRadius: 0.6, keyringHole: true, keyringDiameter: 4.0,
  });
  const [twistCfg, setTwistCfg] = useState<TwistConfig>({
    shape: "sphere", numSegments: 8, twistAngle: 90, clearance: 2.5,
    ballDiameter: 25, ballHeight: 21, resolution: 24,
  });
  const [exportMsg, setExportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const currentPreset = useMemo(() => PRESETS.find(p => p.id === activePreset)!, [activePreset]);

  const baseShape = useMemo(() => {
    if (uploadedSvg) {
      const parsed = parseSvgShape(uploadedSvg);
      if (parsed) return parsed;
    }
    return currentPreset.makeShape();
  }, [uploadedSvg, currentPreset]);

  const geometry = useMemo(() => {
    if (mode === "twist") return buildTwistBallGeometry({ ...twistCfg, shape: "sphere" });
    if (mode === "twistCube") return buildTwistBallGeometry({ ...twistCfg, shape: "cube" });
    return buildFidgetGeometry(baseShape, cfg);
  }, [mode, baseShape, cfg, twistCfg]);

  const showMsg = (m: string) => { setExportMsg(m); setTimeout(() => setExportMsg(""), 3000); };

  const handleSvgUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedSvg(ev.target?.result as string);
    reader.readAsText(file);
  }, []);

  const handleExportSTL = useCallback(() => {
    if (!geometry) return;
    try {
      const mesh = new THREE.Mesh(geometry);
      const result = new STLExporter().parse(mesh, { binary: true });
      downloadBlob(new Blob([result], { type: "application/octet-stream" }), `fidget-${activePreset}-${Date.now()}.stl`);
      showMsg("STL exportado!");
    } catch (err) { console.error(err); toastExportError(); }
  }, [geometry, activePreset]);

  const handleExport3MF = useCallback(() => {
    if (!geometry) return;
    try {
      const mesh = new THREE.Mesh(geometry);
      const result = new STLExporter().parse(mesh, { binary: true });
      downloadBlob(new Blob([result], { type: "application/octet-stream" }), `fidget-${activePreset}-${Date.now()}.3mf`);
      showMsg("3MF exportado!");
    } catch (err) { console.error(err); toastExportError(); }
  }, [geometry, activePreset]);

  const u = (key: keyof FidgetConfig, val: number) => setCfg(c => ({ ...c, [key]: val }));
  const ut = (key: keyof TwistConfig, val: number) => setTwistCfg(c => ({ ...c, [key]: val }));

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#F9FAF4]">
      {/* SIDEBAR */}
      <div className="w-full md:w-[380px] bg-[#F9FAF4] border-r border-[#E2E3DD] overflow-y-auto p-6 space-y-6 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
              <Layers className="w-6 h-6 text-[#632CE5]" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter text-[#1A1C19]">Fidget Maker</h1>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                {mode === "layers" ? "Camadas aninhadas com offset fixo" : mode === "twist" ? "Bola articulada com corte helicoidal" : "Cubo articulado com corte helicoidal"}
              </p>
            </div>
          </div>
        </header>

        {/* MODE SELECTOR */}
        <div className="flex bg-[#E8E9E3] rounded-lg p-1">
          {([["layers", "Camadas"], ["twist", "Twist Ball"], ["twistCube", "Twist Cube"]] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m as typeof mode)}
              className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${mode === m ? "bg-white text-[#1A1C19] shadow-sm" : "text-zinc-500 hover:text-[#1A1C19]"}`}>
              {label}
            </button>
          ))}
        </div>

        {mode === "layers" ? (
          <>
            {/* TABS */}
            <div className="flex bg-[#E8E9E3] rounded-lg p-1">
              {(["shape", "config"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${tab === t ? "bg-white text-[#1A1C19] shadow-sm" : "text-zinc-500 hover:text-[#1A1C19]"}`}>
                  {t === "shape" ? "Forma" : "Config"}
                </button>
              ))}
            </div>

            {tab === "shape" ? (
              <div className="space-y-5">
                {/* PRESET GRID */}
                <div>
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                    <Star className="w-3.5 h-3.5 text-[#632CE5]" />
                    Formas Internas
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => { setActivePreset(p.id); setUploadedSvg(null); }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${activePreset === p.id && !uploadedSvg ? "border-[#632CE5] bg-[#632CE5]/10 shadow-md" : "border-[#E8E9E3] bg-white hover:border-[#632CE5]/30"}`}>
                        <span className="text-xl">{p.icon}</span>
                        <span className="text-[8px] font-bold uppercase text-zinc-600">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* SVG IMPORT */}
                <div>
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                    <Upload className="w-3.5 h-3.5 text-[#632CE5]" />
                    Importar SVG
                  </h3>
                  <input ref={fileRef} type="file" accept=".svg" onChange={handleSvgUpload} className="hidden" />
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-[#E8E9E3] rounded-xl hover:border-[#632CE5]/40 hover:bg-[#632CE5]/5 transition-all">
                    <Upload className="w-4 h-4 text-zinc-500" />
                    <span className="text-[10px] font-bold uppercase text-zinc-500">
                      {uploadedSvg ? "SVG Carregado ✓" : "Carregar SVG"}
                    </span>
                  </button>
                  {uploadedSvg && (
                    <button onClick={() => setUploadedSvg(null)}
                      className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-[9px] font-bold uppercase text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-3 h-3" /> Remover SVG
                    </button>
                  )}
                </div>

                {/* PREVIEW */}
                <div className="bg-white rounded-xl border border-[#E8E9E3] p-4">
                  <div className="text-[9px] font-bold uppercase text-zinc-400 mb-2">Preview da Forma</div>
                  <div className="w-full h-32 flex items-center justify-center">
                    <div className="[&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                      dangerouslySetInnerHTML={{ __html: currentPreset.svg }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* CAMADAS */}
                <div>
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                    <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                    01. Camadas
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] uppercase font-bold text-zinc-600">Qtd. Camadas</label>
                      <div className="flex items-center gap-2">
                        <button onClick={() => u("numLayers", Math.max(1, cfg.numLayers - 1))}
                          className="w-6 h-6 rounded bg-[#E8E9E3] flex items-center justify-center hover:bg-[#632CE5]/20 transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] font-mono text-[#632CE5] w-6 text-center">{cfg.numLayers}</span>
                        <button onClick={() => u("numLayers", Math.min(10, cfg.numLayers + 1))}
                          className="w-6 h-6 rounded bg-[#E8E9E3] flex items-center justify-center hover:bg-[#632CE5]/20 transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <SliderRow label="Passo entre Camadas" value={cfg.offsetStep} unit="mm"
                      min={0.5} max={8} step={0.1} onChange={v => u("offsetStep", v)} />
                    <SliderRow label="Folga (Gap)" value={cfg.gap} unit="mm"
                      min={0} max={2} step={0.05} onChange={v => u("gap", v)} />
                  </div>
                </div>

                {/* PAREDE */}
                <div>
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                    <Box className="w-3.5 h-3.5 text-[#632CE5]" />
                    02. Parede & Extrusão
                  </h3>
                  <div className="space-y-3">
                    <SliderRow label="Espessura da Parede" value={cfg.wallThickness} unit="mm"
                      min={0.5} max={6} step={0.1} onChange={v => u("wallThickness", v)} />
                    <SliderRow label="Altura da Camada" value={cfg.ringHeight} unit="mm"
                      min={1} max={10} step={0.1} onChange={v => u("ringHeight", v)} />
                    <SliderRow label="Fillet (Arredondamento)" value={cfg.filletRadius} unit="mm"
                      min={0} max={2} step={0.05} onChange={v => u("filletRadius", v)} />
                  </div>
                </div>

                {/* CHAVEIRO */}
                <div>
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                    <Circle className="w-3.5 h-3.5 text-[#632CE5]" />
                    03. Chaveiro
                  </h3>
                  <div className="space-y-3">
                    <button onClick={() => setCfg(c => ({ ...c, keyringHole: !c.keyringHole }))}
                      className={`w-full flex items-center justify-center gap-2 py-3 border rounded text-[9px] font-black uppercase tracking-widest transition-all ${cfg.keyringHole ? "bg-[#632CE5] text-white border-[#632CE5]" : "bg-[#E8E9E3] text-zinc-500 border-[#E8E9E3]"}`}>
                      <Circle className="w-3.5 h-3.5" />
                      Furo do Chaveiro (Maior Camada)
                    </button>
                    {cfg.keyringHole && (
                      <SliderRow label="Diâmetro Furo" value={cfg.keyringDiameter} unit="mm"
                        min={2} max={8} step={0.1} onChange={v => u("keyringDiameter", v)} />
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : mode === "twist" ? (
          /* ===== TWIST BALL CONFIG ===== */
          <div className="space-y-5">
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                01. Dimensões
              </h3>
              <div className="space-y-3">
                <SliderRow label="Diâmetro" value={twistCfg.ballDiameter} unit="mm"
                  min={10} max={50} step={0.5} onChange={v => ut("ballDiameter", v)} />
                <SliderRow label="Altura" value={twistCfg.ballHeight} unit="mm"
                  min={10} max={50} step={0.5} onChange={v => ut("ballHeight", v)} />
              </div>
            </div>
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                02. Gomos & Twist
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] uppercase font-bold text-zinc-600">Qtd. Gomos</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => ut("numSegments", Math.max(2, twistCfg.numSegments - 1))}
                      className="w-6 h-6 rounded bg-[#E8E9E3] flex items-center justify-center hover:bg-[#632CE5]/20 transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-[11px] font-mono text-[#632CE5] w-6 text-center">{twistCfg.numSegments}</span>
                    <button onClick={() => ut("numSegments", Math.min(16, twistCfg.numSegments + 1))}
                      className="w-6 h-6 rounded bg-[#E8E9E3] flex items-center justify-center hover:bg-[#632CE5]/20 transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <SliderRow label="Ângulo de Twist" value={twistCfg.twistAngle} unit="°"
                  min={0} max={180} step={5} onChange={v => ut("twistAngle", v)} />
                <SliderRow label="Folga (Clearance)" value={twistCfg.clearance} unit="°"
                  min={0.5} max={6} step={0.1} onChange={v => ut("clearance", v)} />
              </div>
            </div>
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                03. Qualidade
              </h3>
              <div className="space-y-3">
                <SliderRow label="Resolução" value={twistCfg.resolution} unit=""
                  min={8} max={48} step={4} onChange={v => ut("resolution", v)} />
                <p className="text-[8px] text-zinc-400 leading-relaxed">
                  {twistCfg.twistAngle === 0
                    ? "Twist = 0°: gomos soltos, sem encaixe."
                    : `Folga estimada: ~${((twistCfg.clearance * Math.PI / 180) * (twistCfg.ballDiameter / 2)).toFixed(2)}mm entre gomos.`}
                </p>
              </div>
            </div>
          </div>
        ) : mode === "twistCube" ? (
          /* ===== TWIST CUBE CONFIG ===== */
          <div className="space-y-5">
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                01. Dimensões
              </h3>
              <div className="space-y-3">
                <SliderRow label="Lado" value={twistCfg.ballDiameter} unit="mm"
                  min={10} max={50} step={0.5} onChange={v => ut("ballDiameter", v)} />
                <SliderRow label="Altura" value={twistCfg.ballHeight} unit="mm"
                  min={10} max={50} step={0.5} onChange={v => ut("ballHeight", v)} />
              </div>
            </div>
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                02. Gomos & Twist
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] uppercase font-bold text-zinc-600">Qtd. Gomos</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => ut("numSegments", Math.max(2, twistCfg.numSegments - 1))}
                      className="w-6 h-6 rounded bg-[#E8E9E3] flex items-center justify-center hover:bg-[#632CE5]/20 transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-[11px] font-mono text-[#632CE5] w-6 text-center">{twistCfg.numSegments}</span>
                    <button onClick={() => ut("numSegments", Math.min(16, twistCfg.numSegments + 1))}
                      className="w-6 h-6 rounded bg-[#E8E9E3] flex items-center justify-center hover:bg-[#632CE5]/20 transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <SliderRow label="Ângulo de Twist" value={twistCfg.twistAngle} unit="°"
                  min={0} max={180} step={5} onChange={v => ut("twistAngle", v)} />
                <SliderRow label="Folga (Clearance)" value={twistCfg.clearance} unit="°"
                  min={0.5} max={6} step={0.1} onChange={v => ut("clearance", v)} />
              </div>
            </div>
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2 mb-3">
                <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                03. Qualidade
              </h3>
              <div className="space-y-3">
                <SliderRow label="Resolução" value={twistCfg.resolution} unit=""
                  min={8} max={48} step={4} onChange={v => ut("resolution", v)} />
                <p className="text-[8px] text-zinc-400 leading-relaxed">
                  {twistCfg.twistAngle === 0
                    ? "Twist = 0°: gomos soltos, sem encaixe."
                    : `Folga estimada: ~${((twistCfg.clearance * Math.PI / 180) * (twistCfg.ballDiameter / 2)).toFixed(2)}mm entre gomos.`}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* EXPORT (shared) */}
        <div className="pt-4 border-t border-[#E2E3DD] space-y-3">
          <button onClick={handleExportSTL} disabled={!geometry}
            className="w-full bg-[#632CE5] text-white py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#7C4DFF] transition-all shadow-[0_0_20px_rgba(124,58,237,0.2)] disabled:opacity-40">
            <Download className="w-4 h-4" /> Exportar STL
          </button>
          <button onClick={handleExport3MF} disabled={!geometry}
            className="w-full bg-white border-2 border-[#632CE5] text-[#632CE5] py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-[#632CE5]/5 transition-all disabled:opacity-40">
            <Download className="w-4 h-4" /> Exportar 3MF
          </button>
        </div>
      </div>

      {/* VIEWPORT */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <Canvas shadows camera={{ position: [0, 30, 80], fov: 35 }}>
            <color attach="background" args={["#F3F4EE"]} />
            <ambientLight intensity={0.6} />
            <hemisphereLight args={["#ffffff", "#666666", 0.6]} />
            <directionalLight position={[40, 40, 40]} intensity={1.4} castShadow />
            <pointLight position={[-40, -40, -20]} intensity={0.6} />
            <OrbitControls makeDefault />
            <Grid infiniteGrid fadeDistance={120} cellColor="#222" sectionColor="#444" cellSize={2} sectionSize={10} />
            <Center>
              {geometry ? (
                <mesh geometry={geometry} castShadow receiveShadow scale={[SCALE, SCALE, SCALE]}>
                  <meshStandardMaterial color="#632CE5" metalness={0.25} roughness={0.45} />
                </mesh>
              ) : (
                <mesh>
                  <boxGeometry args={[12, 12, 1]} />
                  <meshStandardMaterial color="#ccc" wireframe />
                </mesh>
              )}
            </Center>
          </Canvas>
        </div>

        {/* HUD */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-white/80 backdrop-blur-md border border-[#E2E3DD] p-4 rounded-xl space-y-1">
            <div className="text-[10px] font-black text-[#1A1C19] uppercase tracking-widest">Preview 3D</div>
            <div className="text-[13px] font-black text-[#632CE5] uppercase tracking-tighter">
              {mode === "layers"
                ? `${cfg.numLayers} camadas • ${cfg.wallThickness}mm parede`
                : `${twistCfg.numSegments} gomos • twist ${twistCfg.twistAngle}°`
              }
            </div>
          </div>
        </div>

        {/* EXPORT MSG */}
        {exportMsg && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#632CE5] text-white px-6 py-3 rounded-full flex items-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-lg">
              <Check className="w-4 h-4" /> {exportMsg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SliderRow({ label, value, unit, min, max, step, onChange }: {
  label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <label className="text-[9px] uppercase font-bold text-zinc-600">{label}</label>
        <span className="text-[10px] font-mono text-[#632CE5]">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#632CE5] h-1.5 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer" />
    </div>
  );
}
