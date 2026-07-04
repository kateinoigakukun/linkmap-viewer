#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep in sync with apps/report/index.html and apps/report/embedded.ts.
const DATA_PLACEHOLDER = '__LINKMAP_VIEWER_DATA__';

const TEMPLATE_PATH = fileURLToPath(new URL('../dist-report/index.html', import.meta.url));
const REPORT_DATA_PATH = fileURLToPath(new URL('../dist-cli/reportData.mjs', import.meta.url));

function printUsage() {
  console.log(`Usage: linkmap-viewer <linkmap> [-o|--output <output.html>]

Renders a linker map (.map or .map.gz, wasm-ld or Apple ld) as a
self-contained HTML report that can be opened directly in a browser.

Options:
  -o, --output <path>  Output HTML path (default: <linkmap>.html)
  -h, --help           Show this help message`);
}

function parseArgs(argv) {
  let input;
  let output;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '-o' || arg === '--output') {
      output = argv[++i];
      if (output === undefined) {
        throw new Error(`Missing value for ${arg}`);
      }
    } else if (input === undefined) {
      input = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!input) {
    throw new Error('Missing required <linkmap> argument');
  }

  return { input, output };
}

function defaultOutputPath(inputPath) {
  const dir = dirname(inputPath);
  const name = basename(inputPath);
  const stripped = name.endsWith('.map.gz')
    ? name.slice(0, -'.map.gz'.length)
    : name.slice(0, name.length - extname(name).length) || name;
  return join(dir, `${stripped}.html`);
}

function readLinkmapText(inputPath) {
  const bytes = readFileSync(inputPath);
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  return (isGzip ? gunzipSync(bytes) : bytes).toString('utf8');
}

function fail(message) {
  console.error(`linkmap-viewer: ${message}`);
  process.exit(1);
}

/** Demangles Swift symbols with the Node build of the same wasm demangler the playground uses. */
async function demangleSwiftNames(names) {
  const { default: initSwiftDemangle } = await import('swift-demangle-wasm');
  const demangle = await initSwiftDemangle();

  const demangled = {};
  for (const name of names) {
    const result = demangle(name);
    if (result !== name) demangled[name] = result;
  }
  return demangled;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`linkmap-viewer: ${err.message}\n`);
    printUsage();
    process.exit(1);
  }

  const outputPath = args.output ?? defaultOutputPath(args.input);

  let template;
  try {
    template = readFileSync(TEMPLATE_PATH, 'utf8');
  } catch {
    fail(
      `report template not found at ${TEMPLATE_PATH}.\n` +
        'Run `npm run build:report` in the linkmap-viewer package first.',
    );
  }

  if (!template.includes(DATA_PLACEHOLDER)) {
    fail('report template is missing its data placeholder; it may be out of date.');
  }

  let buildReportPayload;
  try {
    ({ buildReportPayload } = await import(REPORT_DATA_PATH));
  } catch {
    fail(
      `report builder not found at ${REPORT_DATA_PATH}.\n` +
        'Run `npm run build:cli` in the linkmap-viewer package first.',
    );
  }

  let text;
  try {
    text = readLinkmapText(args.input);
  } catch (err) {
    fail(`failed to read ${args.input}: ${err.message}`);
  }

  let payload;
  try {
    payload = await buildReportPayload(text, demangleSwiftNames);
  } catch (err) {
    fail(`failed to parse ${args.input}: ${err.message}`);
  }

  const encoded = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8')).toString('base64');
  const html = template.split(DATA_PLACEHOLDER).join(encoded);

  try {
    writeFileSync(outputPath, html);
  } catch (err) {
    fail(`failed to write ${outputPath}: ${err.message}`);
  }

  console.log(
    `Wrote ${outputPath} (${(html.length / 1024).toFixed(0)} kB, ` +
      `${payload.objectCount} input files, ${payload.symbolCount} symbols)`,
  );
}

await main();
