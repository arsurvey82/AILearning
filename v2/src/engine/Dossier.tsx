/**
 * Dossier. The generic node renderer (CLAUDE.md §4, §7.3).
 *
 * Content-agnostic: it renders whatever ConceptNode it is handed. Adding a node
 * means adding a data file, never touching this component. That is the whole
 * point of the §5 schema.
 *
 * Layer order is deliberate and matches design-spec §11: L0 always visible, then
 * "show me", "common snags", "at scale", "under the hood". Snags sit second
 * because a confused learner needs their question answered before they will care
 * about scale or matrix shapes.
 */

import { useMemo } from 'react';
import { AskBox } from '../ai/AskBox';
import type { ConceptNode, NodeId } from '../content/schema';
import { getNode } from '../content';
import { ORIGINS } from '../content';
import { OriginOf } from '../glossary/Dig';
import { SORT_ACCURACY, WEIGHTS_ARE_ILLUSTRATIVE } from '../model/toyModel';
import { useStore, type Layer } from '../store';
import { AttentionArcs } from './AttentionArcs';
import { FlowDiagram } from './FlowDiagram';
import { LayerExpander } from './LayerExpander';
import { Markdown, inline } from './markdown';
import { NumberGrid } from './NumberGrid';
import { SnagList } from './SnagCard';
import './Dossier.css';

function LinkChips({ ids, kind }: { ids: NodeId[]; kind: 'needs' | 'unlocks' }) {
  const focusNode = useStore((s) => s.focusNode);
  if (ids.length === 0) {
    return <span className="dz-none">{kind === 'needs' ? 'nothing, start here' : 'end of the built path'}</span>;
  }
  return (
    <>
      {ids.map((id) => {
        const n = getNode(id);
        return (
          <button
            key={id}
            className={`dz-chip ${kind}`}
            onClick={() => focusNode(id, 'notebook')}
            title={n ? n.L0_oneLiner : id}
          >
            {n?.title ?? id}
            {n?.status === 'stub' && <span className="dz-stubdot" aria-label="(stub)" />}
          </button>
        );
      })}
    </>
  );
}

export function Dossier({ node }: { node: ConceptNode }) {
  const runInput = useStore((s) => s.runInput);
  const runNonce = useStore((s) => s.runNonce);
  const level = useStore((s) => s.level);
  const queryToken = useStore((s) => s.queryToken);
  const setQueryToken = useStore((s) => s.setQueryToken);
  const isLayerOpen = useStore((s) => s.isLayerOpen);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const openLayers = useStore((s) => s.openLayers);

  // Recomputed from the symbolic core whenever the Run input changes.
  const block = useMemo(
    // Undefined for the many nodes that have structure but no arithmetic.
    () => node.L1?.example?.compute(runInput),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id, runInput],
  );

  const open = (l: Layer) => isLayerOpen(node.id, l);
  const toggle = (l: Layer) => () => toggleLayer(node.id, l);
  void openLayers; // subscribe to layer changes

  return (
    <article className="dz" aria-labelledby={`${node.id}-title`}>
      <header className="dz-head">
        <span className={`dz-tag c-${node.color}`}>{node.tag}</span>
        {node.status === 'stub' && (
          <span className="dz-stub">
            stub. No worked example or snags yet, on purpose
          </span>
        )}
        <h2 className="dz-title" id={`${node.id}-title`}>
          {node.title}
        </h2>
      </header>

      {/* L0, always visible. One idea, no wall. */}
      <p className="dz-oneliner">{inline(node.L0_oneLiner)}</p>
      {/* Analogies are earned by watching someone not understand the plain
          version, so most nodes legitimately have none yet.
          Hidden in practised mode: for a learner who already holds the schema
          an analogy is redundant guidance, and the expertise reversal
          literature finds redundant guidance actively lowers learning gains
          rather than being merely wasted. */}
      {/* Why this exists at all.

          Sits with the opening framing rather than under the worked example,
          because "why is there a normalisation step" is a question a reader has
          before they care what it computes. Not every node has one: a vector is
          an object, not somebody's fix for something. */}
      {ORIGINS[node.id] && (
        <div className="dz-origin">
          <OriginOf origin={ORIGINS[node.id]!} />
        </div>
      )}

      {node.L0_analogy && level === 'learning' && (
        <p className="dz-analogy">
          <span className="dz-analogy-k">Like this:</span> {inline(node.L0_analogy)}
        </p>
      )}

      <div className="dz-layers">
        {node.L1 && (
          <LayerExpander
            id={`${node.id}-l1`}
            label="Show me"
            hint={block ? 'the actual numbers' : 'how it fits together'}
            open={open('L1')}
            onToggle={toggle('L1')}
          >
            <ol className="dz-steps">
              {node.L1.prose.map((p, i) => (
                <li key={i}>{inline(p)}</li>
              ))}
            </ol>

            {/* Structure first, then numbers. For most concepts the structure
                IS the content. There is nothing to compute about AIBrix. */}
            {node.L1.flow && <FlowDiagram spec={node.L1.flow} />}

            {/* A purpose-built visual, where one concept earns one. */}
            {node.L1.visual === 'attention-arcs' && <AttentionArcs />}

            {block &&
              (node.L1.visual === 'attention-arcs' ? (
                // Controlled: the arcs above and this grid are two views of one
                // selection, so they move together.
                <NumberGrid
                  block={block}
                  pulseKey={runNonce}
                  selected={Math.min(queryToken, Math.max(block.groups.length - 1, 0))}
                  onSelect={setQueryToken}
                />
              ) : (
                <NumberGrid block={block} pulseKey={runNonce} />
              ))}

            {/* This used to be a caveat saying the weights were illustrative.
                Now that they are trained, the honest note is the opposite one,
                and it is worth stating rather than leaving blank: a reader has
                no way to tell a trained number from a random one by looking. */}
            {block &&
              (WEIGHTS_ARE_ILLUSTRATIVE ? (
                <p className="dz-caveat">
                  The arithmetic is genuinely computed, but the starting weights are seeded and{' '}
                  <strong>illustrative</strong>, so this toy does not really sort.
                </p>
              ) : (
                <p className="dz-caveat trained">
                  These are <strong>trained</strong> nanoGPT weights, not random ones. This model
                  really does sort, correctly on {Math.round(SORT_ACCURACY * 100)}% of inputs it
                  never saw, which is why the numbers above have structure in them rather than
                  sitting near an even split.
                </p>
              ))}
          </LayerExpander>
        )}

        <LayerExpander
          id={`${node.id}-l2`}
          label="Common snags"
          // The distinction is load-bearing. Cards harvested from watching a
          // real beginner trip have authority that anticipated ones do not, and
          // labelling both the same way would quietly spend that authority.
          hint={
            node.snagsPlaytested
              ? 'questions real beginners asked here'
              : 'questions this usually raises'
          }
          count={node.L2_snags.length > 0 ? `${node.L2_snags.length}` : undefined}
          open={open('L2')}
          onToggle={toggle('L2')}
        >
          <SnagList snags={node.L2_snags} idPrefix={node.id} />
        </LayerExpander>

        <LayerExpander
          id={`${node.id}-l3`}
          label="At scale"
          hint="what a real model does"
          open={open('L3')}
          onToggle={toggle('L3')}
        >
          {node.L3_atScale.length === 0 ? (
            <p className="dz-empty">Not written yet.</p>
          ) : (
            <div className="dz-scroll">
              <table className="dz-scale">
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">Here</th>
                    <th scope="col">GPT-2</th>
                    <th scope="col">Llama-3</th>
                  </tr>
                </thead>
                <tbody>
                  {node.L3_atScale.map((s) => (
                    <tr key={s.label}>
                      <th scope="row">{s.label}</th>
                      <td className="tabular">{s.here}</td>
                      <td className="tabular">{s.gpt2 ?? ', '}</td>
                      <td className="tabular">{s.llama ?? ', '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {node.L3_atScale
            .filter((s) => s.note || s.source)
            .map((s) => (
              <p className="dz-scalenote" key={s.label}>
                <strong>{s.label}:</strong> {inline(s.note ?? '')}{' '}
                {/* An uncited figure is one nobody has checked. Saying so is
                    the point. Design-spec §8 asks for a verification pass,
                    and a pass you cannot see is not one you can trust. */}
                {s.source ? (
                  <a
                    className="dz-cite"
                    href={s.source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={s.source.url}
                  >
                    verified · {s.source.label}
                  </a>
                ) : (
                  <span className="dz-uncited">not yet verified against a source</span>
                )}
              </p>
            ))}
        </LayerExpander>

        <LayerExpander
          id={`${node.id}-l4`}
          label="Under the hood"
          hint="the real math and code"
          open={open('L4')}
          onToggle={toggle('L4')}
        >
          {node.L4_underHood ? (
            <Markdown source={node.L4_underHood} />
          ) : (
            <p className="dz-empty">Not written yet.</p>
          )}
        </LayerExpander>
      </div>

      {/* Layer B sits AFTER the authored snags on purpose: the playtested cards
          answer what we already know people ask; this catches the tail. */}
      <AskBox node={node} block={block} />

      {/* No dead ends (§7.3). Always visible, always clickable. */}
      <footer className="dz-foot">
        <div className="dz-footrow">
          <span className="dz-footk">Needs</span>
          <div className="dz-chips">
            <LinkChips ids={node.prereqs} kind="needs" />
          </div>
        </div>
        <div className="dz-footrow">
          <span className="dz-footk">Unlocks</span>
          <div className="dz-chips">
            <LinkChips ids={node.leadsTo} kind="unlocks" />
          </div>
        </div>
      </footer>
    </article>
  );
}
