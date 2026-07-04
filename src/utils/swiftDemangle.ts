import { isSwiftMangledSymbol } from './swiftSymbols';
import type { SymbolDemangler } from '../types/symbolDemangler';

// The in-browser Swift demangler, used by the playground only. It pulls in an ~8.5 MB wasm module,
// which is why reports (built from apps/report) never import this file -- the CLI demangles them
// in Node instead, and a generated report carries display names, not a demangler.
// https://github.com/kateinoigakukun/swift-demangle.wasm
type DemangleFn = (mangledName: string) => string;

let demanglePromise: Promise<DemangleFn> | null = null;

export function loadSwiftDemangler(): Promise<DemangleFn> {
  if (!demanglePromise) {
    demanglePromise = (async () => {
      const [{ default: init }, { default: wasmUrl }] = await Promise.all([
        import('swift-demangle-wasm'),
        import('swift-demangle-wasm/dist/swift-demangle.wasm?url'),
      ]);
      return init({ module: fetch(wasmUrl) });
    })();
  }
  return demanglePromise;
}

/**
 * A demangler that resolves names as they are asked for, so opening a linkmap does not pay for
 * demangling symbols that are never looked at -- nor for loading the wasm module at all, until
 * the first Swift symbol is shown.
 */
export function createSwiftDemangler(): SymbolDemangler {
  const cache = new Map<string, string>();

  return {
    lookup(name) {
      return cache.get(name);
    },

    async request(names) {
      const pending = [...new Set(names)].filter(
        (name) => isSwiftMangledSymbol(name) && !cache.has(name),
      );
      if (pending.length === 0) return;

      // Demangling is best-effort: if the wasm module cannot be loaded, names stay mangled.
      let demangle: DemangleFn;
      try {
        demangle = await loadSwiftDemangler();
      } catch {
        return;
      }

      // Names that demangle to themselves are cached too, so they are not retried on every render.
      for (const name of pending) {
        cache.set(name, demangle(name));
      }
    },
  };
}
