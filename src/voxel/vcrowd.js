// drawai — the voxel crowd. Twenty solids assembling themselves on a
// midnight platform, under lamps that go round.
//
// This is `crowd.js` for the voxel rig: a page whose whole job is to
// show the variety at a glance. The scenery is one graveyard hill out
// of a stop-motion Halloween — a spiral hill curling over a full moon,
// bare trees, pumpkins — because a crowd of these creatures needed
// somewhere to be, and a flat grey disc was nowhere.
//
// IT IS THE ONE SCENE HERE WITH REAL LIGHTS. Everything else in this
// project bakes its illumination — the drawn parts into the paper, the
// voxel rig into its vertex colours — because baked light cannot swim
// and costs nothing. But baked light points one way for ever, and the
// whole point of this page is lamps that DON'T: the characters are
// built `lit: true` (no baked face shading, AO kept — occlusion is
// geometry, not illumination), the moon is a shadow-casting key light,
// and three coloured lanterns orbit the crowd on their own clocks, one
// of them dragging real shadows around the floor as it goes.
//
// The CAMERA does not move on its own. Dragging still orbits it, but
// nothing animates it — on this page the light is the animation.
//
// THE MOUNT: a character does not appear, it is ASSEMBLED. The rig
// sorts every mesh's triangles bottom-up (see vrig.js), so growing
// `drawRange` from 0 to full sweeps the character into existence voxel
// by voxel — and because shadows render the same geometry, the shadow
// assembles with it. No geometry is touched at runtime.
//
// Nothing builds in one frame: twenty characters is ~200 ms, so the
// queue fills on a time budget, the same way the class fills in orla.
import * as THREE from 'three';
import { newVRecipe, buildVoxelCharacter, ensureVParams, VX } from './vrig.js';
import { VSPECIES_IDS } from './vspecies.js';
import { PALETTE_IDS } from './vpalette.js';
import { createVoxelAnimator } from './vanim.js';
import { Carve, meshCells } from './carve.js';

THREE.ColorManagement.enabled = false;

// ---- palette of the night -------------------------------------------
const BG = 0x000000;
const TILE = 0x2c2938, TILE2 = 0x252230, UNDER = 0x161322;
const ROCK = 0x1e1b2c, ROCK2 = 0x252134;
const TREE = 0x16121f;
const STONE = 0x555064, STONE2 = 0x47425a;
const PUMP = 0xd06a1d, STEM = 0x44522c, FACE = 0x120e1a;
const MOON = 0xf4eed6, CRATER = 0xe4dcbc;

// Five across, four deep, on an EXACT grid — no jitter, no stagger.
// Everyone faces the same way (+z, at the camera), like a class being
// photographed. Which is what this is: the ragged hand-of-god scatter
// belongs to the drawn crowd; a voxel crowd wants the same rigour as
// its own cubes.
const COLS = 5, ROWS = 4, N = COLS * ROWS;
const SPACE = 2.3;
const MOUNT_S = 1.4;                     // seconds to assemble one

const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
// the "advanced" half of the lighting is mostly these three lines:
// filmic tone mapping so the lamps can overdrive a surface without
// clipping to white, and soft shadow maps under a real key light
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
stage.appendChild(renderer.domElement);

// ---- camera: parked. Drag orbits it; nothing animates it. -----------
const view = { az: .12, el: .38, halfH: 4.1, targetY: 1.35 };
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 200);
function place() {
  const r = 40, ce = Math.cos(view.el);
  camera.position.set(Math.sin(view.az) * ce * r, Math.sin(view.el) * r + view.targetY, Math.cos(view.az) * ce * r);
  camera.lookAt(0, view.targetY, 0);
}
// the grid is wider than it is tall, so a narrow window must widen the
// view instead of cropping the back rows — same trick as main.js
const MIN_HALF_W = 8.2;
function onResize() {
  const w = stage.clientWidth, h = stage.clientHeight, aspect = w / h;
  const halfH = Math.max(view.halfH, MIN_HALF_W / aspect * (view.halfH / 4.1));
  camera.top = halfH; camera.bottom = -halfH;
  camera.left = -halfH * aspect; camera.right = halfH * aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
addEventListener('resize', onResize);

// ---- the platform, and everything that grows out of it --------------
// One Carve, one mesh: the slab, the spiral hill, the trees, the
// pumpkins and the stones are a single solid, so the mesher welds them
// and the AO pools where a tree meets the ground.
const FLOOR_R = 116;                     // cells; platform ~14.5 units wide — at KOFF 128 this is as big as the key space allows

function buildScenery() {
  const v = new Carve();

  // the slab: a ragged coin of night-coloured tiles with a rocky
  // underside, floating in the black
  const edge = (x, z) =>
    FLOOR_R * (.90 + .13 * v.h01(Math.round(x / 7), 0, Math.round(z / 7), 7));
  for (let x = -FLOOR_R - 8; x <= FLOOR_R + 8; x++)
    for (let z = -FLOOR_R - 8; z <= FLOOR_R + 8; z++) {
      const d = Math.hypot(x, z), e = edge(x, z);
      if (d > e) continue;
      v.set(x, -1, z, v.h01(x, 0, z, 3) < .14 ? TILE2 : TILE);
      // the underside steps in as it goes down, like a broken biscuit
      for (let L = 1; L <= 4; L++)
        if (d < e - L * 4 + v.h01(x, L, z, 9) * 5) v.set(x, -1 - L, z, UNDER);
    }

  // THE HILL — a cone that keeps climbing past its own tip and curls
  // over, fern-wise. The curl lives in the x/y plane so it reads as a
  // silhouette against the moon from the parked camera.
  const hx = -55, hz = -85, H = 30, R0 = 13;
  for (let y = 0; y < H; y++) {
    const r = Math.max(1.8, R0 * Math.pow(1 - y / (H + 5), 1.2));
    v.disc(y, hx, hz, r * (1 + .05 * Math.sin(y * .8)), r, (y % 6) ? ROCK : ROCK2, 2.2);
  }
  const RC = 8.5, cy = H + RC * .35;
  let prev = [hx, cy - RC, hz];
  for (let i = 1; i <= 30; i++) {
    const t = i / 30, ang = t * 4.35;
    const rr = RC * (1 - .55 * t);
    const p = [hx - Math.sin(ang) * rr, cy - Math.cos(ang) * rr, hz];
    v.stroke(prev, p, 2.4 * (1 - t) + .8, 2.4 * (1 - t * .96) + .8, ROCK);
    prev = p;
  }

  // bare trees: a leaning trunk and a few clawed branches, near the
  // rim so they frame the crowd instead of standing in it
  const tree = (x, z, h, lean, salt) => {
    const top = [x + lean * h, h, z + lean * h * .3];
    v.stroke([x, -1, z], top, 1.7, .5, TREE);
    for (let b = 0; b < 4; b++) {
      const t = .45 + b * .16;
      const at = [x + lean * h * t, h * t, z + lean * h * t * .3];
      const dir = v.h01(b, salt, 0, 21) * 6.3;
      const len = h * .34 * (1 - b * .12);
      const end = [at[0] + Math.cos(dir) * len, at[1] + len * .75, at[2] + Math.sin(dir) * len * .6];
      v.stroke(at, end, .7, .25, TREE);
      // the claw at the end of every branch
      v.stroke(end, [end[0] + Math.cos(dir + .9) * 3, end[1] + 2, end[2]], .4, .2, TREE);
    }
  };
  tree(100, 28, 26, -.16, 1);
  tree(-94, 42, 22, .2, 2);
  tree(-10, -100, 24, .1, 3);
  tree(88, -50, 20, .12, 4);

  // pumpkins, lit from inside later by the flicker light
  const pumpkin = (x, z, r) => {
    v.blob(x, r * .8, z, r * 1.15, r * .85, r * 1.15, PUMP, 2.6);
    v.set(x, Math.round(r * 1.7), z, STEM);
    const zf = z + Math.round(r * 1.3);
    const dabF = (dx, dy) => {
      for (let zz = zf; zz >= z; zz--)
        if (v.taken(x + dx, dy, zz)) { v.set(x + dx, dy, zz, FACE); return; }
    };
    dabF(-Math.ceil(r * .45), Math.round(r * .95));   // two eyes
    dabF(Math.ceil(r * .45), Math.round(r * .95));
    for (let m = -Math.ceil(r * .5); m <= Math.ceil(r * .5); m++)
      if ((m + 9) % 2) dabF(m, Math.round(r * .4));   // a gap-toothed grin
  };
  pumpkin(38, -84, 4);
  pumpkin(-90, -26, 3);
  pumpkin(92, 12, 3.5);

  // gravestones. It is that kind of platform.
  const stone = (x, z, w, h, salt) => {
    for (let yy = 0; yy <= h; yy++)
      for (let xx = -w; xx <= w; xx++) {
        if (yy === h && Math.abs(xx) === w) continue;   // shouldered top
        v.set(x + xx, yy, z, v.h01(xx, yy, salt, 5) < .2 ? STONE2 : STONE);
        v.set(x + xx, yy, z - 1, STONE2);
      }
  };
  stone(18, -78, 2, 6, 1);
  stone(-64, -72, 3, 5, 2);
  stone(66, -70, 2, 7, 3);

  const occ = new Map();
  for (const k of v.cells.keys()) occ.set(k, {});
  const geo = meshCells({ cells: v.cells, occ, pivot: [0, 0, 0], vx: VX, shade: false });
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
}
buildScenery();

// ---- the moon: a voxel coin that glows on its own -------------------
// MeshBasicMaterial and toneMapped:false — the moon is not lit, it IS
// light, and tone mapping would grey it down with everything else.
const MOON_AT = new THREE.Vector3(-3.4, 2.1, -5.6);
{
  const v = new Carve();
  const R = 20;
  for (let x = -R; x <= R; x++)
    for (let y = -R; y <= R; y++)
      if (x * x + y * y <= R * R) {
        const crater =
          Math.hypot(x - 8, y - 5) < 5 || Math.hypot(x + 9, y + 8) < 7 ||
          Math.hypot(x + 4, y - 12) < 4 || Math.hypot(x - 12, y + 11) < 3;
        v.set(x, y, 0, crater ? CRATER : MOON);
      }
  const occ = new Map();
  for (const k of v.cells.keys()) occ.set(k, {});
  const geo = meshCells({ cells: v.cells, occ, pivot: [0, 0, 0], vx: VX, shade: false });
  const matl = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const moon = new THREE.Mesh(geo, matl);
  moon.position.copy(MOON_AT);
  scene.add(moon);
}

// a soft halo behind it, and the same trick reused for every lantern
function glowSprite(color, size, opacity = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 63);
  g.addColorStop(0, `rgba(255,255,255,${opacity})`);
  g.addColorStop(.35, `rgba(255,255,255,${opacity * .28})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), color,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false,
  }));
  sp.scale.set(size, size, 1);
  scene.add(sp);
  return sp;
}
glowSprite(0x5a6a96, 5.5, .5).position.copy(MOON_AT);

// ---- the lights -----------------------------------------------------
// A dim blue ambient so the dark side of a face is night-coloured
// rather than missing; the moon as the shadow-casting key; and three
// lanterns at three radii, heights and speeds — one running backwards,
// so the pattern never repeats. The warm one drags real shadows.
scene.add(new THREE.HemisphereLight(0x51619a, 0x120e1c, 1.05));

// The crowd faces the camera and the moon is BEHIND it, so moonlight
// alone rims twenty backs and shows nobody's face. This is the fill:
// a soft front light, no shadows, just enough to read expressions by —
// the lamps then paint colour over it as they pass.
const fillLight = new THREE.DirectionalLight(0x8d97c8, .62);
fillLight.position.set(2.5, 3, 9);
scene.add(fillLight, fillLight.target);

const moonLight = new THREE.DirectionalLight(0xb9c8ff, 2.4);
moonLight.position.copy(MOON_AT);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
Object.assign(moonLight.shadow.camera, { left: -10, right: 10, top: 10, bottom: -4, near: 1, far: 38 });
moonLight.shadow.bias = -.0008;
// normalBias beats bias on voxel stairsteps: it pushes the sample along
// the normal, so the shadow acne goes without the shadow detaching
moonLight.shadow.normalBias = .06;
scene.add(moonLight, moonLight.target);

const LAMPS = [
  // the warm one is the show: it casts, so the crowd's shadows wheel
  // around the floor as it orbits
  { col: 0xffa14b, r: 4.6, y: 1.9, spd: .40, ph: 0, power: 34, casts: true },
  { col: 0x86ffb0, r: 6.4, y: 1.3, spd: -.23, ph: 2.1, power: 20, casts: true },
  { col: 0x7fb0ff, r: 3.4, y: 3.2, spd: .59, ph: 4.2, power: 25, casts: false },
].map(L => {
  const light = new THREE.PointLight(L.col, L.power, 0, 2);
  if (L.casts) {
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -.002;
    light.shadow.normalBias = .06;
  }
  const bulb = new THREE.Mesh(
    new THREE.BoxGeometry(VX * 1.6, VX * 1.6, VX * 1.6),
    new THREE.MeshBasicMaterial({ color: L.col, toneMapped: false }),
  );
  const glow = glowSprite(L.col, .7, .8);
  scene.add(light, bulb);
  return { ...L, light, bulb, glow };
});

// ---- ground mist ----------------------------------------------------
// A dozen soft grey sprites drifting slowly across the platform at
// ankle height. Normal blending and whisper opacity — mist is the
// absence of contrast, and an additive fog would glow like a lamp.
const MIST = [];
{
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 63);
  g.addColorStop(0, 'rgba(200,205,235,.55)');
  g.addColorStop(.55, 'rgba(200,205,235,.22)');
  g.addColorStop(1, 'rgba(200,205,235,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: .05 + Math.random() * .05,
      depthWrite: false, toneMapped: false,
      rotation: Math.random() * Math.PI * 2,
    });
    const sp = new THREE.Sprite(m);
    const sc = 2.6 + Math.random() * 2.4;
    sp.scale.set(sc, sc * .45, 1);
    scene.add(sp);
    MIST.push({
      sp, m,
      x: (Math.random() - .5) * 14, z: (Math.random() - .5) * 10,
      y: .12 + Math.random() * .3,
      spd: .08 + Math.random() * .1, rot: (Math.random() - .5) * .05,
    });
  }
}

// the pumpkin nearest the crowd burns from inside
const pumpLight = new THREE.PointLight(0xff9a3c, 3.6, 4, 2);
pumpLight.position.set(38 * VX, .35, -84 * VX);
scene.add(pumpLight);

// ---- the crowd ------------------------------------------------------
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
// the night picks the wardrobe: mostly gloom and graphite, the loud
// palettes rationed to an accent or two per crowd
const PAL_W = [['gloom', 30], ['graphite', 26], ['clay', 20], ['crayon', 14], ['candy', 10]];
function pickPalette() {
  let x = Math.random() * PAL_W.reduce((a, p) => a + p[1], 0);
  for (const [id, w] of PAL_W) { if ((x -= w) < 0) return id; }
  return 'graphite';
}

const slots = [];
for (let i = 0; i < N; i++) {
  const c = i % COLS, r = (i / COLS) | 0;
  slots.push({
    i,
    x: (c - (COLS - 1) / 2) * SPACE,
    z: (r - (ROWS - 1) / 2) * SPACE,
    face: null, anim: null, recipe: null, mount: 1,
  });
}

let queue = [];
function fill() {
  for (const s of slots) if (s.face) { scene.remove(s.face.holder); s.face.dispose(); s.face = null; }
  queue = slots.slice();
}

// THE SEATING PLAN: cats down front, dogs behind them, and the two
// back rows for everyone on two legs. A class photo seats by height,
// and the quadrupeds are the short ones.
function speciesFor(slot) {
  const row = (slot.i / COLS) | 0;      // row 3 is nearest the camera
  if (row === 3) return 'cat';
  if (row === 2) return 'dog';
  return pick(['human', 'nightmare']);
}

function buildSlot(s) {
  if (s.face) { scene.remove(s.face.holder); s.face.dispose(); }
  const recipe = newVRecipe();
  recipe.species = speciesFor(s);
  recipe.palette = pickPalette();
  ensureVParams(recipe);
  const f = buildVoxelCharacter(recipe, { lit: true });
  // the holder is placed; the character inside it is only shifted onto
  // its own centre, so a quad's long body stays in its slot
  const holder = new THREE.Group();
  holder.position.set(s.x, 0, s.z);
  f.group.position.z = -f.stats.cz * VX;
  holder.add(f.group);
  scene.add(holder);
  f.holder = holder;
  s.face = f;
  s.recipe = recipe;
  s.mount = 0;                                       // assemble from nothing
  for (const e of f.entries) e.meshes[e.cur].geometry.setDrawRange(0, 0);
  s.anim = createVoxelAnimator(() => s.face, {
    breath: true, sway: true, blink: true, gaze: true, talk: false,
    phase: Math.random() * 40, amp: rnd(.8, 1.2),
  });
  hud();
}
fill();

// ---- pointer: drag looks around, a tap re-assembles someone ---------
let down = null;
const ray = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', ev => {
  down = { x: ev.clientX, y: ev.clientY, az: view.az, el: view.el, moved: 0 };
  try { renderer.domElement.setPointerCapture(ev.pointerId); } catch { /* already gone */ }
});
renderer.domElement.addEventListener('pointermove', ev => {
  if (!down) return;
  const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
  down.moved = Math.max(down.moved, Math.hypot(dx, dy));
  view.az = down.az - dx * .009;
  view.el = Math.max(-.05, Math.min(1.2, down.el + dy * .006));
});
addEventListener('pointerup', ev => {
  if (down && down.moved < 5) tap(ev);
  down = null;
});
renderer.domElement.addEventListener('wheel', ev => {
  ev.preventDefault();
  view.halfH = Math.max(.8, Math.min(7, view.halfH * (1 + Math.sign(ev.deltaY) * .1)));
  onResize();
}, { passive: false });

function tap(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(
    ((ev.clientX - r.left) / r.width) * 2 - 1,
    -((ev.clientY - r.top) / r.height) * 2 + 1,
  ), camera);
  for (const hit of ray.intersectObjects(scene.children, true)) {
    if (!hit.object.visible || !hit.object.userData.partId) continue;
    const s = slots.find(s => s.face && hit.object.parent?.parent?.parent === s.face.group);
    if (s) { queue.push(s); return; }
  }
}

addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (e.key === 'r') fill();
});

// ---- hud ------------------------------------------------------------
function hud() {
  const el = document.getElementById('count');
  if (!el) return;
  const built = slots.filter(s => s.face);
  const tris = built.reduce((a, s) => a + s.face.stats.tris, 0);
  el.textContent = `${built.length}/${N} characters · ${tris} tris`;
}

// ---- the director ---------------------------------------------------
// Every second or so somebody is told to DO something — hop, pull a
// face, let a face go. Without this the crowd is twenty idle loops out
// of phase; with it there is always one thing happening somewhere,
// which is what "alive" actually looks like from this far away.
const MOODS = ['happy', 'angry', 'sad', 'scared'];
let nextAct = 3;
function direct(t) {
  if (t < nextAct) return;
  nextAct = t + .7 + Math.random() * 1.4;
  const s = slots[(Math.random() * slots.length) | 0];
  if (!s.face || s.mount < 1) return;
  const roll = Math.random();
  if (roll < .40) s.anim.hop();
  else if (roll < .70) s.anim.setFace(MOODS[(Math.random() * MOODS.length) | 0]);
  else s.anim.setFace('idle');            // moods drain back out again
}

// ---- loop -----------------------------------------------------------
const sstep = w => w * w * (3 - 2 * w);
let last = performance.now();
onResize();

function frame(now = performance.now()) {
  // clamped at BOTH ends: a hand-pumped frame can hand us a `now`
  // behind the last real one, and a negative dt runs the gaze springs
  // backwards
  const t = now / 1000, dt = Math.max(0, Math.min(.05, (now - last) / 1000));
  last = now;

  // build on a TIME budget, never one-per-frame
  if (queue.length) {
    const until = performance.now() + 20;
    do { buildSlot(queue.shift()); } while (queue.length && performance.now() < until);
  }

  for (const L of LAMPS) {
    const a = t * L.spd + L.ph;
    const x = Math.cos(a) * L.r, z = Math.sin(a) * L.r;
    const y = L.y + Math.sin(t * L.spd * 2.3 + L.ph) * .3;
    L.light.position.set(x, y, z);
    L.bulb.position.set(x, y, z);
    L.glow.position.set(x, y, z);
  }
  // a candle gutters; a steady flame would read as a bulb
  pumpLight.intensity = 2.3 + Math.sin(t * 11) * .5 + Math.sin(t * 23.7) * .35;

  // the mist crawls, turns over on itself, and wraps around
  for (const m of MIST) {
    m.x += m.spd * dt;
    if (m.x > 8) m.x = -8;
    m.m.rotation += m.rot * dt;
    m.sp.position.set(m.x, m.y + Math.sin(t * .3 + m.z) * .04, m.z);
  }

  direct(t);

  for (const s of slots) {
    if (!s.face) continue;
    if (s.mount < 1) {
      // the assembly: sweep drawRange up the pre-sorted triangles.
      // The animator waits — a body should not breathe until it has
      // finished existing.
      s.mount = Math.min(1, s.mount + dt / MOUNT_S);
      const f = sstep(s.mount);
      for (const e of s.face.entries) {
        const g = e.meshes[e.cur].geometry;
        g.setDrawRange(0, Math.floor(g.userData.tris * f) * 3);
      }
      if (s.mount >= 1)
        for (const e of s.face.entries) e.meshes[e.cur].geometry.setDrawRange(0, Infinity);
    } else s.anim.update(t, dt);
  }

  place();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// the decidable half — see CLAUDE.md
const yieldNow = () => new Promise(res => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => res();
  ch.port2.postMessage(0);
});

window.__vcrowd = {
  frame, slots, LAMPS, view,
  async pump(n = 60, step = 16) {
    renderer.setAnimationLoop(null);
    for (let i = 0; i < n; i++) { frame(last + step); await yieldNow(); }
    renderer.setAnimationLoop(frame);
  },
  refill: fill,
  stats: () => ({
    built: slots.filter(s => s.face).length,
    queued: queue.length,
    mounting: slots.filter(s => s.face && s.mount < 1).length,
    tris: slots.reduce((a, s) => a + (s.face?.stats.tris ?? 0), 0),
    species: slots.map(s => s.recipe?.species),
  }),
};
