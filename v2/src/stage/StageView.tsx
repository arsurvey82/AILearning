/**
 * StageView, the graphic you learn *from*.
 *
 * The map answers "where am I". It does not answer "what is happening to my
 * data right now", and that second question is the one bbycroft's visual
 * actually serves: a persistent picture of the tensors, with the active one
 * lit, that changes as you move through the pipeline.
 *
 * So on a forward-pass stage this replaces the map: the same input rendered as
 * whatever that stage turns it into, at a size you can read, with transport
 * controls. Off the pipeline there is no data flowing, and the map comes back.
 *
 * Interaction is deliberately two-way:
 *   - stepping in the notebook moves this
 *   - stepping here moves the notebook
 *   - clicking a token here selects it in the grid below
 * One `focusNodeId`, one `queryToken`, one `runInput`, no view can disagree
 * with another because there is only one copy of the state.
 *
 * On autoplay: Mayer's segmenting principle is clear that learner-paced beats
 * system-paced, so it is PAUSED by default and stepping is the primary control.
 * Play exists because watching it run once is a good way to see the shape of
 * the whole thing, but it is opt-in, and any manual step stops it.
 */

import { Fragment, useEffect } from 'react';
import { StageNarrator } from '../ai/StageNarrator';
import { FORWARD_PASS, getNode, isOnForwardPass } from '../content';
import { attention } from '../model/attention';
import { parseInput, tokenize } from '../model/embedding';
import { FFN_DIM, forward } from '../model/forward';
import { C_DIM, VOCAB } from '../model/toyModel';
import { ModelScene } from '../scene/ModelScene';
import { useStore } from '../store';
import './StageView.css';

/** Diverging scale: negative cool, positive warm, zero near-invisible. */
function cellColor(v: number): string {
  const m = Math.max(-1, Math.min(1, v / 0.8));
  return m >= 0
    ? `color-mix(in srgb, var(--orange) ${Math.round(m * 88)}%, transparent)`
    : `color-mix(in srgb, var(--blue) ${Math.round(-m * 88)}%, transparent)`;
}

/** How many of the 48 rows to draw. Enough to read as a tensor, not a wall. */
const ROWS = 16;

export function StageView() {
  const focusNodeId = useStore((s) => s.focusNodeId);
  const focusNode = useStore((s) => s.focusNode);
  const runInput = useStore((s) => s.runInput);
  const queryToken = useStore((s) => s.queryToken);
  const setQueryToken = useStore((s) => s.setQueryToken);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);

  const i = FORWARD_PASS.indexOf(focusNodeId);
  const node = getNode(focusNodeId);
  const parsed = parseInput(runInput);
  const letters = parsed.letters;
  const ids = tokenize(letters);

  // Autoplay walks the pipeline, then stops at the end rather than looping , 
  // a loop invites watching instead of reading.
  useEffect(() => {
    if (!playing) return;
    if (i < 0 || i >= FORWARD_PASS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => {
      const next = FORWARD_PASS[i + 1];
      if (next) focusNode(next, 'notebook');
    }, 2600);
    return () => clearTimeout(t);
  }, [playing, i, focusNode, setPlaying]);

  const step = (d: -1 | 1) => {
    setPlaying(false);
    const next = FORWARD_PASS[i + d];
    if (next) focusNode(next, 'notebook');
  };

  return (
    <section className="sv" aria-label={`Stage: ${node?.title ?? ''}`}>
      <header className="sv-head">
        <span className="sv-step">
          Stage {i + 1} of {FORWARD_PASS.length}
        </span>
        <h2 className="sv-title">{node?.title}</h2>
        <p className="sv-sub">{node?.tag}</p>
      </header>

      {/* The persistent scene. It is the same scene on every one of the twelve
          stages, only the camera moves. That continuity is the thing a reader
          said was missing: with a slideshow every step costs a silent "where
          did the last thing go?", and here the answer is that it is still
          there, just above you. */}
      <ModelScene height={300} />

      <div className="sv-body">
        <StageBody id={focusNodeId} letters={letters} ids={ids} input={runInput} />
      </div>

      {/* Transport. Step is primary; play is opt-in and stops on any step. */}
      <div className="sv-transport">
        <button className="sv-btn" onClick={() => step(-1)} disabled={i <= 0} aria-label="Previous stage">
          ◀
        </button>
        <button
          className={`sv-play${playing ? ' on' : ''}`}
          onClick={() => setPlaying(!playing)}
          disabled={i >= FORWARD_PASS.length - 1}
        >
          {playing ? '❚❚ Pause' : '▶ Play through'}
        </button>
        <button
          className="sv-btn"
          onClick={() => step(1)}
          disabled={i >= FORWARD_PASS.length - 1}
          aria-label="Next stage"
        >
          ▶
        </button>

        <ol className="sv-ticks" aria-hidden="true">
          {FORWARD_PASS.map((id, k) => (
            <li key={id}>
              <button
                className={`sv-tick${k === i ? ' here' : k < i ? ' done' : ''}`}
                onClick={() => {
                  setPlaying(false);
                  focusNode(id, 'notebook');
                }}
                title={getNode(id)?.title}
              />
            </li>
          ))}
        </ol>
      </div>

      {letters.length > 0 && (
        <div className="sv-tokens">
          <span className="sv-l">Input</span>
          {letters.map((l, k) => (
            <button
              key={k}
              className={`sv-tok${k === queryToken ? ' on' : ''}`}
              onClick={() => setQueryToken(k)}
              title={`${l} at seat ${k}`}
            >
              {l}
              <sub>{k}</sub>
            </button>
          ))}
        </div>
      )}

      {/* The optional LLM, attached to what is on screen. It arrives after the
          visual and the transport on purpose: the walk is the lesson, and the
          narration is commentary on a step you have already been shown. */}
      <StageNarrator nodeId={focusNodeId} />
    </section>
  );
}

/* ------------------------------------------------------------------ */

function StageBody({
  id,
  letters,
  ids,
  input,
}: {
  id: string;
  letters: string[];
  ids: number[];
  input: string;
}) {
  const queryToken = useStore((s) => s.queryToken);

  if (letters.length === 0) {
    return <p className="sv-empty">Type letters into Run to see them flow.</p>;
  }

  if (id === 'tokenization') {
    return (
      <div className="sv-lane">
        <Lane label="text" cells={letters.map((l) => ({ key: l, text: l }))} kind="text" />
        <Arrow note="cut into pieces the vocabulary knows" />
        <Lane
          label="pieces"
          cells={letters.map((l, k) => ({ key: `${l}${k}`, text: l }))}
          kind="piece"
        />
      </div>
    );
  }

  if (id === 'token-id') {
    return (
      <div className="sv-lane">
        <Lane label="pieces" cells={letters.map((l, k) => ({ key: `p${k}`, text: l }))} kind="piece" />
        <Arrow note="look up each piece's slot in the vocabulary" />
        <Lane label="IDs" cells={ids.map((d, k) => ({ key: `i${k}`, text: String(d) }))} kind="id" />
      </div>
    );
  }

  const f = forward(input);
  const q = Math.min(queryToken, letters.length - 1);

  /* ---- attention: the canonical T×T picture ---- */
  if (id === 'attention') {
    const w = attention(input).heads[0]?.weights ?? [];
    return (
      <div className="sv-tensor-wrap">
        <p className="sv-cap">
          Who listens to whom. Row = the token looking, column = the token looked at.
          <span className="sv-dims"> Blank cells are masked, it may not look ahead.</span>
        </p>
        <div
          className="sv-grid"
          style={{ '--n': letters.length } as React.CSSProperties}
          role="img"
          aria-label="Attention weight matrix"
        >
          <span />
          {letters.map((l, k) => (
            <span className="sv-gh" key={`h${k}`}>
              {l}
              <sub>{k}</sub>
            </span>
          ))}
          {w.map((row, r) => (
            <Fragment key={r}>
              <span className={`sv-gh${r === q ? ' on' : ''}`}>
                {letters[r]}
                <sub>{r}</sub>
              </span>
              {row.map((v, c) => (
                <span
                  key={c}
                  className={`sv-gcell${c > r ? ' masked' : ''}${r === q ? ' inrow' : ''}`}
                  style={c <= r ? { background: heat(v) } : undefined}
                  title={c > r ? 'masked' : `${Math.round(v * 100)}%`}
                >
                  {/* Every unmasked cell shows its number.

                      This used to hide anything below 18%, which was a
                      reasonable call when the weights were random: every cell
                      sat near 1/6 and printing them all was noise. Trained
                      weights inverted that. A row reading 3, 35, 5, 30, 26, 1
                      says the model is ignoring three of the six tokens, and
                      the small numbers are exactly where that shows. The
                      threshold was hiding the structure the training bought. */}
                  {c <= r ? Math.round(v * 100) : ''}
                </span>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  /* ---- feed-forward: the expansion is the whole shape ---- */
  if (id === 'mlp') {
    const t = f.mlp[q];
    return (
      <div className="sv-lane">
        <p className="sv-cap">
          One token, thinking alone. Wide in the middle is where the capacity is.
        </p>
        <div className="sv-widths">
          <Strip values={f.normed[q] ?? []} label={`in · ${C_DIM}`} />
          <span className="sv-x">→</span>
          <Strip values={t?.hidden ?? []} label={`up · ${FFN_DIM}`} wide />
          <span className="sv-x">→</span>
          <Strip values={t?.activated ?? []} label="curve" wide />
          <span className="sv-x">→</span>
          <Strip values={t?.out ?? []} label={`down · ${C_DIM}`} />
        </div>
      </div>
    );
  }

  /* ---- residual: add, never replace ---- */
  if (id === 'residual') {
    return (
      <div className="sv-lane">
        <p className="sv-cap">The block adds to the stream. Nothing is thrown away.</p>
        <div className="sv-widths">
          <Strip values={f.stream[q] ?? []} label="stream in" />
          <span className="sv-x">+</span>
          <Strip values={f.attnOut[q] ?? []} label="what the block found" />
          <span className="sv-x">=</span>
          <Strip values={f.afterAttn[q] ?? []} label="stream out" />
        </div>
      </div>
    );
  }

  /* ---- normalisation ---- */
  if (id === 'normalization') {
    return (
      <div className="sv-lane">
        <p className="sv-cap">
          Same direction, brought to a usable size, so a deep stack neither explodes nor fades.
        </p>
        <div className="sv-widths">
          <Strip values={f.afterAttn[q] ?? []} label="before" />
          <span className="sv-x">→</span>
          <Strip values={f.normed[q] ?? []} label="after LayerNorm" />
        </div>
      </div>
    );
  }

  /* ---- readout ---- */
  if (id === 'unembedding' || id === 'logits') {
    return (
      <div className="sv-lane">
        <p className="sv-cap">
          Only the <strong>last</strong> token predicts. Its vector is compared against every
          vocabulary entry.
        </p>
        <div className="sv-widths">
          <Strip values={f.finalNorm[letters.length - 1] ?? []} label="last vector" />
          <span className="sv-x">→</span>
          <Bars values={f.logits} labels={VOCAB as readonly string[]} kind="logit" />
        </div>
      </div>
    );
  }

  if (id === 'softmax' || id === 'sampling' || id === 'the-loop') {
    const pick = f.probs.indexOf(Math.max(...f.probs));
    return (
      <div className="sv-lane">
        <p className="sv-cap">
          {id === 'the-loop'
            ? 'One token chosen, appended, and the whole pass runs again.'
            : 'Raw scores become percentages that add up to 1.'}
        </p>
        <div className="sv-widths">
          <Bars values={f.logits} labels={VOCAB as readonly string[]} kind="logit" />
          <span className="sv-x">→</span>
          <Bars
            values={f.probs}
            labels={VOCAB as readonly string[]}
            kind="prob"
            highlight={id === 'softmax' ? undefined : pick}
          />
        </div>
        {id === 'the-loop' && f.predicted && (
          <p className="sv-loopline">
            <span className="sv-seq">
              {letters.join(' ')} <em>{f.predicted}</em>
            </span>
            <span className="sv-loopnote">↩ now run the whole thing again on that</span>
          </p>
        )}
      </div>
    );
  }

  /* ---- default: the stream as a tensor ---- */
  return (
    <div className="sv-tensor-wrap">
      <p className="sv-cap">
        Each column is one token, as numbers
        <span className="sv-dims">
          {' '}
, showing {ROWS} of {C_DIM} rows
        </span>
      </p>
      <div className="sv-tensor" role="img" aria-label={`Tensor: ${letters.length} columns`}>
        {f.stream.map((col, k) => (
          <div className={`sv-col${k === queryToken ? ' on' : ''}`} key={k}>
            {col.slice(0, ROWS).map((v, r) => (
              <span key={r} className="sv-cell" style={{ background: cellColor(v) }} title={String(v)} />
            ))}
            <span className="sv-collabel">
              {letters[k]}
              <sub>{k}</sub>
            </span>
          </div>
        ))}
      </div>
      <p className="sv-key" aria-hidden="true">
        <span className="sv-swatch neg" /> negative
        <span className="sv-swatch zero" /> ~zero
        <span className="sv-swatch pos" /> positive
      </p>
    </div>
  );
}

/** Attention weight → warmth. Weights are 0..1, never negative. */
function heat(v: number): string {
  return `color-mix(in srgb, var(--magenta) ${Math.round(Math.min(1, v * 1.15) * 90)}%, transparent)`;
}

/** A vector drawn as a vertical strip, width shows the shape change. */
function Strip({ values, label, wide }: { values: number[]; label: string; wide?: boolean }) {
  const n = wide ? 32 : 16;
  const step = Math.max(1, Math.floor(values.length / n));
  const cells = values.filter((_, i) => i % step === 0).slice(0, n);
  return (
    <div className={`sv-strip${wide ? ' wide' : ''}`}>
      <div className="sv-stripcells">
        {cells.map((v, i) => (
          <span key={i} className="sv-cell" style={{ background: cellColor(v) }} title={String(v)} />
        ))}
      </div>
      <span className="sv-striplabel">{label}</span>
    </div>
  );
}

/** Horizontal bars for the vocabulary-sized things at the end of the pass. */
function Bars({
  values,
  labels,
  kind,
  highlight,
}: {
  values: number[];
  labels: readonly string[];
  kind: 'logit' | 'prob';
  highlight?: number;
}) {
  const max = Math.max(...values.map(Math.abs), 0.0001);
  return (
    <div className="sv-bars">
      {values.map((v, i) => (
        <div className={`sv-bar${highlight === i ? ' pick' : ''}`} key={i}>
          <span className="sv-barlabel">{labels[i]}</span>
          <span className="sv-bartrack">
            {/* A tiny-but-nonzero value must still draw something. At 0% the
                bar disappears entirely, which reads as "no value" rather than
                "very small", a different and wrong claim. */}
            <span
              className={`sv-barfill k-${kind}`}
              style={{ width: v === 0 ? 0 : `max(3px, ${(Math.abs(v) / max) * 100}%)` }}
            />
          </span>
          <span className="sv-barval">
            {kind === 'prob' ? `${Math.round(v * 100)}%` : v.toFixed(2)}
          </span>
        </div>
      ))}
      <span className="sv-striplabel">{kind === 'prob' ? 'probabilities' : 'raw logits'}</span>
    </div>
  );
}

function Lane({
  label,
  cells,
  kind,
}: {
  label: string;
  cells: { key: string; text: string }[];
  kind: string;
}) {
  return (
    <div className="sv-row">
      <span className="sv-l">{label}</span>
      <div className="sv-cells">
        {cells.map((c) => (
          <span key={c.key} className={`sv-box k-${kind}`}>
            {c.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function Arrow({ note }: { note: string }) {
  return (
    <p className="sv-arrow">
      <span aria-hidden="true">↓</span> {note}
    </p>
  );
}

/** True when the stage view has something to draw. */
export function hasStage(nodeId: string): boolean {
  return isOnForwardPass(nodeId);
}
