// MARKS — the small stuff painted or stuck on a face: a scar, a
// plaster, freckles, a beauty spot, ink tears. The drawn generator has
// had these since the beginning (`src/parts/extras.js`) and they do the
// same job here: they are the difference between a product and a
// character, and they cost almost nothing.
//
// EVERY ONE IS ASYMMETRIC OR SCATTERED, on purpose. A mark mirrored
// neatly onto both cheeks stops reading as something that HAPPENED to
// this toy and starts reading as decoration that came out of the mould
// — which is the one thing a scar must not do. So a scar takes a side,
// freckles are a scatter, and only `tears` is a pair (it is a face
// doing something, not a mark).
//
// Marks lie FLAT: barely proud, no bevel to speak of. They are the one
// family in the lab that is painted rather than moulded, and a mark
// with a fat rounded rim reads as a lump of vinyl stuck on a cheek.
const STYLE = {
  none:     null,
  // one stroke across a brow, and a second short one crossing it
  scar:     { kind: 'scar', ticks: 1 },
  // the stitched version: a stroke with rungs
  sutures:  { kind: 'scar', ticks: 4 },
  // a plaster: a pad with a lighter middle
  plaster:  { kind: 'plaster' },
  // a scatter across the nose and both cheeks
  freckles: { kind: 'dots', n: 7, size: .09, spread: 1 },
  // one small dot, high on a cheek
  spot:     { kind: 'dots', n: 1, size: .13, spread: 0 },
  // two ink streaks running down from the eyes — the drawn rig's
  // black tears, and the only mark here that is a pair
  tears:    { kind: 'tears' },
};

export const MARK_STYLES = Object.keys(STYLE);

export const Mark = {
  // LAST. It goes over everything, including the blush.
  id: 'mark', label: 'marks', order: 6,

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 82], ['freckles', 5], ['scar', 3],
                                 ['plaster', 3], ['spot', 3], ['sutures', 2],
                                 ['tears', 2]]),
    side: rng.chance(.5) ? 1 : -1,
    size: C.range(rng, 'size', .85, 1.2),
    roll: rng.r(-.5, .5),
    // a scar over the brow reads as a fight; the same scar on the
    // cheek reads as a scratch. Worth having both.
    high: rng.chance(.55),
  }),

  meta: () => ({
    style: { label: 'style', pick: MARK_STYLES },
    size: { label: 'size', range: [.5, 1.8] },
    roll: { label: 'tilt', range: [-1.2, 1.2] },
    high: { label: 'over the brow', bool: true },
  }),

  build(add, P, L) {
    const M = P.mark;
    const st = STYLE[M.style];
    if (!st) return;
    const r = L.eyeR * M.size;
    const sd = M.side;
    // a plaster is not made of skin either — see `acc` in gmedia.js
    const fin = 'acc';

    // ---- SCAR / SUTURES ------------------------------------------------
    if (st.kind === 'scar') {
      const ay = M.high ? L.eyeY + .34 : L.eyeY - .3;
      const a = L.onFace(sd * (L.eyeX + .06), ay, { halfW: r * .5 });
      const len = r * .58, tube = r * .055;
      add({ type: 'plate', id: 'markScar', outline: 'band', curve: 'line',
            w: len, h: tube, tube,
            p: a.p, n: a.n, roll: M.roll + sd * .5,
            d: tube * 1.2, bevel: tube * .5, proud: tube * .3, color: L.ink });
      // the rungs. One is a crossed scar; four is a stitched seam.
      for (let i = 0; i < st.ticks; i++) {
        const t = st.ticks === 1 ? 0 : (i / (st.ticks - 1) - .5) * 1.3;
        add({ type: 'plate', id: 'markTick' + i, outline: 'band', curve: 'line',
              w: tube * 3.2, h: tube * .8, tube: tube * .8,
              p: a.p, n: a.n, roll: M.roll + sd * .5 + Math.PI / 2,
              offset: [t * len * .78, 0],
              d: tube, bevel: tube * .4, proud: tube * .3, color: L.ink });
      }
      return;
    }

    // ---- PLASTER -------------------------------------------------------
    if (st.kind === 'plaster') {
      const a = L.onFace(sd * (L.eyeX + .1), L.eyeY - .34, { halfW: r * .62 });
      const w = r * .62, h = r * .26;
      add({ type: 'plate', id: 'markPlaster', outline: 'rect',
            w, h, r: h * .5,
            p: a.p, n: a.n, roll: M.roll + sd * .38,
            d: r * .07, bevel: r * .035, proud: r * .03, color: L.sclera, finish: fin });
      // the pad: the darker middle every plaster has
      add({ type: 'plate', id: 'markPad', outline: 'rect',
            w: w * .38, h: h * .62, r: h * .2,
            p: a.p, n: a.n, roll: M.roll + sd * .38,
            d: r * .05, bevel: r * .02, proud: r * .055, color: L.warm, finish: fin });
      return;
    }

    // ---- DOTS: freckles, or one beauty spot ----------------------------
    if (st.kind === 'dots') {
      const rr = r * st.size;
      for (let i = 0; i < st.n; i++) {
        // A FIXED scatter, not a rolled one: marks are rebuilt every
        // boil frame, so anything random here would crawl across the
        // face. Two harmonics give a spread that does not read as a row.
        const u = st.n === 1 ? 0 : i / (st.n - 1) * 2 - 1;
        const ax = st.spread
          ? u * (L.eyeX + .34) + Math.sin(i * 2.4) * .06
          : sd * (L.eyeX + .3);
        const ay = st.spread
          ? L.eyeY - .3 + Math.sin(i * 3.9) * .1
          : L.eyeY - .16;
        const a = L.onFace(ax, ay, { halfW: rr });
        add({ type: 'plate', id: 'markDot' + i, outline: 'ellipse',
              w: rr, h: rr, p: a.p, n: a.n,
              d: rr * .5, bevel: rr * .25, proud: rr * .1,
              color: st.n === 1 ? L.ink : L.warm });
      }
      return;
    }

    // ---- TEARS ---------------------------------------------------------
    // straight down from under each eye, and long: a short one reads as
    // a smudge rather than as something running
    for (const [id, side] of [['markTearL', -1], ['markTearR', 1]]) {
      const a = L.onFace(side * L.eyeX, L.eyeY - .34, { halfW: r * .09 });
      add({ type: 'plate', id, outline: 'band', curve: 'line',
            w: r * .5, h: r * .085, tube: r * .085,
            p: a.p, n: a.n, roll: Math.PI / 2,
            d: r * .06, bevel: r * .03, proud: r * .03, color: L.ink });
    }
  },
};
