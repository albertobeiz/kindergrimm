// ---------------------------------------------------------------
// THE ITEM REGISTRY — the one place a family of objects is turned on.
//
// To add a family:
//   1. write src/items/<yours>.js against the contract below
//   2. import it here
//   3. put it in FAMILIES
//
// Nothing else changes: the draft, the cards, the floor, the child's
// fist and the favour odds all read this list. It is the same
// mechanical job as adding a part.
//
// THE FAMILY CONTRACT
// -------------------
//   id      unique string, also the favour key
//   slot    'held' | 'offhand' | 'worn' | 'charm' | 'mutation' | 'floor'
//   kind    FLOOR ONLY: which of the three floor kinds it makes —
//           'light' | 'toy' | 'bed'. The hand (below) guarantees one
//           card of each, so a floor family that does not declare it
//           can never be dealt.
//   noun    the word in the item's name ('sword')
//   weight  base draft weight before favour
//
//   gen(rng, C)     → params. C = { rank, pow, wpick }. `pow` is the
//                     rank's power multiplier, already rolled — bake
//                     it into whatever the family wants scaled.
//   statsOf(P)      → { add:{}, mul:{} }   PURE. Same P, same numbers.
//   fxOf(P)         → { fear, sticky, throw, chill, lull, thrift, familiar }
//   patchOf(P)      → a recipe patch (mutation slot only)
//   objOf(P)        → { kind, wU, hU, flat, r, fuel, dur, play } (floor only)
//   adj(P)          → one adjective for the name
//   desc(P)         → one line of card copy in the game's own voice
//   draw(s, P, F)   → the art, in REF space, origin at the ANCHOR,
//                     up NEGATIVE. `F` is present only when drawing
//                     inside a character; pass it through to finish().
//
// The anchor is the GRIP for held/offhand, the HEAD CONTACT for worn,
// the BASE for standing floor things, and the CENTRE for flat things
// and charms.
// ---------------------------------------------------------------
import { makeRng, hashStr } from '../rng.js';
import { Sketch } from '../sketch.js';
import { REF, RANKS, MODS, CURSES, wpick, stamp, blankStats, mergeStats,
         nameItem, readStats } from './core.js';

import { Sword } from './sword.js';
import { Bat } from './bat.js';
import { Wand } from './wand.js';
import { Shield } from './shield.js';
import { Crown } from './crown.js';
import { Hat } from './hat.js';
import { Charm } from './charm.js';
import { Doll } from './doll.js';
import { Mutation } from './mutation.js';
import { Lantern } from './lantern.js';
import { Toy } from './toy.js';
import { Bed } from './bed.js';

export const FAMILIES = [
  Sword, Bat, Wand, Shield,       // held / offhand
  Crown, Hat,                     // worn
  Charm, Doll, Mutation,          // carried / bodily
  Lantern, Toy, Bed,              // floor
];
export const FAMILY_BY_ID = Object.fromEntries(FAMILIES.map(f => [f.id, f]));

// ---- rolling ----------------------------------------------------
let uid = 0;

export const familiesForSlot = slot => FAMILIES.filter(f => f.slot === slot);

// The roll, split in two so that a character's recipe can stay tiny.
// `rollP` is everything the DRAWING needs and is pure in
// (family, rank, seed) — so `src/parts/gear.js` stores only those
// three values and re-derives the shape, and it is guaranteed to be
// the same shape the draft card showed. `rollItem` continues the same
// rng stream for the parts only the GAME needs.
function openRoll(familyId, rank, seed) {
  const fam = FAMILY_BY_ID[familyId];
  if (!fam) return null;
  const rng = makeRng(hashStr(`${familyId}:${rank}:${seed}`));
  const R = RANKS[rank] ?? RANKS.sketch;
  const pow = rng.r(R.pow[0], R.pow[1]);
  const P = fam.gen(rng, { rank, pow, wpick });
  P.pow = pow;
  P.rank = rank;                       // the drawing needs it; finish() reads it
  return { fam, rng, R, P };
}

export function rollP(familyId, rank = 'sketch', seed = 0) {
  return openRoll(familyId, rank, seed)?.P ?? null;
}

export function rollItem(familyId, rank = 'sketch', seed = (Math.random() * 1e9) | 0) {
  const open = openRoll(familyId, rank, seed);
  if (!open) return null;
  const { fam, rng, R, P } = open;

  // Stat modifiers are for things a CHILD carries. A bed's stat bag
  // never reaches anybody, so rolling "cosy" onto one would print a
  // promise the game cannot keep — a floor object's rank shows up in
  // `objOf` through `pow` instead, where it is a wider circle of light
  // or a softer mattress.
  const mods = [];
  if (fam.slot !== 'floor') {
    const bag = [...MODS];
    for (let i = 0; i < R.mods && bag.length; i++)
      mods.push(bag.splice((rng.r(0, bag.length)) | 0, 1)[0]);
  }

  // `stuck` means "they will never put it down", which is only a
  // price on a slot that could otherwise be swapped. On a charm or a
  // mutation — neither of which is ever removed — it would be a cost
  // printed on the card and never paid.
  const SWAPPABLE = fam.slot === 'held' || fam.slot === 'offhand' || fam.slot === 'worn';
  const pool = SWAPPABLE ? CURSES : CURSES.filter(c => c.id !== 'stuck');
  const curse = R.curse && fam.slot !== 'floor'
    ? pool[(rng.r(0, pool.length)) | 0] : null;

  const stats = blankStats();
  mergeStats(stats, fam.statsOf?.(P));
  for (const m of mods) mergeStats(stats, m);
  if (curse) mergeStats(stats, curse);

  const obj = fam.objOf?.(P) ?? null;
  const copy = describe(fam, P, stats, mods, curse, obj);
  return {
    uid: ++uid,
    family: familyId,
    slot: fam.slot,
    rank, seed, P, stats, mods, curse, obj,
    fx: fam.fxOf?.(P) ?? {},
    patch: fam.patchOf?.(P) ?? null,
    name: nameItem(fam, P, rank, mods),
    copy, desc: [copy.what, copy.does, copy.costs].filter(Boolean).join(' — '),
  };
}

// A band-picker: turns a number into the word a child would use.
// `words` has one more entry than `cuts` — the last one is "above
// everything". findIndex returns -1 when nothing matched, which is
// exactly that top band.
const band = (v, cuts, words) => {
  const i = cuts.findIndex(c => v < c);
  return words[i < 0 ? words.length - 1 : i];
};

// What a thing on the floor is worth, read off the numbers it will
// actually run on. Floor objects have no stat bag at all, so without
// this their cards would be silent about the only thing that matters.
function readObj(o) {
  const out = [];
  if (o.kind === 'light') {
    out.push(band(o.r, [3, 4.6, 6], ['a small pool of light', 'an honest circle of light',
      'a wide circle of light', 'it lights half the room']));
    out.push(band(o.fuel, [70, 120], ['burns out quickly', 'burns a good while', 'burns most of the night']));
  } else if (o.kind === 'toy') {
    out.push(band(o.play, [.95, 1.4], ['a quiet little thing', 'good to play with', 'they will not want to stop']));
    out.push(band(o.dur, [90, 140], ['it will not last', 'sturdy enough', 'built like a rock']));
  } else if (o.kind === 'bed') {
    out.push(band(o.rest ?? 1, [1.2, 1.5], ['somewhere to sleep', 'a soft one', 'they will be up in no time']));
    out.push(band(o.dur, [90, 140], ['it will not last', 'sturdy enough', 'built like a rock']));
  }
  return out;
}

// Card copy comes in three parts because they are three different
// KINDS of statement, and running them together as one sentence is
// what made a card hard to read: WHAT the thing is, WHAT it does to
// the numbers, and WHAT it costs you. The draft prints them as three
// paragraphs; `desc` keeps the one-line join for tooltips and logs.
function describe(fam, P, stats, mods, curse, obj) {
  const read = obj ? readObj(obj) : readStats(stats);
  return {
    what: fam.desc?.(P) ?? '',
    does: read.join(' · '),
    costs: curse ? `but: ${curse.desc}` : '',
  };
}

// ---- favour: the toybox learns what you like --------------------
// Picking a family makes that family both MORE LIKELY and BETTER.
// That is the whole "choose one and the odds shift" loop, and it
// needs no pool to maintain — favour is just a multiplier over
// generation. Everything else fades, so a run commits to a shape.
export function bumpFavor(favor, familyId) {
  for (const k in favor) if (k !== familyId) favor[k] *= .82;
  favor[familyId] = (favor[familyId] ?? 0) + 1;
}

function rankWeights(f) {
  return [
    ['sketch', Math.max(6, 78 - f * 16)],
    ['inked', 20 + f * 8],
    ['gilded', 2 + f * 5],
    ['nightmare', f >= 2 ? (f - 1) * 3 : 0],
  ].filter(([, w]) => w > 0);
}

// ---- the hand ---------------------------------------------------
// A draft is not three random cards: it is a HAND with a fixed shape.
// The room only ever runs out of one of three things — somewhere to
// sleep, somewhere to play, and light — so all three are always on the
// table. A draft that failed to offer the one you were short of was a
// turn you did not get to play, and the run died of the shuffle rather
// than of anything you did.
//
// The other three are the KIT: anything a child can carry. That is
// where the run's character comes from, so it is the half that is
// still a gamble, and the half favour actually steers.
const HAND = [
  { n: 1, pick: f => f.slot === 'floor' && f.kind === 'light' },
  { n: 1, pick: f => f.slot === 'floor' && f.kind === 'toy' },
  { n: 1, pick: f => f.slot === 'floor' && f.kind === 'bed' },
  { n: 3, pick: f => f.slot !== 'floor' },
];

// One card out of a group's pool. A family gets ONE shot at the slot —
// it is spliced out before it is even rolled, so a hand can never show
// the same family twice — but three seeds inside that shot, because a
// veto (`ok`) is usually about the roll and not the family: a horn
// mutation everybody already has is dead, and the next horn along is
// not.
function pullOne(pool, favor, rng, ok) {
  while (pool.length) {
    const id = wpick(rng, pool);
    pool.splice(pool.findIndex(p => p[0] === id), 1);
    for (let t = 0; t < 3; t++) {
      const it = rollItem(id, wpick(rng, rankWeights(favor[id] ?? 0)), (rng.r(0, 1e9)) | 0);
      if (it && ok(it)) return it;
    }
  }
  return null;
}

// A whole hand, in HAND's order, never two of the same family, biased
// by favour. `ok` is the room's veto — see `anyoneCanTake` in game.js.
export function drawOffers(favor, opts = {}) {
  const rng = opts.rng ?? makeRng((Math.random() * 1e9) | 0);
  const ok = opts.ok ?? (() => true);
  const out = [];
  for (const grp of HAND) {
    const pool = FAMILIES.filter(grp.pick)
      .map(f => [f.id, f.weight * (1 + (favor[f.id] ?? 0) * .9)]);
    for (let n = 0; n < grp.n; n++) {
      const it = pullOne(pool, favor, rng, ok);
      if (!it) break;                    // that group is out of families
      out.push(it);
    }
  }
  return out;
}

// ---- the three hosts --------------------------------------------
// One drawing, three places it can land. None of them re-authors it.

// (1) the draft card / the HUD chip
//
// A thumbnail can't just plant the anchor at the bottom: an anchor is
// the GRIP on a sword (mid-object, with the pommel hanging below), the
// HEAD CONTACT on a hat, the BASE on a lantern. Guessing per slot gets
// three of them wrong and quietly clips the rest.
//
// So we measure instead. The art is drawn once into a generous
// scratch canvas, its ink is measured, and the real thumbnail is
// fitted to that box. A family therefore never has to think about
// framing, and a twelfth one cannot get it wrong. The measurement
// depends only on the params, so it is cached.
const extents = new Map();
function extentOf(fam, item) {
  const key = `${item.family}:${item.rank}:${item.seed}`;
  let e = extents.get(key);
  if (e) return e;

  const N = REF * 3;
  const s = new Sketch(N, N);
  s.boil(hashStr(`fit:${key}`));
  stamp(s, fam, item.P, N / 2, N / 2, REF);        // anchor at centre, scale 1
  const d = s.ctx.getImageData(0, 0, N, N).data;
  let x0 = N, y0 = N, x1 = -1, y1 = -1;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (d[(y * N + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  e = x1 < 0
    ? { x: -REF / 2, y: -REF, w: REF, h: REF }     // drew nothing; fall back
    : { x: x0 - N / 2, y: y0 - N / 2, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  extents.set(key, e);
  return e;
}

// …but fitting each item to its own box would throw away the thing
// the box is FOR. Scale every sword to fill the card and a long one
// and a stubby one look identical — the drawing stops being the stat.
//
// So the scale is per FAMILY, not per item: measured once off a fixed
// spread of rolls, then shared. A long sword fills its card and a
// stubby one visibly does not, and neither is ever clipped, because
// the centring is still per item.
const famMax = new Map();
function familySpan(fam) {
  let m = famMax.get(fam.id);
  if (m !== undefined) return m;
  m = 1;
  for (const rank of ['sketch', 'gilded', 'nightmare']) {
    for (let i = 0; i < 3; i++) {
      const seed = 1009 + i * 7717;
      const e = extentOf(fam, { family: fam.id, rank, seed, P: rollP(fam.id, rank, seed) });
      m = Math.max(m, e.w, e.h);
    }
  }
  famMax.set(fam.id, m);
  return m;
}

export function thumbFor(item, px = 96) {
  const fam = FAMILY_BY_ID[item.family];
  const s = new Sketch(px, px);
  s.boil(hashStr(`thumb:${item.seed}:${item.family}`));
  const e = extentOf(fam, item);
  // an outlier bigger than every sample still gets to fit
  const span = Math.max(familySpan(fam), e.w, e.h);
  const k = (px * .86) / span;
  stamp(s, fam, item.P,
    px / 2 - (e.x + e.w / 2) * k,
    px / 2 - (e.y + e.h / 2) * k,
    k * REF);
  return s.canvas;
}

// (2) the floor prop — the signature scenery.js wants
export function propDrawFor(item) {
  const fam = FAMILY_BY_ID[item.family];
  return (s, W, H) => stamp(s, fam, item.P, 0, 0, fam.flat ? Math.min(W, H) : H);
}

// (3) inside a character part — see src/parts/gear.js
export function drawOnCharacter(s, item, x, y, px, F) {
  const fam = FAMILY_BY_ID[item.family];
  if (!fam) return;
  stamp(s, fam, item.P, x, y, px, F);
}

// ---- what a set of items adds up to -----------------------------
// How good an object-valued effect is, so two of them can be compared.
// Without this the LATER item wins on pickup order alone, and a scruffy
// second doll would silently void a magnificent first one.
const FX_WORTH = {
  throw: v => (v.dmg ?? 0) / Math.max(.1, v.every ?? 1) + (v.r ?? 0) * .05,
  familiar: v => (v.bite ?? 0) + (v.r ?? 0) * .1 + (v.scale ?? 0) * .3,
};

export function aggregate(items) {
  const stats = blankStats();
  const fx = {};
  for (const it of items) {
    mergeStats(stats, it.stats);
    for (const k in it.fx) {
      const v = it.fx[k];
      if (typeof v === 'number') { fx[k] = Math.max(fx[k] ?? 0, v); continue; }
      const worth = FX_WORTH[k];
      if (!fx[k] || !worth || worth(v) > worth(fx[k])) fx[k] = v;
    }
  }
  return { stats, fx };
}

export { REF };
