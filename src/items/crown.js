// ---------------------------------------------------------------
// CROWN — the points ARE the energy, and you can count them.
//
// A crown in this school is cut out of paper with round-ended
// scissors: a band, a zigzag on top, and nothing else. That makes it
// the cleanest place in the whole catalogue to hang a COUNTABLE stat.
// Across the room you can see that the kid in the seven-pointed one
// is the one still going at the end of the night, and you never had
// to open a card to learn it.
//
// Everything else the family rolls serves that read. `height` is how
// far the points stand up, `band` is how much crown there is to wear,
// and `tilt` is only ever the fact that nobody wears a crown straight
// — a child who wears it like that is not thinking about it, so it
// costs them less to keep on.
//
// The jewel is the one thing here that is not about lasting: a stone
// carries a small circle of the child's own light, and in this game
// light is the only real defence. Two families can do that; this is
// the one you wear.
// ---------------------------------------------------------------
import { REF, finish } from './core.js';

const HW = REF * .40;        // half-width — the crown is REF*.8 across
const SAG = REF * .022;      // it is a hoop round a head, so the ends ride higher

const xAt = t => -HW + 2 * HW * t;
const arc = t => -SAG * (2 * t - 1) ** 2;   // 0 at the anchor, up at the ends

// The middle point of a crown is the tallest and no two are equal.
// `P.jag` was rolled ONCE in gen(): if this were s.jr() the teeth
// would breathe and the count would stop being readable.
function toothK(P, i) {
  const n = P.points;
  const half = (n - 1) / 2 || 1;
  return P.jag[i] * (1 - .2 * Math.abs(i - (n - 1) / 2) / half);
}

// The whole silhouette as one ring: underside left→right, up the
// right edge, then the teeth back across. Never smoothed — chaikin
// here would round the points off and cost the family its stat.
function shape(P) {
  const BT = REF * P.band, H = REF * P.height, n = P.points;
  const pts = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([xAt(t), arc(t)]); }
  pts.push([HW, arc(1) - BT]);
  for (let i = n - 1; i >= 0; i--) {
    const tp = (i + .5) / n, tv = i / n;
    pts.push([xAt(tp), arc(tp) - BT - H * toothK(P, i)]);
    pts.push([xAt(tv), arc(tv) - BT]);
  }
  return pts;
}

export const Crown = {
  id: 'crown', slot: 'worn', noun: 'crown', weight: 6,

  gen(rng, C) {
    // five is the crown a child draws; three and seven are the ones
    // they are pleased with
    const points = C.wpick(rng, [[3, 10], [4, 16], [5, 22], [6, 12], [7, 6]]);
    const jag = [];
    for (let i = 0; i < points; i++) jag.push(rng.r(.86, 1.08));
    return {
      points, jag,
      height: rng.r(.12, .30),
      band: rng.r(.06, .12),
      tilt: rng.r(-.12, .12),
      // a better-drawn crown was worth putting a stone on
      jewel: rng.chance(.28 + Math.max(0, C.pow - 1) * .6),
    };
  },

  statsOf(P) {
    const t = P.points - 3;               // teeth over the plain minimum, 0..4
    const tall = (P.height - .12) / .18;  // 0..1, how far they stand up
    const heft = (P.band - .06) / .06;    // 0..1, how much band there is
    const skew = Math.abs(P.tilt) / .12;  // 0..1, how crooked it sits

    const add = {
      // the countable one: teeth are energy, and taller teeth are more
      // of it. The band is the part that is actually comfortable.
      maxStam: (10 + t * 6.5) * (.85 + tall * .3) * (.85 + heft * .3) * P.pow,
    };
    if (P.jewel) add.lampR = 1.1 * P.pow;
    // worn crooked, which means worn without thinking about it
    const mul = skew ? { drain: 1 / (1 + .07 * skew * P.pow) } : {};
    return { add, mul };
  },

  adj(P) {
    const c = [
      ['spiky', (P.points - 3) / 4],
      ['tall', (P.height - .12) / .18],
      ['fat', (P.band - .06) / .06],
      ['crooked', Math.abs(P.tilt) / .12],
      ['bright', P.jewel ? .7 : 0],
    ];
    let best = c[0];
    for (const x of c) if (x[1] > best[1]) best = x;
    return best[1] < .45 ? 'little' : best[0];
  },

  desc(P) {
    const n = `${P.points} points, and every one of them is another hour up`;
    return P.jewel ? `${n}; the stone carries a little light of its own` : n;
  },

  draw(s, P, F) {
    const BT = REF * P.band, H = REF * P.height, n = P.points;
    s.ctx.save();
    s.ctx.rotate(P.tilt);                 // nobody wears a crown straight

    finish(s, shape(P), P.rank, { F, lw: REF * .032 });

    // where the band stops and the zigzag starts — the line that makes
    // the teeth countable rather than a lumpy outline
    const rim = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; rim.push([xAt(t), arc(t) - BT]); }
    s.sline(rim, REF * .022, .5);

    // a fold up the spine of each point: the count, said twice
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, x = xAt(t), y0 = arc(t) - BT;
      s.sline([[x, y0], [x, y0 - H * toothK(P, i) * .7]], REF * .018, .28);
    }

    if (P.jewel) {
      const r = Math.max(BT * .5, REF * .028), jy = -BT * .6;
      const g = s.blobPts(0, jy, r, r * .95, 0, .35);
      finish(s, g, P.rank, { F, lw: REF * .022 });
      s.hatchFill(g, REF * .028, -.7, .22, 1);      // glass, not a bump
      // the gleam: the tick a child puts on anything that shines
      const gx = r * 1.15, gy = jy - r * 1.15, a = REF * .055;
      s.sline([[gx - a, gy], [gx + a, gy]], REF * .016, .7);
      s.sline([[gx, gy - a * .7], [gx, gy + a * .7]], REF * .016, .7);
    }

    s.ctx.restore();
  },
};
