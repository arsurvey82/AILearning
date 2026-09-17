/**
 * The claim the first screen makes, checked against the model that makes it.
 *
 * A reader reported that flipping the nearer noun changed the verb, which the
 * page said would not happen. They were right about what they saw and the page
 * was right about what it meant: the WORD changes, the NUMBER does not. The
 * page now says that, and this pins it, because the promise is only worth
 * making if it is true for every sentence the reader can build.
 */

import { describe, expect, it } from 'vitest';
import { decide, flipNoun, nounNumber, verbNumber } from '../src/learn/words';

const NOUNS = ['cat', 'cats', 'dog', 'dogs'];
const pairs = NOUNS.flatMap((subject) =>
  NOUNS.filter((d) => d !== subject).map((distractor) => ({ subject, distractor })),
);

describe('what the first screen promises', () => {
  it('has sentences to check', () => {
    expect(pairs.length).toBeGreaterThan(8);
  });

  it('never changes the verb NUMBER when the nearer noun flips', () => {
    for (const s of pairs) {
      const a = decide(s);
      const b = decide({ ...s, distractor: flipNoun(s.distractor) });
      expect(verbNumber(a.verb), `${s.subject}/${s.distractor}`).toBe(verbNumber(b.verb));
    }
  });

  it('always changes the verb number when the subject flips', () => {
    for (const s of pairs) {
      const a = decide(s);
      const b = decide({ ...s, subject: flipNoun(s.subject) });
      expect(verbNumber(a.verb), `${s.subject}/${s.distractor}`).not.toBe(verbNumber(b.verb));
    }
  });

  it('does change the verb WORD sometimes, which is why the page says so', () => {
    /* If this ever stopped being true the page would be over-explaining, and
       the sentence about the word changing should come back out. */
    const changed = pairs.filter(
      (s) => decide(s).verb !== decide({ ...s, distractor: flipNoun(s.distractor) }).verb,
    );
    expect(changed.length).toBeGreaterThan(0);
  });

  it('agrees with the subject in every case', () => {
    for (const s of pairs) {
      expect(verbNumber(decide(s).verb), `${s.subject}/${s.distractor}`).toBe(
        nounNumber(s.subject),
      );
    }
  });
});
