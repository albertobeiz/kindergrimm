// THE BODY. Four forms and one primitive: a sphere and a cube are the
// same superellipsoid with a squareness knob, and a ROCK and a SLIME
// are that ball with its surface bent — lumpy harmonics for one, a
// downward swell for the other (`formK` in gshape.js). The face
// catalogue never knows which: features place through `L.at`, the only
// thing a form has to provide.
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
    // how hard the bent forms are bent. Only `rock` and `slime` read
    // it, and it is WIDE, because on those two the bend is the entire
    // difference between one and the ball it started as.
    lump: C.range(rng, 'lump', .7, 1.5),
  }),

  meta: () => ({
    r: { label: 'size', range: [.3, .8] },
    wide: { label: 'width', range: [.7, 1.4] },
    tall: { label: 'height', range: [.7, 1.4] },
    deep: { label: 'depth', range: [.7, 1.2] },
    corner: { label: 'squareness', range: [2, 8] },
    lump: { label: 'lumpiness', range: [0, 2] },
  }),

  build(add, P, L) {
    add({ type: 'solid', id: 'body',
          rx: L.rx, ry: L.ry, rz: L.rz, exp: L.exp,
          // the same bend the layout landed the face with
          form: L.form, amp: P.body.lump,
          pos: [0, L.cy, 0], color: L.body });
  },
};
