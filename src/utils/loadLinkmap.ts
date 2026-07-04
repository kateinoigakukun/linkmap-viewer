import { decompressGzip, isGzipData } from './gzip';

// Reading a linkmap from a file, the clipboard or the network is a playground concern only:
// reports are rendered from a treemap the CLI has already parsed (see src/utils/reportPayload.ts).

export const SAMPLE_LINKMAP_URL = 'samples/javascriptkit-basic.map.gz';

export function isGzipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.gz') || name.endsWith('.gzip');
}

export async function readLinkmapFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  if (isGzipFile(file) || isGzipData(buffer)) {
    return decompressGzip(buffer);
  }

  return new TextDecoder().decode(buffer);
}

export async function readLinkmapResponse(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer();

  if (isGzipData(buffer)) {
    return decompressGzip(buffer);
  }

  return new TextDecoder().decode(buffer);
}

export async function fetchSampleLinkmap(baseUrl: string): Promise<string> {
  const url = `${baseUrl}${SAMPLE_LINKMAP_URL}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load sample linkmap (${response.status})`);
  }

  return readLinkmapResponse(response);
}
