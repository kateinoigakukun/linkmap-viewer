import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The playground: the interactive app at kateinoigakukun.github.io/linkmapviz, where you
// import a linkmap yourself. See vite.report.config.ts for the app the CLI bakes reports from.
export default defineConfig(({ command }) => ({
  root: resolvePath('./apps/playground'),
  publicDir: resolvePath('./public'),
  plugins: [react()],
  base: command === 'build' ? '/linkmapviz/' : '/',
  build: {
    outDir: resolvePath('./dist'),
    emptyOutDir: true,
  },
}));
