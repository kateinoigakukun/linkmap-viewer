const GZIP_MAGIC = 0x1f;
const GZIP_MAGIC2 = 0x8b;

export function isGzipData(data: ArrayBuffer | Uint8Array): boolean {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC && bytes[1] === GZIP_MAGIC2;
}

export async function decompressGzip(data: ArrayBuffer): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Gzip decompression is not supported in this browser');
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  const decompressed = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}
