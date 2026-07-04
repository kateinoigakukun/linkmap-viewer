import { describe, expect, it } from 'vitest';
import { isGzipFile } from './loadLinkmap';
import { isGzipData } from './gzip';

describe('loadLinkmap', () => {
  it('detects gzip files by extension', () => {
    expect(isGzipFile(new File([''], 'output.map.gz'))).toBe(true);
    expect(isGzipFile(new File([''], 'output.map'))).toBe(false);
  });

  it('detects gzip data by magic bytes', () => {
    expect(isGzipData(new Uint8Array([0x1f, 0x8b, 0x08]))).toBe(true);
    expect(isGzipData(new TextEncoder().encode('plain text'))).toBe(false);
  });
});
