import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appleMapPath, sampleMapGzPath, sampleMapPath } from './helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const cliPath = path.join(repoRoot, 'bin', 'linkmapviz.mjs');

function renderReport(inputPath: string): { outputPath: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'linkmapviz-report-'));
  const outputPath = path.join(dir, 'report.html');
  execFileSync('node', [cliPath, inputPath, '-o', outputPath], { cwd: repoRoot });
  return { outputPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test.describe('linkmapviz CLI', () => {
  test('renders a self-contained report from a wasm-ld map', async ({ page }) => {
    const { outputPath, cleanup } = renderReport(sampleMapPath);
    try {
      await page.goto(`file://${outputPath}`);
      await expect(page.getByTestId('summary')).toContainText('3 input files');
      await expect(page.getByTestId('treemap-svg')).toBeVisible();
    } finally {
      cleanup();
    }
  });

  test('renders a self-contained report from a gzip-compressed map', async ({ page }) => {
    const { outputPath, cleanup } = renderReport(sampleMapGzPath);
    try {
      await page.goto(`file://${outputPath}`);
      await expect(page.getByTestId('summary')).toContainText('3 input files');
    } finally {
      cleanup();
    }
  });

  test('renders Swift symbols the CLI demangled ahead of time', async ({ page }) => {
    const { outputPath, cleanup } = renderReport(appleMapPath);
    try {
      await page.goto(`file://${outputPath}`);
      await expect(page.getByTestId('summary')).toContainText('2 input files');

      // Focus the object, which switches the treemap to its symbols.
      await page.locator('[data-testid=treemap-svg] .hit').first().click();
      await expect(page.locator('[data-testid=treemap-svg] text').first()).toHaveText(
        'SchemaNotesItemV',
      );

      // The mangled name is still available in the drawer.
      await page.locator('[data-testid=treemap-svg] .hit').first().click();
      await expect(page.getByTestId('symbol-drawer')).toContainText('$s6Schema10NotesItemV');
    } finally {
      cleanup();
    }
  });

  test('ships neither the wasm demangler nor a linkmap parser', () => {
    const { outputPath, cleanup } = renderReport(appleMapPath);
    try {
      const html = readFileSync(outputPath, 'utf8');

      expect(html).not.toContain('application/wasm');
      expect(html).not.toContain('swift-demangle');
      // A marker string only the Apple linkmap parser contains.
      expect(html).not.toContain('Dead Stripped Symbols');

      // The playground bundle alone is ~11 MB once the wasm demangler is inlined.
      expect(statSync(outputPath).size).toBeLessThan(1024 * 1024);
    } finally {
      cleanup();
    }
  });
});
