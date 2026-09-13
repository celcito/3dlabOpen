"use client";

import { useState } from "react";
import {
  MousePointer, Move, RotateCw, Minimize2, Maximize2,
  RotateCcw, AlignLeft, AlignHorizontalSpaceAround, AlignRight,
  AlignCenterVertical, AlignCenterHorizontal,
  Undo2, Redo2, Copy, Clipboard, Plus, Minus, ZoomIn, ZoomOut,
  Grid, Maximize, Minimize, Box, Trash2, Download, Settings,
  Undo, Redo, GitBranch, Minus as ShiftIcon, Command, Keyboard, Text, Square, Circle, Triangle, Star, Heart,
} from "lucide-react";
import { BooleanOp } from "../../lib/cookie-cutter/booleanOps";

interface ToolbarProps {
  transformMode: "translate" | "rotate" | "scale";
  onModeChange: (mode: "translate" | "rotate" | "scale") => void;
  snapGrid: number;
  onSnapChange: (snap: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onBooleanOp: (op: BooleanOp) => void;
  onAlign: (align: "left" | "center" | "right" | "top" | "middle" | "bottom" | "distribute-h" | "distribute-v") => void;
  onZoomFit: () => void;
  onAddPrimitive: (shape: string) => void;
  onAddText: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onCut: () => void;
  wireframe: boolean;
  onWireframeToggle: () => void;
  showGrid: boolean;
  onGridToggle: () => void;
  onSnapGridChange: (snap: number) => void;
}

const TOOLS = [
  { id: "select", icon: MousePointer, label: "Selecionar (V)", shortcut: "V" },
  { id: "move", icon: Move, label: "Mover (M)", shortcut: "M" },
  { id: "rotate", icon: RotateCw, label: "Rotacionar (R)", shortcut: "R" },
  { id: "scale", icon: Minimize2, label: "Escalar (S)", shortcut: "S" },
];

const PRIMITIVES = [
  { id: "rect", icon: "▭", label: "Retângulo (R)" },
  { id: "circle", icon: "⭕", label: "Círculo (C)" },
  { id: "triangle", icon: "△", label: "Triângulo (T)" },
  { id: "rounded-rect", icon: "⬜", label: "Ret. Arredondado" },
  { id: "star", icon: "★", label: "Estrela" },
  { "id": "polygon", icon: "⬟", label: "Polígono" },
  { "id": "heart", icon: "♥", label: "Coração" },
];

const ALIGN_ACTIONS = [
  { id: "left", icon: AlignLeft, label: "Alinhar Esquerda" },
  { id: "center", icon: AlignHorizontalSpaceAround, label: "Centralizar H" },
  { id: "right", icon: AlignRight, label: "Alinhar Direita" },
  { id: "top", icon: AlignCenterVertical, label: "Alinhar Topo" },
  { id: "middle", icon: AlignCenterHorizontal, label: "Centralizar V" },
  { id: "bottom", icon: AlignCenterVertical, label: "Alinhar Baixo" },
  { id: "distribute-h", icon: AlignHorizontalSpaceAround, label: "Distribuir H" },
  { id: "distribute-v", icon: AlignCenterHorizontal, label: "Distribuir V" },
];

const BOOLEAN_OPS: { id: BooleanOp; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { id: "union", icon: <span className="text-[10px] font-bold">∪</span>, label: "União", shortcut: "U" },
  { id: "subtract", icon: <span className="text-[10px] font-bold">−</span>, label: "Subtração", shortcut: "Shift+S" },
  { id: "intersect", icon: <span className="text-[10px] font-bold">∩</span>, label: "Interseção", shortcut: "Shift+I" },
  { id: "exclude", icon: <span className="text-[10px] font-bold">⊕</span>, label: "Exclusão XOR", shortcut: "Shift+X" },
];

export function Toolbar({
  transformMode,
  onModeChange,
  snapGrid,
  onSnapChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onBooleanOp,
  onAlign,
  onZoomFit,
  onAddPrimitive,
  onAddText,
  onDelete,
  onDuplicate,
  onGroup,
  onUngroup,
  onCopy,
  onPaste,
  onCut,
  wireframe,
  onWireframeToggle,
  showGrid,
  onGridToggle,
  onSnapGridChange,
}: ToolbarProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  return (
    <div className="bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Tools */}
        <div className="flex items-center gap-0.5 border-r border-[#E2E3DD] pr-2">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => onModeChange(tool.id as "translate" | "rotate" | "scale")}
              className={`p-1.5 rounded transition-colors ${
                transformMode === tool.id
                  ? "bg-[#632CE5]/10 text-[#632CE5]"
                  : "text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]"
              }`}
              title={`${tool.label}`}
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Primitives */}
        <div className="flex items-center gap-0.5 border-r border-[#E2E3DD] pr-2">
          <button className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors" title="Adicionar Forma">
            <Box className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => onAddPrimitive("rect")}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors"
              title="Retângulo (R)"
            >
              <span className="text-[12px]">▭</span>
            </button>
            <button
              onClick={() => onAddPrimitive("circle")}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors"
              title="Círculo (C)"
            >
              <span className="text-[12px]">⭕</span>
            </button>
            <button
              onClick={() => onAddPrimitive("triangle")}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors"
              title="Triângulo (T)"
            >
              <span className="text-[12px]">△</span>
            </button>
            <button
              onClick={() => onAddPrimitive("rounded-rect")}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors"
              title="Ret. Arredondado"
            >
              <span className="text-[12px]">⬜</span>
            </button>
            <button
              onClick={() => onAddPrimitive("star")}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors"
              title="Estrela"
            >
              <span className="text-[12px]">★</span>
            </button>
            <button
              onClick={() => onAddPrimitive("polygon")}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors"
              title="Polígono"
            >
              <span className="text-[12px]">⬟</span>
            </button>
            <button
              onClick={() => onAddPrimitive("heart")}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors"
              title="Coração"
            >
              <span className="text-[12px]">♥</span>
            </button>
          </div>
        </div>

        {/* Text */}
        <div className="flex items-center gap-0.5 border-r border-[#E2E3DD] pr-2">
          <button
            onClick={onAddText}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors flex items-center gap-1"
            title="Adicionar Texto (T)"
          >
            <Text className="w-4 h-4" />
            <span className="text-[10px] font-bold hidden sm:inline">Texto</span>
          </button>
        </div>

        {/* Boolean Operations */}
        <div className="flex items-center gap-0.5 border-r border-[#E2E3DD] pr-2">
          <span className="text-[8px] text-zinc-400 uppercase font-mono px-1">Booleanas</span>
          {BOOLEAN_OPS.map(op => (
            <button
              key={op.id}
              onClick={() => onBooleanOp(op.id)}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors"
              title={`${op.label} (${op.shortcut})`}
            >
              {op.icon}
            </button>
          ))}
        </div>

        {/* Align & Distribute */}
        <div className="flex items-center gap-0.5 border-r border-[#E2E3DD] pr-2">
          <span className="text-[8px] text-zinc-400 uppercase font-mono px-1">Alinhar</span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => onAlign("left")} className="p-1 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Alinhar Esquerda"><AlignLeft className="w-4 h-4" /></button>
            <button onClick={() => onAlign("center")} className="p-1 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Centralizar Horizontal"><AlignHorizontalSpaceAround className="w-4 h-4" /></button>
            <button onClick={() => onAlign("right")} className="p-1 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Alinhar Direita"><AlignRight className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-[#E2E3DD]" />
            <button onClick={() => onAlign("top")} className="p-1 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Alinhar Topo"><AlignCenterVertical className="w-4 h-4" /></button>
            <button onClick={() => onAlign("middle")} className="p-1 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Centralizar Vertical"><AlignCenterHorizontal className="w-4 h-4" /></button>
            <button onClick={() => onAlign("bottom")} className="p-1 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Alinhar Baixo"><AlignCenterVertical className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-[#E2E3DD]" />
            <button onClick={() => onAlign("distribute-h")} className="p-1 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Distribuir Horizontal"><AlignHorizontalSpaceAround className="w-4 h-4" /></button>
            <button onClick={() => onAlign("distribute-v")} className="p-1 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Distribuir Vertical"><AlignCenterHorizontal className="w-4 h-4" /></button>
          </div>
        </div>

        {/* History */}
        <div className="flex items-center gap-0.5 border-r border-[#E2E3DD] pr-2">
          <button onClick={onUndo} disabled={!canUndo} className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Desfazer (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={onRedo} disabled={!canRedo} className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3] transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Refazer (Ctrl+Shift+Z)">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Edit Operations */}
        <div className="flex items-center gap-0.5 border-r border-[#E2E3DD] pr-2">
          <button onClick={onCopy} className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Copiar (Ctrl+C)"><Copy className="w-4 h-4" /></button>
          <button onClick={onPaste} className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Colar (Ctrl+V)"><Clipboard className="w-4 h-4" /></button>
          <button onClick={onCut} className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Recortar (Ctrl+X)"><Trash2 className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-[#E2E3DD]" />
          <button onClick={onDuplicate} className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Duplicar (Ctrl+D)"><Plus className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-1.5 rounded text-zinc-500 hover:text-red-500 hover:bg-red-50" title="Excluir (Delete)"><Trash2 className="w-4 h-4" /></button>
        </div>

        {/* Group/Ungroup */}
        <div className="flex items-center gap-0.5 border-r border-[#E2E3DD] pr-2">
          <button onClick={onGroup} className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Agrupar (Ctrl+G)"><GitBranch className="w-4 h-4" /></button>
          <button onClick={onUngroup} className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Desagrupar (Ctrl+Shift+G)"><Minus className="w-4 h-4" /></button>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-0.5 border-r border-[#E2E3DD] pr-2">
          <button onClick={onZoomFit} className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Ajustar Zoom"><Maximize className="w-4 h-4" /></button>
          <button onClick={onWireframeToggle} className={`p-1.5 rounded transition-colors ${wireframe ? "bg-[#632CE5]/10 text-[#632CE5]" : "text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]"}`} title="Wireframe"><Minimize className="w-4 h-4" /></button>
          <button onClick={onGridToggle} className={`p-1.5 rounded transition-colors ${showGrid ? "bg-[#632CE5]/10 text-[#632CE5]" : "text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]"}`} title="Grade"><Grid className="w-4 h-4" /></button>
        </div>

        {/* Snap Grid */}
        <div className="flex items-center gap-1 border-r border-[#E2E3DD] pr-2">
          <select
            value={snapGrid}
            onChange={(e) => onSnapGridChange(parseFloat(e.target.value))}
            className="px-2 py-1 text-[10px] bg-white border border-[#E2E3DD] rounded text-zinc-700 focus:border-[#632CE5] focus:outline-none"
          >
            <option value={0}>Snap: Off</option>
            <option value={0.5}>Snap: 0.5mm</option>
            <option value={1}>Snap: 1mm</option>
            <option value={2}>Snap: 2mm</option>
            <option value={5}>Snap: 5mm</option>
          </select>
        </div>

        {/* Export/Download */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Download STL"><Download className="w-4 h-4" /></button>
          <button className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 hover:bg-[#E8E9E3]" title="Configurações"><Settings className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="flex flex-col gap-1 text-left">
          <span className="font-bold text-xs">Atalhos</span>
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            <span><kbd className="px-1 bg-white/10 rounded">V</kbd> Selecionar</span>
            <span><kbd className="px-1 bg-white/10 rounded">T</kbd> Texto</span>
            <span><kbd className="px-1 bg-white/10 rounded">R</kbd> Retângulo</span>
            <span><kbd className="px-1 bg-white/10 rounded">C</kbd> Círculo</span>
            <span><kbd className="px-1 bg-white/10 rounded">Delete</kbd> Excluir</span>
            <span><kbd className="px-1 bg-white/10 rounded">Ctrl+D</kbd> Duplicar</span>
            <span><kbd className="px-1 bg-white/10 rounded">Ctrl+G</kbd> Agrupar</span>
            <span><kbd className="px-1 bg-white/10 rounded">Ctrl+Z</kbd> Desfazer</span>
            <span><kbd className="px-1 bg-white/10 rounded">Ctrl+Shift+Z</kbd> Refazer</span>
          </div>
        </div>
      </div>
    </div>
  );
}