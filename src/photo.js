// ---------------------------------------------------------------
// THE PHOTO — a class portrait of the gloss nursery. One seed
// composes the whole shot: a packed crowd of molded characters on a
// studio floor (big anchors in the middle of the back, small ones
// spilling round the front), a few head-only ones floating overhead
// like weather, and plastic plants from the objects lab tucked
// between the feet.
//
// This is a SCENE, not a fifth generator: it grows nothing itself.
// It deals recipes to the two generators it borrows — the gloss rig
// and the plants rig — and only decides who stands where. The two
// labs still share no runtime with each other; they share this page
// the way they share the menu.
//
// It is also the one page with a POST STACK: a real floor and wall
// give the depth buffer something to hold, and N8AO shades the
// contacts — the soft occlusion a shelf render has and a plain
// forward pass cannot fake. The stack lives in `vendor/` and no
// generator knows it exists.
//
// One verb: reshoot. R deals a new photo; S saves the frame as a
// PNG; a drag orbits the shot. Every placement comes off the shot's
// own rng, so the same shot number is the same photo, faces and all.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { N8AOPass } from '../vendor/n8ao.js';
import { makeRng, hashStr } from './rng.js';
import { buildGloss, newGRecipe, ensureGParams } from './gloss/grig.js';
import { studioEnv, makeMaterialFactory } from './gloss/gmedia.js';
import { createGlossFace } from './gloss/gface.js';
import { buildPlant, newORecipe, ensureOParams } from './obj/orig.js';
import { plantStudio, makeMaterialFactory as makePlantFactory } from './obj/omedia.js';

const stage = document.getElementById('stage');
const countEl = document.getElementById('count');

// preserveDrawingBuffer so S can read the frame back as a PNG — the
// whole page is one still photograph, so the copy cost is the point
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const characterMat = makeMaterialFactory(studioEnv(renderer));
// the garden wears dead-matte only: the lab's glaze roll is a wet
// leaf under a macro lens, and next to the characters' pour it read as
// cheap plastic. Deeper roughness than the lab's matte, quieter env.
const plantMatBase = makePlantFactory(plantStudio(renderer));
const plantMat = (finish, color) => {
  const m = plantMatBase('matte', color);
  m.roughness = .92;
  m.envMapIntensity = .45;
  return m;
};

// ---- the studio -------------------------------------------------------
// The photo dresses its own set instead of borrowing the lab's: the
// labs stand things on a shadow-catcher over a painted gradient, but
// an AO pass can only shade what is IN the depth buffer — so this
// set is real geometry, a floor running into a back wall, the seam
// softened by the pass itself exactly like the reference's cyc.
{
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  scene.background = new THREE.Color('#d8d1c5');

  // the key stands camera-side and left, so every shadow falls
  // back-right into the gaps between sitters — hung overhead like the
  // lab's it pools UNDER each body, precisely where this camera
  // cannot see it
  const key = new THREE.DirectionalLight('#fff6e8', 1.35);
  key.position.set(-6, 9, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -11; key.shadow.camera.right = 11;
  key.shadow.camera.top = 11; key.shadow.camera.bottom = -11;
  key.shadow.camera.near = 3; key.shadow.camera.far = 50;
  key.shadow.radius = 10; key.shadow.blurSamples = 24; key.shadow.bias = -.0002;
  scene.add(key);
  scene.add(new THREE.HemisphereLight('#fff4e0', '#c3b6a2', .62));

  // floor and wall wear the SAME paint: a cyc corner disappears when
  // the only thing marking it is the AO gradient the pass draws there
  const setMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .96, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), setMat('#d5cec1'));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), setMat('#d5cec1'));
  wall.position.set(0, 20, -5.2);
  wall.receiveShadow = true;
  scene.add(wall);
}

const camera = new THREE.PerspectiveCamera(27, 1, .1, 100);

// ---- the post stack ---------------------------------------------------
const composer = new EffectComposer(renderer);
const aoPass = new N8AOPass(scene, camera, 8, 8);
aoPass.configuration.aoRadius = 1;
aoPass.configuration.intensity = 5;
aoPass.configuration.distanceFalloff = 1;
// N8AO gamma-corrects its output by default, and OutputPass converts
// to sRGB again on the way out — corrected twice, the whole photo
// went up like chalk dust. One conversion, at the end, only.
aoPass.configuration.gammaCorrection = false;
aoPass.setQualityMode('High');
composer.addPass(aoPass);
composer.addPass(new OutputPass());

// ---- the composition --------------------------------------------------
// The reference's grammar, verbatim: ONE giant dead centre, mediums
// on its shoulders, the smalls further out — a single line packed
// centre-out in strictly falling size — and where the line runs out
// of frame it FOLDS FORWARD, so the last small ones curl round the
// ends toward the camera. The tiny tier is its own loose front row
// across the whole width, and the garden fills whatever gaps remain.
const LINE_Z = -2.3;       // where the main line stands
const LINE_LIMIT = 4.4;    // half-width before the line folds forward
const PACK = 1.1;          // fraction of a half-width the next sitter keeps
                           // — a real gap: shoulders near, bodies never intersect

let shotSeed = (Math.random() * 1e9) | 0;
let actors = [];        // { kind, holder, built, life, ... }
let queue = [];         // build jobs, consumed on a time budget
let shell = null;       // the mass packer's state, rebuilt each shot

function clearShot() {
  for (const a of actors) {
    if (!a.holder) continue;
    scene.remove(a.holder);
    a.holder.traverse(o => o.geometry?.dispose());
  }
  actors = [];
  queue = [];
}

/** deal one photo. Everything — who, where, how big, which way the
 *  odd one leans — comes off this rng, so a shot number IS the shot. */
function compose(seed) {
  const rng = makeRng(hashStr(`photo:${seed}`));

  // the main line: one anchor giant, then mediums down to smalls in
  // strictly falling size, so the centre-out packer reproduces the
  // reference by construction — big one in the middle, mediums on
  // the sides, smaller ones more on the side
  const n = rng.ri(10, 12);
  const sizes = [rng.r(2.2, 2.6)];
  for (let i = 1; i < n; i++) {
    const t = (i - 1) / (n - 2);
    sizes.push((1.7 - t * .9) * rng.r(.92, 1.08));  // 1.7 down to .8
  }
  sizes.sort((a, b) => b - a);
  for (let i = 0; i < n; i++) {
    actors.push({
      kind: 'stand', recipe: newGRecipe(rng.ri(1, 1e9)),
      s: sizes[i],
      jx: rng.r(-.04, .04), jz: rng.r(-.1, .1),
      phase: rng.r(0, 20), rate: rng.r(.85, 1.2),
    });
  }

  // two LOOSE tiers in front of the line, both spread across the
  // whole width: the semi-tinies (half a medium — the missing rung
  // between the line and the pocket scale) and then plenty of
  // pocket-sized tinies. The staircase of scales is the shot.
  const nsemi = rng.ri(9, 11);
  for (let i = 0; i < nsemi; i++) {
    actors.push({
      kind: 'stand', recipe: newGRecipe(rng.ri(1, 1e9)),
      loose: true,
      x: (i - (nsemi - 1) / 2) * (8.6 / (nsemi - 1)) + rng.r(-.4, .4),
      s: rng.r(.5, .72),
      z: rng.r(-.7, -.1),
      phase: rng.r(0, 20), rate: rng.r(.85, 1.2),
    });
  }
  const ntiny = rng.ri(10, 12);
  for (let i = 0; i < ntiny; i++) {
    actors.push({
      kind: 'stand', recipe: newGRecipe(rng.ri(1, 1e9)),
      loose: true,
      x: (i - (ntiny - 1) / 2) * (8.8 / (ntiny - 1)) + rng.r(-.4, .4),
      s: rng.r(.26, .44),
      z: rng.r(.3, .9),
      phase: rng.r(0, 20), rate: rng.r(.85, 1.2),
    });
  }

  // the weather — grouped, with its own boundary checks: cluster
  // anchors are placed one after another and re-rolled until they
  // stand clear of each other, each with satellites on spread ring
  // angles (a cloud trailing its babies), plus a lone tiny one or two
  // drifting apart — the reference's stray stars.
  const anchors = [];
  const nc = rng.ri(2, 3);
  for (let c = 0; c < nc; c++) {
    let ax = 0, ay = 0, tries = 0;
    do {
      ax = rng.r(-3.4, 3.4);
      ay = rng.r(3.9, 5.2);
      // clear of each other AND of the pyramid's crown — a cloud
      // parked on the tallest ears reads as a hat nobody ordered
    } while (tries++ < 20 && (
      anchors.some(p => Math.hypot(p[0] - ax, p[1] - ay) < 2.6)
      || (Math.abs(ax) < 1.7 && ay < 4.7)));
    anchors.push([ax, ay]);
    const az = rng.r(-3.6, -1.8);
    const ns = rng.ri(1, 3);                      // satellites
    const th0 = rng.r(0, Math.PI * 2);
    for (let i = 0; i <= ns; i++) {
      const recipe = newGRecipe(rng.ri(1, 1e9));
      recipe.stance = 'none';
      if (rng.chance(.8)) recipe.body = 'sphere';
      const anchor = i === 0;
      // satellites share the ring but never the angle: even spread
      // plus jitter, so two babies cannot land on top of each other
      const th = th0 + (i / (ns + 1)) * Math.PI * 2 + rng.r(-.3, .3);
      const rr = anchor ? 0 : rng.r(.8, 1.3);
      actors.push({
        kind: 'float', recipe,
        x: ax + Math.cos(th) * rr,
        y: ay + (anchor ? 0 : Math.sin(th) * rr * .55),
        z: az + (anchor ? 0 : rng.r(-.4, .4)),
        s: anchor ? rng.r(.7, 1) : rng.r(.28, .5),
        phase: rng.r(0, 20), rate: rng.r(.85, 1.2),
        bob: rng.r(.05, .11), bobRate: rng.r(.5, .9),
      });
    }
  }
  const strays = rng.ri(1, 2);
  for (let i = 0; i < strays; i++) {
    const recipe = newGRecipe(rng.ri(1, 1e9));
    recipe.stance = 'none'; recipe.body = 'sphere';
    let sx = 0, sy2 = 0, tries = 0;
    do {
      sx = rng.r(-4, 4);
      sy2 = rng.r(3.8, 5.4);
    } while (tries++ < 20 && anchors.some(p => Math.hypot(p[0] - sx, p[1] - sy2) < 2.2));
    actors.push({
      kind: 'float', recipe, x: sx, y: sy2, z: rng.r(-3.4, -2),
      s: rng.r(.18, .3),
      phase: rng.r(0, 20), rate: rng.r(.85, 1.2),
      bob: rng.r(.06, .12), bobRate: rng.r(.6, 1),
    });
  }

  // the garden, at garden scale: TREES are big and stand BEHIND the
  // crowd like backdrop, framing it from the sides; grass, flowers
  // and houseplants are small and live at the very front. One
  // knee-high everything read as a shelf of samples, not a garden.
  const nt2 = rng.ri(1, 2);
  for (let i = 0; i < nt2; i++) {
    const recipe = newORecipe(rng.ri(1, 1e9));
    recipe.species = 'tree';
    actors.push({
      kind: 'plant', recipe,
      backdrop: true,                   // scenery — the relax pass leaves it be
      x: (i === 0 ? -1 : 1) * rng.r(2.8, 4.4) * (rng.chance(.5) ? 1 : -1),
      z: rng.r(-4.4, -3.6),
      ry: rng.r(0, Math.PI * 2),
      target: rng.r(2.7, 3.8),
    });
  }
  // plenty of grass, flowers and houseplants, filling the gaps: one
  // spread through the line's feet, another through the tiny row
  const np = rng.ri(8, 10);
  for (let i = 0; i < np; i++) {
    const recipe = newORecipe(rng.ri(1, 1e9));
    recipe.species = rng.pick(['grass', 'flower', 'plant', 'grass']);
    actors.push({
      kind: 'plant', recipe,
      x: (i - (np - 1) / 2) * (8.2 / Math.max(1, np - 1)) + rng.r(-.5, .5),
      z: (i % 2 ? rng.r(-1.4, -.4) : rng.r(.4, 1.5)),
      ry: rng.r(0, Math.PI * 2),
      target: rng.r(.14, .28),          // ankle-high: garnish, not furniture
    });
  }

  shell = { z: LINE_Z, limit: LINE_LIMIT, left: 0, right: 0, n: 0, foldL: null, foldR: null };
  queue = actors.slice();
}

/** the line packer. Called with each sitter's BUILT width, biggest
 *  first: the giant anchors x = 0, everyone after lands on whichever
 *  tracked edge keeps the line balanced. A sitter that would step
 *  outside the frame is pulled back to the boundary and pushed
 *  FORWARD instead — the line folds round its own ends, which is
 *  where the reference keeps its outermost smalls. */
function packMass(a, w) {
  const half = w / 2 * PACK;
  let x = shell.n === 0 ? 0
    : shell.right <= -shell.left ? shell.right + half
    : shell.left - half;
  const over = Math.abs(x) + w / 2 - shell.limit;
  if (shell.n > 0 && over > 0) {
    // that side of the line is FULL. The sitter folds forward into
    // its own band and marches INWARD, packed against whoever folded
    // before it — pulled back onto the boundary it collided with the
    // sitter already standing there, and a second fold landed on the
    // first. The main edge is pinned at the limit so the balance
    // check sends the next one to the other side.
    if (x > 0) {
      x = (shell.foldR ?? shell.limit + .35) - half;
      shell.foldR = x - half;
      shell.right = shell.limit;
    } else {
      x = (shell.foldL ?? -(shell.limit + .35)) + half;
      shell.foldL = x + half;
      shell.left = -shell.limit;
    }
    a.z = shell.z + 1.35 + a.jz;
    shell.n++;
    return x + a.jx;
  }
  a.z = shell.z + (shell.n % 2 ? 0 : .45) + a.jz;   // stagger: overlaps occlude, not merge
  if (shell.n === 0) { shell.left = x - half; shell.right = x + half; }
  else if (x > 0) shell.right = Math.max(shell.right, x + half);
  else shell.left = Math.min(shell.left, x - half);
  shell.n++;
  return x + a.jx;
}

/** place a LOOSE sitter properly: it is built, so its footprint is
 *  known — start from the slot it was dealt and slide sideways in
 *  growing steps (then allow a small z give) until the footprint
 *  clears everyone already standing. The dealt slot keeps the row
 *  even; the search keeps it honest. Deterministic: fixed candidate
 *  order, fixed build order. */
function findSpot(a) {
  const placed = actors.filter(o => o !== a && o.holder && o.kind !== 'float' && !o.backdrop && o.r);
  const free = (x, z) =>
    placed.every(o => Math.hypot(o.x - x, o.z - z) >= (o.r + a.r) * .92);
  for (const dz of [0, .25, -.25, .5, -.5]) {
    for (let k = 0; k <= 26; k++) {
      const dx = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * .18;
      const x = a.x + dx, z = a.z + dz;
      if (Math.abs(x) > 4.9) continue;
      if (free(x, z)) { a.x = x; a.z = z; return; }
    }
  }
  // nowhere free nearby — leave it on its slot; the relax pass is
  // the safety net for exactly this
}

function buildActor(a) {
  const holder = new THREE.Group();

  if (a.kind === 'plant') {
    ensureOParams(a.recipe);
    const built = buildPlant(a.recipe, { materialFor: plantMat });
    const s = a.target / Math.max(.5, built.bounds.h);
    holder.add(built.group);
    holder.scale.setScalar(s);
    holder.rotation.y = a.ry;
    a.built = built; a.s = s;
    a.r = built.bounds.w * s / 2;
    if (!a.backdrop) findSpot(a);
    holder.position.set(a.x, 0, a.z);
  } else {
    ensureGParams(a.recipe);
    const built = buildGloss(a.recipe, { materialFor: characterMat });
    const b = built.bounds;
    holder.add(built.group);
    if (a.kind === 'float') {
      // pivot a floater about its middle so the bob is a hover — and
      // it casts NOTHING: its shadow can only land halfway up the
      // wall, a grey stain attached to nobody
      built.group.position.y = -b.cy;
      holder.position.set(a.x, a.y, a.z);
      built.group.traverse(m => { if (m.isMesh) m.castShadow = false; });
    } else {
      // feet on the floor, packed against the neighbours already built
      // (the tiny front row stays loose — small enough to stand anywhere)
      built.group.position.y = -b.minY;
      a.r = b.w * a.s / 2;
      if (a.loose) findSpot(a);
      else a.x = packMass(a, b.w * a.s);
      holder.position.set(a.x, 0, a.z);
      // the outer sitters turn a few degrees in toward the middle —
      // a class photo huddles, a line-up faces front
      holder.rotation.y = -a.x * .05;
    }
    holder.scale.setScalar(a.s);
    // neighbours shade each other: whatever casts also receives, so a
    // small one standing in a big one's shadow sits IN the scene
    // instead of pasted onto it
    built.group.traverse(m => { if (m.isMesh && m.castShadow) m.receiveShadow = true; });
    a.built = built;
    a.life = createGlossFace(built, { gaze: true });
  }

  a.holder = holder;
  scene.add(holder);
  hud();
}

// ---- the relax pass ---------------------------------------------------
// Runs ONCE, after the whole cast is built: every grounded sitter
// gets a footprint circle from the bounds it actually built, and
// overlapping pairs are pushed apart over a few dozen iterations —
// the smaller one yields (weight ∝ r²), so the giants hold the
// composition and the tinies scoot. The packer gets the shot close;
// this pass takes out the last collisions, which is what lets the
// cast grow without the tiers eating each other. Deterministic: same
// positions and radii in, same nudges out.
function relax() {
  const ground = actors.filter(a => a.holder && a.kind !== 'float' && !a.backdrop);
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < ground.length; i++) {
      for (let j = i + 1; j < ground.length; j++) {
        const A = ground[i], B = ground[j];
        // .92 of the summed radii: the radii carry ears and hair, so
        // true tangency (1.0) reads as a queue at the post office —
        // but .82 let two round BODIES share a visible slice of each
        // other, which is the collapse it exists to prevent
        const want = (A.r + B.r) * .92;
        let dx = B.x - A.x, dz = B.z - A.z;
        let d = Math.hypot(dx, dz);
        if (d >= want) continue;
        if (d < 1e-4) { dx = 0; dz = 1; d = 1; }
        const wa = B.r * B.r / (A.r * A.r + B.r * B.r);
        const push = want - d;
        dx /= d; dz /= d;
        A.x -= dx * push * wa; A.z -= dz * push * wa;
        B.x += dx * push * (1 - wa); B.z += dz * push * (1 - wa);
        moved = true;
      }
    }
    // clamp INSIDE the loop: clamped after it, a sitter shoved out
    // of frame lands back on its neighbour with no rounds left to
    // re-settle, and the overlap survives the pass
    for (const a of ground) {
      a.x = Math.max(-4.9, Math.min(4.9, a.x));
      a.z = Math.max(-4.4, Math.min(1.8, a.z));
    }
    if (!moved) break;
  }
  for (const a of ground) {
    a.holder.position.x = a.x;
    a.holder.position.z = a.z;
  }
  // the weather too, in its own plane — a satellite dealt onto its
  // neighbour drifts off it
  const fl = actors.filter(a => a.holder && a.kind === 'float');
  for (let it = 0; it < 40; it++) {
    let moved = false;
    for (let i = 0; i < fl.length; i++) {
      for (let j = i + 1; j < fl.length; j++) {
        const A = fl[i], B = fl[j];
        const want = (A.s + B.s) * .72;
        let dx = B.x - A.x, dy = B.y - A.y;
        let d = Math.hypot(dx, dy);
        if (d >= want) continue;
        if (d < 1e-4) { dx = 0; dy = 1; d = 1; }
        const wa = B.s * B.s / (A.s * A.s + B.s * B.s);
        const push = want - d;
        dx /= d; dy /= d;
        A.x -= dx * push * wa; A.y -= dy * push * wa;
        B.x += dx * push * (1 - wa); B.y += dy * push * (1 - wa);
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const a of fl) {
    a.y = Math.max(3.2, Math.min(5.6, a.y));
    a.holder.position.x = a.x;      // y is written every frame by the bob
  }
}

function reshoot(seed = (Math.random() * 1e9) | 0) {
  shotSeed = seed;
  clearShot();
  compose(seed);
  hud();
}

function hud() {
  if (!countEl) return;
  const made = actors.filter(a => a.holder);
  countEl.textContent = made.length < actors.length
    ? `developing… ${made.length}/${actors.length}`
    : `shot ${shotSeed} · ${actors.length} sitters · ${made.reduce((n, a) => n + (a.built?.stats.verts ?? 0), 0).toLocaleString()} verts`;
}

// ---- the director -----------------------------------------------------
// same idea as the gloss sheet's: hand out feelings, rarely, so a
// face that changes is worth catching
const MOODS = ['happy', 'happy', 'surprised', 'angry', 'sad'];
let nextMood = 1.6;
const rnd = (a, b) => a + Math.random() * (b - a);

function direct(t) {
  if (t < nextMood) return;
  nextMood = t + rnd(.5, 1.8);
  const idle = actors.filter(a => a.life && a.life.face() === 'idle');
  if (!idle.length) return;
  const a = idle[(Math.random() * idle.length) | 0];
  a.life.setFace(MOODS[(Math.random() * MOODS.length) | 0]);
  a.faceUntil = t + rnd(1.3, 3);
}

function animate(a, t, dt) {
  if (!a.life) return;
  if (a.faceUntil && t > a.faceUntil) { a.life.setFace('idle'); a.faceUntil = 0; }

  const own = t * a.rate + a.phase;
  const head = a.life.update(own, dt);
  const hd = a.built.head;
  hd.position.set(head.x, hd.userData.restY + head.y, 0);
  hd.rotation.set(head.pitch, head.yaw, head.rot);

  // breath — volume-preserving, and about the FEET, so a stander
  // swells in place instead of lifting off the floor
  const sy = 1 + Math.sin(own * 1.8) * .008;
  a.holder.scale.set(a.s / Math.sqrt(sy), a.s * sy, a.s / Math.sqrt(sy));

  if (a.kind === 'float')
    a.holder.position.y = a.y + Math.sin(own * a.bobRate) * a.bob;
}

// ---- the camera -------------------------------------------------------
// The photo opens on the shot, but it is a set, not a print: a drag
// orbits it (clamped — the backs of their heads are nobody's photo)
// and a wheel leans in.
// az/el = orbit angles, zoom = lean in/out, ty = the HEIGHT of the
// point the camera orbits — el tilts the shot, ty lifts the whole
// camera (and its framing) without changing the tilt
// Alberto's numbers, read off the corner readout — this IS the shot
const view = { az: 0, el: .2, zoom: 1.18, ty: 2.65 };
let baseDist = 14;
const TARGET = new THREE.Vector3(0, 1.7, 0);

const camEl = document.getElementById('cam');
let camShown = '';

function place() {
  TARGET.y = view.ty;
  const d = baseDist * view.zoom, ce = Math.cos(view.el);
  camera.position.set(
    TARGET.x + Math.sin(view.az) * ce * d,
    TARGET.y + Math.sin(view.el) * d,
    TARGET.z + Math.cos(view.az) * ce * d);
  camera.lookAt(TARGET);
  // the readout: drag to the shot you want, read the numbers off the
  // corner, and those three numbers ARE the camera — hand them to
  // `view` (or __photo.setView) and the opening shot is yours
  if (camEl) {
    const s = `az ${view.az.toFixed(2)} · el ${view.el.toFixed(2)} · zoom ${view.zoom.toFixed(2)} · ty ${view.ty.toFixed(2)}`
      + ` · pos ${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;
    if (s !== camShown) { camEl.textContent = s; camShown = s; }
  }
}

function fit() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const aspect = w / Math.max(1, h);
  const tanV = Math.tan(camera.fov * Math.PI / 360);
  baseDist = Math.max(2.9 / tanV, 4.6 / (tanV * aspect)) + 1.5;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
addEventListener('resize', fit);

let drag = null;
stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => {
  if (!drag) return;
  if (e.shiftKey) {
    // shift+drag = altitude: slide the whole camera (and what it
    // frames) up and down, tilt untouched
    view.ty = Math.max(0, Math.min(4.5, view.ty + (e.clientY - drag.y) * .01));
  } else {
    view.az = Math.max(-.6, Math.min(.6, view.az - (e.clientX - drag.x) * .004));
    view.el = Math.max(.02, Math.min(.5, view.el + (e.clientY - drag.y) * .003));
  }
  drag = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => { drag = null; });
stage.addEventListener('wheel', e => {
  e.preventDefault();
  view.zoom = Math.max(.55, Math.min(1.6, view.zoom * (1 + e.deltaY * .001)));
}, { passive: false });

// ---- save -------------------------------------------------------------
function save() {
  frame(performance.now());
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `photo-${shotSeed}.png`;
  a.click();
}

document.getElementById('again')?.addEventListener('click', () => reshoot());
document.getElementById('save')?.addEventListener('click', save);
addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (e.key === 'r' || e.key === 'R') reshoot();
  if (e.key === 's' || e.key === 'S') save();
  if (e.key === ' ') { Object.assign(view, { az: 0, el: .2, zoom: 1.18, ty: 2.65 }); e.preventDefault(); }
});

// ---- loop -------------------------------------------------------------
// capped at 30, clock-driven — same bargain as the gloss sheet
const MIN_FRAME_MS = 1000 / 30;
let last = performance.now();

function frame(now = performance.now()) {
  const t = now / 1000, dt = Math.max(0, Math.min(.1, (now - last) / 1000));
  last = now;

  if (queue.length) {
    const until = performance.now() + 8;
    do { buildActor(queue.shift()); } while (queue.length && performance.now() < until);
    if (!queue.length) relax();      // the cast is complete — settle it
  }

  direct(t);
  for (const a of actors) if (a.holder) animate(a, t, dt);
  place();
  composer.render();
}

let lastDraw = -1e9;
function loop() {
  const now = performance.now();
  if (now - lastDraw < MIN_FRAME_MS - .5) return;
  lastDraw = now;
  frame(now);
}

reshoot();
fit();
renderer.setAnimationLoop(loop);

// the decidable half — see CLAUDE.md
const yieldNow = () => new Promise(res => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => res();
  ch.port2.postMessage(0);
});

window.__photo = {
  frame, camera, scene, renderer, view, aoPass,
  get seed() { return shotSeed; },
  get actors() { return actors; },
  reshoot,
  setView(az, el, zoom, ty = view.ty) { Object.assign(view, { az, el, zoom, ty }); },
  async pump(n = 60, step = 16) {
    renderer.setAnimationLoop(null);
    for (let i = 0; i < n; i++) { frame(last + step); await yieldNow(); }
    renderer.setAnimationLoop(loop);
  },
  stats: () => ({
    seed: shotSeed,
    built: actors.filter(a => a.holder).length, queued: queue.length,
    kinds: actors.reduce((m, a) => (m[a.kind] = (m[a.kind] || 0) + 1, m), {}),
    verts: actors.reduce((n, a) => n + (a.built?.stats.verts ?? 0), 0),
    xs: actors.filter(a => a.kind === 'stand').map(a => +a.x.toFixed(2)),
  }),
};
