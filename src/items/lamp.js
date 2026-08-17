// ---------------------------------------------------------------
// THE LAMP — a lantern in the FIST, and the choice the game is about.
//
// The floor lantern (`lantern.js`) is a place you can stand. This one
// is the same object picked up, and it costs a HAND: a child holding
// it is a child not holding a bat. That trade is the whole game, so it
// has to be visible on the paper, and it is — twice over:
//
//     THE FAT GLASS BELLY IS THE CIRCLE.  `lampR` is read off `bw`,
//     the same half-width the contour is sampled from. A lamp drawn
//     twice as fat lights twice as far.
//
//     …AND THE SAME BELLY IS THE PENALTY.  A big lantern is an
//     awkward thing to swing. The fatter it is drawn, the slower the
//     child swings and the softer it lands. So you can look at two
//     lamps and see which one is a torch and which one is nearly a
//     weapon, without reading a card.
//
// It hangs from the bail, which is what the fist closes on: the
// anchor is at the TOP of the handle and the whole lantern hangs
// BELOW it, at positive y.
// ---------------------------------------------------------------
import { REF, finish } from './core.js';
import { chaikin } from '../sketch.js';

const cl = v => (v < 0 ? 0 : v > 1 ? 1 : v);
// how fat this one is, 0..1 — the number every promise below is made of
const bowlN = P => cl((P.bowl - .3) / .4);
const tallN = P => cl((P.height - .45) / .5);

const BOWL_W = REF * .30;          // the belly's half-width at bowl = 1
const FULL = REF * .78;            // the whole hanging length at height = 1

// The skeleton, in REF units, hung from y = 0 and running DOWN the
// page. Shared by draw() and statsOf(), which is the only way the
// numbers can be guaranteed to be the numbers that were drawn.
function geom(P) {
  const full = FULL * P.height;
  const bailH = full * (P.bail ? .22 : .10);   // the wire it swings from
  const capH = full * .12;
  const footH = full * (P.foot === 'dish' ? .13 : .05);
  const bodyH = full - bailH - capH - footH;   // the glass
  const bw = BOWL_W * P.bowl;
  return { full, bailH, capH, footH, bodyH, bw };
}

export const Lamp = {
  id: 'lamp',
  slot: 'held',
  // Not a floor family, but the draft's LIGHT group deals it: a hand
  // always offers exactly one way of seeing, and it is a coin toss
  // between somewhere to stand and something to carry.
  kind: 'light',
  noun: 'lamp',
  weight: 12,

  gen(rng, C) {
    return {
      bowl: rng.r(.3, .7),           // the headline: how much glass
      height: rng.r(.45, .95),
      panes: C.wpick(rng, [[2, 4], [3, 6], [4, 3]]),
      bail: rng.chance(.7),          // a long wire handle, easier to swing
      foot: C.wpick(rng, [['dish', 5], ['none', 4]]),
    };
  },

  // Both directions off ONE roll, which is what makes the card honest:
  // the belly gives the circle and takes the swing. `pow` scales the
  // gift only — a better-drawn lamp is a brighter lamp, never a
  // lighter one, so rank can't buy its way out of the trade.
  statsOf(P) {
    const k = P.pow ?? 1;
    const b = bowlN(P);
    const add = {
      lampR: k * (2.1 + 3.3 * b) * (.88 + .06 * P.panes),
    };
    // MEASURED, not guessed. These two numbers are the whole game: at
    // b = 0 a slim lamp costs a fighter almost nothing, and at b = 1 a
    // fat one leaves them swinging at about 45% of an empty hand. Set
    // them any gentler and carrying the light is free, which is the one
    // thing this design cannot survive.
    const mul = {
      // a long bail swings; a stubby one is a fistful of hot tin
      swingT: 1 + .80 * b * (P.bail ? .72 : 1),
      dmg: 1 - .55 * b,
    };
    return { add, mul };
  },

  adj(P) {
    const b = bowlN(P), h = tallN(P);
    const c = [['fat', b], ['slim', 1 - b], ['long', h], ['stubby', 1 - h]];
    let best = c[0];
    for (const e of c) if (e[1] > best[1]) best = e;
    if (best[1] > .7) return best[0];
    if (P.panes >= 4) return 'panelled';
    if (P.bail) return 'swinging';
    return null;                     // a middling lamp is just a lamp
  },

  desc(P) {
    if (bowlN(P) > .72) return 'all glass — they will see everything and hit nothing';
    if (bowlN(P) < .25) return 'a small flame, and a hand still free enough to swing it';
    if (P.bail) return 'the long wire lets them swing it like anything else';
    if (P.panes >= 4) return 'four panes, so it leaks light on every side';
    if (P.foot === 'dish') return 'the dish catches the drips and burns those too';
    return 'oil, glass, and a handle warm from the wick';
  },

  draw(s, P, F) {
    const g = geom(P);
    const yTop = g.bailH;                        // where the cap begins
    const yBot = yTop + g.capH + g.bodyH;        // where the glass ends
    const yAt = t => yBot - g.bodyH * t;         // t = 0 at the bottom

    // pinched at both ends, widest just below the middle — a barrel of
    // glass rather than a box with an opinion
    const belly = t => g.bw
      * (.54 + .46 * Math.pow(Math.sin(Math.PI * Math.pow(cl(t), .82)), .6))
      * (1 - .10 * cl(t));

    // ---- the bail, which is what the hand has hold of --------------
    // A closed crescent rather than a line, so a gilded one gets its
    // gleam and a scribbled one grows barbs like everything else.
    {
      const hw = Math.max(belly(1) * 1.05, REF * .06), tw = REF * .012, M = 14;
      const out = [], inn = [];
      for (let i = 0; i <= M; i++) {
        const a = Math.PI * (i / M);
        out.push([-Math.cos(a) * (hw + tw), yTop - Math.sin(a) * (g.bailH + tw)]);
        inn.push([-Math.cos(a) * (hw - tw), yTop - Math.sin(a) * Math.max(0, g.bailH - tw)]);
      }
      finish(s, out.concat(inn.reverse()), P.rank, { lw: REF * .018, F });
    }

    // ---- the cap ---------------------------------------------------
    const cw = belly(1) * 1.18;
    finish(s, [[-cw * .44, yTop], [cw * .44, yTop], [cw, yTop + g.capH], [-cw, yTop + g.capH]],
      P.rank, { lw: REF * .026, F });
    s.sline([[-cw * .8, yTop + g.capH * .62], [cw * .8, yTop + g.capH * .66]], REF * .015, .4);

    // ---- the glass -------------------------------------------------
    // jw is sub-linewidth, so the contour boils without the shape moving
    const N = 24, jw = REF * .004;
    const lft = [], rgt = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, y = yAt(t), h = belly(t);
      lft.push([-h + s.jr(-jw, jw), y + s.jr(-jw, jw)]);
      rgt.push([h + s.jr(-jw, jw), y + s.jr(-jw, jw)]);
    }
    finish(s, lft.concat(rgt.reverse()), P.rank, { lw: REF * .028, F });

    // ---- the oil, and what it is doing -----------------------------
    s.sline([[-belly(.24) * .86, yAt(.24)], [belly(.24) * .86, yAt(.24) + REF * .004]],
      REF * .018, .55);
    const fh = Math.min(g.bodyH * .44, g.bw * 1.1), fw = fh * .34, fy = yAt(.26);
    s.sline([[0, yAt(.24)], [s.jr(-fw * .06, fw * .06), fy]], REF * .014, .5);
    s.inkFill(chaikin([[0, fy], [fw, fy - fh * .32],
                       [0, fy - fh], [-fw * .94, fy - fh * .36]], true, 2), .5);

    // ---- the panes -------------------------------------------------
    // mullions on the NEAR glass, projected round a cylinder, so they
    // bunch at the edges and cross in front of the flame
    for (let i = 1; i < P.panes; i++) {
      const x = -Math.cos(Math.PI * (i / P.panes));
      const ln = [];
      for (let k = 0; k <= 8; k++) {
        const t = .06 + (k / 8) * .88;
        ln.push([belly(t) * x, yAt(t)]);
      }
      s.sline(ln, REF * .016, .45);
    }

    // ---- what it stands on, when it is put down --------------------
    if (P.foot === 'dish') {
      const rw = g.bw * .95;
      finish(s, [[-rw * .72, yBot], [rw * .72, yBot], [rw, yBot + g.footH], [-rw, yBot + g.footH]],
        P.rank, { lw: REF * .022, F });
    } else {
      s.sline([[-g.bw * .6, yBot + REF * .008], [g.bw * .6, yBot + REF * .012]], REF * .014, .34);
    }

    // ---- what gets out ---------------------------------------------
    // two spill ticks per pane, off the belly. This is `lampR` drawn on
    // the paper, and it is the only reason to be carrying the thing.
    const rays = P.panes * 2;
    const cy = yAt(.5), rx = g.bw * 1.1, ry = g.bodyH * .5, L = g.bw * .3;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + .38;
      const ca = Math.cos(a), sa = Math.sin(a);
      s.sline([[ca * rx, cy + sa * ry], [ca * (rx + L), cy + sa * (ry + L)]], REF * .014, .34);
    }
  },
};
