// ---------------------------------------------------------------
// THE CASTING — the third copy of the project's oldest idea, and on
// purpose the third copy of the code: the gloss generator shares an
// idea with the drawn and voxel ones, not a runtime.
//
// A species is a table of loaded dice per part id:
//
//   { style: { bear: 90, none: 10 } }   an object → weighted pick, and
//                                       what you leave out CANNOT happen
//   { size: [.9, 1.2] }                 an array  → a number in range
//   { teeth: .85 }                      a number  → a probability
//
// Anything a profile does not mention keeps the part's own default, so
// a profile states only what makes that species different. A species
// may also bias the BODY form (sphere vs cube) — but never the palette
// or the material: what a toy is made of is a separate lever, and a
// lavender bear is still a bear. The EARS do the species work, and
// after the eye patch and the muzzle were both cut they do nearly all
// of it — which is worth knowing before adding a species: if it cannot
// be told apart by its silhouette, it has nothing to be told apart by.
//
// `wildcard` is the free roll — the shelf the lab had before species
// existed. It stays the biggest slice on purpose: the casting is there
// to make the compound toys (bunny, pig, robot) arrive assembled, not
// to turn the generator into eight fixed characters.
// ---------------------------------------------------------------

export const GSPECIES = {
  wildcard: { label: 'wildcard', cast: {} },

  bear: {
    label: 'bear',
    cast: {
      crest:  { style: { bear: 90, none: 10 }, size: [.72, .95], spread: [.5, .72] },
      eyes:   { style: { bead: 38, pupil: 24, oval: 20, sleepy: 18 },
                size: [.125, .165] },
      nose:   { style: { none: 84, button: 10, dot: 6 } },
      mouth:  { style: { smile: 30, open: 24, flat: 20, cat: 16, frown: 10 }, teeth: .3 },
      brows:  { style: { none: 90, flat: 10 } },
    },
  },

  bunny: {
    label: 'bunny',
    cast: {
      body:   { tall: [.94, 1] },
      crest:  { style: { bunny: 95, none: 5 }, size: [.82, 1] },
      eyes:   { style: { pupil: 32, bead: 20, googly: 16, slab: 16, happy: 16 } },
      // the big front teeth: grins often, and the line mouths carry
      // the single fang (teeth + tongue on a line is the fang roll)
      mouth:  { style: { grin: 26, smile: 24, cat: 20, open: 14, zig: 16 },
                teeth: .75, tongue: .4 },
      nose:   { style: { none: 88, dot: 8, heart: 4 } },
    },
  },

  cat: {
    label: 'cat',
    cast: {
      crest:  { style: { cat: 95, none: 5 } },
      // set WIDE, and winking more than anybody else
      eyes:   { style: { bead: 28, pupil: 22, sleepy: 18, happy: 16, cross: 16 },
                wink: .15, x: [.54, .72] },
      mouth:  { style: { cat: 44, smile: 20, zig: 16, flat: 20 }, teeth: .5, tongue: .5 },
      nose:   { style: { none: 86, cat: 9, dot: 5 } },
      brows:  { style: { none: 94, sad: 6 } },
    },
  },

  pig: {
    label: 'pig',
    cast: {
      // the pig's snout is the NOSE part's now: a wide plate, warm,
      // and bigger than any other nose gets
      nose:   { style: { snout: 78, button: 14, dot: 8 }, size: [1.5, 2], warm: .85 },
      crest:  { style: { stubs: 42, cat: 28, none: 30 }, size: [.7, .9] },
      eyes:   { style: { bead: 44, pupil: 24, sleepy: 16, googly: 16 }, size: [.115, .155] },
      mouth:  { style: { smile: 36, flat: 26, open: 20, none: 18 } },
      blush:  { style: { oval: 45, round: 20, none: 35 } },
    },
  },

  monster: {
    label: 'monster',
    body: { cube: 55, sphere: 45 },
    cast: {
      crest:  { style: { horns: 68, stubs: 16, none: 16 } },
      eyes:   { style: { cross: 18, angry: 18, slab: 16, googly: 14, ring: 12,
                         spiral: 10, wobble: 12 }, wink: .1 },
      mouth:  { style: { grin: 30, open: 28, holler: 22, zig: 20 },
                teeth: .85, tongue: .5, size: [.58, .85] },
      brows:  { style: { none: 50, angry: 34, thick: 16 } },
      blush:  { style: { none: 80, stripes: 20 } },
    },
  },

  humanoid: {
    label: 'humanoid',
    // ALWAYS the head form: a humanoid is its skull, and a spherical
    // one was just a toy with hair on.
    body: { head: 100 },
    // the one species that names its own palette and material — see
    // the note in `ensureGParams`. A humanoid is made of SKIN.
    palette: 'skin',
    material: 'skin',
    cast: {
      // THE PRESETS ARE THE SHAPE, used exactly as the chibi-skull
      // study left them — the multipliers are pinned to 1, because
      // every one of them stretches a sculpted head back toward an
      // egg, which is what put carrots on the shelf. Variety here
      // comes from PICKING a different skull, never from squashing
      // one. Weighted round-first for the same reason.
      body:   { wide: [1, 1], tall: [1, 1], deep: [1, 1],
                skull: { bun: 32, trapezoid: 26, square: 24, oval: 18 } },
      // NO CREST. Ears and horns are the other species' silhouette
      // work; a humanoid's is its HAIR, which is a part of its own now
      // (`hair.js`) and owns the whole crown. The three ink plates that
      // stood in for hair here — tuft, mop, curl — were a placeholder
      // and are not dealt to anybody any more.
      crest:  { style: { none: 100 } },
      // THE HAIRCUT, and it is most of the character. Weighted the way
      // a room of people is: short and medium carry it, the very long
      // cuts and the tied-up ones are the ones you notice. `bald` stays
      // in at a few percent because a bald chibi is a real character
      // and the skull is good enough to show off.
      hair:   { style: { bob: 13, pixie: 12, bowl: 11, long: 10, side: 9,
                         crop: 8, wavy: 8, curly: 8, twin: 6, pony: 6,
                         hime: 4, spiky: 3, buns: 3, bald: 4 } },
      // THE WHOLE CATALOGUE ROLLS. The orb is the humanoid's signature
      // and keeps the biggest slice, but every other eye in the table
      // is reachable — a face this simple gets its variety from the
      // features, and casting three styles gave three characters.
      // Only the placement is opinionated: chibi eyes sit LOW, at or
      // under the centreline, down in the wide cheeks with all that
      // cranium empty above — the opposite of the toys' upper-half
      // rule, and it is what the reference sheets all do.
      // Listed in full because a cast style table is EXCLUSIVE — what
      // you leave out cannot happen — so "all of them, orb first" has
      // to be written out rather than implied.
      //
      // THE PROPORTIONS ARE THE SPECIES, measured off the chibi
      // reference sheet and checked against the build (`__probe` in
      // the lab): the eye's CENTRE lands ~63% down the head and its
      // top ~50%, which is what "frente despejada, ojos a mitad de
      // cara" actually means — the forehead is the whole top half and
      // the eyes hang off the midline. Each eye is ~26% of the head's
      // width. Guessing these put the face too high and too small
      // twice; the numbers came off the sheet in the end.
      eyes:   { style: { orb: 26, pupil: 14, bead: 8, googly: 8, slab: 6, oval: 5,
                         sleepy: 5, happy: 5, box: 3, round: 3, square: 3,
                         sparkle: 2, diamond: 2, cross: 2, crescent: 1, star: 1,
                         heart: 1, ring: 1, flower: 1, angry: 1, wobble: 1, spiral: 1 },
                size: [.2, .25], x: [.6, .72], y: [-.42, -.28], lid: .3 },
      // a face with a real nose more often than the toys get one
      nose:   { style: { none: 62, button: 14, dot: 12, cat: 4, heart: 4, beak: 2, snout: 2 },
                warm: .6 },
      // SMALL, and a line rather than a maw. Two jobs: the reference
      // mouth is a stroke a fraction of an eye wide, and a small
      // mouth also REACHES less — the layout pushes a mouth clear of
      // the eyes, so a maw under eyes this big lands on the chin.
      mouth:  { style: { smile: 26, cat: 16, flat: 14, zig: 10, frown: 8, none: 12,
                         open: 8, grin: 6 },
                y: [-.52, -.36], size: [.32, .5] },
      // the most browed species on the shelf, and the only one where
      // brows are the RULE rather than an anecdote: the reference
      // faces nearly all have a pair, high on that clear forehead,
      // and on a face this plain they carry the whole expression
      brows:  { style: { none: 30, flat: 20, round: 16, sad: 12, angry: 12, worry: 10 },
                lift: [.3, .5] },
      blush:  { style: { round: 28, oval: 22, none: 50 } },
    },
  },

  robot: {
    label: 'robot',
    body: { cube: 90, sphere: 10 },
    cast: {
      body:   { corner: [3.4, 5.5] },
      crest:  { style: { stubs: 52, none: 36, horns: 12 }, size: [.58, .8] },
      eyes:   { style: { box: 38, square: 26, slab: 20, ring: 16 }, lid: .15 },
      // mostly bare: a robot's face is the grid grin and the screen
      mouth:  { style: { grin: 44, flat: 28, zig: 28 } },
      nose:   { style: { none: 90, dot: 10 } },
      brows:  { style: { none: 86, flat: 14 } },
      blush:  { style: { none: 85, round: 15 } },
    },
  },
};

export const GSPECIES_IDS = Object.keys(GSPECIES);

// how the shelf deals them. Wildcard stays the biggest slice — see the
// header — and the compound species split the rest about evenly.
// `panda` used to sit here. Its whole identity was the ink eye patch,
// so when that went it cast a bear with different weights — a species
// you cannot tell from another is not a species. Its share went back
// to the bear it had become.
// The pig is dealt THIN because it always has a snout, and a snout is
// a nose: at 9% of the shelf it was over half of every nose on it, so
// the pig's share is the real lever on how nosey the whole sheet is.
export const GSPECIES_WEIGHTS = [
  ['wildcard', 30], ['bear', 17], ['bunny', 12], ['cat', 12],
  ['monster', 11], ['humanoid', 9], ['robot', 8], ['pig', 5],
];

const wpick = (rng, pairs) => {
  let t = 0; for (const p of pairs) t += p[1];
  let x = rng.r(0, t);
  for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
  return pairs[pairs.length - 1][0];
};

/** the species' opinion on sphere vs cube, if it has one. */
export function pickGBody(speciesId, rng, defaultIds) {
  const w = GSPECIES[speciesId]?.body;
  return w ? wpick(rng, Object.entries(w)) : defaultIds[(rng.r(0, 1) * defaultIds.length) | 0];
}

/**
 * The casting helper handed to every part's gen(). Three questions,
 * and in each the species wins if it has an opinion and the part's own
 * default applies if it does not.
 */
export function gcastingFor(speciesId) {
  const SP = GSPECIES[speciesId] ?? GSPECIES.wildcard;
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
      /** a number: C.range(rng, 'size', .9, 1.4) */
      range(rng, k, lo, hi) {
        const r = t[k];
        return Array.isArray(r) ? rng.r(r[0], r[1]) : rng.r(lo, hi);
      },
      /** a yes/no: C.chance(rng, 'teeth', .6) */
      chance(rng, k, p) {
        const c = t[k];
        return rng.chance(typeof c === 'number' ? c : p);
      },
    };
  };
}
