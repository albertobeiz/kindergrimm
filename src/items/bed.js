// ---------------------------------------------------------------
// THE BED — the only thing in the toybox that gives TIME back.
//
// Every other family makes a child better at doing something. A bed
// makes the doing cost less: a child asleep on it is a child not
// standing in the dark. So the whole family pays out in `rest`, the
// recovery multiplier the room applies while they sleep, and the
// stat bag is empty on purpose — furniture is not carried and cannot
// buff anybody until somebody lies down on it.
//
// It is drawn FROM ABOVE, because it lies on the lino: `drawBedTop`
// in scenery.js is the template, and the anchor is the middle of the
// mattress. Length runs down the page, the head end is up.
//
// The four things you can read off the paper are the four things
// that make it a better bed:
//   how LONG it is        — the mattress is drawn at its real length
//   how FAT the quilt is  — a thicker loft, drawn as a second contour
//                           running inside the blanket's edge
//   how big the PILLOW is — a blob at the head end, at its real depth
//   what is ON the quilt  — plain, striped, patched, starred
// and the cot rail, which is the one thing that is about lasting
// rather than resting: it is the frame, so it takes the chewing.
//
// A soft bed is a frail bed. All that loft is more to chew through,
// so the plushest quilt has the shortest life — that is the trade,
// and it is the same feature paying twice.
// ---------------------------------------------------------------
import { REF, finish, barPts, starPts } from './core.js';
import { chaikin } from '../sketch.js';

// The mattress, in REF fractions. The WIDTH is fixed and the LENGTH
// is the whole variable — one axis to compare, so two beds side by
// side sort themselves, and a short one reads as a cot rather than
// as a small bed.
const HW = .23;                 // half width
const HL = .46;                 // half length at len = 1

// What each quilt is worth in rest. The pattern IS the number: a
// starred quilt is the good one and looks like the good one.
const QUILT_REST = { plain: 0, stripe: .06, patch: .10, stars: .14 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const n01 = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

const nLen = P => n01(P.len, .6, .95);
const nSoft = P => n01(P.soft, .3, .8);
const nPil = P => n01(P.pillow, .15, .3);

// ---- geometry ---------------------------------------------------
// A mattress-shaped ring: a rectangle with its corners rounded off,
// crooked by a FIXED amount per keypoint. The crookedness comes from
// a phase rolled once in gen(), never from the boil — a bed redrawn
// every frame has to keep the same outline, and finish()'s stroke is
// where the hand comes from.
function slab(cx, cy, hx, hy, ph, amt, round = 1) {
  const k = [[-hx, -hy], [0, -hy], [hx, -hy], [hx, 0],
             [hx, hy], [0, hy], [-hx, hy], [-hx, 0]];
  const c = k.map(([x, y], i) => {
    const w = Math.sin(i * 1.9 + ph) * amt;
    return [cx + x * (1 + w), cy + y * (1 + w * .7)];
  });
  return chaikin(c, true, round);
}

// ---- the quilt --------------------------------------------------
// Drawn ON the blanket and clipped to it, so the pattern runs off the
// edge the way a child's does. Every count comes from the blanket's
// own size — nothing here is rolled, so a longer bed simply carries
// more patches, and none of it crawls between boil frames.
function quilt(s, P, bl, bw, y0, y1) {
  const span = y1 - y0;

  if (P.quilt === 'plain') {
    for (let i = 1; i <= 2; i++) {          // nothing to look at: two creases
      const y = y0 + span * (i / 3);
      s.sline([[-bw * .84, y], [bw * .84, y + REF * .006]], REF * .016, .26);
    }
    return;
  }

  s.ctx.save();
  s.poly(bl, true);
  s.ctx.clip();

  if (P.quilt === 'stripe') {
    const n = Math.max(2, Math.round(span / (REF * .062)));
    for (let i = 1; i < n; i++) {
      const y = y0 + span * (i / n);
      const wide = i % 2;                   // a thick/thin pair reads as woven
      s.sline([[-bw * 1.06, y], [bw * 1.06, y + REF * .005]],
        REF * (wide ? .026 : .014), wide ? .5 : .32);
    }
  } else if (P.quilt === 'patch') {
    const cell = REF * .118;
    const cols = Math.max(2, Math.round((bw * 2) / cell));
    const rows = Math.max(2, Math.round(span / cell));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2) continue;          // every other square, alternating
        const xa = -bw + 2 * bw * (c / cols), xb = -bw + 2 * bw * ((c + 1) / cols);
        const ya = y0 + span * (r / rows), yb = y0 + span * ((r + 1) / rows);
        s.hatchFill([[xa, ya], [xb, ya], [xb, yb], [xa, yb]],
          REF * .03, r % 2 ? .7 : -.7, .3, 1.1);
      }
    }
    for (let c = 1; c < cols; c++) {        // the seams, run long on purpose
      const x = -bw + 2 * bw * (c / cols);
      s.sline([[x, y0 - REF * .02], [x, y1 + REF * .02]], REF * .017, .4);
    }
    for (let r = 1; r < rows; r++) {
      const y = y0 + span * (r / rows);
      s.sline([[-bw * 1.06, y], [bw * 1.06, y + REF * .004]], REF * .017, .4);
    }
  } else {
    // stars: a lattice with every other row shifted half a cell, so it
    // reads as scattered without spending a single random number
    const cell = REF * .155;
    const cols = Math.max(2, Math.round((bw * 2) / cell));
    const rows = Math.max(2, Math.round(span / cell));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -bw + 2 * bw * ((c + .5 + (r % 2 ? .5 : 0)) / cols);
        if (Math.abs(x) > bw * .9) continue;
        const y = y0 + span * ((r + .5) / rows);
        const st = starPts(x, y, REF * .019, REF * .046, 5, (r * 2 + c) * .6 - Math.PI / 2);
        s.sline(st.concat([st[0]]), REF * .016, .55);
      }
    }
  }

  s.ctx.restore();
}

export const Bed = {
  id: 'bed',
  slot: 'floor',
  kind: 'bed',                     // the hand always deals one of these
  noun: 'bed',
  weight: 7,
  // it LIES on the floor: drawn top-down, anchored in the middle, and
  // the scene lays it flat instead of billboarding it
  flat: true,

  gen(rng, C) {
    return {
      len: rng.r(.6, .95),
      pillow: rng.r(.15, .3),
      quilt: C.wpick(rng, [['plain', 4], ['patch', 4], ['stripe', 3], ['stars', 2]]),
      bars: rng.chance(.4),
      soft: rng.r(.3, .8),
      wob: rng.r(0, Math.PI * 2),   // the outline's own crookedness, rolled once
    };
  },

  // Empty, and it should be: a bed is never carried, so it has nothing
  // to add to a child until one is asleep on it. Everything this family
  // does is in objOf().
  statsOf() {
    return { add: {}, mul: {} };
  },

  objOf(P) {
    const k = P.pow ?? 1;

    // How much faster a child recovers on it. Four visible features,
    // four terms — the quilt pattern included, because the pattern is
    // the first thing you can see from across the room. The .08 floor
    // is for having a bed at all: the worst roll still beats the lino.
    const raw = .08 + .26 * nSoft(P) + .09 * nPil(P) + .10 * nLen(P) + QUILT_REST[P.quilt];
    const rest = 1 + clamp(raw * k, 0, .8);

    // How long it survives being slept in and chewed on. The rail is
    // the frame and holds it together; the loft is just more to chew.
    const dur = Math.round(clamp(
      (95 + 55 * nLen(P) + (P.bars ? 40 : 0) - 30 * nSoft(P)) * k, 45, 320));

    // The footprint is SQUARE on purpose. A flat prop is stamped at
    // min(W, H), so anything but a square box shrinks the drawing to
    // the short side and leaves the bed floating in its own quad. The
    // box is sized so the drawn mattress lands at a real bed's length.
    const D = 1.55 + 1.15 * P.len;

    return {
      kind: 'bed', wU: D, hU: D, flat: true,
      dur, rest: +rest.toFixed(2),
    };
  },

  adj(P) {
    const c = [
      ['long', nLen(P)],
      ['stubby', 1 - nLen(P)],
      ['soft', nSoft(P)],
      ['thin', 1 - nSoft(P)],
      ['plump', nPil(P)],
    ];
    let best = c[0];
    for (const e of c) if (e[1] > best[1]) best = e;
    if (best[1] > .68) return best[0];
    if (P.bars) return 'barred';
    return { plain: null, patch: 'patchy', stripe: 'stripy', stars: 'starry' }[P.quilt];
  },

  desc(P) {
    if (nSoft(P) > .7) return 'the fatter the quilt the faster they drop off';
    if (P.bars) return 'the rail keeps them in, and it is what gets chewed first';
    if (P.quilt === 'stars') return 'the stars go face up, where a child can count them';
    if (nLen(P) > .7) return 'long enough to sleep in properly';
    if (nPil(P) > .7) return 'most of it is pillow';
    if (nLen(P) < .25) return 'a cot really, but they fit for now';
    return 'somewhere to put a tired child';
  },

  draw(s, P, F) {
    const hw = REF * HW, hl = REF * HL * P.len;
    const ns = nSoft(P);

    // ---- the mattress ---------------------------------------------
    const mat = slab(0, 0, hw, hl, P.wob, .03, 1);
    finish(s, mat, P.rank, { lw: REF * .032, F });
    s.hatchFill(mat, REF * .055, -.5, .10, 1.1);        // the sheet's tone

    // ---- the pillow -----------------------------------------------
    // `pillow` is the fraction of the bed's LENGTH it eats, so a plump
    // one is plump on a long bed too
    const ph = hl * P.pillow;
    const pcy = -hl + ph + REF * .022;
    const pil = slab(0, pcy, hw * .84, ph, P.wob * 1.7 + 1.1, .06, 2);
    finish(s, pil, P.rank, { lw: REF * .026, F });
    s.sline([[-hw * .5, pcy], [hw * .5, pcy + REF * .004]], REF * .017, .3);

    // ---- the blanket, turned down over the lower two thirds --------
    const by0 = -hl * .18, by1 = hl * 1.02;
    const bw = hw * 1.05;                                // it hangs over the sides
    const bcy = (by0 + by1) / 2, bhl = (by1 - by0) / 2;
    const bl = slab(0, bcy, bw, bhl, P.wob * .7, .022, 1);
    finish(s, bl, P.rank, { lw: REF * .030, F });
    // the tone doubles as the loft: a fat quilt is a denser scribble
    s.scribbleFill(bl, REF * (.085 - .035 * ns), .10 + .06 * ns);
    quilt(s, P, bl, bw, by0, by1);

    // the loft itself — a second contour as far inside the edge as the
    // quilt is thick. This is where `soft` is actually legible.
    const loft = REF * (.012 + .034 * ns);
    const inner = slab(0, bcy, bw - loft, bhl - loft, P.wob * .7, .022, 1);
    s.sline(inner.concat([inner[0]]), REF * .017, .35);

    // the turn-down: the edge gone over twice, and the fold under it
    s.sline([[-bw * .98, by0], [bw * .98, by0 + REF * .004]], REF * .026, .5);
    s.sline([[-bw * .9, by0 + REF * .036], [bw * .9, by0 + REF * .034]], REF * .016, .3);

    // ---- the cot rail ---------------------------------------------
    // Across the head end, drawn last because it is the frame and sits
    // over everything. Spindle count comes off the width, not the dice.
    if (P.bars) {
      const ry = -hl * .99;
      finish(s, barPts(-hw * 1.06, ry, hw * 1.06, ry, REF * .020, REF * .020, 2),
        P.rank, { lw: REF * .024, F });
      const n = Math.max(4, Math.round((hw * 2) / (REF * .062)));
      for (let i = 0; i <= n; i++) {
        const x = -hw + 2 * hw * (i / n);
        s.sline([[x, ry - REF * .04], [x, ry + REF * .04]], REF * .018, .5);
      }
    }
  },
};
