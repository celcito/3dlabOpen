import React, { useState, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center } from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError, toastActionSuccess } from "@/lib/toast";
import { 
  Settings2, Download, Code, Play, Type, Settings, 
  Circle, Layers, AlignJustify, Copy, Check, Eye, EyeOff
} from "lucide-react";

type BeltProfile = 'GT2' | 'HTD3M' | 'HTD5M' | 'MXL' | 'XL' | 'L' | 'T5' | 'T10';
type FlangeType = 'none' | 'top' | 'both';
type BoreType = 'round' | 'D' | 'keyway' | 'hex';

interface PulleyConfig {
  profile: BeltProfile;
  teeth: number;
  width: number;
  flange_type: FlangeType;
  flange_thickness: number;
  flange_overhang: number;
  bore_type: BoreType;
  hole_d: number;
  hub_enabled: boolean;
  hub_d: number;
  hub_l: number;
  set_screw_d: number;
  set_screw_count: number;
  set_screw_angle: number;
  set_screw_offset: number;
  keyway_w_override: number;
  keyway_h_override: number;
}

const BELT_PROFILES: Record<BeltProfile, { pitch: number; depth: number }> = {
  'GT2': { pitch: 2.0, depth: 0.75 },
  'HTD3M': { pitch: 3.0, depth: 1.14 },
  'HTD5M': { pitch: 5.0, depth: 2.06 },
  'MXL': { pitch: 2.032, depth: 0.51 },
  'XL': { pitch: 5.08, depth: 1.27 },
  'L': { pitch: 9.525, depth: 1.91 },
  'T5': { pitch: 5.0, depth: 1.2 },
  'T10': { pitch: 10.0, depth: 2.5 },
};

export default function PulleyGenerator() {
  const [config, setConfig] = useState<PulleyConfig>({
    profile: 'GT2',
    teeth: 20,
    width: 10,
    flange_type: 'both',
    flange_thickness: 1,
    flange_overhang: 1.5,
    bore_type: 'round',
    hole_d: 5,
    hub_enabled: false,
    hub_d: 15,
    hub_l: 10,
    set_screw_d: 3,
    set_screw_count: 1,
    set_screw_angle: 0,
    set_screw_offset: 0,
    keyway_w_override: 0,
    keyway_h_override: 0,
  });
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const profileData = BELT_PROFILES[config.profile];

  const generateScad = () => {
    return `// BOSL2 Timing Pulley Generator
include <BOSL2/std.scad>

// --- Configuration ---
$fn = 64;
profile = "${config.profile}";
pitch = ${profileData.pitch};
tooth_depth = ${profileData.depth};
teeth = ${config.teeth};
width = ${config.width};

flange_type = "${config.flange_type}";
flange_thickness = ${config.flange_thickness};
flange_overhang = ${config.flange_overhang};

bore_type = "${config.bore_type}";
hole_d = ${config.hole_d};
keyway_w = ${config.keyway_w_override > 0 ? config.keyway_w_override : config.hole_d * 0.25};
keyway_h = ${config.keyway_h_override > 0 ? config.keyway_h_override : config.hole_d * 0.25};

hub_enabled = ${config.hub_enabled};
hub_d = ${config.hub_d};
hub_l = ${config.hub_l};
set_screw_d = ${config.set_screw_d};
set_screw_count = ${config.set_screw_count};
set_screw_angle = ${config.set_screw_angle};
set_screw_offset = ${config.set_screw_offset};

// --- Computed Values ---
pitch_r = (pitch * teeth) / (2 * PI);
outer_r = pitch_r - (tooth_depth / 2);
flange_r = outer_r + flange_overhang;

module custom_bore(thickness, d, type) {
    if (d > 0) {
        if (type == "round") {
            cylinder(h=thickness*3, d=d, center=true);
        } else if (type == "D") {
            intersection() {
                cylinder(h=thickness*3, d=d, center=true);
                translate([0, d*0.1, 0]) cube([d*2, d*0.8, thickness*3], center=true);
            }
        } else if (type == "keyway") {
            union() {
                cylinder(h=thickness*3, d=d, center=true);
                translate([0, d/2 + keyway_h/2, 0]) cube([keyway_w, keyway_h, thickness*3], center=true);
            }
        } else if (type == "hex") {
            cylinder(h=thickness*3, d=d / cos(30), $fn=6, center=true);
        }
    }
}

module pulley_hub(hub_d, hub_l, base_thickness, set_screw_d, count) {
    if (hub_enabled && hub_d > 0 && hub_l > 0) {
        difference() {
            translate([0, 0, base_thickness]) cylinder(h=hub_l, d=hub_d);
            if (set_screw_d > 0 && count > 0) {
                for (i = [0:count-1]) {
                    rotate([0, 0, i * (360 / count)])
                    translate([0, 0, base_thickness + (hub_l/2) + set_screw_offset]) 
                    rotate([0, 90, set_screw_angle]) 
                    cylinder(h=hub_d*2, d=set_screw_d);
                }
            }
        }
    }
}

module timing_pulley_teeth(teeth, pitch, tooth_depth, width) {
    pr = (pitch * teeth) / (2 * PI);
    or = pr;
    linear_extrude(height=width) {
        difference() {
            circle(r=or);
            for(i=[0:teeth-1]) {
                rotate([0, 0, i * (360/teeth)])
                translate([or, 0, 0])
                scale([1, 1.2])
                circle(r=tooth_depth);
            }
        }
    }
}

// --- Render ---
difference() {
    union() {
        timing_pulley_teeth(teeth, pitch, tooth_depth, width);
        if (flange_type == "both") {
            cylinder(h=flange_thickness, r=flange_r);
        }
        if (flange_type == "both" || flange_type == "top") {
            translate([0, 0, width - flange_thickness])
            cylinder(h=flange_thickness, r=flange_r);
        }
        if (hub_enabled) {
            pulley_hub(hub_d, hub_l, width, set_screw_d, set_screw_count);
        }
    }
    custom_bore(width + (hub_enabled ? hub_l : 0), hole_d, bore_type);
}
`;
  };

  const handleExportSTL = () => {
    try {
      const exporter = new STLExporter();
      const geoms = createPulleyGeometry(config, profileData);
      const group = new THREE.Group();
      geoms.forEach(g => {
        const mesh = new THREE.Mesh(g);
        group.add(mesh);
      });
      group.rotation.x = -Math.PI / 2;
      group.updateMatrixWorld(true);

      const result = exporter.parse(group, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `pulley_${config.profile}_${config.teeth}T_${Date.now()}.stl`;
      link.click();
      toastActionSuccess("STL exportado com sucesso!");
    } catch (err) {
      console.error(err);
      toastExportError();
    }
  };

  const handleDownloadScad = () => {
    const code = generateScad();
    const blob = new Blob([code], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pulley_${config.profile}_${config.teeth}T_${Date.now()}.scad`;
    link.click();
  };

  const handleCopyScad = () => {
    navigator.clipboard.writeText(generateScad());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toastActionSuccess("Código OpenSCAD copiado!");
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#F9FAF4]">
      {/* SIDEBAR */}
      <div className="w-full md:w-[400px] bg-[#F9FAF4] border-r border-[#E2E3DD] overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
              <Settings className="w-6 h-6 text-[#632CE5]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-[#1A1C19]">Pulley Gen</h1>
          </div>
          <p className="text-[10px] text-[#687064] font-bold tracking-widest uppercase leading-relaxed">
            Parametric timing pulleys. GT2, HTD, MXL, and more.
          </p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5 text-[#632CE5]" />
              01. Perfil da Correia
            </h3>
            
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(BELT_PROFILES) as BeltProfile[]).map(t => (
                <button
                  key={t}
                  onClick={() => setConfig({...config, profile: t})}
                  className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                    config.profile === t
                      ? "bg-[#632CE5]/10 border-[#632CE5]/50 text-[#632CE5]"
                      : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            
            <div className="bg-[#F3F4EE] p-3 rounded-lg border border-[#E2E3DD] flex justify-between">
              <div>
                <p className="text-[9px] text-[#687064] font-bold uppercase">Passo (Pitch)</p>
                <p className="text-xs text-[#1A1C19] font-mono">{profileData.pitch} mm</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-[#687064] font-bold uppercase">Profundidade</p>
                <p className="text-xs text-[#1A1C19] font-mono">{profileData.depth} mm</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
              <AlignJustify className="w-3.5 h-3.5 text-[#632CE5]" />
              02. Dimensões
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-[#494455]">Qtd Dentes</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.teeth}</span>
              </div>
              <input 
                type="range" min="10" max="150" step="1" 
                value={config.teeth}
                onChange={(e) => setConfig({...config, teeth: parseInt(e.target.value)})}
                className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-[#494455]">Largura (Width)</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.width}</span>
              </div>
              <input 
                type="range" min="4" max="50" step="0.5" 
                value={config.width}
                onChange={(e) => setConfig({...config, width: parseFloat(e.target.value)})}
                className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-[#632CE5]" />
              03. Flanges
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'none', label: 'Nenhuma' },
                { id: 'top', label: 'Topo' },
                { id: 'both', label: 'Ambas' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setConfig({...config, flange_type: t.id as FlangeType})}
                  className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                    config.flange_type === t.id
                      ? "bg-[#632CE5]/10 border-[#632CE5]/50 text-[#632CE5]"
                      : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {config.flange_type !== 'none' && (
              <>
                <div className="space-y-3 mt-2">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Espessura Flange</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.flange_thickness}</span>
                  </div>
                  <input type="range" min="0.5" max="5" step="0.1" value={config.flange_thickness} onChange={(e) => setConfig({...config, flange_thickness: parseFloat(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Overhang Flange</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.flange_overhang}</span>
                  </div>
                  <input type="range" min="0.5" max="5" step="0.1" value={config.flange_overhang} onChange={(e) => setConfig({...config, flange_overhang: parseFloat(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
              </>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
              <Circle className="w-3.5 h-3.5 text-[#632CE5]" />
              Furo (Bore)
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-[#494455]">Diâmetro do Furo</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.hole_d}</span>
              </div>
              <input type="range" min="0" max="50" step="0.5" value={config.hole_d} onChange={(e) => setConfig({...config, hole_d: parseFloat(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
            </div>
            
            {config.hole_d > 0 && (
              <div className="space-y-3">
                <label className="text-[9px] uppercase font-bold text-[#494455] block">Tipo de Furo</label>
                <select 
                  value={config.bore_type} 
                  onChange={(e) => setConfig({...config, bore_type: e.target.value as BoreType})}
                  className="w-full bg-white border border-[#E2E3DD] rounded-lg p-2 text-xs text-[#1A1C19]"
                >
                  <option value="round">Cilíndrico (Round)</option>
                  <option value="D">Perfil D (D-Shaft)</option>
                  <option value="keyway">Chaveta (Keyway)</option>
                  <option value="hex">Sextavado (Hex)</option>
                </select>
              </div>
            )}

            {config.bore_type === 'keyway' && (
              <div className="space-y-3 pt-2 pl-4 border-l-2 border-[#E2E3DD]">
                <div className="flex justify-between">
                  <label className="text-[9px] uppercase font-bold text-[#494455]">Largura Chaveta (0 = Auto)</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{config.keyway_w_override}mm</span>
                </div>
                <input type="range" min="0" max="10" step="0.5" value={config.keyway_w_override} onChange={(e) => setConfig({...config, keyway_w_override: parseFloat(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                
                <div className="flex justify-between mt-3">
                  <label className="text-[9px] uppercase font-bold text-[#494455]">Alt. Chaveta (0 = Auto)</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{config.keyway_h_override}mm</span>
                </div>
                <input type="range" min="0" max="10" step="0.5" value={config.keyway_h_override} onChange={(e) => setConfig({...config, keyway_h_override: parseFloat(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                Hub / Eixo
              </h3>
              <button 
                onClick={() => setConfig({...config, hub_enabled: !config.hub_enabled})}
                className={`w-8 h-4 rounded-full transition-colors relative ${config.hub_enabled ? 'bg-[#632CE5]' : 'bg-[#CAC3D8]'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${config.hub_enabled ? 'left-4.5 translate-x-full' : 'left-0.5'}`} />
              </button>
            </div>
            {config.hub_enabled && (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Diâmetro do Hub</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.hub_d}</span>
                  </div>
                  <input type="range" min="5" max="100" step="1" value={config.hub_d} onChange={(e) => setConfig({...config, hub_d: parseFloat(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Comprimento do Hub</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.hub_l}</span>
                  </div>
                  <input type="range" min="1" max="50" step="1" value={config.hub_l} onChange={(e) => setConfig({...config, hub_l: parseFloat(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-[9px] uppercase font-bold text-[#494455]">Parafusos</label>
                      <span className="text-[10px] font-mono text-[#632CE5]">{config.set_screw_count}</span>
                    </div>
                    <input type="range" min="0" max="4" step="1" value={config.set_screw_count} onChange={(e) => setConfig({...config, set_screw_count: parseInt(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-[9px] uppercase font-bold text-[#494455]">Diâmetro (M)</label>
                      <span className="text-[10px] font-mono text-[#632CE5]">{config.set_screw_d}mm</span>
                    </div>
                    <input type="range" min="1" max="10" step="0.5" value={config.set_screw_d} onChange={(e) => setConfig({...config, set_screw_d: parseFloat(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-[9px] uppercase font-bold text-[#494455]">Ângulo Parafuso</label>
                      <span className="text-[10px] font-mono text-[#632CE5]">{config.set_screw_angle}°</span>
                    </div>
                    <input type="range" min="0" max="360" step="15" value={config.set_screw_angle} onChange={(e) => setConfig({...config, set_screw_angle: parseInt(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-[9px] uppercase font-bold text-[#494455]">Offset (Z)</label>
                      <span className="text-[10px] font-mono text-[#632CE5]">{config.set_screw_offset}mm</span>
                    </div>
                    <input type="range" min="-20" max="20" step="1" value={config.set_screw_offset} onChange={(e) => setConfig({...config, set_screw_offset: parseInt(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-[#E2E3DD] pb-10">
            <div className="flex flex-col gap-2">
              <button
                onClick={handleExportSTL}
                className="w-full bg-[#632CE5] text-[#1A1C19] py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#7C4DFF] transition-all shadow-md group"
              >
                <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                Download Preview STL
              </button>
              <button
                onClick={handleDownloadScad}
                className="w-full bg-[#F3F4EE] text-[#1A1C19] py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-[#CAC3D8] transition-all group"
              >
                <Code className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                Download OpenSCAD (.scad)
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* CODE & 3D PREVIEW AREA */}
      <div className="flex-1 flex flex-col h-full bg-[#F1F3ED] relative">
        <div className={`${showPreview ? "h-2/5 md:h-1/3" : "flex-1"} border-b border-[#E2E3DD] bg-white relative flex flex-col`}>
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
            <Code className="w-4 h-4 text-[#632CE5]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#494455]">OpenSCAD Code</span>
          </div>
          <div className="absolute top-4 right-6 z-10 flex items-center gap-2">
            <button
              onClick={handleCopyScad}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black uppercase tracking-widest text-[10px] transition-all ${
                copied
                  ? "bg-[#632CE5]/10 border-[#632CE5]/50 text-[#632CE5]"
                  : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado" : "Copy Code"}
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black uppercase tracking-widest text-[10px] transition-all ${
                showPreview
                  ? "bg-white/80 backdrop-blur-md border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                  : "bg-[#632CE5]/10 border-[#632CE5]/50 text-[#632CE5]"
              }`}
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? "Ocultar Preview" : "Mostrar Preview"}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6 pt-12 custom-scrollbar">
            <pre className="text-[11px] font-mono text-[#1A1C19] leading-relaxed">
              {generateScad()}
            </pre>
          </div>
        </div>

        {showPreview && (
          <div className="flex-1 relative">
            <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
              <Play className="w-4 h-4 text-[#632CE5]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#494455]">Visualização Simbólica</span>
            </div>
            <Canvas shadows camera={{ position: [30, 30, 30], fov: 45 }}>
              <color attach="background" args={["#F1F3ED"]} />
              <ambientLight intensity={0.5} />
              <spotLight position={[50, 50, 50]} angle={0.2} penumbra={1} castShadow />
              <pointLight position={[-50, -50, -50]} intensity={0.5} />
              <OrbitControls makeDefault />
              
              <Grid 
                infiniteGrid 
                fadeDistance={100} 
                sectionColor="#632CE5" 
                cellColor="#E2E3DD" 
                cellSize={2} 
                sectionSize={10} 
              />

              <Center>
                <PlaceholderPulley config={config} profileData={profileData} />
              </Center>
            </Canvas>
          </div>
        )}
      </div>
    </div>
  );
}

function createPulleyGeometry(config: PulleyConfig, profileData: { pitch: number; depth: number }) {
  const shape = new THREE.Shape();
  
  const pitch_r = (profileData.pitch * config.teeth) / (2 * Math.PI);
  const outer_r = pitch_r;
  const tooth_r = profileData.depth;
  
  const numPts = config.teeth * 4;
  for (let i = 0; i <= numPts; i++) {
    const a = (i / numPts) * Math.PI * 2;
    const teethAngle = (Math.PI * 2) / config.teeth;
    const la = a % teethAngle;
    const t = la / teethAngle;
    
    let r = outer_r;
    if (t < 0.3) {
      r = outer_r - tooth_r * Math.sin((t / 0.3) * Math.PI);
    }
    
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  
  if (config.hole_d > 0) {
    const hole = new THREE.Path();
    const d = config.hole_d;
    
    if (config.bore_type === 'round') {
      hole.absarc(0, 0, d / 2, 0, Math.PI * 2, true);
    } else if (config.bore_type === 'D') {
      hole.moveTo(d / 2, d / 2 * 0.5);
      hole.lineTo(d / 2, -d / 2);
      hole.lineTo(-d / 2, -d / 2);
      hole.lineTo(-d / 2, d / 2 * 0.5);
      hole.lineTo(d / 2, d / 2 * 0.5);
    } else if (config.bore_type === 'keyway') {
      hole.absarc(0, 0, d / 2, 0, Math.PI * 2, true);
      const kw = config.keyway_w_override > 0 ? config.keyway_w_override : d * 0.25;
      const kh = config.keyway_h_override > 0 ? config.keyway_h_override : d * 0.25;
      hole.moveTo(kw / 2, d / 2);
      hole.lineTo(kw / 2, d / 2 + kh);
      hole.lineTo(-kw / 2, d / 2 + kh);
      hole.lineTo(-kw / 2, d / 2);
    } else if (config.bore_type === 'hex') {
      const hexR = (d / 2) / Math.cos(Math.PI / 6);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI/2;
        if (i === 0) hole.moveTo(Math.cos(a) * hexR, Math.sin(a) * hexR);
        else hole.lineTo(Math.cos(a) * hexR, Math.sin(a) * hexR);
      }
      hole.lineTo(Math.cos(Math.PI/2) * hexR, Math.sin(Math.PI/2) * hexR);
    }
    shape.holes.push(hole);
  }

  const baseGeom = new THREE.ExtrudeGeometry(shape, {
    depth: config.width,
    bevelEnabled: false,
    curveSegments: 32,
  });

  const geoms = [baseGeom];

  const flange_r = pitch_r + config.flange_overhang;
  const flangeShape = new THREE.Shape();
  flangeShape.absarc(0, 0, flange_r, 0, Math.PI * 2, false);
  
  if (config.hole_d > 0) {
    const flangeHole = new THREE.Path();
    flangeHole.absarc(0, 0, config.hole_d / 2, 0, Math.PI * 2, true);
    flangeShape.holes.push(flangeHole);
  }

  const flangeGeom = new THREE.ExtrudeGeometry(flangeShape, {
    depth: config.flange_thickness,
    bevelEnabled: false,
    curveSegments: 32
  });

  if (config.flange_type === 'both') {
    const bottomFlange = flangeGeom.clone();
    geoms.push(bottomFlange);
  }
  if (config.flange_type === 'both' || config.flange_type === 'top') {
    const topFlange = flangeGeom.clone();
    topFlange.translate(0, 0, config.width - config.flange_thickness);
    geoms.push(topFlange);
  }

  if (config.hub_enabled && config.hub_d > 0 && config.hub_l > 0) {
    const hubShape = new THREE.Shape();
    hubShape.absarc(0, 0, config.hub_d / 2, 0, Math.PI * 2, false);
    if (config.hole_d > 0 && shape.holes.length > 0) {
      hubShape.holes.push(shape.holes[0]); 
    }
    const hubGeom = new THREE.ExtrudeGeometry(hubShape, {
      depth: config.hub_l,
      bevelEnabled: false,
      curveSegments: 32
    });
    hubGeom.translate(0, 0, config.width);
    geoms.push(hubGeom);
  }

  return geoms;
}

function PlaceholderPulley({ config, profileData }: { config: PulleyConfig, profileData: any }) {
  const geoms = useMemo(() => createPulleyGeometry(config, profileData), [config, profileData]);

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {geoms.map((g, i) => (
        <mesh key={i} castShadow receiveShadow geometry={g}>
          <meshStandardMaterial 
            color="#eeeeee" 
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}
