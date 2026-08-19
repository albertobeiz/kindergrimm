// --------------------------------------------------------------
// THE STEM — the trunk. Three styles that are really one shape at
// three proportions: `none` (grass grows blades, not trunks),
// `stalk` (a flower or a houseplant's thin neck), `trunk` (a
// tree's mighty pillar with a belly).
//
// It publishes how tall it got — the layout reads it and the
// leaves and the bloom perch on the crown it owns.
// --------------------------------------------------------------

export const Stem = {
  id: 'stem', label: 'stem', order: 1,

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['stalk', 50], ['trunk', 30], ['none', 20]]),
    h: C.range(rng, 'h', .8, 1.6),
    r: C.range(rng, 'r', .3, .6),
    belly: C.range(rng, 'belly', .08, .3),
    lean: C.range(rng, 'lean', 0, .12),
    leanRot: rng.r(0, Math.PI * 2),      // fixed per recipe: which way
    seed: rng.ri(1, 1e9),
  }),

  meta: () => ({
    style: { label: 'style', pick: ['none', 'stalk', 'trunk'] },
    h: { label: 'height', range: [.4, 3] },
    r: { label: 'thickness', range: [.1, .9] },
    belly: { label: 'belly', range: [0, .5] },
    lean: { label: 'lean', range: [0, .3] },
  }),

  build(add, P, L, C) {
    if (P.style === 'none') return;
    // a stalk is a POLE — nearly full radius all the way up, capped —
    // where a trunk is the cone that tapers into its crown. Same
    // lathe, one blend knob (see trunkProfile in oshape.js).
    add({ shape: 'trunk', h: P.h, r: P.r, belly: P.belly,
          lean: P.lean, leanRot: P.leanRot,
          taper: P.style === 'stalk' ? .68 : 0,
          pos: [0, L.rootY, 0], color: C.trunk });
  },
};