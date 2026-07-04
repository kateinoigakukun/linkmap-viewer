import { expect, test } from '@playwright/test';
import {
  appleMapPath,
  clickNestedTreemapTile,
  clickTreemapTile,
  loadLinkmapFile,
  loadSampleFixture,
} from './helpers';

test.describe('treemap rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadSampleFixture(page);
  });

  test('renders top-level directory groups', async ({ page }) => {
    const labels = await page.locator('[data-testid=treemap-svg] text').allTextContents();
    const joined = labels.join(' ');

    expect(joined).toMatch(/src/i);
    expect(joined).toMatch(/vendor/i);
  });

  test('shows tooltip with size on hover', async ({ page }) => {
    const tile = page.locator('[data-testid=treemap-svg] g').filter({
      has: page.locator('text').filter({ hasText: /vendor/i }),
    });
    await tile.first().locator('.hit').hover({ force: true });

    const tooltip = page.getByTestId('treemap-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator('.tooltip-size')).toContainText(/bytes|kb/i);
  });

  test('opens a bottom drawer when clicking a symbol cell', async ({ page }) => {
    await clickNestedTreemapTile(page, /^a$/);
    await clickNestedTreemapTile(page, /\.text$/);

    const drawer = page.getByTestId('symbol-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('heading')).toHaveText('.text');
    await expect(drawer).toContainText('1.0 kb');
    await expect(drawer).toContainText('100.0%');
    await expect(drawer).not.toContainText('Share of object');
    await expect(drawer).toContainText('/Users/test/project/src/a.o');

    await page.getByTestId('symbol-drawer-close').click();
    await expect(drawer).not.toBeVisible();
  });
});

test.describe('swift symbol demangling', () => {
  test('demangles a symbol once its object is focused, not on load', async ({ page }) => {
    const wasmRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('.wasm')) wasmRequests.push(request.url());
    });

    await page.goto('/');
    await loadLinkmapFile(page, appleMapPath);

    // Nothing Swift is on screen yet, so the demangler must not have been fetched.
    await expect(page.getByTestId('treemap-svg')).toBeVisible();
    expect(wasmRequests).toHaveLength(0);

    await page.locator('[data-testid=treemap-svg] .hit').first().click();

    await expect(page.locator('[data-testid=treemap-svg] text').first()).toHaveText(
      'SchemaNotesItemV',
      { timeout: 15_000 },
    );
    expect(wasmRequests.length).toBeGreaterThan(0);
  });
});

test.describe('subtree focus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadSampleFixture(page);
  });

  test('focuses directly on a deeply nested node from overview', async ({ page }) => {
    await clickNestedTreemapTile(page, /^a$/);

    await expect(page.getByTestId('treemap-breadcrumb')).toContainText('src');
    await expect(page.locator('[data-testid=treemap-breadcrumb] .treemap-breadcrumb-current')).toHaveText(
      'a',
    );

    const focusedLabels = await page.locator('[data-testid=treemap-svg] text').allTextContents();
    expect(focusedLabels.join(' ')).not.toMatch(/vendor/i);
  });

  test('navigates deeper and back via breadcrumb', async ({ page }) => {
    await clickNestedTreemapTile(page, /deep/i);

    await expect(page.getByTestId('treemap-breadcrumb')).toContainText('deep/b');
    await expect(page.locator('[data-testid=treemap-breadcrumb] .treemap-breadcrumb-current')).toHaveText(
      'deep/b',
    );

    const deepLabels = await page.locator('[data-testid=treemap-svg] text').allTextContents();
    expect(deepLabels.join(' ')).toMatch(/768 bytes/i);
    expect(deepLabels.join(' ')).not.toMatch(/vendor/i);

    await page.getByRole('button', { name: 'src', exact: true }).click();
    await expect(page.locator('[data-testid=treemap-breadcrumb] .treemap-breadcrumb-current')).toHaveText(
      'src',
    );

    await page.getByRole('button', { name: '/', exact: true }).click();
    await expect(page.getByTestId('treemap-breadcrumb')).toContainText('/');
    await expect(page.locator('[data-testid=treemap-breadcrumb] .treemap-breadcrumb-current')).toHaveText(
      '/',
    );

    const rootLabels = await page.locator('[data-testid=treemap-svg] text').allTextContents();
    expect(rootLabels.join(' ')).toMatch(/vendor/i);
  });
});
