// ---------------------------------------------------------------
// THE RIG — recipe in, toy out, and the recipe is the ONLY state, so
// the same JSON gives the same toy on any machine.
//
//   recipe = {
//     seed,                       // one integer; the whole toy
//     body,                       // which shape (one for now: sphere)
//     palette, colorIx,           // which five colours, and which of them
//     material,                   // one of `MATERIAL_IDS`
//     parts: { [id]: { params, rr? } }
//   }
//
// Every part gen()s its params, the layout measures once, each part
// pushes SPECS, and this file stamps them. A part never touches
// three.js and never builds a material — it names a colour from the
// layout and a shape from the catalogue.
//
// The face comes back as a map of meshes (`eyeL`, `mouth`, …) and that
// map is the animation surface: a blink is `eyeL.scale.y`, a glance is
// a nudge in x, and neither costs a rebuild. That is the whole reason
// the features are separate objects instead of one welded model.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { makeRng, hashStr } from '../rng.js';
import { plateGeometry, solidGeometry, skullGeometry, decalGeometry, basisAt } from './gshape.js';
// the printed half of the hand — see gdecal.js for why one exists
import { decalCanvas } from './gdecal.js';
import { buildGlossLayout } from './glayout.js';
import { GPARTS, GPART_BY_ID } from './gparts/index.js';
import { PALETTES, PALETTE_BY_ID, PALETTE_DEAL_IDS, INK, SCLERA, MAW, tint, luma } from './gpalette.js';
import { MATERIAL_WEIGHTS } from './gmedia.js';
import { gcastingFor, pickGBody, GSPECIES, GSPECIES_WEIGHTS } from './gspecies.js';

export { GPARTS, GPART_BY_ID };

export const BODY_IDS = ['sphere', 'cube'];

export function newGRecipe(seed = (Math.random() * 1e9) | 0) {
  return { seed, species: null, body: null, palette: null, colorIx: null,
           material: null, parts: {} };
}

// a WEIGHTED pick, because "how often" is most of the art direction
// here: brows are anecdotal, noses are a quarter of the shelf, chrome
// is once a sheet, and a uniform pick over a table cannot say any of
// it. It lives out here rather than on `partRng` because the CAST rng
// needs it too — a finish is dealt by frequency the same as a style.
// Costs exactly one draw, so it can replace a `pick` without shifting
// anything downstream of it in the stream.
const wpick = (rng, pairs) => {
  let total = 0; for (const p of pairs) total += p[1];
  let x = rng.r(0, total);
  for (const p of pairs) if ((x -= p[1]) < 0) return p[0];
  return pairs[pairs.length - 1][0];
};

const partRng = (recipe, id) => {
  const rng = makeRng(hashStr(`${recipe.seed}:g:${id}:${recipe.parts[id]?.rr || 0}`));
  rng.wpick = pairs => wpick(rng, pairs);
  return rng;
};

/** fills in anything the recipe has not already been TOLD. Every field
 *  uses ??=, which is what lets the crowd's filters pin one dimension
 *  and let the rest roll. */
export function ensureGParams(recipe) {
  const rng = makeRng(hashStr(`${recipe.seed}:gcast`));
  // the species FIRST: it loads the dice for everything after it —
  // the body form it prefers, and every part's own rolls
  recipe.species ??= wpick(rng, GSPECIES_WEIGHTS);
  recipe.body ??= pickGBody(recipe.species, rng, BODY_IDS);
  // A species may NAME a palette and a material, and exactly one does.
  // The standing rule is that it must not — what a toy is made of is a
  // separate lever, and a lavender panda is still a panda. The
  // humanoid is the exception the rule was waiting for: it is made of
  // SKIN, and a chrome one is not a humanoid in another finish, it is
  // a different object. Everyone else still leaves both alone, and a
  // pinned filter still wins over either (the ??= runs first).
  const SP = GSPECIES[recipe.species];
  recipe.palette ??= SP?.palette ?? rng.pick(PALETTE_DEAL_IDS);
  recipe.material ??= SP?.material ?? wpick(rng, MATERIAL_WEIGHTS);
  recipe.colorIx ??= rng.ri(0, PALETTE_BY_ID[recipe.palette].colors.length - 1);

  const C = gcastingFor(recipe.species);
  for (const part of GPARTS) {
    recipe.parts[part.id] ??= {};
    recipe.parts[part.id].params ??= part.gen(partRng(recipe, part.id), C(part.id));
  }
  return recipe;
}

export function rerollGPart(recipe, id) {
  const slot = recipe.parts[id];
  if (!slot) return;
  slot.rr = (slot.rr || 0) + 1;
  slot.params = null;
  ensureGParams(recipe);
}

/** the four colours every part draws from, all off the one palette. */
function colorsFor(recipe) {
  const pal = PALETTE_BY_ID[recipe.palette] ?? PALETTES[0];
  const body = pal.colors[recipe.colorIx % pal.colors.length];

  // The warm bits (cheeks) take ANOTHER colour from the same five, and
  // it has to be the WARMEST one — not, as it was, the one furthest in
  // lightness. Furthest-in-lightness picked the blue out of a pale
  // palette often enough that cheeks came out cold, which does not read
  // as a blush at all: it reads as tears. Score by how far toward red
  // a colour sits, and break ties on contrast against the body so it
  // still shows up.
  const warmth = hex => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16 & 255) - (n & 255)) / 255;
  };
  let warm = body, best = -Infinity;
  for (const c of pal.colors) {
    if (c === body) continue;
    const score = warmth(c) * 2 + Math.abs(luma(c) - luma(body)) * .5;
    if (score > best) { best = score; warm = c; }
  }
  return { body, warm, ink: INK, sclera: SCLERA, maw: MAW, lite: tint(body, .55) };
}

/**
 * recipe → { group, face, P, L, stats }.
 * `face` maps a feature id to its mesh.
 */
export function buildGloss(recipe, { materialFor } = {}) {
  ensureGParams(recipe);
  const P = Object.fromEntries(GPARTS.map(p => [p.id, recipe.parts[p.id].params]));
  const L = buildGlossLayout(P, colorsFor(recipe), recipe.body);
  const finish = recipe.material;

  const t0 = performance.now();
  const specs = [];
  const add = s => specs.push(s);
  for (const part of GPARTS) part.build(add, P, L);

  const group = new THREE.Group();
  const face = {};
  let verts = 0;

  for (const spec of specs) {
    // the exponent travels as `exp`, NEVER `n`: a placed solid also
    // carries its surface normal as `n`, and the two silently collide
    // in the spec literal — an array reaches Math.pow and every vertex
    // goes NaN. It happened; the key is different so it cannot again.
    // `mesh` is arrays built elsewhere and stamped here — the skull
    // (gskull.js) and the hair (ghair.js). `skull` is the old name for
    // it and still works.
    const geo = spec.type === 'mesh' || spec.type === 'skull'
      ? skullGeometry(spec.mesh ?? spec.skull)
      : spec.type === 'solid'
      ? solidGeometry(spec.rx, spec.ry, spec.rz, spec.exp ?? 2, spec.dome)
      : spec.type === 'decal'
      ? decalGeometry(spec.w, spec.h, spec.bend)
      : plateGeometry(spec);
    // The SHELL is the body and nothing else. Everything else is a
    // feature set into it, and takes whatever `gmedia.js` says a
    // feature may wear — nobody knits an eye, and a plate's UVs could
    // not carry a stitch even if somebody did.
    const shell = spec.id === 'body';
    // A spec may NAME its finish. Hair is the only thing that does, and
    // it has to: a wool humanoid is a knitted head, not a knitted
    // haircut, and hair reading as the same pour as the face loses the
    // one edge that separates them at sheet scale.
    // A DECAL brings its own artwork instead of a colour. The spec is
    // plain JSON by rule (gdecal.js), so it is also the cache key.
    const mat = spec.type === 'decal'
      ? materialFor.decal(JSON.stringify(spec.art), () => decalCanvas(spec.art))
      : materialFor(spec.finish ?? finish, spec.color, shell);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = spec.id;

    if (spec.pos) {
      mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    } else {
      const b = basisAt(spec.p, spec.n, spec.proud ?? 0, spec.roll ?? 0);
      mesh.position.copy(b.position);
      mesh.quaternion.copy(b.quaternion);
      // an offset is in the FEATURE's own plane, not the world's — so a
      // catchlight stays up-and-left of its eye however the eye is
      // tilted or wherever on the head it landed
      if (spec.offset) { mesh.translateX(spec.offset[0]); mesh.translateY(spec.offset[1]); }
    }

    // Only the body casts, and whatever ASKS to. A face feature lies
    // flush against a body that is already casting, and the key's blur
    // would smear its shadow back across the very face it sits on —
    // but hair is a real volume standing off the head, and hair that
    // casts nothing reads as paint.
    mesh.castShadow = spec.id === 'body' || !!spec.cast;
    mesh.userData.shut = !!spec.shut;
    // how far this feature may slide when the toy looks somewhere, in
    // its own plane. A pupil gets most of its white; a white eye gets
    // almost nothing. Absent means "use the default for a whole eye".
    if (spec.travel) mesh.userData.travel = spec.travel;
    // how far a lid slides DOWN as the eye closes
    if (spec.lidDrop) mesh.userData.lidDrop = spec.lidDrop;
    // or how far it ROLLS — the ball eye's hemisphere cap pivots about
    // the ball's centre instead of sliding, in radians
    if (spec.lidRoll) mesh.userData.lidRoll = spec.lidRoll;
    // where a pupil parks in its white. The blink pulls it back to
    // centre, because the white squashes about the EYE's middle and a
    // pupil left up at the top would be squashed about its own and
    // slide straight out of the closing lid.
    if (spec.anchorY) mesh.userData.anchorY = spec.anchorY;

    group.add(mesh);
    if (spec.id !== 'body') face[spec.id] = mesh;
    verts += geo.attributes.position.count;
  }

  // WHAT WAS ACTUALLY BUILT. `L.H` is the BODY's height and nothing
  // else, so a page that fits a toy by it is fitting the head and
  // ignoring whatever is standing on top of it — a bunny came out 1.76×
  // taller than its cell believed and grew into the row above. Ears,
  // horns and a dropped maw all live out here, and every one of them
  // is inside these bounds.
  const box = new THREE.Box3();
  for (const child of group.children) {
    child.updateMatrix();
    child.geometry.computeBoundingBox();
    box.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrix));
  }
  const bounds = {
    w: box.max.x - box.min.x, h: box.max.y - box.min.y,
    cy: (box.min.y + box.max.y) / 2,     // the toy's real middle, not the head's
    minY: box.min.y, maxY: box.max.y,
  };

  return {
    group, face, P, L, bounds,
    stats: { buildMs: Math.round(performance.now() - t0), verts, meshes: specs.length },
  };
}
