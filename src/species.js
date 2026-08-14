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
    bases: { sit: 62, biped: 38 },
    cast: {
      crest:  { style: { floppy: 62, bear: 22, none: 16 }, tone: { skin: 100 } },
      // the muzzle is in the SKULL's outline; the nose is just the
      // dark button sitting on the end of it
      skull:  { muzzle: [.26, .44], shape: { round: 40, wide: 26, lump: 18, drop: 16 } },
      nose:   { style: { button: 62, triangle: 38 } },
      mouth:  { style: { cat: 44, tongue: 24, wobble: 18, buckteeth: 8, tiny: 6 } },
      // an animal face is two dots and a muzzle. No irises, no lashes.
      eyes:   { type: { dot: 62, happy: 20, closed: 10, saucer: 8 }, scale: [.85, 1.25] },
      brows:  { on: 0 },
      hair:   { style: { bald: 88, messy: 8, curly: 4 } },
      extras: { spots: .55, tears: .04, whiskers: 0, glasses: .04 },
      tail:   { style: { wag: 54, curl: 30, puff: 16 } },
      torso:  { shape: { bean: 34, barrel: 26, round: 24, pear: 16 } },
    },
  },

  cat: {
    label: 'gato',
    bases: { quad: 74, biped: 26 },
    cast: {
      crest:  { style: { cat: 92, none: 8 }, len: [1.1, 1.5], tone: { skin: 100 } },
      // the muzzle sits almost mid-face on a cat, not down on the chin
      skull:  { muzzle: [.18, .3], muzzleY: [.3, .46],
                shape: { round: 54, wide: 24, square: 12, lump: 10 } },
      nose:   { style: { triangle: 78, button: 22 } },
      // the W under the nose is the whole cat
      mouth:  { style: { cat: 80, tiny: 10, tongue: 6, fangs: 4 } },
      // dots, crosses or shut lines — and set WIDE APART, out near the
      // sides of the face where a cat's are
      eyes:   { type: { dot: 66, closed: 18, xcross: 16 }, scale: [1.3, 1.75], sx: [.58, .72] },
      brows:  { on: 0 },
      hair:   { style: { bald: 92, messy: 8 } },
      extras: { whiskers: .92, spots: .3, tears: .05, glasses: .04 },
      tail:   { style: { curl: 58, wag: 32, puff: 10 } },
      torso:  { shape: { bean: 40, tiny: 24, round: 22, drop: 14 } },
    },
  },

  rabbit: {
    label: 'conejo',
    bases: { sit: 58, biped: 42 },
    cast: {
      crest:  { style: { bunny: 90, none: 10 }, len: [1.1, 1.6], tone: { skin: 100 } },
      nose:   { style: { triangle: 62, button: 38 } },
      mouth:  { style: { buckteeth: 52, cat: 24, tiny: 14, wobble: 10 } },
      eyes:   { type: { dot: 58, happy: 18, saucer: 14, closed: 10 }, scale: [.9, 1.3] },
      brows:  { on: 0 },
      hair:   { style: { bald: 92, messy: 8 } },
      skull:  { muzzle: [.1, .2], shape: { round: 40, tall: 26, drop: 20, pear: 14 } },
      extras: { whiskers: .7, spots: .3, tears: .12, glasses: .05 },
      tail:   { style: { puff: 82, none: 18 } },
      torso:  { shape: { pear: 34, bean: 30, round: 24, tiny: 12 } },
    },
  },

  bird: {
    label: 'pájaro',
    bases: { sit: 45, biped: 55 },
    cast: {
      crest:  { style: { sprout: 34, frills: 26, spikes: 20, none: 20 }, tone: { skin: 70, bone: 30 } },
      nose:   { style: { none: 100 } },                    // the beak IS the face
      mouth:  { style: { beak: 88, tiny: 12 }, beakLen: [.9, 1.5] },
      eyes:   { type: { dot: 66, happy: 14, closed: 12, saucer: 8 }, scale: [.8, 1.15] },
      brows:  { on: 0 },
      hair:   { style: { bald: 72, spiky: 18, messy: 10 } },
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
    bases: { sit: 22, biped: 78 },
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
    bases: { sit: 15, biped: 85 },
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

export const BASES = ['biped', 'sit', 'quad'];

// A BASE is the skeleton, not the casting: 'biped' is the big-headed
// two-legged doodle, 'sit' is the animal sitting on its haunches with
// its front paws on the floor. The species says which it prefers.
const DEFAULT_BASES = { biped: 100 };
export function pickBase(speciesId, rng) {
  const b = SPECIES[speciesId]?.bases ?? DEFAULT_BASES;
  return wpick(rng, Object.entries(b));
}

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
