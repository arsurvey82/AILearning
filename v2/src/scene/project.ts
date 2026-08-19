/**
 * Orthographic 3D projection, in about forty lines.
 *
 * The flat version of this scene read as pages because it had no depth and no
 * mouse control: rectangles stacked down a column with a camera that panned.
 * bbycroft's model is a solid you fly around, and that is not a styling
 * difference. You cannot see that a tensor is a slab, or that the layers sit
 * behind one another, from a diagram that has only two axes.
 *
 * The honest options were three.js (about 150 KB gzipped, and this ships as
 * ONE self-contained file with no CDN), raw WebGL (weeks), or real 3D geometry
 * projected by hand into the Canvas 2D context we already have. This is the
 * third. The geometry is genuinely three-dimensional, orbit, depth sorting
 * and foreshortening are all real; only the rasteriser is 2D.
 *
 * Axes, in cells:
 *   x, the model's width (channels). 48 for the residual stream, 192 in the MLP.
 *   y, down the pipeline. Embedding at the top, sampling at the bottom.
 *   z, the token axis. One row per token in the sequence.
 *
 * So every tensor is a thin slab lying flat in x-z, and the pass runs downward
 * through them. That is the shape of the thing.
 */

export interface Cam {
  /** Point the camera looks at, in cells. */
  tx: number;
  ty: number;
  tz: number;
  /** Rotation about the vertical axis. */
  yaw: number;
  /** Tilt. 0 is edge-on; larger looks down from above. */
  pitch: number;
  /** Pixels per cell. */
  scale: number;
  /**
   * Screen-space nudge, in pixels.
   *
   * Centring cannot be done by moving the look-at point: once the scene is
   * rotated, "the middle of the projected image" is not a world coordinate you
   * can subtract from tx. Framing is a screen-space question, so it is answered
   * in screen space.
   */
  ox?: number;
  oy?: number;
}

export interface Pt {
  sx: number;
  sy: number;
  /** Distance from the viewer. Larger is further away. */
  d: number;
}

/** How thick a tensor slab is drawn, in cells. Enough to read as solid. */
export const THICK = 1.6;

export function project(cam: Cam, x: number, y: number, z: number, W: number, H: number): Pt {
  const dx = x - cam.tx;
  const dy = y - cam.ty;
  const dz = z - cam.tz;

  // Spin about the vertical axis...
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const rx = dx * cy - dz * sy;
  const rz = dx * sy + dz * cy;

  // ...then tilt the whole thing toward the viewer.
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const ry = dy * cp - rz * sp;
  const d = dy * sp + rz * cp;

  return {
    sx: W / 2 + rx * cam.scale + (cam.ox ?? 0),
    sy: H / 2 + ry * cam.scale + (cam.oy ?? 0),
    d,
  };
}

/** The eight corners of a slab, in the order the face table below expects. */
export function corners(
  cam: Cam,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  W: number,
  H: number,
): Pt[] {
  return [
    project(cam, x0, y0, z0, W, H), // 0 top    back  left
    project(cam, x1, y0, z0, W, H), // 1 top    back  right
    project(cam, x1, y0, z1, W, H), // 2 top    front right
    project(cam, x0, y0, z1, W, H), // 3 top    front left
    project(cam, x0, y1, z0, W, H), // 4 bottom back  left
    project(cam, x1, y1, z0, W, H), // 5 bottom back  right
    project(cam, x1, y1, z1, W, H), // 6 bottom front right
    project(cam, x0, y1, z1, W, H), // 7 bottom front left
  ];
}

/**
 * The six faces, as indices into `corners`, with a shade for each.
 *
 * The top face carries the data, so it is the brightest; the sides fall away.
 * Flat shading like this is what makes a projected box read as solid rather
 * than as an outline drawing.
 */
export const FACES: ReadonlyArray<{ idx: [number, number, number, number]; shade: number; top?: boolean }> = [
  { idx: [0, 1, 2, 3], shade: 1, top: true },
  { idx: [4, 5, 6, 7], shade: 0.45 },
  { idx: [3, 2, 6, 7], shade: 0.72 },
  { idx: [0, 1, 5, 4], shade: 0.62 },
  { idx: [1, 2, 6, 5], shade: 0.8 },
  { idx: [0, 3, 7, 4], shade: 0.55 },
];

/** Average depth of a face. The sort key for painter's ordering. */
export function faceDepth(pts: readonly Pt[], idx: readonly number[]): number {
  let s = 0;
  for (const i of idx) s += pts[i]!.d;
  return s / idx.length;
}

/**
 * A face is turned away from the viewer when its projected winding reverses.
 * Culling those halves the fill work and, more importantly, stops a box's far
 * side painting over its near side when two slabs interleave.
 */
export function facesViewer(pts: readonly Pt[], idx: readonly number[]): boolean {
  const [a, b, c] = [pts[idx[0]!]!, pts[idx[1]!]!, pts[idx[2]!]!];
  return (b.sx - a.sx) * (c.sy - a.sy) - (b.sy - a.sy) * (c.sx - a.sx) > 0;
}
