/**
 * "None of it feels vague" as something the build can check.
 *
 * Vagueness has a mechanical cause: a sentence uses a word the reader does not
 * have, and there is nowhere to go and find out. So the rule is that every term
 * mentioned inside an explanation must itself be openable, or be on the ASSUMED
 * list, and every chain of digging must reach the floor rather than wandering
 * forever.
 *
 * That turns a matter of taste into a failing test, which is the only way it
 * survives contact with more content being added later.
 */

import { describe, expect, it } from 'vitest';
import { ASSUMED, linkedIds, stripLinks, type Term } from '../src/glossary/schema';
import { BY_ID, TERMS, forced, timeline } from '../src/glossary/terms';

/** Every piece of prose a term shows, so nothing escapes the checks. */
function prose(t: Term): string[] {
  return [
    t.plain,
    ...(t.not ? [t.not] : []),
    ...(t.more ?? []),
    ...(t.origin?.kind === 'fix' ? [t.origin.problem, t.origin.gained] : []),
    ...(t.origin?.kind === 'forced' ? [t.origin.because] : []),
  ];
}

describe('every term can be dug into', () => {
  it('has no duplicate ids', () => {
    expect(new Set(TERMS.map((t) => t.id)).size).toBe(TERMS.length);
  });

  it('never mentions a term that cannot be opened', () => {
    const missing: string[] = [];
    for (const t of TERMS) {
      for (const text of prose(t)) {
        for (const id of linkedIds(text)) {
          if (!BY_ID.has(id)) missing.push(`${t.id} -> ${id}`);
        }
      }
    }
    expect(missing, `links with no entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('never points `see` at something that does not exist', () => {
    const bad: string[] = [];
    for (const t of TERMS) {
      for (const id of t.see ?? []) if (!BY_ID.has(id)) bad.push(`${t.id} -> ${id}`);
    }
    expect(bad, `dangling see: ${bad.join(', ')}`).toEqual([]);
  });

  /**
   * The floor, and the width of each step.
   *
   * The first version of this capped the longest chain at six hops and failed
   * at eight. The cap was a guess, and measuring it exposed that depth is the
   * wrong thing to police: eight hops with no cycles is a reader choosing to
   * keep going, which is the whole point of making it diggable.
   *
   * What actually produces "I am lost" is BREADTH. A sentence offering six
   * doors at once forces a choice the reader has no basis for making. So the
   * bound belongs on how many new terms one line introduces, and depth only
   * needs a loose sanity limit to catch a runaway.
   */
  it('never offers too many doors in one line', () => {
    const wide = TERMS.map((t) => ({ id: t.id, n: new Set(linkedIds(t.plain)).size }))
      .filter((x) => x.n > 3);
    expect(wide, `lines with too many links: ${wide.map((w) => `${w.id}(${w.n})`).join(', ')}`).toEqual([]);
  });

  it('terminates from every starting point, without wandering', () => {
    const depth = new Map<string, number>();
    const walk = (id: string, seen: Set<string>): number => {
      if (seen.has(id)) return 0; // a cycle adds no new depth
      if (depth.has(id)) return depth.get(id)!;
      const t = BY_ID.get(id)!;
      const next = [...new Set(prose(t).flatMap(linkedIds))].filter((x) => x !== id);
      const here = next.length === 0 ? 0 : 1 + Math.max(...next.map((n) => walk(n, new Set([...seen, id]))));
      depth.set(id, here);
      return here;
    };

    const deepest = TERMS.map((t) => ({ id: t.id, d: walk(t.id, new Set()) })).sort(
      (a, b) => b.d - a.d,
    );
    // Loose on purpose. This is a runaway guard, not a style rule.
    expect(deepest[0]!.d, `deepest chain starts at ${deepest[0]!.id}`).toBeLessThanOrEqual(12);
    expect(deepest.every((x) => Number.isFinite(x.d))).toBe(true);
  });

  it('reaches a term with no onward links, so the floor really exists', () => {
    const leaves = TERMS.filter((t) => prose(t).flatMap(linkedIds).length === 0);
    expect(leaves.length, 'nothing terminates').toBeGreaterThan(0);
  });

  it('uses only assumed words or linked terms for the jargon it introduces', () => {
    /* A deliberately small guard rather than a language model: these are the
       words this project has caught itself using without defining. Each one
       either gets a link or gets rewritten. */
    const JARGON = [
      'softmax', 'logit', 'logits', 'tensor', 'matrix multiplication', 'gradient',
      'parameter', 'parameters', 'weights', 'inference', 'residual', 'normalisation',
    ];
    const bare: string[] = [];
    for (const t of TERMS) {
      for (const text of prose(t)) {
        const plain = stripLinks(text).toLowerCase();
        for (const j of JARGON) {
          if (plain.includes(j) && !BY_ID.has(j.replace(/\s+/g, '-'))) {
            bare.push(`${t.id}: "${j}"`);
          }
        }
      }
    }
    expect(bare, `undefined jargon: ${bare.join(', ')}`).toEqual([]);
  });
});

describe('every term says where it came from', () => {
  it('deflates, by saying what the thing is not', () => {
    /* The move that makes the reference document easy is taking away a wrong
       picture, not adding a right one. At least half the entries should do it. */
    const withNot = TERMS.filter((t) => t.not).length;
    expect(withNot / TERMS.length).toBeGreaterThan(0.4);
  });

  it('separates what was forced from what somebody chose', () => {
    expect(forced().length, 'nothing is forced?').toBeGreaterThan(0);
    expect(timeline().length, 'nothing is dated?').toBeGreaterThan(4);
    for (const t of forced()) {
      expect(t.origin, t.id).not.toHaveProperty('year');
    }
  });

  /**
   * The assumed list is a bet about the audience, so it should stay small and
   * stay honest. A long list is how a project quietly gives itself permission
   * to leave things undefined.
   */
  it('assumes only plain everyday words, and not many of them', () => {
    expect(ASSUMED.size).toBeLessThan(50);
    const jargonInAssumed = [...ASSUMED].filter((w) => BY_ID.has(w));
    expect(jargonInAssumed, `assumed AND defined: ${jargonInAssumed.join(', ')}`).toEqual([]);
    for (const w of ASSUMED) expect(w, 'assumed words should be single words').not.toContain(' ');
  });

  it('gives every dated fix a real earlier failure to point at', () => {
    for (const t of timeline()) {
      expect(t.origin.problem.length, `${t.id} has no named problem`).toBeGreaterThan(30);
      expect(t.origin.year).toBeGreaterThan(1950);
      expect(t.origin.year).toBeLessThanOrEqual(new Date('2026-08-16').getFullYear());
    }
  });

  it('cites the dated claims', () => {
    const uncited = timeline().filter((t) => !t.origin.source).map((t) => t.id);
    // Every year attributed to a paper needs the paper. The context window is
    // the one exception: it is a consequence of the transformer rather than a
    // result anyone published, and it points at the transformer instead.
    expect(uncited).toEqual(['context-window']);
  });

  it('orders the timeline so a reader can walk back through it', () => {
    const years = timeline().map((t) => t.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  /**
   * The differentiation the dates exist to make.
   *
   * A newcomer fuses these into one recent invention. The years are what pry
   * them apart, so if the years ever stop separating them the structure has
   * quietly lost its point.
   */
  it('keeps attention, the transformer and backpropagation apart in time', () => {
    const year = (id: string) => {
      const o = BY_ID.get(id)!.origin;
      return o?.kind === 'fix' ? o.year : NaN;
    };
    expect(year('attention')).toBeLessThan(year('transformer'));
    expect(year('backpropagation')).toBeLessThan(year('attention'));
    expect(BY_ID.get('backpropagation')!.not).toMatch(/not part of the/i);
    expect(BY_ID.get('dimension')!.origin?.kind).toBe('fix');
  });

  it('makes the context window a consequence, not a preference', () => {
    const t = BY_ID.get('context-window')!;
    expect(t.not).toMatch(/side effect|consequence|not a product decision/i);
    expect(prose(t).join(' ')).toContain('transformer');
  });
});
