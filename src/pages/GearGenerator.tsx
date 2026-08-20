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

type GearType = 'spur' | 'ring' | 'crown' | 'bevel' | 'worm' | 'worm_gear' | 'rack';
type PitchType = 'circular' | 'module';
type BoreType = 'round' | 'D' | 'keyway' | 'spline';

interface GearConfig {
  type: GearType;
  pitch_type: PitchType;
  pitch_value: number;
  teeth: number;
  thickness: number;
  pressure_angle: number;
  clearance: number;
  helical: number;
  hole_d: number;
  bore_type: BoreType;
  hub_enabled: boolean;
  hub_d: number;
  hub_l: number;
  set_screw_d: number;
  rack_teeth: number;
  rack_height: number;
  mate_teeth: number;
  worm_starts: number;
  worm_diam: number;
  worm_length: number;
  spiral: number;
  cutter_radius: number;
}

export default function GearGenerator() {
  const [config, setConfig] = useState<GearConfig>({
    type: 'spur',
    pitch_type: 'module',
    pitch_value: 2,
    teeth: 20,
    thickness: 10,
    pressure_angle: 20,
    clearance: 0.2,
    helical: 0,
    hole_d: 5,
    bore_type: 'round',
    hub_enabled: false,
    hub_d: 15,
    hub_l: 10,
    set_screw_d: 3,
    rack_teeth: 20,
    rack_height: 10,
    mate_teeth: 20,
    worm_starts: 1,
    worm_diam: 15,
    worm_length: 30,
    spiral: 30,
    cutter_radius: 20,
  });
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const generateScad = () => {
    let code = `// BOSL2 Gear Generator
include <BOSL2/std.scad>
include <BOSL2/gears.scad>

// --- Configuration ---
$fn = 64;
pitch_type = "${config.pitch_type}";
pitch_value = ${config.pitch_value};
thickness = ${config.thickness};
pressure_angle = ${config.pressure_angle};
clearance = ${config.clearance};

circ_pitch = pitch_type == "circular" ? pitch_value : pitch_value * PI;
mod = pitch_type == "module" ? pitch_value : pitch_value / PI;

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
                translate([0, d/2, 0]) cube([d*0.25, d*0.25, thickness*3], center=true);
            }
        } else if (type == "spline") {
            union() {
                cylinder(h=thickness*3, d=d*0.8, center=true);
                for(i=[0:5]) rotate([0,0,i*60]) cube([d*0.2, d*1.1, thickness*3], center=true);
            }
        }
    }
}

module gear_hub(hub_d, hub_l, thickness, set_screw_d) {
    if (hub_d > 0 && hub_l > 0) {
        difference() {
            translate([0, 0, thickness/2]) cylinder(h=hub_l, d=hub_d);
            if (set_screw_d > 0) {
                translate([0, 0, thickness/2 + hub_l/2]) rotate([0, 90, 0]) cylinder(h=hub_d*2, d=set_screw_d, center=true);
            }
        }
    }
}
`;

    if (config.type === 'spur') {
      code += `teeth = ${config.teeth};
helical = ${config.helical};
hole_d = ${config.hole_d};
bore_type = "${config.bore_type}";
hub_enabled = ${config.hub_enabled};
hub_d = ${config.hub_d};
hub_l = ${config.hub_l};
set_screw_d = ${config.set_screw_d};

// --- Render ---
difference() {
    union() {
        spur_gear(circ_pitch=circ_pitch, teeth=teeth, thickness=thickness, 
                  helical=helical, pressure_angle=pressure_angle, clearance=clearance, hole_d=0);
        if (hub_enabled) {
            gear_hub(hub_d, hub_l, thickness, set_screw_d);
        }
    }
    custom_bore(thickness + (hub_enabled ? hub_l : 0), hole_d, bore_type);
}
`;
    } else if (config.type === 'ring') {
      code += `teeth = ${config.teeth};
helical = ${config.helical};

// --- Render ---
spur_gear(circ_pitch=circ_pitch, teeth=teeth, thickness=thickness, 
          helical=helical, pressure_angle=pressure_angle, clearance=clearance, internal=true);
`;
    } else if (config.type === 'rack') {
      code += `teeth = ${config.rack_teeth};
height = ${config.rack_height};
helical = ${config.helical};

// --- Render ---
rack(circ_pitch=circ_pitch, teeth=teeth, thickness=thickness, height=height, 
     pressure_angle=pressure_angle, helical=helical, clearance=clearance);
`;
    } else if (config.type === 'bevel') {
      code += `teeth = ${config.teeth};
mate_teeth = ${config.mate_teeth};
hole_d = ${config.hole_d};
spiral = ${config.spiral};
cutter_radius = ${config.cutter_radius};

// --- Render ---
difference() {
    bevel_gear(circ_pitch=circ_pitch, teeth=teeth, mate_teeth=mate_teeth, thickness=thickness, 
               spiral=spiral, cutter_radius=cutter_radius, pressure_angle=pressure_angle, clearance=clearance, hole_d=0);
    custom_bore(thickness, hole_d, "${config.bore_type}");
}
`;
    } else if (config.type === 'crown') {
      code += `teeth = ${config.teeth};
mate_teeth = ${config.mate_teeth};
hole_d = ${config.hole_d};

// --- Render ---
difference() {
    bevel_gear(circ_pitch=circ_pitch, teeth=teeth, mate_teeth=mate_teeth, thickness=thickness, 
               pitch_angle=90, pressure_angle=pressure_angle, clearance=clearance, hole_d=0);
    custom_bore(thickness, hole_d, "${config.bore_type}");
}
`;
    } else if (config.type === 'worm_gear') {
      code += `teeth = ${config.teeth};
worm_starts = ${config.worm_starts};
worm_diam = ${config.worm_diam};
hole_d = ${config.hole_d};

// --- Render ---
difference() {
    worm_gear(circ_pitch=circ_pitch, teeth=teeth, worm_starts=worm_starts, worm_diam=worm_diam, 
              thickness=thickness, pressure_angle=pressure_angle, clearance=clearance, hole_d=0);
    custom_bore(thickness, hole_d, "${config.bore_type}");
}
`;
    } else if (config.type === 'worm') {
      code += `starts = ${config.worm_starts};
d = ${config.worm_diam};
l = ${config.worm_length};
hole_d = ${config.hole_d};

// --- Render ---
difference() {
    worm(circ_pitch=circ_pitch, starts=starts, d=d, l=l, 
         pressure_angle=pressure_angle, clearance=clearance, hole_d=0);
    custom_bore(l, hole_d, "${config.bore_type}");
}
`;
    }

    return code;
  };

  const handleExportSTL = () => {
    try {
      const exporter = new STLExporter();
      const geometry = createGearGeometry(config);
      const mesh = new THREE.Mesh(geometry);
      
      // Printable orientation
      mesh.rotation.x = -Math.PI / 2;
      mesh.updateMatrixWorld();

      const result = exporter.parse(mesh, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `gear_preview_${config.type}_${Date.now()}.stl`;
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
    link.download = `gear_${config.type}_${Date.now()}.scad`;
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
            <h1 className="text-xl font-black uppercase tracking-tighter text-[#1A1C19]">BOSL2 Gear Gen</h1>
          </div>
          <p className="text-[10px] text-[#687064] font-bold tracking-widest uppercase leading-relaxed">
            Fully parametric spur, ring, crown, bevel, worm gears, and gear racks.
          </p>
        </header>

        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5 text-[#632CE5]" />
              01. Tipo de Engrenagem
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'spur', label: 'Spur Gear' },
                { id: 'ring', label: 'Ring (Internal)' },
                { id: 'rack', label: 'Gear Rack' },
                { id: 'bevel', label: 'Bevel Gear' },
                { id: 'crown', label: 'Crown Gear' },
                { id: 'worm', label: 'Worm' },
                { id: 'worm_gear', label: 'Worm Gear' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setConfig({...config, type: t.id as GearType})}
                  className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                    config.type === t.id
                      ? "bg-[#632CE5]/10 border-[#632CE5]/50 text-[#632CE5]"
                      : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
              <AlignJustify className="w-3.5 h-3.5 text-[#632CE5]" />
              02. Parâmetros Base
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-[#494455]">Tipo de Passo</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfig({...config, pitch_type: 'module'})}
                  className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                    config.pitch_type === 'module'
                      ? "bg-[#632CE5]/10 border-[#632CE5]/50 text-[#632CE5]"
                      : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                  }`}
                >
                  Módulo
                </button>
                <button
                  onClick={() => setConfig({...config, pitch_type: 'circular'})}
                  className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                    config.pitch_type === 'circular'
                      ? "bg-[#632CE5]/10 border-[#632CE5]/50 text-[#632CE5]"
                      : "bg-[#F3F4EE] border-[#E2E3DD] text-[#494455] hover:bg-[#E8E9E3]"
                  }`}
                >
                  Passo Circular
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-[#494455]">
                  {config.pitch_type === 'module' ? 'Valor do Módulo' : 'Passo Circular'}
                </label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.pitch_value}</span>
              </div>
              <input 
                type="range" min="0.5" max="20" step="0.5" 
                value={config.pitch_value}
                onChange={(e) => setConfig({...config, pitch_value: parseFloat(e.target.value)})}
                className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {config.type !== 'worm' && config.type !== 'rack' && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-[9px] uppercase font-bold text-[#494455]">Dentes (teeth)</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{config.teeth}</span>
                </div>
                <input 
                  type="range" min="6" max="100" step="1" 
                  value={config.teeth}
                  onChange={(e) => setConfig({...config, teeth: parseInt(e.target.value)})}
                  className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-[#494455]">Espessura (thickness)</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.thickness}</span>
              </div>
              <input 
                type="range" min="2" max="100" step="1" 
                value={config.thickness}
                onChange={(e) => setConfig({...config, thickness: parseInt(e.target.value)})}
                className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-[#494455]">Ângulo de Pressão</label>
                <span className="text-[10px] font-mono text-[#632CE5]">{config.pressure_angle}°</span>
              </div>
              <input 
                type="range" min="10" max="45" step="1" 
                value={config.pressure_angle}
                onChange={(e) => setConfig({...config, pressure_angle: parseFloat(e.target.value)})}
                className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-[#632CE5]" />
              03. Específicos do Tipo
            </h3>

            {(config.type === 'spur' || config.type === 'ring' || config.type === 'rack') && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-[9px] uppercase font-bold text-[#494455]">Ângulo Helicoidal</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{config.helical}°</span>
                </div>
                <input 
                  type="range" min="-45" max="45" step="1" 
                  value={config.helical}
                  onChange={(e) => setConfig({...config, helical: parseInt(e.target.value)})}
                  className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[8px] text-[#687064] uppercase">Valores positivos/negativos para roscas dir/esq.</p>
              </div>
            )}

            {config.type === 'rack' && (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Qtd Dentes Rack</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.rack_teeth}</span>
                  </div>
                  <input 
                    type="range" min="5" max="100" step="1" 
                    value={config.rack_teeth}
                    onChange={(e) => setConfig({...config, rack_teeth: parseInt(e.target.value)})}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Altura da Base</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.rack_height}</span>
                  </div>
                  <input 
                    type="range" min="2" max="50" step="1" 
                    value={config.rack_height}
                    onChange={(e) => setConfig({...config, rack_height: parseInt(e.target.value)})}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </>
            )}

            {(config.type === 'bevel' || config.type === 'crown') && (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Dentes da Eng. Mate</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.mate_teeth}</span>
                  </div>
                  <input 
                    type="range" min="6" max="100" step="1" 
                    value={config.mate_teeth}
                    onChange={(e) => setConfig({...config, mate_teeth: parseInt(e.target.value)})}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </>
            )}

            {(config.type === 'bevel') && (
              <>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Ângulo Espiral (Spiral)</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.spiral}°</span>
                  </div>
                  <input type="range" min="0" max="45" step="1" value={config.spiral} onChange={(e) => setConfig({...config, spiral: parseInt(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Raio do Cortador (Cutter R)</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.cutter_radius}</span>
                  </div>
                  <input type="range" min="0" max="100" step="1" value={config.cutter_radius} onChange={(e) => setConfig({...config, cutter_radius: parseInt(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  <p className="text-[8px] text-[#687064] uppercase">Use spiral=0 e cutter_radius=0 para dentes retos.</p>
                </div>
              </>
            )}

            {(config.type === 'worm' || config.type === 'worm_gear') && (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Worm Starts</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.worm_starts}</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" step="1" 
                    value={config.worm_starts}
                    onChange={(e) => setConfig({...config, worm_starts: parseInt(e.target.value)})}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Diâmetro do Worm</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{config.worm_diam}</span>
                  </div>
                  <input 
                    type="range" min="5" max="100" step="1" 
                    value={config.worm_diam}
                    onChange={(e) => setConfig({...config, worm_diam: parseInt(e.target.value)})}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </>
            )}

            {config.type === 'worm' && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-[9px] uppercase font-bold text-[#494455]">Comprimento do Worm</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{config.worm_length}</span>
                </div>
                <input 
                  type="range" min="10" max="200" step="1" 
                  value={config.worm_length}
                  onChange={(e) => setConfig({...config, worm_length: parseInt(e.target.value)})}
                  className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>

          {(config.type !== 'rack' && config.type !== 'ring') && (
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
                    <option value="round">Redondo (Round)</option>
                    <option value="D">Perfil D (D-Shaft)</option>
                    <option value="keyway">Chaveta (Keyway)</option>
                    <option value="spline">Estriado (Spline)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {config.type === 'spur' && (
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
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-[9px] uppercase font-bold text-[#494455]">Parafuso de Fixação (Set Screw)</label>
                      <span className="text-[10px] font-mono text-[#632CE5]">{config.set_screw_d}mm</span>
                    </div>
                    <input type="range" min="0" max="10" step="0.5" value={config.set_screw_d} onChange={(e) => setConfig({...config, set_screw_d: parseFloat(e.target.value)})} className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="pt-4">
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
              <p className="text-[9px] text-[#687064] text-center uppercase tracking-wider px-2">
                O STL gerado é uma versão simplificada de preview. Para engenharia de precisão, utilize o arquivo .scad no OpenSCAD.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* CODE & 3D PREVIEW AREA */}
      <div className="flex-1 flex flex-col h-full bg-[#F1F3ED] relative">
        <div className={`${showPreview ? "h-2/5 md:h-1/2" : "flex-1"} border-b border-[#E2E3DD] bg-white relative flex flex-col`}>
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
            <Code className="w-4 h-4 text-[#632CE5]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#494455]">OpenSCAD BOSL2 Code</span>
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
            <Canvas shadows camera={{ position: [40, 40, 40], fov: 45 }}>
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
                <PlaceholderGear config={config} />
              </Center>
            </Canvas>
          </div>
        )}
      </div>
    </div>
  );
}

// Very rough approximation for 3D visualization purposes. 
// OpenSCAD provides the precise engineering geometry.

function createGearGeometry(config: GearConfig) {
  const shape = new THREE.Shape();
  
  // estimate circular pitch if module is used
  const cp = config.pitch_type === 'module' ? config.pitch_value * Math.PI : config.pitch_value;

  if (config.type === 'rack') {
    const length = config.rack_teeth * cp;
    const h = config.rack_height;
    const th = cp * 0.5;
    
    shape.moveTo(-length/2, 0);
    shape.lineTo(length/2, 0);
    shape.lineTo(length/2, h);
    
    // teeth
    for(let i=config.rack_teeth-1; i>=0; i--) {
      const xStart = (i * cp) - length/2;
      shape.lineTo(xStart + th, h);
      shape.lineTo(xStart + th*0.8, h + th*0.8);
      shape.lineTo(xStart + th*0.2, h + th*0.8);
      shape.lineTo(xStart, h);
    }
    shape.lineTo(-length/2, h);
    shape.lineTo(-length/2, 0);
    
  } else if (config.type === 'worm') {
    const r = config.worm_diam / 2;
    shape.moveTo(0,0);
    shape.absarc(0,0, r, 0, Math.PI*2, false);
  } else {
    const pr = (config.teeth * cp) / (Math.PI * 2);
    const outerR = pr + (cp / Math.PI);
    const rootR = pr - (cp / Math.PI) * 1.25;
    
    if (config.type === 'ring') {
      const extR = outerR + 10;
      shape.moveTo(0,0);
      shape.absarc(0,0, extR, 0, Math.PI*2, false);
      
      const hole = new THREE.Path();
      hole.absarc(0,0, outerR, 0, Math.PI*2, true);
      shape.holes.push(hole);
    } else {
      const numPts = config.teeth * 8;
      for (let i=0; i<=numPts; i++) {
        const a = (i/numPts) * Math.PI*2;
        const teethAngle = Math.PI*2 / config.teeth;
        const la = a % teethAngle;
        const t = la / teethAngle;
        let r = rootR;
        if (t > 0.1 && t < 0.4) r = THREE.MathUtils.lerp(rootR, outerR, (t-0.1)/0.3);
        else if (t >= 0.4 && t <= 0.6) r = outerR;
        else if (t > 0.6 && t < 0.9) r = THREE.MathUtils.lerp(outerR, rootR, (t-0.6)/0.3);
        
        if (i===0) shape.moveTo(Math.cos(a)*r, Math.sin(a)*r);
        else shape.lineTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      
      if (config.hole_d > 0 && config.bore_type === 'round') {
        const hole = new THREE.Path();
        hole.absarc(0,0, config.hole_d/2, 0, Math.PI*2, true);
        shape.holes.push(hole);
      } else if (config.hole_d > 0 && config.bore_type === 'D') {
        const hole = new THREE.Path();
        const d = config.hole_d;
        hole.moveTo(d/2, d/2 * 0.5);
        hole.lineTo(d/2, -d/2);
        hole.lineTo(-d/2, -d/2);
        hole.lineTo(-d/2, d/2 * 0.5);
        hole.lineTo(d/2, d/2 * 0.5);
        shape.holes.push(hole);
      } else if (config.hole_d > 0 && config.bore_type === 'keyway') {
        const hole = new THREE.Path();
        hole.absarc(0,0, config.hole_d/2, 0, Math.PI*2, true);
        
        // keyway cutout
        const kw = config.hole_d * 0.25;
        const kh = config.hole_d * 0.25;
        hole.moveTo(kw/2, config.hole_d/2);
        hole.lineTo(kw/2, config.hole_d/2 + kh);
        hole.lineTo(-kw/2, config.hole_d/2 + kh);
        hole.lineTo(-kw/2, config.hole_d/2);
        
        shape.holes.push(hole);
      } else if (config.hole_d > 0 && config.bore_type === 'spline') {
        const hole = new THREE.Path();
        hole.absarc(0,0, config.hole_d/2, 0, Math.PI*2, true);
        shape.holes.push(hole);
      }
    }
  }
  
  const depth = config.type === 'worm' ? config.worm_length : config.thickness;
  const extrudeSettings = { depth, bevelEnabled: false, curveSegments: 32 };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();
  
  // Rotate bevel/crown gears for visual distinction
  if (config.type === 'bevel' || config.type === 'crown') {
    const positions = geometry.attributes.position;
    for(let i=0; i<positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // taper based on z to simulate bevel
      const factor = 1 - ((z + depth/2)/depth) * 0.5; 
      positions.setX(i, x * factor);
      positions.setY(i, y * factor);
    }
    geometry.computeVertexNormals();
  }
  
  geometry.rotateX(Math.PI/2);
  
  return geometry;
}

function PlaceholderGear({ config }: { config: GearConfig }) {
  const geom = useMemo(() => createGearGeometry(config), [config]);

  return (
    <mesh castShadow receiveShadow geometry={geom}>
      <meshStandardMaterial 
        color="#eeeeee" 
        metalness={0.8}
        roughness={0.2}
      />
    </mesh>
  );
}
