# Linkmap Viewer

Minimal viewer for linker map files. Upload a `.map` or gzip-compressed `.map.gz` file to see binary size as a D3 treemap grouped by object file and symbol.

Two formats are supported, detected from the file's own contents:

| Linker | How to produce a map |
| --- | --- |
| [wasm-ld](https://lld.llvm.org/) and other LLD flavours | `-Wl,-Map=output.map` |
| Apple `ld` (ld64, ld-prime) | `-Wl,-map,output.map`, or Xcode's `LD_GENERATE_MAP_FILE=YES` with `LD_MAP_FILE_PATH` |

The demo includes a [JavaScriptKit Basic example](https://github.com/swiftwasm/JavaScriptKit/tree/main/Examples/Basic) linkmap (`public/samples/javascriptkit-basic.map.gz`, 19 MB → 1.2 MB gzipped).

Live demo: https://kateinoigakukun.github.io/linkmap-viewer/

## CLI

The `linkmap-viewer` command renders a linker map as a single, self-contained HTML file — no
server needed, just open it in a browser:

```bash
npx linkmap-viewer output.map              # writes output.html
npx linkmap-viewer output.map -o report.html
```

It accepts the same `.map` and `.map.gz` files as the web app, from either linker.

## The two apps

| App | Entry | What it does |
| --- | --- | --- |
| Playground | `apps/playground` | The interactive site: you import a linkmap, it is parsed in the browser, and Swift symbols are demangled on demand with wasm as you focus an object. |
| Report | `apps/report` | What the CLI bakes into a generated report. No linkmap parser and no demangler — just a decoder for the treemap the CLI embedded. |

Both render the same treemap from `src/components`, so the two stay in step.

Splitting them is what keeps a report small. The CLI parses the linkmap and demangles its Swift
symbols in Node, then embeds a [compact encoding](src/utils/reportPayload.ts) of the treemap alone:
positional tuples, an interned section table, and no colors or group totals, since the app
recomputes those on load. So a report is ~250 kB rather than the ~11 MB it would cost to ship the
wasm demangler, and it carries only the symbols the treemap shows rather than the whole linkmap.

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

## GitHub Pages

Pushes to `main` deploy automatically via `.github/workflows/deploy.yml`.

Enable Pages in the repository settings: **Settings → Pages → Build and deployment → GitHub Actions**.

## Linkmap formats

Both parsers normalise to the same shape, so everything downstream — the path tree, the treemap,
the symbol drawer — is format-agnostic. `parseLinkmap` picks the parser; there is no setting.

Object names are taken from the path basename with a trailing `.o` stripped. Archive members are
named after the member rather than the archive, so `libFoo.a(Bar.o)` reads as `Bar`. No language-
or toolchain-specific path rewriting is applied.

### wasm-ld / LLD

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

Two details worth knowing. Symbols listed under `# Dead Stripped Symbols:` are **excluded** —
the linker removed them, so counting them would overstate every total. And the Mach-O leading
underscore is stripped from symbol names, which is what lets Swift's `$s` prefix reach the
demangler.

## License

MIT
