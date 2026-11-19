import type { FitConfig } from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export interface FitResolution {
  circular: boolean;
  /** Container outside half-size along X (radius for cylinders). */
  outerHalfW: number;
  /** Container outside half-size along Z (radius for cylinders). */
  outerHalfD: number;
  /** Opening half-size: outside minus the wall. */
  innerHalfW: number;
  innerHalfD: number;
  /** Lid skirt half-size, the part that enters the opening. */
  skirtHalfW: number;
  skirtHalfD: number;
  wall: number;
  floor: number;
  height: number;
  lidPlate: number;
  /** Skirt height, kept short enough that it does not bottom out. */
  skirt: number;
  clearance: number;
  /** Chamfer actually applied to the container, clamped by the wall. */
  chamfer: number;
}

/**
 * Derives the whole lid + container pair from the outside dimensions. The
 * spigot of the lid generator (nominal minus clearance per side) is exactly
 * the skirt, so the pair always mates with the configured clearance.
 */
export function resolveFitPair(config: FitConfig): FitResolution {
  const circular = config.shape === "cylinder";
  const outerHalfW = circular ? Math.max(2.5, config.diameter / 2) : Math.max(2.5, config.width / 2);
  const outerHalfD = circular
    ? outerHalfW
    : config.shape === "square"
      ? outerHalfW
      : Math.max(2.5, config.depth / 2);

  const wall = clamp(config.wall, 0.8, Math.min(outerHalfW, outerHalfD) - 0.6);
  const height = Math.max(5, config.containerHeight);
  const floor = clamp(config.floor, 0.5, Math.max(0.5, height - 1));

  const innerHalfW = outerHalfW - wall;
  const innerHalfD = outerHalfD - wall;

  const clearance = clamp(
    config.clearance,
    0.05,
    Math.max(0.05, Math.min(2, Math.min(innerHalfW, innerHalfD) - 1))
  );
  const skirtHalfW = Math.max(0.5, innerHalfW - clearance);
  const skirtHalfD = Math.max(0.5, innerHalfD - clearance);
  const skirt = clamp(config.lidSkirt, 1, Math.max(1, height - floor - 1));
  const lidPlate = clamp(config.lidPlate, 0.8, 50);

  const chamfer = config.chamfer
    ? clamp(config.chamferSize, 0.1, Math.min(wall * 0.9, height / 2 - 0.05, outerHalfW - 0.5))
    : 0;

  return {
    circular,
    outerHalfW,
    outerHalfD,
    innerHalfW,
    innerHalfD,
    skirtHalfW,
    skirtHalfD,
    wall,
    floor,
    height,
    lidPlate,
    skirt,
    clearance,
    chamfer,
  };
}
