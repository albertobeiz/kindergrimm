// --------------------------------------------------------------
// THE LEAVES — the part every species is named for: grass grows
// BLADES, a houseplant grows a ROSETTE, a tree grows a CROWN, a
// flower grows a SPRIG. One interface called four ways. Species
// pick the style; the params the style needs are rolled under it.
// --------------------------------------------------------------
import { oshash as osh } from '../oshape.js';

export const Leaves = {
  id: 'leaves', label: 'leaves', order: 2,

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['tuft', 40], ['rosette', 30], ['crown', 20], ['sprig', 10]]),
    count: C.range(rng, 'count', 4, 9),
    size: C.range(rng, 'size', .6, 1.3),
    lean: C.range(rng, 'lean', .25, .5),
    seed: rng.ri(1, 1e9),
  }),

  meta: () => ({
    style: { label: 'style', pick: ['tuft', 'rosette', 'crown', 'sprig'] },
    count: { label: 'count', range: [2, 24], step: 1 },
    size: { label: 'size', range: [.4, 1.8] },
  }),

  build(add, P, L, C) {
    const n = (P.count | 0) || 6;
    const w = L.leaf.size * .55;            // the ONE leaf unit

    if (P.style === 'crown') {
      // a TREE's crown: a nest of blobs resting on the trunk top.
      // The crown is not leaves pinned to twigs — it is a canopy,
      // one volume the way the gloss bodies are one volume.
      const cr = Math.max(L.stem.r * 1.9, L.leaf.size * .9);
      const cy = L.crownY + L.leaf.size * .35;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + osh(P.seed, i) * .6;
        const rr = cr * (.55 + osh(P.seed, i * 3) * .5);
        const y = cy + (osh(P.seed, i * 5) - .4) * cr * .8;
        add({ shape: 'blob', rx: rr, ry: rr * (1 + osh(P.seed, i * 7) * .4),
              rz: rr * .85, n: 2.5, wob: .16, seed: P.seed + i,
              pos: [Math.cos(a) * rr * .6, y, Math.sin(a) * rr * .6],
              color: i % 3 ? C.leaf : C.leafD });
      }
      return;
    }

    if (P.style === 'tuft') {
      // grass: MANY slender blades in a ring around the mound, each
      // leaning its own way (osh keeps it stable per recipe)
      const tot = Math.round(n * 2.2);
      for (let i = 0; i < tot; i++) {
        const a = (i / tot) * Math.PI * 2 + osh(P.seed, i) * .5;
        const h = L.leaf.size * (1.1 + osh(P.seed, i * 3) * .9);
        const lean = .12 + osh(P.seed, i * 5) * .45;
        // roots scattered ACROSS the mound, not on one ring — ringed,
        // face-on neighbours overlapped into what read as a single
        // wide fin
        const rr = L.M.r * (.1 + osh(P.seed, i * 11) * .38);
        add({ shape: 'blade', w: Math.min(w * .45, h * .17), h, lean,
              droop: osh(P.seed, i * 7) * .5,
              pos: [Math.cos(a) * rr, L.rootY, Math.sin(a) * rr],
              rot: [0, a + osh(P.seed, i) * .3, -lean * .4],
              color: i % 3 ? C.leaf : C.leafD });
      }
      return;
    }

    // --- the pointing-leaf family: rosette and sprig ------------------
    // a ring of CUPPED leaves tilted up and out from a stem point —
    // the curl arcs each tip back up, so the ring reads as moulded
    // plastic rather than paddles glued to a post. Alternate leaves
    // stand steeper, which is what layers a rosette without a second
    // ring. A sprig stays small and thin.
    const place = P.style === 'sprig'
      ? L.rootY + L.stem.h * .45
      : L.rootY + (L.stem.h ? Math.max(L.stem.h * .2, .2) : .2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + osh(P.seed, i) * .5;
      const tilt = .38 + (i % 2) * .28 + osh(P.seed, i * 2) * .3;  // 0 = up, 1 = out
      const h = L.leaf.size * (.7 + osh(P.seed, i * 4) * .6);
      add({
        shape: 'leaf', w: w * (P.style === 'sprig' ? .55 : .9),
        h, n: 2.4,
        depth: .045 * Math.max(.6, h),          // meat scales with the leaf
        curl: -(.1 + osh(P.seed, i * 6) * .12), // tip arcs back toward upright
        pos: [Math.cos(a) * .08, place, Math.sin(a) * .08],
        rot: [0, a, -tilt * 1.15],
        color: i % 3 ? C.leaf : C.leafD,
      });
    }
  },
};