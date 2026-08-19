// THE NOSE. Small, central, and the one feature that is sometimes a
// real lump rather than a plate: a button nose wants to be a ball,
// because half of what sells it is the highlight sliding around a
// curve the flat features do not have.
const STYLE = {
  none:   null,
  dot:    { type: 'plate', outline: 'ellipse', wf: .3,  hf: .3 },
  button: { type: 'solid', wf: .42, hf: .42, sink: .45 },
  snout:  { type: 'plate', outline: 'rect', wf: .8, hf: .38 },
  beak:   { type: 'plate', outline: 'tri', wf: .46, hf: .42, flip: true },
  cat:    { type: 'plate', outline: 'tri', wf: .42, hf: .3, flip: true },
  heart:  { type: 'plate', outline: 'heart', wf: .38, hf: .34 },
};

export const NOSE_STYLES = Object.keys(STYLE);

export const Nose = {
  id: 'nose', label: 'nose', order: 3,

  // Most characters have NO nose. Two eyes and a mouth is the whole face in
  // the reference, and a nose on every one of them turns a sheet of
  // characters into a sheet of the same character.
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 91], ['dot', 3], ['button', 2], ['snout', 1],
                                 ['cat', 1], ['beak', 1], ['heart', 1]]),
    bias: C.range(rng, 'bias', -.04, .04),     // off the midpoint the layout publishes
    size: C.range(rng, 'size', .42, .66),      // × eye size
    warm: C.chance(rng, 'warm', .35),      // in the palette's warm colour, not ink
  }),

  meta: () => ({
    style: { label: 'style', pick: NOSE_STYLES },
    bias: { label: 'height', range: [-.2, .2] },
    size: { label: 'size', range: [.3, 1.8] },
    warm: { label: 'warm tone', bool: true },
  }),

  build(add, P, L) {
    const N = P.nose;
    const st = STYLE[N.style];
    if (!st) return;
    // the layout's midpoint between eyes and mouth: a nose cannot
    // collide with a mouth however either of them is dragged
    const r = L.eyeR * N.size;
    const a = L.at(0, L.noseY + N.bias);
    const color = N.warm ? L.warm : L.ink;

    const base = 0;

    if (st.type === 'solid') {
      // sunk most of the way in, so it reads as a bump on the face and
      // not a bead balanced on it
      add({ type: 'solid', id: 'nose', rx: r * st.wf, ry: r * st.hf, rz: r * st.wf,
            p: a.p, n: a.n, proud: base - r * st.wf * st.sink, color });
      return;
    }
    add({ type: 'plate', id: 'nose', outline: st.outline, flip: st.flip,
          w: r * st.wf, h: r * st.hf,
          p: a.p, n: a.n,
          d: r * .3, bevel: Math.min(r * .18, r * st.hf * .45),
          proud: base + r * .12, color });
  },
};
