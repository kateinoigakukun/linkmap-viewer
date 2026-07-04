export interface LinkmapSymbol {
  name: string;
  size: number;
  section?: string;
}

export interface LinkmapObject {
  name: string;
  path: string;
  size: number;
  section?: string;
  symbols: LinkmapSymbol[];
}

export interface LinkmapData {
  sections: Record<string, number>;
  objects: Record<string, LinkmapObject>;
  symbols: Array<LinkmapSymbol & { object: string }>;
  totalSize: number;
}

export interface TreemapNode {
  name: string;
  /** Demangled name for a Swift symbol, when it differs from `name`. Filled in by the playground
   * after in-browser demangling, and by the CLI when it builds a report. */
  displayName?: string;
  value?: number;
  inputPath?: string;
  color?: string;
  section?: string;
  isSymbol?: boolean;
  children?: TreemapNode[];
  symbols?: TreemapNode[];
}

export interface SymbolDetail {
  name: string;
  displayName?: string;
  size: number;
  section?: string;
  objectPath: string;
  objectSize: number;
  color?: string;
}

export interface TreemapData extends TreemapNode {
  children: TreemapNode[];
  totalSize: number;
  objectCount: number;
  symbolCount: number;
}
