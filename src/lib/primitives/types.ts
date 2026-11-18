export type PrimitiveShape = "cylinder" | "box";

export interface PrimitiveConfig {
  shape: PrimitiveShape;

  /** Cylinder outside diameter, mm. */
  diameter: number;
  /** Box size along X, mm. */
  width: number;
  /** Box size along Z, mm. */
  depth: number;
  /** Extrusion height, mm. */
  height: number;

  /** 45° chamfer on the top and bottom edges. */
  chamfer: boolean;
  chamferSize: number;

  /** Vertical ridges on the side walls. */
  knurl: boolean;
  knurlRidges: number;
  knurlDepth: number;

  /** Mesh resolution factor: 1 (preview) .. 2 (export). */
  quality: number;
}
