// SPECTACLES — the first of the EXTRAS, and the ones that change a face
// most for the least geometry: two frames, a bridge, and the toy is
// suddenly somebody in particular.
//
// Every style is stacked plates, the same trick as a pupil on a white:
// a FRAME (a ring outline, so it is a frame rather than a disc) and,
// where the style wants one, a LENS filled behind it. The catalogue is
// really two questions — round or square, and see-through or not.
//
// WHERE THEY SIT is the whole difficulty, and it is not a constant. An
// `orb` eye is a ball standing three quarters of its own radius off the
// head; a plate eye is almost flush. So the eyes publish `eyeProud` and
// the layout hands it over — spectacles placed for a flat eye cut
// straight through an eyeball, which is exactly what happened.
const STYLE = {
  none:    null,
  // wire rounds. Thin, dark, the reading-glasses read
  round:   { outline: 'ring', wf: 1.28, hf: 1.28, thick: .16 },
  // heavy squares — the ones you actually notice at sheet scale
  square:  { outline: 'rring', wf: 1.34, hf: 1.14, thick: .22, r: .34 },
  // filled lenses in ink: shades. No frame of its own, because a dark
  // lens IS its own silhouette and a frame round it just goes muddy
  sunnies: { outline: 'rring', wf: 1.42, hf: 1.02, thick: .16, r: .3, lens: 'ink' },
  // a pale lens behind a dark frame: the goggle read, and the one
  // style where the eye still shows THROUGH something
  goggles: { outline: 'ring', wf: 1.5, hf: 1.5, thick: .26, lens: 'lite' },
  // ONE lens, on one side, and the asymmetry is the joke
  monocle: { outline: 'ring', wf: 1.3, hf: 1.3, thick: .18, single: true },
};

export const SPECS_STYLES = Object.keys(STYLE);

export const Specs = {
  // AFTER the eyes and the brows: it reads their sizes off the layout,
  // and it has to sit in front of whatever they built.
  id: 'specs', label: 'specs', order: 4,

  // Anecdotal, like the brows and for the same reason: glasses on every
  // toy stop being a character and become the house style.
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 88], ['round', 4], ['square', 3],
                                 ['sunnies', 2], ['goggles', 2], ['monocle', 1]]),
    size: C.range(rng, 'size', .92, 1.18),     // × the eye's own size
    ink: C.chance(rng, 'ink', .72),            // frame in ink, or in the warm
    side: rng.chance(.5) ? 1 : -1,             // which eye a monocle takes
  }),

  meta: () => ({
    style: { label: 'style', pick: SPECS_STYLES },
    size: { label: 'size', range: [.6, 1.6] },
    ink: { label: 'dark frame', bool: true },
  }),

  build(add, P, L) {
    const S = P.specs;
    const st = STYLE[S.style];
    if (!st) return;
    const r = L.eyeSize * S.size;
    // ink, or the accessory colour — never the toy's own warm, which
    // on a humanoid is another skin tone and vanishes
    const frame = S.ink ? L.ink : L.acc;
    // clear of whatever the eyes built, plus air. `eyeProud` is in eye
    // units, so it scales with them.
    const lift = L.eyeSize * (L.eyeProud + .16);
    // spectacles are plastic, not whatever the toy is poured in
    const fin = 'glossy';
    const w = r * st.wf, h = r * st.hf;
    const d = r * .18;

    for (const [id, side] of [['specL', -1], ['specR', 1]]) {
      if (st.single && side !== S.side) continue;
      // `onFace`, not `at`: a lens is wider than the eye under it, so
      // it is the one that walks at the silhouette
      const a = L.onFace(side * L.eyeX, L.eyeY, { halfW: w });

      if (st.lens) {
        // behind the frame, and a hair smaller, so the frame's inner
        // edge always overlaps it and no seam of skin shows between
        add({ type: 'plate', id: id + 'Lens', outline: st.outline === 'ring' ? 'ellipse' : 'rect',
              w: w * .94, h: h * .94, r: st.r == null ? undefined : Math.min(w, h) * st.r,
              p: a.p, n: a.n, d: d * .5, bevel: d * .2,
              proud: lift - d * .3,
              color: st.lens === 'ink' ? L.ink : L.lite , finish: fin });
      }
      add({ type: 'plate', id, outline: st.outline,
            w, h, thick: st.thick,
            r: st.r == null ? undefined : Math.min(w, h) * st.r,
            p: a.p, n: a.n, d, bevel: Math.min(d * .5, Math.min(w, h) * st.thick * .6),
            proud: lift, color: frame , finish: fin });
    }

    // THE BRIDGE — a short bar between the two, on the midline. A pair
    // of lenses with nothing joining them reads as two stickers.
    if (!st.single) {
      const b = L.at(0, L.eyeY);
      // the lens centre's WORLD x, from the same call that placed the
      // frames — `eyeX` is a face coordinate and `w` a world length,
      // and multiplying them gave a bar that reached neither lens
      const xw = Math.abs(L.onFace(L.eyeX, L.eyeY, { halfW: w }).p[0]);
      // run out past each frame's inner edge, most of the way through
      // its rim: the bevel eats a hair off the band's ends, and a bar
      // that only kisses the rim's midline can still fall short of it
      const span = xw - w * (1 - st.thick * .75);
      if (span > 0)
        add({ type: 'plate', id: 'specBridge', outline: 'band', curve: 'line',
              w: span, h: r * .09, tube: r * .09,
              p: b.p, n: b.n, d: d * .8, bevel: d * .3,
              proud: lift - d * .1, color: frame , finish: fin });
    }

    // and a STRAP for the goggles: one band round the head, which is
    // the only thing that says these are worn rather than held
    if (st.strap) {
      for (const side of [-1, 1]) {
        const a = L.onFace(side * (L.eyeX + .62), L.eyeY, { facing: .12 });
        add({ type: 'plate', id: 'specStrap' + (side < 0 ? 'L' : 'R'),
              outline: 'band', curve: 'line',
              w: r * .5, h: r * .16, tube: r * .16,
              p: a.p, n: a.n, d: d * .7, bevel: d * .25,
              proud: r * .1, color: frame , finish: fin });
      }
    }
  },
};
