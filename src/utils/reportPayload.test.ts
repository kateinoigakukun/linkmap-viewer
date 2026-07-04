import { describe, expect, it } from 'vitest';
import { decodeReport, encodeReport, REPORT_FORMAT_VERSION } from './reportPayload';
import { createTreemapData, parseLinkmap } from './linkmapParser';
import { applyDemangledNames } from './swiftSymbols';
import type { TreemapData } from '../types/linkmap';

const LINKMAP = `    Addr      Off     Size Out     In      Symbol
       -        0       10         /src/a.o:(one)
       -        0       20         /src/a.o:($s13Example4fooyyF)
       -        0       40         /lib/b.o:(three)`;

function buildTreemap(): TreemapData {
  const treemap = createTreemapData(parseLinkmap(LINKMAP));
  applyDemangledNames(treemap, { $s13Example4fooyyF: 'Example.foo()' });
  return treemap;
}

/** Drops keys whose value is undefined, so an absent field and an explicit undefined compare equal. */
function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('encodeReport / decodeReport', () => {
  it('round-trips the tree, including values, colors, sections and paths', () => {
    const original = buildTreemap();

    const restored = decodeReport(encodeReport(original));

    // The root's own `value`/`color` are recomputed rather than carried, since createTreemapData
    // drops them when it builds its wrapper; everything under it must match exactly.
    expect(normalize(restored.children)).toEqual(normalize(original.children));
    expect(restored.name).toBe(original.name);
    expect(restored.totalSize).toBe(original.totalSize);
    expect(restored.objectCount).toBe(original.objectCount);
    expect(restored.symbolCount).toBe(original.symbolCount);
  });

  it('keeps demangled display names', () => {
    const restored = decodeReport(encodeReport(buildTreemap()));

    const symbols = restored.children.flatMap((child) => child.symbols ?? []);
    expect(symbols.find((symbol) => symbol.name === '$s13Example4fooyyF')?.displayName).toBe(
      'Example.foo()',
    );
  });

  it('interns section names instead of repeating them per symbol', () => {
    const treemap = createTreemapData(
      parseLinkmap(`    Addr      Off     Size Out     In      Symbol
       -        0      100 TEXT
       -        0       10         /src/a.o:(one)
       -        0       20         /src/a.o:(two)
       -        0       40         /lib/b.o:(three)`),
    );

    const payload = encodeReport(treemap);

    expect(payload.sections).toEqual(['TEXT']);
  });

  it('rejects a payload written by a different format version', () => {
    const payload = { ...encodeReport(buildTreemap()), version: REPORT_FORMAT_VERSION + 1 };

    expect(() => decodeReport(payload)).toThrow(/Unsupported report format/);
  });
});
