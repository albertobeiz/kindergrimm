// ---------------------------------------------------------------
// THE CASTING — same idea as `src/species.js`, one dimension up.
//
// A dog is not a new set of models. It is the same catalogue of voxel
// parts with the dice loaded: floppy ears, a muzzle in the skull's own
// profile, four legs instead of two, and a tail that wags.
//
// A profile is one table per part id, and the VALUE says what it does:
//
//   { style: { floppy: 84, bear: 10 } }   an object → weighted pick,
//                                         and what you leave out
//                                         CANNOT happen
//   { len: [1.1, 1.6] }                   an array  → a number in range
//   { spots: .55 }                        a number  → a probability
//
// Anything a profile does not mention keeps the part's own default, so
// a profile states only what makes that species different.
//
// This tree keeps its own copy of the casting helper on purpose: the
// voxel generator and the drawn one share an idea, not a runtime, and
// a change to one must not be able to break the other.
// ---------------------------------------------------------------

export const VSPECIES = {
  human: {
    label: 'human',
    bases: { biped: 100 },
    cast: {
      // the chibi read: the head IS the character, the body is a
      // handle. Half the total height is skull.
      skull: { shape: { box: 42, tomb: 12, slab: 10, wide: 8, tall: 8, tower: 7, bell: 6, coffin: 4, round: 3 },
               muzzle: [0, 0], w: [10, 12], h: [16, 20], d: [7, 9],
               jaw: [.96, 1.04] },
      torso: { w: [2, 2], h: [3, 5], d: [2, 2] },
      legs:  { len: [2, 3] },
      arms:  { len: [.4, .75], thick: [.75, 1.15] },
      crest: { style: { none: 70, bunny: 8, horns: 6, sprout: 6, spikes: 5, cat: 5 } },
      nose:  { style: { none: 56, dot: 26, button: 12, beak: 4, skull: 2 } },
      mouth: { style: { line: 24, tiny: 18, oh: 12, wobble: 12, grin: 12, crook: 8, frown: 7, zigzag: 4, teeth: 2, void: 1 }, w: [0, 1] },
      // BIG eyes, so when a glance rolls in you can watch the pupil
      // travel inside the eyeball
      eyes:  { type: { saucer: 24, sparkle: 14, void: 12, xcross: 8, line: 7, wink: 6, ring: 5, heart: 5,
                       button: 5, spiral: 4, odd: 4, crescent: 3, sleepy: 3 },
               w: [6, 8], h: [7, 9], y: [.5, .62], sep: [.74, .92], proud: .04 },
      hair:  { style: { mop: 11, bob: 10, cap: 8, spike: 8, tuft: 8, bedhead: 8, comb: 7, curtain: 7,
                        pigtails: 7, long: 6, widow: 6, emo: 5, mohawk: 4, buns: 4, monk: 2, bald: 6 } },
      extras: { spots: .05, freckles: .34, whiskers: 0, blush: .3, patch: .06 },
      hat:   { style: { none: 74, cap: 9, pointy: 6, bucket: 5, crown: 3, bow: 3 } },
      tail:  { style: { none: 100 } },
    },
  },

  dog: {
    label: 'dog',
    bases: { quad: 100 },
    cast: {
      // ears first: on a dog they are the biggest thing on the head
      crest: { style: { floppy: 80, bear: 12, none: 8 }, len: [1.5, 2.2], tone: { hair: 100 } },
      // the muzzle is in the SKULL's own profile, so the nose and the
      // mouth land on it without ever learning it exists
      // a smaller skull than a biped's: on all fours the head is not
      // the whole animal, and at biped scale a dog reads as a head
      // that grew legs
      skull: { shape: { round: 42, wide: 24, box: 18, drop: 16 },
               muzzle: [2.4, 4.4], muzzleY: [.30, .42], w: [4, 5], d: [3, 5], h: [8, 10] },
      nose:  { style: { button: 76, dot: 24 }, size: [1.3, 2] },
      mouth: { style: { cat: 40, wobble: 22, grin: 20, teeth: 12, tiny: 6 } },
      // an animal face is two dots and a muzzle. No irises.
      eyes:  { type: { bead: 56, void: 22, happy: 12, sleepy: 10 }, sep: [.52, .66] },
      brows: { on: 0 },
      hair:  { style: { bald: 84, tuft: 10, mop: 6 } },
      extras: { spots: .55, freckles: .05, whiskers: .1, blush: .05, belly: .5 },
      hat:   { style: { none: 92, cap: 4, bow: 4 } },
      tail:  { style: { wag: 56, curl: 28, puff: 16 } },
      torso: { shape: { barrel: 38, bean: 30, round: 20, tiny: 12 }, cloth: .1 },
      legs4: { len: [3, 5] },
    },
  },

  cat: {
    label: 'cat',
    bases: { quad: 100 },
    cast: {
      crest: { style: { cat: 92, none: 8 }, len: [.9, 1.4], tone: { hair: 100 } },
      // a cat's muzzle sits almost mid-face, not down on the chin
      skull: { shape: { round: 54, wide: 22, box: 14, dome: 10 },
               muzzle: [1.2, 2.4], muzzleY: [.36, .48], w: [3, 5], d: [3, 4], h: [7, 9] },
      nose:  { style: { dot: 62, button: 38 }, size: [.8, 1.2] },
      mouth: { style: { cat: 78, tiny: 12, teeth: 10 } },
      // set WIDE, out near the sides of the face where a cat's are
      eyes:  { type: { bead: 52, void: 24, xcross: 12, sleepy: 12 }, sep: [.60, .76] },
      brows: { on: 0 },
      hair:  { style: { bald: 90, tuft: 10 } },
      extras: { whiskers: .92, spots: .34, freckles: .04, blush: .05, belly: .55 },
      hat:   { style: { none: 94, bow: 6 } },
      tail:  { style: { long: 46, curl: 34, puff: 20 }, len: [1.2, 1.9] },
      torso: { shape: { bean: 42, tiny: 26, round: 20, barrel: 12 }, cloth: .08 },
      legs4: { len: [2, 4] },
    },
  },

  nightmare: {
    label: 'nightmare',
    bases: { biped: 100 },
    cast: {
      // a shape cut out of the dark: everything about it is silhouette
      skull: { shape: { coffin: 18, tomb: 16, box: 16, tall: 14, tower: 12, wonky: 10, bell: 8, drop: 6 },
               muzzle: [0, 1.6], w: [9, 12], h: [16, 20], d: [7, 9], jaw: [.8, 1] },
      torso: { shape: { tiny: 32, pear: 26, bean: 24, barrel: 18 }, cloth: .25,
               w: [2, 2], h: [4, 6], d: [2, 2] },
      crest: { style: { horns: 32, antlers: 22, spikes: 20, stalks: 14, none: 12 },
               len: [1.2, 2.1], tone: { bone: 54, dark: 46 } },
      nose:  { style: { none: 66, skull: 34 } },
      mouth: { style: { void: 20, teeth: 20, stitch: 18, zigzag: 16, crook: 14, oh: 12 }, w: [0, 2] },
      eyes:  { type: { glow: 16, void: 16, hollow: 12, crescent: 10, ring: 10, button: 9, xcross: 9,
                       spiral: 7, angry: 6, odd: 5 }, proud: .3,
               w: [5, 8], h: [6, 9], sep: [.68, .9] },
      hair:  { style: { bald: 40, long: 16, emo: 10, widow: 10, curtain: 8, mop: 8, bedhead: 8 } },
      arms:  { style: { noodle: 48, stub: 22, up: 18, down: 12 }, len: [.7, 1.1], hand: { claw: 66, dot: 22, mitten: 12 } },
      legs:  { style: { noodle: 56, stump: 28, thick: 16 }, len: [2, 5] },
      extras: { spots: .22, freckles: .04, whiskers: 0, blush: .02, patch: .3 },
      hat:   { style: { none: 88, crown: 7, pointy: 5 } },
      tail:  { style: { spike: 44, none: 32, long: 24 } },
    },
  },
};

export const VSPECIES_IDS = Object.keys(VSPECIES);
export const VBASES = ['biped', 'quad'];

const wpick = (rng, pairs) => {
  let t = 0; for (const p of pairs) t += p[1];
  let x = rng.r(0, t);
  for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
  return pairs[pairs.length - 1][0];
};

// A BASE is the skeleton, not the casting: `biped` stands up on two
// legs with the head on top, `quad` puts the body flat and the head
// out front. The species says which it is built on.
const DEFAULT_BASES = { biped: 100 };
export function pickVBase(speciesId, rng) {
  return wpick(rng, Object.entries(VSPECIES[speciesId]?.bases ?? DEFAULT_BASES));
}

/**
 * The casting helper handed to every part's gen(). Three questions,
 * and in each the species wins if it has an opinion and the part's own
 * default applies if it does not.
 */
export function vcastingFor(speciesId) {
  const SP = VSPECIES[speciesId] ?? VSPECIES.human;
  return partId => {
    const t = SP.cast?.[partId] ?? {};
    return {
      species: speciesId,
      /** one of a weighted list: C.pick(rng, 'style', DEFAULT_PAIRS) */
      pick(rng, k, pairs) {
        const w = t[k];
        const list = (w && typeof w === 'object' && !Array.isArray(w))
          ? Object.entries(w).filter(([, n]) => n > 0) : pairs;
        return wpick(rng, list);
      },
      /** a number: C.range(rng, 'len', .8, 1.2) */
      range(rng, k, lo, hi) {
        const r = t[k];
        return Array.isArray(r) ? rng.r(r[0], r[1]) : rng.r(lo, hi);
      },
      /** a whole number of voxels: C.int(rng, 'w', 4, 7) */
      int(rng, k, lo, hi) {
        const r = t[k];
        return Math.round(Array.isArray(r) ? rng.r(r[0], r[1]) : rng.r(lo, hi));
      },
      /** a yes/no: C.chance(rng, 'spots', .4) */
      chance(rng, k, p) {
        const c = t[k];
        return rng.chance(typeof c === 'number' ? c : p);
      },
    };
  };
}
