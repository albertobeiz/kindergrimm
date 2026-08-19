// ---------------------------------------------------------------
// THE HAIR — the humanoid's, and the fourth kind of thing this lab
// builds: not a plate and not a solid but a set of grown CLUMPS.
//
// IT GROWS FROM THE CROWN. That is the whole model and it is not a
// metaphor: hair is parametrised by (azimuth, height) on the body, and
// that parametrisation CONVERGES at the top pole all by itself — every
// clump is a sliver up there and only opens out as it descends. So a
// head of hair is a fan of clumps radiating from one point on top,
// which is what a head of hair is.
//
// An earlier version lofted one smooth shell and called the job done.
// It was a helmet. What separates hair from a swim cap is that it is
// MANY overlapping pieces, each with thickness, each ending in its own
// point at its own height — so the silhouette is broken, the surface
// has grooves in it, and light finds edges to catch. That is what this
// builds:
//
//   SCALP   a thin shell hugging the head, so a gap between clumps
//           shows dark hair and never skin
//   CLUMPS  ~16 tapered tiles, layered at alternating depths, each
//           running from the crown down to its own tip
//   PIECES  tails, buns and the ahoge — tubes and balls
//
// The hem — where each clump ENDS, as a function of azimuth — is still
// the entire haircut, and still three numbers: `front`, `side`, `back`.
// A pixie and a bob differ only there.
//
// One generator covers the sphere AND the cube, because both are the
// same superellipsoid with a different exponent and `surfT` already
// knows the difference. Writing two would be writing the same file
// twice and letting them drift.
//
// This file never touches three.js: it hands back `{verts, faces}`.
// ---------------------------------------------------------------
import { subdivideN } from './catmullClark.js';
import { surfT } from './gshape.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
                         a[2] * b[0] - a[0] * b[2],
                         a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1;
                    return [a[0] / l, a[1] / l, a[2] / l]; };

// ---- the styles -------------------------------------------------------
// `front` / `side` / `back` are where the clumps END, in body height:
// +1 the crown, 0 the middle of the head, −1 the bottom of it, and
// anything below −1 has left the head and is hanging.
//
// THE ORDERING IS THE READ, and both halves of it were paid for by a
// bad sheet: the BACK sits far below the front, because hair runs down
// to the nape — level all round and the hair is a cap sitting on top of
// the head. And the SIDES sit below the front too, because the temple
// is where hair comes down past the brow — level from nose to ear and
// the head is cut on a straight line. Fringe high, temples lower, nape
// lowest.
//
//   vol   how far the clumps stand off the head — the volume
//   n     how many clumps; more is finer, fewer is chunkier
//   jag   how unequal their tips are, which is what stops the hem
//         reading as a line somebody drew
//   wave  ripple down the length
//   part  lifts the hem on one side: a parting
//   open  holds the face clear further round, for the long cuts
const STYLE = {
  bald: null,

  //                 front  side   back   vol    n   jag
  crop:  { front: .42, side: .16, back: -.30, vol: .10, n: 16, jag: .10 },
  pixie: { front: .30, side: -.06, back: -.52, vol: .15, n: 16, jag: .20 },
  bowl:  { front: .06, side: -.26, back: -.58, vol: .16, n: 18, jag: .08 },
  spiky: { front: .34, side: .04, back: -.42, vol: .17, n: 13, jag: .38 },
  side:  { front: .10, side: -.18, back: -.56, vol: .16, n: 16, jag: .16, part: .30 },
  curly: { front: .18, side: -.20, back: -.50, vol: .24, n: 14, jag: .22, wave: .16 },

  // the long ones. `open` holds the face arc further round before the
  // length starts — falling from the cheekbone, a long cut closes into
  // a hood with a little face at the bottom of it.
  bob:   { front: .14, side: -1.00, back: -1.18, vol: .15, n: 18, jag: .12, open: .34 },
  wavy:  { front: .12, side: -1.30, back: -1.50, vol: .16, n: 18, jag: .18,
           wave: .12, open: .34 },
  long:  { front: .16, side: -1.95, back: -2.25, vol: .15, n: 18, jag: .14, open: .38 },
  hime:  { front: .02, side: -2.10, back: -2.40, vol: .15, n: 20, jag: .06, open: .14 },

  // tied up: a short base plus a piece
  pony:  { front: .14, side: -.06, back: -.46, vol: .14, n: 16, jag: .14, tails: 1 },
  twin:  { front: .14, side: -.10, back: -.50, vol: .14, n: 16, jag: .14, tails: 2 },
  buns:  { front: .12, side: -.14, back: -.50, vol: .14, n: 16, jag: .14, buns: 2 },
};

export const HAIR_STYLES = Object.keys(STYLE);
export const isLongHair = id => (STYLE[id]?.side ?? 1) < -1;

// where the face arc holds and where it lets go, in radians off the
// nose. Driven by the ANGLE, not by `cos(ang)`: a cosine starts closing
// the moment it leaves the nose, so the hem was half way to the side by
// 45° and the hair swallowed the temples and most of the cheeks.
const FACE_HOLD = .95, FACE_END = 1.55;
const BACK_START = 1.95, BACK_END = 2.6;
// below this the hair has left the head: it keeps the horizontal it had
// here and simply descends, which is what falling hair does. Taken from
// the chin instead, long hair tapers to a paintbrush.
const FALL = -.45;

const STATIONS = 9;      // samples down a clump
const ACROSS = 3;        // samples across it
const SUBDIV = 1;        // the sweep is smooth already; this rounds the rim

/** the hem: where a clump at this azimuth ends. The whole haircut. */
function hemAt(st, ang, H) {
  const a = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
  const o = st.open ?? 0;
  const hold = FACE_HOLD + o, end = FACE_END + o;
  const bs = Math.max(BACK_START, end + .1);
  const fw = 1 - smooth(clamp((a - hold) / (end - hold), 0, 1));
  const bw = smooth(clamp((a - bs) / (BACK_END - bs), 0, 1));
  let v = st.side + (st.front - st.side) * fw + (st.back - st.side) * bw;
  if (st.part) v += st.part * Math.sin(ang) * fw * H.part;
  return v;
}

/** deterministic per-clump jitter. From the index and one seed, never
 *  from `rng`: hair is rebuilt on every boil frame and anything rolled
 *  per-frame would shimmer. */
const jitter = (i, seed) => Math.sin(i * 12.9898 + seed) * .5 + .5;

/**
 * (azimuth, height) → a point on or off the body.
 *
 * `y` is +1 at the crown and −1 at the bottom of the head; `infl` pushes
 * out along the surface normal-ish direction, so 1 is the skin and 1.15
 * is hair standing off it. Below `FALL` the hair has left the head and
 * only descends. One function, and it works on the cube as well as the
 * sphere because `surfT` carries the exponent.
 */
function pointer(shape) {
  const { rx, ry, rz, exp } = shape;
  const on = (az, y, infl) => {
    const el = Math.asin(clamp(y, -1, 1)) * .999;
    const c = Math.cos(el);
    const d = [Math.sin(az) * c, Math.sin(el), Math.cos(az) * c];
    const t = surfT(d[0], d[1], d[2], rx, ry, rz, exp) * infl;
    return [d[0] * t, d[1] * t, d[2] * t];
  };
  return (az, y, infl) => {
    if (y >= FALL) return on(az, y, infl);
    const b = on(az, FALL, infl);
    return [b[0], b[1] + (y - FALL) * ry, b[2]];
  };
}

/**
 * ONE CLUMP: a tapered tile running from the crown down to its own tip.
 *
 * It is built in (azimuth, height) so it conforms to the head for free —
 * every sample across its width asks the body where the surface is, so
 * a clump lies on a round head like a tile instead of hovering off it
 * like a card. And because azimuth width becomes nothing at the pole,
 * the clump converges at the crown on its own: that convergence is the
 * whorl, and it is why the hair looks grown rather than fitted.
 */
function clumpMesh(pt, o) {
  const verts = [], rings = [];
  for (let i = 0; i < STATIONS; i++) {
    const s = i / (STATIONS - 1);
    const e = smooth(s);
    const y = lerp(o.y0, o.y1, e);
    // WIDE most of the way and pointed only at the end. Tapered evenly
    // from the root, clumps stop overlapping and the head turns into a
    // row of icicles with scalp showing between them.
    const w = o.w * (1 - .34 * Math.pow(s, 3));
    // thin where it leaves the parting, full through the body of the
    // clump, thinning again at the tip — hair has no volume at a cut
    const swell = Math.sin(Math.min(1, s * 1.15) * Math.PI * .92);
    const r = 1 + o.vol * (.22 + .78 * swell) + o.layer;
    const th = o.vol * (.30 + .70 * swell) + .012;
    const wob = o.wave ? o.wave * Math.sin(s * 7 + o.phase) * s : 0;
    const ring = [], inner = [];
    for (let j = 0; j <= ACROSS; j++) {
      const u = -1 + 2 * j / ACROSS;
      const az = o.az + u * w;
      // the tile CURVES: its edges lie closer to the head than its
      // spine, so clumps meet in a groove rather than in a flat seam
      const rr = r + wob - o.bulge * u * u;
      verts.push(pt(az, y, rr));
      ring.push(verts.length - 1);
      inner.push(pt(az, y, rr - th));
    }
    for (let j = ACROSS; j >= 0; j--) { verts.push(inner[j]); ring.push(verts.length - 1); }
    rings.push(ring);
  }
  const faces = [], R = rings[0].length;
  for (let i = 0; i < STATIONS - 1; i++)
    for (let k = 0; k < R; k++) {
      const k2 = (k + 1) % R;
      faces.push([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]]);
    }
  faces.push(rings[STATIONS - 1].slice());
  faces.push(rings[0].slice().reverse());
  return { verts, faces };
}

/** THE SCALP: a thin shell under the clumps. It is never the silhouette
 *  — the clumps are — but without it a gap between two of them shows
 *  bare skin, which reads as a bald patch rather than as a parting. */
function scalpMesh(st, pt, H) {
  const A = 26, RINGS = 5, verts = [], rings = [];
  for (let j = 0; j < RINGS; j++) {
    const t = j / (RINGS - 1), ring = [];
    for (let i = 0; i < A; i++) {
      const az = i / A * Math.PI * 2;
      // BELOW the nominal hem, not above it. The clumps vary in width
      // and in where they end, so between any two of them there is a
      // sliver — and a sliver of SKIN in the middle of a haircut reads
      // as a bald patch. Reaching past the hem it stays behind the
      // clumps' own tips (which are jagged and mostly longer), so it
      // never becomes the silhouette itself.
      const hem = hemAt(st, az, H) - .12;
      const y = lerp(1, hem, smooth(1 - t));
      verts.push(pt(az, y, j === 0 ? 1.001 : 1 + st.vol * H.vol * .34));
      ring.push(verts.length - 1);
    }
    rings.push(ring);
  }
  const faces = [];
  for (let j = 0; j < RINGS - 1; j++)
    for (let i = 0; i < A; i++) {
      const k = (i + 1) % A;
      faces.push([rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]]);
    }
  faces.push(rings[0].slice());
  faces.push(rings[RINGS - 1].slice().reverse());
  return { verts, faces };
}

/** several meshes as one. Catmull-Clark is happy with disconnected
 *  components, so a whole head of hair subdivides in one pass and
 *  arrives as a single mesh — sixteen clumps as sixteen meshes would be
 *  five hundred draw calls on the sheet. */
function merge(list) {
  const verts = [], faces = [];
  for (const m of list) {
    const off = verts.length;
    for (const v of m.verts) verts.push(v);
    for (const f of m.faces) faces.push(f.map(i => i + off));
  }
  return { verts, faces };
}

/** A TUBE along a path — a tail, the ahoge. Rings carried by PARALLEL
 *  TRANSPORT rather than rebuilt from a fixed up-vector, which would
 *  spin where the path turns vertical and pinch it into an hourglass. */
function strand(path, radii, sides = 8, subdiv = 2) {
  const verts = [], rings = [];
  let nrm = null;
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const t = norm(sub(b, a));
    if (!nrm) nrm = cross(Math.abs(t[1]) < .9 ? [0, 1, 0] : [1, 0, 0], t);
    else { const d = dot(nrm, t); nrm = [nrm[0] - t[0] * d, nrm[1] - t[1] * d, nrm[2] - t[2] * d]; }
    nrm = norm(nrm);
    const bi = cross(t, nrm), ring = [];
    for (let k = 0; k < sides; k++) {
      const a2 = k / sides * Math.PI * 2;
      const c = Math.cos(a2) * radii[i], s2 = Math.sin(a2) * radii[i];
      verts.push([path[i][0] + nrm[0] * c + bi[0] * s2,
                  path[i][1] + nrm[1] * c + bi[1] * s2,
                  path[i][2] + nrm[2] * c + bi[2] * s2]);
      ring.push(verts.length - 1);
    }
    rings.push(ring);
  }
  const faces = [];
  for (let i = 0; i < rings.length - 1; i++)
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      faces.push([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]]);
    }
  faces.push(rings[rings.length - 1].slice());
  faces.push(rings[0].slice().reverse());
  return subdivideN({ verts, faces }, subdiv);
}

/** a tail hanging from an anchor: OUT first, then down. With the swing
 *  starting at zero it leaves the head straight downward and hangs
 *  against the cheek, and standing clear of the head is the entire
 *  silhouette of a tied-up style. Its reach scales with the HEAD, never
 *  with the hair's length — scaled by length, waist-length tails swung a
 *  head-radius clear each side and the sheet shrank the face to fit. */
function tailAt(pt, ry, az, y, len, thick, flick) {
  const root = pt(az, y, 1.05);
  const out = norm([root[0], 0, root[2]]);
  const reach = ry * .58, N = 7, path = [], radii = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const outward = (.30 + Math.sin(t * 1.45) * .80) * (1 - t * .22) + flick * t * t;
    path.push([root[0] + out[0] * outward * reach,
               root[1] - len * smooth(t),
               root[2] + out[2] * outward * reach - len * .10 * t]);
    radii.push(thick * (1 - .62 * t * t) * (t < .12 ? .8 + t * 1.7 : 1));
  }
  return strand(path, radii);
}

/** THE AHOGE — one strand off the crown, curling over. The cheapest
 *  character in the lab: eight vertices, and the single most chibi
 *  thing on a head. */
function ahogeAt(pt, ry, H) {
  const root = pt(H.ahogeAng, .93, 1.02), N = 7, path = [], radii = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    path.push([root[0] + Math.sin(t * 2.6) * ry * .34 * H.ahogeDir,
               root[1] + ry * .62 * Math.sin(t * 1.5),
               root[2] + ry * .20 * Math.sin(t * 2.1)]);
    radii.push(ry * .062 * (1 - .78 * t));
  }
  return strand(path, radii, 6, 2);
}

/**
 * P.hair + the layout → a list of `{ id, mesh }` and `{ id, ball }`.
 * The PART turns these into specs; this file has no opinion about
 * materials, colours or three.js.
 */
export function buildHair(P, L) {
  const H = P.hair;
  const st = STYLE[H.style];
  if (!st || !L.shape) return [];
  const pt = pointer(L.shape);
  const ry = L.shape.ry;
  const vol = st.vol * H.vol;
  const n = Math.max(8, Math.round((st.n ?? 16) * H.density));

  // THE CLUMPS, radiating from the crown.
  const clumps = [];
  for (let k = 0; k < n; k++) {
    const r1 = jitter(k, H.seed), r2 = jitter(k + 31, H.seed);
    const r3 = jitter(k + 67, H.seed), r4 = jitter(k + 103, H.seed);
    // NOT evenly spaced, and NOT all the same width. Identical clumps
    // at identical spacing tile into a lampshade: the eye reads the
    // repeat before it reads the hair. Nudging each one off its slice
    // and varying how much it covers is what turns a row of panels
    // into a head of hair.
    const az = (k + .5 + (r3 - .5) * .45) / n * Math.PI * 2;
    // every other clump sits a little PROUDER, so they overlap in real
    // layers instead of tiling flush. Both directions was the mistake:
    // the sunken half dropped under the scalp and vanished, and what
    // was left read as melon slices with grooves cut between them.
    // Never negative, and small — this is a surface break, not a gap.
    const layer = (k % 2 ? .04 : .18) * vol * (.5 + r4);
    clumps.push(clumpMesh(pt, {
      az,
      // 1.22 of its own slice, so neighbours overlap and no gap opens
      w: Math.PI / n * 1.42 * H.width * (1 + .40 * r2),
      y0: 1.0,                                   // the crown, where all of them meet
      y1: hemAt(st, az, H) - (st.jag ?? .15) * H.jag * r1,
      vol,
      layer,
      bulge: vol * .20,
      wave: (st.wave ?? 0) * H.wave,
      phase: r1 * 6.283,
    }));
  }

  const out = [
    { id: 'hairScalp', mesh: scalpMesh(st, pt, H) },
    { id: 'hair', mesh: subdivideN(merge(clumps), SUBDIV) },
  ];

  if (st.tails === 2) {
    for (const s of [-1, 1])
      out.push({ id: 'hairTail' + (s < 0 ? 'L' : 'R'),
                 mesh: tailAt(pt, ry, s * H.tailAng, H.tailY,
                              ry * H.tailLen, ry * .34, s * .12) });
  } else if (st.tails === 1) {
    out.push({ id: 'hairTail',
               mesh: tailAt(pt, ry, Math.PI, H.tailY, ry * H.tailLen * 1.15, ry * .40, 0) });
  }
  if (st.buns) {
    for (const s of [-1, 1])
      out.push({ id: 'hairBun' + (s < 0 ? 'L' : 'R'),
                 ball: { r: ry * H.bunR, pos: pt(s * H.bunAng, .62, 1 + vol) } });
  }
  if (H.ahoge) out.push({ id: 'hairAhoge', mesh: ahogeAt(pt, ry, H) });
  return out;
}
