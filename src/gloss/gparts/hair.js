// THE HAIR — the humanoid's only, and the part that turns a head into a
// character. The shapes are all in `ghair.js`; this file is the dice.
//
// The DEFAULT IS BALD, and that is deliberate rather than lazy: a cast
// style table is exclusive, so a species that says nothing about hair
// gets none, and only the humanoid casts real styles. A bear with a
// ponytail is one line away and it is not one anybody wanted.
import { buildHair, HAIR_STYLES } from '../ghair.js';
import { HAIR_IDS, HAIR_WEIGHTS } from '../gpalette.js';

export { HAIR_STYLES };

export const Hair = {
  id: 'hair', label: 'hair', order: 2,

  gen: (rng, C) => ({
    // bald unless a species asks — see the header
    style: C.pick(rng, 'style', [['bald', 100]]),
    // hair has its own colour table, never the body's palette
    color: C.pick(rng, 'color', HAIR_WEIGHTS),
    // how far the clumps stand off the head. WIDE, because flat-and-
    // sleek against big-and-soft is most of the difference between two
    // heads wearing the same cut.
    vol: C.range(rng, 'vol', .7, 1.5),
    // how many clumps: fewer and chunkier, or more and finer
    density: C.range(rng, 'density', .8, 1.25),
    // how far each clump wraps past its own slice — the overlap
    width: C.range(rng, 'width', .9, 1.15),
    // how unequal the tips are. This is what stops a hem reading as a
    // line somebody ruled across the head.
    jag: C.range(rng, 'jag', .6, 1.5),
    wave: C.range(rng, 'wave', .7, 1.35),
    part: C.range(rng, 'part', .7, 1.3),
    // ONE seed for every per-clump variation on the head. It has to be
    // a rolled parameter rather than live randomness: hair is rebuilt
    // on every boil frame, and anything re-rolled per frame shimmers.
    seed: rng.r(0, 6.283),
    // the tied-up styles
    // Just BEHIND the ear — about a right angle off the nose. Tied
    // further round than that the tail hangs behind the head and the
    // whole silhouette is lost from the front, which is the only angle
    // the sheet ever sees; tied forward of it, it covers the cheek.
    tailAng: C.range(rng, 'tailAng', 1.45, 1.85),   // radians off the face
    tailY: C.range(rng, 'tailY', .5, .78),          // how high it is tied
    tailLen: C.range(rng, 'tailLen', .8, 1.9),      // × head height
    bunAng: C.range(rng, 'bunAng', .7, 1.15),
    bunR: C.range(rng, 'bunR', .17, .26),
    // THE AHOGE, and it is worth a knob of its own: one strand off the
    // crown reads as a whole personality, so it is dealt often but not
    // to everyone.
    ahoge: C.chance(rng, 'ahoge', .22),
    ahogeAng: rng.r(-.5, .5),
    ahogeDir: rng.chance(.5) ? 1 : -1,
  }),

  meta: () => ({
    style: { label: 'cut', pick: HAIR_STYLES },
    color: { label: 'colour', pick: HAIR_IDS },
    vol: { label: 'volume', range: [.5, 2] },
    wave: { label: 'wave', range: [0, 2] },
    part: { label: 'parting', range: [0, 2] },
    density: { label: 'clumps', range: [.6, 1.6] },
    width: { label: 'clump width', range: [.7, 1.4] },
    jag: { label: 'ragged tips', range: [0, 2] },
    seed: { label: 'shuffle', range: [0, 6.28] },
    tailY: { label: 'tied at', range: [.2, .8] },
    tailLen: { label: 'tail length', range: [.4, 2.4] },
    tailAng: { label: 'tails apart', range: [1.2, 2.6] },
    bunR: { label: 'bun size', range: [.1, .35] },
    ahoge: { label: 'ahoge', bool: true },
  }),

  build(add, P, L) {
    for (const piece of buildHair(P, L)) {
      // a bun is a ball, and the body's own solid primitive already
      // makes those — no reason for `ghair.js` to loft a sphere
      if (piece.ball) {
        add({ type: 'solid', id: piece.id, color: L.hair, cast: true, finish: 'hair',
              rx: piece.ball.r, ry: piece.ball.r * .92, rz: piece.ball.r,
              pos: [piece.ball.pos[0], piece.ball.pos[1] + L.cy, piece.ball.pos[2]] });
        continue;
      }
      // hair is a real volume standing off the head, not a feature lying
      // flush on it, so unlike every other face part it CASTS
      add({ type: 'mesh', id: piece.id, mesh: piece.mesh,
            pos: [0, L.cy, 0], color: L.hair, cast: true, finish: 'hair' });
    }
  },
};
