/**
 * Acceptance gates, CLAUDE.md §10, verified per §11.
 *
 * Runs against the BUILT single file over file://, so it also proves the
 * shipping artifact works with no server and no network.
 */

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILT = pathToFileURL(path.resolve(here, '../../dist/index.html')).href;
const SHOTS = path.resolve(here, '../../test-results/shots');

/**
 * The concept map, which is no longer the landing surface.
 *
 * The app opens on seven words and four numbers, because that is where a
 * reader should start. Everything in this file is about the map, so it asks
 * for it rather than assuming it.
 */
async function openMap(page: Page) {
  /* The map is now the landing surface, so there is nothing to click. The
     button this used to press only exists on the learn surface, and pressing
     it from here would navigate AWAY from the map. */
  await page.goto(BUILT);
}

/** Screenshots are evidence, take them after motion settles. */
async function shot(page: Page, name: string) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

/** Fails the run on any console error, §10's "no console errors". */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/**
 * The single obvious way in.
 *
 * On a wide screen both panes are visible and the pipeline strip is the entry
 * point; below the split breakpoint the map's own CTA is. Tests run at 1280
 * wide, which is split.
 */
/** Below the split breakpoint the notebook has to be selected first. */
async function ensureNotebook(page: Page) {
  const toggle = page.getByRole('button', { name: /^Notebook/ });
  if ((await toggle.count()) > 0) await toggle.click();
}

/** A pipeline stage by exact name. "Embedding" also matches "Unembedding". */
function stage(page: Page, name: string) {
  return page.locator('.ps-track').getByRole('button', { name, exact: true });
}

async function startWalk(page: Page) {
  await openMap(page);
  await ensureNotebook(page);
  await stage(page, 'Tokenization').click();
  await expect(page.locator('.dz-title')).toHaveText('Tokenization');
  await page.waitForTimeout(320);
}

/** Advance N steps along the pipeline via Next. */
async function walkForward(page: Page, steps: number) {
  for (let i = 0; i < steps; i++) {
    await page.locator('.nb-step.right').click();
    await page.waitForTimeout(120);
  }
}

async function openEmbedding(page: Page) {
  await startWalk(page);
  await walkForward(page, 2);
  await expect(page.locator('.dz-title')).toHaveText('Embedding');
}

test('map and notebook are visible together, not toggled', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  // The whole point: "where am I" and "what is this" are not mutually
  // exclusive. Both panes render at once above the breakpoint.
  await expect(page.locator('.app.split')).toBeVisible();
  await expect(page.locator('.app-note .dz-title')).toBeVisible();

  /* At the root the graphic pane IS the universe, by request: a front door
     has to make someone want to walk in, and a diagram of three boxes does
     not. The earlier complaint that circles answer a taxonomy question nobody
     asked still stands EVERYWHERE ELSE, which is why this holds only at the
     root and the structure is one click away here. */
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();

  // No view toggle, because there is nothing to toggle between.
  await expect(page.getByRole('button', { name: /^Map/ })).toHaveCount(0);

  // design-spec §5: three continents, reachable from the map pane.
  const kids = page.locator('.map-kid');
  await expect(kids).toHaveCount(3);
  await expect(kids.nth(0)).toContainText('The Model');
  await expect(kids.nth(2)).toContainText('The Operations');

  await page.waitForTimeout(700);
  await shot(page, '01-split');
  expect(errors).toEqual([]);
});

test('the flow is always on screen and the map follows it', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  // Named stages with arrows between them, not a rail of anonymous dots.
  const strip = page.locator('.ps-track');
  await expect(strip).toContainText('Tokenization');
  await expect(strip).toContainText('Attention');
  await expect(strip).toContainText('The Loop');
  await expect(page.locator('.ps-item')).toHaveCount(12);

  // The one input, shown beside the flow it travels through.
  await expect(page.locator('.ps-in')).toHaveText('C B A B B C');

  await stage(page, 'Embedding').click();
  await expect(page.locator('.ps-item.here')).toContainText('Embedding');
  // Everything before it reads as passed, so the direction is visible.
  await expect(page.locator('.ps-item.done')).toHaveCount(2);

  // And the map moved with it, one shared focus, no second navigation.
  await expect(page.locator('.dz-title')).toHaveText('Embedding');
  await page.waitForTimeout(600);
  await shot(page, '02-flow-follows');

  expect(errors).toEqual([]);
});

test('the stage graphic leads, and drives the notebook both ways', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  await stage(page, 'Embedding').click();

  // On a pipeline stage the graphic replaces the map, the map cannot show
  // what is happening to the data, only where the concept sits.
  await expect(page.locator('.sv')).toBeVisible();
  // The scene is also a canvas now, so this has to name the map's own.
  await expect(page.locator('.app-map .map-canvas')).toHaveCount(0);
  await expect(page.locator('.app-map .ms-canvas')).toBeVisible();
  await expect(page.locator('.sv-title')).toHaveText('Embedding');
  await expect(page.locator('.sv-step')).toContainText('Stage 3 of 12');

  // The tensor is drawn as a tensor: one column per token.
  await expect(page.locator('.sv-col')).toHaveCount(6);

  // Stepping in the graphic moves the notebook.
  await page.locator('.sv-btn').nth(1).click();
  await expect(page.locator('.dz-title')).toHaveText('Attention');
  await expect(page.locator('.sv-title')).toHaveText('Attention');

  // ...and stepping in the notebook moves the graphic.
  await page.locator('.nb-step').first().click();
  await expect(page.locator('.sv-title')).toHaveText('Embedding');

  // Selecting a token in the graphic selects it in the grid below.
  await page.locator('.sv-tok').nth(2).click();
  await expect(page.locator('.sv-col.on .sv-collabel')).toContainText('A');

  // Autoplay is opt-in and paused by default, learner-paced beats system-paced.
  await expect(page.locator('.sv-play')).toContainText('Play through');
  await shot(page, '03-stage');

  expect(errors).toEqual([]);
});

test('every one of the twelve stages draws its own real visual', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  // Each stage gets a visual built for what that stage actually does, 
  // no stage falls back to a generic placeholder.
  const expected: Array<[string, string]> = [
    ['Tokenization', '.sv-box.k-piece'],
    ['Token ID', '.sv-box.k-id'],
    ['Embedding', '.sv-tensor .sv-col'],
    ['Attention', '.sv-grid .sv-gcell'],
    ['Feed-Forward (MLP)', '.sv-strip.wide'],
    ['Residual stream', '.sv-strip'],
    ['Normalization (LayerNorm)', '.sv-strip'],
    ['Unembedding → Logits', '.sv-barfill.k-logit'],
    ['Logits', '.sv-barfill.k-logit'],
    ['Softmax', '.sv-barfill.k-prob'],
    ['Sampling', '.sv-bar.pick'],
    ['The Loop', '.sv-seq'],
  ];

  for (const [title, selector] of expected) {
    await stage(page, title).click();
    await expect(page.locator('.sv-title'), title).toHaveText(title);
    await expect(page.locator(selector).first(), `${title} → ${selector}`).toBeVisible();
  }

  // The last stage shows the predicted letter appended to the sequence.
  await expect(page.locator('.sv-seq em')).toHaveText(/^[ABC]$/);
  await shot(page, '04-stage-loop');

  expect(errors).toEqual([]);
});

test('the attention matrix shows the mask as absence', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  await stage(page, 'Attention').click();

  // 6 tokens: 36 cells, of which 15 are above the diagonal and masked.
  await expect(page.locator('.sv-gcell')).toHaveCount(36);
  await expect(page.locator('.sv-gcell.masked')).toHaveCount(15);
  await shot(page, '05-stage-attention');

  expect(errors).toEqual([]);
});

test('the Run box only appears where the input computes something', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);

  // Embedding computes from it, so the control belongs here.
  await expect(page.locator('#run-input')).toBeVisible();

  // Step off the pipeline first, on a pipeline node the stage view replaces
  // the map, so there are no map chips to navigate with.
  await page.locator('.nb-crumb', { hasText: 'LLM' }).click();
  // The root is the universe now, and its chips are the way down from here.
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();

  // Deploy prep computes nothing from "C B A B B C". Showing the control
  // there implies a relationship that does not exist.
  for (const id of ['build', 'deploy-prep']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }
  await expect(page.locator('.dz-title')).toHaveText('Deploy prep');
  await expect(page.locator('#run-input')).toHaveCount(0);

  // Same for the Operations continent.
  await page.locator('.nb-crumb', { hasText: 'LLM' }).click();
  for (const id of ['operations', 'training-path', 'feast']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }
  await expect(page.locator('.dz-title')).toHaveText('Feast');
  await expect(page.locator('#run-input')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('off the pipeline, the pane shows structure instead of live data', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  await page.locator('.map-kid[data-node-id="operations"]').click();

  // Nothing is flowing through "The Operations", so there is no tensor to
  // draw, but there is still a real thing to show, and it is not a circle.
  await expect(page.locator('.sv')).toHaveCount(0);
  await expect(page.locator('.app-map .sf-chain')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the map is the fallback for the handful of nodes with no structure', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  // A leaf like "Vector" has neither a pipeline stage nor a flow of its own.
  // Rather than draw an empty frame, the containment view comes back, the
  // map is still the honest answer when there is genuinely nothing to flow.
  for (const id of ['model', 'foundations', 'linalg', 'vector']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }
  await expect(page.locator('.dz-title')).toHaveText('Vector');
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('narrow screens fall back to the toggle', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 900, height: 800 });
  await openMap(page);

  // Two columns will not fit, so it stacks and the toggle returns.
  await expect(page.locator('.app.split')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Map/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Walk the forward pass/ })).toBeVisible();

  expect(errors).toEqual([]);
});

test('the forward pass is walkable end to end on one input', async ({ page }) => {
  const errors = watchConsole(page);
  await startWalk(page);

  // The whole point: one input survives the journey.
  await expect(page.locator('#run-input')).toHaveValue('C B A B B C');
  await shot(page, '02-walk-tokenization');

  for (const expected of ['Token ID', 'Embedding', 'Attention']) {
    await page.locator('.nb-step.right').click();
    await expect(page.locator('.dz-title')).toHaveText(expected);
    // The input is unchanged at every step, that continuity IS the lesson.
    await expect(page.locator('#run-input')).toHaveValue('C B A B B C');
  }

  // Prev/Next crossed a containment boundary to get here: Embedding lives in
  // The Transformer, Attention two levels deeper inside a Layer.
  await expect(page.locator('.nb-crumb').last()).toHaveText('Attention');
  await expect(page.locator('.pr-text')).toContainText('4 of 12 along the forward pass');
  await shot(page, '03-walk-attention');

  expect(errors).toEqual([]);
});

test('Tokenization contrasts character codes with vocabulary slots', async ({ page }) => {
  const errors = watchConsole(page);
  await startWalk(page);
  await page.getByRole('button', { name: /Show me/ }).click();

  const rows = page.locator('.ng-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('character code');
  await expect(rows.nth(1)).toContainText('vocabulary slot');

  // C is 67 in Unicode and slot 2 in this model's vocabulary, the whole lesson.
  await expect(rows.nth(0).locator('.ng-cell').first()).toContainText('67');
  await expect(rows.nth(1).locator('.ng-cell').first()).toContainText('2');

  expect(errors).toEqual([]);
});

test('Attention shows the causal mask and rows that sum to 1', async ({ page }) => {
  const errors = watchConsole(page);
  await startWalk(page);
  await walkForward(page, 3);
  await expect(page.locator('.dz-title')).toHaveText('Attention');

  await page.getByRole('button', { name: /Show me/ }).click();
  await expect(page.locator('.ng-table')).toBeVisible();

  // First token: nowhere to look but itself.
  await expect(page.locator('.ng-row.role-input .ng-cell').first()).toContainText('1.00');

  // Pick the second query token. it can see two tokens, and the rest are masked.
  await page.locator('.ng-groups .ng-chip').nth(1).click();
  const scoreCells = page.locator('.ng-row.role-neutral .ng-cell');
  await expect(scoreCells.nth(2)).toContainText('-inf'); // may not look ahead

  // The probe explains the mask rather than showing a bare number.
  await scoreCells.nth(2).hover();
  await expect(page.locator('.ng-probe')).toContainText('may not look at');

  await page.getByRole('button', { name: /Common snags/ }).click();
  await expect(page.locator('.snag-q')).toHaveCount(8);
  await shot(page, '04-attention-mask');

  expect(errors).toEqual([]);
});

test('the Agent layer shows what an agent is made of, not just a sentence', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  // In split mode the map pane is navigation only, selecting a node opens it
  // in the notebook beside it, so there is no "open the lesson" step.
  for (const id of ['operations', 'inference-path', 'agent-layer']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }
  await expect(page.locator('.dz-title')).toHaveText('Agent layer');
  await page.waitForTimeout(320);

  await page.getByRole('button', { name: /Show me/ }).click();

  // The components, named. this is the thing a one-liner cannot carry.
  const parts = page.locator('.fd-part-l');
  for (const label of ['Model', 'Tools', 'MCP servers', 'Memory']) {
    await expect(parts.filter({ hasText: new RegExp(`^${label}$`) })).toHaveCount(1);
  }
  // ...and the loop that makes it an agent rather than a chatbot.
  await expect(page.locator('.fd-loop')).toContainText('tool call');
  await expect(page.locator('.fd-step')).toHaveCount(5);

  await page.getByRole('button', { name: /Common snags/ }).click();
  await expect(page.locator('.snag-q').first()).toContainText('what actually IS an agent');
  await shot(page, '14-agent-layer');

  // Anticipated, not harvested, and the UI says which.
  await expect(page.locator('.lx-head').filter({ hasText: 'Common snags' })).toContainText(
    'questions this usually raises',
  );

  expect(errors).toEqual([]);
});

test('AIBrix explains routing rather than restating its own name', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  for (const id of ['operations', 'inference-path', 'aibrix']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }
  await expect(page.locator('.dz-title')).toHaveText('AIBrix');
  await page.waitForTimeout(320);

  await page.getByRole('button', { name: /Show me/ }).click();
  await expect(page.locator('.fd-part-l').filter({ hasText: 'Prefix-aware' })).toHaveCount(1);
  await expect(page.locator('.fd-part-l').filter({ hasText: 'Adapter-aware' })).toHaveCount(1);

  await page.getByRole('button', { name: /At scale/ }).click();
  await expect(page.locator('.dz-scale')).toBeVisible();
  await page.getByRole('button', { name: /Under the hood/ }).click();
  await expect(page.getByText(/Control plane and data plane/)).toBeVisible();
  await shot(page, '15-aibrix');

  expect(errors).toEqual([]);
});

test('attention arcs are learner-paced, not autoplaying', async ({ page }) => {
  const errors = watchConsole(page);
  await startWalk(page);
  await walkForward(page, 3);
  await expect(page.locator('.dz-title')).toHaveText('Attention');
  await page.getByRole('button', { name: /Show me/ }).click();

  const arcs = page.locator('.aa-arc');
  await expect(page.locator('.aa-svg')).toBeVisible();

  // Segmenting principle: the learner controls the pace. Nothing moves on its
  // own, so the same token stays selected until it is stepped.
  await expect(page.locator('.aa-chip.on')).toHaveText(/C0/);
  await expect(arcs).toHaveCount(1); // first token sees only itself
  await page.waitForTimeout(900);
  await expect(page.locator('.aa-chip.on')).toHaveText(/C0/); // still there

  // Stepping forward widens what it can see, one arc per visible token.
  await page.locator('.aa-step').nth(1).click();
  await expect(arcs).toHaveCount(2);
  await page.locator('.aa-step').nth(1).click();
  await expect(arcs).toHaveCount(3);

  // Dual coding: the same fact in words, and it is the accessible channel.
  await expect(page.locator('.aa-read')).toContainText('can see 3 of 6 tokens');
  await expect(page.locator('.aa-read')).toContainText('add up to 100');
  await shot(page, '17-attention-arcs');

  expect(errors).toEqual([]);
});

test('practised mode removes scaffolding rather than adding content', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);

  // Learning: the analogy is shown and the grid slices to six.
  await expect(page.locator('.dz-analogy')).toBeVisible();
  await page.getByRole('button', { name: /Show me/ }).click();
  await expect(page.locator('.ng-count')).toHaveText('showing 6 of 48 dimensions');

  await page.getByRole('button', { name: 'Practised' }).click();

  // Expertise reversal: redundant guidance goes, the material stays.
  await expect(page.locator('.dz-analogy')).toHaveCount(0);
  await expect(page.locator('.ng-count')).toHaveText('showing 12 of 48 dimensions');
  await expect(page.locator('.dz-oneliner')).toBeVisible();
  await expect(page.locator('.ng-table')).toBeVisible();

  // And it explains itself rather than silently hiding things.
  await page.getByRole('button', { name: /Why this setting exists/ }).click();
  await expect(page.locator('.lv-note')).toContainText('expertise reversal effect');
  await shot(page, '18-practised-mode');

  await page.getByRole('button', { name: 'Learning' }).click();
  await expect(page.locator('.dz-analogy')).toBeVisible();

  expect(errors).toEqual([]);
});

test('checkpoints are retrieval practice with feedback, never a gate', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);

  // Opt-in, and it says plainly that it can be skipped.
  const invite = page.locator('.cp-invite');
  await expect(invite).toContainText('not a gate');
  await invite.click();

  // The question requires recall, and the distractor is the real off-by-one.
  await expect(page.locator('.cp-q')).toContainText('position 3');
  const opts = page.locator('.cp-opt');
  await expect(opts).toHaveCount(3);

  // Answer wrong on purpose: feedback explains, and routes to the written card.
  await opts.filter({ hasText: 'it is the third letter' }).click();
  await expect(page.locator('.cp-fb')).toContainText('position = human count');
  await expect(page.locator('.cp-fb')).not.toHaveClass(/good/);

  const goto = page.getByRole('button', { name: /Read the card on this/ });
  await expect(goto).toContainText("Isn't position 3 an A?");
  await goto.click();
  // It opened the snags layer rather than just marking the answer wrong.
  await expect(page.locator('.snag-q')).toHaveCount(8);

  // Retry, answer correctly.
  await page.getByRole('button', { name: 'Try again' }).click();
  await opts.filter({ hasText: 'position 3 is the fourth letter' }).click();
  await expect(page.locator('.cp-fb.good')).toBeVisible();
  await shot(page, '19-checkpoint');

  // Nothing was ever blocked. Next worked from the moment the page loaded.
  await page.locator('.nb-step.right').click();
  await expect(page.locator('.dz-title')).toHaveText('Attention');

  expect(errors).toEqual([]);
});

test('Embedding renders L0 by default and nothing else', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);

  await expect(page.locator('.dz-oneliner')).toHaveText(/Turn each token into numbers/);
  await expect(page.locator('.dz-analogy')).toHaveText(/name tag \(what you are\)/);

  const heads = page.locator('.lx-head');
  await expect(heads).toHaveCount(4);
  for (const label of ['Show me', 'Common snags', 'At scale', 'Under the hood']) {
    await expect(heads.filter({ hasText: label })).toHaveAttribute('aria-expanded', 'false');
  }
  await expect(page.locator('.lx-panel')).toHaveCount(0);

  await shot(page, '05-notebook-L0');
  expect(errors).toEqual([]);
});

test('all four layers open, and all eight snags are present and expandable', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);

  await page.getByRole('button', { name: /Show me/ }).click();
  await expect(page.locator('.ng-table')).toBeVisible();
  await shot(page, '06-L1-open');

  await page.getByRole('button', { name: /Common snags/ }).click();
  const snags = page.locator('.snag-q');
  await expect(snags).toHaveCount(8);

  for (let i = 0; i < 8; i++) {
    await snags.nth(i).click();
    await expect(page.locator('.snag-a')).toHaveCount(1);
  }

  await page.getByRole('button', { name: /Isn't position 3 an A/ }).click();
  await expect(page.getByText(/computers count from 0/)).toBeVisible();
  await shot(page, '07-snag-open');

  await page.getByRole('button', { name: /At scale/ }).click();
  await expect(page.locator('.dz-scale')).toBeVisible();

  await page.getByRole('button', { name: /Under the hood/ }).click();
  await expect(page.locator('.md-pre')).toBeVisible();
  await shot(page, '08-L4-underhood');

  expect(errors).toEqual([]);
});

test('the Run control recomputes every number', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);
  await page.getByRole('button', { name: /Show me/ }).click();

  const before = await page.locator('.ng-cell').first().textContent();

  await page.locator('#run-input').fill('A A B C');
  await expect(page.locator('.ng-groups .ng-chip').first()).toHaveText('A @ seat 0');

  const after = await page.locator('.ng-cell').first().textContent();
  expect(after).not.toBe(before);
  await shot(page, '09-after-run');

  await page.locator('#run-input').fill('A B Z');
  await expect(page.getByText(/ignored "Z"/)).toBeVisible();

  expect(errors).toEqual([]);
});

test('a changed input flows through to attention too', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);
  await page.locator('#run-input').fill('A B C');

  await page.locator('.nb-step.right').click();
  await expect(page.locator('.dz-title')).toHaveText('Attention');

  // The Run box carried across the step, one model, threaded through.
  await expect(page.locator('#run-input')).toHaveValue('A B C');
  await page.getByRole('button', { name: /Show me/ }).click();

  // Three tokens in, so three query rows to choose from.
  await expect(page.locator('.ng-groups .ng-chip')).toHaveCount(3);
  await expect(page.locator('.ng-groups .ng-chip').first()).toHaveText('A@0 is looking');

  expect(errors).toEqual([]);
});

test('NumberGrid slices big vectors and probes show provenance', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);
  await page.getByRole('button', { name: /Show me/ }).click();

  await expect(page.locator('.ng-count')).toHaveText('showing 6 of 48 dimensions');
  await expect(page.locator('.ng-row')).toHaveCount(3);
  await expect(page.locator('.ng-cell')).toHaveCount(18);

  await page.locator('.ng-row.role-input .ng-cell').first().hover();
  await expect(page.locator('.ng-probe')).toContainText('+');
  await expect(page.locator('.ng-probe')).toContainText('seat 0');

  await page.getByRole('button', { name: 'show all 48' }).click();
  await expect(page.locator('.ng-cell')).toHaveCount(144);
  await shot(page, '10-showall');

  const noSideScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(noSideScroll).toBe(true);
  expect(errors).toEqual([]);
});

test('no dead ends: Needs, Unlocks and the progress rail are always there', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);

  await expect(page.locator('.dz-footk', { hasText: 'Needs' })).toBeVisible();
  await expect(page.locator('.dz-footk', { hasText: 'Unlocks' })).toBeVisible();
  await expect(page.locator('.pr-dot')).toHaveCount(12);

  // Unlocks navigates forward along the pipeline.
  await page.locator('.dz-chip.unlocks').first().click();
  await expect(page.locator('.dz-title')).toHaveText('Attention');

  // Two more steps reach unbuilt ground, and it says so plainly rather than
  // pretending to be a lesson.
  // ...and the step after that is built too, the pipeline no longer runs out
  // of authored ground partway along.
  await page.locator('.nb-step.right').click();
  await expect(page.locator('.dz-title')).toHaveText('Feed-Forward (MLP)');
  await expect(page.locator('.lx-head').filter({ hasText: 'Show me' })).toBeVisible();
  await page.getByRole('button', { name: /Show me/ }).click();
  await expect(page.locator('.fd-chain')).toBeVisible();

  expect(errors).toEqual([]);
});

test('every concept has real content behind it', async ({ page }) => {
  const errors = watchConsole(page);
  // The honesty counter lives on the full map, which stacked mode shows.
  await page.setViewportSize({ width: 900, height: 800 });
  await openMap(page);

  // It used to read "1 of 64".
  /* Read the number rather than hardcoding it. Pinning 64 meant that adding
     three lessons failed a test about honesty rather than about counting. */
  const headline = await page.locator('.map-count').innerText();
  const concepts = Number(headline.match(/(\d+)\s+concepts/)![1]);
  expect(concepts, `headline said "${headline}"`).toBeGreaterThanOrEqual(64);
  await expect(page.locator('.map-count')).toContainText('diagrams');

  // Spot-check a leaf that was previously a bare one-liner.
  for (const id of ['model', 'foundations', 'linalg', 'dot-product']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }
  await page.getByRole('button', { name: 'Open the lesson →' }).click();
  await expect(page.locator('.dz-title')).toHaveText('Dot Product');
  await page.getByRole('button', { name: /Show me/ }).click();

  // Real numbers, pulled from the same attention computation the spine uses.
  await expect(page.locator('.ng-row')).toHaveCount(3);
  await expect(page.locator('.ng-row').nth(2)).toContainText('product');
  await shot(page, '16-dot-product');

  expect(errors).toEqual([]);
});

test('the AI layer is optional and off by default', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);

  // §9: no key required for full function, the box explains itself instead.
  await expect(page.locator('.ask-off-t')).toContainText('Still confused about Embedding');
  await expect(page.getByRole('button', { name: 'Add an API key' })).toBeVisible();

  await page.getByRole('button', { name: 'Add an API key' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Every provider offered. The list is rendered from the registry, so
  // adding one is a data change and this assertion is what keeps the UI
  // honest about it.
  const options = dialog.locator('#ais-provider option');
  await expect(options).toHaveCount(4);
  await expect(options.nth(0)).toHaveText(/Claude \(Anthropic\)/);
  await expect(options.nth(1)).toHaveText(/OpenAI/);
  await expect(options.nth(2)).toHaveText(/OpenRouter/);
  await expect(options.nth(3)).toHaveText(/Gemini \(Google\)/);

  // Gemini ships no hardcoded model name, one was, and it 404'd once Google
  // withdrew it from new accounts. Instead the panel offers to ask the key
  // what it can actually reach, which cannot go stale.
  await dialog.locator('#ais-provider').selectOption('google');
  const find = dialog.getByRole('button', { name: 'Find models' });
  await expect(find).toBeVisible();
  // Disabled until there is a key to ask with, pressing it earlier could only
  // ever produce an auth error.
  await expect(find).toBeDisabled();
  await dialog.locator('#ais-key').fill('AIzaPLACEHOLDER');
  await expect(find).toBeEnabled();
  await dialog.locator('#ais-key').fill('');

  // OpenRouter defaults to the free router, so a learner never has to go and
  // find a model slug before they can ask anything.
  await dialog.locator('#ais-provider').selectOption('openrouter');
  await expect(dialog.locator('#ais-model')).toHaveValue('openrouter/free');
  await expect(dialog.locator('.ais-hint').last()).toContainText('costs nothing');

  // Reasoning is offered where the provider supports it, and off by default, 
  // reasoning tokens bill as output tokens.
  const reasoning = dialog.locator('.ais-check input');
  await expect(reasoning).toHaveCount(1);
  await expect(reasoning).not.toBeChecked();

  // ...and not offered where it does not apply.
  await dialog.locator('#ais-provider').selectOption('anthropic');
  await expect(dialog.locator('.ais-check input')).toHaveCount(0);
  await expect(dialog.locator('#ais-model')).toHaveValue('claude-opus-5');

  // The key field is masked, and the page is honest about browser exposure.
  await expect(dialog.locator('#ais-key')).toHaveAttribute('type', 'password');
  await expect(dialog.locator('.ais-warn')).toContainText('visible in the network tab');
  await shot(page, '11-ai-settings');

  // Entering a key flips the box to the question form and lights the header.
  await dialog.locator('#ais-key').fill('sk-ant-test-not-a-real-key');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.app-ai')).toHaveText(/LLM on/);
  await expect(page.locator('.ask-input')).toBeVisible();
  await expect(page.locator('.ask-note')).toContainText('not to compute or invent numbers');

  // ...and nothing was persisted. A reload must not resurrect the key.
  const stored = await page.evaluate(() => JSON.stringify({...localStorage }));
  expect(stored).not.toContain('sk-ant');
  expect(stored).toBe('{}');

  expect(errors).toEqual([]);
});

test('keyboard operable end to end', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);

  const showMe = page.getByRole('button', { name: /Show me/ });
  await showMe.focus();
  await page.keyboard.press('Enter');
  await expect(showMe).toHaveAttribute('aria-expanded', 'true');

  await page.locator('.ng-cell').first().focus();
  await expect(page.locator('.ng-probe')).toContainText('token table row');

  await page.keyboard.press('Escape');
  await expect(showMe).toHaveAttribute('aria-expanded', 'false');

  expect(errors).toEqual([]);
});

test('the hidden view is fully inert when stacked', async ({ page }) => {
  const errors = watchConsole(page);
  // Only meaningful below the split breakpoint, above it nothing is hidden.
  await page.setViewportSize({ width: 900, height: 800 });
  await openEmbedding(page);

  const mapInert = await page.evaluate(() => {
    const mapView = document.querySelectorAll('.app-view')[0] as HTMLElement | undefined;
    return mapView?.hasAttribute('inert') ?? false;
  });
  expect(mapInert).toBe(true);

  expect(errors).toEqual([]);
});

test('light theme renders', async ({ page }) => {
  const errors = watchConsole(page);
  await openEmbedding(page);
  await page.getByRole('button', { name: /Switch to light theme/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: /Show me/ }).click();
  await page.getByRole('button', { name: /Common snags/ }).click();
  await shot(page, '12-light');
  expect(errors).toEqual([]);
});

test('narrow viewport does not overflow', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 390, height: 780 });
  await openEmbedding(page);
  await page.getByRole('button', { name: /Show me/ }).click();

  const noSideScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(noSideScroll).toBe(true);
  await shot(page, '13-narrow');
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * The graphic pane shows the thing, not a diagram of where the thing sits.
 *
 * The map answers "where does this concept live in a taxonomy". That is a
 * navigation question, and a reader described the result exactly: "it seems
 * made up circles only". These lock in that the largest pane on screen shows
 * real structure, and that moving the map out of the way did not take the
 * drill-down with it.
 * ------------------------------------------------------------------ */

test('picking a concept shows its structure as boxes, not orbiting circles', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  /* The root is the one deliberate exception: it greets with the universe.
     Its structure is still there, one click away, and that click is what this
     asserts. Everywhere below, boxes lead and circles are opt-in. */
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();
  await page.getByRole('button', { name: /show the structure/ }).click();
  await expect(page.locator('.app-map .sf-box').first()).toBeVisible();
  await expect(page.locator('.app-map .map-canvas')).toHaveCount(0);

  for (const id of ['operations', 'training-path', 'kubeflow']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }
  await expect(page.locator('.app-flowhead h2')).toHaveText('Kubeflow');

  // The chain the reader asked for: data first, GPUs late, adapters at the end.
  const boxes = page.locator('.app-map .sf-box');
  expect(await boxes.count()).toBeGreaterThanOrEqual(7);
  await expect(boxes.filter({ hasText: 'Raw data' })).toHaveCount(1);
  await expect(boxes.filter({ hasText: 'Data preparation' })).toHaveCount(1);
  await expect(boxes.filter({ hasText: 'GPU container image' })).toHaveCount(1);
  await expect(boxes.filter({ hasText: 'SLURM' })).toHaveCount(1);

  await shot(page, '14-structure-kubeflow');
  expect(errors).toEqual([]);
});

test('the structure steps one box at a time, and detail waits for you', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  for (const id of ['operations', 'training-path', 'kubeflow']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }

  // Segmenting: the parts of a box appear only when you arrive at it, so eight
  // boxes' worth of nested detail is never on screen at once.
  await expect(page.locator('.sf-item.here .sf-part').first()).toBeVisible();
  await expect(page.locator('.sf-item.ahead .sf-part').first()).toBeHidden();

  await expect(page.locator('.sf-pos')).toContainText('1 of');
  await page.getByRole('button', { name: 'Next box' }).click();
  await expect(page.locator('.sf-pos')).toContainText('2 of');
  await expect(page.locator('.sf-item.here .sf-box')).toContainText('Data preparation');

  // SLURM sits inside the scheduler box, so it only shows once you step there.
  await page.locator('.sf-box', { hasText: 'Scheduler' }).click();
  await expect(page.locator('.sf-item.here .sf-part', { hasText: 'SLURM' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('the map is still one click away, and drilling down still works without it', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await openMap(page);

  // Container nodes carry a flow too, so the chips had to stop being a map
  // feature. otherwise fourteen nodes, the root included, lose their way down.
  await expect(page.locator('.map-kid[data-node-id="operations"]')).toBeVisible();

  // The root opens on the universe, so the trip is the other way round now.
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();
  await page.getByRole('button', { name: /show the structure/ }).click();
  await expect(page.locator('.app-map .sf-box').first()).toBeVisible();
  await page.getByRole('button', { name: /show on map/ }).click();
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();

  expect(errors).toEqual([]);
});

test('the step-by-step narrator is offered on a stage, and is off without a key', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await openEmbedding(page);

  // The offer names what it would do with the live numbers; the lesson is
  // complete without it (CLAUDE.md §2, AI never computes).
  await expect(page.locator('.sn-off')).toBeVisible();
  await expect(page.locator('.sn-off-d')).toContainText('Q, K and V');
  await expect(page.getByRole('button', { name: 'Narrate this step' })).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('the paths a reader asked to see are shown as steps, not buried in a footnote', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await openMap(page);

  // Prefill and decode used to be sub-items inside a single "Engine" box.
  // They are the whole reason the two halves of serving behave differently,
  // so they are steps you walk through.
  for (const id of ['operations', 'inference-path']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }
  // Match on the box's own label: the decode box's body text mentions
  // prefill, and a whole-box text match would count that too.
  const inf = page.locator('.app-map .sf-box > .sf-label');
  await expect(inf.filter({ hasText: 'Prefill' })).toHaveCount(1);
  await expect(inf.filter({ hasText: 'KV cache' })).toHaveCount(1);
  await expect(inf.filter({ hasText: 'Decode' })).toHaveCount(1);
  await shot(page, '20-inference-path');

  // The training path has to show where an adapter comes from, not just a
  // full checkpoint.
  await page.locator('.nb-crumb', { hasText: 'The Operations' }).click();
  await page.locator('.map-kid[data-node-id="training-path"]').click();
  await page.locator('.sf-box', { hasText: 'What the run is allowed to change' }).click();
  await expect(page.locator('.sf-item.here .sf-part', { hasText: 'LoRA' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('Q, K and V each show their own mechanism instead of a circle', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  for (const id of ['model', 'transformer', 'layer', 'attention']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }

  // Attention is a pipeline stage, so its children are reached from the
  // notebook's Inside list rather than from map chips.
  await page.locator('.nb-inside-item[data-node-id="query"]').click();
  await expect(page.locator('.app-flowhead h2')).toHaveText('Query (Q)');

  const q = page.locator('.app-map .sf-box');
  await expect(q.filter({ hasText: 'Multiply by Wq' })).toHaveCount(1);
  await expect(q.filter({ hasText: 'query vector' })).toHaveCount(1);
  // The reason Q is not cached, which is the fact that distinguishes it from K and V.
  await expect(q.filter({ hasText: 'Used once, then dropped' })).toHaveCount(1);
  await shot(page, '21-query');

  await page.locator('.nb-crumb', { hasText: 'Attention' }).click();
  await page.locator('.nb-inside-item[data-node-id="key"]').click();
  await expect(page.locator('.app-map .sf-box').filter({ hasText: 'Kept, not discarded' })).toHaveCount(1);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * One scene, not a slideshow.
 *
 * "Not like picture by picture" was the ask. The property that delivers it is
 * that the SAME scene is mounted at every stage and only the camera moves, 
 * so the thing you were just looking at is still there, and the connection
 * between steps is visible rather than remembered.
 * ------------------------------------------------------------------ */

test('the model scene persists across every stage, only the camera moves', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  await stage(page, 'Embedding').click();
  const scene = page.locator('.app-map .ms-canvas');
  await expect(scene).toBeVisible();

  // The same element survives the walk. If the scene were rebuilt per stage
  // this handle would go stale, which is exactly the slideshow behaviour.
  const handle = await scene.elementHandle();
  for (const name of ['Attention', 'Feed-Forward (MLP)', 'Softmax', 'The Loop']) {
    await stage(page, name).click();
    await expect(page.locator('.sv-title')).toHaveText(name);
    expect(await handle!.isVisible(), `scene survived ${name}`).toBe(true);
  }

  await page.waitForTimeout(1200);
  await shot(page, '22-scene');
  expect(errors).toEqual([]);
});

test('the scene is keyboard-reachable even though it is a canvas', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  await stage(page, 'Embedding').click();

  // A canvas cannot be tabbed into, so the same twelve destinations exist as
  // real buttons. Without them the scene would be pointer-only.
  // They are visually hidden until focused, which is the point, so this
  // exercises the real route in (focus, then activate) rather than a click a
  // keyboard user would never make.
  const jump = page.getByRole('button', { name: 'Fly to Attention' });
  await expect(jump).toHaveCount(1);
  await jump.focus();
  await expect(jump).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sv-title')).toHaveText('Attention');

  expect(errors).toEqual([]);
});

test('the universe survives as an index, and every entry opens a lesson', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  /* At the root the index IS the graphic, so its door reads "Close index"
     there. The door this test is about is the one on every OTHER node, where
     circles are not the default and the index has to be asked for. */
  await page.locator('.map-kid[data-node-id="model"]').click();
  const open = page.getByRole('button', { name: /Universe index/ });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();

  // And it wins even on a pipeline stage, where a scene would otherwise show.
  await page.getByRole('button', { name: /Close index/ }).click();
  await stage(page, 'Attention').click();
  await expect(page.locator('.app-map .ms-canvas')).toBeVisible();
  await page.getByRole('button', { name: /Universe index/ }).click();
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();
  await expect(page.locator('.app-map .ms-canvas')).toHaveCount(0);
  await shot(page, '23-universe-index');

  // An index that does not take you anywhere is decoration. Start from the
  // root, where the index is already what is on screen.
  await openMap(page);
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();
  await page.locator('.map-kid[data-node-id="operations"]').click();
  await expect(page.locator('.dz-title')).toHaveText('The Operations');

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * The scene is an object, not a diagram.
 *
 * A reader named the gap exactly: boxes, but not a real model dissected, and
 * not movable. These pin the two properties that answer it, depth you can turn
 * and faces carrying real values, plus the one interaction bug that ruins a
 * drag-to-orbit camera: ending every drag by navigating away.
 * ------------------------------------------------------------------ */

async function dragScene(page: Page, dx: number, dy: number) {
  const box = (await page.locator('.ms-canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
  await page.mouse.up();
}

test('the model can be turned, and turning it does not navigate away', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  await stage(page, 'Attention').click();
  await expect(page.locator('.sv-title')).toHaveText('Attention');

  // Nothing offers to reset a view that has not moved.
  await expect(page.getByRole('button', { name: 'Reset view' })).toHaveCount(0);

  await dragScene(page, 130, -45);
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();

  // The drag ended over some block. Treating that as a click would make the
  // camera unusable, because every orbit would jump you to another stage.
  await expect(page.locator('.sv-title')).toHaveText('Attention');

  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.getByRole('button', { name: 'Reset view' })).toHaveCount(0);
  await shot(page, '25-orbit');

  expect(errors).toEqual([]);
});

test('the scene paints real values, so it changes when the input does', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  await stage(page, 'Attention').click();
  await page.waitForTimeout(1500);

  const pixels = () =>
    page.evaluate(() => {
      const c = document.querySelector('.ms-canvas') as HTMLCanvasElement;
      return c.toDataURL().length;
    });

  const before = await pixels();
  await page.locator('#run-input').fill('A A A B');
  await page.waitForTimeout(1500);
  const after = await pixels();

  // The faces are painted from the symbolic core's output, not from a texture,
  // so a different input has to produce a different picture.
  expect(after).not.toBe(before);
  expect(errors).toEqual([]);
});

test('the index is a preview you can see, not a word you have to imagine', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  /* Off the root, where the index is something you ask for rather than the
     thing already on screen. "Show on map" told the reader nothing about what
     was behind it; the thumbnail shows the bodies around where they are. */
  await page.locator('.map-kid[data-node-id="model"]').click();
  const btn = page.getByRole('button', { name: /Universe index/ });
  await expect(btn.locator('.ub-canvas')).toBeVisible();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');

  await btn.click();
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: /Close index/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await shot(page, '26-universe-preview');

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * The migration to trained weights.
 *
 * The map used to run on seeded random projections, honestly labelled but
 * useless: every attention row came out near 1/6 and a learner studying it was
 * studying noise. These pin the thing that changed.
 * ------------------------------------------------------------------ */

test('the attention grid shows trained structure, not a flat row', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  await stage(page, 'Attention').click();

  const rows = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.sv-gcell')].map((e) => e.textContent ?? '');
    const out: string[][] = [];
    for (let i = 0; i < 6; i++) out.push(cells.slice(i * 6, (i + 1) * 6));
    return out;
  });

  // Every unmasked cell prints its value. A threshold used to hide anything
  // below 18%, which with trained weights hides exactly where the model is
  // NOT looking, and that is half the information in the grid.
  const last = rows[5]!.map(Number);
  expect(last.every((n) => Number.isFinite(n)), `last row was ${rows[5]!.join(',')}`).toBe(true);

  // Random projections give a near-uniform row. Trained ones do not.
  expect(Math.max(...last), 'no cell dominates, which means untrained weights').toBeGreaterThan(30);
  expect(Math.min(...last), 'no cell is ignored, which means untrained weights').toBeLessThan(5);

  await shot(page, '27-trained-attention');
  expect(errors).toEqual([]);
});

test('the model predicts the sorted answer, so the numbers mean something', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  await stage(page, 'The Loop').click();

  // C B A B B C sorted starts with A, and a working model says so.
  await expect(page.locator('.sv-seq em')).toHaveText('A');
  expect(errors).toEqual([]);
});

test('the lessons name the normalisation the weights were trained under', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  // It said RMSNorm while claiming GPT-2 lineage, and the weights are LayerNorm.
  // Running the wrong one produces numbers belonging to no model at all.
  await expect(page.locator('.ps-track')).toContainText('Normalization (LayerNorm)');
  await stage(page, 'Normalization (LayerNorm)').click();
  await expect(page.locator('.dz-title')).toHaveText('Normalization (LayerNorm)');
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * Origins on the concept nodes.
 *
 * Explaining what a knob does never stops it feeling arbitrary. Naming the
 * failure that made it necessary does, and the dates are what pry apart things
 * a newcomer fuses into one recent invention.
 * ------------------------------------------------------------------ */

test('a dated concept leads with what was broken, not with itself', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  await stage(page, 'Attention').click();

  const origin = page.locator('.dz-origin [data-testid="origin"]');
  await expect(origin).toBeVisible();
  await expect(origin).toContainText('2014');
  await expect(origin).toContainText('what was broken');
  /* The failure comes before the benefit on screen, which is the whole design.

     Read via textContent, not innerText. The labels are uppercased by CSS, so
     innerText returns "WHAT WAS BROKEN" while toContainText above matches
     against textContent and sees the lowercase source. Mixing the two silently
     compares different strings. */
  const text = (await origin.evaluate((e) => e.textContent ?? '')).toLowerCase();
  expect(text.indexOf('what was broken')).toBeLessThan(text.indexOf('what it bought'));
  expect(text).toContain('what it bought');
  await expect(origin.locator('.gl-src')).toBeVisible();

  await shot(page, '28-origin-attention');
  expect(errors).toEqual([]);
});

test('a forced concept says nobody chose it', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  await stage(page, 'Tokenization').click();

  const origin = page.locator('.dz-origin [data-testid="origin"]');
  await expect(origin).toContainText('nobody chose this');
  await expect(origin).toContainText('no version of the problem');
  // Forced things have no year, because there is no alternative history.
  expect(await origin.innerText()).not.toMatch(/\b(19|20)\d\d\b/);
  expect(errors).toEqual([]);
});

test('the dates keep attention and the transformer apart, on screen', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);

  const yearAt = async (name: string) => {
    await stage(page, name).click();
    const t = await page.locator('.dz-origin [data-testid="origin"]').innerText();
    return Number(t.match(/\b(19|20)\d\d\b/)![0]);
  };

  // Attention is 2014, so it is not the transformer, which is 2017.
  expect(await yearAt('Attention')).toBe(2014);

  await page.locator('.nb-crumb', { hasText: 'The Transformer' }).click();
  const tf = await page.locator('.dz-origin [data-testid="origin"]').innerText();
  expect(Number(tf.match(/\b(19|20)\d\d\b/)![0])).toBe(2017);
  expect(errors).toEqual([]);
});

test('objects with no real history are given none', async ({ page }) => {
  const errors = watchConsole(page);
  await openMap(page);
  for (const id of ['model', 'foundations', 'linalg', 'vector']) {
    await page.locator(`.map-kid[data-node-id="${id}"]`).click();
  }
  await expect(page.locator('.dz-title')).toHaveText('Vector');
  /* A vector is not somebody's fix for something, and inventing a date for it
     would be worse than saying nothing. Leaving it blank was worse too: a blank
     reads as an oversight. So it now answers, and the answer is that there is
     nothing to chase here. */
  await expect(page.locator('.dz-origin')).toHaveCount(1);
  await expect(page.locator('.dz-origin')).toContainText('no history to tell');
  await expect(page.locator('.dz-origin')).not.toHaveText(/[0-9]{4}/);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * The front door, and getting back out of it.
 * ------------------------------------------------------------------ */

test('the universe greets first, and hands over', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto(BUILT);

  // No clicking to get here. This is what opening the file gives you.
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();
  await expect(page.locator('.map-crumb.here')).toHaveText('LLM');

  // And it points at the lesson rather than being an end in itself.
  await expect(page.locator('.map-start')).toBeVisible();
  expect(errors).toEqual([]);
});

test('you can go down three levels on the map and get back out', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto(BUILT);

  /* The reported problem was that the map could not be navigated. The trail
     and the way up were both hidden in split mode, which is the only mode the
     map is ever shown in, so going in was one-way.

     Driven from the keyboard, which is also the only way to check that the
     canvas keeps the promise its own aria-label makes. */
  await expect(page.getByTestId('map-up')).toHaveCount(0); // nothing above the root
  const canvas = page.locator('.app-map .map-canvas');
  await canvas.focus();

  for (let i = 0; i < 3; i++) await canvas.press('Enter');
  const deep = await page.locator('.map-crumb.here').innerText();
  expect(deep).not.toBe('LLM');
  expect(await page.locator('.map-crumb').count()).toBe(4);

  // All the way back up, using only what the map itself offers.
  await expect(page.getByTestId('map-up')).toHaveCount(1);
  for (let i = 0; i < 3; i++) await page.getByTestId('map-up').click();
  await expect(page.locator('.map-crumb.here')).toHaveText('LLM');
  await expect(page.getByTestId('map-up')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the trail jumps straight home from depth', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto(BUILT);
  const canvas = page.locator('.app-map .map-canvas');
  await canvas.focus();
  for (let i = 0; i < 3; i++) await canvas.press('Enter');

  // Four levels deep, one click home. Stepping out four times is not navigation.
  await page.locator('.map-crumb', { hasText: 'LLM' }).first().click();
  await expect(page.locator('.map-crumb.here')).toHaveText('LLM');
  await expect(page.locator('.app-map .map-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
