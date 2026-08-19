// --------------------------------------------------------------
// THE HAND — `sketch` draws, `carve` lays cells, this one WARPS
// CURVES. The plants lab is solid plastic shapes copied from the
// gardener's shelf: the leaf, the blade, the trunk, the crown.
// Everything is maximum-solid so the whole plant reads at a glance.
//
// Four things get made here, and a part never touches three.js: it
// names a SHAPE and hands over numbers, and this file is the only
// place the names become geometry. Same rule as `F.media.*` for the
// pencils and `gshape.js` for the gloss characters.
//
//   leaf  — an ellipse with the tips sharpened, extruded flat. The
//           whole leaf family is one exponent.
//   petal — a teardrop, extruded flat. The daisy's ray.
//   blade — a curved blade of grass with the bend BAKED INTO THE
//           OUTLINE by offsetting a centreline — because a straight
//           blade is a stick.
//   trunk — a profile spun round y, with a lean bent into the
//           lattice afterwards. The stem, the trunk.
//   blob  — a sphere pushed to an ellipsoid with fixed harmonics
//           (same seed → same lump, deterministically). The crown,
//           the mound, the blossom bubbles.
//
// Conventions: every shape runs BASE at (0,0) to TIP at (0,±h) in
// the x-y plane, so the part that places it knows which end roots.
// --------------------------------------------------------------
import * as THREE from 'three';

// ---- outlines ----------------------------------------------------------

/** a leaf: |x/w|^n + |y/h|^n = 1 — the whole leaf family in one
 *  exponent. n=2.2 is a plain ellipse, n≈3 points the tips. The
 *  superellipse is centred at (0, h) so its BASE sits on the origin
 *  and its tip reaches (0, 2h) — a leaf roots at the stem.
 *  This is the same form the voxel lab keeps, minus the voxels. */
function leafOutline(w, h, n = 2.4) {
  const s = new THREE.Shape();
  const N = 72;
  s.moveTo(0, 0);
  for (let i = 1; i < N; i++) {
    const a = (i / N) * Math.PI * 2;                     // full circle
    const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
    // t scales the direction (cos a, sin a) onto the superellipse —
    // at a=0 the point is (w, h), at a=π/2 it is (0, 2h)
    const t = 1 / Math.pow(Math.pow(ca / w, n) + Math.pow(sa / h, n), 1 / n);
    s.lineTo(Math.cos(a) * t, Math.sin(a) * t + h);
  }
  s.closePath();
  return s;
}

/** a petal — a teardrop: a rounded nose at the base, a point at the
 *  tip. w = half-width at the fat part, h = length. */
function petalOutline(w, h) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-w, h * .3, -w * .72, h * .85, 0, h);
  s.bezierCurveTo(w * .72, h * .85, w, h * .3, 0, 0);
  s.closePath();
  return s;
}

/** a blade of grass. The centreline is a quadratic curve from base
 *  (0,0) to tip (lean*h, h); the outline is the centreline offset to
 *  each side by a width that dies at both ends. `droop` turns the
 *  final quarter of the blade back down toward the ground. */
function bladeOutline(w, h, lean, droop) {
  const N = 30;
  // the spine is INTEGRATED from a bend angle, never offset in y: an
  // offset spine folds back on itself at a hard droop, the two edge
  // curves cross, and the triangulator fills the whole loop as a slab
  // (a tuft used to grow a few of those). Marching a fixed arc length
  // along a monotonically bending heading cannot fold.
  const spine = [[0, 0]];
  {
    let x = 0, y = 0;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const th = lean * 1.5 * Math.pow(t, 1.2)
        + droop * 2.4 * Math.pow(Math.max(0, t - .55) / .45, 2);
      x += Math.sin(th) * h / N;
      y += Math.cos(th) * h / N;
      spine.push([x, y]);
    }
  }
  const s = new THREE.Shape();
  const L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(N, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const nx = -dy, ny = dx;
    const t = i / N;
    const wid = w * Math.pow(1 - t, 1.6);       // broad base, thread tip
    L.push([spine[i][0] + nx * wid, spine[i][1] + ny * wid]);
    R.push([spine[i][0] - nx * wid, spine[i][1] - ny * wid]);
  }
  s.moveTo(L[0][0], L[0][1]);
  for (const p of L) s.lineTo(p[0], p[1]);
  for (const p of R.reverse()) s.lineTo(p[0], p[1]);
  s.closePath();
  return s;
}

// ---- plates -------------------------------------------------------------

/** a flat outline extruded with a soft bevel — the moulded-rim read
 *  the gloss plates give the characters. A leaf is a plate; its thickness
 *  is its meat. */
function plateGeometry(shape, depth, bevel) {
  const be = Math.max(1e-4, Math.min(bevel ?? depth * .5, depth * .9));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 32,
    bevelEnabled: true, bevelThickness: be, bevelSize: be, bevelSegments: 4,
  });
  g.translate(0, 0, -depth / 2);              // plate spans -d/2..d/2
  g.computeVertexNormals();
  return g;
}

/** cup a plate along its length: the tip lifts out of the plane on a
 *  parabola. A flat leaf is a paddle; a cupped one is moulded. `len`
 *  is the outline's full reach in y, `curl` the lift as a fraction
 *  of it (sign picks the side). */
function curlPlate(g, len, curl) {
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i)) / len;
    pos.setZ(i, pos.getZ(i) + curl * len * t * t);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  smoothNormals(g);
  return g;
}

/** average normals across coincident vertices. An extrude is
 *  non-indexed, so once a plate is bent, per-triangle normals facet
 *  the very curve the bend added — welding by position gets the
 *  moulded read back without re-indexing anything. */
function smoothNormals(g) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  const acc = new Map();
  const key = i => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const a = acc.get(k) ?? [0, 0, 0];
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
    acc.set(k, a);
  }
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(key(i));
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    nor.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
  nor.needsUpdate = true;
}

export function leafGeometry(w, h, n = 2.4, depth = .05, curl = 0) {
  const g = plateGeometry(leafOutline(w, h, n), depth);
  return curl ? curlPlate(g, h * 2, curl) : g;
}
export function petalGeometry(w, h, depth = .04, curl = 0) {
  const g = plateGeometry(petalOutline(w, h), depth);
  return curl ? curlPlate(g, h, curl) : g;
}
export function bladeGeometry(w, h, lean, droop, depth = .03) {
  return plateGeometry(bladeOutline(w, h, lean, droop), depth);
}

// ---- trunk ---------------------------------------------------------------
// A profile spun round y. The profile is parametric so the same code
// does the squat bloom-stalk and the mighty tree trunk.

/** profile (r, y) pairs for LatheGeometry, from base to top.
 *  `taper` blends the tree's cone toward a pole: 0 tapers to nothing
 *  (a trunk), 1 keeps nearly the whole radius to the crown and closes
 *  with a rounded cap (a stalk — a flower's neck is a pole, and the
 *  cone version read as a traffic cone wearing a daisy). */
function trunkProfile(h, r, belly, taper = 0) {
  const k = taper;
  const f = (cone, pole) => cone * (1 - k) + pole * k;
  const pts = [
    [f(.9, 1), 0], [f(1.05, 1.04), .08],               // roots flare
    [f(1.02 + belly * .35, 1 + belly * .2), .2],       // the belly
    [f(.82, .97), .42], [f(.6, .94), .62], [f(.42, .9), .8],
    [f(.3, .87), .92], [f(0, .84), 1],
  ];
  if (k > 0) pts.push([k * .5, 1.02], [0, 1.03]);      // rounded cap
  return pts.map(([a, t]) => new THREE.Vector2(r * a, h * t));
}

export function trunkGeometry(h, r, belly = .12, { lean = 0, leanRot = 0, taper = 0, seg = 48 } = {}) {
  const g = new THREE.LatheGeometry(trunkProfile(h, r, belly, taper), seg);
  // bend the lattice: shear the top sideways by `lean`, kept at the
  // base — a tree that grew toward the light
  if (lean) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = Math.pow(Math.max(0, y) / h, 2);
      pos.setX(i, pos.getX(i) + Math.cos(leanRot) * lean * h * t);
      pos.setZ(i, pos.getZ(i) + Math.sin(leanRot) * lean * h * t);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

// ---- blob -----------------------------------------------------------------
// a superellipsoid with fixed harmonics: the same seed gives the same
// lump on every rebuild, so a crown never shimmers between frames.

/** radius along a direction of |x/rx|^n + |y/ry|^n + |z/rz|^n = 1 */
function surfT(dx, dy, dz, rx, ry, rz, n) {
  return 1 / Math.pow(
    Math.pow(Math.abs(dx / rx), n) + Math.pow(Math.abs(dy / ry), n)
    + Math.pow(Math.abs(dz / rz), n), 1 / n);
}

export function blobGeometry(rx, ry, rz, { n = 2, wob = .14, seed = 0, segments = 56, rings = 30, dome = 0 } = {}) {
  // `dome` cuts the sphere to a cap (in pi): .5 is a hemisphere —
  // the mound, which sits ON the floor and must not poke under it
  const g = new THREE.SphereGeometry(1, segments, rings,
    0, Math.PI * 2, 0, dome ? Math.PI * dome : Math.PI);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i), dy = pos.getY(i), dz = pos.getZ(i);
    // fixed harmonics of the angles + seed: same seed, same lump
    const th = Math.atan2(Math.hypot(dx, dz), dy);
    const ph = Math.atan2(dz, dx);
    const w = 1 + wob * (
      Math.sin(th * 2 + seed * 2.71) * .55
      + Math.sin(ph * 3 + seed * 4.2) * .3
      + Math.sin(th * 5 + ph * 2 - seed * 1.6) * .3);
    const t = surfT(dx, dy, dz, rx, ry, rz, n) * w;
    pos.setXYZ(i, dx * t, dy * t, dz * t);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// ---- the dispatch -----------------------------------------------------------
// A spec names a shape and carries numbers. This is the ONLY gate
// between the parts and three.js — a part never imports this file.

export const SHAPES = {
  leaf:  s => leafGeometry(s.w, s.h, s.n ?? 2.4, s.depth ?? .05, s.curl ?? 0),
  petal: s => petalGeometry(s.w, s.h, s.depth ?? .04, s.curl ?? 0),
  blade: s => bladeGeometry(s.w, s.h, s.lean ?? .4, s.droop ?? 0, s.depth ?? .03),
  trunk: s => trunkGeometry(s.h, s.r, s.belly ?? .12, s),
  blob:  s => blobGeometry(s.rx, s.ry, s.rz, s),
};

export function buildSpec(spec) {
  return SHAPES[spec.shape](spec);
}

// ---- deterministic scatter ---------------------------------------------
// A part cannot roll during build — the same recipe must give the
// same plant every rebuild (and every frame, since the lab redraws).
// So the count, sizes and the SEED are gen()'d, and this hash turns
// a seed + an index into a stable number for placing a blade among
// a ring of blades. Same role as `h01` in the voxel hand.

export function oshash(seed, i) {
  let h = seed + i * 0x9e3779b9;
  h = Math.imul(h ^ h >>> 15, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}