import type { LinkmapData } from '../types/linkmap';

const COLUMN_SPACES = '        ';

interface LinkmapEntry {
  addr: number;
  offset: number;
  size: number;
  out?: string;
  in?: string;
  symbol?: string;
}

function isValidHex(text: string | undefined): text is string {
  return text !== undefined && /^[0-9a-f]+$/.test(text);
}

function parseLinkmapLine(line: string): LinkmapEntry | undefined {
  let cursor = 0;
  const skipSpaces = () => {
    while (cursor < line.length && line[cursor] === ' ') cursor++;
  };
  const readUntilNextSpace = (): string | undefined => {
    const start = cursor;
    while (cursor < line.length && line[cursor] !== ' ' && line[cursor] !== '\n') cursor++;
    if (start === cursor) return undefined;
    return line.slice(start, cursor);
  };
  const peekString = (length: number) => line.slice(cursor, Math.min(cursor + length, line.length));

  skipSpaces();
  const addrText = readUntilNextSpace();
  if (addrText === undefined) return undefined;
  const addr = addrText === '-' ? -1 : isValidHex(addrText) ? parseInt(addrText, 16) : undefined;
  if (addr === undefined) return undefined;

  skipSpaces();
  const offsetText = readUntilNextSpace();
  const offset = isValidHex(offsetText) ? parseInt(offsetText, 16) : undefined;
  if (offset === undefined) return undefined;

  skipSpaces();
  const sizeText = readUntilNextSpace();
  const size = isValidHex(sizeText) ? parseInt(sizeText, 16) : undefined;
  if (size === undefined) return undefined;

  cursor++;

  let out: string | undefined;
  if (peekString(COLUMN_SPACES.length) === COLUMN_SPACES) {
    cursor += COLUMN_SPACES.length;
  } else {
    out = readUntilNextSpace();
  }

  let input: string | undefined;
  if (peekString(COLUMN_SPACES.length) === COLUMN_SPACES) {
    cursor += COLUMN_SPACES.length;
  } else {
    input = readUntilNextSpace();
  }

  skipSpaces();
  const symbol = cursor < line.length ? line.slice(cursor).trim() : undefined;

  return { addr, offset, size, out, in: input, symbol: symbol || undefined };
}

function isSectionHeader(entry: LinkmapEntry): boolean {
  if (entry.addr !== -1 || entry.in || entry.symbol) return false;
  const out = entry.out;
  if (!out) return false;
  if (/^[A-Z][A-Z0-9_]*$/.test(out)) return true;
  if (/^CUSTOM\(.+\)$/.test(out)) return true;
  return false;
}

function isInputFilePath(path: string): boolean {
  if (path.startsWith('<internal>')) return true;
  if (path.startsWith('/')) return true;
  if (path.endsWith('.o') || path.includes('.a(')) return true;
  return false;
}

function parseInputField(input: string): { objectPath: string; symbolName: string } | null {
  const match = input.match(/^(.+):\((.*)\)$/);
  if (!match) return null;

  const objectPath = match[1];
  const symbolName = match[2] || 'unnamed';
  if (!isInputFilePath(objectPath)) return null;

  return { objectPath, symbolName };
}

function displayName(path: string): string {
  if (path.startsWith('<internal>')) return '<internal>';
  const fileName = path.split('/').pop() ?? path;
  if (fileName.endsWith('.o')) return fileName.slice(0, -2);
  return fileName;
}

/** Parser for the map written by wasm-ld and other LLD flavours (`-Wl,-Map=out.map`). */
export function parseWasmLdLinkmap(text: string): LinkmapData {
  const lines = text.split('\n');
  const data: LinkmapData = {
    sections: {},
    objects: {},
    symbols: [],
    totalSize: 0,
  };

  let currentSection: string | null = null;

  for (let i = 1; i < lines.length; i++) {
    const entry = parseLinkmapLine(lines[i]);
    if (!entry || entry.size === 0) continue;

    if (isSectionHeader(entry)) {
      data.totalSize += entry.size;
      currentSection = entry.out!.match(/^([^(]+)/)?.[1] ?? entry.out!;
      data.sections[currentSection] = (data.sections[currentSection] || 0) + entry.size;
      continue;
    }

    if (!entry.in) continue;

    const parsed = parseInputField(entry.in);
    if (!parsed) continue;

    const { objectPath, symbolName } = parsed;
    data.totalSize += entry.size;

    if (!data.objects[objectPath]) {
      data.objects[objectPath] = {
        name: displayName(objectPath),
        path: objectPath,
        size: 0,
        symbols: [],
        section: currentSection || undefined,
      };
    }

    data.objects[objectPath].size += entry.size;
    data.objects[objectPath].symbols.push({
      name: symbolName,
      size: entry.size,
      section: currentSection || undefined,
    });

    data.symbols.push({
      name: symbolName,
      object: objectPath,
      size: entry.size,
      section: currentSection || undefined,
    });
  }

  return data;
}
