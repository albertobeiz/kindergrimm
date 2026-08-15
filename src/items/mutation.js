// ---------------------------------------------------------------
// MUTATION — the one item that does not go ON the child. It REWRITES
// the child.
//
// Everything else in the catalogue is a thing you can put down again;
// this is a patch to the recipe. `patchOf(P)` hands the game a partial
// bag of PART PARAMS, the game merges it into the character and
// rebuilds — so the kid who walks out of the draft is a different
// drawing than the one who walked in. Nothing is drawn on top: the
// horns are grown by `crest.js`, the big eyes by `eyes.js`.
//
// Which is why the card art is the FEATURE ALONE. A pair of horns, one
// enormous eye, a curling tail: that is the promise, and the part file
// keeps it. Drawing a whole character here would just be a portrait of
// somebody else's kid.
//
// Every key below is verified against the part file that reads it —
// skull.s / torso.wF·hF, eyes.type·type2·scale, crest.style·len·curve,
// tail.style·len, arms.style·len·hand, extras.spots. A wrong key is a
// silent no-op, never an error, so this list is the whole contract.
//
// `pow` is baked into `amt` in gen(), so a gilded mutation is a bigger
// FEATURE as well as a bigger number — statsOf must not multiply by
// P.pow again or the rank would count twice.
// ---------------------------------------------------------------
import { REF, finish } from './core.js';
import { chaikin, circlePts } from '../sketch.js';

// what can go wrong with a child. Spots are the common little one.
const KINDS = [
  ['spots', 16], ['bighead', 14], ['saucer', 13],
  ['horns', 12], ['tail', 11], ['longarms', 10],
  // these two change nothing about the drawing of the child — they
  // change how big the drawing IS. No patch, just a scale.
  ['grow', 12], ['shrink', 12],
];

// a spine thickened into a closed ring — a horn, a tail, an arm. core
// has barPts for STRAIGHT bars only, and none of these are straight.
function ribbon(spine, w0, w1) {
  const L = [], R = [];
  for (let i = 0; i < spine.length; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(spine.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    const t = i / (spine.length - 1);
    const hw = (w0 + (w1 - w0) * t) / 2;
    L.push([spine[i][0] + nx * hw, spine[i][1] + ny * hw]);
    R.push([spine[i][0] - nx * hw, spine[i][1] - ny * hw]);
  }
  return [...L, ...R.reverse()];
}

export const Mutation = {
  id: 'mutation', slot: 'mutation', noun: 'change', weight: 8,

  // The kind is the whole item; `amt` is how far it goes, and it is the
  // only number the drawing, the patch and the stats all read.
  gen: (rng, C) => ({
    kind: C.wpick(rng, KINDS),
    amt: rng.r(.45, 1) * C.pow,
    curve: rng.r(-.25, .5),                 // horns: <0 sweeps forward
    tailStyle: C.wpick(rng, [['wag', 10], ['curl', 8], ['spike', 5]]),
    armStyle: C.wpick(rng, [['stub', 6], ['noodle', 4]]),
    hand: C.wpick(rng, [['mitten', 60], ['claw', 26], ['dot', 14]]),
    gaze: [rng.r(-.35, .35), rng.r(-.3, .3)],   // where the big eye is looking
    wob: rng.r(-.16, .16),                      // one lean, held still
    // the spot field, rolled ONCE. Rolling it in draw() would re-scatter
    // the markings twice a second on a character.
    marks: Array.from({ length: 9 }, () => [
      rng.r(0, Math.PI * 2), rng.r(.12, .84), rng.r(.55, 1), rng.chance(.42),
    ]),
  }),

  // The patch IS the item. Values are absolute part params, clamped so a
  // scribbled roll still leaves a child and not a balloon.
  patchOf(P) {
    const a = P.amt;
    if (P.kind === 'bighead') {
      // torso wF/hF are ratios AGAINST the head, so shrinking them is
      // what actually reads as big-headed (see the note in torso.gen);
      // skull.s alone would just make a larger child.
      return { parts: {
        skull: { params: { s: Math.min(.82, .60 + a * .09) } },
        torso: { params: { wF: Math.max(.30, .42 - a * .05), hF: Math.max(.32, .48 - a * .07) } },
      } };
    }
    if (P.kind === 'saucer') {
      // type2 is the doodle habit of drawing the second eye differently;
      // a matched pair is the point here, so it is turned off.
      return { parts: { eyes: { params: {
        type: 'saucer', type2: 'none', scaleR: 1,
        scale: Math.min(2.3, 1.35 + a * .35), glint: true,
      } } } };
    }
    if (P.kind === 'horns') {
      return { parts: { crest: { params: {
        style: 'horns', tone: 'bone', curve: P.curve,
        len: Math.min(2.2, .95 + a * .5),
      } } } };
    }
    if (P.kind === 'tail') {
      return { parts: { tail: { params: {
        style: P.tailStyle, len: Math.min(1.9, .9 + a * .45),
      } } } };
    }
    if (P.kind === 'longarms') {
      // the style has to be forced: 'hips', 'clasped' and 'behind' park
      // the hand on the body, and then length buys no reach at all.
      return { parts: { arms: { params: {
        style: P.armStyle, hand: P.hand,
        len: Math.min(1.75, 1.05 + a * .4),
      } } } };
    }
    // grow/shrink touch no part at all: the child is the same drawing,
    // held at a different size. `scale` is a stat, and the game applies
    // it when it re-fits the body.
    if (P.kind === 'grow' || P.kind === 'shrink') return null;
    return { parts: { extras: { params: { spots: true } } } };
  },

  // PURE. Same P, same numbers. One headline stat each, at most one
  // small rider — a mutation should never be two items at once.
  statsOf(P) {
    const a = P.amt;
    if (P.kind === 'bighead')                 // more of everything, slower
      return { add: { maxStam: 34 * a, dmg: .3 * a }, mul: { speed: Math.max(.6, 1 - .12 * a) } };
    if (P.kind === 'saucer')                  // it sees in the dark
      return { mul: { drain: Math.max(.5, 1 - .2 * a) } };
    if (P.kind === 'horns')
      return { add: { dmg: .65 * a }, mul: { knock: 1 + .2 * a } };
    if (P.kind === 'tail')
      return { mul: { speed: 1 + .3 * a } };
    if (P.kind === 'longarms')
      return { add: { reach: .75 * a } };
    // Big is slow and lasts; small is quick and cheap to run. Both are
    // real trades — neither is the better card.
    // The size has to be big enough to SEE across a dark room, or the
    // card is promising something the game does not deliver.
    if (P.kind === 'grow')
      return { mul: { scale: 1 + .42 * a, speed: Math.max(.6, 1 - .15 * a) },
               add: { dmg: .5 * a, maxStam: 22 * a, reach: .25 * a } };
    if (P.kind === 'shrink')
      return { mul: { scale: Math.max(.48, 1 - .28 * a), speed: 1 + .22 * a,
                      drain: Math.max(.55, 1 - .14 * a) },
               add: { dmg: -.3 * a, reach: -.15 * a } };
    return { add: { maxStam: 14 * a } };
  },

  adj(P) {
    const big = P.amt > 1.15;
    if (P.kind === 'bighead') return big ? 'balloon-headed' : 'big-headed';
    if (P.kind === 'saucer') return big ? 'moon-eyed' : 'saucer-eyed';
    if (P.kind === 'horns') return big ? 'great-horned' : 'horned';
    if (P.kind === 'tail') return big ? 'long-tailed' : 'tailed';
    if (P.kind === 'longarms') return big ? 'gangly' : 'long-armed';
    if (P.kind === 'grow') return big ? 'enormous' : 'big';
    if (P.kind === 'shrink') return big ? 'pocket-sized' : 'little';
    return big ? 'dappled' : 'spotted';
  },

  desc(P) {
    if (P.kind === 'bighead') return 'a bigger head holds more, and turns slower';
    if (P.kind === 'saucer') return 'eyes that size take in the whole dark room';
    if (P.kind === 'horns') return 'they will be going in head first now';
    if (P.kind === 'tail') return 'something to steer with when they run';
    if (P.kind === 'longarms') return 'the longer the arm the further they reach';
    if (P.kind === 'grow') return 'harder to wear out, and harder to hurry';
    if (P.kind === 'shrink') return 'small enough to be quick, and to go hungry slowly';
    return 'markings say this one belongs to something';
  },

  // Origin at the CENTRE, up negative, everything a fraction of REF.
  draw(s, P, F) {
    const a = P.amt;
    const o = { F, lw: REF * .032 };
    const thin = { F, lw: REF * .026 };

    // ---- a big head on a small body ----------------------------
    // The body is FIXED and the head grows: the size of the roll is
    // only legible against something that did not change.
    if (P.kind === 'bighead') {
      const r = REF * Math.min(.33, .21 + a * .07);
      const hy = -REF * .08, by = REF * .32, br = REF * .105;

      const body = s.blobPts(0, by, br, br * 1.06, 0, .45);
      finish(s, body, P.rank, thin);

      const y0 = hy + r * .86, y1 = by - br * .9;      // the neck, if any is left
      if (y1 > y0 + REF * .02)
        for (const sd of [-1, 1]) s.sline([[sd * REF * .045, y0], [sd * REF * .05, y1]], REF * .02, .55);

      const head = s.blobPts(0, hy, r, r * .93, P.wob * .5, .35);
      finish(s, head, P.rank, o);
      for (const sd of [-1, 1]) {                       // the void eyes
        s.ctx.fillStyle = s.inkA(.92);
        s.wobbly(sd * r * .36, hy - r * .04, r * .16, r * .18);
        s.ctx.fill();
      }
      s.sline([[-r * .2, hy + r * .34], [r * .22, hy + r * .32]], REF * .019, .6);
      return;
    }

    // ---- one enormous eye --------------------------------------
    // The spokes are how this game already draws light (see the
    // nightlight): more of them, and it is gathering more of it.
    if (P.kind === 'saucer') {
      const r = REF * Math.min(.30, .22 + a * .055);
      const disc = s.blobPts(0, 0, r, r * .98, P.wob * .4, .35);
      finish(s, disc, P.rank, o);

      const px = P.gaze[0] * r * .38, py = P.gaze[1] * r * .34;
      s.ctx.fillStyle = s.inkA(.94);
      s.wobbly(px, py, r * .42, r * .43);
      s.ctx.fill();
      s.ctx.fillStyle = s.paperA(.92);
      s.wobbly(px - r * .16, py - r * .18, r * .13, r * .13);
      s.ctx.fill();

      const rays = 4 + Math.round(a * 3);
      for (let i = 0; i < rays; i++) {
        const ang = P.wob + (i / rays) * Math.PI * 2;
        const c = Math.cos(ang), sn = Math.sin(ang);
        s.sline([[c * r * 1.16, sn * r * 1.16], [c * r * 1.42, sn * r * 1.42]], REF * .018, .5);
      }
      return;
    }

    // ---- a pair of horns ---------------------------------------
    // Growth rings count up with the length: a longer horn is an older
    // horn, and it hits harder.
    if (P.kind === 'horns') {
      const L = REF * Math.min(.60, .30 + a * .16);
      const rings = Math.max(2, Math.round(1.4 + a * 1.6));

      for (const sd of [-1, 1]) {
        const bx = sd * REF * .15, by = REF * .20;
        const spine = chaikin([
          [bx, by],
          [bx + sd * REF * .09, by - L * .5],
          [bx + sd * REF * (.14 + P.curve * .12), by - L * .92],
        ], false, 2);
        finish(s, ribbon(spine, REF * .105, REF * .016), P.rank, o);

        for (let k = 1; k <= rings; k++) {
          const i = Math.round(spine.length * k * .16);
          if (i >= spine.length - 1) break;
          const p = spine[i], q = spine[i + 1];
          let nx = -(q[1] - p[1]), ny = q[0] - p[0];
          const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
          const hw = REF * .052 * (1 - k * .17);
          s.sline([[p[0] + nx * hw, p[1] + ny * hw], [p[0] - nx * hw, p[1] - ny * hw]], REF * .015, .45);
        }
      }
      // the scalp they erupt from, so they read as horns and not tusks
      s.sline(chaikin([[-REF * .30, REF * .31], [0, REF * .20], [REF * .30, REF * .31]], false, 2), REF * .02, .5);
      return;
    }

    // ---- a tail ------------------------------------------------
    if (P.kind === 'tail') {
      const L = REF * Math.min(.62, .36 + a * .16);
      const x0 = -REF * .26, y0 = REF * .22;
      let spine;
      if (P.tailStyle === 'curl') {
        spine = chaikin([[x0, y0], [x0 + L * .5, y0 - L * .28],
                         [x0 + L * .66, y0 - L * .8], [x0 + L * .24, y0 - L * .95]], false, 2);
      } else if (P.tailStyle === 'spike') {
        spine = chaikin([[x0, y0], [x0 + L * .5, y0 - L * .25], [x0 + L * 1.0, y0 - L * .6]], false, 2);
      } else {
        spine = chaikin([[x0, y0], [x0 + L * .55, y0 - L * .18], [x0 + L * .95, y0 + L * .2]], false, 2);
      }
      finish(s, ribbon(spine, REF * .085, REF * (P.tailStyle === 'spike' ? .012 : .038)), P.rank, o);
      // the haunch it is stuck to
      s.sline(chaikin([[x0 - REF * .09, y0 + REF * .14], [x0 - REF * .13, y0 - REF * .02],
                       [x0 - REF * .02, y0 - REF * .11]], false, 2), REF * .02, .5);
      return;
    }

    // ---- one long arm ------------------------------------------
    if (P.kind === 'longarms') {
      const L = REF * Math.min(.62, .40 + a * .16);
      const x0 = -REF * .24, y0 = -REF * .26;
      const spine = chaikin([[x0, y0], [x0 + L * .30, y0 + L * .52], [x0 + L * .62, y0 + L * .95]], false, 2);
      const th = REF * (P.armStyle === 'noodle' ? .05 : .085);

      finish(s, s.blobPts(x0, y0, REF * .075, REF * .07, P.wob, .45), P.rank, thin);
      finish(s, ribbon(spine, th, th * .82), P.rank, o);

      const tip = spine[spine.length - 1];
      if (P.hand === 'dot') {
        s.ctx.fillStyle = s.inkA(.9);
        s.wobbly(tip[0], tip[1], REF * .045, REF * .045);
        s.ctx.fill();
      } else if (P.hand === 'claw') {
        for (let k = 0; k < 3; k++) {
          const ang = -.35 + k * .55;
          s.stroke([[tip[0], tip[1]],
                    [tip[0] + Math.cos(ang) * REF * .11, tip[1] + Math.sin(ang) * REF * .11]],
            REF * .022, { taper: .4, alpha: .9 });
        }
      } else {
        finish(s, s.blobPts(tip[0], tip[1], REF * .075, REF * .068, P.wob * .6, .45), P.rank, thin);
      }
      // the crease where an elbow would be, if it had one
      const mid = spine[(spine.length * .45) | 0];
      s.sline([[mid[0] - th * .5, mid[1] - th * .3], [mid[0] + th * .5, mid[1] + th * .3]], REF * .015, .4);
      return;
    }

    // ---- bigger, or smaller ------------------------------------
    // Size is the one change that cannot be drawn on its own: a big
    // child alone is just a child. So both are drawn TWICE — the one
    // you have, at a fixed size, and the one you would get. The gap
    // between them is the stat, and it is the whole card.
    if (P.kind === 'grow' || P.kind === 'shrink') {
      const k = P.kind === 'grow'
        ? Math.min(1.75, 1 + .5 * a)
        : Math.max(.42, 1 - .32 * a);
      // a doodle child in one line: a head, a body, two feet
      const kid = (cx, m, dim) => {
        const hr = REF * .13 * m, hy = -REF * .1 * m;
        const by = hy + hr * 1.5, bw = hr * .74, bh = hr * 1.0;
        const opt = { F, lw: REF * (dim ? .022 : .032) };
        finish(s, chaikin([[cx - bw, by], [cx + bw, by],
                           [cx + bw * .86, by + bh], [cx - bw * .86, by + bh]], true, 2), P.rank, opt);
        finish(s, s.blobPts(cx, hy, hr, hr * .95, P.wob * .4, .35), P.rank, opt);
        for (const sd of [-1, 1]) {
          s.ctx.fillStyle = s.inkA(dim ? .5 : .92);
          s.wobbly(cx + sd * hr * .36, hy, hr * .17, hr * .19);
          s.ctx.fill();
          s.sline([[cx + sd * bw * .5, by + bh], [cx + sd * bw * .55, by + bh + hr * .34]],
            REF * .018, dim ? .35 : .55);
        }
      };
      // the one that did not change is drawn faintly, on the left
      kid(-REF * .26, .82, true);
      kid(REF * .2, .82 * k, false);
      // the measuring line, so the difference is a fact and not a feeling
      const ty = REF * .34;
      s.sline([[-REF * .42, ty], [REF * .42, ty]], REF * .014, .3);
      return;
    }

    // ---- a spotted patch of hide -------------------------------
    // The count is the stat: more marks, more left in the tank.
    const patch = s.blobPts(0, 0, REF * .33, REF * .27, P.wob, .6);
    finish(s, patch, P.rank, o);

    const n = Math.min(P.marks.length, 3 + Math.round(a * 2.2));
    s.ctx.save();
    s.poly(patch, true); s.ctx.clip();
    for (let i = 0; i < n; i++) {
      const [ang, rad, sz, ring] = P.marks[i];
      const x = Math.cos(ang) * REF * .26 * rad, y = Math.sin(ang) * REF * .20 * rad;
      const rr = REF * (.026 + .022 * sz);
      if (ring) {
        const c = circlePts(x, y, rr, rr * .92, 12);
        s.sline(c.concat([c[0]]), REF * .016, .55);
      } else {
        s.ctx.fillStyle = s.inkA(.8);
        s.wobbly(x, y, rr * .55, rr * .55);
        s.ctx.fill();
      }
    }
    s.ctx.restore();
  },
};
