import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Bundles the pure, DOM-free parsing/treemap/encoding logic (src/cli/reportData.ts and what it
// imports) into a plain Node ES module, so bin/linkmapviz.mjs can use the app's own parser
// without a TypeScript toolchain at install time.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolvePath('./dist-cli'),
    emptyOutDir: true,
    target: 'node18',
    minify: false,
    lib: {
      entry: resolvePath('./src/cli/reportData.ts'),
      formats: ['es'],
      fileName: () => 'reportData.mjs',
    },
  },
});
