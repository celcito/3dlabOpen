"use client";

import { useState } from "react";
import { DesignElement, ElementRole, Transform } from "../../lib/cookie-cutter/designElements";
import { getPrimitiveParams, PrimitiveShape } from "../../lib/cookie-cutter/primitives";

interface PropertiesPanelProps {
  element: DesignElement | null;
  onTransformChange: (id: string, transform: Partial<Transform>) => void;
  onTextChange: (id: string, textData: { text: string; font: string; fontSize: number; align: "left" | "center" | "right" }) => void;
  onPrimitiveChange: (id: string, primitiveData: { shape: PrimitiveShape; params: Record<string, number> }) => void;
  onRoleChange: (id: string, role: ElementRole) => void;
}

const FONTS = [
  { id: "Arial", name: "Arial" },
  { id: "Script", name: "Script" },
  { id: "Block", name: "Block" },
];

function TransformInputs({
  transform,
  onChange,
}: {
  transform: Transform;
  onChange: (transform: Partial<Transform>) => void;
}) {
  const [linkScale, setLinkScale] = useState(true);

  return (
    <div className="space-y-3">
      <h4 className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 border-b border-[#E2E3DD] pb-2">
        Transform
      </h4>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[8px] text-zinc-500 uppercase mb-1 block">X (mm)</label>
          <input
            type="number"
            value={transform.x}
            onChange={(e) => onChange({ x: parseFloat(e.target.value) || 0 })}
            step="0.1"
            className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Y (mm)</label>
          <input
            type="number"
            value={transform.y}
            onChange={(e) => onChange({ y: parseFloat(e.target.value) || 0 })}
            step="0.1"
            className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Rotação (°)</label>
          <input
            type="number"
            value={Math.round(transform.rotation * 180 / Math.PI)}
            onChange={(e) => onChange({ rotation: (parseFloat(e.target.value) || 0) * Math.PI / 180 })}
            step="1"
            className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={linkScale}
              onChange={(e) => setLinkScale(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#632CE5] rounded"
            />
            <span className="text-[8px] text-zinc-500 uppercase">Link</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Largura (mm)</label>
          <input
            type="number"
            value={Math.round(transform.scaleX * 100) / 100}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 1;
              onChange({ scaleX: val });
              if (linkScale) onChange({ scaleY: val });
            }}
            step="0.1"
            className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Altura (mm)</label>
          <input
            type="number"
            value={Math.round(transform.scaleY * 100) / 100}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 1;
              onChange({ scaleY: val });
              if (linkScale) onChange({ scaleX: val });
            }}
            step="0.1"
            className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function TextInputs({
  element,
  onChange,
}: {
  element: DesignElement & { type: "text" };
  onChange: (id: string, textData: { text: string; font: string; fontSize: number; align: "left" | "center" | "right" }) => void;
}) {
  const textData = element.textData;

  return (
    <div className="space-y-3">
      <h4 className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 border-b border-[#E2E3DD] pb-2">
        Texto
      </h4>

      <div>
        <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Conteúdo</label>
        <textarea
          value={textData.text}
          onChange={(e) => onChange(element.id, { ...textData, text: e.target.value })}
          rows={3}
          className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded focus:border-[#632CE5] focus:outline-none resize-y"
          placeholder="Digite o texto..."
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Fonte</label>
          <select
            value={textData.font}
            onChange={(e) => onChange(element.id, { ...textData, font: e.target.value })}
            className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded focus:border-[#632CE5] focus:outline-none"
          >
            {FONTS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Tamanho (mm)</label>
          <input
            type="number"
            value={textData.fontSize}
            onChange={(e) => onChange(element.id, { ...textData, fontSize: parseInt(e.target.value) || 16 })}
            min="4"
            max="50"
            step="1"
            className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Alinhamento</label>
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map(align => (
            <button
              key={align}
              onClick={() => onChange(element.id, { ...textData, align })}
              className={`flex-1 py-1.5 px-2 rounded text-[9px] font-bold uppercase transition-colors ${
                textData.align === align
                  ? "bg-[#632CE5] text-white"
                  : "bg-white border border-[#E2E3DD] text-zinc-500 hover:border-[#632CE5]/50"
              }`}
            >
              {align === "left" && "⬛"}
              {align === "center" && "⬜"}
              {align === "right" && "🟥"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PrimitiveInputs({
  element,
  onChange,
}: {
  element: DesignElement & { type: "primitive" };
  onChange: (id: string, primitiveData: { shape: string; params: Record<string, number> }) => void;
}) {
  const primitiveData = element.primitiveData;
  const defaults = {
    circle: { radius: 15 },
    rect: { width: 30, height: 20, cornerRadius: 0 },
    "rounded-rect": { width: 30, height: 20, cornerRadius: 4 },
    triangle: { side: 30 },
    star: { outerRadius: 20, innerRadius: 10, points: 5 },
    polygon: { sides: 6, radius: 20 },
    heart: { size: 25 },
  };

  const shape = primitiveData.shape;
  const params = primitiveData.params;

  const renderParams = () => {
    switch (shape) {
      case "circle":
        return (
          <div>
            <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Raio (mm)</label>
            <input
              type="number"
              value={params.radius || 15}
              onChange={(e) => onChange(element.id, { shape, params: { radius: parseFloat(e.target.value) || 15 } })}
              min="1"
              max="50"
              step="0.5"
              className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
            />
          </div>
        );
      case "rect":
      case "rounded-rect":
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Largura</label>
              <input
                type="number"
                value={params.width || 30}
                onChange={(e) => onChange(element.id, { shape, params: { ...params, width: parseFloat(e.target.value) || 30 } })}
                min="1"
                max="100"
                step="0.5"
                className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Altura</label>
              <input
                type="number"
                value={params.height || 20}
                onChange={(e) => onChange(element.id, { shape, params: { ...params, height: parseFloat(e.target.value) || 20 } })}
                min="1"
                max="100"
                step="0.5"
                className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
              />
            </div>
            {shape === "rounded-rect" && (
              <div className="col-span-2">
                <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Raio dos cantos</label>
                <input
                  type="number"
                  value={params.cornerRadius || (shape === "rounded-rect" ? 4 : 0)}
                  onChange={(e) => onChange(element.id, { shape, params: { ...params, cornerRadius: parseFloat(e.target.value) || 0 } })}
                  min="0"
                  max="50"
                  step="0.5"
                  className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
                />
              </div>
            )}
          </div>
        );
      case "triangle":
        return (
          <div>
            <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Lado (mm)</label>
            <input
              type="number"
              value={params.side || 30}
              onChange={(e) => onChange(element.id, { shape, params: { side: parseFloat(e.target.value) || 30 } })}
              min="1"
              max="100"
              step="0.5"
              className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
            />
          </div>
        );
      case "star":
        return (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Raio externo</label>
              <input
                type="number"
                value={params.outerRadius || 20}
                onChange={(e) => onChange(element.id, { shape, params: { ...params, outerRadius: parseFloat(e.target.value) || 20 } })}
                min="1"
                max="50"
                step="0.5"
                className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Raio interno</label>
              <input
                type="number"
                value={params.innerRadius || 10}
                onChange={(e) => onChange(element.id, { shape, params: { ...params, innerRadius: parseFloat(e.target.value) || 10 } })}
                min="1"
                max="50"
                step="0.5"
                className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Pontas</label>
              <input
                type="number"
                value={params.points || 5}
                onChange={(e) => onChange(element.id, { shape, params: { ...params, points: parseInt(e.target.value) || 5 } })}
                min="3"
                max="20"
                step="1"
                className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
              />
            </div>
          </div>
        );
      case "polygon":
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Lados</label>
              <input
                type="number"
                value={params.sides || 6}
                onChange={(e) => onChange(element.id, { shape, params: { ...params, sides: parseInt(e.target.value) || 6 } })}
                min="3"
                max="20"
                step="1"
                className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Raio</label>
              <input
                type="number"
                value={params.radius || 20}
                onChange={(e) => onChange(element.id, { shape, params: { ...params, radius: parseFloat(e.target.value) || 20 } })}
                min="1"
                max="50"
                step="0.5"
                className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
              />
            </div>
          </div>
        );
      case "heart":
        return (
          <div>
            <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Tamanho</label>
            <input
              type="number"
              value={params.size || 25}
              onChange={(e) => onChange(element.id, { shape, params: { size: parseFloat(e.target.value) || 25 } })}
              min="5"
              max="100"
              step="0.5"
              className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded font-mono focus:border-[#632CE5] focus:outline-none"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 border-b border-[#E2E3DD] pb-2">
        <span>◆</span>
        Primitiva
      </h4>

      <div>
        <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Forma</label>
        <select
          value={shape}
          onChange={(e) => {
            const newShape = e.target.value as any;
            const newParams = defaults[newShape as keyof typeof defaults] || {};
            onChange(element.id, { shape: newShape, params: newParams });
          }}
          className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded focus:border-[#632CE5] focus:outline-none"
        >
          <option value="circle">Círculo</option>
          <option value="rect">Retângulo</option>
          <option value="rounded-rect">Ret. Arredondado</option>
          <option value="triangle">Triângulo</option>
          <option value="star">Estrela</option>
          <option value="polygon">Polígono</option>
          <option value="heart">Coração</option>
        </select>
      </div>

      {renderParams()}
    </div>
  );
}

function AppearanceInputs({
  element,
  onRoleChange,
}: {
  element: DesignElement;
  onRoleChange: (id: string, role: ElementRole) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 border-b border-[#E2E3DD] pb-2">
        Aparência
      </h4>

      <div>
        <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Papel na exportação</label>
        <div className="flex gap-1">
          {(["cutter", "stamp", "ignore"] as const).map(role => (
            <button
              key={role}
              onClick={() => onRoleChange(element.id, role)}
              className={`flex-1 py-1.5 px-2 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                element.role === role
                  ? (role === "cutter" ? "bg-[#ff5722]/15 text-[#ff5722]" : role === "stamp" ? "bg-[#632CE5]/15 text-[#632CE5]" : "bg-[#F9FAF4] text-zinc-400")
                  : "bg-white border border-[#E2E3DD] text-zinc-500 hover:border-[#632CE5]/50"
              }`}
            >
              {role === "cutter" && "🔪 Corte"}
              {role === "stamp" && "📝 Gravar"}
              {role === "ignore" && "🚫 Ignorar"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[8px] text-zinc-500 uppercase mb-1 block">Opacidade</label>
        <input
          type="range"
          min="0"
          max="100"
          value={(element.visible ? 1 : 0) * 100}
          onChange={(e) => {/* visibility handled separately */}}
          className="w-full accent-[#632CE5] cursor-pointer"
        />
      </div>
    </div>
  );
}

export function PropertiesPanel({
  element,
  onTransformChange,
  onTextChange,
  onPrimitiveChange,
  onRoleChange,
}: PropertiesPanelProps) {
  if (!element) {
    return (
      <div className="bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg p-4 h-full flex flex-col items-center justify-center text-zinc-400">
        <p className="text-[11px] text-center">Selecione um elemento</p>
        <p className="text-[9px] text-center text-zinc-500">para editar suas propriedades</p>
      </div>
    );
  }

  const handleTransformChange = (transform: Partial<Transform>) => {
    onTransformChange(element.id, transform);
  };

  const handleTextChange = (textData: { text: string; font: string; fontSize: number; align: "left" | "center" | "right" }) => {
    onTextChange(element.id, textData);
  };

  const handlePrimitiveChange = (primitiveData: { shape: string; params: Record<string, number> }) => {
    onPrimitiveChange(element.id, { shape: primitiveData.shape as any, params: primitiveData.params });
  };

  const handleRoleChange = (role: ElementRole) => {
    onRoleChange(element.id, role);
  };

  return (
    <div className="bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg p-4 space-y-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[#E2E3DD] pb-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
          <span className="w-4 h-4 text-[#632CE5]">{element.type === "path" && "📐"} {element.type === "text" && "𝌕"} {element.type === "primitive" && "◆"} {element.type === "group" && "📁"}</span>
          <span>Propriedades</span>
        </h3>
        <span className="bg-[#632CE5]/10 text-[#632CE5] px-2 py-0.5 rounded font-mono text-[9px] font-bold capitalize">
          {element.type}
        </span>
      </div>

      <div className="space-y-1">
        <input
          type="text"
          value={element.name}
          onChange={(e) => {/* rename handled separately */}}
          className="w-full px-2 py-1.5 text-[10px] bg-white border border-[#E2E3DD] rounded focus:border-[#632CE5] focus:outline-none"
          readOnly
        />
      </div>

      <TransformInputs transform={element.transform} onChange={handleTransformChange} />

      {element.type === "text" && <TextInputs element={element} onChange={onTextChange} />}
      {element.type === "primitive" && <PrimitiveInputs element={element} onChange={onPrimitiveChange} />}
      <AppearanceInputs element={element} onRoleChange={handleRoleChange} />
    </div>
  );
}
export default PropertiesPanel;
