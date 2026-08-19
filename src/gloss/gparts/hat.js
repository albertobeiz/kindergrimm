// HEADWEAR — the last of the extras and the loudest, because unlike a
// mark or a pair of glasses a hat changes the SILHOUETTE, which is the
// only thing that survives at sheet scale.
//
// Its relationship with the HAIR splits the catalogue in two, and
// getting that wrong is what a first pass does:
//
//   HUG    a beanie or a cap is PULLED ON, and a real one compresses
//          the hair under it — it wants the head's own radius plus a
//          little, and the hair poking out below the rim is the read.
//          Sized to clear a big soft cut instead, it stands a whole
//          hair's volume off the skull at every height, including
//          down at the ears where there is no hair at all, and comes
//          out as a bowl balanced on the head.
//   PERCH  a headband, a bow, a flower, a crown — these sit ON TOP of
//          whatever is up there and genuinely need `L.hairTop`, which
//          the hair publishes via `hairOuter`. Same edge as the eyes
//          publishing `eyeProud` for the spectacles.
//
// The vocabulary is deliberately three shapes of thing:
//
//   DOME   a sphere cut short (`dome`) — a beanie, a cap's crown
//   BAND   a sphere ZONE, cut at both ends (`domeFrom`) — a brim, a
//          cuff, a headband. This is what `domeFrom` was added for.
//   PLATE  the flat stuff — a visor, a bow, a flower
//
// Colour comes off the toy's own palette (`warm`, `lite`, `ink`) rather
// than a new table. A hat in an unrelated colour is a different
// product; a hat in the family's colours is an accessory.
const STYLE = {
  none:    null,
  // pulled down over the crown, with a rolled cuff at the rim
  beanie:  { dome: .42, cuff: [.38, .47], hug: 1.09 },
  // a shallower crown plus a visor out front
  cap:     { dome: .34, visor: true, hug: 1.08 },
  // a thin zone lying round the head: the headband
  band:    { band: [.28, .35], grow: 1.04 },
  // points standing round the crown
  crown:   { points: 6, grow: 1.03 },
  // one bow on the side of the head
  bow:     { bow: true, grow: 1.02 },
  // and one flower, same place, quieter
  flower:  { bloom: true, grow: 1.02 },
};

export const HAT_STYLES = Object.keys(STYLE);

/**
 * What a PULLED-ON hat does to the hair under it, or null.
 *
 * A beanie neither clears the hair nor hides inside it: it FLATTENS it.
 * Sized to clear a big cut it is a bowl balanced on the head; sized to
 * the skull it vanishes under the hair entirely — both were built.
 * What actually happens is that the hair is squashed above the hat's
 * rim and spills out below it, so this publishes the ceiling and where
 * it starts, and `ghair.js` reads it off the LAYOUT. The two parts have
 * to agree about one number, which is the layout's whole job.
 */
export function hatHug(P) {
  const st = STYLE[P.hat?.style];
  if (!st || !st.hug) return null;
  const k = st.hug * (P.hat.size ?? 1);
  return { k, rimY: k * Math.cos(Math.PI * st.dome) };
}

export const Hat = {
  // after the hair, whose outer radius it needs
  id: 'hat', label: 'hat', order: 3,

  // Rare. A hat is a strong statement and the shelf can carry a few.
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 86], ['beanie', 3], ['cap', 3],
                                 ['band', 3], ['bow', 2], ['flower', 2],
                                 ['crown', 1]]),
    // WHICH accessory colour. The layout turns this into a hex that is
    // guaranteed to stand clear of the skin and the hair.
    accIx: rng.ri(0, 9),
    size: C.range(rng, 'size', .94, 1.12),
    // which side a bow or a flower sits on, and how far round
    side: rng.chance(.5) ? 1 : -1,
    lean: C.range(rng, 'lean', .7, 1.15),
  }),

  meta: () => ({
    style: { label: 'style', pick: HAT_STYLES },
    accIx: { label: 'colour', range: [0, 9] },
    size: { label: 'size', range: [.8, 1.3] },
    lean: { label: 'placement', range: [.4, 1.5] },
  }),

  build(add, P, L) {
    const T = P.hat;
    const st = STYLE[T.style];
    if (!st) return;
    const col = L.acc;
    // An accessory is NOT made of the toy: left to inherit the shell's
    // finish a beanie on a humanoid is poured in SKIN. `acc` is the
    // soft plastic they all wear, and its sheen is self-coloured —
    // rubber's white one washed a brick red out to pale pink.
    const fin = 'acc';
    // HUG the head and let the hair squash under it, or PERCH on top
    // of whatever the hair is doing — see the header
    const k = (st.hug ? st.hug : L.hairTop * st.grow) * T.size;
    const rx = L.rx * k, ry = L.ry * k, rz = L.rz * k;
    const solid = (id, extra) => add({
      type: 'solid', id, rx, ry, rz, exp: L.exp, cast: true, finish: fin,
      pos: [0, L.cy, 0], color: col, ...extra });

    if (st.dome) {
      solid('hat', { dome: st.dome });
      // the CUFF: a zone, slightly fatter than the crown it rolls
      // under, which is the whole read of a knitted brim
      if (st.cuff)
        add({ type: 'solid', id: 'hatCuff', exp: L.exp, cast: true,
              rx: rx * 1.045, ry: ry * 1.03, rz: rz * 1.045,
              dome: st.cuff[1], domeFrom: st.cuff[0], finish: fin,
              pos: [0, L.cy, 0], color: col });
    }
    if (st.band)
      add({ type: 'solid', id: 'hat', exp: L.exp, cast: true,
            rx, ry, rz, dome: st.band[1], domeFrom: st.band[0], finish: fin,
            pos: [0, L.cy, 0], color: col });

    // THE VISOR — a flat plate out over the face at the cap's rim. The
    // one piece that says which way a cap is pointing.
    if (st.visor) {
      const a = L.at(0, .52);
      add({ type: 'plate', id: 'hatVisor', outline: 'ellipse',
            w: L.rx * .62 * T.size, h: L.rz * .52 * T.size,
            p: [a.p[0], a.p[1], a.p[2] + L.rz * .12],
            // laid nearly flat, tipped a little down at the front
            n: [0, .86, .5], d: L.s * .05, bevel: L.s * .022,
            proud: 0, color: col, cast: true, finish: fin });
    }

    // THE CROWN — points standing round the top on `L.top`, the same
    // anchor the ears use
    if (st.points) {
      for (let i = 0; i < st.points; i++) {
        const t = (i / (st.points - 1) - .5) * 1.5;
        const a = L.top(t);
        const u = L.s * .16 * T.size;
        add({ type: 'plate', id: 'hatPoint' + i, outline: 'tri', flip: true,
              w: u * .5, h: u, p: a.p, n: [a.n[0] * .5, a.n[1] * .5, 1],
              roll: -t * .5, d: u * .35, bevel: u * .16,
              offset: [0, u * .35], color: col, cast: true, finish: fin });
      }
    }

    // A BOW or a FLOWER, off to one side of the crown — the two extras
    // that are placed rather than worn
    if (st.bow || st.bloom) {
      const a = L.top(T.side * T.lean * .62);
      const u = L.s * (st.bow ? .2 : .17) * T.size;
      const n = [a.n[0] * .6, a.n[1] * .6, .8];
      if (st.bloom) {
        add({ type: 'plate', id: 'hatBloom', outline: 'flower', petals: 5, amp: .34,
              w: u, h: u, p: a.p, n, d: u * .3, bevel: u * .14,
              proud: u * .1, color: col, cast: true, finish: fin });
        add({ type: 'plate', id: 'hatBloomEye', outline: 'ellipse',
              w: u * .3, h: u * .3, p: a.p, n, d: u * .2, bevel: u * .09,
              proud: u * .34, color: L.sclera, finish: fin });
        return;
      }
      // two loops and a knot: the cheapest bow that reads as one
      for (const s of [-1, 1])
        add({ type: 'plate', id: 'hatBow' + (s < 0 ? 'L' : 'R'), outline: 'tri',
              w: u * .5, h: u * .8, p: a.p, n, roll: s * Math.PI / 2,
              offset: [s * u * .62, 0], d: u * .3, bevel: u * .13,
              proud: u * .08, color: col, cast: true, finish: fin });
      add({ type: 'plate', id: 'hatKnot', outline: 'ellipse',
            w: u * .26, h: u * .26, p: a.p, n,
            d: u * .3, bevel: u * .13, proud: u * .2, color: col, finish: fin });
    }
  },
};
