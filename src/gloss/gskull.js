// ---------------------------------------------------------------
// THE SKULL — the humanoid's head, and the ONE body in the lab that
// is MODELED rather than described. A superellipsoid was tried first,
// with a chin-tuck knob bolted on, and it never read as a chibi skull:
// one implicit formula cannot say "full cheeks HERE, chin THIS wide,
// face flat in front". This is the modeling workflow, in code, solved
// in the chibi-skull side project and ported:
//
//   a low-poly control CAGE — a stack of rings, each one line of
//   numbers [y, halfWidth, halfDepth, zOffset] — run through
//   Catmull-Clark subdivision. The cage IS the silhouette; shaping a
//   head is editing a handful of numbers, exactly like dragging edge
//   loops in a modeler. Subdivision does all the smoothing, so there
//   are no poles, no seams and no shading creases.
//
// The layout's contract survives intact: a body only has to provide
// `at(ax, ay)` → point + normal, and the skull provides it by RAY
// CASTING its own mesh from the centre. The mesh is star-shaped about
// the origin, so a ray hits exactly one front face, and the normals
// are smooth vertex normals interpolated at the hit — a feature lands
// on the real subdivided surface, never on an approximation of it.
//
// Pure arrays end to end (this file never touches three.js): the same
// {verts, faces} the layout raycasts is handed to `skullGeometry` in
// gshape.js, so the surface features sit on and the surface that is
// drawn can never disagree — one build, shared.
//
// Axes: +Y up, +Z front, cage coords roughly ±1; the caller scales.
// ---------------------------------------------------------------
import { subdivideN } from './catmullClark.js';

const lerp = (a, b, t) => a + (b - a) * t;

export const SKULL_DEFAULTS = {
  nx: 2, nz: 2,      // cage cells across the caps
  subdiv: 3,         // Catmull-Clark iterations

  width: 1, depth: 1, height: 1,
  // 0 = square cross-section (hard corners), 1 = corners on a circle
  round: .7,

  // The cage, bottom to top: [y, halfWidth, halfDepth, zOffset].
  // halfWidth/halfDepth are multiples of width/depth. THIS is the
  // whole shape.
  levels: [
    [-1.0, .40, .44, .05],
    [-.68, .70, .76, .04],
    [-.32, .88, .92, .02],
    [.05, 1.00, 1.00, 0],
    [.45, 1.02, 1.00, -.01],
    [.80, .86, .85, -.02],
    [1.0, .46, .48, -.03],
  ],

  // Flatten the face by clamping cage vertices against a tilted
  // plane. A hard clamp is fine: subdivision rounds the corner it
  // leaves behind. Set >= depth to disable.
  facePlane: .74,
  faceTilt: .06,     // >0 leans the brow forward and the chin back
};

// The five classic chibi skulls, tuned in the side project's demo.
export const SKULL_PRESETS = {
  // steamed bun: widest low at the cheeks, short, maximum cute
  bun: {
    width: 1, depth: .98, height: 1, round: .62,
    levels: [
      [-1.0, .52, .50, .05],
      [-.66, .90, .84, .04],
      [-.30, 1.06, .96, .02],
      [.05, 1.06, 1.00, 0],
      [.45, .98, .98, -.01],
      [.80, .82, .84, -.02],
      [1.0, .46, .48, -.03],
    ],
    facePlane: .74, faceTilt: .04,
  },
  // crisp corners, reads assertive
  square: {
    width: .98, depth: .98, height: 1.1, round: .2,
    levels: [
      [-1.0, .56, .54, .04],
      [-.66, .92, .90, .03],
      [-.30, 1.00, .98, .01],
      [.05, 1.02, 1.00, 0],
      [.45, 1.00, .99, -.01],
      [.80, .88, .88, -.02],
      [1.0, .52, .54, -.03],
    ],
    facePlane: .70, faceTilt: .04,
  },
  // egg: the neutral all-purpose base
  oval: {
    width: .92, depth: .98, height: 1.15, round: .9,
    levels: SKULL_DEFAULTS.levels,
    facePlane: .74, faceTilt: .07,
  },
  // `triangle` lived here — the study's fifth: cranium at full width
  // over a chin a quarter of it. It is gone. On a body with no neck
  // and no shoulders under it that silhouette does not read as a slim
  // character, it reads as a CARROT: nothing stops the taper, so the
  // eye follows it to a point. The four survivors all keep a real
  // chin, and the variety between them is where the cheeks are widest,
  // not how sharply they close.
  // heavy lower face, chubby
  trapezoid: {
    width: 1, depth: .98, height: 1, round: .4,
    levels: [
      [-1.0, .62, .56, .04],
      [-.64, 1.00, .92, .03],
      [-.28, 1.08, .98, .01],
      [.08, 1.04, 1.00, 0],
      [.48, .94, .95, -.01],
      [.80, .80, .82, -.02],
      [1.0, .44, .48, -.03],
    ],
    facePlane: .72, faceTilt: .03,
  },
};

export const SKULL_IDS = Object.keys(SKULL_PRESETS);

/** the control cage: rings around a rounded square, capped top and
 *  bottom. Ported whole from chibi-skull. */
function buildCage(p) {
  const { nx, nz, levels } = p;
  const ny = levels.length - 1;
  const uAt = i => (i / nx) * 2 - 1;
  const wAt = k => (k / nz) * 2 - 1;

  const perim = [];
  for (let i = 0; i < nx; i++) perim.push([i, 0]);
  for (let k = 0; k < nz; k++) perim.push([nx, k]);
  for (let i = nx; i > 0; i--) perim.push([i, nz]);
  for (let k = nz; k > 0; k--) perim.push([0, k]);

  const verts = [], faces = [];

  function place(i, k, j) {
    const u = uAt(i), w = wAt(k);
    const [y, hw, hd, zOff] = levels[j];
    // blend the square cross-section toward a circle; `m` keeps the
    // cap's interior points consistent with the perimeter around them
    const m = Math.max(Math.abs(u), Math.abs(w));
    const h = Math.hypot(u, w);
    const s = h > 1e-9 ? lerp(1, m / h, p.round) : 1;
    const x = u * s * hw * p.width;
    const py = y * p.height;
    let pz = w * s * hd * p.depth + zOff;
    pz = Math.min(pz, p.facePlane + p.faceTilt * y);
    verts.push([x, py, pz]);
    return verts.length - 1;
  }

  const capIndex = level => {
    const grid = [];
    for (let i = 0; i <= nx; i++) {
      grid[i] = [];
      for (let k = 0; k <= nz; k++) grid[i][k] = place(i, k, level);
    }
    return grid;
  };

  const bottomGrid = capIndex(0);
  const rings = [perim.map(([i, k]) => bottomGrid[i][k])];
  for (let j = 1; j < ny; j++) rings.push(perim.map(([i, k]) => place(i, k, j)));
  const topGrid = capIndex(ny);
  rings.push(perim.map(([i, k]) => topGrid[i][k]));

  const ringLen = perim.length;
  for (let j = 0; j < ny; j++) {
    for (let m = 0; m < ringLen; m++) {
      const n = (m + 1) % ringLen;
      faces.push([rings[j][m], rings[j + 1][m], rings[j + 1][n], rings[j][n]]);
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      faces.push([topGrid[i][k], topGrid[i][k + 1], topGrid[i + 1][k + 1], topGrid[i + 1][k]]);
      faces.push([bottomGrid[i][k], bottomGrid[i + 1][k], bottomGrid[i + 1][k + 1], bottomGrid[i][k + 1]]);
    }
  }
  return { verts, faces };
}

/**
 * preset id (or a params object) + multipliers → the surface.
 *
 * Returns the subdivided mesh (pure arrays, for `skullGeometry`) plus
 * everything the LAYOUT needs from a body: `pick(dir)` — the raycast
 * `at` is built on — bounds, and the silhouette half-width by height.
 * `scale` multiplies every vertex, so cage units never leak out.
 */
export function skullSurface(preset, { scale = 1, width = 1, height = 1, depth = 1 } = {}) {
  const base = typeof preset === 'string' ? SKULL_PRESETS[preset] ?? SKULL_PRESETS.oval : preset;
  const p = { ...SKULL_DEFAULTS, ...base };
  p.width *= width; p.height *= height; p.depth *= depth;

  const mesh = subdivideN(buildCage(p), p.subdiv);
  const { verts, faces } = mesh;
  for (const v of verts) { v[0] *= scale; v[1] *= scale; v[2] *= scale; }

  // ---- smooth vertex normals, accumulated per face --------------------
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

  // ---- bounds and the silhouette half-width, binned by height ---------
  let minY = 1e9, maxY = -1e9, maxX = 0, maxZ = 0;
  for (const v of verts) {
    minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    maxX = Math.max(maxX, Math.abs(v[0])); maxZ = Math.max(maxZ, Math.abs(v[2]));
  }
  const BINS = 24;
  const hw = new Array(BINS).fill(0);
  for (const v of verts) {
    const b = Math.min(BINS - 1, Math.max(0, ((v[1] - minY) / (maxY - minY) * BINS) | 0));
    hw[b] = Math.max(hw[b], Math.abs(v[0]));
  }
  // a bin a coarse cage leaves thin borrows from its neighbours
  for (let i = 0; i < BINS; i++)
    hw[i] = Math.max(hw[i], hw[i - 1] ?? 0, hw[i + 1] ?? 0);

  // ---- triangles for the raycast --------------------------------------
  const tris = [];
  for (const f of faces)
    for (let i = 2; i < f.length; i++) tris.push([f[0], f[i - 1], f[i]]);

  /** ray from the origin along `dir` → { p, n } on the surface.
   *  Möller–Trumbore over every triangle; the mesh is star-shaped
   *  about the origin so exactly one front face is hit. */
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
      const qx = -a[1] * e1z + a[2] * e1y, qy = -a[2] * e1x + a[0] * e1z, qz = -a[0] * e1y + a[1] * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < -1e-6 || u + v > 1 + 1e-6) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t <= 1e-9 || t >= best) continue;
      best = t;
      hit = { ia, ib, ic, u, v, t };
    }
    if (!hit) return null;
    const { ia, ib, ic, u, v, t } = hit;
    const w = 1 - u - v;
    const na = vn[ia], nb = vn[ib], nc = vn[ic];
    let nx = w * na[0] + u * nb[0] + v * nc[0];
    let ny = w * na[1] + u * nb[1] + v * nc[1];
    let nz = w * na[2] + u * nb[2] + v * nc[2];
    const l = Math.hypot(nx, ny, nz) || 1;
    return { p: [dx * t, dy * t, dz * t], n: [nx / l, ny / l, nz / l] };
  }

  return {
    mesh,                       // { verts, faces } — hand this to skullGeometry
    minY, maxY, maxX, maxZ,
    pick,
    /** silhouette half-width at height y (mesh frame). */
    halfWidthAt(y) {
      const f = (y - minY) / (maxY - minY) * BINS - .5;
      const i = Math.min(BINS - 1, Math.max(0, f | 0));
      const j = Math.min(BINS - 1, i + 1);
      return lerp(hw[i], hw[j], Math.min(1, Math.max(0, f - i)));
    },
  };
}
