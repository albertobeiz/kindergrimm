// ---------------------------------------------------------------
// THE RIG — recipe in, animatable character out.
//
// This file is deliberately generic: it knows nothing about eyes or
// arms, only about the part contract. Adding a part type should
// NEVER require editing this file (see src/parts/index.js).
//
//   recipe = {
//     seed,                       // one integer; the whole character
//     media,                      // 'graphite' | 'ink' | 'watercolor' | ...
//     color: 'auto'|'plain'|'color',
//     parts: { [id]: { params, lock?, rr? } }
//   }
//
// `params` is what the editor edits and what makes a character
// itself. `rr` is a per-part reroll counter: bumping it re-derives
// only that part from the seed. `lock` keeps a part through a global
// regenerate.
//
// The recipe is the ONLY state. Same JSON in, same character out,
// on any machine — that is what makes these usable in a game.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { makeRng, hashStr } from './rng.js';
import { makePart, U } from './part.js';
import { buildLayout } from './layout.js';
import { PARTS, PART_BY_ID } from './parts/index.js';
import { castingFor } from './species.js';

export { PARTS };

export function newRecipe(seed = (Math.random() * 1e9) | 0) {
  return { seed, species: 'human', color: 'auto', media: 'graphite', parts: {} };
}

const partRng = (recipe, id) =>
  makeRng(hashStr(`${recipe.seed}:${id}:${recipe.parts[id]?.rr || 0}`));

// A part's gen() is handed a CASTING helper scoped to that part: it
// answers pick/range/chance with the species' opinion when it has one
// and the part's own default when it does not. The species only ever
// biases GENERATION — once params exist they are plain numbers, so a
// saved recipe rebuilds identically without it.
const castFor = recipe => castingFor(recipe.species);

// fill in whatever is missing — a new recipe, or an old recipe from
// before a part type existed
export function ensureParams(recipe) {
  recipe.media ??= 'graphite';
  recipe.species ??= 'human';
  const cast = castFor(recipe);
  for (const def of PARTS) {
    const slot = recipe.parts[def.id] ??= {};
    slot.params ??= def.gen(partRng(recipe, def.id), cast(def.id));
  }
}

export function rerollPart(recipe, id) {
  const slot = recipe.parts[id];
  slot.rr = (slot.rr || 0) + 1;
  slot.params = PART_BY_ID[id].gen(partRng(recipe, id), castFor(recipe)(id));
}

// re-derive every unlocked part (a new seed, a new species, or the
// same one again)
export function regenUnlocked(recipe, seed = recipe.seed) {
  recipe.seed = seed;
  const cast = castFor(recipe);
  for (const def of PARTS) {
    const slot = recipe.parts[def.id] ??= {};
    if (slot.lock && slot.params) continue;
    slot.rr = 0;
    slot.params = def.gen(partRng(recipe, def.id), cast(def.id));
  }
}

// ---------------------------------------------------------------
// Build: for every part, for every bone it asks for, draw a canvas
// and hang it on a THREE.Group at that bone's position.
// ---------------------------------------------------------------
export function buildCharacter(recipe) {
  ensureParams(recipe);
  const Ps = Object.fromEntries(PARTS.map(d => [d.id, recipe.parts[d.id].params]));
  const F = buildLayout(recipe, Ps);

  const group = new THREE.Group();
  // Two sub-groups so the animator can act them separately: the HEAD
  // sways, cocks toward a glance and rides the breath; the BODY stays
  // planted on the floor. A part opts into the body with region:'body'.
  const headGroup = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup, headGroup);
  const entries = [];

  for (const def of PARTS) {
    const P = F.P[def.id];
    // a part can belong to a species: wings are for birds, and no
    // amount of dice-loading turns an arm into one
    if (def.species && !def.species.includes(recipe.species)) continue;
    if (def.skip?.(P, F)) continue;
    const pivot = def.pivot ?? [.5, .5];
    const [wU, hU] = def.size(P, F);

    for (const b of def.bones(P, F)) {
      const part = makePart({
        name: b.name, wU, hU, pivot,
        states: def.states ?? ['idle'],
        seed: `${recipe.seed}:${recipe.parts[def.id].rr || 0}`,
        draw: (sk, st) => {
          // Put the canvas origin where the part expects it: parts
          // draw in CHARACTER COORDINATES (px, y down, origin at the
          // centre of the head), so we translate the bone anchor onto
          // the plane's pivot and let the part draw absolute numbers.
          sk.ctx.save();
          sk.ctx.translate(pivot[0] * sk.w - b.x * U, (1 - pivot[1]) * sk.h + b.y * U);
          def.draw(sk, P, st, F, b);
          sk.ctx.restore();
        },
      });

      const order = b.order ?? def.order;
      part.mesh.renderOrder = order;
      part.mesh.position.z = order * .001;      // tie-break for the depth buffer
      part.mesh.userData.partId = def.id;

      const bone = new THREE.Group();
      bone.position.set(b.x, b.y, 0);
      bone.userData.base = { x: b.x, y: b.y };  // the animator moves off this
      bone.add(part.mesh);
      (def.region === 'body' ? bodyGroup : headGroup).add(bone);

      entries.push({
        id: def.id, def, bone, part,
        side: b.side ?? 1,
        depth: b.depth ?? def.depth ?? 0,
        region: def.region ?? 'head',
      });
    }
  }

  return {
    group, headGroup, bodyGroup, entries, F, recipe,
    byId: id => entries.filter(e => e.id === id),
    dispose() { entries.forEach(e => e.part.dispose()); },
  };
}
