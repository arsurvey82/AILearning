/**
 * ModelScene. The whole model as a solid you can turn in your hands.
 *
 * The flat version of this read as pages. A reader put it exactly right: boxes,
 * but not a real model dissected, and not movable. Two things were missing and
 * neither was polish.
 *
 * Depth. Every tensor is now a slab with thickness, lying in the x/z plane,
 * and the pass runs downward through the stack. You can see that the MLP is a
 * wide shallow sheet and that the attention matrices are small squares standing
 * behind one another, because the geometry is real 3D projected by hand into
 * Canvas 2D. See project.ts for why not WebGL.
 *
 * Control. Drag to orbit, scroll to zoom. A camera you drive yourself turns a
 * diagram into a thing you are looking at, and that is the difference between
 * reading a figure and inspecting an object.
 *
 * The faces carry real numbers. Each slab's top face is painted from the values
 * the symbolic core computed for the current input, so the causal triangle in
 * an attention matrix is visible as geometry rather than described in a caption.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FORWARD_PASS, getNode } from '../content';
import { parseInput } from '../model/embedding';
import { useStore } from '../store';
import { blocksForStage, boundsOf, buildLayout, type Block } from './layout';
import { corners, FACES, faceDepth, project, THICK, type Cam } from './project';
import { extent, sceneValues, type Matrix } from './values';
import './ModelScene.css';

const KIND_VAR: Record<Block['kind'], string> = {
  token: '--aqua',
  table: '--yellow',
  stream: '--blue',
  proj: '--magenta',
  square: '--magenta',
  wide: '--violet',
  weights: '--orange',
  score: '--green',
};

/** Starting view. Angled enough to read as solid, flat enough to read as a stack. */
const HOME = { yaw: -0.62, pitch: 0.72 };

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h || '888888', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Darken a hex colour toward black, for the side faces. */
function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}

/**
 * Paint a block's values into an offscreen bitmap, one pixel per number.
 *
 * Drawing 192 x 6 individual quads per frame would not hold 60fps, and it is
 * unnecessary. A projected top face is a parallelogram, and a parallelogram is
 * an affine transform of a rectangle, so each slab becomes a tiny image the
 * canvas maps onto its own face for free.
 */
function bitmap(rows: Matrix, positive: string, negative: string): HTMLCanvasElement | null {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (!h || !w) return null;

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(w, h);
  const max = extent(rows);
  const p = hexToRgb(positive);
  const n = hexToRgb(negative);

  for (let r = 0; r < h; r++) {
    for (let col = 0; col < w; col++) {
      const val = rows[r]![col] ?? 0;
      /* Square root, not raw magnitude. Most values sit well below the maximum,
         so a linear ramp renders almost every cell black and the face reads as
         an empty outline. The root spends more of the range where the data
         actually is. */
      const t = 0.28 + 0.72 * Math.sqrt(clamp(Math.abs(val) / max, 0, 1));
      const [cr, cg, cb] = val >= 0 ? p : n;
      const i = (r * w + col) * 4;
      img.data[i] = Math.round(cr * t);
      img.data[i + 1] = Math.round(cg * t);
      img.data[i + 2] = Math.round(cb * t);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Point in a convex quad, by consistent winding sign. */
function inside(x: number, y: number, q: ReadonlyArray<{ sx: number; sy: number }>): boolean {
  let sign = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % q.length]!;
    const cross = (b.sx - a.sx) * (y - a.sy) - (b.sy - a.sy) * (x - a.sx);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

export function ModelScene({ height = 380 }: { height?: number }) {
  const focusNodeId = useStore((s) => s.focusNodeId);
  const focusNode = useStore((s) => s.focusNode);
  const runInput = useStore((s) => s.runInput);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Cam | null>(null);
  const orbitRef = useRef({ ...HOME });
  const zoomRef = useRef<number | null>(null);
  const hoverRef = useRef<string | null>(null);
  const turnedRef = useRef(false);
  const [hover, setHover] = useState<string | null>(null);
  const [turned, setTurned] = useState(false);

  const T = useMemo(() => Math.max(1, parseInput(runInput).letters.length), [runInput]);
  const layout = useMemo(() => buildLayout(T), [T]);
  const values = useMemo(() => sceneValues(runInput), [runInput]);

  const stage = FORWARD_PASS.includes(focusNodeId) ? focusNodeId : undefined;
  const active = useMemo(
    () => new Set(stage ? blocksForStage(layout, stage).map((b) => b.id) : []),
    [layout, stage],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim() || '#888888';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Bitmaps depend on the input and the theme, not on the camera, so they are
    // built once rather than per frame.
    const faces = new Map<string, HTMLCanvasElement | null>();
    for (const b of layout.blocks) {
      const rows = values.get(b.id);
      if (rows) faces.set(b.id, bitmap(rows, v(KIND_VAR[b.kind]), v('--orange')));
    }

    let raf = 0;
    let last = performance.now();
    let vw = 0;
    let vh = 0;

    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      vw = r.width;
      vh = r.height;
      canvas.width = Math.max(1, Math.round(vw * dpr));
      canvas.height = Math.max(1, Math.round(vh * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    ro.observe(canvas);

    /**
     * Where the camera wants to be for the current stage.
     *
     * The scale fits the PROJECTED extent, not the extent in cells. Those are
     * different numbers as soon as you orbit: a slab 48 wide covers a different
     * span on screen at 40 degrees than at 0, and fitting the cell bounds sent
     * the model off the edge of the pane at most angles.
     *
     * Scale multiplies projected offsets linearly, so projecting once at unit
     * scale gives the exact answer with no search.
     */
    const want = (): Cam => {
      const shown = active.size ? layout.blocks.filter((b) => active.has(b.id)) : layout.blocks;
      const bb = boundsOf(shown);
      const base: Cam = {
        tx: bb.x + bb.w / 2,
        ty: bb.y + bb.h / 2,
        tz: 0,
        yaw: orbitRef.current.yaw,
        pitch: orbitRef.current.pitch,
        scale: 1,
      };

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const b of shown) {
        const z = b.rows / 2;
        for (const p of corners(base, b.x, b.x + b.cols, b.y, b.y + THICK, -z, z, 0, 0)) {
          minX = Math.min(minX, p.sx);
          maxX = Math.max(maxX, p.sx);
          minY = Math.min(minY, p.sy);
          maxY = Math.max(maxY, p.sy);
        }
      }

      // Room for the labels, which sit above a slab rather than inside it.
      const pad = 0.14;
      const fit = Math.min(
        vw / Math.max(maxX - minX, 1e-3) / (1 + pad * 2),
        vh / Math.max(maxY - minY, 1e-3) / (1 + pad * 2 + 0.12),
      );

      const scale = zoomRef.current ?? clamp(fit, 0.4, 24);
      // `corners` was called with W and H of zero, so these are raw projected
      // offsets at unit scale. Multiply by the chosen scale and push the middle
      // of that back to the middle of the pane.
      return {
        ...base,
        scale,
        ox: -((minX + maxX) / 2) * scale,
        oy: -((minY + maxY) / 2) * scale,
      };
    };

    type Quad = {
      pts: ReturnType<typeof project>[];
      d: number;
      b: Block;
      shade: number;
      top: boolean;
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!vw || !vh) return;

      // A rAF timestamp can predate the one captured at setup, which would make
      // dt negative and drive the scale through zero.
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;

      const target = want();
      if (!camRef.current) camRef.current = { ...target };
      const cam = camRef.current;

      if (reduce) {
        Object.assign(cam, target);
      } else {
        const k = 1 - Math.exp(-dt * 7);
        cam.tx += (target.tx - cam.tx) * k;
        cam.ty += (target.ty - cam.ty) * k;
        cam.scale += (target.scale - cam.scale) * k;
        cam.ox = (cam.ox ?? 0) + ((target.ox ?? 0) - (cam.ox ?? 0)) * k;
        cam.oy = (cam.oy ?? 0) + ((target.oy ?? 0) - (cam.oy ?? 0)) * k;
        // Orbit tracks the pointer exactly. Easing a drag feels like lag.
        cam.yaw = target.yaw;
        cam.pitch = target.pitch;
      }
      cam.scale = Math.max(0.1, cam.scale);

      ctx.clearRect(0, 0, vw, vh);

      /* Painter's algorithm over every face in the scene at once. Sorting
         within each block would be wrong: slabs interleave in depth as you
         orbit, and a per block order lets a far slab paint over a near one. */
      const quads: Quad[] = [];
      for (const b of layout.blocks) {
        const z = b.rows / 2;
        const pts = corners(cam, b.x, b.x + b.cols, b.y, b.y + THICK, -z, z, vw, vh);
        for (const f of FACES) {
          /* No back face culling. The winding test needs a sign convention that
             is easy to get backwards, and getting it backwards silently culls
             the TOP faces, which are the ones carrying the data. Painter's
             ordering already resolves a convex box correctly, so the six faces
             all go into the sort and the nearest one wins. */
          quads.push({
            pts: f.idx.map((i) => pts[i]!),
            d: faceDepth(pts, f.idx),
            b,
            shade: f.shade,
            top: Boolean(f.top),
          });
        }
      }
      quads.sort((p, q) => q.d - p.d);

      const ink = v('--ink');
      for (const q of quads) {
        const on = active.has(q.b.id);
        const hot = hoverRef.current === q.b.id;
        const [a, b2, c, d] = q.pts as [Quad['pts'][0], Quad['pts'][0], Quad['pts'][0], Quad['pts'][0]];

        ctx.globalAlpha = on ? 1 : hot ? 0.85 : 0.4;
        const img = q.top ? faces.get(q.b.id) : undefined;

        if (img) {
          /* Map the bitmap onto the face. The top face runs corner 0 to 1 along
             x (columns) and 0 to 3 along z (rows), and those two edges are
             exactly the affine basis the transform needs. */
          const exx = (b2.sx - a.sx) / img.width;
          const exy = (b2.sy - a.sy) / img.width;
          const ezx = (d.sx - a.sx) / img.height;
          const ezy = (d.sy - a.sy) / img.height;
          ctx.save();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.transform(exx, exy, ezx, ezy, a.sx, a.sy);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        } else {
          ctx.fillStyle = shade(v(KIND_VAR[q.b.kind]), q.shade);
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b2.sx, b2.sy);
          ctx.lineTo(c.sx, c.sy);
          ctx.lineTo(d.sx, d.sy);
          ctx.closePath();
          ctx.fill();
        }

        if (on) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b2.sx, b2.sy);
          ctx.lineTo(c.sx, c.sy);
          ctx.lineTo(d.sx, d.sy);
          ctx.closePath();
          ctx.stroke();
        }
      }

      // Labels last, so nothing paints over them.
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      for (const b of layout.blocks) {
        if (!active.has(b.id) && hoverRef.current !== b.id) continue;
        const p = project(cam, b.x, b.y, -b.rows / 2, vw, vh);
        if (b.cols * cam.scale < 34) continue;
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillStyle = ink;
        ctx.fillText(b.label, p.sx, p.sy - (b.note ? 16 : 5));
        if (b.note) {
          ctx.font = '11px system-ui, sans-serif';
          ctx.fillStyle = v('--muted');
          ctx.fillText(b.note, p.sx, p.sy - 4);
        }
      }
    };

    raf = requestAnimationFrame(draw);

    /**
     * Hit testing against projected top faces.
     *
     * Inverting the projection would be neater but wrong once slabs overlap.
     * This walks every block, keeps the ones whose top face contains the
     * pointer, and takes the nearest, which is what the viewer sees.
     */
    const pick = (e: PointerEvent): Block | undefined => {
      const cam = camRef.current;
      if (!cam) return;
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;

      const hits: Array<{ b: Block; d: number }> = [];
      for (const b of layout.blocks) {
        const z = b.rows / 2;
        const pts = corners(cam, b.x, b.x + b.cols, b.y, b.y + THICK, -z, z, r.width, r.height);
        const top = FACES[0]!.idx.map((i) => pts[i]!);
        if (inside(mx, my, top)) hits.push({ b, d: faceDepth(pts, FACES[0]!.idx) });
      }
      hits.sort((p, q) => p.d - q.d);
      return hits[0]?.b;
    };

    let dragging = false;
    let px = 0;
    let py = 0;
    let moved = 0;

    const down = (e: PointerEvent) => {
      dragging = true;
      moved = 0;
      px = e.clientX;
      py = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };

    const move = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - px;
        const dy = e.clientY - py;
        px = e.clientX;
        py = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        orbitRef.current.yaw += dx * 0.006;
        // Pitch stops short of vertical. Past that the model turns inside out
        // and there is no way to tell which way is forward.
        orbitRef.current.pitch = clamp(orbitRef.current.pitch + dy * 0.005, 0.06, 1.45);
        if (!turnedRef.current && moved > 24) {
          turnedRef.current = true;
          setTurned(true);
        }
        return;
      }
      const b = pick(e);
      const id = b?.id ?? null;
      if (id !== hoverRef.current) {
        hoverRef.current = id;
        setHover(id);
        canvas.style.cursor = b ? 'pointer' : 'grab';
      }
    };

    const up = (e: PointerEvent) => {
      dragging = false;
      canvas.releasePointerCapture(e.pointerId);
      // A drag is not a click. Without this, every orbit ends by navigating.
      if (moved > 6) return;
      const target = pick(e)?.stages.find((s) => FORWARD_PASS.includes(s));
      if (target) focusNode(target, 'notebook');
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camRef.current;
      if (!cam) return;
      zoomRef.current = clamp(cam.scale * Math.exp(-e.deltaY * 0.0015), 0.5, 40);
    };

    const leave = () => {
      hoverRef.current = null;
      setHover(null);
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('pointerleave', leave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('pointerleave', leave);
    };
  }, [layout, values, active, focusNode]);

  const hovered = hover ? layout.blocks.find((b) => b.id === hover) : undefined;
  const stageNode = stage ? getNode(stage) : undefined;

  const reset = () => {
    orbitRef.current = { ...HOME };
    zoomRef.current = null;
    turnedRef.current = false;
    setTurned(false);
  };

  return (
    <div className="ms" style={{ height }}>
      <canvas ref={canvasRef} className="ms-canvas" aria-hidden="true" />

      <div className="ms-hud">
        <span className="ms-where">
          {stageNode ? <em>{stageNode.title}</em> : 'The whole model, at true proportions'}
        </span>
        <span className="ms-hint">
          {hovered ? (
            <>
              <strong>{hovered.label}</strong>
              {hovered.note ? ` · ${hovered.note}` : ''}
            </>
          ) : (
            'Drag to turn it. Scroll to zoom.'
          )}
        </span>
      </div>

      {turned && (
        <button className="ms-reset" onClick={reset}>
          Reset view
        </button>
      )}

      {/* The canvas takes no keyboard focus, so the same destinations exist
          here as real buttons. They appear when focused. */}
      <ul className="ms-a11y">
        {FORWARD_PASS.map((id) => (
          <li key={id}>
            <button onClick={() => focusNode(id, 'notebook')}>
              Fly to {getNode(id)?.title ?? id}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
