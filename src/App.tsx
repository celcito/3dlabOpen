/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { Brush, Cuboid, BoxSelect, Calculator, Megaphone, Sparkles, Scissors, ArrowRightLeft, QrCode, Palette, Gamepad2, Baseline, Waves, UserCircle2, Box, Flower, Image } from "lucide-react";
import PaintMixer from "./pages/PaintMixer";
import AiFigures from "./pages/AiFigures";
import Viewer3D from "./pages/Viewer3D";
import PriceCalculator from "./pages/PriceCalculator";
import MarketingGenerator from "./pages/MarketingGenerator";
import PlateCreator from "./pages/PlateCreator";
import CookieCutterMaker from "./pages/CookieCutterMaker";
import FileConverter from "./pages/FileConverter";
import SvgConverter from "./pages/SvgConverter";
import QrGenerator from "./pages/QrGenerator";
import DesignEditor from "./pages/DesignEditor";
import FidgetClickerMaker from "./pages/FidgetClickerMaker";

import NameSignGenerator from "./pages/NameSignGenerator";
import FlexiModelCreator from "./pages/FlexiModelCreator";
import Face3DGenerator from "./pages/Face3DGenerator";
import BinGenerator from "./pages/BinGenerator";
import VaseGenerator from "./pages/VaseGenerator";
import ImageTo3D from "./pages/ImageTo3D";

function NavItem({ to, icon: Icon, label, description }: { to: string; icon: any; label: string; description: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`w-full flex items-center gap-3.5 px-6 py-4 border-l-2 transition-all ${
        isActive 
          ? "border-[#00E5FF] text-white bg-[#00E5FF]/5" 
          : "border-transparent text-zinc-400 hover:text-white hover:bg-white/2"
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#00E5FF]" : "text-zinc-500"}`} />
      <div className="flex flex-col min-w-0">
        <span className={`text-[11px] font-black uppercase tracking-wider ${isActive ? "text-white" : "text-zinc-300"}`}>
          {label}
        </span>
        <span className="text-[9px] text-zinc-500 truncate font-sans uppercase tracking-tight font-bold">
          {description}
        </span>
      </div>
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#080808] text-white font-sans overflow-hidden">
      {/* SIDEBAR NAVIGATION */}
      <nav className="w-[240px] bg-[#0d0d0d] border-r border-zinc-900 flex flex-col pt-8 shrink-0">
        <div className="px-6 flex items-center gap-3 mb-8 shrink-0">
          <div className="text-xl font-black tracking-tighter border-2 border-[#00E5FF] text-[#00E5FF] w-9 h-9 flex items-center justify-center shrink-0">
            V
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-black tracking-widest uppercase text-white">Vértice Studio</span>
            <span className="text-[8px] tracking-wider text-zinc-500 uppercase font-mono font-bold">Print Companion</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-8">
          <div className="flex flex-col w-full">
            <NavItem to="/" icon={BoxSelect} label="Separar Partes 3D" description="3D Viewer & Slicer" />
            <NavItem to="/face-3d" icon={UserCircle2} label="Face 3D" description="Foto em Relevo 3D" />
            <NavItem to="/image-to-3d" icon={Image} label="Imagem para 3D" description="Image to 3D Model" />
            <NavItem to="/vase-generator" icon={Flower} label="Vase Maker" description="Vasos Paramétricos" />
            <NavItem to="/bin-generator" icon={Box} label="Bin Generator" description="Organizadores Sob Medida" />
            <NavItem to="/flexi-creator" icon={Waves} label="Criador Flexi" description="Modelos Articulados" />
            <NavItem to="/name-sign" icon={Baseline} label="Gerador de Placas" description="Placas e Letreiros" />
            <NavItem to="/fidget-clicker" icon={Gamepad2} label="Clicker Maker" description="Fidget Chaveiro 3D" />
            <NavItem to="/design-editor" icon={Palette} label="Editor de Design" description="Criação de Layouts" />
            <NavItem to="/qr-generator" icon={QrCode} label="Gerador QR 3D" description="QR Code para Placas" />
            <NavItem to="/svg-converter" icon={ArrowRightLeft} label="Vetorizador Imagem" description="PNG para SVG" />
            <NavItem to="/cookie-cutter-maker" icon={Scissors} label="Cortador de Biscoitos" description="Biscoito CUT Maker" />
            <NavItem to="/plate-creator" icon={Sparkles} label="Criador de Placas 3D" description="3D Plate Designer" />
            <NavItem to="/paint-mixer" icon={Brush} label="Misturador de Tintas" description="Paint Color Mixer" />
            <NavItem to="/ai-figures" icon={Cuboid} label="Gerador de Figuras" description="AI Character Figures" />
            <NavItem to="/price-calculator" icon={Calculator} label="Calculadora de Preços" description="Price Calculator" />
            <NavItem to="/marketing-generator" icon={Megaphone} label="Gerador de Marketing" description="Product Marketing" />
            <NavItem to="/file-converter" icon={ArrowRightLeft} label="Conversor de Arquivos" description="Converter STL, OBJ, FBX" />
          </div>
        </div>
      </nav>
      
      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#080808]">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Viewer3D />} />
          <Route path="/face-3d" element={<Face3DGenerator />} />
          <Route path="/image-to-3d" element={<ImageTo3D />} />
          <Route path="/vase-generator" element={<VaseGenerator />} />
          <Route path="/bin-generator" element={<BinGenerator />} />
          <Route path="/flexi-creator" element={<FlexiModelCreator />} />
          <Route path="/name-sign" element={<NameSignGenerator />} />
          <Route path="/fidget-clicker" element={<FidgetClickerMaker />} />
          <Route path="/design-editor" element={<DesignEditor />} />
          <Route path="/qr-generator" element={<QrGenerator />} />
          <Route path="/svg-converter" element={<SvgConverter />} />
          <Route path="/cookie-cutter-maker" element={<CookieCutterMaker />} />
          <Route path="/plate-creator" element={<PlateCreator />} />
          <Route path="/paint-mixer" element={<PaintMixer />} />
          <Route path="/ai-figures" element={<AiFigures />} />
          <Route path="/price-calculator" element={<PriceCalculator />} />
          <Route path="/marketing-generator" element={<MarketingGenerator />} />
          <Route path="/file-converter" element={<FileConverter />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
