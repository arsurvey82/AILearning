/**
 * The word model, and the small amount of grammar the UI needs to know.
 *
 * The task is subject-verb agreement across a distractor:
 *
 *     the cat  near the dogs sits .
 *     the cats near the dog  sit  .
 *
 * The nearer noun always disagrees in number with the verb, so a model that
 * copies from the closest noun scores zero. Getting it right means the verb
 * position has to reach past the distractor to the real subject, and that reach
 * shows up in the attention row. That is the entire reason for choosing this
 * task over sorting letters: the picture becomes a claim a reader can check
 * against their own grammar.
 */

import raw from '../model/weights-words.json';
import { forward, paramCounts, type Trace, type Weights } from '../model/gpt';

export const WORDS = raw as unknown as Weights;

interface Groups {
  sg_noun: string[];
  pl_noun: string[];
  sg_verb: string[];
  pl_verb: string[];
  fixed: string[];
}
export const GROUPS = (raw as unknown as { groups: Groups }).groups;

/** Held-out agreement accuracy, recorded by the trainer. */
export const AGREEMENT = (raw as unknown as { agreement_held_out: number }).agreement_held_out;

/** Where the verb sits in the sentence, so the UI never has to count. */
export const VERB_POS = (raw as unknown as { verb_pos: number }).verb_pos;

export const PARAMS = paramCounts(WORDS);

export type Number_ = 'singular' | 'plural';

export function nounNumber(word: string): Number_ | undefined {
  if (GROUPS.sg_noun.includes(word)) return 'singular';
  if (GROUPS.pl_noun.includes(word)) return 'plural';
  return undefined;
}
export function verbNumber(word: string): Number_ | undefined {
  if (GROUPS.sg_verb.includes(word)) return 'singular';
  if (GROUPS.pl_verb.includes(word)) return 'plural';
  return undefined;
}

/** The other number's form of a noun, so one click can flip it. */
export function flipNoun(word: string): string {
  const i = GROUPS.sg_noun.indexOf(word);
  if (i >= 0) return GROUPS.pl_noun[i]!;
  const j = GROUPS.pl_noun.indexOf(word);
  if (j >= 0) return GROUPS.sg_noun[j]!;
  return word;
}

/** Cycle to the next noun of the same number, keeping the sentence grammatical. */
export function nextNoun(word: string): string {
  const list = GROUPS.sg_noun.includes(word) ? GROUPS.sg_noun : GROUPS.pl_noun;
  const i = list.indexOf(word);
  return i < 0 ? word : list[(i + 1) % list.length]!;
}

export interface Sentence {
  subject: string;
  distractor: string;
}

/** The words the model actually sees, up to but not including the verb. */
export function promptOf(s: Sentence): string[] {
  return ['the', s.subject, 'near', 'the', s.distractor];
}

export interface Decision {
  trace: Trace;
  /** The verb the model chose. */
  verb: string;
  /** Whether that verb agrees with the subject, which is the task. */
  correct: boolean;
  /**
   * What the verb position attends to, from the head that does the reaching.
   * One weight per word of the prompt.
   */
  attention: number[];
  /** Which block and head that row came from, so the UI can name it. */
  source: { block: number; head: number };
}

/**
 * The head that reaches for the subject.
 *
 * Picked by measuring rather than hardcoded: the interesting head is the one
 * whose verb-position row puts the most weight on the subject. Hardcoding block
 * 1 head 0 would work today and quietly point at the wrong thing the first time
 * anyone retrains the model.
 */
function reachingHead(t: Trace, subjectIndex: number): { block: number; head: number } {
  let best = { block: 0, head: 0 };
  let bestWeight = -1;
  t.layers.forEach((L, block) =>
    L.heads.forEach((H, head) => {
      const row = H.weights[H.weights.length - 1];
      const w = row?.[subjectIndex] ?? 0;
      if (w > bestWeight) {
        bestWeight = w;
        best = { block, head };
      }
    }),
  );
  return best;
}

export function decide(s: Sentence): Decision {
  const prompt = promptOf(s);
  const trace = forward(WORDS, prompt);
  const verb = trace.predicted;
  const want = nounNumber(s.subject);
  const source = reachingHead(trace, 1); // index 1 is the subject
  const row = trace.layers[source.block]!.heads[source.head]!.weights;
  return {
    trace,
    verb,
    correct: verbNumber(verb) !== undefined && verbNumber(verb) === want,
    attention: row[row.length - 1]!.slice(),
    source,
  };
}
