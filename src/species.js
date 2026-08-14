// ---------------------------------------------------------------
// SPECIES — a casting profile, not code.
//
// A dog is not a new set of drawings. It is the same catalogue of
// parts with the dice loaded toward floppy ears, a snout, spots and
// no hair. Everything a species changes is a CHOICE, and every choice
// already goes through a part's gen().
//
// A profile is one table per part. The VALUE says what it does:
//
//   { style: { floppy: 55, bear: 25 } }   an object → weighted pick
//   { snoutLen: [1.1, 1.6] }              an array  → a number in a range
//   { spots: .55 }                        a number  → a probability
//
// Anything a profile does not mention keeps the part's own default,
// so a profile only ever states what makes that species different.
//
// TO ADD A SPECIES: copy the nearest entry below, change the tables,
// done. No drawing code. If it needs a shape nobody has drawn yet
// (a beak, a tail), add that as a normal variant of an existing part
// first — see ARCHITECTURE.md §9 — and then every species can use it.
// ---------------------------------------------------------------

export const SPECIES = {
  human: {
    label: 'humano',
    // the default catalogue already IS the human doodle, so this
    // profile only holds it back from the beastly options
    cast: {
      crest:  { style: { none: 74, sprout: 8, halo: 6, bolt: 6, flower: 6 } },
      nose:   { style: { none: 34, button: 26, line: 24, triangle: 16 } },
      mouth:  { style: { wobble: 20, tiny: 18, zigzag: 12, smirk: 14, frown: 12, grit: 10, buckteeth: 8, stitch: 6 } },
      eyes:   { type: { saucer: 30, dot: 16, wide: 12, sparkle: 10, sleepy: 10, happy: 8, angry: 6, closed: 4, spiral: 4 } },
      hair:   { style: { bob: 14, messy: 12, spiky: 10, bowl: 10, curly: 10, buzz: 8, afro: 8, pigtails: 8, long: 6, buns: 5, topknot: 4, mohawk: 3, cowlick: 2 } },
      extras: { spots: .05, tears: .18, freckles: .3, whiskers: 0, glasses: .2 },
      tail:   { style: { none: 100 } },
    },
  },

  dog: {
    label: 'perro',
    cast: {
      crest:  { style: { floppy: 62, bear: 22, none: 16 } },
      // the muzzle is in the SKULL's outline; the nose is just the
      // dark button sitting on the end of it
      skull:  { muzzle: [.26, .44], shape: { round: 40, wide: 26, lump: 18, drop: 16 } },
      nose:   { style: { button: 62, triangle: 38 } },
      mouth:  { style: { tongue: 30, wobble: 22, zigzag: 18, cat: 14, buckteeth: 10, tiny: 6 } },
      eyes:   { type: { dot: 30, saucer: 28, sleepy: 16, happy: 12, wide: 8, closed: 6 } },
      hair:   { style: { bald: 76, messy: 14, curly: 10 } },
      extras: { spots: .55, tears: .04, whiskers: 0, glasses: .04 },
      tail:   { style: { wag: 54, curl: 30, puff: 16 } },
      torso:  { shape: { bean: 34, barrel: 26, round: 24, pear: 16 } },
    },
  },

  cat: {
    label: 'gato',
    cast: {
      crest:  { style: { cat: 84, none: 16 }, len: [.9, 1.35] },
      // a flatter muzzle than a dog's: cats are all cheeks
      skull:  { muzzle: [.14, .26], shape: { round: 44, wide: 24, square: 18, lump: 14 } },
      nose:   { style: { triangle: 78, button: 22 } },
      mouth:  { style: { cat: 52, tiny: 18, wobble: 12, fangs: 12, tongue: 6 } },
      eyes:   { type: { saucer: 30, angry: 20, dot: 18, sleepy: 14, happy: 10, spiral: 8 } },
      hair:   { style: { bald: 84, messy: 16 } },
      extras: { whiskers: .92, spots: .3, tears: .05, glasses: .04 },
      tail:   { style: { curl: 58, wag: 32, puff: 10 } },
      torso:  { shape: { bean: 40, tiny: 24, round: 22, drop: 14 } },
    },
  },

  rabbit: {
    label: 'conejo',
    cast: {
      crest:  { style: { bunny: 90, none: 10 }, len: [1.1, 1.6] },
      nose:   { style: { triangle: 62, button: 38 } },
      mouth:  { style: { buckteeth: 58, tiny: 18, wobble: 14, cat: 10 } },
      eyes:   { type: { saucer: 32, dot: 24, wide: 18, sparkle: 12, happy: 8, closed: 6 } },
      hair:   { style: { bald: 88, messy: 12 } },
      skull:  { muzzle: [.1, .2], shape: { round: 40, tall: 26, drop: 20, pear: 14 } },
      extras: { whiskers: .7, spots: .3, tears: .12, glasses: .05 },
      tail:   { style: { puff: 82, none: 18 } },
      torso:  { shape: { pear: 34, bean: 30, round: 24, tiny: 12 } },
    },
  },

  bird: {
    label: 'pájaro',
    cast: {
      crest:  { style: { sprout: 34, frills: 26, spikes: 20, none: 20 } },
      nose:   { style: { none: 100 } },                    // the beak IS the face
      mouth:  { style: { beak: 88, tiny: 12 }, beakLen: [.9, 1.5] },
      eyes:   { type: { dot: 40, saucer: 26, wide: 16, spiral: 10, closed: 8 } },
      hair:   { style: { bald: 66, spiky: 20, messy: 14 } },
      // a small beak-forward head, and the wings are their own part
      skull:  { muzzle: [.08, .18], shape: { round: 46, drop: 26, tall: 16, lump: 12 } },
      arms:   { style: { behind: 100 } },   // hidden under the wings
      legs:   { style: { noodle: 62, stub: 38 }, foot: { claw: 84, oval: 16 }, len: [.7, 1.3] },
      extras: { spots: .35, tears: .06, whiskers: 0, glasses: .05 },
      tail:   { style: { puff: 44, wag: 30, none: 26 } },
      torso:  { shape: { drop: 34, round: 28, bean: 22, tiny: 16 } },
    },
  },

  monster: {
    label: 'monstruo',
    cast: {
      crest:  { style: { horns: 34, spikes: 20, stalks: 16, frills: 14, antlers: 10, crown: 6 } },
      nose:   { style: { none: 48, skull: 26, snout: 16, triangle: 10 } },
      mouth:  { style: { maw: 30, zigzag: 22, fangs: 20, void: 12, drool: 10, stitch: 6 } },
      eyes:   { type: { hollow: 24, void: 20, sunken: 16, spiral: 12, xcross: 12, angry: 10, wide: 6 } },
      hair:   { style: { bald: 58, messy: 18, spiky: 16, curly: 8 } },
      // the outline IS the monster: lumpy, lopsided, occasionally
      // carrying a muzzle it should not have
      skull:  { shape: { bumpy: 24, wonky: 20, lump: 18, pear: 14, wide: 12, drop: 12 },
                muzzle: [0, .3], fur: .4 },
      arms:   { style: { stub: 34, noodle: 26, wing: 18, hips: 12, clasped: 10 }, hand: { claw: 56, mitten: 30, dot: 14 } },
      extras: { spots: .5, tears: .12, whiskers: 0, glasses: .04 },
      tail:   { style: { spike: 40, wag: 26, curl: 20, none: 14 } },
      torso:  { shape: { bean: 28, barrel: 26, pear: 24, drop: 22 } },
    },
  },

  nightmare: {
    label: 'pesadilla',
    cast: {
      // a shape cut out of the dark: the head is filled in, and the
      // only light left is whatever is looking at you
      skull:  { shroud: .82, shape: { tall: 26, drop: 22, lump: 20, wonky: 18, bumpy: 14 },
                muzzle: [0, .22] },
      crest:  { style: { horns: 30, spikes: 24, antlers: 20, stalks: 14, none: 12 }, tone: { dark: 70, bone: 30 } },
      nose:   { style: { none: 70, skull: 30 } },
      mouth:  { style: { maw: 26, void: 24, stitch: 20, fangs: 16, zigzag: 14 } },
      eyes:   { type: { void: 34, saucer: 22, hollow: 16, spiral: 14, xcross: 14 } },
      hair:   { style: { bald: 62, messy: 22, long: 16 } },
      arms:   { style: { noodle: 42, stub: 24, behind: 18, clasped: 16 }, hand: { claw: 62, dot: 24, mitten: 14 }, len: [.8, 1.3] },
      legs:   { style: { noodle: 56, stub: 44 } },
      extras: { tears: .55, spots: .2, whiskers: 0, glasses: 0 },
      tail:   { style: { spike: 46, none: 30, curl: 24 } },
      torso:  { shape: { tiny: 30, drop: 26, bean: 24, pear: 20 }, tone: { black: 70, hatch: 20, scribble: 10 } },
    },
  },
};

export const SPECIES_IDS = Object.keys(SPECIES);

const wpick = (rng, pairs) => {
  let t = 0; for (const p of pairs) t += p[1];
  let x = rng.r(0, t);
  for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
  return pairs[pairs.length - 1][0];
};

// ---------------------------------------------------------------
// The casting helper handed to every part's gen(). It answers three
// questions, and in each case the species profile wins if it has an
// opinion and the part's own default applies if it does not.
// ---------------------------------------------------------------
export function castingFor(speciesId) {
  const SP = SPECIES[speciesId] ?? SPECIES.human;
  return partId => {
    const t = SP.cast?.[partId] ?? {};
    return {
      species: speciesId,
      /** one of a weighted list: C.pick(rng, 'style', DEFAULT_PAIRS) */
      pick(rng, key, defaultPairs) {
        const w = t[key];
        const pairs = (w && typeof w === 'object' && !Array.isArray(w))
          ? Object.entries(w).filter(([, n]) => n > 0)
          : defaultPairs;
        return wpick(rng, pairs);
      },
      /** a number: C.range(rng, 'snoutLen', .8, 1.2) */
      range(rng, key, lo, hi) {
        const r = t[key];
        return Array.isArray(r) ? rng.r(r[0], r[1]) : rng.r(lo, hi);
      },
      /** a yes/no: C.chance(rng, 'spots', .4) */
      chance(rng, key, p) {
        const c = t[key];
        return rng.chance(typeof c === 'number' ? c : p);
      },
    };
  };
}
