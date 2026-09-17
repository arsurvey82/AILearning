/**
 * The first thirty seconds.
 *
 * A sentence with a gap and one button. Press it and the model fills the gap,
 * then shows what the verb position was looking at while it decided. Swap one
 * word and the answer changes.
 *
 * The order is deliberate. The reader verifies the model against their own
 * grammar before a single term is defined, because "the verb agrees with the
 * subject" is knowledge they already have. Only once they have seen it be right
 * does any of the machinery earn their attention.
 *
 * The distractor is the point. Its number is independent of the subject's, so
 * it carries no information about the answer and reading it is worth nothing.
 * When the reader flips the distractor and the verb's number does NOT change,
 * that is the moment the reach becomes real rather than asserted.
 */

import { useState } from 'react';
import {
  AGREEMENT,
  decide,
  flipNoun,
  nextNoun,
  nounNumber,
  verbNumber,
  promptOf,
  type Decision,
  type Sentence,
} from './words';
import './Hook.css';

type Phase = 'ready' | 'decided';

export function Hook({
  onOpenModel,
  sentence,
  setSentence,
}: {
  onOpenModel?: () => void;
  sentence: Sentence;
  setSentence: (s: Sentence) => void;
}) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [result, setResult] = useState<Decision | null>(null);

  const words = promptOf(sentence);

  /** Any edit invalidates the answer, so the screen never shows a stale verb. */
  const edit = (next: Sentence) => {
    setSentence(next);
    if (phase === 'decided') setResult(decide(next));
  };

  const run = () => {
    setResult(decide(sentence));
    setPhase('decided');
  };

  const subjNum = nounNumber(sentence.subject);
  const distNum = nounNumber(sentence.distractor);

  return (
    <section className="hk">
      <p className="hk-kicker">A model with 101,952 learned numbers, running here in your browser</p>

      <div className="hk-line" data-testid="sentence">
        {words.map((w, i) => {
          const isSubject = i === 1;
          const isDistractor = i === 4;
          if (!isSubject && !isDistractor) {
            return (
              <span className="hk-w" key={i}>
                {w}
              </span>
            );
          }
          return (
            <button
              key={i}
              className={`hk-w hk-pick${isSubject ? ' subject' : ' distractor'}`}
              data-testid={isSubject ? 'subject' : 'distractor'}
              title="click to change the word, shift-click to change its number"
              onClick={(e) => {
                const change = e.shiftKey ? flipNoun : nextNoun;
                edit(
                  isSubject
                    ? { ...sentence, subject: change(w) }
                    : { ...sentence, distractor: change(w) },
                );
              }}
            >
              {w}
              <em>{isSubject ? 'the subject' : 'the nearer noun'}</em>
            </button>
          );
        })}

        <span className={`hk-gap${result ? ' filled' : ''}`} data-testid="gap">
          <span data-testid="gap-word">{result ? result.verb : '?'}</span>
          {result && (
            <em className="hk-gap-n" data-testid="gap-number">
              {verbNumber(result.verb) ?? ''}
            </em>
          )}
        </span>
        <span className="hk-w">.</span>
      </div>

      {phase === 'ready' ? (
        <div className="hk-cta">
          <button className="hk-go" onClick={run} data-testid="decide">
            Watch it decide
          </button>
          <p className="hk-sub">
            Two nouns. The first one is <b>the subject</b>, the one the sentence is about. The
            second sits closer to the gap and has nothing to do with it. Only the subject
            controls the verb.
          </p>
        </div>
      ) : (
        result && (
          <div className="hk-after">
            <p className={`hk-verdict${result.correct ? ' good' : ' bad'}`} data-testid="verdict">
              {result.correct
                ? `Correct. "${sentence.subject}" is ${subjNum}, so the verb is "${result.verb}".`
                : `Wrong. It answered "${result.verb}" for a ${subjNum} subject.`}
            </p>

            <div className="hk-att" data-testid="attention">
              <p className="hk-att-h">
                What the model was looking at while it chose, from block{' '}
                {result.source.block + 1}, head {result.source.head + 1}
              </p>
              <div className="hk-bars">
                {words.map((w, i) => {
                  const p = result.attention[i] ?? 0;
                  const key = i === 1 ? 'subject' : i === 4 ? 'distractor' : '';
                  return (
                    <div className={`hk-bar ${key}`} key={i} data-word={w}>
                      <div className="hk-bar-fill" style={{ height: `${Math.max(2, p * 100)}%` }} />
                      <span className="hk-bar-p">{Math.round(p * 100)}</span>
                      <span className="hk-bar-w">{w}</span>
                    </div>
                  );
                })}
              </div>
              <p className="hk-att-n">
                It spends {Math.round((result.attention[1] ?? 0) * 100)}% on the subject and{' '}
                {Math.round((result.attention[4] ?? 0) * 100)}% on the nearer noun. Nothing told it
                which one mattered.
              </p>
            </div>

            <div className="hk-try">
              <p className="hk-try-h">Try it yourself</p>
              <ul>
                <li>
                  <button
                    className="hk-try-b"
                    data-testid="flip-subject"
                    onClick={() => edit({ ...sentence, subject: flipNoun(sentence.subject) })}
                  >
                    Make the subject {subjNum === 'singular' ? 'plural' : 'singular'}
                  </button>
                  <span>the verb switches to its {subjNum === 'singular' ? 'plural' : 'singular'} form</span>
                </li>
                <li>
                  <button
                    className="hk-try-b"
                    data-testid="flip-distractor"
                    onClick={() =>
                      edit({ ...sentence, distractor: flipNoun(sentence.distractor) })
                    }
                  >
                    Make the nearer noun {distNum === 'singular' ? 'plural' : 'singular'}
                  </button>
                  {/* Measured, not assumed: flipping this noun often changes
                      the verb WORD ("waits" becomes "runs") while leaving its
                      number alone. Promising "the number stays the same" and
                      then showing a different word reads as a broken promise,
                      so the promise now says which part holds. */}
                  <span>
                    the verb may change word, but it stays {subjNum === 'singular' ? 'singular' : 'plural'}
                  </span>
                </li>
              </ul>
            </div>

            <p className="hk-foot">
              It gets this right on {Math.round(AGREEMENT * 100)}% of sentences it was never
              trained on. The nearer noun is singular or plural equally often, so it carries no
              clue about the answer: a model that copied it would score about half, no better
              than a coin flip.{' '}
              {onOpenModel && (
                <button className="hk-open" onClick={onOpenModel} data-testid="open-model">
                  Now look inside it
                </button>
              )}
            </p>
          </div>
        )
      )}
    </section>
  );
}
