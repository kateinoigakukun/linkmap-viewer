import { expect, test } from '@playwright/test';
import path from 'node:path';
import {
  appleMapPath,
  fixturesDir,
  loadLinkmapFile,
  sampleMapGzPath,
  sampleMapPath,
} from './helpers';

const invalidGzPath = path.join(fixturesDir, 'invalid.map.gz');

test.describe('linkmap import', () => {
  test('loads a plain .map file', async ({ page }) => {
    await page.goto('/');
    await loadLinkmapFile(page, sampleMapPath);

    await expect(page.getByTestId('summary')).toContainText('2.3 kb');
    await expect(page.getByTestId('summary')).toContainText('3 input files');
    await expect(page.getByTestId('summary')).toContainText('3 symbols');
    await expect(page.getByTestId('treemap-svg')).toBeVisible();
  });

  test('loads an Apple ld map, detecting the format from its contents', async ({ page }) => {
    await page.goto('/');
    await loadLinkmapFile(page, appleMapPath);

    // 0x400 + 0x800 = 3072 bytes. The dead-stripped 0x9999 symbol must not be counted.
    await expect(page.getByTestId('summary')).toContainText('3.0 kb');
    await expect(page.getByTestId('summary')).toContainText('2 input files');
    await expect(page.getByTestId('summary')).toContainText('2 symbols');
    await expect(page.getByTestId('treemap-svg')).toBeVisible();
  });

  test('loads a gzip-compressed .map.gz file', async ({ page }) => {
    await page.goto('/');
    await loadLinkmapFile(page, sampleMapGzPath);

    await expect(page.getByTestId('summary')).toContainText('2.3 kb');
    await expect(page.getByTestId('treemap-svg')).toBeVisible();
  });

  test('loads the sample linkmap via the example button', async ({ page }) => {
    await page.route('**/samples/javascriptkit-basic.map.gz', async (route) => {
      const fs = await import('node:fs/promises');
      const body = await fs.readFile(sampleMapGzPath);
      await route.fulfill({
        status: 200,
        body,
        headers: { 'content-type': 'application/gzip' },
      });
    });

    await page.goto('/');
    await page.getByTestId('sample-link').click();

    await expect(page.getByTestId('summary')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('treemap-svg')).toBeVisible();
  });

  test('shows an error for invalid gzip content', async ({ page }) => {
    await page.goto('/');

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('import-button').click(),
    ]);
    await fileChooser.setFiles(invalidGzPath);

    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByTestId('summary')).toBeHidden();
  });
});

test.describe('clipboard import', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('loads linkmap pasted from clipboard', async ({ page }) => {
    await page.goto('/');

    const linkmap = `    Addr      Off     Size Out     In      Symbol
       -        0       64         /tmp/paste.o:(sym)
       -        0       64                 sym`;

    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, linkmap);

    const pasteShortcut = process.platform === 'darwin' ? 'Meta+v' : 'Control+v';
    await page.keyboard.press(pasteShortcut);

    await expect(page.getByTestId('summary')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('summary')).toContainText('100 bytes');
    await expect(page.getByTestId('summary')).toContainText('1 input file');
  });
});
