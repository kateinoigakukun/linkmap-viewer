import { describe, expect, it } from 'vitest';
import { isAppleLinkmap, parseAppleLinkmap } from './appleLinkmapParser';
import { parseLinkmap } from './linkmapParser';

const APPLE_MAP = `# Path: /build/Release-iphoneos/CanvasKitApple.framework/CanvasKitApple
# Arch: arm64
# Object files:
[  0] linker synthesized
[  1] /build/Intermediates.noindex/Core.build/Objects-normal/arm64/Session.o
[  2] /build/Products/Release-iphoneos/libSchema.a(Schema.o)
# Sections:
# Address\tSize    \tSegment\tSection
0x100004000\t0x00000300\t__TEXT\t__text
0x100004300\t0x00000100\t__DATA\t__const
# Symbols:
# Address\tSize    \tFile  Name
0x100004000\t0x00000100\t[  1] _$s4Core7SessionCACycfc
0x100004100\t0x00000200\t[  2] _$s6Schema10NotesItemV
0x100004300\t0x00000080\t[  1] _plain_c_symbol
0x100004380\t0x00000000\t[  1] _zero_sized
# Dead Stripped Symbols:
#        \tSize    \tFile  Name
<<dead>> \t0x00009999\t[  1] _$s4Core6UnusedV
`;

describe('isAppleLinkmap', () => {
  it('recognises an Apple linker map', () => {
    expect(isAppleLinkmap(APPLE_MAP)).toBe(true);
  });

  it('does not claim a wasm-ld map', () => {
    const wasm = `    Addr      Off     Size Out     In      Symbol
       -        8     6240 TYPE
       -   146bf9       20         /path/to/file.o:(symbol_name)`;
    expect(isAppleLinkmap(wasm)).toBe(false);
  });
});

describe('parseAppleLinkmap', () => {
  it('attributes symbol sizes to their object file', () => {
    const result = parseAppleLinkmap(APPLE_MAP);

    const core = '/build/Intermediates.noindex/Core.build/Objects-normal/arm64/Session.o';
    const schema = '/build/Products/Release-iphoneos/libSchema.a(Schema.o)';

    expect(result.objects[core].size).toBe(0x100 + 0x80);
    expect(result.objects[schema].size).toBe(0x200);
    expect(result.totalSize).toBe(0x100 + 0x200 + 0x80);
  });

  it('records section sizes and assigns each symbol its section by address', () => {
    const result = parseAppleLinkmap(APPLE_MAP);

    expect(result.sections['__TEXT,__text']).toBe(0x300);
    expect(result.sections['__DATA,__const']).toBe(0x100);

    const bySection = Object.fromEntries(result.symbols.map((s) => [s.name, s.section]));
    expect(bySection['$s4Core7SessionCACycfc']).toBe('__TEXT,__text');
    expect(bySection['plain_c_symbol']).toBe('__DATA,__const');
  });

  it('strips the Mach-O underscore so Swift names keep their $s prefix', () => {
    const result = parseAppleLinkmap(APPLE_MAP);
    const names = result.symbols.map((s) => s.name);

    expect(names).toContain('$s4Core7SessionCACycfc');
    expect(names).toContain('plain_c_symbol');
    expect(names.some((n) => n.startsWith('_'))).toBe(false);
  });

  it('excludes dead-stripped symbols, which are not in the binary', () => {
    const result = parseAppleLinkmap(APPLE_MAP);

    expect(result.symbols.some((s) => s.name === '$s4Core6UnusedV')).toBe(false);
    expect(result.totalSize).toBeLessThan(0x9999);
  });

  it('skips zero-sized symbols', () => {
    const result = parseAppleLinkmap(APPLE_MAP);
    expect(result.symbols.some((s) => s.name === 'zero_sized')).toBe(false);
  });

  it('names an archive member after the member, not the archive', () => {
    const result = parseAppleLinkmap(APPLE_MAP);
    const schema = '/build/Products/Release-iphoneos/libSchema.a(Schema.o)';
    expect(result.objects[schema].name).toBe('Schema');
  });

  it('ignores object entries that are not real files', () => {
    // "linker synthesized" has no symbols pointing at it here; the point is that its presence
    // in the table does not break index-based lookup for the entries that follow.
    const result = parseAppleLinkmap(APPLE_MAP);
    expect(Object.keys(result.objects)).toHaveLength(2);
  });
});

describe('parseLinkmap dispatch', () => {
  it('routes an Apple map to the Apple parser', () => {
    const result = parseLinkmap(APPLE_MAP);
    expect(result.totalSize).toBe(0x100 + 0x200 + 0x80);
  });

  it('still routes a wasm-ld map to the wasm-ld parser', () => {
    const wasm = `    Addr      Off     Size Out     In      Symbol
       -        8     6240 TYPE
       -   146bf9       20         /path/to/file.o:(symbol_name)`;
    const result = parseLinkmap(wasm);
    expect(result.sections.TYPE).toBe(0x6240);
    expect(result.objects['/path/to/file.o'].size).toBe(0x20);
  });
});
