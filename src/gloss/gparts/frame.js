// THE FRAME — what a character STANDS ON. Two stances: `none` (the head IS
// the character, the sheet as it always was) and `biped` (a chibi torso on
// two stub feet, arms at the sides).
//
// Everything here is RAYMAN anatomy: no arms, no legs, no neck. The
// torso is an upright pill (a superellipsoid taller than it is wide,
// squared just enough to read as a cylinder), the hands are balls
// FLOATING beside it, the feet are shoes floating under it, and the
// air in the gaps is what makes it a character and not a figurine. The head
// still SINKS into the torso — the one joint that is a socket, not a
// gap. The head stays the character: the whole frame adds roughly half a
// head of height, never more, so the face keeps carrying the sheet.
//
// The split of labour follows the muzzle rule: this part knows what a
// frame IS (the proportions, where limbs sit), so `frameLayout` states
// it — and the LAYOUT calls it, because the head's own height depends
// on the answer. The part's build() then just stamps what the layout
// measured. Face parts never learn any of this: they place through
// `L.at`, which simply sits higher.
import { subdivideN } from '../catmullClark.js';

export const Frame = {
  id: 'frame', label: 'frame', order: 1,

  // rolled for every character, read only when the recipe's stance is not
  // `none` — same shape as `corner`, which only a cube reads
  gen: (rng, C) => ({
    // SMALL. The head is the character and the frame is a stand it grew —
    // these were a quarter bigger and the characters started reading as
    // characters with heads instead of heads with a stance.
    hips: C.range(rng, 'hips', .23, .31),      // torso half-width × r
    squat: C.range(rng, 'squat', .2, .27),     // torso half-height × r
    // squared enough that the sides run straight — that is the whole
    // difference between a pill and an egg
    belly: C.range(rng, 'belly', 2.4, 3.2),
    float: C.range(rng, 'float', .05, .1),     // the air under the torso, × r
    footR: C.range(rng, 'footR', .13, .17),    // shoe half-width × r
    handR: C.range(rng, 'handR', .1, .14),     // mitt radius × r
    handY: C.range(rng, 'handY', .35, .6),     // where on the torso they hover
    // THE OUTFIT. `dressed` swaps the torso from the body's own pour to
    // cloth; gloves and shoes are always coloured — a bare biped with
    // white gloves and red shoes is the oldest character design there
    // is. The layout resolves the colours (`L.outfit`); this only rolls
    // the dice. Half the creatures go dressed; the humanoid pins 1.
    dressed: C.chance(rng, 'dressed', .5),
    clothIx: rng.ri(0, 9),
    // the screen-printed graphic on the cloth. `none` carries the
    // sheet — a print on every chest is a uniform, not a wardrobe.
    motif: C.pick(rng, 'motif', [['none', 44], ['stripes', 16], ['star', 11],
                                 ['heart', 10], ['spot', 10], ['zig', 9]]),
  }),

  meta: () => ({
    hips: { label: 'torso width', range: [.2, .6] },
    squat: { label: 'torso height', range: [.18, .55] },
    belly: { label: 'torso square', range: [2, 4.5] },
    float: { label: 'float gap', range: [.02, .3] },
    footR: { label: 'foot size', range: [.1, .35] },
    handR: { label: 'hand size', range: [.08, .3] },
    handY: { label: 'hand height', range: [0, 1] },
    dressed: { label: 'dressed', bool: true },
    motif: { label: 'print', pick: ['none', 'stripes', 'star', 'heart', 'spot', 'zig'] },
  }),

  build(add, P, L) {
    const Fr = L.frame, O = L.outfit;
    if (!Fr) return;
    // A DRESSED torso is cloth: the `acc` finish (matte, self-coloured
    // sheen) in the outfit's cloth colour, with the print riding as a
    // baked map. Undressed it is the same POUR as the head — a knitted
    // bear has a knitted belly. Either way it is a real volume in the
    // light, so it casts.
    if (O.dressed) {
      add({ type: 'solid', id: 'torso', frame: true, cast: true,
            finish: 'acc', color: O.cloth,
            print: O.motif !== 'none'
              ? { motif: O.motif, cloth: O.cloth, ink: O.ink } : undefined,
            rx: Fr.torso.rx, ry: Fr.torso.ry, rz: Fr.torso.rz, exp: Fr.torso.exp,
            pos: Fr.torso.pos });
    } else {
      add({ type: 'solid', id: 'torso', frame: true, shell: true, cast: true,
            rx: Fr.torso.rx, ry: Fr.torso.ry, rz: Fr.torso.rz, exp: Fr.torso.exp,
            pos: Fr.torso.pos, color: L.body });
    }
    // gloves and shoes are ALWAYS worn — soft plastic in their own
    // colours, never the character's pour
    for (const limb of Fr.limbs)
      add({ type: 'mesh', id: limb.id, frame: true, cast: true,
            finish: 'acc',
            color: limb.id.startsWith('hand') ? O.glove : O.shoe,
            mesh: limb.mesh, pos: limb.pos });
  },
};

// ---- the extremities, MODELED --------------------------------------
// A mitten has a palm and a thumb; a shoe has a sole, a toe and a
// heel. Those are parts you can name, so — same verdict as the rock
// and the slime — they get a control CAGE through Catmull-Clark, not
// another ellipsoid. Both cages are a handful of rings, deterministic
// (no rng: a frame is rebuilt per recipe and must never boil), and
// authored ONCE as the LEFT one — the right is a mirror.

const rotY = (verts, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return verts.map(([x, y, z]) => [x * c + z * s, y, -x * s + z * c]);
};

/** x → −x; faces rewound so the normals keep facing out. */
const mirrorX = ({ verts, faces }) => ({
  verts: verts.map(([x, y, z]) => [-x, y, z]),
  faces: faces.map(f => f.slice().reverse()),
});

/** rings of [y, k] around y, radius shaped per azimuth by `rad`,
 *  capped both ends — the same construction as gform's cage. */
function ringCage(sides, levels, rad) {
  const verts = [], rings = [];
  for (const [y, k] of levels) {
    const ring = [];
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2;
      verts.push(rad(a, k, y));
      ring.push(verts.length - 1);
    }
    rings.push(ring);
  }
  const faces = [];
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < sides; i++)
      faces.push([rings[j][i], rings[j][(i + 1) % sides],
                  rings[j + 1][(i + 1) % sides], rings[j + 1][i]]);
  faces.push(rings[rings.length - 1].slice());
  faces.push(rings[0].slice().reverse());
  return { verts, faces, rings };
}

/**
 * A MITTEN, thumbless-fingered: a soft palm with one thumb swell,
 * authored as the LEFT hand — the thumb on +x, which is the INNER side
 * when the hand floats at −x. Centred on the origin, radius ≈ `s`.
 */
function makeMitt(s) {
  const cage = ringCage(8,
    [[-1, .55], [-.45, .95], [.25, .97], [.85, .55]],
    (a, k, y) => [Math.sin(a) * k * s, y * s, Math.cos(a) * k * s]);
  // the thumb is IN THE CAGE, like the rock's lumps: one vertex of the
  // upper ring pushed out and up, its neighbours carrying a little of
  // it, so subdivision softens the spike into a swell
  const up = cage.rings[2];                     // the y = .25 ring
  const push = (vi, m, lift) => {
    const v = cage.verts[vi];
    v[0] *= m; v[2] *= m; v[1] += lift * s;
  };
  push(up[2], 1.5, .28);                        // i=2 is dead on +x
  push(up[1], 1.14, .1);
  push(up[3], 1.14, .1);
  return subdivideN({ verts: cage.verts, faces: cage.faces }, 2);
}

/**
 * A SHOE: flat sole (two near-full rings at the bottom — the rock's
 * sitting-flat trick), a toe fuller and longer than the heel, and the
 * upper sloping back as it rises. Origin at the sole's centre, +z is
 * the toe; half-width ≈ `s`.
 */
function makeShoe(s) {
  const levels = [[0, .97, 0], [.22, 1, 0], [.62, .8, -.14], [1.05, .42, -.34]];
  const cage = ringCage(10, levels.map(l => [l[0], l[1]]),
    (a, k, y) => {
      const zShift = levels.find(l => l[0] === y)[2];
      const cz = Math.cos(a);
      return [Math.sin(a) * k * s,
              y * s * 1.35,
              (cz * (cz > 0 ? 1.6 : 1.05) * k + zShift) * s];
    });
  return subdivideN({ verts: cage.verts, faces: cage.faces }, 2);
}

/** the built mesh's top, for stacking the torso above the shoes. */
const meshTop = ({ verts }) => verts.reduce((m, v) => Math.max(m, v[1]), 0);

/**
 * The frame, measured. Called by the LAYOUT (before anything else is
 * placed, because the head's height depends on it), returned as plain
 * numbers for build() to stamp.
 *
 * `ry` is the HEAD's half-height: the sink and the proportions are all
 * relative to the head, because the head is the subject — a frame that
 * scaled off its own numbers could grow away from the face it carries.
 */
export function frameLayout(F, { r, ry }, stance) {
  const sink = ry * .22;                        // the head's socket overlap
  const footR = F.footR * r;
  const gap = F.float * r;                      // the Rayman air

  // one LEFT shoe, splayed a few degrees; every other foot is a turn
  // or a mirror of it
  const shoeL = makeShoe(footR);
  shoeL.verts = rotY(shoeL.verts, .14);
  const shoeR = mirrorX(shoeL);
  const footTop = meshTop(shoeL);

  // biped: an upright pill, two shoes floating under it, two mitts
  // floating beside it. Nothing touches anything — the gaps are load-
  // bearing, they are what says "character" instead of "figurine".
  const rxT = F.hips * r, ryT = F.squat * r * 1.15, rzT = F.hips * r * .92;
  const tCy = footTop + gap + ryT;
  const handR = F.handR * r;
  const mittL = makeMitt(handR), mittR = mirrorX(mittL);
  const limbs = [
    { id: 'footL', mesh: shoeL, pos: [-rxT * .8, 0, r * .07] },
    { id: 'footR', mesh: shoeR, pos: [rxT * .8, 0, r * .07] },
    ...[[-1, 'handL', mittL], [1, 'handR', mittR]].map(([sx, id, mesh]) => ({
      id, mesh,
      pos: [sx * (rxT + handR + r * .06),
            tCy - ryT + F.handY * ryT * 2, 0],
    })),
  ];
  return {
    stance,
    torso: { rx: rxT, ry: ryT, rz: rzT, exp: F.belly, pos: [0, tCy, 0] },
    limbs,
    headBase: tCy + ryT - sink,
  };
}
