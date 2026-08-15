// ---------------------------------------------------------------
// THE SWORD — the family where the headline stat is a LENGTH.
//
// Everything else in the toybox has to translate its numbers into a
// picture. A sword doesn't: the blade IS the reach bar, drawn at
// scale. Hold two of them next to each other and the better one is
// obviously the better one, from across the room, with no card.
//
// So the shape is built from a spine rather than from `barPts`: the
// notches have to be BITTEN out of the contour (a nick drawn on top
// of a clean edge is a scratch, not damage), and four chaikin'd
// corners have nowhere to put a bite. `barPts` still does the two
// honest bars — the guard and the grip.
//
// The trade is legible on the paper too: the crossbar is the thing
// that keeps the blade off your fingers, so it is what lets a child
// hold on all night — and every bite out of the edge takes a little
// of that back.
// ---------------------------------------------------------------
import { REF, finish, barPts } from './core.js';
import { circlePts } from '../sketch.js';

// The skeleton, in REF units. The fist closes at (0,0), so the grip
// straddles the origin and the hand rides up against the guard.
const GRIP_TOP = -REF * .11;
const GRIP_BOT = REF * .075;
const GUARD_Y = -REF * .115;
const BASE_Y = -REF * .105;        // where the blade leaves the guard
const RUN = REF * .665;            // blade length at bladeLen = 1
const POM_Y = REF * .100;
const NW = .06;                    // how much of the blade's LENGTH one bite spans

export const Sword = {
  id: 'sword',
  slot: 'held',
  noun: 'sword',
  weight: 10,

  gen(rng, C) {
    const bladeLen = rng.r(.5, 1);
    const bladeW = rng.r(.04, .10);
    // a guard narrower than the blade is not a guard, it's a bump
    const guardW = Math.max(rng.r(.09, .20), bladeW * 1.6);
    const notches = C.wpick(rng, [[0, 5], [1, 4], [2, 2], [3, 1]]);

    // Notch POSITIONS are rolled here, once. Rolled in draw() they
    // would crawl up and down the blade twice a second.
    const notchSide = rng.chance(.5) ? 1 : -1;
    const notchT = [];
    for (let i = 0; i < notches; i++) {
      // banded, and kept off the last third: out there the blade is
      // already narrow and a bite would read as a snapped tip
      const a = .20 + .50 * (i / notches), b = .20 + .50 * ((i + 1) / notches);
      notchT.push(rng.r(a + (b - a) * .2, b - (b - a) * .2));
    }

    return {
      bladeLen, bladeW,
      guard: rng.chance(.72), guardW,
      pommel: C.wpick(rng, [['knob', 5], ['ring', 3], ['none', 2]]),
      notches, notchT, notchSide,
      curve: rng.r(-.12, .12),
    };
  },

  // Every roll lands somewhere you can point at on the paper:
  //   the blade's length   → damage and reach
  //   the bites in it      → more damage, less of it left to hold
  //   the blade's fatness  → knockback, paid for in swing time
  //   the lean             → knockback traded against reach
  //   the crossbar         → energy: your fingers stay on it
  //   the pommel           → one small thing each, incl. having none
  statsOf(P) {
    const k = P.pow ?? 1;
    const lenN = (P.bladeLen - .5) / .5;
    const fatN = (P.bladeW - .04) / .06;
    const bentN = Math.abs(P.curve) / .12;

    const add = {
      dmg: k * (.60 * lenN + .14 * P.notches),
      reach: k * .42 * lenN - .30 * bentN,
      maxStam: (P.guard ? k * (5 + P.guardW * 22) : 0) - P.notches * 2.5,
    };
    // the heft penalty is NOT scaled by pow: a finer sword is never a
    // worse one, it just carries the same weight better
    const mul = {
      swingT: 1 + .24 * (.55 * lenN + .45 * fatN),
      knock: 1 + k * (.12 * fatN + .16 * bentN),
    };

    if (P.pommel === 'knob') mul.swingT *= .92;        // a counterweight
    else if (P.pommel === 'ring') mul.drain = .93;     // hangs off the wrist
    else mul.speed = 1.05;                             // nothing on the end

    return { add, mul };
  },

  adj(P) {
    const lenN = (P.bladeLen - .5) / .5;
    const c = [
      ['long', lenN],
      ['stubby', 1 - lenN],
      ['fat', (P.bladeW - .04) / .06],
      ['chewed', P.notches / 3],
      ['bent', Math.abs(P.curve) / .12],
    ];
    let best = c[0];
    for (const e of c) if (e[1] > best[1]) best = e;
    return best[1] > .62 ? best[0] : null;   // a middling sword is just a sword
  },

  desc(P) {
    if (P.notches >= 2) return 'the bites out of the edge are what make it bite';
    if (!P.guard) return 'nothing between the blade and your fingers';
    if (P.bladeLen > .85) return 'the longer the blade the further it reaches';
    if (Math.abs(P.curve) > .085) return 'it leans, so it swings wide instead of far';
    return 'a bar, a blade and a bit of string';
  },

  draw(s, P, F) {
    const L = RUN * P.bladeLen;
    const wB = REF * P.bladeW;
    const sd = P.notchSide;

    // the lean: nothing at the guard, all of it at the tip, so the
    // grip and crossbar stay square to the hand
    const lean = t => P.curve * REF * t * t;
    // wide where it meets the guard, then a slow belly into a point
    const wid = t => wB * (t < .55 ? 1 - .10 * (t / .55)
                                   : .90 * Math.pow(1 - (t - .55) / .45, .72));
    // 0..1, how deep the bite is here. max(), not sum(), so two close
    // notches nibble the same edge instead of cutting the blade in half
    const nf = t => {
      let f = 0;
      for (const nt of P.notchT) f = Math.max(f, Math.max(0, 1 - Math.abs(t - nt) / NW));
      return f;
    };
    // The bitten edge. The mouthful is measured against the blade's
    // width AT THE GUARD, not the local width, so a nick in a thin
    // blade is as much of a chunk as a nick in a fat one — and two
    // floors stop it ever biting through.
    const bite = (t, w) => {
      const c = nf(t);
      return c > 0 ? Math.max(w * .30, Math.min(w, REF * .013), w - wB * .55 * c) : w;
    };

    // ---- the blade -----------------------------------------------
    // sampled up one edge, round the point, and back down the other
    const N = 26, up = [], down = [];
    for (let i = 0; i < N; i++) {
      const t = i / N;                       // the tip is added by hand
      const x = lean(t), y = BASE_Y - L * t;
      const w = wid(t), b = bite(t, w);
      up.push([x - (sd < 0 ? b : w), y]);
      down.push([x + (sd > 0 ? b : w), y]);
    }
    const blade = up.concat([[lean(1), BASE_Y - L]], down.reverse());
    finish(s, blade, P.rank, { lw: REF * .032, F });

    // the ridge down the middle — it follows the lean, so the curve
    // reads even when the silhouette is against something dark
    const spine = [];
    for (let i = 0; i <= 8; i++) {
      const t = .08 + .78 * (i / 8);
      spine.push([lean(t), BASE_Y - L * t]);
    }
    s.sline(spine, REF * .017, .38);

    // a crack running in off the floor of each bite, so the damage
    // survives being read small and blurred across the room
    for (const nt of P.notchT) {
      const w = wid(nt), x = lean(nt) + bite(nt, w) * sd, y = BASE_Y - L * nt;
      s.sline([[x, y], [x - sd * w * .55, y + L * .022]], REF * .016, .45);
    }

    // ---- the grip -------------------------------------------------
    const gw = REF * .036;
    finish(s, barPts(0, GRIP_BOT, 0, GRIP_TOP, gw, gw * .92, 2), P.rank,
      { lw: REF * .028, F });
    // the binding. The count is read off the blade rather than rolled:
    // a long one has to be held harder, and it can never disagree.
    const wraps = P.bladeLen > .78 ? 3 : 2;
    for (let i = 1; i <= wraps; i++) {
      const y = GRIP_BOT - (GRIP_BOT - GRIP_TOP) * (i / (wraps + 1));
      s.sline([[-gw * 1.15, y + REF * .012], [gw * 1.15, y - REF * .012]], REF * .019, .55);
    }

    // ---- the crossbar ---------------------------------------------
    if (P.guard) {
      const g = REF * P.guardW;
      finish(s, barPts(-g, GUARD_Y, g, GUARD_Y, REF * .032, REF * .032, 2), P.rank,
        { lw: REF * .030, F });
    }

    // ---- the pommel -----------------------------------------------
    if (P.pommel === 'knob') {
      // wob .35 and an explicit rot: a lump drawn slowly, and its
      // remaining wander is under a line width — that part is the boil
      finish(s, s.blobPts(0, POM_Y, REF * .050, REF * .046, 0, .35), P.rank,
        { lw: REF * .026, F });
    } else if (P.pommel === 'ring') {
      // fill:false leaves the hole open, which is the whole point of a
      // ring — you can see the child through it
      const r = REF * .050;
      finish(s, circlePts(0, POM_Y, r, r * .95, 20, 0), P.rank,
        { lw: REF * .026, fill: false, F });
      const inner = circlePts(0, POM_Y, r * .48, r * .45, 14, 0);
      s.sline(inner.concat([inner[0]]), REF * .018, .5);
    }
  },
};
