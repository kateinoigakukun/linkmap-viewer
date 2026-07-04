import { defineConfig } from 'vitest/config';

// Unit tests live next to the code in src/ and apps/. The app configs each set `root` to their own
// entrypoint directory, so tests get their own config rooted at the repository instead.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-report/**', '**/dist-cli/**', 'e2e/**'],
  },
});
