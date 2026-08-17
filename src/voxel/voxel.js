// drawai — the voxel lab. One character on a paper floor, an orbiting
// orthographic camera, and the panel that owns the recipe.
//
// Ortho on purpose: voxel art wants parallel edges, and it is the same
// camera every other scene here uses. The turntable is the point of
// the page — a solid is the one thing the drawn generator cannot show
// you from behind.
import * as THREE from 'three';
import { newVRecipe, buildVoxelCharacter, rerollVPart, regenVUnlocked, ensureVParams, auditPlates, VX } from './vrig.js';
import { VSPECIES_IDS } from './vspecies.js';
import { PALETTE_IDS } from './vpalette.js';
import { createVoxelAnimator } from './vanim.js';
import { Carve, meshCells } from './carve.js';
import { initVUI } from './vui.js';

THREE.ColorManagement.enabled = false;

const PAPER = 0xf6f1e5, PAPER2 = 0xe7e0cd, PAPER3 = 0xded6c0;
const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
stage.appendChild(renderer.domElement);

// ---- camera: az/el orbit around a point over the floor -----------
const view = { az: .55, el: .42, halfH: 1.3, targetY: .9 };
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 200);

function place() {
  const r = 40;
  const ce = Math.cos(view.el);
  camera.position.set(Math.sin(view.az) * ce * r, Math.sin(view.el) * r + view.targetY, Math.cos(view.az) * ce * r);
  camera.lookAt(0, view.targetY, 0);
}
function onResize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const aspect = w / h;
  camera.top = view.halfH; camera.bottom = -view.halfH;
  camera.left = -view.halfH * aspect; camera.right = view.halfH * aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
addEventListener('resize', onResize);

// ---- the floor is voxels too, or the scale of everything is a lie -
{
  const v = new Carve();
  const R = 22;
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const t = v.h01(x, 0, z, 3);
      // a rounded plate, so the world does not end in a square
      if (Math.hypot(x, z) > R) continue;
      v.set(x, -1, z, t < .12 ? PAPER3 : PAPER2);
    }
  const occ = new Map();
  for (const [k] of v.cells) occ.set(k, {});
  const geo = meshCells({ cells: v.cells, occ, pivot: [0, 0, 0], vx: VX });
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true })));
}

// a soft blob under the feet: the one thing that is not a voxel, and
// only because a stair-stepped shadow reads as a mistake
const shadow = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d').createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(60,54,42,.34)');
  g.addColorStop(.6, 'rgba(60,54,42,.13)');
  g.addColorStop(1, 'rgba(60,54,42,0)');
  const ctx = c.getContext('2d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = .002;
  scene.add(m);
  return m;
})();

// ---- app state ---------------------------------------------------
const recipe = newVRecipe();
recipe.species = VSPECIES_IDS[(Math.random() * VSPECIES_IDS.length) | 0];
recipe.palette = PALETTE_IDS[(Math.random() * PALETTE_IDS.length) | 0];
ensureVParams(recipe);

let face = null;
const anim = { breath: true, sway: true, blink: true, gaze: true, talk: false, amp: 1 };
const animator = createVoxelAnimator(() => face, anim);
let turntable = true;
let buildMs = 0;

let queued = false;
function rebuild() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    const t0 = performance.now();
    if (face) { scene.remove(face.group); face.dispose(); }
    face = buildVoxelCharacter(app.recipe());
    scene.add(face.group);
    buildMs = performance.now() - t0;
    const s = face.stats;
    // centre the model on the turntable axis: a quad's mass is all
    // behind the origin and would otherwise swing around off-frame
    face.group.position.z = -s.cz * VX;
    shadow.position.z = -s.cz * VX;
    view.targetY = s.height * VX * .52;
    view.halfH = Math.max(.75, Math.max(s.height, s.depth * 1.1) * VX * .74);
    shadow.scale.setScalar(Math.max(.5, s.radius * VX * 3.2));
    onResize();
    applyHighlight();
    ui.refresh();
    hud();
  });
}

let mediaMode = recipe.palette, speciesMode = recipe.species;
const rollPalette = () => mediaMode === 'all' ? PALETTE_IDS[(Math.random() * PALETTE_IDS.length) | 0] : mediaMode;
const rollSpecies = () => speciesMode === 'all' ? VSPECIES_IDS[(Math.random() * VSPECIES_IDS.length) | 0] : speciesMode;

const app = {
  recipe: () => recipe,
  paletteMode: () => mediaMode,
  speciesMode: () => speciesMode,
  setPalette(mode) { mediaMode = mode; recipe.palette = rollPalette(); rebuild(); },
  // a species change re-casts every unlocked part on the same seed
  setSpecies(mode) {
    speciesMode = mode;
    recipe.species = rollSpecies();
    recipe.base = null;
    regenVUnlocked(recipe, recipe.seed);
    rebuild();
  },
  setBase(b) { recipe.base = b; rebuild(); },
  setRecipe(json) {
    for (const k of Object.keys(recipe)) delete recipe[k];
    Object.assign(recipe, json);
    ensureVParams(recipe);
    mediaMode = recipe.palette; speciesMode = recipe.species;
    rebuild();
  },
  rebuild,
  reroll(id) { rerollVPart(recipe, id); rebuild(); },
  regen(seed = (Math.random() * 1e9) | 0) {
    recipe.species = rollSpecies();
    recipe.palette = rollPalette();
    recipe.base = null;
    regenVUnlocked(recipe, seed);
    rebuild();
  },
  anim, animator,
  setTurntable(on) { turntable = on; },
  turntable: () => turntable,
  resetView() { view.az = .55; view.el = .42; },
  onSelectionChange: () => applyHighlight(),
};
const ui = initVUI(app);

// ---- selection ---------------------------------------------------
const ray = new THREE.Raycaster();
const SELECT = new THREE.Color(0x8fa9d8);
const WHITE = new THREE.Color(0xffffff);
function applyHighlight() {
  if (!face) return;
  for (const e of face.entries) e.matl.color.copy(e.id === ui.selected ? SELECT : WHITE);
}

// ---- pointer: drag orbits, a tap selects a part ------------------
let down = null;
renderer.domElement.addEventListener('pointerdown', ev => {
  down = { x: ev.clientX, y: ev.clientY, az: view.az, el: view.el, moved: 0 };
  try { renderer.domElement.setPointerCapture(ev.pointerId); } catch { /* already gone */ }
});
renderer.domElement.addEventListener('pointermove', ev => {
  if (!down) return;
  const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
  down.moved = Math.max(down.moved, Math.hypot(dx, dy));
  view.az = down.az - dx * .009;
  view.el = Math.max(-.25, Math.min(1.25, down.el + dy * .006));
});
addEventListener('pointerup', ev => {
  if (down && down.moved < 5) pick(ev);
  down = null;
});
renderer.domElement.addEventListener('wheel', ev => {
  ev.preventDefault();
  view.halfH = Math.max(.35, Math.min(4, view.halfH * (1 + Math.sign(ev.deltaY) * .12)));
  onResize();
}, { passive: false });

function pick(ev) {
  if (!face) return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(
    ((ev.clientX - r.left) / r.width) * 2 - 1,
    -((ev.clientY - r.top) / r.height) * 2 + 1,
  ), camera);
  const hits = ray.intersectObjects(face.group.children, true).filter(h => h.object.visible);
  ui.select(hits.length ? hits[0].object.userData.partId : null);
}

// ---- hud ---------------------------------------------------------
function hud() {
  const el = document.getElementById('count');
  if (!el || !face) return;
  const s = face.stats;
  el.textContent = `${s.voxels} voxels · ${s.tris} tris · ${s.parts} parts · ${s.height} tall · built in ${buildMs.toFixed(0)}ms`;
}

// ---- loop --------------------------------------------------------
onResize();
rebuild();
let last = performance.now();
function frame(now = performance.now()) {
  // clamped at BOTH ends: a hand-pumped frame can hand us a `now`
  // behind the last real one, and a negative dt runs the gaze spring
  // backwards — it blows up to 1e36 in about twenty frames
  const t = now / 1000, dt = Math.max(0, Math.min(.05, (now - last) / 1000));
  last = now;
  if (turntable && !down) view.az += dt * .28;
  animator.update(t, dt);
  place();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// A hidden panel throttles rAF to a crawl, so anything measured off
// one is a lie. pump() drives the loop by hand and yields through a
// MessageChannel — a setTimeout is clamped to ~1s in a hidden tab and
// a microtask never lets the event loop run at all.
const yieldNow = () => new Promise(res => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => res();
  ch.port2.postMessage(0);
});

window.__voxel = {
  frame,
  async pump(n = 60, step = 16) {
    // stop the real loop first, or its frames interleave with the
    // pumped ones on a different clock and every timer measured off
    // this is a lie
    renderer.setAnimationLoop(null);
    // carry on from the last frame's clock, not from performance.now():
    // restarting at the real clock rewinds the virtual one, every dt
    // clamps to zero and the whole animator quietly stops advancing
    for (let i = 0; i < n; i++) { frame(last + step); await yieldNow(); }
    renderer.setAnimationLoop(frame);
  },
  recipe: () => recipe,
  face: () => face,
  stats: () => face?.stats,
  audit: () => auditPlates(face),
  view, anim, animator, app,
};
