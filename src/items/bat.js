// ---------------------------------------------------------------
// THE BAT — the knockback family.
//
// A club, and a club is one idea: almost all of the wood is in the
// last third. `fat` is the head's half-width, and it is the whole
// item at once — the silhouette, the shove it gives, and the reason
// it is slow to bring back round. You can see a heavy one coming
// from the other side of the room.
//
// Nails are COUNTED. Five nails is five wedges in the paper and five
// helpings of extra bite; there is no hidden roll deciding either.
// And nothing here reaches: it is short, that is the trade, and the
// family never touches `reach`.
//
// The barrel is sampled from a profile rather than one straight
// `barPts` taper, because a linear taper draws a carrot. The handle
// runs parallel, the swell happens over the middle, and the end is
// blunt.
// ---------------------------------------------------------------
import { REF, finish, barPts } from './core.js';
import { smooth, circlePts } from '../sketch.js';

const cl = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const fatN = P => cl((P.fat - .06) / .10);   // 0 = broomstick, 1 = log
const lenN = P => cl((P.len - .5) / .45);

// The silhouette, as functions of t (0 at the butt, 1 at the tip).
// Everything else in draw() hangs off this so the nails, the tape and
// the knot all sit ON the wood at whatever width it happens to be.
function profile(P) {
  const y0 = REF * .055;                 // a little butt below the fist
  const y1 = -REF * P.len;
  const w0 = REF * .035;                 // the handle: always thin
  const w1 = REF * P.fat;                // the head: the headline
  const yAt = t => y0 + (y1 - y0) * t;
  const hAt = t => {
    if (t < .07) return w0 * (1.45 - .45 * (t / .07));   // the knob
    if (t < .40) return w0;                              // the grip
    if (t < .80) return w0 + (w1 - w0) * smooth((t - .40) / .40);
    if (t < .93) return w1;                              // the barrel
    const u = (t - .93) / .07;                           // blunt end
    return w1 * (.2 + .8 * Math.sqrt(Math.max(0, 1 - u * u)));
  };
  return { y0, y1, w0, w1, yAt, hAt };
}

export const Bat = {
  id: 'bat',
  slot: 'held',
  noun: 'bat',
  weight: 9,

  gen(rng, C) {
    return {
      len: rng.r(.5, .95),
      fat: rng.r(.06, .16),
      // most bats are plain wood; a hammered one is an event
      nails: C.wpick(rng, [[0, 34], [1, 20], [2, 16], [3, 11], [4, 7], [5, 4]]),
      tape: rng.chance(.55),
      knot: rng.chance(.35),
    };
  },

  // knock is the family's headline and comes off `fat`. dmg is the
  // second string and comes mostly off the nails you can count. The
  // swing cost is deliberately NOT scaled by pow — a gilded bat is
  // better, not clumsier, and the cost stays legible as "it is fat".
  statsOf(P) {
    const f = fatN(P), l = lenN(P), pow = P.pow ?? 1;
    return {
      add: {
        dmg: (.18 + f * .20 + P.nails * .085 + (P.knot ? .18 : 0)) * pow,
      },
      mul: {
        knock: 1 + (.26 + f * .44 + l * .12) * pow,
        swingT: (1.04 + f * .26 + l * .10) * (P.tape ? .92 : 1),
      },
    };
  },

  adj(P) {
    const f = fatN(P), l = lenN(P);
    if (P.nails >= 4) return 'nailed';
    if (f > .62 && l < .45) return 'stubby';
    if (f > .62) return 'fat';
    if (l > .66) return 'long';
    if (l < .25) return 'stubby';
    if (P.nails >= 2) return 'nailed';
    if (P.knot) return 'knotty';
    if (P.tape) return 'taped';
    return 'plain';
  },

  desc(P) {
    if (P.nails >= 3) return 'someone went at it with a hammer, and every nail counts';
    if (P.nails > 0) return 'the nails are the part that bites';
    if (fatN(P) > .6) return 'all the weight is in the head, and so is all the shove';
    if (P.knot) return 'the knot is the hardest bit of the wood';
    return 'slow to swing, but they go a long way';
  },

  draw(s, P, F) {
    const g = profile(P);

    // ---- the wood ------------------------------------------------
    // sampled down both sides; jw is sub-linewidth, so it boils but
    // never changes the shape
    const N = 28, jw = REF * .005;
    const lft = [], rgt = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, y = g.yAt(t), h = g.hAt(t);
      lft.push([-h + s.jr(-jw, jw), y + s.jr(-jw, jw)]);
      rgt.push([h + s.jr(-jw, jw), y + s.jr(-jw, jw)]);
    }
    finish(s, lft.concat(rgt.reverse()), P.rank, { lw: REF * .032, F });

    // grain: two lines that follow the swell, so it reads as turned wood
    for (const sd of [-.45, .30]) {
      const ln = [];
      for (let i = 0; i <= 10; i++) {
        const t = .12 + (i / 10) * .78;
        ln.push([g.hAt(t) * sd, g.yAt(t)]);
      }
      s.sline(ln, REF * .014, .26);
    }

    // ---- the knot ------------------------------------------------
    if (P.knot) {
      const kt = .62, kh = g.hAt(kt);
      const kr = Math.min(REF * .05, kh * .62);
      const kx = -kh * .28, ky = g.yAt(kt);
      const o = circlePts(kx, ky, kr, kr * .82, 14);
      s.sline(o.concat([o[0]]), REF * .018, .5);
      const sw = [];                                   // the grain swirling round it
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 3.4;
        const r = kr * (.14 + .62 * (i / 24));
        sw.push([kx + Math.cos(a) * r * 1.1, ky + Math.sin(a) * r * .9]);
      }
      s.sline(sw, REF * .015, .42);
    }

    // ---- the tape ------------------------------------------------
    // a longer bat has a longer handle and gets the fourth wrap — the
    // count is read off `len`, never rolled
    if (P.tape) {
      const wraps = (g.y0 - g.y1) * .4 > REF * .28 ? 4 : 3;
      const span = .34 / wraps;
      for (let i = 0; i < wraps; i++) {
        const t0 = .05 + i * span, t1 = t0 + span * .55;
        s.sline([[-g.hAt(t0) * 1.18, g.yAt(t0)], [g.hAt(t1) * 1.18, g.yAt(t1)]],
          REF * .022, .62);
      }
      const te = .05 + (wraps - 1) * span + span * .55;   // where the tape stops
      s.sline([[-g.hAt(te) * 1.2, g.yAt(te)], [g.hAt(te) * 1.2, g.yAt(te)]],
        REF * .02, .5);
    }

    // ---- the nails -----------------------------------------------
    // spaced evenly over the head, alternating sides, angled toward
    // the tip. `ph` is a wobble frozen out of P itself: it varies
    // between bats and holds perfectly still on any one of them.
    const ph = P.len * 31.7 + P.fat * 97.3;
    for (let i = 0; i < P.nails; i++) {
      const side = i % 2 ? 1 : -1;
      const t = .60 + ((i + .5) / P.nails) * .30;
      const y = g.yAt(t), h = g.hAt(t), L = REF * .06;
      const rise = L * (.25 + .3 * (.5 + .5 * Math.sin(ph + i * 2.1)));
      const x0 = side * (h - REF * .012);
      const wedge = barPts(x0, y, x0 + side * L, y - rise,
        REF * .024, REF * .005, 0);
      finish(s, wedge, P.rank, { lw: REF * .019, F });
      // the wood splitting where it went in
      s.sline([[x0, y + REF * .004], [x0 - side * REF * .055, y + REF * .022]],
        REF * .013, .35);
    }
  },
};
