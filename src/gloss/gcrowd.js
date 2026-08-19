// ---------------------------------------------------------------
// THE GLOSS SHEET — `crowd.html` for the molded rig, and built the
// same way that page is: a FLAT GRID seen straight on, seven across
// and five down, every character the same size in its own cell.
//
// It was a floor first, receding into depth, and that was the
// wrong page. Depth costs the two things a contact sheet is for: the
// back row is smaller than the front row so you cannot compare them,
// and a character that moves is moving away from you where it barely reads.
// Flatten it and every cell is worth the same.
//
// The characters hang on a WALL rather than standing on a floor, and the
// wall is what makes the lighting work: it sits just behind them, so
// every character throws a short shadow onto it and the sheet has depth
// without the camera needing any.
//
// THE ANIMATION IS ALL FACE. There is no body-move director — a character
// hopping in its cell is a screensaver, and the thing worth watching
// is thirty-five faces looking around a room and reacting. That whole
// vocabulary is `gface.js`: gaze, the head whipping after it, blinks,
// and expressions. This page only decides WHO feels what and WHEN,
// which is exactly the job `crowd.js`'s director does for poses.
//
// Both pages build through `buildGloss`, so a part added in the lab
// shows up here with no second implementation to keep in step.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { buildGloss, newGRecipe, ensureGParams, BODY_IDS, STANCE_IDS } from './grig.js';
import { studioEnv, makeMaterialFactory, dressScene, MATERIALS } from './gmedia.js';
import { createGlossFace } from './gface.js';
import { PALETTES } from './gpalette.js';
import { GSPECIES_IDS } from './gspecies.js';

const CELL_W = 1, CELL_H = 1.06;
// of a cell. It leaves real air around each character, and it has to: a gaze
// swings the head a little way out of its cell and a wide one is close
// to its neighbour before it even moves.
const CHARACTER = .74;

const stage = document.getElementById('stage');
const countEl = document.getElementById('count');

// A phone gets a narrower sheet rather than seven columns of nothing:
// the whole grid always fits, so the COUNT changes, never the scale.
const chooseGrid = () => {
  const a = stage.clientWidth / Math.max(1, stage.clientHeight);
  return a < .8 ? { cols: 3, rows: 5 } : a < 1.25 ? { cols: 5, rows: 5 } : { cols: 7, rows: 5 };
};

// THE FILTERS. Each dimension is pinned or left to roll — hold two
// still and the third is the only thing varying, which is the only way
// to see whether a lever is doing any work. There is deliberately no
// face-part filter: a sheet with the eyes pinned is not a cast of
// characters, it is a spreadsheet.
const filters = { species: 'all', body: 'all', stance: 'all', palette: 'all', material: 'all' };

// The filters live in the URL, not just in memory: a link with
// ?species=panda pinned is the whole feature — no share button, no
// storage, just query params a filter change keeps in sync.
const FILTER_KEYS = ['species', 'body', 'stance', 'palette', 'material'];
function readFiltersFromURL() {
  const q = new URLSearchParams(location.search);
  for (const k of FILTER_KEYS) {
    const v = q.get(k);
    if (v) filters[k] = v;
  }
}
function writeFiltersToURL() {
  const q = new URLSearchParams(location.search);
  for (const k of FILTER_KEYS) {
    if (filters[k] === 'all') q.delete(k);
    else q.set(k, filters[k]);
  }
  const qs = q.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}
readFiltersFromURL();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SPAN = 9;
dressScene(scene, renderer, { shadows: 'wall', span: SPAN, wallZ: .55 });
const materialFor = makeMaterialFactory(studioEnv(renderer));

// A real lens, not an ortho box: a long-ish 26° so the grid barely
// converges, but the characters out at the edges still turn a few degrees
// toward you and the sheet reads as objects on a wall instead of a
// printed page.
const camera = new THREE.PerspectiveCamera(26, 1, .1, 100);

let grid = { cols: 7, rows: 5 };
let slots = [];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

function layOut() {
  const { cols, rows } = grid;
  slots = [];
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols, row = (i / cols) | 0;
    slots.push({
      i,
      x: (col - (cols - 1) / 2) * CELL_W,
      y: -(row - (rows - 1) / 2) * CELL_H,
      built: null, holder: null, recipe: null, life: null, scale: 1,
      phase: Math.random() * 20, rate: rnd(.85, 1.2),
      faceUntil: 0,
    });
  }
}

function clearSlot(s) {
  if (!s.built) return;
  scene.remove(s.holder);
  s.built.group.traverse(o => o.geometry?.dispose());
  s.built = null; s.life = null;
}

function buildSlot(s, recipe = null) {
  clearSlot(s);
  if (!recipe) {
    recipe = newGRecipe();
    // a pinned filter is written in BEFORE the recipe is filled: every
    // field in `ensureGParams` uses ??=, so it only rolls what it was
    // not told
    for (const k of FILTER_KEYS)
      if (filters[k] !== 'all') recipe[k] = filters[k];
  }
  ensureGParams(recipe);
  const built = buildGloss(recipe, { materialFor });

  // One size for the whole sheet — a cell is a cell, and a character that
  // rolled a bigger radius should not get a bigger square.
  //
  // Fitted on BOTH dimensions, not just height: the body ratios go out
  // to 1.26 wide against 0.82 tall, so a squat one normalised by height
  // alone comes out fitting its cell vertically and barging into its
  // neighbours sideways. Whichever axis is tighter decides.
  // THE HEAD IS THE SUBJECT, so the head is what gets normalised — a
  // sheet of faces wants every face the same size to be comparable.
  // But fitting by the head ALONE let ears climb into the row above,
  // and fitting by the whole character shrank a long-eared head to a pebble
  // to make room for its own ears. So: size by the head, and only fall
  // back to the total when the total would get out of hand. Ears
  // overhang, which is what ears do.
  const B = built.bounds;
  const budget = CELL_H * CHARACTER;
  const scale = Math.min(
    budget / built.L.H,               // heads all one size…
    // …unless the whole character runs away. 1.45 × the head budget is 0.98
    // of a cell, so the tallest pair of ears still stops short of the
    // row above — that headroom is the difference between a bunny
    // keeping its head and shrinking it to a pebble to hold its ears.
    (budget * 1.28) / B.h,
    // and SIDEWAYS the same bargain, for the same reason: twin tails
    // and a pair of rabbit ears are both wider than the head they are
    // on, and fitted hard they shrank the face to half its
    // neighbours'. 1.2 × the character's share is .89 of a cell, so the
    // widest still leaves a lane between itself and the next one.
    (CELL_W * CHARACTER * 1.2) / B.w,
  );
  const holder = new THREE.Group();
  holder.position.set(s.x, s.y, 0);
  // centred between the two: the head sits where a face should, and a
  // tall pair of ears still leans into its share of the cell
  built.group.position.y = -(B.cy + built.L.cy) / 2;
  holder.add(built.group);
  scene.add(holder);

  s.built = built; s.holder = holder; s.recipe = recipe; s.scale = scale;
  s.life = createGlossFace(built, { gaze: true });
  hud();
}

let queue = [];
function newSheet() {
  for (const s of slots) clearSlot(s);
  queue = slots.slice();
  hud();
}

layOut();
newSheet();

function hud() {
  if (!countEl) return;
  const made = slots.filter(s => s.built);
  const pinned = Object.entries(filters).filter(([, v]) => v !== 'all')
    .map(([k, v]) => `${k}: ${v}`).join(' · ');
  countEl.textContent = made.length < slots.length
    ? `molding… ${made.length}/${slots.length}`
    : `${slots.length} characters · ${made.reduce((a, s) => a + s.built.stats.verts, 0).toLocaleString()} verts`
      + (pinned ? ` · ${pinned}` : '');
}

// ---- the filter bar ---------------------------------------------------
function buildFilters() {
  const bar = document.getElementById('filters');
  if (!bar) return;
  bar.textContent = '';

  // one select per dimension. The unpinned option is NAMED after the
  // dimension ("body", "palette", "material"), so a bar that is doing
  // nothing still says what it could do without a label beside it.
  const sel = (key, values) => {
    const s = document.createElement('select');
    s.title = key;
    for (const v of [{ id: 'all', label: key }, ...values]) {
      const o = document.createElement('option');
      o.value = v.id;
      o.textContent = v.label ?? v.id;
      s.appendChild(o);
    }
    s.value = filters[key];
    s.onchange = () => { filters[key] = s.value; writeFiltersToURL(); buildFilters(); newSheet(); };
    bar.appendChild(s);
    return s;
  };

  sel('species', GSPECIES_IDS.map(id => ({ id, label: id })));
  sel('body', BODY_IDS.map(id => ({ id, label: id })));
  sel('stance', STANCE_IDS.map(id => ({ id, label: id })));
  sel('palette', PALETTES);
  // a palette is unreadable as a word, so the pinned one carries a dot
  // of its first colour — one colour, not the whole five-swatch strip
  const dot = document.createElement('i');
  dot.className = 'dot';
  const pal = PALETTES.find(p => p.id === filters.palette);
  if (pal) dot.style.background = pal.colors[0];
  else dot.classList.add('off');
  bar.appendChild(dot);
  sel('material', MATERIALS);
}
buildFilters();

// ---- fit --------------------------------------------------------------
function fit() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const want = chooseGrid();
  if (want.cols !== grid.cols || want.rows !== grid.rows) {
    for (const s of slots) clearSlot(s);
    grid = want;
    layOut();
    newSheet();
  }
  const aspect = w / Math.max(1, h);
  // CONTAIN, never cover: a contact sheet with a row cropped off is
  // not a contact sheet
  const halfW = grid.cols * CELL_W / 2 * 1.06;
  const halfH = grid.rows * CELL_H / 2 * 1.06 + .34;   // headroom for the bar
  const tanV = Math.tan(26 * Math.PI / 360);
  dist = Math.max(halfH / tanV, halfW / (tanV * aspect)) + 1;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// The sheet opens dead-on, because that is the shot — but these are
// real objects on a wall and they hold up from an angle, so a drag
// turns the whole page. Pitch is clamped: past ~.5 rad you are looking
// at the tops of their heads, and a face seen from above is the one
// thing this page cannot do.
const view = { yaw: 0, pitch: 0, zoom: 1 };
let dist = 8;

function place() {
  const d = dist * view.zoom, cp = Math.cos(view.pitch);
  camera.position.set(
    Math.sin(view.yaw) * cp * d,
    Math.sin(view.pitch) * d,
    Math.cos(view.yaw) * cp * d);
  camera.lookAt(0, 0, 0);
}

addEventListener('resize', fit);
fit();

// ---- the director -----------------------------------------------------
// It hands out FEELINGS, not moves. Same shape as `crowd.js`'s pose
// director: pick somebody, give them something, schedule the return to
// idle. Weighted toward idle so the sheet is mostly calm and a face
// that does change is worth catching.
const MOODS = ['happy', 'happy', 'surprised', 'angry', 'sad'];
let nextMood = 1.4;

function direct(t) {
  if (t < nextMood) return;
  nextMood = t + rnd(.4, 1.6);
  const idle = slots.filter(s => s.life && s.life.face() === 'idle');
  if (!idle.length) return;
  const s = pick(idle);
  s.life.setFace(pick(MOODS));
  s.faceUntil = t + rnd(1.3, 3.2);
}

function animate(s, t, dt) {
  if (s.faceUntil && t > s.faceUntil) { s.life.setFace('idle'); s.faceUntil = 0; }

  const own = t * s.rate + s.phase;
  const head = s.life.update(own, dt);

  // breath, and the same slow sway the drawn crowd has — enough that
  // the sheet is never still, small enough that it is never the thing
  // you are looking at
  const sy = 1 + Math.sin(own * 1.8) * .008;
  const swayX = Math.sin(own * .55) * CELL_W * .008;
  const swayY = Math.cos(own * .37) * CELL_H * .006;

  const h = s.holder;
  h.position.set(s.x + swayX, s.y + swayY, 0);
  // the gaze turns the HEAD, not the holder: head.x/y are already in
  // the character's own units, and the head group lives inside the scaled
  // group, so no unit conversion — and a character with a torso keeps its
  // feet planted while it looks
  const hd = s.built.head;
  hd.position.set(head.x, hd.userData.restY + head.y, 0);
  hd.rotation.set(head.pitch, head.yaw, head.rot);
  // volume-preserving, so a breath reads as weight and not as the character
  // changing size
  h.scale.set(s.scale / Math.sqrt(sy), s.scale * sy, s.scale / Math.sqrt(sy));
}

// ---- pointer ----------------------------------------------------------
let drag = null;
const ray = new THREE.Raycaster();

stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; });
addEventListener('pointermove', e => {
  if (!drag) return;
  drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
  view.yaw = Math.max(-.9, Math.min(.9, view.yaw - (e.clientX - drag.x) * .005));
  view.pitch = Math.max(-.45, Math.min(.5, view.pitch + (e.clientY - drag.y) * .004));
  drag.x = e.clientX; drag.y = e.clientY;
});
addEventListener('pointerup', e => {
  if (drag && drag.moved < 6) tap(e);
  drag = null;
});

// a tap re-molds that character: the same cell, somebody else in it
function tap(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(
    ((ev.clientX - r.left) / r.width) * 2 - 1,
    -((ev.clientY - r.top) / r.height) * 2 + 1,
  ), camera);
  for (const hit of ray.intersectObjects(scene.children, true)) {
    // walk up to the holder: a face mesh is one level deeper than a
    // frame mesh now that the head is its own group
    let o = hit.object;
    while (o && !slots.some(s => s.holder === o)) o = o.parent;
    const s = slots.find(s => s.built && s.holder === o);
    if (s && !queue.includes(s)) { queue.push(s); return; }
  }
}

stage.addEventListener('wheel', e => {
  e.preventDefault();
  view.zoom = Math.max(.4, Math.min(2, view.zoom * (1 + e.deltaY * .001)));
}, { passive: false });

addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (e.key === 'r' || e.key === 'R') newSheet();
  if (e.key === ' ') { Object.assign(view, { yaw: 0, pitch: 0, zoom: 1 }); e.preventDefault(); }
});

// ---- loop -------------------------------------------------------------
// CAPPED AT 30. Thirty-five idle faces blinking and glancing do not
// need every frame the display can give — and on a 120 Hz panel this
// page was rendering four times as often as it has anything new to
// say, which is heat for nothing. The animation is driven by the clock
// rather than by the frame count, so halving the frames changes the
// pace of nothing; it only stops drawing the same thing twice.
const MIN_FRAME_MS = 1000 / 30;
let last = performance.now();

function frame(now = performance.now()) {
  const t = now / 1000, dt = Math.max(0, Math.min(.1, (now - last) / 1000));
  last = now;

  // a TIME budget, not a count: a character is a few ms now, so the sheet
  // fills almost at once on a fast machine and still never stutters
  if (queue.length) {
    const until = performance.now() + 8;
    do { buildSlot(queue.shift()); } while (queue.length && performance.now() < until);
  }

  direct(t);
  for (const s of slots) if (s.built) animate(s, t, dt);

  place();
  renderer.render(scene, camera);
}

// The gate lives HERE and not inside `frame`, so that driving frames by
// hand — `pump`, and every measurement built on it — still gets every
// one it asks for. Gating the function itself silently swallowed half
// of them and filled the sheet at half speed under test.
let lastDraw = -1e9;
function loop() {
  const now = performance.now();
  if (now - lastDraw < MIN_FRAME_MS - .5) return;
  lastDraw = now;
  frame(now);
}
renderer.setAnimationLoop(loop);

// the decidable half — see CLAUDE.md
const yieldNow = () => new Promise(res => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => res();
  ch.port2.postMessage(0);
});

window.__gcrowd = {
  frame, camera, filters, view, renderer, scene,
  look(yaw = 0, pitch = 0, zoom = 1) { Object.assign(view, { yaw, pitch, zoom }); },
  get slots() { return slots; },
  async pump(n = 60, step = 16) {
    renderer.setAnimationLoop(null);
    for (let i = 0; i < n; i++) { frame(last + step); await yieldNow(); }
    renderer.setAnimationLoop(loop);
  },
  refill: newSheet,
  filter(patch) { Object.assign(filters, patch); writeFiltersToURL(); buildFilters(); newSheet(); },
  stats: () => ({
    grid, built: slots.filter(s => s.built).length, queued: queue.length,
    verts: slots.reduce((a, s) => a + (s.built?.stats.verts ?? 0), 0),
    ms: slots.map(s => s.built?.stats.buildMs ?? null),
    faces: slots.map(s => s.life?.face()),
    palettes: slots.map(s => s.recipe?.palette),
    materials: slots.map(s => s.recipe?.material),
    stances: slots.map(s => s.recipe?.stance),
  }),
};
