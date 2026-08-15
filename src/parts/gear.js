// =================================================================
// GEAR — the objects a character is actually carrying.
//
// These are the join between the item system and the rig. They own no
// art of their own: an item family draws itself ONCE (in `REF` space,
// origin at its anchor) and these parts plant that same drawing on a
// body. The sword on the draft card and the sword in the fist are
// literally the same strokes.
//
// The params are deliberately tiny — `{ family, rank, seed }` — and
// the rolled shape is derived from them, so a recipe stays small and
// JSON-clean and the editor's pickers all work: change the family and
// you get a different object, change the rank and you get the same
// object drawn in a better medium.
//
// WHY THE BONE IS AT THE SHOULDER. A held thing has to follow the arm
// through every pose, and bones are flat siblings — there is no
// parenting in the rig. So the gear bone is placed at EXACTLY the
// arm's origin and `anim.js` hands it the arm's finished transform.
// The item is then drawn at the hand's own coordinates, which
// `layout.js` publishes as `B.grip(side)`. Rotating about the
// shoulder is what an arm does, so the item swings correctly for free
// — including in poses nobody has written yet.
// =================================================================
import { U } from '../part.js';
import { FAMILY_BY_ID, rollP, familiesForSlot } from '../items/index.js';
import { stamp } from '../items/core.js';

const NONE = 'none';

// How big an object is against the character carrying it. These heads
// are enormous, so an item scaled "realistically" against the body
// reads as a splinter; a weapon wants to be about as long as the head
// is wide before it looks like a weapon at all.
const heldPx = F => F.s * 1.55;
const wornPx = F => F.w * 1.9;

// how far a carried thing swings away from the body. A weapon leans
// right out; a shield is held closer, because it is meant to be
// between the child and the room.
const TILT_MAIN = .82;
const TILT_OFF = .3;

// Deriving the drawn params from (family, rank, seed) is pure, but it
// happens once per boil frame per state, so memoise it. Never roll
// inside draw() without this — and never roll with `s.jr`, or the
// item's shape would shimmer at 1 Hz.
const memo = new Map();
function paramsOf(P) {
  if (!P || !P.family || P.family === NONE) return null;
  const key = `${P.family}:${P.rank}:${P.seed}`;
  let v = memo.get(key);
  if (v === undefined) {
    v = rollP(P.family, P.rank, P.seed);
    memo.set(key, v);
  }
  return v;
}

// One gen() for all three slots: mostly nothing, because most
// characters are not carrying anything. The small chance of a real
// object is what lets the editor and the crowd page exercise the art
// without the game running.
const genFor = (slot, chance) => (rng, C) => {
  const pool = familiesForSlot(slot);
  const on = pool.length && rng.chance(chance);
  return {
    family: on ? pool[rng.ri(0, pool.length - 1)].id : NONE,
    rank: C.pick(rng, 'rank', [['sketch', 76], ['inked', 19], ['gilded', 4], ['nightmare', 1]]),
    seed: rng.ri(0, 1e9),
  };
};

const metaFor = slot => () => ({
  family: { label: 'objeto', pick: [NONE, ...familiesForSlot(slot).map(f => f.id)] },
  rank: { label: 'rango', pick: ['sketch', 'inked', 'gilded', 'nightmare'] },
  seed: { label: 'semilla', range: [0, 1e9], step: 1 },
});

// A hand-held slot. `sd` is which hand: +1 the main one, -1 the other.
function handSlot(id, label, sd, chance) {
  return {
    id, label,
    // order 0 is the one free slot in the rig's block: in front of the
    // arm that holds it, and still BEHIND the head — a raised object
    // must pass behind the face, never across it
    order: 0, depth: -.15, region: 'body',
    base: ['biped'],
    gen: genFor(sd > 0 ? 'held' : 'offhand', chance),
    meta: metaFor(sd > 0 ? 'held' : 'offhand'),
    skip: (P, F) => !paramsOf(P) || !F.B.grip,
    // AT THE SHOULDER, not the hand — see the header
    bones: (P, F) => [{
      name: sd > 0 ? 'gearR' : 'gearL',
      x: sd * F.B.shoulderX / U, y: -F.B.shoulderY / U, side: sd,
    }],
    size: (P, F) => {
      const g = F.B.grip(sd);
      const px = heldPx(F);
      const dx = Math.abs(g[0] - sd * F.B.shoulderX) + px;
      const dy = Math.abs(g[1] - F.B.shoulderY) + px;
      return [(dx * 2.4) / U, (dy * 2.4) / U];
    },
    draw(s, P, st, F, bone) {
      const item = paramsOf(P);
      const fam = FAMILY_BY_ID[P.family];
      if (!item || !fam) return;
      const sd = bone.side;
      const [hx, hy] = F.B.grip(sd);
      const px = heldPx(F) * (fam.scaleOn ?? 1);
      s.ctx.save();
      // ANGLED OUT, and it matters more than it sounds. These heads are
      // enormous and overlap the body, and gear draws behind the skull
      // (order 0) so that a raised arm never crosses the face. Held
      // straight up, a sword is therefore invisible — the whole blade
      // lands behind the head. Swung out and away it reads as a
      // silhouette against the floor, which is also just how a child
      // draws somebody holding something.
      s.ctx.translate(hx + sd * px * .18, hy + px * .1);
      s.ctx.rotate(sd * (fam.tilt ?? (sd > 0 ? TILT_MAIN : TILT_OFF)));
      s.ctx.scale(sd, 1);
      stamp(s, fam, item, 0, 0, px, F);
      s.ctx.restore();
    },
  };
}

export const Held = handSlot('held', 'objeto', 1, .1);
export const Offhand = handSlot('offhand', 'otra mano', -1, .05);

// =================================================================
// WORN — a hat or a crown, on top of the skull.
// order 7 puts it level with the crest; the registry order (Worn is
// listed AFTER Crest) is what puts it in front of a pair of horns.
// =================================================================
export const Worn = {
  id: 'worn', label: 'sombrero', order: 7, depth: .35,
  gen: genFor('worn', .1),
  meta: metaFor('worn'),
  skip: P => !paramsOf(P),
  bones: (P, F) => [{ name: 'worn', x: F.L.hatX / U, y: -F.L.hatY / U }],
  size: (P, F) => [(wornPx(F) * 2.4) / U, (wornPx(F) * 2.4) / U],
  draw(s, P, st, F) {
    const item = paramsOf(P);
    const fam = FAMILY_BY_ID[P.family];
    if (!item || !fam) return;
    s.ctx.save();
    s.ctx.translate(F.L.hatX, F.L.hatY);
    // nobody wears a hat straight, and the head's own ¾ turn should
    // carry it along
    s.ctx.rotate(F.turn * .18);
    stamp(s, fam, item, 0, 0, wornPx(F) * (fam.scaleOn ?? 1), F);
    s.ctx.restore();
  },
};
