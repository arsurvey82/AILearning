/**
 * Label fitting. The reported defect was text sitting outside its circle while
 * a sibling's sat inside, so these tests assert containment directly rather
 * than trusting the render.
 */

import { describe, expect, it } from 'vitest';
import { fitLabel, wrapBalanced } from '../src/map/label';
import { NODES } from '../src/content';

/** Stand-in for canvas metrics: system-ui averages ~0.55em per character. */
const measure = (text: string, size: number) => text.length * size * 0.55;

/** The usable chord the fitter targets, recomputed here independently. */
const usable = (radius: number, lines: number) => radius * 2 * (lines > 1 ? 0.78 : 0.92) * 0.86;

describe('fitLabel', () => {
  it('keeps a short label on one line at a comfortable size', () => {
    const f = fitLabel('Vector', { radius: 70, measure });
    expect(f.placement).toBe('inside');
    expect(f.lines).toEqual(['Vector']);
    expect(f.fontSize).toBeGreaterThanOrEqual(12);
  });

  it('shrinks before it wraps', () => {
    const f = fitLabel('Tokenization', { radius: 60, measure });
    expect(f.placement).toBe('inside');
    expect(f.lines).toHaveLength(1);
  });

  it('wraps rather than overflowing when shrinking is not enough', () => {
    const f = fitLabel('Transformer Layer xN', { radius: 52, measure });
    expect(f.placement).toBe('inside');
    expect(f.lines.length).toBeGreaterThan(1);
  });

  it('only goes outside when nothing readable fits', () => {
    const tiny = fitLabel('Normalization (RMSNorm)', { radius: 9, measure });
    expect(tiny.placement).toBe('below');
  });

  it('never returns a fit that overflows its disc', () => {
    for (const r of [14, 22, 40, 64, 90, 140, 220]) {
      for (const n of NODES) {
        const f = fitLabel(n.title, { radius: r, measure });
        if (f.placement !== 'inside') continue;
        const widest = Math.max(...f.lines.map((l) => measure(l, f.fontSize)));
        expect(
          widest,
          `"${n.title}" at r=${r} is ${widest.toFixed(0)}px in a ${usable(r, f.lines.length).toFixed(0)}px chord`,
        ).toBeLessThanOrEqual(usable(r, f.lines.length) + 0.01);
      }
    }
  });

  it('treats every real node title the same way at the same size', () => {
    // The visible defect was inconsistency between siblings, so this pins the
    // property that actually matters: at one radius, either they all fit or
    // the ones that do not are genuinely longer.
    const r = 96;
    const results = NODES.map((n) => ({ title: n.title, fit: fitLabel(n.title, { radius: r, measure }) }));
    const outside = results.filter((x) => x.fit.placement === 'below');
    expect(outside, `these fall outside at r=${r}: ${outside.map((o) => o.title).join(', ')}`).toEqual(
      [],
    );
  });
});

describe('wrapBalanced', () => {
  it('splits near the middle rather than leaving a stub', () => {
    expect(wrapBalanced('Transformer Layer xN')).toEqual(['Transformer', 'Layer xN']);
  });

  it('leaves a single word alone', () => {
    expect(wrapBalanced('Embedding')).toEqual(['Embedding']);
  });
});
