import type { LinkmapData, TreemapData, TreemapNode } from '../types/linkmap';
import { isAppleLinkmap, parseAppleLinkmap } from './appleLinkmapParser';
import { parseWasmLdLinkmap } from './wasmLdLinkmapParser';
import { aggregateValues, buildPathTree } from './pathTree';
import { assignTreemapColors } from './format';

/**
 * Parses a linker map, detecting which linker wrote it.
 *
 * Both supported formats normalise to the same {@link LinkmapData}, so everything downstream --
 * the path tree, the treemap, the symbol drawer -- is format-agnostic.
 */
export function parseLinkmap(text: string): LinkmapData {
  return isAppleLinkmap(text) ? parseAppleLinkmap(text) : parseWasmLdLinkmap(text);
}

export function createTreemapData(data: LinkmapData): TreemapData {
  const tree = buildPathTree(Object.values(data.objects));
  aggregateValues(tree);
  assignTreemapColors(tree);

  const objectCount = Object.keys(data.objects).length;

  return {
    name: tree.name,
    children: tree.children ?? [],
    totalSize: tree.value ?? 0,
    objectCount,
    symbolCount: data.symbols.length,
  };
}

export function nodeForZoom(node: TreemapNode): TreemapNode | null {
  if (node.children?.length) {
    return node;
  }
  if (node.symbols?.length) {
    return {
      name: node.name,
      value: node.value,
      inputPath: node.inputPath,
      children: node.symbols.map((symbol) => ({
        name: symbol.name,
        displayName: symbol.displayName,
        value: symbol.value,
        color: symbol.color,
        section: symbol.section,
        inputPath: node.inputPath,
        isSymbol: true,
      })),
    };
  }
  return null;
}
