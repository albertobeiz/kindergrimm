// --------------------------------------------------------------
// THE PALETTES — one coherent leaf-bed per palette. A plant is not
// a character with a "body colour": it is a SOIL, a LEAF, a TRUNK and a
// BLOOM, and the four have to agree they came from the same
// garden. So a palette names its roles instead of indexing them,
// and the layout hands the parts the resolved set — the parts
// never look colours up.
//
// These are sampled from the nursery, not from the gloss lab: the
// greens are the whole deal, and the bloom is deliberately close
// to cream so the green reads as THE colour and a flower is a
// surprise rather than the norm.
// ----------------------------------------------------------------

// a tiny hsl helper so the greens here are written as two numbers
// instead of six long hexes. COMMA syntax: three's Color parser
// reads `hsl(h, s%, l%)` but the modern space-separated form comes
// back as pure white, which made the whole shelf one ghost.
const G = (h, s, l) => `hsl(${h}, ${s}%, ${l}%)`;

export const OPALETTES = [
  { id: 'meadow', label: 'meadow',
    roles: { ground: '#6b5436', trunk: '#7d5f3e', leaf: G(92, 36, 42), leafD: G(92, 38, 28),
             bloom: '#e9e2cc', bloomD: '#cbb883' } },
  { id: 'lime', label: 'lime',
    roles: { ground: '#57462f', trunk: '#6e5336', leaf: G(78, 46, 44), leafD: G(78, 48, 28),
             bloom: '#f5efd8', bloomD: '#d9b964' } },
  { id: 'fern', label: 'fern',
    roles: { ground: '#5e4b34', trunk: '#6f5a3e', leaf: G(120, 28, 40), leafD: G(120, 32, 27),
             bloom: '#efe6cd', bloomD: '#b9ae8d' } },
  { id: 'bloom', label: 'bloom',
    roles: { ground: '#7a6244', trunk: '#8a6f4c', leaf: G(95, 42, 40), leafD: G(95, 46, 27),
             bloom: '#f2cdd5', bloomD: '#e38fa7' } },
  { id: 'desert', label: 'desert',
    roles: { ground: '#6e5a3e', trunk: '#8a6a44', leaf: G(60, 30, 46), leafD: G(60, 32, 32),
             bloom: '#e7ddc0', bloomD: '#caa458' } },
  { id: 'tundra', label: 'tundra',
    roles: { ground: '#5c5540', trunk: '#6f6650', leaf: G(100, 20, 40), leafD: G(100, 22, 28),
             bloom: '#d9e3d8', bloomD: '#a9bfa9' } },
];

export const OPALETTE_IDS = OPALETTES.map(p => p.id);
export const OPALETTE_BY_ID = Object.fromEntries(OPALETTES.map(p => [p.id, p]));

/** the one ink that does every bloom centre in the lab, outside the
 *  palettes on purpose — same trick as the gloss lab's `INK`: a single
 *  shared near-black is most of the family resemblance. */
export const INK = '#33291f';

/** a role set resolved out of a palette. The parts read a NAME,
 *  never a colour number. */
export function resolveRoles(recipe) {
  const pal = OPALETTE_BY_ID[recipe.palette] ?? OPALETTES[0];
  const r = pal.roles;
  return {
    ground: r.ground, trunk: r.trunk,
    leaf: r.leaf, leafD: r.leafD,
    bloom: r.bloom, bloomD: r.bloomD,
    ink: INK,
  };
}