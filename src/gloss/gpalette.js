// ---------------------------------------------------------------
// THE PALETTES — twelve soft five-colour sets, from the reference
// sheet. A character picks a PALETTE, then one colour out of it for
// the body and a second for its warm bits (blush, tongue, an accent).
// Both come from the same five, which is what stops a shelf of twenty
// looking like twenty unrelated toys.
//
// These were sampled from the swatches by eye — the printed hex codes
// on the sheet are below legible resolution. Correcting one is editing
// one string, and nothing downstream reads a colour by name.
//
// `INK` is deliberately NOT in any palette. One warm near-black does
// every eye, brow and mouth in the lab, and that single shared value
// is most of the family resemblance — the same job the one graphite
// does for the drawn crowd.
// ---------------------------------------------------------------

export const INK = '#2b2422';

// The white of an eye — warm and slightly off, never paper white. It
// sits outside the palettes for the same reason INK does: one value
// across the whole lab is what makes twelve palettes look like one
// product line rather than twelve products.
export const SCLERA = '#f6f2e9';

// Inside an open mouth. Dark warm maroon, shared like INK: every open
// maw on the shelf is the same pour, which is most of what makes a
// mouth read as an interior rather than as a dark sticker.
export const MAW = '#5b2530';

/** a colour lifted toward white — the muzzle-patch pour. This is a
 *  LIGHTER PART, a second colour of vinyl like a panda's white face,
 *  not a highlight; the no-painted-shadows rule is about darkness. */
export function tint(hex, k = .5) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16 & 255, n >> 8 & 255, n & 255]
    .map(v => Math.round(v + (255 - v) * k));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

export const PALETTES = [
  { id: 'dusk',    label: 'dusk',    colors: ['#CFC6D9', '#7B7BB0', '#F5C48A', '#F7E6C4', '#D9A5A5'] },
  { id: 'meadow',  label: 'meadow',  colors: ['#F2E08D', '#9FCFE1', '#E7E3A2', '#F4B8C4', '#F6C9CE'] },
  { id: 'harbour', label: 'harbour', colors: ['#3D77A6', '#7FA6BE', '#F2E7A0', '#F7D9B0', '#F2704A'] },
  { id: 'denim',   label: 'denim',   colors: ['#4A7BA6', '#F2A6A0', '#F7D5D5', '#A67BA6', '#F0EDE6'] },
  { id: 'mist',    label: 'mist',    colors: ['#C6CFE8', '#CFC6E8', '#F2D0DE', '#F7DCC0', '#F7C6CE'] },
  { id: 'bloom',   label: 'bloom',   colors: ['#F4AFC5', '#F2D0EA', '#E0AFD9', '#B8D4F0', '#B0B9E8'] },
  { id: 'orchard', label: 'orchard', colors: ['#6B5C7B', '#F5F0E1', '#F2E88A', '#C6DE8A', '#F2A03C'] },
  { id: 'lagoon',  label: 'lagoon',  colors: ['#3AB8A0', '#A8D6C0', '#BDD9A0', '#D9E8A8', '#A8DEC8'] },
  { id: 'melon',   label: 'melon',   colors: ['#A8D6C8', '#F2B8A0', '#F2A08A', '#F2C6C6', '#E85A3C'] },
  { id: 'ember',   label: 'ember',   colors: ['#F2C6D0', '#F2A8A0', '#F29078', '#F2A03C', '#E87830'] },
  { id: 'moss',    label: 'moss',    colors: ['#A8D6C0', '#BDE0B0', '#D2E8A8', '#EDE8A0', '#E8C84A'] },
  { id: 'apricot', label: 'apricot', colors: ['#F7E8D9', '#F7C6A8', '#F2A88A', '#F2907A', '#E8705A'] },

  // SKIN — the humanoid's, and the only palette that is not a colour
  // scheme but a RANGE of one thing. Four skin tones pale to deep,
  // and a rosy fifth that `colorsFor` will always score as the warm
  // one, so the blush is a flush of the same face rather than a
  // sticker in an unrelated colour. Kept out of the random deal (see
  // `PALETTE_DEAL_IDS`): a skin-toned bear is just a beige bear.
  { id: 'skin', label: 'skin', colors: ['#F7DFCE', '#EFC4A6', '#D79E76', '#A9704B', '#F0A99A'] },
];

export const PALETTE_IDS = PALETTES.map(p => p.id);
// what an un-opinionated character may be poured in. `skin` is asked
// for by name or pinned by hand, never dealt.
export const PALETTE_DEAL_IDS = PALETTE_IDS.filter(id => id !== 'skin');
export const PALETTE_BY_ID = Object.fromEntries(PALETTES.map(p => [p.id, p]));

// ---------------------------------------------------------------
// HAIR. Its own table, and that is the point: hair is never the body's
// colour. A toy's five-colour set is what makes a shelf look like one
// product line; a HEAD's hair is what tells two of them apart, so it is
// dealt from here instead, exactly as `INK` sits outside the palettes.
//
// Weighted, because frequency is art direction here too. The naturals
// carry the line — a sheet where a third of the heads are mint is a
// toy shelf again, not a cast of characters — and the dyed half is the
// treat. `ink` leads: black hair is the commonest hair there is, and it
// is the one value already doing every brow and eye in the lab.
// ---------------------------------------------------------------
export const HAIR_COLORS = [
  { id: 'ink',      label: 'black',    hex: '#2B2422', w: 15 },
  { id: 'espresso', label: 'espresso', hex: '#3B2820', w: 11 },
  { id: 'chocolate',label: 'chocolate',hex: '#4E3527', w: 10 },
  { id: 'chestnut', label: 'chestnut', hex: '#6B4430', w: 10 },
  { id: 'caramel',  label: 'caramel',  hex: '#9A6C3E', w: 8 },
  { id: 'honey',    label: 'honey',    hex: '#C0913F', w: 6 },
  { id: 'blonde',   label: 'blonde',   hex: '#DFC072', w: 6 },
  { id: 'platinum', label: 'platinum', hex: '#E4D8BC', w: 4 },
  { id: 'ginger',   label: 'ginger',   hex: '#BC5A2C', w: 5 },
  { id: 'ash',      label: 'ash',      hex: '#7E776C', w: 4 },
  { id: 'silver',   label: 'silver',   hex: '#C3BFB6', w: 4 },
  // the dyed half — a treat, never the rule
  { id: 'rose',     label: 'rose',     hex: '#DE8397', w: 4 },
  { id: 'lilac',    label: 'lilac',    hex: '#A08FC4', w: 4 },
  { id: 'mint',     label: 'mint',     hex: '#84C1A6', w: 3 },
  { id: 'sky',      label: 'sky',      hex: '#7BA2D2', w: 3 },
  { id: 'plum',     label: 'plum',     hex: '#65456E', w: 3 },
];

export const HAIR_IDS = HAIR_COLORS.map(c => c.id);
export const HAIR_BY_ID = Object.fromEntries(HAIR_COLORS.map(c => [c.id, c]));
export const HAIR_WEIGHTS = HAIR_COLORS.filter(c => c.w > 0).map(c => [c.id, c.w]);

// ---------------------------------------------------------------
// ACCESSORIES. Their own table, for exactly the reason hair has one: a
// hat, a frame or a plaster has to be VISIBLE, and it cannot be if it
// is drawn from the toy's own five. On a humanoid that is fatal —
// every colour in the `skin` palette IS a skin tone, so the first
// beanie came out as a bald head.
//
// These are the accessory colours a toy shelf actually uses: strong,
// slightly dirty, and few. `pickAcc` then guarantees the one chosen
// stands clear of BOTH the body and the hair, so a red hat never lands
// on a red toy and a black one never lands on black hair.
// ---------------------------------------------------------------
// No terracotta and no tan. They were in, and against a skin body they
// scored well on luma while being the same HUE — a brick beanie on a
// peach head lit by a warm key came out as another shade of face. Luma
// is not enough; see `pickAcc`.
export const ACC_COLORS = [
  '#2B2422', '#F0EAE0', '#C6483E', '#D8C049',
  '#5E9E86', '#3F7FA6', '#6E4E8C', '#8A8E93', '#B8375C', '#3E5C4A',
];

/** the accessory colour furthest in luma from both the toy and its
 *  hair, chosen deterministically from a rolled index so the same
 *  recipe always gets the same one. */
export function pickAcc(i, body, hair) {
  // FULL RGB distance, not luma. Scored on lightness alone a terracotta
  // beats a teal against peach skin — and then renders as another shade
  // of face, because it is the same hue and the key light is warm.
  // Distance in colour, not in brightness.
  const rgb = hex => { const n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const B = rgb(body), H = rgb(hair);
  let best = ACC_COLORS[0], score = -1;
  for (let k = 0; k < ACC_COLORS.length; k++) {
    const c = ACC_COLORS[(k + i) % ACC_COLORS.length];
    const C = rgb(c);
    // the WORSE of its two clearances decides — an accessory has to
    // stand off the skin and off the hair, not average well
    const d = Math.min(dist(C, B), dist(C, H));
    // the rolled index breaks ties, so a sheet still varies instead of
    // every toy converging on the one safest colour
    const sc = d + (k === 0 ? .05 : 0);
    if (sc > score) { score = sc; best = c; }
  }
  return best;
}

/** a → b by t, in hex. For the brow, which is the hair's own colour
 *  pulled toward ink: a platinum brow at full strength disappears, and
 *  an ink one on blonde hair reads as somebody else's eyebrows. */
export function mix(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map(s =>
    Math.round(((A >> s) & 255) + (((B >> s) & 255) - ((A >> s) & 255)) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/** how dark a colour reads, 0..1 — used to keep a feature off a body
 *  it would vanish against, never to invent a colour. */
export function luma(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (.2126 * (n >> 16 & 255) + .7152 * (n >> 8 & 255) + .0722 * (n & 255)) / 255;
}

// There was a `shade()` here, darkening the body colour for a ring
// behind each eye. It is gone with the rim: on palettes this pale a
// darkened body tone does not read as shadow, it reads as a second
// colour. A shadow on this lab comes from geometry and the studio,
// never from a colour picked to look like one.
