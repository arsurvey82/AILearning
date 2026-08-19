/** Fly the camera through the pass and screenshot it, to check it reads. */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, '../dist/index.html')).href;
const OUT = path.resolve(here, '../test-results/shots');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BUILT);

for (const name of ['Embedding', 'Attention', 'Feed-Forward (MLP)', 'Softmax', 'The Loop']) {
  await page.locator('.ps-track').getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(1400); // let the camera settle
  await page.screenshot({ path: `${OUT}/scene-${name.replace(/\W+/g, '-')}.png` });
  console.log('shot', name);
}

await browser.close();
