/**
 * StageNarrator. The LLM attached to the animation, walked one step at a time.
 *
 * Sits under the stage visual. Press "Narrate this step" and it explains what
 * is on screen using the actual numbers the symbolic core just produced for the
 * current input. The real Q, K and V for this run, not a description of Q, K
 * and V in general.
 *
 * The division of labour is strict and worth stating plainly, because "let the
 * LLM show you how attention works" is exactly the shape of demo that quietly
 * hallucinates a matrix:
 *
 *   /src/model  computes.  Deterministic TypeScript, unit-tested, the only
 *               thing allowed to produce a number.
 *   the LLM     narrates.  It receives those numbers as verified text and is
 *               instructed not to derive, round or extend them.
 *
 * So "run it step by step" means the *walk* is driven by the lesson, and the
 * model is a commentator that arrives at each stop after the fact. Without a
 * key the walk still works. You just read the authored prose instead.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FORWARD_PASS, getNode, walkStep } from '../content';
import { useStore } from '../store';
import { buildGrounding } from './grounding';
import { createAdapter } from './providers';
import { stageGrounding } from './stageGrounding';
import './StageNarrator.css';

/** What we ask on the learner's behalf at each stop. */
const STEP_QUESTION =
  'Explain what is happening at this stage, using the live numbers above as your example. ' +
  'Point at specific values and say what they mean. Do not restate the lesson text verbatim, ' +
  'walk me through what these particular numbers show.';

export function StageNarrator({ nodeId }: { nodeId: string }) {
  const aiProvider = useStore((s) => s.aiProvider);
  const aiKey = useStore((s) => s.aiKey);
  const aiModel = useStore((s) => s.aiModel);
  const aiReasoning = useStore((s) => s.aiReasoning);
  const openAISettings = useStore((s) => s.openAISettings);
  const runInput = useStore((s) => s.runInput);
  const focusNode = useStore((s) => s.focusNode);

  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const adapter = useMemo(
    () => createAdapter({ provider: aiProvider, apiKey: aiKey, model: aiModel, reasoning: aiReasoning }),
    [aiProvider, aiKey, aiModel, aiReasoning],
  );

  const node = getNode(nodeId);
  const step = FORWARD_PASS.indexOf(nodeId);
  const next = walkStep(nodeId, 1);

  /**
   * A narration is about one stage on one input. Changing either makes the
   * text on screen describe numbers that are no longer there, which is worse
   * than showing nothing, so it is dropped, and any request in flight with it.
   */
  useEffect(() => {
    abortRef.current?.abort();
    setText(null);
    setError(null);
    setBusy(false);
  }, [nodeId, runInput]);

  // Nothing in flight should outlive the component.
  useEffect(() => () => abortRef.current?.abort(), []);

  const narrate = async () => {
    if (!node || busy) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setBusy(true);
    setError(null);
    try {
      const live = stageGrounding(nodeId, runInput);
      const result = await adapter.ask({
        // Authored content first, live trace second. Both are verified; the
        // trace is what makes the answer about *this* run rather than about
        // attention in the abstract.
        grounding: live ? `${buildGrounding(node)}\n\n${live}` : buildGrounding(node),
        question: STEP_QUESTION,
        signal: ctrl.signal,
      });
      setText(result.text);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!node || step < 0) return null;

  if (!adapter.available) {
    return (
      <div className="sn sn-off">
        <p className="sn-off-t">Want this narrated with the numbers on screen?</p>
        <p className="sn-off-d">
          Connect an API key and you can walk the pass step by step, with each stage explained using
          this run's actual values. The real Q, K and V for <code>{runInput}</code>, not a generic
          description. The numbers stay computed on this page; the model only reads them out.
        </p>
        <button className="sn-btn" onClick={openAISettings}>
          Connect an LLM
        </button>
      </div>
    );
  }

  return (
    <div className="sn">
      <div className="sn-head">
        <span className="sn-step">
          Step {step + 1} of {FORWARD_PASS.length} · {node.title}
        </span>
        <button className="sn-btn" onClick={narrate} disabled={busy}>
          {busy ? 'Reading the numbers…' : text ? 'Again' : 'Narrate this step'}
        </button>
      </div>

      {text && (
        <div className="sn-body" aria-live="polite">
          {text.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {error && (
        <p className="sn-error" role="alert">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}

      {text && next && (
        <button className="sn-next" onClick={() => focusNode(next.id)}>
          Next step: {next.title} <span aria-hidden="true">›</span>
        </button>
      )}

      <p className="sn-note">
        The numbers came from this page's own code. The model was given them as fact and told not to
        compute. If its words disagree with the values above, the values are right.
      </p>
    </div>
  );
}
