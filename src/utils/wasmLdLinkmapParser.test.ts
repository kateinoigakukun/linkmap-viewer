import { describe, expect, it } from 'vitest';
import { parseWasmLdLinkmap } from './wasmLdLinkmapParser';

describe('parseWasmLdLinkmap', () => {
  it('parses sections, objects, and symbols', () => {
    const content = `    Addr      Off     Size Out     In      Symbol
       -        8     6240 TYPE
       -   146bf9       20         /path/to/file.o:(symbol_name)
       -   146bf9       20                 symbol_name`;

    const result = parseWasmLdLinkmap(content);

    expect(result.totalSize).toBe(0x6240 + 0x20);
    expect(result.sections.TYPE).toBe(0x6240);
    expect(result.objects['/path/to/file.o']).toBeDefined();
    expect(result.objects['/path/to/file.o'].size).toBe(0x20);
    expect(result.symbols).toHaveLength(1);
  });

  it('keeps full path as object key', () => {
    const content = `    Addr      Off     Size Out     In      Symbol
       -        0       10         /some/deep/path/module.o:(sym)`;

    const result = parseWasmLdLinkmap(content);

    expect(result.objects['/some/deep/path/module.o']).toBeDefined();
    expect(result.objects['/some/deep/path/module.o'].name).toBe('module');
  });

  it('keeps archive paths intact', () => {
    const content = `    Addr      Off     Size Out     In      Symbol
       -        0       10         /path/to/libtest.a(member.o):(symbol)`;

    const result = parseWasmLdLinkmap(content);

    expect(result.objects['/path/to/libtest.a(member.o)']).toBeDefined();
  });

  it('handles internal symbols', () => {
    const content = `    Addr      Off     Size Out     In      Symbol
       -        0       10         <internal>:(internal_symbol)`;

    const result = parseWasmLdLinkmap(content);

    expect(result.objects['<internal>']).toBeDefined();
  });

  it('ignores zero-size entries and malformed lines', () => {
    const content = `    Addr      Off     Size Out     In      Symbol
       -        0        0         zero.o:(zero)
       not a valid line
       -        0       20         other.o:(sym)`;

    const result = parseWasmLdLinkmap(content);

    expect(result.totalSize).toBe(0x20);
    expect(result.symbols).toHaveLength(1);
  });

  it('skips duplicate continuation lines', () => {
    const content = `    Addr      Off     Size Out     In      Symbol
       -        0       10         /path/to/file.o:(symbol_name)
       -        0       10                 symbol_name
       -        0       20                 $sMangledSymbol`;

    const result = parseWasmLdLinkmap(content);

    expect(result.symbols).toHaveLength(1);
    expect(result.objects['/path/to/file.o'].size).toBe(0x10);
  });

  it('does not treat C++ symbol names as object paths', () => {
    const content = `    Addr      Off     Size Out     In      Symbol
       -        0       40         /path/lib.a(member.o):(.rodata._ZN5swift31ImplicitGenericParamDescriptorsE)
       -        0       40                 swift::ImplicitGenericParamDescriptors
       -        0       10                 std::__2::small_primes`;

    const result = parseWasmLdLinkmap(content);

    expect(Object.keys(result.objects)).toEqual(['/path/lib.a(member.o)']);
    expect(result.objects['/path/lib.a(member.o)'].size).toBe(0x40);
    expect(result.symbols).toHaveLength(1);
  });

  it('parses CUSTOM section headers', () => {
    const content = `    Addr      Off     Size Out     In      Symbol
       -        0      100 CUSTOM(.debug_info)
       -        0       10         /path/to/file.o:(sym)`;

    const result = parseWasmLdLinkmap(content);

    expect(result.sections.CUSTOM).toBe(0x100);
    expect(result.symbols).toHaveLength(1);
  });
});
