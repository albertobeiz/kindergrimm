// --------------------------------------------------------------
// THE CASTING — the fourth copy of the project's oldest idea, and
// on purpose the fourth copy of the code: the plants lab shares an
// idea with the drawn, voxel and gloss ones, not a runtime.
//
// Here the species are the GARDENER'S FOUR: grass, plant, tree,
// flower. A species is a table of loaded dice per part id, exactly
// like the other labs:
//
//   { style: { tuft: 80, none: 20 } }  an object → weighted pick
//   { size: [.9, 1.4] }                an array  → a number in range
//   { lean: .6 }                       a number  → a probability
//
// A species states ONLY what makes it different — everything else
// keeps the part's own default. And the four are deliberately
// SHAPES of thing, not four skins on one body: a grass tuft and a
// tree crown share almost no geometry, so the parts branch hard on
// the style the species loads.
// ----------------------------------------------------------------

const wpick = (rng, pairs) => {
  let total = 0; for (const p of pairs) total += p[1];
  let x = rng.r(0, total);
  for (const p of pairs) if ((x -= p[1]) < 0) return p[0];
  return pairs[pairs.length - 1][0];
};

export const OSPECIES = {
  grass: {
    label: 'grass',
    cast: {
      // NOTE the mound's keys are the mound's PARAMS (`bump` is a
      // chance, there is no `style`) — a `style` table sat here once
      // and was dead weight nothing read
      mound: { bump: .25, r: [.8, 1.2], tall: [.3, .5] },
      stem:  { style: { none: 100 } },
      leaves: { style: { tuft: 100 }, count: [10, 20], size: [.7, 1.2] },
      bloom: { style: { none: 92, grasshead: 8 } },
    },
  },
  plant: {
    label: 'plant',
    cast: {
      mound: { bump: 1, r: [.7, 1], tall: [.35, .6] },
      stem:  { style: { stalk: 100 }, h: [.7, 1.2], r: [.2, .32] },
      leaves: { style: { rosette: 100 }, count: [5, 8], size: [.8, 1.15] },
      bloom: { style: { none: 85, ball: 15 } },
    },
  },
  tree: {
    label: 'tree',
    cast: {
      mound: { bump: 1, r: [.8, 1.1], tall: [.35, .6] },
      stem:  { style: { trunk: 100 }, h: [1.6, 2.6], r: [.5, .75] },
      leaves: { style: { crown: 100 }, size: [.9, 1.2], count: [3, 5] },
      bloom: { style: { none: 88, blossom: 12 } },
    },
  },
  flower: {
    label: 'flower',
    cast: {
      mound: { bump: 1, r: [.5, .8], tall: [.3, .5] },
      stem:  { style: { stalk: 100 }, h: [.9, 1.6], r: [.14, .22] },
      leaves: { style: { sprig: 100 }, count: [1, 3], size: [.5, .8] },
      bloom: { style: { daisy: 100 }, size: [.9, 1.3], petals: [7, 10] },
    },
  },
  // the free roll: no opinions, every part keeps its own dice. It is
  // where the odd bush (a crown on no trunk) and the flowering tuft
  // come from — the shelf's surprises, same job as the gloss wildcard.
  wildcard: {
    label: 'wildcard',
    cast: {},
  },
};

export const OSPECIES_IDS = Object.keys(OSPECIES);

/** a species' opinion on a rolled value. Same three questions as the
 *  gloss casting: pick / range / chance, species wins, part default
 *  otherwise. */
export function ocastingFor(speciesId) {
  const SP = OSPECIES[speciesId] ?? OSPECIES.grass;
  return partId => {
    const t = SP.cast?.[partId] ?? {};
    return {
      species: speciesId,
      pick(rng, k, pairs) {
        const w = t[k];
        const list = (w && typeof w === 'object' && !Array.isArray(w))
          ? Object.entries(w) : pairs;
        return wpick(rng, list);
      },
      range(rng, k, lo, hi) {
        const r = t[k];
        return Array.isArray(r) ? rng.r(r[0], r[1]) : rng.r(lo, hi);
      },
      chance(rng, k, p) {
        const c = t[k];
        return rng.chance(typeof c === 'number' ? c : p);
      },
    };
  };
}