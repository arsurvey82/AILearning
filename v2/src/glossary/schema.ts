/**
 * Terms that can be dug into, all the way down.
 *
 * The rule this exists to enforce: no explanation may leave a term standing
 * there undefined. A reader who does not know one word in a sentence cannot
 * evaluate the sentence, and "it feels vague" is what that experience is called
 * from the inside. So every term used inside an explanation must itself either
 * be a term you can open, or be on the ASSUMED list, and a test fails the build
 * when that is not true.
 *
 * The second thing every term carries is its ORIGIN, which is the axis the
 * concept map never had. Explaining what a knob does never makes it stop
 * feeling arbitrary. Walking back to the failure that made the knob necessary
 * does. So each term is either:
 *
 *   forced    nobody chose it. It falls out of the problem itself, and there
 *             is no alternative history where it is different.
 *   fix       somebody's contingent solution, with a year and a named earlier
 *             failure. It could have gone another way.
 *
 * That split is doing real work. A newcomer arrives believing a language model
 * is one recent invention; it is a stack of fixes, each patching a specific
 * earlier failure, and the dates are what pry them apart. Attention is 2014 and
 * the transformer is 2017, so attention is not the transformer. Backpropagation
 * is older than all of it and belongs to any neural network, not this one.
 */

export type TermId = string;

/** Where a source can be checked. design-spec section 8 requires these. */
export interface Source {
  label: string;
  url: string;
}

export type Origin =
  | {
      kind: 'forced';
      /** The constraint that leaves no choice. */
      because: string;
    }
  | {
      kind: 'fix';
      /** When it became the standard answer. */
      year: number;
      /** What was broken before it. The reason the fix exists at all. */
      problem: string;
      /** What the fix bought, in the reader's terms. */
      gained: string;
      source?: Source;
    };

export interface Term {
  id: TermId;
  term: string;
  /** Other spellings that should resolve to this entry. */
  aliases?: string[];

  /**
   * One line, no jargon, deliberately deflating.
   *
   * The move that makes the reference document easy is not simplification, it
   * is deflation: showing that a word which sounds large is a small idea in
   * expensive clothing. So this should say what the thing IS in plain words,
   * and where a reader is likely to arrive with a wrong picture, `not` should
   * take it away.
   */
  plain: string;

  /** The wrong mental model to kill. Optional, but it is usually the point. */
  not?: string;

  /** More, for a reader who wants it. Terms in here are diggable too. */
  more?: string[];

  origin?: Origin;

  /** Where to go next, by term id. */
  see?: TermId[];
}

/**
 * Words a reader is assumed to have, so a chain is allowed to stop here.
 *
 * Writing this list down is the honest part. Every entry is a bet about the
 * audience, and keeping it short and visible stops the bets being made silently
 * inside prose.
 */
export const ASSUMED = new Set([
  'number', 'numbers', 'word', 'words', 'text', 'letter', 'letters', 'list',
  'table', 'row', 'rows', 'column', 'columns', 'add', 'added', 'sum',
  'multiply', 'measure', 'distance', 'near', 'nearness', 'position', 'positions',
  'computer', 'model', 'models', 'sentence', 'meaning', 'similar', 'similarity',
]);

/** Terms are written as [[id]] inside prose, so they can be found and linked. */
export const LINK = /\[\[([a-z0-9-]+)\]\]/g;

/** Every term id referenced from a piece of prose. */
export function linkedIds(text: string): TermId[] {
  return [...text.matchAll(LINK)].map((m) => m[1]!);
}

/** Prose with the link markers removed, for plain reading and for tests. */
export function stripLinks(text: string): string {
  return text.replace(LINK, (_m, id: string) => id.replace(/-/g, ' '));
}
