import type { PrimitiveConfig } from "../primitives/types";
import type { FitConfig } from "./types";
import { resolveFitPair } from "./fit";

/**
 * The lid is the primitive generator's stepper part: a smaller spigot at the
 * base (the skirt that enters the opening) topped by the full-size flange
 * (the plate that rests on the rim). Passing wall + clearance as the primitive
 * clearance makes the spigot land exactly on the container opening minus the
 * configured clearance.
 */
export function lidToPrimitive(config: FitConfig): PrimitiveConfig {
  const fit = resolveFitPair(config);
  return {
    shape: fit.circular ? "cylinder" : "box",
    diameter: fit.outerHalfW * 2,
    width: fit.outerHalfW * 2,
    depth: fit.outerHalfD * 2,
    height: fit.skirt + fit.lidPlate,

    chamfer: config.chamfer,
    chamferSize: config.chamferSize,

    knurl: false,
    knurlRidges: 24,
    knurlDepth: 1,

    fit: true,
    fitHeight: fit.skirt,
    fitClearance: fit.wall + fit.clearance,

    groove: false,
    grooveWidth: 2.5,
    grooveDepth: 1.2,
    grooveHeight: 4,

    quality: config.quality,
  };
}
