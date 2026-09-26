"use client";

import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scissors,
  BoxSelect,
  UserCircle2,
  Image,
  Flower,
  Box,
  Waves,
  Keyboard,
  Camera,
  Baseline,
  Gamepad2,
  Paperclip,
  Cake,
  Puzzle,
  Palette,
  QrCode,
  ArrowRightLeft,
  Brush,
  Layers,
  Cuboid,
  Calculator,
  Megaphone,
  Settings2,
  CircleDot,
  WrapText,
  Nut,
  ImagePlus,
  Sparkles,
  Printer,
  Wand2,
  Grid,
  PenTool,
  MousePointer2,
  Download,
  Upload,
  Share2,
  Star,
  Zap,
  Heart,
  MessageSquare,
} from "lucide-react";
import { M2crLogo } from "@/components/M2crLogo";

const TOOL_CATEGORIES = [
  {
    id: "core",
    label: "Core Studio",
    accent: "#632CE5",
    accentLight: "#E8E6F7",
    icon: Sparkles,
    tools: [
      { to: "/split-3mf", label: "Split 3MF", desc: "Import, segment & export multi-color 3MF with precision", icon: Scissors, featured: true },
      { to: "/viewer3d", label: "3D Slicer & Painter", desc: "Vertex painting, auto-segmentation, connectors, STL/3MF export", icon: BoxSelect, featured: true },
      { to: "/plate-creator", label: "Plate Creator", desc: "Arrange, auto-pack & export print plates for multi-material", icon: Grid, featured: false },
      { to: "/filament-painter", label: "Filament Painter", desc: "Paint models for multi-color prints with AMS/MMU support", icon: Layers, featured: false },
      { to: "/file-converter", label: "File Converter", desc: "STL, OBJ, FBX, 3MF, GLTF conversion & repair", icon: ArrowRightLeft, featured: false },
    ],
  },
  {
    id: "creative",
    label: "Creative Generators",
    accent: "#00C896",
    accentLight: "#E6F9F1",
    icon: Wand2,
    tools: [
      { to: "/image-to-3d", label: "Image to 3D", desc: "Convert photos to printable 3D models with depth maps", icon: Image, featured: true },
      { to: "/face-3d", label: "Face 3D Relief", desc: "Turn portraits into lithophane-style 3D reliefs", icon: UserCircle2, featured: true },
      { to: "/lithophane-generator", label: "Lithophane Maker", desc: "High-fidelity photo lithophanes with frame options", icon: Box, featured: false },
      { to: "/vase-generator", label: "Vase Generator", desc: "Parametric vases with spiral, twist & texture controls", icon: Flower, featured: false },
      { to: "/name-sign", label: "Sign & Plaque Maker", desc: "Custom text plaques, nameplates & dimensional lettering", icon: Baseline, featured: false },
      { to: "/qr-generator", label: "QR Code Generator", desc: "Styled QR codes with logo embed for 3D printing", icon: QrCode, featured: false },
      { to: "/svg-converter", label: "Image Vectorizer", desc: "PNG/JPG to clean SVG with edge detection", icon: ArrowRightLeft, featured: false },
    ],
  },
  {
    id: "functional",
    label: "Functional Prints",
    accent: "#F59E0B",
    accentLight: "#FEF3C7",
    icon: Box,
    tools: [
      { to: "/bin-generator", label: "Bin & Tray Generator", desc: "Stackable bins, grid trays, organizers with labels", icon: Box, featured: true },
      { to: "/flexi-creator", label: "Flexi Creator", desc: "Articulated print-in-place models with joint libraries", icon: Waves, featured: true },
      { to: "/keycap-customizer", label: "Keycap Designer", desc: "MX-compatible keycaps with legends, profiles & textures", icon: Keyboard, featured: false },
      { to: "/cookie-cutter-maker", label: "Cookie Cutter Maker", desc: "Food-safe cutters from SVG with bevel & handle options", icon: Scissors, featured: false },
      { to: "/cake-topper", label: "Cake Topper Creator", desc: "Personalized cake toppers with names, ages & themes", icon: Cake, featured: false },
      { to: "/clip-maker", label: "Clip Maker", desc: "Cable clips, bag seals, card holders & organizers", icon: Paperclip, featured: false },
    ],
  },
  {
    id: "engineering",
    label: "Engineering & Precision",
    accent: "#EF4444",
    accentLight: "#FEF2F2",
    icon: Settings2,
    tools: [
      { to: "/gear-generator", label: "Gear Generator", desc: "Involute spur/helical gears with BOSL2 precision", icon: Settings2, featured: true },
      { to: "/pulley-generator", label: "Pulley Generator", desc: "GT2, GT3, HTD, T5/T10 timing pulleys with flanges", icon: CircleDot, featured: true },
      { to: "/belt-generator", label: "Belt Generator", desc: "Custom length timing belts with tooth profiles", icon: WrapText, featured: false },
      { to: "/screw-generator", label: "Screw Generator", desc: "ISO metric threads, custom pitches, tolerance control", icon: Nut, featured: false },
      { to: "/gear-generator", label: "Can Opener from Image", desc: "Lithophane-style manual can opener from any image", icon: ImagePlus, featured: false },
    ],
  },
  {
    id: "fun",
    label: "Toys & Fidgets",
    accent: "#EC4899",
    accentLight: "#FDF2F8",
    icon: Gamepad2,
    tools: [
      { to: "/fidget-clicker", label: "Clicker Maker", desc: "Satisfying mechanical clickers with spring tuning", icon: Gamepad2, featured: true },
      { to: "/fidget-maker", label: "Fidget Maker", desc: "Nested layers, spinners, sliders & gravity toys", icon: Layers, featured: true },
      { to: "/puzzle-generator", label: "Puzzle Generator", desc: "Interlocking puzzles, maze boxes & brain teasers", icon: Puzzle, featured: false },
      { to: "/ai-figures", label: "AI Figure Generator", desc: "Poseable character figures with joint systems", icon: Cuboid, featured: false },
    ],
  },
];

const QUICK_ACTIONS = [
  { to: "/split-3mf", label: "Open Split 3MF", icon: Scissors, shortcut: "⌘1" },
  { to: "/viewer3d", label: "Open 3D Painter", icon: BoxSelect, shortcut: "⌘2" },
  { to: "/plate-creator", label: "Arrange Plate", icon: Grid, shortcut: "⌘3" },
  { to: "/file-converter", label: "Convert Files", icon: ArrowRightLeft, shortcut: "⌘4" },
];

function CategoryCard({ category, index, delay = 0 }: { category: typeof TOOL_CATEGORIES[0]; index: number; delay?: number }) {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1], delay: delay * 0.12 }}
      className="group relative overflow-hidden"
      style={{ borderRadius: "2rem" }}
    >
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${category.accentLight} 0%, transparent 60%)`,
          opacity: 0.6,
        }}
      />
      <div
        className="absolute inset-0 rounded-2xl p-[1px] pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${category.accent}40 0%, transparent 50%)`,
        }}
      >
        <div className="relative h-full rounded-[calc(2rem-1px)] overflow-hidden" style={{ background: "#FFFFFF" }}>
          <div className="p-6 md:p-8 h-full flex flex-col">
            <div className="flex items-start justify-between mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: category.accentLight, color: category.accent }}
                >
                  <category.icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <div>
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.15em] mb-1"
                    style={{ background: category.accentLight, color: category.accent }}
                  >
                    {category.label}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--workbench-text)] leading-none">
                    {category.tools.filter(t => t.featured).length} Featured
                  </h2>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--surface-container-low)] border border-[var(--surface-container-high)]">
                <span className="font-mono text-[10px] text-[var(--on-surface-variant)]">Tools</span>
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold text-white"
                  style={{ background: category.accent }}
                >
                  {category.tools.length}
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-hide">
              {category.tools.map((tool, toolIndex) => (
                <motion.div
                  key={tool.to}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1], delay: delay * 0.12 + toolIndex * 0.06 }}
                  whileHover={{ y: -2, scale: 1.005 }}
                  whileTap={{ scale: 0.985 }}
                >
                  <Link
                    to={tool.to}
                    className="relative w-full flex items-start gap-4 p-4 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group"
                    style={{
                      background: hoveredTool === tool.to ? `${category.accent}08` : "transparent",
                      border: hoveredTool === tool.to ? `1px solid ${category.accent}30` : "1px solid transparent",
                    }}
                    onMouseEnter={() => setHoveredTool(tool.to)}
                    onMouseLeave={() => setHoveredTool(null)}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 flex-shrink-0 relative overflow-hidden"
                      style={{
                        background: hoveredTool === tool.to ? category.accent : category.accentLight,
                        color: hoveredTool === tool.to ? "#FFFFFF" : category.accent,
                      }}
                    >
                      <tool.icon className="w-5 h-5 transition-all duration-300" strokeWidth={hoveredTool === tool.to ? 2.5 : 2} />
                      {tool.featured && (
                        <motion.div
                          animate={{ scale: [1, 1.15, 1], rotate: [0, 3, -3, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: "#F59E0B" }}
                        >
                          <Star className="w-2.5 h-2.5 text-white" />
                        </motion.div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="font-semibold text-[var(--workbench-text)] text-base leading-snug group-hover:text-[#632CE5] transition-colors">
                        {tool.label}
                      </h3>
                      <p className="text-[12px] text-[var(--on-surface-variant)] leading-relaxed mt-1 line-clamp-2">{tool.desc}</p>
                    </div>
                    <motion.div
                      className="w-8 h-8 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                      style={{ background: category.accentLight, color: category.accent }}
                      animate={{ x: hoveredTool === tool.to ? 4 : 0 }}
                    >
                      <MousePointer2 className="w-4 h-4" strokeWidth={2} />
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="pt-4 border-t border-[var(--surface-container-high)]">
              <Link
                to={category.tools[0].to}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-mono text-[11px] font-semibold uppercase tracking-[0.05em] transition-all duration-300"
                style={{
                  background: category.accent,
                  color: "#FFFFFF",
                  boxShadow: `0 4px 20px -8px ${category.accent}`,
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                <span>Launch {category.tools[0].label}</span>
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  →
                </motion.span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function QuickActionButton({ action, index }: { action: typeof QUICK_ACTIONS[0]; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.3 + index * 0.08 }}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
    >
      <Link
        to={action.to}
        className="relative flex items-center gap-3 px-5 py-4 rounded-xl border border-[var(--surface-container-high)] bg-[var(--workbench-panel)] hover:border-[var(--surface-container)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group w-full"
      >
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--surface-container-low)] text-[#632CE5] group-hover:bg-[#632CE5] group-hover:text-white transition-colors duration-300">
          <action.icon className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="flex-1 text-left">
          <span className="font-semibold text-[var(--workbench-text)]">{action.label}</span>
          <span className="font-mono text-[10px] text-[var(--workbench-muted)] ml-2">{action.shortcut}</span>
        </div>
        <motion.div
          className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-[#632CE5]10 text-[#632CE5] transition-all duration-300"
          animate={{ x: [0, 3, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <MousePointer2 className="w-3.5 h-3.5" strokeWidth={2.5} />
        </motion.div>
      </Link>
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, accent, delay }: { label: string; value: string; icon: any; accent: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1], delay }}
      className="relative p-5 md:p-6 rounded-2xl bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] overflow-hidden"
    >
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}15 0%, transparent 70%)` }} />
      <div className="relative flex flex-col">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${accent}15`, color: accent }}>
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="font-mono text-3xl md:text-4xl font-bold text-[var(--workbench-text)] leading-none tracking-tight mb-1">{value}</div>
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">{label}</div>
      </div>
    </motion.div>
  );
}

function FloatingOrb({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <motion.div
      className={className}
      style={style}
      animate={{
        x: [0, 20, -15, 0],
        y: [0, -15, 20, 0],
        scale: [1, 1.05, 0.98, 1],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    >
      <div className="absolute inset-0 rounded-full" style={{ filter: "blur(80px)", opacity: 0.4 }} />
    </motion.div>
  );
}

export default function Dashboard() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const totalTools = TOOL_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0);

  return (
    <div className="relative min-h-[100dvh] bg-[var(--workbench-viewport)] overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <FloatingOrb
          style={{
            width: "600px",
            height: "600px",
            top: "-200px",
            right: "-200px",
            background: "radial-gradient(ellipse at center, #632CE520 0%, transparent 70%)",
          }}
        />
        <FloatingOrb
          style={{
            width: "400px",
            height: "400px",
            bottom: "20%",
            left: "-100px",
            background: "radial-gradient(ellipse at center, #00C89615 0%, transparent 70%)",
          }}
        />
        <FloatingOrb
          style={{
            width: "300px",
            height: "300px",
            top: "40%",
            right: "10%",
            background: "radial-gradient(ellipse at center, #F59E0B15 0%, transparent 70%)",
          }}
        />
      </div>

      <header
        className="relative z-10 sticky top-0 backdrop-blur-2xl border-b border-[var(--surface-container-high)]/80 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(249, 250, 244, 0.9)" : "rgba(249, 250, 244, 0.7)",
          boxShadow: scrolled ? "0 4px 40px -20px rgba(0,0,0,0.08)" : "none",
        }}
      >
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <M2crLogo size={28} withWordmark={true} />
          </div>
          <nav className="hidden md:flex items-center gap-6">
            {TOOL_CATEGORIES.map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] transition-colors relative"
              >
                {cat.label}
                <motion.span
                  layoutId={`underline-${cat.id}`}
                  className="absolute bottom-[-4px] left-0 h-0.5 rounded-full"
                  style={{ background: cat.accent, width: "100%" }}
                  initial={false}
                />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block font-mono text-[11px] text-[var(--workbench-muted)]">v0.5.0</span>
            <div className="w-8 h-8 rounded-full bg-[var(--primary-fixed)] border border-[var(--surface-container)] flex items-center justify-center font-sans text-xs font-bold text-[#632CE5]">
              MC
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-8 pb-20">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            className="mb-16 md:mb-24"
          >
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
              <div className="relative">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.15em] mb-6" style={{ background: "#E8E6F7", color: "#632CE5" }}>
                  Workbench Studio
                </span>
                <h1 className="text-5xl md:text-7xl lg:text-[72px] font-bold tracking-tighter leading-[0.95] text-[var(--workbench-text)] max-w-xl">
                  Your 3D Print{" "}
                  <span style={{ color: "#632CE5" }}>Workbench</span>
                </h1>
                <p className="mt-6 md:mt-8 text-lg md:text-xl text-[var(--on-surface-variant)] leading-relaxed max-w-lg pr-8">
                  A complete suite of parametric generators, slicers & creative tools for 3D printing.
                  {totalTools} specialized tools. Zero friction. Native 3MF color support.
                </p>

                <div className="mt-8 md:mt-12 flex flex-wrap gap-3">
                  {QUICK_ACTIONS.map((action, i) => (
                    <QuickActionButton key={action.to} action={action} index={i} />
                  ))}
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-[var(--on-surface-variant)]">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4" strokeWidth={2} />
                    <span>STL • 3MF • OBJ • GLTF</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4" strokeWidth={2} />
                    <span>FDM • SLA • Multi-material</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" strokeWidth={2} />
                    <span>Native color pipeline</span>
                  </div>
                </div>
              </div>

              <div className="relative hidden lg:block">
                <div className="relative aspect-[4/3] rounded-[2.5rem] overflow-hidden" style={{ background: "#FFFFFF" }}>
                  <div className="absolute inset-0 p-[1px] rounded-[2.5rem]" style={{ background: "linear-gradient(135deg, #632CE540 0%, #00C89640 50%, #F59E0B40 100%)" }}>
                    <div className="relative h-full rounded-[calc(2.5rem-1px)] overflow-hidden bg-[var(--workbench-viewport)]">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-8">
                          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center relative" style={{ background: "linear-gradient(135deg, #632CE5 0%, #00C896 100%)" }}>
                            <Printer className="w-12 h-12 text-white" strokeWidth={1.5} />
                          </div>
                          <h3 className="text-2xl font-bold text-[var(--workbench-text)] mb-2">Live Preview</h3>
                          <p className="text-[var(--on-surface-variant)]">Drop a model → paint → slice → print</p>
                        </div>
                      </div>
                      <div className="absolute bottom-6 left-6 right-6 flex gap-3">
                        <div className="flex-1 h-16 rounded-xl bg-[var(--workbench-panel)]/80 backdrop-blur-xl border border-white/50 flex items-center justify-center gap-4 px-6">
                          <div className="w-2 h-2 rounded-full" style={{ background: "#632CE5" }} />
                          <div className="w-2 h-2 rounded-full" style={{ background: "#00C896" }} />
                          <div className="w-2 h-2 rounded-full" style={{ background: "#F59E0B" }} />
                          <div className="w-2 h-2 rounded-full" style={{ background: "#EF4444" }} />
                          <div className="w-2 h-2 rounded-full" style={{ background: "#EC4899" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-16 md:mb-20"
          >
<StatCard label="Total Tools" value={totalTools.toString()} icon={Box} accent="#632CE5" delay={0} />
<StatCard label="Categories" value={TOOL_CATEGORIES.length.toString()} icon={Layers} accent="#00C896" delay={0.1} />
            <StatCard label="Export Formats" value="6+" icon={Download} accent="#F59E0B" delay={0.2} />
            <StatCard label="Print Modes" value="FDM/SLA" icon={Printer} accent="#EF4444" delay={0.3} />
            <StatCard label="Active Users" value="2.4k+" icon={Heart} accent="#EC4899" delay={0.4} />
          </motion.div>

          <AnimatePresence mode="popLayout">
            {TOOL_CATEGORIES.map((category, catIndex) => (
              <motion.section
                key={category.id}
                id={category.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                className="mb-16 md:mb-20"
              >
                <div className="flex items-end justify-between gap-6 mb-8">
                  <div>
                    <span
                      className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.15em] mb-3"
                      style={{ background: category.accentLight, color: category.accent }}
                    >
                      {category.label}
                    </span>
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--workbench-text)] leading-none">
                      {category.tools.length} Tools
                    </h2>
                  </div>
                  <Link
                    to={category.tools[0].to}
                    className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-[11px] font-semibold uppercase tracking-[0.05em] transition-all duration-300"
                    style={{ background: category.accent, color: "#FFFFFF" }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                  >
                    Explore →
                  </Link>
                </div>

                <div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                  style={{
                    gridTemplateColumns: catIndex % 2 === 0
                      ? "repeat(4, 1fr)"
                      : "repeat(4, 1fr)",
                  }}
                >
                  {category.tools.slice(0, 4).map((tool, toolIndex) => (
                    <motion.div
                      key={tool.to}
                      layout
                      initial={{ opacity: 0, y: 30, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: catIndex * 0.1 + toolIndex * 0.08 }}
                      whileHover={{ y: -4 }}
                    >
                      <Link
                        to={tool.to}
                        className="relative group h-full flex flex-col"
                      >
                        <div
                          className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] group-hover:border-transparent"
                          style={{
                            boxShadow: `0 4px 20px -8px ${category.accent}20`,
                          }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center p-8">
                            <div className="w-full h-full max-w-xs max-h-xs relative">
                              <div className="absolute inset-0 rounded-xl flex items-center justify-center" style={{ background: category.accentLight }}>
                                <tool.icon className="w-16 h-16" style={{ color: category.accent }} strokeWidth={1.5} />
                              </div>
                              {tool.featured && (
                                <div className="absolute top-3 right-3">
                                  <motion.span
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.05em]"
                                    style={{ background: "#F59E0B", color: "#FFFFFF" }}
                                  >
                                    <Star className="w-3 h-3" /> Featured
                                  </motion.span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 via-black/10 to-transparent">
                            <h3 className="font-semibold text-white text-base leading-snug">{tool.label}</h3>
                          </div>
                        </div>
                        <div className="mt-3 flex-1 flex flex-col">
                          <p className="text-[13px] text-[var(--on-surface-variant)] leading-relaxed flex-1">{tool.desc}</p>
                          <div className="mt-3 pt-3 border-t border-[var(--surface-container-high)] flex items-center justify-between">
                            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--workbench-muted)]">Launch</span>
                            <motion.div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#632CE5] group-hover:bg-[#632CE5] group-hover:text-white transition-colors duration-300"
                              style={{ background: "#E8E6F7" }}
                              animate={{ x: [0, 2, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            >
                              <MousePointer2 className="w-4 h-4" strokeWidth={2.5} />
                            </motion.div>
                          </div>
                        </div>
                      </Link>
                </motion.div>
              ))}
                  {category.tools.length > 4 && (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 30, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: catIndex * 0.1 + 0.32 }}
                      whileHover={{ y: -4 }}
                      className="relative h-full flex flex-col"
                    >
                      <div
                        className="relative aspect-[4/3] rounded-2xl overflow-hidden border-2 border-dashed transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:border-solid group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]"
                        style={{ borderColor: `${category.accent}40`, background: `${category.accent}05` }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center p-8">
                          <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: category.accentLight }}>
                              <category.icon className="w-8 h-8" style={{ color: category.accent }} strokeWidth={2} />
                            </div>
                            <h3 className="font-semibold text-[var(--workbench-text)] mb-1">+ {category.tools.length - 4} More Tools</h3>
                            <p className="text-[13px] text-[var(--on-surface-variant)]">Explore the full {category.label.toLowerCase()} suite</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex-1 flex flex-col justify-end">
                        <Link
                          to={category.tools[0].to}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-mono text-[11px] font-semibold uppercase tracking-[0.05em] transition-all duration-300"
                          style={{
                            background: category.accent,
                            color: "#FFFFFF",
                            boxShadow: `0 4px 20px -8px ${category.accent}`,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                          onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                        >
                          View All {category.label}
                          <motion.span
                            animate={{ x: [0, 4, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          >
                            →
                          </motion.span>
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>

          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            className="relative rounded-[3rem] overflow-hidden pb-16 md:pb-24"
            style={{ background: "linear-gradient(135deg, #1A1C19 0%, #2D2B35 100%)" }}
          >
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, #632CE530 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, #00C89620 0%, transparent 50%)" }} />
            <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-8">
              <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.15em] mb-5" style={{ background: "rgba(99, 44, 229, 0.2)", color: "#C8B8FF" }}>
                  Ready to Print
                </span>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[0.95] text-white mb-6">
                  Start Creating in{" "}
                  <span className="text-transparent bg-clip-text" style={{ background: "linear-gradient(135deg, #632CE5 0%, #00C896 100%)" }}>
                    Seconds
                  </span>
                </h2>
                <p className="text-lg text-[var(--workbench-muted)] leading-relaxed max-w-xl mx-auto">
                  No installation. No configuration. Open any tool and start designing for your 3D printer immediately.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {[
                  { label: "Drag & Drop", desc: "STL, OBJ, 3MF, GLTF", icon: Upload },
                  { label: "Paint & Segment", desc: "Vertex colors → parts", icon: PenTool },
                  { label: "Export & Print", desc: "3MF with native colors", icon: Download },
                ].map((step, i) => (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.3 + i * 0.1 }}
                    className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-[var(--workbench-panel)]/5 border border-white/10 hover:bg-[var(--workbench-panel)]/10 transition-colors"
                  >
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(99, 44, 229, 0.15)", color: "#C8B8FF" }}>
                      <step.icon className="w-7 h-7" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-semibold text-white text-lg mb-1">{step.label}</h3>
                    <p className="text-[13px] text-[var(--on-surface-variant)]">{step.desc}</p>
                    {i < 2 && (
                      <div className="absolute top-1/2 right-[-20px] w-8 h-8 flex items-center justify-center text-[var(--on-surface-variant)]">
                        <ArrowRightLeft className="w-5 h-5" strokeWidth={1.5} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[var(--surface-container-high)] bg-[var(--workbench-panel)] py-8 px-4 md:px-8">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <M2crLogo size={24} withWordmark={false} />
            <span className="font-sans text-[14px] font-medium text-[var(--on-surface-variant)]">Workbench Studio</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[12px] text-[var(--on-surface-variant)]">
            <span>30+ parametric tools</span>
            <span className="w-px h-4 bg-[#E8E7E0]"></span>
            <span>Native 3MF color pipeline</span>
            <span className="w-px h-4 bg-[#E8E7E0]"></span>
            <span>Open source • MIT License</span>
            <span className="w-px h-4 bg-[#E8E7E0]"></span>
            <a
              href="/catalogo_m2cr.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--workbench-text)] transition-colors underline underline-offset-4 decoration-[#E8E7E0]"
            >
              Catálogo M2CR
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--surface-container-low)] hover:bg-[#E8E7E0] text-[var(--on-surface-variant)] transition-colors">
              <Box className="w-4.5 h-4.5" strokeWidth={2} />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--surface-container-low)] hover:bg-[#E8E7E0] text-[var(--on-surface-variant)] transition-colors">
              <Share2 className="w-4.5 h-4.5" strokeWidth={2} />
            </a>
            <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--surface-container-low)] hover:bg-[#E8E7E0] text-[var(--on-surface-variant)] transition-colors">
              <MessageSquare className="w-4.5 h-4.5" strokeWidth={2} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}