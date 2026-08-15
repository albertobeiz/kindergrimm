// ---------------------------------------------------------------
// KINDERGRIMM — keep the children in the light, and tell them what
// to do.
//
// THE LOOP
//   Click a child to pick it up; its stats show at the top. What you
//   click next is an ORDER: the floor to walk there, a bed to rest, a
//   toy to play, a nightmare to go at it. Children do NOTHING on
//   their own — an idle child is a child burning down, and every bit
//   of progress in this game is something you told someone to do.
//
//   Playing fills the bar — and costs the child energy, because the
//   only thing here that makes progress has to be paid for. It can
//   never take the LAST of it: at 10% the child puts the toy down by
//   itself, so nobody is ever lost to a game they were told to enjoy.
//   When the
//   bar fills, everything STOPS and a hand of six objects is dealt: a
//   lamp, a toy, a bed, and three things a child can carry. You keep
//   ONE. Carried things ask which child; furniture asks where on the
//   floor.
//
//   The room is black outside the lamps, and the dark is the ONLY
//   thing that takes energy from a child. Nightmares eat the
//   furniture; they never touch anybody. At zero energy a child's
//   parents come and take it home. A child is three
//   numbers — ENERGY, ATTACK, SPEED — and every object on a card
//   moves one of them.
//
// THE VIEW is 3D: floor on XZ, orbiting orthographic camera, and
// every upright drawing a billboard yawed to face it. See
// ARCHITECTURE.md §6b.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { ROOM_BG, makeFloorTexture, makeShadowTextures } from './ground.js';
// only the opening hand is hand-authored now; everything the draft
// offers later is generated (see src/items/)
import { makeProp, drawBedTop, drawBall, drawLantern } from './scenery.js';
import { createDarkness } from './dark.js';
import { createPostFX } from './postfx.js';
import { Sketch } from './sketch.js';
import { setRender, U } from './part.js';
import { newRecipe, buildCharacter, ensureParams, setDepthRank, shadowOrder, LAYER } from './rig.js';
import { createAnimator } from './anim.js';
import { drawOffers, bumpFavor, thumbFor, propDrawFor, aggregate, rollItem } from './items/index.js';
import { applyStats, withArticle } from './items/core.js';
import { audio } from './audio.js';

setRender({ u: 96, frames: 2 });
THREE.ColorManagement.enabled = false;

// ---- the numbers ------------------------------------------------
const ROOM_R = 13;
const KID_H = 1.9;
const AMBIENT = .015;                    // the FLOOR goes properly black
const DARK_VIS = .16;                    // …but a body in the dark still reads
                                         // as a shape. You should always be able
                                         // to see where everyone is.
const BODY_R = .42;

// Slow on purpose. You need long enough to watch what is actually
// happening before anything is at stake — a child standing in the
// light is good for minutes, and only the dark is urgent.
const STAM_MAX = 100;
const DRAIN_IDLE = .3, DRAIN_DARK = 2;
// Playing is WORK. The bar is the only thing in this game that makes
// progress, and it has to be paid for in the same currency the dark
// charges — otherwise the right move is always "everyone on a toy,
// forever" and a bed is just something the nightmares eat. It stacks
// ON TOP of the dark, so playing out where you cannot see is the
// worst thing you can ask of a child, which is exactly right.
const DRAIN_PLAY = 1.6;
// …but playing may never send a child home. Below this fraction of
// max energy they put the toy down on their own (see stepKid). Only
// the DARK can take the last of a child's energy.
const PLAY_STOP = .1;
// THE DARK IS THE ONLY THING THAT TAKES ENERGY FROM A CHILD.
// A nightmare standing over one used to drain it too, and that was a
// hidden mechanic: nothing on screen said the child was being emptied,
// and it broke the one promise the room makes plainly — that a child
// inside the light is safe and outside it is not. Nightmares eat the
// furniture. If driving them off needs to be worth a child's time,
// buy it with something you can SEE, not with a clock nobody can read.
const RECOVER = 4;
const TIRED = 25;
const PLAY_WEAR = 1.5, BED_WEAR = 1.2;

// The first bars fill in seconds, and the need grows LINEARLY — an
// exponential need outran the class and the rewards dried up while
// the threat stayed flat. Now the bar stays honest and the ramp
// lives in the nightmares instead (see mareStats).
const XP_RATE = .38;                     // bar per second of play, x the toy
const XP_STEP = 1.35;                    // flat growth per level
let xpNeed = 1.6;

const MARE_V = .5, MARE_CHEW = 9, MARE_HP = 6;
const MARE_SLOW = .88, MARE_EVERY = 16;

// Everything about a nightmare grows with the level — how often they
// come, how much they take, how fast they move, how hard they are to
// drive off. Gentle slopes on purpose: the draft is still the ramp
// the player CHOOSES; this is just the night keeping pace with it.
// Rolled at spawn, so an old mare keeps the night it was born into.
function mareStats() {
  const L = state.level;
  return {
    every: Math.max(6, MARE_EVERY - L * .4),
    hp: MARE_HP + L * .4,
    v: MARE_V * (1 + Math.min(.6, L * .02)),
    chew: MARE_CHEW * (1 + L * .03),
  };
}

const state = {
  xp: 0, level: 0, lost: 0, over: false, flash: 0, gloom: 0,
  // `started` is the title screen and `paused` is the draft. Two
  // flags, because they stop the world for opposite reasons: the
  // draft freezes a game in progress, the title holds one that has
  // not begun — and the class is still being BUILT behind it.
  started: false,
  paused: false, offers: null, pending: null, selected: null,
  // every fifth level a new child knocks. `kidDue` is set when the bar
  // fills on such a level and cashed AFTER the card pick resolves, so
  // the two choices never sit on screen at once; `choosing` is the
  // card screen, `pendingKid` the child waiting for a spot on the
  // floor — the same two beats as an object.
  kidDue: false, choosing: false, pendingKid: null,
  // how much the toybox likes each family of object. Picking one
  // makes it both commoner and better; everything else fades.
  favor: {},
};

// ---- boot -------------------------------------------------------
const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(ROOM_BG);

let halfH = 8.5;
const ZOOM_MIN = 3.4, ZOOM_MAX = 26;
const ORBIT_R = 16, ORBIT_Y = 9.6;
const PAN_R = 16;                        // how far from the middle you may wander
let camAz = .55, camAzWant = .55;
// where the camera is looking: `want` is what input sets, `at` is the
// smoothed value the camera actually uses, so every move glides
const camWant = new THREE.Vector3(), camAt = new THREE.Vector3();
const camera = new THREE.OrthographicCamera(-1, 1, halfH, -halfH, .1, 100);
const view = { az: camAz, rightX: 1, rightZ: 0 };
const TOUCH = matchMedia('(pointer: coarse)').matches;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
stage.appendChild(renderer.domElement);
const postfx = createPostFX(renderer);

function onResize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.top = halfH; camera.bottom = -halfH;
  camera.left = -halfH * (w / h); camera.right = halfH * (w / h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  const pr = renderer.getPixelRatio();
  postfx.resize(Math.round(w * pr), Math.round(h * pr));
}
addEventListener('resize', onResize);

// keep the view over the room: the further out you zoom the less
// there is to pan to, or you drag the edge of the floor into shot.
// Returns whether it actually had to pull the target back, which the
// drag uses to re-anchor itself against the wall.
function clampPan() {
  const lim = Math.max(0, PAN_R - halfH * .5);
  const d = Math.hypot(camWant.x, camWant.z);
  if (d <= lim) return false;
  camWant.x *= lim / d; camWant.z *= lim / d;
  return true;
}

function setZoom(v) {
  halfH = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
  clampPan();
  // A wheel during a live drag changes how many world units a pixel is
  // worth, and the drag measures itself from the pixel it started on.
  // Re-anchor on the finger where it is now, or the view snaps back to
  // the target the pan began with. (Declared below; only ever reached
  // from an event, long after this module has finished evaluating.)
  if (drag) {
    const p = ptrs.get(drag.id);
    if (p) { drag.from.copy(camWant); drag.x0 = p.x; drag.y0 = p.y; }
  }
  onResize();
}

function updateCamera(dt) {
  camAzWant += ((keys.q ? 1 : 0) - (keys.e ? 1 : 0)) * 1.2 * dt;
  // ease toward what input asked for, framerate-independently, so a
  // 90° button press swings rather than snaps
  const k = 1 - Math.pow(.0008, dt);
  camAz += (camAzWant - camAz) * k;
  camAt.lerp(camWant, 1 - Math.pow(.0025, dt));

  view.az = camAz;
  camera.position.set(camAt.x + Math.sin(camAz) * ORBIT_R, ORBIT_Y, camAt.z + Math.cos(camAz) * ORBIT_R);
  camera.lookAt(camAt.x, .6, camAt.z);
  view.rightX = Math.cos(camAz);
  view.rightZ = -Math.sin(camAz);
}

const lookAtXZ = (x, z) => { camWant.set(x, 0, z); clampPan(); };

// A sound from a place in the room: panned along the camera's right
// axis and quieter with distance from where you are looking. Gentle
// on purpose — this is a diorama heard from outside, not a world the
// listener stands inside of.
function sfxAt(name, x, z, o = {}) {
  const dx = x - camAt.x, dz = z - camAt.z;
  const pan = (dx * view.rightX + dz * view.rightZ) / (halfH * 1.3);
  const d = Math.hypot(dx, dz);
  audio.sfx(name, { ...o, pan, vol: (o.vol ?? 1) / (1 + (d * d) / 140) });
}

const depthKey = (x, z) => x * Math.sin(camAz) + z * Math.cos(camAz);

// ---- the room ---------------------------------------------------
const TILE = 8;
for (let ix = -4; ix <= 4; ix++) {
  for (let iz = -4; iz <= 4; iz++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE, TILE),
      new THREE.MeshBasicMaterial({ map: makeFloorTexture(`${ix}:${iz}`) }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(ix * TILE, 0, iz * TILE);
    m.renderOrder = -10000;
    scene.add(m);
  }
}

const darkness = createDarkness(scene);
const SHADOWS = makeShadowTextures(4);

const POOL_TEX = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 6, 128, 128, 126);
  grd.addColorStop(0, 'rgba(255,226,160,.20)');
  grd.addColorStop(.5, 'rgba(255,216,150,.10)');
  grd.addColorStop(1, 'rgba(255,210,140,0)');
  g.fillStyle = grd;
  g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
})();

// ---- the marks that float over a child in trouble ---------------
// A colour pulse tells you something is wrong; a mark over the head
// tells you WHICH thing, from across a dark room, without selecting
// anybody. Drawn the way a child would: a fat exclamation, or three
// sleepy z's.
function makeMarkTexture(kind) {
  const s = new Sketch(128, 128);
  s.boil(kind === 'tired' ? 11 : 23);
  if (kind === 'tired') {
    for (let i = 0; i < 3; i++) {
      const sz = 34 - i * 9, x = 24 + i * 30, y = 92 - i * 30;
      s.stroke([[x, y - sz], [x + sz, y - sz], [x, y], [x + sz, y]], 6 - i * 1.2,
        { taper: .12, alpha: 1, amp: .5 });
    }
  } else {
    s.stroke([[64, 20], [64, 78]], 15, { taper: .2, alpha: 1, wedge: true });
    s.ctx.fillStyle = s.inkA(1);
    s.wobbly(64, 102, 8, 8);
    s.ctx.fill();
  }
  return new THREE.CanvasTexture(s.canvas);
}
const MARK_TIRED = makeMarkTexture('tired');
const MARK_ALERT = makeMarkTexture('alert');

function makeMark() {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(.85, .85),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 }),
  );
  m.visible = false;
  m.renderOrder = 900000;         // over everyone; it is a UI element
  scene.add(m);
  return m;
}

// the chalk ring under whoever you have picked up
const RING_TEX = (() => {
  const s = new Sketch(256, 256);
  s.boil(7);
  for (let k = 0; k < 2; k++) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2, r = 108 + s.jr(-5, 5);
      pts.push([128 + Math.cos(a) * r, 128 + Math.sin(a) * r]);
    }
    s.sline(pts, 3.4, .85);
  }
  return new THREE.CanvasTexture(s.canvas);
})();

function makePool(r) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: POOL_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = .05;
  m.renderOrder = -8000;
  scene.add(m);
  return m;
}

const ring = new THREE.Mesh(
  new THREE.PlaneGeometry(1.5, 1.5),
  new THREE.MeshBasicMaterial({ map: RING_TEX, transparent: true, depthWrite: false, opacity: .8 }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = .07;
ring.renderOrder = -7900;
ring.visible = false;
scene.add(ring);

// ---- objects ----------------------------------------------------
const things = [], kids = [], mares = [];
const pickables = [];              // invisible proxies, one per clickable entity

// A proxy is what the mouse actually hits: raycasting every part mesh
// of every child would be both slow and wrong — you would miss the
// gaps between the strokes. One quad per entity, invisible,
// billboarded. Invisible objects still raycast.
function addPick(ent, w, h, flat = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial());
  if (flat) m.rotation.x = -Math.PI / 2;
  else m.geometry.translate(0, h / 2, 0);
  m.visible = false;
  m.userData.ent = ent;
  // stand it where the thing is straight away. Characters get theirs
  // re-placed every frame; a bed does not move, and leaving it at the
  // origin means the bed is unclickable and the origin is a bed.
  m.position.set(ent.x ?? 0, flat ? .03 : 0, ent.z ?? 0);
  scene.add(m);
  pickables.push(m);
  ent.pick = m;
  return m;
}

function dropPick(ent) {
  if (!ent.pick) return;
  scene.remove(ent.pick);
  const i = pickables.indexOf(ent.pick);
  if (i >= 0) pickables.splice(i, 1);
  ent.pick.geometry.dispose(); ent.pick.material.dispose();
  ent.pick = null;
}

function addThing(o) {
  const mesh = makeProp({
    draw: o.draw, wU: o.wU, hU: o.hU, flat: !!o.flat,
    // a generated object passes its own seed so the thing on the floor
    // is the same drawing the card showed
    seed: o.seed ?? `${o.kind}${things.length}:${(Math.random() * 1e6) | 0}`,
  });
  if (o.flat) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    mesh.position.set(o.x, .02, o.z);
    mesh.renderOrder = -9500;
  } else mesh.position.set(o.x, 0, o.z);
  scene.add(mesh);

  const t = { ...o, mesh };
  // how good a toy is at being played with — the toy carries this,
  // not the child, so a better toy is a real upgrade for everybody
  if (o.kind === 'toy') t.play = o.play ?? (.8 + Math.random() * .7);
  if (o.kind === 'light') {
    t.pool = makePool(o.r);
    t.pool.position.set(o.x, .05, o.z);
  }
  // generous on purpose: a ball is 0.6 units across and would be a
  // pixel hunt at any sensible zoom
  if (o.kind === 'bed' || o.kind === 'toy') {
    addPick(t, Math.max(o.wU, 1.2), o.flat ? Math.max(o.hU, 1.6) : Math.max(o.hU, 1.2), !!o.flat);
  }
  things.push(t);
  return t;
}

// Objects come and go all night in this room, and every generated one
// bakes its OWN CanvasTexture — so letting them go without disposing
// grows the GPU footprint for the whole session.
//
// `ownTexture` matters: a prop's map belongs to that prop alone, but
// the pools, rings, marks and marbles all share one module-level
// texture between every instance. Disposing a shared map would blank
// every other one in the room.
function freeMesh(m, ownTexture = false) {
  if (!m) return;
  scene.remove(m);
  m.geometry?.dispose();
  if (ownTexture) m.material?.map?.dispose();
  m.material?.dispose();
}

function removeThing(t) {
  freeMesh(t.mesh, true);            // its drawing is its own
  freeMesh(t.pool);                  // …but the glow decal is shared
  dropPick(t);
  for (const k of kids) if (k.order && k.order.obj === t) { k.order = null; k.act = 'idle'; }
  const i = things.indexOf(t); if (i >= 0) things.splice(i, 1);
}

// ---- light ------------------------------------------------------
function lightPower(l, t) {
  const k = Math.max(0, Math.min(1, l.fuel / (l.maxFuel || 1)));
  let p = .3 + .7 * Math.min(1, k / .55);
  if (k < .16) p *= .82 + .18 * Math.sin(t * 17 + l.x * 3);
  return p;
}

// rebuilt once a frame — lightAt() is called dozens of times and must
// not walk the whole scene each time
let LIGHTS = [];
function rebuildLights(t) {
  LIGHTS = [];
  for (const l of things) {
    if (l.kind !== 'light' || l.fuel <= 0) continue;
    l.power = lightPower(l, t);
    LIGHTS.push({ x: l.x, z: l.z, r: l.r * l.power });
  }
  for (const k of kids) {
    if (k.lampR <= 0) continue;
    // a `flickery` curse never quite lets them trust their own lamp
    const f = k.curses.has('flicker') ? .74 + .26 * Math.sin(t * 9 + k.id * 2) : 1;
    LIGHTS.push({ x: k.x, z: k.z, r: k.lampR * f });
  }
}

function lightAt(x, z) {
  let acc = 0;
  for (const l of LIGHTS) {
    const d = Math.hypot(x - l.x, z - l.z);
    const t = d / l.r;
    acc += Math.max(0, (1 / (1 + 2.2 * t * t) - .08) / .92);
  }
  return 1 - Math.exp(-acc * 2.8);
}

// ---- characters -------------------------------------------------
const WARM = {
  eyes: ['closed', 'left', 'right', 'up', 'down', 'scared'],
  mouth: ['scared'], quadlegs: ['stepA', 'stepB', 'fold'],
};

function makeFace(recipe) {
  ensureParams(recipe);
  const face = buildCharacter(recipe);
  for (const e of face.entries) {
    const warm = WARM[e.id];
    if (!warm) continue;
    const cur = e.part.cur.state;
    for (const st of warm) e.part.setState(st);
    e.part.setState(cur);
  }
  return face;
}

// The height in the room is held constant while the DRAWING changes:
// scale is derived from the head, so a big-head mutation makes the
// head bigger against the body instead of making the child a giant.
// `sizeJit` is the one-off personal size, kept across rebuilds so a
// child never pops when it gains a hat.
function fitBody(c) {
  const face = c.face;
  c.scale = (c.wantH / 1.4) * (.58 / (face.F.s / U)) * c.sizeJit * (c.stats?.scale ?? 1);
  const sw = (face.F.B.halfW * 3.0) / U * c.scale;
  c.shadow.geometry.dispose();
  c.shadow.geometry = new THREE.PlaneGeometry(sw, sw * .5);
  // the click target has to grow with the child, or a giant is
  // unclickable round its edges and a shrunk one steals clicks from
  // the floor behind it
  const pb = c.pickBase;
  if (c.pick && pb) {
    const f = c.scale / pb.scale;
    const w = pb.w * f, h = pb.h * f;
    c.pick.geometry.dispose();
    c.pick.geometry = new THREE.PlaneGeometry(w, h);
    c.pick.geometry.translate(0, h / 2, 0);
  }
}

const GEAR_SLOTS = ['held', 'offhand', 'worn'];

function buildBody(species, wantH, gear = true) {
  const recipe = newRecipe();
  recipe.species = species;
  recipe.media = 'graphite';
  recipe.base = null;
  // A CHILD starts with nothing in its hands. The gear parts roll a
  // small chance of random kit, which is right for the editor and the
  // crowd page but a lie here: a child drawn holding a sword that is
  // not in its belongings breaks the one promise this whole system
  // makes. Nightmares keep theirs — they have no inventory to
  // contradict, and a scribbled crown suits them.
  if (!gear) for (const id of GEAR_SLOTS)
    recipe.parts[id] = { params: { family: 'none', rank: 'sketch', seed: 0 }, lock: true };
  const face = makeFace(recipe);

  const holder = new THREE.Group();
  face.group.position.y = face.F.B.floorY / U;
  holder.add(face.group);
  scene.add(holder);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, .5),
    new THREE.MeshBasicMaterial({
      map: SHADOWS[(Math.random() * SHADOWS.length) | 0],
      transparent: true, depthWrite: false, opacity: .8,
    }),
  );
  shadow.rotation.order = 'YXZ';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .06 + Math.random() * .02;
  scene.add(shadow);

  const c = {
    face, holder, shadow, wantH, sizeJit: .92 + Math.random() * .16,
    scale: 1, parts: face.entries.map(e => e.part.matl),
  };
  fitBody(c);
  return c;
}

// Rebuild a character from its own (patched) recipe, in place. This is
// how an item changes what a child IS rather than what it carries.
// It costs ~20ms, so it may only ever happen while the draft has the
// world stopped — never during play.
//
// Three things must be re-pointed or they quietly rot: the cached
// material list (the light tint would keep writing to disposed
// materials and the new child would never light), the feet lift (the
// animator never writes face.group), and the depth rank (a fresh face
// has rank null, which the board sort re-stamps for free).
function rebuildFace(c) {
  const recipe = c.face.recipe;
  c.holder.remove(c.face.group);
  c.face.dispose();
  c.face = makeFace(recipe);
  c.face.group.position.y = c.face.F.B.floorY / U;
  c.holder.add(c.face.group);
  c.parts = c.face.entries.map(e => e.part.matl);
  fitBody(c);
}

const NAMES = ['Poppy', 'Tam', 'Pearl', 'Wren', 'Nils', 'Juno', 'Bruno', 'Lilo'];

// Every live stat is DERIVED, never edited in place: `k.base` is who
// the child was born as, `k.items` is what it is carrying, and
// `recomputeKid` re-runs the whole sum whenever the set changes.
// Re-deriving rather than multiplying is what stops swapping a sword
// from drifting the numbers a little further every single draft.
function recomputeKid(k) {
  const { stats, fx } = aggregate(k.items);
  k.stats = applyStats(k.base, stats);
  k.fx = fx;
  // every stat is flattened onto the child so the sim can read
  // `k.speed` — EXCEPT `scale`, which is not a number the sim reads
  // but a multiplier on the body fit. Copying it here would clobber
  // the size derived from the head and shrink every child to 1.
  for (const key in k.stats) if (key !== 'scale') k[key] = k.stats[key];
  if (k.face) fitBody(k);
  // curses ride along with whatever granted them. The ones that are
  // pure numbers are already folded into the bag above; these are the
  // ones the simulation has to look up by name.
  k.curses = new Set(k.items.filter(it => it.curse).map(it => it.curse.id));
  k.stamina = Math.min(k.stamina, k.maxStam);
  if (k.lampR > 0 && !k.lampPool) k.lampPool = makePool(2.6);
  if (k.lampR <= 0 && k.lampPool) { scene.remove(k.lampPool); k.lampPool = null; }
  refreshAura(k);
  refreshPet(k);
}

// An effect with a radius gets a chalk circle, whatever slot granted
// it — a snail's chill reaches as far as a bell's. This lives here
// rather than in giveItem because EVERY path that changes a child's
// belongings comes through recomputeKid, and only one of them used to
// remember to do it.
function refreshAura(k) {
  let kind = AURA_KINDS.find(a => k.fx[a] > 0);
  let r = kind ? k.fx[kind] : 0;
  // `bait` is a curse, not an fx — but it is the most spatial thing a
  // child can carry, and a pull you cannot see is exactly the unread
  // stat this game promises not to have. Radius matches the pull in
  // nearestBreakable.
  if (!kind && k.curses.has('bait')) { kind = 'bait'; r = 6; }
  const want = kind ? `${kind}:${r.toFixed(2)}` : '';
  if (k.auraKey === want) return;
  k.auraKey = want;
  if (k.aura) {
    scene.remove(k.aura);
    k.aura.geometry.dispose(); k.aura.material.dispose();
    k.aura = null;
  }
  if (kind) k.aura = makeAura(kind, r);
}

// A second, better doll should upgrade the animal you already have
// rather than silently do nothing.
function refreshPet(k) {
  const f = k.fx.familiar;
  const pet = pets.find(p => p.owner === k);
  if (!f) return;
  if (!pet) { spawnPet(k, f); return; }
  pet.bite = Math.max(pet.bite, f.bite ?? 0);
  pet.r = Math.max(pet.r, f.r ?? 0);
}

// Ids are a counter, never an index: a candidate at the door consumes
// one whether or not it stays, and the id seeds animation phases and
// pet ids — a duplicate means two children blinking in lockstep.
let nextKidId = 0;

function rollBase() {
  return {
    speed: .9 + Math.random() * .7,
    dmg: 1.4 + Math.random() * .6,
    reach: 1.7, swingT: .85, rest: 1, lampR: 0,
    scale: 1, maxStam: STAM_MAX, drain: 1, knock: 2.6,
  };
}

// Build a child but do NOT enlist it — the door scene needs children
// who exist, breathe and can be tapped without yet being anyone's to
// command. `spawnKid` below is the only caller that enlists.
function makeKid(x, z, base) {
  const body = buildBody('human', KID_H, false);
  const id = nextKidId++;
  const k = {
    ...body, kind: 'kid', id, name: NAMES[id % NAMES.length],
    x, z,
    h: Math.random() * Math.PI * 2, rad: BODY_R,
    stamina: base.maxStam ?? STAM_MAX,
    base,
    items: [], fx: {}, curses: new Set(), lampPool: null,
    act: 'idle', order: null, aura: null,
    lit: 1, gone: false, swing: 0, warned: false,
    throwT: 0,
  };
  // the getter must read the LIVE face: a mutation rebuilds it, and a
  // closure over the original would animate a disposed character
  k.animator = createAnimator(() => k.face, {
    blink: true, gaze: true, talk: false, sway: true, breath: true,
    boil: true, boilSpeed: .5, phase: Math.random() * 20, amp: 1.1,
  });
  recomputeKid(k);
  addPick(k, 1.1, 2.1);
  // remember the size the proxy was cut at, so `fitBody` can re-cut it
  // in proportion when an object makes this child bigger or smaller
  k.pickBase = { w: 1.1, h: 2.1, scale: k.scale };
  k.mark = makeMark();
  return k;
}

function spawnKid() {
  const a = Math.random() * Math.PI * 2, r = .8 + Math.random() * 1.6;
  const k = makeKid(Math.cos(a) * r, Math.sin(a) * r, rollBase());
  kids.push(k);
  return k;
}

function spawnMare() {
  const body = buildBody('nightmare', 1.7);
  const a = Math.random() * Math.PI * 2, r = ROOM_R + 3;
  const ms = mareStats();
  const m = {
    ...body, kind: 'mare',
    x: Math.cos(a) * r, z: Math.sin(a) * r,
    h: 0, rad: BODY_R * 1.25, hp: ms.hp, v: ms.v, chew: ms.chew,
    dying: 0, stagger: 0,
    hitFlash: 0, knock: null, target: null, retarget: 0,
    mired: 0,
  };
  m.animator = createAnimator(() => m.face, {
    blink: true, gaze: true, talk: false, sway: true, breath: true,
    boil: true, boilSpeed: .8, phase: Math.random() * 20, amp: 1.5,
  });
  m.animator.setPose('walk', { speed: .5 });
  addPick(m, 1.2, 2);
  mares.push(m);
  sfxAt('loom', m.x, m.z, { vol: .8 });  // arriving at the edge of hearing
  return m;
}

function despawn(c, list) {
  scene.remove(c.holder);
  freeMesh(c.shadow);                        // SHADOWS[] is shared
  freeMesh(c.lampPool);
  freeMesh(c.aura);
  freeMesh(c.mark);
  dropPick(c);
  c.face.dispose();
  const i = list.indexOf(c); if (i >= 0) list.splice(i, 1);
  if (state.selected === c) state.selected = null;
  // whatever this child was carrying goes home with it
  for (const p of [...pets]) if (p.owner === c) despawn(p, pets);
  // and a marble already in the air is nobody's now
  for (const s of shots) if (s.from === c) s.life = 0;
}

// ---- giving a child an object -----------------------------------
// A chalk circle on the floor, for the objects whose effect has a
// RADIUS. An aura you cannot see is a stat with no consequence, and
// this game's whole promise is that you can read power off the page.
const AURA_TEX = (() => {
  const s = new Sketch(256, 256);
  s.boil(31);
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 44; i++) {
      const a = (i / 44) * Math.PI * 2, r = 112 - k * 7 + s.jr(-6, 6);
      pts.push([128 + Math.cos(a) * r, 128 + Math.sin(a) * r]);
    }
    s.sline(pts, 2.2, .5);
  }
  return new THREE.CanvasTexture(s.canvas);
})();

const AURA_COL = {
  chill: [.6, .8, 1],
  lull: [.75, .7, 1], fear: [1, .6, .55], thrift: [.7, 1, .75],
  bait: [1, .45, .4],                    // the circle the nightmares read
};

function makeAura(kind, r) {
  const c = AURA_COL[kind] ?? [1, 1, 1];
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({
      map: AURA_TEX, transparent: true, depthWrite: false, opacity: .28,
      blending: THREE.AdditiveBlending,
    }),
  );
  m.material.color.setRGB(c[0], c[1], c[2]);
  m.rotation.x = -Math.PI / 2;
  m.position.y = .06;
  m.renderOrder = -7850;                 // over the pools, under the ring
  scene.add(m);
  return m;
}

// The one place an item is attached to a child. Slots that hold one
// thing swap; charms and mutations stack. A mutation is the expensive
// one: it patches the RECIPE and rebuilds the character, which is
// only affordable because the draft has the world stopped.
const AURA_KINDS = ['chill', 'lull', 'fear', 'thrift'];

function giveItem(k, item) {
  if (item.slot === 'mutation') {
    // each change happens to a child only once — a second pair of
    // horns is not a second pair of horns
    if (k.items.some(i => i.family === 'mutation' && i.P.kind === item.P.kind)) return false;
    k.items.push(item);
    if (item.patch) {
      mergePatch(k.face.recipe, item.patch);
      recomputeKid(k);
      rebuildFace(k);
    } else {
      // a size change touches no part: the same drawing, held bigger.
      // No reason to pay 20ms redrawing every canvas.
      recomputeKid(k);
    }
    return true;
  }

  if (item.slot === 'held' || item.slot === 'offhand' || item.slot === 'worn') {
    const held = k.items.find(i => i.slot === item.slot);
    if (held) {
      if (k.curses.has('stuck') && held.curse?.id === 'stuck') return false;
      k.items.splice(k.items.indexOf(held), 1);
    }
    k.items.push(item);
    // the gear parts derive their whole drawing from these three
    // values, so this is the entire hand-off from item to rig
    k.face.recipe.parts[item.slot] = {
      params: { family: item.family, rank: item.rank, seed: item.seed },
      lock: true,
    };
    recomputeKid(k);
    rebuildFace(k);
    return true;
  }

  k.items.push(item);                     // charms just stack
  recomputeKid(k);                        // …which refreshes the ring and the pet
  return true;
}

// Merge a mutation's recipe patch. `lock: true` so a later global
// regenerate cannot undo something the player chose.
function mergePatch(recipe, patch) {
  if (!patch?.parts) return;
  for (const id in patch.parts) {
    const slot = recipe.parts[id] ??= {};
    slot.params = { ...slot.params, ...patch.parts[id].params };
    slot.lock = true;
  }
}

// ---- familiars --------------------------------------------------
// A doll comes alive and trails the child who carries it. It is the
// one thing in the room with a mind of its own — it keeps station
// behind its owner and goes at anything that comes too close — which
// is exactly why it belongs to an OBJECT and not to a child: the rule
// that children do nothing on their own has to stay true.
//
// It is a real character, built from the same rig as everybody else,
// so a familiar can be a cat, a dog or a small nightmare depending on
// what the doll was made in the shape of.
const pets = [];

function spawnPet(owner, fx) {
  // knee-high at most: at a child's own height it stops reading as a
  // pet and starts reading as another child
  const body = buildBody(fx.species ?? 'cat', KID_H * .66 * (fx.scale ?? .7), false);
  const p = {
    ...body, kind: 'pet', owner,
    x: owner.x - .8, z: owner.z - .8, h: 0, rad: BODY_R * .55,
    bite: fx.bite ?? .5, r: fx.r ?? 3.5, swing: 0, id: owner.id + 90,
    // it hits in its owner's name, and from its OWN position so the
    // shove goes the right way — but with an empty `fx`, or the
    // owner's on-hit effects would fire twice per bite
    name: owner.name, fx: {}, knock: 2.2,
  };
  p.animator = createAnimator(() => p.face, {
    blink: true, gaze: true, talk: false, sway: true, breath: true,
    boil: true, boilSpeed: .9, phase: Math.random() * 20, amp: 1.3,
  });
  pets.push(p);
  return p;
}

function stepPet(p, t, dt) {
  if (p.owner.gone || !kids.includes(p.owner)) { despawn(p, pets); return; }

  // whatever is worrying the owner is the pet's business
  let foe = null, fd = 1e9;
  for (const m of mares) {
    if (m.dying > 0) continue;
    const d = Math.hypot(m.x - p.owner.x, m.z - p.owner.z);
    if (d < p.r && d < fd) { fd = d; foe = m; }
  }

  const speed = 1.7;
  if (foe) {
    const d = Math.hypot(foe.x - p.x, foe.z - p.z);
    p.h = Math.atan2(foe.z - p.z, foe.x - p.x);
    if (d > .7) {
      p.x += Math.cos(p.h) * speed * dt;
      p.z += Math.sin(p.h) * speed * dt;
      p.animator.setPose('run');
    } else if ((p.swing -= dt) <= 0) {
      p.swing = .8;
      p.animator.setPose('attack');
      strike(p, foe, p.bite, .5);
    }
    p.animator.setFace('angry');
    return;
  }

  // otherwise: heel, a little behind and to one side
  const hx = p.owner.x - Math.cos(p.owner.h) * .9;
  const hz = p.owner.z - Math.sin(p.owner.h) * .9;
  const d = Math.hypot(hx - p.x, hz - p.z);
  if (d > .35) {
    p.h = Math.atan2(hz - p.z, hx - p.x);
    const v = Math.min(speed, d * 2.4) * dt;
    p.x += Math.cos(p.h) * v; p.z += Math.sin(p.h) * v;
    p.animator.setPose('walk');
  } else p.animator.setPose('idle');
  p.animator.setFace('idle');
}

// ---- the marbles a wand throws ----------------------------------
// The one thing in this game that flies. It is a drawn pebble on a
// lobbed arc, and it exists so that "shoots" is a real answer to
// "what could an object do" without turning a baby school into a
// shooter: it staggers and chips, it never kills on its own.
const shots = [];
const SHOT_TEX = (() => {
  const s = new Sketch(64, 64);
  s.boil(17);
  const b = s.blobPts(32, 32, 15, 14, .2, .4);
  s.paperFill(b);
  s.stroke(b.concat([b[0]]), 3, { taper: .1, alpha: 1 });
  s.hatchFill(b, 5, -.7, .16, 1);
  return new THREE.CanvasTexture(s.canvas);
})();

function throwShot(k, m) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(.34, .34),
    new THREE.MeshBasicMaterial({ map: SHOT_TEX, transparent: true, depthWrite: false }),
  );
  // a marble in the air is over everybody; it is too small to be worth
  // a rank of its own on the board
  mesh.renderOrder = 500000;
  scene.add(mesh);
  const d = Math.hypot(m.x - k.x, m.z - k.z) || 1;
  shots.push({
    mesh, x: k.x, z: k.z, y: 1.1, from: k,
    vx: (m.x - k.x) / d * (k.fx.throw.speed ?? 7),
    vz: (m.z - k.z) / d * (k.fx.throw.speed ?? 7),
    vy: 1.4, dmg: k.fx.throw.dmg ?? 1, life: 2.5,
  });
  sfxAt('tick', k.x, k.z, { vol: .6 });
}

function stepShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.life -= dt;
    if (s.life <= 0 || s.y < .05) {          // spent, or its thrower went home
      freeMesh(s.mesh);
      shots.splice(i, 1);
      continue;
    }
    s.x += s.vx * dt; s.z += s.vz * dt;
    s.vy -= 5.2 * dt; s.y += s.vy * dt;
    let hit = null;
    for (const m of mares) {
      if (m.dying > 0) continue;
      if (Math.hypot(m.x - s.x, m.z - s.z) < m.rad + .3 && s.y < 1.7) { hit = m; break; }
    }
    if (hit) {
      strike(s.from, hit, s.dmg, .55);
      freeMesh(s.mesh);
      shots.splice(i, 1);
    }
  }
}

// A key charm carried anywhere near a bed or a toy makes it last
// longer — against fair wear AND against being chewed on, which is
// the thing that actually breaks the furniture in this room.
function thriftAt(x, z) {
  for (const k of kids) {
    if (!k.fx.thrift) continue;
    if (Math.hypot(k.x - x, k.z - z) < k.fx.thrift) return .55;
  }
  return 1;
}

// a nightmare wants the closest bed or toy and does not care who is
// using it — in fact that is the whole horror of the thing
function nearestBreakable(x, z) {
  // a child under a `wanted` curse drags them toward whatever it is
  // standing near — the price of a nightmare-drawn object
  let bait = null;
  for (const k of kids) if (k.curses.has('bait')) { bait = k; break; }
  let best = null, bd = 1e9;
  for (const t of things) {
    if ((t.kind !== 'bed' && t.kind !== 'toy') || t.dur <= 0) continue;
    let d = Math.hypot(t.x - x, t.z - z);
    if (bait) d -= Math.max(0, 6 - Math.hypot(t.x - bait.x, t.z - bait.z));
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

function separate() {
  const all = [...kids, ...mares, ...pets];
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (a.dying > 0) continue;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      if (b.dying > 0) continue;
      let dx = b.x - a.x, dz = b.z - a.z;
      let d = Math.hypot(dx, dz);
      const min = a.rad + b.rad;
      if (d >= min) continue;
      if (d < 1e-4) { dx = Math.cos(i * 2.4); dz = Math.sin(i * 2.4); d = 1; }
      const push = ((min - d) / d) * .5;
      a.x -= dx * push; a.z -= dz * push;
      b.x += dx * push; b.z += dz * push;
    }
  }
}

// ---- a child's turn ---------------------------------------------
const moveTo = (k, tx, tz, dt, mult = 1) => {
  const dx = tx - k.x, dz = tz - k.z, d = Math.hypot(dx, dz);
  if (d < .001) return 0;
  k.h = Math.atan2(dz, dx);
  const v = k.speed * mult * dt;
  if (v < d) { k.x += Math.cos(k.h) * v; k.z += Math.sin(k.h) * v; }
  else { k.x = tx; k.z = tz; }
  return d;
};

// One hit landing, wherever it came from — a swing or a thrown
// marble. The item effects that fire ON CONTACT live here, so there
// is exactly one place a nightmare can be hurt.
function strike(k, m, dmg, knockMul = 1) {
  m.hp -= dmg;
  m.stagger = .35;
  // the hit has to LAND: a white flare, a shove away from whoever
  // threw it, and the thing flinches
  m.hitFlash = 1;
  const a = Math.atan2(m.z - k.z, m.x - k.x);
  const kb = (k.knock ?? 2.6) * knockMul;
  m.knock = { x: Math.cos(a) * kb, z: Math.sin(a) * kb };
  m.animator.setFace('scared');
  state.flash = Math.max(state.flash, .18);
  // cooled just enough that three children on one nightmare read as
  // hits, not as static
  sfxAt('tap', m.x, m.z, { cool: .07 });

  if (k.fx?.sticky) m.mired = Math.max(m.mired, k.fx.sticky);
  if (k.fx?.fear) {                       // everything nearby flinches too
    for (const o of mares) {
      if (o === m || o.dying > 0) continue;
      if (Math.hypot(o.x - m.x, o.z - m.z) < k.fx.fear) {
        o.stagger = Math.max(o.stagger, .45);
        o.animator.setFace('scared');
      }
    }
  }

  if (m.hp <= 0) {
    m.dying = .6;
    sfxAt('erase', m.x, m.z);            // death is the eraser
    say(`${k.name} drove one off`);
    // driving one off moves the bar. Play is still the engine, but a
    // child spending the night fighting must not be a child wasted —
    // capped so a mare is worth seconds of play, never a whole level
    addXp(Math.min(2.5, xpNeed * .12));
    for (const other of kids) if (other.order?.obj === m) { other.order = null; other.act = 'idle'; }
  }
}

function stepKid(k, t, dt) {
  k.lit = lightAt(k.x, k.z);
  // A `flickery` child never quite trusts the light it is standing in.
  // It has to bite whether or not they are carrying a lamp of their
  // own, or the card would be printing a price nobody pays.
  if (k.curses.has('flicker')) k.lit *= .72 + .28 * Math.sin(t * 9 + k.id * 2);
  const dark = k.lit < .12;

  // `k.act` is last frame's — the orders below are what set it — and
  // that one frame of lag is invisible at any drain rate we use here.
  if (k.act === 'sleep') k.stamina = Math.min(k.maxStam, k.stamina + RECOVER * k.rest * dt);
  else {
    let drain = dark ? DRAIN_DARK : DRAIN_IDLE;
    if (k.act === 'play') drain += DRAIN_PLAY;
    k.stamina -= drain * k.drain * dt;
  }

  if (k.stamina < TIRED && !k.warned) {
    k.warned = true;
    sfxAt('squiggle', k.x, k.z);
    say(dark ? `${k.name} is frightened` : `${k.name} needs to sleep`);
  } else if (k.stamina > TIRED + 14) k.warned = false;

  if (k.stamina <= 0) {
    k.gone = true; state.lost++; state.flash = 1;
    sfxAt('stroke', k.x, k.z);           // one long line off the page
    say(`${k.name} went home`);
    return;
  }

  // ---- everything is something you told them to do -------------
  const o = k.order;
  if (!o) {
    k.act = 'idle';
    k.animator.setPose('idle');
    k.animator.setFace(k.stamina < 20 ? 'crying' : dark ? 'scared' : 'idle');
    return;
  }

  if (o.type === 'move') {
    if (moveTo(k, o.x, o.z, dt) < .18) { k.order = null; k.act = 'idle'; }
    else { k.act = 'walk'; k.animator.setPose('walk'); }
    k.animator.setFace(dark ? 'scared' : 'idle');
    return;
  }

  if (o.type === 'fight') {
    if (!mares.includes(o.obj) || o.obj.dying > 0) { k.order = null; k.act = 'idle'; return; }
    const d = Math.hypot(o.obj.x - k.x, o.obj.z - k.z);
    k.act = 'fight';
    // a wand keeps working at range, which is the whole point of one
    if (k.fx.throw && (k.throwT -= dt) <= 0 && d < (k.fx.throw.r ?? 7)) {
      k.throwT = k.fx.throw.every ?? 1.2;
      throwShot(k, o.obj);
    }
    if (d > k.reach) { moveTo(k, o.obj.x, o.obj.z, dt, 1.3); k.animator.setPose('run'); }
    else if ((k.swing -= dt) <= 0) {
      k.swing = k.swingT;
      k.animator.setPose('attack');
      strike(k, o.obj, k.dmg);
    }
    k.animator.setFace('angry');
    return;
  }

  // bed or toy: walk to it, then stay on it until it breaks, they are
  // done, or you tell them otherwise
  const obj = o.obj;
  if (!things.includes(obj) || obj.dur <= 0) { k.order = null; k.act = 'idle'; return; }

  // Playing has a FLOOR. Orders persist, so without one a child told
  // to play would grind itself to zero and be carried home from a game
  // it was told to enjoy. At 10% it puts the toy down by itself — the
  // mirror of a full child getting out of bed, not a refused order:
  // the order simply ENDS, the way "sleep" ends at full.
  if (obj.kind === 'toy' && k.stamina < k.maxStam * PLAY_STOP) {
    k.order = null; k.act = 'idle';
    say(`${k.name} is too tired to play`);
    return;
  }
  if (Math.hypot(obj.x - k.x, obj.z - k.z) > .55) {
    k.act = 'walk';
    moveTo(k, obj.x, obj.z, dt);
    k.animator.setPose('walk');
    k.animator.setFace(dark ? 'scared' : 'idle');
    return;
  }

  const thrift = thriftAt(obj.x, obj.z);

  if (obj.kind === 'toy') {
    k.act = 'play';
    obj.dur -= PLAY_WEAR * thrift * dt;
    addXp(XP_RATE * obj.play * dt);
    k.animator.setPose('play');
    k.animator.setFace(dark ? 'scared' : 'idle');
    if (obj.dur <= 0) { say('a toy broke'); sfxAt('snap', obj.x, obj.z); removeThing(obj); }
  } else {
    k.act = 'sleep';
    obj.dur -= BED_WEAR * thrift * dt;
    // a lullaby doll nearby, and the bed's own softness
    let lull = obj.rest ?? 1;
    for (const o of kids) {
      if (!o.fx.lull || o === k) continue;
      if (Math.hypot(o.x - k.x, o.z - k.z) < o.fx.lull) lull *= 1.5;
    }
    k.stamina = Math.min(k.maxStam, k.stamina + RECOVER * k.rest * (lull - 1) * dt);
    k.animator.setPose('sleep');
    k.animator.setFace('sleeping');
    if (obj.dur <= 0) { say('a bed broke'); sfxAt('snap', obj.x, obj.z); removeThing(obj); }
    else if (k.stamina >= k.maxStam - 1) { k.order = null; k.act = 'idle'; }
  }
}

// ---- nightmares -------------------------------------------------
function stepMare(m, t, dt) {
  if (m.dying > 0) {
    m.dying -= dt;
    const u = Math.max(0, m.dying / .6);
    for (const mat of m.parts) mat.opacity = u;
    m.shadow.material.opacity = .8 * u;
    if (m.dying <= 0) despawn(m, mares);
    return;
  }
  const lit = lightAt(m.x, m.z);
  // Light does not kill them, it MIRES them. A cold-snap charm mires
  // them where there is no light at all, and a thread charm makes a
  // hit stick — both are ways of buying the same thing a lamp buys.
  if (m.mired > 0) m.mired -= dt;
  let mire = MARE_SLOW * lit;
  if (m.mired > 0) mire = Math.max(mire, MARE_SLOW);
  for (const k of kids) {
    if (!k.fx.chill) continue;
    if (Math.hypot(k.x - m.x, k.z - m.z) < k.fx.chill) { mire = Math.max(mire, MARE_SLOW); break; }
  }
  const speed = m.v * (1 - mire);
  if (m.stagger > 0) m.stagger -= dt;
  if (m.hitFlash > 0) m.hitFlash = Math.max(0, m.hitFlash - dt * 4);
  if (m.knock) {                                  // shoved, and skidding to a stop
    m.x += m.knock.x * dt; m.z += m.knock.z * dt;
    m.knock.x *= Math.pow(.02, dt); m.knock.z *= Math.pow(.02, dt);
    if (Math.hypot(m.knock.x, m.knock.z) < .05) m.knock = null;
  }

  m.retarget -= dt;
  if (!m.target || m.target.dur <= 0 || m.retarget <= 0) {
    m.target = nearestBreakable(m.x, m.z);
    m.retarget = 1.2;
  }
  if (!m.target) {
    m.h += (Math.random() - .5) * dt * 2;
    m.x += Math.cos(m.h) * speed * .4 * dt;
    m.z += Math.sin(m.h) * speed * .4 * dt;
    return;
  }
  const dx = m.target.x - m.x, dz = m.target.z - m.z, d = Math.hypot(dx, dz);
  if (d > .7) {
    m.h = Math.atan2(dz, dx);
    if (m.stagger <= 0) { m.x += Math.cos(m.h) * speed * dt; m.z += Math.sin(m.h) * speed * dt; }
  } else if (m.stagger <= 0) {
    // a key charm nearby protects the furniture from THIS too — the
    // chew is what actually destroys things, so a promise that only
    // covered fair wear and tear would be no promise at all
    m.target.dur -= m.chew * thriftAt(m.target.x, m.target.z) * dt;
    state.flash = Math.max(state.flash, .35);
    // fires every frame the chew lands; the cooldown turns that into
    // an intermittent gnawing you can find in the dark by ear
    sfxAt('gnaw', m.target.x, m.target.z, { cool: .6 });
    if (m.target.dur <= 0) {
      say(m.target.kind === 'bed' ? 'a nightmare broke a bed' : 'a nightmare broke a toy');
      sfxAt('snap', m.target.x, m.target.z);
      removeThing(m.target);
      m.target = null;
    }
  }
}

// ---- the draft --------------------------------------------------
// There is no fixed list of rewards and no currency. A whole hand of
// objects is GENERATED whenever the bar fills — art, numbers and name
// from one seed — you keep exactly ONE of them, and that pick tilts
// the odds toward its family for the rest of the run. That is the
// whole economy.
function addXp(n) {
  if (state.paused || state.over) return;
  state.xp += n;
  if (state.xp >= xpNeed) { state.xp -= xpNeed; xpNeed += XP_STEP; openDraft(); }
}

function openDraft() {
  // The SHAPE of the hand — a lamp, a toy, a bed and three things to
  // carry — lives in items/index.js. All the room contributes is its
  // veto: never offer a card nobody here can use, because a mutation
  // every child already has is a dead choice on the table.
  state.offers = drawOffers(state.favor, { ok: anyoneCanTake });
  state.paused = true;
  audio.sfx('paper');
  state.level++;
  // every fifth level, a new child knocks — but the door only opens
  // once the card on the table has been dealt with
  if (state.level % 5 === 0) state.kidDue = true;
  renderDraft();
}

function chooseOffer(i) {
  state.pending = state.offers[i];
  state.offers = null;
  audio.sfx('tick');
  renderDraft();
}

const CARRIED = ['held', 'offhand', 'worn', 'charm', 'mutation'];

// Can anybody actually take this? A mutation only happens to a child
// once, so with three children who all already have horns there is
// nobody left to give a pair of horns to — and without this the draft
// would wait forever for a click that can never work.
const anyoneCanTake = it => !CARRIED.includes(it.slot)
  || kids.some(k => !k.gone && canTake(k, it));

function canTake(k, it) {
  if (it.slot === 'mutation')
    return !k.items.some(i => i.family === 'mutation' && i.P.kind === it.P.kind);
  if (it.slot === 'held' || it.slot === 'offhand' || it.slot === 'worn') {
    const cur = k.items.find(i => i.slot === it.slot);
    return !(cur && cur.curse?.id === 'stuck');
  }
  return true;
}

// The way out. Any pending card can be thrown away, so a run can
// never be stranded on an offer nobody can use.
function discardPending() {
  if (!state.pending) return;
  // the log is prose, so it gets the article back
  say(`${withArticle(state.pending.name)} — put back in the box`);
  audio.sfx('paper');
  state.pending = null;
  resumeAfterPick();
}

// The card is settled; either the world resumes or the door opens.
function resumeAfterPick() {
  if (state.kidDue) { beginKidChoice(); return; }
  state.paused = false;
  renderDraft();
}

function applyPending(ent, gx, gz) {
  const it = state.pending;
  if (!it) return false;

  if (CARRIED.includes(it.slot)) {
    if (!ent || ent.kind !== 'kid') return false;
    if (!giveItem(ent, it)) { say('that one will not take it'); return false; }
    sfxAt('scratch', ent.x, ent.z);      // drawn into their hands
    say(`${ent.name} takes ${withArticle(it.name)}`);
  } else {
    if (gx === undefined || Math.hypot(gx, gz) > ROOM_R) return false;
    const o = it.obj;
    addThing({
      ...o, x: gx, z: gz, maxFuel: o.fuel, maxDur: o.dur,
      // the placed object is drawn from the SAME params as the card,
      // so what you picked is exactly what lands on the floor
      draw: propDrawFor(it), seed: `item:${it.uid}:${it.seed}`, item: it,
    });
    sfxAt('scratch', gx, gz);            // drawn onto the floor
    say(`${withArticle(it.name)} — put down`);
  }

  bumpFavor(state.favor, it.family);
  state.pending = null;
  resumeAfterPick();
  return true;
}

// ---- a new child at the door ------------------------------------
// Every fifth level, three children knock and you keep at most one.
// They are offered the same way objects are — CARDS — because that is
// the choosing screen this game already taught: portrait, name, the
// numbers, the cost. Then the same second beat as furniture: click
// the floor, and that is where the child walks in. Standing the trio
// in the dark room instead read as a heap of strangers behind an
// unreadable veil.
//
// Each candidate is born with one mutation, because base stats alone
// differ by tenths — a thing you can SEE on the portrait is a choice,
// which is this game's whole promise.
const candidates = [];

// The portrait is the REAL child, not an approximation: the built
// character is borrowed into a one-off transparent scene, rendered
// once, and handed back. One shared renderer, sized per use — this
// only ever runs while the draft has the world stopped.
let portraitGL = null;
function portraitOf(k, px = 160) {
  const r = portraitGL ??= new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(1);
  r.setSize(px, px);
  const sc = new THREE.Scene();
  const prev = k.holder.parent, vis = k.holder.visible;
  k.holder.visible = true;
  k.holder.rotation.y = 0;
  k.holder.position.set(0, 0, 0);
  k.holder.scale.set(k.scale, k.scale, 1);
  sc.add(k.holder);
  // feet at y=0; headroom above for horns and crowns, a sliver below
  // so the feet are not kissing the card edge
  const cam = new THREE.OrthographicCamera(-1.45, 1.45, 2.55, -.35, .1, 50);
  cam.position.z = 10;
  r.render(sc, cam);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  c.getContext('2d').drawImage(r.domElement, 0, 0);
  if (prev) prev.add(k.holder);
  k.holder.visible = vis;
  return c;
}

function rollCandidateBase() {
  // wider dice than a founding child: these are strangers, and the
  // spread is what makes three of them worth comparing
  const b = rollBase();
  b.speed = .8 + Math.random() * 1.0;
  b.dmg = 1.2 + Math.random() * 1.0;
  b.maxStam = 80 + ((Math.random() * 45) | 0);
  return b;
}

const CANDIDATE_RANKS = ['sketch', 'sketch', 'sketch', 'inked', 'inked', 'gilded'];

function beginKidChoice() {
  state.kidDue = false;
  state.choosing = true;                   // the world stays paused
  for (let i = 0; i < 3; i++) {
    const k = makeKid(0, 0, rollCandidateBase());
    // built but not IN the room yet: invisible, unclickable, waiting
    // on a card. The pick proxy comes back when the child does.
    dropPick(k);
    k.holder.visible = false;
    k.shadow.visible = false;
    const mut = rollItem('mutation',
      CANDIDATE_RANKS[(Math.random() * CANDIDATE_RANKS.length) | 0],
      (Math.random() * 1e9) | 0);
    if (mut) giveItem(k, mut);             // ~40ms each; the world is stopped
    k.portrait = portraitOf(k);            // after the mutation, so it shows
    candidates.push(k);
  }
  audio.sfx('knock');
  say('a knock at the door');
  renderDraft();
}

function chooseKid(i) {
  const k = candidates[i];
  if (!k) return;
  candidates.splice(i, 1);
  for (const c of [...candidates]) despawn(c, candidates);
  state.choosing = false;
  state.pendingKid = k;                    // now: where do they come in?
  renderDraft();
}

function placeKid(gx, gz) {
  const k = state.pendingKid;
  if (gx === undefined || Math.hypot(gx, gz) > ROOM_R) return false;
  k.x = gx; k.z = gz;
  k.holder.visible = true;
  k.shadow.visible = true;
  addPick(k, 1.1, 2.1);
  fitBody(k);                              // re-cut the proxy for their size
  kids.push(k);
  sfxAt('scratch', gx, gz);                // drawn into the class
  say(`${k.name} joins the class`);
  state.pendingKid = null;
  state.paused = false;
  renderDraft();
  return true;
}

// the way out, at either beat: from the cards, or with a child
// already chosen but not yet placed
function declineKids() {
  if (state.pendingKid) { despawn(state.pendingKid, candidates); state.pendingKid = null; }
  for (const c of [...candidates]) despawn(c, candidates);
  audio.sfx('paper');
  say('they went home with their parents');
  state.choosing = false;
  state.paused = false;
  renderDraft();
}

// ---- input ------------------------------------------------------
const keys = {};
// R sits one key from the E that turns the camera, and a run is long
// — so a live game asks twice. A finished one has nothing left to lose.
let armedR = -1e9;
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (!state.started) { if (e.key === 'Enter' || e.key === ' ') begin(); return; }
  if (e.key === 'r' || e.key === 'R') {
    if (state.over || performance.now() - armedR < 2500) location.reload();
    else { armedR = performance.now(); say('press R again to start over'); }
  }
  if (e.key === 'm' || e.key === 'M') say(audio.toggleMute() ? 'sound off' : 'sound on');
  if (e.key === 'Escape') {
    if (state.pending) discardPending();
    else if (state.choosing || state.pendingKid) declineKids();
    else state.selected = null;
  }
  const n = parseInt(e.key, 10);
  if (state.offers && n >= 1 && n <= state.offers.length) chooseOffer(n - 1);
  if (state.choosing && n >= 1 && n <= candidates.length) chooseKid(n - 1);
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('wheel', e => setZoom(halfH * (1 + Math.sign(e.deltaY) * .12)), { passive: true });

const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPt = new THREE.Vector3();
const panA = new THREE.Vector3(), panB = new THREE.Vector3();
const ndc = new THREE.Vector2();

// where on the floor is this pixel, with the camera as it is NOW
function groundAt(cx, cy, out = hitPt) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(groundPlane, out) ? out : null;
}

function entAt(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables, false);
  return hits.length ? hits[0].object.userData.ent : null;
}

// =================================================================
// GESTURES
//
// On a phone a tap and the start of a drag are the same event, so
// every press starts as a PROVISIONAL tap: it only becomes a camera
// pan once the finger has travelled far enough or been held long
// enough. The order is issued on RELEASE, never on press — which is
// also what stops a pan from dropping a lantern while the draft is
// waiting for you to pick a spot.
//
// Panning grabs the floor: we remember the world point under the
// finger and move the camera so that point stays under it. No
// pixels-to-world conversion, so it is exact at any zoom and angle.
// =================================================================
const TAP_SLOP = 11;                     // px of travel still counts as a tap
const TAP_MS = 400;
const ptrs = new Map();
let drag = null;                         // { id, grab:Vector3 } once panning
let pinch = null;
let lastTap = { t: 0, ent: null };

const el = renderer.domElement;
el.style.touchAction = 'none';

el.addEventListener('pointerdown', ev => {
  // capture keeps a drag alive if the finger leaves the canvas, but it
  // THROWS if the pointer is already gone — and an exception here
  // would lose the press entirely
  try { el.setPointerCapture(ev.pointerId); } catch {}
  ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, t0: performance.now(), moved: false });
  if (ptrs.size === 2) {                 // second finger: never a tap
    for (const p of ptrs.values()) p.moved = true;
    const [a, b] = [...ptrs.values()];
    pinch = {
      d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      ang: Math.atan2(b.y - a.y, b.x - a.x),
      halfH0: halfH, az0: camAzWant, twisted: false,
    };
    drag = null;
  }
});

el.addEventListener('pointermove', ev => {
  const p = ptrs.get(ev.pointerId);
  if (!p) return;
  p.x = ev.clientX; p.y = ev.clientY;

  if (ptrs.size >= 2 && pinch) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    setZoom(pinch.halfH0 * (pinch.d / d));
    // twist has a deadzone, or every pinch rotates the room a little
    let da = Math.atan2(b.y - a.y, b.x - a.x) - pinch.ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (pinch.twisted || Math.abs(da) > .22) { pinch.twisted = true; camAzWant = pinch.az0 - da; }
    return;
  }

  if (!p.moved && (Math.hypot(p.x - p.x0, p.y - p.y0) > TAP_SLOP
                   || performance.now() - p.t0 > TAP_MS)) {
    p.moved = true;
    // the pixel the finger went down on, and the target as it was then
    drag = { id: ev.pointerId, x0: p.x0, y0: p.y0, from: camWant.clone() };
  }
  if (drag && drag.id === ev.pointerId) {
    // BOTH rays are cast through the camera as it is RIGHT NOW, and
    // the target is set ABSOLUTELY from where the pan began. Both
    // halves of that matter: the camera eases toward `camWant` and so
    // is always a little behind it, and a per-move delta measured
    // against the lagging camera feeds that lag straight back in —
    // every move re-pays a debt already owed, the pan accelerates
    // under a steady finger, and on release it sails past and settles
    // back. Measured this way the lag is in both rays and cancels.
    const a = groundAt(drag.x0, drag.y0, panA);
    const b = groundAt(p.x, p.y, panB);
    if (a && b) {
      camWant.set(drag.from.x + a.x - b.x, 0, drag.from.z + a.z - b.z);
      // At the wall, forget the part of the drag that was refused, or
      // dragging back does nothing until the finger has undone every
      // pixel it pushed into the clamp.
      if (clampPan()) { drag.from.copy(camWant); drag.x0 = p.x; drag.y0 = p.y; }
    }
  }
});

function endPointer(ev) {
  const p = ptrs.get(ev.pointerId);
  ptrs.delete(ev.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (drag && drag.id === ev.pointerId) drag = null;
  if (!p || p.moved) return;
  if (performance.now() - p.t0 > TAP_MS) return;
  handleTap(p.x, p.y);
}
el.addEventListener('pointerup', endPointer);
el.addEventListener('pointercancel', ev => { ptrs.delete(ev.pointerId); pinch = null; drag = null; });

function handleTap(cx, cy) {
  if (state.over || !state.started) return;
  const ent = entAt(cx, cy);
  const onGround = groundAt(cx, cy);

  if (state.pending) {
    applyPending(ent, onGround ? hitPt.x : undefined, onGround ? hitPt.z : undefined);
    return;
  }
  if (state.pendingKid) {
    if (onGround && placeKid(hitPt.x, hitPt.z)) return;
    return;
  }
  if (state.paused) return;

  const now = performance.now();
  const double = ent && ent === lastTap.ent && now - lastTap.t < 380;
  lastTap = { t: now, ent };

  if (ent && ent.kind === 'kid') {
    state.selected = ent;
    audio.sfx('tick');                      // picked a child up
    if (double) lookAtXZ(ent.x, ent.z);     // tap twice to bring them into view
    return;
  }
  const k = state.selected;
  if (!k || k.gone) return;

  // an order is something written down — a little stroke where you
  // pointed, so every meaningful tap answers back
  if (ent && ent.kind === 'mare') {
    k.order = { type: 'fight', obj: ent };
    sfxAt('scratch', ent.x, ent.z, { vol: .7 });
    say(`${k.name} goes for it`);
  } else if (ent && (ent.kind === 'bed' || ent.kind === 'toy')) {
    k.order = { type: ent.kind, obj: ent };
    sfxAt('scratch', ent.x, ent.z, { vol: .7 });
    say(`${k.name} → ${ent.kind === 'bed' ? 'off to bed' : 'off to play'}`);
  } else if (onGround) {
    k.order = { type: 'move', x: hitPt.x, z: hitPt.z };
    sfxAt('tap', hitPt.x, hitPt.z, { vol: .5 });
  }
}

// ---- the buttons a thumb can reach ------------------------------
// Two-finger twist is horrible to aim, and this room has nothing that
// needs an arbitrary angle — so touch gets quarter turns instead.
document.getElementById('rot-l').onclick = () => { camAzWant -= Math.PI / 2; };
document.getElementById('rot-r').onclick = () => { camAzWant += Math.PI / 2; };
document.getElementById('zoom-in').onclick = () => setZoom(halfH * .78);
document.getElementById('zoom-out').onclick = () => setZoom(halfH * 1.28);

// ---- HUD --------------------------------------------------------
const hudEl = document.getElementById('hud');
const cardEl = document.getElementById('card');
const logEl = document.getElementById('log');
const barEl = document.getElementById('bar');
const draftEl = document.getElementById('draft');
// Messages stack up the right-hand side and age out, newest on top,
// so three things happening at once produce three lines instead of
// one line that flickers between them.
const msgs = [];
function say(text) {
  msgs.unshift({ text, life: 5 });
  if (msgs.length > 6) msgs.length = 6;
  drawMsgs();
}
function drawMsgs() {
  logEl.innerHTML = msgs.map(m =>
    `<div style="opacity:${Math.min(1, m.life / 1.2).toFixed(2)}">${m.text}</div>`).join('');
}
function ageMsgs(dt) {
  if (!msgs.length) return;
  let dirty = false;
  for (let i = msgs.length - 1; i >= 0; i--) {
    msgs[i].life -= dt;
    if (msgs[i].life <= 0) { msgs.splice(i, 1); dirty = true; }
    else if (msgs[i].life < 1.2) dirty = true;
  }
  if (dirty) drawMsgs();
}

const SLOT_WORD = {
  held: 'for one child to carry', offhand: 'for one child’s other hand',
  worn: 'for one child to wear', charm: 'for one child to keep',
  mutation: 'this happens to one child', floor: 'put it on the floor',
};

function renderDraft() {
  draftEl.classList.toggle('thin', (!!state.pending || !!state.pendingKid) && !state.offers && !state.choosing);
  if (state.offers) {
    draftEl.style.display = 'flex';
    // Three paragraphs, never one sentence: what it is, what it does
    // to the numbers, and what it costs. Run together they read as one
    // long line of flavour and the upgrade hides inside it.
    draftEl.innerHTML = `<h2>something new<small> · keep one</small></h2><div class="cards">`
      + state.offers.map((o, i) =>
        `<button class="r-${o.rank}" data-i="${i}"><b>${o.name}</b><div class="txt">`
        + (o.copy.what ? `<p>${o.copy.what}</p>` : '')
        + (o.copy.does ? `<p class="up">${o.copy.does}</p>` : '')
        + (o.copy.costs ? `<p class="bad">${o.copy.costs}</p>` : '')
        + `</div><em>${SLOT_WORD[o.slot] ?? ''}</em><i>${i + 1}</i></button>`).join('') + `</div>`;
    // The card shows the object's OWN drawing, not an icon standing in
    // for it — the same strokes that will end up in a fist or on the
    // floor. It is the moment the whole system justifies itself: you
    // are choosing between three drawings.
    draftEl.querySelectorAll('button').forEach(b => {
      const o = state.offers[+b.dataset.i];
      b.insertBefore(thumbFor(o, 96), b.querySelector('em'));
      b.onclick = () => chooseOffer(+b.dataset.i);
    });
  } else if (state.pending) {
    draftEl.style.display = 'flex';
    draftEl.innerHTML = `<h2>${CARRIED.includes(state.pending.slot)
      ? 'click the child who gets it' : 'click the floor to put it down'}`
      + `<small> · esc to put it back</small></h2>`;
  } else if (state.choosing) {
    // the same screen the toys use, because it is the choosing screen
    // this game already taught: portrait, name, numbers, cost
    draftEl.style.display = 'flex';
    draftEl.innerHTML = `<h2>a new child is at the door<small> · keep one, or none</small></h2>`
      + `<div class="cards">` + candidates.map((k, i) => {
        const mut = k.items[0];
        return `<button class="r-${mut?.rank ?? 'sketch'}" data-i="${i}"><b>${k.name}</b><div class="txt">`
          + (mut?.copy.what ? `<p>${mut.copy.what}</p>` : '')
          + `<p class="up">speed ${k.speed.toFixed(1)} · attack ${k.dmg.toFixed(1)}`
          + ` · energy ${Math.round(k.maxStam)}</p>`
          + (mut?.copy.costs ? `<p class="bad">${mut.copy.costs}</p>` : '')
          + `</div><em>${mut ? `born with ${mut.name}` : 'a new classmate'}</em><i>${i + 1}</i></button>`;
      }).join('') + `</div>`
      + `<button class="decline">send them all home</button>`;
    draftEl.querySelectorAll('.cards button').forEach(b => {
      const k = candidates[+b.dataset.i];
      b.insertBefore(k.portrait, b.querySelector('em'));
      b.onclick = () => chooseKid(+b.dataset.i);
    });
    draftEl.querySelector('.decline').onclick = declineKids;
  } else if (state.pendingKid) {
    draftEl.style.display = 'flex';
    draftEl.innerHTML = `<h2>click the floor where ${state.pendingKid.name} comes in`
      + `<small> · esc sends them home</small></h2>`;
  } else {
    draftEl.style.display = 'none';
  }
}

const ACTION = {
  idle: 'waiting', walk: 'walking', play: 'playing',
  sleep: 'sleeping', fight: 'fighting',
};

// #card is rewritten every frame, which would destroy a <canvas> 60
// times a second. So the panel is split once: the vitals are volatile
// and the kit is rebuilt only when the child's belongings actually
// change.
cardEl.innerHTML = '<div class="vitals"></div><div class="kit"></div>';
const vitalsEl = cardEl.querySelector('.vitals');
const kitEl = cardEl.querySelector('.kit');
let kitKey = '';

function updateKit(k) {
  const key = k ? `${k.id}|${k.items.map(i => i.uid).join(',')}` : '';
  if (key === kitKey) return;
  kitKey = key;
  kitEl.innerHTML = '';
  if (!k || !k.items.length) return;
  const h = document.createElement('div');
  h.className = 'kit-h';
  h.textContent = 'carrying';
  kitEl.appendChild(h);
  const ul = document.createElement('ul');
  for (const it of k.items) {
    const li = document.createElement('li');
    li.className = `r-${it.rank}`;
    li.appendChild(thumbFor(it, 64));      // baked at 64, shown at 22
    const label = document.createElement('span');
    label.textContent = it.name;
    li.appendChild(label);
    li.title = it.desc;
    ul.appendChild(li);
  }
  kitEl.appendChild(ul);
}

function updateHud() {
  const k = state.selected;
  hudEl.textContent = `children ${kids.length} · level ${state.level}`;
  if (!k || k.gone) { cardEl.style.display = 'none'; }
  else {
    cardEl.style.display = 'block';
    const p = Math.max(0, Math.min(1, k.stamina / k.maxStam));
    const low = p < .25 ? ' low' : k.lit < .12 ? ' dark' : '';
    // the curses this child is under, in words, on the card — the sim
    // reads them by name, so the player must be able to as well
    const quirks = [...new Map(
      k.items.filter(i => i.curse).map(i => [i.curse.id, i.curse])).values()];
    vitalsEl.innerHTML =
      `<h3>${k.name}</h3>`
      + `<div class="e"><i class="${low.trim()}" style="width:${(p * 100).toFixed(0)}%"></i>`
      + `<u>energy ${Math.round(k.stamina)}</u></div>`
      + `<dl><dt>speed</dt><dd>${k.speed.toFixed(1)}</dd>`
      + `<dt>attack</dt><dd>${k.dmg.toFixed(1)}</dd></dl>`
      + `<p>${ACTION[k.act] ?? k.act}${k.lampR ? ' · carries a light' : ''}</p>`
      + quirks.map(c => `<p class="quirk">${c.word} — ${c.desc}</p>`).join('');
    updateKit(k);
  }
  barEl.style.width = `${Math.max(0, Math.min(1, state.xp / xpNeed)) * 100}%`;
}

// ---- the opening hand -------------------------------------------
addThing({ kind: 'light', draw: drawLantern, wU: .7, hU: 1.05, x: 0, z: 0, r: 4.4, fuel: 105, maxFuel: 105 });
addThing({ kind: 'bed', draw: drawBedTop, wU: 1.5, hU: 2.1, flat: true, x: -2.2, z: 1.2, dur: 100, maxDur: 100 });
addThing({ kind: 'toy', draw: drawBall, wU: .6, hU: .6, x: 2.3, z: -.6, dur: 100, maxDur: 100, play: 1 });
// No decor. Everything on this floor is something you can click; a
// chair you cannot use is just a thing to mistake for a chair you can.

let toSpawn = 3;
renderDraft();

// ---- the title screen -------------------------------------------
// It is a screen with a job. A child costs ~20 ms to build and NOTHING
// MAY BUILD DURING PLAY — so the class fills itself in behind the
// title, one per frame, while you are reading the rules. By the time
// you press the button the room is already standing there, breathing.
//
// The world is frozen (`dt` is 0) but the frame is not: the animator
// runs off `dtRaw`, so they blink and sway behind the veil, and the
// camera turns slowly, which is the only advertisement this game has
// for being a 3D room at all.
const startEl = document.getElementById('start');
function begin() {
  if (state.started) return;
  state.started = true;
  startEl.style.display = 'none';
  audio.sfx('scratch');
  say('keep them in the light');
}
document.getElementById('begin').onclick = begin;

// ---- loop -------------------------------------------------------
onResize();
let last = performance.now(), mareT = 0, musicT = 0;
renderer.setAnimationLoop(now => {
  const dtRaw = Math.min(.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  // the draft stops the world; the title has not started it yet
  const dt = state.paused || !state.started ? 0 : dtRaw;
  if (!state.started) camAzWant += dtRaw * .09;

  if (toSpawn > 0) { toSpawn--; spawnKid(); }

  rebuildLights(t);

  if (state.started && !state.over && !state.paused) {
    for (const k of [...kids]) {
      stepKid(k, t, dt);
      if (k.gone) despawn(k, kids);
    }
    if (kids.length === 0 && !toSpawn) {
      state.over = true;
      audio.sfx('tear');                 // the page tears — the one big sound
      const g = document.getElementById('gameover');
      g.style.display = 'flex';
      // the level IS the score: it is the one number a whole run adds
      // up to, and a run that leaves no number behind was never played
      const prev = +localStorage.getItem('kg-best') || 0;
      if (state.level > prev) localStorage.setItem('kg-best', state.level);
      // ONE flex child. Loose text and a <span> would be two flex
      // items sitting side by side, and the <br> between them would do
      // nothing at all — which is exactly what it was doing.
      g.innerHTML = `<div>the lights went out…`
        + `<span>all ${state.lost} children went home · level ${state.level}`
        + `${state.level > prev ? ' — their best night yet' : prev ? ` · best ${prev}` : ''}`
        + ` · press R</span></div>`;
    }
    for (const th of [...things]) {
      if (th.kind !== 'light') continue;
      th.fuel -= dt;
      if (th.fuel <= 0) {
        say('a light went out'); state.gloom = 1;
        sfxAt('puff', th.x, th.z);
        removeThing(th);
      }
    }
    mareT += dt;
    if (mareT > mareStats().every && things.some(x => x.kind === 'bed' || x.kind === 'toy')) {
      mareT = 0; spawnMare();
    }
    for (const m of [...mares]) stepMare(m, t, dt);
    for (const p of [...pets]) stepPet(p, t, dt);
    stepShots(dt);
    separate();
  }

  updateCamera(dtRaw);

  // Zoomed out, a child is a few pixels tall — but a finger is about
  // 44 of them. Tap targets grow with the zoom so they stay thumbable
  // however far back you are.
  const pickScale = Math.max(1, halfH / 9);

  darkness.update(LIGHTS, t);
  for (const th of things) {
    if (!th.pool) continue;
    const p = th.power ?? 1;
    th.pool.scale.setScalar(p);
    th.pool.material.opacity = p * (.9 + Math.sin(t * 6 + th.x) * .1);
  }

  for (const c of [...kids, ...mares, ...pets, ...candidates]) {
    c.holder.position.set(c.x, 0, c.z);
    c.holder.rotation.y = view.az;
    c.holder.scale.set(c.scale, c.scale, 1);
    c.shadow.position.set(c.x, c.shadow.position.y, c.z);
    c.shadow.rotation.y = view.az;
    if (c.pick) {
      c.pick.position.set(c.x, 0, c.z);
      c.pick.rotation.y = view.az;
      c.pick.scale.setScalar(pickScale);
    }
    if (c.lampPool) {
      c.lampPool.position.set(c.x, .05, c.z);
      c.lampPool.scale.setScalar(c.lampR / 2.6);
    }
    if (c.aura) {
      c.aura.position.set(c.x, .06, c.z);
      c.aura.material.opacity = .18 + .12 * Math.sin(t * 2.2 + c.id);
    }
    const v = DARK_VIS + (1 - DARK_VIS) * lightAt(c.x, c.z);
    // a struck nightmare flares white for a moment — the only way to
    // tell a hit landed on something that is already a black scribble
    const flare = c.hitFlash > 0 ? c.hitFlash * .9 : 0;
    // Two tiers, and they never both fire: RED means losing energy
    // right now, AMBER means will need a bed soon. Red wins.
    const awake = c.kind === 'kid' && c.act !== 'sleep';
    // RED means the dark is taking energy right now — and the dark is
    // the only thing that ever does, so this and `dark` in stepKid are
    // the same test and must stay that way. A pulse that can fire for
    // a reason the player cannot name is worse than no pulse.
    const bleeding = awake && c.lit < .12;
    const tired = awake && !bleeding && c.stamina < c.maxStam * .25;

    if (c.dying > 0) {
      // already fading out; leave it alone
    } else if (bleeding) {
      // A child losing energy out in the dark pulses RED. The red is
      // added flat rather than scaled by the light, because the whole
      // point is that you can see it in a part of the room you cannot
      // otherwise see into.
      const p = .55 + .45 * Math.sin(t * 7);
      const r = Math.min(1.5, v + .5 + p * .55);
      const gb = v * .28;
      for (const mat of c.parts) mat.color.setRGB(r, gb, gb * .9);
    } else if (tired) {
      // a slower, warmer throb — worrying, not an emergency
      const p = .5 + .5 * Math.sin(t * 3.2);
      const r = Math.min(1.4, v + .3 + p * .34);
      for (const mat of c.parts) mat.color.setRGB(r, r * .74, v * .45);
    } else {
      for (const mat of c.parts) mat.color.setScalar(Math.min(1.6, v + flare));
    }

    c.shadow.material.opacity = .8 * (bleeding || tired ? Math.max(v, .35) : v);
    if (bleeding) c.shadow.material.color.setRGB(1, .3, .28);
    else if (tired) c.shadow.material.color.setRGB(1, .78, .42);
    else c.shadow.material.color.setScalar(1);

    // the mark over the head
    if (c.mark) {
      const show = bleeding || tired;
      c.mark.visible = show;
      if (show) {
        c.mark.material.map = bleeding ? MARK_ALERT : MARK_TIRED;
        c.mark.material.color.setRGB(...(bleeding ? [1, .38, .34] : [1, .8, .45]));
        c.mark.material.opacity = .55 + .45 * Math.sin(t * (bleeding ? 7 : 3.2));
        c.mark.position.set(c.x, 2.35 + Math.sin(t * 2 + c.id) * .05, c.z);
        c.mark.rotation.y = view.az;
      }
    }
    c.animator.update(t, dtRaw);
  }

  for (const th of things) {
    const wear = th.dur !== undefined && th.maxDur ? .55 + .45 * (th.dur / th.maxDur) : 1;
    if (th.flat) { th.mesh.material.color.setScalar(wear); continue; }
    th.mesh.rotation.y = view.az;
    if (th.pick) {                                  // the target turns with it
      th.pick.rotation.y = view.az;
      th.pick.scale.setScalar(pickScale);
    }
    const v = DARK_VIS + (1 - DARK_VIS) * lightAt(th.x, th.z);
    th.mesh.material.color.setScalar(v * wear);
  }

  for (const s of shots) {
    s.mesh.position.set(s.x, s.y, s.z);
    s.mesh.rotation.y = view.az;                   // a marble is a billboard too
    const v = DARK_VIS + (1 - DARK_VIS) * lightAt(s.x, s.z);
    s.mesh.material.color.setScalar(v);
  }

  const sel = state.selected;
  ring.visible = !!(sel && !sel.gone);
  if (ring.visible) {
    ring.position.set(sel.x, .07, sel.z);
    ring.material.opacity = .5 + .25 * Math.sin(t * 3);
  }

  const board = [...things.filter(th => !th.flat), ...kids, ...mares, ...pets, ...candidates]
    .sort((a, b) => depthKey(a.x, a.z) - depthKey(b.x, b.z));
  for (let r = 0; r < board.length; r++) {
    const b = board[r];
    if (b.face) { setDepthRank(b.face, r); b.shadow.renderOrder = shadowOrder(b.face); }
    else b.mesh.renderOrder = r * LAYER + 6;
  }

  // The music reads the room four times a second: how many nightmares
  // are up, and how much of the class is out in the dark. That one
  // number is the whole score — the layers in audio.js divide it up.
  musicT -= dtRaw;
  if (musicT <= 0) {
    musicT = .25;
    const up = mares.filter(m => m.dying <= 0).length;
    const darkFrac = kids.length ? kids.filter(k => k.lit < .12).length / kids.length : 0;
    audio.setMusic({
      started: state.started, over: state.over,
      draft: state.paused && !state.over,
      threat: Math.min(1, (up / 3) * .6 + darkFrac * .6),
    });
  }

  state.flash = Math.max(0, state.flash - dtRaw * 2);
  state.gloom = Math.max(0, state.gloom - dtRaw * 1.1);
  ageMsgs(dtRaw);
  postfx.setFlash(state.flash);
  postfx.setGloom(state.gloom);
  updateHud();
  postfx.render(scene, camera);
});

window.__game = { state, kids, mares, pets, things, shots, lightAt, spawnMare, openDraft, audio,
  begin, giveItem, recomputeKid, camera, renderer, addXp, camWant, camAt, lookAtXZ,
  candidates, beginKidChoice, chooseKid, placeKid, declineKids,
  get xpNeed() { return xpNeed; }, get halfH() { return halfH; }, get az() { return camAzWant; } };
