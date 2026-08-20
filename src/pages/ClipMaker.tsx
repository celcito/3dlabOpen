import React, { useState, useRef, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, Float } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
// @ts-ignore
import ImageTracer from "imagetracerjs";
import { 
  Paperclip, Sparkles, Download, Upload, Palette, Layers, Settings, 
  Sliders, Eye, RotateCcw, Check, Image as ImageIcon, Flower, Heart, 
  Star, FileText, Bookmark, Wand2, Feather, RefreshCw, Copy, 
  CheckCircle2, AlertCircle, Info, ShieldCheck, Box, Shapes,
  Search, X, ChevronRight, ChevronLeft, Compass, Flame,
  Sun, Moon, LayoutGrid
} from "lucide-react";

// --- TYPES & INTERFACES ---
export type ClipSizeCategory = "small" | "medium" | "large" | "giant" | "custom";
export type ClipBodyStyle = "classic" | "solid_bookmark" | "stem_connector" | "rounded_wire";
export type TopStyle = "line_art" | "solid_embossed" | "badge_plate";
export type StemStyle = "botanical_leaves" | "straight_neck" | "dual_bridge" | "winged_cushion" | "none_flush";
export type MaterialFinish = "matte" | "glossy" | "pearl" | "glitter";

export interface ClipConfig {
  // Size & Proportions
  sizeCategory: ClipSizeCategory;
  bodyStyle: ClipBodyStyle;
  clipLength: number;         // Total clip length (mm)
  clipWidth: number;          // Total clip width (mm)
  wireThickness: number;      // Width of extruded wire (mm)
  wireDepth: number;          // Z height / thickness of wire (mm)
  loopGap: number;            // Gap between concentric turns (mm)
  
  // Stem / Cabinho Connector Settings
  stemHeight: number;         // Height of stem neck (mm) - elevates decorative top
  stemWidth: number;          // Width of stem rod (mm)
  stemStyle: StemStyle;       // Style of the connector stem
  stemLeaves: boolean;        // Add cute botanical leaves on the stem
  stemLeafSize: number;       // Size of decorative leaves (mm)
  stemCalyxWidth?: number;    // Width of flared rounded calyx at emblem junction (mm)
  stemRoundness?: number;     // % of organic rounding curvature (0 to 100)
  
  // Top Design Settings
  topStyle: TopStyle;
  topDiameter: number;        // Top emblem width/diameter (mm)
  topHeight: number;          // Top emblem extrusion depth (mm)
  topLineWidth: number;       // Line art line thickness (mm)
  topOverlap: number;         // Overlap with clip wire for strong 3D bond (mm)
  topAngle: number;           // Rotation angle of top in degrees (-180 to 180)
  topOffsetX: number;         // Lateral offset X (mm)
  topOffsetY: number;         // Vertical offset adjustment (mm)
  topBevel: boolean;          // Add smooth chamfer/bevel to edges
  
  // Bicolor / Multicolor
  isBicolor: boolean;
  clipColor: string;          // Hex color for clip body
  topColor: string;           // Hex color for top emblem
  accentColor: string;        // Hex for secondary details / core
  finish: MaterialFinish;

  // View / Simulation Settings
  showPaper: boolean;
  paperType: "lined" | "grid" | "blank";
  batchGrid5x: boolean;       // Show 5x batch layout for printing
  showWireframe: boolean;
  showDimensions: boolean;
}

export interface PresetItem {
  id: string;
  name: string;
  category: "floral" | "symbols" | "geometric" | "cute" | "giant";
  sizeCategory: ClipSizeCategory;
  defaultTopStyle: TopStyle;
  icon: string;
  description: string;
  svg: string;
  defaultStemHeight?: number;
  defaultStemStyle?: StemStyle;
  defaultStemLeaves?: boolean;
}

// --- COLOR PALETTE (From Reference Photo) ---
export const CLIP_COLORS = [
  { name: "Azul Céu", hex: "#1E88E5", secondary: "#90CAF9" },
  { name: "Amarelo Ouro", hex: "#FFD600", secondary: "#FFF59D" },
  { name: "Laranja Cenoura", hex: "#FF6D00", secondary: "#FFCC80" },
  { name: "Preto Noite", hex: "#18181B", secondary: "#52525B" },
  { name: "Branco Puro", hex: "#FDFDFD", secondary: "#E4E4E7" },
  { name: "Branco Pérola", hex: "#F7F3E9", secondary: "#FFFDF9" },
  { name: "Vermelho Rubi", hex: "#D50000", secondary: "#FF8A80" },
  { name: "Verde Folha", hex: "#00C853", secondary: "#B9F6CA" },
  { name: "Roxo Lavanda", hex: "#8E24AA", secondary: "#E1BEE7" },
  { name: "Rosa Chiclete", hex: "#EC407A", secondary: "#F8BBD0" },
];

// --- STANDARD PRESETS (Rich Line Art & 3D Collection) ---
export const PRESETS: PresetItem[] = [
  // 1. FLORES & BOTÂNICA
  {
    id: "flower_stem_photo",
    name: "Flor com Cabinho & Folhas (da Foto)",
    category: "floral",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🌸",
    defaultStemHeight: 10,
    defaultStemStyle: "botanical_leaves",
    defaultStemLeaves: true,
    description: "Flor com pétalas arredondadas e cabinho floral com folhas elevando o topo (idêntico à foto de referência)",
    svg: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="11"/><path d="M 46 41 C 43 32 42 22 50 14 C 58 22 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(0.0 50 50)"/><path d="M 46 41 C 43 32 42 22 50 14 C 58 22 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(45.0 50 50)"/><path d="M 46 41 C 43 32 42 22 50 14 C 58 22 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(90.0 50 50)"/><path d="M 46 41 C 43 32 42 22 50 14 C 58 22 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(135.0 50 50)"/><path d="M 46 41 C 43 32 42 22 50 14 C 58 22 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(180.0 50 50)"/><path d="M 46 41 C 43 32 42 22 50 14 C 58 22 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(225.0 50 50)"/><path d="M 46 41 C 43 32 42 22 50 14 C 58 22 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(270.0 50 50)"/><path d="M 46 41 C 43 32 42 22 50 14 C 58 22 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(315.0 50 50)"/></g></svg>`
  },
  {
    id: "flower_mini",
    name: "Florzinha 5 Pétalas",
    category: "floral",
    sizeCategory: "small",
    defaultTopStyle: "solid_embossed",
    icon: "🌺",
    defaultStemHeight: 8,
    defaultStemStyle: "botanical_leaves",
    defaultStemLeaves: true,
    description: "Flor fofa com 5 pétalas arredondadas e miolo esférico em alto relevo",
    svg: `<svg viewBox="0 0 100 100"><g><path d="M 57.05 59.71 Q 62.36 88.04 50.00 84.00 Q 37.64 88.04 42.95 59.71 Q 90.00 50.00 82.34 60.51 Q 82.36 73.51 57.05 59.71 Q 62.36 11.96 69.98 22.49 Q 82.36 26.49 61.41 46.29 Q 17.64 26.49 30.02 22.49 Q 37.64 11.96 50.00 38.00 Q 17.64 73.51 17.66 60.51 Q 10.00 50.00 38.59 46.29 Z" fill="currentColor"/><circle cx="50" cy="50" r="13" fill="#ffffff"/></g></svg>`
  },
  {
    id: "rose_outline",
    name: "Rosa Romântica (Line Art)",
    category: "floral",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🌹",
    defaultStemHeight: 10,
    defaultStemStyle: "botanical_leaves",
    defaultStemLeaves: true,
    description: "Espiral orgânica e pétalas concêntricas elegantes em traço contínuo com haste botânica",
    svg: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">M 50 49 a 5 5 0 0 1 0.00 5.00 a 10 10 0 0 1 -10.00 0.00 a 15 15 0 0 1 -0.00 -15.00 a 20 20 0 0 1 20.00 -0.00 a 25 25 0 0 1 0.00 25.00 a 30 30 0 0 1 -30.00 0.00 a 35 35 0 0 1 -0.00 -35.00 a 40 40 0 0 1 40.00 -0.00</g></svg>`
  },
  {
    id: "lotus_zen",
    name: "Flor de Lótus Sagrada",
    category: "floral",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🪷",
    description: "Lótus meditativa com pétalas simétricas e base suave para leitura e planners",
    svg: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M 50 14 C 45 34 45 62 50 80 C 55 62 55 34 50 14 Z"/><path d="M 44 78 C 34 60 30 40 36 26 C 44 34 48 56 44 78 Z"/><path d="M 56 78 C 66 60 70 40 64 26 C 56 34 52 56 56 78 Z"/><path d="M 40 82 C 24 66 16 44 24 28 C 34 36 38 60 40 82 Z"/><path d="M 60 82 C 76 66 84 44 76 28 C 66 36 62 60 60 82 Z"/></g></svg>`
  },
  {
    id: "daisy_large",
    name: "Margarida Roseta",
    category: "floral",
    sizeCategory: "large",
    defaultTopStyle: "line_art",
    icon: "🌼",
    description: "Margarida floral clássica com múltiplas pétalas e centro vazado",
    svg: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="10"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(0.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(30.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(60.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(90.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(120.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(150.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(180.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(210.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(240.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(270.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(300.0 50 50)"/><path d="M 46 41 C 43 32 42 16 50 8 C 58 16 57 32 54 41 C 52 43 48 43 46 41 Z" transform="rotate(330.0 50 50)"/></g></svg>`
  },
  {
    id: "sunflower_geo",
    name: "Girassol Radiante",
    category: "floral",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🌻",
    description: "Girassol geométrico com raios triangulares e centro circular",
    svg: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="13"/><circle cx="50" cy="50" r="45" stroke-width="3"/><path d="M 50 18 L 54 28 L 50 40 L 46 28 Z" transform="rotate(0 50 50)"/><path d="M 50 18 L 54 28 L 50 40 L 46 28 Z" transform="rotate(45 50 50)"/><path d="M 50 18 L 54 28 L 50 40 L 46 28 Z" transform="rotate(90 50 50)"/><path d="M 50 18 L 54 28 L 50 40 L 46 28 Z" transform="rotate(135 50 50)"/><path d="M 50 18 L 54 28 L 50 40 L 46 28 Z" transform="rotate(180 50 50)"/><path d="M 50 18 L 54 28 L 50 40 L 46 28 Z" transform="rotate(225 50 50)"/><path d="M 50 18 L 54 28 L 50 40 L 46 28 Z" transform="rotate(270 50 50)"/><path d="M 50 18 L 54 28 L 50 40 L 46 28 Z" transform="rotate(315 50 50)"/></g></svg>`
  },
  {
    id: "tulip_delicate",
    name: "Tulipa Minimalista",
    category: "floral",
    sizeCategory: "small",
    defaultTopStyle: "line_art",
    icon: "🌷",
    description: "Cálice de tulipa estilizado com linhas elegantes e fechamento suave",
    svg: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M 50 82 C 32 80 22 62 26 44 C 28 34 34 28 42 30 C 46 31 48 36 50 38 C 52 36 54 31 58 30 C 66 28 72 34 74 44 C 78 62 68 80 50 82 Z"/><path d="M 50 82 C 49 88 49 92 51 96"/><path d="M 50 88 C 42 86 37 90 40 95"/></g></svg>`
  },
  {
    id: "cherry_blossom",
    name: "Cerejeira Sakura",
    category: "floral",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "💮",
    description: "Flor oriental com 5 pétalas chanfradas e centro em estrela",
    svg: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="4"/><circle cx="50" cy="50" r="13" stroke-width="2"/><g><path d="M 46 44 C 41 34 38 24 43 18 C 46 21 48 22 50 22 C 52 22 54 21 57 18 C 62 24 59 34 54 44 C 52 46 48 46 46 44 Z" transform="rotate(0 50 50)"/><path d="M 46 44 C 41 34 38 24 43 18 C 46 21 48 22 50 22 C 52 22 54 21 57 18 C 62 24 59 34 54 44 C 52 46 48 46 46 44 Z" transform="rotate(72 50 50)"/><path d="M 46 44 C 41 34 38 24 43 18 C 46 21 48 22 50 22 C 52 22 54 21 57 18 C 62 24 59 34 54 44 C 52 46 48 46 46 44 Z" transform="rotate(144 50 50)"/><path d="M 46 44 C 41 34 38 24 43 18 C 46 21 48 22 50 22 C 52 22 54 21 57 18 C 62 24 59 34 54 44 C 52 46 48 46 46 44 Z" transform="rotate(216 50 50)"/><path d="M 46 44 C 41 34 38 24 43 18 C 46 21 48 22 50 22 C 52 22 54 21 57 18 C 62 24 59 34 54 44 C 52 46 48 46 46 44 Z" transform="rotate(288 50 50)"/></g></g></svg>`
  },
  {
    id: "leaf_large",
    name: "Folha com Nervuras",
    category: "floral",
    sizeCategory: "large",
    defaultTopStyle: "line_art",
    icon: "🍃",
    description: "Folha botânica estilizada com haste central e nervuras em relevo",
    svg: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M 50 10 C 26 34 24 66 50 90 C 76 66 74 34 50 10 Z"/><path d="M 50 14 C 50 40 50 66 50 86"/><path d="M 50 30 C 40 33 33 38 28 46"/><path d="M 50 30 C 60 33 67 38 72 46"/><path d="M 50 48 C 40 50 34 56 30 62"/><path d="M 50 48 C 60 50 66 56 70 62"/><path d="M 50 66 C 42 67 38 70 35 74"/><path d="M 50 66 C 58 67 62 70 65 74"/></g></svg>`
  },
  {
    id: "botanical_sprig",
    name: "Ramo de Oliveira",
    category: "floral",
    sizeCategory: "large",
    defaultTopStyle: "line_art",
    icon: "🌿",
    description: "Haste com folhinhas emparelhadas em curva graciosa para marcadores",
    svg: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M 28 86 Q 48 52 68 14"/><path d="M 58 22 C 51 24 48 29 52 32 C 57 35 63 30 58 22 Z"/><path d="M 56 36 C 63 34 67 38 64 42 C 59 45 53 41 56 36 Z"/><path d="M 50 48 C 43 48 40 52 43 56 C 48 59 55 54 50 48 Z"/><path d="M 46 60 C 53 57 57 61 54 65 C 49 69 42 64 46 60 Z"/><path d="M 40 72 C 33 71 30 75 33 79 C 38 82 45 77 40 72 Z"/></g></svg>`
  },

  // 2. CORAÇÕES & SÍMBOLOS
  {
    id: "paper_plane_photo",
    name: "Aviãozinho de Papel (da Foto)",
    category: "symbols",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "✈️",
    defaultStemHeight: 8,
    defaultStemStyle: "straight_neck",
    description: "Avião de origami inclinado com dobras vazadas e cabinho de elevação (da foto de referência)",
    svg: `<svg viewBox="0 0 100 100">
      <polygon points="12,50 88,20 52,85 45,55" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
      <line x1="45" y1="55" x2="88" y2="20" stroke="currentColor" stroke-width="5"/>
      <polygon points="45,55 52,85 62,60" fill="none" stroke="currentColor" stroke-width="4"/>
      <line x1="12" y1="50" x2="52" y2="40" stroke="currentColor" stroke-width="4"/>
    </svg>`
  },
  {
    id: "heart_winged_photo",
    name: "Coração com Asinhas (da Foto)",
    category: "symbols",
    sizeCategory: "large",
    defaultTopStyle: "line_art",
    icon: "🪽",
    defaultStemHeight: 6,
    defaultStemStyle: "winged_cushion",
    description: "Coração central ladeado por par de asas estilizadas e haste reforçada (da foto de referência)",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 50 68 C 38 56 32 46 32 38 C 32 30 38 26 44 26 C 47 26 49 28 50 30 C 51 28 53 26 56 26 C 62 26 68 30 68 38 C 68 46 62 56 50 68 Z" fill="currentColor"/>
      <path d="M 32 36 C 22 24 10 28 8 36 C 6 44 18 52 30 52" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <path d="M 28 42 C 16 38 12 48 20 54" fill="none" stroke="currentColor" stroke-width="4"/>
      <path d="M 68 36 C 78 24 90 28 92 36 C 94 44 82 52 70 52" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <path d="M 72 42 C 84 38 88 48 80 54" fill="none" stroke="currentColor" stroke-width="4"/>
    </svg>`
  },
  {
    id: "heart_angled_red",
    name: "Coração na Ponta (Glitter)",
    category: "symbols",
    sizeCategory: "small",
    defaultTopStyle: "solid_embossed",
    icon: "💖",
    description: "Coração abaulado com inclinação charmosa na ponta do clipe (estilo foto vermelha)",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 50 85 C 22 62 10 44 10 28 C 10 14 22 8 35 8 C 44 8 48 14 50 18 C 52 14 56 8 65 8 C 78 8 90 14 90 28 C 90 44 78 62 50 85 Z" fill="currentColor"/>
    </svg>`
  },
  {
    id: "heart_interlocking",
    name: "Corações Entrelaçados",
    category: "symbols",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "💕",
    description: "Dois corações harmoniosamente fundidos em traço contínuo vazado",
    svg: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M 28 82 C 20 70 12 60 12 26 C 12 14 20 18 20 18 C 20 18 24 22 28 38 C 40 22 44 18 44 18 C 44 18 52 14 56 26 C 56 60 36 70 28 82 Z"/><path d="M 68 82 C 60 70 44 60 44 26 C 44 14 52 18 52 18 C 52 18 56 22 68 38 C 72 22 76 18 76 18 C 76 18 84 14 88 26 C 88 60 76 70 68 82 Z"/></g></svg>`
  },
  {
    id: "heart_origami",
    name: "Coração Origami / Facetado",
    category: "symbols",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "💎",
    description: "Coração geométrico moderno com facetas triangulares estilo 3D low-poly",
    svg: `<svg viewBox="0 0 100 100">
      <polygon points="50,88 20,55 15,30 35,15 50,30 65,15 85,30 80,55" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
      <line x1="50" y1="30" x2="50" y2="88" stroke="currentColor" stroke-width="4"/>
      <line x1="35" y1="15" x2="50" y2="52" stroke="currentColor" stroke-width="4"/>
      <line x1="65" y1="15" x2="50" y2="52" stroke="currentColor" stroke-width="4"/>
      <line x1="15" y1="30" x2="50" y2="52" stroke="currentColor" stroke-width="4"/>
      <line x1="85" y1="30" x2="50" y2="52" stroke="currentColor" stroke-width="4"/>
      <line x1="20" y1="55" x2="50" y2="52" stroke="currentColor" stroke-width="4"/>
      <line x1="80" y1="55" x2="50" y2="52" stroke="currentColor" stroke-width="4"/>
    </svg>`
  },
  {
    id: "heart_infinity",
    name: "Coração Infinito",
    category: "symbols",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "♾️",
    description: "Símbolo do infinito com o topo entrelaçado em formato de coração",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 50 65 C 32 80 12 75 12 50 C 12 25 35 25 50 50 C 65 25 88 25 88 50 C 88 75 68 80 50 65 Z" fill="none" stroke="currentColor" stroke-width="7"/>
      <path d="M 50 35 C 42 20 28 15 22 28" fill="none" stroke="currentColor" stroke-width="5"/>
      <path d="M 50 35 C 58 20 72 15 78 28" fill="none" stroke="currentColor" stroke-width="5"/>
    </svg>`
  },
  {
    id: "heart_mini",
    name: "Coração Delicado",
    category: "symbols",
    sizeCategory: "small",
    defaultTopStyle: "solid_embossed",
    icon: "❤️",
    description: "Coração romântico com acabamento suave e abaulado",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 50 82 C 20 60 10 42 10 28 C 10 15 22 10 34 10 C 43 10 48 16 50 20 C 52 16 57 10 66 10 C 78 10 90 15 90 28 C 90 42 80 60 50 82 Z" fill="currentColor"/>
      <circle cx="42" cy="26" r="4" fill="#ffffff"/>
    </svg>`
  },
  {
    id: "heart_line",
    name: "Coração Line Art",
    category: "symbols",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🤍",
    description: "Coração vazado minimalista com arame contínuo",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 50 80 C 22 58 12 40 12 28 C 12 16 22 10 34 10 C 43 10 48 16 50 20 C 52 16 57 10 66 10 C 78 10 88 16 88 28 C 88 40 78 58 50 80 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: "star_celestial",
    name: "Estrela Celestial 8 Pontas",
    category: "symbols",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "✨",
    description: "Estrela estelar mística com pontas longas e diamantes intercalados",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 50 8 L 56 38 L 86 44 L 56 50 L 50 80 L 44 50 L 14 44 L 44 38 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
      <path d="M 28 22 L 40 34 M 60 34 L 72 22 M 28 66 L 40 54 M 60 54 L 72 66" stroke="currentColor" stroke-width="4"/>
      <circle cx="50" cy="44" r="5" fill="none" stroke="currentColor" stroke-width="3"/>
    </svg>`
  },
  {
    id: "moon_star",
    name: "Lua Crescente & Estrela",
    category: "symbols",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🌙",
    description: "Lua mística vazada abrigando uma pequena estrela de 4 pontas",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 65 15 C 35 18 20 45 32 75 C 44 95 75 92 82 80 C 55 82 38 60 48 35 C 52 25 60 18 65 15 Z" fill="none" stroke="currentColor" stroke-width="6"/>
      <polygon points="68,36 72,46 82,50 72,54 68,64 64,54 54,50 64,46" fill="none" stroke="currentColor" stroke-width="4"/>
    </svg>`
  },
  {
    id: "star_line",
    name: "Estrela Line Art Clássica",
    category: "symbols",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🌟",
    description: "Estrela vazada com linha contínua em formato geométrico limpo",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 50 12 L 61 38 L 89 38 L 66 54 L 75 80 L 50 64 L 25 80 L 34 54 L 11 38 L 39 38 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: "star_mini",
    name: "Estrelinha Brilhante",
    category: "symbols",
    sizeCategory: "small",
    defaultTopStyle: "solid_embossed",
    icon: "⭐",
    description: "Estrela clássica de 5 pontas suavemente arredondadas",
    svg: `<svg viewBox="0 0 100 100">
      <polygon points="50,10 62,38 92,38 67,56 77,85 50,67 23,85 33,56 8,38 38,38" fill="currentColor"/>
    </svg>`
  },
  {
    id: "airplane_line",
    name: "Avião de Papel",
    category: "symbols",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "✈️",
    description: "Aviãozinho de origami estilizado vazado para viagens e estudos",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 15 45 L 85 15 L 50 85 L 42 55 Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
      <path d="M 42 55 L 85 15" fill="none" stroke="currentColor" stroke-width="6"/>
      <path d="M 42 55 L 48 72 L 56 63" fill="none" stroke="currentColor" stroke-width="5"/>
    </svg>`
  },

  // 3. FORMAS GEOMÉTRICAS & MANDALAS
  {
    id: "hexagon_mandala",
    name: "Hexágono Mandala Sagrada",
    category: "geometric",
    sizeCategory: "large",
    defaultTopStyle: "line_art",
    icon: "🔷",
    description: "Geometria sagrada hexagonal com triângulos cruzados e anéis concêntricos",
    svg: `<svg viewBox="0 0 100 100">
      <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="none" stroke="currentColor" stroke-width="5"/>
      <polygon points="50,22 75,37 75,63 50,78 25,63 25,37" fill="none" stroke="currentColor" stroke-width="4"/>
      <circle cx="50" cy="50" r="14" fill="none" stroke="currentColor" stroke-width="4"/>
      <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" stroke-width="3"/>
      <line x1="15" y1="30" x2="85" y2="70" stroke="currentColor" stroke-width="3"/>
      <line x1="15" y1="70" x2="85" y2="30" stroke="currentColor" stroke-width="3"/>
    </svg>`
  },
  {
    id: "diamond_faceted",
    name: "Diamante Lapidado 3D",
    category: "geometric",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "💠",
    description: "Lapidação de joia com mesa plana, facetas e ápice pontiagudo",
    svg: `<svg viewBox="0 0 100 100">
      <polygon points="30,20 70,20 90,45 50,85 10,45" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
      <line x1="10" y1="45" x2="90" y2="45" stroke="currentColor" stroke-width="5"/>
      <line x1="30" y1="20" x2="40" y2="45" stroke="currentColor" stroke-width="4"/>
      <line x1="70" y1="20" x2="60" y2="45" stroke="currentColor" stroke-width="4"/>
      <line x1="40" y1="45" x2="50" y2="85" stroke="currentColor" stroke-width="4"/>
      <line x1="60" y1="45" x2="50" y2="85" stroke="currentColor" stroke-width="4"/>
      <line x1="30" y1="20" x2="50" y2="45" stroke="currentColor" stroke-width="4"/>
      <line x1="70" y1="20" x2="50" y2="45" stroke="currentColor" stroke-width="4"/>
    </svg>`
  },
  {
    id: "spiral_fibonacci",
    name: "Espiral Áurea / Fibonacci",
    category: "geometric",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🌀",
    description: "Proporção áurea matemática em curva espiral fluida e contínua",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 50 50 A 4 4 0 0 1 54 54 A 8 8 0 0 1 46 62 A 16 16 0 0 1 38 46 A 26 26 0 0 1 64 36 A 40 40 0 0 1 82 72 A 56 56 0 0 1 30 86" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: "triangle_triquetra",
    name: "Triângulos da Trindade",
    category: "geometric",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🔺",
    description: "Triquetra celta com arcos entrelaçados e nó infinito",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 50 15 C 65 35 75 60 75 75 C 60 75 35 65 15 50 C 35 35 60 25 75 25 C 75 40 65 65 50 85 C 35 65 25 40 25 25 Z" fill="none" stroke="currentColor" stroke-width="6"/>
      <circle cx="50" cy="52" r="24" fill="none" stroke="currentColor" stroke-width="5"/>
    </svg>`
  },
  {
    id: "circle_artdeco",
    name: "Círculos Art Déco",
    category: "geometric",
    sizeCategory: "large",
    defaultTopStyle: "line_art",
    icon: "🎯",
    description: "Padrão de arcos concêntricos e linhas radiais da era moderna dos anos 20",
    svg: `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="5"/>
      <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" stroke-width="4"/>
      <circle cx="50" cy="50" r="14" fill="none" stroke="currentColor" stroke-width="4"/>
      <line x1="50" y1="8" x2="50" y2="92" stroke="currentColor" stroke-width="4"/>
      <line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" stroke-width="4"/>
      <polygon points="50,22 78,50 50,78 22,50" fill="none" stroke="currentColor" stroke-width="3"/>
    </svg>`
  },
  {
    id: "cube_isometric",
    name: "Cubo Isométrico 3D",
    category: "geometric",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🧊",
    description: "Cubo tridimensional em perspectiva isométrica com vértices conectados",
    svg: `<svg viewBox="0 0 100 100">
      <polygon points="50,15 85,35 85,75 50,95 15,75 15,35" fill="none" stroke="currentColor" stroke-width="6"/>
      <line x1="50" y1="55" x2="50" y2="95" stroke="currentColor" stroke-width="5"/>
      <line x1="50" y1="55" x2="85" y2="35" stroke="currentColor" stroke-width="5"/>
      <line x1="50" y1="55" x2="15" y2="35" stroke="currentColor" stroke-width="5"/>
      <circle cx="50" cy="55" r="4" fill="currentColor"/>
    </svg>`
  },
  {
    id: "compass_rose",
    name: "Rosa dos Ventos",
    category: "geometric",
    sizeCategory: "large",
    defaultTopStyle: "line_art",
    icon: "🧭",
    description: "Bússola náutica geométrica com 4 pontos cardeais em relevo",
    svg: `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="5"/>
      <polygon points="50,12 58,42 50,46" fill="currentColor"/>
      <polygon points="50,12 42,42 50,46" fill="none" stroke="currentColor" stroke-width="2"/>
      <polygon points="50,88 58,58 50,54" fill="none" stroke="currentColor" stroke-width="2"/>
      <polygon points="50,88 42,58 50,54" fill="currentColor"/>
      <polygon points="88,50 58,42 54,50" fill="currentColor"/>
      <polygon points="88,50 58,58 54,50" fill="none" stroke="currentColor" stroke-width="2"/>
      <polygon points="12,50 42,42 46,50" fill="none" stroke="currentColor" stroke-width="2"/>
      <polygon points="12,50 42,58 46,50" fill="currentColor"/>
    </svg>`
  },

  // 4. FOFOS & PETS
  {
    id: "cloud_mushroom_photo",
    name: "Nuvem / Cogumelo (da Foto)",
    category: "cute",
    sizeCategory: "small",
    defaultTopStyle: "line_art",
    icon: "☁️",
    defaultStemHeight: 6,
    defaultStemStyle: "straight_neck",
    description: "Silhueta arredondada suave com cabinho de encaixe (da foto de referência)",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 25 65 C 16 65 12 55 18 46 C 16 38 24 28 34 30 C 40 20 60 20 66 30 C 76 28 84 38 82 46 C 88 55 84 65 75 65 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="36" cy="48" r="4" fill="currentColor"/>
      <circle cx="64" cy="48" r="4" fill="currentColor"/>
      <path d="M 45 54 Q 50 58 55 54" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: "butterfly_line",
    name: "Borboleta Line Art",
    category: "cute",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "🦋",
    description: "Asas de borboleta fluidas em traço contínuo moderno",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 50 35 C 40 15 15 15 15 40 C 15 60 45 65 50 82 C 55 65 85 60 85 40 C 85 15 60 15 50 35 Z" fill="none" stroke="currentColor" stroke-width="7"/>
      <path d="M 50 50 C 35 55 25 70 35 82 C 45 88 48 75 50 82 C 52 75 55 88 65 82 C 75 70 65 55 50 50 Z" fill="none" stroke="currentColor" stroke-width="6"/>
    </svg>`
  },
  {
    id: "cat_silhouette",
    name: "Gatinho Kawaii",
    category: "cute",
    sizeCategory: "small",
    defaultTopStyle: "line_art",
    icon: "🐱",
    description: "Silhueta com orelhas pontudas, nariz e bigodinhos delicados",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 25 75 C 18 65 18 45 22 35 L 30 18 L 42 28 C 46 26 54 26 58 28 L 70 18 L 78 35 C 82 45 82 65 75 75 C 65 85 35 85 25 75 Z" fill="none" stroke="currentColor" stroke-width="6"/>
      <line x1="20" y1="52" x2="38" y2="54" stroke="currentColor" stroke-width="4"/>
      <line x1="18" y1="62" x2="36" y2="60" stroke="currentColor" stroke-width="4"/>
      <line x1="80" y1="52" x2="62" y2="54" stroke="currentColor" stroke-width="4"/>
      <line x1="82" y1="62" x2="64" y2="60" stroke="currentColor" stroke-width="4"/>
      <polygon points="50,56 46,50 54,50" fill="currentColor"/>
    </svg>`
  },
  {
    id: "paw_print",
    name: "Patinha Pet",
    category: "cute",
    sizeCategory: "small",
    defaultTopStyle: "solid_embossed",
    icon: "🐾",
    description: "Almofada plantar e 4 dedinhos fofos em alto relevo",
    svg: `<svg viewBox="0 0 100 100">
      <ellipse cx="50" cy="65" rx="20" ry="16" fill="currentColor"/>
      <circle cx="28" cy="42" r="8" fill="currentColor"/>
      <circle cx="42" cy="30" r="9" fill="currentColor"/>
      <circle cx="58" cy="30" r="9" fill="currentColor"/>
      <circle cx="72" cy="42" r="8" fill="currentColor"/>
    </svg>`
  },
  {
    id: "cloud_mini",
    name: "Nuvem Fofa",
    category: "cute",
    sizeCategory: "small",
    defaultTopStyle: "solid_embossed",
    icon: "☁️",
    description: "Nuvens arredondadas kawaii para organização de cadernos",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 28 65 C 18 65 12 56 16 46 C 18 36 28 35 34 37 C 38 25 54 22 62 30 C 68 25 80 28 82 38 C 88 42 88 54 82 60 C 78 65 72 65 28 65 Z" fill="currentColor"/>
    </svg>`
  },
  {
    id: "hand_line",
    name: "Mãozinha High-Five",
    category: "symbols",
    sizeCategory: "medium",
    defaultTopStyle: "line_art",
    icon: "✋",
    description: "Mão acenando em contorno elegante vazado para lembretes e tarefas",
    svg: `<svg viewBox="0 0 100 100">
      <path d="M 32 78 L 32 50 C 32 45 25 45 25 50 L 25 40 C 25 35 18 35 18 40 L 18 44 C 18 38 12 38 12 44 L 12 60 C 12 75 25 88 45 88 C 65 88 78 78 78 62 L 78 35 C 78 28 70 28 70 35 L 70 30 C 70 24 62 24 62 30 L 62 25 C 62 18 54 18 54 25 L 54 22 C 54 15 46 15 46 22 L 46 55 L 40 55 C 36 55 32 60 32 78 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
    </svg>`
  },

  // 5. GIGANTES (Marcadores de Bíblia & Livros)
  {
    id: "winged_heart_giant",
    name: "Coração com Asas de Anjo",
    category: "giant",
    sizeCategory: "giant",
    defaultTopStyle: "line_art",
    icon: "🪽",
    description: "Clipe Gigante com asas angelicais detalhadas e coração central",
    svg: `<svg viewBox="0 0 100 100">
      <!-- Center Heart -->
      <path d="M 50 62 C 40 50 35 40 35 32 C 35 24 41 20 48 20 C 50 20 50 22 50 22 C 50 22 50 20 52 20 C 59 20 65 24 65 32 C 65 40 60 50 50 62 Z" fill="currentColor"/>
      <!-- Left Wing Feathers -->
      <path d="M 36 28 C 20 10 5 22 6 36 C 8 46 22 50 35 48" fill="none" stroke="currentColor" stroke-width="5"/>
      <path d="M 30 38 C 15 32 8 45 12 55 C 16 62 28 58 35 52" fill="none" stroke="currentColor" stroke-width="4"/>
      <!-- Right Wing Feathers -->
      <path d="M 64 28 C 80 10 95 22 94 36 C 92 46 78 50 65 48" fill="none" stroke="currentColor" stroke-width="5"/>
      <path d="M 70 38 C 85 32 92 45 88 55 C 84 62 72 58 65 52" fill="none" stroke="currentColor" stroke-width="4"/>
    </svg>`
  },
  {
    id: "bow_ribbon",
    name: "Laço de Fita Coquette",
    category: "giant",
    sizeCategory: "giant",
    defaultTopStyle: "line_art",
    icon: "🎀",
    description: "Laço de fita gracioso para agendas, planners e cadernos de estudos",
    svg: `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="45" r="8" fill="currentColor"/>
      <path d="M 44 45 C 20 20 10 40 25 55 C 38 60 45 48 45 45 Z" fill="none" stroke="currentColor" stroke-width="6"/>
      <path d="M 56 45 C 80 20 90 40 75 55 C 62 60 55 48 55 45 Z" fill="none" stroke="currentColor" stroke-width="6"/>
      <path d="M 45 52 L 30 85 L 42 75 L 48 85 Z" fill="none" stroke="currentColor" stroke-width="5"/>
      <path d="M 55 52 L 70 85 L 58 75 L 52 85 Z" fill="none" stroke="currentColor" stroke-width="5"/>
    </svg>`
  }
];

// --- 3D UTILS: Miter Offset for Vector Curves ---
function getOffsetPoints(points: THREE.Vector2[], offset: number): THREE.Vector2[] {
  const result: THREE.Vector2[] = [];
  const n = points.length;
  if (n < 3) return points.map(p => p.clone());

  let cleanPoints = [...points];
  if (cleanPoints[0].distanceTo(cleanPoints[cleanPoints.length - 1]) < 0.001) {
    cleanPoints.pop();
  }
  const m = cleanPoints.length;

  for (let i = 0; i < m; i++) {
    const prev = cleanPoints[(i - 1 + m) % m];
    const curr = cleanPoints[i];
    const next = cleanPoints[(i + 1) % m];

    const dir1 = new THREE.Vector2().subVectors(curr, prev).normalize();
    const dir2 = new THREE.Vector2().subVectors(next, curr).normalize();

    const norm1 = new THREE.Vector2(-dir1.y, dir1.x);
    const norm2 = new THREE.Vector2(-dir2.y, dir2.x);
    const bisectorNorm = new THREE.Vector2().addVectors(norm1, norm2).normalize();

    const cosHalfTheta = norm1.dot(bisectorNorm);
    let scale = 1.0;
    if (cosHalfTheta > 0.1) scale = 1.0 / cosHalfTheta;
    scale = Math.min(scale, 2.5);

    const offsetPt = new THREE.Vector2().copy(curr).addScaledVector(bisectorNorm, offset * scale);
    result.push(offsetPt);
  }

  if (result.length > 0) result.push(result[0].clone());
  return result;
}

function createRibbonShapeFromPoints(points: THREE.Vector2[], thickness: number, isClosed: boolean): THREE.Shape {
  const shape = new THREE.Shape();
  const n = points.length;
  if (n < 2) return shape;

  if (isClosed) {
    const outer = getOffsetPoints(points, thickness / 2);
    const inner = getOffsetPoints(points, -thickness / 2);
    
    shape.moveTo(outer[0].x, outer[0].y);
    for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].y);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(inner[0].x, inner[0].y);
    for (let i = 1; i < inner.length; i++) hole.lineTo(inner[i].x, inner[i].y);
    hole.closePath();
    shape.holes.push(hole);
  } else {
    const forward: THREE.Vector2[] = [];
    const backward: THREE.Vector2[] = [];

    for (let i = 0; i < n; i++) {
      let tangent = new THREE.Vector2();
      if (i === 0) {
        tangent.subVectors(points[1], points[0]).normalize();
      } else if (i === n - 1) {
        tangent.subVectors(points[n - 1], points[n - 2]).normalize();
      } else {
        const t1 = new THREE.Vector2().subVectors(points[i], points[i - 1]).normalize();
        const t2 = new THREE.Vector2().subVectors(points[i + 1], points[i]).normalize();
        tangent.addVectors(t1, t2).normalize();
      }

      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      forward.push(new THREE.Vector2().copy(points[i]).addScaledVector(normal, thickness / 2));
      backward.unshift(new THREE.Vector2().copy(points[i]).addScaledVector(normal, -thickness / 2));
    }

    const combined = [...forward, ...backward];
    shape.moveTo(combined[0].x, combined[0].y);
    for (let i = 1; i < combined.length; i++) {
      shape.lineTo(combined[i].x, combined[i].y);
    }
    shape.closePath();
  }
  return shape;
}

// --- GENERATE STEM / CABINHO GEOMETRY ---
function createStemGeometry(config: ClipConfig): THREE.BufferGeometry | null {
  const { 
    stemHeight, 
    stemWidth, 
    stemStyle, 
    stemLeaves, 
    stemLeafSize, 
    wireDepth, 
    wireThickness, 
    bodyStyle,
    clipWidth,
    topDiameter,
    stemCalyxWidth = 6.5
  } = config;
  const sc = 0.1;
  const S = (stemHeight || 0) * sc;
  const H = (wireDepth || 1.8) * sc;
  const T = (stemWidth || wireThickness || 2.2) * sc;
  const W = (clipWidth || 14) * sc;
  const calyxW = (stemCalyxWidth || 6.5) * sc;

  if (S <= 0.05) {
    if (stemStyle === "none_flush") return null;
    // Flush Mount: Organic Arched Saddle (Apoio Arredondado Abaulado)
    const rSaddle = Math.max(T * 1.3, (topDiameter * sc) * 0.22);
    const saddle = new THREE.Shape();
    saddle.moveTo(-rSaddle, -0.05);
    saddle.bezierCurveTo(-rSaddle * 0.6, 0.08, -T * 0.4, 0.14, 0, 0.14);
    saddle.bezierCurveTo(T * 0.4, 0.14, rSaddle * 0.6, 0.08, rSaddle, -0.05);
    saddle.bezierCurveTo(rSaddle * 0.4, -0.02, -rSaddle * 0.4, -0.02, -rSaddle, -0.05);
    saddle.closePath();
    return new THREE.ExtrudeGeometry(saddle, { 
      depth: H, 
      bevelEnabled: true, 
      bevelThickness: 0.025, 
      bevelSize: 0.02,
      bevelSegments: 3 
    });
  }

  const shapes: THREE.Shape[] = [];

  const rMid = T / 2;
  const rTop = Math.max(rMid * 1.4, calyxW / 2);
  const rBot = Math.min(W * 0.38, Math.max(rMid * 1.6, T * 1.3));

  if (stemStyle === "dual_bridge") {
    // Arched Double Pillar Bridge with rounded vault cradle
    const pillarDist = W * 0.26;
    const pW = T * 0.75;
    
    // Left Pillar
    const leftP = new THREE.Shape();
    leftP.moveTo(-pillarDist - pW, -0.05);
    leftP.bezierCurveTo(-pillarDist - pW * 0.7, S * 0.2, -pillarDist - pW/2, S * 0.5, -pillarDist - pW/2, S + 0.05);
    leftP.lineTo(-pillarDist + pW/2, S + 0.05);
    leftP.bezierCurveTo(-pillarDist + pW/2, S * 0.5, -pillarDist, S * 0.2, -pillarDist, -0.05);
    leftP.closePath();
    shapes.push(leftP);

    // Right Pillar
    const rightP = new THREE.Shape();
    rightP.moveTo(pillarDist, -0.05);
    rightP.bezierCurveTo(pillarDist, S * 0.2, pillarDist - pW/2, S * 0.5, pillarDist - pW/2, S + 0.05);
    rightP.lineTo(pillarDist + pW/2, S + 0.05);
    rightP.bezierCurveTo(pillarDist + pW/2, S * 0.5, pillarDist + pW, S * 0.2, pillarDist + pW, -0.05);
    rightP.closePath();
    shapes.push(rightP);

    // Rounded Top Arched Vault Cradle (cradles the emblem)
    const vault = new THREE.Shape();
    vault.moveTo(-pillarDist - pW, S + 0.02);
    vault.bezierCurveTo(-pillarDist * 0.5, S + 0.15, pillarDist * 0.5, S + 0.15, pillarDist + pW, S + 0.02);
    vault.lineTo(pillarDist + pW * 0.5, S - 0.06);
    vault.bezierCurveTo(pillarDist * 0.3, S + 0.05, -pillarDist * 0.3, S + 0.05, -pillarDist - pW * 0.5, S - 0.06);
    vault.closePath();
    shapes.push(vault);

    // Mid cross bridge
    const cross = new THREE.Shape();
    cross.moveTo(-pillarDist, S * 0.45);
    cross.bezierCurveTo(-pillarDist * 0.5, S * 0.48, pillarDist * 0.5, S * 0.48, pillarDist, S * 0.45);
    cross.lineTo(pillarDist, S * 0.55);
    cross.bezierCurveTo(pillarDist * 0.5, S * 0.58, -pillarDist * 0.5, S * 0.58, -pillarDist, S * 0.55);
    cross.closePath();
    shapes.push(cross);
  } else if (stemStyle === "winged_cushion") {
    // Pedestal Cushion with broad floral petals / wings
    const wingW = Math.max(W * 0.45, rTop * 1.5);
    const cushion = new THREE.Shape();
    cushion.moveTo(-wingW, S + 0.05);
    cushion.bezierCurveTo(-wingW * 0.7, S * 0.6, -rMid * 1.6, S * 0.35, -rBot, -0.05);
    cushion.lineTo(rBot, -0.05);
    cushion.bezierCurveTo(rMid * 1.6, S * 0.35, wingW * 0.7, S * 0.6, wingW, S + 0.05);
    cushion.bezierCurveTo(wingW * 0.5, S + 0.14, -wingW * 0.5, S + 0.14, -wingW, S + 0.05);
    cushion.closePath();
    shapes.push(cushion);
  } else if (stemStyle === "straight_neck") {
    // Pescoço Reto: same diameter & cross-section shape as the clip wire segment,
    // reaching up flush to the emblem bottom edge so it never pokes into the figure
    const emblemBottom = ((stemHeight || 0) + (config.topOffsetY || 0) - (config.topOverlap || 0) - (config.topDiameter || 0) * 0.15) * sc;
    const neckH = Math.max(0.06, Math.min(S, emblemBottom));
    const rNeck = (wireThickness || 2.0) * sc / 2;
    const neckShape = new THREE.Shape();
    if (bodyStyle === "rounded_wire") {
      neckShape.absarc(0, rNeck, rNeck, 0, Math.PI * 2, false);
    } else {
      neckShape.moveTo(-rNeck, -0.05);
      neckShape.lineTo(-rNeck, neckH + 0.05);
      neckShape.lineTo(rNeck, neckH + 0.05);
      neckShape.lineTo(rNeck, -0.05);
      neckShape.closePath();
    }
    const neckDepth = bodyStyle === "rounded_wire" ? wireThickness * sc : H;
    return new THREE.ExtrudeGeometry(neckShape, {
      depth: neckDepth,
      bevelEnabled: config.topBevel !== false,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2
    });
  } else {
    // Botanical: Organic Trumpet & Floral Calyx (Cálice Floral Arredondado)
    const mainStem = new THREE.Shape();
    
    // 1. Start at bottom-left flared foot (blends into clip top)
    mainStem.moveTo(-rBot, -0.05);

    // 2. Smooth curved waist transition up to stem mid-body
    mainStem.bezierCurveTo(
      -rBot * 0.7, S * 0.18,
      -rMid * 1.1, S * 0.32,
      -rMid, S * 0.5
    );

    // 3. Flared Calyx / Receptáculo: curves outward smoothly to cradle the decoration
    mainStem.bezierCurveTo(
      -rMid, S * 0.75,
      -rTop * 0.85, S * 0.9,
      -rTop, S + 0.05
    );

    // 4. Rounded convex top dome / cradle (hugs the circular contour of the emblem)
    mainStem.bezierCurveTo(
      -rTop * 0.45, S + 0.14,
      rTop * 0.45, S + 0.14,
      rTop, S + 0.05
    );

    // 5. Right side Calyx curves smoothly down to mid-waist
    mainStem.bezierCurveTo(
      rTop * 0.85, S * 0.9,
      rMid, S * 0.75,
      rMid, S * 0.5
    );

    // 6. Right side waist curves down into right flared foot
    mainStem.bezierCurveTo(
      rMid * 1.1, S * 0.32,
      rBot * 0.7, S * 0.18,
      rBot, -0.05
    );

    // 7. Base saddle closing arc
    mainStem.bezierCurveTo(
      rBot * 0.35, -0.02,
      -rBot * 0.35, -0.02,
      -rBot, -0.05
    );
    mainStem.closePath();
    shapes.push(mainStem);

    // Add botanical leaves if botanical_leaves or stemLeaves is true
    if (stemStyle === "botanical_leaves" || stemLeaves) {
      const leafL = (stemLeafSize || 6.0) * sc;
      const leafW = leafL * 0.52;
      const leafY = S * 0.42;

      // Left Leaf: organic curved droplet
      const leftLeaf = new THREE.Shape();
      leftLeaf.moveTo(0, leafY);
      leftLeaf.bezierCurveTo(-leafL * 0.4, leafY - leafW * 0.35, -leafL * 0.95, leafY + leafW * 0.35, -leafL, leafY + leafL * 0.5);
      leftLeaf.bezierCurveTo(-leafL * 0.7, leafY + leafL * 0.75, -leafL * 0.2, leafY + leafW * 0.85, 0, leafY + leafW * 0.5);
      leftLeaf.closePath();
      shapes.push(leftLeaf);

      // Right Leaf: organic curved droplet
      const rightLeaf = new THREE.Shape();
      rightLeaf.moveTo(0, leafY);
      rightLeaf.bezierCurveTo(leafL * 0.4, leafY - leafW * 0.35, leafL * 0.95, leafY + leafW * 0.35, leafL, leafY + leafL * 0.5);
      rightLeaf.bezierCurveTo(leafL * 0.7, leafY + leafL * 0.75, leafL * 0.2, leafY + leafW * 0.85, 0, leafY + leafW * 0.5);
      rightLeaf.closePath();
      shapes.push(rightLeaf);
    }
  }

  const geoms = shapes.map(sh => new THREE.ExtrudeGeometry(sh, {
    depth: H,
    bevelEnabled: config.topBevel !== false,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 3
  }));

  if (geoms.length === 1) return geoms[0];
  return BufferGeometryUtils.mergeGeometries(geoms);
}

// --- GENERATE PAPERCLIP BODY GEOMETRY ---
// Continuous open wire path for the classic trombone-style paperclip
function buildClassicWirePath(config: ClipConfig): THREE.Vector2[] {
  const { clipLength, clipWidth, wireThickness, loopGap } = config;
  const sc = 0.1; // 1 unit = 10mm in Three.js coordinate system

  const W = clipWidth * sc;
  const L = clipLength * sc;
  const T = wireThickness * sc;
  const gap = (loopGap || 2.2) * sc;

  const r1 = W / 2; // Outer bottom radius
  const r2 = Math.max(0.12, (W - gap - T) / 2); // Top loop radius
  const r3 = Math.max(0.16, (T + gap) / 2); // Inner bottom radius (open, roomy turn)
  // Top-left fillet radius: large sweeping rounded shoulder that "descends" into the
  // left spine smoothly — sized close to the right-side loop (r2) for visual symmetry
  const rc = Math.min(Math.max(r1 * 0.62, r2 * 0.85, T * 1.4), r1 * 0.72);

  const pts: THREE.Vector2[] = [];
  const segs = 16;

  const topY = 0;
  const botY = -L;

  // Append a circular arc in segs steps (tangent-continuous with the surrounding segments)
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    for (let i = 0; i <= segs; i++) {
      const angle = a0 + (i / segs) * (a1 - a0);
      pts.push(new THREE.Vector2(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r));
    }
  };

  // Top bar: connects the center stem base out to the left edge
  pts.push(new THREE.Vector2(0, topY));
  pts.push(new THREE.Vector2(-r1 + rc, topY));

  // Rounded top-left corner (fillet between the top bar and the left spine)
  arc(-r1 + rc, -rc, rc, Math.PI / 2, Math.PI);

  // Outer left spine
  pts.push(new THREE.Vector2(-r1, botY + r1));

  // Outer bottom U-turn
  arc(0, botY + r1, r1, Math.PI, Math.PI * 2);

  // Outer right spine (stops below topY to leave open space)
  pts.push(new THREE.Vector2(r1, topY - r2));

  // Top loop U-turn
  const topCenter = new THREE.Vector2(r1 - r2, topY - r2);
  arc(topCenter.x, topCenter.y, r2, 0, Math.PI);

  // Middle spine going down
  const midX = topCenter.x - r2;
  pts.push(new THREE.Vector2(midX, botY + r1 + r3 * 2));

  // Inner bottom U-turn (generous radius so the loop never pinches)
  const botInnerCenter = new THREE.Vector2(midX + r3, botY + r1 + r3 * 2);
  arc(botInnerCenter.x, botInnerCenter.y, r3, Math.PI, Math.PI * 2);

  // Inner spine going up - terminates freely in space with open tip at 35% height!
  const innerX = botInnerCenter.x + r3;
  pts.push(new THREE.Vector2(innerX, topY - r2 - (L * 0.35)));

  return pts;
}

// Circular arc wire segment (a0 -> a1, CCW in the x/y plane with y up). Combined
// with LineCurve3 segments the classic paperclip path becomes a C1-continuous
// piecewise curve, so the tube is perfectly straight on the spines and perfectly
// circular on the loops (no CatmullRom bowing / burrs on straight runs).
class ArcCurve3 extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly center: THREE.Vector3,
    private readonly radius: number,
    private readonly a0: number,
    private readonly a1: number
  ) {
    super();
  }
  getPoint(t: number, optionalTarget: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    const a = this.a0 + (this.a1 - this.a0) * t;
    return optionalTarget.set(
      this.center.x + Math.cos(a) * this.radius,
      this.center.y + Math.sin(a) * this.radius,
      this.center.z
    );
  }
}

// Rounded wire: extrudes the classic path as a real circular cross-section tube
function createRoundedWireGeometry(config: ClipConfig): THREE.BufferGeometry {
  const { wireThickness, clipLength, clipWidth, loopGap } = config;
  const sc = 0.1;

  const W = clipWidth * sc;
  const L = clipLength * sc;
  const T = wireThickness * sc;
  const gap = (loopGap || 2.2) * sc;
  const radius = T / 2;

  const r1 = W / 2;
  const r2 = Math.max(0.12, (W - gap - T) / 2);
  const r3 = Math.max(0.16, (T + gap) / 2);
  const rc = Math.min(Math.max(r1 * 0.62, r2 * 0.85, T * 1.4), r1 * 0.72);

  const topY = 0;
  const botY = -L;
  const midX = r1 - r2 * 2;
  const innerX = midX + r3 * 2;
  const bottomY = botY + r1 + r3 * 2;
  const tipY = topY - r2 - L * 0.35;

  const V3 = (x: number, y: number) => new THREE.Vector3(x, y, 0);
  const path = new THREE.CurvePath<THREE.Vector3>();
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    path.add(new THREE.LineCurve3(V3(x1, y1), V3(x2, y2)));
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) =>
    path.add(new ArcCurve3(V3(cx, cy), r, a0, a1));

  // Top bar: center stem base out to the left fillet start
  line(0, topY, -r1 + rc, topY);
  // Rounded top-left corner (fillet)
  arc(-r1 + rc, -rc, rc, Math.PI / 2, Math.PI);
  // Outer left spine
  line(-r1, -rc, -r1, botY + r1);
  // Outer bottom U-turn
  arc(0, botY + r1, r1, Math.PI, Math.PI * 2);
  // Outer right spine (stops below topY to leave open space)
  line(r1, botY + r1, r1, topY - r2);
  // Top loop U-turn
  arc(r1 - r2, topY - r2, r2, 0, Math.PI);
  // Middle spine going down
  line(midX, topY - r2, midX, bottomY);
  // Inner bottom U-turn
  arc(midX + r3, bottomY, r3, Math.PI, Math.PI * 2);
  // Inner spine (free tip at 35% height)
  line(innerX, bottomY, innerX, tipY);

  // Tubular segments scaled to arc length so curves stay smooth at any size;
  // radial segments bumped to 16 for a cleaner print surface.
  const tubularSegments = Math.max(64, Math.round(path.getLength() * 14));
  const wireTube = new THREE.TubeGeometry(path, tubularSegments, radius, 16, false);

  // Sit the round wire on the print bed (bottom touches z=0, top at 2*radius)
  wireTube.translate(0, 0, radius);

  return wireTube;
}

function createPaperclipGeometry(config: ClipConfig): THREE.BufferGeometry {
  const { clipLength, clipWidth, wireThickness, wireDepth, bodyStyle, loopGap } = config;
  const sc = 0.1; // 1 unit = 10mm in Three.js coordinate system

  const W = clipWidth * sc;
  const L = clipLength * sc;
  const T = wireThickness * sc;
  const H = wireDepth * sc;
  const gap = (loopGap || 2.2) * sc;

  if (bodyStyle === "rounded_wire") {
    // ROUNDED REAL-WIRE PAPERCLIP (ARAME REDONDO 3D)
    // Classic double-loop shape with a true circular wire cross-section
    return createRoundedWireGeometry(config);
  }

  if (bodyStyle === "classic") {
    // 1. OPEN DOUBLE-LOOP GEM CLIP (TROMBONE ABERTO 2 VOLTAS)
    // Continuous open wire path with guaranteed clearances and a completely free inner tip
    const pts = buildClassicWirePath(config);

    // Extrude open wire ribbon (top bar is part of the wire path, no separate brace)
    const ribbonShape = createRibbonShapeFromPoints(pts, T, false);

    const geomRibbon = new THREE.ExtrudeGeometry(ribbonShape, {
      depth: H,
      bevelEnabled: config.topBevel,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2
    });

    return geomRibbon;
  } else if (bodyStyle === "solid_bookmark") {
    // 2. BOOKMARK WITH WIDE OPEN TONGUE & LEAD-IN NOSE (MARCADOR COM LINGUETA ABERTA)
    // Outer U-frame with solid top bridge + central spring tongue with lead-in flared tip
    const outerR = W / 2;
    const botY = -L;
    const outerFrame = new THREE.Shape();
    
    // Outer U-contour
    outerFrame.moveTo(-outerR, 0);
    outerFrame.lineTo(-outerR, botY + outerR);
    outerFrame.absarc(0, botY + outerR, outerR, Math.PI, 0, true);
    outerFrame.lineTo(outerR, 0);
    outerFrame.lineTo(-outerR, 0);
    outerFrame.closePath();

    // Inner cutout hole creating a wide U-bracket with solid top bar
    const innerW = Math.max(0.2, W - T * 2);
    const innerR = Math.max(0.05, innerW / 2);
    const topBarThickness = T * 1.3;
    
    const hole = new THREE.Path();
    hole.moveTo(-innerR, -topBarThickness);
    hole.lineTo(innerR, -topBarThickness);
    hole.lineTo(innerR, botY + outerR);
    hole.absarc(0, botY + outerR, innerR, 0, Math.PI, false);
    hole.lineTo(-innerR, -topBarThickness);
    hole.closePath();
    outerFrame.holes.push(hole);

    // Central Flexible Spring Tongue (attached only at top, completely open at bottom!)
    const tongueW = Math.max(0.18, innerW - gap * 2);
    const tongueL = L * 0.65; // Leaves open entrance mouth of 35% at bottom
    const tongueShape = new THREE.Shape();
    const tR = tongueW / 2;
    
    // Tongue starts at top bar
    tongueShape.moveTo(-tR, -topBarThickness);
    tongueShape.lineTo(-tR, -tongueL + tR);
    // Tapered / rounded lead-in nose for smooth paper gliding
    tongueShape.absarc(0, -tongueL + tR, tR, Math.PI, 0, true);
    tongueShape.lineTo(tR, -topBarThickness);
    tongueShape.closePath();

    const geomFrame = new THREE.ExtrudeGeometry(outerFrame, {
      depth: H,
      bevelEnabled: config.topBevel,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2
    });

    const geomTongue = new THREE.ExtrudeGeometry(tongueShape, {
      depth: H,
      bevelEnabled: config.topBevel,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2
    });

    return BufferGeometryUtils.mergeGeometries([geomFrame, geomTongue]);
  } else {
    // 3. OPEN TRIPLE-PRONG FORK CLIP (GARFO ABERTO 3 PONTAS)
    // Outer legs and central leg open completely at bottom for effortless sliding
    const botY = -L;
    const topBarT = T * 1.3;
    const prongW = T * 0.9;
    const shapes: THREE.Shape[] = [];

    // Top Base Bar
    const topBase = new THREE.Shape();
    topBase.moveTo(-W / 2, 0);
    topBase.lineTo(W / 2, 0);
    topBase.lineTo(W / 2, -topBarT);
    topBase.lineTo(-W / 2, -topBarT);
    topBase.closePath();
    shapes.push(topBase);

    // Left Prong (full length with rounded tip)
    const leftProng = new THREE.Shape();
    leftProng.moveTo(-W / 2, -topBarT);
    leftProng.lineTo(-W / 2 + prongW, -topBarT);
    leftProng.lineTo(-W / 2 + prongW, botY + prongW);
    leftProng.absarc(-W / 2 + prongW / 2, botY + prongW, prongW / 2, 0, Math.PI, true);
    leftProng.lineTo(-W / 2, -topBarT);
    leftProng.closePath();
    shapes.push(leftProng);

    // Right Prong (full length with rounded tip)
    const rightProng = new THREE.Shape();
    rightProng.moveTo(W / 2 - prongW, -topBarT);
    rightProng.lineTo(W / 2, -topBarT);
    rightProng.lineTo(W / 2, botY + prongW);
    rightProng.absarc(W / 2 - prongW / 2, botY + prongW, prongW / 2, 0, Math.PI, true);
    rightProng.lineTo(W / 2 - prongW, -topBarT);
    rightProng.closePath();
    shapes.push(rightProng);

    // Center Tongue (shorter with flared arrow tip)
    const centerProng = new THREE.Shape();
    const cL = L * 0.65;
    const cW = prongW * 1.2;
    centerProng.moveTo(-cW / 2, -topBarT);
    centerProng.lineTo(cW / 2, -topBarT);
    centerProng.lineTo(cW / 2, -cL + cW / 2);
    centerProng.absarc(0, -cL + cW / 2, cW / 2, 0, Math.PI, true);
    centerProng.lineTo(-cW / 2, -topBarT);
    centerProng.closePath();
    shapes.push(centerProng);

    const geoms = shapes.map(sh => new THREE.ExtrudeGeometry(sh, {
      depth: H,
      bevelEnabled: config.topBevel,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2
    }));

    return BufferGeometryUtils.mergeGeometries(geoms);
  }
}

// --- 3D SCENE COMPONENT ---
function Clip3DScene({
  config,
  topGeometries,
  mergedGeometry
}: {
  config: ClipConfig;
  topGeometries: { geom: THREE.BufferGeometry; colorType: "clip" | "top" | "accent" }[];
  mergedGeometry: THREE.BufferGeometry | null;
}) {
  const clipBodyGeom = useMemo(() => {
    return createPaperclipGeometry(config);
  }, [config]);

  const stemGeom = useMemo(() => {
    return createStemGeometry(config);
  }, [config]);

  // Material properties based on finish
  const materialProps = useMemo(() => {
    switch (config.finish) {
      case "glossy":
        return { roughness: 0.15, metalness: 0.1, clearcoat: 0.6 };
      case "pearl":
        return { roughness: 0.25, metalness: 0.35, clearcoat: 0.8 };
      case "glitter":
        return { roughness: 0.3, metalness: 0.5 };
      default: // matte
        return { roughness: 0.45, metalness: 0.05 };
    }
  }, [config.finish]);

  const clipMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: config.clipColor,
    wireframe: config.showWireframe,
    ...materialProps
  }), [config.clipColor, config.showWireframe, materialProps]);

  const topMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: config.isBicolor ? config.topColor : config.clipColor,
    wireframe: config.showWireframe,
    ...materialProps
  }), [config.isBicolor, config.topColor, config.clipColor, config.showWireframe, materialProps]);

  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: config.accentColor || "#ffffff",
    wireframe: config.showWireframe,
    ...materialProps
  }), [config.accentColor, config.showWireframe, materialProps]);

  // Simulation Paper Sheet
  const sc = 0.1;
  const paperW = 14; // 140mm wide paper
  const paperH = 18; // 180mm high paper

  // 5x Batch array calculation
  const batchOffsets = useMemo(() => {
    if (!config.batchGrid5x) return [[0, 0]];
    const spacingX = (config.topDiameter * 1.3 + 10) * sc;
    return [
      [-2 * spacingX, 0],
      [-1 * spacingX, 0],
      [0, 0],
      [1 * spacingX, 0],
      [2 * spacingX, 0],
    ];
  }, [config.batchGrid5x, config.topDiameter]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
      <Grid 
        renderOrder={-1} 
        position={[0, 0, -0.01]} 
        args={[25, 25]} 
        cellSize={0.5} 
        cellThickness={0.5} 
        cellColor="#E2E3DD" 
        sectionSize={2.5} 
        sectionThickness={1.0} 
        sectionColor="#632CE5" 
        fadeDistance={30} 
      />

      {/* PAPER SIMULATION (MOCK NOTEBOOK) */}
      {config.showPaper && !config.batchGrid5x && (
        <group position={[0, -config.clipLength * sc * 0.45, -0.05]}>
          {/* Main Paper Sheet */}
          <mesh receiveShadow position={[0, 0, -0.02]}>
            <planeGeometry args={[paperW, paperH]} />
            <meshStandardMaterial color="#faf8f5" roughness={0.8} />
          </mesh>

          {/* Paper Edge Corner Fold / Shadow */}
          <mesh position={[0, 0, -0.03]}>
            <planeGeometry args={[paperW + 0.1, paperH + 0.1]} />
            <meshBasicMaterial color="#0a0a0a" transparent opacity={0.3} />
          </mesh>

          {/* Ruled Lines on Paper */}
          {config.paperType === "lined" && Array.from({ length: 14 }).map((_, i) => (
            <mesh key={`line-${i}`} position={[0, paperH / 2 - 2 - i * 1.1, 0.001]}>
              <planeGeometry args={[paperW - 2, 0.02]} />
              <meshBasicMaterial color="#d4d4d8" />
            </mesh>
          ))}
        </group>
      )}

      {/* RENDER CLIPS (SINGLE OR BATCH OF 5) */}
      {batchOffsets.map((offset, bIdx) => (
        <group key={`clip-instance-${bIdx}`} position={[offset[0], offset[1], 0]}>
          {/* 1. Paperclip Base Body */}
          {clipBodyGeom && (
            <mesh geometry={clipBodyGeom} material={clipMat} castShadow receiveShadow />
          )}

          {/* 2. Stem / Cabinho Connector */}
          {stemGeom && (
            <mesh geometry={stemGeom} material={clipMat} castShadow receiveShadow />
          )}

          {/* 3. Top Emblem Elements */}
          {topGeometries.map((item, idx) => {
            const mat = item.colorType === "accent" ? accentMat : (item.colorType === "top" ? topMat : clipMat);
            const emblemY = ((config.stemHeight || 0) + (config.topDiameter * 0.35 - config.topOverlap) + (config.topOffsetY || 0)) * sc;
            return (
              <mesh 
                key={`top-geom-${idx}`} 
                geometry={item.geom} 
                material={mat} 
                castShadow 
                receiveShadow 
                position={[
                  (config.topOffsetX || 0) * sc, 
                  emblemY, 
                  0
                ]}
                rotation={[0, 0, ((config.topAngle || 0) * Math.PI) / 180]}
              />
            );
          })}
        </group>
      ))}
    </group>
  );
}

// --- MAIN EXPORTED COMPONENT ---
export default function ClipMaker() {
  const [activePresetId, setActivePresetId] = useState<string>("rose_outline");
  const [activeCategory, setActiveCategory] = useState<string>("floral");
  const [activeTab, setActiveTab] = useState<"preset" | "clip" | "top" | "colors" | "export">("preset");
  
  // Lateral Gallery Drawer State
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(true);
  const [galleryCategory, setGalleryCategory] = useState<string>("all");
  const [gallerySearch, setGallerySearch] = useState<string>("");

  const [config, setConfig] = useState<ClipConfig>({
    sizeCategory: "medium",
    bodyStyle: "classic",
    clipLength: 50,
    clipWidth: 14,
    wireThickness: 2.0,
    wireDepth: 1.8,
    loopGap: 2.2,
    stemHeight: 10,
    stemWidth: 2.2,
    stemStyle: "botanical_leaves",
    stemLeaves: true,
    stemLeafSize: 6.0,
    stemCalyxWidth: 6.5,
    topStyle: "line_art",
    topDiameter: 30,
    topHeight: 2.2,
    topLineWidth: 1.8,
    topOverlap: 2.5,
    topAngle: 0,
    topOffsetX: 0,
    topOffsetY: 0,
    topBevel: true,
    isBicolor: false,
    clipColor: "#1E88E5", // Azul Céu
    topColor: "#FFD600",  // Amarelo
    accentColor: "#FFFFFF",
    finish: "glossy",
    showPaper: false,
    paperType: "lined",
    batchGrid5x: false,
    showWireframe: false,
    showDimensions: false
  });

  const [customSvgString, setCustomSvgString] = useState<string | null>(null);
  const [customImageName, setCustomImageName] = useState<string>("");
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  // Filtered presets for lateral gallery and quick selection
  const filteredGalleryPresets = useMemo(() => {
    return PRESETS.filter(item => {
      const matchCat = galleryCategory === "all" || item.category === galleryCategory;
      const matchSearch = !gallerySearch.trim() || 
        item.name.toLowerCase().includes(gallerySearch.toLowerCase()) || 
        item.description.toLowerCase().includes(gallerySearch.toLowerCase()) ||
        item.id.toLowerCase().includes(gallerySearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [galleryCategory, gallerySearch]);

  // --- PRESET SELECTION HANDLER ---
  const handleSelectPreset = (preset: PresetItem) => {
    setActivePresetId(preset.id);
    setCustomSvgString(null);
    setCustomImageName("");

    // Set dimensions matching preset category
    let length = 50;
    let width = 14;
    let topDiam = 28;
    let wireT = 2.0;

    if (preset.id === "heart_angled_red") {
      setConfig(prev => ({
        ...prev,
        sizeCategory: "small",
        topStyle: "solid_embossed",
        clipLength: 35,
        clipWidth: 13,
        topDiameter: 18,
        wireThickness: 2.0,
        wireDepth: 1.8,
        stemHeight: 6,
        stemStyle: "straight_neck",
        stemLeaves: false,
        topAngle: -30,
        topOffsetX: -1.5,
        topOffsetY: 0.5,
        clipColor: "#D50000",
        finish: "glitter",
        bodyStyle: "classic"
      }));
      triggerSuccess(`Preset "${preset.name}" carregado com inclinação e acabamento Glitter!`);
      return;
    }

    if (preset.sizeCategory === "small") {
      length = 36;
      width = 12;
      topDiam = 20;
      wireT = 1.8;
    } else if (preset.sizeCategory === "medium") {
      length = 50;
      width = 14;
      topDiam = 28;
      wireT = 2.0;
    } else if (preset.sizeCategory === "large") {
      length = 65;
      width = 18;
      topDiam = 36;
      wireT = 2.4;
    } else if (preset.sizeCategory === "giant") {
      length = 95;
      width = 24;
      topDiam = 52;
      wireT = 2.8;
    }

    const stemH = preset.defaultStemHeight !== undefined 
      ? preset.defaultStemHeight 
      : (preset.category === "floral" ? 10 : (preset.category === "symbols" || preset.category === "cute" ? 7 : 5));
    const stemSt = preset.defaultStemStyle || (preset.category === "floral" ? "botanical_leaves" : "straight_neck");
    const stemLf = preset.defaultStemLeaves !== undefined ? preset.defaultStemLeaves : (preset.category === "floral");

    setConfig(prev => ({
      ...prev,
      sizeCategory: preset.sizeCategory,
      topStyle: preset.defaultTopStyle,
      clipLength: length,
      clipWidth: width,
      topDiameter: topDiam,
      wireThickness: wireT,
      stemHeight: stemH,
      stemStyle: stemSt,
      stemLeaves: stemLf,
      topAngle: 0,
      topOffsetX: 0,
      topOffsetY: 0,
      bodyStyle: preset.sizeCategory === "giant" ? "solid_bookmark" : "classic"
    }));

    triggerSuccess(`Desenho "${preset.name}" selecionado com cabinho de elevação!`);
  };

  // --- SVG / IMAGE UPLOAD & TRACER ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    setCustomImageName(file.name);
    setActivePresetId("");

    if (ext === "svg") {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCustomSvgString(text);
        triggerSuccess(`SVG "${file.name}" carregado com sucesso!`);
      };
      reader.readAsText(file);
    } else if (["png", "jpg", "jpeg", "webp", "bmp"].includes(ext || "")) {
      setIsTracing(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const imgUrl = event.target?.result as string;
        try {
          ImageTracer.imageToSVG(
            imgUrl,
            (svgStr: string) => {
              setCustomSvgString(svgStr);
              setIsTracing(false);
              triggerSuccess(`Imagem "${file.name}" vetorizada em 3D com sucesso!`);
            },
            {
              ltilesize: 128,
              numberofcolors: 2,
              pathomit: 8,
              blurradius: 1,
              strokewidth: 1.5,
              linefilter: true
            }
          );
        } catch (err) {
          console.error(err);
          setIsTracing(false);
          setErrorMsg("Erro ao vetorizar a imagem. Tente uma imagem com alto contraste.");
        }
      };
      reader.readAsDataURL(file);
    } else {
      setErrorMsg("Formato não suportado. Envie arquivos SVG, PNG ou JPG.");
    }
  };

  // --- ACTIVE SVG STRING DERIVATION ---
  const currentSvg = useMemo(() => {
    if (customSvgString) return customSvgString;
    const preset = PRESETS.find(p => p.id === activePresetId);
    return preset ? preset.svg : PRESETS[0].svg;
  }, [customSvgString, activePresetId]);

  // --- PARSE SVG PATHS & BUILD 3D TOP GEOMETRIES ---
  const topGeometries = useMemo(() => {
    if (!currentSvg) return [];
    try {
      const loader = new SVGLoader();
      const svgData = loader.parse(currentSvg);
      const sc = 0.1;
      const targetSize = config.topDiameter * sc;
      const depth = config.topHeight * sc;
      const lineWidth = config.topLineWidth * sc;

      // Extract all subpaths and determine total bounding box
      const allPoints: THREE.Vector2[] = [];
      const pathList: { points: THREE.Vector2[]; isClosed: boolean; isFilled: boolean }[] = [];

      svgData.paths.forEach(p => {
        p.subPaths.forEach(sub => {
          const pts = sub.getPoints(35);
          if (pts.length >= 2) {
            const isClosed = pts[0].distanceTo(pts[pts.length - 1]) < 0.1;
            pts.forEach(pt => allPoints.push(pt));
            pathList.push({ points: pts, isClosed, isFilled: !!(p.userData?.style as any)?.fill });
          }
        });
      });

      if (allPoints.length === 0) return [];

      // Compute bounding box
      const box = new THREE.Box2();
      allPoints.forEach(p => box.expandByPoint(p));
      const sizeX = box.max.x - box.min.x;
      const sizeY = box.max.y - box.min.y;
      const maxDim = Math.max(sizeX, sizeY) || 1;
      const center = new THREE.Vector2((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2);
      const scaleFactor = targetSize / maxDim;

      // Scaled and centered normalized paths
      const normalizedPaths = pathList.map(p => {
        const scaledPts = p.points.map(pt => {
          return new THREE.Vector2()
            .subVectors(pt, center)
            .multiplyScalar(scaleFactor)
            .multiply(new THREE.Vector2(1, -1)); // Flip Y to standard 3D orientation
        });
        return { points: scaledPts, isClosed: p.isClosed, isFilled: p.isFilled };
      });

      const outputGeoms: { geom: THREE.BufferGeometry; colorType: "clip" | "top" | "accent" }[] = [];

      if (config.topStyle === "line_art") {
        // Line Art / Arame: Every path becomes an extruded thick ribbon
        normalizedPaths.forEach((pathObj, idx) => {
          try {
            const ribbonShape = createRibbonShapeFromPoints(pathObj.points, lineWidth, pathObj.isClosed);
            const geom = new THREE.ExtrudeGeometry(ribbonShape, {
              depth,
              bevelEnabled: config.topBevel,
              bevelThickness: 0.02,
              bevelSize: 0.015,
              bevelSegments: 2
            });
            outputGeoms.push({ geom, colorType: idx === 0 ? "top" : "accent" });
          } catch (e) {}
        });
      } else if (config.topStyle === "solid_embossed") {
        // Solid Embossed: Base plate filled shape + raised detail ridges
        const outerPoints = normalizedPaths[0]?.points || [];
        if (outerPoints.length >= 3) {
          const shape = new THREE.Shape();
          shape.moveTo(outerPoints[0].x, outerPoints[0].y);
          for (let i = 1; i < outerPoints.length; i++) shape.lineTo(outerPoints[i].x, outerPoints[i].y);
          shape.closePath();

          const baseGeom = new THREE.ExtrudeGeometry(shape, {
            depth: depth * 0.7,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelSegments: 3
          });
          outputGeoms.push({ geom: baseGeom, colorType: "top" });

          // Raised inner details
          normalizedPaths.slice(1).forEach(pathObj => {
            try {
              const ribbon = createRibbonShapeFromPoints(pathObj.points, lineWidth * 0.8, pathObj.isClosed);
              const detailGeom = new THREE.ExtrudeGeometry(ribbon, {
                depth: depth * 0.5,
                bevelEnabled: true,
                bevelThickness: 0.01,
                bevelSize: 0.01
              });
              detailGeom.translate(0, 0, depth * 0.7);
              outputGeoms.push({ geom: detailGeom, colorType: "accent" });
            } catch (e) {}
          });
        }
      } else {
        // Badge Plate: Circular / Shaped backplate with embossed emblem
        const r = targetSize / 2;
        const circleShape = new THREE.Shape();
        circleShape.absarc(0, 0, r, 0, Math.PI * 2, false);

        const plateGeom = new THREE.ExtrudeGeometry(circleShape, {
          depth: depth * 0.6,
          bevelEnabled: true,
          bevelThickness: 0.02,
          bevelSize: 0.02
        });
        outputGeoms.push({ geom: plateGeom, colorType: "top" });

        // Raised logo lines on top of plate
        normalizedPaths.forEach(pathObj => {
          try {
            const ribbon = createRibbonShapeFromPoints(pathObj.points, lineWidth, pathObj.isClosed);
            const logoGeom = new THREE.ExtrudeGeometry(ribbon, {
              depth: depth * 0.6,
              bevelEnabled: true,
              bevelThickness: 0.01,
              bevelSize: 0.01
            });
            logoGeom.translate(0, 0, depth * 0.6);
            outputGeoms.push({ geom: logoGeom, colorType: "accent" });
          } catch (e) {}
        });
      }

      return outputGeoms;
    } catch (err) {
      console.error("Erro ao gerar geometria do topo:", err);
      return [];
    }
  }, [currentSvg, config.topStyle, config.topDiameter, config.topHeight, config.topLineWidth, config.topBevel]);

  // --- MERGED COMPLETE GEOMETRY FOR EXPORT ---
  const getExportMesh = (batch: boolean = false): THREE.Mesh => {
    const sc = 0.1;
    const clipGeom = createPaperclipGeometry(config);
    const stemGeom = createStemGeometry(config);
    const geomsToMerge: THREE.BufferGeometry[] = [];

    const topOffsetY = ((config.stemHeight || 0) + (config.topDiameter * 0.35 - config.topOverlap)) * sc;

    // Single Clip Assembly
    const assembleSingleClip = (xOffset: number = 0, yOffset: number = 0) => {
      const cClone = clipGeom.clone();
      cClone.translate(xOffset, yOffset, 0);
      geomsToMerge.push(cClone.toNonIndexed());

      if (stemGeom) {
        const sClone = stemGeom.clone();
        sClone.translate(xOffset, yOffset, 0);
        geomsToMerge.push(sClone.toNonIndexed());
      }

      topGeometries.forEach(item => {
        const tClone = item.geom.clone();
        if (config.topAngle) {
          tClone.rotateZ(((config.topAngle || 0) * Math.PI) / 180);
        }
        tClone.translate(
          xOffset + (config.topOffsetX || 0) * sc, 
          topOffsetY + yOffset + (config.topOffsetY || 0) * sc, 
          0
        );
        geomsToMerge.push(tClone.toNonIndexed());
      });
    };

    if (batch) {
      const spacingX = (config.topDiameter * 1.3 + 10) * sc;
      for (let i = -2; i <= 2; i++) {
        assembleSingleClip(i * spacingX, 0);
      }
    } else {
      assembleSingleClip(0, 0);
    }

    const merged = BufferGeometryUtils.mergeGeometries(geomsToMerge);
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial());
    // Rotate to lay completely flat on 3D printer printbed (Z up)
    mesh.rotation.x = -Math.PI / 2;
    mesh.updateMatrixWorld();
    return mesh;
  };

  // --- STL EXPORT HANDLER ---
  const handleExportSTL = (batch: boolean = false) => {
    try {
      const mesh = getExportMesh(batch);
      const exporter = new STLExporter();
      const result = exporter.parse(mesh, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      const fileName = `clipe_${config.sizeCategory}_${activePresetId || 'custom'}${batch ? '_kit5x' : ''}.stl`;
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      triggerSuccess(`Arquivo STL "${fileName}" exportado com sucesso!`);
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro ao gerar arquivo STL para impressão 3D.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FAF4] text-[#1A1C19] font-sans overflow-hidden">
      {/* HEADER BAR */}
      <header className="h-14 border-b border-[#E2E3DD] bg-white px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#632CE5]/10 border border-[#632CE5]/40 flex items-center justify-center text-[#632CE5]">
            <Paperclip className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-wider text-[#1A1C19] flex items-center gap-2">
              Gerador de Clipes Decorativos 3D
              <span className="bg-[#632CE5]/10 text-[#632CE5] border border-[#632CE5]/30 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                PRINT-READY STL
              </span>
            </h1>
            <p className="text-[10px] text-[#687064] font-mono">
              Clipes para papel, planners e cadernos com topos florais, line art e fotos personalizadas
            </p>
          </div>
        </div>

        {/* TOP BAR QUICK CONTROLS */}
        <div className="flex items-center gap-2">
          {/* TOGGLE PAINEL LATERAL DE MINIATURAS */}
          <button
            onClick={() => setIsGalleryOpen(prev => !prev)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
              isGalleryOpen 
                ? "bg-[#632CE5]/20 border-[#632CE5] text-[#632CE5] shadow-sm shadow-[#632CE5]/20" 
                : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:text-[#1A1C19]"
            }`}
            title="Abrir/fechar painel lateral com grade de miniaturas line art"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#632CE5]" />
            <span>Grade Miniaturas</span>
            <span className="bg-[#632CE5]/20 text-[#632CE5] text-[9px] px-1 rounded-full font-mono font-bold">
              {PRESETS.length}
            </span>
          </button>

          <button
            onClick={() => setConfig(prev => ({ ...prev, showPaper: !prev.showPaper }))}
            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
              config.showPaper 
                ? "bg-[#632CE5]/15 border-[#632CE5] text-[#632CE5]" 
                : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:text-[#1A1C19]"
            }`}
            title="Simula o clipe preso a uma folha de caderno real"
          >
            <FileText className="w-3.5 h-3.5" />
            {config.showPaper ? "Ocultar Papel" : "Simular no Papel"}
          </button>

          <button
            onClick={() => setConfig(prev => ({ ...prev, batchGrid5x: !prev.batchGrid5x }))}
            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
              config.batchGrid5x 
                ? "bg-[#632CE5]/15 border-[#632CE5] text-[#632CE5]" 
                : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:text-[#1A1C19]"
            }`}
            title="Organiza 5 clipes alinhados na mesa para produção rápida"
          >
            <Copy className="w-3.5 h-3.5" />
            {config.batchGrid5x ? "Modo 1x Unidade" : "Kit 5x Produção"}
          </button>

          <div className="h-4 w-[1px] bg-[#E8E9E3] mx-1" />

          <button
            onClick={() => handleExportSTL(config.batchGrid5x)}
            className="px-4 py-1.5 bg-[#632CE5] hover:bg-[#7C4DFF] text-white font-black text-[10px] uppercase tracking-wider rounded flex items-center gap-2 shadow-lg shadow-[#632CE5]/20 transition-transform active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar STL {config.batchGrid5x ? "(Kit 5x)" : "(1x)"}
          </button>
        </div>
      </header>

      {/* SUCCESS / ERROR NOTIFICATIONS */}
      {successMsg && (
        <div className="bg-emerald-50 border-b border-emerald-500/40 text-emerald-700 text-xs px-6 py-2 flex items-center gap-2 font-mono shrink-0 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border-b border-red-500/40 text-red-700 text-xs px-6 py-2 flex items-center gap-2 font-mono shrink-0 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* WORKSPACE BODY: 3 COLUMNS */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT CONTROLS PANEL */}
        <div className="w-[380px] lg:w-[400px] bg-white border-r border-[#E2E3DD] flex flex-col shrink-0 overflow-hidden">
          {/* TABS NAVIGATION */}
          <div className="flex border-b border-[#E2E3DD] bg-[#F9FAF4] p-1 gap-1 shrink-0">
            {[
              { id: "preset", label: "Modelos", icon: Wand2 },
              { id: "clip", label: "Corpo do Clipe", icon: Paperclip },
              { id: "top", label: "Topo 3D", icon: Sparkles },
              { id: "colors", label: "Cores & Acabamento", icon: Palette },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    isActive 
                      ? "bg-[#632CE5]/10 text-[#632CE5] border border-[#632CE5]/30" 
                      : "text-[#687064] hover:text-[#494455] hover:bg-[#F3F4EE]/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
            {/* --- TAB 1: PRESETS & UPLOAD --- */}
            {activeTab === "preset" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* CATEGORY SELECTOR */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] uppercase font-mono font-bold text-[#687064]">
                      1. Categoria de Desenhos
                    </label>
                    <button
                      onClick={() => setIsGalleryOpen(true)}
                      className="text-[9px] font-mono text-[#632CE5] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <LayoutGrid className="w-3 h-3" />
                      Abrir Painel Lateral
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: "floral", label: "Florais", icon: "🌸" },
                      { id: "symbols", label: "Símbolos", icon: "❤️" },
                      { id: "geometric", label: "Geometria", icon: "🔷" },
                      { id: "cute", label: "Fofos", icon: "🦋" },
                      { id: "giant", label: "Gigantes", icon: "🪽" },
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setActiveCategory(cat.id);
                          setGalleryCategory(cat.id);
                        }}
                        className={`py-2 px-1 rounded text-[9px] font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                          activeCategory === cat.id
                            ? "bg-[#632CE5]/10 border-[#632CE5] text-[#632CE5]"
                            : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                        }`}
                      >
                        <span className="text-sm">{cat.icon}</span>
                        <span className="truncate w-full text-center">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* PRESET CARDS WITH SVG VECTOR THUMBNAILS */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] uppercase font-mono font-bold text-[#687064]">
                      2. Escolha o Topo Decorativo
                    </label>
                    <span className="text-[9px] font-mono text-[#687064]">
                      {PRESETS.filter(p => p.category === activeCategory).length} opções
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.filter(p => p.category === activeCategory).map(preset => {
                      const isSelected = activePresetId === preset.id && !customSvgString;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => handleSelectPreset(preset)}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden group ${
                            isSelected
                              ? "bg-[#632CE5]/10 border-[#632CE5] shadow-sm shadow-[#632CE5]/10"
                              : "bg-[#F3F4EE] border-[#E2E3DD] hover:border-[#CAC3D8] hover:bg-[#F3F4EE]"
                          }`}
                        >
                          {/* MINIATURE SVG PREVIEW */}
                          <div className="w-full h-16 bg-[#F9FAF4] rounded border border-[#E2E3DD] mb-2 flex items-center justify-center p-1.5 relative overflow-hidden group-hover:border-[#632CE5]/40 transition-colors">
                            <div 
                              className="w-12 h-12 text-[#632CE5] flex items-center justify-center pointer-events-none transition-transform group-hover:scale-110"
                              dangerouslySetInnerHTML={{ __html: preset.svg }}
                            />
                            <span className="absolute bottom-1 right-1 text-xs opacity-70">
                              {preset.icon}
                            </span>
                            <span className={`absolute top-1 right-1 text-[7px] font-mono font-bold px-1 rounded uppercase ${
                              preset.sizeCategory === "small" ? "bg-amber-500/20 text-amber-400" :
                              preset.sizeCategory === "medium" ? "bg-blue-500/20 text-blue-400" :
                              preset.sizeCategory === "large" ? "bg-emerald-500/20 text-emerald-400" :
                              "bg-[#632CE5]/20 text-[#7C4DFF]"
                            }`}>
                              {preset.sizeCategory}
                            </span>
                          </div>

                          <div>
                            <h4 className={`text-[11px] font-black uppercase tracking-tight truncate ${isSelected ? "text-[#632CE5]" : "text-[#1A1C19]"}`}>
                              {preset.name}
                            </h4>
                            <p className="text-[8px] text-[#687064] mt-0.5 line-clamp-1">
                              {preset.description}
                            </p>
                          </div>

                          {isSelected && (
                            <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-[#632CE5] shadow-sm shadow-[#632CE5]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* UPLOAD CUSTOM IMAGE / LOGO */}
                <div className="pt-2">
                  <label className="text-[10px] uppercase font-mono font-bold text-[#687064] mb-2 block">
                    3. Ou Carregue Seu Próprio Desenho / Logo
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".svg,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                  />

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                      customSvgString 
                        ? "border-[#632CE5] bg-[#632CE5]/5" 
                        : "border-[#E2E3DD] hover:border-[#CAC3D8] bg-[#F3F4EE]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#632CE5]">
                      {isTracing ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-[#632CE5]" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <span className="text-xs font-bold text-[#1A1C19] block">
                        {customImageName ? customImageName : "Enviar SVG, PNG ou Foto"}
                      </span>
                      <span className="text-[9px] font-mono text-[#687064] block mt-0.5">
                        {isTracing ? "Vetorizando contorno em tempo real..." : "Vetorização automática e instantânea em relevo 3D"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 2: CORPO DO CLIPE (PAPERCLIP BODY) --- */}
            {activeTab === "clip" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* SIZE CATEGORY SELECTOR */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-[#687064] mb-2 block">
                    Tamanho Padrão
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "small", label: "Pequeno", desc: "35mm" },
                      { id: "medium", label: "Médio", desc: "50mm" },
                      { id: "large", label: "Grande", desc: "65mm" },
                      { id: "giant", label: "Gigante", desc: "95mm" },
                    ].map(size => (
                      <button
                        key={size.id}
                        onClick={() => {
                          const len = size.id === "small" ? 36 : size.id === "medium" ? 50 : size.id === "large" ? 65 : 95;
                          const wid = size.id === "small" ? 12 : size.id === "medium" ? 14 : size.id === "large" ? 18 : 24;
                          setConfig(prev => ({ ...prev, sizeCategory: size.id as any, clipLength: len, clipWidth: wid }));
                        }}
                        className={`p-2 rounded text-center border transition-all ${
                          config.sizeCategory === size.id
                            ? "bg-[#632CE5]/15 border-[#632CE5] text-[#632CE5]"
                            : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                        }`}
                      >
                        <div className="text-[10px] font-black uppercase">{size.label}</div>
                        <div className="text-[8px] font-mono text-[#687064]">{size.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CLIP BODY STYLE */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-[#687064] mb-2 block">
                    Modelo do Clipe (Entrada 100% Aberta)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "rounded_wire", label: "Arame Redondo", desc: "Clipe clássico com arame 3D arredondado", icon: "🌀" },
                      { id: "solid_bookmark", label: "Marcador c/ Lingueta", desc: "Lingueta central aberta na base (Ideal p/ 3D)", icon: "📑" },
                      { id: "classic", label: "Trombone 2 Voltas", desc: "Arame contínuo com ponta livre e folga", icon: "📎" },
                      { id: "stem_connector", label: "Garfo Triplo Aberto", desc: "3 Hastes paralelas com base aberta", icon: "🔱" },
                    ].map(st => (
                      <button
                        key={st.id}
                        onClick={() => setConfig(prev => ({ ...prev, bodyStyle: st.id as any }))}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          config.bodyStyle === st.id
                            ? "bg-[#632CE5]/10 border-[#632CE5] text-[#632CE5]"
                            : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{st.icon}</span>
                          <div className="text-[10px] font-black uppercase tracking-tight">{st.label}</div>
                        </div>
                        <div className="text-[8px] text-[#687064] mt-1 leading-tight">{st.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* --- SEÇÃO DO CABINHO / HASTE DE ELEVAÇÃO --- */}
                <div className="p-3.5 rounded-xl bg-[#F3F4EE] border border-[#632CE5]/30 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌿</span>
                      <div>
                        <h4 className="text-xs font-black uppercase text-[#632CE5] tracking-tight">
                          Cabinho / Haste de Elevação
                        </h4>
                        <p className="text-[9px] text-[#494455]">
                          Separa o desenho do clipe para não atrapalhar o encaixe em papéis
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#632CE5]/10 text-[#632CE5] border border-[#632CE5]/30">
                      {config.stemHeight || 0} mm
                    </span>
                  </div>

                  {/* STEM STYLE SELECTOR */}
                  <div>
                    <label className="text-[9px] uppercase font-mono font-bold text-[#687064] mb-1.5 block">
                      Modelo do Cabinho
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: "botanical_leaves", label: "Botânico c/ Folhas", icon: "🌱" },
                        { id: "straight_neck", label: "Pescoço Reto", icon: "📏" },
                        { id: "dual_bridge", label: "Ponte Dupla", icon: "🪜" },
                        { id: "winged_cushion", label: "Suporte Abas", icon: "🪽" },
                        { id: "none_flush", label: "Sem Cabinho", icon: "❌" },
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={() => setConfig(prev => ({ 
                            ...prev, 
                            stemStyle: item.id as any,
                            stemHeight: item.id === "none_flush" ? 0 : (prev.stemHeight || 8)
                          }))}
                          className={`p-1.5 rounded-lg border text-left flex items-center gap-1.5 transition-all ${
                            config.stemStyle === item.id
                              ? "bg-[#632CE5]/10 border-[#632CE5] text-[#632CE5]"
                              : "bg-white border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                          }`}
                        >
                          <span className="text-xs">{item.icon}</span>
                          <span className="text-[9px] font-bold truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* STEM HEIGHT SLIDER & QUICK PILLS */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Comprimento do Cabinho</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.stemHeight || 0} mm</span>
                    </div>

                    <div className="flex gap-1.5">
                      {[
                        { h: 0, label: "0mm" },
                        { h: 6, label: "6mm" },
                        { h: 10, label: "10mm (Foto ⭐)" },
                        { h: 15, label: "15mm" },
                        { h: 20, label: "20mm" },
                      ].map(pill => (
                        <button
                          key={pill.h}
                          onClick={() => setConfig(prev => ({ 
                            ...prev, 
                            stemHeight: pill.h,
                            stemStyle: pill.h === 0 ? "none_flush" : (prev.stemStyle === "none_flush" ? "straight_neck" : prev.stemStyle)
                          }))}
                          className={`flex-1 py-1 text-[8px] font-mono font-bold rounded border transition-all ${
                            config.stemHeight === pill.h
                              ? "bg-[#632CE5] text-white border-[#632CE5]"
                              : "bg-white border-[#E2E3DD] text-[#494455] hover:text-[#1A1C19]"
                          }`}
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="25"
                      step="1"
                      value={config.stemHeight || 0}
                      onChange={e => setConfig(prev => ({ ...prev, stemHeight: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* ARREDONDAMENTO DO ENCONTRO / CÁLICE FLORAL */}
                  <div className="pt-2 border-t border-[#E2E3DD] space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Arredondamento do Encontro (Cálice Floral)</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.stemCalyxWidth || 6.5} mm</span>
                    </div>
                    <p className="text-[8px] text-[#687064] font-mono">
                      Suaviza a transição entre o clipe e a decoração com curvas orgânicas abauladas
                    </p>
                    <input
                      type="range"
                      min="3.0"
                      max="14.0"
                      step="0.5"
                      value={config.stemCalyxWidth || 6.5}
                      onChange={e => setConfig(prev => ({ ...prev, stemCalyxWidth: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* LEAF CONTROLS (IF BOTANICAL OR LEAVES ENABLED) */}
                  {(config.stemStyle === "botanical_leaves" || config.stemLeaves) && (
                    <div className="pt-1 border-t border-[#E2E3DD] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-mono font-bold text-[#494455]">Folhas Decorativas no Cabinho</span>
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, stemLeaves: !prev.stemLeaves }))}
                          className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase ${
                            config.stemLeaves ? "bg-[#632CE5]/10 text-[#632CE5] border border-[#632CE5]/40" : "bg-[#E8E9E3] text-[#687064]"
                          }`}
                        >
                          {config.stemLeaves ? "Ativadas" : "Desativadas"}
                        </button>
                      </div>

                      {config.stemLeaves && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-mono text-[#494455]">
                            <span>Tamanho das Folhinhas</span>
                            <span className="text-[#632CE5] font-bold">{config.stemLeafSize || 6.0} mm</span>
                          </div>
                          <input
                            type="range"
                            min="3.0"
                            max="10.0"
                            step="0.5"
                            value={config.stemLeafSize || 6.0}
                            onChange={e => setConfig(prev => ({ ...prev, stemLeafSize: Number(e.target.value) }))}
                            className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* CLEARANCE BENEFIT BADGE */}
                  <div className="p-2 rounded-lg bg-[#E8DEFF]/50 border border-[#632CE5]/20 flex items-start gap-2">
                    <span className="text-[#632CE5] text-xs mt-0.5">✓</span>
                    <p className="text-[9px] text-[#494455] leading-tight">
                      <strong>Encaixe Livre:</strong> Com {config.stemHeight || 0}mm de elevação, o clipe abraça até {(config.stemHeight || 0) > 8 ? '20 a 30' : (config.stemHeight || 0) > 4 ? '10 a 15' : '3 a 5'} folhas sem encavalar ou amassar as bordas das páginas.
                    </p>
                  </div>
                </div>

                {/* PARAMETRIC SLIDERS */}
                <div className="space-y-4 pt-2">
                  {/* Comprimento */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Comprimento do Clipe (L)</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.clipLength} mm</span>
                    </div>
                    <input
                      type="range"
                      min="25"
                      max="110"
                      step="1"
                      value={config.clipLength}
                      onChange={e => setConfig(prev => ({ ...prev, clipLength: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Largura */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Largura do Clipe (W)</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.clipWidth} mm</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="35"
                      step="0.5"
                      value={config.clipWidth}
                      onChange={e => setConfig(prev => ({ ...prev, clipWidth: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Espessura do Arame */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Espessura do Filamento (Arame)</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.wireThickness} mm</span>
                    </div>
                    <input
                      type="range"
                      min="1.4"
                      max="3.8"
                      step="0.1"
                      value={config.wireThickness}
                      onChange={e => setConfig(prev => ({ ...prev, wireThickness: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Fenda / Folga de Entrada do Papel (Loop Gap) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Abertura da Fenda de Entrada (Folga)</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.loopGap || 2.2} mm</span>
                    </div>
                    <p className="text-[8px] text-[#687064] font-mono">
                      Espaço livre entre as voltas para o papel entrar suavemente sem prender
                    </p>
                    <input
                      type="range"
                      min="1.6"
                      max="4.5"
                      step="0.1"
                      value={config.loopGap || 2.2}
                      onChange={e => setConfig(prev => ({ ...prev, loopGap: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Altura Z / Profundidade */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Altura da Extrusão (Z)</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.wireDepth} mm</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="3.5"
                      step="0.1"
                      value={config.wireDepth}
                      onChange={e => setConfig(prev => ({ ...prev, wireDepth: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 3: TOPO 3D (EMBLEM SETTINGS) --- */}
            {activeTab === "top" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* TOP STYLE */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-[#687064] mb-2 block">
                    Modo de Extrusão 3D do Topo
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "line_art", label: "Line Art (Vazado)", desc: "Estilo arame elegante contínuo" },
                      { id: "solid_embossed", label: "Sólido Abaulado", desc: "Preenchido com relevo 3D" },
                      { id: "badge_plate", label: "Medalhão Placa", desc: "Placa base com contorno alto" },
                    ].map(st => (
                      <button
                        key={st.id}
                        onClick={() => setConfig(prev => ({ ...prev, topStyle: st.id as any }))}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          config.topStyle === st.id
                            ? "bg-[#632CE5]/10 border-[#632CE5] text-[#632CE5]"
                            : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                        }`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-tight">{st.label}</div>
                        <div className="text-[8px] text-[#687064] mt-1 leading-tight">{st.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* TOP PARAMETERS */}
                <div className="space-y-4 pt-2">
                  {/* Diâmetro do Topo */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Diâmetro / Tamanho do Topo</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.topDiameter} mm</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="65"
                      step="1"
                      value={config.topDiameter}
                      onChange={e => setConfig(prev => ({ ...prev, topDiameter: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Espessura das Linhas do Desenho */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Espessura do Traço (Line Width)</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.topLineWidth} mm</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="4.5"
                      step="0.1"
                      value={config.topLineWidth}
                      onChange={e => setConfig(prev => ({ ...prev, topLineWidth: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Altura de Extrusão do Topo */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Altura do Relevo (Z)</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.topHeight} mm</span>
                    </div>
                    <input
                      type="range"
                      min="1.2"
                      max="5.0"
                      step="0.1"
                      value={config.topHeight}
                      onChange={e => setConfig(prev => ({ ...prev, topHeight: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Sobreposição / Solda com a Haste */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Fusão com o Clipe (Overlap)</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.topOverlap} mm</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="8.0"
                      step="0.5"
                      value={config.topOverlap}
                      onChange={e => setConfig(prev => ({ ...prev, topOverlap: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Elevação por Cabinho */}
                  <div className="space-y-1.5 p-3 rounded-lg bg-[#E8DEFF]/40 border border-[#632CE5]/30">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#632CE5] text-[10px] uppercase font-bold flex items-center gap-1.5">
                        <span>🌿</span> Elevação por Cabinho (Haste)
                      </span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.stemHeight || 0} mm</span>
                    </div>
                    <p className="text-[8px] text-[#494455] leading-tight">
                      Eleva o desenho do topo para não bloquear as folhas de papel
                    </p>
                    <input
                      type="range"
                      min="0"
                      max="25"
                      step="1"
                      value={config.stemHeight || 0}
                      onChange={e => setConfig(prev => ({ ...prev, stemHeight: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Ângulo de Rotação do Topo */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Inclinação / Rotação do Topo</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setConfig(prev => ({ ...prev, topAngle: 0 }))}
                          className="text-[9px] font-mono text-[#687064] hover:text-[#1A1C19] px-1 bg-[#E8E9E3] rounded"
                        >
                          Reset 0°
                        </button>
                        <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.topAngle}°</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      step="5"
                      value={config.topAngle}
                      onChange={e => setConfig(prev => ({ ...prev, topAngle: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Deslocamento Lateral X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[#494455] text-[10px] uppercase font-bold">Posição Lateral (X)</span>
                      <span className="font-mono text-[#632CE5] font-bold text-[10px]">{config.topOffsetX} mm</span>
                    </div>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={config.topOffsetX}
                      onChange={e => setConfig(prev => ({ ...prev, topOffsetX: Number(e.target.value) }))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E8E9E3] rounded cursor-pointer"
                    />
                  </div>

                  {/* Chanfro Suave (Bevel) */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#F3F4EE] border border-[#E2E3DD] mt-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#1A1C19] block">Chanfro Suave (Bevel)</span>
                      <span className="text-[8px] text-[#687064] block font-mono">Bordas arredondadas que facilitam a passagem em papéis</span>
                    </div>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, topBevel: !prev.topBevel }))}
                      className={`w-9 h-5 rounded-full transition-colors relative ${config.topBevel ? 'bg-[#632CE5]' : 'bg-[#CAC3D8]'}`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${config.topBevel ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 4: CORES & ACABAMENTO --- */}
            {activeTab === "colors" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* 8 OFFICIAL PRODUCTION COLORS */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-[#687064] mb-2 block">
                    Paleta Oficial de Filamentos
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {CLIP_COLORS.map(color => {
                      const isSelected = config.clipColor === color.hex;
                      return (
                        <button
                          key={color.hex}
                          onClick={() => setConfig(prev => ({ ...prev, clipColor: color.hex }))}
                          className={`p-2 rounded-lg border text-center flex flex-col items-center gap-1.5 transition-all ${
                            isSelected ? "border-white scale-105 shadow-md shadow-white/10" : "border-[#E2E3DD] hover:border-[#CAC3D8] bg-[#F3F4EE]"
                          }`}
                        >
                          <div 
                            className="w-6 h-6 rounded-full border border-black/30 shadow-inner" 
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="text-[8px] font-bold text-[#494455] truncate w-full text-center">
                            {color.name.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* MATERIAL FINISH */}
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-[#687064] mb-2 block">
                    Acabamento de Superfície
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "matte", label: "Fosco", desc: "PLA Matte" },
                      { id: "glossy", label: "Brilhante", desc: "PETG / Gloss" },
                      { id: "pearl", label: "Pérola", desc: "Perolado" },
                      { id: "glitter", label: "Glitter", desc: "Partículas" },
                    ].map(fin => (
                      <button
                        key={fin.id}
                        onClick={() => setConfig(prev => ({ ...prev, finish: fin.id as any }))}
                        className={`p-2 rounded text-center border transition-all ${
                          config.finish === fin.id
                            ? "bg-[#632CE5]/15 border-[#632CE5] text-[#632CE5]"
                            : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                        }`}
                      >
                        <div className="text-[10px] font-black uppercase">{fin.label}</div>
                        <div className="text-[8px] font-mono text-[#687064]">{fin.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* BICOLOR TOGGLE (MULTI-MATERIAL) */}
                <div className="p-3 rounded-lg bg-[#F3F4EE] border border-[#E2E3DD] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#1A1C19] block">Impressão Bicolor (Troca de Cor)</span>
                      <span className="text-[8px] text-[#687064] block font-mono">Permite corpo em uma cor e topo decorativo em outra</span>
                    </div>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, isBicolor: !prev.isBicolor }))}
                      className={`w-9 h-5 rounded-full transition-colors relative ${config.isBicolor ? 'bg-[#632CE5]' : 'bg-[#CAC3D8]'}`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${config.isBicolor ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {config.isBicolor && (
                    <div className="pt-2 border-t border-[#E2E3DD]">
                      <label className="text-[9px] font-mono uppercase text-[#494455] mb-1.5 block">Cor do Topo Decorativo</label>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {CLIP_COLORS.map(color => (
                          <button
                            key={`top-${color.hex}`}
                            onClick={() => setConfig(prev => ({ ...prev, topColor: color.hex }))}
                            className={`w-6 h-6 rounded-full shrink-0 border ${config.topColor === color.hex ? 'border-white ring-2 ring-[#632CE5]' : 'border-transparent'}`}
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM QUICK STATS & EXPORT CARD */}
          <div className="p-4 border-t border-[#E2E3DD] bg-white space-y-3 shrink-0">
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="bg-[#F3F4EE] p-2 rounded border border-[#E2E3DD]">
                <span className="text-[8px] text-[#687064] block uppercase">Comprimento</span>
                <span className="text-xs font-black text-[#1A1C19]">{config.clipLength} mm</span>
              </div>
              <div className="bg-[#F3F4EE] p-2 rounded border border-[#E2E3DD]">
                <span className="text-[8px] text-[#687064] block uppercase">Largura Topo</span>
                <span className="text-xs font-black text-[#1A1C19]">{config.topDiameter} mm</span>
              </div>
              <div className="bg-[#F3F4EE] p-2 rounded border border-[#E2E3DD]">
                <span className="text-[8px] text-[#687064] block uppercase">Tempo Aprox.</span>
                <span className="text-xs font-black text-[#632CE5]">~12 min</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleExportSTL(false)}
                className="flex-1 py-2.5 bg-[#F3F4EE] hover:bg-[#E8E9E3] text-[#1A1C19] font-bold text-xs uppercase tracking-wider rounded border border-[#CAC3D8] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                STL 1x (Unidade)
              </button>
              <button
                onClick={() => handleExportSTL(true)}
                className="flex-1 py-2.5 bg-[#632CE5] hover:bg-[#7C4DFF] text-white font-black text-xs uppercase tracking-wider rounded flex items-center justify-center gap-1.5 shadow-lg shadow-[#632CE5]/20 transition-all cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                STL Kit 5x
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT 3D VIEWPORT */}
        <div className="flex-1 relative bg-radial from-[#F1F3ED] to-[#F9FAF4] flex flex-col">
          {/* 3D CANVAS */}
          <div className="flex-1 w-full h-full">
            <Canvas
              shadows
              camera={{ position: [0, 8, 12], fov: 40 }}
              gl={{ antialias: true, preserveDrawingBuffer: true }}
            >
              <ambientLight intensity={0.7} />
              <directionalLight position={[10, 15, 10]} intensity={1.5} castShadow shadow-mapSize={1024} />
              <directionalLight position={[-10, 10, -5]} intensity={0.6} />
              <pointLight position={[0, -5, 5]} intensity={0.4} />

              <Center top>
                <Clip3DScene 
                  config={config} 
                  topGeometries={topGeometries}
                  mergedGeometry={null}
                />
              </Center>

              <OrbitControls
                makeDefault
                minDistance={4}
                maxDistance={35}
                maxPolarAngle={Math.PI / 2 + 0.1}
              />
            </Canvas>
          </div>

          {/* VIEWPORT OVERLAYS */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            {!isGalleryOpen && (
              <button
                onClick={() => setIsGalleryOpen(true)}
                className="px-3 py-2 bg-white hover:bg-[#F3F4EE] border border-[#632CE5]/50 text-[#632CE5] rounded-lg shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-bold transition-all cursor-pointer group hover:scale-105"
                title="Expandir painel lateral de miniaturas"
              >
                <LayoutGrid className="w-4 h-4 text-[#632CE5] group-hover:rotate-12 transition-transform" />
                <span>Galeria Line Art ({PRESETS.length})</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => setConfig(prev => ({ ...prev, showWireframe: !prev.showWireframe }))}
              className={`p-2 rounded-lg border backdrop-blur-md transition-all cursor-pointer ${
                config.showWireframe 
                  ? "bg-[#632CE5]/20 border-[#632CE5] text-[#632CE5]" 
                  : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:text-[#1A1C19]"
              }`}
              title="Alternar modo aramado / malha 3D"
            >
              <Box className="w-4 h-4" />
            </button>
          </div>

          {/* FLOATING CONTROLS INFO FOOTER */}
          <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md shadow-lg border border-[#E2E3DD] px-3 py-1.5 rounded-lg flex items-center gap-3 text-[10px] font-mono text-[#494455] pointer-events-auto">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#632CE5] animate-pulse" />
                Preview 3D em Tempo Real
              </span>
              <span>•</span>
              <span>Botão Esquerdo: Girar</span>
              <span>•</span>
              <span>Scroll: Zoom</span>
              <span>•</span>
              <span>Botão Direito: Pan</span>
            </div>

            <div className="bg-white/90 backdrop-blur-md shadow-lg border border-[#E2E3DD] px-3 py-1.5 rounded-lg text-[10px] font-mono text-[#494455] pointer-events-auto">
              Modelo: <strong className="text-[#1A1C19]">{activePresetId || 'Personalizado'}</strong> ({config.sizeCategory})
            </div>
          </div>
        </div>

        {/* --- RIGHT LATERAL PANEL: GRADE DE MINIATURAS LINE ART --- */}
        {isGalleryOpen && (
          <aside className="w-[360px] xl:w-[410px] bg-white border-l border-[#E2E3DD] flex flex-col shrink-0 overflow-hidden shadow-2xl animate-in slide-in-from-right-4 duration-200 z-20">
            {/* PANEL HEADER */}
            <div className="p-3.5 border-b border-[#E2E3DD] bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-[#632CE5]/10 border border-[#632CE5]/30 flex items-center justify-center text-[#632CE5]">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1C19] flex items-center gap-2">
                    Galeria Line Art
                    <span className="bg-[#632CE5]/10 text-[#632CE5] text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                      {filteredGalleryPresets.length} modelos
                    </span>
                  </h3>
                  <p className="text-[9px] text-[#687064]">
                    Flores, corações e formas geométricas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setGalleryCategory("all");
                    setGallerySearch("");
                  }}
                  className="p-1.5 text-[#687064] hover:text-[#494455] hover:bg-[#F3F4EE] rounded text-[10px] transition-colors cursor-pointer"
                  title="Limpar filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsGalleryOpen(false)}
                  className="p-1.5 text-[#687064] hover:text-[#1A1C19] hover:bg-[#E8E9E3] rounded transition-colors cursor-pointer"
                  title="Minimizar painel lateral"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* LIVE SEARCH BAR */}
            <div className="p-3 border-b border-[#E2E3DD] bg-white shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#687064]" />
                <input
                  type="text"
                  placeholder="Buscar rosa, coração, diamante, estrela..."
                  value={gallerySearch}
                  onChange={e => setGallerySearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 bg-white border border-[#E2E3DD] focus:border-[#632CE5] rounded-md text-xs text-[#1A1C19] placeholder-[#687064] outline-none transition-colors"
                />
                {gallerySearch && (
                  <button
                    onClick={() => setGallerySearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#687064] hover:text-[#1A1C19]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* CATEGORY FILTER PILLS */}
            <div className="px-3 py-2 border-b border-[#E2E3DD] bg-[#F9FAF4] flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
              {[
                { id: "all", label: "Todos", count: PRESETS.length },
                { id: "floral", label: "🌸 Flores", count: PRESETS.filter(p => p.category === "floral").length },
                { id: "symbols", label: "❤️ Corações", count: PRESETS.filter(p => p.category === "symbols").length },
                { id: "geometric", label: "🔷 Geometria", count: PRESETS.filter(p => p.category === "geometric").length },
                { id: "cute", label: "🦋 Fofos", count: PRESETS.filter(p => p.category === "cute").length },
                { id: "giant", label: "🪽 Gigantes", count: PRESETS.filter(p => p.category === "giant").length },
              ].map(cat => {
                const isActive = galleryCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setGalleryCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#632CE5] text-white border-[#632CE5] font-black shadow-sm shadow-[#632CE5]/20"
                        : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:text-[#1A1C19] hover:bg-[#E8E9E3]"
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className={`text-[8px] px-1 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-[#E8E9E3] text-[#494455]'}`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* THUMBNAIL GRID BODY */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
              {filteredGalleryPresets.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3">
                  <Shapes className="w-8 h-8 text-[#7A7487] mx-auto" />
                  <p className="text-xs text-[#494455] font-bold">Nenhum desenho encontrado</p>
                  <p className="text-[10px] text-[#7A7487]">Tente buscar por outro termo ou limpe os filtros de categoria.</p>
                  <button
                    onClick={() => {
                      setGalleryCategory("all");
                      setGallerySearch("");
                    }}
                    className="px-3 py-1.5 bg-[#F3F4EE] hover:bg-[#E8E9E3] text-[#632CE5] text-xs font-bold rounded border border-[#CAC3D8] cursor-pointer"
                  >
                    Ver Todos os Modelos
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredGalleryPresets.map(preset => {
                    const isSelected = activePresetId === preset.id && !customSvgString;
                    return (
                      <div
                        key={`gallery-${preset.id}`}
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-2 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden group ${
                          isSelected
                            ? "bg-[#632CE5]/10 border-[#632CE5] ring-2 ring-[#632CE5]/40 shadow-lg shadow-[#632CE5]/15"
                            : "bg-white border-[#E2E3DD] hover:border-[#CAC3D8] hover:bg-[#F3F4EE] hover:scale-[1.02]"
                        }`}
                      >
                        {/* THUMBNAIL VECTOR DISPLAY */}
                        <div className="w-full h-24 bg-[#F3F4EE] rounded-lg border border-[#E2E3DD] mb-2 flex items-center justify-center p-2 relative overflow-hidden group-hover:border-[#632CE5]/50 transition-colors">
                          <div
                            className="w-16 h-16 text-[#632CE5] flex items-center justify-center pointer-events-none transition-transform duration-300 group-hover:scale-115 drop-shadow-[0_0_8px_rgba(99,44,229,0.35)]"
                            dangerouslySetInnerHTML={{ __html: preset.svg }}
                          />

                          {/* SIZE BADGE */}
                          <span className={`absolute top-1.5 right-1.5 text-[7px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                            preset.sizeCategory === "small" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                            preset.sizeCategory === "medium" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                            preset.sizeCategory === "large" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                            "bg-[#632CE5]/20 text-[#7C4DFF] border border-[#632CE5]/30"
                          }`}>
                            {preset.sizeCategory}
                          </span>

                          {/* ICON EMOJI */}
                          <span className="absolute bottom-1.5 right-1.5 text-xs opacity-75 group-hover:opacity-100 transition-opacity">
                            {preset.icon}
                          </span>

                          {/* SELECTED CHECKMARK BADGE */}
                          {isSelected && (
                            <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-[#632CE5] text-white flex items-center justify-center shadow-md shadow-[#632CE5]/40">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        {/* NAME AND DETAILS */}
                        <div className="px-0.5 pb-0.5">
                          <h4 className={`text-[11px] font-black uppercase tracking-tight truncate leading-tight ${isSelected ? "text-[#632CE5]" : "text-[#1A1C19]"}`}>
                            {preset.name}
                          </h4>
                          <div className="flex items-center justify-between mt-1 text-[8px] font-mono text-[#687064]">
                            <span className="capitalize">{preset.category}</span>
                            <span className="text-[#494455]">
                              {preset.defaultTopStyle === "line_art" ? "Line Art" : preset.defaultTopStyle === "solid_embossed" ? "Sólido" : "Medalhão"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PANEL FOOTER: QUICK STYLE SWITCHER */}
            <div className="p-3 border-t border-[#E2E3DD] bg-white space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase text-[#494455] font-bold">Modo 3D do Topo</span>
                <button
                  onClick={() => setActiveTab("top")}
                  className="text-[9px] font-mono text-[#632CE5] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  Configurações <ChevronRight className="w-2.5 h-2.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "line_art", label: "Line Art" },
                  { id: "solid_embossed", label: "Sólido" },
                  { id: "badge_plate", label: "Medalhão" },
                ].map(st => (
                  <button
                    key={`quick-st-${st.id}`}
                    onClick={() => setConfig(prev => ({ ...prev, topStyle: st.id as any }))}
                    className={`py-1.5 px-1 rounded text-[9px] font-bold text-center border transition-all cursor-pointer ${
                      config.topStyle === st.id
                        ? "bg-[#632CE5]/20 border-[#632CE5] text-[#632CE5]"
                        : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:text-[#1A1C19]"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
} 
