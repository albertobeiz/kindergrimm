// ---------------------------------------------------------------
// THE HAIR — the humanoid's, and the fourth kind of thing this lab
// builds: ONE MOLDED MASS with the clumps carved into it, plus a
// handful of STRANDS growing from points on the head.
//
// That decomposition is not invented — it is how the figures in the
// reference are actually molded. A vinyl figure's hair is a back piece
// (the mass), a front piece (the fringe), and separate accent strands:
// the momiage hanging in front of each ear, loose wisps over the
// forehead, a flyaway or two at the crown. The mass gives volume, and
// the strands are what read as STYLED — a molded mass alone always
// looks like it came out of a mold.
//
// Two dead ends are still worth keeping: a single smooth shell was a
// helmet, and separate tiled clumps gapped onto skin, caught the studio
// as glassy streaks, and had no volume. One thick closed shell, carved:
//
//   volume   the outer surface stands well off the head; the inner one
//            hugs it, and the fold between them at the hem is the thick
//            rounded rim every molded haircut has
//   grooves  narrow notches in the outer radius at clump boundaries
//   scallop  the hem drops to a point under each clump
//
// And it GROWS FROM A WHORL, not from the top pole. The first carving
// used plain azimuth, so every groove was a meridian and they all met
// at the geometric top — a pumpkin, not a haircut. Hair radiates from
// a whorl set BACK off the crown (or pulled to the front hairline for
// the upswept cuts), so every groove is a great-circle ray out of a
// placeable whorl point: the fringe's grooves run forward-and-down
// over the forehead, the back's run down the nape, the way combed hair
// lies. The strands follow the same field, which is what keeps a wisp
// and the groove under it agreeing about which way this head is combed.
//
// The hem — front/side/back, by azimuth — is still the whole haircut.
// One generator covers the sphere AND the cube: both are the same
// superellipsoid and `surfT` carries the exponent.
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
// `front` / `side` / `back` are where the mass ends, in body height: +1
// the crown, 0 the middle of the head, −1 the bottom, below −1 hanging.
// THE ORDERING IS THE READ: fringe high, temples lower, nape lowest —
// level all round is a cap, level nose-to-ear cuts the head on a line.
//
//   vol      how fat the mass is, off the head's radius
//   n        how many clumps are carved into it
//   jag      how far the hem drops to a tip under each clump
//   part     runs the fringe diagonally; also swings the whorl aside
//   curtain  opens the fringe over the nose, forehead showing
//   pomp     sweeps the front UP — displacement, not a hem number
//   open     holds the face clear further round, for the long cuts
//   whorlAz/whorlY  where this cut is combed from, if not the default
//            back-of-crown
const STYLE = {
  bald: null,

  // --- swept UP, off the forehead --------------------------------------
  // upswept styles grow from the FRONT hairline — the whorl sits low
  // over the brow and the flow runs up and back over the crown
  quiff:  { front: .54, side: .10, back: -.40, vol: .17, n: 12, jag: .10, pomp: .34,
            whorlAz: 0, whorlY: .48 },
  swept:  { front: .46, side: -.04, back: -.50, vol: .18, n: 13, jag: .12,
            pomp: .22, part: .30 },
  crop:   { front: .48, side: .18, back: -.30, vol: .12, n: 14, jag: .06, pomp: .10 },
  spiky:  { front: .40, side: .06, back: -.42, vol: .19, n: 11, jag: .26, pomp: .16,
            whorlY: .95 },

  // --- short, with a fringe DOWN ---------------------------------------
  bowl:   { front: .06, side: -.26, back: -.58, vol: .20, n: 16, jag: .05 },
  pixie:  { front: .24, side: -.08, back: -.52, vol: .18, n: 14, jag: .18, part: .26 },
  side:   { front: .12, side: -.18, back: -.56, vol: .20, n: 14, jag: .12, part: .36 },
  curtain:{ front: .08, side: -.30, back: -.56, vol: .19, n: 14, jag: .10, curtain: .38 },
  curly:  { front: .20, side: -.20, back: -.50, vol: .27, n: 12, jag: .12, wave: .05 },

  // --- MID: the media melena -------------------------------------------
  bob:    { front: .14, side: -.95, back: -1.15, vol: .19, n: 16, jag: .09, open: .34 },
  midi:   { front: .16, side: -1.35, back: -1.55, vol: .19, n: 16, jag: .10, open: .36 },
  layers: { front: .22, side: -1.28, back: -1.48, vol: .22, n: 13, jag: .34, open: .36,
            curtain: .24 },
  wavy:   { front: .12, side: -1.50, back: -1.70, vol: .21, n: 16, jag: .14,
            wave: .05, open: .34 },

  // --- long -------------------------------------------------------------
  long:   { front: .16, side: -1.95, back: -2.25, vol: .18, n: 16, jag: .10, open: .38 },
  hime:   { front: .02, side: -2.10, back: -2.40, vol: .18, n: 18, jag: .04, open: .14,
            locks: 2.2 },

  // --- tied up ----------------------------------------------------------
  pony:   { front: .16, side: -.06, back: -.46, vol: .17, n: 14, jag: .09,
            part: .22, tails: 1 },
  twin:   { front: .14, side: -.10, back: -.50, vol: .17, n: 14, jag: .09, tails: 2 },
  buns:   { front: .14, side: -.14, back: -.50, vol: .17, n: 14, jag: .09,
            curtain: .22, buns: 2 },
};

export const HAIR_STYLES = Object.keys(STYLE);
export const isLongHair = id => (STYLE[id]?.side ?? 1) < -1;

/**
 * How far the hair's outer surface stands off the head, as an
 * inflation factor. HATS need it: a beanie sized to a bare skull sinks
 * into a big soft cut and comes out as a painted band. Same edge as
 * `eyeReach` — the part publishes a fact about itself rather than the
 * hat reading this style table.
 */
export function hairOuter(P) {
  const st = STYLE[P.hair?.style];
  if (!st) return 1;
  return 1 + st.vol * (P.hair.vol ?? 1) + (st.pomp ?? 0) * (P.hair.pomp ?? 1) * .35;
}

// where the face arc holds and where it lets go, in radians off the
// nose. Driven by the ANGLE, not by `cos(ang)`: a cosine starts closing
// the moment it leaves the nose and the hair swallows the temples.
const FACE_HOLD = .95, FACE_END = 1.55;
const BACK_START = 1.95, BACK_END = 2.6;
// below this the hair has left the head: it keeps the horizontal it had
// here and simply descends, which is what falling hair does.
const FALL = -.45;

const A = 72;          // azimuth samples — the grooves live here
const ROWS = 8;        // rows hem → crown, each surface
const SUBDIV = 1;

/** the base hem: where the mass ends at this azimuth. The haircut. */
function hemAt(st, ang, H) {
  const a = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
  const o = st.open ?? 0;
  const hold = FACE_HOLD + o, end = FACE_END + o;
  const bs = Math.max(BACK_START, end + .1);
  const fw = 1 - smooth(clamp((a - hold) / (end - hold), 0, 1));
  const bw = smooth(clamp((a - bs) / (BACK_END - bs), 0, 1));
  let v = st.side + (st.front - st.side) * fw + (st.back - st.side) * bw;
  // a PARTING runs the fringe diagonally: long over one brow, high at
  // the opposite temple
  if (st.part) v += st.part * Math.sin(ang) * fw * H.part;
  // a CURTAIN raises it in the middle and drops it at both temples, so
  // the forehead shows between two falling sides
  if (st.curtain) {
    const c = Math.max(0, Math.cos(ang * 1.5));
    v += st.curtain * H.part * c * c * fw;
  }
  return v;
}

/** deterministic per-strand jitter. From an index and one seed, never
 *  from `rng`: hair is rebuilt on every boil frame and anything rolled
 *  per-frame would shimmer. */
const jitter = (i, seed) => Math.sin(i * 12.9898 + seed) * .5 + .5;

/**
 * (azimuth, height) → a point on or off the body. `infl` 1 is the skin.
 * Below `FALL` the hair has left the head and only descends.
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
 * THE FLOW FIELD — where this head is combed from.
 *
 * The whorl sits at the back of the crown by default, nudged per head,
 * swung round for parted styles and pulled to the front hairline for
 * the upswept ones. `flow(az, y)` gives a surface point's coordinates
 * in that field: `phi`, which ray out of the whorl it lies on (the
 * groove coordinate), and `theta`, how far from the whorl it is.
 * `ray(phi0, s)` walks back out: the point at angle `s` along one ray —
 * which is exactly the path a strand of combed hair takes, so the
 * wisps march along it.
 */
function makeFlow(st, H) {
  const wAz = (st.whorlAz ?? Math.PI) + H.whorl
            - (st.part ?? 0) * H.part * 1.6;
  const wY = clamp(st.whorlY ?? .74, -.9, .98);
  const wEl = Math.asin(wY);
  const W = [Math.sin(wAz) * Math.cos(wEl), wY, Math.cos(wAz) * Math.cos(wEl)];
  // tangent frame seeded from the face direction, so phi = 0 always
  // points down the front of the head
  let e1 = [0 - W[0] * W[2], 0 - W[1] * W[2], 1 - W[2] * W[2]];
  if (Math.hypot(e1[0], e1[1], e1[2]) < 1e-4) e1 = [1, 0, 0];
  e1 = norm(e1);
  const e2 = cross(W, e1);

  function flow(az, y) {
    const el = Math.asin(clamp(Math.max(y, FALL), -1, 1));
    const c = Math.cos(el);
    const d = [Math.sin(az) * c, Math.sin(el), Math.cos(az) * c];
    const dw = dot(d, W);
    const v = [d[0] - dw * W[0], d[1] - dw * W[1], d[2] - dw * W[2]];
    const l = Math.hypot(v[0], v[1], v[2]);
    if (l < 1e-5) return { phi: 0, theta: 0 };
    return { phi: Math.atan2(dot(v, e2) / l, dot(v, e1) / l),
             theta: Math.acos(clamp(dw, -1, 1)) };
  }

  function ray(phi0, s) {
    const u = [e1[0] * Math.cos(phi0) + e2[0] * Math.sin(phi0),
               e1[1] * Math.cos(phi0) + e2[1] * Math.sin(phi0),
               e1[2] * Math.cos(phi0) + e2[2] * Math.sin(phi0)];
    const d = [W[0] * Math.cos(s) + u[0] * Math.sin(s),
               W[1] * Math.cos(s) + u[1] * Math.sin(s),
               W[2] * Math.cos(s) + u[2] * Math.sin(s)];
    return { az: Math.atan2(d[0], d[2]), y: d[1] };
  }

  return { flow, ray };
}

/**
 * THE MASS. One closed shell with torus topology: the outer surface
 * climbs hem → crown, folds over, and the inner surface comes back down
 * hugging the head — no caps, no seams, no bare skin, and the fold at
 * the hem is the thick rounded rim of a molded piece.
 */
function hairMass(st, pt, H, shape, F) {
  const vol = st.vol * H.vol;
  const lift = (st.pomp ?? 0) * H.pomp;
  const n = Math.max(8, Math.round(st.n * H.density));

  // the clump boundaries of the FLOW, jittered so the carving never
  // tiles into a repeat — the eye reads a repeat before the hair
  const bounds = [];
  for (let k = 0; k < n; k++)
    bounds.push((k + .5 + (jitter(k, H.seed) - .5) * .5) / n * Math.PI * 2);

  function clumpAt(phi) {
    const a = ((phi % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    for (let k = 0; k < n; k++) {
      const lo = bounds[k], hi = bounds[(k + 1) % n] + (k === n - 1 ? Math.PI * 2 : 0);
      if (a >= lo && a < hi) return { k, p: (a - lo) / (hi - lo) };
    }
    return { k: 0, p: .5 };
  }

  // the GROOVE: a notch at each clump boundary of the flow, fading near
  // the whorl (a whorl is a point, not a star of notches) and near the
  // antipode, where the rays reconverge
  const GW = .16;
  function carve(az, y) {
    const { phi, theta } = F.flow(az, y);
    const { p } = clumpAt(phi);
    const d = Math.min(p, 1 - p) / GW;
    const notch = d < 1 ? smooth(1 - d) : 0;
    const fade = smooth(clamp(theta / .5, 0, 1))
               * smooth(clamp((Math.PI - theta) / .5, 0, 1));
    // this scales the hair's THICKNESS, never the total radius. As a
    // factor on the whole inflation a deep notch dived inside the head
    // and opened a black gap in the fringe — a groove is carved into
    // the hair, and it must bottom out at the hair's own floor.
    return 1 - .52 * notch * fade;
  }

  // the SCALLOP: the tip pattern follows the flow too, so the scallop
  // and the grooves above it always agree about the combing
  function hemCol(az) {
    const base = hemAt(st, az, H);
    const { k, p } = clumpAt(F.flow(az, base).phi);
    const deep = (st.jag ?? .1) * H.jag * (.45 + .55 * jitter(k + 31, H.seed));
    return base - deep * Math.pow(Math.sin(Math.PI * p), 1.6);
  }

  const verts = [], rings = [];
  const ring = f => {
    const r = [];
    for (let i = 0; i < A; i++) {
      const az = i / A * Math.PI * 2;
      verts.push(f(az));
      r.push(verts.length - 1);
    }
    rings.push(r);
  };

  for (let j = 0; j < ROWS; j++) {
    const t = j / (ROWS - 1);
    ring(az => {
      const hem = hemCol(az);
      const y = lerp(hem, 1.0, smooth(t) * .85 + t * .15);
      const swell = .72 + .28 * Math.sin(Math.min(1, .15 + t) * Math.PI * .8);
      const wob = st.wave ? st.wave * H.wave * Math.sin(az * 3 + t * 9) : 0;
      const p = pt(az, y, 1.012 + vol * swell * carve(az, y) + wob);
      // THE POMPADOUR: a radial push cannot make an upswept fringe — it
      // just makes a fatter helmet — so this displaces the outer surface
      // UP and FORWARD over the front only, peaking between hairline and
      // crown and returning to zero at both: the outer surface meets the
      // inner one at the crown, and a lift carried into that fold would
      // tear the mass open.
      if (lift) {
        const fz = Math.max(0, Math.cos(az));
        const w = Math.sin(t * Math.PI) * fz * fz;
        return [p[0], p[1] + lift * shape.ry * w, p[2] + lift * shape.rz * .40 * w];
      }
      return p;
    });
  }
  for (let j = 0; j < ROWS; j++) {
    const t = j / (ROWS - 1);
    ring(az => pt(az, lerp(1.0, hemCol(az) + .05, smooth(t)), 1.015));
  }

  const faces = [], R = rings.length;
  for (let j = 0; j < R; j++) {
    const r0 = rings[j], r1 = rings[(j + 1) % R];
    for (let i = 0; i < A; i++) {
      const i2 = (i + 1) % A;
      faces.push([r0[i], r0[i2], r1[i2], r1[i]]);
    }
  }
  return subdivideN({ verts, faces }, SUBDIV);
}

/** several meshes as one — every wisp on a head arrives as ONE mesh,
 *  because eight wisps as eight meshes is 280 draw calls on the sheet. */
function merge(list) {
  const verts = [], faces = [];
  for (const m of list) {
    const off = verts.length;
    for (const v of m.verts) verts.push(v);
    for (const f of m.faces) faces.push(f.map(i => i + off));
  }
  return { verts, faces };
}

/** A TUBE along a path — rings carried by PARALLEL TRANSPORT rather
 *  than rebuilt from a fixed up-vector, which would spin where the
 *  path turns vertical and pinch it into an hourglass. */
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

// ---- THE WISPS --------------------------------------------------------
// The point strands. Three families, and each one is a real part of how
// the reference figures are molded:
//
//   MOMIAGE   the pair hanging in front of the ears. They hang, so they
//             do not follow the flow — they run down the surface and
//             keep falling past the mass hem, longer than it, which is
//             what makes them read as separate strands and not as two
//             more clumps.
//   FRINGE    loose strands over the forehead, marching along the flow
//             ray through their root — down for a fringe, up-and-back
//             for the upswept cuts, automatically, because those styles
//             moved the whorl to the front hairline.
//
// Every root starts INSIDE the mass (a strand growing from a point must
// never float off it) and every tip eases just proud of it.

function wispSet(st, pt, H, F, shape, massTop) {
  const ry = shape.ry;
  const out = [];
  const W = H.wisps;

  // MOMIAGE — only where the ear region is actually EXPOSED. On a bob
  // or a melena the mass itself already falls past the ear, and a
  // separate lock riding outside it just reads as a ridge stuck onto
  // the haircut. `st.locks` overrides: the hime cut IS its face locks.
  const lockLen = (st.locks ?? 1) * W;
  for (const sgn of [-1, 1]) {
    const az = sgn * (1.38 + .12 * jitter(sgn + 3, H.seed));
    const hem = hemAt(st, az, H);
    if (hem < -.9 && !st.locks) continue;
    const end = hem - (.25 + .3 * jitter(sgn + 9, H.seed)) * lockLen;
    const N = 7, path = [], radii = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const y = lerp(.25, end, smooth(t) * .8 + t * .2);
      // buried at the root, HUGGING the mass — a lock that stands off
      // it reads as an antenna — and easing barely proud at the tip
      const infl = lerp(massTop - .06, massTop + .012, smooth(Math.min(1, t * 2)))
                 + .03 * t * t;
      path.push(pt(az, y, infl));
      radii.push(ry * .068 * (1 - .8 * t * t) + ry * .004);
    }
    out.push(strand(path, radii, 6, 1));
  }

  // FRINGE wisps — strands that HANG PAST the fringe's hem, close to
  // the skin, the stray bangs every reference figure has. They were
  // flow-marched first, riding on top of the fringe, and read as
  // antennae however short they got: a wisp crossing the outer surface
  // at an angle is a stick, wherever it points. Hanging is a direction
  // that cannot be misread. Root buried under the mass rim, and by the
  // time it clears the hem it sits just off the SKIN — below the hem
  // there is no mass to hug.
  const nf = 2 + (jitter(17, H.seed) > .45 ? 1 : 0);
  for (let k = 0; k < nf; k++) {
    const az0 = (nf === 1 ? 0 : (k / (nf - 1) - .5)) * .9
              + (jitter(k + 23, H.seed) - .5) * .25;
    const hem = hemAt(st, az0, H);
    if (hem < -.85) continue;              // no forehead hem to hang past
    const drop = (.14 + .12 * jitter(k + 41, H.seed)) * W;
    const N = 6, path = [], radii = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const y = lerp(hem + .16, hem - drop, smooth(t) * .7 + t * .3);
      const infl = lerp(massTop - .05, 1.055, smooth(Math.min(1, t * 1.6)));
      path.push(pt(az0 + .04 * Math.sin(t * 3 + k), y, infl));
      radii.push(ry * .034 * (1 - .72 * t * t) + ry * .003);
    }
    out.push(strand(path, radii, 6, 1));
  }

  // There was a third family here — FLYAWAYS, one or two strands
  // marching off the crown near the whorl. Removed after three tuning
  // rounds: a tube crossing the crown's convex silhouette reads as a
  // stick at ANY length or lift, and the reference figures have none —
  // their crowns are smooth molded vinyl, and the one strand standing
  // up there is the AHOGE, which is already a deliberate feature with
  // its own dice. A wisp the tuning cannot save is a wisp the design
  // does not want.

  return merge(out);
}

/** a tail hanging from an anchor: OUT first, then down — standing clear
 *  of the head is the entire silhouette of a tied-up style. Its reach
 *  scales with the HEAD, never with the hair's length. */
function tailAt(pt, ry, az, y, len, thick, flick) {
  const root = pt(az, y, 1.08);
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

/** THE AHOGE — one strand off the crown, curling over. Eight vertices,
 *  and the single most chibi thing on a head. */
function ahogeAt(pt, ry, H) {
  const root = pt(H.ahogeAng, .93, 1.06), N = 7, path = [], radii = [];
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
  // a beanie or a headband is worn BARE — see `hatBare` in hat.js
  if (!st || !L.shape || L.hatBare) return [];
  const pt = pointer(L.shape);
  const ry = L.shape.ry;
  const vol = st.vol * H.vol;
  const F = makeFlow(st, H);

  const out = [{ id: 'hair', mesh: hairMass(st, pt, H, L.shape, F) }];
  out.push({ id: 'hairWisps', mesh: wispSet(st, pt, H, F, L.shape, 1 + vol) });

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
