import { useState } from "react";
import { Printer, Droplet, ExternalLink, AlertTriangle, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Source {
  name: string;
  printerType: "fdm" | "resin" | "both";
  type: "free" | "subscription";
  cost: string;
  desc: string;
  tags: string[];
  url: string;
  recommended: boolean;
}

const SOURCES: Source[] = [
  {
    name: "Cults3D.com", printerType: "both", type: "free",
    cost: "Gratuito + Pago",
    desc: "Grande marketplace com tag 'Commercial use' por modelo. Funciona bem para FDM e resina.",
    tags: ["Personagens", "Acessórios", "FDM", "Resina"],
    url: "https://cults3d.com", recommended: false,
  },
  {
    name: "CGTrader.com", printerType: "both", type: "subscription",
    cost: "Por arquivo",
    desc: "Seção dedicada a impressão 3D com licença comercial explícita. Personagens originais e mascotes para FDM e resina.",
    tags: ["Personagens originais", "Mascotes", "FDM", "Resina"],
    url: "https://www.cgtrader.com", recommended: false,
  },
  {
    name: "Patreon (criadores 3D)", printerType: "both", type: "subscription",
    cost: "~US$ 5–20/mês",
    desc: "Artistas vendem licença comercial nos tiers mais altos. Tem criadores focados em FDM e outros em resina.",
    tags: ["Articulados FDM", "Miniaturas resina", "Originais"],
    url: "https://www.patreon.com", recommended: false,
  },
  {
    name: "Printables.com", printerType: "fdm", type: "free",
    cost: "Gratuito",
    desc: "Da Prusa. Filtre por 'Commercial use allowed'. Ótimo para articulados, decoração e RPG em FDM.",
    tags: ["Articulados", "Decoração", "RPG"],
    url: "https://www.printables.com", recommended: false,
  },
  {
    name: "MyMiniFactory.com", printerType: "fdm", type: "free",
    cost: "Gratuito + Pago",
    desc: "Boa seleção de modelos maiores para FDM. Licenças documentadas por modelo.",
    tags: ["Miniaturas grandes", "Sci-fi", "Fantasy"],
    url: "https://www.myminifactory.com", recommended: false,
  },
  {
    name: "Tribes (MyMiniFactory)", printerType: "fdm", type: "subscription",
    cost: "~US$ 8–15/mês por criador",
    desc: "Assine criadores independentes. Dezenas de modelos novos/mês com licença comercial. Melhor custo-benefício para FDM.",
    tags: ["Alto volume", "Alta qualidade"],
    url: "https://www.myminifactory.com/tribes", recommended: true,
  },
  {
    name: "DriveThruRPG / 3D Studio", printerType: "fdm", type: "subscription",
    cost: "~US$ 5–15/arquivo",
    desc: "Focado em miniaturas para D&D e jogos de tabuleiro. Licença comercial disponível em muitos kits.",
    tags: ["D&D", "Tabuleiro"],
    url: "https://www.drivethrurpg.com", recommended: false,
  },
  {
    name: "Loot Studios", printerType: "resin", type: "subscription",
    cost: "~US$ 14/mês",
    desc: "Assinatura mensal com pacotes completos de miniaturas para resina, licença comercial inclusa.",
    tags: ["RPG", "Colecionáveis", "Alta qualidade"],
    url: "https://lootstudios.com", recommended: true,
  },
  {
    name: "Titan Forge Miniatures", printerType: "resin", type: "subscription",
    cost: "~US$ 9–15/mês",
    desc: "Miniaturas detalhadas para resina com licença de impressão comercial.",
    tags: ["Miniaturas", "Fantasy", "Sci-fi"],
    url: "https://www.patreon.com/titanforgeminiatures", recommended: false,
  },
  {
    name: "EC3D Designs", printerType: "resin", type: "subscription",
    cost: "~US$ 10/mês",
    desc: "Cenários, terrenos e miniaturas para resina. Ótimo para montar kits de RPG para venda.",
    tags: ["Cenários", "Terrenos", "RPG"],
    url: "https://www.patreon.com/ec3d", recommended: false,
  },
  {
    name: "Epics 'N' Quests", printerType: "resin", type: "subscription",
    cost: "~US$ 12/mês",
    desc: "Personagens e miniaturas de alta resolução para resina SLA/MSLA com licença comercial.",
    tags: ["Personagens", "Alta resolução", "SLA/MSLA"],
    url: "https://www.patreon.com/epicsnquests", recommended: false,
  },
];

const fmt = (v: number): string => "R$ " + Math.max(0, v).toFixed(2).replace(".", ",");

// Explanatory Tooltip Component for beginners
function HelpTooltip({ text, position = "top" }: { text: string; position?: "top" | "bottom" | "left" | "right" }) {
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
        <p className="tracking-wide uppercase text-[#00E5FF] font-black text-[9px] mb-1 font-sans">Dica de Ajuda / Help Tip</p>
        <p className="font-sans normal-case font-medium">{text}</p>
      </div>
    </div>
  );
}

function SliderRow({
  label, min, max, value, step = 1, onChange, suffix = "", hint, tooltip,
}: {
  label: string; min: number; max: number; value: number;
  step?: number; onChange: (v: number) => void; suffix?: string; hint?: string; tooltip?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <Label className="text-[11px] text-zinc-400 flex items-center">
          <span>{label}</span>
          {tooltip && <HelpTooltip text={tooltip} />}
        </Label>
        <span className="text-[11px] font-semibold text-zinc-300 font-mono">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#00E5FF] h-1 bg-zinc-900 border border-zinc-850 rounded cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5 font-mono">
        <span>{min}{suffix}</span>
        {hint && <span className="text-zinc-500 font-sans">{hint}</span>}
        <span>{max}{suffix}</span>
      </div>
    </div>
  );
}

function NumInput({
  label, value, onChange, step = 1, prefix = "", tooltip,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; prefix?: string; tooltip?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-zinc-400 flex items-center">
        <span>{label}</span>
        {tooltip && <HelpTooltip text={tooltip} />}
      </Label>
      <div className="flex items-center bg-[#111] border border-zinc-900 rounded-md overflow-hidden focus-within:border-[#00E5FF]/50 transition-colors">
        {prefix && (
          <span className="pl-2.5 pr-1 text-zinc-500 text-xs font-mono">{prefix}</span>
        )}
        <Input
          type="number"
          value={value}
          step={step}
          onChange={e => onChange(Number(e.target.value))}
          className="border-0 bg-transparent h-9 font-mono text-xs text-white [appearance:textfield] [&::-webkit-outer-spin-button]:opacity-30 [&::-webkit-inner-spin-button]:opacity-30"
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent, colorClass }: { label: string; value: string; accent?: boolean; colorClass?: string }) {
  return (
    <div className={`bg-[#111] border rounded-lg p-4 text-center ${accent ? "border-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.05)]" : "border-zinc-900"}`}>
      <div className="text-[8px] uppercase tracking-[0.1em] text-zinc-500 mb-1.5 font-black">{label}</div>
      <div className={`text-xl font-bold font-mono ${colorClass ? colorClass : (accent ? "text-[#00E5FF]" : "text-white")}`}>{value}</div>
    </div>
  );
}

function BreakdownBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 2;
  return (
    <div className="flex items-center gap-3 mb-2.5">
      <span className="text-[11px] text-zinc-500 min-w-[150px] truncate">{label}</span>
      <div className="flex-1 bg-zinc-950 border border-zinc-900/60 rounded h-2 overflow-hidden">
        <div className="rounded-full h-full transition-[width] duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] text-zinc-300 min-w-[64px] text-right font-mono">{fmt(value)}</span>
    </div>
  );
}

function SourceCard({ source, accentColor }: { source: Source; accentColor: string }) {
  return (
    <div className={`bg-[#111] rounded-lg p-5 relative border transition-all hover:border-zinc-800 ${source.recommended ? "shadow-[0_0_15px_rgba(0,229,255,0.03)]" : "border-zinc-900"}`}
      style={source.recommended ? { borderColor: accentColor } : undefined}>
      {source.recommended && (
        <div className="absolute -top-2.5 left-4 text-[8px] font-black px-2.5 py-0.5 rounded-full tracking-widest"
          style={{ backgroundColor: accentColor, color: "#080808" }}>
          RECOMENDADO
        </div>
      )}
      <div className="flex justify-between items-start mb-2">
        <span className="font-bold text-sm text-white tracking-tight">{source.name}</span>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase ${
          source.type === "free" ? "bg-emerald-950/30 text-emerald-400 border border-emerald-900/20" : "bg-purple-950/30 text-purple-400 border border-purple-900/20"
        }`}>
          {source.cost}
        </span>
      </div>
      <p className="text-xs text-zinc-400 mb-3.5 leading-relaxed font-medium">{source.desc}</p>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {source.tags.map(t => (
          <span key={t} className="bg-zinc-950 text-zinc-500 text-[9px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded border border-zinc-900">{t}</span>
        ))}
      </div>
      <a href={source.url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest hover:opacity-75 transition-opacity"
        style={{ color: accentColor }}>
        Acessar site <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function FdmCalc({ meta, setMeta }: { meta: number; setMeta: (v: number) => void }) {
  const [gramas, setGramas] = useState(80);
  const [precoRolo, setPrecoRolo] = useState(110);
  const [horas, setHoras] = useState(4);
  const [energia, setEnergia] = useState(0.8);
  const [acabamento, setAcabamento] = useState(8);
  const [embalagem, setEmbalagem] = useState(6);
  const [dep, setDep] = useState(1.2);
  const [taxa, setTaxa] = useState(12);
  const [margem, setMargem] = useState(200);

  const cFilamento = (gramas / 1000) * precoRolo;
  const cEnergia = horas * energia;
  const cDep = horas * dep;
  const cTotal = cFilamento + cEnergia + acabamento + embalagem + cDep;
  const precoBase = cTotal * (1 + margem / 100);
  const taxaVal = precoBase * (taxa / 100);
  const precoFinal = precoBase + taxaVal;
  const lucro = precoFinal - cTotal - taxaVal;
  const margemReal = cTotal > 0 ? Math.round((lucro / cTotal) * 100) : 0;
  const qtd = lucro > 0 ? Math.ceil(meta / lucro) : null;

  const breakdown: [string, number][] = [
    ["Filamento", cFilamento],
    ["Energia", cEnergia],
    ["Acabamento/pintura", acabamento],
    ["Embalagem + frete", embalagem],
    ["Depreciação impressora", cDep],
    ["Taxa marketplace", taxaVal],
  ];
  const totalBreakdown = breakdown.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <NumInput 
          label="Filamento usado (g)" 
          value={gramas} 
          onChange={setGramas} 
          tooltip="Peso final estimado da peça em gramas (incluindo suportes e preenchimento)."
        />
        <NumInput 
          label="Custo do rolo (R$/kg)" 
          value={precoRolo} 
          onChange={setPrecoRolo} 
          prefix="R$" 
          tooltip="Valor pago por 1kg de filamento FDM (ex: PLA, ABS, PETG)."
        />
        <NumInput 
          label="Tempo de impressão (h)" 
          value={horas} 
          onChange={setHoras} 
          step={0.5} 
          tooltip="Tempo total que a impressora leva para confeccionar a peça."
        />
        <NumInput 
          label="Custo energia (R$/h)" 
          value={energia} 
          onChange={setEnergia} 
          step={0.1} 
          prefix="R$" 
          tooltip="Consumo elétrico estimado da impressora 3D por hora em operação."
        />
        <NumInput 
          label="Acabamento / pintura (R$)" 
          value={acabamento} 
          onChange={setAcabamento} 
          prefix="R$" 
          tooltip="Custo de primers, lixas, tintas, vernizes ou mão de obra extra para pós-processamento."
        />
        <NumInput 
          label="Embalagem + frete (R$)" 
          value={embalagem} 
          onChange={setEmbalagem} 
          prefix="R$" 
          tooltip="Valor de caixas, plástico bolha, fitas adesivas e taxas de envio inclusas no valor da peça."
        />
        <NumInput 
          label="Depreciação impressora (R$/h)" 
          value={dep} 
          onChange={setDep} 
          step={0.1} 
          prefix="R$" 
          tooltip="Valor reservado por hora para cobrir manutenções, bicos extras e desgaste natural do equipamento."
        />
        <NumInput 
          label="Taxa marketplace (%)" 
          value={taxa} 
          onChange={setTaxa} 
          prefix="%" 
          tooltip="Porcentagem cobrada pela plataforma onde você anuncia a venda (ex: Mercado Livre, Shopee, Etsy)."
        />
      </div>

      <div className="bg-[#111] border border-zinc-900 rounded-lg p-5">
        <SliderRow 
          label="Margem de lucro desejada" 
          min={50} 
          max={500} 
          value={margem} 
          step={10} 
          onChange={setMargem} 
          suffix="%" 
          hint="Recomendado: 150–250%" 
          tooltip="Fator de multiplicação sobre o custo de produção para estipular o seu retorno financeiro líquido."
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Custo total" value={fmt(cTotal)} />
        <MetricCard label="Preço sugerido" value={fmt(precoFinal)} accent />
        <MetricCard label="Lucro líquido" value={fmt(lucro)} colorClass="text-emerald-400" />
        <MetricCard label="Margem real" value={`${margemReal}%`} colorClass="text-cyan-400" />
      </div>

      <div className="bg-[#111] border border-zinc-900 rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 mb-4 font-bold flex items-center">
          <span>Divisão dos Custos / Cost Breakdown</span>
          <HelpTooltip text="Gráfico de distribuição que aponta para onde está indo o dinheiro investido na fabricação desta peça." />
        </div>
        {breakdown.map(([lbl, value]) => (
          <BreakdownBar key={lbl} label={lbl} value={value} total={totalBreakdown} color="#00E5FF" />
        ))}
      </div>

      <div className="bg-[#111] border border-zinc-900 rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 mb-3 font-bold flex items-center">
          <span>Meta Mensal / Monthly Goal</span>
          <HelpTooltip text="Determine seu objetivo financeiro mensal para ver quantas réplicas ou bonecos precisa produzir e vender." />
        </div>
        <NumInput label="Renda desejada por mês (R$)" value={meta} onChange={setMeta} prefix="R$" />
        {qtd !== null ? (
          <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Você precisa vender <span className="text-2xl font-black text-[#00E5FF] font-mono align-middle mx-1">{qtd}</span> peças/mês para bater a meta.
          </div>
        ) : (
          <div className="mt-4 text-xs text-zinc-500">Ajuste a margem para calcular.</div>
        )}
      </div>
    </div>
  );
}

function ResinCalc({ meta, setMeta }: { meta: number; setMeta: (v: number) => void }) {
  const resinAccent = "#A855F7";
  const [ml, setMl] = useState(50);
  const [precoResina, setPrecoResina] = useState(180);
  const [horas, setHoras] = useState(3);
  const [energia, setEnergia] = useState(0.5);
  const [lavagem, setLavagem] = useState(4);
  const [fep, setFep] = useState(3);
  const [acabamento, setAcabamento] = useState(12);
  const [embalagem, setEmbalagem] = useState(6);
  const [dep, setDep] = useState(1.5);
  const [taxa, setTaxa] = useState(12);
  const [margem, setMargem] = useState(250);

  const cResina = (ml / 1000) * precoResina;
  const cEnergia = horas * energia;
  const cDep = horas * dep;
  const cTotal = cResina + cEnergia + lavagem + fep + acabamento + embalagem + cDep;
  const precoBase = cTotal * (1 + margem / 100);
  const taxaVal = precoBase * (taxa / 100);
  const precoFinal = precoBase + taxaVal;
  const lucro = precoFinal - cTotal - taxaVal;
  const margemReal = cTotal > 0 ? Math.round((lucro / cTotal) * 100) : 0;
  const qtd = lucro > 0 ? Math.ceil(meta / lucro) : null;

  const breakdown: [string, number][] = [
    ["Resina", cResina],
    ["Energia (UV + curador)", cEnergia],
    ["Lavagem (IPA/álcool)", lavagem],
    ["Depreciação FEP", fep],
    ["Acabamento/pintura", acabamento],
    ["Embalagem + frete", embalagem],
    ["Depreciação impressora", cDep],
    ["Taxa marketplace", taxaVal],
  ];
  const totalBreakdown = breakdown.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-6">
      <div className="border border-purple-900/30 bg-purple-950/10 rounded-md p-4 text-xs leading-relaxed text-purple-400">
        ✨ <strong>Dica Premium:</strong> Resina tem custo de material maior que FDM, mas permite detalhamento muito superior — miniaturas de RPG, colecionáveis e figuras com partes finas vendem por preços maiores. Use margem de 200–350%.
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumInput 
          label="Resina usada (ml)" 
          value={ml} 
          onChange={setMl} 
          tooltip="Volume total de resina líquida estimado para a peça, incluindo bicos e suportes necessários."
        />
        <NumInput 
          label="Custo da resina (R$/litro)" 
          value={precoResina} 
          onChange={setPrecoResina} 
          prefix="R$" 
          tooltip="Valor pago por 1 litro (ou 1kg) de resina líquida fotopolimerizável."
        />
        <NumInput 
          label="Tempo de impressão (h)" 
          value={horas} 
          onChange={setHoras} 
          step={0.5} 
          tooltip="Tempo que a impressora MSLA/SLA gasta para expor e fatiar todas as camadas."
        />
        <NumInput 
          label="Energia UV + curador (R$/h)" 
          value={energia} 
          onChange={setEnergia} 
          step={0.1} 
          prefix="R$" 
          tooltip="Custo elétrico estimado da impressora de resina e da câmara de cura ultravioleta pós-impressão."
        />
        <NumInput 
          label="Lavagem IPA/álcool (R$)" 
          value={lavagem} 
          onChange={setLavagem} 
          step={0.5} 
          prefix="R$" 
          tooltip="Gasto de insumos como Álcool Isopropílico (IPA) ou solventes para lavar a resina não curada."
        />
        <NumInput 
          label="Depreciação FEP (R$/peça)" 
          value={fep} 
          onChange={setFep} 
          step={0.5} 
          prefix="R$" 
          tooltip="Fração calculada do desgaste da película FEP/nFEP do tanque. Películas precisam ser trocadas periodicamente."
        />
        <NumInput 
          label="Acabamento / pintura (R$)" 
          value={acabamento} 
          onChange={setAcabamento} 
          prefix="R$" 
          tooltip="Insumos adicionais para primers, lixas, tintas acrílicas para miniaturas ou vernizes especiais."
        />
        <NumInput 
          label="Embalagem + frete (R$)" 
          value={embalagem} 
          onChange={setEmbalagem} 
          prefix="R$" 
          tooltip="Custo com caixa, espumas de modelismo (necessárias para resina frágil) e fitas de envio."
        />
        <NumInput 
          label="Depreciação impressora (R$/h)" 
          value={dep} 
          onChange={setDep} 
          step={0.1} 
          prefix="R$" 
          tooltip="Reserva para amortizar a vida útil da tela LCD (painel de exposição UV), que se desgasta a cada mil horas."
        />
        <NumInput 
          label="Taxa marketplace (%)" 
          value={taxa} 
          onChange={setTaxa} 
          prefix="%" 
          tooltip="Porcentagem cobrada pela plataforma de vendas na internet."
        />
      </div>

      <div className="bg-[#111] border border-zinc-900 rounded-lg p-5">
        <SliderRow 
          label="Margem de lucro desejada" 
          min={50} 
          max={500} 
          value={margem} 
          step={10} 
          onChange={setMargem} 
          suffix="%" 
          hint="Recomendado: 200–350%" 
          tooltip="Multiplicador de retorno que remunera seu trabalho artístico e o risco da manufatura aditiva."
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Custo total" value={fmt(cTotal)} />
        <MetricCard label="Preço sugerido" value={fmt(precoFinal)} accent />
        <MetricCard label="Lucro líquido" value={fmt(lucro)} colorClass="text-purple-400" />
        <MetricCard label="Margem real" value={`${margemReal}%`} colorClass="text-cyan-400" />
      </div>

      <div className="bg-[#111] border border-zinc-900 rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 mb-4 font-bold flex items-center">
          <span>Divisão dos Custos / Cost Breakdown</span>
          <HelpTooltip text="Divisão percentual dos custos para fabricação de miniaturas em resina líquida." />
        </div>
        {breakdown.map(([lbl, value]) => (
          <BreakdownBar key={lbl} label={lbl} value={value} total={totalBreakdown} color={resinAccent} />
        ))}
      </div>

      <div className="bg-[#111] border border-zinc-900 rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 mb-3 font-bold flex items-center">
          <span>Meta Mensal / Monthly Goal</span>
          <HelpTooltip text="Alvo financeiro que deseja alcançar vendendo suas peças de alta fidelidade em resina." />
        </div>
        <NumInput label="Renda desejada por mês (R$)" value={meta} onChange={setMeta} prefix="R$" />
        {qtd !== null ? (
          <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Você precisa vender <span className="text-2xl font-black text-purple-400 font-mono align-middle mx-1">{qtd}</span> peças/mês para bater a meta.
          </div>
        ) : (
          <div className="mt-4 text-xs text-zinc-500">Ajuste a margem para calcular.</div>
        )}
      </div>
    </div>
  );
}

function SourcesTab() {
  const [printerFilter, setPrinterFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = SOURCES.filter(s => {
    const matchPrinter = printerFilter === "all" || s.printerType === printerFilter || s.printerType === "both";
    const matchType = typeFilter === "all" || s.type === typeFilter;
    return matchPrinter && matchType;
  });

  const pillClass = (active: boolean, color: string) =>
    `px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all ${
      active
        ? `border-transparent text-black font-black`
        : "border-zinc-900 text-zinc-500 hover:border-zinc-800 hover:text-zinc-300"
    }`;

  return (
    <div className="space-y-6">
      <div className="bg-[#111] border border-zinc-900 p-6 rounded-lg space-y-5">
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-bold flex items-center">
            <span>Tipo de Impressora / Printer Type</span>
            <HelpTooltip text="Filtre sites de modelos 3D focados em deposição fundida (FDM) ou estereofotolitografia por resina líquida." />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              ["all", "Todas", "#00E5FF"],
              ["fdm", "FDM", "#00E5FF"],
              ["resin", "Resina", "#A855F7"],
              ["both", "Ambas", "#00E5FF"],
            ].map(([val, label, color]) => (
              <button
                key={val}
                onClick={() => setPrinterFilter(val)}
                className={pillClass(printerFilter === val, color)}
                style={printerFilter === val ? { backgroundColor: color } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-bold flex items-center">
            <span>Custo do Modelo / Licensing model</span>
            <HelpTooltip text="Filtre marketplaces por downloads gratuitos (Creative Commons/Uso Comercial) ou assinaturas premium." />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              ["all", "Todos"],
              ["free", "Gratuito / Free"],
              ["subscription", "Assinatura / Paid"],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setTypeFilter(val)}
                className={pillClass(typeFilter === val, "#00E5FF")}
                style={typeFilter === val ? { backgroundColor: "#00E5FF" } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="text-zinc-500 text-xs py-8 text-center col-span-2">Nenhuma fonte encontrada com esses filtros.</div>
        ) : (
          filtered.map((s, i) => (
            <SourceCard
              key={`${s.name}-${s.printerType}-${i}`}
              source={s}
              accentColor={s.printerType === "resin" ? "#A855F7" : "#00E5FF"}
            />
          ))
        )}
      </div>

      <div className="border border-amber-950/40 bg-amber-950/10 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-amber-400 mb-1 uppercase tracking-wide">Sempre confirme antes de vender / Commercial Use Notice</div>
            <div className="text-[11px] text-zinc-400 leading-relaxed font-medium">
              Mesmo em plataformas seguras, verifique a licença de cada arquivo individualmente.
              Procure os termos <em>"commercial use allowed"</em>, <em>"for sale"</em> ou <em>"selling prints allowed"</em>.
              Em caso de dúvidas, contate o criador ou modelador original diretamente.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PriceCalculator() {
  const [tab, setTab] = useState("fdm");
  const [meta, setMeta] = useState(2000);

  return (
    <div className="flex flex-col h-full overflow-hidden text-white bg-[#080808]">
      <header className="p-8 flex justify-between items-end border-b border-zinc-900 shrink-0 bg-[#0d0d0d]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#00E5FF] font-bold mb-2">VÉRTICE STUDIO TOOLS / v0.4.2</p>
          <h1 className="text-6xl font-black tracking-tighter leading-none uppercase">Price Calculator</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-bold">Meta Estimada / Target</div>
          <div className="font-mono text-sm text-[#00E5FF] font-black">{fmt(meta)} <span className="text-zinc-500 text-[10px]">/ mês</span></div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#080808] p-8">
        <div className="max-w-[760px] mx-auto space-y-6">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="bg-zinc-950 border border-zinc-900 p-1 mb-6 flex gap-1 rounded">
              <TabsTrigger 
                value="fdm" 
                className={`flex-1 flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] py-2 transition-all ${
                  tab === "fdm" ? "bg-[#00E5FF] text-black" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                Filamento (FDM)
              </TabsTrigger>
              <TabsTrigger 
                value="resin" 
                className={`flex-1 flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] py-2 transition-all ${
                  tab === "resin" ? "bg-[#A855F7] text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Droplet className="w-3.5 h-3.5" />
                Resina (SLA)
              </TabsTrigger>
              <TabsTrigger 
                value="sources" 
                className={`flex-1 flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] py-2 transition-all ${
                  tab === "sources" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Fontes de Modelos 3D
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fdm" className="focus-visible:outline-none focus-visible:ring-0">
              <FdmCalc meta={meta} setMeta={setMeta} />
            </TabsContent>
            <TabsContent value="resin" className="focus-visible:outline-none focus-visible:ring-0">
              <ResinCalc meta={meta} setMeta={setMeta} />
            </TabsContent>
            <TabsContent value="sources" className="focus-visible:outline-none focus-visible:ring-0">
              <SourcesTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <footer className="h-12 border-t border-zinc-900 px-8 flex items-center justify-between bg-[#0d0d0d] shrink-0 font-sans">
        <div className="flex gap-6 items-center text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
          <span>Engine: <span className="text-[#00E5FF]">Cost-Based Pricing</span></span>
          <span>Sources: {SOURCES.length} Marketplaces</span>
        </div>
      </footer>
    </div>
  );
}
