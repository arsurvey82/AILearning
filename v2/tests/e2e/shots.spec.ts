/**
 * Screenshots of the lens surfaces, for review by eye.
 *
 * CLAUDE.md section 11 asks for these to be taken AND looked at. Tests catch
 * a missing string; only a picture catches a grid that draws the same vector
 * five times, which is a thing that has already happened once in this project.
 */

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, '../../dist/index.html')).href;
const OUT = path.resolve(here, '../../test-results/review');

/** Clip to the top of the index: header, lens bar, and the first rows. */
async function shot(page: Page, ix: Locator, name: string) {
  const box = (await ix.boundingBox())!;
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 1250) },
  });
}

const LENSES = ['what', 'use', 'choose', 'why', 'when', 'file', 'code', 'scale'];

test('capture every lens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1300 });
  await page.goto(BUILT);
  await page.getByTestId('scale-start').click();
  const ix = page.getByTestId('concept-index');
  await expect(ix).toBeVisible();
  await ix.scrollIntoViewIfNeeded();

  for (const id of LENSES) {
    await ix.getByTestId(`lens-${id}`).click();
    await page.waitForTimeout(120);
    /* A full element shot is 4900px tall and Playwright paints only the first
       screen of it, which looks exactly like a table that stops after nine
       rows. Clipping to a readable window avoids both problems. */
    await shot(page, ix, `lens-${id}`);
  }

  // The state that used to render a bare table and no explanation.
  await ix.getByTestId('lens-why').click();
  await page.getByTestId('gaps-only').click();
  await shot(page, ix, 'gaps-none');
  await page.getByTestId('gaps-only').click();

  // The real gaps: concepts with nothing in the downloaded file.
  await ix.getByTestId('lens-file').click();
  await page.getByTestId('gaps-only').click();
  await shot(page, ix, 'gaps-file');
});

test('capture a concept with no history', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1300 });
  await page.goto(BUILT);
  await page.getByRole('button', { name: 'Concept map' }).click();
  for (const id of ['model', 'foundations', 'linalg', 'vector']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }
  await expect(page.locator('.dz-title')).toHaveText('Vector');
  await page.screenshot({ path: path.join(OUT, 'origin-none.png'), fullPage: false });
});
