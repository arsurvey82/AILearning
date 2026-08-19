/**
 * Look at it. CLAUDE.md §11. Screenshots are part of the acceptance gate, and
 * the only way to catch collisions, overflow, and a surface that has stopped
 * being calm. Navigates by the same chips a reader would click.
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, './dist/index.html')).href;
const OUT = path.resolve(here, './test-results/shots');

/** Each entry is the chip path down from the root. */
const WALKS = [
  ['query', ['model', 'transformer', 'layer', 'attention', 'query']],
  ['weighted-sum', ['model', 'transformer', 'layer', 'attention', 'weighted-sum']],
  ['inference-path', ['operations', 'inference-path']],
  ['training-path', ['operations', 'training-path']],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const [name, chips] of WALKS) {
  await page.goto(BUILT);
  for (const id of chips) {
    // Pipeline stages show live data instead of a map, so their children are
    // reached from the notebook's "Inside" list rather than from chips. Both
    // exist on every node that has children; take whichever is on screen.
    const chip = page.locator(`.map-kid[data-node-id="${id}"]`);
    const item = page.locator(`.nb-inside-item[data-node-id="${id}"]`);
    if (await chip.count()) await chip.click();
    else await item.click();
    await page.waitForTimeout(140);
  }
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/sf-${name}.png` });
  console.log('shot', name);
}

await browser.close();
