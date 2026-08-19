// ---------------------------------------------------------------
// THE HAIR — the humanoid's, and the fourth kind of thing this lab
// builds: ONE MOLDED MASS with the clumps carved into it.
//
// That sentence is the third attempt, and the two dead ends are worth
// keeping. A single smooth shell was first: a helmet — nothing broke
// the surface, nothing caught the light, a swim cap. Separate tiled
// clumps were second: gaps opened between them onto bare skin, their
// rims caught the studio as glassy streaks, and a head of loose tiles
// has no VOLUME — it hugs the skull it was supposed to sit above. The
// reference figures are neither: they are one thick piece of vinyl,
// molded fat off the head, with GROOVES run from the crown down and a
// hem that drops to a point under each clump. Solid mass, carved
// detail. So that is what this builds — one closed, thick shell:
//
//   volume   the outer surface stands well off the head; the inner one
//            hugs it, and the rim between them is the thick rounded
//            edge every molded haircut has
//   grooves  narrow notches in the outer radius at each clump
//            boundary, converging at the crown — the whorl for free
//   scallop  the hem drops to a tip under each clump's middle, so the
//            edge reads as hair ENDING rather than as a cut line
//
// It still GROWS from the crown: everything is parametrised by
// (azimuth, height), the grooves all meet at the top pole, and a clump
// is a region of that parametrisation, not a separate object.
//
// The hem — front/side/back, where the mass ends by azimuth — is still
// the whole haircut, and a pixie and a bob still differ only there.
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
//
// THE ORDERING IS THE READ, and both halves of it were paid for by a
// bad sheet: the BACK sits far below the front (hair runs to the nape —
// level all round is a cap sitting on the head) and the SIDES sit below
// the front (the temple is where hair passes the brow — level from nose
// to ear cuts the head on a straight line).
//
//   vol   how fat the mass is, as a fraction of the head's radius.
//         BIG — this is most of what was missing for two attempts
//   n     how many clumps are carved into it
//   jag   how far the hem drops to a tip under each clump
//   wave  ripple down the length
//   part  lifts the hem on one side: a parting
//   open  holds the face clear further round, for the long cuts
const STYLE = {
  bald: null,

  // --- swept UP, off the forehead --------------------------------------
  // The shape a bowl cut cannot make, and the whole sheet was bowl cuts
  // without it: the hem sits HIGH on the forehead and `pomp` lifts the
  // mass up and back above it, so the silhouette rises at the front
  // instead of falling. This is a direction of styling, not a length.
  quiff:  { front: .54, side: .10, back: -.40, vol: .17, n: 12, jag: .10, pomp: .34 },
  swept:  { front: .46, side: -.04, back: -.50, vol: .18, n: 13, jag: .12,
            pomp: .22, part: .30 },
  crop:   { front: .48, side: .18, back: -.30, vol: .12, n: 14, jag: .06, pomp: .10 },
  spiky:  { front: .40, side: .06, back: -.42, vol: .19, n: 11, jag: .26, pomp: .16 },

  // --- short, with a fringe DOWN ---------------------------------------
  // …but only `bowl` is blunt across the whole brow. The others break it
  // up: `curtain` parts in the middle and shows forehead between two
  // sides, `side` and `pixie` run it diagonally. A fringe that is always
  // one flat line is always the same haircut.
  bowl:   { front: .06, side: -.26, back: -.58, vol: .20, n: 16, jag: .05 },
  pixie:  { front: .24, side: -.08, back: -.52, vol: .18, n: 14, jag: .18, part: .26 },
  side:   { front: .12, side: -.18, back: -.56, vol: .20, n: 14, jag: .12, part: .36 },
  curtain:{ front: .08, side: -.30, back: -.56, vol: .19, n: 14, jag: .10, curtain: .38 },
  curly:  { front: .20, side: -.20, back: -.50, vol: .27, n: 12, jag: .12, wave: .05 },

  // --- MID: the media melena, which was missing entirely ---------------
  // There was a hole between `bob` (at the jaw) and `long` (past the
  // chest) and it is the commonest length there is.
  bob:    { front: .14, side: -.95, back: -1.15, vol: .19, n: 16, jag: .09, open: .34 },
  midi:   { front: .16, side: -1.35, back: -1.55, vol: .19, n: 16, jag: .10, open: .36 },
  layers: { front: .22, side: -1.28, back: -1.48, vol: .22, n: 13, jag: .34, open: .36,
            curtain: .24 },
  wavy:   { front: .12, side: -1.50, back: -1.70, vol: .21, n: 16, jag: .14,
            wave: .05, open: .34 },

  // --- long -------------------------------------------------------------
  long:   { front: .16, side: -1.95, back: -2.25, vol: .18, n: 16, jag: .10, open: .38 },
  hime:   { front: .02, side: -2.10, back: -2.40, vol: .18, n: 18, jag: .04, open: .14 },

  // --- tied up ----------------------------------------------------------
  pony:   { front: .16, side: -.06, back: -.46, vol: .17, n: 14, jag: .09,
            part: .22, tails: 1 },
  twin:   { front: .14, side: -.10, back: -.50, vol: .17, n: 14, jag: .09, tails: 2 },
  buns:   { front: .14, side: -.14, back: -.50, vol: .17, n: 14, jag: .09,
            curtain: .22, buns: 2 },
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

const A = 72;          // azimuth samples — the grooves live here, so it
                       // has to resolve a notch a tenth of a clump wide
const ROWS = 8;        // rows hem → crown, each surface
const SUBDIV = 1;

/** the base hem: where the mass ends at this azimuth, before the
 *  per-clump scallop. The whole haircut. */
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
  // the forehead shows between two falling sides. Squared cosine, so
  // the lift is concentrated over the nose and gone by the temple.
  if (st.curtain) {
    const c = Math.max(0, Math.cos(ang * 1.5));
    v += st.curtain * H.part * c * c * fw;
  }
  return v;
}

/** deterministic per-clump jitter. From the index and one seed, never
 *  from `rng`: hair is rebuilt on every boil frame and anything rolled
 *  per-frame would shimmer. */
const jitter = (i, seed) => Math.sin(i * 12.9898 + seed) * .5 + .5;

/**
 * (azimuth, height) → a point on or off the body. `infl` 1 is the skin;
 * 1.2 is hair standing a fifth of the head off it. Below `FALL` the
 * hair has left the head and only descends. Works on the cube as well
 * as the sphere because `surfT` carries the exponent.
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
 * THE MASS. One closed shell with torus topology: the outer surface
 * climbs hem → crown, folds over, and the inner surface comes back down
 * to the hem, hugging the head. No caps, no seams, no bare skin — and
 * the fold at the hem is the thick rounded rim of a molded piece.
 */
function hairMass(st, pt, H, shape) {
  const vol = st.vol * H.vol;
  const lift = (st.pomp ?? 0) * H.pomp;
  const n = Math.max(8, Math.round(st.n * H.density));

  // the clump boundaries, jittered so the carving never tiles into a
  // repeat — the eye reads a repeat before it reads the hair
  const bounds = [];
  for (let k = 0; k < n; k++)
    bounds.push((k + .5 + (jitter(k, H.seed) - .5) * .5) / n * Math.PI * 2);

  // which clump an azimuth is in, and where across it (0..1)
  function clumpAt(az) {
    const a = ((az % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    for (let k = 0; k < n; k++) {
      const lo = bounds[k], hi = bounds[(k + 1) % n] + (k === n - 1 ? Math.PI * 2 : 0);
      if (a >= lo && a < hi) return { k, p: (a - lo) / (hi - lo) };
    }
    return { k: 0, p: .5 };
  }

  // the GROOVE: a narrow notch at each boundary, fading toward the
  // crown where its physical width goes to nothing anyway — kept full
  // depth up there it turns the whorl into a star of spikes
  const GW = .16;                       // notch half-width, of a clump
  function carve(az, t) {
    const { p } = clumpAt(az);
    const d = Math.min(p, 1 - p) / GW;
    const notch = d < 1 ? smooth(1 - d) : 0;
    return 1 - .38 * notch * (1 - .65 * smooth(t));
  }

  // the SCALLOP: under each clump the hem drops to a tip. Sine-powered
  // so the tip is a point and the shoulders are round, and every clump
  // gets its own depth — even tips read as a cut edge, and the whole
  // reason the hem scallops is to read as hair ending.
  function hemCol(az) {
    const { k, p } = clumpAt(az);
    const deep = (st.jag ?? .1) * H.jag * (.45 + .55 * jitter(k + 31, H.seed));
    return hemAt(st, az, H) - deep * Math.pow(Math.sin(Math.PI * p), 1.6);
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

  // outer surface, hem → crown. Fat through the body, easing at both
  // ends: a molded cut swells off the head and rolls under at the hem.
  for (let j = 0; j < ROWS; j++) {
    const t = j / (ROWS - 1);
    ring(az => {
      const hem = hemCol(az);
      const y = lerp(hem, 1.0, smooth(t) * .85 + t * .15);
      const swell = .72 + .28 * Math.sin(Math.min(1, .15 + t) * Math.PI * .8);
      const wob = st.wave ? st.wave * H.wave * Math.sin(az * 3 + t * 9) : 0;
      const p = pt(az, y, (1 + (vol * swell + wob)) * carve(az, t));
      // THE POMPADOUR. A radial push cannot make an upswept fringe — it
      // just makes a fatter helmet — so this displaces the outer surface
      // UP and FORWARD instead, over the front of the head only. It
      // peaks between the hairline and the crown and returns to zero at
      // both, because the outer surface meets the inner one at the crown
      // and a lift carried into that fold would tear the mass open.
      if (lift) {
        const fz = Math.max(0, Math.cos(az));
        const w = Math.sin(t * Math.PI) * fz * fz;
        return [p[0], p[1] + lift * shape.ry * w, p[2] + lift * shape.rz * .40 * w];
      }
      return p;
    });
  }
  // inner surface, crown → hem, hugging the head — and stopping a
  // little short of the hem so the rim tucks visibly under the mass
  for (let j = 0; j < ROWS; j++) {
    const t = j / (ROWS - 1);
    ring(az => {
      const hem = hemCol(az);
      const y = lerp(1.0, hem + .05, smooth(t));
      return pt(az, y, 1.015);
    });
  }

  // torus stitch: every ring to the next, and the last back to the
  // first — that final band of quads IS the hem's rounded rim
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

/** THE AHOGE — one strand off the crown, curling over. The cheapest
 *  character in the lab: eight vertices, and the single most chibi
 *  thing on a head. */
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
  if (!st || !L.shape) return [];
  const pt = pointer(L.shape);
  const ry = L.shape.ry;
  const vol = st.vol * H.vol;

  const out = [{ id: 'hair', mesh: hairMass(st, pt, H, L.shape) }];

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
