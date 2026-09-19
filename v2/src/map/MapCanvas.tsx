/**
 * MapCanvas. CLAUDE.md §7.2, design-spec §5 and §7.
 *
 * A nested cosmos: every body opens into the bodies inside it. The recursive
 * layout, camera and hit-testing are ported from the v1 prototype
 * (docs/prototype-v1-universe.html), which had the shape right; what is new is
 * that each body is a real ConceptNode, so the map can also express ORDER.
 *
 * Two relationships, drawn differently and deliberately:
 *   CONTAINMENT -> nesting. Attention sits inside a Transformer Layer.
 *   ORDER       -> rims. Blue = needed first, green = unlocks next.
 * Conflating them is what made v1 feel like a filing cabinet instead of a path.
 */

import { useEffect, useRef, useState } from 'react';
import {
  FORWARD_PASS,
  NODES,
  ROOT_ID,
  childrenOf,
  forwardPassBuiltCount,
  getNode,
  hasChildren,
  pathTo,
} from '../content';
import type { ConceptNode } from '../content/schema';
import { DEFAULT_INPUT } from '../model/toyModel';
import { useStore } from '../store';
import { fitLabel } from './label';
import './MapCanvas.css';

interface Body {
  node: ConceptNode;
  depth: number;
  parent: Body | null;
  children: Body[];
  /** world radius of this body */
  R: number;
  /** radius its children orbit at */
  ringR: number;
  /** world radius each child gets */
  childR: number;
  baseAngle: number;
  orbitSpeed: number;
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  sr: number;
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function withAlpha(color: string, a: number): string {
  if (color.startsWith('rgb')) return color;
  let h = color.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Build the body tree once, with the prototype's sizing rules. */
function buildBodies(reduced: boolean): { root: Body; byId: Record<string, Body> } {
  const byId: Record<string, Body> = {};

  const make = (node: ConceptNode, parent: Body | null, depth: number, i: number, n: number): Body => {
    const R = depth === 0 ? 1000 : (parent?.childR ?? 300);
    const body: Body = {
      node,
      depth,
      parent,
      children: [],
      R,
      ringR: R * 0.6,
      childR: R * 0.3,
      // Fan children evenly, offset per depth so nested rings do not line up
      // into a spoke and read as one straight line.
      baseAngle: -Math.PI / 2 + i * ((2 * Math.PI) / Math.max(n, 1)) + depth * 0.4,
      /* Nested rings must not all spin at one rate or the whole thing reads
         as noise, so speed still falls with depth. But dividing by depth+1
         took a full orbit from 209 seconds at the top to 1047 four levels
         down, which is not "slower", it is stopped. A gentler falloff keeps
         the distinction and keeps everything visibly alive. */
      orbitSpeed: reduced ? 0 : (0.05 / (1 + depth * 0.35)) * (depth % 2 ? -1 : 1),
      cx: 0,
      cy: 0,
      sx: 0,
      sy: 0,
      sr: 0,
    };
    byId[node.id] = body;

    const kids = childrenOf(node.id);
    // Fit children around the ring without overlapping, then cap so a body with
    // two children does not produce two near-parent-sized moons.
    const fit = kids.length > 1 ? body.ringR * Math.sin(Math.PI / kids.length) * 0.62 : body.ringR * 0.5;
    body.childR = Math.min(fit, R * 0.3);

    body.children = kids.map((k, ki) => make(k, body, depth + 1, ki, kids.length));
    return body;
  };

  const rootNode = getNode(ROOT_ID);
  if (!rootNode) throw new Error('root node missing');
  const root = make(rootNode, null, 0, 0, 1);
  return { root, byId };
}

export function MapCanvas({ compact = false }: { compact?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const focusNodeId = useStore((s) => s.focusNodeId);
  const focusNode = useStore((s) => s.focusNode);
  const setView = useStore((s) => s.setView);
  const theme = useStore((s) => s.theme);
  const [hint, setHint] = useState(true);

  const focused = getNode(focusNodeId);
  const setGraphic = useStore((s) => s.setGraphic);
  /* Two different clicks, deliberately.

     Diving through the canvas or the trail is MAP navigation, so it pins the
     pane and the universe stays up. Clicking a chip means "take me to that
     concept", so it leaves the pane alone and the destination shows its own
     structure, which teaches more than another ring of circles. */
  const diveTo = (id: string) => {
    setGraphic('universe');
    focusNode(id);
  };

  /* Straight to the lesson, where the grounded ask box lives. Without a key
     that box can only explain what it would do, so the settings open too:
     being told to add a key with no way to get one is the dead end again in
     a different costume. */
  const askAbout = () => {
    focusNode(focusNodeId, 'notebook');
    if (!useStore.getState().aiKey) useStore.getState().openAISettings();
  };

  const crumbs = pathTo(focusNodeId);
  const kids = childrenOf(focusNodeId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { root, byId } = buildBodies(reduced);

    let W = 0;
    let H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    /**
     * A ResizeObserver, not a window resize listener.
     *
     * In split mode the pane changes size without the window changing at all , 
     * so `resize` never fires, the backing store keeps its old dimensions, and
     * CSS stretches the result. Circles come out as ellipses. Observing the
     * element itself is the only thing that catches every case.
     */
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 240 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.3 + 0.2,
      tw: Math.random() * 6.28,
      sp: Math.random() * 0.6 + 0.2,
    }));

    let T = 0;
    let last = performance.now();
    const cam = { x: 0, y: 0, scale: 0.02 };
    let manual: { x: number; y: number } | null = null;
    let userScale: number | null = null;
    let raf = 0;

    /**
     * Frame the focused body.
     *
     * Compact mode pulls back: in a narrow column, filling the pane with one
     * sphere answers "what am I on", which the notebook beside it already
     * answers, while losing "where does it sit", which is the only thing the
     * map is there for.
     */
    const scaleFor = (b: Body) =>
      Math.max(0.001, (Math.min(W, H) * (compact ? 0.2 : 0.36)) / b.R);

    const positions = () => {
      const walk = (b: Body) => {
        for (const k of b.children) {
          const a = k.baseAngle + T * k.orbitSpeed;
          k.cx = b.cx + b.ringR * Math.cos(a);
          k.cy = b.cy + b.ringR * Math.sin(a);
          walk(k);
        }
      };
      root.cx = 0;
      root.cy = 0;
      walk(root);
    };

    const isAncestor = (maybe: Body, of: Body): boolean => {
      let p = of.parent;
      while (p) {
        if (p === maybe) return true;
        p = p.parent;
      }
      return false;
    };

    const step = (now: number) => {
      // Clamped at both ends: the lower clamp matters because a rAF callback can
      // carry a timestamp predating the performance.now() captured at setup,
      // which would make dt negative, flip the easing sign and drive the scale
      // through zero into negative, where every arc radius throws.
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      T += dt;

      if (W <= 0 || H <= 0) {
        raf = requestAnimationFrame(step);
        return;
      }

      positions();

      const state = useStore.getState();
      const focus = byId[state.focusNodeId] ?? root;

      // Position pins exactly (§7.2, no drift); only scale eases.
      cam.x = focus.cx + (manual?.x ?? 0);
      cam.y = focus.cy + (manual?.y ?? 0);
      const wantScale = Math.max(0.001, userScale ?? scaleFor(focus));
      cam.scale += (wantScale - cam.scale) * Math.min(dt * 5, 1);
      if (!(cam.scale > 0.0001)) cam.scale = 0.0001;

      // The info panel is pinned bottom-left and is opaque, so a universe
      // centred on the viewport puts a body underneath it. Shift the optical
      // centre right by half the panel so nothing important hides behind it.
      const panelW = W > 720 ? 378 : 0;
      const cxScreen = (W + panelW) / 2;

      const w2s = (x: number, y: number): [number, number] => [
        (x - cam.x) * cam.scale + cxScreen,
        (y - cam.y) * cam.scale + H / 2,
      ];

      const INK = cssVar('--ink', '#fff');
      const BLUE = cssVar('--blue', '#3987e5');
      const GREEN = cssVar('--green', '#2a9d2a');
      const STAR = cssVar('--star', '#cfd6ff');
      const MUTED = cssVar('--muted', '#898781');

      ctx.clearRect(0, 0, W, H);

      for (const s of stars) {
        s.tw += dt * s.sp;
        ctx.globalAlpha = 0.28 + 0.4 * Math.sin(s.tw);
        ctx.fillStyle = STAR;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const sel = focus.node;
      const prereqs = new Set(sel.prereqs);
      const unlocks = new Set(sel.leadsTo);

      const drawBody = (b: Body, alpha: number, labelled: boolean, isFocus = false) => {
        const [sx, sy] = w2s(b.cx, b.cy);
        const r = b.R * cam.scale;
        b.sx = sx;
        b.sy = sy;
        b.sr = r;
        if (r < 1.2) return;
        if (sx < -r - 140 || sx > W + r + 140 || sy < -r - 140 || sy > H + r + 140) return;

        const col = cssVar(`--${b.node.color}`, '#3987e5');
        const isPre = prereqs.has(b.node.id);
        const isNext = unlocks.has(b.node.id);
        const isStub = b.node.status === 'stub';

        /**
         * A body you are INSIDE is a container, not an object. Filling it at
         * full strength paints its children in the same colour they sit on, and
         * "box in box" stops reading as containment, it reads as overlap. So
         * the focused container recedes to a rim and a wash, and the things
         * inside it are what carry the colour.
         */
        const isOpenContainer = isFocus && b.children.length > 0;
        const fill: [number, number, number] = isOpenContainer
          ? [0.2, 0.1, 0.03]
          : [0.92, 0.5, 0.14];

        ctx.globalAlpha = alpha;

        const g = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 1.9);
        g.addColorStop(0, withAlpha(col, isOpenContainer ? 0.1 : isFocus ? 0.34 : 0.2));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0, r * 1.9), 0, 6.283);
        ctx.fill();

        const bg = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r);
        bg.addColorStop(0, withAlpha(col, fill[0]));
        bg.addColorStop(0.6, withAlpha(col, fill[1]));
        bg.addColorStop(1, withAlpha(col, fill[2]));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, 6.283);
        ctx.fill();

        const rim = isFocus ? INK : isPre ? BLUE : isNext ? GREEN : col;
        ctx.strokeStyle = withAlpha(rim, isFocus || isPre || isNext ? 0.95 : 0.55);
        ctx.lineWidth = isFocus ? 3 : isPre || isNext ? 2.5 : 1.2;
        // Dashed = outline only. The map never lets an unwritten node look written.
        if (isStub && !isFocus) ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, 6.283);
        ctx.stroke();
        ctx.setLineDash([]);

        // Faint orbit ring hints there is more inside.
        if (b.children.length && r > 26) {
          ctx.strokeStyle = withAlpha(MUTED, 0.22);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0, b.ringR * cam.scale), 0, 6.283);
          ctx.stroke();
        }

        if (labelled && r > 8) {
          ctx.textAlign = 'center';

          /* A focused container cannot hold its own name in the middle of
             itself. Its children orbit at 0.6R AND rotate, so over a few
             seconds they sweep every angle; the disc left clear inside that
             orbit is roughly 45px across while the title needs 200. No choice
             of angle fixes it, which is why "The Operations" sat across "a
             model, not a machine" and "The Transformer" across "The Model".

             So the name of the room goes above the room. Nothing orbits
             there. Clamped to the viewport, because once you are deep enough
             the rim is off-screen and an unclamped title goes with it. */
          if (isFocus && b.children.length > 0) {
            const size = Math.max(14, Math.min(30, r * 0.16));
            const lx = Math.min(Math.max(sx, 120), W - 120);
            const base = Math.max(sy - r - 12, 22 + size);
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = INK;
            ctx.font = `600 ${size}px system-ui, sans-serif`;
            ctx.fillText(b.node.title, lx, b.node.tag ? base - size * 0.95 : base);
            if (b.node.tag) {
              ctx.font = `500 ${Math.max(10, size * 0.48)}px system-ui, sans-serif`;
              ctx.fillStyle = withAlpha(INK, 0.66);
              ctx.fillText(b.node.tag, lx, base);
            }
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = 1;
            return;
          }
          // Shrink, then wrap, and only leave the disc when nothing readable
          // fits at all. The old rule tried one size and gave up, which is why
          // "The Operations" hung outside its circle while "The Model" sat
          // inside. Same kind of thing, two different presentations.
          const fit = fitLabel(b.node.title, {
            radius: r,
            measure: (t, size) => {
              ctx.font = `600 ${size}px system-ui, sans-serif`;
              return ctx.measureText(t).width;
            },
          });
          const seen = state.visited.has(b.node.id) && !isFocus;

          if (fit.placement === 'inside') {
            ctx.textBaseline = 'middle';
            ctx.fillStyle = INK;
            ctx.font = `600 ${fit.fontSize}px system-ui, sans-serif`;

            const lh = fit.fontSize * 1.15;
            // The tag only earns its place when the title left room, it is
            // usually what pushes the block past the rim.
            const showTag = Boolean(b.node.tag) && r > 58 && fit.lines.length === 1;
            const blockH = fit.lines.length * lh + (showTag ? fit.fontSize * 0.85 : 0);
            let y = sy - blockH / 2 + lh / 2;

            for (const line of fit.lines) {
              ctx.fillText(line, sx, y);
              y += lh;
            }
            if (showTag) {
              ctx.font = `500 ${Math.max(9, fit.fontSize * 0.5)}px system-ui, sans-serif`;
              ctx.fillStyle = withAlpha(INK, 0.7);
              ctx.fillText(b.node.tag, sx, y - lh + fit.fontSize * 0.95);
            }
            if (seen) {
              ctx.font = `${Math.max(9, r * 0.15)}px system-ui, sans-serif`;
              ctx.fillStyle = withAlpha(INK, 0.5);
              ctx.fillText('✓', sx, sy + r * 0.66);
            }
          } else {
            /**
             * A label that does not fit inside its own disc is centred under
             * it, which is fine in open space and wrong for a child orbiting
             * inside a focused parent, because a centred label runs straight
             * across the parent's own title. That is what "Softmax weights"
             * and "Weighted sum of V" were doing on top of "Attention".
             *
             * So labels lean AWAY from the centre they orbit: a child to the
             * left of the middle is right-aligned and grows further left. The
             * text then moves outward into empty space instead of inward
             * across the parent.
             */
            const [fx] = w2s(focus.cx, focus.cy);
            const dx = sx - fx;
            const orbiting = b.parent === focus;
            const lean = orbiting && Math.abs(dx) > r * 0.5;

            /* A child near the vertical axis cannot lean anywhere useful, it
               is directly above or below the parent's own title. So it flips
               to sitting ABOVE its disc when it is in the upper half, which is
               the only direction with empty space. */
            const [, fy] = w2s(focus.cx, focus.cy);
            const above = orbiting && !lean && sy < fy;

            ctx.textAlign = lean ? (dx < 0 ? 'right' : 'left') : 'center';
            ctx.textBaseline = above ? 'bottom' : 'top';
            ctx.font = `600 ${fit.fontSize}px system-ui, sans-serif`;
            ctx.fillStyle = withAlpha(INK, 0.92);
            ctx.fillText(
              b.node.title + (seen ? ' ✓' : ''),
              lean ? sx + (dx < 0 ? r * 0.4 : -r * 0.4) : sx,
              above ? sy - r - 8 : sy + r + 8,
            );
            ctx.textAlign = 'center';
          }
        }
        ctx.globalAlpha = 1;
      };

      // Connectors from the focus out to its children, with a travelling dot:
      // that is data moving, and it is the one bit of motion worth keeping.
      const [fx0, fy0] = w2s(focus.cx, focus.cy);
      for (const k of focus.children) {
        const [kx, ky] = w2s(k.cx, k.cy);
        ctx.strokeStyle = withAlpha(MUTED, 0.18);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx0, fy0);
        ctx.lineTo(kx, ky);
        ctx.stroke();

        if (!reduced) {
          const f = ((T * 0.28 + k.baseAngle) % 1 + 1) % 1;
          const px = fx0 + (kx - fx0) * f;
          const py = fy0 + (ky - fy0) * f;
          const col = cssVar(`--${k.node.color}`, '#3987e5');
          const gr = ctx.createRadialGradient(px, py, 0, px, py, 5);
          gr.addColorStop(0, col);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, 6.283);
          ctx.fill();
        }
      }

      // Context you came from, then hints of what is deeper, then the focus.
      if (focus.parent) {
        drawBody(focus.parent, 0.16, false);
        for (const sib of focus.parent.children) if (sib !== focus) drawBody(sib, 0.16, true);
      }
      for (const k of focus.children) for (const gk of k.children) drawBody(gk, 0.3, false);
      for (const k of focus.children) drawBody(k, 1, true);
      drawBody(focus, 1, true, true);

      void isAncestor;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // ---- interaction ----
    const hit = (clientX: number, clientY: number): Body | null => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const focus = byId[useStore.getState().focusNodeId] ?? root;
      const candidates: Body[] = [focus, ...focus.children];
      for (const k of focus.children) candidates.push(...k.children);
      if (focus.parent) candidates.push(focus.parent, ...focus.parent.children);

      let best: Body | null = null;
      for (const b of candidates) {
        if (b.sr === 0) continue;
        if (Math.hypot(x - b.sx, y - b.sy) <= Math.max(b.sr, 13)) {
          if (!best || b.sr < best.sr) best = b;
        }
      }
      return best;
    };

    const reset = () => {
      manual = null;
      userScale = null;
    };

    let down: { x: number; y: number } | null = null;
    let moved = false;
    let panFrom = { x: 0, y: 0, mx: 0, my: 0 };

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      moved = false;
      panFrom = { x: manual?.x ?? 0, y: manual?.y ?? 0, mx: e.clientX, my: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
        moved = true;
        manual = manual ?? { x: 0, y: 0 };
        manual.x = panFrom.x - (e.clientX - panFrom.mx) / cam.scale;
        manual.y = panFrom.y - (e.clientY - panFrom.my) / cam.scale;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!moved) {
        const b = hit(e.clientX, e.clientY);
        const current = useStore.getState().focusNodeId;
        setHint(false);
        reset();
        if (b && b.node.id !== current) {
          pin();
          focusNode(b.node.id); // dive into it
        } else if (b && b.node.id === current) {
          // Already here: a leaf opens its lesson, a container you have already
          // opened does too. Prev/Next in the notebook walks its children.
          setView('notebook');
        } else {
          const cur = byId[current];
          if (cur?.parent) { pin(); focusNode(cur.parent.node.id); } // empty space rises
        }
      }
      down = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = (userScale ?? cam.scale) * (e.deltaY < 0 ? 1.12 : 0.89);
      userScale = Math.max(0.002, Math.min(next, 12));
    };
    const pin = () => useStore.getState().setGraphic('universe');

    const onKey = (e: KeyboardEvent) => {
      const state = useStore.getState();
      const cur = byId[state.focusNodeId];
      if (!cur) return;
      const sibs = cur.parent ? cur.parent.children : [cur];
      const i = sibs.indexOf(cur);

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const n = sibs[(i + 1) % sibs.length];
        if (n) { reset(); setHint(false); pin(); focusNode(n.node.id); }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = sibs[(i - 1 + sibs.length) % sibs.length];
        if (n) { reset(); setHint(false); pin(); focusNode(n.node.id); }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // Enter descends if there is anything inside; otherwise it teaches.
        const first = cur.children[0];
        if (first) { reset(); pin(); focusNode(first.node.id); }
        else setView('notebook');
      } else if (e.key === ' ') {
        e.preventDefault();
        setView('notebook');
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        reset();
        if (cur.parent) { pin(); focusNode(cur.parent.node.id); }
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
    };
  }, [focusNode, setView, theme, compact]);

  return (
    <div className="map">
      <canvas
        ref={canvasRef}
        className="map-canvas"
        tabIndex={0}
        role="application"
        aria-label="Concept map. Arrow keys move between siblings, Enter goes deeper, Backspace goes up, Space opens the lesson."
      />

      {/* §7.7: a parallel structure so the canvas is not a dead end for
          screen readers. Nested to mirror the containment the canvas draws. */}
      <nav className="sr-only" aria-label="All concepts">
        <TreeList id={ROOT_ID} />
      </nav>

      {/* This used to be hidden in split mode on the grounds that the notebook
          beside it shows the same trail. That was wrong in practice: the
          notebook's trail is in the other pane, and split is the only mode the
          map is ever seen in, so the map shipped with no visible way back at
          all. The cost of two trails is mild redundancy. The cost of none was
          a map you could fall into. */}
      <div className="map-crumbs">
        {crumbs.length > 1 && (
          <button
            className="map-up"
            data-testid="map-up"
            onClick={() => diveTo(crumbs[crumbs.length - 2]!.id)}
            title="Out to the level above"
          >
            ↑ Out
          </button>
        )}
        {crumbs.map((c, i) => (
          <span key={c.id}>
            {i > 0 && <span className="map-sep">›</span>}
            <button
              className={`map-crumb${c.id === focusNodeId ? ' here' : ''}`}
              onClick={() => diveTo(c.id)}
            >
              {c.title}
            </button>
          </span>
        ))}
      </div>

      {/* design-spec §5 makes the forward pass the primary track. Without a
          single obvious way in, a learner lands on 64 doors and no suggestion , 
          the map is for roaming, and roaming alone is paralysis.
          Hidden in split mode: the pipeline strip beside it already IS the
          way in, and two competing entry points is worse than one. */}
      {(!compact || crumbs.length === 1) && (
      <button
        className="map-start"
        onClick={() => {
          const first = FORWARD_PASS[0];
          if (first) focusNode(first, 'notebook');
        }}
      >
        <span className="map-start-t">▶ Walk the forward pass</span>
        <span className="map-start-d">
          Follow one input, {DEFAULT_INPUT}, from raw letters to attention , {' '}
          {forwardPassBuiltCount()} steps built in full
        </span>
      </button>
      )}

      {hint && !compact && (
        <p className="map-hint">click a world to dive in · scroll to zoom · drag to pan</p>
      )}

      {/* Split mode: navigation only. The notebook beside it already carries
          the title, the description and the relationships, and repeating them
          two inches apart is redundancy the learner has to reconcile. */}
      {/* This used to render only when the node had children, so arriving at
          any of the 54 leaves made the panel vanish and the map became a dead
          end with no explanation. A leaf is not a failure, it is the bottom,
          and the bottom is where the lesson is. */}
      {focused && compact && (
        <aside className="map-panel slim">
          {kids.length === 0 ? (
            <p className="map-kids-l">
              Nothing inside {focused.title}. This is where the lesson is.
            </p>
          ) : (
          <>
          <p className="map-kids-l">Inside {focused.title}</p>
          <div className="map-kids">
            {kids.map((k) => (
              <button
                key={k.id}
                className="map-kid"
                data-node-id={k.id}
                onClick={() => focusNode(k.id, 'notebook')}
              >
                <span className="map-dot" style={{ background: `var(--${k.color})` }} />
                {k.title}
              </button>
            ))}
          </div>
          </>
          )}

          {/* On every node, not only the dead ends. The map answers "where am
              I"; these are the two things anyone wants next. */}
          <div className="map-acts">
            <button onClick={() => focusNode(focusNodeId, 'notebook')} data-testid="map-read">
              Read the lesson
            </button>
            <button onClick={askAbout} data-testid="map-ask">
              Ask about this
            </button>
          </div>
        </aside>
      )}

      {focused && !compact && (
        <aside className="map-panel">
          <span className={`map-tag c-${focused.color}`}>{focused.tag}</span>
          <h2>{focused.title}</h2>
          <p className="map-desc">{focused.L0_oneLiner}</p>

          {kids.length > 0 ? (
            <>
              <p className="map-kids-l">Inside, click to dive</p>
              <div className="map-kids">
                {kids.map((k) => (
                  <button
                    key={k.id}
                    className="map-kid"
                    data-node-id={k.id}
                    onClick={() => focusNode(k.id)}
                  >
                    <span className="map-dot" style={{ background: `var(--${k.color})` }} />
                    {k.title}
                    {hasChildren(k.id) && <span className="map-more">›</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="map-leaf">Deepest layer here, nothing nested inside.</p>
          )}

          <dl className="map-rel">
            <dt className="needs">Needs</dt>
            <dd>
              {focused.prereqs.length === 0
                ? ', '
                : focused.prereqs.map((id) => getNode(id)?.title ?? id).join(', ')}
            </dd>
            <dt className="unlocks">Unlocks</dt>
            <dd>
              {focused.leadsTo.length === 0
                ? ', '
                : focused.leadsTo.map((id) => getNode(id)?.title ?? id).join(', ')}
            </dd>
          </dl>

          <button className="map-open" onClick={() => setView('notebook')}>
            Open the lesson →
          </button>
          {focused.status === 'stub' && (
            <p className="map-stub">Outline only. No worked example or snags yet.</p>
          )}
        </aside>
      )}

      <div className={`map-legend${compact ? ' hide' : ''}`} aria-hidden="true">
        <div>
          <span className="lg-dot sel" /> selected
        </div>
        <div>
          <span className="lg-dot pre" /> needed first
        </div>
        <div>
          <span className="lg-dot next" /> unlocks next
        </div>
        <div>
          <span className="lg-dot stub" /> outline only
        </div>
      </div>

      {/* The honest headline. It used to read "1 of 64 built to full depth";
          now every node has depth, so the interesting numbers are how many
          carry a diagram and how many compute live from the toy model. */}
      {!compact && (
        <p className="map-count">
          {NODES.length} concepts · {NODES.filter((n) => n.L1?.flow).length} diagrams ·{' '}
          {NODES.filter((n) => n.L1?.example).length} with live numbers
        </p>
      )}
    </div>
  );
}

function TreeList({ id }: { id: string }) {
  const focusNode = useStore((s) => s.focusNode);
  const kids = childrenOf(id);
  if (kids.length === 0) return null;
  return (
    <ul>
      {kids.map((k) => (
        <li key={k.id}>
          <button onClick={() => focusNode(k.id, 'notebook')}>
            {k.title}, {k.L0_oneLiner}
            {k.status === 'stub' ? ' (outline only)' : ''}
          </button>
          <TreeList id={k.id} />
        </li>
      ))}
    </ul>
  );
}
