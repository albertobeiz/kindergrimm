// ---------------------------------------------------------------
// Face rig: turns a RECIPE into a tree of bones with one drawn part
// hanging from each. The recipe is the single source of truth and is
// fully serializable — same JSON, same face, anywhere.
//
// recipe = {
//   seed, color: 'auto'|'plain'|'color',
//   parts: { [id]: { params, lock?, rr? } }
// }
// `rr` is a per-part reroll counter: bumping it re-derives that
// part's params from the seed without touching anything else.
//
// GEOMETRY vs INK: the skull keypoints, eye offsets and side picks
// are derived here with rngs seeded from (seed + part rr) so the
// construction holds still while the line boil re-inks each frame.
//
// Parts draw in FACE COORDINATES (px, y-down, origin at face
// center) exactly like the cyber-crowd reference: the rig
// translates each part's canvas so its bone anchor lands on the
// plane's pivot.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { chaikin, SKINC, HAIRCOL, ACCENTC } from './sketch.js';
import { MEDIA } from './media.js';
import { makeRng, hashStr } from './rng.js';
import { makePart, U } from './part.js';
import { Skull, Ears } from './parts/skull.js';
import { Eyes, Brows } from './parts/eyes.js';
import { Mouth, Nose } from './parts/mouthnose.js';
import { Hair } from './parts/hair.js';
import { Extras } from './parts/extras.js';
import { Horns } from './parts/horns.js';
import { Neck } from './parts/neck.js';

export const PARTS = [Hair, Horns, Neck, Skull, Ears, Eyes, Brows, Nose, Mouth, Extras];
const byId = Object.fromEntries(PARTS.map(d => [d.id, d]));

export function newRecipe(seed = (Math.random() * 1e9) | 0) {
  return { seed, color: 'auto', media: 'graphite', parts: {} };
}

const partRng = (recipe, id) =>
  makeRng(hashStr(`${recipe.seed}:${id}:${recipe.parts[id]?.rr || 0}`));

// fill in any missing params (new recipe, or a new part added later)
export function ensureParams(recipe) {
  recipe.media ??= 'graphite';
  for (const def of PARTS) {
    const slot = recipe.parts[def.id] ??= {};
    slot.params ??= def.gen(partRng(recipe, def.id));
  }
}

export function rerollPart(recipe, id) {
  const slot = recipe.parts[id];
  slot.rr = (slot.rr || 0) + 1;
  slot.params = byId[id].gen(partRng(recipe, id));
}

// re-derive every unlocked part (new seed)
export function regenUnlocked(recipe, seed = recipe.seed) {
  recipe.seed = seed;
  for (const def of PARTS) {
    const slot = recipe.parts[def.id] ??= {};
    if (slot.lock && slot.params) continue;
    slot.rr = 0;
    slot.params = def.gen(partRng(recipe, def.id));
  }
}

const geomRng = (recipe, id) =>
  makeRng(hashStr(`${recipe.seed}:geom:${id}:${recipe.parts[id]?.rr || 0}`));

// eye opening height and lash weight per type — the bestiary sockets
// read taller than a portrait eye
const EH = {
  saucer: .10, dot: .07, hollow: .10, void: .095, wide: .105, xcross: .08,
  sparkle: .10, sleepy: .085, star: .10, spiral: .09, happy: .08,
  angry: .085, sunken: .085, closed: .07,
};
const LASH = {
  saucer: .05, dot: .05, hollow: .05, void: .05, wide: .05, xcross: .052,
  sparkle: .05, sleepy: .05, star: .05, spiral: .05, happy: .05,
  angry: .052, sunken: .045, closed: .045,
};

// ---- casting + construction, all in px like the reference ------
function buildContext(recipe) {
  const Ps = Object.fromEntries(PARTS.map(d => [d.id, recipe.parts[d.id].params]));
  const S = Ps.skull.s * U;                      // the face scale, px
  const w = S * Ps.skull.wf;                     // half width, px
  const turn = Ps.skull.turn;
  const at = Math.abs(turn), ts = Math.sign(turn) || 1;
  const press = Ps.skull.press;
  const lwMain = S * .05 * press, lwThin = S * .021 * press;

  // skull keypoints: the near side of a turned head swells, the far
  // side collapses, chin and crown push toward where the face points
  const rSk = geomRng(recipe, 'skull');
  const aj = () => rSk.r(-.028, .028) * S;
  const { jaw, chinW, skullY, chinY } = Ps.skull;
  const kp = side => {
    const sc = 1 + (side === ts ? .1 : -.28) * at;
    return [
      [side * w * .80 * sc + aj(), -S * skullY * .72 + aj()],
      [side * w * .97 * sc + aj(), -S * .20 + aj()],
      [side * w * .94 * sc + aj(), S * .15 + aj()],
      [side * w * .80 * jaw * sc + aj(), S * chinY * .6 + aj()],
      [side * w * .34 * chinW * sc + aj(), S * chinY * .92 + aj()],
    ];
  };
  let right = kp(1), left = kp(-1);
  let chin = [turn * w * .3, S * chinY + aj() * .5];
  let skullTop = [turn * w * .16, -S * skullY];

  let facePoly = chaikin([skullTop, ...right, chin, ...left.slice().reverse()], true, 2);
  // one smoothing pass only: fast sketches keep a hint of the polygon
  let outlineOpen = chaikin([right[0], ...right.slice(1), chin, ...left.slice(1).reverse(), left[0]], false, 1);

  // the doodle register slides the DENSE outline part-way onto one
  // TARGET SHAPE (after smoothing, so a brick keeps its corners): the
  // jaw and cheeks stop being a portrait and become a head drawn in
  // one motion. The shape family separates one creature from the
  // next: ball, brick, bean, egg.
  const round = Ps.skull.round || 0;
  if (round > 0) {
    const shape = Ps.skull.shape || 'round';
    const cyR = S * (chinY - skullY) / 2;
    let rxR = w * 1.06, ryR = S * (chinY + skullY) / 2;
    if (shape === 'tall') { rxR *= .8; ryR *= 1.14; }
    if (shape === 'wide') { rxR *= 1.2; ryR *= .82; }
    // radius of the target outline in direction `ang` (0 = right, y down)
    const radius = ang => {
      const cA = Math.cos(ang), sA = Math.sin(ang);
      if (shape === 'square') {
        // superellipse: flat cheeks and crown, corners barely rounded
        const n = 5.5;
        return 1 / Math.pow(Math.pow(Math.abs(cA / rxR), n) + Math.pow(Math.abs(sA / ryR), n), 1 / n);
      }
      const r = 1 / Math.hypot(cA / rxR, sA / ryR);
      // drop: the crown pinches toward a point, the jowls stay full
      if (shape === 'drop' && sA < 0) return r * (1 - .30 * Math.pow(-sA, 1.6));
      // pear: narrow brow over heavy cheeks — the classic blob creature
      if (shape === 'pear') return r * (1 - .26 * Math.pow(Math.max(0, -sA), 1.3) + .1 * Math.pow(Math.max(0, sA), 1.5));
      // lump: one side swells, like it was drawn without lifting the pen
      if (shape === 'lump') return r * (1 + .12 * Math.sin(ang * 2 + 1) + .07 * Math.sin(ang * 3));
      return r;
    };
    const roundPt = p => {
      const ang = Math.atan2((p[1] - cyR) / ryR, p[0] / rxR);
      const rr = radius(ang);
      return [p[0] + (Math.cos(ang) * rr - p[0]) * round,
              p[1] + (cyR + Math.sin(ang) * rr - p[1]) * round];
    };
    facePoly = facePoly.map(roundPt);
    outlineOpen = outlineOpen.map(roundPt);
    right = right.map(roundPt);
    left = left.map(roundPt);
    chin = roundPt(chin);
    skullTop = roundPt(skullTop);
  }
  const hairlinePts = [[-.75 * w, -.55 * S], [-.4 * w, -.66 * S], [turn * w * .12, (-.70 + (rSk.chance(.4) ? .05 : 0)) * S], [.4 * w, -.66 * S], [.75 * w, -.55 * S]];
  const capPts = chaikin([...hairlinePts, [.80 * w, -S * skullY * .72], [turn * w * .12, -S * skullY * 1.0], [-.80 * w, -S * skullY * .72]], true, 2);

  // eyes: geometry the brow/nose/extras also need
  const rEy = geomRng(recipe, 'eyes');
  const E = Ps.eyes;
  const fx = turn * w * .3;
  const sx = w * E.sx;
  const ew0 = w * .32 * E.scale;
  const eh = (EH[E.type] ?? .09) * S * E.ehJit * E.scale;
  const gaze = ew0 * (turn * .35 + E.gazeJit);
  const browY = -eh * 1.2 - S * Ps.brows.yF;
  const lashW = (LASH[E.type] ?? .048) * S * press;
  const eyeX = sd => fx + sd * sx * (sd === ts ? 1 + .04 * at : 1 - .38 * at);
  const eyeW = sd => ew0 * (sd === ts ? 1 - .05 * at : 1 - .55 * at);
  const ey0 = { [-1]: rEy.r(-.022, .022) * S, [1]: rEy.r(-.022, .022) * S };
  const ecxJit = { [-1]: rEy.r(-.028, .028) * S * .4, [1]: rEy.r(-.028, .028) * S * .4 };

  const nx = turn * w * .5;
  const mw = w * .30 * (1 - .25 * at) * Ps.mouth.wF;
  const my = S * Ps.mouth.myF, mx = fx * 1.15;

  const rEx = geomRng(recipe, 'extras');
  const shadowSide = -ts;
  const markSide = rEx.chance(.5) ? -1 : 1;
  const modSide = at > .3 ? ts : (rEx.chance(.5) ? -1 : 1);

  // the casting: which of the muted colors this face gets, if any
  const mode = recipe.color || 'auto';
  const plain = mode === 'plain' || (mode === 'auto' && Ps.skull.plain);
  const colors = {
    plain,
    skin: !plain && Ps.skull.skinOn ? SKINC[Ps.skull.skinIdx % SKINC.length] : null,
    hairCol: !plain && Ps.hair.colOn ? HAIRCOL[Ps.hair.colIdx % HAIRCOL.length] : null,
    accent: ACCENTC[(Ps.extras.accentIdx ?? 0) % ACCENTC.length],
    blush: !plain && Ps.extras.blush,
  };

  return {
    U, s: S, w, turn, at, ts, press, lwMain, lwThin, P: Ps, colors,
    media: MEDIA[recipe.media] ?? MEDIA.graphite,
    L: { right, left, chin, skullTop, facePoly, outlineOpen, hairlinePts, capPts,
         fx, sx, ew0, eh, gaze, browY, lashW, eyeX, eyeW, ey0, ecxJit,
         nx, mw, my, mx, shadowSide, markSide, modSide },
  };
}

export function buildFace(recipe) {
  ensureParams(recipe);
  const F = buildContext(recipe);
  const group = new THREE.Group();
  const entries = [];
  for (const def of PARTS) {
    const P = F.P[def.id];
    if (def.skip?.(P, F)) continue;
    const pivot = def.pivot ?? [.5, .5];
    const [wU, hU] = def.size(P, F);
    for (const b of def.bones(P, F)) {
      const part = makePart({
        name: b.name, wU, hU, pivot,
        states: def.states ?? ['idle'],
        seed: `${recipe.seed}:${recipe.parts[def.id].rr || 0}`,
        draw: (sk, st) => {
          // land the bone anchor on the plane's pivot, then draw in
          // face coordinates like the reference code
          sk.ctx.save();
          sk.ctx.translate(pivot[0] * sk.w - b.x * U, (1 - pivot[1]) * sk.h + b.y * U);
          def.draw(sk, P, st, F, b);
          sk.ctx.restore();
        },
      });
      const order = b.order ?? def.order;
      part.mesh.renderOrder = order;
      part.mesh.position.z = order * .001;   // tie-break for the depth buffer
      part.mesh.userData.partId = def.id;
      const bone = new THREE.Group();
      bone.position.set(b.x, b.y, 0);
      bone.userData.base = { x: b.x, y: b.y };   // the animator parallaxes off this
      bone.add(part.mesh);
      group.add(bone);
      entries.push({
        id: def.id, def, bone, part, side: b.side ?? 1,
        depth: b.depth ?? def.depth ?? 0,
      });
    }
  }
  return {
    group, entries, F, recipe,
    byId: id => entries.filter(e => e.id === id),
    dispose() { entries.forEach(e => e.part.dispose()); },
  };
}
