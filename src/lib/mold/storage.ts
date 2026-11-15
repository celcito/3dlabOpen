import type { MoldConfig } from '../../types/mold';
import {
  DEFAULT_MOLD_CONFIG,
  MOLD_LIMITS,
  MOLD_SHAPE_IDS,
  MOLD_TYPE_IDS,
  MOLD_STORAGE_KEY,
} from './constants';

export interface MoldStudioState {
  config: MoldConfig;
  targetSizeMm: number;
}

export const DEFAULT_MOLD_STATE: MoldStudioState = {
  config: DEFAULT_MOLD_CONFIG,
  targetSizeMm: 50,
};

function clamp(value: unknown, limits: { min: number; max: number }, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(limits.max, Math.max(limits.min, n));
}

function isBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.startsWith('#') ? value : fallback;
}

export function loadSavedMoldState(): MoldStudioState {
  if (typeof window === 'undefined') return DEFAULT_MOLD_STATE;

  try {
    const raw = window.localStorage.getItem(MOLD_STORAGE_KEY);
    if (!raw) return DEFAULT_MOLD_STATE;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_MOLD_STATE;

    const storedConfig = (parsed.config ?? {}) as Partial<MoldConfig>;
    const def = DEFAULT_MOLD_CONFIG;

    return {
      config: {
        ...def,
        type: MOLD_TYPE_IDS.includes(storedConfig.type as MoldConfig['type'])
          ? (storedConfig.type as MoldConfig['type'])
          : def.type,
        shape: MOLD_SHAPE_IDS.includes(storedConfig.shape as MoldConfig['shape'])
          ? (storedConfig.shape as MoldConfig['shape'])
          : def.shape,
        wallThickness: clamp(storedConfig.wallThickness, MOLD_LIMITS.wallThickness, def.wallThickness),
        floorThickness: clamp(storedConfig.floorThickness, MOLD_LIMITS.floorThickness, def.floorThickness),
        splitPlaneRatio:
          clamp(
            typeof storedConfig.splitPlaneRatio === 'number'
              ? storedConfig.splitPlaneRatio * 100
              : undefined,
            MOLD_LIMITS.splitPlane,
            def.splitPlaneRatio * 100
          ) / 100,
        pourSpout: isBool(storedConfig.pourSpout, def.pourSpout),
        pourSpoutDiameter: clamp(
          storedConfig.pourSpoutDiameter,
          MOLD_LIMITS.pourSpoutDiameter,
          def.pourSpoutDiameter
        ),
        airVents: isBool(storedConfig.airVents, def.airVents),
        airVentDiameter: clamp(
          storedConfig.airVentDiameter,
          MOLD_LIMITS.airVentDiameter,
          def.airVentDiameter
        ),
        alignmentPins: isBool(storedConfig.alignmentPins, def.alignmentPins),
        pinSize: clamp(storedConfig.pinSize, MOLD_LIMITS.pinSize, def.pinSize),
        draftAngle: clamp(storedConfig.draftAngle, MOLD_LIMITS.draftAngle, def.draftAngle),
        explodeDistance: clamp(
          storedConfig.explodeDistance,
          MOLD_LIMITS.explodeDistance,
          def.explodeDistance
        ),
        moldColor: isColor(storedConfig.moldColor, def.moldColor),
        topColor: isColor(storedConfig.topColor, def.topColor),
      },
      targetSizeMm: clamp(parsed.targetSizeMm, MOLD_LIMITS.targetSize, DEFAULT_MOLD_STATE.targetSizeMm),
    };
  } catch (err) {
    console.warn('Erro ao carregar criador de moldes do localStorage:', err);
    return DEFAULT_MOLD_STATE;
  }
}

export function saveMoldStateToStorage(state: MoldStudioState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(MOLD_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn('Erro ao salvar criador de moldes no localStorage:', err);
    return false;
  }
}
