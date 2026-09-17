/**
 * Does every control on the page actually do something?
 *
 * A control that looks live and changes nothing is the worst kind of bug,
 * because the reader concludes the page is broken and stops trusting the parts
 * that work. Nothing here asserts; it reports, so the output can be read and
 * judged rather than turned green.
 */

import { test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, '../../dist/index.html')).href;

/** A cheap fingerprint of what the reader can see. */
async function fingerprint(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
}

async function sweep(page: import('@playwright/test').Page, where: string) {
  const dead: string[] = [];
  const live: string[] = [];
  const n = await page.locator('button:visible').count();

  for (let i = 0; i < n; i++) {
    const b = page.locator('button:visible').nth(i);
    let label = '';
    try {
      label = (await b.innerText()).replace(/\s+/g, ' ').trim().slice(0, 46);
    } catch {
      continue;
    }
    if (!label) label = (await b.getAttribute('aria-label')) ?? '(unlabelled)';
    const before = await fingerprint(page);
    try {
      await b.click({ timeout: 1500 });
    } catch {
      dead.push(label + '  [NOT CLICKABLE]');
      continue;
    }
    await page.waitForTimeout(140);
    const after = await fingerprint(page);
    if (before === after) dead.push(label);
    else live.push(label);
    // Back to a known state, so each control is judged from the same place.
    await page.goto(BUILT);
    if (where === 'learn') {
      await page.getByRole('button', { name: 'Trained model', exact: true }).click();
      await page.waitForTimeout(180);
    }
  }
  console.log('=== ' + where + ': ' + live.length + ' live, ' + dead.length + ' changed nothing');
  for (const d of dead) console.log('   DEAD  ' + d);
}

/* A report rather than an assertion, and it clicks every control on the page
   one at a time, so it needs room. Kept in the suite because a dead control is
   invisible to every other test here. */
test.describe.configure({ timeout: 300_000 });

test('map surface: every control', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(BUILT);
  await sweep(page, 'map');
});

test('learn surface: every control', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(BUILT);
  await page.getByRole('button', { name: 'Trained model', exact: true }).click();
  await page.waitForTimeout(300);
  await sweep(page, 'learn');
});
