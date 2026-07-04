import { decompressGzip, isGzipData } from '../../src/utils/gzip';
import { decodeReport, type ReportPayload } from '../../src/utils/reportPayload';
import type { TreemapData } from '../../src/types/linkmap';

// The CLI (bin/linkmap-viewer.mjs) substitutes this element's placeholder text with a base64 gzip
// of the encoded treemap. The placeholder text is deliberately not referenced here: the CLI does a
// blind find-and-replace over the whole built file, so a copy of it in this source would be
// clobbered too.
const EMBEDDED_DATA_ELEMENT_ID = 'linkmap-viewer-data';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Reads the treemap baked into this report, or null when the template was never filled in. */
export async function readEmbeddedTreemap(): Promise<TreemapData | null> {
  const base64 = document.getElementById(EMBEDDED_DATA_ELEMENT_ID)?.textContent?.trim();
  if (!base64) return null;

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(base64);
  } catch {
    // Not valid base64 -- this is the unfilled template, opened directly.
    return null;
  }

  const json = isGzipData(bytes)
    ? await decompressGzip(bytes.buffer as ArrayBuffer)
    : new TextDecoder().decode(bytes);

  return decodeReport(JSON.parse(json) as ReportPayload);
}
