// ---------------------------------------------------------------
// KINDERGRIMM — walk them through the dark, and wait for the ones
// who stopped to fight.
//
// THE LOOP
//   You have ONE verb: tap the floor and the whole class walks there.
//   That is the entire control scheme. Everything else is something
//   the children decide, and there is only one thing they decide:
//
//   A child that can SEE a nightmare on it plants its feet and fights
//   until one of them is finished — and does not move while it does.
//   So the group tears itself in half every time you cross something,
//   and you either wait for the stragglers or walk on and leave them
//   out there. That waiting IS the game.
//
//   LIGHT IS NOT A WEAPON AND NOT A SHELTER. It does exactly one
//   thing: you can see. It does not slow a nightmare, it does not
//   hurt one, and standing in it costs nothing. But a child cannot
//   fight what it cannot see, so the lamps decide which of two games
//   you are playing at any moment: in the light you stand and fight,
//   in the dark you run — an unengaged child can always be walked
//   away from something it never saw.
//
//   A HAND HOLDS A LAMP OR A WEAPON, NEVER BOTH. That is the whole
//   composition problem: too many lamps and nothing dies, too many
//   bats and half the class is blind.
//
//   Nightmares hunt the CHILDREN now. They do not bite and nobody is
//   hurt — they frighten, energy runs out, and a child with none left
//   is collected by its parents. Every one you drive off fills the
//   bar; when it fills the world STOPS and a hand of five objects is
//   dealt, of which you keep one.
//
//   The floor has no edge. It goes on in every direction, and the
//   other children are out there somewhere — you find them by walking
//   into the dark until you hear one.
//
// THE VIEW is 3D: floor on XZ, orbiting orthographic camera, and
// every upright drawing a billboard yawed to face it. See
// ARCHITECTURE.md §6b.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { ROOM_BG, makeFloorTexture, makeShadowTextures } from './ground.js';
import { makeProp, drawLantern } from './scenery.js';
import { createDarkness } from './dark.js';
import { createPostFX } from './postfx.js';
import { Sketch } from './sketch.js';
import { hashStr } from './rng.js';
import { setRender, U } from './part.js';
import { newRecipe, buildCharacter, ensureParams, setDepthRank, shadowOrder, LAYER } from './rig.js';
import { createAnimator } from './anim.js';
import { drawOffers, bumpFavor, thumbFor, propDrawFor, aggregate, rollItem } from './items/index.js';
import { applyStats, withArticle } from './items/core.js';
import { audio } from './audio.js';

setRender({ u: 96, frames: 2 });
THREE.ColorManagement.enabled = false;

// ---- the numbers ------------------------------------------------
const KID_H = 1.9;
const AMBIENT = .015;                    // the FLOOR goes properly black
const DARK_VIS = .16;                    // …but a CHILD in the dark still reads
                                         // as a shape. You must always be able
                                         // to see where your own class is.
const MARE_VIS = .035;                   // a nightmare does not get that mercy:
                                         // unlit, it is a suggestion on the page.
// How much room a body takes. Bigger than it needs to be for
// collision, on purpose: this is what sets how loosely the class
// stands, and packed shoulder to shoulder they read as one blob
// rather than as five children.
const BODY_R = .6;

// The one threshold that matters, and it is used in three places that
// must never disagree: whether a child can fight a nightmare, how
// bright a thing has to be to be drawn properly, and what the music
// counts as "out in the dark".
const SEE = .12;

const STAM_MAX = 100;
// Nothing takes energy from a child except being frightened, and a
// child that is left alone gets it back. There is no idle drain and
// no bed: the clock is the nightmares, and only the nightmares.
// energy per second, one nightmare. At 7 a child emptied in fourteen
// seconds and the class could not trade fast enough to hold; at 5 a
// one-on-one is a twenty-second clock, which is long enough to walk
// somebody out of it and short enough to be frightening.
const MARE_SCARE = 5;
const HURT_HOLD = .8;                    // …and how long before they settle
const REGEN = 3.5;
const TIRED = 25;

const ARRIVE = 1.5;                      // how close to the tap is "there"
const DREAD = 4;                         // a nightmare this close is felt, seen or not
// A lit nightmare this close is everybody's business: whoever is not
// already swinging at something walks over and piles on. Kept short so
// it reads as "the one that is on us" and never as hunting.
const HELP_R = 4.5;

// The bar is COUNTED IN KILLS now, which is the most legible economy
// this game has ever had: the number under the bar is how many more
// nightmares until the next drawing.
// The FIRST nightmare buys the first card. A player has to be shown
// what the bar is for before they can want it, and a tutorial nobody
// wrote is just the reward arriving early.
//
// The step is deliberately tiny, so the opening is a burst: the first
// five cards cost 1, 1.35, 1.7, 2.05 and 2.4 nightmares — call it a
// minute for five objects. A run has to have a SHAPE by the time it
// is dangerous, and a shape is made of cards.
const XP_STEP = .35;
let xpNeed = 1;

// MEASURED, twice, and both times the number was the whole game.
//
// At .5 units/second from a spawn ring of 19 the first nightmare took
// FIFTY SECONDS to reach anybody. At 1.0 it was worse in a way that
// looked better: it is slower than a walking class, so a class that
// keeps walking is never caught, nothing is ever fought, no card is
// ever dealt, and the only thing that happens all night is the
// slowest child being picked off from behind.
//
// So they are FASTER than a child — faster than all but the quickest.
// You cannot outrun a nightmare; you can only choose where to be
// standing when it arrives, and whether there is light there. That is
// the game, and it only exists above about 1.3.
const MARE_V = 1.85, MARE_HP = 4.5;
const MARE_SLOW = .88;                   // only an ITEM mires them now — never light
// MEASURED. The bar is spawn-gated, not fight-gated: a class parked in
// the light kills a nightmare almost exactly as fast as one arrives,
// so this number IS the tempo of the whole game. At 13 seconds a draft
// took eighty; at 7 it takes about fifty, which is what the reward
// loop wants.
const MARE_EVERY = 7;
const SPAWN_R = 10, SPAWN_SPAN = 5;      // out of the dark, not over the horizon

// Everything about a nightmare grows with the level — how often they
// come, how many, how fast, how hard to drive off. Gentle slopes: the
// draft is still the ramp the player CHOOSES; this is the night
// keeping pace with it. Rolled at spawn, so an old mare keeps the
// night it was born into.
function mareStats() {
  const L = state.level;
  return {
    every: Math.max(4.5, MARE_EVERY - L * .25),
    n: Math.min(3, 1 + Math.floor(L / 4)),
    hp: MARE_HP + L * .3,
    v: MARE_V * (1 + Math.min(.6, L * .02)),
  };
}

const state = {
  xp: 0, level: 0, lost: 0, over: false, flash: 0, gloom: 0,
  // `started` is the title screen and `paused` is the draft. Two
  // flags, because they stop the world for opposite reasons: the
  // draft freezes a game in progress, the title holds one that has
  // not begun — and the class is still being BUILT behind it.
  started: false,
  paused: false, offers: null, pending: null,
  // where you last tapped. There is only one order in this game and
  // this is it; every child that is not fighting is walking here.
  goto: null,
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
let camAz = .55, camAzWant = .55;
// where the camera is looking: `want` is what input sets, `at` is the
// smoothed value the camera actually uses, so every move glides
const camWant = new THREE.Vector3(), camAt = new THREE.Vector3();
const camera = new THREE.OrthographicCamera(-1, 1, halfH, -halfH, .1, 100);
const view = { az: camAz, rightX: 1, rightZ: 0 };

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

// There is no pan limit any more: the floor has no edge to drag into
// shot. What replaces it is a rescue — see `keepInFrame`.
function setZoom(v) {
  halfH = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
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

const lookAtXZ = (x, z) => { camWant.set(x, 0, z); };

// The middle of the class — the one place the camera ever goes on its
// own, and what the recentre button is for.
function groupAt(out = new THREE.Vector3()) {
  if (!kids.length) return out.set(camWant.x, 0, camWant.z);
  let x = 0, z = 0;
  for (const k of kids) { x += k.x; z += k.z; }
  return out.set(x / kids.length, 0, z / kids.length);
}

// THE FLOCK — whoever is actually walking, and nobody else. A child
// that has stopped to fight is deliberately left out of it: the whole
// point of a fight is that the class walks on without them, and a
// camera anchored to the one who stayed behind would drag the frame
// backwards at exactly the moment the player is deciding whether to
// leave them. If nobody is walking it falls back to whoever is not
// fighting, and only if the entire class is fighting does it watch
// the fight.
function flockAt(out = new THREE.Vector3()) {
  let x = 0, z = 0, n = 0;
  for (const k of kids) { if (k.act !== 'walk') continue; x += k.x; z += k.z; n++; }
  if (n) return out.set(x / n, 0, z / n);
  for (const k of kids) { if (k.act === 'fight') continue; x += k.x; z += k.z; n++; }
  if (n) return out.set(x / n, 0, z / n);
  return groupAt(out);
}

// The camera rides the flock. On a floor with no edge it has to —
// there is no landmark to navigate by and nothing to pan back to.
// A manual drag takes it back for a few seconds so you can still look
// ahead into the dark, and then it returns to the class on its own.
const FOLLOW_HOLD = 3.5;
const gCentre = new THREE.Vector3();
let panHold = 0;
function followFlock(dt) {
  if (drag) { panHold = FOLLOW_HOLD; return; }
  if (panHold > 0) { panHold -= dt; return; }
  if (!kids.length) return;
  flockAt(gCentre);
  camWant.lerp(gCentre, 1 - Math.pow(.12, dt));
}

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

// ---- the floor, which has no edge --------------------------------
// A fixed grid of tiles that FOLLOWS the view, snapped to the tile
// size, each one showing the texture its own coordinate hashes to. So
// the floor is infinite, deterministic (walk away and back and the
// same scuffs are there), and costs a fixed number of draw calls
// forever.
//
// NOTHING IS BAKED WHILE YOU PLAY: the variants are drawn once at
// boot and shared. A per-tile bake would mean drawing a 384px canvas
// every time you crossed a seam, which is a stutter you would feel
// exactly while walking somewhere new.
const TILE = 8, GRID = 11;
const FLOOR_TEX = Array.from({ length: 12 }, (_, i) => makeFloorTexture(`t${i}`));
const tileGeo = new THREE.PlaneGeometry(TILE, TILE);
const tiles = [];
for (let i = 0; i < GRID * GRID; i++) {
  const m = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ map: FLOOR_TEX[0] }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -10000;
  m.userData.key = null;
  scene.add(m);
  tiles.push(m);
}

function updateFloor() {
  const bx = Math.round(camAt.x / TILE), bz = Math.round(camAt.z / TILE);
  const h = (GRID - 1) / 2;
  let i = 0;
  for (let dx = -h; dx <= h; dx++) {
    for (let dz = -h; dz <= h; dz++) {
      const ix = bx + dx, iz = bz + dz, key = `${ix}:${iz}`;
      const m = tiles[i++];
      if (m.userData.key === key) continue;
      m.userData.key = key;
      m.position.set(ix * TILE, 0, iz * TILE);
      const hs = hashStr(key);
      m.material.map = FLOOR_TEX[hs % FLOOR_TEX.length];
      // A quarter turn per tile, from the same hash. Twelve textures
      // would otherwise show their repeat; spun four ways they read as
      // forty-eight, and the seams stay invisible.
      // Rotation order is XYZ, so this z-spin happens in the plane's
      // own frame BEFORE it is tipped flat — a spin within the floor,
      // not a tumble out of it.
      m.rotation.z = (hs >> 5) % 4 * (Math.PI / 2);
    }
  }
}

const darkness = createDarkness(scene);
darkness.setAmbient(AMBIENT);
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

// ---- the marks that float over a child ---------------------------
// A colour pulse tells you something is wrong; a mark over the head
// tells you WHICH thing, from across a dark room, without selecting
// anybody. Drawn the way a child would: a fat exclamation, three
// sleepy z's, or a question for the one who is lost.
function makeMarkTexture(kind) {
  const s = new Sketch(128, 128);
  s.boil(kind === 'tired' ? 11 : kind === 'lost' ? 5 : 23);
  if (kind === 'tired') {
    for (let i = 0; i < 3; i++) {
      const sz = 34 - i * 9, x = 24 + i * 30, y = 92 - i * 30;
      s.stroke([[x, y - sz], [x + sz, y - sz], [x, y], [x + sz, y]], 6 - i * 1.2,
        { taper: .12, alpha: 1, amp: .5 });
    }
  } else if (kind === 'lost') {
    // a question mark, drawn slowly by somebody who is not sure
    const hook = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * 1.15 - (i / 14) * Math.PI * 1.45;
      hook.push([64 + Math.cos(a) * 24, 44 - Math.sin(a) * 24]);
    }
    hook.push([64, 78]);
    s.stroke(hook, 11, { taper: .18, alpha: 1, amp: .6 });
    s.ctx.fillStyle = s.inkA(1);
    s.wobbly(64, 102, 7, 7);
    s.ctx.fill();
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
const MARK_LOST = makeMarkTexture('lost');

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

// where you last tapped, drawn on the floor — the only order in the
// game deserves to leave a mark
const GOTO_TEX = (() => {
  const s = new Sketch(128, 128);
  s.boil(3);
  for (let k = 0; k < 2; k++) {
    s.sline([[38 + s.jr(-3, 3), 38 + s.jr(-3, 3)], [90 + s.jr(-3, 3), 90 + s.jr(-3, 3)]], 4, .8);
    s.sline([[90 + s.jr(-3, 3), 38 + s.jr(-3, 3)], [38 + s.jr(-3, 3), 90 + s.jr(-3, 3)]], 4, .8);
  }
  return new THREE.CanvasTexture(s.canvas);
})();

const gotoMark = new THREE.Mesh(
  new THREE.PlaneGeometry(.9, .9),
  new THREE.MeshBasicMaterial({ map: GOTO_TEX, transparent: true, depthWrite: false, opacity: .5 }),
);
gotoMark.rotation.x = -Math.PI / 2;
gotoMark.position.y = .075;
gotoMark.renderOrder = -7890;
gotoMark.visible = false;
scene.add(gotoMark);

// ---- objects ----------------------------------------------------
const things = [], kids = [], mares = [], lost = [];
// nightmares waiting for a frame of their own to be built in — a wave
// is queued, never built at once (ARCHITECTURE.md §6b)
const queued = [];
const pickables = [];              // invisible proxies, one per clickable entity

// A proxy is what the tap actually hits: raycasting every part mesh of
// every child would be both slow and wrong — you would miss the gaps
// between the strokes. One quad per entity, invisible, billboarded.
// Invisible objects still raycast.
//
// ONLY YOUR OWN CHILDREN GET ONE. Nothing else in this game is
// clickable: there are no orders to give a nightmare or a lantern, and
// a proxy over either of them would only eat the tap you meant for the
// floor behind it.
function addPick(ent, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial());
  m.geometry.translate(0, h / 2, 0);
  m.visible = false;
  m.userData.ent = ent;
  m.position.set(ent.x ?? 0, 0, ent.z ?? 0);
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
    draw: o.draw, wU: o.wU, hU: o.hU,
    // a generated object passes its own seed so the thing on the floor
    // is the same drawing the card showed
    seed: o.seed ?? `${o.kind}${things.length}:${(Math.random() * 1e6) | 0}`,
  });
  mesh.position.set(o.x, 0, o.z);
  scene.add(mesh);

  const t = { ...o, mesh };
  t.pool = makePool(o.r);
  t.pool.position.set(o.x, .05, o.z);
  things.push(t);
  return t;
}

// Objects come and go all night, and every generated one bakes its OWN
// CanvasTexture — so letting them go without disposing grows the GPU
// footprint for the whole session.
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
  // a carried lamp is a light like any other, and it walks
  for (const k of [...kids, ...lost]) {
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
  // the tap target has to grow with the child, or a giant is
  // unclickable round its edges and a shrunk one steals taps from the
  // floor behind it
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

// `kit` is what this character is BORN holding, pre-seeded into the
// recipe. That matters: handing a child an object after the fact costs
// a full rebuild (~20ms), and a child is built during play now — one
// found in the dark has to cost exactly ONE build, not two.
function buildBody(species, wantH, gear = true, kit = []) {
  const recipe = newRecipe();
  recipe.species = species;
  recipe.media = 'graphite';
  recipe.base = null;
  // A CHILD starts with nothing in its hands except what you gave it.
  // The gear parts roll a small chance of random kit, which is right
  // for the editor and the crowd page but a lie here: a child drawn
  // holding a sword that is not in its belongings breaks the one
  // promise this whole system makes. Nightmares keep theirs — they
  // have no inventory to contradict, and a scribbled crown suits them.
  if (!gear) for (const id of GEAR_SLOTS)
    recipe.parts[id] = { params: { family: 'none', rank: 'sketch', seed: 0 }, lock: true };
  for (const it of kit) {
    if (!GEAR_SLOTS.includes(it.slot)) continue;
    recipe.parts[it.slot] = {
      params: { family: it.family, rank: it.rank, seed: it.seed }, lock: true,
    };
  }
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

const NAMES = ['Poppy', 'Tam', 'Pearl', 'Wren', 'Nils', 'Juno', 'Bruno', 'Lilo',
               'Mila', 'Otto', 'Sable', 'Fen', 'Rook', 'Ivy', 'Cass', 'Bo'];

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
  // nearestKid.
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

// Ids are a counter, never an index: a child found in the dark consumes
// one whether or not it lives, and the id seeds animation phases and
// pet ids — a duplicate means two children blinking in lockstep.
let nextKidId = 0;

function rollBase() {
  return {
    // A brisk walk. They are small and the floor is endless, so a
    // slow class turns every crossing into dead time — and this is
    // tied to MARE_V, which has to stay just under the average or
    // walking away from a nightmare becomes free.
    speed: 1.5 + Math.random() * .8,
    // Bare hands, and deliberately feeble: a weapon has to be worth a
    // card. Every family's damage is an ADD on top of this, so the
    // lower this sits the more a sword is actually worth — measured at
    // +27% for a plain one and +60% for a gilded.
    dmg: .9 + Math.random() * .5,
    reach: 1.7, swingT: .85, rest: 1, lampR: 0,
    // A SHOVE, not a launch. Children are rooted while they fight now,
    // so a hit that threw a nightmare past their reach ended the fight
    // instead of winning it — one hit every six seconds, and nothing
    // ever died. This lands it back inside reach, every time.
    scale: 1, maxStam: STAM_MAX, drain: 1, knock: 1.2,
  };
}

// Build a child, holding whatever `kit` says. It is NOT enlisted here:
// a child found in the dark exists, breathes and lights its own patch
// of floor before it is anybody's.
function makeKid(x, z, base, kit = []) {
  const body = buildBody('human', KID_H, false, kit);
  const id = nextKidId++;
  const k = {
    ...body, kind: 'kid', id, name: NAMES[id % NAMES.length],
    x, z,
    h: Math.random() * Math.PI * 2, rad: BODY_R,
    stamina: base.maxStam ?? STAM_MAX,
    base,
    items: [...kit], fx: {}, curses: new Set(), lampPool: null,
    act: 'idle', aura: null,
    lit: 1, gone: false, swing: 0, warned: false, hurt: 0,
    throwT: 0, lost: false,
  };
  // the getter must read the LIVE face: a mutation rebuilds it, and a
  // closure over the original would animate a disposed character
  k.animator = createAnimator(() => k.face, {
    blink: true, gaze: true, talk: false, sway: true, breath: true,
    boil: true, boilSpeed: .5, phase: Math.random() * 20, amp: 1.1,
  });
  recomputeKid(k);
  k.mark = makeMark();
  return k;
}

// enlist: give it a tap target and put it on the register
function enlist(k) {
  k.lost = false;
  addPick(k, 1.1, 2.1);
  // remember the size the proxy was cut at, so `fitBody` can re-cut it
  // in proportion when an object makes this child bigger or smaller
  k.pickBase = { w: 1.1, h: 2.1, scale: k.scale };
  fitBody(k);
  kids.push(k);
  return k;
}

// The opening class. One lamp between three, which is the whole game
// stated on the first screen: somebody has to carry the light, and
// that somebody is not going to be much use in a fight.
const OPENING = ['lamp', 'bat', 'sword'];

function spawnKid(n) {
  const a = (n / 3) * Math.PI * 2, r = 1.1;
  const it = rollItem(OPENING[n % OPENING.length], 'sketch', (Math.random() * 1e9) | 0);
  const k = makeKid(Math.cos(a) * r, Math.sin(a) * r, rollBase(), it ? [it] : []);
  return enlist(k);
}

function spawnMare() {
  const body = buildBody('nightmare', 1.7);
  const g = groupAt();
  const a = Math.random() * Math.PI * 2, r = SPAWN_R + Math.random() * SPAWN_SPAN;
  const ms = mareStats();
  const m = {
    ...body, kind: 'mare',
    x: g.x + Math.cos(a) * r, z: g.z + Math.sin(a) * r,
    // deliberately NARROWER than a child: it has to be able to stand
    // inside a rooted child's reach and stay there after a shove, or
    // the fight ends every time a hit lands
    h: 0, rad: BODY_R * .85, hp: ms.hp, v: ms.v,
    dying: 0, stagger: 0,
    hitFlash: 0, knock: null, target: null, retarget: 0,
    mired: 0,
  };
  m.animator = createAnimator(() => m.face, {
    blink: true, gaze: true, talk: false, sway: true, breath: true,
    boil: true, boilSpeed: .8, phase: Math.random() * 20, amp: 1.5,
  });
  m.animator.setPose('walk', { speed: .5 });
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
// that children only do what you tell them has to stay true.
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

  // whatever is worrying the owner is the pet's business — and it can
  // see in the dark, which is most of what a familiar is for
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
// lobbed arc, and it exists so that "reaches across the dark" is a
// real answer to "what could an object do" without turning a baby
// school into a shooter: it staggers and chips, it never kills alone.
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

// A key charm carried near a lantern makes it burn longer. The only
// thing in this game that wears out is a light, so this is where
// `thrift` had to land — an effect that draws a ring on the floor and
// then does nothing would be exactly the unreadable stat the whole
// object system is built to avoid.
function thriftAt(x, z) {
  for (const k of kids) {
    if (!k.fx.thrift) continue;
    if (Math.hypot(k.x - x, k.z - z) < k.fx.thrift) return .6;
  }
  return 1;
}

// A nightmare wants the nearest child, and does not care what that
// child is holding — but it does care whether one of its own is
// already on them.
//
// MEASURED: without `CROWD` every nightmare in the room converges on
// the single nearest child, because that is what "nearest" means when
// they all walk the same way. Three of them frighten at three times
// the rate while the child can only ever swing at one, so it melts in
// five seconds with its whole class standing next to it — and the
// player cannot see why, because nothing on screen says "they are all
// on Tam". A queue of nightmares per child is unreadable; one each,
// spilling over only when they outnumber the class, is not.
const CROWD = 7;                         // how far one will walk to find its own child

function nearestKid(x, z, self) {
  let bait = null;
  for (const k of kids) if (k.curses.has('bait')) { bait = k; break; }
  const claims = new Map();
  for (const m of mares) {
    if (m === self || m.dying > 0 || !m.target) continue;
    claims.set(m.target, (claims.get(m.target) ?? 0) + 1);
  }
  let best = null, bd = 1e9;
  for (const k of kids) {
    if (k.gone) continue;
    let d = Math.hypot(k.x - x, k.z - z) + (claims.get(k) ?? 0) * CROWD;
    // a child under a `wanted` curse drags them across the room — the
    // price of a nightmare-drawn object
    if (bait) d -= Math.max(0, 6 - Math.hypot(k.x - bait.x, k.z - bait.z));
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

function separate() {
  const all = [...kids, ...mares, ...pets, ...lost];
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
    // THE WHOLE ECONOMY. The bar counts nightmares, nothing else fills
    // it, and the number under it is how many more until the next card.
    addXp(1);
  }
}

function stepKid(k, t, dt) {
  k.lit = lightAt(k.x, k.z);
  // A `flickery` child never quite trusts the light it is standing in.
  // It has to bite whether or not they are carrying a lamp of their
  // own, or the card would be printing a price nobody pays.
  if (k.curses.has('flicker')) k.lit *= .72 + .28 * Math.sin(t * 9 + k.id * 2);

  // NOTHING TAKES ENERGY EXCEPT BEING FRIGHTENED, and a child left
  // alone gets it back. The dark is not a clock any more — it is a
  // blindfold, which is worse.
  //
  // There are no beds, so `rest` became the rate they settle at, and a
  // lullaby charm calms whoever is standing near it. Both keep their
  // meaning and their card copy; what they act on moved.
  if (k.hurt > 0) k.hurt -= dt;
  else {
    let calm = k.rest;
    for (const o of kids) {
      if (!o.fx.lull || o === k) continue;
      if (Math.hypot(o.x - k.x, o.z - k.z) < o.fx.lull) { calm *= 1.5; break; }
    }
    k.stamina = Math.min(k.maxStam, k.stamina + REGEN * calm * dt);
  }

  if (k.stamina < TIRED && !k.warned) {
    k.warned = true;
    sfxAt('squiggle', k.x, k.z);
    say(`${k.name} has had enough`);
  } else if (k.stamina > TIRED + 14) k.warned = false;

  if (k.stamina <= 0) {
    k.gone = true; state.lost++; state.flash = 1;
    sfxAt('stroke', k.x, k.z);           // one long line off the page
    say(`${k.name} went home`);
    return;
  }

  // ---- what is out there, and can we see it? --------------------
  // `foe` is what this child will actually fight: close enough to
  // swing at AND lit. `near` is everything, lit or not — that is the
  // one they can hear, and it is why a child in the dark looks
  // frightened before you know why.
  let foe = null, fd = 1e9, near = 1e9;
  for (const m of mares) {
    if (m.dying > 0) continue;
    const d = Math.hypot(m.x - k.x, m.z - k.z);
    if (d < near) near = d;
    if (d > k.reach + .3 || d >= fd) continue;
    if (lightAt(m.x, m.z) < SEE) continue;      // you cannot fight what you cannot see
    fd = d; foe = m;
  }

  // A wand reaches across the room, and does it while walking — that
  // is the whole point of one. It still cannot pick out a target in
  // the dark.
  if (k.fx.throw && (k.throwT -= dt) <= 0) {
    const R = k.fx.throw.r ?? 7;
    let far = null, bd = R;
    for (const m of mares) {
      if (m.dying > 0) continue;
      const d = Math.hypot(m.x - k.x, m.z - k.z);
      if (d < bd && lightAt(m.x, m.z) >= SEE) { bd = d; far = m; }
    }
    if (far) { k.throwT = k.fx.throw.every ?? 1.2; throwShot(k, far); }
  }

  if (foe) {
    // ROOTED. A fight is a commitment: they will not walk away from it
    // and you cannot call them off. Waiting is the price of crossing
    // something you could see.
    k.act = 'fight';
    k.h = Math.atan2(foe.z - k.z, foe.x - k.x);
    if ((k.swing -= dt) <= 0) {
      k.swing = k.swingT;
      k.animator.setPose('attack');
      strike(k, foe, k.dmg);
    }
    k.animator.setFace('angry');
    return;
  }

  const scared = near < DREAD;

  // NOBODY FIGHTS ALONE. A child with nothing in reach, but a lit
  // nightmare right next to the class, walks over and joins in — so a
  // nightmare that arrives in the lamplight is swarmed by whoever is
  // free instead of duelling one child while the rest walk past it.
  // It only ever answers what is already on top of them (`HELP_R`), so
  // it reads as piling on and never as hunting.
  let help = null, hd = HELP_R;
  for (const m of mares) {
    if (m.dying > 0) continue;
    const d = Math.hypot(m.x - k.x, m.z - k.z);
    if (d < hd && lightAt(m.x, m.z) >= SEE) { hd = d; help = m; }
  }
  if (help) {
    k.act = 'walk';
    moveTo(k, help.x, help.z, dt, 1.2);
    k.animator.setPose('run');
    k.animator.setFace('angry');
    return;
  }

  const g = state.goto;
  if (g && Math.hypot(g.x - k.x, g.z - k.z) > ARRIVE) {
    k.act = 'walk';
    moveTo(k, g.x, g.z, dt);
    k.animator.setPose('walk');
    k.animator.setFace(scared ? 'scared' : 'idle');
    return;
  }

  k.act = scared ? 'scared' : 'idle';
  k.animator.setPose('idle');
  k.animator.setFace(k.stamina < 20 ? 'crying' : scared ? 'scared' : 'idle');
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

  // LIGHT DOES NOTHING TO THEM. It does not slow them and it does not
  // burn them; it only lets a child see one coming. The only things
  // that mire a nightmare now are objects — a cold-snap charm's ring,
  // or a thread charm making a hit stick — and both of those draw
  // themselves on the floor.
  let mire = 0;
  if (m.mired > 0) { m.mired -= dt; mire = MARE_SLOW; }
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
  if (!m.target || m.target.gone || !kids.includes(m.target) || m.retarget <= 0) {
    m.target = nearestKid(m.x, m.z, m);
    m.retarget = 1.2;
  }
  if (!m.target) {
    m.h += (Math.random() - .5) * dt * 2;
    m.x += Math.cos(m.h) * speed * .4 * dt;
    m.z += Math.sin(m.h) * speed * .4 * dt;
    return;
  }

  const k = m.target;
  const dx = k.x - m.x, dz = k.z - m.z, d = Math.hypot(dx, dz);
  const touch = m.rad + k.rad + .35;
  if (d > touch) {
    m.h = Math.atan2(dz, dx);
    if (m.stagger <= 0) { m.x += Math.cos(m.h) * speed * dt; m.z += Math.sin(m.h) * speed * dt; }
  } else if (m.stagger <= 0) {
    // IT DOES NOT BITE. Nobody is hurt in this school and nobody ever
    // will be: it stands over them and frightens them, and a child
    // with no courage left is collected by its parents. `drain` is
    // still the child's own — a `cosy` hat really does help.
    k.stamina -= MARE_SCARE * k.drain * dt;
    k.hurt = HURT_HOLD;
    state.flash = Math.max(state.flash, .3);
    // fires every frame it lands; the cooldown turns that into an
    // intermittent noise you can find in the dark by ear
    sfxAt('gnaw', k.x, k.z, { cool: .55 });
  }
}

// ---- the children you find in the dark --------------------------
// The floor has no edge, so it needs a reason to be walked. This is
// it: somewhere out there another child is standing in the black,
// holding something, waiting. Walk your class into them and they join.
//
// They are built AHEAD OF TIME and one per frame — the same rule the
// nightmares follow. A child costs ~20ms and the one moment this game
// must never stutter is while you are walking somewhere new.
// THE CLASS IS MEANT TO GROW, and fast: three children is a shape you
// have already read by the second minute. Around level three there
// should be four of them and it should keep going, so they are put
// CLOSE — inside ten seconds of walking, not thirty — several are out
// there at once, and the next one is already on its way before you
// have reached the last.
//
// Distance is the whole dial here. At 24-44 units a lost child was a
// two-way expedition that cost more than it brought; at 11-23 it is a
// detour, which is what it should be.
const LOST_MAX = 3;
const FIND_R = 2.4;                      // generous: a class is 2 units wide
const LOST_MIN = 11, LOST_SPAN = 12;     // how far out one is put
let lostT = 3;

// what a stranger is carrying — the reason to go and get them
const LOST_KIT = ['lamp', 'lamp', 'sword', 'bat', 'wand', 'shield', 'hat', 'crown', 'charm', 'doll'];
const LOST_RANKS = ['sketch', 'sketch', 'inked', 'inked', 'gilded'];

function placeLost() {
  const g = groupAt();
  const a = Math.random() * Math.PI * 2, r = LOST_MIN + Math.random() * LOST_SPAN;
  const it = rollItem(
    LOST_KIT[(Math.random() * LOST_KIT.length) | 0],
    LOST_RANKS[(Math.random() * LOST_RANKS.length) | 0],
    (Math.random() * 1e9) | 0);
  // wider dice than a founding child: these are strangers, and the
  // spread is what makes one worth going out into the dark for
  const base = rollBase();
  base.speed = 1.35 + Math.random() * 1.1;
  base.dmg = .75 + Math.random() * .85;
  base.maxStam = 80 + ((Math.random() * 45) | 0);
  const k = makeKid(g.x + Math.cos(a) * r, g.z + Math.sin(a) * r, base, it ? [it] : []);
  k.lost = true;
  k.sob = 0;
  lost.push(k);
  say('someone is crying, a long way off');
  sfxAt('squiggle', k.x, k.z, { vol: .5 });
  return k;
}

// ---- the lanterns somebody left burning -------------------------
// No draft ever deals a floor light now, so this is the only way one
// arrives: it is already out there, already lit, and you find it the
// same way you find a child — by walking into the dark until
// something in it is glowing. On a floor with no landmarks a distant
// pool of light is the only thing that can pull a class anywhere, and
// unlike a lost child it needs no beacon, because it IS one.
//
// It is rolled from the real `Lantern` family, so what you find is a
// proper generated object with its own drawing, radius and tank.
const LANTERN_MAX = 3;
const LANTERN_MIN = 16, LANTERN_SPAN = 22;
let lanternT = 12;

function placeLantern() {
  const g = flockAt();
  const a = Math.random() * Math.PI * 2, r = LANTERN_MIN + Math.random() * LANTERN_SPAN;
  const it = rollItem('lantern',
    LOST_RANKS[(Math.random() * LOST_RANKS.length) | 0],
    (Math.random() * 1e9) | 0);
  if (!it?.obj) return null;
  const o = it.obj;
  const th = addThing({
    ...o, x: g.x + Math.cos(a) * r, z: g.z + Math.sin(a) * r, maxFuel: o.fuel,
    draw: propDrawFor(it), seed: `item:${it.uid}:${it.seed}`, item: it,
  });
  say('there is a light burning out there');
  return th;
}

function stepLost(l, t, dt) {
  l.animator.setPose('idle');
  l.animator.setFace('crying');
  // they call out now and then, panned from where they are — on a
  // floor with no landmarks this is half of how you find them
  if ((l.sob -= dt) <= 0) {
    l.sob = 5 + Math.random() * 4;
    sfxAt('squiggle', l.x, l.z, { vol: .45 });
  }
  for (const k of kids) {
    if (Math.hypot(k.x - l.x, k.z - l.z) > FIND_R) continue;
    const i = lost.indexOf(l);
    if (i >= 0) lost.splice(i, 1);
    enlist(l);
    l.sob = 0;
    audio.sfx('tick');
    say(`${l.name} was found in the dark`);
    return;
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
  // The SHAPE of the hand — one way of SEEING and four things to
  // carry — lives in items/index.js. All the room contributes is its
  // veto: never offer a card nobody here can use, because a mutation
  // every child already has is a dead choice on the table.
  state.offers = drawOffers(state.favor, { ok: anyoneCanTake });
  state.paused = true;
  audio.sfx('paper');
  state.level++;
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
  state.paused = false;
  renderDraft();
}

// Every card is now something a child CARRIES — the draft stopped
// dealing furniture when the room stopped having any, and stopped
// dealing floor lanterns when it turned out a place is worthless to a
// class that never stands still. So there is one beat left: tap who
// gets it.
function applyPending(ent) {
  const it = state.pending;
  if (!it) return false;
  if (!ent || ent.kind !== 'kid') return false;
  if (!giveItem(ent, it)) { say('that one will not take it'); return false; }
  sfxAt('scratch', ent.x, ent.z);        // drawn into their hands
  say(`${ent.name} takes ${withArticle(it.name)}`);

  bumpFavor(state.favor, it.family);
  state.pending = null;
  state.paused = false;
  renderDraft();
  return true;
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
  if (e.key === ' ') { panHold = 0; const g = flockAt(); lookAtXZ(g.x, g.z); }
  if (e.key === 'Escape' && state.pending) discardPending();
  const n = parseInt(e.key, 10);
  if (state.offers && n >= 1 && n <= state.offers.length) chooseOffer(n - 1);
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
// also what stops a pan from marching the whole class across the room
// while the draft is waiting for you to pick a spot.
//
// Panning grabs the floor: we remember the world point under the
// finger and move the camera so that point stays under it. No
// pixels-to-world conversion, so it is exact at any zoom and angle.
// =================================================================
const TAP_SLOP = 11;                     // px of travel still counts as a tap
const TAP_MS = 400;
const ptrs = new Map();
let drag = null;                         // { id, from } once panning
let pinch = null;

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
    if (a && b) camWant.set(drag.from.x + a.x - b.x, 0, drag.from.z + a.z - b.z);
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

  if (state.pending) { applyPending(ent); return; }
  if (state.paused) return;

  // THE FLOOR IS THE WHOLE GAME. There is nothing to tap ON any more:
  // picking a child up used to open a card, and a card you can read
  // but not act on is a menu pretending to be a verb. Children are
  // only ever tapped while the draft is holding an object out, which
  // is handled above.
  if (onGround) {
    state.goto = { x: hitPt.x, z: hitPt.z };
    // NOT 'tap' — that is the sound of a hit landing, and hearing it
    // every time you point at the floor made your own orders sound
    // like something hitting a nightmare. This is chalk on lino.
    sfxAt('scratch', hitPt.x, hitPt.z, { vol: .45 });
  }
}

// ---- the buttons a thumb can reach ------------------------------
// Two-finger twist is horrible to aim, and this room has nothing that
// needs an arbitrary angle — so touch gets quarter turns instead.
document.getElementById('rot-l').onclick = () => { camAzWant -= Math.PI / 2; };
document.getElementById('rot-r').onclick = () => { camAzWant += Math.PI / 2; };
document.getElementById('zoom-in').onclick = () => setZoom(halfH * .78);
document.getElementById('zoom-out').onclick = () => setZoom(halfH * 1.28);
// snap straight back to the flock, and hand the camera back to it
document.getElementById('centre').onclick = () => {
  panHold = 0;
  const g = flockAt();
  lookAtXZ(g.x, g.z);
};

// ---- HUD --------------------------------------------------------
const hudEl = document.getElementById('hud');
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

// Every card is carried by somebody now, so there is no "put it on
// the floor" any more.
const SLOT_WORD = {
  held: 'for one child to carry', offhand: 'for one child’s other hand',
  worn: 'for one child to wear', charm: 'for one child to keep',
  mutation: 'this happens to one child',
};

function renderDraft() {
  draftEl.classList.toggle('thin', !!state.pending && !state.offers);
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
    // are choosing between five drawings.
    draftEl.querySelectorAll('button').forEach(b => {
      const o = state.offers[+b.dataset.i];
      b.insertBefore(thumbFor(o, 96), b.querySelector('em'));
      b.onclick = () => chooseOffer(+b.dataset.i);
    });
  } else if (state.pending) {
    draftEl.style.display = 'flex';
    draftEl.innerHTML = `<h2>tap the child who gets it`
      + `<small> · esc to put it back</small></h2>`;
  } else {
    draftEl.style.display = 'none';
  }
}

// The whole readout. There is no character panel any more: what a
// child is carrying is DRAWN ON THE CHILD, and how it is doing is the
// red pulse and the mark over its head. A card would only be
// restating, in words, things already on the paper.
function updateHud() {
  const left = Math.max(0, Math.ceil(xpNeed - state.xp));
  hudEl.textContent = `children ${kids.length} · level ${state.level} · ${left} more`;
  barEl.style.width = `${Math.max(0, Math.min(1, state.xp / xpNeed)) * 100}%`;
}

// ---- the opening hand -------------------------------------------
// One lantern on the floor: the patch of light the class starts in,
// and the only thing here that is not something you chose.
addThing({ kind: 'light', draw: drawLantern, wU: .7, hU: 1.05, x: 0, z: 0, r: 4.4, fuel: 150, maxFuel: 150 });

let toSpawn = 3;
renderDraft();

// ---- the title screen -------------------------------------------
// It is a screen with a job. A child costs ~20 ms to build and as
// little as possible may build during play — so the class fills itself
// in behind the title, one per frame, while you are reading the rules.
// By the time you press the button the room is already standing there,
// breathing.
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
  say('tap the floor — they all walk there');
}
document.getElementById('begin').onclick = begin;

// ---- loop -------------------------------------------------------
// It is a NAMED function, not a closure handed straight to
// setAnimationLoop, so that `pump()` below can drive it by hand. A
// browser throttles rAF to a crawl whenever the tab is not visible,
// which makes every measurement taken off a hidden panel a lie —
// this is the only way to run the night to its end and read the
// numbers off it.
onResize();
let last = performance.now(), mareT = 0, musicT = 0;
function frame(now) {
  const dtRaw = Math.min(.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  // the draft stops the world; the title has not started it yet
  const dt = state.paused || !state.started ? 0 : dtRaw;
  if (!state.started) camAzWant += dtRaw * .09;

  if (toSpawn > 0) spawnKid(3 - toSpawn--);

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
      th.fuel -= dt * thriftAt(th.x, th.z);
      if (th.fuel <= 0) {
        say('a light went out'); state.gloom = 1;
        sfxAt('puff', th.x, th.z);
        removeThing(th);
      }
    }
    // ONE build per frame, and never two: a nightmare arriving and a
    // child being placed in the same frame is 40ms and you would feel
    // it. The nightmare goes first — it is the one on a clock.
    let built = false;
    mareT += dt;
    const ms = mareStats();
    if (mareT > ms.every) {
      mareT = 0;
      spawnMare();
      built = true;
      // the rest of the wave arrives over the next few frames
      for (let i = 1; i < ms.n; i++) queued.push(1);
    } else if (queued.length) { queued.pop(); spawnMare(); built = true; }

    lostT -= dt;
    if (!built && lostT <= 0 && lost.length < LOST_MAX && kids.length) {
      lostT = 8 + Math.random() * 7;
      placeLost();
      built = true;
    }

    lanternT -= dt;
    if (!built && lanternT <= 0 && things.length < LANTERN_MAX && kids.length) {
      lanternT = 18 + Math.random() * 14;
      placeLantern();
    }

    for (const m of [...mares]) stepMare(m, t, dt);
    for (const l of [...lost]) stepLost(l, t, dt);
    for (const p of [...pets]) stepPet(p, t, dt);
    stepShots(dt);
    separate();
  }

  followFlock(dtRaw);
  updateCamera(dtRaw);
  updateFloor();
  // the dark is a plane, and it goes where you are looking — on an
  // endless floor it has to travel or you would drag its edge into shot
  darkness.mesh.position.set(camAt.x, .04, camAt.z);

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

  for (const c of [...kids, ...mares, ...pets, ...lost]) {
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
    // A CHILD in the dark is still a shape you can find. A NIGHTMARE
    // is not: unlit it is almost nothing on the page, which is the
    // whole reason to be carrying a lamp.
    const floor = c.kind === 'mare' ? MARE_VIS : DARK_VIS;
    const v = floor + (1 - floor) * lightAt(c.x, c.z);
    // a struck nightmare flares white for a moment — the only way to
    // tell a hit landed on something that is already a black scribble
    const flare = c.hitFlash > 0 ? c.hitFlash * .9 : 0;
    // Two tiers, and they never both fire: RED means losing energy
    // right now, AMBER means low. Red wins.
    const mine = c.kind === 'kid' && !c.lost;
    const bleeding = mine && c.hurt > 0;
    const tired = mine && !bleeding && c.stamina < c.maxStam * .25;

    if (c.dying > 0) {
      // already fading out; leave it alone
    } else if (bleeding) {
      // A child being frightened pulses RED. The red is added flat
      // rather than scaled by the light, because the whole point is
      // that you can see it in a part of the room you cannot
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
      const show = bleeding || tired || c.lost;
      c.mark.visible = show;
      if (show) {
        // A LOST child's mark is the only thing in this game that is
        // visible through the dark, and it has to be: an endless floor
        // with no landmark and no map is not mysterious, it is just a
        // place you cannot find anything in. It fades up as you close
        // on them, so it is a direction rather than an answer.
        const far = Math.hypot(c.x - camAt.x, c.z - camAt.z);
        c.mark.material.map = c.lost ? MARK_LOST : bleeding ? MARK_ALERT : MARK_TIRED;
        c.mark.material.color.setRGB(
          ...(c.lost ? [.72, .86, 1] : bleeding ? [1, .38, .34] : [1, .8, .45]));
        c.mark.material.opacity = c.lost
          ? Math.max(.12, .75 - far / 46) * (.7 + .3 * Math.sin(t * 2.4))
          : .55 + .45 * Math.sin(t * (bleeding ? 7 : 3.2));
        c.mark.position.set(c.x, 2.35 + Math.sin(t * 2 + c.id) * .05, c.z);
        c.mark.rotation.y = view.az;
      }
    }
    c.animator.update(t, dtRaw);
  }

  for (const th of things) {
    th.mesh.rotation.y = view.az;
    const v = DARK_VIS + (1 - DARK_VIS) * lightAt(th.x, th.z);
    th.mesh.material.color.setScalar(v);
  }

  for (const s of shots) {
    s.mesh.position.set(s.x, s.y, s.z);
    s.mesh.rotation.y = view.az;                   // a marble is a billboard too
    const v = DARK_VIS + (1 - DARK_VIS) * lightAt(s.x, s.z);
    s.mesh.material.color.setScalar(v);
  }

  gotoMark.visible = !!state.goto && state.started && !state.over;
  if (gotoMark.visible) {
    gotoMark.position.set(state.goto.x, .075, state.goto.z);
    gotoMark.rotation.z = t * .35;                 // it is chalk, and it is restless
    gotoMark.material.opacity = .28 + .16 * Math.sin(t * 3.4);
  }

  const board = [...things, ...kids, ...mares, ...pets, ...lost]
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
    const darkFrac = kids.length ? kids.filter(k => k.lit < SEE).length / kids.length : 0;
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
}
renderer.setAnimationLoop(frame);

// Drive the world by hand, one synthetic frame at a time. It MUST
// yield between frames or a test that awaits it never resolves.
//
// The yield is a MessageChannel, and both of the obvious alternatives
// are traps. `setTimeout` is clamped to about a second in a hidden
// tab, so a timer-based pump takes an hour to run a minute of game —
// and a hidden tab is exactly the case this function exists for,
// because that is when rAF stops. `await Promise.resolve()` is worse
// in the other direction: a microtask never lets the event loop run
// at all, so the page appears to hang for the whole pump and nothing
// can read the result. A channel message is a real task, and it is
// not throttled.
const pumpChan = new MessageChannel();
const pumpTick = () => new Promise(r => {
  pumpChan.port1.onmessage = () => r();
  pumpChan.port2.postMessage(0);
});

let pumpT = performance.now();
async function pump(n = 60, step = 1000 / 60) {
  for (let i = 0; i < n; i++) {
    pumpT += step;
    frame(pumpT);
    await pumpTick();
  }
  return { t: pumpT, kids: kids.length, mares: mares.length, level: state.level };
}

window.__game ={ state, kids, mares, pets, lost, things, shots, lightAt, spawnMare, openDraft,
  audio, begin, giveItem, recomputeKid, camera, renderer, addXp, camWant, camAt, lookAtXZ,
  groupAt, flockAt, placeLost, placeLantern, rollBase, makeKid, enlist, mareStats, strike,
  frame, pump,
  chooseOffer, applyPending, discardPending, nearestKid, thriftAt,
  get xpNeed() { return xpNeed; }, get halfH() { return halfH; }, get az() { return camAzWant; } };
