export type Point2D = [number, number];

export type Path2D = Point2D[];

export interface ModelLineart {
  id: string;
  name: string;
  category: 'confectionery' | 'holidays' | 'animals' | 'botanical' | 'frames';
  categoryLabel: string;
  description: string;
  iconName: string;
  // Normalized 0-100 coordinate system
  outerPerimeter: Path2D; // Closed loop for cutter
  innerDetails: Path2D[]; // Interior lineart paths for stamp debossing
}

export type ViewMode = 'combo' | 'cutter_only' | 'stamp_only' | 'integrated' | 'dough_preview';

export type FilamentColor = {
  id: string;
  name: string;
  hex: string;
  roughness: number;
  metalness: number;
  type: 'matte' | 'silk' | 'dough';
};

export interface ModelSettings {
  // Dimensions (mm)
  targetWidth: number; // 40mm to 130mm, default 75mm
  targetHeight: number;
  lockAspectRatio: boolean;

  // Cutter blade settings (mm)
  bladeHeight: number; // 10mm to 25mm, default 15mm
  bladeEdgeThickness: number; // 0.8mm to 1.4mm, default 0.9mm (sharp)
  bladeBaseThickness: number; // 1.6mm to 2.4mm, default 1.8mm (rigid)
  lipWidth: number; // 4mm to 8mm, default 6mm (comfort pressing flange)
  lipThickness: number; // 2mm to 4mm, default 2.5mm

  // Stamp settings (mm)
  stampPlateThickness: number; // 2mm to 4mm, default 2.8mm
  stampDepth: number; // 2mm to 5mm, default 3mm (impression relief)
  stampLineThickness: number; // 1.0mm to 2.5mm, default 1.4mm
  stampClearance: number; // 0.8mm to 1.5mm offset from cutter inside wall
  airReleaseHoles: boolean; // Holes to prevent vacuum suction on dough
  airHoleDiameter: number; // 2mm to 4mm
  handleType: 'knob' | 'bar' | 'ring' | 'none';
  handleHeight: number; // 15mm to 30mm

  // Text on Stamp settings
  customText: string;
  textFont: 'cursive' | 'bold' | 'serif' | 'rounded';
  textSize: number; // 12 to 36
  textOffsetY: number; // -35 to 35
  mirrorText: boolean; // Auto-mirror for physical dough stamp release

  // Material, slicer & visual
  infillPercent: number; // 10% to 100%, default 20%
  filamentColor: string;
  stampFilamentColor: string;
  showPrintBed: boolean;
  showDimensions: boolean;
  wireframe: boolean;
}

export interface PrintEstimation {
  cutterWeightGrams: number;
  stampWeightGrams: number;
  totalWeightGrams: number;
  printTimeMinutes: number;
  filamentMeters: number;
  trianglesCount: number;
}
