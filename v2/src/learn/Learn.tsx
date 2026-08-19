/**
 * The trained-model surface.
 *
 * One sentence, owned here, shared by both halves. The hook proves the model
 * works against grammar the reader already has; the ladder is how they go
 * looking for why. Keeping the sentence in one place means opening the ladder
 * never asks "which sentence are we talking about now".
 */

import { useState } from 'react';
import { DigPanel } from '../glossary/Dig';
import { Hook } from './Hook';
import { Ladder } from './Ladder';
import { Start } from './Start';
import type { Sentence } from './words';
import './Learn.css';

/* Two scales, in this order.
   One: seven words, four numbers, printed. Where everybody starts.
   Two: a trained transformer with real attention. Where you go when the
   printed version stops being enough, and not a moment before. */
type Scale = 'start' | 'model';

export function Learn() {
  const [sentence, setSentence] = useState<Sentence>({ subject: 'cat', distractor: 'dogs' });
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState<Scale>('start');

  return (
    <div className="lrn">
      <div className="lrn-scales" role="group" aria-label="Where to start">
        <button
          className={`lrn-scale${scale === 'start' ? ' on' : ''}`}
          onClick={() => setScale('start')}
          data-testid="scale-start"
        >
          <b>Start here</b>
          <span>seven words, four numbers, printed</span>
        </button>
        <button
          className={`lrn-scale${scale === 'model' ? ' on' : ''}`}
          onClick={() => setScale('model')}
          data-testid="scale-model"
        >
          <b>A trained model</b>
          <span>real weights, real attention</span>
        </button>
      </div>

      {scale === 'start' ? (
        <Start />
      ) : (
        <>
          <Hook sentence={sentence} setSentence={setSentence} onOpenModel={() => setOpen(true)} />
          {open && (
            <>
              <div className="lrn-rule">
                <span>Inside the model</span>
              </div>
              <Ladder sentence={sentence} />
            </>
          )}
        </>
      )}

      <DigPanel />
    </div>
  );
}
