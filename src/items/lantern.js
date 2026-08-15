// ---------------------------------------------------------------
// THE LANTERN — the family that gives the child nothing.
//
// Every other family hands the kid a number. This one hands them a
// CIRCLE on the floor, and that is the whole game: light is the
// weapon, so a lantern's power is a place, not a stat. `statsOf` is
// deliberately empty. All of it lives in `objOf`.
//
// Which means the drawing carries the entire promise, and it has to
// be readable from the far side of the room:
//
//     THE FAT GLASS BELLY IS THE CIRCLE.  A bowl drawn twice as wide
//     lights a circle twice as wide, because `r` is read off `bw` —
//     the same number the contour is sampled from.
//
//     THE GLASS IS THE TANK.  `fuel` is the DRAWN height of the oil
//     column, not the raw `height` roll. So the hook, the cap and the
//     foot all eat into it visibly: a hooked lantern has a shorter
//     glass and a shorter night, and you can see the handle taking it.
//
// The body is sampled off a `belly()` profile rather than a box (the
// scenery lantern is a trapezoid, which is a box with an opinion) so
// that the mullions, the oil line and the glow all hang off the same
// curve and sit ON a round thing.
// ---------------------------------------------------------------
import { REF, finish, barPts } from './core.js';
import { chaikin } from '../sketch.js';

const cl = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const bowlN = P => cl((P.bowl - .25) / .35);
const tallN = P => cl((P.height - .5) / .45);
const r2 = v => Math.round(v * 100) / 100;

const BOWL_W = REF * .58;          // the belly's half-width at bowl = 1
// The REF box is a hard ceiling for a floor prop — propDrawFor maps it
// onto the whole canvas — and finish() flicks its gilded ticks up to
// REF*.11 past the contour. So the tallest lantern stops short of it.
const TALL = REF * .87;            // the silhouette at height = 1

// The skeleton, in REF units, base at y = 0 and up NEGATIVE. Shared by
// draw() and objOf() on purpose: it is the only way the numbers can be
// guaranteed to be the numbers that were drawn.
function geom(P) {
  const full  = TALL * P.height;                   // the whole silhouette
  const hookH = P.hook ? full * .16 : 0;           // the handle steals headroom
  const capH  = full * .11;
  const footH = full * (P.foot === 'splay' ? .16 : P.foot === 'ring' ? .10 : .035);
  const bodyH = full - hookH - capH - footH;       // the glass — this is the oil
  const bw    = BOWL_W * P.bowl;
  // what it actually stands on, so the room knows how much floor it takes
  const span  = P.foot === 'splay' ? Math.max(bw * .92, REF * .16)
              : P.foot === 'ring'  ? Math.max(bw * .78, REF * .13)
              : bw * .56;
  return { full, hookH, capH, footH, bodyH, bw, span };
}

export const Lantern = {
  id: 'lantern',
  slot: 'floor',
  kind: 'light',                   // the hand always deals one of these
  noun: 'lantern',
  weight: 9,

  gen(rng, C) {
    return {
      bowl: rng.r(.25, .6),          // the headline: the glass belly
      height: rng.r(.5, .95),
      panes: C.wpick(rng, [[2, 4], [3, 6], [4, 3]]),
      hook: rng.chance(.55),
      foot: C.wpick(rng, [['splay', 4], ['ring', 5], ['none', 3]]),
    };
  },

  // A floor object is not carried and buffs nobody. Empty on purpose —
  // see objOf, which is where a lantern's whole life is.
  statsOf() {
    return { add: {}, mul: {} };
  },

  objOf(P) {
    const g = geom(P), pow = P.pow ?? 1;

    // THE PROMISE. `bw` is the half-width the contour was sampled from,
    // so this is literally the drawing measured with a ruler.
    const r = (g.bw / REF) * 14.5
            * (.82 + .06 * P.panes)               // every pane is another way out
            * (1 + (g.footH / REF) * 1.1)         // held higher, the pool spreads
            * (.7 + .3 * pow);

    // and the tank is the glass you can see the oil sitting in
    const fuel = (g.bodyH / REF) * 184
               * (P.foot === 'ring' ? 1.1 : 1)    // the dish burns the drips too
               * (.75 + .25 * pow);

    // Real size in the room: the drawn aspect, plus room for the spill
    // ticks and for the gleam finish() flicks off a gilded contour.
    const hU = P.height * 1.5;
    const half = Math.max(g.bw, g.span) * 1.32 + REF * .11;
    const wU = Math.min(1.5, Math.max(.5, hU * (2 * half) / REF));
    return { kind: 'light', wU: r2(wU), hU: r2(hU), r: r2(r), fuel: Math.round(fuel) };
  },

  adj(P) {
    const b = bowlN(P), h = tallN(P);
    const c = [['fat', b], ['thin', 1 - b], ['tall', h], ['squat', 1 - h]];
    let best = c[0];
    for (const e of c) if (e[1] > best[1]) best = e;
    if (best[1] > .68) return best[0];
    if (P.panes >= 4) return 'panelled';
    if (P.hook) return 'hooked';
    return null;                       // a middling lantern is just a lantern
  },

  desc(P) {
    if (bowlN(P) > .7) return 'the fatter the glass the wider the circle it draws';
    if (tallN(P) > .7) return 'a tall glass is a long night';
    if (tallN(P) < .25) return 'squat, and it will not see the morning';
    if (P.hook) return 'the handle takes the height the oil wanted';
    if (P.foot === 'ring') return 'the dish under it catches the drips and burns those too';
    if (P.foot === 'splay') return 'up on its legs, so the light gets further along the floor';
    if (P.panes >= 4) return 'four panes, so it leaks light on every side';
    return 'oil, glass, and a wick someone trimmed';
  },

  draw(s, P, F) {
    const g = geom(P);
    const yBot = -g.footH;                       // where the glass starts
    const yTop = yBot - g.bodyH;                 // and where it ends
    const yCap = yTop - g.capH;
    const yAt = t => yBot - g.bodyH * t;

    // pinched at the base, widest just below the middle, tapering into
    // the shoulder — a barrel of glass, not a box
    const belly = t => g.bw
      * (.52 + .48 * Math.pow(Math.sin(Math.PI * Math.pow(cl(t), .84)), .58))
      * (1 - .14 * cl(t));

    // ---- what it stands on ---------------------------------------
    if (P.foot === 'splay') {
      for (const sd of [-1, 1]) {
        finish(s, barPts(sd * g.span, 0, sd * g.bw * .40, yBot,
          REF * .019, REF * .025, 2), P.rank, { lw: REF * .024, F });
      }
      // the brace, or it reads as two sticks that happen to touch
      s.sline([[-g.span * .66, -g.footH * .42], [g.span * .66, -g.footH * .38]],
        REF * .017, .45);
    } else if (P.foot === 'ring') {
      const rw = g.span;                          // a saucer, flaring upward
      finish(s, [[-rw * .74, 0], [rw * .74, 0], [rw, yBot], [-rw, yBot]], P.rank,
        { lw: REF * .026, F });
      s.sline([[-rw * .9, -g.footH * .72], [rw * .9, -g.footH * .68]], REF * .017, .5);
    } else {
      // flat on the lino: nothing but the smudge where it sits
      s.sline([[-g.bw * .7, yBot + REF * .006], [g.bw * .7, yBot + REF * .010]],
        REF * .016, .34);
    }

    // ---- the glass -----------------------------------------------
    // jw is sub-linewidth, so the contour boils without the shape moving
    const N = 26, jw = REF * .004;
    const lft = [], rgt = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, y = yAt(t), h = belly(t);
      lft.push([-h + s.jr(-jw, jw), y + s.jr(-jw, jw)]);
      rgt.push([h + s.jr(-jw, jw), y + s.jr(-jw, jw)]);
    }
    finish(s, lft.concat(rgt.reverse()), P.rank, { lw: REF * .030, F });

    // ---- the oil ---------------------------------------------------
    // the surface, and two ripples under it. It is a fixed slice of the
    // glass, so a taller lantern draws a deeper tank and HAS one.
    s.sline([[-belly(.22) * .88, yAt(.22)], [belly(.22) * .88, yAt(.22) + REF * .004]],
      REF * .020, .55);
    for (const t of [.13, .07])
      s.sline([[-belly(t) * .78, yAt(t)], [belly(t) * .78, yAt(t) + REF * .003]],
        REF * .015, .28);

    // ---- the flame -------------------------------------------------
    const fh = Math.min(g.bodyH * .46, g.bw * 1.15);
    const fw = fh * .34;
    const fy = yAt(.24);
    s.sline([[0, yAt(.22)], [s.jr(-fw * .06, fw * .06), fy]], REF * .016, .5);  // the wick
    const fl = chaikin([[0, fy], [fw, fy - fh * .32],
                        [0, fy - fh], [-fw * .94, fy - fh * .36]], true, 2);
    s.inkFill(fl, .5);

    // ---- the panes -------------------------------------------------
    // mullions on the NEAR glass, so they cross in front of the flame.
    // Projected round a cylinder, which is why they bunch at the edges.
    for (let i = 1; i < P.panes; i++) {
      const x = -Math.cos(Math.PI * (i / P.panes));
      const ln = [];
      for (let k = 0; k <= 8; k++) {
        const t = .05 + (k / 8) * .90;
        ln.push([belly(t) * x, yAt(t)]);
      }
      s.sline(ln, REF * .018, .45);
    }
    // the two frame rails that hold the glass in
    for (const t of [.04, .96])
      s.sline([[-belly(t) * 1.05, yAt(t)], [belly(t) * 1.05, yAt(t) + REF * .004]],
        REF * .022, .55);
    // one shine, so it reads as glass and not as tin
    {
      const sh = [];
      for (let k = 0; k <= 5; k++) {
        const t = .55 + (k / 5) * .30;
        sh.push([-belly(t) * .60, yAt(t)]);
      }
      s.sline(sh, REF * .015, .30);
    }

    // ---- the cap ---------------------------------------------------
    const cw = belly(1) * 1.20;
    finish(s, [[-cw, yTop], [cw, yTop], [cw * .42, yCap], [-cw * .42, yCap]], P.rank,
      { lw: REF * .028, F });
    s.sline([[-cw * .82, yTop - g.capH * .34], [cw * .82, yTop - g.capH * .30]],
      REF * .016, .4);

    // ---- the handle ------------------------------------------------
    // a closed crescent rather than a line, so a gilded one gets its
    // gleam and a scribbled one grows its barbs like everything else
    if (P.hook) {
      // sprung from the cap's own top corners, so it sits on the lid
      const hw = Math.max(cw * .42, REF * .065), tw = REF * .013, M = 14;
      const out = [], inn = [];
      for (let i = 0; i <= M; i++) {
        const a = Math.PI * (i / M);
        out.push([-Math.cos(a) * (hw + tw), yCap - Math.sin(a) * (g.hookH + tw)]);
        inn.push([-Math.cos(a) * (hw - tw), yCap - Math.sin(a) * (g.hookH - tw)]);
      }
      finish(s, out.concat(inn.reverse()), P.rank, { lw: REF * .020, F });
    }

    // ---- what gets out ---------------------------------------------
    // two spill ticks per pane, off the belly, as long as the bowl is
    // fat. This is the light radius drawn on the paper.
    const rays = P.panes * 2;
    const cy = yAt(.45), rx = g.bw * 1.08, ry = g.bodyH * .58, L = g.bw * .24;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + .38;
      const ca = Math.cos(a), sa = Math.sin(a);
      s.sline([[ca * rx, cy + sa * ry], [ca * (rx + L), cy + sa * (ry + L)]],
        REF * .015, .34);
    }
  },
};
