/**
 * Notebook. The linear walkthrough (CLAUDE.md §7.1, §7.3).
 *
 * One Cell per node, read in forward-pass order. The Run control sits at the top
 * and stays put, because it governs every number below it.
 */

import { useEffect, useRef } from 'react';
import {
  childrenOf,
  getNode,
  isOnForwardPass,
  pathTo,
  siblingsOf,
  walkStep,
} from '../content';
import { Checkpoint } from '../engine/Checkpoint';
import { Dossier } from '../engine/Dossier';
import { RunControl } from '../engine/RunControl';
import { universeShown, useStore } from '../store';
import { LevelToggle } from '../ui/LevelToggle';
import { PipelineStrip } from '../ui/PipelineStrip';
import { ProgressRail } from '../ui/ProgressRail';
import './Notebook.css';

export function Notebook() {
  const focusNodeId = useStore((s) => s.focusNodeId);
  const focusNode = useStore((s) => s.focusNode);
  const setView = useStore((s) => s.setView);
  const collapseAll = useStore((s) => s.collapseAll);
  const graphic = useStore((s) => s.graphic);
  const setGraphic = useStore((s) => s.setGraphic);
  const scrollRef = useRef<HTMLDivElement>(null);

  const node = getNode(focusNodeId);

  /**
   * Prev/Next follows the PIPELINE when this node is on it, and falls back to
   * siblings otherwise.
   *
   * This matters: the forward pass crosses containment boundaries, Attention
   * sits two levels inside a Transformer Layer but comes straight after
   * Embedding in the order things happen. Walking siblings there sends the
   * learner sideways into Unembedding instead of forward into Attention, which
   * is a dead end dressed as progress.
   */
  const onSpine = isOnForwardPass(focusNodeId);
  const sibs = siblingsOf(focusNodeId);
  const i = sibs.findIndex((n) => n.id === focusNodeId);
  const prev = onSpine ? walkStep(focusNodeId, -1) : i > 0 ? sibs[i - 1] : undefined;
  const next = onSpine
    ? walkStep(focusNodeId, 1)
    : i >= 0 && i < sibs.length - 1
      ? sibs[i + 1]
      : undefined;

  const crumbs = pathTo(focusNodeId);
  const kids = childrenOf(focusNodeId);

  // A new cell starts at the top, collapsed, the calm surface is the default
  // state every time, not just on first load.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [focusNodeId]);

  // Esc collapses this node's open layers (§7.7).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') collapseAll(focusNodeId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapseAll, focusNodeId]);

  if (!node) return <div className="nb-missing">No such node.</div>;

  return (
    <div className="nb" ref={scrollRef}>
      <div className="nb-inner">
        <div className="nb-top">
          <button
            className={`nb-onmap${universeShown(graphic, focusNodeId) ? ' on' : ''}`}
            onClick={() => {
              setGraphic(universeShown(graphic, focusNodeId) ? 'structure' : 'universe');
              setView('map');
            }}
          >
            {/* Reads from what is actually drawn, not from the flag, because
                at the root the flag is inverted and a label built on the flag
                alone said "show on map" while the map was already showing. */}
            <span aria-hidden="true">◉</span>{' '}
            {universeShown(graphic, focusNodeId) ? 'show the structure' : 'show on map'}
          </button>
          <ProgressRail />
        </div>

        <LevelToggle />

        {/* The flow, always on screen. This is the thing a rail of dots could
            never carry: the named stages, the order, and where you are in it. */}
        <PipelineStrip />

        <nav className="nb-crumbs" aria-label="Where you are">
          {crumbs.map((c, ci) => (
            <span key={c.id}>
              {ci > 0 && <span className="nb-sep" aria-hidden="true">›</span>}
              <button
                className={`nb-crumb${c.id === focusNodeId ? ' here' : ''}`}
                onClick={() => focusNode(c.id)}
                aria-current={c.id === focusNodeId ? 'page' : undefined}
              >
                {c.title}
              </button>
            </span>
          ))}
        </nav>

        {/* The Run box only belongs where the input actually computes
            something. On Deploy prep or Feast, `C B A B B C` produces nothing
. Showing the control there implies a relationship that does not
            exist, and asks the reader to work out why nothing happens. */}
        {node.L1?.example && <RunControl />}

        <Dossier node={node} />

        {/* Retrieval practice, after the study. Alternating the two beats
            either alone (Roediger & Karpicke). Never a gate. */}
        {node.checkpoint && <Checkpoint spec={node.checkpoint} nodeId={node.id} />}

        {kids.length > 0 && (
          <section className="nb-inside" aria-label={`Inside ${node.title}`}>
            <h3 className="nb-inside-h">Inside {node.title}</h3>
            <div className="nb-inside-list">
              {kids.map((k) => (
                <button
                  key={k.id}
                  className="nb-inside-item"
                  data-node-id={k.id}
                  onClick={() => focusNode(k.id)}
                >
                  <span className="nb-inside-dot" style={{ background: `var(--${k.color})` }} />
                  <span className="nb-inside-body">
                    <span className="nb-inside-t">
                      {k.title}
                      {k.status === 'stub' && <em className="nb-inside-stub">outline</em>}
                    </span>
                    <span className="nb-inside-d">{k.L0_oneLiner}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <nav className="nb-nav" aria-label="Move through the track">
          <button
            className="nb-step"
            disabled={!prev}
            onClick={() => prev && focusNode(prev.id)}
          >
            <span className="nb-dir">‹ Prev</span>
            <span className="nb-name">{prev?.title ?? ''}</span>
          </button>
          <button
            className="nb-step right"
            disabled={!next}
            onClick={() => next && focusNode(next.id)}
          >
            <span className="nb-dir">Next ›</span>
            <span className="nb-name">{next?.title ?? ''}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
