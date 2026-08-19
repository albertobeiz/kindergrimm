// THE BLUSH. Two warm patches out on the cheeks, in a colour taken
// from the toy's own palette rather than a pink invented for the job —
// which is what keeps a shelf of twenty looking like one product line.
//
// It sits barely proud: a cheek is the one feature that should read as
// painted on rather than moulded in.
const STYLE = {
  none:   null,
  oval:   { outline: 'ellipse', wf: 1, hf: .62, n: 1 },
  round:  { outline: 'ellipse', wf: .8, hf: .8, n: 1 },
  stripes:{ outline: 'rect', wf: .8, hf: .1, n: 3 },
  heart:  { outline: 'heart', wf: .62, hf: .58, n: 1 },
};

export const BLUSH_STYLES = Object.keys(STYLE);

export const Blush = {
  id: 'blush', label: 'blush', order: 5,

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 40], ['oval', 20], ['round', 16], ['stripes', 12], ['heart', 12]]),
    out: C.range(rng, 'out', .24, .4),        // further out than the eyes
    drop: C.range(rng, 'drop', .2, .38),       // and below them
    size: C.range(rng, 'size', .8, 1.25),      // × eye size
  }),

  meta: () => ({
    style: { label: 'style', pick: BLUSH_STYLES },
    out: { label: 'outward', range: [0, .8] },
    drop: { label: 'drop', range: [0, .8] },
    size: { label: 'size', range: [.4, 2] },
  }),

  build(add, P, L) {
    const B = P.blush;
    const st = STYLE[B.style];
    if (!st) return;
    const r = L.eyeR * B.size;

    for (const [id, side] of [['blushL', -1], ['blushR', 1]]) {
      // onFace, not at: a cheek is placed outboard of the eye on
      // purpose, which walks it straight at the silhouette
      const a = L.onFace(side * (L.eyeX + B.out), L.eyeY - B.drop,
                         { halfW: r * st.wf });
      for (let i = 0; i < st.n; i++) {
        // a stripe set is one shape repeated up the cheek
        const dy = st.n === 1 ? 0 : (i - (st.n - 1) / 2) * r * .34;
        add({ type: 'plate', id: st.n === 1 ? id : `${id}${i}`, outline: st.outline,
              w: r * st.wf * (st.n > 1 ? 1 - Math.abs(i - (st.n - 1) / 2) * .22 : 1),
              h: r * st.hf,
              p: a.p, n: a.n, roll: side * .12, offset: [0, dy],
              d: r * .16, bevel: Math.min(r * .09, r * st.hf * .45),
              proud: r * .04, color: L.warm });
      }
    }
  },
};
