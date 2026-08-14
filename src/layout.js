// ---------------------------------------------------------------
// LAYOUT — the shared skeleton every part measures itself against.
//
// Parts must not invent their own anchors. If two parts need to agree
// on a position (the brows sit over the eyes, the arms hang off the
// torso), that position is computed ONCE here and read from `F`.
//
// Everything here is in CHARACTER COORDINATES: pixels, y pointing
// DOWN, origin at the centre of the head. The body simply continues
// downward into positive y.
//
// The rngs used here are seeded separately from the line boil, so the
// construction holds still while the ink is redrawn each frame.
// ---------------------------------------------------------------
import { chaikin, SKINC, HAIRCOL, ACCENTC } from './sketch.js';
import { MEDIA } from './media.js';
import { makeRng, hashStr } from './rng.js';
import { U } from './part.js';

const geomRng = (recipe, id) =>
  makeRng(hashStr(`${recipe.seed}:geom:${id}:${recipe.parts[id]?.rr || 0}`));

// eye opening height and lash weight per eye type, as a fraction of
// the head scale. A new eye type needs an entry in both or it falls
// back to the default and will look slightly off.
const EH = {
  saucer: .10, dot: .07, hollow: .10, void: .095, wide: .105, xcross: .08,
  sparkle: .10, sleepy: .085, star: .10, spiral: .09, happy: .08,
  angry: .085, sunken: .085, closed: .07,
};
const LASH = {
  saucer: .05, dot: .05, hollow: .05, void: .05, wide: .05, xcross: .052,
  sparkle: .05, sleepy: .05, star: .05, spiral: .05, happy: .05,
  angry: .052, sunken: .045, closed: .045,
};

// ---------------- the head ----------------
function headLayout(recipe, Ps, S, w) {
  const turn = Ps.skull.turn;
  const at = Math.abs(turn), ts = Math.sign(turn) || 1;
  const rSk = geomRng(recipe, 'skull');
  const aj = () => rSk.r(-.028, .028) * S;
  const { jaw, chinW, skullY, chinY } = Ps.skull;

  // skull keypoints: the near side of a turned head swells, the far
  // side collapses, chin and crown push toward where the face points
  const kp = side => {
    const sc = 1 + (side === ts ? .1 : -.28) * at;
    return [
      [side * w * .80 * sc + aj(), -S * skullY * .72 + aj()],
      [side * w * .97 * sc + aj(), -S * .20 + aj()],
      [side * w * .94 * sc + aj(), S * .15 + aj()],
      [side * w * .80 * jaw * sc + aj(), S * chinY * .6 + aj()],
      [side * w * .34 * chinW * sc + aj(), S * chinY * .92 + aj()],
    ];
  };
  let right = kp(1), left = kp(-1);
  let chin = [turn * w * .3, S * chinY + aj() * .5];
  let skullTop = [turn * w * .16, -S * skullY];

  let facePoly = chaikin([skullTop, ...right, chin, ...left.slice().reverse()], true, 2);
  // one smoothing pass only: fast sketches keep a hint of the polygon
  let outlineOpen = chaikin([right[0], ...right.slice(1), chin, ...left.slice(1).reverse(), left[0]], false, 1);

  // The doodle head slides its DENSE outline part-way onto one TARGET
  // SHAPE (after smoothing, so a brick keeps its corners). The shape
  // family is what separates one creature from the next.
  //
  // TO ADD A HEAD SHAPE: add a name to Skull.gen's `shape` pick list,
  // then add a case to `radius` below returning the distance from the
  // centre to the outline at angle `ang`.
  const round = Ps.skull.round || 0;
  if (round > 0) {
    const shape = Ps.skull.shape || 'round';
    const cyR = S * (chinY - skullY) / 2;
    let rxR = w * 1.06, ryR = S * (chinY + skullY) / 2;
    if (shape === 'tall') { rxR *= .8; ryR *= 1.14; }
    if (shape === 'wide') { rxR *= 1.2; ryR *= .82; }
    const radius = ang => {
      const cA = Math.cos(ang), sA = Math.sin(ang);
      if (shape === 'square') {
        // superellipse: flat cheeks and crown, corners barely rounded
        const n = 5.5;
        return 1 / Math.pow(Math.pow(Math.abs(cA / rxR), n) + Math.pow(Math.abs(sA / ryR), n), 1 / n);
      }
      const r = 1 / Math.hypot(cA / rxR, sA / ryR);
      // drop: the crown pinches toward a point, the jowls stay full
      if (shape === 'drop' && sA < 0) return r * (1 - .30 * Math.pow(-sA, 1.6));
      // pear: narrow brow over heavy cheeks — the classic blob creature
      if (shape === 'pear') return r * (1 - .26 * Math.pow(Math.max(0, -sA), 1.3) + .1 * Math.pow(Math.max(0, sA), 1.5));
      // lump: one side swells, like it was drawn without lifting the pen
      if (shape === 'lump') return r * (1 + .12 * Math.sin(ang * 2 + 1) + .07 * Math.sin(ang * 3));
      return r;
    };
    const roundPt = p => {
      const ang = Math.atan2((p[1] - cyR) / ryR, p[0] / rxR);
      const rr = radius(ang);
      return [p[0] + (Math.cos(ang) * rr - p[0]) * round,
              p[1] + (cyR + Math.sin(ang) * rr - p[1]) * round];
    };
    facePoly = facePoly.map(roundPt);
    outlineOpen = outlineOpen.map(roundPt);
    right = right.map(roundPt);
    left = left.map(roundPt);
    chin = roundPt(chin);
    skullTop = roundPt(skullTop);
  }

  const hairlinePts = [[-.75 * w, -.55 * S], [-.4 * w, -.66 * S],
                       [turn * w * .12, (-.70 + (rSk.chance(.4) ? .05 : 0)) * S],
                       [.4 * w, -.66 * S], [.75 * w, -.55 * S]];
  const capPts = chaikin([...hairlinePts, [.80 * w, -S * skullY * .72],
                          [turn * w * .12, -S * skullY * 1.0], [-.80 * w, -S * skullY * .72]], true, 2);

  return { right, left, chin, skullTop, facePoly, outlineOpen, hairlinePts, capPts };
}

// ---------------- the features ----------------
function featureLayout(recipe, Ps, S, w, turn, at, ts, press) {
  const rEy = geomRng(recipe, 'eyes');
  const E = Ps.eyes;
  const fx = turn * w * .3;                     // the face's own centre line
  const sx = w * E.sx;
  const ew0 = w * .32 * E.scale;
  const eh = (EH[E.type] ?? .09) * S * E.ehJit * E.scale;
  const gaze = ew0 * (turn * .35 + E.gazeJit);
  const browY = -eh * 1.2 - S * Ps.brows.yF;
  const lashW = (LASH[E.type] ?? .048) * S * press;
  const eyeX = sd => fx + sd * sx * (sd === ts ? 1 + .04 * at : 1 - .38 * at);
  const eyeW = sd => ew0 * (sd === ts ? 1 - .05 * at : 1 - .55 * at);
  const ey0 = { [-1]: rEy.r(-.022, .022) * S, [1]: rEy.r(-.022, .022) * S };
  const ecxJit = { [-1]: rEy.r(-.028, .028) * S * .4, [1]: rEy.r(-.028, .028) * S * .4 };

  const nx = turn * w * .5;
  const mw = w * .30 * (1 - .25 * at) * Ps.mouth.wF;
  const my = S * Ps.mouth.myF, mx = fx * 1.15;

  const rEx = geomRng(recipe, 'extras');
  const shadowSide = -ts;
  const markSide = rEx.chance(.5) ? -1 : 1;
  const modSide = at > .3 ? ts : (rEx.chance(.5) ? -1 : 1);

  return { fx, sx, ew0, eh, gaze, browY, lashW, eyeX, eyeW, ey0, ecxJit,
           nx, mw, my, mx, shadowSide, markSide, modSide };
}

// ---------------- the body ----------------
// One small block of numbers the torso, arms and legs all agree on.
// Everything hangs off where the neck stops.
function bodyLayout(Ps, S, w) {
  const T = Ps.torso ?? { wF: .6, hF: .8 };
  const neckLen = Ps.neck?.len ?? .16;
  const chinY = Ps.skull.chinY;

  const top = S * (chinY + neckLen) - S * .04;   // tucked under the neck
  const halfW = w * T.wF;
  const h = S * T.hF;
  const bot = top + h;
  return {
    top, bot, h, halfW,
    shoulderY: top + h * .18,
    shoulderX: halfW * .92,
    hipY: bot - h * .05,
    hipX: halfW * .44,
  };
}

// ---------------- the whole character ----------------
export function buildLayout(recipe, Ps) {
  const S = Ps.skull.s * U;                      // the head scale, px
  const w = S * Ps.skull.wf;                     // head half width, px
  const turn = Ps.skull.turn;
  const at = Math.abs(turn), ts = Math.sign(turn) || 1;
  const press = Ps.skull.press;                  // how hard the pencil is pressed

  const head = headLayout(recipe, Ps, S, w);
  const feats = featureLayout(recipe, Ps, S, w, turn, at, ts, press);
  const B = bodyLayout(Ps, S, w);

  // the casting: which of the muted colours this character gets, if any
  const mode = recipe.color || 'auto';
  const plain = mode === 'plain' || (mode === 'auto' && Ps.skull.plain);
  const colors = {
    plain,
    skin: !plain && Ps.skull.skinOn ? SKINC[Ps.skull.skinIdx % SKINC.length] : null,
    hairCol: !plain && Ps.hair.colOn ? HAIRCOL[Ps.hair.colIdx % HAIRCOL.length] : null,
    cloth: !plain && Ps.torso?.clothOn ? SKINC[(Ps.torso.clothIdx ?? 0) % SKINC.length] : null,
    accent: ACCENTC[(Ps.extras.accentIdx ?? 0) % ACCENTC.length],
    blush: !plain && Ps.extras.blush,
  };

  return {
    U,
    s: S, w, turn, at, ts, press,
    lwMain: S * .05 * press,        // contour weight
    lwThin: S * .021 * press,       // detail weight
    P: Ps,
    colors,
    media: MEDIA[recipe.media] ?? MEDIA.graphite,
    L: { ...head, ...feats },       // head + features
    B,                              // body
  };
}
