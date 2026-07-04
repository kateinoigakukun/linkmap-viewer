import { describe, expect, it } from 'vitest';
import { applyDemangledNames, collectSwiftSymbolNames, isSwiftMangledSymbol } from './swiftSymbols';
import type { TreemapNode } from '../types/linkmap';

function treeWithSymbols(): TreemapNode {
  return {
    name: 'root',
    children: [
      {
        name: 'obj',
        symbols: [
          { name: '$s13Example4fooyyF', value: 10 },
          { name: 'helper', value: 5 },
          { name: '$s13Example4fooyyF', value: 3 },
        ],
      },
    ],
  };
}

describe('isSwiftMangledSymbol', () => {
  it('detects Swift mangled symbols', () => {
    expect(isSwiftMangledSymbol('$sSi1soiyS2i_SitFZ')).toBe(true);
    expect(isSwiftMangledSymbol('main')).toBe(false);
    expect(isSwiftMangledSymbol('.text')).toBe(false);
  });
});

describe('collectSwiftSymbolNames', () => {
  it('collects mangled Swift symbols from the treemap tree, without duplicates', () => {
    expect(collectSwiftSymbolNames(treeWithSymbols())).toEqual(['$s13Example4fooyyF']);
  });
});

describe('applyDemangledNames', () => {
  it('records display names on the symbols that have one', () => {
    const root = treeWithSymbols();

    applyDemangledNames(root, { $s13Example4fooyyF: 'Example.foo()' });

    const symbols = root.children![0].symbols!;
    expect(symbols[0].displayName).toBe('Example.foo()');
    expect(symbols[2].displayName).toBe('Example.foo()');
    expect(symbols[1].displayName).toBeUndefined();
  });

  it('leaves names that demangle to themselves without a display name', () => {
    const root = treeWithSymbols();

    applyDemangledNames(root, { $s13Example4fooyyF: '$s13Example4fooyyF' });

    expect(root.children![0].symbols![0].displayName).toBeUndefined();
  });
});
