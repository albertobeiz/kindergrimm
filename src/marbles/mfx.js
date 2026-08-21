// ---------------------------------------------------------------
// MFX — the impact department for `marbles.html`.
//
// Every consequence the arena shows for a collision lives here: the
// specks off a crushed enemy, the dust a marble ploughs up, the ring a
// shockwave leaves on the plastic, the bolt between two of them, the
// knock the camera takes. The game says WHAT happened; this file is the
// only thing that says what it LOOKED like. Nothing in here reads or
// writes game state, and nothing in the game needs to know a pool exists.
//
// FOUR RULES, and the first two are the ones that make it look expensive.
//
// 1. ADDITIVE WITHOUT BLOOM. There is no post stack, so brightness has
//    to be won against a mid-taupe floor (#d5cec1 — around .66 linear).
//    Additive means the floor's value is the FLOOR, so a broad white
//    sprite laid over it can only travel the last third of the way to
//    white: it reads as milk, not light. So the shape of every effect is
//    the same — a SMALL, SATURATED, over-driven core (colours are pushed
//    past 1.0 on purpose; the clamp at the end is what makes a core read
//    white-hot while its fringe keeps the hue) surrounded by a wide,
//    faint halo that stays under a quarter. And a ring is a dark-to-
//    bright GRADIENT with the peak at its leading edge, never a flat
//    band — an evenly lit annulus on a light floor reads as a painted
//    circle, an edge that is hot on the outside and falls away inward
//    reads as a shock travelling.
//    Everything is `toneMapped: false` for the same reason: the scene
//    runs ACES, and ACES takes exactly the top off the punch.
//
// 2. NOTHING LINGERS. Mobile-game juice is 100–450 ms. If an effect is
//    still on screen when the next one lands, both read as smoke. The
//    only exceptions are the floor ghosts, which are a trail and are
//    supposed to be a smear.
//
// 3. NO ALLOCATION IN THE UPDATE PATH, and none in the EMIT path either
//    — `spark()` fires dozens of times a second beside 450 animated
//    enemies. So every pool is a struct of `Float32Array`s, every emit
//    is positional arguments (see the note on `add`), and the effects
//    come to SIX draw calls however many of them are on screen (five
//    instanced pools and the lightning ribbon), plus one per live
//    floating label. `fx.stats().draws` reports it.
//
// 4. MOTION CURVES. Expansion is fast-out-slow, opacity falls on a
//    curve. `easeOf` and `fadeOf` at the top own both, and every effect
//    names one of them rather than rolling its own — that is what makes
//    a nova and a blast feel like they came out of the same box.
//
// A note on WHEN to build it: the two pooled `PointLight`s go into the
// scene at construction, so create the FX BEFORE the level's meshes. A
// light added later changes the lighting hash and forces every material
// already in the scene to recompile, which is a visible hitch.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { makeRng, hashStr } from '../rng.js';

// One seeded stream for the whole module. Nothing here needs to be
// reproducible for the GAME's sake — but a fixed-seed screenshot is how
// this project checks its own art direction, and `Math.random()` would
// put a different spray of sparks in every frame of the same replay.
const rng = makeRng(hashStr('mfx'));
const rnd = rng.next;
const TAU = Math.PI * 2;

// ---- curves -----------------------------------------------------
// Two functions, used by everything. `easeOf` drives SIZE (a shock is
// fastest at birth), `fadeOf` drives BRIGHTNESS. Linear anywhere in
// either and the effect reads as an animation rather than an event.
const EASE_OUT = 0, EASE_LIN = 1, EASE_QUINT = 2;
const easeOf = (id, t) => id === EASE_LIN ? t
  : id === EASE_QUINT ? 1 - (1 - t) ** 5
  : 1 - (1 - t) ** 3;

const P_TAIL = 0,   // hot immediately, gone quickly — sparks, specks
      P_FLASH = 1,  // a rise steep enough to be an impact, then a fall
      P_HOLD = 2,   // stays lit and then cuts — beams, tracers
      P_DUST = 3;   // blooms, then hangs and thins out
const fadeOf = (id, t) => id === P_FLASH ? (t < .18 ? t / .18 : (1 - (t - .18) / .82) ** 2)
  : id === P_HOLD ? 1 - t * t * t
  : id === P_DUST ? (t < .22 ? t / .22 : 1) * (1 - t) ** 1.5
  : (1 - t) ** 2;

// ---- how the effects sit on the floor ---------------------------
// Ground decals never write depth, so nothing here can z-fight with
// anything else in the module — the lifts exist only to clear the floor
// plane itself, and they are ordered by how much each effect wants to
// look like it is ON the plastic rather than above it.
const Y_GHOST = .004, Y_SMEAR = .006, Y_RING = .012,
      Y_FLASH = .018, Y_BOLT = .030, Y_DOME = .002;

const MODE_FACE = 0,   // camera-facing billboard
      MODE_FLAT = 1,   // lying in the floor plane, yawed
      MODE_UP = 2;     // standing on the floor, world-axis (domes)

// ---- the two numbers that tune the knock ------------------------
// Both are multiplied by trauma SQUARED, so they are the amplitude of
// the first frame of a full-power hit and nothing else. Raise these
// before raising the decay: a bigger number reads as a harder hit, a
// slower decay reads as a wobbly camera.
const SHAKE_POS = .11;    // world units, in the camera's own plane
const SHAKE_ROT = .016;   // radians of roll

// ---- the bakery -------------------------------------------------
// Four textures, procedural, baked once and shared by every pool.
// Every one of them varies ALPHA and leaves RGB at white: the colour of
// an effect comes from its instance colour, so one soft dot is a warm
// dust puff and a cold frost mote and a hot spark without a second map.
function surface(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c.getContext('2d');
}

function stops(g, list) {
  for (const [at, a] of list) g.addColorStop(at, `rgba(255,255,255,${a})`);
  return g;
}

/** the soft particle. A hot centre and a long tail — hard-edged quads
 *  are the single most prototype-looking thing a particle system does. */
function bakeDot() {
  const g = surface(128, 128);
  g.fillStyle = stops(g.createRadialGradient(64, 64, 0, 64, 64, 64), [
    [0, 1], [.18, .72], [.42, .28], [.72, .07], [1, 0]]);
  g.fillRect(0, 0, 128, 128);
  return g.canvas;
}

/** a shockwave edge. See rule 1: the peak sits at .93 of the radius and
 *  the inside ramps up to it from nothing, so what the eye catches is
 *  the leading edge and the wake behind it, not a lit disc. */
function bakeRing(inner, peak) {
  const g = surface(256, 256);
  g.fillStyle = stops(g.createRadialGradient(128, 128, 0, 128, 128, 128), [
    [0, 0], [inner, 0], [inner + (peak - inner) * .45, .06],
    [peak - .08, .32], [peak, 1], [peak + .05, .5], [1, 0]]);
  g.fillRect(0, 0, 256, 256);
  return g.canvas;
}

/** a bolt strip: a hot core across the width, tapered at both ends so a
 *  tracer arrives at a point instead of a cut-off rectangle. */
function bakeBolt() {
  const g = surface(128, 32);
  g.fillStyle = stops(g.createLinearGradient(0, 0, 0, 32), [
    [0, 0], [.28, .16], [.46, .9], [.5, 1], [.54, .9], [.72, .16], [1, 0]]);
  g.fillRect(0, 0, 128, 32);
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = stops(g.createLinearGradient(0, 0, 128, 0), [
    [0, 0], [.09, 1], [.91, 1], [1, 0]]);
  g.fillRect(0, 0, 128, 32);
  return g.canvas;
}

/** brightness per vertex, baked into the geometry.
 *
 *  This is the cheap half of `instanceColor`: the instance carries the
 *  colour and the fade, the geometry carries the SHAPE of the light
 *  across itself. A dome gets a bright rim and a faint apex out of it
 *  for nothing, which is the whole difference between a translucent
 *  shell and a lit balloon. */
function paint(geo, fn) {
  const p = geo.attributes.position, n = p.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = fn ? fn(p.getX(i), p.getY(i), p.getZ(i)) : 1;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = c;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// ---- one pool, four shapes --------------------------------------
// Sparks, dust, ground flashes, ghosts, rings, smears, tracers and
// domes are all the same object: a textured primitive with a position,
// two scales, a colour, an age and a life. The only thing that differs
// is which way it faces, and that is one number per instance.
//
// A NOTE ON `instanceColor`, because it is a silent trap in r160:
// `USE_INSTANCING_COLOR` reaches the VERTEX chunk but `color_fragment`
// only applies `vColor` under `USE_COLOR`. So an InstancedMesh whose
// material is not `vertexColors: true` takes its instance colours and
// throws them away — every particle comes out the material's flat white
// and nothing warns you. Hence `paint()` on every geometry (an all-ones
// `color` attribute) and `vertexColors: true` on every material.
//
// And `instanceColor` is built in the constructor rather than left to
// `setColorAt` to create on first use: adding it later changes the
// program cache key, which means a shader recompile in the middle of a
// fight.
const FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'grav', 'drag',
                'ax', 'ay', 'bx', 'by', 'yc', 'ys', 'r', 'g', 'b', 'age', 'life'];
const BYTES = ['mode', 'prof', 'ease'];

class Quads {
  constructor(scene, geo, map, cap, order) {
    this.cap = cap;
    this.n = 0;
    this.geo = geo;
    this.mat = new THREE.MeshBasicMaterial({
      map, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(geo, this.mat, cap);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    // A pool rewrites every instance every frame, so its bounding sphere
    // is stale the moment it is computed — and three computes one ONCE
    // for an InstancedMesh and then trusts it forever. Left culled, the
    // whole pool pops out of view the first time the camera swings.
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.count = 0;
    scene.add(mesh);
    this.mesh = mesh;
    this.M = mesh.instanceMatrix.array;
    this.C = mesh.instanceColor.array;
    for (const f of FIELDS) this[f] = new Float32Array(cap);
    for (const f of BYTES) this[f] = new Uint8Array(cap);
  }

  /** Twenty-one positional arguments, and yes it is ugly. An options
   *  object here would allocate once per speck and `pop()` deals eight
   *  of them per dead enemy, hundreds of times a fight — this is the one
   *  place in the project where readability loses on purpose.
   *  Returns false when the pool is full: at that point the screen is
   *  already saturated and one more speck is not the difference. */
  add(mode, x, y, z, vx, vy, vz, grav, drag, ax, ay, bx, by, yc, ys, r, g, b, life, prof, ease) {
    if (this.n >= this.cap) return false;
    const i = this.n++;
    this.mode[i] = mode; this.prof[i] = prof; this.ease[i] = ease;
    this.x[i] = x; this.y[i] = y; this.z[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.grav[i] = grav; this.drag[i] = drag;
    this.ax[i] = ax; this.ay[i] = ay; this.bx[i] = bx; this.by[i] = by;
    this.yc[i] = yc; this.ys[i] = ys;
    this.r[i] = r; this.g[i] = g; this.b[i] = b;
    this.age[i] = 0; this.life[i] = life;
    return true;
  }

  /** swap-remove: the last live instance drops into the hole, so the
   *  live region stays dense and the GPU upload stays short. */
  kill(i) {
    const j = --this.n;
    if (i !== j) {
      for (const f of FIELDS) { const a = this[f]; a[i] = a[j]; }
      for (const f of BYTES) { const a = this[f]; a[i] = a[j]; }
    }
  }

  step(dt, R, U, F) {
    const M = this.M, C = this.C;
    for (let i = 0; i < this.n;) {
      const life = this.life[i];
      const age = this.age[i] += dt;
      const t = age / life;
      if (t >= 1) { this.kill(i); continue; }   // a live one just landed on i

      const drag = this.drag[i];
      if (drag > 0 || this.grav[i] !== 0) {
        const d = 1 - Math.min(.95, drag * dt);
        let vx = this.vx[i] *= d, vy = this.vy[i] *= d, vz = this.vz[i] *= d;
        vy = this.vy[i] = vy + this.grav[i] * dt;
        const y = this.y[i] += vy * dt;
        this.x[i] += vx * dt;
        this.z[i] += vz * dt;
        // Specks LAND. A speck that sinks through the plastic is the
        // tell that the burst is a sprite animation and not debris.
        if (y < .012 && this.grav[i] < 0) {
          this.y[i] = .012; this.vy[i] = 0; this.grav[i] = 0;
          this.vx[i] = vx * .25; this.vz[i] = vz * .25;
        }
      }

      const e = easeOf(this.ease[i], t);
      const sx = this.ax[i] + (this.bx[i] - this.ax[i]) * e;
      const sy = this.ay[i] + (this.by[i] - this.ay[i]) * e;
      const o = i * 16;
      const mode = this.mode[i];
      if (mode === MODE_FACE) {
        M[o] = R.x * sx; M[o + 1] = R.y * sx; M[o + 2] = R.z * sx; M[o + 3] = 0;
        M[o + 4] = U.x * sy; M[o + 5] = U.y * sy; M[o + 6] = U.z * sy; M[o + 7] = 0;
        M[o + 8] = F.x; M[o + 9] = F.y; M[o + 10] = F.z; M[o + 11] = 0;
      } else if (mode === MODE_FLAT) {
        // local +x along the yaw, local +y across it, normal straight up.
        // The across-axis is the yaw turned MINUS ninety degrees, not
        // plus: the other way round gives a left-handed basis whose
        // normal points into the floor, and a single-sided decal then
        // renders on the wrong face and vanishes.
        const c = this.yc[i], s = this.ys[i];
        M[o] = c * sx; M[o + 1] = 0; M[o + 2] = s * sx; M[o + 3] = 0;
        M[o + 4] = s * sy; M[o + 5] = 0; M[o + 6] = -c * sy; M[o + 7] = 0;
        M[o + 8] = 0; M[o + 9] = 1; M[o + 10] = 0; M[o + 11] = 0;
      } else {
        M[o] = sx; M[o + 1] = 0; M[o + 2] = 0; M[o + 3] = 0;
        M[o + 4] = 0; M[o + 5] = sy; M[o + 6] = 0; M[o + 7] = 0;
        M[o + 8] = 0; M[o + 9] = 0; M[o + 10] = sx; M[o + 11] = 0;
      }
      M[o + 12] = this.x[i]; M[o + 13] = this.y[i]; M[o + 14] = this.z[i]; M[o + 15] = 1;

      const a = fadeOf(this.prof[i], t);
      const k = i * 3;
      C[k] = this.r[i] * a; C[k + 1] = this.g[i] * a; C[k + 2] = this.b[i] * a;
      i++;
    }

    this.mesh.count = this.n;
    if (this.n > 0) {
      const im = this.mesh.instanceMatrix, ic = this.mesh.instanceColor;
      // partial uploads, and the range and the flag are always set
      // together — a range added on a frame that does not upload is
      // never cleared and the list grows forever.
      im.addUpdateRange(0, this.n * 16); im.needsUpdate = true;
      ic.addUpdateRange(0, this.n * 3); ic.needsUpdate = true;
    }
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.geo.dispose();
    this.mat.map?.dispose();
    this.mat.dispose();
  }
}

export function createFX(scene, camera, renderer) {
  const ANISO = Math.min(4, renderer?.capabilities?.getMaxAnisotropy?.() ?? 1);
  const tex = canvas => {
    const t = new THREE.CanvasTexture(canvas);
    // Decals lie flat and the camera looks down the table at them, which
    // is the grazing case where an unfiltered map turns to mush.
    t.anisotropy = ANISO;
    return t;
  };

  const DOT = tex(bakeDot());
  const RING_THIN = tex(bakeRing(.58, .93));
  const RING_FAT = tex(bakeRing(.26, .88));
  const BOLT = tex(bakeBolt());

  const quad = () => paint(new THREE.PlaneGeometry(1, 1), null);
  // a unit hemisphere, bright at the rim and thin at the apex
  const domeGeo = paint(
    new THREE.SphereGeometry(1, 22, 8, 0, TAU, 0, Math.PI / 2),
    (x, y) => .25 + .75 * (1 - y) ** 1.4);

  const motes = new Quads(scene, quad(), DOT, 820, 12);        // specks, dust, ghosts, flashes
  const ringsThin = new Quads(scene, quad(), RING_THIN, 72, 10);
  const ringsFat = new Quads(scene, quad(), RING_FAT, 56, 10);
  const bolts = new Quads(scene, quad(), BOLT, 48, 14);        // tracers and beams
  const domes = new Quads(scene, domeGeo, null, 8, 16);
  const pools = [motes, ringsThin, ringsFat, bolts, domes];

  // ---- lightning ------------------------------------------------
  // One mesh for every bolt on screen. A `THREE.Line` was the obvious
  // build and is the wrong one: `linewidth` is 1 on every desktop GL
  // backend, so a bolt across half the table is a hairline you cannot
  // see. These are ribbons instead — real width, tapering to a point at
  // both ends — and they all live in ONE pre-built buffer with the
  // indices baked at construction, so twenty-four of them are one draw
  // call and a spawn only rewrites its own slice.
  const ZAPS = 24, ZSEG = 9, ZPTS = ZSEG + 1, ZVERT = ZPTS * 2;
  const zapGeo = new THREE.BufferGeometry();
  const zPos = new Float32Array(ZAPS * ZVERT * 3);
  const zCol = new Float32Array(ZAPS * ZVERT * 3);
  {
    const uv = new Float32Array(ZAPS * ZVERT * 2);
    const idx = new Uint16Array(ZAPS * ZSEG * 6);
    let w = 0;
    for (let k = 0; k < ZAPS; k++) {
      const base = k * ZVERT;
      for (let j = 0; j < ZPTS; j++) {
        const u = j / ZSEG, v = (base + j * 2) * 2;
        uv[v] = u; uv[v + 1] = 0;
        uv[v + 2] = u; uv[v + 3] = 1;
      }
      for (let j = 0; j < ZSEG; j++) {
        const a = base + j * 2;
        idx[w++] = a; idx[w++] = a + 1; idx[w++] = a + 2;
        idx[w++] = a + 1; idx[w++] = a + 3; idx[w++] = a + 2;
      }
    }
    zapGeo.setAttribute('position', new THREE.BufferAttribute(zPos, 3).setUsage(THREE.DynamicDrawUsage));
    zapGeo.setAttribute('color', new THREE.BufferAttribute(zCol, 3).setUsage(THREE.DynamicDrawUsage));
    zapGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    zapGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    zapGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  }
  const zapMat = new THREE.MeshBasicMaterial({
    map: BOLT, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const zapMesh = new THREE.Mesh(zapGeo, zapMat);
  zapMesh.frustumCulled = false;
  zapMesh.renderOrder = 15;
  zapMesh.visible = false;
  scene.add(zapMesh);
  const zAge = new Float32Array(ZAPS), zLife = new Float32Array(ZAPS);
  const zR = new Float32Array(ZAPS), zG = new Float32Array(ZAPS), zB = new Float32Array(ZAPS);
  const zOn = new Uint8Array(ZAPS);
  let zapCursor = 0, zapLive = 0, zapDirty = false;

  // ---- labels ---------------------------------------------------
  // Pooled sprites, and the one place in the module that is NOT
  // additive: a label has to stay readable over a bright floor and a
  // pile of effects, and additive would eat the dark outline that is
  // doing the work. The texture is cached on string+colour, so a fight
  // that shouts "CHAIN x3" forty times bakes one canvas.
  const LABELS = 14, LABEL_CACHE_MAX = 48;
  const labelCache = new Map();
  const measure = surface(8, 8);
  const labels = [];
  for (let i = 0; i < LABELS; i++) {
    const m = new THREE.SpriteMaterial({
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0,
    });
    const sp = new THREE.Sprite(m);
    sp.renderOrder = 30;
    sp.visible = false;
    scene.add(sp);
    labels.push({ sp, m, age: 0, life: 0, x: 0, y0: 0, z: 0, rise: 1, size: .4, aspect: 1, on: false });
  }
  let labelLive = 0;

  function labelTexture(str, css) {
    const key = str + '|' + css;
    const hit = labelCache.get(key);
    if (hit) return hit;
    const px = 64;
    const font = `700 ${px}px ui-monospace, "SF Mono", Menlo, monospace`;
    measure.font = font;
    // wide tracking is the project's UI voice; it also stops a short
    // shout reading as one blob at arena distance
    try { measure.letterSpacing = '4px'; } catch { /* older canvas: no tracking */ }
    const w = Math.ceil(measure.measureText(str).width);
    const pad = Math.round(px * .38);
    const g = surface(w + pad * 2, Math.round(px * 1.7));
    g.font = font;
    try { g.letterSpacing = '4px'; } catch { /* as above */ }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const cx = g.canvas.width / 2, cy = g.canvas.height / 2;
    g.shadowColor = 'rgba(24,17,12,.55)';
    g.shadowBlur = px * .18;
    g.shadowOffsetY = px * .05;
    g.lineJoin = 'round';
    g.lineWidth = px * .24;
    g.strokeStyle = '#241c15';
    g.strokeText(str, cx, cy);
    g.shadowColor = 'transparent';
    g.fillStyle = css;
    g.fillText(str, cx, cy);
    const t = new THREE.CanvasTexture(g.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    const entry = { t, aspect: g.canvas.width / g.canvas.height };
    // A game can shout an unbounded number of distinct strings
    // ("CHAIN x37"), so the cache is a queue, not a heap.
    if (labelCache.size >= LABEL_CACHE_MAX) {
      const oldest = labelCache.keys().next().value;
      labelCache.get(oldest).t.dispose();
      labelCache.delete(oldest);
    }
    labelCache.set(key, entry);
    return entry;
  }

  // ---- the two lights -------------------------------------------
  // Two, forever. They are the only dynamic lights the arena can pay
  // for: every one of them is evaluated by every material in the scene
  // on every fragment, whether it is pulsing or sitting at zero.
  const lights = [];
  for (let i = 0; i < 2; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 6, 2);
    l.castShadow = false;
    scene.add(l);
    lights.push({ l, age: 0, life: 0, peak: 0 });
  }
  let lightLive = 0;

  function pulse(x, y, z, r, g, b, peak, dist, life) {
    let slot = -1, worst = 1e9;
    for (let i = 0; i < lights.length; i++) {
      const L = lights[i];
      if (L.life <= 0) { slot = i; break; }
      const left = L.life - L.age;
      if (left < worst) { worst = left; slot = i; }
    }
    const L = lights[slot];
    L.l.position.set(x, y, z);
    L.l.color.setRGB(r, g, b);
    L.l.distance = dist;
    L.peak = peak; L.age = 0; L.life = life;
  }

  // ---- camera shake ---------------------------------------------
  // Trauma decays, and the offset is trauma SQUARED — that is what makes
  // it read as a knock: almost all the amplitude is spent in the first
  // sixth of a second and the tail is gone before you can call it a
  // wobble. The signal is LINEARLY interpolated value noise, not a sine:
  // a sine is a pendulum, and a pendulum is a camera on a spring rather
  // than a table taking a hit.
  const NOISE = new Float32Array(96);
  for (let i = 0; i < 96; i++) NOISE[i] = rnd() * 2 - 1;
  const noise = (x, o) => {
    const i = Math.floor(x), f = x - i;
    const a = NOISE[(((i + o) % 96) + 96) % 96], b = NOISE[(((i + o + 1) % 96) + 96) % 96];
    return a + (b - a) * f;
  };
  let trauma = 0, traumaDecay = 2.4, shakeFreq = 26;
  let punchX = 0, punchZ = 0, punchT = 0, punchLife = .16;
  let offX = 0, offY = 0, offZ = 0, rotX = 0, rotY = 0, rotZ = 0;
  let shakeOn = false;
  const lastCam = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 };

  // ---- trail throttling -----------------------------------------
  // `trailPoint` is told a position and nothing else — no marble id — so
  // "have I already laid a ghost for THIS marble" is answered by
  // proximity: the nearest recently-seen emitter within a marble's own
  // reach is assumed to be the same one. Two marbles crossing inside
  // that radius at speed can share a slot for a frame; the cost is one
  // missed ghost in a trail of a dozen, which is invisible, and the
  // alternative is an id parameter in the hottest call in the module.
  const TRAILS = 12, TRAIL_STEP = .17, TRAIL_CLAIM = 1.3, TRAIL_STALE = .25;
  const tX = new Float32Array(TRAILS), tZ = new Float32Array(TRAILS);
  const tSeen = new Float32Array(TRAILS).fill(-99);

  // ---- scratch --------------------------------------------------
  const _c = new THREE.Color();
  const R = new THREE.Vector3(), U = new THREE.Vector3(), F = new THREE.Vector3();
  let T = 0;

  /** CSS string or THREE.Color in, linear rgb out. The result is a
   *  shared scratch when a string arrives — read r/g/b immediately. */
  const toCol = c => (c && c.isColor) ? c : _c.set(c ?? '#ffffff');

  // a camera-facing speck
  const mote = (x, y, z, vx, vy, vz, grav, drag, s0, s1, r, g, b, life, prof) =>
    motes.add(MODE_FACE, x, y, z, vx, vy, vz, grav, drag, s0, s0, s1, s1, 1, 0, r, g, b, life, prof, EASE_OUT);

  // something lying on the floor. `yaw` is baked to cos/sin here so the
  // update loop never touches trigonometry.
  const decal = (pool, x, y, z, ax, ay, bx, by, yaw, r, g, b, life, prof, ease) =>
    pool.add(MODE_FLAT, x, y, z, 0, 0, 0, 0, 0, ax, ay, bx, by,
      Math.cos(yaw), Math.sin(yaw), r, g, b, life, prof, ease);

  /** the internal ring, positional. The public `ring()` is the one that
   *  takes an options object, and it is not allowed anywhere near an
   *  emitter that fires per enemy. */
  function pushRing(x, z, radius, r, g, b, life, fat, rise, squash) {
    const pool = fat ? ringsFat : ringsThin;
    const r0 = radius * .18, r1 = radius;
    return pool.add(MODE_FLAT, x, Y_RING + rise, z, 0, 0, 0, 0, 0,
      r0 * 2, r0 * 2 * squash, r1 * 2, r1 * 2, 1, 0, r, g, b, life, P_TAIL, EASE_OUT);
  }

  const clampN = (n, hi) => Math.max(0, Math.min(hi, n | 0));

  // ---------------------------------------------------------------
  // THE EFFECTS
  // ---------------------------------------------------------------
  const fx = {

    /** one small enemy dies. Debris that arcs and lands, plus a ground
     *  ring that starts squashed and relaxes as it spreads — a shock
     *  leaving the floor, not a circle drawn on it. */
    pop(x, z, color, n = 8) {
      const c = toCol(color), r = c.r, g = c.g, b = c.b;
      n = clampN(n, 24);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, sp = 1.1 + rnd() * 2.3, s = .05 + rnd() * .06;
        mote(x, .1 + rnd() * .12, z,
          Math.cos(a) * sp, 2 + rnd() * 2.2, Math.sin(a) * sp,
          -11, 1.1, s, s * .45,
          r * 1.35, g * 1.35, b * 1.35, .3 + rnd() * .16, P_TAIL);
      }
      // two white chips, over-driven: the burst needs something that is
      // brighter than the floor rather than merely lighter than it
      for (let i = 0; i < 2; i++) {
        const a = rnd() * TAU, sp = 2.2 + rnd() * 1.8;
        mote(x, .14, z, Math.cos(a) * sp, 2.8 + rnd() * 1.6, Math.sin(a) * sp,
          -12, 1.4, .05, .012, 2.2, 2.05, 1.9, .13 + rnd() * .06, P_TAIL);
      }
      pushRing(x, z, .62, r * 1.5, g * 1.5, b * 1.5, .2, false, 0, .5);
    },

    /** a hit that did not kill. The cheapest thing in the file, because
     *  it is the one that runs constantly: no ring, no flash, four
     *  specks with a short life. */
    spark(x, z, color, n = 4) {
      const c = toCol(color), r = c.r * 1.7, g = c.g * 1.7, b = c.b * 1.7;
      n = clampN(n, 16);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, sp = 2.4 + rnd() * 2.8;
        mote(x, .12 + rnd() * .1, z, Math.cos(a) * sp, 1.2 + rnd() * 1.9, Math.sin(a) * sp,
          -14, 1.6, .04 + rnd() * .025, .012, r, g, b, .1 + rnd() * .08, P_TAIL);
      }
    },

    /** a marble ploughing the swarm. The dust is the FLOOR's colour, not
     *  the marble's — kicked plastic dust that came out tinted read as a
     *  coloured exhaust plume, which is a spaceship, not a marble. */
    plow(x, z, dirX, dirZ, power) {
      const len = Math.hypot(dirX, dirZ) || 1;
      const ux = dirX / len, uz = dirZ / len;
      const p = Math.max(0, Math.min(1, power));
      const n = clampN(2 + p * 5, 8);
      for (let i = 0; i < n; i++) {
        const spread = (rnd() - .5) * 1.1;
        const bx = -ux * Math.cos(spread) + uz * Math.sin(spread);
        const bz = -uz * Math.cos(spread) - ux * Math.sin(spread);
        const sp = (.8 + 2.2 * p) * (.6 + rnd() * .8);
        mote(x - ux * .2, .07 + rnd() * .12, z - uz * .2,
          bx * sp, .5 + rnd() * 1.1, bz * sp,
          -2.2, 2.3, .16 + rnd() * .1, .42 + rnd() * .2,
          .40, .37, .32, .3 + rnd() * .22, P_DUST);
      }
      // and the smear it leaves behind, laid along the travel
      const yaw = Math.atan2(uz, ux);
      decal(motes, x - ux * .45, Y_SMEAR, z - uz * .45,
        .5 + 1.5 * p, .30, 1.1 + 2 * p, .5, yaw,
        .30, .27, .23, .26, P_TAIL, EASE_OUT);
    },

    ring(x, z, radius, color, opts = {}) {
      const c = toCol(color);
      const life = opts.life ?? .45;
      const rise = opts.rise ?? 0;
      // `width` is a HINT: it picks one of two baked bands. A real
      // per-instance band width needs a shader, and the only difference
      // the eye actually catches at this distance is thin versus fat.
      const fat = (opts.width ?? .12) > .18;
      pushRing(x, z, radius, c.r, c.g, c.b, life, fat, rise, opts.squash ?? 1);
    },

    /** the full explosion: a small over-driven core, a fat ring, a
     *  faster thin one chasing it, debris, and one of the two lights. */
    blast(x, z, radius, color) {
      const c = toCol(color), r = c.r, g = c.g, b = c.b;
      // THE CORE IS SMALL AND IT IS TINTED. Two passes are recorded
      // here. It was first sized to the blast radius and over-driven
      // well past 1 on every channel — on a pale ice floor under ACES
      // that is not a detonation, it is a white hole the size of a
      // third of the sheet with the game underneath it. What actually
      // reads as heat is a core well INSIDE the ring it belongs to,
      // driven just past 1 and carrying the explosion's own COLOUR, so
      // the frame goes orange or blue rather than blank.
      mote(x, .22, z, 0, 0, 0, 0, 0, radius * .16, radius * .5,
        .38 + r * .55, .34 + g * .55, .3 + b * .55, .13, P_FLASH);
      // A THIN, DIM, SHORT RING. Everything about this line is a
      // correction. Additive light over PALE ICE cannot make a
      // saturated colour — orange plus near-white is white — so an
      // over-driven fat band did not read as an explosion, it read as
      // the game being replaced by a hole. What survives the floor is
      // a narrow band at about half value, gone in a third of a
      // second: bright enough to be light, dim enough to still be
      // orange, and brief enough that the swarm underneath is never
      // hidden at the moment you are trying to read it.
      pushRing(x, z, radius, r * .5, g * .5, b * .54, .28, false, .02, .8);
      pushRing(x, z, radius * 1.16, r * .26, g * .26, b * .3, .44, false, .04, .9);
      const n = clampN(10 + radius * 7, 26);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, sp = (1.6 + rnd() * 3.4) * (.6 + radius * .4);
        mote(x, .12 + rnd() * .18, z, Math.cos(a) * sp, 2.4 + rnd() * 3.4, Math.sin(a) * sp,
          -12, 1.2, .05 + rnd() * .07, .02,
          r * 1.5, g * 1.5, b * 1.5, .24 + rnd() * .24, P_TAIL);
      }
      // dust that survives the flash, so the hole in the swarm still
      // looks disturbed once the bright part has gone
      for (let i = 0; i < 6; i++) {
        const a = rnd() * TAU, sp = radius * (.5 + rnd() * .7);
        mote(x, .1 + rnd() * .1, z, Math.cos(a) * sp, .4 + rnd() * .7, Math.sin(a) * sp,
          -1.4, 2.4, .2, .55 + rnd() * .3, .42, .38, .33, .42 + rnd() * .2, P_DUST);
      }
      pulse(x, radius * .5, z, r, g, b, 14 + radius * 16, radius * 4.5, .17);
      // A multiply-blended SCORCH was built for this and cut: with the
      // fade carried by `instanceColor`, and instance colour able only
      // to darken a multiply decal, a scorch can be laid down but never
      // taken away. A mark that snaps off is worse than no mark.
    },

    /** the cold version. Same shock, slower and crisper, plus the dome —
     *  the one effect in the module with volume, and the reason a frost
     *  nova reads as a field rather than a bigger explosion. */
    nova(x, z, radius, color) {
      const c = toCol(color), r = c.r, g = c.g, b = c.b;
      pushRing(x, z, radius, r * .7, g * .7, b * .78, .5, false, .01, .95);
      // MIND THE UNIT: the quads are a 1×1 plane, so their scale is a
      // DIAMETER, but the dome is a unit hemisphere and its scale is a
      // RADIUS. The first pass read as a nova twice the size of its own
      // shockwave, which looks like a bug in the game rather than in the
      // effect. `ax/bx` are the ground radius, `ay/by` the height.
      domes.add(MODE_UP, x, Y_DOME, z, 0, 0, 0, 0, 0,
        radius * .28, radius * .12, radius, radius * .34, 1, 0,
        r * .34, g * .36, b * .4, .5, P_FLASH, EASE_QUINT);
      for (let i = 0; i < 9; i++) {
        const a = rnd() * TAU, rr = radius * (.3 + rnd() * .7);
        mote(x + Math.cos(a) * rr, .06 + rnd() * .1, z + Math.sin(a) * rr,
          Math.cos(a) * .3, .35 + rnd() * .6, Math.sin(a) * .3,
          -.4, 1.1, .07, .22 + rnd() * .12,
          r * 1.3, g * 1.35, b * 1.45, .45 + rnd() * .35, P_DUST);
      }
    },

    /** lightning between two floor points. */
    zap(x1, z1, x2, z2, color) {
      const c = toCol(color);
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 1e-4) return;
      const ux = dx / len, uz = dz / len;
      const px = -uz, pz = ux;              // one perpendicular for the whole
      const amp = Math.min(.42, len * .13); // bolt: the jitter is small enough
      const hw = .06;                       // that a per-segment frame is noise
      let k = -1;
      for (let i = 0; i < ZAPS; i++) {
        const s = (zapCursor + i) % ZAPS;
        if (!zOn[s]) { k = s; break; }
      }
      if (k < 0) { k = zapCursor % ZAPS; zapLive--; }   // steal the oldest
      zapCursor = (k + 1) % ZAPS;
      zOn[k] = 1; zapLive++;
      zAge[k] = 0; zLife[k] = .12;
      zR[k] = c.r * 2.1; zG[k] = c.g * 2.1; zB[k] = c.b * 2.1;
      let o = k * ZVERT * 3;
      for (let j = 0; j < ZPTS; j++) {
        const f = j / ZSEG;
        const taper = Math.sin(Math.PI * f) ** .6;
        const off = (rnd() * 2 - 1) * amp * taper;
        const cx = x1 + dx * f + px * off, cz = z1 + dz * f + pz * off;
        const w = hw * (.2 + .8 * taper);
        zPos[o] = cx + px * w; zPos[o + 1] = Y_BOLT; zPos[o + 2] = cz + pz * w;
        zPos[o + 3] = cx - px * w; zPos[o + 4] = Y_BOLT; zPos[o + 5] = cz - pz * w;
        o += 6;
      }
      zapDirty = true;
      // the contacts. A bolt with nothing happening at its ends reads as
      // a decal; two specks at the terminals read as a discharge.
      mote(x1, Y_BOLT + .06, z1, 0, 0, 0, 0, 0, .16, .04, c.r * 2, c.g * 2, c.b * 2, .11, P_TAIL);
      mote(x2, Y_BOLT + .06, z2, 0, 0, 0, 0, 0, .22, .05, c.r * 2, c.g * 2, c.b * 2, .13, P_TAIL);
    },

    tracer(x1, z1, x2, z2, color) {
      const c = toCol(color);
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 1e-4) return;
      decal(bolts, (x1 + x2) / 2, Y_BOLT, (z1 + z2) / 2,
        len, .055, len, .055, Math.atan2(dz, dx),
        c.r * 1.9, c.g * 1.9, c.b * 1.9, .08, P_HOLD, EASE_LIN);
    },

    beam(x1, z1, x2, z2, color, life = .25) {
      const c = toCol(color);
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 1e-4) return;
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, yaw = Math.atan2(dz, dx);
      // two quads: a coloured body and a white core inside it. One quad
      // at full brightness just goes white and loses the hue; the pair
      // gives the beam an edge that is the colour and a centre that is
      // hotter than the floor can absorb.
      decal(bolts, mx, Y_BOLT, mz, len, .17, len, .21, yaw,
        c.r * 1.5, c.g * 1.5, c.b * 1.5, life, P_HOLD, EASE_LIN);
      decal(bolts, mx, Y_BOLT + .004, mz, len, .06, len, .07, yaw,
        1.3 + c.r * .6, 1.28 + c.g * .6, 1.25 + c.b * .6, life * .85, P_HOLD, EASE_LIN);
    },

    /** soft dust, no gravity — a marble settling. */
    puff(x, z, color, n = 6) {
      const c = toCol(color);
      n = clampN(n, 16);
      // the marble's colour, but mostly floor: dust that is the object's
      // own hue reads as the object smoking
      const r = .34 + c.r * .18, g = .31 + c.g * .18, b = .27 + c.b * .18;
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, sp = .25 + rnd() * .6;
        mote(x, .06 + rnd() * .1, z, Math.cos(a) * sp, .2 + rnd() * .35, Math.sin(a) * sp,
          0, 1.5, .14 + rnd() * .08, .38 + rnd() * .2, r, g, b, .5 + rnd() * .35, P_DUST);
      }
    },

    /** the marble impact. Sparks up the normal, and a flash laid ACROSS
     *  it in the floor plane — the contact spreads sideways, so a round
     *  flash reads as a light switching on and an elongated one reads as
     *  two things hitting. This does NOT shake the camera: the game
     *  decides what is worth a knock, or every enemy in the swarm gets
     *  a vote. */
    hit(x, z, nx, nz, power, color) {
      const len = Math.hypot(nx, nz) || 1;
      const ux = nx / len, uz = nz / len;
      const p = Math.max(0, Math.min(1, power));
      const c = toCol(color), r = c.r, g = c.g, b = c.b;
      const n = clampN(3 + p * 8, 14);
      for (let i = 0; i < n; i++) {
        const spread = (rnd() - .5) * 1.4;
        const bx = ux * Math.cos(spread) - uz * Math.sin(spread);
        const bz = uz * Math.cos(spread) + ux * Math.sin(spread);
        const sp = (1.6 + 4.4 * p) * (.5 + rnd() * .9);
        mote(x, .12 + rnd() * .14, z, bx * sp, .7 + rnd() * 1.8, bz * sp,
          -13, 1.3, .04 + rnd() * .045, .014,
          r * 1.6 + .3, g * 1.6 + .3, b * 1.6 + .3, .11 + rnd() * .13, P_TAIL);
      }
      const tangent = Math.atan2(uz, ux) + Math.PI / 2;
      decal(motes, x, Y_FLASH, z,
        .18 + .34 * p, .1 + .16 * p, .5 + .9 * p, .16 + .3 * p, tangent,
        1.5 + r * .5, 1.45 + g * .5, 1.4 + b * .5, .13 + .06 * p, P_FLASH, EASE_OUT);
    },

    /** a shout in world space. */
    text(x, z, str, color, opts = {}) {
      const css = typeof color === 'string' ? color
        : '#' + (color && color.isColor ? color : _c.set(color ?? '#ffffff')).getHexString();
      const e = labelTexture(String(str), css);
      let slot = null, worst = -1;
      for (const L of labels) {
        if (!L.on) { slot = L; break; }
        const used = L.age / L.life;
        if (used > worst) { worst = used; slot = L; }   // steal the most spent
      }
      if (!slot) return;
      if (!slot.on) labelLive++;
      slot.on = true;
      slot.age = 0;
      slot.life = opts.life ?? 1;
      slot.x = x; slot.z = z;
      slot.y0 = opts.y ?? .9;
      slot.rise = opts.rise ?? 1.1;
      // `small` is the damage-number size. A shout and a tick of damage
      // are the same object with the same curves, and the only thing
      // that should separate them is how loud they are — a second label
      // system for numbers would drift from this one within a week.
      slot.size = opts.size ?? (opts.small ? .27 : .42);
      slot.aspect = e.aspect;
      if (slot.m.map !== e.t) { slot.m.map = e.t; slot.m.needsUpdate = true; }
      // placed and blanked HERE rather than left to the next `update`:
      // a game that shouts after it has updated the FX would otherwise
      // show one frame of the previous label's position and opacity.
      slot.sp.position.set(x, slot.y0, z);
      slot.sp.scale.set(slot.size * .55 * e.aspect, slot.size * .55, 1);
      slot.m.opacity = 0;
      slot.sp.visible = true;
    },

    /** a fading ghost under a fast marble. Self-throttled by distance —
     *  see the note on the trail slots above. */
    trailPoint(x, z, radius, color) {
      let best = -1, bestD = TRAIL_CLAIM * TRAIL_CLAIM, oldest = 0;
      for (let i = 0; i < TRAILS; i++) {
        if (tSeen[i] < tSeen[oldest]) oldest = i;
        if (T - tSeen[i] > TRAIL_STALE) continue;
        const dx = x - tX[i], dz = z - tZ[i], d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) {
        tSeen[best] = T;
        const dx = x - tX[best], dz = z - tZ[best];
        if (dx * dx + dz * dz < TRAIL_STEP * TRAIL_STEP) return;
        tX[best] = x; tZ[best] = z;
      } else {
        tX[oldest] = x; tZ[oldest] = z; tSeen[oldest] = T;
      }
      // DIM, and dimmer than it looks like it should be. These land on
      // pale ice, and an additive ghost at half value over a bright
      // floor is white — a marble crossing the sheet was leaving a
      // comet tail rather than a scuff. At a quarter it keeps its
      // colour, which is the only thing it is for.
      const c = toCol(color);
      const s = radius * 2.1;
      decal(motes, x, Y_GHOST, z, s, s, s * .7, s * .7, 0,
        c.r * .26, c.g * .26, c.b * .26, .26, P_TAIL, EASE_OUT);
    },

    /** a knock. `amount` is 0..1 and ADDS to whatever is still ringing,
     *  so a chain of hits builds. `opts.dirX/dirZ` shove the camera the
     *  way the impact went — the punch is what separates "something hit
     *  something" from "the camera is vibrating". */
    shake(amount, opts = {}) {
      const a = Math.max(0, Math.min(1, amount));
      trauma = Math.min(1, trauma + a);
      traumaDecay = opts.decay ?? 2.4;
      shakeFreq = opts.freq ?? 26;
      const dx = opts.dirX ?? 0, dz = opts.dirZ ?? 0;
      const len = Math.hypot(dx, dz);
      if (len > 1e-5) {
        punchX = (dx / len) * a * .09;
        punchZ = (dz / len) * a * .09;
        punchT = 0;
        punchLife = opts.punch ?? .16;
      }
    },

    update(dt, now) {
      // `now` is taken for symmetry with the scene's other update
      // signatures and deliberately not trusted — a caller handing over
      // milliseconds would put every curve in the module out by a
      // thousand. The clock here is the module's own.
      dt = (typeof dt === 'number' && dt > 0) ? Math.min(dt, .05) : 0;
      T += dt;

      // ---- camera: take back last frame's shake, then re-apply -----
      // The game places the camera before this runs, so the transform on
      // arrival is normally clean. Normally. If the game DIDN'T move it
      // this frame the value sitting there is the one we shook, and
      // reading it as the base is how a shake walks the camera off the
      // table over a few seconds. So: if the transform is bit-for-bit
      // what we left, we put it back ourselves; otherwise the game has
      // spoken and its placement is the base.
      if (shakeOn) {
        const p = camera.position, r = camera.rotation;
        if (Math.abs(p.x - lastCam.px) < 1e-7 && Math.abs(p.y - lastCam.py) < 1e-7 &&
            Math.abs(p.z - lastCam.pz) < 1e-7 && Math.abs(r.x - lastCam.rx) < 1e-7 &&
            Math.abs(r.y - lastCam.ry) < 1e-7 && Math.abs(r.z - lastCam.rz) < 1e-7) {
          p.set(p.x - offX, p.y - offY, p.z - offZ);
          r.set(r.x - rotX, r.y - rotY, r.z - rotZ);
        }
        shakeOn = false;
      }
      offX = offY = offZ = rotX = rotY = rotZ = 0;

      if (trauma > 0) {
        trauma = Math.max(0, trauma - traumaDecay * dt);
        const k = trauma * trauma;
        const ph = T * shakeFreq;
        // the jitter is in the camera's OWN plane, so it is shake on the
        // screen rather than shake in the world — a world-space jitter
        // at this camera angle mostly slides the table sideways
        camera.updateMatrixWorld();
        const e = camera.matrixWorld.elements;
        const jx = noise(ph, 0) * SHAKE_POS * k;
        const jy = noise(ph, 31) * SHAKE_POS * k * .8;
        offX = e[0] * jx + e[4] * jy;
        offY = e[1] * jx + e[5] * jy;
        offZ = e[2] * jx + e[6] * jy;
        rotZ = noise(ph, 57) * SHAKE_ROT * k;
        rotX = noise(ph, 11) * SHAKE_ROT * k * .45;
        rotY = noise(ph, 73) * SHAKE_ROT * k * .45;
      }
      if (punchT < punchLife) {
        punchT += dt;
        const u = Math.min(1, punchT / punchLife);
        // out and back: the camera is shoved, then returns. A shove that
        // decays to zero without coming back is a camera that has moved.
        const s = Math.sin(Math.PI * u) * (1 - u);
        offX += punchX * s;
        offZ += punchZ * s;
      }
      if (offX || offY || offZ || rotX || rotY || rotZ) {
        const p = camera.position, r = camera.rotation;
        p.set(p.x + offX, p.y + offY, p.z + offZ);
        r.set(r.x + rotX, r.y + rotY, r.z + rotZ);
        lastCam.px = p.x; lastCam.py = p.y; lastCam.pz = p.z;
        lastCam.rx = r.x; lastCam.ry = r.y; lastCam.rz = r.z;
        shakeOn = true;
      }

      // billboards must use the SHAKEN camera, or every speck slides
      // against the arena for as long as the knock lasts
      camera.updateMatrixWorld();
      const e = camera.matrixWorld.elements;
      R.set(e[0], e[1], e[2]);
      U.set(e[4], e[5], e[6]);
      F.set(e[8], e[9], e[10]);

      for (const p of pools) p.step(dt, R, U, F);

      // ---- lightning ---------------------------------------------
      if (zapLive > 0) {
        for (let k = 0; k < ZAPS; k++) {
          if (!zOn[k]) continue;
          const t = (zAge[k] += dt) / zLife[k];
          const base = k * ZVERT * 3;
          if (t >= 1) {
            zOn[k] = 0; zapLive--;
            // collapse the dead ribbon rather than leave it black: a
            // zero-area triangle costs no fill, a black one costs all of it
            const x = zPos[base], y = zPos[base + 1], z = zPos[base + 2];
            for (let v = 0; v < ZVERT; v++) {
              const o = base + v * 3;
              zPos[o] = x; zPos[o + 1] = y; zPos[o + 2] = z;
              zCol[o] = zCol[o + 1] = zCol[o + 2] = 0;
            }
            zapDirty = true;
            continue;
          }
          const a = fadeOf(P_HOLD, t);
          const r = zR[k] * a, g = zG[k] * a, b = zB[k] * a;
          for (let v = 0; v < ZVERT; v++) {
            const o = base + v * 3;
            zCol[o] = r; zCol[o + 1] = g; zCol[o + 2] = b;
          }
        }
        zapGeo.attributes.color.needsUpdate = true;
      }
      if (zapDirty) { zapGeo.attributes.position.needsUpdate = true; zapDirty = false; }
      zapMesh.visible = zapLive > 0;

      // ---- labels -------------------------------------------------
      if (labelLive > 0) {
        for (const L of labels) {
          if (!L.on) continue;
          const t = (L.age += dt) / L.life;
          if (t >= 1) { L.on = false; L.sp.visible = false; L.m.opacity = 0; labelLive--; continue; }
          // a fast pop to full size, then the drift: a label that grows
          // over its whole life reads as a zoom, not a shout
          const grow = .55 + .45 * easeOf(EASE_OUT, Math.min(1, t / .14));
          const h = L.size * grow;
          L.sp.scale.set(h * L.aspect, h, 1);
          L.sp.position.set(L.x, L.y0 + L.rise * easeOf(EASE_OUT, t), L.z);
          L.m.opacity = t < .1 ? t / .1 : (1 - (t - .1) / .9) ** 1.6;
        }
      }

      // ---- lights -------------------------------------------------
      lightLive = 0;
      for (const L of lights) {
        if (L.life <= 0) { L.l.intensity = 0; continue; }
        const t = (L.age += dt) / L.life;
        if (t >= 1) { L.life = 0; L.l.intensity = 0; continue; }
        L.l.intensity = L.peak * fadeOf(P_FLASH, t);
        lightLive++;
      }
    },

    /** for the game's debug object to assert on. Allocates, and is meant
     *  to: it is called from a console, never from a frame. */
    stats() {
      let draws = 0;
      for (const p of pools) if (p.n > 0) draws++;
      if (zapLive > 0) draws++;
      draws += labelLive;
      return {
        live: {
          motes: motes.n,
          rings: ringsThin.n + ringsFat.n,
          bolts: bolts.n,
          domes: domes.n,
          zaps: zapLive,
          labels: labelLive,
          lights: lightLive,
        },
        draws,
      };
    },

    dispose() {
      for (const p of pools) p.dispose(scene);
      scene.remove(zapMesh);
      zapGeo.dispose();
      zapMat.dispose();
      for (const L of labels) { scene.remove(L.sp); L.m.dispose(); }
      for (const e of labelCache.values()) e.t.dispose();
      labelCache.clear();
      for (const L of lights) scene.remove(L.l);
      // BOLT is shared between the `bolts` pool and the zap ribbon, and
      // the pool disposed it already; DOT and the two rings belong to
      // one pool each and went with them.
    },
  };

  return fx;
}
