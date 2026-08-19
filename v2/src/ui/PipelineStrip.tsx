/**
 * PipelineStrip, the flow, always on screen.
 *
 * The missing bbycroft property was never the 3D. It was that the *whole
 * process* stays visible while you read about one part of it, so a paragraph
 * about attention never floats free of where attention sits in the journey.
 *
 * A progress rail of dots does not do this: dots show how far along you are,
 * not what the stages are or which way anything moves. This shows the named
 * stages with arrows between them, the current one lit, and everything before
 * it marked as already passed, so "too much information" becomes "this much
 * information, at this point in a flow I can see."
 *
 * Clicking a stage jumps there, which makes it navigation as well as
 * orientation.
 */

import { FORWARD_PASS, getNode, isOnForwardPass } from '../content';
import { useStore } from '../store';
import './PipelineStrip.css';

export function PipelineStrip() {
  const focusNodeId = useStore((s) => s.focusNodeId);
  const focusNode = useStore((s) => s.focusNode);
  const runInput = useStore((s) => s.runInput);
  const visited = useStore((s) => s.visited);

  const here = FORWARD_PASS.indexOf(focusNodeId);
  const onSpine = isOnForwardPass(focusNodeId);

  return (
    <nav className={`ps${onSpine ? '' : ' off'}`} aria-label="The forward pass">
      <div className="ps-head">
        <span className="ps-l">Forward pass</span>
        <span className="ps-in" title="The input flowing through every stage">
          {runInput}
        </span>
      </div>

      <ol className="ps-track">
        {FORWARD_PASS.map((id, i) => {
          const n = getNode(id);
          if (!n) return null;
          const state = i === here ? 'here' : here >= 0 && i < here ? 'done' : 'ahead';
          return (
            <li key={id} className={`ps-item ${state}`}>
              <button
                className="ps-btn"
                onClick={() => focusNode(id, 'notebook')}
                aria-current={i === here ? 'step' : undefined}
                title={n.L0_oneLiner}
              >
                {n.title}
              </button>
            </li>
          );
        })}
      </ol>

      {/* "Stepped off" is only true if you were ever on. At the root it is the
          first thing a new reader is told, and it reads as a reprimand for
          having done nothing yet. */}
      {!onSpine && (
        <p className="ps-aside">
          {visited.size <= 1
            ? 'This is the path one input takes through the model. Pick any stage to jump in.'
            : 'You have stepped off the pipeline. Pick a stage above to rejoin it.'}
        </p>
      )}
    </nav>
  );
}
