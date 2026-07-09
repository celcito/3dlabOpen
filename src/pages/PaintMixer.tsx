import { useState } from "react";
import { Search, Droplet, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import colorConvert from "color-convert";

// Explanatory Tooltip Component for beginners
function HelpTooltip({ text, position = "right" }: { text: string; position?: "top" | "bottom" | "left" | "right" }) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2"
  };

  return (
    <div className="relative group inline-flex items-center ml-1.5 select-none shrink-0 align-middle">
      <span className="text-zinc-500 hover:text-[#00E5FF] transition-colors cursor-help focus:outline-none p-0.5">
        <Info className="w-3.5 h-3.5" />
      </span>
      <div 
        className={`absolute hidden group-hover:block z-50 w-64 p-3 text-[10px] leading-relaxed font-sans normal-case font-medium text-zinc-300 bg-zinc-950 border border-zinc-800 rounded shadow-[0_6px_20px_rgba(0,0,0,0.95)] pointer-events-none transition-all duration-150 ${positionClasses[position]}`}
      >
        <p className="tracking-wide uppercase text-[#00E5FF] font-black text-[9px] mb-1">Dica de Ajuda / Help Tip</p>
        <p>{text}</p>
      </div>
    </div>
  );
}

// Mock data for initial MVP
const BRANDS = [
  { id: "citadel", name: "Citadel" },
  { id: "vallejo", name: "Vallejo" },
];

const MOCK_PAINTS = [
  { id: 1, name: "Mephiston Red", brand: "Citadel", hex: "#9a1115", type: "Base" },
  { id: 2, name: "Macragge Blue", brand: "Citadel", hex: "#0d2a59", type: "Base" },
  { id: 3, name: "Averland Sunset", brand: "Citadel", hex: "#fbb81c", type: "Base" },
  { id: 4, name: "Abaddon Black", brand: "Citadel", hex: "#000000", type: "Base" },
  { id: 5, name: "Corax White", brand: "Citadel", hex: "#ffffff", type: "Base" },
  { id: 6, name: "Ultramarine", brand: "Vallejo", hex: "#152069", type: "Model Color" },
  { id: 7, name: "Flat Red", brand: "Vallejo", hex: "#990000", type: "Model Color" },
];

export default function PaintMixer() {
  const [targetHex, setTargetHex] = useState("#800080"); // Default purple
  
  // Basic euclidean distance in LAB space (mock interpolation)
  const findClosestPaints = (hex: string) => {
    try {
      const targetLab = colorConvert.hex.lab(hex.replace("#", ""));
      return MOCK_PAINTS.map(paint => {
        const paintLab = colorConvert.hex.lab(paint.hex.replace("#", ""));
        const distance = Math.sqrt(
          Math.pow(targetLab[0] - paintLab[0], 2) +
          Math.pow(targetLab[1] - paintLab[1], 2) +
          Math.pow(targetLab[2] - paintLab[2], 2)
        );
        return { ...paint, distance };
      }).sort((a, b) => a.distance - b.distance).slice(0, 3);
    } catch (e) {
      return [];
    }
  };

  const closest = findClosestPaints(targetHex);

  return (
    <div className="flex flex-col h-full overflow-hidden text-white">
      {/* HEADER AREA */}
      <header className="p-8 flex justify-between items-end border-b border-[#222] shrink-0 bg-[#080808]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#00E5FF] font-bold mb-2">VÉRTICE STUDIO TOOLS / v0.4.2</p>
          <h1 className="text-6xl font-black tracking-tighter leading-none uppercase">Paint Mixer</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Target Color</div>
          <div className="font-mono text-sm">{targetHex || 'NONE'}</div>
        </div>
      </header>

      {/* EDITOR CORE */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 h-full overflow-hidden">
        
        {/* LEFT PANE */}
        <div className="bg-[#050505] p-8 overflow-y-auto border-r border-[#222]">
          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-6 font-bold flex items-center">
              <span>01. Target Color Specification</span>
              <HelpTooltip text="Defina a cor desejada que deseja obter ao misturar tintas físicas. Você pode digitar o código HEX ou escolher uma cor de referência." />
            </h3>
            
            <div className="bg-[#0A0A0A] border border-zinc-800 p-6 flex gap-6 items-center mb-6">
                <div 
                  className="w-32 h-32 border-2 border-zinc-700 shadow-[0_0_20px_rgba(0,0,0,0.5)] shrink-0"
                  style={{ backgroundColor: targetHex }}
                />
                <div className="flex-1 space-y-4">
                  <div className="bg-[#151515] p-3 border border-zinc-800">
                    <label className="text-[9px] uppercase text-zinc-500 flex items-center mb-1">
                      <span>HEX Code</span>
                      <HelpTooltip text="Código hexadecimal de 6 dígitos (ex: #800080 para roxo). Representa a cor exata digitalmente." />
                    </label>
                    <input 
                        value={targetHex} 
                        onChange={(e) => setTargetHex(e.target.value)} 
                        placeholder="#000000"
                        maxLength={7}
                        className="bg-transparent outline-none font-mono text-2xl w-full text-white"
                    />
                  </div>
                </div>
            </div>

            <button className="w-full bg-white text-black font-black uppercase text-xs py-4 tracking-widest hover:bg-[#00E5FF] transition-colors flex items-center justify-center gap-2">
              <Search className="w-4 h-4" />
              Calculate Recipe
            </button>
          </section>
        </div>

        {/* RIGHT PANE */}
        <div className="bg-[#0A0A0A] p-8 flex flex-col overflow-y-auto">
          <section className="flex-1">
            <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-6 font-bold flex items-center">
              <span>02. Suggested Recipe</span>
              <HelpTooltip text="Fórmula matemática calculada pelo algoritmo de interpolação LAB. Mostra quantas partes de cada cor padrão usar para atingir o tom desejado." />
            </h3>
            {closest.length > 0 ? (
                <div className="space-y-3">
                  {closest.map((paint, index) => (
                    <div key={paint.id} className="flex items-center gap-4 p-4 bg-[#151515] border border-zinc-800">
                      <div 
                        className="w-12 h-12 border border-zinc-700 shrink-0"
                        style={{ backgroundColor: paint.hex }}
                      />
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm uppercase tracking-wide truncate">{paint.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest truncate">{paint.brand} • {paint.type}</p>
                      </div>
                      <div className="bg-zinc-900 px-3 py-1 border border-zinc-800 font-mono text-[#00E5FF] text-xs shrink-0">
                        {index === 0 ? "2 PARTS" : "1 PART"}
                      </div>
                    </div>
                  ))}
                  <button className="w-full mt-6 bg-zinc-800 text-white font-black uppercase text-xs py-4 tracking-widest hover:bg-zinc-700 transition-colors">
                    Save Recipe
                  </button>
                </div>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-600 border border-zinc-800 border-dashed">
                  <Droplet className="w-12 h-12 mb-4 opacity-30" />
                  <p className="text-[10px] uppercase tracking-widest">Enter a valid HEX color to get a recipe</p>
                </div>
            )}
          </section>
        </div>
      </div>
      
      {/* FOOTER BAR */}
      <footer className="h-12 border-t border-[#222] px-8 flex items-center justify-between bg-[#0A0A0A] shrink-0">
        <div className="flex gap-6 items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          <span>Engine: <span className="text-[#00E5FF]">LAB Space Interpolation</span></span>
          <span>Database: {MOCK_PAINTS.length} Paints</span>
        </div>
      </footer>
    </div>
  );
}
