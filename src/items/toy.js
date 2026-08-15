// ---------------------------------------------------------------
// THE TOY — the family with no stats at all, so the SIZE is the art.
//
// Everything else in the catalogue hangs its numbers on a child. A toy
// hangs them on the floor: all it does is fill the play bar, and a bar
// filling faster is the one thing in this game you CANNOT see. So the
// headline roll is spent on the only channel left — how much of the
// paper the thing takes up. `size` is not a number the drawing obeys
// later, it IS the drawing's scale: a .45 ball is a small doodle
// sitting at the bottom of its box and a .9 ball fills it. Put two
// cards side by side and the better toy is the bigger picture.
//
// That is also why `hU` is 1 for every kind and never moves. The REF
// box is one world unit tall, so a toy drawn at .6 of the box arrives
// in the room at .6 of a unit without a second scale anywhere. Scale
// the box AND the art and the size gets squared, and a small toy comes
// out a postage stamp.
//
// Decor and bells are the garnish, and both are COUNTABLE: three
// stripes, five spots, three stars, and exactly as many bells as the
// roll says. A child picks the one with the bells on it for the same
// reason the player does.
//
// The kind is the one roll that is worth nothing. A drum is not better
// than a horse — it is only a different shape of floor, so you can
// take the one you like without paying for it.
// ---------------------------------------------------------------
import { REF, finish, barPts, starPts } from './core.js';
import { chaikin, circlePts, arcPts, TAU } from '../sketch.js';

// 0..1 across the size roll — every number in the file reads this.
const sizeN = P => (P.size - .45) / .45;

// how much of the REF box the drawing fills. The whole family's
// headline stat, spent on the picture instead of on a stat line.
const scaleOf = P => .60 + .40 * sizeN(P);

// a big set has three blocks in it, a small one has two. Derived, not
// rolled, so the count can never disagree with the size on the card.
const blockN = P => (P.size >= .70 ? 3 : 2);

// how much play each decoration is worth. Nobody has to be told that
// the starry one is the good one; they can see the stars.
const DECOR_K = { none: 0, stripes: .45, spots: .70, stars: 1 };

// canvas width per kind, as a fraction of the REF box. Only wide
// enough to hold the art — hU is always 1.
const WID = { ball: .92, blocks: .50, horse: .96, drum: .84 };

// contour weights. Held constant in REF rather than scaled with the
// toy: the same pencil drew the small one, and it should look it.
const LW = REF * .030, LW2 = REF * .024, LW3 = REF * .021;

export const Toy = {
  // `kind` is the FLOOR kind this family makes (the hand deals one of
  // each); `P.kind` below is which toy it happens to be.
  id: 'toy', slot: 'floor', kind: 'toy', noun: 'toy', weight: 10,

  gen(rng, C) {
    return {
      kind: C.wpick(rng, [['ball', 10], ['blocks', 7], ['drum', 6], ['horse', 5]]),
      size: rng.r(.45, .9),
      // a better-drawn toy was worth putting stars on
      decor: C.wpick(rng, [['none', 8], ['stripes', 6], ['spots', 5],
                           ['stars', 3 + Math.max(0, C.pow - 1) * 8]]),
      bells: C.wpick(rng, [[0, 10], [1, 6], [2, 3], [3, 1]]),
      // frozen hand-wobble: block lean, letters, spot and star
      // placement. Rolled here because a count that is re-rolled in
      // draw() is a count nobody can read.
      hand: Array.from({ length: 10 }, () => rng.r(0, 1)),
    };
  },

  // A toy does nothing to the child holding it — it is not held. The
  // whole family lives in objOf.
  statsOf() { return { add: {}, mul: {} }; },

  // play = XP per second, dur = how many seconds of it there are.
  // Size drives both; decor and bells only sweeten the rate, so a
  // small toy can never outlast a big one however pretty it is.
  objOf(P) {
    const n = sizeN(P), pw = P.pow ?? 1;
    const g = 1 + (pw - 1) * .30;           // rank, softened: .96 → 1.30
    const play = (.86 + .48 * n + .21 * DECOR_K[P.decor] + .045 * P.bells) * g;
    return {
      kind: 'toy',
      wU: WID[P.kind], hU: 1,
      dur: Math.round((66 + 84 * n) * (1 + (pw - 1) * .25)),
      play: Math.round(play * 100) / 100,
    };
  },

  adj(P) {
    const n = sizeN(P);
    const c = [
      ['big', n], ['little', 1 - n],
      ['starry', P.decor === 'stars' ? .95 : 0],
      ['spotty', P.decor === 'spots' ? .80 : 0],
      ['stripy', P.decor === 'stripes' ? .68 : 0],
      ['jingly', P.bells / 3],
    ];
    let best = c[0];
    for (const e of c) if (e[1] > best[1]) best = e;
    return best[1] > .6 ? best[0] : null;
  },

  desc(P) {
    if (P.bells >= 2) return `${P.bells} bells on it, and they hear every one`;
    if (P.decor === 'stars') return 'the stars are why they queue for it';
    if (P.size > .78) return 'big enough that three of them can play at once';
    if (P.size < .55) return 'small, and it will not last the week';
    if (P.kind === 'drum') return 'a drum, so nobody in the room is bored';
    if (P.kind === 'horse') return 'it rocks, and they take turns badly';
    if (P.kind === 'blocks') return 'they stack it, they knock it down, they stack it';
    return 'round, and it goes where it likes';
  },

  draw(s, P, F) {
    const u = REF * scaleOf(P);            // every coordinate below is in u
    if (P.kind === 'ball') ball(s, P, F, u);
    else if (P.kind === 'blocks') blocks(s, P, F, u);
    else if (P.kind === 'horse') horse(s, P, F, u);
    else drum(s, P, F, u);
  },
};

// ---- the four toys ----------------------------------------------

function ball(s, P, F, u) {
  const r = u * .40;
  // rot and the squash come from P: a ball that re-rolled its own
  // roundness every frame would breathe like a lung
  const body = s.blobPts(0, -r, r, r * (.96 + P.hand[1] * .08),
                         (P.hand[0] - .5) * .5, .35);
  finish(s, body, P.rank, { lw: LW, F });

  // the seam a child draws to say "this is a ball and not a circle"
  const band = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    band.push([-r + 2 * r * t, -r + Math.sin(Math.PI * t) * r * .45]);
  }
  s.sline(chaikin(band, false, 1), REF * .020, .55);

  decorate(s, P, u, 0, -r, r * .60, r * .60);
  bells(s, P, F, u, -r * .5, r * .5, -r * 1.9);
}

function blocks(s, P, F, u) {
  const n = blockN(P), hw = u * .17, bh = u * .245, step = bh - u * .012;
  let y = 0;
  for (let i = 0; i < n; i++) {
    const ox = (P.hand[i] - .5) * u * .06;          // never quite stacked
    const sk = (P.hand[i + 3] - .5) * u * .05;      // and never quite level
    finish(s, [[ox - hw, y], [ox + hw, y - sk],
               [ox + hw, y - bh - sk], [ox - hw, y - bh]], P.rank, { lw: LW, F });
    letter(s, P, i, ox, y - (bh + sk) * .5, hw * .42);
    y -= step;
  }
  decorate(s, P, u, 0, -n * step * .5, hw * .82, n * step * .40);
  bells(s, P, F, u, -hw * .8, hw * .8, y - u * .01);
}

// the letter nobody can read — three of them, so a room full of
// blocks doesn't turn into an eye chart
function letter(s, P, i, cx, cy, r) {
  const m = Math.floor(P.hand[6 + i] * 3);
  if (m === 0) {
    s.sline([[cx - r, cy + r], [cx, cy - r], [cx + r, cy + r]], REF * .020, .6);
    s.sline([[cx - r * .5, cy + r * .15], [cx + r * .5, cy + r * .15]], REF * .018, .55);
  } else if (m === 1) {
    s.sline([[cx - r, cy - r], [cx + r, cy + r]], REF * .020, .6);
    s.sline([[cx + r, cy - r], [cx - r, cy + r]], REF * .020, .6);
  } else {
    const o = circlePts(cx, cy, r, r, 12, 0);
    s.sline(o.concat([o[0]]), REF * .020, .6);
  }
}

function horse(s, P, F, u) {
  const xr = u * .44, RH = u * .15, TH = u * .06;
  const rock = x => -RH * (x / xr) ** 2;      // touches the floor in the middle

  // the rockers, as one ring: along the bottom curve and back along
  // the top one. A rocker is the whole reason a horse is a horse.
  const out = [], inn = [];
  for (let i = 0; i <= 12; i++) {
    const x = -xr + 2 * xr * (i / 12);
    out.push([x, rock(x)]);
    inn.push([x, rock(x) - TH]);
  }
  finish(s, out.concat(inn.reverse()), P.rank, { lw: LW2, F });

  for (const sd of [-1, 1])                  // two legs, and no more
    finish(s, barPts(sd * u * .20, rock(sd * u * .20) - TH, sd * u * .13, -u * .40,
                     u * .045, u * .045, 2), P.rank, { lw: LW2, F });

  finish(s, s.blobPts(0, -u * .47, u * .25, u * .115, 0, .32), P.rank, { lw: LW, F });
  finish(s, barPts(u * .13, -u * .46, u * .29, -u * .66, u * .075, u * .055, 2),
         P.rank, { lw: LW2, F });
  finish(s, s.blobPts(u * .33, -u * .70, u * .105, u * .085, -.35, .32),
         P.rank, { lw: LW2, F });
  finish(s, [[u * .285, -u * .755], [u * .325, -u * .835], [u * .360, -u * .745]],
         P.rank, { lw: LW3, F });                              // the ear
  finish(s, [[-u * .09, -u * .560], [u * .07, -u * .570],
             [u * .06, -u * .630], [-u * .08, -u * .620]], P.rank, { lw: LW3, F });

  s.ctx.fillStyle = s.inkA(.9);              // the void eye, as ever
  s.wobbly(u * .365, -u * .715, u * .030, u * .032);
  s.ctx.fill();
  s.sline([[u * .40, -u * .665], [u * .435, -u * .645], [u * .40, -u * .625]], REF * .018, .5);

  for (let i = 0; i < 3; i++) {               // the mane
    const t = i / 2, x = u * (.155 + .105 * t), y = -u * (.505 + .155 * t);
    s.sline([[x, y], [x - u * .075, y - u * .075]], REF * .020, .55);
    // and the tail, sweeping off the back
    s.sline([[-u * .23, -u * .485], [-u * .30, -u * .43 + i * u * .035],
             [-u * .37, -u * .35 + i * u * .045]], REF * .020, .5);
  }

  decorate(s, P, u, -u * .02, -u * .47, u * .175, u * .072);
  bells(s, P, F, u, -u * .20, -u * .05, -u * .575);
}

function drum(s, P, F, u) {
  const rw = u * .38, ry = u * .105, top = -u * .44;

  // the shell: over the top rim, down the sides, under the bottom one
  finish(s, arcPts(0, top, rw, ry, Math.PI, TAU, 14)
            .concat(arcPts(0, -ry, rw, ry, 0, Math.PI, 14)), P.rank, { lw: LW, F });
  const head = circlePts(0, top, rw, ry, 22, 0);
  finish(s, head, P.rank, { lw: LW2, F });                     // the skin

  // the lacing, as one zigzag cord between the rims. A wider drum
  // needs more of it, so the count is read off the size and never
  // rolled — six turns of cord on a small one, nine on a big one.
  const nz = 5 + Math.round(sizeN(P) * 3);
  const zig = [];
  for (let i = 0; i <= nz * 2; i++) {
    const a = Math.PI * (i / (nz * 2)), sy = Math.sin(a) * ry * .95;
    zig.push([Math.cos(a) * rw * .95, (i % 2 ? -ry : top) + sy]);
  }
  s.sline(zig, REF * .018, .5);

  decorate(s, P, u, 0, top, rw * .58, ry * .58);

  for (const sd of [-1, 1]) {                                  // the two sticks
    finish(s, barPts(sd * u * .32, -u * .04, -sd * u * .25, -u * .60,
                     u * .030, u * .026, 2), P.rank, { lw: LW3, F });
    finish(s, s.blobPts(-sd * u * .25, -u * .615, u * .046, u * .043, 0, .3),
           P.rank, { lw: LW3, F });
  }

  bells(s, P, F, u, -rw * .42, rw * .42, top + ry * .15);
}

// ---- the two things every toy can be given ----------------------

// Decoration, inside an elliptical patch the kind hands over. The
// COUNTS are fixed per style and drawn exactly: three stripes, five
// spots, three stars — the same three numbers that set the play rate.
function decorate(s, P, u, cx, cy, rx, ry) {
  if (P.decor === 'stripes') {
    for (let i = 0; i < 3; i++) {
      const t = (i - 1) * .58, y = cy + ry * t;
      const hw = rx * Math.sqrt(Math.max(0, 1 - t * t));
      const arc = [];
      for (let j = 0; j <= 8; j++) {
        const q = j / 8;
        arc.push([cx + (-1 + 2 * q) * hw, y + Math.sin(Math.PI * q) * ry * .16]);
      }
      s.sline(arc, REF * .024, .5);
    }
  } else if (P.decor === 'spots') {
    for (let i = 0; i < 5; i++) {
      const a = P.hand[i] * TAU, d = .35 + .45 * P.hand[(i + 2) % 10];
      s.ctx.fillStyle = s.inkA(.5);
      s.wobbly(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, u * .038, u * .036);
      s.ctx.fill();
    }
  } else if (P.decor === 'stars') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + P.hand[0] * 2;
      const st = starPts(cx + Math.cos(a) * rx * .55, cy + Math.sin(a) * ry * .55,
                         u * .030, u * .072, 5, -Math.PI / 2 + (P.hand[i + 4] - .5));
      s.sline(st.concat([st[0]]), REF * .020, .6);
    }
  }
}

// Bells, on little wires along the toy's top line. Drawn exactly as
// counted, spread over the span the kind gives — the loudest thing in
// the room and the easiest number on the card to check.
function bells(s, P, F, u, x0, x1, y) {
  for (let i = 0; i < P.bells; i++) {
    const t = P.bells === 1 ? .5 : i / (P.bells - 1);
    const x = x0 + (x1 - x0) * t, tip = y - u * .10;
    s.sline([[x * .78, y], [x, y - u * .05], [x, tip]], REF * .018, .6);
    finish(s, s.blobPts(x, tip + u * .055, u * .052, u * .050, 0, .3),
           P.rank, { lw: LW3, F });
    s.sline([[x - u * .042, tip + u * .088], [x + u * .042, tip + u * .088]],
            REF * .016, .55);                                  // the mouth
    s.ctx.fillStyle = s.inkA(.8);
    s.wobbly(x, tip + u * .100, u * .014, u * .014);           // the clapper
    s.ctx.fill();
  }
}
