/**
 * Fitting a node's label inside its disc.
 *
 * The first version tried one font size and, if the text did not fit, dropped
 * the label underneath the circle. That produced the reported defect: sibling
 * nodes labelled inconsistently, with "The Operations" hanging outside its
 * disc while "The Model" sat inside. The same kind of thing, presented two
 * different ways, which reads as breakage rather than as design.
 *
 * Order of attempts, cheapest first:
 *   1. one line at the ideal size
 *   2. one line, shrunk toward a floor
 *   3. two lines, wrapped on a space, shrunk toward the floor
 *   4. only then, outside, and only when the disc is genuinely too small to
 *      hold readable text at all
 *
 * Pure and measure-injected so it can be unit-tested. Canvas text metrics are
 * exactly the sort of thing that is never checked and quietly regresses.
 */

export interface LabelFit {
  lines: string[];
  fontSize: number;
  /** 'inside' the disc, or 'below' it when nothing readable fits. */
  placement: 'inside' | 'below';
}

export interface FitOptions {
  /** Disc radius in screen pixels. */
  radius: number;
  /** Measures a string at a given font size. */
  measure: (text: string, fontSize: number) => number;
  /** Smallest size still worth reading. Below this, go outside instead. */
  minFontSize?: number;
  /** Largest size, before the radius caps it. */
  maxFontSize?: number;
}

/** Split on the space nearest the middle, so neither line is a stub. */
export function wrapBalanced(text: string): string[] {
  const words = text.split(' ');
  if (words.length < 2) return [text];

  let best = 1;
  let bestDelta = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    const delta = Math.abs(a - b);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

export function fitLabel(text: string, opts: FitOptions): LabelFit {
  const { radius, measure } = opts;
  const min = opts.minFontSize ?? 9;
  const max = opts.maxFontSize ?? 21;

  // Usable width across a circle, kept inside the rim rather than touching it.
  const widthAt = (lineCount: number) => {
    // Two lines sit further from the centre, so less width is available.
    const inset = lineCount > 1 ? 0.78 : 0.92;
    return radius * 2 * inset * 0.86;
  };

  const ideal = Math.max(min, Math.min(radius * 0.3, max));

  // 1 & 2, one line, shrinking toward the floor.
  for (let size = ideal; size >= min; size -= 1) {
    if (measure(text, size) <= widthAt(1)) {
      return { lines: [text], fontSize: size, placement: 'inside' };
    }
  }

  // 3, two lines, shrinking toward the floor.
  const wrapped = wrapBalanced(text);
  if (wrapped.length > 1) {
    // Two lines need vertical room as well as horizontal.
    const fitsVertically = (size: number) => size * 2.2 <= radius * 1.5;
    for (let size = ideal; size >= min; size -= 1) {
      const widest = Math.max(...wrapped.map((l) => measure(l, size)));
      if (widest <= widthAt(2) && fitsVertically(size)) {
        return { lines: wrapped, fontSize: size, placement: 'inside' };
      }
    }
  }

  // 4, nothing readable fits inside.
  return { lines: [text], fontSize: Math.max(min, 12), placement: 'below' };
}
