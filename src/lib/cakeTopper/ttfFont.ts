/**
 * Fontes TTF/OTF para o topo de bolo.
 *
 * O `TextGeometry` do three.js só entende o formato "typeface JSON". Aqui o
 * arquivo `.ttf` (ex.: a fonte da Bluey em `public/fonts/Bluey.ttf`) é
 * convertido com o opentype.js — mesma lib usada pelo cookie-cutter — para o
 * formato do three: um contorno por glifo (`o`) com comandos
 * "m x y" / "l x y" / "q x1 y1 x y" / "b x1 y1 x2 y2 x y".
 */
import { Font } from "three/examples/jsm/loaders/FontLoader.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _opentype: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOpentype(): Promise<any> {
  if (!_opentype) {
    _opentype = await import("opentype.js");
  }
  return _opentype;
}

function num(value: number): number {
  return Math.round(value * 100) / 100;
}

type OpentypeCommand = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number };

/** Contorno de um glifo do opentype.js no formato de path do typeface JSON. */
export function opentypeCommandsToOutline(commands: OpentypeCommand[]): string {
  const tokens: Array<string | number> = [];
  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        tokens.push("m", num(cmd.x ?? 0), num(cmd.y ?? 0));
        break;
      case "L":
        tokens.push("l", num(cmd.x ?? 0), num(cmd.y ?? 0));
        break;
      case "Q":
        tokens.push("q", num(cmd.x1 ?? 0), num(cmd.y1 ?? 0), num(cmd.x ?? 0), num(cmd.y ?? 0));
        break;
      case "C":
        tokens.push("b", num(cmd.x1 ?? 0), num(cmd.y1 ?? 0), num(cmd.x2 ?? 0), num(cmd.y2 ?? 0), num(cmd.x ?? 0), num(cmd.y ?? 0));
        break;
      // "Z": o three fecha cada contorno implicitamente (o typeface JSON não usa "z").
      default:
        break;
    }
  }
  return tokens.join(" ");
}

interface TypefaceGlyph {
  x_min: number;
  x_max: number;
  ha: number;
  o?: string;
}

/**
 * Converte uma fonte do opentype.js no JSON aceito pelo `Font` do three.js.
 * Glifos sem contorno (ex.: espaço) entram só com o avanço (`ha`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function opentypeFontToTypeface(font: any, familyName = "TTF"): any {
  const resolution = font.unitsPerEm || 1000;
  const glyphs: Record<string, TypefaceGlyph> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toEntry = (glyph: any): TypefaceGlyph => {
    const outline = opentypeCommandsToOutline(glyph.path?.commands ?? []);
    return {
      x_min: num(glyph.xMin ?? 0),
      x_max: num(glyph.xMax ?? 0),
      ha: num(glyph.advanceWidth ?? 0),
      ...(outline ? { o: outline } : {}),
    };
  };

  const total = font.glyphs?.length ?? 0;
  for (let i = 0; i < total; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const glyph: any = font.glyphs.get(i);
    if (!glyph) continue;
    const entry = toEntry(glyph);
    const codepoints: number[] = Array.isArray(glyph.unicodes) && glyph.unicodes.length
      ? glyph.unicodes
      : glyph.unicode != null
        ? [glyph.unicode]
        : [];
    for (const cp of codepoints) {
      const ch = String.fromCodePoint(cp);
      if (!(ch in glyphs)) glyphs[ch] = entry;
    }
  }

  // O FontLoader usa "?" para caracteres ausentes: garanta que exista.
  if (!glyphs["?"]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallback: any = font.charToGlyph?.("?");
    if (fallback) glyphs["?"] = toEntry(fallback);
  }

  const head = font.tables?.head ?? {};
  const hhea = font.tables?.hhea ?? {};
  const post = font.tables?.post ?? {};

  return {
    glyphs,
    familyName,
    resolution,
    boundingBox: {
      xMin: num(head.xMin ?? 0),
      xMax: num(head.xMax ?? resolution),
      yMin: num(head.yMin ?? 0),
      yMax: num(head.yMax ?? resolution),
    },
    ascender: num(hhea.ascender ?? resolution),
    descender: num(hhea.descender ?? 0),
    underlineThickness: num(post.underlineThickness ?? 0),
  };
}

const ttfCache = new Map<string, Promise<Font>>();

export function isTtfFontUrl(url: string): boolean {
  return /\.(ttf|otf)$/i.test(url.split("?")[0]);
}

/** O mesmo nome em .ttf ou .otf (a fonte da Bluey costuma vir nos dois formatos). */
function fontUrlCandidates(url: string): string[] {
  const candidates = [url];
  if (/\.ttf$/i.test(url)) candidates.push(url.replace(/\.ttf$/i, ".otf"));
  else if (/\.otf$/i.test(url)) candidates.push(url.replace(/\.otf$/i, ".ttf"));
  return candidates;
}

/** Existe algum arquivo de fonte em public/fonts para essa URL? */
export async function isTtfTopperFontAvailable(url: string): Promise<boolean> {
  for (const candidate of fontUrlCandidates(url)) {
    try {
      const response = await fetch(candidate, { method: "HEAD" });
      if (response.ok) return true;
    } catch {
      // tenta a próxima extensão
    }
  }
  return false;
}

/** Carrega (e cacheia) um .ttf/.otf como `Font` do three.js. */
export function loadTtfTopperFont(url: string): Promise<Font> {
  const cached = ttfCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    let buffer: ArrayBuffer | null = null;
    for (const candidate of fontUrlCandidates(url)) {
      const response = await fetch(candidate);
      if (response.ok) {
        buffer = await response.arrayBuffer();
        break;
      }
    }
    if (!buffer) {
      throw new Error(`Fonte não encontrada em ${url} (nem .otf com o mesmo nome)`);
    }
    const opentype = await getOpentype();
    const parsed = opentype.parse(buffer);
    if (!parsed?.glyphs) {
      throw new Error(`Arquivo de fonte inválido: ${url}`);
    }
    return new Font(opentypeFontToTypeface(parsed, url.split("/").pop() || "TTF"));
  })();

  ttfCache.set(url, promise);
  // Falha não fica cacheada: corrigir o arquivo e recarregar já funciona.
  promise.catch(() => ttfCache.delete(url));
  return promise;
}
