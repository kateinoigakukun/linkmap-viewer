import { expect, test } from '@playwright/test';

test.describe('landing page', () => {
  test('shows title and import controls', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'linkmapviz' })).toBeVisible();
    await expect(page.getByTestId('import-button')).toBeVisible();
    await expect(page.getByTestId('sample-link')).toBeVisible();
    await expect(page.getByTestId('summary')).toBeHidden();
  });
});
