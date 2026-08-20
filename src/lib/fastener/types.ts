export type FastenerType = "screw" | "nut" | "washer";
export type System = "metric" | "uts";
export type HeadType = "hex" | "pan" | "flat" | "button" | "socket" | "ribbed_socket";
export type DriveType = "none" | "phillips" | "torx" | "slot" | "hex";
export type NutShape = "hex" | "square";
export type WasherType = "standard" | "large" | "spring";

export interface FastenerConfig {
  type: FastenerType;
  system: System;
  size: string;

  length: number;
  headType: HeadType;
  driveType: DriveType;
  fullThread: boolean;
  threadLength: number;
  splitScrew: boolean;

  nutShape: NutShape;
  nutThicknessOverride: number;
  clearance: number;
  bevelNut: boolean;

  washerType: WasherType;
  washerChamfer: boolean;

  /** Mesh resolution factor: 1 (preview, low) .. 2 (export, high). */
  quality: number;
  debugMode: boolean;
}

/** Head dimensions, all in mm. */
export interface HeadSpec {
  /** Head outer diameter (across corners for hex). */
  dk: number;
  /** Head height. */
  k: number;
  /** For hex heads: across-flats. */
  s?: number;
  /** For socket heads: hex socket across-flats. */
  socket?: number;
}

export interface NutSpec {
  /** Across flats. */
  s: number;
  /** Nominal thickness. */
  m: number;
}

export interface WasherSpec {
  /** Inner hole diameter. */
  d1: number;
  /** Outer diameter. */
  d2: number;
  /** Thickness. */
  h: number;
}

/** Resolved fastener dimensions for a given nominal size. */
export interface FastenerSizeSpec {
  label: string;
  system: System;
  /** Nominal thread major diameter in mm. */
  majorD: number;
  /** Thread pitch in mm per turn. */
  pitch: number;
  threadAngle?: number;
  hexHead?: HeadSpec;
  socketHead?: HeadSpec;
  panHead?: HeadSpec;
  flatHead?: HeadSpec;
  buttonHead?: HeadSpec;
  nut?: NutSpec;
  squareNut?: NutSpec;
  washer?: WasherSpec;
  washerLarge?: WasherSpec;
}
