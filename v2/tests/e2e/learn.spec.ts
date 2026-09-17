/**
 * QA for the trained-model surface.
 *
 * The rule from the build plan: "it renders" is not a test. Every control names
 * the exact observable change it causes, and the last test is a generic sweep
 * that clicks everything and fails on any control that leaves the page
 * unchanged. That backstop is what catches a dead button without needing a
 * bespoke test for each one.
 */

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, '../../dist/index.html')).href;
const SHOTS = path.resolve(here, '../../test-results/shots');

const SG_VERB = ['sits', 'runs', 'sleeps', 'sings', 'waits'];
const PL_VERB = ['sit', 'run', 'sleep', 'sing', 'wait'];

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/** The trained-model surface is opt-in while it is being built. */
async function openLearn(page: Page) {
  /* No longer the landing surface: the universe greets first and hands over
     to this. The header button reads "Trained model" from the map side. */
  await page.goto(BUILT);
  await page.getByRole('button', { name: 'Trained model', exact: true }).click();
}

/* Scale one is the front door now, so anything about the trained model has to
   ask for it. That ordering is the point rather than an inconvenience. */
async function openModelScale(page: Page) {
  await openLearn(page);
  await page.getByTestId('scale-model').click();
}

async function decide(page: Page) {
  await openModelScale(page);
  await page.getByTestId('decide').click();
  await expect(page.getByTestId('gap-word')).not.toHaveText('?');
}

/* The gap now carries the verb AND its number, because "the number did not
   change" was something the reader had to take on faith while watching the
   word change. This reads just the word, so every assertion below still means
   what it meant. */
const gap = (p: Page) => p.getByTestId('gap-word').innerText();

test('the hook opens on a sentence with a gap and one button', async ({ page }) => {
  const errors = watchConsole(page);
  await openModelScale(page);

  await expect(page.getByTestId('sentence')).toContainText('near');
  await expect(page.getByTestId('gap-word')).toHaveText('?');
  await expect(page.getByTestId('decide')).toBeVisible();
  // Nothing is revealed before the reader asks for it.
  await expect(page.getByTestId('attention')).toHaveCount(0);

  await page.screenshot({ path: `${SHOTS}/learn-1-ready.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('Watch it decide fills the gap with a verb that agrees with the subject', async ({ page }) => {
  const errors = watchConsole(page);
  await decide(page);

  const subject = await page.getByTestId('subject').innerText();
  const verb = await gap(page);
  const plural = !SG_VERB.concat(PL_VERB).includes(verb) ? null : PL_VERB.includes(verb);

  expect(SG_VERB.concat(PL_VERB), `model answered "${verb}"`).toContain(verb);
  // "cat" is singular, so the verb must be too. This is the task.
  expect(plural, `subject "${subject}" with verb "${verb}"`).toBe(subject.startsWith('cats'));
  await expect(page.getByTestId('verdict')).toContainText('Correct');

  await page.screenshot({ path: `${SHOTS}/learn-2-decided.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('changing the subject number changes the answer', async ({ page }) => {
  const errors = watchConsole(page);
  await decide(page);

  const before = await gap(page);
  await page.getByTestId('flip-subject').click();
  const after = await gap(page);

  expect(after, 'the verb must follow the subject').not.toBe(before);
  expect(SG_VERB.includes(before)).toBe(PL_VERB.includes(after));
  expect(errors).toEqual([]);
});

test('changing the distractor does NOT change the answer', async ({ page }) => {
  const errors = watchConsole(page);
  await decide(page);

  /* The whole point of the task, and the assertion that proves the model is
     not reading the nearest noun.

     Compared on NUMBER, not on the exact word. Five singular verbs are equally
     likely here, so the argmax can move between them whenever any input
     changes; that is not a failure and asserting string equality would make
     this test flap for a reason unrelated to the claim. */
  const before = await gap(page);
  await page.getByTestId('flip-distractor').click();
  const after = await gap(page);
  expect(
    PL_VERB.includes(after),
    `distractor flip changed "${before}" to "${after}", which crosses number`,
  ).toBe(PL_VERB.includes(before));
  await expect(page.getByTestId('verdict')).toContainText('Correct');
  expect(errors).toEqual([]);
});

test('the attention row shows the reach past the distractor', async ({ page }) => {
  const errors = watchConsole(page);
  await decide(page);

  const bars = page.locator('.hk-bar');
  await expect(bars).toHaveCount(5);

  const pct = async (sel: string) =>
    Number(await page.locator(`.hk-bar.${sel} .hk-bar-p`).innerText());
  const onSubject = await pct('subject');
  const onDistractor = await pct('distractor');

  expect(onSubject, 'most of the attention should land on the subject').toBeGreaterThan(50);
  expect(onSubject).toBeGreaterThan(onDistractor * 5);

  await page.screenshot({ path: `${SHOTS}/learn-3-attention.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('editing a word after deciding never leaves a stale answer on screen', async ({ page }) => {
  const errors = watchConsole(page);
  await decide(page);

  const before = await gap(page);
  // Cycle to a different noun of the same number. The verb may or may not
  // change, but the attention row must be recomputed for the new sentence.
  await page.getByTestId('subject').click();
  const subject = await page.getByTestId('subject').innerText();
  expect(subject).not.toBe('cat');
  await expect(page.getByTestId('gap-word')).not.toHaveText('?');
  expect(SG_VERB.concat(PL_VERB)).toContain(await gap(page));
  expect(before).toBeTruthy();
  expect(errors).toEqual([]);
});

test('the concept map is still reachable and still works', async ({ page }) => {
  const errors = watchConsole(page);
  // The map is the landing surface now, so there is nothing to click to reach
  // it. The rest of the assertion is unchanged: it still has to work.
  await page.goto(BUILT);
  await expect(page.locator('.app-note .dz-title')).toBeVisible();
  await expect(page.locator('.ps-track')).toContainText('Attention');
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * The backstop.
 * ------------------------------------------------------------------ */

test('every control on the hook changes something', async ({ page }) => {
  const errors = watchConsole(page);
  await decide(page);

  /* Address controls by their test id, not by index.

     Clicking a control can add or remove other controls, so a list captured
     once goes stale mid-sweep and the run fails on a missing element rather
     than on a dead button. Identity survives the page changing under us. */
  const ids = ['subject', 'distractor', 'flip-subject', 'flip-distractor'];
  const snapshot = () =>
    page.evaluate(() => (document.querySelector('.hk') as HTMLElement).innerText);

  const dead: string[] = [];
  for (const id of ids) {
    const before = await snapshot();
    await page.getByTestId(id).click();
    if (before === (await snapshot())) dead.push(id);
  }

  expect(dead, `controls that did nothing: ${dead.join(', ')}`).toEqual([]);
  // And the one that navigates instead of mutating.
  await page.getByTestId('open-model').click();
  await expect(page.getByTestId('ladder')).toBeVisible();
  expect(errors).toEqual([]);
});

test('no horizontal overflow on a phone', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 390, height: 780 });
  await decide(page);
  const ok = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(ok).toBe(true);
  await page.screenshot({ path: `${SHOTS}/learn-4-narrow.png`, fullPage: true });
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * The ladder, and its seam with the concept map.
 * ------------------------------------------------------------------ */

async function openLadder(page: Page) {
  await decide(page);
  await page.getByTestId('open-model').click();
  await expect(page.getByTestId('ladder')).toBeVisible();
}

test('the ladder opens on the whole model and goes down five rungs', async ({ page }) => {
  const errors = watchConsole(page);
  await openLadder(page);

  await expect(page.getByTestId('crumb-model')).toBeVisible();
  for (const r of ['model', 'block', 'head', 'neuron', 'number']) {
    await page.getByTestId(`rung-${r}`).click();
    await expect(page.getByTestId(`crumb-${r}`), `rung ${r}`).toBeVisible();
  }
  await page.screenshot({ path: `${SHOTS}/learn-5-ladder.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('switching block changes what is drawn', async ({ page }) => {
  const errors = watchConsole(page);
  await openLadder(page);
  await page.getByTestId('rung-block').click();

  const shot = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('.ld-a11y')).map((e) => (e as HTMLElement).innerText).join('|'),
    );
  const one = await shot();
  await page.getByTestId('pick-block-1').click();
  expect(await shot(), 'block 2 must not draw block 1').not.toBe(one);
  expect(errors).toEqual([]);
});

test('switching head changes the attention grid, and rows still sum to 1', async ({ page }) => {
  const errors = watchConsole(page);
  await openLadder(page);
  await page.getByTestId('rung-head').click();

  const rows = () =>
    page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.ld-g'));
      const att = blocks.find((b) => b.textContent?.includes('budget adding to 1'));
      return Array.from(att!.querySelectorAll('.ld-a11y li')).map((li) => li.textContent ?? '');
    });

  const h1 = await rows();
  await page.getByTestId('pick-head-1').click();
  const h2 = await rows();
  expect(h2, 'the two heads must not be identical').not.toEqual(h1);

  // Every visible row of a softmax has to add up.
  for (const line of h2) {
    const nums = (line.match(/-?\d+\.\d+/g) ?? []).map(Number);
    if (nums.length) expect(nums.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1.001);
  }
  expect(errors).toEqual([]);
});

test('clicking a cell reads out its value, clicking again clears it', async ({ page }) => {
  const errors = watchConsole(page);
  await openLadder(page);
  await page.getByTestId('rung-head').click();

  const cv = page.locator('.ld-canvas').first();
  const box = (await cv.boundingBox())!;
  await cv.click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId('picked').first()).toBeVisible();

  await cv.click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId('picked')).toHaveCount(0);
  expect(box.width).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('every rung links across to the concept that explains it', async ({ page }) => {
  const errors = watchConsole(page);
  await openLadder(page);

  const expected: Record<string, string> = {
    model: 'The Transformer',
    block: 'Transformer Layer',
    head: 'Attention',
    neuron: 'Neuron',
    number: 'Parameter',
  };

  for (const [rung, title] of Object.entries(expected)) {
    await page.getByTestId(`rung-${rung}`).click();
    await expect(page.getByTestId('read-concept'), `rung ${rung}`).toContainText(title);
  }
  expect(errors).toEqual([]);
});

test('the concept link lands on that lesson in the universe', async ({ page }) => {
  const errors = watchConsole(page);
  await openLadder(page);
  await page.getByTestId('rung-head').click();
  await page.getByTestId('read-concept').click();

  // It leaves the trained-model surface and opens the authored lesson, so the
  // instance and the concept are one click apart in both directions.
  await expect(page.getByTestId('ladder')).toHaveCount(0);
  await expect(page.locator('.dz-title')).toHaveText('Attention');
  await page.screenshot({ path: `${SHOTS}/learn-6-seam.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('every control on the ladder changes something', async ({ page }) => {
  const errors = watchConsole(page);
  await openLadder(page);

  const snapshot = () =>
    page.evaluate(() => (document.querySelector('.ld') as HTMLElement).innerText);

  /* Per rung, the controls that rung actually offers. Sweeping a single flat
     list does not work here: choosing a rung changes which selectors exist, so
     the set has to be re-derived after every move. */
  /* Ordered so every click is a real transition. The ladder opens on `model`,
     so visiting it first would look like a dead button when it is simply
     already selected. It comes last instead, arriving from `number`. */
  const perRung: Array<[string, string[]]> = [
    ['block', ['pick-block-1', 'pick-block-0']],
    ['head', ['pick-head-1', 'pick-head-0', 'pick-block-1', 'pick-block-0']],
    ['neuron', ['pick-block-1', 'pick-block-0']],
    ['number', []],
    ['model', []],
  ];

  const dead: string[] = [];
  for (const [rung, ids] of perRung) {
    const beforeRung = await snapshot();
    await page.getByTestId(`rung-${rung}`).click();
    if (beforeRung === (await snapshot())) dead.push(`rung-${rung}`);

    for (const id of ids) {
      const before = await snapshot();
      await page.getByTestId(id).click();
      if (before === (await snapshot())) dead.push(`${rung}/${id}`);
    }
  }

  expect(dead, `controls that did nothing: ${dead.join(', ')}`).toEqual([]);
  expect(errors).toEqual([]);
});

test('the learned table shows different rows for different words', async ({ page }) => {
  const errors = watchConsole(page);
  await openLadder(page);
  await page.getByTestId('rung-number').click();

  /* A screenshot caught this one and no assertion would have.
     The grid was labelled "token table" but drew the same vector for every row,
     because a placeholder returned one embedded row regardless of the id. It
     looked plausible and was false, which is the failure mode this whole
     project exists to avoid. */
  const rows = await page.evaluate(() => {
    const g = Array.from(document.querySelectorAll('.ld-g')).find((e) =>
      e.textContent?.includes('Token table'),
    );
    return Array.from(g!.querySelectorAll('.ld-a11y li')).map((li) => li.textContent ?? '');
  });

  expect(rows.length).toBeGreaterThan(2);
  // "the" appears twice and must be identical; "cat" must differ from "the".
  const byWord = new Map<string, string>();
  for (const r of rows) {
    const word = r.split(':')[0]!.trim();
    const nums = r.slice(r.indexOf(':') + 1);
    if (byWord.has(word)) expect(byWord.get(word), `same word, same row`).toBe(nums);
    byWord.set(word, nums);
  }
  expect(byWord.size, 'more than one distinct word').toBeGreaterThan(1);
  expect(new Set(byWord.values()).size, 'different words must have different rows').toBe(byWord.size);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Scale one, and digging into terms.
 * ------------------------------------------------------------------ */

/* The Start surface is three steps now, not one scroll: the idea, the history,
   then the index. Each helper lands on the one its tests are about. */
async function openHistory(page: Page) {
  await openStart(page);
  await page.getByTestId('step-history').click();
  await expect(page.getByTestId('timeline')).toBeVisible();
}

async function openIndex(page: Page) {
  await openStart(page);
  await page.getByTestId('step-index').click();
  await expect(page.getByTestId('concept-index')).toBeVisible();
}

async function openStart(page: Page) {
  await openLearn(page);
  await page.getByTestId('scale-start').click();
  await expect(page.getByTestId('table')).toBeVisible();
}

test('the front door is the printed table, not the transformer', async ({ page }) => {
  const errors = watchConsole(page);
  await openLearn(page);

  // Start here is the default, because at four numbers wide a reader can read
  // the row rather than look at a picture of it.
  await expect(page.getByTestId('table')).toBeVisible();
  await expect(page.getByTestId('scale-start')).toBeVisible();

  const rows = page.locator('.st-nums tbody tr');
  await expect(rows).toHaveCount(7);
  // Four components, plus the label and the similarity column.
  await expect(rows.first().locator('td')).toHaveCount(6);

  await page.screenshot({ path: `${SHOTS}/learn-7-start.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('cat and dog are marked close, and the table says so itself', async ({ page }) => {
  const errors = watchConsole(page);
  await openStart(page);

  await expect(page.getByTestId('verdict')).toContainText('cat');
  const score = Number((await page.getByTestId('verdict').innerText()).match(/0\.\d\d/)![0]);
  expect(score, 'cat and dog should be close').toBeGreaterThan(0.85);

  // The closeness is shown in the table, not only described underneath it.
  await expect(page.locator('.st-nums tr.near')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('comparing against a different word changes every score', async ({ page }) => {
  const errors = watchConsole(page);
  await openStart(page);

  const before = await page.locator('.st-nums td.sim').allInnerTexts();
  await page.getByTestId('row-wood').click();
  const after = await page.locator('.st-nums td.sim').allInnerTexts();
  expect(after, 'the comparison column must recompute').not.toEqual(before);
  expect(errors).toEqual([]);
});

test('any term in any sentence can be opened', async ({ page }) => {
  const errors = watchConsole(page);
  await openStart(page);

  await page.locator('.gl-chip').first().click();
  await expect(page.getByTestId('dig')).toBeVisible();
  await expect(page.locator('.gl-term')).toBeVisible();

  // No link may be broken. Tests fail on it, and the UI marks it loudly.
  await expect(page.locator('.gl-broken')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/learn-8-dig.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('digging keeps the trail, and you can walk back out', async ({ page }) => {
  const errors = watchConsole(page);
  await openStart(page);

  await page.locator('.gl-chip').first().click();
  const first = await page.locator('.gl-term').innerText();

  // Open a term from inside the explanation. It pushes; it does not replace,
  // because the question that led here has not gone away.
  await page.locator('.gl-body .gl-chip').first().click();
  await expect(page.locator('.gl-crumb')).toHaveCount(2);
  expect(await page.locator('.gl-term').innerText()).not.toBe(first);

  await page.getByTestId('dig-back').click();
  await expect(page.locator('.gl-crumb')).toHaveCount(1);
  expect(await page.locator('.gl-term').innerText()).toBe(first);

  await page.getByTestId('dig-close').click();
  await expect(page.getByTestId('dig')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the timeline reads as a stack of fixes, oldest first', async ({ page }) => {
  const errors = watchConsole(page);
  await openHistory(page);

  const tl = page.getByTestId('timeline');
  await expect(tl).toBeVisible();

  const years = (await tl.locator('.tl-year').allInnerTexts()).map(Number);
  expect(years.length, 'no dated fixes').toBeGreaterThan(20);
  expect(years, 'oldest first').toEqual([...years].sort((a, b) => a - b));
  // More than a century, which is the point: not one recent invention.
  expect(years[years.length - 1]! - years[0]!).toBeGreaterThan(100);

  // Every row leads with the failure, not the concept.
  const first = await tl.locator('.tl-problem').first().innerText();
  expect(first.length).toBeGreaterThan(40);

  await page.screenshot({ path: `${SHOTS}/learn-10-timeline.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('things nobody chose sit outside the timeline, with no year', async ({ page }) => {
  const errors = watchConsole(page);
  await openHistory(page);

  const forced = page.locator('.tl-forced');
  await expect(forced).toContainText('nobody chose them');
  // A year would imply an alternative history, so there must not be one.
  expect(await forced.evaluate((e) => e.textContent ?? '')).not.toMatch(/\b(18|19|20)\d\d\b/);
  expect(errors).toEqual([]);
});

test('filtering by era splits at the transformer', async ({ page }) => {
  const errors = watchConsole(page);
  await openHistory(page);

  const years = async () =>
    (await page.locator('.tl-year').allInnerTexts()).map(Number);

  await page.getByTestId('filter-before').click();
  expect((await years()).every((y) => y < 2017), 'before should be pre-2017').toBe(true);

  await page.getByTestId('filter-after').click();
  expect((await years()).every((y) => y >= 2017), 'after should be 2017 onwards').toBe(true);
  expect(errors).toEqual([]);
});

test('a timeline row opens the concept it belongs to', async ({ page }) => {
  const errors = watchConsole(page);
  await openHistory(page);

  await page.getByTestId('year-attention').click();
  // It leaves the start scale and lands on the authored lesson.
  await expect(page.locator('.dz-title')).toHaveText('Attention');
  await expect(page.locator('.dz-origin [data-testid="origin"]')).toContainText('2014');
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * What is actually in the downloaded file.
 * ------------------------------------------------------------------ */

test('the index reads one lens down the whole list', async ({ page }) => {
  const errors = watchConsole(page);
  await openIndex(page);

  const ix = page.getByTestId('concept-index');
  await ix.scrollIntoViewIfNeeded();
  await expect(ix).toBeVisible();

  /* The rows saying "nothing" are the point. People assume a model file
     contains the machinery that produced it, and none of this is in there. */
  for (const id of ['backprop', 'gradient-descent', 'attention-scores', 'kv-cache']) {
    await expect(ix.getByTestId(`row-${id}`), id).toContainText('Nothing');
  }
  await expect(ix.getByTestId('row-parameter')).toContainText('Every value in every tensor');

  await page.screenshot({ path: `${SHOTS}/learn-11-index.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('switching lens asks a different question of the same concepts', async ({ page }) => {
  const errors = watchConsole(page);
  await openIndex(page);
  const ix = page.getByTestId('concept-index');

  const cell = () => ix.getByTestId('row-backprop').innerText();
  const inFile = await cell();
  expect(inFile).toContain('Nothing');

  await page.getByTestId('lens-why').click();
  const why = await cell();
  expect(why, 'the why lens should say something else').not.toBe(inFile);
  expect(why).toContain('1986');

  await page.getByTestId('lens-what').click();
  expect(await cell()).not.toBe(why);
  expect(errors).toEqual([]);
});

test('every lens reports its own coverage, holes included', async ({ page }) => {
  const errors = watchConsole(page);
  await openIndex(page);
  const ix = page.getByTestId('concept-index');

  /* This used to assert that "why it exists" read under 100%, because it did.
     The hole was filled rather than the check relaxed, so the assertion now
     reads the other way: every lens is complete, and the number is still
     computed from the content rather than written on the button. */
  for (const id of ['what', 'use', 'choose', 'why', 'when', 'file', 'code', 'scale']) {
    const txt = await ix.getByTestId(`lens-${id}`).innerText();
    expect(Number(txt.match(/(\d+)%/)![1]), id).toBe(100);
  }
  expect(errors).toEqual([]);
});

test('unanswered cells are shown, not hidden', async ({ page }) => {
  const errors = watchConsole(page);
  await openIndex(page);
  const ix = page.getByTestId('concept-index');

  /* No concept is unanswered any more, so the gap this exercises is the real
     one that remains: the 21 concepts with nothing in the downloaded file. */
  await page.getByTestId('lens-file').click();
  await page.getByTestId('gaps-only').click();
  const cells = await ix.locator('.ci-v').allInnerTexts();
  expect(cells.length).toBeGreaterThan(5);
  expect(cells.every((c) => c.includes('Nothing'))).toBe(true);

  /* Filtering to the gaps on a lens that has none used to render a bare table
     and no explanation, which reads as a broken screen rather than as good
     news. It has to say so. */
  await page.getByTestId('lens-why').click();
  await expect(ix.getByTestId('no-gaps')).toContainText('No gaps in this lens');
  await expect(ix.locator('.ci-v.empty')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an index row opens its lesson', async ({ page }) => {
  const errors = watchConsole(page);
  await openIndex(page);
  await page.getByTestId('concept-index').getByTestId('row-backprop').locator('button').click();
  await expect(page.locator('.dz-title')).toContainText('Backprop');
  expect(errors).toEqual([]);
});

test('a lens says what it holds before you scroll it', async ({ page }) => {
  const errors = watchConsole(page);
  await openIndex(page);
  const ix = page.getByTestId('concept-index');

  /* "Why it exists" is at 100%, and its first six rows all read "no history"
     because groupings and mathematical objects sort to the top. A reader who
     stops there concludes the lens is empty. The count has to arrive first. */
  await ix.getByTestId('lens-why').click();
  const why = await ix.getByTestId('lens-summary').innerText();
  expect(why).toMatch(/carry a dated fix, from 1[0-9]{3} to 20[0-9]{2}/);
  expect(why).toMatch(/no history to tell/);

  await ix.getByTestId('lens-file').click();
  await expect(ix.getByTestId('lens-summary')).toContainText('leave nothing at all in the file');

  // A lens with nothing to count must not print an empty line where one goes.
  await ix.getByTestId('lens-what').click();
  await expect(ix.getByTestId('lens-summary')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the number holds when the nearer noun flips, even though the word may not', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await openLearn(page);
  await page.getByTestId('scale-model').click();
  await page.getByTestId('decide').click();

  /* A reader reported this as a bug: they flipped the noun next to the gap and
     the verb changed, which the page had promised would not happen. They were
     right about what they saw. The word does change; the number does not, and
     the number is the whole point, so it is now on screen. */
  /* innerText on both sides. toHaveText compares textContent, which is the
     lowercase source, while innerText returns what CSS renders in caps, so
     mixing them silently compares two different strings. */
  const num = () => page.getByTestId('gap-number').innerText();
  const before = await num();
  await page.getByTestId('flip-distractor').click();
  await page.waitForTimeout(120);
  expect(await num(), 'flipping the nearer noun must not move the number').toBe(before);

  // And the subject still moves it, or the demonstration proves nothing.
  await page.getByTestId('flip-subject').click();
  await page.waitForTimeout(120);
  expect(await num(), 'flipping the subject must move it').not.toBe(before);
  expect(errors).toEqual([]);
});

test('the first screen defines its own words', async ({ page }) => {
  const errors = watchConsole(page);
  await openLearn(page);
  await page.getByTestId('scale-model').click();

  // "distractor" is testing jargon. A reader meeting it in the first thirty
  // seconds has been handed a term nobody defined, and said so.
  const text = (await page.locator('.hk').innerText()).toLowerCase();
  expect(text).not.toContain('distractor');
  expect(text).toContain('the nearer noun');
  expect(text).toContain('the subject');
  expect(errors).toEqual([]);
});

test('the front surface is three steps, not one scroll', async ({ page }) => {
  const errors = watchConsole(page);
  await openStart(page);

  /* It used to render the idea, the table, the whole 67-row index AND the
     whole timeline at once: 138 controls on one page, with every concept name
     appearing twice. Thoroughness that reads as a bug. */
  await expect(page.getByTestId('table')).toBeVisible();
  await expect(page.getByTestId('concept-index')).toHaveCount(0);
  await expect(page.getByTestId('timeline')).toHaveCount(0);

  const onIdea = await page.locator('button:visible').count();
  expect(onIdea, 'the first step should be readable, not a control panel').toBeLessThan(40);

  // And each step is reachable, both by the nav and by the way forward.
  await page.getByTestId('to-history').click();
  await expect(page.getByTestId('timeline')).toBeVisible();
  await expect(page.getByTestId('table')).toHaveCount(0);

  await page.getByTestId('to-index').click();
  await expect(page.getByTestId('concept-index')).toBeVisible();
  await expect(page.getByTestId('timeline')).toHaveCount(0);

  await page.getByTestId('step-idea').click();
  await expect(page.getByTestId('table')).toBeVisible();
  expect(errors).toEqual([]);
});

test('no concept is listed twice on the same screen', async ({ page }) => {
  const errors = watchConsole(page);
  await openIndex(page);

  /* The duplication was real: the timeline and the index each listed the
     concepts, so twelve names appeared twice on one page. They are separate
     steps now, and this fails if they are ever merged back. */
  const labels = await page.locator('button:visible').allInnerTexts();
  const seen = new Map<string, number>();
  for (const l of labels.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    seen.set(l, (seen.get(l) ?? 0) + 1);
  }
  const twice = [...seen].filter(([, n]) => n > 1).map(([l]) => l);
  expect(twice).toEqual([]);
  expect(errors).toEqual([]);
});
