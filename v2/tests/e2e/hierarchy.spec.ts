/**
 * The Dig panel never dead-ends: opening any concept shows hierarchy first.
 *
 * A reader who lands on transformer and has never seen the word before needs
 * parent, children, and next steps before any long prose. This test walks the
 * chain from the front door to transformer and asserts that the strip
 * renders the parts of a transformer as clickable chips, so the panel offers
 * somewhere to go on every open.
 */

import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, '../../dist/index.html')).href;

async function openLearn(page: Page) {
  await page.goto(BUILT);
  const learn = page.getByRole('button', { name: /^Trained model/ });
  if ((await learn.count()) > 0) await learn.click();
}

async function chip(page: Page, id: string) {
  return page.locator(`.gl-chip[data-term="${id}"]`).first();
}

async function digTo(page: Page, id: string) {
  // Bridges into the store from the panel that renders when the dig is open.
  // Deliberately runs through UI clicks, not evaluate, so the assertions
  // exercise the same paths a reader takes.
  const seeChip = page.locator(`.gl-see-row .gl-chip`, { hasText: id.replace(/-/g, ' ') }).first();
  await seeChip.click();
}

test('the dig panel shows hierarchy for transformer, and lets a reader walk into a part', async ({ page }) => {
  await openLearn(page);

  // The [[embedding]] chip on the Start view is the front door.
  const embeddingChip = await chip(page, 'embedding');
  await expect(embeddingChip).toBeVisible();
  await embeddingChip.click();

  const panel = page.locator('[data-testid="dig"]');
  await expect(panel).toBeVisible();

  // Walk the see chain from embedding to transformer through the panel.
  // embedding -> token-table -> position-table -> transformer.
  await digTo(page, 'token-table');
  await digTo(page, 'position-table');
  await digTo(page, 'transformer');

  await expect(panel.locator('.gl-term')).toHaveText('Transformer');

  // The hierarchy strip is what this task adds. It always renders first.
  const strip = panel.locator('[data-testid="hierarchy"]');
  await expect(strip).toBeVisible();

  // The parts that live inside a transformer, as clickable chips. Direct
  // children include layer, and the layer's children include attention,
  // mlp, residual and normalization. All five must land.
  for (const partId of ['layer', 'attention', 'mlp', 'residual', 'normalization']) {
    await expect(
      strip.locator(`[data-testid="hier-kid-${partId}"]`),
      `expected a chip for ${partId}`,
    ).toBeVisible();
  }

  // Clicking a child opens that child, keeping the trail intact.
  await strip.locator(`[data-testid="hier-kid-attention"]`).click();
  await expect(panel.locator('.gl-term')).toHaveText('Attention');

  // The trail carries the whole path back, so no reader is stranded on the
  // way down.
  const crumbs = panel.locator('.gl-crumb');
  await expect(crumbs).toHaveCount(5);
});
