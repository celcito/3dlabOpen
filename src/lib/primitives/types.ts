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

  /** Lid spigot: a smaller bottom step that plugs into the container. */
  fit: boolean;
  /** Height of the spigot step, mm. */
  fitHeight: number;
  /** Clearance per side between the spigot and the container, mm. */
  fitClearance: number;

  /** Elastic-band groove on the side wall, cylinders only. */
  groove: boolean;
  /** Axial width of the groove, mm. */
  grooveWidth: number;
  /** Radial depth of the groove, mm. */
  grooveDepth: number;
  /** Groove centre, measured from the base, mm. */
  grooveHeight: number;

  /** Mesh resolution factor: 1 (preview) .. 2 (export). */
  quality: number;
}
