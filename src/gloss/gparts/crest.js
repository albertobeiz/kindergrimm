// THE CREST — ears, horns, and whatever else breaks the top of the
// head. This is the other half of why the reference reads as a shelf
// of CREATURES: a cat, a bear and a bunny are the same ball with the
// same face, told apart entirely by what sticks up. The silhouette is
// doing the species work.
//
// Ears are PLATES, like the face: flat shapes with a bevelled rim,
// facing the camera. That is not a cheat — the reference toys' ears
// really are this flat — and it means an inner-ear is just a smaller
// warm plate on top, the way an eye's pupil is. They stand on
// `L.top(t)`, the layout's rim-of-the-head anchor, tilted a little
// toward the surface normal so a pair fans outward.
const STYLE = {
  none:  null,
  cat:   { outline: 'tri',  wf: .82, hf: 1.05, inner: .5,  lean: .2 },
  bear:  { outline: 'ellipse', wf: .76, hf: .76, inner: .55, lean: .12 },
  bunny: { outline: 'rect', wf: .42, hf: 1.2, r: 1, inner: .55, lean: .16, tall: true },
  horns: { outline: 'tri',  wf: .4, hf: .78,  inner: 0,  lean: .55, tone: 'warm' },
  stubs: { outline: 'ellipse', wf: .36, hf: .52, inner: 0, lean: .3, tone: 'warm' },
};

// Three hair styles lived here — `tuft`, `mop`, `curl`, ink plates
// standing on the crown. They were a placeholder for a real haircut and
// they are gone: hair is `hair.js` now, a lofted shell over the skull
// with a hem, a colour table and a finish of its own. The crest is back
// to what it is good at, which is ears and horns.

export const CREST_STYLES = Object.keys(STYLE);

export const Crest = {
  id: 'crest', label: 'ears', order: 2,

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 26], ['bear', 20], ['cat', 18], ['bunny', 14],
                                 ['horns', 12], ['stubs', 10]]),
    spread: C.range(rng, 'spread', .45, .78), // out along the crown, ±1 is the side
    size: C.range(rng, 'size', .7, .95),      // × the head's own radius
  }),

  meta: () => ({
    style: { label: 'style', pick: CREST_STYLES },
    spread: { label: 'apart', range: [.15, 1] },
    size: { label: 'size', range: [.4, 1.6] },
  }),

  build(add, P, L) {
    const C = P.crest;
    const st = STYLE[C.style];
    if (!st) return;
    const u = Math.min(L.rx, L.ry) * .5 * C.size;
    const w = u * st.wf, h = u * st.hf * (st.tall ? 1 : 1);
    const d = u * .3;

    for (const [id, side] of [['earL', -1], ['earR', 1]]) {
      const a = L.top(side * C.spread);
      // fanned: mostly facing the camera, leaning into the head's own
      // normal so a pair splays the way stuck-on ears do
      const n = [a.n[0] * .45, a.n[1] * .45, 1];
      // MIRRORED: the pair leans the other way round, so each ear
      // carries the tilt its opposite used to. `side` is −1 left,
      // +1 right, and negating it is the whole flip.
      const roll = -side * st.lean;
      // the base is buried: the plate is shifted up its own v so its
      // bottom third is inside the head and it can never hover
      const lift = h * .62;

      add({ type: 'plate', id, outline: st.outline,
            w, h, r: st.r == null ? undefined : Math.min(w, h) * st.r,
            flip: true,
            p: a.p, n, roll, d, bevel: Math.min(d * .5, w * .4),
            offset: [0, lift],
            color: st.tone === 'warm' ? L.warm : L.body });

      if (st.inner) {
        // centred in the VISIBLE ear, not on the plate's own middle —
        // the outer plate's lower third is buried in the head, so an
        // inner pad sharing its centre sits at the base of the ear
        add({ type: 'plate', id: id + 'Inner', outline: st.outline,
              w: w * st.inner, h: h * st.inner,
              r: st.r == null ? undefined : Math.min(w, h) * st.inner * st.r,
              flip: true,
              p: a.p, n, roll, d: d * .5, bevel: d * .2,
              offset: [0, lift + h * (1 - st.inner) * .4], proud: d * .7,
              color: L.warm });
      }
    }
  },
};
