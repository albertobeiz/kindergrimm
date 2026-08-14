// The crowd: a 7×5 page of faces, no editing. Each one is a full rig
// — it blinks, breathes and boils on its own clock — so this doubles
// as the honest stress test of the whole system.
//
// Two concessions to running 35 rigs at once, both set before any
// face is built: half the boil frames and a lower canvas resolution.
// Layout is unaffected (U is resolution only), and the faces are
// drawn one per frame so the page fills in like someone working
// down the sheet instead of freezing for several seconds.
import * as THREE from 'three';
import { PAPER, Sketch, chaikin } from './sketch.js';
import { setRender, U } from './part.js';
import { addPaper, makeFloorLine } from './paper.js';
import { newRecipe, buildCharacter, ensureParams } from './rig.js';
import { MEDIA, MEDIA_IDS } from './media.js';
import { SPECIES, SPECIES_IDS } from './species.js';
import { createAnimator } from './anim.js';

setRender({ u: 118, frames: 2 });

THREE.ColorManagement.enabled = false;

const COLS = 7, ROWS = 5, N = COLS * ROWS;
const CELL_W = 1.0, CELL_H = 1.45, FACE_SCALE = .62;
const HALF_H = ROWS * CELL_H / 2 + .26;
const TOP_MARGIN = .18;          // the HUD sits over this strip
// every row is a shelf: a drawn floor line all its characters stand on
const rowFloorY = row => -(row - (ROWS - 1) / 2) * CELL_H - CELL_H * .40;

const params = new URLSearchParams(location.search);
// 'todos'/'todas' mix them per character — the whole range on one page
const media = [...MEDIA_IDS, 'todos'].includes(params.get('media')) ? params.get('media') : 'todos';
const species = [...SPECIES_IDS, 'todas'].includes(params.get('species')) ? params.get('species') : 'todas';

const links = (host, items, current, key) => {
  document.getElementById(host).innerHTML = items.map(([val, label]) => {
    const q = new URLSearchParams({ media, species });
    q.set(key, val);
    return `<a href="?${q}"${val === current ? ' class="sel"' : ''}>${label}</a>`;
  }).join(' · ');
};
links('medias', [['todos', 'todos'], ...MEDIA_IDS.map(m => [m, MEDIA[m].label])], media, 'media');
links('species', [['todas', 'todas'], ...SPECIES_IDS.map(s => [s, SPECIES[s].label])], species, 'species');

const stage = document.getElementById('stage');
const countEl = document.getElementById('count');
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);

const camera = new THREE.OrthographicCamera(-1, 1, HALF_H, -HALF_H, .1, 100);
camera.position.set(0, TOP_MARGIN, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
stage.appendChild(renderer.domElement);

function onResize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.left = -HALF_H * w / h;
  camera.right = HALF_H * w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
addEventListener('resize', onResize);

addPaper(scene, HALF_H);
for (let r = 0; r < ROWS; r++) {
  const fl = makeFloorLine(COLS * CELL_W + .5);
  fl.position.set(0, rowFloorY(r) - fl.userData.lineDy, -1);
  scene.add(fl);
}

// ---- the page of faces ------------------------------------------
const cells = new Array(N).fill(null);
let queue = [];

function cellPos(i) {
  return [
    ((i % COLS) - (COLS - 1) / 2) * CELL_W,
    -((i / COLS | 0) - (ROWS - 1) / 2) * CELL_H,
  ];
}

function drawCell(i, recipe = null) {
  if (cells[i]) {
    scene.remove(cells[i].holder);
    cells[i].face.dispose();
  }
  if (!recipe) {
    recipe = newRecipe();
    recipe.media = media === 'todos' ? MEDIA_IDS[(Math.random() * MEDIA_IDS.length) | 0] : media;
    recipe.species = species === 'todas' ? SPECIES_IDS[(Math.random() * SPECIES_IDS.length) | 0] : species;
  }
  ensureParams(recipe);
  const face = buildCharacter(recipe);
  const holder = new THREE.Group();
  const [x] = cellPos(i);
  // land the feet on this row's floor line, whatever the proportions
  holder.position.set(x, rowFloorY(i / COLS | 0) + (face.F.B.floorY / U) * FACE_SCALE, 0);
  holder.scale.setScalar(FACE_SCALE);
  holder.add(face.group);          // the animator owns face.group's transform
  scene.add(holder);
  // every head lives on its own clock, or the page breathes in unison
  const opts = {
    blink: true, gaze: true, talk: false, sway: true, breath: true, boil: true,
    boilSpeed: .5, phase: Math.random() * 20, amp: 1.5,
  };
  cells[i] = { i, recipe, face, holder, opts, talkUntil: 0, emote: null, animator: createAnimator(() => face, opts) };
}

function newPage() {
  queue = [...Array(N).keys()];
  // fill in reading order, but jump around a little so it doesn't
  // look like a progress bar
  queue.sort(() => Math.random() - .5);
}

newPage();

addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') newPage();
});

// ---- click a face and it is someone else ------------------------
const ray = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', ev => {
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((ev.clientX - r.left) / r.width) * 2 - 1,
    -((ev.clientY - r.top) / r.height) * 2 + 1,
  );
  ray.setFromCamera(ndc, camera);
  // pick by cell, not by pixel: the nearest cell centre to the click
  const p = ray.ray.origin;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < N; i++) {
    const [x, y] = cellPos(i);
    const d = Math.hypot(p.x - x, p.y - y - .05);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best >= 0 && bestD < Math.max(CELL_W, CELL_H) * .8) {
    if (!queue.includes(best)) queue.unshift(best);
  }
});

// ---- the life of the page ---------------------------------------
// Every so often somebody does something: glances aside (a real head
// turn — the face redraws itself at a new angle), mutters for a bit,
// or throws an emote. Most of the crowd just stands there breathing.
function makeEmoteMesh(kind) {
  const s = new Sketch(110, 110);
  s.boil((Math.random() * 1e9) | 0);
  const c = s.ctx, m = 55;
  if (kind === 'bang') {
    s.stroke([[m, 18], [m, 62]], 10, { taper: .25, alpha: 1, wedge: true });
    c.fillStyle = s.inkA(.95);
    s.wobbly(m, 82, 6, 6); c.fill();
  } else if (kind === 'quest') {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI * .95 + i / 12 * Math.PI * 1.35;
      pts.push([m + Math.cos(a) * 20, 38 + Math.sin(a) * 20]);
    }
    pts.push([m + 12, 62], [m + 8, 72]);
    s.stroke(chaikin(pts, false, 1), 7, { taper: .3, alpha: .95 });
    c.fillStyle = s.inkA(.95);
    s.wobbly(m + 6, 88, 5.5, 5.5); c.fill();
  } else if (kind === 'heart') {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30 * Math.PI * 2;
      pts.push([m + 16 * Math.pow(Math.sin(t), 3) * 2.1,
                52 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 2.1]);
    }
    s.poly(pts, true); c.fillStyle = s.inkA(.9); c.fill();
    s.sline(pts.concat([pts[0]]), 1.6, .8);
  } else if (kind === 'zzz') {
    for (let k = 0; k < 3; k++) {
      const sz = 26 - k * 7, x0 = 28 + k * 24, y0 = 74 - k * 26;
      s.stroke([[x0, y0 - sz], [x0 + sz, y0 - sz], [x0, y0], [x0 + sz, y0]], 4.5 - k, { taper: .2, alpha: .9, amp: .5 });
    }
  } else if (kind === 'dizzy') {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, a = t * Math.PI * 5.2;
      pts.push([m + Math.cos(a) * 30 * t, m + Math.sin(a) * 30 * t]);
    }
    s.sline(pts, 2.2, .85);
  } else { // drop: the anxious bead of sweat
    const d = chaikin([[m, 22], [m + 16, 58], [m, 78], [m - 16, 58]], true, 2);
    s.paperFill(d);
    s.sline(d.concat([d[0]]), 2.2, .85);
    s.sline([[m - 5, 52], [m - 7, 64]], 1.6, .5);
  }
  const tex = new THREE.CanvasTexture(s.canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(.34, .34),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.renderOrder = 200;
  return mesh;
}

const EMOTES = ['bang', 'quest', 'heart', 'zzz', 'dizzy', 'drop'];

function giveEmote(cell, t) {
  clearEmote(cell);
  const mesh = makeEmoteMesh(EMOTES[(Math.random() * EMOTES.length) | 0]);
  mesh.position.set(.34 + Math.random() * .12, .74 + Math.random() * .15, .2);
  mesh.rotation.z = (Math.random() - .5) * .25;
  cell.holder.add(mesh);
  cell.emote = { mesh, t0: t, dur: 1.6 + Math.random() * 1.2 };
}

function clearEmote(cell) {
  if (!cell.emote) return;
  cell.holder.remove(cell.emote.mesh);
  cell.emote.mesh.material.map.dispose();
  cell.emote.mesh.material.dispose();
  cell.emote.mesh.geometry.dispose();
  cell.emote = null;
}

function glance(cell) {
  // an actual head turn: same person, redrawn mid-gesture
  const sk = cell.recipe.parts.skull.params;
  const dir = Math.random() < .5 ? -1 : 1;
  sk.turn = Math.abs(sk.turn) > .18 && Math.random() < .4
    ? (Math.random() - .5) * .16                     // back to front
    : dir * (.2 + Math.random() * .35);              // aside
  drawCell(cell.i, cell.recipe);
}

let nextLife = 2;
const lifeLog = window.__life = { glances: 0, talks: 0, emotes: 0 };

// ---- loop -------------------------------------------------------
onResize();
let last = performance.now();
renderer.setAnimationLoop(now => {
  const t = now / 1000, dt = Math.min(.1, (now - last) / 1000);
  last = now;

  // Fill the page on a time budget rather than one per frame: a
  // character costs ~20ms to draw, so this is normally one or two a
  // frame, but if the browser is handing out slow frames (a
  // background tab) it draws more of them instead of taking a minute.
  if (queue.length) {
    const until = performance.now() + 24;
    do { drawCell(queue.shift()); } while (queue.length && performance.now() < until);
    countEl.textContent = queue.length ? `dibujando… ${N - queue.length}/${N}` : '';
  } else if (t > nextLife) {
    nextLife = t + .5 + Math.random() * .9;
    const cell = cells[(Math.random() * N) | 0];
    if (cell) {
      // gaze runs continuously inside every animator now, so the big
      // redraw-turn can be the rare gesture it should be
      const roll = Math.random();
      if (roll < .16) { glance(cell); lifeLog.glances++; }
      else if (roll < .42) { cell.talkUntil = t + .9 + Math.random() * 1.4; lifeLog.talks++; }
      else if (roll < .62) { giveEmote(cell, t); lifeLog.emotes++; }
      // the rest of the time: nobody does anything, like a real crowd
    }
  }

  for (const c of cells) {
    if (!c) continue;
    c.opts.talk = t < c.talkUntil;
    c.animator.update(t, dt);
    if (c.emote) {
      const age = t - c.emote.t0;
      if (age > c.emote.dur) clearEmote(c);
      else {
        const pop = Math.min(1, age * 5);
        c.emote.mesh.scale.setScalar(pop * (1.25 - .25 * pop));    // overshoot, settle
        c.emote.mesh.material.opacity = Math.min(1, (c.emote.dur - age) * 2.5);
      }
    }
  }
  renderer.render(scene, camera);
});
