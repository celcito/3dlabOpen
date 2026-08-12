import { Search, Droplet, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MOCK_PAINTS, usePaintMixer } from "../hooks/usePaintMixer";

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
      <span className="text-zinc-500 hover:text-[#632CE5] transition-colors cursor-help focus:outline-none p-0.5">
        <Info className="w-3.5 h-3.5" />
      </span>
      <div 
        className={`absolute hidden group-hover:block z-50 w-64 p-3 text-[10px] leading-relaxed font-sans normal-case font-medium text-zinc-300 bg-[#E8E9E3] border border-[#E8E9E3] rounded shadow-[0_6px_20px_rgba(0,0,0,0.95)] pointer-events-none transition-all duration-150 ${positionClasses[position]}`}
      >
        <p className="tracking-wide uppercase text-[#632CE5] font-black text-[9px] mb-1">Dica de Ajuda / Help Tip</p>
        <p>{text}</p>
      </div>
    </div>
  );
}

export default function PaintMixer() {
  const { targetHex, setTargetHex, closest } = usePaintMixer();

  return (
    <div className="flex flex-col h-full overflow-hidden text-[#1A1C19]">
      {/* HEADER AREA */}
      <header className="p-8 flex justify-between items-end border-b border-[#E2E3DD] shrink-0 bg-[#F9FAF4]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#632CE5] font-bold mb-2">VÉRTICE STUDIO TOOLS / v0.4.2</p>
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
        <div className="bg-[#F9FAF4] p-8 overflow-y-auto border-r border-[#E2E3DD]">
          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-6 font-bold flex items-center">
              <span>01. Target Color Specification</span>
              <HelpTooltip text="Defina a cor desejada que deseja obter ao misturar tintas físicas. Você pode digitar o código HEX ou escolher uma cor de referência." />
            </h3>
            
            <div className="bg-[#F9FAF4] border border-[#E8E9E3] p-6 flex gap-6 items-center mb-6">
                <div 
                  className="w-32 h-32 border-2 border-[#E8E9E3] shadow-[0_0_20px_rgba(0,0,0,0.5)] shrink-0"
                  style={{ backgroundColor: targetHex }}
                />
                <div className="flex-1 space-y-4">
                  <div className="bg-[#E8E9E3] p-3 border border-[#E8E9E3]">
                    <label className="text-[9px] uppercase text-zinc-500 flex items-center mb-1">
                      <span>HEX Code</span>
                      <HelpTooltip text="Código hexadecimal de 6 dígitos (ex: #800080 para roxo). Representa a cor exata digitalmente." />
                    </label>
                    <input 
                        value={targetHex} 
                        onChange={(e) => setTargetHex(e.target.value)} 
                        placeholder="#000000"
                        maxLength={7}
                        className="bg-transparent outline-none font-mono text-2xl w-full text-[#1A1C19]"
                    />
                  </div>
                </div>
            </div>

            <button className="w-full bg-white text-black font-black uppercase text-xs py-4 tracking-widest hover:bg-[#632CE5] transition-colors flex items-center justify-center gap-2">
              <Search className="w-4 h-4" />
              Calculate Recipe
            </button>
          </section>
        </div>

        {/* RIGHT PANE */}
        <div className="bg-[#F9FAF4] p-8 flex flex-col overflow-y-auto">
          <section className="flex-1">
            <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-6 font-bold flex items-center">
              <span>02. Suggested Recipe</span>
              <HelpTooltip text="Fórmula matemática calculada pelo algoritmo de interpolação LAB. Mostra quantas partes de cada cor padrão usar para atingir o tom desejado." />
            </h3>
            {closest.length > 0 ? (
                <div className="space-y-3">
                  {closest.map((paint, index) => (
                    <div key={paint.id} className="flex items-center gap-4 p-4 bg-[#E8E9E3] border border-[#E8E9E3]">
                      <div 
                        className="w-12 h-12 border border-[#E8E9E3] shrink-0"
                        style={{ backgroundColor: paint.hex }}
                      />
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm uppercase tracking-wide truncate">{paint.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest truncate">{paint.brand} • {paint.type}</p>
                      </div>
                      <div className="bg-[#E8E9E3] px-3 py-1 border border-[#E8E9E3] font-mono text-[#632CE5] text-xs shrink-0">
                        {index === 0 ? "2 PARTS" : "1 PART"}
                      </div>
                    </div>
                  ))}
                  <button className="w-full mt-6 bg-[#F9FAF4] text-[#212121] font-black uppercase text-xs py-4 tracking-widest hover:bg-[#F9FAF4] transition-colors">
                    Save Recipe
                  </button>
                </div>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-600 border border-[#E8E9E3] border-dashed">
                  <Droplet className="w-12 h-12 mb-4 opacity-30" />
                  <p className="text-[10px] uppercase tracking-widest">Enter a valid HEX color to get a recipe</p>
                </div>
            )}
          </section>
        </div>
      </div>
      
      {/* FOOTER BAR */}
      <footer className="h-12 border-t border-[#E2E3DD] px-8 flex items-center justify-between bg-[#F9FAF4] shrink-0">
        <div className="flex gap-6 items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          <span>Engine: <span className="text-[#632CE5]">LAB Space Interpolation</span></span>
          <span>Database: {MOCK_PAINTS.length} Paints</span>
        </div>
      </footer>
    </div>
  );
}
