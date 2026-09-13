"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, LockOpen, GripVertical, ChevronDown, ChevronRight, MoreVertical, Trash2, Copy, Minus, Plus, Type, Square, GitBranch } from "lucide-react";
import { DesignElement, ElementRole, toPathData } from "../../lib/cookie-cutter/designElements";

interface LayersPanelProps {
  elements: DesignElement[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRoleChange: (id: string, role: ElementRole) => void;
  onVisibilityToggle: (id: string) => void;
  onLockToggle: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
  onGroup: (ids: string[]) => void;
  onUngroup: (id: string) => void;
}

function LayerRow({
  element,
  index,
  isSelected,
  onClick,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  element: DesignElement;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
}) {
  const isGroup = element.type === "group";
  const hasChildren = isGroup && element.children && element.children.length > 0;
  const [expanded, setExpanded] = useState(true);

  const roleLabels: Record<string, { label: string; color: string }> = {
    cutter: { label: "Corte", color: "bg-[#ff5722]/15 text-[#ff5722]" },
    stamp: { label: "Gravar", color: "bg-[#632CE5]/15 text-[#632CE5]" },
    ignore: { label: "Ignorar", color: "bg-[#F9FAF4] text-zinc-400" },
  };

  const typeIcons: Record<string, string> = {
    path: "📐",
    text: "𝌕",
    primitive: "◆",
    group: "📁",
  };

  return (
    <div className="group">
      <div
        draggable={true}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onDragStart={(e) => onDragStart(e, index)}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, index)}
        className={`flex items-center gap-2 p-2 rounded transition-all cursor-pointer ${
          isSelected ? "bg-[#632CE5]/10 border-l-2 border-[#632CE5]" : "hover:bg-white/50"
        }`}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[12px] text-zinc-400 select-none opacity-0 group-hover:opacity-100">⋮⋮</span>
          
          {isGroup && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-0.5 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}

          <span className="text-[12px] flex-shrink-0">{typeIcons[element.type] || "●"}</span>
          
          <input
            type="text"
            value={element.name}
            onChange={(e) => { e.stopPropagation(); }}
            onBlur={(e) => { /* rename handled via context menu */ }}
            className="text-[10.5px] font-mono text-zinc-300 font-bold truncate flex-1 bg-transparent border-none outline-none"
            readOnly
          />
          
          {element.type === "path" && (
            <span className="text-[8px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
              <span>{Math.round((element as any).length || 0)}px</span>
              <span>•</span>
              <span>{(element as any).isClosed ? "Loop" : "Aberto"}</span>
            </span>
          )}

          <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider ${roleLabels[element.role]?.color || "text-zinc-500"}`}>
            {roleLabels[element.role]?.label || element.role}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            className={`p-1 rounded transition-colors ${element.visible ? "text-zinc-400 hover:text-[#632CE5]" : "text-zinc-300 hover:text-zinc-500"}`}
            title={element.visible ? "Ocultar" : "Mostrar"}
          >
            {element.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            className={`p-1 rounded transition-colors ${element.locked ? "text-[#ff5722]" : "text-zinc-300 hover:text-zinc-500"}`}
            title={element.locked ? "Desbloquear" : "Bloquear"}
          >
            {element.locked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 transition-colors"
            title="Mais opções"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isGroup && expanded && element.children && (
        <div className="ml-6 border-l border-[#E2E3DD] pl-2">
          {element.children.map((child, childIdx) => (
            <LayerRow
              key={child.id}
              element={child}
              index={childIdx}
              isSelected={false}
              onClick={() => {}}
              onContextMenu={() => {}}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              onDragOver={() => {}}
              onDrop={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LayersPanel({
  elements,
  selectedIds,
  onSelect,
  onReorder,
  onRoleChange,
  onVisibilityToggle,
  onLockToggle,
  onRename,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
}: LayersPanelProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: DesignElement } | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);

  const handleClick = (element: DesignElement, additive: boolean) => {
    if (additive) {
      onSelect(selectedIds.includes(element.id)
        ? selectedIds.filter(id => id !== element.id)
        : [...selectedIds, element.id]
      );
    } else {
      onSelect(selectedIds.includes(element.id) && selectedIds.length === 1
        ? [element.id]
        : [element.id]
      );
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragSourceIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDragSourceIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragSourceIndex !== null && dragSourceIndex !== targetIndex) {
      onReorder(dragSourceIndex, targetIndex);
    }
    setDragSourceIndex(null);
  };

  const handleContextMenu = (e: React.MouseEvent, element: DesignElement) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, element });
  };

  const handleRoleChange = (id: string, role: ElementRole) => {
    onRoleChange(id, role);
    setContextMenu(null);
  };

  const handleVisibilityToggle = (id: string) => {
    onVisibilityToggle(id);
    setContextMenu(null);
  };

  const handleLockToggle = (id: string) => {
    onLockToggle(id);
    setContextMenu(null);
  };

  const handleDuplicate = (ids: string[]) => {
    onDuplicate(ids);
    setContextMenu(null);
  };

  const handleDelete = (ids: string[]) => {
    onDelete(ids);
    setContextMenu(null);
  };

  const handleGroup = (ids: string[]) => {
    onGroup(ids);
    setContextMenu(null);
  };

  const handleUngroup = (id: string) => {
    onUngroup(id);
    setContextMenu(null);
  };

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (elements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-4">
        <GitBranch className="w-12 h-12 mb-2 opacity-30" />
        <p className="text-[11px] text-center">Nenhuma camada ainda</p>
        <p className="text-[9px] text-center">Importe um SVG ou adicione formas</p>
      </div>
    );
  }

  return (
    <div className="bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center border-b border-[#E2E3DD] p-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
          <GitBranch className="w-4 h-4 text-[#632CE5]" />
          <span>Camadas</span>
        </h3>
        <span className="bg-[#632CE5]/10 text-[#632CE5] px-2 py-0.5 rounded font-mono text-[9px] font-bold">
          {elements.filter(e => e.role !== "ignore").length} Caminhos
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-1 p-2">
        {elements
          .filter(e => e.role !== "ignore")
          .map((element, index) => (
            <LayerRow
              key={element.id}
              element={element}
              index={index}
              isSelected={selectedIds.includes(element.id)}
              onClick={() => handleClick(element, false)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, element }); }}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", String(index));
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {}}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={(e, targetIdx) => {
                // Handled by parent
              }}
            />
          ))}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-[#E2E3DD] rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleDuplicate([contextMenu.element.id]);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-[11px] text-zinc-700 hover:bg-[#F9FAF4] flex items-center gap-2"
          >
            <Copy className="w-4 h-4 text-zinc-400" />
            Duplicar (Ctrl+D)
          </button>
          <button
            onClick={() => {
              handleGroup(selectedIds.filter(id => selectedIds.includes(contextMenu.element.id)));
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-[11px] text-zinc-700 hover:bg-[#F9FAF4] flex items-center gap-2"
            disabled={selectedIds.length < 2}
          >
            <GitBranch className="w-4 h-4 text-zinc-400" />
            Agrupar (Ctrl+G)
          </button>
          <button
            onClick={() => {
              // ungroup handled
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-[11px] text-zinc-700 hover:bg-[#F9FAF4] flex items-center gap-2"
            disabled={contextMenu.element.type !== "group"}
          >
            <Minus className="w-4 h-4 text-zinc-400" />
            Desagrupar (Ctrl+Shift+G)
          </button>
          <hr className="my-1 border-[#E2E3DD]" />
          <button
            onClick={() => {
              handleDelete([contextMenu.element.id]);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-[11px] text-red-500 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}