// THE BODY. A sphere or a cube, which are one superellipsoid with a
// squareness knob. The face catalogue never knows which: features
// place through `L.at`, the only thing a form has to provide.
export const Body = {
  id: 'body', label: 'body', order: 0,

  // The sheet normalises every toy to one HEIGHT, so `r` is nearly
  // invisible and the ratios are everything: squat-and-wide against
  // tall-and-narrow is the only silhouette variety a sphere has. These
  // were ±6% and every toy came out the same circle.
  gen: (rng, C) => ({
    r: C.range(rng, 'r', .46, .54),
    // A head is square or WIDER, never taller than it is wide. A tall
    // narrow head reads as a face squeezed in a vice; the whole family
    // sits between a square and a squat oval.
    wide: C.range(rng, 'wide', 1, 1.3),
    tall: C.range(rng, 'tall', .84, 1),
    deep: C.range(rng, 'deep', .86, 1.06),
    // how hard the corners are squared off. Only a `cube` reads it —
    // a sphere is pinned at 2 so it stays an exact ball. 2.8 is a
    // pillow, 5.5 is a proper block with the edges softened.
    corner: C.range(rng, 'corner', 2.8, 5.5),
    // which chibi skull. Only a `head` reads it — the preset is a
    // whole modeled cage (gskull.js), so the pick IS the silhouette.
    // The neutral egg and the bun carry the shelf; the pointier and
    // squarer skulls are the exceptions.
  }),

  meta: () => ({
    r: { label: 'size', range: [.3, .8] },
    wide: { label: 'width', range: [.7, 1.4] },
    tall: { label: 'height', range: [.7, 1.4] },
    deep: { label: 'depth', range: [.7, 1.2] },
    corner: { label: 'squareness', range: [2, 8] },
  }),

  build(add, P, L) {
    add({ type: 'solid', id: 'body',
          rx: L.rx, ry: L.ry, rz: L.rz, exp: L.exp, pos: [0, L.cy, 0],
          color: L.body });
  },
};
