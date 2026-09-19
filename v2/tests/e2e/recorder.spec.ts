import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, '../../dist/index.html')).href;

test('the learner never sees the recorder', async ({ page }) => {
  await page.goto(BUILT);
  /* A visible research instrument changes the session it is measuring, so it
     has to be absent rather than merely tucked away. */
  await expect(page.getByTestId('recorder')).toHaveCount(0);
});

test('the facilitator gets it, and it captures where they were', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(BUILT + '#playtest');
  await expect(page.getByTestId('recorder')).toBeVisible();
  await page.getByTestId('pt-start').click();

  // Navigate somewhere specific, as a learner would.
  await page.locator('.map-kid[data-node-id="model"]').click();
  await page.getByTestId('pt-said').click();
  await page.getByTestId('pt-words').fill('wait, is position 3 an A?');
  await page.getByTestId('pt-commit').click();

  const row = page.getByTestId('pt-list').locator('li').first();
  // Their words, verbatim. A tidied heading is what stops a card working.
  await expect(row).toContainText('wait, is position 3 an A?');
  // And the context, which the facilitator never typed.
  await expect(row).toContainText('The Model');

  // A stumble nobody voiced needs no typing at all.
  await page.getByTestId('pt-silent').click();
  await expect(page.getByTestId('pt-list').locator('li')).toHaveCount(2);
  await expect(page.getByTestId('pt-list').locator('li.silent')).toHaveCount(1);

  await expect(page.getByTestId('pt-copy')).toContainText('Copy 2 as markdown');
});

test('the clock and the context are captured at the keypress', async ({ page }) => {
  await page.goto(BUILT + '#playtest');
  await page.getByTestId('pt-start').click();
  await page.locator('.map-kid[data-node-id="operations"]').click();

  /* Captured when the button is pressed, not when typing finishes. By then the
     learner has moved on and the note would record where they went next. */
  await page.getByTestId('pt-said').click();
  await page.locator('.map-kid[data-node-id="inference-path"]').click();
  await page.getByTestId('pt-words').fill('what is a path');
  await page.getByTestId('pt-commit').click();

  const row = page.getByTestId('pt-list').locator('li').first();
  await expect(row).toContainText('The Operations');
  await expect(row).not.toContainText('Inference');
});
