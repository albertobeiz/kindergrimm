// ---------------------------------------------------------------
// THE WAND — a stick with something on the end of it.
//
// The one family that SHOOTS. Everything else in the game happens at
// arm's length; a wand lets a kid lob a drawn marble across the room
// while the other hand is still busy swinging. So the HEAD is the
// thing that matters, and it is drawn big enough to read from the far
// side of the page: `tipR` is the marble's weight, its damage and how
// often one goes. The shaft is only how far the kid can poke — long
// and whippy, which is why a long one reaches but swings slow.
//
// The notches are the other half of the read: exactly `charges` nicks
// cut across the stick, and each one is one more marble in the air.
// You can count a wand's rate of fire off the paper.
//
// ANCHOR = THE GRIP, at (0,0), stick going up.
// ---------------------------------------------------------------
import { REF, finish, barPts, starPts } from './core.js';
import { chaikin } from '../sketch.js';

// What each head is FOR. A wand is a stick whatever you tie to it, so
// the shape is the only place the four can differ — and each one bends
// the same four throw numbers rather than inventing a fifth.
//   every  seconds between marbles (lower is better)
//   dmg    what one marble does
//   r      how big a hit it is, in world units
//   speed  how fast it crosses the room
const TIPS = {
  star:     { every: .84,  dmg: .95,  r: 1.00, speed: 1.15 },  // flicks them off
  crescent: { every: .98,  dmg: .90,  r: 1.12, speed: 1.30 },  // hooks them out flat
  knot:     { every: 1.20, dmg: 1.35, r: .92,  speed: .85 },   // heavy, slow, hurts
  bell:     { every: 1.06, dmg: 1.05, r: 1.24, speed: .95 },   // rings, spreads
};

// How far above the head's centre the drawing actually reaches, in
// units of `r`. The head is planted so every wand's total drawn height
// is exactly REF*len — the number that also buys the reach.
const RISE = { star: 1, crescent: .51, knot: 1, bell: .95 };
// And how far below that centre the shaft stops, so the stick always
// dies inside the head instead of poking out the far side.
const SEAT = { star: -.06, crescent: .48, knot: -.04, bell: -.12 };

// the four throw numbers, derived once so fxOf and desc can never
// disagree about what this wand does
function throwOf(P) {
  const T = TIPS[P.tip] ?? TIPS.star;
  const pow = P.pow ?? 1;
  return {
    // a fat head and a notched shaft both mean sooner
    every: Math.max(.5, (3.1 - P.tipR * 6) * T.every / (pow * (.88 + P.charges * .12))),
    dmg: (.35 + P.tipR * 3.2) * T.dmg * pow,
    speed: (6.5 + P.len * 3.2) * T.speed,
    r: (4.4 + P.tipR * 13) * T.r,
  };
}

export const Wand = {
  id: 'wand', slot: 'held', noun: 'wand', weight: 7,

  gen(rng, C) {
    // pow leans on the head, not the stick: a gilded wand is the one
    // with the ridiculous knob on the end, and you can see it coming
    const tipR = Math.max(.075, Math.min(.19, rng.r(.08, .18) + (C.pow - 1) * .06));
    return {
      len: rng.r(.55, .9),
      tip: C.wpick(rng, [['star', 4], ['crescent', 3], ['knot', 3], ['bell', 2]]),
      tipR,
      charges: rng.ri(1, 4),
      crook: rng.r(-.15, .15),
    };
  },

  statsOf(P) {
    const pow = P.pow ?? 1;
    return {
      add: {
        reach: (.25 + P.len * .8) * pow,      // the headline: it is a long stick
        dmg: (.12 + P.tipR * 1.5) * pow,      // and a light one — the head is the hit
      },
      // the trade: the longer the shaft the slower it comes round
      mul: { swingT: .93 + (P.len - .55) * .34 },
    };
  },

  fxOf(P) {
    return { throw: throwOf(P) };
  },

  adj(P) {
    const t = (P.tipR - .08) / .1;            // head
    const l = (P.len - .55) / .35;            // stick
    const c = Math.abs(P.crook) / .15;        // bend
    const g = (P.charges - 1) / 3;            // notches
    const bag = [[t, 'fat'], [l, 'long'], [c * .95, 'crooked'],
                 [g * .9, 'notched'], [(1 - l) * .7, 'stubby']];
    return bag.sort((a, b) => b[0] - a[0])[0][1];
  },

  desc(P) {
    return `lobs a marble every ${throwOf(P).every.toFixed(1)}s, and a fatter ${P.tip} lobs sooner`;
  },

  draw(s, P, F) {
    const L = REF * P.len;                    // grip to the very top
    const r = REF * P.tipR;                   // the head's drawn radius
    const lean = P.crook * 1.1;               // the head goes with the bend
    const cx = REF * P.crook, cy = -(L - r * (RISE[P.tip] ?? 1));
    const ex = cx * .95, ey = cy + r * (SEAT[P.tip] ?? 0);

    // the shaft: a tapered bar, then bowed sideways so no wand is ever
    // a ruler. `bend` projects a point onto the bar's own axis, so the
    // notches can ride the same curve.
    const dl = Math.hypot(ex, ey) || 1;
    const ux = ex / dl, uy = ey / dl;         // along
    const nx = -uy, ny = ux;                  // across
    const bow = REF * P.crook * .45;
    const bend = p => {
      const t = Math.max(0, Math.min(1, (p[0] * ux + p[1] * uy) / dl));
      const k = Math.sin(Math.PI * t) * bow;
      return [p[0] + nx * k, p[1] + ny * k];
    };
    const w0 = REF * .026, w1 = REF * .013;   // thick at the fist, whippy at the end
    finish(s, barPts(0, 0, ex, ey, w0, w1, 1).map(bend), P.rank,
      { lw: REF * .025, F, style: 'light' });

    // the head
    finish(s, headPts(s, P, cx, cy, r, lean), P.rank, { lw: REF * .033, F, style: 'hatch' });
    if (P.tip === 'bell') {
      s.ctx.fillStyle = s.inkA(.9);           // the clapper, hanging out
      s.wobbly(cx, cy + r * .95, r * .2, r * .24);
      s.ctx.fill();
    } else if (P.tip === 'knot') {
      for (const o of [-.3, .28]) {           // the string it is wound from
        const w = [];
        for (let i = 0; i <= 8; i++) {
          const u = -1 + i / 4;
          w.push([cx + u * r * .8, cy + o * r + Math.sin(Math.PI * (i / 8)) * r * .26 * Math.sign(o || 1)]);
        }
        s.sline(chaikin(w, false, 1), REF * .017, .55);
      }
    }

    // the charges: exactly P.charges nicks cut across the stick
    for (let i = 0; i < P.charges; i++) {
      const t = .17 + i * .13;
      const c = bend([ex * t, ey * t]);
      const hw = (w0 + (w1 - w0) * t) * 1.5 + REF * .005;
      const a = Math.atan2(ny, nx) + .34;     // all cut at the same slant
      s.sline([[c[0] - Math.cos(a) * hw, c[1] - Math.sin(a) * hw],
               [c[0] + Math.cos(a) * hw, c[1] + Math.sin(a) * hw]], REF * .019, .8);
    }
  },
};

// ---- the four heads ---------------------------------------------
// Whatever the shape, its drawn radius is `r` — that is the promise
// the stats are making, so nothing here may quietly draw smaller.
function headPts(s, P, cx, cy, r, lean) {
  if (P.tip === 'crescent') {
    // an arc pair: an outer sweep and an inner one that meets it at
    // both ends, so the horns come to a point instead of a stump
    const a0 = -.17 * Math.PI + lean, a1 = 1.17 * Math.PI + lean, N = 20;
    const out = [], back = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = a0 + (a1 - a0) * u;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      const k = 1 - .58 * Math.sin(Math.PI * u);
      back.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
    }
    return out.concat(back.reverse());
  }
  if (P.tip === 'knot') {
    return s.blobPts(cx, cy, r, r * .95, lean, .5);
  }
  if (P.tip === 'bell') {
    // neck, shoulder, flare, mouth. A bell hangs plumb, so it is the
    // one head that ignores the lean.
    const prof = [[-.28, -.95], [-.54, -.46], [-.86, .3], [-1, .72],
                  [-.6, .88], [0, .92], [.6, .88], [1, .72],
                  [.86, .3], [.54, -.46], [.28, -.95]];
    return chaikin(prof.map(p => [cx + p[0] * r, cy + p[1] * r]), true, 2);
  }
  // star: as many points as the shaft has notches, plus three — the
  // charges read twice, and a busier star gets a fatter waist so it
  // does not collapse into a spider
  const n = 3 + P.charges;
  return starPts(cx, cy, r * (.36 + n * .022), r, n, lean - Math.PI / 2);
}
