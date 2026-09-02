# linkmapviz

[![npm](https://img.shields.io/npm/v/linkmapviz)](https://www.npmjs.com/package/linkmapviz)
[![license](https://img.shields.io/npm/l/linkmapviz)](LICENSE)

Minimal viewer for linker map files. Upload a `.map` or gzip-compressed `.map.gz` file to see binary size as a D3 treemap grouped by object file and symbol.

Two formats are supported, detected from the file's own contents:

| Linker | How to produce a map |
| --- | --- |
| [wasm-ld](https://lld.llvm.org/) | `-Wl,-Map=output.map` |
| Apple `ld` (ld64, ld-prime) | `-Wl,-map,output.map`, or Xcode's `LD_GENERATE_MAP_FILE=YES` with `LD_MAP_FILE_PATH` |

The demo includes a [JavaScriptKit Basic example](https://github.com/swiftwasm/JavaScriptKit/tree/main/Examples/Basic) linkmap (`public/samples/javascriptkit-basic.map.gz`, 19 MB → 1.2 MB gzipped).

Live demo: https://kateinoigakukun.github.io/linkmapviz/


https://github.com/user-attachments/assets/e3072cb7-a254-42b2-8b1a-c500911ca246

## CLI

The `linkmapviz` command renders a linker map as a single, self-contained HTML file. No server needed, just open it in a browser:

```bash
npx linkmapviz output.map              # writes output.html
npx linkmapviz output.map -o report.html
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build         # the playground, into dist/
npm run build:report  # the report template the CLI fills in, into dist-report/
npm run build:cli     # the parser the CLI runs in Node, into dist-cli/
npm run preview
```

## Tests

```bash
npm test          # unit tests (Vitest)
npm run test:e2e  # browser tests (Playwright)
```

## Releasing

Bump the version, then push a matching `v` tag:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

## Linkmap formats

Both parsers normalise to the same shape, so everything downstream (the path tree, the treemap,
the symbol drawer) is format-agnostic. `parseLinkmap` picks the parser; there is no setting.

Object names are taken from the path basename with a trailing `.o` stripped. Archive members are
named after the member rather than the archive, so `libFoo.a(Bar.o)` reads as `Bar`. No language-
or toolchain-specific path rewriting is applied.

### wasm-ld

A column layout, one row per section and per symbol:

```
    Addr      Off     Size Out     In      Symbol
       -        8     6240 TYPE
       -   146bf9       20         /path/to/object.o:(symbol_name)
```

### Apple ld

Four labelled sections. Symbols reference an object file by its index in the table above them,
and a symbol's section is resolved from the address ranges in `# Sections:`.

```
# Path: /path/to/binary
# Arch: arm64
# Object files:
[  1] /path/to/foo.o
# Sections:
# Address	Size    	Segment	Section
0x100004000	0x00001000	__TEXT	__text
# Symbols:
# Address	Size    	File  Name
0x100004000	0x00000100	[  1] _$s3Foo3BarV
```

Symbols listed under `# Dead Stripped Symbols:` are **excluded**. The linker removed them, so
counting them would overstate every total. And the Mach-O leading underscore is stripped from
symbol names, which is what lets Swift's `$s` prefix reach the demangler.

## License

MIT
