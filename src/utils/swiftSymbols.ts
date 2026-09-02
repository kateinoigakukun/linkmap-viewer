import type { TreemapNode } from '../types/linkmap';

// Pure Swift-symbol helpers, with no demangler attached. The playground demangles in the browser
// with wasm (swiftDemangle.ts); the CLI does it in Node (bin/linkmapviz.mjs). Both then call
// applyDemangledNames, so a report ships display names rather than a demangler.

export function isSwiftMangledSymbol(name: string): boolean {
  return name.startsWith('$s');
}

/** Distinct Swift-mangled symbol names in the tree, i.e. exactly the ones worth demangling. */
export function collectSwiftSymbolNames(root: TreemapNode): string[] {
  const names = new Set<string>();

  const walk = (node: TreemapNode): void => {
    node.symbols?.forEach((symbol) => {
      if (isSwiftMangledSymbol(symbol.name)) names.add(symbol.name);
    });
    node.children?.forEach(walk);
  };

  walk(root);
  return [...names];
}

/** Records demangled names on the symbols of `root`, in place. Names absent from the map, and
 * names that demangle to themselves, are left without a display name. */
export function applyDemangledNames(root: TreemapNode, demangled: Record<string, string>): void {
  const walk = (node: TreemapNode): void => {
    node.symbols?.forEach((symbol) => {
      const name = demangled[symbol.name];
      if (name !== undefined && name !== symbol.name) symbol.displayName = name;
    });
    node.children?.forEach(walk);
  };

  walk(root);
}
