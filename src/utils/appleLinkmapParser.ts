import type { LinkmapData } from '../types/linkmap';

// Parser for the linker map written by Apple's ld (ld64 and ld-prime), as produced by
// `-Wl,-map,<path>` or Xcode's LD_GENERATE_MAP_FILE=YES / LD_MAP_FILE_PATH.
//
// The format is four labelled sections:
//
//   # Path: /path/to/binary
//   # Arch: arm64
//   # Object files:
//   [  0] linker synthesized
//   [  1] /path/to/foo.o
//   [  2] /path/to/libBar.a(Bar.o)
//   # Sections:
//   # Address	Size    	Segment	Section
//   0x100004000	0x00001000	__TEXT	__text
//   # Symbols:
//   # Address	Size    	File  Name
//   0x100004000	0x00000100	[  1] _$s3Foo3BarV
//   # Dead Stripped Symbols:
//   #        	Size    	File  Name
//   <<dead>> 	0x00000008	[  1] _$s3Foo6UnusedV
//
// Symbols reference an object file by its index in the table above. Sections are given as
// address ranges, so a symbol's section is found by locating the range containing its address.

interface SectionRange {
  start: number;
  end: number;
  name: string;
}

const OBJECT_LINE = /^\[\s*(\d+)\]\s+(.*)$/;
const SECTION_LINE = /^(0x[0-9a-fA-F]+)\s+(0x[0-9a-fA-F]+)\s+(\S+)\s+(\S+)\s*$/;
const SYMBOL_LINE = /^(0x[0-9a-fA-F]+)\s+(0x[0-9a-fA-F]+)\s+\[\s*(\d+)\]\s*(.*)$/;

/**
 * Recognises an Apple linker map. The object-file table is the distinguishing marker: wasm-ld
 * maps are a plain column layout with no `#`-prefixed section headers.
 */
export function isAppleLinkmap(text: string): boolean {
  const head = text.slice(0, 4096);
  return /^# Path:/m.test(head) && /^# Object files:/m.test(head);
}

/**
 * Mach-O gives every C symbol a leading underscore. Strip it so that names line up with what
 * the source declared, and so Swift's `$s` prefix is visible to the demangler.
 */
function normalizeSymbolName(raw: string): string {
  const name = raw.trim();
  return name.startsWith('_') ? name.slice(1) : name;
}

function findSection(ranges: SectionRange[], address: number): string | undefined {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const range = ranges[mid];
    if (address < range.start) hi = mid - 1;
    else if (address >= range.end) lo = mid + 1;
    else return range.name;
  }
  return undefined;
}

export function parseAppleLinkmap(text: string): LinkmapData {
  const data: LinkmapData = {
    sections: {},
    objects: {},
    symbols: [],
    totalSize: 0,
  };

  const objectPaths = new Map<string, string>();
  const ranges: SectionRange[] = [];
  let mode: 'none' | 'objects' | 'sections' | 'symbols' | 'dead' = 'none';

  for (const rawLine of text.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (line.startsWith('#')) {
      if (line.startsWith('# Object files:')) mode = 'objects';
      else if (line.startsWith('# Sections:')) mode = 'sections';
      // "Dead Stripped Symbols" must be checked before "Symbols": those bytes were removed by
      // the linker and are not in the binary, so counting them would overstate every total.
      else if (line.startsWith('# Dead Stripped Symbols:')) mode = 'dead';
      else if (line.startsWith('# Symbols:')) mode = 'symbols';
      continue;
    }
    if (line.length === 0) continue;

    if (mode === 'objects') {
      const match = OBJECT_LINE.exec(line);
      if (match) objectPaths.set(match[1], match[2].trim());
      continue;
    }

    if (mode === 'sections') {
      const match = SECTION_LINE.exec(line);
      if (!match) continue;
      const start = Number.parseInt(match[1], 16);
      const size = Number.parseInt(match[2], 16);
      const name = `${match[3]},${match[4]}`;
      ranges.push({ start, end: start + size, name });
      data.sections[name] = (data.sections[name] ?? 0) + size;
      continue;
    }

    if (mode === 'symbols') {
      const match = SYMBOL_LINE.exec(line);
      if (!match) continue;
      const size = Number.parseInt(match[2], 16);
      if (!Number.isFinite(size) || size === 0) continue;

      const objectPath = objectPaths.get(match[3]);
      if (objectPath === undefined) continue;

      const address = Number.parseInt(match[1], 16);
      const section = findSection(ranges, address);
      const name = normalizeSymbolName(match[4]) || 'unnamed';

      let object = data.objects[objectPath];
      if (!object) {
        object = {
          name: displayName(objectPath),
          path: objectPath,
          size: 0,
          symbols: [],
          section,
        };
        data.objects[objectPath] = object;
      }

      object.size += size;
      object.symbols.push({ name, size, section });
      data.symbols.push({ name, object: objectPath, size, section });
      data.totalSize += size;
    }
  }

  return data;
}

/**
 * Label for an object file. Archive members read better as the member itself
 * (`libFoo.a(Bar.o)` → `Bar`) since the archive name repeats across every entry.
 */
function displayName(path: string): string {
  const archive = path.match(/\(([^)]+)\)$/);
  if (archive) {
    const member = archive[1];
    return member.endsWith('.o') ? member.slice(0, -2) : member;
  }
  const fileName = path.split('/').pop() ?? path;
  return fileName.endsWith('.o') ? fileName.slice(0, -2) : fileName;
}
