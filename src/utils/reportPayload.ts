import type { TreemapData, TreemapNode } from '../types/linkmap';
import { aggregateValues } from './pathTree';
import { assignTreemapColors } from './format';

// The compact form of a treemap that the CLI bakes into a report and apps/report decodes.
//
// It is deliberately not `JSON.stringify(TreemapData)`. Three things shrink it a lot on real
// linkmaps, where a tree runs to tens of thousands of nodes:
//
//   - nodes are positional tuples, so no key is repeated per node;
//   - colors and every group's value are dropped, since assignTreemapColors and aggregateValues
//     recompute them from the tree on load;
//   - section names are interned into a table, as the same handful repeat across every symbol.

export const REPORT_FORMAT_VERSION = 1;

/** [name, value, sectionIndex, displayName?], sectionIndex -1 when the symbol has no section. */
type EncodedSymbol = [string, number, number] | [string, number, number, string];

/** [name, inputPath, value, children | symbols], value null for a group node. */
type EncodedNode = [string, string, null, EncodedNode[]] | [string, string, number, EncodedSymbol[]];

export interface ReportPayload {
  version: number;
  name: string;
  totalSize: number;
  objectCount: number;
  symbolCount: number;
  sections: string[];
  nodes: EncodedNode[];
}

export function encodeReport(data: TreemapData): ReportPayload {
  const sections: string[] = [];
  const sectionIndexes = new Map<string, number>();

  const internSection = (section: string | undefined): number => {
    if (!section) return -1;
    let index = sectionIndexes.get(section);
    if (index === undefined) {
      index = sections.length;
      sections.push(section);
      sectionIndexes.set(section, index);
    }
    return index;
  };

  const encodeSymbol = (symbol: TreemapNode): EncodedSymbol => {
    const encoded: EncodedSymbol = [symbol.name, symbol.value ?? 0, internSection(symbol.section)];
    return symbol.displayName ? [...encoded, symbol.displayName] : encoded;
  };

  const encodeNode = (node: TreemapNode): EncodedNode => {
    if (node.children?.length) {
      return [node.name, node.inputPath ?? '', null, node.children.map(encodeNode)];
    }
    return [node.name, node.inputPath ?? '', node.value ?? 0, (node.symbols ?? []).map(encodeSymbol)];
  };

  return {
    version: REPORT_FORMAT_VERSION,
    name: data.name,
    totalSize: data.totalSize,
    objectCount: data.objectCount,
    symbolCount: data.symbolCount,
    sections,
    nodes: data.children.map(encodeNode),
  };
}

export function decodeReport(payload: ReportPayload): TreemapData {
  if (payload.version !== REPORT_FORMAT_VERSION) {
    throw new Error(
      `Unsupported report format (found ${payload.version}, expected ${REPORT_FORMAT_VERSION}). ` +
        'Regenerate the report with a matching version of linkmap-viewer.',
    );
  }

  const { sections } = payload;

  const decodeSymbol = ([name, value, sectionIndex, displayName]: EncodedSymbol): TreemapNode => {
    const symbol: TreemapNode = { name, value };
    if (sectionIndex >= 0) symbol.section = sections[sectionIndex];
    if (displayName) symbol.displayName = displayName;
    return symbol;
  };

  const decodeNode = ([name, inputPath, value, rest]: EncodedNode): TreemapNode => {
    const node: TreemapNode = { name };
    if (inputPath) node.inputPath = inputPath;

    if (value === null) {
      node.children = (rest as EncodedNode[]).map(decodeNode);
    } else {
      node.value = value;
      node.symbols = (rest as EncodedSymbol[]).map(decodeSymbol);
    }
    return node;
  };

  const data: TreemapData = {
    name: payload.name,
    children: payload.nodes.map(decodeNode),
    totalSize: payload.totalSize,
    objectCount: payload.objectCount,
    symbolCount: payload.symbolCount,
  };

  aggregateValues(data);
  assignTreemapColors(data);
  return data;
}
