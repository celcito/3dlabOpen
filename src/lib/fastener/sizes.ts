import type { FastenerSizeSpec, HeadSpec, NutSpec, System, WasherSpec } from "./types";

/**
 * ISO 261/262 coarse thread and ISO fastener dimensional tables.
 * All values in mm. Head/nut/washer standards: ISO 4017 (hex head),
 * ISO 4762 (socket cap), ISO 7380 (button), ISO 14580 (pan), ISO 4032 (nut),
 * ISO 7089 (plain washer), ISO 7093 (large washer).
 */
const METRIC: FastenerSizeSpec[] = [
  {
    label: "M2", system: "metric", majorD: 2.0, pitch: 0.4,
    hexHead: { s: 4.0, k: 1.4, dk: round(4.0 * 1.1547) },
    socketHead: { dk: 3.8, k: 2.0, socket: 1.5 },
    panHead: { dk: 4.0, k: 1.3 },
    flatHead: { dk: 4.5, k: 1.2 },
    buttonHead: { dk: 4.7, k: 1.6 },
    nut: { s: 4.0, m: 1.6 },
    squareNut: { s: 4.5, m: 1.6 },
    washer: { d1: 2.2, d2: 5.0, h: 0.3 },
    washerLarge: { d1: 2.2, d2: 6.0, h: 0.6 },
  },
  {
    label: "M2.5", system: "metric", majorD: 2.5, pitch: 0.45,
    hexHead: { s: 5.0, k: 1.7, dk: round(5.0 * 1.1547) },
    socketHead: { dk: 4.5, k: 2.5, socket: 2.0 },
    panHead: { dk: 5.0, k: 1.6 },
    flatHead: { dk: 5.5, k: 1.5 },
    buttonHead: { dk: 5.7, k: 2.0 },
    nut: { s: 5.0, m: 2.0 },
    squareNut: { s: 5.0, m: 2.0 },
    washer: { d1: 2.7, d2: 6.0, h: 0.5 },
    washerLarge: { d1: 2.7, d2: 8.0, h: 0.6 },
  },
  {
    label: "M3", system: "metric", majorD: 3.0, pitch: 0.5,
    hexHead: { s: 5.5, k: 2.0, dk: round(5.5 * 1.1547) },
    socketHead: { dk: 5.5, k: 3.0, socket: 2.5 },
    panHead: { dk: 6.0, k: 1.8 },
    flatHead: { dk: 6.5, k: 1.5 },
    buttonHead: { dk: 6.5, k: 2.3 },
    nut: { s: 5.5, m: 2.4 },
    squareNut: { s: 5.5, m: 2.4 },
    washer: { d1: 3.2, d2: 7.0, h: 0.5 },
    washerLarge: { d1: 3.2, d2: 9.0, h: 0.8 },
  },
  {
    label: "M4", system: "metric", majorD: 4.0, pitch: 0.7,
    hexHead: { s: 7.0, k: 2.8, dk: round(7.0 * 1.1547) },
    socketHead: { dk: 7.0, k: 4.0, socket: 3.0 },
    panHead: { dk: 8.0, k: 2.4 },
    flatHead: { dk: 8.5, k: 2.0 },
    buttonHead: { dk: 8.5, k: 3.2 },
    nut: { s: 7.0, m: 3.2 },
    squareNut: { s: 7.0, m: 3.2 },
    washer: { d1: 4.3, d2: 9.0, h: 0.8 },
    washerLarge: { d1: 4.3, d2: 12.0, h: 1.0 },
  },
  {
    label: "M5", system: "metric", majorD: 5.0, pitch: 0.8,
    hexHead: { s: 8.0, k: 3.5, dk: round(8.0 * 1.1547) },
    socketHead: { dk: 8.5, k: 5.0, socket: 4.0 },
    panHead: { dk: 9.5, k: 3.0 },
    flatHead: { dk: 10.0, k: 2.5 },
    buttonHead: { dk: 10.5, k: 4.0 },
    nut: { s: 8.0, m: 4.0 },
    squareNut: { s: 8.0, m: 4.0 },
    washer: { d1: 5.3, d2: 10.0, h: 1.0 },
    washerLarge: { d1: 5.3, d2: 14.0, h: 1.2 },
  },
  {
    label: "M6", system: "metric", majorD: 6.0, pitch: 1.0,
    hexHead: { s: 10.0, k: 4.0, dk: round(10.0 * 1.1547) },
    socketHead: { dk: 10.0, k: 6.0, socket: 5.0 },
    panHead: { dk: 11.0, k: 3.5 },
    flatHead: { dk: 12.0, k: 3.0 },
    buttonHead: { dk: 12.5, k: 5.0 },
    nut: { s: 10.0, m: 5.0 },
    squareNut: { s: 10.0, m: 5.0 },
    washer: { d1: 6.4, d2: 12.0, h: 1.6 },
    washerLarge: { d1: 6.4, d2: 16.0, h: 1.6 },
  },
  {
    label: "M7", system: "metric", majorD: 7.0, pitch: 1.0,
    hexHead: { s: 11.0, k: 4.5, dk: round(11.0 * 1.1547) },
    socketHead: { dk: 12.0, k: 7.0, socket: 6.0 },
    panHead: { dk: 13.0, k: 4.0 },
    flatHead: { dk: 14.0, k: 3.5 },
    buttonHead: { dk: 14.5, k: 5.5 },
    nut: { s: 11.0, m: 5.5 },
    squareNut: { s: 11.0, m: 5.5 },
    washer: { d1: 7.4, d2: 14.0, h: 1.6 },
    washerLarge: { d1: 7.4, d2: 18.0, h: 1.6 },
  },
  {
    label: "M8", system: "metric", majorD: 8.0, pitch: 1.25,
    hexHead: { s: 13.0, k: 5.3, dk: round(13.0 * 1.1547) },
    socketHead: { dk: 13.0, k: 8.0, socket: 6.0 },
    panHead: { dk: 15.0, k: 5.0 },
    flatHead: { dk: 16.0, k: 4.0 },
    buttonHead: { dk: 16.5, k: 6.5 },
    nut: { s: 13.0, m: 6.5 },
    squareNut: { s: 13.0, m: 6.5 },
    washer: { d1: 8.4, d2: 16.0, h: 1.6 },
    washerLarge: { d1: 8.4, d2: 20.0, h: 2.0 },
  },
  {
    label: "M10", system: "metric", majorD: 10.0, pitch: 1.5,
    hexHead: { s: 16.0, k: 6.4, dk: round(16.0 * 1.1547) },
    socketHead: { dk: 16.0, k: 10.0, socket: 8.0 },
    panHead: { dk: 19.0, k: 6.0 },
    flatHead: { dk: 20.0, k: 5.0 },
    buttonHead: { dk: 20.0, k: 8.0 },
    nut: { s: 16.0, m: 8.0 },
    squareNut: { s: 16.0, m: 8.0 },
    washer: { d1: 10.5, d2: 20.0, h: 2.0 },
    washerLarge: { d1: 10.5, d2: 25.0, h: 2.5 },
  },
  {
    label: "M12", system: "metric", majorD: 12.0, pitch: 1.75,
    hexHead: { s: 18.0, k: 7.5, dk: round(18.0 * 1.1547) },
    socketHead: { dk: 18.0, k: 12.0, socket: 10.0 },
    panHead: { dk: 22.0, k: 7.0 },
    flatHead: { dk: 24.0, k: 6.0 },
    buttonHead: { dk: 24.0, k: 10.0 },
    nut: { s: 18.0, m: 10.0 },
    squareNut: { s: 18.0, m: 10.0 },
    washer: { d1: 13.0, d2: 24.0, h: 2.5 },
    washerLarge: { d1: 13.0, d2: 30.0, h: 3.0 },
  },
  {
    label: "M14", system: "metric", majorD: 14.0, pitch: 2.0,
    hexHead: { s: 21.0, k: 8.8, dk: round(21.0 * 1.1547) },
    socketHead: { dk: 21.0, k: 14.0, socket: 12.0 },
    panHead: { dk: 25.0, k: 8.0 },
    flatHead: { dk: 27.0, k: 7.0 },
    buttonHead: { dk: 27.0, k: 11.0 },
    nut: { s: 21.0, m: 11.0 },
    squareNut: { s: 21.0, m: 11.0 },
    washer: { d1: 15.0, d2: 28.0, h: 2.5 },
    washerLarge: { d1: 15.0, d2: 34.0, h: 3.0 },
  },
  {
    label: "M16", system: "metric", majorD: 16.0, pitch: 2.0,
    hexHead: { s: 24.0, k: 10.0, dk: round(24.0 * 1.1547) },
    socketHead: { dk: 24.0, k: 16.0, socket: 14.0 },
    panHead: { dk: 28.0, k: 9.0 },
    flatHead: { dk: 30.0, k: 8.0 },
    buttonHead: { dk: 30.0, k: 12.0 },
    nut: { s: 24.0, m: 13.0 },
    squareNut: { s: 24.0, m: 13.0 },
    washer: { d1: 17.0, d2: 30.0, h: 3.0 },
    washerLarge: { d1: 17.0, d2: 38.0, h: 3.0 },
  },
  {
    label: "M18", system: "metric", majorD: 18.0, pitch: 2.5,
    hexHead: { s: 27.0, k: 11.5, dk: round(27.0 * 1.1547) },
    socketHead: { dk: 27.0, k: 18.0, socket: 14.0 },
    panHead: { dk: 32.0, k: 10.0 },
    flatHead: { dk: 34.0, k: 9.0 },
    buttonHead: { dk: 34.0, k: 14.0 },
    nut: { s: 27.0, m: 15.0 },
    squareNut: { s: 27.0, m: 15.0 },
    washer: { d1: 19.0, d2: 34.0, h: 3.0 },
    washerLarge: { d1: 19.0, d2: 42.0, h: 4.0 },
  },
  {
    label: "M20", system: "metric", majorD: 20.0, pitch: 2.5,
    hexHead: { s: 30.0, k: 12.5, dk: round(30.0 * 1.1547) },
    socketHead: { dk: 30.0, k: 20.0, socket: 17.0 },
    panHead: { dk: 35.0, k: 11.0 },
    flatHead: { dk: 37.0, k: 10.0 },
    buttonHead: { dk: 38.0, k: 16.0 },
    nut: { s: 30.0, m: 16.0 },
    squareNut: { s: 30.0, m: 16.0 },
    washer: { d1: 21.0, d2: 37.0, h: 3.0 },
    washerLarge: { d1: 21.0, d2: 45.0, h: 4.0 },
  },
];

/** UTS (UNC/UNF nominal) sizes — nominal OD + coarse TPI, converted to mm. */
const UTS_RAW: { label: string; odIn: number; tpi: number; hexAcrossIn: number }[] = [
  { label: "#4", odIn: 0.112, tpi: 40, hexAcrossIn: 0.219 },
  { label: "#6", odIn: 0.138, tpi: 32, hexAcrossIn: 0.270 },
  { label: "#8", odIn: 0.164, tpi: 32, hexAcrossIn: 0.323 },
  { label: "#10", odIn: 0.190, tpi: 24, hexAcrossIn: 0.354 },
  { label: "1/4", odIn: 0.25, tpi: 20, hexAcrossIn: 0.4375 },
  { label: "5/16", odIn: 0.3125, tpi: 18, hexAcrossIn: 0.5 },
  { label: "3/8", odIn: 0.375, tpi: 16, hexAcrossIn: 0.5625 },
  { label: "7/16", odIn: 0.4375, tpi: 14, hexAcrossIn: 0.625 },
  { label: "1/2", odIn: 0.5, tpi: 13, hexAcrossIn: 0.75 },
  { label: "9/16", odIn: 0.5625, tpi: 12, hexAcrossIn: 0.8125 },
  { label: "5/8", odIn: 0.625, tpi: 11, hexAcrossIn: 0.9375 },
  { label: "3/4", odIn: 0.75, tpi: 10, hexAcrossIn: 1.125 },
];

const INCH = 25.4;

function buildUtsTable(): FastenerSizeSpec[] {
  return UTS_RAW.map((r) => {
    const d = r.odIn * INCH;
    const pitch = INCH / r.tpi;
    const s = r.hexAcrossIn * INCH;
    // Standard approximations for UTS fasteners (UNF/UNC style).
    const k = Math.round(r.odIn * 0.66 * INCH * 10) / 10;
    const m = Math.round(r.odIn * 0.87 * INCH * 10) / 10;
    const head: HeadSpec = { dk: round(d * 1.5), k: round(d * 0.66) };
    const hexHead: HeadSpec = { s: round(s), k: round(k), dk: round(s * 1.1547) };
    const socket: HeadSpec = { dk: round(d * 1.55), k: round(d * 0.66 * 1.2), socket: round(d * 0.8) };
    const nut: NutSpec = { s: round(s), m: round(m) };
    const washer: WasherSpec = { d1: round(d * 1.06), d2: round(d * 2.0), h: round(d * 0.2) };
    const washerLarge: WasherSpec = { d1: round(d * 1.06), d2: round(d * 2.5), h: round(d * 0.24) };
    return {
      label: r.label, system: "uts", majorD: round(d), pitch: round(pitch),
      hexHead, socketHead: socket, panHead: head, flatHead: head, buttonHead: head,
      nut, squareNut: { s: round(s), m: round(m) }, washer, washerLarge,
    };
  });
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

const UTS = buildUtsTable();

/** All available sizes for a system, in display order. */
export function getSizeLabels(system: System): string[] {
  return (system === "metric" ? METRIC : UTS).map((s) => s.label);
}

/** Look up a fastener size spec. Falls back to the closest metric size. */
export function getFastenerSize(system: System, label: string): FastenerSizeSpec {
  const table = system === "metric" ? METRIC : UTS;
  const found = table.find((s) => s.label === label);
  if (found) return found;
  const numeric = parseFloat(label.replace(/[^0-9.]/g, ""));
  const sorted = [...table].sort((a, b) => Math.abs(a.majorD - numeric) - Math.abs(b.majorD - numeric));
  return sorted[0] ?? METRIC[0];
}

/** Fill any missing head/nut/washer dimensions with sane defaults. */
export function resolveHeadDims(spec: FastenerSizeSpec, headType: "hex" | "pan" | "flat" | "button" | "socket" | "ribbed_socket"): HeadSpec {
  const d = spec.majorD;
  const table: Record<string, HeadSpec | undefined> = {
    hex: spec.hexHead,
    pan: spec.panHead,
    flat: spec.flatHead,
    button: spec.buttonHead,
    socket: spec.socketHead,
    ribbed_socket: spec.socketHead,
  };
  const found = table[headType];
  if (found) return found;
  const defaultDk = headType === "socket" ? d * 1.55 : headType === "flat" ? d * 2.0 : d * 1.8;
  const defaultK = headType === "flat" ? d * 0.55 : d * 0.6;
  return { dk: round(defaultDk), k: round(defaultK), socket: round(d * 0.8) };
}

export function resolveNutDims(spec: FastenerSizeSpec, shape: "hex" | "square"): NutSpec {
  const found = shape === "hex" ? spec.nut : spec.squareNut;
  if (found) return found;
  return { s: round(spec.majorD * 1.6), m: round(spec.majorD * 0.8) };
}

export function resolveWasherDims(spec: FastenerSizeSpec, large: boolean): WasherSpec {
  const found = large ? spec.washerLarge : spec.washer;
  if (found) return found;
  return { d1: round(spec.majorD * 1.1), d2: round(spec.majorD * (large ? 2.5 : 2.0)), h: round(spec.majorD * 0.2) };
}
