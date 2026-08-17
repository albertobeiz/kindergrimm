// ---------------------------------------------------------------
// THE OBJECT SYSTEM — the hand that draws things, and the dice.
//
// THE ONE IDEA: **the stats ARE the drawing.** An item is a seeded
// bag of params, and that same bag drives `draw()` and `statsOf()`.
// A sword that rolled a long blade IS drawn long and DOES reach
// further. A lantern with a fat bowl IS drawn fat and DOES light a
// bigger circle. You can read an item's power off the paper, the way
// you can read a character's species off its ears.
//
// So: never add a stat with no visible consequence, and never draw a
// feature that means nothing.
//
// AUTHORED ONCE, DRAWN IN THREE PLACES. Every family draws itself in
// its own little REF-sized box with the origin at its ANCHOR and up
// NEGATIVE — the scenery convention. `stamp()` then plants that same
// drawing wherever it is needed:
//
//     the draft card   ·  the floor prop  ·  the fist of a child
//
// It scales through `ctx.scale`, never by multiplying the numbers.
// That matters more than it looks: every decision inside Sketch
// (`w >= 1.2` granulation, the 2.2px resample floor, the `n < 3`
// bail) is made in USER units, before the transform. Scaling the
// canvas gives the identical drawing, grain and all, at another size.
// Scaling your own numbers crosses those thresholds, shifts the whole
// random stream, and quietly gives you a DIFFERENT item.
// Keep the factor inside roughly [.6, 2] and the grain holds up.
// ---------------------------------------------------------------
import { chaikin } from '../sketch.js';

// The reference box every item is authored in. Chosen so all three
// hosts land in the safe scaling band: the card draws at 96 (×1.0),
// a floor prop at ~128 (×1.33), and a fist in the game room at
// ~F.s*1.1 ≈ 60 (×.63).
export const REF = 96;

// weighted pick — `makeRng` has no `weighted`, and every part file
// re-declares this. Pairs are [value, weight], like a part's gen().
export function wpick(rng, pairs) {
  let t = 0;
  for (const [, n] of pairs) t += n;
  let r = rng.r(0, t);
  for (const [v, n] of pairs) if ((r -= n) <= 0) return v;
  return pairs[pairs.length - 1][0];
}

// ---- ranks ------------------------------------------------------
// Rarity is a DRAWING TREATMENT, not a colour swatch. A better item
// is drawn in a better medium, so you can tell across the room, and
// so a twelfth family cannot invent its own ladder.
//
//   pow   multiplies the size of every bonus the family hands out
//   mods  how many extra rolled modifiers it carries
//   curse nightmare only: it always costs you something
export const RANKS = {
  sketch:    { id: 'sketch',    label: 'pencil',    pow: [.85, 1.05], mods: 0, weight: 78 },
  inked:     { id: 'inked',     label: 'inked',     pow: [1.0, 1.25], mods: 1, weight: 20 },
  gilded:    { id: 'gilded',    label: 'gilded',    pow: [1.2, 1.5],  mods: 2, weight: 2 },
  nightmare: { id: 'nightmare', label: 'scribbled', pow: [1.5, 2.0],  mods: 2, weight: 0, curse: true },
};
export const RANK_IDS = ['sketch', 'inked', 'gilded', 'nightmare'];

// The word that goes in the item's name. `sketch` is silent on
// purpose — a plain pencil object is the baseline, and calling it
// "pencil sword" every time makes the good ones read as noise.
const RANK_WORD = { sketch: '', inked: 'inked', gilded: 'gilded', nightmare: 'scribbled' };

// ---- finish() — what `solid()` is to the scenery ----------------
// EVERY family closes its shapes through this and gets the whole
// rank ladder for free. No family may draw its own rank look; that
// is the rule that keeps the catalogue legible.
//
//   o.F      the layout frame, when drawing INSIDE a character.
//            Present → go through F.media (a part must never call a
//            technique directly). Absent → the harder prop idiom,
//            because a thing on the floor is read at distance under
//            a blur and a delicate contour dissolves into the lino.
//   o.lw     contour weight, in REF units
//   o.style  the tone style for the media path
//   o.fill   false to skip the opaque body (an open shape, a strap)
export function finish(s, pts, rank = 'sketch', o = {}) {
  const lw = o.lw ?? 3;
  const closed = pts.concat([pts[0]]);
  const F = o.F;

  if (o.fill !== false) {
    if (F) F.media.tone(s, pts, { style: o.style ?? 'light', gap: REF * .05 });
    else s.paperFill(pts);
  }

  if (rank === 'inked') {
    // a second, more confident pass — the line someone went back over
    if (F) F.media.edge(s, closed, lw * 1.15, { alpha: 1 });
    else s.stroke(closed, lw * 1.15, { taper: .06, amp: .6, alpha: 1 });
    const gh = s.offsetShape(pts, 1.035, 0, 0, .7);
    s.sline(gh.concat([gh[0]]), lw * .5, .4);
  } else if (rank === 'gilded') {
    if (F) F.media.edge(s, closed, lw, { alpha: 1 });
    else s.stroke(closed, lw, { taper: .1, amp: .7, alpha: 1 });
    // the gleam: a lighter core, and ticks flicking off the outline
    const inner = s.offsetShape(pts, .82, 0, 0, .5);
    s.hatchFill(inner, REF * .075, -.7, .1, 1);
    for (let i = 0; i < 3; i++) {
      const p = pts[((i * 7 + 2) * 3) % pts.length];
      const c = centroid(pts);
      const a = Math.atan2(p[1] - c[1], p[0] - c[0]);
      const r0 = REF * .045, r1 = REF * .1;
      s.sline([[p[0] + Math.cos(a) * r0, p[1] + Math.sin(a) * r0],
               [p[0] + Math.cos(a) * r1, p[1] + Math.sin(a) * r1]], lw * .55, .75);
    }
  } else if (rank === 'nightmare') {
    // drawn by THEM: pressed through the paper, and it grew barbs
    if (F) F.media.edge(s, closed, lw * 1.3, { alpha: 1 });
    else s.stroke(closed, lw * 1.35, { taper: .04, amp: 1.4, alpha: 1 });
    s.scribbleFill(pts, REF * .05, .5);
    const c = centroid(pts);
    for (let i = 0; i < 5; i++) {
      const p = pts[((i * 5 + 1) * 5) % pts.length];
      const a = Math.atan2(p[1] - c[1], p[0] - c[0]) + s.jr(-.4, .4);
      const r1 = REF * s.jr(.05, .11);
      s.sline([[p[0], p[1]], [p[0] + Math.cos(a) * r1, p[1] + Math.sin(a) * r1]], lw * .5, .9);
    }
  } else {
    if (F) F.media.edge(s, closed, lw, { alpha: 1 });
    else s.stroke(closed, lw, { taper: .1, amp: .8, alpha: 1 });
  }
}

function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

// A rounded bar from a to b — the workhorse shape for blades,
// handles, stems and shafts. Returns a closed point ring.
export function barPts(x0, y0, x1, y1, w0, w1 = w0, round = 1) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  const pts = [
    [x0 + nx * w0, y0 + ny * w0],
    [x1 + nx * w1, y1 + ny * w1],
    [x1 - nx * w1, y1 - ny * w1],
    [x0 - nx * w0, y0 - ny * w0],
  ];
  return round ? chaikin(pts, true, round) : pts;
}

// An n-pointed star ring, anchored so `r0` is the waist and `r1` the
// tips. Sketch has no star primitive; several families want one.
export function starPts(cx, cy, r0, r1, n, rot = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 ? r0 : r1;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// ---- stamping: one drawing, three hosts -------------------------
// Plant a family's art into any Sketch at (x, y), `px` tall.
// `fam` is passed in rather than looked up, so core never has to
// import the registry (and the registry can import core).
export function stamp(s, fam, P, x, y, px, F) {
  const k = px / REF;
  s.ctx.save();
  s.ctx.translate(x, y);
  s.ctx.scale(k, k);
  fam.draw(s, P, F);
  s.ctx.restore();
}

// ---- modifiers --------------------------------------------------
// What a rank buys you on top of the family's own numbers. Shared,
// so every family gets the same vocabulary and a "swift sword" and a
// "swift crown" mean the same thing.
export const MODS = [
  { id: 'sharp',   word: 'sharp',   add: { dmg: .7 } },
  { id: 'swift',   word: 'swift',   mul: { swingT: .84 } },
  { id: 'long',    word: 'long',    add: { reach: .45 } },
  { id: 'light',   word: 'light',   mul: { speed: 1.18 } },
  { id: 'warm',    word: 'warm',    add: { lampR: 1.1 } },
  { id: 'stout',   word: 'stout',   add: { maxStam: 22 } },
  { id: 'cosy',    word: 'cosy',    mul: { drain: .82 } },
  { id: 'restful', word: 'restful', mul: { rest: 1.35 } },
  { id: 'heavy',   word: 'heavy',   mul: { knock: 1.5 }, add: { dmg: .3 } },
];

// ---- effects ----------------------------------------------------
// What `fxOf(P)` may return. UNITS ARE THE CONTRACT: everything here
// is a RADIUS IN WORLD UNITS except where noted, because the game
// compares them against `Math.hypot(dx, dz)` directly. Return a 0-1
// "strength" instead and it silently never fires — a class walks
// around inside about 4 units, so a believable earshot is 2 to 6.
//
//   fear:   r   on a hit, every nightmare within r flinches
//   chill:  r   nightmares within r are mired (light no longer does this)
//   lull:   r   children within r get their courage back faster
//   thrift: r   lanterns within r burn longer
//   sticky: SECONDS a nightmare this child hits stays mired
//   throw:  { every: SECONDS, dmg, speed: units/s, r: range }
//   familiar: { species, scale, bite, r } — a whole live character
//
// Numbers stack by `Math.max` across a child's whole kit; objects
// replace. Add a key here and it must be read somewhere in game.js,
// or it is a stat with no visible consequence — the one thing this
// system is not allowed to have.
export const FX_KEYS = ['fear', 'chill', 'lull', 'thrift', 'sticky', 'throw', 'familiar'];

// ---- curses -----------------------------------------------------
// The price of a nightmare-drawn object. Never lethal, never gory —
// this is a baby school. They make the room harder, not the child.
export const CURSES = [
  { id: 'bait',    word: 'wanted',  desc: 'nightmares come looking for them' },
  { id: 'hungry',  word: 'hungry',  desc: 'burns energy faster', mul: { drain: 1.35 } },
  { id: 'flicker', word: 'flickery', desc: 'their own light stutters' },
  { id: 'stuck',   word: 'stuck',   desc: 'they will never put it down' },
  { id: 'leaden',  word: 'leaden',  desc: 'it drags at them', mul: { speed: .88 } },
];

// ---- stats ------------------------------------------------------
// A modifier bag is { add: {...}, mul: {...} }. Aggregation is
// deliberately re-derived from the child's BASE every time the set
// changes, never mutated in place — that is what stops swapping a
// sword from drifting the numbers a little further every draft.
export const STAT_KEYS = [
  'speed', 'dmg', 'reach', 'swingT', 'rest', 'lampR',
  'scale', 'maxStam', 'drain', 'knock',
];

export function blankStats() {
  return { add: {}, mul: {} };
}

export function mergeStats(into, s) {
  if (!s) return into;
  for (const k in s.add ?? {}) into.add[k] = (into.add[k] ?? 0) + s.add[k];
  for (const k in s.mul ?? {}) into.mul[k] = (into.mul[k] ?? 1) * s.mul[k];
  return into;
}

// stat = (base + Σadd) * Πmul
export function applyStats(base, bag) {
  const out = {};
  for (const k of STAT_KEYS) {
    const b = base[k] ?? 0;
    out[k] = (b + (bag.add[k] ?? 0)) * (bag.mul[k] ?? 1);
  }
  return out;
}

// ---- naming -----------------------------------------------------
// Lowercase and doodle-plain, to match `say('a toy broke')`. The
// adjective comes from the family's own strongest roll, so the name
// is another place the params show through.
//
// The name is BARE — no article. It is a LABEL far more often than it
// is a word in a sentence: a card heading, a row in a kit list. "a
// long inked bat" as a heading reads as a line of flavour, where
// "long inked bat" reads as the thing itself. `withArticle` puts one
// back for the few places that are actually prose.
export function nameItem(fam, P, rank, mods) {
  const bits = [];
  // A family declines to name a middling roll, and then the modifier
  // is the only interesting thing about the object — so it gets the
  // adjective instead of the name going bare.
  const adj = fam.adj?.(P) || (mods.length ? mods[0].word : null);
  if (adj) bits.push(adj);
  const rw = RANK_WORD[rank];
  if (rw) bits.push(rw);
  bits.push(fam.noun);
  return bits.join(' ');
}

export const withArticle = n => (/^[aeiou]/.test(n) ? `an ${n}` : `a ${n}`);

// A one-line reading of what the numbers actually do, built from the
// bag rather than written by hand — so it can never drift from the
// item it is describing.
// Both directions are spelled out. Prefixing "less" onto the good
// word gives you "less swings faster", which is not English.
const STAT_WORD = {
  speed: 'quicker', dmg: 'hits harder', reach: 'reaches further',
  swingT: 'swings faster', rest: 'rests better', lampR: 'gives light',
  scale: 'bigger', maxStam: 'more energy',
  drain: 'tires slower', knock: 'knocks back harder',
};
const STAT_BAD = {
  speed: 'slower', dmg: 'hits softer', reach: 'shorter reach',
  swingT: 'swings slower', rest: 'rests worse', lampR: 'dimmer',
  scale: 'smaller', maxStam: 'less energy',
  drain: 'tires faster', knock: 'knocks back less',
};
const LOWER_BETTER = new Set(['swingT', 'drain']);

export function readStats(bag, limit = 3) {
  const score = {};
  for (const k in bag.add) score[k] = Math.abs(bag.add[k]) * (k === 'maxStam' ? .04 : 1);
  for (const k in bag.mul) {
    const d = Math.abs(bag.mul[k] - 1) * 3;
    score[k] = (score[k] ?? 0) + d;
  }
  const good = k => {
    const a = bag.add[k] ?? 0, m = (bag.mul[k] ?? 1) - 1;
    const dir = a + m;
    return LOWER_BETTER.has(k) ? dir < 0 : dir > 0;
  };
  return Object.keys(score)
    .filter(k => STAT_WORD[k] && score[k] > .01)
    .sort((a, b) => score[b] - score[a])
    .slice(0, limit)
    .map(k => (good(k) ? STAT_WORD : STAT_BAD)[k]);
}
