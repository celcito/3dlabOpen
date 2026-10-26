/**
 * Fontes locais empacotadas em `public/fonts/`. Carregadas via FontFace API
 * (fetch do arquivo) em vez do Google Fonts.
 */
const LOCAL_FONT_FILES: Record<string, string> = {
  'Pokemon Solid': '/fonts/Pokemon Solid.ttf',
  'Pokemon Hollow': '/fonts/Pokemon Hollow.ttf',
  'Super Mario 256': '/fonts/Super Mario 256.ttf',
};

const localFontPromises = new Map<string, Promise<void>>();

export function isLocalFont(family: string): boolean {
  return Object.prototype.hasOwnProperty.call(LOCAL_FONT_FILES, family);
}

export function ensureLocalFont(family: string): Promise<void> {
  const cached = localFontPromises.get(family);
  if (cached) return cached;

  const src = LOCAL_FONT_FILES[family];
  const promise = (async () => {
    if (typeof document === 'undefined' || !document.fonts || !src) return;
    try {
      const res = await fetch(src);
      if (!res.ok) return;
      const buffer = await res.arrayBuffer();
      const fontFace = new FontFace(family, buffer);
      await fontFace.load();
      document.fonts.add(fontFace);
    } catch {
      // fallback para a fonte do sistema
    }
  })();

  localFontPromises.set(family, promise);
  return promise;
}
