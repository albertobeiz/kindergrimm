// ---------------------------------------------------------------
// THE MODELED BODIES — `rock` and `slime`, built the way a modeller
// would build them: a low-poly control CAGE run through Catmull-Clark.
//
// This is the third technique tried on these two shapes and the first
// that works, and the sequence is the lesson:
//
//   1. a RADIAL DISPLACEMENT on the ball. Scaling a sphere in and out
//      along the ray moves its surface but keeps its topology of
//      extents — the bottom stays as round as the top — so nothing
//      could sit flat and no peak could close.
//   2. a PROFILE, a surface of revolution over a silhouette function.
//      Better: it can be flat-bottomed and it can come to a point. But
//      a silhouette is only the outline; everything a shape does that
//      is not its outline has to be smuggled in as a fudge on top.
//   3. a CAGE. Eight lines of numbers, and the shape is simply drawn.
//
// The lab already knew this. It is written down against the chibi
// skull that was here before: **a shape you can name the parts of
// wants a cage, not an exponent.** A rock has a foot and a dome; a
// slime has a base, a waist and a tip. Those are parts, so they get a
// cage.
//
// The layout's contract survives untouched: a body only has to provide
// `at(ax, ay)` → point + normal, and this provides it by RAY CASTING
// its own mesh from the centre. The mesh is star-shaped about the
// origin, so a ray hits exactly one front face, and the normal is
// interpolated from smooth vertex normals — features land on the real
// subdivided surface rather than on an idea of it. The same arrays the
// layout cast against are what get stamped, so the surface the face
// sits on and the surface that is drawn are one object.
// ---------------------------------------------------------------
import { subdivideN } from './catmullClark.js';

const lerp = (a, b, t) => a + (b - a) * t;

// A cage is a stack of RINGS: [y, radius], bottom to top, in a unit
// box. Deliberately few — the whole point of a cage is that you can
// read the shape off the numbers.
const CAGE = {
  // FLAT ON THE BOTTOM, ROUNDED UP. The foot is wide and the two rings
  // above it are nearly as wide, so the side leaves the ground almost
  // vertically and the base reads as a face it is resting on. Then it
  // domes.
  // FEWER SIDES ON PURPOSE. Twelve sides and a small jitter subdivide
  // into a smooth dome — which is a pebble, not a rock. Eight sides
  // leave facets big enough to survive Catmull-Clark, and the jitter
  // has to be large enough to be a FORM rather than a wobble.
  rock: {
    sides: 8, subdiv: 2, jitter: .17,
    levels: [
      [-1.00, .74], [-.95, .93], [-.72, 1.02], [-.30, 1.04],
      [.12, .98], [.52, .82], [.82, .54], [1.00, .18],
    ],
  },
  // A DROP. A wide round base, the widest point low, and a long taper
  // to a soft point — the tip ring is small rather than collapsed, so
  // subdivision rounds it instead of pinching it.
  slime: {
    sides: 12, subdiv: 2, jitter: 0,
    levels: [
      [-1.00, .46], [-.92, .80], [-.68, .98], [-.34, 1.02],
      [.06, .90], [.44, .64], [.76, .34], [1.00, .07],
    ],
  },
};

export const FORM_MESHES = Object.keys(CAGE);
export const isMeshForm = f => f in CAGE;

/** deterministic per-vertex nudge. From the indices, never from `rng`:
 *  a body is rebuilt on every boil frame and anything rolled per frame
 *  would shimmer — the same rule as `wobble` in gshape.js. */
const jit = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * .5 + .5;

function buildCage(p) {
  const { sides, levels, jitter } = p;
  const verts = [], rings = [];
  for (let j = 0; j < levels.length; j++) {
    const [y, r] = levels[j];
    const ring = [];
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2;
      // the lumps are in the CAGE, so subdivision softens them into
      // swells rather than leaving them as dents
      const k = jitter ? 1 + jitter * (jit(i, j) - .5) * 2 : 1;
      const ky = jitter ? y + jitter * .25 * (jit(i + 7, j) - .5) * 2 : y;
      verts.push([Math.sin(a) * r * k, ky, Math.cos(a) * r * k]);
      ring.push(verts.length - 1);
    }
    rings.push(ring);
  }
  const faces = [];
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < sides; i++) {
      const k = (i + 1) % sides;
      faces.push([rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]]);
    }
  // both ends closed with one n-gon. Catmull-Clark takes any arity, and
  // an n-gon cap is what rounds the rock's foot and the slime's tip.
  faces.push(rings[rings.length - 1].slice());
  faces.push(rings[0].slice().reverse());
  return { verts, faces };
}

/**
 * form id + multipliers → the surface.
 *
 * Returns the subdivided mesh (pure arrays, for `meshGeometry`) plus
 * everything the LAYOUT needs from a body: `pick(dir)`, which `at` is
 * built on, the bounds, and the silhouette half-width by height.
 */
export function formSurface(form, { scale = 1, width = 1, height = 1, depth = 1 } = {}) {
  const p = CAGE[form];
  const mesh = subdivideN(buildCage(p), p.subdiv);
  const { verts, faces } = mesh;
  for (const v of verts) {
    v[0] *= scale * width; v[1] *= scale * height; v[2] *= scale * depth;
  }

  // ---- smooth vertex normals -----------------------------------------
  const vn = verts.map(() => [0, 0, 0]);
  for (const f of faces) {
    // Newell's method: robust for any planar-ish n-gon
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < f.length; i++) {
      const a = verts[f[i]], b = verts[f[(i + 1) % f.length]];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    for (const vi of f) { vn[vi][0] += nx; vn[vi][1] += ny; vn[vi][2] += nz; }
  }
  for (const n of vn) {
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n[0] /= l; n[1] /= l; n[2] /= l;
  }

  // ---- bounds, and the half-width binned by height --------------------
  let minY = 1e9, maxY = -1e9, maxX = 0, maxZ = 0;
  for (const v of verts) {
    minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    maxX = Math.max(maxX, Math.abs(v[0])); maxZ = Math.max(maxZ, Math.abs(v[2]));
  }
  const BINS = 24, hw = new Array(BINS).fill(0);
  for (const v of verts) {
    const b = Math.min(BINS - 1, Math.max(0,
      ((v[1] - minY) / (maxY - minY) * BINS) | 0));
    hw[b] = Math.max(hw[b], Math.abs(v[0]));
  }
  for (let i = 0; i < BINS; i++) hw[i] = Math.max(hw[i], hw[i - 1] ?? 0, hw[i + 1] ?? 0);

  // ---- triangles for the raycast --------------------------------------
  const tris = [];
  for (const f of faces)
    for (let i = 2; i < f.length; i++) tris.push([f[0], f[i - 1], f[i]]);

  /** ray from the origin along `dir` → { p, n }. Möller–Trumbore over
   *  every triangle; the mesh is star-shaped about the origin so
   *  exactly one front face is hit. */
  function pick(dx, dy, dz) {
    let best = Infinity, hit = null;
    for (const [ia, ib, ic] of tris) {
      const a = verts[ia], b = verts[ib], c = verts[ic];
      const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
      const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det;
      const u = -(a[0] * px + a[1] * py + a[2] * pz) * inv;
      if (u < -1e-6 || u > 1 + 1e-6) continue;
      const qx = -a[1] * e1z + a[2] * e1y, qy = -a[2] * e1x + a[0] * e1z,
            qz = -a[0] * e1y + a[1] * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < -1e-6 || u + v > 1 + 1e-6) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t <= 1e-9 || t >= best) continue;
      best = t; hit = { ia, ib, ic, u, v, t };
    }
    if (!hit) return null;
    const { ia, ib, ic, u, v, t } = hit, w = 1 - u - v;
    const na = vn[ia], nb = vn[ib], nc = vn[ic];
    let nx = w * na[0] + u * nb[0] + v * nc[0];
    let ny = w * na[1] + u * nb[1] + v * nc[1];
    let nz = w * na[2] + u * nb[2] + v * nc[2];
    const l = Math.hypot(nx, ny, nz) || 1;
    return { p: [dx * t, dy * t, dz * t], n: [nx / l, ny / l, nz / l] };
  }

  return {
    mesh, minY, maxY, maxX, maxZ, pick,
    /** silhouette half-width at height y, in the mesh's own frame. */
    halfWidthAt(y) {
      const f = (y - minY) / (maxY - minY) * BINS - .5;
      const i = Math.min(BINS - 1, Math.max(0, f | 0));
      const j = Math.min(BINS - 1, i + 1);
      return lerp(hw[i], hw[j], Math.min(1, Math.max(0, f - i)));
    },
  };
}
