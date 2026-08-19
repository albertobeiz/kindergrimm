// --------------------------------------------------------------
// THE BLOOM — the flower head. Every species can have one, but the
// styles are each species' own word: a daisy (flower), a blossom
// (tree), a grasshead (grass), a ball (houseplant). The bloom
// perches on L.crownY — the top of the stem — which the stem
// published; it never learns what a trunk is.
// --------------------------------------------------------------
import { oshash as osh } from '../oshape.js';

export const Bloom = {
  id: 'bloom', label: 'bloom', order: 3,

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 60], ['daisy', 20], ['ball', 10], ['blossom', 10]]),
    size: C.range(rng, 'size', .5, 1),
    petals: C.range(rng, 'petals', 6, 10),
    seed: rng.ri(1, 1e9),
  }),

  meta: () => ({
    style: { label: 'style', pick: ['none', 'daisy', 'ball', 'blossom', 'grasshead'] },
    size: { label: 'size', range: [.3, 1.4] },
    petals: { label: 'petals', range: [4, 14], step: 1 },
  }),

  build(add, P, L, C) {
    const y = L.crownY;                        // the perch the stem owns
    if (P.style === 'none') return;

    if (P.style === 'ball') {
      // a houseplant's ball of blossom: one generous wobbly sphere
      add({ shape: 'blob', rx: .35 * P.size, ry: .3 * P.size, rz: .35 * P.size,
            n: 2.2, wob: .18, seed: P.seed, pos: [0, y, 0], color: C.bloom });
      return;
    }

    if (P.style === 'blossom') {
      // a tree's blossom: tiny white balls dusted over the crown
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + osh(P.seed, i) * .5;
        const rr = .5 + osh(P.seed, i * 2) * .4;
        add({ shape: 'blob', rx: .07 * P.size, ry: .07 * P.size, rz: .07 * P.size,
              n: 2, wob: .1, seed: P.seed + i,
              pos: [Math.cos(a) * rr, y + (osh(P.seed, i * 3) - .3) * .5,
                    Math.sin(a) * rr],
              color: C.bloom });
      }
      return;
    }

    if (P.style === 'grasshead') {
      // a grass seed-head: a few tiny blades standing over the tuft
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + osh(P.seed, i) * .4;
        add({ shape: 'blade', w: .03 * P.size, h: .8 * P.size, lean: .1,
              droop: 0,
              pos: [Math.cos(a) * .1, L.rootY, Math.sin(a) * .1],
              rot: [0, a, 0], color: C.leafD });
      }
      return;
    }

    // daisy — the flower's bloom: a ring of petals around a disc.
    // Every petal is a flat plate fanned out; the disc is a squashed
    // dome that hides the stems and gives the head its middle.
    const n = (P.petals | 0) || 8;
    const pr = .22 * P.size;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      add({
        shape: 'petal', w: pr * .62, h: pr * 2.2,
        curl: .16,                         // tips cup up toward the sun
        pos: [0, y + .01, 0],
        rot: [0, a, .95],                  // petal plates lying outward
        color: C.bloom,
      });
    }
    add({ shape: 'blob', rx: pr, ry: pr * .8, rz: pr, n: 2.6, wob: .06,
          seed: P.seed, pos: [0, y + pr * .15, 0], color: C.bloomD });
  },
};