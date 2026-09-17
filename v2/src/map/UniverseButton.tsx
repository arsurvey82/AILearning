/**
 * The index, as a thing you can see rather than a word you have to read.
 *
 * "Show on map" was a text button, which asked the reader to imagine what was
 * behind it. A live thumbnail answers that before the click: it draws the
 * bodies around wherever you currently are, so you can see how many concepts
 * sit beside this one and roughly how they group.
 *
 * The preview shares nothing with MapCanvas on purpose. It renders a few dozen
 * circles at 100 by 62 pixels; borrowing the full camera, orbit and hit-testing
 * machinery to do that would couple two things that only look alike.
 */

import { useEffect, useRef } from 'react';
import { childrenOf, getNode, pathTo } from '../content';
import { universeShown, useStore } from '../store';
import './UniverseButton.css';

export function UniverseButton() {
  const focusNodeId = useStore((s) => s.focusNodeId);
  const graphic = useStore((s) => s.graphic);
  const setGraphic = useStore((s) => s.setGraphic);
  const setView = useStore((s) => s.setView);
  const ref = useRef<HTMLCanvasElement>(null);

  const node = getNode(focusNodeId);
  /* Label and state both read from what is drawn, not from the stored choice,
     so the button cannot say "Universe index" while the universe is showing. */
  const on = universeShown(graphic, focusNodeId);
  const kids = childrenOf(focusNodeId);
  const crumbs = pathTo(focusNodeId);
  // At a leaf there is nothing inside to preview, so show its siblings: the
  // useful question there is "what else is at this level".
  const ring = kids.length ? kids : childrenOf(crumbs[crumbs.length - 2]?.id ?? '');

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim() || '#888888';

    let raf = 0;
    let t = 0;
    let last = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      if (!reduce) t += dt;

      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(r.width * dpr)) {
        canvas.width = Math.round(r.width * dpr);
        canvas.height = Math.round(r.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const W = r.width;
      const H = r.height;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.34;

      // The container you are inside.
      ctx.strokeStyle = v('--border');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.5, 0, 6.283);
      ctx.stroke();

      ctx.fillStyle = v(`--${node?.color ?? 'blue'}`);
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.42, 0, 6.283);
      ctx.fill();

      // What is inside it, orbiting slowly.
      const n = Math.min(ring.length, 10);
      for (let i = 0; i < n; i++) {
        const k = ring[i]!;
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + t * 0.12;
        const x = cx + Math.cos(a) * R * 1.12;
        const y = cy + Math.sin(a) * R * 1.12;
        ctx.globalAlpha = k.id === focusNodeId ? 1 : 0.7;
        ctx.fillStyle = v(`--${k.color}`);
        ctx.beginPath();
        ctx.arc(x, y, k.id === focusNodeId ? 4 : 2.6, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [focusNodeId, node, ring]);

  return (
    <button
      className={`ub${on ? ' on' : ''}`}
      onClick={() => {
        setGraphic(on ? 'auto' : 'universe');
        setView('map');
      }}
      title={
        on
          ? 'Back to the structure'
          : `Open the index. ${ring.length} concepts beside this one, 64 in all`
      }
      aria-pressed={on}
    >
      <canvas ref={ref} className="ub-canvas" aria-hidden="true" />
      <span className="ub-text">
        <span className="ub-t">{on ? 'Close index' : 'Universe index'}</span>
        <span className="ub-d">{on ? 'back to the structure' : `${ring.length} beside this`}</span>
      </span>
    </button>
  );
}
