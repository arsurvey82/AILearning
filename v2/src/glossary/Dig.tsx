/**
 * Digging in, and being able to get back out.
 *
 * Every term inside any explanation is a door. The thing that stops that being
 * disorienting is the trail: the panel keeps the path you took, so however deep
 * you went you can see how you got there and step back one at a time. Depth is
 * not what makes a reader lost; losing the way back is.
 *
 * The panel deliberately does not close when you open a new term. Opening
 * "vector" from inside "embedding" pushes onto the stack rather than replacing
 * it, because the question you were originally answering has not gone away.
 *
 * Every panel also carries a hierarchy strip at the top, so no open ever
 * dead-ends. Parent, this, and children as chips, plus "needs first" for
 * prereqs and "unlocks next" for leadsTo. A reader without the key concept
 * always has somewhere to go.
 */

import { useEffect } from 'react';
import { useStore } from '../store';
import { LINK, type Origin } from './schema';
import { BY_ID } from './terms';
import { childrenOf, getNode } from '../content';
import type { ConceptNode, NodeId } from '../content/schema';
import './Dig.css';

/* ------------------------------------------------------------------ prose */

/**
 * Text with [[term]] markers turned into doors.
 *
 * Chips rather than underlined links: a link implies leaving the page, and this
 * never does. The reader should be able to tell at a glance how much of a
 * sentence is diggable before they commit to reading it.
 */
export function Prose({ text, className }: { text: string; className?: string }) {
  const dig = useStore((s) => s.digTo);
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const m of text.matchAll(LINK)) {
    const id = m[1]!;
    const at = m.index!;
    if (at > last) parts.push(text.slice(last, at));
    const t = BY_ID.get(id);
    parts.push(
      t ? (
        <button key={`${id}-${at}`} className="gl-chip" onClick={() => dig(id)} data-term={id}>
          {t.term.toLowerCase()}
        </button>
      ) : (
        // A missing term is a content bug, and tests fail on it. Showing the id
        // rather than silently dropping it means it cannot hide in review.
        <mark key={`${id}-${at}`} className="gl-broken">
          {id}
        </mark>
      ),
    );
    last = at + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p className={className}>{parts}</p>;
}

/* ---------------------------------------------------------- hierarchy strip */

/**
 * Descendants deep enough that a container child does not hide its own children.
 *
 * The transformer's direct children include `layer`, and a reader who has
 * never seen the word "layer" learns nothing from that chip alone. Walking one
 * level further exposes attention, mlp, residual and normalization: the parts
 * that make the container mean something. Capped at two levels to keep the
 * strip calm.
 */
function descendantChips(id: NodeId): ConceptNode[] {
  const seen = new Set<NodeId>();
  const out: ConceptNode[] = [];
  const push = (n: ConceptNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    out.push(n);
  };
  for (const kid of childrenOf(id)) {
    push(kid);
    for (const grand of childrenOf(kid.id)) push(grand);
  }
  return out;
}

/** Label a concept node or a glossary term, whichever exists at that id. */
function labelFor(id: string): string {
  return BY_ID.get(id)?.term ?? getNode(id)?.title ?? id;
}

/**
 * A chip that opens whatever exists at that id: a glossary term, a concept
 * node, or both. The panel handles either kind, so the click is safe.
 */
function HierChip({ id, tone }: { id: string; tone: 'up' | 'here' | 'kid' | 'need' | 'unlock' }) {
  const dig = useStore((s) => s.digTo);
  const label = labelFor(id).toLowerCase();
  const canOpen = BY_ID.has(id) || !!getNode(id);
  if (!canOpen) {
    return <span className={`gl-hier-chip gl-hier-${tone} gl-hier-flat`}>{label}</span>;
  }
  if (tone === 'here') {
    return <span className={`gl-hier-chip gl-hier-here`}>{label}</span>;
  }
  return (
    <button
      className={`gl-hier-chip gl-hier-${tone}`}
      onClick={() => dig(id)}
      data-testid={`hier-${tone}-${id}`}
      data-term={id}
    >
      {label}
    </button>
  );
}

/**
 * Parent, this, children, plus prereqs and leadsTo.
 *
 * Rendered whenever the id opened matches a concept node, which most of the
 * shared ids do. A term with no matching node draws nothing, because there is
 * no hierarchy to draw.
 */
function Hierarchy({ id }: { id: string }) {
  const node = getNode(id);
  if (!node) return null;

  const parent = node.parent ? getNode(node.parent) : undefined;
  const kids = descendantChips(id);
  const needs = node.prereqs ?? [];
  const unlocks = node.leadsTo ?? [];

  const anything = parent || kids.length || needs.length || unlocks.length;
  if (!anything) return null;

  return (
    <section className="gl-hier" data-testid="hierarchy">
      <div className="gl-hier-row gl-hier-here-row">
        <span className="gl-hier-k">you are here</span>
        <div className="gl-hier-chips">
          {parent && <HierChip id={parent.id} tone="up" />}
          {parent && <span className="gl-hier-sep" aria-hidden="true">/</span>}
          <HierChip id={node.id} tone="here" />
          {kids.length > 0 && <span className="gl-hier-sep" aria-hidden="true">/</span>}
          {kids.map((c) => (
            <HierChip key={c.id} id={c.id} tone="kid" />
          ))}
        </div>
      </div>

      {needs.length > 0 && (
        <div className="gl-hier-row gl-hier-need-row">
          <span className="gl-hier-k">needs first</span>
          <div className="gl-hier-chips">
            {needs.map((p) => (
              <HierChip key={p} id={p} tone="need" />
            ))}
          </div>
        </div>
      )}

      {unlocks.length > 0 && (
        <div className="gl-hier-row gl-hier-unlock-row">
          <span className="gl-hier-k">unlocks next</span>
          <div className="gl-hier-chips">
            {unlocks.map((p) => (
              <HierChip key={p} id={p} tone="unlock" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ panel */

export function DigPanel() {
  const trail = useStore((s) => s.dig);
  const back = useStore((s) => s.digBack);
  const close = useStore((s) => s.digClose);
  const to = useStore((s) => s.digTo);

  // Escape pops one level rather than closing everything, so a deep dig is not
  // undone by a reflex.
  useEffect(() => {
    if (!trail.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      back();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [trail.length, back]);

  if (!trail.length) return null;
  const id = trail[trail.length - 1]!;
  const t = BY_ID.get(id);
  const n = getNode(id);
  if (!t && !n) return null;

  const title = t?.term ?? n?.title ?? id;

  return (
    <aside className="gl-panel" role="dialog" aria-label={`About ${title}`} data-testid="dig">
      <header className="gl-head">
        <nav className="gl-trail" aria-label="How you got here">
          {trail.map((tid, i) => (
            <span key={`${tid}-${i}`}>
              {i > 0 && <span className="gl-arrow" aria-hidden="true">›</span>}
              <button
                className={`gl-crumb${i === trail.length - 1 ? ' here' : ''}`}
                onClick={() => to(tid, i)}
                data-testid={`trail-${i}`}
              >
                {labelFor(tid)}
              </button>
            </span>
          ))}
        </nav>
        <div className="gl-acts">
          {trail.length > 1 && (
            <button className="gl-x" onClick={back} data-testid="dig-back" aria-label="Back one step">
              ‹ back
            </button>
          )}
          <button className="gl-x" onClick={close} data-testid="dig-close" aria-label="Close">
            ✕
          </button>
        </div>
      </header>

      <div className="gl-body">
        <h2 className="gl-term">{title}</h2>

        {/* Hierarchy first, under the title and before any long prose. A reader
            without the key concept can see parent, siblings and next steps
            before anything asks for their attention. */}
        <Hierarchy id={id} />

        {t ? (
          <Prose text={t.plain} className="gl-plain" />
        ) : (
          n && <p className="gl-plain">{n.L0_oneLiner}</p>
        )}

        {/* Taking away the wrong picture is usually the whole job, so it sits
            immediately under the definition rather than at the bottom. */}
        {t?.not && (
          <div className="gl-not">
            <span className="gl-not-k">what it is not</span>
            <Prose text={t.not} />
          </div>
        )}

        {t?.origin && <OriginBlock id={t.id} />}

        {t?.more?.map((m, i) => (
          <Prose key={i} text={m} className="gl-more" />
        ))}

        {t?.see && t.see.length > 0 && (
          <div className="gl-see">
            <span className="gl-see-k">from here</span>
            <div className="gl-see-row">
              {t.see.map((s) => (
                <button key={s} className="gl-chip" onClick={() => useStore.getState().digTo(s)}>
                  {BY_ID.get(s)?.term.toLowerCase() ?? s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Why the thing exists.
 *
 * The split between forced and dated is the point. Explaining what a knob does
 * never stops it feeling arbitrary; naming the failure that made it necessary
 * does. So a dated fix leads with the problem, not with itself.
 */
export function OriginBlock({ id }: { id: string }) {
  const t = BY_ID.get(id);
  if (!t?.origin) return null;
  return <OriginOf origin={t.origin} />;
}

/**
 * The same block, given an origin directly.
 *
 * Concept nodes and glossary terms both carry origins and both deserve the
 * identical treatment, so this takes the value rather than a lookup key. Two
 * renderers for one idea would drift, and the split between forced and dated is
 * exactly the thing that must not drift.
 */
export function OriginOf({ origin }: { origin: Origin }) {
  /* An object with no history says so, rather than being left blank. A vector
     is not somebody's fix for anything, and a made-up date would be worse than
     the gap. */
  if (origin.kind === 'none') {
    return (
      <div className="gl-origin none" data-testid="origin">
        <span className="gl-origin-k">no history to tell</span>
        <Prose text={origin.because} />
      </div>
    );
  }

  if (origin.kind === 'forced') {
    return (
      <div className="gl-origin forced" data-testid="origin">
        <span className="gl-origin-k">nobody chose this</span>
        <Prose text={origin.because} />
        <p className="gl-origin-n">
          There is no version of the problem where this is different.
        </p>
      </div>
    );
  }

  const o = origin;
  return (
    <div className="gl-origin fix" data-testid="origin">
      <span className="gl-origin-k">
        someone's fix <b>{o.year}</b>
      </span>
      <div className="gl-before">
        <span className="gl-before-k">what was broken</span>
        <Prose text={o.problem} />
      </div>
      <div className="gl-after">
        <span className="gl-before-k">what it bought</span>
        <Prose text={o.gained} />
      </div>
      {o.source && (
        <a className="gl-src" href={o.source.url} target="_blank" rel="noreferrer noopener">
          {o.source.label}
        </a>
      )}
    </div>
  );
}
