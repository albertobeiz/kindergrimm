// THE MOUTH — two families now, and the split is the whole reference:
//
//   LINES — a stroke along a centreline (smile, cat, zig…). Small,
//   ink, the pastel-egg register. These are what we had.
//
//   MAWS — a CONSTRUCTED mouth: an ink outline with a dark maroon
//   interior behind it, and optionally a white strip of teeth hanging
//   from the top lip and a warm tongue rising from the bottom. This is
//   the Ferriz read — the shark grin, the zombie teeth, the huge
//   open holler — and it is allowed to be ENORMOUS: half the face and
//   more. The earlier small-and-black rule was for the line family,
//   and the maws are exactly the exception it was waiting for.
//
// A maw is stacked plates, nothing else — the same trick as a pupil
// on a white. Interior parked behind the outline, furniture parked in
// front of the interior.
const STYLE = {
  none:  null,
  // -- lines: small, ink -------------------------------------------
  smile: { line: true, curve: 'arc',  sag: .42, wf: 1, tf: .15 },
  frown: { line: true, curve: 'arc',  sag: -.4, wf: .9, tf: .15 },
  flat:  { line: true, curve: 'line', sag: 0,   wf: .8, tf: .14 },
  cat:   { line: true, curve: 'wave', sag: .34, wf: 1.05, tf: .14 },
  zig:   { line: true, curve: 'zig',  sag: .34, wf: 1, tf: .12 },
  // -- maws: big, built --------------------------------------------
  // mul is the licence to go big: it scales the whole construction
  // `mul` is the licence to go big — but it was written when the eye
  // unit was half this size, and everything here scales off that unit.
  // At 2.3 a maw came out spanning the whole face.
  open:   { maw: true, wf: 1, hf: .78, mul: 1.42 },
  holler: { maw: true, wf: .8, hf: 1.05, mul: 1.45 },      // taller than wide
  grin:   { maw: true, wf: 1.3, hf: .52, mul: 1.5, allTeeth: true },
};

export const MOUTH_STYLES = Object.keys(STYLE);

/** how far the mouth reaches above its own centre, in units of
 *  `L.eyeR`. The layout asks, the same way it asks `eyeReach`, so a
 *  maw two eyes tall still gets pushed clear of the eyes. */
export function mouthReach(P) {
  const st = STYLE[P.mouth.style];
  if (!st) return 0;
  return (st.line ? st.tf * 1.4 : st.hf) * (st.mul ?? 1) * P.mouth.size;
}

/** and sideways: the mouth's half-width in units of `L.eyeR`. A maw on
 *  a narrow chin is the layout's problem in BOTH axes. */
export function mouthSpan(P) {
  const st = STYLE[P.mouth.style];
  if (!st) return 0;
  return (st.wf ?? 1) * (st.mul ?? 1) * P.mouth.size;
}

export const Mouth = {
  id: 'mouth', label: 'mouth', order: 5,

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['open', 18], ['smile', 16], ['grin', 12], ['cat', 12],
                                 ['flat', 10], ['holler', 9], ['zig', 7], ['frown', 6],
                                 ['none', 10]]),
    // close under the eyes: the face reads as one band of features,
    // not a pair of eyes with a mouth adrift somewhere below them
    y: C.range(rng, 'y', -.2, -.02),        // a wish — the layout may push it down
    size: C.range(rng, 'size', .5, .78),       // × eye size, × the style's own mul
    proud: C.range(rng, 'proud', .08, .2),
    teeth: C.chance(rng, 'teeth', .6),      // a maw's white strip
    tongue: C.chance(rng, 'tongue', .45),    // and its warm tongue
  }),

  meta: () => ({
    style: { label: 'style', pick: MOUTH_STYLES },
    y: { label: 'height', range: [-.8, .1] },
    size: { label: 'size', range: [.4, 2] },
    proud: { label: 'relief', range: [0, .5] },
    teeth: { label: 'teeth', bool: true },
    tongue: { label: 'tongue', bool: true },
  }),

  build(add, P, L) {
    const M = P.mouth;
    const st = STYLE[M.style];
    if (!st) return;
    const r = L.eyeR * M.size * (st.mul ?? 1) * L.mouthFit;
    const a = L.at(0, L.mouthY);
    const base = r * M.proud * (st.line ? 1 : .4);

    if (st.line) {
      add({ type: 'plate', id: 'mouth', outline: 'band',
            curve: st.curve, sag: st.sag * r, tube: r * st.tf,
            w: r * st.wf, h: r * st.tf,
            p: a.p, n: a.n,
            d: r * .22, bevel: r * st.tf * .5,
            proud: base, color: L.ink });
      // ONE white fang hanging off the line, point down and a little
      // off-centre — the single tooth is a whole personality
      if (M.teeth && M.tongue) {
        add({ type: 'plate', id: 'mouthFang', outline: 'tri',
              w: r * .16, h: r * .22,
              p: a.p, n: a.n,
              d: r * .18, bevel: r * .05,
              proud: base + r * .05, offset: [r * st.wf * .38, -r * .2],
              color: L.sclera });
      }
      return;
    }

    // ---- a maw ------------------------------------------------------
    const w = r * st.wf, h = r * st.hf, d = r * .16;
    const corner = Math.min(w, h) * .8;

    // the outline: the drawn lip line around everything
    add({ type: 'plate', id: 'mouth', outline: 'rect',
          w, h, r: corner,
          p: a.p, n: a.n, d, bevel: d * .5,
          proud: base, color: L.ink });

    // the interior, behind the lip line
    add({ type: 'plate', id: 'mouthMaw', outline: 'rect',
          w: w * .84, h: h * .8, r: corner * .8,
          p: a.p, n: a.n, d: d * .8, bevel: d * .3,
          proud: base + d * .5, color: st.allTeeth ? L.sclera : L.maw });

    if (st.allTeeth) {
      // the grin: the interior IS the teeth, split by ink bars
      const bars = w > h * 1.8 ? 3 : 2;
      for (let i = 0; i < bars; i++) {
        const fx = (i + 1) / (bars + 1) * 2 - 1;
        add({ type: 'plate', id: `mouthBar${i}`, outline: 'rect',
              w: w * .035, h: h * .68, r: w * .03,
              p: a.p, n: a.n, d: d * .5, bevel: d * .12,
              proud: base + d * .95, offset: [fx * w * .8, 0],
              color: L.ink });
      }
      // and one horizontal split, upper teeth from lower
      add({ type: 'plate', id: 'mouthSplit', outline: 'rect',
            w: w * .8, h: h * .05, r: h * .04,
            p: a.p, n: a.n, d: d * .5, bevel: d * .12,
            proud: base + d * .95, offset: [0, -h * .06],
            color: L.ink });
      return;
    }

    if (M.teeth) {
      // Hanging FROM the top lip, and SPLIT. One white slab in a dark
      // mouth reads as a sticking plaster however it is placed — what
      // makes it teeth is the divisions, which is exactly why `grin`
      // was the best-reading mouth on the sheet. Same trick here.
      const tw = w * .62, th = h * .3, ty = h * .8 - th;
      add({ type: 'plate', id: 'mouthTeeth', outline: 'rect',
            w: tw, h: th, r: th * .16,
            p: a.p, n: a.n, d: d * .6, bevel: d * .15,
            proud: base + d * .95, offset: [0, ty],
            color: L.sclera });
      for (let i = 0; i < 3; i++) {
        add({ type: 'plate', id: `mouthTooth${i}`, outline: 'rect',
              w: tw * .035, h: th * .82, r: tw * .03,
              p: a.p, n: a.n, d: d * .4, bevel: d * .1,
              proud: base + d * 1.15, offset: [(i - 1) * tw * .46, ty],
              color: L.ink });
      }
    }
    if (M.tongue) {
      add({ type: 'plate', id: 'mouthTongue', outline: 'ellipse',
            w: w * .42, h: h * .42,
            p: a.p, n: a.n, d: d * .8, bevel: d * .3,
            proud: base + d * .8, offset: [0, -h * .52],
            color: L.warm });
    }
  },
};
