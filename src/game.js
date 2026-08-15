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
//   Playing fills the bar. When it fills, everything STOPS and you
//   draw three cards: a knack for one child, a lamp, a toy, a bed.
//   Knacks ask which child; things ask where on the floor.
//
//   The room is black outside the lamps. Dark drains a child fast,
//   and at zero its parents come and take it home.
//
//   Every child has a NERVE from -3 to +3 and every nightmare a
//   MENACE from -3 to +3. Courage is nerve plus the light you happen
//   to be standing in, so the same child freezes in the dark and
//   squares up under a lamp. Out-matched, it freezes and cries — and
//   a frozen child ignores your orders until the thing goes away.
//
// THE VIEW is 3D: floor on XZ, orbiting orthographic camera, and
// every upright drawing a billboard yawed to face it. See
// ARCHITECTURE.md §6b.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { ROOM_BG, makeFloorTexture, makeShadowTextures } from './ground.js';
import {
  makeProp, drawBedTop, drawBall, drawLantern, drawTorch, drawAreaLantern,
} from './scenery.js';
import { createDarkness } from './dark.js';
import { createPostFX } from './postfx.js';
import { Sketch } from './sketch.js';
import { setRender, U } from './part.js';
import { newRecipe, buildCharacter, ensureParams, setDepthRank, shadowOrder, LAYER } from './rig.js';
import { createAnimator } from './anim.js';

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
const RECOVER = 4;
const TIRED = 25;
const PLAY_WEAR = 1.5, BED_WEAR = 1.2;

// The first bars fill in seconds. Nothing about a level gets harder
// except how long the next one takes — the ramp is entirely time.
const XP_RATE = .38;                     // bar per second of play, x the toy
let xpNeed = 1.6;

const MARE_V = .5, MARE_CHEW = 9, MARE_HP = 6;
const MARE_SLOW = .88, MARE_EVERY = 16;

const state = {
  xp: 0, level: 0, lost: 0, over: false, flash: 0, gloom: 0,
  paused: false, offers: null, pending: null, selected: null,
};

// ---- boot -------------------------------------------------------
const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(ROOM_BG);

let halfH = 8.5;
const ORBIT_R = 16, ORBIT_Y = 9.6;
let camAz = .55;
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

function updateCamera(dt) {
  camAz += ((keys.q ? 1 : 0) - (keys.e ? 1 : 0)) * 1.2 * dt;
  view.az = camAz;
  camera.position.set(Math.sin(camAz) * ORBIT_R, ORBIT_Y, Math.cos(camAz) * ORBIT_R);
  camera.lookAt(0, .6, 0);
  view.rightX = Math.cos(camAz);
  view.rightZ = -Math.sin(camAz);
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
    seed: `${o.kind}${things.length}:${(Math.random() * 1e6) | 0}`,
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

function removeThing(t) {
  scene.remove(t.mesh);
  if (t.pool) scene.remove(t.pool);
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
  for (const k of kids) if (k.lampR > 0) LIGHTS.push({ x: k.x, z: k.z, r: k.lampR });
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

function buildBody(species, wantH) {
  const recipe = newRecipe();
  recipe.species = species;
  recipe.media = 'graphite';
  recipe.base = null;
  ensureParams(recipe);
  const face = buildCharacter(recipe);
  for (const e of face.entries) {
    const warm = WARM[e.id];
    if (!warm) continue;
    const cur = e.part.cur.state;
    for (const st of warm) e.part.setState(st);
    e.part.setState(cur);
  }
  const scale = (wantH / 1.4) * (.58 / (face.F.s / U)) * (.92 + Math.random() * .16);

  const holder = new THREE.Group();
  face.group.position.y = face.F.B.floorY / U;
  holder.add(face.group);
  scene.add(holder);

  const sw = (face.F.B.halfW * 3.0) / U * scale;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(sw, sw * .5),
    new THREE.MeshBasicMaterial({
      map: SHADOWS[(Math.random() * SHADOWS.length) | 0],
      transparent: true, depthWrite: false, opacity: .8,
    }),
  );
  shadow.rotation.order = 'YXZ';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .06 + Math.random() * .02;
  scene.add(shadow);

  return { face, holder, shadow, scale, parts: face.entries.map(e => e.part.matl) };
}

const NAMES = ['Poppy', 'Tam', 'Pearl', 'Wren', 'Nils', 'Juno', 'Bruno', 'Lilo'];

function spawnKid(i) {
  const body = buildBody('human', KID_H);
  const a = Math.random() * Math.PI * 2, r = .8 + Math.random() * 1.6;
  const k = {
    ...body, kind: 'kid', id: i, name: NAMES[i % NAMES.length],
    x: Math.cos(a) * r, z: Math.sin(a) * r,
    h: Math.random() * Math.PI * 2, rad: BODY_R,
    stamina: STAM_MAX,
    speed: .9 + Math.random() * .7,
    dmg: 1.4 + Math.random() * .6,
    reach: 1.7, swingT: .85, rest: 1, lampR: 0, lampPool: null,
    act: 'idle', order: null,
    lit: 1, gone: false, swing: 0, warned: false,
    animator: createAnimator(() => body.face, {
      blink: true, gaze: true, talk: false, sway: true, breath: true,
      boil: true, boilSpeed: .5, phase: Math.random() * 20, amp: 1.1,
    }),
  };
  addPick(k, 1.1, 2.1);
  k.mark = makeMark();
  kids.push(k);
  return k;
}

function spawnMare() {
  const body = buildBody('nightmare', 1.7);
  const a = Math.random() * Math.PI * 2, r = ROOM_R + 3;
  const m = {
    ...body, kind: 'mare',
    x: Math.cos(a) * r, z: Math.sin(a) * r,
    h: 0, rad: BODY_R * 1.25, hp: MARE_HP, dying: 0, stagger: 0,
    hitFlash: 0, knock: null, target: null, retarget: 0,
    animator: createAnimator(() => body.face, {
      blink: true, gaze: true, talk: false, sway: true, breath: true,
      boil: true, boilSpeed: .8, phase: Math.random() * 20, amp: 1.5,
    }),
  };
  m.animator.setPose('walk', { speed: .5 });
  addPick(m, 1.2, 2);
  mares.push(m);
  return m;
}

function despawn(c, list) {
  scene.remove(c.holder, c.shadow);
  if (c.lampPool) scene.remove(c.lampPool);
  if (c.mark) scene.remove(c.mark);
  dropPick(c);
  c.face.dispose();
  c.shadow.geometry.dispose(); c.shadow.material.dispose();
  const i = list.indexOf(c); if (i >= 0) list.splice(i, 1);
  if (state.selected === c) state.selected = null;
}

// a nightmare wants the closest bed or toy and does not care who is
// using it — in fact that is the whole horror of the thing
function nearestBreakable(x, z) {
  let best = null, bd = 1e9;
  for (const t of things) {
    if ((t.kind !== 'bed' && t.kind !== 'toy') || t.dur <= 0) continue;
    const d = Math.hypot(t.x - x, t.z - z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

function separate() {
  const all = [...kids, ...mares];
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

function stepKid(k, t, dt) {
  k.lit = lightAt(k.x, k.z);
  const dark = k.lit < .12;

  if (k.act === 'sleep') k.stamina = Math.min(STAM_MAX, k.stamina + RECOVER * k.rest * dt);
  else k.stamina -= (dark ? DRAIN_DARK : DRAIN_IDLE) * dt;

  if (k.stamina < TIRED && !k.warned) {
    k.warned = true;
    say(dark ? `${k.name} is frightened` : `${k.name} needs to sleep`);
  } else if (k.stamina > TIRED + 14) k.warned = false;

  if (k.stamina <= 0) {
    k.gone = true; state.lost++; state.flash = 1;
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
    if (d > k.reach) { moveTo(k, o.obj.x, o.obj.z, dt, 1.3); k.animator.setPose('run'); }
    else if ((k.swing -= dt) <= 0) {
      k.swing = k.swingT;
      k.animator.setPose('attack');
      const m = o.obj;
      m.hp -= k.dmg;
      m.stagger = .35;
      // the hit has to LAND: a white flare, a shove away from whoever
      // threw it, and the thing flinches
      m.hitFlash = 1;
      const a = Math.atan2(m.z - k.z, m.x - k.x);
      m.knock = { x: Math.cos(a) * 2.6, z: Math.sin(a) * 2.6 };
      m.animator.setFace('scared');
      state.flash = Math.max(state.flash, .18);
      if (o.obj.hp <= 0) {
        o.obj.dying = .6;
        say(`${k.name} drove one off`);
        for (const other of kids) if (other.order?.obj === o.obj) { other.order = null; other.act = 'idle'; }
      }
    }
    k.animator.setFace('angry');
    return;
  }

  // bed or toy: walk to it, then stay on it until it breaks, they are
  // done, or you tell them otherwise
  const obj = o.obj;
  if (!things.includes(obj) || obj.dur <= 0) { k.order = null; k.act = 'idle'; return; }
  if (Math.hypot(obj.x - k.x, obj.z - k.z) > .55) {
    k.act = 'walk';
    moveTo(k, obj.x, obj.z, dt);
    k.animator.setPose('walk');
    k.animator.setFace(dark ? 'scared' : 'idle');
    return;
  }

  if (obj.kind === 'toy') {
    k.act = 'play';
    obj.dur -= PLAY_WEAR * dt;
    addXp(XP_RATE * obj.play * dt);
    k.animator.setPose('play');
    k.animator.setFace(dark ? 'scared' : 'idle');
    if (obj.dur <= 0) { say('a toy broke'); removeThing(obj); }
  } else {
    k.act = 'sleep';
    obj.dur -= BED_WEAR * dt;
    k.animator.setPose('sleep');
    k.animator.setFace('sleeping');
    if (obj.dur <= 0) { say('a bed broke'); removeThing(obj); }
    else if (k.stamina >= STAM_MAX - 1) { k.order = null; k.act = 'idle'; }
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
  const speed = MARE_V * (1 - MARE_SLOW * lit);
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
    m.target.dur -= MARE_CHEW * dt;
    state.flash = Math.max(state.flash, .35);
    if (m.target.dur <= 0) {
      say(m.target.kind === 'bed' ? 'a nightmare broke a bed' : 'a nightmare broke a toy');
      removeThing(m.target);
      m.target = null;
    }
  }
}

// ---- the draft --------------------------------------------------
const KNACKS = [
  { id: 'strong', label: 'Strong', desc: 'hits much harder', kid: k => { k.dmg *= 1.6; } },
  { id: 'quick', label: 'Quick', desc: 'runs faster', kid: k => { k.speed *= 1.3; } },
  { id: 'reach', label: 'Long arms', desc: 'reaches further', kid: k => { k.reach *= 1.4; } },
  { id: 'fury', label: 'Fury', desc: 'swings more often', kid: k => { k.swingT *= .7; } },
  { id: 'lamp', label: 'Little lantern', desc: 'a light that follows them', kid: k => { k.lampR += k.lampR ? 1 : 2.6; } },
  { id: 'nap', label: 'Good sleeper', desc: 'rests far quicker', kid: k => { k.rest *= 1.7; } },
];
const PLACEABLES = [
  { id: 'torch', label: 'Torch', desc: 'small light, burns out fast', put: { kind: 'light', draw: drawTorch, wU: .5, hU: 1.2, r: 2.3, fuel: 55 } },
  { id: 'lantern', label: 'Lantern', desc: 'an honest light', put: { kind: 'light', draw: drawLantern, wU: .7, hU: 1.05, r: 4.4, fuel: 105 } },
  { id: 'biglamp', label: 'Standing lamp', desc: 'lights half the room', put: { kind: 'light', draw: drawAreaLantern, wU: 1.5, hU: 2.2, r: 5.8, fuel: 150 } },
  { id: 'toy', label: 'Toy', desc: 'a good one — fills the bar faster', put: { kind: 'toy', draw: drawBall, wU: .6, hU: .6, dur: 100, play: 1.35 } },
  { id: 'bed', label: 'Bed', desc: 'somewhere to sleep', put: { kind: 'bed', draw: drawBedTop, wU: 1.5, hU: 2.1, flat: true, dur: 100 } },
];

function addXp(n) {
  if (state.paused || state.over) return;
  state.xp += n;
  if (state.xp >= xpNeed) { state.xp -= xpNeed; xpNeed *= 1.42; openDraft(); }
}

function openDraft() {
  const pool = [...KNACKS.map(k => ({ ...k, type: 'knack' })),
                ...PLACEABLES.map(p => ({ ...p, type: 'place' }))];
  const offers = [];
  while (offers.length < 3 && pool.length) offers.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  state.offers = offers;
  state.paused = true;
  state.level++;
  renderDraft();
}

function chooseOffer(i) {
  state.pending = state.offers[i];
  state.offers = null;
  renderDraft();
}

function applyPending(ent, gx, gz) {
  const p = state.pending;
  if (!p) return false;
  if (p.type === 'knack') {
    if (!ent || ent.kind !== 'kid') return false;
    p.kid(ent);
    say(`${ent.name}: ${p.label}`);
    if (p.id === 'lamp' && !ent.lampPool) ent.lampPool = makePool(2.6);
  } else {
    if (gx === undefined || Math.hypot(gx, gz) > ROOM_R) return false;
    addThing({ ...p.put, x: gx, z: gz, maxFuel: p.put.fuel, maxDur: p.put.dur });
    say(`${p.label} placed`);
  }
  state.pending = null;
  state.paused = false;
  renderDraft();
  return true;
}

// ---- input ------------------------------------------------------
const keys = {};
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'r' || e.key === 'R') location.reload();
  if (e.key === 'Escape') state.selected = null;
  const n = parseInt(e.key, 10);
  if (state.offers && n >= 1 && n <= state.offers.length) chooseOffer(n - 1);
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('wheel', e => {
  halfH = Math.min(26, Math.max(3.4, halfH * (1 + Math.sign(e.deltaY) * .12)));
  onResize();
}, { passive: true });

const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPt = new THREE.Vector3();

renderer.domElement.addEventListener('pointerdown', ev => {
  if (state.over) return;
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((ev.clientX - r.left) / r.width) * 2 - 1,
    -((ev.clientY - r.top) / r.height) * 2 + 1,
  );
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables, false);
  const ent = hits.length ? hits[0].object.userData.ent : null;
  const onGround = ray.ray.intersectPlane(groundPlane, hitPt);

  if (state.pending) {                      // the draft is waiting on a target
    applyPending(ent, onGround ? hitPt.x : undefined, onGround ? hitPt.z : undefined);
    return;
  }
  if (state.paused) return;

  if (ent && ent.kind === 'kid') { state.selected = ent; return; }
  const k = state.selected;
  if (!k || k.gone) return;

  if (ent && ent.kind === 'mare') { k.order = { type: 'fight', obj: ent }; say(`${k.name} goes for it`); }
  else if (ent && (ent.kind === 'bed' || ent.kind === 'toy')) {
    k.order = { type: ent.kind, obj: ent };
    say(`${k.name} → ${ent.kind === 'bed' ? 'off to bed' : 'off to play'}`);
  } else if (onGround) {
    k.order = { type: 'move', x: hitPt.x, z: hitPt.z };
  }
});

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

function renderDraft() {
  draftEl.classList.toggle('thin', !!state.pending && !state.offers);
  if (state.offers) {
    draftEl.style.display = 'flex';
    draftEl.innerHTML = `<h2>something new</h2><div class="cards">` + state.offers.map((o, i) =>
      `<button data-i="${i}"><b>${o.label}</b><span>${o.desc}</span>`
      + `<em>${o.type === 'knack' ? 'for one child' : 'put it on the floor'}</em><i>${i + 1}</i></button>`).join('') + `</div>`;
    draftEl.querySelectorAll('button').forEach(b => b.onclick = () => chooseOffer(+b.dataset.i));
  } else if (state.pending) {
    draftEl.style.display = 'flex';
    draftEl.innerHTML = `<h2>${state.pending.type === 'knack'
      ? 'click the child who gets it' : 'click the floor to put it down'}</h2>`;
  } else {
    draftEl.style.display = 'none';
  }
}

const ACTION = { idle: 'waiting', walk: 'walking', play: 'playing', sleep: 'sleeping', fight: 'fighting' };

function updateHud() {
  const k = state.selected;
  hudEl.textContent = `children ${kids.length}`;
  if (!k || k.gone) { cardEl.style.display = 'none'; }
  else {
    cardEl.style.display = 'block';
    const p = Math.max(0, Math.min(1, k.stamina / STAM_MAX));
    const low = p < .25 ? ' low' : k.lit < .12 ? ' dark' : '';
    cardEl.innerHTML =
      `<h3>${k.name}</h3>`
      + `<div class="e"><i class="${low.trim()}" style="width:${(p * 100).toFixed(0)}%"></i>`
      + `<u>energy ${Math.round(k.stamina)}</u></div>`
      + `<dl><dt>speed</dt><dd>${k.speed.toFixed(1)}</dd>`
      + `<dt>attack</dt><dd>${k.dmg.toFixed(1)}</dd></dl>`
      + `<p>${ACTION[k.act] ?? k.act}${k.lampR ? ' · carries a lantern' : ''}</p>`;
  }
  barEl.style.width = `${Math.max(0, Math.min(1, state.xp / xpNeed)) * 100}%`;
}

// ---- the opening hand -------------------------------------------
addThing({ kind: 'light', draw: drawLantern, wU: .7, hU: 1.05, x: 0, z: 0, r: 4.4, fuel: 105, maxFuel: 105 });
addThing({ kind: 'bed', draw: drawBedTop, wU: 1.5, hU: 2.1, flat: true, x: -2.2, z: 1.2, dur: 100, maxDur: 100 });
addThing({ kind: 'toy', draw: drawBall, wU: .6, hU: .6, x: 2.3, z: -.6, dur: 100, maxDur: 100, play: 1 });
// No decor. Everything on this floor is something you can click; a
// chair you cannot use is just a thing to mistake for a chair you can.

let toSpawn = [0, 1, 2];
renderDraft();

// ---- loop -------------------------------------------------------
onResize();
let last = performance.now(), mareT = 0;
renderer.setAnimationLoop(now => {
  const dtRaw = Math.min(.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  const dt = state.paused ? 0 : dtRaw;      // the draft stops the world

  if (toSpawn.length) spawnKid(toSpawn.shift());

  rebuildLights(t);

  if (!state.over && !state.paused) {
    for (const k of [...kids]) {
      stepKid(k, t, dt);
      if (k.gone) despawn(k, kids);
    }
    if (kids.length === 0 && !toSpawn.length) {
      state.over = true;
      const g = document.getElementById('gameover');
      g.style.display = 'flex';
      g.innerHTML = `the lights went out…<br><span style="font-size:18px">all ${state.lost} children went home · press R</span>`;
    }
    for (const th of [...things]) {
      if (th.kind !== 'light') continue;
      th.fuel -= dt;
      if (th.fuel <= 0) { say('a light went out'); state.gloom = 1; removeThing(th); }
    }
    mareT += dt;
    if (mareT > MARE_EVERY && things.some(x => x.kind === 'bed' || x.kind === 'toy')) {
      mareT = 0; spawnMare();
    }
    for (const m of [...mares]) stepMare(m, t, dt);
    separate();
  }

  updateCamera(dtRaw);

  darkness.update(LIGHTS, t);
  for (const th of things) {
    if (!th.pool) continue;
    const p = th.power ?? 1;
    th.pool.scale.setScalar(p);
    th.pool.material.opacity = p * (.9 + Math.sin(t * 6 + th.x) * .1);
  }

  for (const c of [...kids, ...mares]) {
    c.holder.position.set(c.x, 0, c.z);
    c.holder.rotation.y = view.az;
    c.holder.scale.set(c.scale, c.scale, 1);
    c.shadow.position.set(c.x, c.shadow.position.y, c.z);
    c.shadow.rotation.y = view.az;
    if (c.pick) { c.pick.position.set(c.x, 0, c.z); c.pick.rotation.y = view.az; }
    if (c.lampPool) {
      c.lampPool.position.set(c.x, .05, c.z);
      c.lampPool.scale.setScalar(c.lampR / 2.6);
    }
    const v = DARK_VIS + (1 - DARK_VIS) * lightAt(c.x, c.z);
    // a struck nightmare flares white for a moment — the only way to
    // tell a hit landed on something that is already a black scribble
    const flare = c.hitFlash > 0 ? c.hitFlash * .9 : 0;
    // Two tiers, and they never both fire: RED means losing energy
    // right now, AMBER means will need a bed soon. Red wins.
    const awake = c.kind === 'kid' && c.act !== 'sleep';
    const bleeding = awake && c.lit < .12;
    const tired = awake && !bleeding && c.stamina < STAM_MAX * .25;

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
    if (th.pick) th.pick.rotation.y = view.az;      // the target turns with it
    const v = DARK_VIS + (1 - DARK_VIS) * lightAt(th.x, th.z);
    th.mesh.material.color.setScalar(v * wear);
  }

  const sel = state.selected;
  ring.visible = !!(sel && !sel.gone);
  if (ring.visible) {
    ring.position.set(sel.x, .07, sel.z);
    ring.material.opacity = .5 + .25 * Math.sin(t * 3);
  }

  const board = [...things.filter(th => !th.flat), ...kids, ...mares]
    .sort((a, b) => depthKey(a.x, a.z) - depthKey(b.x, b.z));
  for (let r = 0; r < board.length; r++) {
    const b = board[r];
    if (b.face) { setDepthRank(b.face, r); b.shadow.renderOrder = shadowOrder(b.face); }
    else b.mesh.renderOrder = r * LAYER + 6;
  }

  state.flash = Math.max(0, state.flash - dtRaw * 2);
  state.gloom = Math.max(0, state.gloom - dtRaw * 1.1);
  ageMsgs(dtRaw);
  postfx.setFlash(state.flash);
  postfx.setGloom(state.gloom);
  updateHud();
  postfx.render(scene, camera);
});

window.__game = { state, kids, mares, things, lightAt, spawnMare, openDraft,
  camera, renderer, addXp, get xpNeed() { return xpNeed; } };
