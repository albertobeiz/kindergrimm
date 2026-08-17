// The head, and it is most of the character. A doodle skull is huge —
// half the total height — and the whole face is painted onto its front
// surface by other parts, so the ONE thing this part must get right is
// the profile, which is why the profile itself lives in vlayout.js and
// this file only fills it in.
import { HEAD_SHAPES } from '../vlayout.js';

export const Skull = {
  id: 'skull', label: 'head', group: 'head',

  gen: (rng, C) => ({
    shape: C.pick(rng, 'shape', [
      ['round', 30], ['box', 22], ['tall', 14], ['wide', 12], ['dome', 10], ['drop', 8], ['wonky', 6],
    ]),
    w: C.int(rng, 'w', 4, 7),          // half-width: the head is 2w+1 across
    h: C.int(rng, 'h', 9, 14),
    d: C.int(rng, 'd', 4, 6),
    jaw: C.range(rng, 'jaw', .74, 1.08),
    // a muzzle is a species opt-in: 0 for anybody who is not an animal
    muzzle: C.range(rng, 'muzzle', 0, 0),
    muzzleY: C.range(rng, 'muzzleY', .30, .44),
    wonk: rng.r(-1.6, 1.6),
    pale: C.chance(rng, 'pale', .6),   // a snout in a lighter tone
    chin: C.chance(rng, 'chin', .55),  // a shaded jaw
  }),

  meta: () => ({
    shape: { label: 'shape', pick: HEAD_SHAPES },
    w: { label: 'half width', range: [3, 8], step: 1 },
    h: { label: 'height', range: [6, 16], step: 1 },
    d: { label: 'half depth', range: [3, 7], step: 1 },
    jaw: { label: 'jaw', range: [.6, 1.2] },
    muzzle: { label: 'muzzle', range: [0, 5] },
    muzzleY: { label: 'muzzle height', range: [.15, .6] },
    wonk: { label: 'wonk', range: [-2.5, 2.5] },
    pale: { label: 'pale snout', bool: true },
    chin: { label: 'shaded jaw', bool: true },
  }),

  build(v, P, st, V) {
    const H = V.head;
    const zTop = H.cz + H.d + Math.ceil(P.muzzle) + 2;
    for (let y = H.y0; y <= H.y1; y++)
      for (let z = H.z0 - 1; z <= zTop; z++)
        for (let x = H.x0 - 2; x <= H.x1 + 2; x++)
          if (V.contains(x, y, z)) v.set(x, y, z, V.pal.skin);

    // the jaw takes a shade — it is the one place a big round head
    // needs help reading as a solid rather than as a ball
    if (P.chin)
      for (let z = H.z0; z <= zTop; z++)
        for (let x = H.x0; x <= H.x1; x++)
          for (const y of [H.y0, H.y0 + 1]) if (v.taken(x, y, z)) v.set(x, y, z, V.pal.skinD);

    // a snout in a lighter tone: this is what makes a muzzle read as a
    // muzzle instead of as a long chin
    if (V.muzzle && P.pale) {
      const m = V.muzzle;
      for (let y = Math.floor(m.cy - m.ry); y <= Math.ceil(m.cy + m.ry); y++)
        for (let z = Math.floor(m.cz - m.rz); z <= zTop; z++)
          for (let x = H.x0; x <= H.x1; x++)
            if (V.inMuzzle(x, y, z)) v.set(x, y, z, V.pal.skinL);
    }
  },
};
