// --------------------------------------------------------------
// THE MOUND — the soil every plant grows from. One part, one job:
// it is the ROOT. The layout reads its params to publish the soil
// surface, and every other part (blades, rosette, stem) roots on
// that surface without ever learning how the mound is built.
// --------------------------------------------------------------
import { oshash } from '../oshape.js';

export const Mound = {
  id: 'mound', label: 'mound', order: 0,

  gen: (rng, C) => ({
    r: C.range(rng, 'r', .6, 1.2),        // half-width of the soil
    tall: C.range(rng, 'tall', .35, .65), // how high the soil rises —
                                          // it is a bed, not half the plant
    bump: C.chance(rng, 'bump', .6),
    seed: rng.ri(1, 1e9),                // the wobble, fixed per recipe
  }),

  meta: () => ({
    r: { label: 'width', range: [.3, 1.5] },
    tall: { label: 'rise', range: [.2, 1.1] },
    bump: { label: 'an extra lump', bool: true },
  }),

  build(add, P, L, C) {
    // a squat, wobbly dome sitting ON the floor (dome: .45 keeps the
    // underside hidden — the half-sphere already ends at y=0)
    add({ shape: 'blob', rx: P.r, ry: P.tall, rz: P.r * 1.08,
          n: 2.2, wob: .06, seed: P.seed, dome: .45,
          pos: [0, 0, 0], color: C.ground });
    if (P.bump) {
      const a = oshash(P.seed, 7) * Math.PI * 2;
      add({ shape: 'blob', rx: P.r * .5, ry: P.tall * .62, rz: P.r * .52,
            n: 2.5, wob: .14, seed: P.seed + 3, dome: .45,
            pos: [Math.cos(a) * P.r * .55, 0, Math.sin(a) * P.r * .55],
            color: C.ground });
    }
  },
};