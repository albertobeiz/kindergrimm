// drawai — graphite faces on cream paper, cyber-crowd style.
// One face built from a recipe, one bone per part, click to select.
import * as THREE from 'three';
import { PAPER } from './sketch.js';
import { addPaper, makeFloorLine } from './paper.js';
import { U } from './part.js';
import { newRecipe, buildCharacter, rerollPart, regenUnlocked, ensureParams } from './rig.js';
import { MEDIA_IDS } from './media.js';
import { createAnimator } from './anim.js';
import { initUI } from './editor.js';

THREE.ColorManagement.enabled = false;

const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);

// The character's origin is the centre of the HEAD, so the body hangs
// below it: frame a little low to keep the feet in shot.
const HALF_H = 1.28;
const CAM_Y = -.28;
// the panel leaves a narrow viewport, so also guarantee a minimum
// half-WIDTH: without it, wide ears and horns get cut off the sides
const MIN_HALF_W = 1.08;
const camera = new THREE.OrthographicCamera(-1, 1, HALF_H, -HALF_H, .1, 100);
camera.position.set(0, CAM_Y, 10);
camera.lookAt(0, CAM_Y, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
stage.appendChild(renderer.domElement);

function onResize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const aspect = w / h;
  const halfH = Math.max(HALF_H, MIN_HALF_W / aspect);
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.left = -halfH * aspect;
  camera.right = halfH * aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
addEventListener('resize', onResize);

addPaper(scene, HALF_H);

// the character stands ON a drawn floor line, whatever its proportions
const FLOOR_Y = -.92;
{
  const fl = makeFloorLine(3.4);
  fl.position.set(0, FLOOR_Y - fl.userData.lineDy, -1);
  scene.add(fl);
}

// ---- app state --------------------------------------------------
const recipe = newRecipe();
recipe.media = MEDIA_IDS[(Math.random() * MEDIA_IDS.length) | 0];
ensureParams(recipe);
let face = null;

const anim = { blink: true, gaze: true, talk: false, sway: true, breath: true, boil: true, boilSpeed: .5 };
const animator = createAnimator(() => face, anim);

let rebuildQueued = false;
function rebuild() {
  // collapse slider-drag bursts into one rebuild per frame
  if (rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(() => {
    rebuildQueued = false;
    if (face) { scene.remove(face.group); face.dispose(); }
    face = buildCharacter(app.recipe());
    // feet on the floor: the origin is the head's centre, so lift the
    // character by how far its own feet hang below that
    face.group.position.y = FLOOR_Y + face.F.B.floorY / U;
    scene.add(face.group);
    applyHighlight();
    ui.refresh();
  });
}

// 'todos' rolls a different medium every time the face is redrawn
let mediaMode = 'todos';
const rollMedia = () =>
  mediaMode === 'todos' ? MEDIA_IDS[(Math.random() * MEDIA_IDS.length) | 0] : mediaMode;

const app = {
  recipe: () => recipe,
  mediaMode: () => mediaMode,
  setMedia(mode) { mediaMode = mode; recipe.media = rollMedia(); rebuild(); },
  setRecipe(json) {
    for (const k of Object.keys(recipe)) delete recipe[k];
    Object.assign(recipe, json);
    ensureParams(recipe);
    mediaMode = recipe.media || 'graphite';
    rebuild();
  },
  rebuild,
  reroll(id) { rerollPart(recipe, id); rebuild(); },
  regen(seed = (Math.random() * 1e9) | 0) {
    regenUnlocked(recipe, seed);
    recipe.media = rollMedia();
    rebuild();
  },
  anim,
  onSelectionChange: () => applyHighlight(),
};
const ui = initUI(app);

// ---- selection: click the face, transparent pixels pass through --
const ray = new THREE.Raycaster();
const SELECT_TINT = new THREE.Color(0x9db6de);
const WHITE = new THREE.Color(0xffffff);

function applyHighlight() {
  if (!face) return;
  for (const e of face.entries)
    e.part.matl.color.copy(e.id === ui.selected ? SELECT_TINT : WHITE);
}

renderer.domElement.addEventListener('pointerdown', ev => {
  if (!face) return;
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((ev.clientX - r.left) / r.width) * 2 - 1,
    -((ev.clientY - r.top) / r.height) * 2 + 1,
  );
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(face.group.children, true)
    .sort((a, b) => b.object.renderOrder - a.object.renderOrder);
  const byMesh = new Map(face.entries.map(e => [e.part.mesh, e]));
  for (const hit of hits) {
    const e = byMesh.get(hit.object);
    if (!e || !hit.uv) continue;
    if (e.part.alphaAt(hit.uv.x, hit.uv.y) > 12) { ui.select(e.id); return; }
  }
  ui.select(null);
});

// ---- loop -------------------------------------------------------
onResize();
rebuild();
let last = performance.now();
renderer.setAnimationLoop(now => {
  const t = now / 1000, dt = Math.min(.1, (now - last) / 1000);
  last = now;
  animator.update(t, dt);
  renderer.render(scene, camera);
});
