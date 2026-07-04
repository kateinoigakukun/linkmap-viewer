/**
 * Resolves display names for mangled symbols, on demand.
 *
 * The playground supplies a wasm-backed implementation (src/utils/swiftDemangle.ts) so symbols are
 * demangled only once they are actually shown. Generated reports supply none: the CLI demangled
 * them ahead of time and every symbol node already carries its `displayName`.
 */
export interface SymbolDemangler {
  /** The demangled name for `name`, if it has already been resolved. */
  lookup(name: string): string | undefined;
  /** Resolves `names`, so that `lookup` can answer for them once this settles. */
  request(names: string[]): Promise<void>;
}
