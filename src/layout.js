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
  const muzzle = Ps.skull.muzzle || 0;
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
      let r = 1 / Math.hypot(cA / rxR, sA / ryR);
      // drop: the crown pinches toward a point, the jowls stay full
      if (shape === 'drop' && sA < 0) r *= 1 - .30 * Math.pow(-sA, 1.6);
      // pear: narrow brow over heavy cheeks — the classic blob creature
      else if (shape === 'pear') r *= 1 - .26 * Math.pow(Math.max(0, -sA), 1.3) + .1 * Math.pow(Math.max(0, sA), 1.5);
      // lump: one side swells, like it was drawn without lifting the pen
      else if (shape === 'lump') r *= 1 + .12 * Math.sin(ang * 2 + 1) + .07 * Math.sin(ang * 3);
      // bumpy / wonky: the outline itself is the creature. Monsters
      // are not a face on a ball, they are a shape that has a face.
      else if (shape === 'bumpy') r *= 1 + .17 * Math.sin(ang * 3 + 1.2) + .1 * Math.sin(ang * 5 + .4);
      else if (shape === 'wonky') r *= 1 + .26 * Math.pow(Math.max(0, Math.cos(ang - .9)), 2) - .1 * Math.pow(Math.max(0, Math.cos(ang + 1.9)), 2);

      // THE MUZZLE, and the reason animals stopped looking like kids
      // in a costume: the snout is part of the head's outline, not a
      // shape stamped on the front of it.
      // The silhouette only swells a little — the muzzle itself is a
      // LOBE the skull draws over the jaw (see Skull.draw), because a
      // smooth bulge reads as a long chin, not as a snout.
      if (muzzle > 0) {
        const d = ang - Math.PI / 2;                    // 0 = straight down
        r *= 1 + muzzle * .45 * Math.exp(-(d * d) / (2 * .62 * .62));
      }
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

  // where the muzzle lobe ended up, so the nose and the mouth can sit
  // ON it instead of floating on a flat face
  const M = muzzle > 0
    ? { on: true,
        cx: turn * w * .12,
        cy: S * chinY * (1 + muzzle * .3) * .68,
        rx: w * (.34 + muzzle * .5),
        ry: S * chinY * (.18 + muzzle * .34) }
    : { on: false, cx: 0, cy: 0, rx: 0, ry: 0 };

  return { right, left, chin, skullTop, facePoly, outlineOpen, hairlinePts, capPts, M };
}

// ---------------- the features ----------------
function featureLayout(recipe, Ps, S, w, turn, at, ts, press, M) {
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
  const mx = fx * 1.15;
  // A muzzle owns the lower face: the nose sits on top of it and the
  // mouth underneath. Without one they fall back to the flat-face
  // positions. Parts read these and never work it out themselves.
  const noseY = M.on ? M.cy - M.ry * .42 : S * .29;
  const my = M.on ? M.cy + M.ry * .46 : S * Ps.mouth.myF;

  const rEx = geomRng(recipe, 'extras');
  const shadowSide = -ts;
  const markSide = rEx.chance(.5) ? -1 : 1;
  const modSide = at > .3 ? ts : (rEx.chance(.5) ? -1 : 1);

  return { fx, sx, ew0, eh, gaze, browY, lashW, eyeX, eyeW, ey0, ecxJit,
           nx, mw, my, mx, noseY, shadowSide, markSide, modSide };
}

// ---------------- the body ----------------
// One small block of numbers the torso, arms and legs all agree on.
// There is no neck: the head sits straight ON the body, overlapping
// its top — the Isaac silhouette. `floorY` is where the feet end, so
// scenes can stand every character on a floor line whatever its
// proportions are.
function bodyLayout(Ps, S, w, base) {
  const T = Ps.torso ?? { wF: .5, hF: .65 };
  const chinY = Ps.skull.chinY;
  // a muzzle pushes the chin down, and the body has to get out of its way
  const muzzle = Ps.skull.muzzle || 0;

  const top = S * chinY * (1 + muzzle * .62) - S * .14;   // the head overlaps the body

  // ---- SITTING: the animal on its haunches ----
  // Wider than tall, no legs to speak of, four paws on the floor: two
  // little ones at the front and two splayed at the sides. Every
  // anchor the paws need is published here.
  if (base === 'sit') {
    const halfW = w * Math.max(.62, T.wF * 1.35);
    const h = S * Math.max(.5, T.hF * .95);
    const bot = top + h;
    return {
      sit: true,
      top, bot, h, halfW,
      shoulderY: top + h * .3, shoulderX: halfW * .9,
      hipY: bot - h * .06, hipX: halfW * .45,
      frontPawX: halfW * .34, frontPawY: bot - S * .012,
      sidePawX: halfW * 1.0, sidePawY: bot - S * .03,
      pawR: S * .085,
      floorY: bot + S * .055,
    };
  }

  const halfW = w * T.wF;
  const h = S * T.hF;
  const bot = top + h;
  const hipY = bot - h * .06;

  const Lg = Ps.legs ?? { style: 'stub', len: .4, foot: 'oval' };
  const legLen = Lg.style === 'none' ? 0 : h * .5 * Lg.len;
  const footH = Lg.style === 'none' ? S * .02 : (Lg.foot === 'none' ? S * .02 : S * .062);
  const floorY = (Lg.style === 'none' ? bot : hipY + legLen) + footH;

  return {
    sit: false,
    top, bot, h, halfW,
    shoulderY: top + h * .22,
    shoulderX: halfW * .95,
    hipY,
    hipX: halfW * .42,
    floorY,
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
  const feats = featureLayout(recipe, Ps, S, w, turn, at, ts, press, head.M);
  const B = bodyLayout(Ps, S, w, recipe.base);

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
