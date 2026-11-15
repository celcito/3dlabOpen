import type { MoldConfig, MoldType, MoldShape } from '../../types/mold';

export const MOLD_STORAGE_KEY = 'criador_de_moldes_3d_state_v1';

export const MOLD_LIMITS = {
  targetSize: { min: 20, max: 180, step: 1 },
  wallThickness: { min: 2, max: 40, step: 0.5 },
  floorThickness: { min: 1.5, max: 30, step: 0.5 },
  splitPlane: { min: 20, max: 80, step: 1 },
  draftAngle: { min: 0, max: 8, step: 0.5 },
  pinSize: { min: 2, max: 12, step: 0.5 },
  pourSpoutDiameter: { min: 4, max: 30, step: 0.5 },
  airVentDiameter: { min: 1, max: 8, step: 0.5 },
  explodeDistance: { min: 0, max: 60, step: 1 },
} as const;

export const DEFAULT_MOLD_CONFIG: MoldConfig = {
  type: 'two_part',
  shape: 'box',
  wallThickness: 10,
  floorThickness: 8,
  splitPlaneRatio: 0.5,
  pourSpout: true,
  pourSpoutDiameter: 12,
  airVents: true,
  airVentDiameter: 3.5,
  alignmentPins: true,
  pinSize: 6,
  draftAngle: 2,
  explodeDistance: 0,
  moldColor: '#632CE5',
  topColor: '#7C4DFF',
};

export const MOLD_TYPE_IDS: MoldType[] = ['single_open', 'two_part', 'silicone_box'];
export const MOLD_SHAPE_IDS: MoldShape[] = ['box', 'rounded', 'cylinder'];
