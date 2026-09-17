import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, '../../dist/index.html')).href;
const OUT = path.resolve(here, '../../test-results/review');

test('at-scale citations', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto(BUILT);
  // Sampling carries both kinds: a config figure and two pure conventions.
  await page.locator('.ps-track button', { hasText: 'Sampling' }).first().click();
  await page.getByRole('button', { name: /At scale/ }).click();
  await page.waitForTimeout(300);
  const note = page.locator('.app-note');
  await expect(note.locator('.dz-scale')).toBeVisible();
  await note.screenshot({ path: path.join(OUT, 'citations.png') });
});
