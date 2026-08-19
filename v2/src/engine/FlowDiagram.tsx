/**
 * FlowDiagram. What a stage is made of, and which way things move through it.
 *
 * This is the piece the first build was missing. A node like "Agent layer" or
 * "AIBrix" is not a fact, it is a *structure*: several parts wired together in
 * an order. A one-line description of a structure is nearly useless, which is
 * why expanding those nodes felt empty no matter how good the sentence was.
 *
 * Rendered as nested boxes and arrows in plain HTML:
 *   - it reflows on a narrow screen instead of overflowing
 *   - the text is selectable and searchable
 *   - a screen reader reads it as an ordered list of steps and their parts,
 *     with no parallel description to maintain
 * An SVG with hand-placed coordinates gives up all three.
 */

import type { FlowKind, FlowNode, FlowSpec } from '../content/schema';
import './FlowDiagram.css';

const KIND_LABEL: Record<FlowKind, string> = {
  input: 'in',
  stage: 'step',
  store: 'holds state',
  control: 'decides',
  output: 'out',
};

function Part({ node }: { node: FlowNode }) {
  return (
    <li className={`fd-part k-${node.kind ?? 'stage'}`}>
      <span className="fd-part-l">{node.label}</span>
      {node.sub && <span className="fd-part-s">{node.sub}</span>}
    </li>
  );
}

function Step({ node, index }: { node: FlowNode; index: number }) {
  const kind = node.kind ?? 'stage';
  return (
    <li className={`fd-step k-${kind}`}>
      <div className="fd-box">
        <span className="fd-kind" aria-hidden="true">
          {KIND_LABEL[kind]}
        </span>
        <span className="fd-num" aria-hidden="true">
          {index + 1}
        </span>
        <span className="fd-label">{node.label}</span>
        {node.sub && <span className="fd-sub">{node.sub}</span>}

        {node.parts && node.parts.length > 0 && (
          <>
            <span className="fd-parts-l">contains</span>
            <ul className="fd-parts">
              {node.parts.map((p) => (
                <Part key={p.id} node={p} />
              ))}
            </ul>
          </>
        )}
      </div>
    </li>
  );
}

export function FlowDiagram({ spec }: { spec: FlowSpec }) {
  return (
    <figure className="fd">
      <figcaption className="fd-caption">{spec.caption}</figcaption>

      <div className="fd-scroll">
        <ol className="fd-chain">
          {spec.steps.map((s, i) => (
            <Step key={s.id} node={s} index={i} />
          ))}
        </ol>
      </div>

      {spec.loop && (
        <p className="fd-loop">
          <span aria-hidden="true">↩ </span>
          {spec.loop}
        </p>
      )}

      {spec.note && <p className="fd-note">{spec.note}</p>}
    </figure>
  );
}
