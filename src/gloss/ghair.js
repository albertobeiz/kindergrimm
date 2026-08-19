// ---------------------------------------------------------------
// THE HAIR — the humanoid's, and the fourth thing this lab knows how to
// build. Not a plate and not a solid: a LOFTED SHELL over the skull,
// subdivided like the skull itself.
//
// THE ONE IDEA. A haircut is a single curve: the line where the hair
// stops. Run that line around the head — low across the forehead for a
// fringe, up at the temples to clear the ears, down past the jaw at the
// back for length — and everything above it is hair. So the whole
// silhouette vocabulary is one function of azimuth, `hemAt(ang)`, and a
// style is a handful of numbers feeding it:
//
//        front ────╮                       ang = 0 is the face
//                  ╰── side ──╮            +ang toward the toy's left
//                             ╰── back     y = +1 crown, −1 chin,
//                                          below −1 is off the head
//
// A bob and a pixie are the same mesh with a different hem. That is why
// there is no separate "long hair" model: below the chin the profile
// freezes the head's radius and the loft just keeps going down, which
// is what falling hair does.
//
// Everything else is one more small piece: tails and buns and the ahoge
// are TUBES (`strand`), and a bun is the body's own solid primitive.
//
// This file never touches three.js. It hands back `{verts, faces}` the
// same way `gskull.js` does, and `grig.js` stamps it.
// ---------------------------------------------------------------
import { subdivideN } from './catmullClark.js';

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
// `front` / `side` / `back` are the hem in CAGE HEIGHT (see the header).
// Useful landmarks on this scale: the crown is +1, the brow about 0, the
// eyes about −.28, the chin −1. So a `front` of .35 is a bare forehead,
// .05 is a fringe sitting on the brows, and anything under −1.1 is hair
// past the jaw.
//
//   vol    how far the cap stands off the skull — hair's thickness
//   wave   ripple in that thickness; `waveN` how many around the head
//   part   lifts the hem on one side only: a side parting
//   spike  spikes the crown
//   tails  1 = one at the back, 2 = a pair
//   buns   a pair on top
//   fluff  extra volume up at the crown, for the big soft cuts
const STYLE = {
  bald: null,

  // --- short: the hem stays on the head --------------------------------
  // NOTE THE BACKS. They are all far lower than the fronts and sides,
  // because hair carries on down the back of the skull to the nape.
  // Given a hem roughly level all the way round — which is what a first
  // pass gets you — the shell becomes a ring sitting on top of the head
  // and every short cut reads as an ACORN CAP rather than as hair.
  // …and the SIDES sit below the front, not above it. The temple is the
  // one place hair reliably comes down past the brow, so a hem that is
  // level from nose to ear cuts the head on a straight line — the same
  // acorn again, seen from the front this time. Fringe high, temples
  // lower, nape lowest: that ordering is the whole read.
  crop:  { front: .40, side: .10, back: -.35, vol: .050 },
  pixie: { front: .30, side: -.10, back: -.55, vol: .070 },
  bowl:  { front: .04, side: -.30, back: -.62, vol: .080 },
  spiky: { front: .36, side: .02, back: -.45, vol: .065, spike: .10, spikeN: 7 },
  side:  { front: .10, side: -.20, back: -.60, vol: .080, part: .26 },
  curly: { front: .18, side: -.25, back: -.55, vol: .125, wave: .16, waveN: 8,
           fluff: .07 },

  // --- long: the hem drops off the head and the loft follows it --------
  // `open` holds the face arc further round before the length starts.
  // Without it the hair begins falling at the cheekbone and a long cut
  // closes into a HOOD with a little face at the bottom of it. Held to
  // ~75° the length starts behind the cheek, which is where hair
  // actually hangs. `hime` gets less of it on purpose — locks framing
  // the face are the whole point of that cut.
  bob:   { front: .16, side: -1.02, back: -1.20, vol: .075, open: .34 },
  wavy:  { front: .14, side: -1.35, back: -1.55, vol: .085, wave: .085, waveN: 5,
           open: .34 },
  long:  { front: .18, side: -2.00, back: -2.30, vol: .080, open: .38 },
  hime:  { front: .02, side: -2.15, back: -2.45, vol: .080, open: .14 },

  // --- tied up: a short base plus a piece ------------------------------
  pony:  { front: .16, side: -.10, back: -.50, vol: .070, tails: 1 },
  twin:  { front: .16, side: -.15, back: -.55, vol: .070, tails: 2 },
  buns:  { front: .14, side: -.18, back: -.55, vol: .070, buns: 2 },
};

export const HAIR_STYLES = Object.keys(STYLE);
/** does this style hang below the jaw? the layout has no use for it, but
 *  the CROWD does — a long-haired toy needs its cell measured taller. */
export const isLongHair = id => (STYLE[id]?.side ?? 1) < -1;

const A = 28;          // azimuth samples around the head
const RINGS = 7;       // loft rings from hem to crown
const SUBDIV = 2;      // the cap is big and smooth; 3 is wasted on it

/**
 * THE HEM, and with it the whole haircut.
 *
 * Blended from three numbers with a shaped falloff rather than a plain
 * cosine: a cosine peaks at exactly one azimuth, which gives a fringe
 * that comes to a point over the nose. This is flat across the front
 * ~50° and then falls away, which is a cut fringe.
 */
// where the face arc holds and where it lets go, in radians off the
// nose. Driven by the ANGLE, not by `cos(ang)`: a cosine blend starts
// closing the moment it leaves the nose, so the hem was already
// half-way to the side by 45° and the hair swallowed the temples and
// most of the cheeks. Held flat to ~55° and released by ~89°, it reads
// as a cut fringe with the face actually showing under it.
const FACE_HOLD = .95, FACE_END = 1.55;
const BACK_START = 1.95, BACK_END = 2.6;

function hemAt(st, ang, H) {
  const a = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));   // 0..π off the nose
  const o = st.open ?? 0;
  const hold = FACE_HOLD + o, end = FACE_END + o;
  const fw = 1 - smooth(clamp((a - hold) / (end - hold), 0, 1));
  const bw = smooth(clamp((a - Math.max(BACK_START, end + .1)) /
                          (BACK_END - Math.max(BACK_START, end + .1)), 0, 1));
  let v = st.side + (st.front - st.side) * fw + (st.back - st.side) * bw;
  // a parting lifts one temple and only shows across the front
  if (st.part) v += st.part * Math.sin(ang) * fw * H.part;
  return v;
}

/** how far off the skin the cap sits at ring `j` (0 = the hem). */
function inflAt(st, ang, j, H) {
  // ring 0 is INSIDE the head: it is the hair's cut edge, and burying it
  // is what stops a gap showing along the hairline. Only JUST inside,
  // though — buried deep it gave the shell a thick blunt rim all round
  // the hem and every short cut came out an acorn cap.
  if (j === 0) return .985;
  const t = j / (RINGS - 1);
  // THIN AT THE CUT, THICK OVER THE CROWN — hair has no volume at the
  // line where it was cut and all of it up top. A flat ramp gives a
  // helmet of even thickness, which is the same acorn from the inside.
  let v = 1 + (st.vol * H.vol) * (.18 + .82 * smooth(t));
  if (st.fluff) v += st.fluff * smooth(t) * H.vol;
  if (st.wave) v += st.wave * H.wave * Math.sin(ang * (st.waveN ?? 5) + t * 2.4) * t;
  if (st.spike) v += st.spike * Math.abs(Math.sin(ang * (st.spikeN ?? 7))) * smooth(t) ** 2;
  return v;
}

/** the cap: one closed shell, hem to crown. */
function capMesh(st, prof, H) {
  const verts = [], rings = [];
  for (let j = 0; j < RINGS; j++) {
    const ring = [];
    for (let i = 0; i < A; i++) {
      const ang = i / A * Math.PI * 2;
      const hem = hemAt(st, ang, H);
      // Every column runs from its OWN hem up to the crown, so ring j is
      // a parallel of the hem rather than a line of constant height.
      // That is what lets one loft carry a fringe and a waist-length
      // back at the same time.
      const t = j / (RINGS - 1);
      const y = lerp(hem, 1.0, smooth(t) * .82 + t * .18);
      verts.push(prof.pointAt(y, ang, inflAt(st, ang, j, H)));
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
  // both ends closed with one n-gon — Catmull-Clark takes any arity, and
  // the bottom one is buried in the head where nobody will ever see it
  faces.push(rings[RINGS - 1].slice());
  faces.push(rings[0].slice().reverse());
  return subdivideN({ verts, faces }, SUBDIV);
}

/**
 * A TUBE along a path — a tail, a lock, the ahoge. Rings are carried
 * along the curve by PARALLEL TRANSPORT (each frame is the last one
 * projected onto the new normal plane) instead of being rebuilt from a
 * fixed up-vector, which would spin the tube where the path turns
 * vertical and pinch it into an hourglass.
 */
function strand(path, radii, sides = 8, subdiv = 2) {
  const verts = [], rings = [];
  let nrm = null;
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const t = norm(sub(b, a));
    if (!nrm) nrm = cross(Math.abs(t[1]) < .9 ? [0, 1, 0] : [1, 0, 0], t);
    else { const d = dot(nrm, t); nrm = [nrm[0] - t[0] * d, nrm[1] - t[1] * d, nrm[2] - t[2] * d]; }
    nrm = norm(nrm);
    const bi = cross(t, nrm);
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a2 = k / sides * Math.PI * 2;
      const c = Math.cos(a2) * radii[i], s = Math.sin(a2) * radii[i];
      verts.push([path[i][0] + nrm[0] * c + bi[0] * s,
                  path[i][1] + nrm[1] * c + bi[1] * s,
                  path[i][2] + nrm[2] * c + bi[2] * s]);
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

/** a tail hanging from an anchor on the head: out, then down, then a
 *  flick. Tapered, so it reads as a bunch of hair and not a sausage. */
function tailAt(prof, ang, y, len, thick, flick) {
  const root = prof.pointAt(y, ang, 1.03);
  const out = norm([root[0], 0, root[2]]);
  // HOW FAR IT STANDS OFF is a fact about the HEAD, not about how long
  // the hair is. Scaled by `len`, a waist-length pair of tails swung a
  // whole head-radius clear on each side, the sheet fitted the cell to
  // that width, and the face shrank to half the size of its
  // short-haired neighbours'. Tie the reach to the head and a long tail
  // just hangs longer.
  const reach = prof.height * .40;
  const N = 7, path = [], radii = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    // OUT FIRST, then down. The `.30` base is what makes it a pigtail
    // rather than a sideburn: with the swing starting at zero the tail
    // leaves the head straight downward and hangs against the cheek,
    // and the whole silhouette of a tied-up style is that it stands
    // clear of the head before it falls.
    const outward = (.30 + Math.sin(t * 1.45) * .80) * (1 - t * .22) + flick * t * t;
    const drop = -len * smooth(t);
    path.push([root[0] + out[0] * outward * reach,
               root[1] + drop,
               root[2] + out[2] * outward * reach - len * .10 * t]);
    radii.push(thick * (1 - .62 * t * t) * (t < .12 ? .8 + t * 1.7 : 1));
  }
  return strand(path, radii);
}

/** the AHOGE — one strand standing off the crown and curling over. The
 *  cheapest character in the lab: it costs eight vertices and it is the
 *  single most chibi thing on the head. */
function ahogeAt(prof, H) {
  const root = prof.pointAt(.92, H.ahogeAng, 1.0);
  const h = prof.height, N = 7, path = [], radii = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    path.push([root[0] + Math.sin(t * 2.6) * h * .16 * H.ahogeDir,
               root[1] + h * (.30 * Math.sin(t * 1.5)),
               root[2] + h * .10 * Math.sin(t * 2.1)]);
    radii.push(h * .030 * (1 - .78 * t));
  }
  return strand(path, radii, 6, 2);
}

/**
 * P.hair + the layout → a list of `{ mesh }` and `{ ball }` pieces.
 * The PART turns these into specs; this file has no opinion about
 * materials, colours or three.js.
 */
export function buildHair(P, L) {
  const H = P.hair;
  const st = STYLE[H.style];
  const prof = L.profile;
  if (!st || !prof) return [];          // bald, or a body with no skull

  const out = [{ id: 'hair', mesh: capMesh(st, prof, H) }];
  const h = prof.height;

  if (st.tails === 2) {
    for (const s of [-1, 1])
      out.push({ id: 'hairTail' + (s < 0 ? 'L' : 'R'),
                 mesh: tailAt(prof, s * H.tailAng, H.tailY,
                              h * H.tailLen, h * .17, s * .12) });
  } else if (st.tails === 1) {
    out.push({ id: 'hairTail',
               mesh: tailAt(prof, Math.PI, H.tailY, h * H.tailLen * 1.15, h * .20, 0) });
  }

  if (st.buns) {
    for (const s of [-1, 1]) {
      const p = prof.pointAt(.72, s * H.bunAng, 1.02);
      out.push({ id: 'hairBun' + (s < 0 ? 'L' : 'R'),
                 ball: { r: h * H.bunR, pos: p } });
    }
  }

  if (H.ahoge) out.push({ id: 'hairAhoge', mesh: ahogeAt(prof, H) });
  return out;
}
