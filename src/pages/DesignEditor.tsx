import React, { useEffect, useRef, useState } from "react";
import { Canvas, Rect, Circle, Triangle, IText, FabricImage, FabricObject } from "fabric";
import { 
  Square, Circle as CircleIcon, Triangle as TriangleIcon, Type, Image as ImageIcon, 
  Trash2, MoveUp, MoveDown, Download, Layers, 
  Settings, MousePointer2, Plus, Layout, 
  Undo, Redo, Save, FileJson, FileCode, Play, Palette,
  BringToFront, SendToBack, Copy, FlipHorizontal, FlipVertical
} from "lucide-react";

export default function DesignEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [properties, setProperties] = useState({
    fill: "#00E5FF",
    stroke: "#ffffff",
    strokeWidth: 0,
    opacity: 1,
    fontSize: 40,
    fontFamily: "Inter",
    fontWeight: "bold"
  });

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Initialize Fabric Canvas
    const canvas = new Canvas(canvasRef.current, {
      width: containerRef.current.clientWidth - 40,
      height: containerRef.current.clientHeight - 80,
      backgroundColor: "#111111",
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;

    // Selection Events
    canvas.on("selection:created", (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on("selection:updated", (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on("selection:cleared", () => setSelectedObject(null));
    
    // Update Properties on Selection
    canvas.on("object:modified", () => updatePropertiesFromSelection());

    // Handle Window Resize
    const handleResize = () => {
      if (containerRef.current) {
        canvas.setDimensions({
          width: containerRef.current.clientWidth - 40,
          height: containerRef.current.clientHeight - 80,
        });
        canvas.renderAll();
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.dispose();
    };
  }, []);

  const updatePropertiesFromSelection = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      setProperties({
        fill: (obj.fill as string) || "#00E5FF",
        stroke: (obj.stroke as string) || "#ffffff",
        strokeWidth: obj.strokeWidth || 0,
        opacity: obj.opacity || 1,
        fontSize: (obj as any).fontSize || 40,
        fontFamily: (obj as any).fontFamily || "Inter",
        fontWeight: (obj as any).fontWeight || "bold"
      });
    }
  };

  // Add Shapes
  const addRect = () => {
    const rect = new Rect({
      left: 100,
      top: 100,
      fill: properties.fill,
      width: 100,
      height: 100,
      stroke: "#ffffff",
      strokeWidth: 0
    });
    fabricRef.current?.add(rect);
    fabricRef.current?.setActiveObject(rect);
    fabricRef.current?.renderAll();
  };

  const addCircle = () => {
    const circle = new Circle({
      left: 100,
      top: 100,
      fill: properties.fill,
      radius: 50,
      stroke: "#ffffff",
      strokeWidth: 0
    });
    fabricRef.current?.add(circle);
    fabricRef.current?.setActiveObject(circle);
    fabricRef.current?.renderAll();
  };

  const addTriangle = () => {
    const triangle = new Triangle({
      left: 100,
      top: 100,
      fill: properties.fill,
      width: 100,
      height: 100,
      stroke: "#ffffff",
      strokeWidth: 0
    });
    fabricRef.current?.add(triangle);
    fabricRef.current?.setActiveObject(triangle);
    fabricRef.current?.renderAll();
  };

  const addText = () => {
    const text = new IText("TEXTO AQUI", {
      left: 100,
      top: 100,
      fontFamily: "Inter",
      fontWeight: "900",
      fontSize: 40,
      fill: properties.fill
    });
    fabricRef.current?.add(text);
    fabricRef.current?.setActiveObject(text);
    fabricRef.current?.renderAll();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (f) => {
      const data = f.target?.result;
      if (typeof data === "string") {
        const img = await FabricImage.fromURL(data);
        img.scale(0.5);
        fabricRef.current?.add(img);
        fabricRef.current?.centerObject(img);
        fabricRef.current?.setActiveObject(img);
        fabricRef.current?.renderAll();
      }
    };
    reader.readAsDataURL(file);
  };

  // Actions
  const deleteObject = () => {
    const activeObjects = fabricRef.current?.getActiveObjects();
    if (activeObjects) {
      fabricRef.current?.discardActiveObject();
      activeObjects.forEach((obj) => fabricRef.current?.remove(obj));
      fabricRef.current?.renderAll();
    }
  };

  const bringForward = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      fabricRef.current?.bringObjectForward(obj);
      fabricRef.current?.renderAll();
    }
  };

  const sendBackwards = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      fabricRef.current?.sendObjectBackwards(obj);
      fabricRef.current?.renderAll();
    }
  };

  const bringToFront = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      fabricRef.current?.bringObjectToFront(obj);
      fabricRef.current?.renderAll();
    }
  };

  const sendToBack = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      fabricRef.current?.sendObjectToBack(obj);
      fabricRef.current?.renderAll();
    }
  };

  const handlePropertyChange = (key: string, value: any) => {
    setProperties(prev => ({ ...prev, [key]: value }));
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      obj.set(key as any, value);
      fabricRef.current?.renderAll();
    }
  };

  // Exports
  const exportSVG = () => {
    if (!fabricRef.current) return;
    const svg = fabricRef.current.toSVG();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "design-export.svg";
    link.click();
  };

  const exportPNG = () => {
    if (!fabricRef.current) return;
    const dataURL = fabricRef.current.toDataURL({ format: "png", multiplier: 2 });
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "design-export.png";
    link.click();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080808]">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-zinc-900 bg-[#0d0d0d] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-[#00E5FF]" />
            <h1 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Design Editor Pro</h1>
          </div>
          
          <div className="h-6 w-px bg-zinc-800" />
          
          <div className="flex items-center gap-1">
            <ToolButton icon={MousePointer2} onClick={() => {}} title="Selecionar" />
            <ToolButton icon={Square} onClick={addRect} title="Quadrado" />
            <ToolButton icon={CircleIcon} onClick={addCircle} title="Círculo" />
            <ToolButton icon={TriangleIcon} onClick={addTriangle} title="Triângulo" />
            <ToolButton icon={Type} onClick={addText} title="Texto" />
            <label className="cursor-pointer">
              <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
              <ToolButton icon={ImageIcon} as="span" title="Imagem" />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportSVG}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-[#00E5FF] hover:border-[#00E5FF]/40 transition-all"
          >
            <FileCode className="w-3.5 h-3.5" />
            Exportar SVG
          </button>
          <button 
            onClick={exportPNG}
            className="flex items-center gap-2 px-5 py-2 bg-[#00E5FF] rounded text-[9px] font-black uppercase tracking-widest text-black hover:bg-white transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)]"
          >
            <Download className="w-3.5 h-3.5" />
            Salvar PNG
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: LAYERS & ELEMENTS */}
        <div className="w-64 border-r border-zinc-900 bg-[#0d0d0d] flex flex-col shrink-0">
          <div className="p-5 border-b border-zinc-900">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              Camadas / Elementos
            </h3>
            <div className="space-y-1">
              <p className="text-[9px] text-zinc-600 uppercase font-bold text-center py-8">
                Clique nos elementos do canvas para selecionar.
              </p>
            </div>
          </div>
          
          <div className="mt-auto p-5 border-t border-zinc-900">
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-900">
              <p className="text-[8px] text-zinc-500 uppercase font-bold leading-relaxed">
                Utilize o editor para criar artes que podem ser convertidas em STL no "Criador de Placas".
              </p>
            </div>
          </div>
        </div>

        {/* CENTER: CANVAS WORKSPACE */}
        <div 
          ref={containerRef}
          className="flex-1 bg-[#080808] p-10 flex items-center justify-center relative overflow-hidden"
          style={{ backgroundImage: "radial-gradient(#1a1a1a 1px, transparent 1px)", backgroundSize: "30px 30px" }}
        >
          <div className="shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-zinc-900 rounded-lg overflow-hidden bg-[#111]">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* RIGHT PANEL: PROPERTIES */}
        <div className="w-72 border-l border-zinc-900 bg-[#0d0d0d] p-6 flex flex-col gap-8 shrink-0 overflow-y-auto scrollbar-hide">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Settings className="w-3.5 h-3.5" />
            Propriedades do Objeto
          </h3>

          {!selectedObject ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
              <MousePointer2 className="w-12 h-12 text-zinc-700 mb-4" />
              <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-widest">
                Nenhum objeto selecionado
              </p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* TRANSFORM ACTIONS */}
              <div className="space-y-4">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">Posicionamento</label>
                <div className="grid grid-cols-4 gap-2">
                  <ActionButton icon={BringToFront} onClick={bringToFront} title="Frente" />
                  <ActionButton icon={MoveUp} onClick={bringForward} title="+1 Nível" />
                  <ActionButton icon={MoveDown} onClick={sendBackwards} title="-1 Nível" />
                  <ActionButton icon={SendToBack} onClick={sendToBack} title="Fundo" />
                </div>
              </div>

              {/* COLOR & FILL */}
              <div className="space-y-4">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">Cor do Elemento</label>
                <div className="flex flex-wrap gap-2">
                  {["#00E5FF", "#FFFFFF", "#FF0055", "#00FF88", "#FFAA00", "#AA00FF", "#222222"].map(color => (
                    <button
                      key={color}
                      onClick={() => handlePropertyChange("fill", color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${properties.fill === color ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="relative">
                    <input 
                      type="color" 
                      value={properties.fill}
                      onChange={(e) => handlePropertyChange("fill", e.target.value)}
                      className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* SLIDERS */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-600">Opacidade</span>
                    <span className="text-[#00E5FF]">{Math.round(properties.opacity * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.01" 
                    value={properties.opacity}
                    onChange={(e) => handlePropertyChange("opacity", parseFloat(e.target.value))}
                    className="w-full accent-[#00E5FF] h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-600">Espessura Contorno</span>
                    <span className="text-[#00E5FF]">{properties.strokeWidth}px</span>
                  </div>
                  <input 
                    type="range" min="0" max="20" step="1" 
                    value={properties.strokeWidth}
                    onChange={(e) => handlePropertyChange("strokeWidth", parseInt(e.target.value))}
                    className="w-full accent-[#00E5FF] h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* TEXT OPTIONS */}
              {(selectedObject.type === "i-text" || selectedObject.type === "text") && (
                <div className="space-y-4 pt-4 border-t border-zinc-900">
                   <label className="text-[9px] uppercase font-bold text-zinc-600 block">Texto</label>
                   <div className="space-y-3">
                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                      <span className="text-zinc-600">Tamanho da Fonte</span>
                      <span className="text-[#00E5FF]">{properties.fontSize}px</span>
                    </div>
                    <input 
                      type="range" min="10" max="200" step="1" 
                      value={properties.fontSize}
                      onChange={(e) => handlePropertyChange("fontSize", parseInt(e.target.value))}
                      className="w-full accent-[#00E5FF] h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* DANGER ZONE */}
              <div className="pt-8 border-t border-zinc-900">
                <button 
                  onClick={deleteObject}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 rounded text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-all group"
                >
                  <Trash2 className="w-4 h-4 group-hover:animate-bounce" />
                  Remover Elemento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, onClick, as: Component = "button", title }: any) {
  return (
    <Component
      onClick={onClick}
      title={title}
      className="p-2.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all group relative"
    >
      <Icon className="w-4 h-4" />
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black border border-zinc-800 rounded text-[8px] font-black uppercase tracking-widest text-[#00E5FF] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
        {title}
      </span>
    </Component>
  );
}

function ActionButton({ icon: Icon, onClick, title }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex flex-col items-center justify-center gap-1.5 p-2 bg-zinc-900 border border-zinc-800 rounded hover:border-[#00E5FF]/40 hover:bg-zinc-800 transition-all group"
    >
      <Icon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#00E5FF]" />
      <span className="text-[7px] font-black uppercase text-zinc-600 group-hover:text-zinc-400">{title}</span>
    </button>
  );
}
