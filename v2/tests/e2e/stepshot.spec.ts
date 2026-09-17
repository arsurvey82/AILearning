import { test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, '../../dist/index.html')).href;
const OUT = path.resolve(here, '../../test-results/review');

test('the three steps', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1250 });
  await page.goto(BUILT);
  await page.getByRole('button', { name: 'Trained model', exact: true }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'step-1.png') });
  await page.getByTestId('step-history').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'step-2.png') });
});

test('beyond text', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(BUILT);
  await page.locator('.map-kid[data-node-id="beyond"]').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'beyond.png') });
});
