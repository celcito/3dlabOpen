import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Brush, Cuboid, BoxSelect, Calculator, Megaphone, Sparkles, Scissors, ArrowRightLeft, QrCode, Palette, Gamepad2, Baseline, Waves, UserCircle2, Box, Flower, Image, ImagePlus, Layers, Camera, Settings, HelpCircle, Headset, MonitorPlay, Keyboard, Settings2, CircleDot, WrapText, Nut, Paperclip, Puzzle } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { M2crLogo } from "@/components/M2crLogo";
import Viewer3D from "./pages/Viewer3D";

const PaintMixer = lazy(() => import("./pages/PaintMixer"));
const FilamentPainter = lazy(() => import("./pages/FilamentPainter"));
const LithophaneGenerator = lazy(() => import("./pages/LithophaneGenerator"));
const AiFigures = lazy(() => import("./pages/AiFigures"));
const PriceCalculator = lazy(() => import("./pages/PriceCalculator"));
const MarketingGenerator = lazy(() => import("./pages/MarketingGenerator"));
const PlateCreator = lazy(() => import("./pages/PlateCreator"));
const CookieCutterMaker = lazy(() => import("./pages/CookieCutterMaker"));
const FileConverter = lazy(() => import("./pages/FileConverter"));
const SvgConverter = lazy(() => import("./pages/SvgConverter"));
const QrGenerator = lazy(() => import("./pages/QrGenerator"));
const DesignEditor = lazy(() => import("./pages/DesignEditor"));
const FidgetClickerMaker = lazy(() => import("./pages/FidgetClickerMaker"));
const NameSignGenerator = lazy(() => import("./pages/NameSignGenerator"));
const FlexiModelCreator = lazy(() => import("./pages/FlexiModelCreator"));
const FlexiFromPhoto = lazy(() => import("./pages/FlexiFromPhoto"));
const Face3DGenerator = lazy(() => import("./pages/Face3DGenerator"));
const BinGenerator = lazy(() => import("./pages/BinGenerator"));
const VaseGenerator = lazy(() => import("./pages/VaseGenerator"));
const ImageTo3D = lazy(() => import("./pages/ImageTo3D"));
const Split3MF = lazy(() => import("./pages/Split3MF"));
const KeycapCustomizer = lazy(() => import("./pages/KeycapCustomizer"));
const GearGenerator = lazy(() => import("./pages/GearGenerator"));
const PulleyGenerator = lazy(() => import("./pages/PulleyGenerator"));
const BeltGenerator = lazy(() => import("./pages/BeltGenerator"));
const ScrewGenerator = lazy(() => import("./pages/ScrewGenerator"));
const CanOpener = lazy(() => import("./pages/CanOpener"));
const ClipMaker = lazy(() => import("./pages/ClipMaker"));
const PuzzleGenerator = lazy(() => import("./pages/PuzzleGenerator"));

const NAV_ITEMS = [
  { to: "/split-3mf", icon: Scissors, label: "Split 3MF", description: "Import & split multi-color 3MF" },
  { to: "/viewer3d", icon: BoxSelect, label: "3D Slicer", description: "3D Viewer & Slicer" },
  { to: "/face-3d", icon: UserCircle2, label: "Face 3D", description: "Foto em Relevo 3D" },
  { to: "/image-to-3d", icon: Image, label: "Image to 3D", description: "Image to 3D Model" },
  { to: "/vase-generator", icon: Flower, label: "Vase Maker", description: "Vasos Paramétricos" },
  { to: "/bin-generator", icon: Box, label: "Bin & Tray Generator", description: "Custom bins and sorting trays" },
  { to: "/flexi-creator", icon: Waves, label: "Flexi Creator", description: "Modelos Articulados" },
  { to: "/keycap-customizer", icon: Keyboard, label: "Keycap Customizer", description: "Keycaps MX paramétricas" },
  { to: "/flexi-from-photo", icon: Camera, label: "Flexi From Photo", description: "Flexi a partir de Foto" },
  { to: "/name-sign", icon: Baseline, label: "Gerador de Placas", description: "Placas e Letreiros" },
  { to: "/fidget-clicker", icon: Gamepad2, label: "Clicker Maker", description: "Fidget Chaveiro 3D" },
  { to: "/clip-maker", icon: Paperclip, label: "Clip Maker", description: "Clipes Decorativos 3D" },
  { to: "/puzzle-generator", icon: Puzzle, label: "Puzzle Generator", description: "Quebra-Cabeça Paramétrico" },
  { to: "/design-editor", icon: Palette, label: "Editor de Design", description: "Criação de Layouts" },
  { to: "/qr-generator", icon: QrCode, label: "QR Generator", description: "QR Code para Placas" },
  { to: "/svg-converter", icon: ArrowRightLeft, label: "Vetorizador Imagem", description: "PNG para SVG" },
  { to: "/cookie-cutter-maker", icon: Scissors, label: "Cortador de Biscoitos", description: "Biscoito CUT Maker" },
  { to: "/plate-creator", icon: Sparkles, label: "Criador de Placas 3D", description: "3D Plate Designer" },
  { to: "/paint-mixer", icon: Brush, label: "Misturador de Tintas", description: "Paint Color Mixer" },
  { to: "/filament-painter", icon: Layers, label: "Filament Painter", description: "Multicolor Print Generator" },
  { to: "/lithophane-generator", icon: Box, label: "Lithophane Maker", description: "Foto em Relevo STL" },
  { to: "/ai-figures", icon: Cuboid, label: "Gerador de Figuras", description: "AI Character Figures" },
  { to: "/price-calculator", icon: Calculator, label: "Calculadora de Preços", description: "Price Calculator" },
  { to: "/marketing-generator", icon: Megaphone, label: "Gerador de Marketing", description: "Product Marketing" },
  { to: "/file-converter", icon: ArrowRightLeft, label: "Conversor de Arquivos", description: "Converter STL, OBJ, FBX" },
];

const ENGINEERING_ITEMS = [
  { to: "/gear-generator", icon: Settings2, label: "Gear Generator", description: "BOSL2 Parametric Gears" },
  { to: "/pulley-generator", icon: CircleDot, label: "Pulley Generator", description: "Timing Belt Pulleys" },
  { to: "/belt-generator", icon: WrapText, label: "Belt Generator", description: "Timing Belts (GT2, HTD)" },
  { to: "/screw-generator", icon: Nut, label: "Screw Generator", description: "Parametric Fasteners" },
  { to: "/can-opener", icon: ImagePlus, label: "Image Can Opener", description: "Imagem → Abridor de Latas 3D" },
];

function NavItem({ to, icon: Icon, label, description }: { to: string; icon: any; label: string; description: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-r-full border-l-4 font-mono text-[11px] font-medium tracking-[0.05em] transition-colors scale-95 active:scale-100 ${
        isActive
          ? "bg-[#7C4DFF] text-[#FCF6FF] border-[#632CE5]"
          : "border-transparent text-[#494455] hover:bg-[#E8E9E3] hover:text-[#1A1C19]"
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#FCF6FF]" : "text-[#7A7487]"}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] bg-[var(--workbench-page)] text-[var(--workbench-text)] font-sans overflow-hidden">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-[280px] bg-[#FFFFFF] border-r border-[#CAC3D8] flex flex-col py-5 shrink-0">
        <div className="px-5 mb-8 flex items-center gap-3 shrink-0">
          <M2crLogo size={30} withWordmark={false} />
          <div className="flex flex-col">
            <h1 className="font-sans text-[20px] font-bold text-[#632CE5] leading-none">Workbench</h1>
            <span className="font-mono text-[10px] text-[#494455] tracking-[0.05em] mt-1">V0.5.0</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-6 px-2 space-y-0.5">
          <div className="flex flex-col w-full">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
            <div className="px-4 pt-4 pb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[#7A7487] font-bold">
              Engineering
            </div>
            {ENGINEERING_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>
        </div>
        {/* CTA + Footer */}
        <div className="px-5 mt-auto pt-4 space-y-4 shrink-0">
          <button className="w-full py-2 px-4 bg-[#632CE5] text-white rounded font-mono text-[11px] tracking-[0.05em] hover:bg-[#7C4DFF] transition-colors flex items-center justify-center gap-2">
            <MonitorPlay className="w-4 h-4" />
            Upgrade to Pro
          </button>
          <div className="border-t border-[#E8E9E3] pt-4 space-y-1">
            <a className="flex items-center gap-3 px-2 py-2 text-[#494455] hover:bg-[#E8E9E3] rounded font-mono text-[11px] tracking-[0.05em] transition-colors">
              <HelpCircle className="w-4 h-4" />
              Documentation
            </a>
            <a className="flex items-center gap-3 px-2 py-2 text-[#494455] hover:bg-[#E8E9E3] rounded font-mono text-[11px] tracking-[0.05em] transition-colors">
              <Headset className="w-4 h-4" />
              Support
            </a>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* TOP TOOLBAR */}
        <header className="h-16 bg-[#FFFFFF] border-b border-[#CAC3D8] flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-8">
            <M2crLogo size={24} />
          </div>
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-lg hover:bg-[#E8E9E3] flex items-center justify-center text-[#494455] transition-colors" aria-label="Configurações">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[#E2DFDE] border border-[#CAC3D8] flex items-center justify-center font-sans text-xs font-bold text-[#636262]">
              MC
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#F9FAF4]">
          <div className="workbench-content flex-1 min-h-0">
            <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-[#F9FAF4]">
      <M2crLogo size={44} withWordmark={true} />
      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#7A7487] font-bold">
        Carregando&hellip;
      </span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/split-3mf" element={<Split3MF />} />
          <Route path="/keycap-customizer" element={<KeycapCustomizer />} />
          <Route path="/" element={<Navigate to="/split-3mf" replace />} />
          <Route path="/viewer3d" element={<Viewer3D />} />
          <Route path="/face-3d" element={<Face3DGenerator />} />
          <Route path="/image-to-3d" element={<ImageTo3D />} />
          <Route path="/vase-generator" element={<VaseGenerator />} />
          <Route path="/bin-generator" element={<BinGenerator />} />
          <Route path="/flexi-creator" element={<FlexiModelCreator />} />
          <Route path="/flexi-from-photo" element={<FlexiFromPhoto />} />
          <Route path="/name-sign" element={<NameSignGenerator />} />
          <Route path="/fidget-clicker" element={<FidgetClickerMaker />} />
          <Route path="/design-editor" element={<DesignEditor />} />
          <Route path="/qr-generator" element={<QrGenerator />} />
          <Route path="/svg-converter" element={<SvgConverter />} />
          <Route path="/cookie-cutter-maker" element={<CookieCutterMaker />} />
          <Route path="/plate-creator" element={<PlateCreator />} />
          <Route path="/paint-mixer" element={<PaintMixer />} />
          <Route path="/filament-painter" element={<FilamentPainter />} />
          <Route path="/lithophane-generator" element={<LithophaneGenerator />} />
          <Route path="/ai-figures" element={<AiFigures />} />
          <Route path="/price-calculator" element={<PriceCalculator />} />
          <Route path="/marketing-generator" element={<MarketingGenerator />} />
          <Route path="/file-converter" element={<FileConverter />} />
          <Route path="/gear-generator" element={<GearGenerator />} />
          <Route path="/pulley-generator" element={<PulleyGenerator />} />
          <Route path="/belt-generator" element={<BeltGenerator />} />
          <Route path="/screw-generator" element={<ScrewGenerator />} />
          <Route path="/can-opener" element={<CanOpener />} />
          <Route path="/clip-maker" element={<ClipMaker />} />
          <Route path="/puzzle-generator" element={<PuzzleGenerator />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
