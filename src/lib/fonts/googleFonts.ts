const SYSTEM_FONTS = new Set([
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Garamond',
  'Futura',
  'Courier New',
  'Verdana',
  'Georgia',
  'Trebuchet MS',
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
]);

const BATCH_SIZE = 10;
const TIMEOUT_MS = 10000;

const singleFontPromises = new Map<string, Promise<void>>();
const requestedFamilies = new Set<string>();

function stylesUrl(families: string[]): string {
  const list = families
    .map((family) => 'family=' + family.trim().replace(/\s+/g, '+') + ':wght@400;700')
    .join('&');
  return `https://fonts.googleapis.com/css2?${list}&display=swap`;
}

function loadStylesheet(href: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;

    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    link.onload = () => done(true);
    link.onerror = () => done(false);
    document.head.appendChild(link);
    window.setTimeout(() => done(true), TIMEOUT_MS);
  });
}

async function registerFontFace(family: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load(`700 64px "${family}"`);
    await document.fonts.load(`400 64px "${family}"`);
  } catch {
    // fallback para a fonte do sistema
  }
}

/**
 * Carrega a folha de estilo e os arquivos de uma família do Google Fonts
 * antes de gerar a geometria. Famílias de sistema e já carregadas são puladas.
 */
export function ensureGoogleFont(family: string): Promise<void> {
  if (!family || SYSTEM_FONTS.has(family)) return Promise.resolve();

  const cached = singleFontPromises.get(family);
  if (cached) return cached;

  const promise = (async () => {
    const loaded = await loadStylesheet(stylesUrl([family]));
    if (loaded) await registerFontFace(family);
    requestedFamilies.add(family);
  })();

  singleFontPromises.set(family, promise);
  return promise;
}

/**
 * Pré-carrega várias famílias em lotes (usado para as prévias do seletor).
 * O navegador só baixa os arquivos de fonte que realmente forem renderizados.
 */
export async function ensureGoogleFonts(families: string[]): Promise<void> {
  const pending = [
    ...new Set(families),
  ].filter((family) => family && !SYSTEM_FONTS.has(family) && !requestedFamilies.has(family));

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const loaded = await loadStylesheet(stylesUrl(batch));
    batch.forEach((family) => {
      requestedFamilies.add(family);
      if (!loaded) void ensureGoogleFont(family);
    });
  }
}
