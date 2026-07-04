import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Builds apps/report into a single, dependency-free HTML file (dist-report/index.html) that the
// `linkmap-viewer` CLI uses as a template: it substitutes the `__LINKMAP_VIEWER_DATA__`
// placeholder with the encoded treemap and writes the result out as a standalone report.
//
// The report app imports no linkmap parser and no wasm demangler -- the CLI does both up front --
// so this bundle is a couple of hundred KB rather than the playground's ~11 MB of wasm.
export default defineConfig({
  root: resolvePath('./apps/report'),
  publicDir: false,
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: resolvePath('./dist-report'),
    emptyOutDir: true,
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
  },
});
