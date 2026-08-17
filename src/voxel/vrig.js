// ---------------------------------------------------------------
// THE VOXEL RIG — recipe in, animatable solid out.
//
// Same contract as `src/rig.js`, and the same promise: the recipe is
// the ONLY state, so the same JSON gives the same character on any
// machine. What differs is what a part hands back — cells, not a
// canvas — and how those cells become meshes.
//
//   recipe = {
//     seed,                    // one integer; the whole character
//     species, base,           // casting and skeleton
//     palette,                 // what it is made of
//     parts: { [id]: { params, lock?, rr? } }
//   }
//
// TWO PASSES, and the first one is the interesting one:
//
//   1. Every part builds its RESTING cells in registry order into one
//      shared grid. Later parts overwrite earlier ones, so each cell
//      ends up owned by exactly one part. That single composite is
//      what makes the character a solid object rather than a stack of
//      separate models: face culling and ambient occlusion are then
//      computed against the WHOLE body, and a head welds to a torso.
//
//   2. Each part is meshed on its own, drawing only the cells it owns.
//      One mesh per part per state. Animating is flipping `visible`.
//
// THE PLATE RULE falls out of pass 1 and is the one thing an author of
// an animated part has to hold in their head: every state of a part
// must fill the SAME cells. Only colours may change. A state that
// leaves a cell out gets the resting colour back (so nothing can ever
// punch a hole in a head), and a state that reaches into a cell some
// later part owns is silently invisible — `audit()` reports both.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { makeRng, hashStr } from '../rng.js';
import { Carve, meshCells, unkey, hash3 } from './carve.js';
import { buildVoxelLayout } from './vlayout.js';
import { VPARTS, VPART_BY_ID } from './vparts/index.js';
import { vcastingFor, pickVBase } from './vspecies.js';

export { VPARTS };

// world units per voxel. Resolution only — every measurement in the
// generator is in whole voxels, so this scales a character without
// changing a single proportion.
export const VX = 1 / 16;

export function newVRecipe(seed = (Math.random() * 1e9) | 0) {
  return { seed, species: 'human', base: null, palette: 'graphite', parts: {} };
}

const partRng = (recipe, id) =>
  makeRng(hashStr(`${recipe.seed}:v:${id}:${recipe.parts[id]?.rr || 0}`));
const castFor = recipe => vcastingFor(recipe.species);

export function ensureVParams(recipe) {
  recipe.species ??= 'human';
  recipe.palette ??= 'graphite';
  recipe.base ||= pickVBase(recipe.species, makeRng(hashStr(`${recipe.seed}:vbase`)));
  const cast = castFor(recipe);
  for (const def of VPARTS) {
    const slot = recipe.parts[def.id] ??= {};
    slot.params ??= def.gen(partRng(recipe, def.id), cast(def.id));
  }
}

export function rerollVPart(recipe, id) {
  const slot = recipe.parts[id];
  slot.rr = (slot.rr || 0) + 1;
  slot.params = VPART_BY_ID[id].gen(partRng(recipe, id), castFor(recipe)(id));
}

export function regenVUnlocked(recipe, seed = recipe.seed) {
  recipe.seed = seed;
  const cast = castFor(recipe);
  for (const def of VPARTS) {
    const slot = recipe.parts[def.id] ??= {};
    if (slot.lock && slot.params) continue;
    slot.rr = 0;
    slot.params = def.gen(partRng(recipe, def.id), cast(def.id));
  }
}

const restOf = def => def.states?.[0] ?? 'idle';

/**
 * `lit: true` builds a character for a scene that has REAL lights: the
 * fixed face shading is left out of the vertex colours (it would fight
 * a lamp that moves) and the material becomes Lambert. Everything else
 * — the AO, the grain, the ownership pass — is identical.
 */
export function buildVoxelCharacter(recipe, { vx = VX, lit = false } = {}) {
  ensureVParams(recipe);
  const Ps = Object.fromEntries(VPARTS.map(d => [d.id, recipe.parts[d.id].params]));
  const V = buildVoxelLayout(recipe, Ps);

  const defs = VPARTS.filter(def =>
    !(def.species && !def.species.includes(recipe.species))
    && !(def.base && !def.base.includes(V.base))
    && !def.skip?.(Ps[def.id], V));

  // ---- pass 1: the composite -----------------------------------
  const occ = new Map();               // key -> { c, part, group }
  const rest = new Map();              // partId -> Map(key -> colour)
  for (const def of defs) {
    const v = new Carve(occ);
    def.build(v, Ps[def.id], restOf(def), V);
    rest.set(def.id, v.cells);
    const group = def.group ?? 'head';
    for (const [k, c] of v.cells) occ.set(k, { c, part: def.id, group });
  }

  // ---- pass 2: one mesh per part per state ---------------------
  const group = new THREE.Group();
  const headGroup = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup, headGroup);
  const hp = V.headPivot;
  headGroup.position.set(hp[0] * vx, hp[1] * vx, hp[2] * vx);

  const entries = [];
  const dropped = [];
  let tris = 0;

  for (const def of defs) {
    const P = Ps[def.id];
    const g = def.group ?? 'head';
    const pivot = g === 'head' ? hp : [0, 0, 0];
    const parent = g === 'head' ? headGroup : bodyGroup;
    const states = def.states ?? ['idle'];
    const restCells = rest.get(def.id);
    const meshes = {};
    const matl = lit
      ? new THREE.MeshLambertMaterial({ vertexColors: true })
      : new THREE.MeshBasicMaterial({ vertexColors: true });

    function cellsFor(st) {
      if (st === restOf(def)) return restCells;
      const v = new Carve(occ);
      def.build(v, P, st, V);
      // the safety net: a cell the state forgot keeps its resting
      // colour, so no state can leave a hole in the body
      const out = new Map(restCells);
      for (const [k, c] of v.cells) out.set(k, c);
      return out;
    }

    function ensure(st) {
      if (meshes[st]) return meshes[st];
      const all = cellsFor(st);
      const mine = new Map();
      for (const [k, c] of all) {
        const o = occ.get(k);
        if (!o || o.part === def.id) mine.set(k, c);
        // only a cell this state INVENTED counts as dropped — a resting
        // cell some later part owns was never this part's to draw
        else if (st !== restOf(def) && !restCells.has(k))
          dropped.push({ part: def.id, st, k, to: o.part });
      }
      // MOUNT ORDER — the cells are re-sorted bottom-up with a speckle
      // of jitter before meshing, so the triangle stream is ordered by
      // height and a scene can assemble a character voxel by voxel
      // with nothing more than geometry.setDrawRange (the crowd does).
      // Insertion order carried no meaning before, so this is free.
      const mountKey = k => { const [x, y, z] = unkey(k); return y + hash3(x, y, z, 13) * 4; };
      const ordered = new Map([...mine.entries()].sort((a, b) => mountKey(a[0]) - mountKey(b[0])));
      const geo = meshCells({ cells: ordered, occ, pivot, vx, shade: !lit });
      const mesh = new THREE.Mesh(geo, matl);
      mesh.userData.partId = def.id;
      // a lit character lives in a scene with real lights, and a real
      // light means real shadows — flag every mesh, including the ones
      // a blink builds lazily mid-play
      if (lit) mesh.castShadow = mesh.receiveShadow = true;
      mesh.visible = false;
      parent.add(mesh);
      tris += geo.userData.tris;
      return (meshes[st] = mesh);
    }

    const e = {
      id: def.id, def, group: g, matl, meshes, states,
      cur: restOf(def),
      cells: restCells,
      setState(st) {
        if (!states.includes(st) || e.cur === st) return;
        ensure(st).visible = true;
        if (meshes[e.cur]) meshes[e.cur].visible = false;
        e.cur = st;
      },
      ensure,
    };
    ensure(e.cur).visible = true;
    entries.push(e);
  }

  // ---- bounds, for framing a camera ----------------------------
  // A quad is long rather than tall and its mass sits behind the
  // origin, so a scene that framed on height alone would crop it and
  // spin it off-centre. Both extents and the z centroid are published.
  let minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9, maxR = 0;
  for (const k of occ.keys()) {
    const [x, y, z] = unkey(k);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y + 1);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    maxR = Math.max(maxR, Math.hypot(x, z));
  }

  return {
    group, headGroup, bodyGroup, entries, V, recipe, occ,
    byId: id => entries.find(e => e.id === id),
    stats: { voxels: occ.size, tris, parts: entries.length,
             height: maxY - minY, depth: maxZ - minZ + 1, cz: (minZ + maxZ) / 2,
             radius: maxR, vx },
    dropped,
    dispose() {
      for (const e of entries) {
        for (const st in e.meshes) { e.meshes[st].geometry.dispose(); e.meshes[st].removeFromParent(); }
        e.matl.dispose();
      }
    },
  };
}

// ---------------------------------------------------------------
// THE PLATE AUDIT — build every state of every part and report the
// cells that do not line up. Cheap, decidable, and the one bug class
// this design can still have. Call it from the console.
// ---------------------------------------------------------------
export function auditPlates(face) {
  const out = [];
  for (const e of face.entries) {
    if (e.states.length < 2) continue;
    const restKeys = new Set(e.cells.keys());
    for (const st of e.states) {
      e.ensure(st);
      const v = new Carve(face.occ);
      e.def.build(v, face.V.P[e.id], st, face.V);
      let missing = 0, extra = 0, stolen = 0;
      for (const k of restKeys) if (!v.cells.has(k)) missing++;
      for (const k of v.cells.keys()) {
        if (restKeys.has(k)) continue;
        extra++;
        const o = face.occ.get(k);
        if (o && o.part !== e.id) stolen++;
      }
      if (missing || extra) out.push({ part: e.id, state: st, missing, extra, stolen });
    }
  }
  return out;
}
