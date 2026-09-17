import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, '../../dist/index.html')).href;
const OUT = path.resolve(here, '../../test-results/review');

test('the first screen', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 1150 });
  await page.goto(BUILT);
  await page.getByRole('button', { name: 'Trained model', exact: true }).click();
  await page.getByTestId('scale-model').click();
  await page.getByTestId('decide').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('gap-number')).toBeVisible();
  await page.locator('.hk').screenshot({ path: path.join(OUT, 'hook.png') });
});
