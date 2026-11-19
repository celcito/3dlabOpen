export type FitShape = "cylinder" | "square" | "rectangle";

/**
 * Lid + container pair. Every size comes from the container's OUTSIDE
 * dimension: the wall gives the opening, the clearance gives the lid skirt.
 */
export interface FitConfig {
  shape: FitShape;

  /** Container outside diameter, mm (cylinder). */
  diameter: number;
  /** Container outside size along X, mm (square / rectangle). */
  width: number;
  /** Container outside size along Z, mm (square / rectangle). */
  depth: number;
  /** Container height, mm. */
  containerHeight: number;
  /** Container wall thickness, mm. */
  wall: number;
  /** Container floor thickness, mm. */
  floor: number;

  /** Lid plate thickness, mm. */
  lidPlate: number;
  /** Lid skirt height, the part that goes inside the opening, mm. */
  lidSkirt: number;
  /** Clearance per side between the skirt and the container wall, mm. */
  clearance: number;

  /** 45° chamfer on the container edges and on the lid. */
  chamfer: boolean;
  chamferSize: number;

  /** Mesh resolution factor: 1 (preview) .. 2 (export). */
  quality: number;
}
