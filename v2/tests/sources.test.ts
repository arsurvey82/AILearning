/**
 * Every figure about the outside world can be checked, or says it cannot.
 *
 * None of the at-scale numbers are computed by this project, so each is a
 * claim about something else: a published model, or what people commonly do.
 * The first kind gets a citation. The second kind gets told on itself. What
 * must not happen is the second kind wearing the first kind's clothes.
 */

import { describe, expect, it } from 'vitest';
import { NODES, basisOf, citationsFor, isConvention } from '../src/content';

const external = NODES.flatMap((n) =>
  (n.L3_atScale ?? [])
    .filter((s) => (s.gpt2 || s.llama) && /[0-9]/.test(`${s.gpt2 ?? ''}${s.llama ?? ''}`))
    .map((s) => ({ id: n.id, s })),
);

describe('at-scale figures', () => {
  it('has a meaningful number of external figures to check', () => {
    expect(external.length).toBeGreaterThan(50);
  });

  it('leaves no external figure both uncited and unmarked', () => {
    const naked = external
      .filter(({ id, s }) => citationsFor(id, s).length === 0 && !isConvention(id, s))
      .map(({ id, s }) => `${id} :: ${s.label}`);
    expect(naked).toEqual([]);
  });

  it('never cites a config for something no config contains', () => {
    for (const { id, s } of external) {
      if (basisOf(id, s.label) !== 'convention' || s.source) continue;
      expect(citationsFor(id, s), `${id} :: ${s.label}`).toEqual([]);
    }
  });

  it('cites the config of whichever model the figure is about', () => {
    for (const { id, s } of external) {
      if (s.source || basisOf(id, s.label) === 'convention') continue;
      const urls = citationsFor(id, s).map((c) => c.url).join(' ');
      if (s.gpt2) expect(urls, `${id} :: ${s.label}`).toContain('gpt2');
      if (s.llama) expect(urls, `${id} :: ${s.label}`).toContain('Llama-3.1-8B');
    }
  });

  it('keeps conventions a minority, or the lens is guesswork', () => {
    const conv = external.filter(({ id, s }) => isConvention(id, s)).length;
    expect(conv / external.length).toBeLessThan(0.4);
  });
});
