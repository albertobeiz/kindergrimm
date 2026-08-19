// THE BROWS. Two short bands above the eyes — and almost all of the
// expression in the whole lab lives in their TILT. A brow rolled down
// toward the nose is angry, rolled up is worried, and it is the same
// geometry both times. That is why `roll` is in the plate basis rather
// than baked into an outline.
const STYLE = {
  none:  null,
  flat:  { curve: 'line', sag: 0,   wf: .9,  tf: .13, roll: 0 },
  angry: { curve: 'line', sag: 0,   wf: .85, tf: .15, roll: -.42 },
  sad:   { curve: 'line', sag: 0,   wf: .85, tf: .13, roll: .38 },
  round: { curve: 'arc',  sag: -.3, wf: .9,  tf: .12, roll: 0 },
  thick: { curve: 'arc',  sag: -.2, wf: .95, tf: .24, roll: 0 },
  worry: { curve: 'arc',  sag: .28, wf: .8,  tf: .12, roll: .16 },
};

export const BROW_STYLES = Object.keys(STYLE);

export const Brows = {
  id: 'brows', label: 'brows', order: 2,

  // ANECDOTAL. A brow changes a face completely, which is exactly why
  // almost nobody gets one — on a shelf where every toy has them they
  // stop being expression and become furniture.
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 88], ['flat', 3], ['angry', 3], ['round', 2],
                                 ['sad', 2], ['thick', 1], ['worry', 1]]),
    lift: C.range(rng, 'lift', .22, .42),      // above the eye, in face coordinates
    size: C.range(rng, 'size', .9, 1.25),      // × eye size
  }),

  meta: () => ({
    style: { label: 'style', pick: BROW_STYLES },
    lift: { label: 'lift', range: [.05, .7] },
    size: { label: 'size', range: [.5, 1.8] },
  }),

  build(add, P, L) {
    const st = STYLE[P.brows.style];
    if (!st) return;
    const r = L.eyeR * P.brows.size;

    for (const [id, side] of [['browL', -1], ['browR', 1]]) {
      const a = L.onFace(side * L.eyeX, L.eyeY + P.brows.lift,
                         { halfW: r * st.wf });
      add({ type: 'plate', id, outline: 'band',
            curve: st.curve, sag: st.sag * r, tube: r * st.tf,
            w: r * st.wf, h: r * st.tf,
            p: a.p, n: a.n, roll: st.roll * side,
            d: r * .22, bevel: r * st.tf * .5,
            // the head's own hair, pulled toward ink by the layout —
            // ink brows under blonde hair read as somebody else's
            proud: r * .1, color: L.browColor ?? L.ink });
    }
  },
};
