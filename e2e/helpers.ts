import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const fixturesDir = path.join(__dirname, 'fixtures');
export const sampleMapPath = path.join(fixturesDir, 'sample.map');
export const sampleMapGzPath = path.join(fixturesDir, 'sample.map.gz');

export async function loadLinkmapFile(page: Page, filePath: string): Promise<void> {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('import-button').click(),
  ]);
  await fileChooser.setFiles(filePath);
  await expect(page.getByTestId('summary')).toBeVisible();
}

export async function loadSampleFixture(page: Page): Promise<void> {
  await loadLinkmapFile(page, sampleMapPath);
}

export async function clickTreemapTile(page: Page, label: string | RegExp): Promise<void> {
  await dispatchTreemapClick(page, label, 'parent');
}

export async function clickNestedTreemapTile(page: Page, label: string | RegExp): Promise<void> {
  await dispatchTreemapClick(page, label, 'nested');
}

async function dispatchTreemapClick(
  page: Page,
  label: string | RegExp,
  target: 'parent' | 'nested',
): Promise<void> {
  const pattern = label instanceof RegExp ? label : new RegExp(label, 'i');

  await page.evaluate(({ source, flags, target }) => {
    const labelPattern = new RegExp(source, flags);
    const svg = document.querySelector('[data-testid=treemap-svg]');
    if (!svg) throw new Error('Treemap SVG not found');

    const groups = Array.from(svg.querySelectorAll('g')).filter((group) => {
      const text = group.querySelector(':scope > text')?.textContent ?? '';
      return labelPattern.test(text);
    });

    const tileGroup =
      target === 'parent'
        ? groups.find((group) => group.querySelector(':scope > text')?.textContent?.includes(' – ')) ??
          groups[0]
        : groups.find((group) => !group.querySelector(':scope > text')?.textContent?.includes(' – ')) ??
          groups[groups.length - 1];

    if (!tileGroup) {
      throw new Error(`Treemap tile not found for ${source}`);
    }

    const hit = tileGroup.querySelector('.hit') as SVGRectElement | null;
    if (!hit) {
      throw new Error('Treemap hit target not found');
    }

    const rect = hit.getBoundingClientRect();
    const y = target === 'parent' ? Math.min(10, Math.max(1, rect.height / 4)) : rect.height / 2;
    hit.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + y,
        view: window,
      }),
    );
  }, { source: pattern.source, flags: pattern.flags, target });
  await page.waitForTimeout(50);
}

export async function getTreemapLabels(page: Page): Promise<string[]> {
  return page.locator('[data-testid=treemap-svg] text').allTextContents();
}

export async function getTopLevelTreemapLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid=treemap-svg]');
    if (!svg) return [];

    const labels: string[] = [];
    for (const group of svg.querySelectorAll('g')) {
      const hit = group.querySelector('.hit');
      const text = group.querySelector('text');
      if (!hit || !text) continue;

      const parentGroup = group.parentElement;
      if (parentGroup !== svg && parentGroup?.tagName.toLowerCase() === 'g') {
        continue;
      }

      labels.push(text.textContent ?? '');
    }
    return labels;
  });
}

export const appleMapPath = path.join(fixturesDir, 'apple.map');
