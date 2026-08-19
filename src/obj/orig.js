// --------------------------------------------------------------
// THE RIG — recipe in, plant out, and the recipe is the ONLY state,
// so the same JSON gives the same plant on any machine.
//
//   recipe = {
//     seed, species, palette, material,
//     parts: { mound, stem, leaves, bloom } // each { params }
//   }
//
// Every part gen()s its params (biased by the species), the layout
// measures once, every part pushes SPECS, and this file stamps them
// into meshes with the media factory. A part never touches three.js
// and never builds a material — it names a shape from the hand and
// a colour role from the layout, exactly like the gloss contract.
// --------------------------------------------------------------
import * as THREE from 'three';
import { makeRng, hashStr } from '../rng.js';
import { buildSpec } from './oshape.js';
import { buildPlantLayout } from './olayout.js';
import { OPARTS, OPART_BY_ID } from './oparts/index.js';
import { OPALETTES, resolveRoles } from './opalette.js';
import { OSPECIES, OSPECIES_IDS, ocastingFor } from './ospecies.js';
import { FINISH_WEIGHTS } from './omedia.js';

export { OPARTS, OPART_BY_ID };
export { OSPECIES_IDS };

const wpick = (rng, pairs) => {
  let total = 0; for (const p of pairs) total += p[1];
  let x = rng.r(0, total);
  for (const p of pairs) if ((x -= p[1]) < 0) return p[0];
  return pairs[pairs.length - 1][0];
};

const partRng = (recipe, id) => {
  const rng = makeRng(hashStr(`${recipe.seed}:o:${id}:${recipe.parts[id].rr || 0}`));
  rng.wpick = pairs => wpick(rng, pairs);
  return rng;
};

export function newORecipe(seed = (Math.random() * 1e9) | 0) {
  return { seed, species: null, palette: null, material: null, parts: {} };
}

/** fills in anything the recipe has not already been TOLD. The
 *  species first (it loads the dice), then the palette and the
 *  finish, then every part's params. `??=` in every field is what
 *  lets a caller pin one dimension and roll the rest. */
export function ensureOParams(recipe) {
  const rng = makeRng(hashStr(`${recipe.seed}:ocast`));
  // the gardener's four carry the shelf; the wildcard is the free
  // roll — every part keeps its own dice, so the odd bush happens
  recipe.species ??= wpick(rng, OSPECIES_IDS.map(id => [id, id === 'wildcard' ? 16 : 21]));
  recipe.palette ??= rng.pick(OPALETTES.map(p => p.id));
  recipe.material ??= wpick(rng, FINISH_WEIGHTS);
  const C = ocastingFor(recipe.species);
  for (const part of OPARTS) {
    recipe.parts[part.id] ??= {};
    recipe.parts[part.id].params ??= part.gen(partRng(recipe, part.id), C(part.id));
  }
  return recipe;
}

export function rerollOPart(recipe, id) {
  const slot = recipe.parts[id];
  if (!slot) return;
  slot.rr = (slot.rr || 0) + 1;
  slot.params = null;
  ensureOParams(recipe);
}

/**
 * recipe → { group, P, L, bounds, stats }.
 * `P` is the flat param map the layout reads; `L` carries the
 * anchors (rootY / crownY / leaf unit) and the resolved colours.
 */
export function buildPlant(recipe, { materialFor } = {}) {
  ensureOParams(recipe);
  const P = Object.fromEntries(OPARTS.map(p => [p.id, recipe.parts[p.id].params]));
  const C = resolveRoles(recipe);
  const L = buildPlantLayout(P, C);

  const t0 = performance.now();
  const specs = [];
  const add = s => specs.push(s);
  const P0 = P; // flat map, for parts that want a neighbour
  for (const part of OPARTS)
    part.build(add, recipe.parts[part.id].params, L, C, P0);

  const group = new THREE.Group();
  let verts = 0;
  for (const spec of specs) {
    const geo = buildSpec(spec);
    const mat = materialFor ? materialFor(spec.finish ?? recipe.material, spec.color) : null;
    const mesh = new THREE.Mesh(geo, mat);
    if (spec.pos) mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    if (spec.rot) mesh.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    // everything casts and receives: the studio hangs a soft key with
    // a shadow map, and a plant that throws nothing onto its own soil
    // floats off the floor it grew from
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    verts += geo.attributes.position.count;
  }

  // WHAT WAS ACTUALLY GROWN — the whole plant's bounds, for the
  // page camera; neither the layout nor a part can know this
  const box = new THREE.Box3();
  for (const child of group.children) {
    child.updateMatrix();
    child.geometry.computeBoundingBox();
    box.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrix));
  }
  const bounds = {
    w: box.max.x - box.min.x, h: Math.max(0, box.max.y),
    cy: (box.min.y + box.max.y) / 2,
    minY: box.min.y, maxY: box.max.y,
  };

  return {
    group, P, L, bounds,
    recipe,
    stats: { buildMs: Math.round(performance.now() - t0), verts, meshes: specs.length },
  };
}