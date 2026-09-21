import * as THREE from "three";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _opentype: any = null;

async function getOpentype() {
  if (!_opentype) {
    _opentype = await import("opentype.js");
  }
  return _opentype;
}

// Built-in fonts (loaded from CDN)
const FONTS: Record<string, string> = {
  Arial: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/files/inter-latin-400-normal.woff",
  Script: "https://cdn.jsdelivr.net/npm/@fontsource/dancing-script@5.0.0/files/dancing-script-latin-400-normal.woff",
  Block: "https://cdn.jsdelivr.net/npm/@fontsource/black-ops-one@5.0.0/files/black-ops-one-latin-400-normal.woff",
};

// Cache loaded fonts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fontCache: Record<string, any> = {};

let _onFontsLoaded: (() => void) | null = null;
let _loadedCount = 0;
const _totalFonts = Object.keys(FONTS).length;

export function onFontsLoaded(cb: () => void) {
  _onFontsLoaded = cb;
  if (_loadedCount >= _totalFonts) cb();
}

export function areFontsLoaded(): boolean {
  return _loadedCount >= _totalFonts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadFont(name: string): Promise<any> {
  if (fontCache[name]) return fontCache[name];
  const url = FONTS[name] || FONTS.Arial;
  try {
    const [response, ot] = await Promise.all([fetch(url), getOpentype()]);
    const buffer = await response.arrayBuffer();
    const font = ot.parse(buffer);
    fontCache[name] = font;
    _loadedCount++;
    if (_loadedCount >= _totalFonts && _onFontsLoaded) {
      _onFontsLoaded();
    }
    return font;
  } catch (e) {
    console.warn(`Failed to load font "${name}" from ${url}:`, e);
    throw e;
  }
}

export function getAvailableFonts(): string[] {
  return Object.keys(FONTS);
}

/**
 * Convert a text string into a THREE.ShapeGeometry at a given position and scale.
 * The text is centered at (x, y) with the given fontSize in mm.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function textToShapeGeometry(
  text: string,
  font: any,
  fontSize: number
): THREE.ShapeGeometry {
  const paths = font.getPaths(text, 0, 0, fontSize);
  const shapes: THREE.Shape[] = [];

  for (const path of paths) {
    const pathCommands = path.commands;
    const shape = new THREE.Shape();
    let curX = 0;
    let curY = 0;

    for (const cmd of pathCommands) {
      switch (cmd.type) {
        case "M":
          shape.moveTo(cmd.x, cmd.y);
          curX = cmd.x;
          curY = cmd.y;
          break;
        case "L":
          shape.lineTo(cmd.x, cmd.y);
          curX = cmd.x;
          curY = cmd.y;
          break;
        case "Q":
          shape.quadraticCurveTo(cmd.x1!, cmd.y1!, cmd.x, cmd.y);
          curX = cmd.x;
          curY = cmd.y;
          break;
        case "C":
          shape.bezierCurveTo(cmd.x1!, cmd.y1!, cmd.x2!, cmd.y2!, cmd.x, cmd.y);
          curX = cmd.x;
          curY = cmd.y;
          break;
        case "Z":
          shape.closePath();
          break;
      }
    }
    if (shape.curves.length > 0) {
      shapes.push(shape);
    }
  }

  if (shapes.length === 0) {
    return new THREE.ShapeGeometry(new THREE.Shape());
  }

  const geom = new THREE.ShapeGeometry(shapes);

  // Center the geometry at origin
  geom.computeBoundingBox();
  const bbox = geom.boundingBox!;
  const cx = (bbox.max.x + bbox.min.x) / 2;
  const cy = (bbox.max.y + bbox.min.y) / 2;
  geom.translate(-cx, -cy, 0);

  return geom;
}

/**
 * Generate SVG string from text for the existing SVG parsing pipeline.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function textToSvgString(
  text: string,
  font: any,
  fontSize: number,
  x: number,
  y: number,
  scale: number
): string {
  const paths = font.getPaths(text, 0, 0, fontSize);
  let pathData = "";

  for (const path of paths) {
    for (const cmd of path.commands) {
      switch (cmd.type) {
        case "M":
          pathData += `M ${cmd.x} ${cmd.y} `;
          break;
        case "L":
          pathData += `L ${cmd.x} ${cmd.y} `;
          break;
        case "Q":
          pathData += `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y} `;
          break;
        case "C":
          pathData += `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y} `;
          break;
        case "Z":
          pathData += "Z ";
          break;
      }
    }
  }

  // Compute bounding box to center the text
  const totalPath = font.getPath(text, 0, 0, fontSize);
  const bbox = totalPath.getBoundingBox();
  const cx = (bbox.x2 + bbox.x1) / 2;
  const cy = (bbox.y2 + bbox.y1) / 2;

  // Apply transform: translate to (x, y) centered, then scale
  const tx = x - cx * scale;
  const ty = y - cy * scale;

  return `<svg viewBox="0 0 100 100"><g transform="translate(${tx},${ty}) scale(${scale})"><path id="text_${Date.now()}" d="${pathData}" /></g></svg>`;
}
