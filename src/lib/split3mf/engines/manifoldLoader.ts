import { getManifoldModule, setWasmUrl } from "manifold-3d/lib/wasm.js";
import wasmUrl from "manifold-3d/manifold.wasm?url";

type ManifoldModule = Awaited<ReturnType<typeof getManifoldModule>>;

let cached: ManifoldModule | null = null;
let loadError: string | null = null;
let loading: Promise<ManifoldModule> | null = null;
let wasmUrlOverride: string | null = null;

export type { ManifoldModule };

/**
 * Overrides the WASM URL used by the next `loadManifold()` call. In the
 * browser the Vite `?url` import is correct; tests running in Node must point
 * at the absolute path to `manifold.wasm` (e.g. `path.join(process.cwd(),
 * "node_modules/manifold-3d/manifold.wasm")`).
 */
export function setManifoldWasmUrl(url: string): void {
  wasmUrlOverride = url;
  resetManifold();
}

/**
 * Lazily loads the manifold-3d WASM module (singleton). Loads once and
 * caches; subsequent calls resolve instantly. Throws after a failed load.
 * Set `manifold3d.wasmUrl` before calling to override the WASM fetch path
 * (Vite emits a hashed asset URL).
 */
export async function loadManifold(): Promise<ManifoldModule> {
  if (cached) return cached;
  if (loadError) throw new Error(loadError);
  if (loading) return loading;

  loading = (async () => {
    setWasmUrl(wasmUrlOverride ?? wasmUrl);
    try {
      const mod = await getManifoldModule();
      cached = mod;
      return mod;
    } catch (err) {
      loadError = err instanceof Error ? err.message : "manifold-3d load failed";
      throw new Error(loadError);
    } finally {
      loading = null;
    }
  })();

  return loading;
}

/** True when the WASM module has already loaded (synchronous check). */
export function isManifoldReady(): boolean {
  return cached !== null;
}

/** Resets the cached module (useful for tests). */
export function resetManifold(): void {
  cached = null;
  loadError = null;
  loading = null;
}

export { setWasmUrl };
