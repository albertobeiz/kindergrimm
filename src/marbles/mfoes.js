// ---------------------------------------------------------------
// THE TIDE — the hundreds.
//
// THE ONE IDEA THAT MAKES THE GAME POSSIBLE: a small enemy is not a
// physics body. It is a position, a hit point count and a sprite. It
// never pushes anything, never resolves a contact and never asks the
// solver a question — a marble rolling over it simply kills it. Only
// the marbles are dynamic, and there are never more than a dozen of
// those, which is why five hundred enemies cost about as much as an
// idle contact sheet.
//
// THE BRUTE is the exception on purpose: it is the only enemy a marble
// bounces OFF, so it is the only one that changes a shot. Brutes are
// also the only enemies that are real molded characters — they are
// few, so they can afford to be — while the swarm is one instanced
// mesh per kind plus one instanced contact shadow.
//
// WHY THEY ARE SLOW. The sheet is thirty-six units of ice, and a
// walker crosses it in the better part of a minute. That is the whole
// density argument: at three spawns a second and a forty-second walk,
// a hundred and twenty of them are on the ice at any moment without
// anything ever arriving in a rush. Speed up the tide and you have to
// slow the spawns, and then the ice is empty and it is a different,
// worse game.
//
// EIGHT KINDS, AND EACH ONE ASKS A DIFFERENT QUESTION of the board:
//
//   mote      nothing — it is the material a lane is made of
//   walker    the baseline; everything else is measured against it
//   runner    it will reach the line first: deal with it or lose one
//   spitter   it SHOOTS your marbles from outside their range, so a
//             marble planted short of it is a marble being whittled
//   bomber    it walks INTO a marble and takes half its life with it
//   splitter  killing it makes three more problems, so where it dies
//             matters as much as that it does
//   carapace  a shell: a marble rolling over it barely scratches it,
//             and only an ABILITY gets through — the one enemy your
//             throw cannot answer
//   mender    it heals the ones around it, so a lane you were
//             out-damaging stops dying — kill it first
//
// The rule they were written against: every kind must be answerable by
// a DIFFERENT decision. Two enemies that both mean "throw harder" are
// one enemy with two models.
//
// DATA IS PARALLEL ARRAYS. Not because six hundred objects would be
// slow to allocate, but because they would be slow to KEEP: a swarm
// that churns thirty objects a second hands the collector a bill in
// the middle of a throw, which is exactly when a frame may not drop.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { FIELD } from './mtable.js';

export const MAX_FOES = 720;



// HIT POINTS ARE NOT UNIFORM ACROSS THE ROSTER AND MUST NOT BE.
// A mote is deliberately cheap — it is the material a lane is made of,
// and a throw that cannot mow one is a throw that does not feel like
// anything. The weight sits on the BIG ones instead: a carapace is
// twenty motes, a mender is fourteen, and those are the enemies an
// ABILITY has to chew through rather than a marble rolling past.
// Inflating everything evenly was measured and it killed the plough,
// which is the one thing the whole game is built around.
// THE COLOURS ARE LOUD ON PURPOSE. The first palette kept every kind
// within a step of charcoal — honest to the register, and at forty
// pixels the whole tide read as one species. The two kinds that ARE the
// mass (mote, walker) stay dark; everything with a behaviour worth
// telling apart wears a colour you can name from the hand: crimson
// runs, teal shoots, orange explodes, olive splits, green heals, ochre
// lays, red drums.
export const FOE_KINDS = {
  mote: {
    r: .22, hp: 11, speed: .58, dps: 2, bounty: 1, tall: .72,
    color: '#484254', eye: '#F3EDE0',
  },
  walker: {
    r: .31, hp: 55, speed: .42, dps: 4, bounty: 2, tall: .92,
    color: '#38333f', eye: '#F3EDE0',
  },
  runner: {
    r: .26, hp: 35, speed: .82, dps: 3, bounty: 2, tall: 1.42,
    color: '#8a3348', eye: '#FFD9C2', spike: .95, wide: .78,
  },
  spitter: {
    r: .30, hp: 90, speed: .30, dps: 0, bounty: 4, tall: 1.1,
    color: '#2e6b5e', eye: '#B6F0DC', snout: .8,
    // its bolt steals SECONDS off a marble's clock — time is the only
    // resource a marble has, so time is the only thing an enemy may
    // attack
    range: 5.2, shotCd: 2.1, shotDmg: 2,
  },
  bomber: {
    r: .34, hp: 60, speed: .62, dps: 0, bounty: 4, tall: .82,
    color: '#7a3020', eye: '#FFC9A0', core: '#FF6A2E', fuse: .75, wide: 1.08,
    blastR: 1.8, blastDmg: 5,          // SECONDS drained, not damage
  },
  splitter: {
    r: .40, hp: 130, speed: .34, dps: 5, bounty: 3, tall: .88,
    color: '#6b7034', eye: '#E4F0C0', bumps: 3, splits: 3,
  },
  carapace: {
    r: .40, hp: 220, speed: .27, dps: 6, bounty: 5, tall: .62,
    color: '#2f3742', eye: '#DCE8F0', shell: '#B4CBDC', wide: 1.3,
    // A SHELL DEFLECTS. It used to soak the crush instead — 78% off
    // anything the rolling did — and that was the wrong shape for it:
    // a marble ploughed straight over a carapace and the carapace
    // shrugged, which reads as the game ignoring the hit. Now the
    // marble SKIDS OFF it and pays for the line it lost, while the
    // shell takes the impact. It is still the enemy a throw cannot
    // simply answer; it just says so with the shot instead of with a
    // number.
    bounce: .55,
  },
  mender: {
    r: .30, hp: 150, speed: .36, dps: 1.5, bounty: 6, tall: 1.5,
    color: '#2f6b45', eye: '#CFF0D6', antenna: '#7FD9A0',
    healR: 3.6, healCd: 2.2, healFrac: .085,
  },
  brood: {
    // A CARRIER. It drops a mote every few seconds as it walks, so it
    // is answerable by exactly one decision: kill it EARLY, up the
    // sheet, or meet everything it laid on the way down. Killing it at
    // the line is killing one enemy; killing it at the top is killing
    // eight.
    r: .42, hp: 160, speed: .30, dps: 4, bounty: 6, tall: .95,
    color: '#7a5c2e', eye: '#F0D9B0', bumps: 5, wide: 1.18,
    broodCd: 3.2,
  },
  herald: {
    // THE DRUM. It makes everything around it walk half again as fast —
    // the inverse of the mender: one undoes your damage, the other
    // takes away your TIME. Same answer (kill it first), different
    // thing being stolen.
    r: .34, hp: 190, speed: .44, dps: 3, bounty: 7, tall: 1.5,
    color: '#7a2f2a', eye: '#FFD9C2', antenna: '#F2704A', spike: .34,
    hasteR: 3.4, haste: 1.4,
  },
  brute: {
    r: .95, hp: 750, speed: .21, dps: 17, bounty: 16, tall: 1,
    color: '#2b2833', eye: '#F3EDE0',
  },
  // THE BOSS. Same machinery as a brute — a wall with hit points that
  // wears a real molded character — only bigger, far tougher, and with
  // a movement pattern rolled fresh for each one (see `march`). It is
  // what closes a wave.
  boss: {
    // Measured: at 9000 and a .26 walk, the wave-one boss spawned at the
    // far rail and took a hundred seconds to die — most of it spent out
    // of everybody's range, walking. A boss should be a fight, not a
    // commute.
    // 3400 → 1600 → 800, cut twice on measurement: a plain three-
    // marble board plus rams took 59 seconds at 1600, and a boss that
    // outstays its own banner is a chore, not a climax. The wave
    // scaling still grows it — a late boss is a siege — but the FIRST
    // one dies in about half a minute to an ordinary board, faster to
    // a deliberate one: at 1040 (this × `pressure(1).hp`) it is FOUR
    // full-power rams from any kind the bag starts with. That is what
    // the ram constant in `mphys.js` is set from, so this number and
    // that one move together.
    r: 1.5, hp: 800, speed: .34, dps: 34, bounty: 90, tall: 1,
    // it hits back harder than a brute does when you bounce off it
    bounce: 1,
    color: '#221f2b', eye: '#FFD9C2',
  },
};
// THE BIGGEST ENEMY'S RADIUS, and every grid query has to leave at
// least this much slop. `each` filters on CENTRE distance, so a query
// of `r + .4` never even visits a brute whose centre is 0.9 away but
// whose body is well inside the blast — the effect looked like a
// shrunken hitbox on the one enemy the game asks you to aim at.
//
// IT IS DERIVED, NOT TYPED. It was hard-coded to .95 — the brute's
// radius — and then the boss arrived at 1.5, which is bigger than the
// slop meant to cover it: the sweep's query could not reach a boss
// until the marble was already most of the way inside it, so the
// rebound fired late or not at all and a marble sailed straight
// through the thing it was supposed to bounce off. A constant that
// means "the biggest one" must be computed from the table, or the next
// kind bigger than it silently breaks every query in the game.
export const MAX_FOE_R = Math.max(...Object.values(FOE_KINDS).map(k => k.r));

export const SWARM_KINDS = ['mote', 'walker', 'runner', 'spitter', 'bomber',
                            'splitter', 'carapace', 'mender', 'brood', 'herald'];
// the two that do NOT draw as instanced swarm blobs: they wear real
// molded characters, because there are never many of them and they are
// the things the player aims AT.
export const BIG_KINDS = ['brute', 'boss'];
const BRUTE_IX = SWARM_KINDS.length;

// how many of each may be DRAWN at once. A cap per kind rather than
// MAX_FOES eight times over: menders are rare and motes are the floor,
// and eight full-size instance buffers is a third of a megabyte of
// matrices that never get written.
const DRAW_CAP = { mote: 420, walker: 340, runner: 240, spitter: 110,
                   bomber: 110, splitter: 110, carapace: 140, mender: 50,
                   brood: 60, herald: 50 };

// ---------------------------------------------------------------
// One geometry per kind: a squashed blob with two eyes welded into it,
// its silhouette piece, and every colour baked as VERTEX COLOURS.
//
// The eyes are part of the body mesh, which is only legal because
// every enemy in this game walks the same way — down the sheet, toward
// the camera — so a face pointing along +z always points at the
// player. It buys a swarm with EYES for one draw call, and the eyes
// are most of why the tide reads as creatures rather than as debris.
//
// `instanceColor` then MULTIPLIES those vertex colours, so a hit flash
// tints the whole enemy, whites included. That is correct: a thing
// being hurt flashes, it does not selectively flash its body.
//
// THE SILHOUETTE IS THE READ, not the colour. At the far end of a
// sheet this long an enemy is eight pixels of dark grey whatever it
// is, so every kind differs in OUTLINE first: a spike, a snout, a fuse,
// three bumps, a flat shell, a tall antenna.
// ---------------------------------------------------------------
function blobGeometry(kind) {
  const K = FOE_KINDS[kind];
  const parts = [];
  const push = (geo, color, m) => {
    geo.applyMatrix4(m);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(geo);
  };
  const M = (sx, sy, sz, x, y, z, rx = 0) => {
    const m = new THREE.Matrix4().makeScale(sx, sy, sz);
    if (rx) m.premultiply(new THREE.Matrix4().makeRotationX(rx));
    return m.setPosition(x, y, z);
  };
  const h = K.tall;
  const topY = K.r * h * 1.56;
  // per-kind body WIDTH: a runner is a lean drop, a carapace a wide
  // dome, a bomber a fat keg — the proportion is readable three rows
  // further away than any colour is
  const wide = K.wide ?? 1;

  const body = new THREE.SphereGeometry(1, 12, 8);
  // flatten the base so it sits ON the ice rather than in it
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < -.25) p.setY(i, -.25 + (y + .25) * .42);
  }
  body.computeVertexNormals();
  push(body, K.color, M(K.r * wide, K.r * h, K.r, 0, K.r * h * .78, 0));

  // --- the silhouette piece ---
  if (K.spike)                                   // runner: a drawn-out point
    push(new THREE.ConeGeometry(1, 1, 7), K.color,
         M(K.r * .5, K.r * h * K.spike, K.r * .5, 0, topY * .92, 0));
  if (K.snout)                                   // spitter: a forward nozzle
    push(new THREE.ConeGeometry(1, 1, 7), K.color,
         M(K.r * .34, K.r * K.snout * 1.7, K.r * .34, 0, K.r * h * .95, K.r * .72, Math.PI / 2.1));
  if (K.fuse) {                                  // bomber: a lit core and a fuse
    push(new THREE.SphereGeometry(1, 9, 7), K.core,
         M(K.r * .46, K.r * .46, K.r * .46, 0, K.r * h * 1.0, K.r * .55));
    push(new THREE.ConeGeometry(1, 1, 5), '#F0C060',
         M(K.r * .13, K.r * K.fuse, K.r * .13, 0, topY * .96, 0));
  }
  if (K.bumps)                                   // splitter: the three to come
    for (let i = 0; i < K.bumps; i++) {
      const a = (i / K.bumps) * Math.PI * 2 + .5;
      push(new THREE.SphereGeometry(1, 8, 6), K.color,
           M(K.r * .44, K.r * .44, K.r * .44,
             Math.cos(a) * K.r * .52, topY * .78, Math.sin(a) * K.r * .52));
    }
  if (K.shell) {                                 // carapace: a lid, in a lighter vinyl
    const s = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI * .56);
    push(s, K.shell, M(K.r * 1.12, K.r * h * 1.15, K.r * 1.12, 0, K.r * h * .58, 0));
  }
  if (K.antenna) {                               // mender: the tall stalk
    push(new THREE.CylinderGeometry(1, 1, 1, 5), K.color,
         M(K.r * .085, K.r * h * .7, K.r * .085, 0, topY * .92, 0));
    push(new THREE.SphereGeometry(1, 9, 7), K.antenna,
         M(K.r * .32, K.r * .32, K.r * .32, 0, topY * 1.5, 0));
  }

  // --- the eyes: set wide and LOW, which is the whole cartoon-dark read
  const eyeR = K.r * (kind === 'mote' ? .30 : .25);
  const eyeY = K.r * h * (K.shell ? .78 : .92);
  for (const sx of [-1, 1]) {
    push(new THREE.SphereGeometry(1, 7, 5), K.eye,
         M(eyeR, eyeR * 1.1, eyeR * .8, sx * K.r * wide * .42, eyeY, K.r * .80));
    push(new THREE.SphereGeometry(1, 6, 4), '#171319',
         M(eyeR * .52, eyeR * .58, eyeR * .5, sx * K.r * wide * .44, eyeY - eyeR * .02, K.r * .93));
  }
  return mergeGeometries(parts);
}

/** the merge three's BufferGeometryUtils would do — vendored here
 *  rather than pulling the util in, because this is the only place in
 *  the project that needs it and it is fifteen lines. */
function mergeGeometries(geos) {
  let vTotal = 0, iTotal = 0;
  for (const g of geos) { vTotal += g.attributes.position.count; iTotal += g.index.count; }
  const pos = new Float32Array(vTotal * 3), nor = new Float32Array(vTotal * 3);
  const col = new Float32Array(vTotal * 3), idx = new Uint16Array(iTotal);
  let vo = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    col.set(g.attributes.color.array, vo * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count; io += gi.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/** the soft dark disc every enemy stands on. A swarm cannot afford
 *  real shadows — six hundred casters is six hundred shadow-map draws
 *  — and it does not need them: a blurred blob under a small round
 *  thing is indistinguishable from its shadow and costs one instanced
 *  quad. */
function contactTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(26,34,44,.5)');
  grad.addColorStop(.55, 'rgba(26,34,44,.24)');
  grad.addColorStop(1, 'rgba(26,34,44,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------
// THE GRID. One uniform hash over the sheet, rebuilt every frame.
// Rebuilt, not maintained: six hundred inserts into a flat Int32Array
// is about fifteen microseconds, and an incrementally-maintained grid
// costs a remove-and-reinsert per enemy per frame anyway — for the
// same work and a class of bugs where an enemy is in two cells at
// once. The only rule is that nothing may hold a bucket across a
// frame boundary.
// ---------------------------------------------------------------
const CELL = 1.4;

function makeGrid() {
  const cols = Math.ceil((FIELD.halfW * 2 + 4) / CELL);
  const rows = Math.ceil((FIELD.back - FIELD.far + 4) / CELL);
  const head = new Int32Array(cols * rows);
  const next = new Int32Array(MAX_FOES);
  const cellOf = (x, z) => {
    const cx = Math.min(cols - 1, Math.max(0, ((x + FIELD.halfW + 2) / CELL) | 0));
    const cz = Math.min(rows - 1, Math.max(0, ((z - FIELD.far + 2) / CELL) | 0));
    return cz * cols + cx;
  };
  return { cols, rows, head, next, cellOf };
}

// ---------------------------------------------------------------
export function createTide(scene, hooks = {}) {
  const { onLeak, onKill, onFoeShot, onFoeBlast, onHeal } = hooks;

  const x = new Float32Array(MAX_FOES), z = new Float32Array(MAX_FOES);
  const hp = new Float32Array(MAX_FOES), maxHp = new Float32Array(MAX_FOES);
  const kind = new Uint8Array(MAX_FOES);
  const alive = new Uint8Array(MAX_FOES);
  const phase = new Float32Array(MAX_FOES);
  const slowT = new Float32Array(MAX_FOES), slowK = new Float32Array(MAX_FOES);
  const stunT = new Float32Array(MAX_FOES);
  const burnT = new Float32Array(MAX_FOES), burnD = new Float32Array(MAX_FOES);
  const flash = new Float32Array(MAX_FOES);
  const heal = new Float32Array(MAX_FOES);        // healed-recently glow
  const drift = new Float32Array(MAX_FOES);       // per-enemy wander, tiny
  // FORMATION MOVEMENT. `mvx` is a constant sideways speed — zero for a
  // block, the same value for every member of a drifting one, and
  // proportional to the member's offset for one that opens out. A
  // zigzag instead reads `mphase`, and every member of a formation
  // carries the SAME phase, so they all turn at the same instant and
  // the shape stays rigid. Driving it off each enemy's own z would
  // shear a block into a wave.
  const march = new Uint8Array(MAX_FOES);         // 0 = mvx, 1 = zigzag
  // THE VARIANTS — the same kind, recast. 1 = SWIFT: half again the
  // speed, half the health, drawn small and pale. 2 = HEAVY: half the
  // speed, double-and-some the health, drawn big and dark. One byte
  // buys "fast but weak" and "slow but strong" for every kind in the
  // table at once, and the SIZE is what sells it — a heavy walker is
  // visibly a bigger animal, not a stat line.
  const variant = new Uint8Array(MAX_FOES);
  // WHERE THIS ENEMY BELONGS in its formation. The shape's offsets are
  // authored once at spawn, but a thirty-six-unit walk full of swerves,
  // wander and walk-arounds scattered every formation long before it
  // arrived — a wedge reached the midline as a loose crowd with
  // stragglers outside its own triangle. The march moves the ANCHOR;
  // the enemy springs back to its anchor after every disturbance, so a
  // formation breathes around obstacles and then re-forms.
  const homeX = new Float32Array(MAX_FOES);
  const spdK = new Float32Array(MAX_FOES);
  const sizeK = new Float32Array(MAX_FOES);
  const mvx = new Float32Array(MAX_FOES);
  const mphase = new Float32Array(MAX_FOES);
  // how far a zigzag swings, or how hard a `pulse` surges. Per enemy so
  // a boss can roll its own movement instead of picking from three.
  const mamp = new Float32Array(MAX_FOES);
  const chew = new Int16Array(MAX_FOES);
  const cd = new Float32Array(MAX_FOES);          // spitter / mender / brood clock
  const haste = new Float32Array(MAX_FOES);       // seconds of herald-speed left
  const scale = new Float32Array(MAX_FOES);
  // WHICH MARBLE HAS ALREADY ROLLED OVER THIS ONE. The crush used to
  // fire once per SUBSTEP for as long as an enemy stayed inside the
  // sweep, and the substep count is derived from the frame time — so a
  // 120Hz machine dealt about 1.6× the crush damage and 1.6× the
  // plough drag of a 60Hz one. The game's headline verb was different
  // on a phone. One mark per marble per enemy fixes both at once, and
  // it is also what "rolled over it" actually means.
  const mark = new Int32Array(MAX_FOES);
  // A SLOT IS REUSED ALMOST IMMEDIATELY — the free list is a stack and
  // the tide churns a dozen a second — so "is my target still alive?"
  // asked by index alone will happily say yes about a completely
  // different enemy that walked on thirty units up the sheet. Every
  // spawn bumps this, and a homing shot remembers the value it aimed at.
  const gen = new Uint16Array(MAX_FOES);

  let count = 0;
  const free = [];
  for (let i = MAX_FOES - 1; i >= 0; i--) free.push(i);
  const grid = makeGrid();
  const pendingSplit = [];

  const KIND_INDEX = Object.fromEntries(SWARM_KINDS.map((k, i) => [k, i]));
  BIG_KINDS.forEach((k, i) => { KIND_INDEX[k] = BRUTE_IX + i; });

  const swarmMesh = SWARM_KINDS.map(k => {
    const m = new THREE.InstancedMesh(
      blobGeometry(k),
      new THREE.MeshPhysicalMaterial({
        vertexColors: true, roughness: .36, metalness: 0,
        clearcoat: .8, clearcoatRoughness: .25, envMapIntensity: .8,
      }),
      DRAW_CAP[k]);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    scene.add(m);
    return m;
  });

  const contact = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: contactTexture(), transparent: true, depthWrite: false, toneMapped: false,
    }),
    MAX_FOES);
  contact.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = .008;
  contact.frustumCulled = false;
  contact.renderOrder = 2;
  contact.count = 0;
  scene.add(contact);

  const bruteRigs = [];
  const bruteOf = new Int16Array(MAX_FOES).fill(-1);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  const V = new THREE.Vector3(), S = new THREE.Vector3();
  const C = new THREE.Color();

  const kindName = i => SWARM_KINDS[kind[i]] ?? BIG_KINDS[kind[i] - BRUTE_IX];

  // --- spawning ---------------------------------------------------------
  const ZIG_W = 1.15;                             // zigzag rate, radians/s
  const ZIG_A = .95;                              // …and how far it swings
  let clock = 0;
  // EVERY WAVE WALKS A LITTLE FASTER. It is one multiplier rather than
  // a table of per-kind speeds, so the roster keeps its relative pace —
  // a runner is always about twice a walker, whatever wave it is.
  let pace = 1;
  // THE PARADE SPEED. Every small enemy in a wave walks at THIS speed,
  // whatever kind it is — the per-kind speeds made a mixed wave smear
  // into a crowd inside twenty seconds, because formations of
  // different kinds caught each other up and interleaved. One front
  // speed and the wave arrives as a parade: distinct blocks, held
  // gaps, readable from the first second. The big kinds (brute, boss)
  // are exempt — they lumber on their own clock, and they are not part
  // of any formation. Status effects still bend it: a slow, a stun and
  // the herald's haste all read AGAINST the parade, which makes each
  // of them more visible, not less.
  let parade = .42;

  function spawn(k, px, pz, hpScale = 1, m = null) {
    if (!free.length) return -1;
    const i = free.pop();
    const K = FOE_KINDS[k];
    alive[i] = 1; kind[i] = KIND_INDEX[k];
    x[i] = px; z[i] = pz;
    hp[i] = maxHp[i] = K.hp * hpScale;
    phase[i] = Math.random() * 6.283;
    slowT[i] = slowK[i] = stunT[i] = burnT[i] = burnD[i] = flash[i] = heal[i] = 0;
    haste[i] = 0;
    // the individual wander is now nearly nothing: it exists so a
    // formation does not look stamped out of metal, and anything bigger
    // dissolves the shape it is supposed to be decorating
    drift[i] = (Math.random() * 2 - 1) * .09;
    march[i] = m?.march ?? 0;
    mvx[i] = m?.vx ?? 0;
    mphase[i] = m?.phase ?? 0;
    mamp[i] = m?.amp ?? 1;
    variant[i] = m?.variant ?? 0;
    homeX[i] = px;
    // variants no longer touch SPEED — the parade rule outranks them.
    // Swift is small and weak, heavy is big and tough, and both keep
    // step with the ranks.
    spdK[i] = 1;
    sizeK[i] = variant[i] === 1 ? .78 : variant[i] === 2 ? 1.45 : 1;
    if (variant[i] === 1) { hp[i] *= .5; maxHp[i] *= .5; }
    if (variant[i] === 2) { hp[i] *= 2.4; maxHp[i] *= 2.4; }
    chew[i] = -1;
    cd[i] = Math.random() * (K.shotCd ?? K.healCd ?? 1);
    scale[i] = 0;
    mark[i] = 0;                                  // a recycled slot is a new enemy
    gen[i] = (gen[i] + 1) & 0xffff;
    count++;
    if (k === 'brute' || k === 'boss') {
      const want = k === 'boss';
      const rig = bruteRigs.find(r => !r.busy && !!r.boss === want);
      if (rig) { rig.busy = true; rig.group.visible = true; bruteOf[i] = bruteRigs.indexOf(rig); }
    }
    return i;
  }

  function kill(i, silent = false) {
    if (!alive[i]) return;
    const K = FOE_KINDS[kindName(i)];
    alive[i] = 0;
    count--;
    if (bruteOf[i] >= 0) {
      const rig = bruteRigs[bruteOf[i]];
      rig.busy = false; rig.group.visible = false;
      bruteOf[i] = -1;
    }
    if (!silent && onKill) onKill(x[i], z[i], kindName(i));
    // A SPLIT IS DEFERRED. Spawning inside a kill would hand the new
    // enemy the slot the dying one is still being read out of — the
    // free list is a stack, so it is the SAME index — and the caller
    // would find a live mote where it left a corpse.
    if (!silent && K.splits) pendingSplit.push(x[i], z[i], K.splits);
    free.push(i);
  }

  /** damage. `opts.phys` marks it as the rolling crush, which is the
   *  only thing a carapace's shell stops. Returns true if it killed. */
  function hurt(i, dmg, opts = {}) {
    if (!alive[i] || dmg <= 0) return false;
    const K = FOE_KINDS[kindName(i)];
    if (opts.phys && K.armor) dmg *= 1 - K.armor;
    hp[i] -= dmg;
    flash[i] = Math.max(flash[i], .1);
    if (opts.slow) {
      slowK[i] = Math.min(SLOW_CAP, Math.max(slowK[i], opts.slow));
      slowT[i] = Math.max(slowT[i], opts.slowFor ?? 1.4);
    }
    if (opts.stun) stunT[i] = Math.max(stunT[i], opts.stun);
    if (opts.burn) { burnD[i] = Math.max(burnD[i], opts.burn); burnT[i] = Math.max(burnT[i], opts.burnFor ?? 2.5); }
    if (hp[i] <= 0) { kill(i); return true; }
    return false;
  }

  // CLAMPED AT .85, and the clamp is load-bearing. `deep cold` scales
  // the slow by 1.35 and the aura re-applies every .3s, so two of that
  // card froze the tide solid inside the radius and THREE of them took
  // the factor past 1 — at which point `mul = 1 - slowK` went negative
  // and the enemies walked back up the sheet. A slow may never be a
  // stop, and it may certainly never be a reverse.
  const SLOW_CAP = .85;
  function chill(i, factor, secs) {
    if (!alive[i]) return;
    slowK[i] = Math.min(SLOW_CAP, Math.max(slowK[i], factor));
    slowT[i] = Math.max(slowT[i], secs);
  }

  // --- queries ----------------------------------------------------------
  function rebuildGrid() {
    grid.head.fill(-1);
    for (let i = 0; i < MAX_FOES; i++) {
      if (!alive[i]) continue;
      const c = grid.cellOf(x[i], z[i]);
      grid.next[i] = grid.head[c];
      grid.head[c] = i;
    }
  }

  function each(px, pz, r, fn) {
    const r2 = r * r;
    const span = Math.ceil(r / CELL);
    const cx = ((px + FIELD.halfW + 2) / CELL) | 0;
    const cz = ((pz - FIELD.far + 2) / CELL) | 0;
    for (let gz = cz - span; gz <= cz + span; gz++) {
      if (gz < 0 || gz >= grid.rows) continue;
      for (let gx = cx - span; gx <= cx + span; gx++) {
        if (gx < 0 || gx >= grid.cols) continue;
        for (let i = grid.head[gz * grid.cols + gx]; i !== -1; i = grid.next[i]) {
          // the grid is a frame-old snapshot and a sweep KILLS as it
          // walks it, so a dead index is normal, not a bug — skipping
          // it here is cheaper than repairing the buckets on every kill
          if (!alive[i]) continue;
          const dx = x[i] - px, dz = z[i] - pz;
          const d2 = dx * dx + dz * dz;
          if (d2 <= r2 && fn(i, d2)) return;
        }
      }
    }
  }

  function nearest(px, pz, r, filter) {
    let best = -1, bd = Infinity;
    each(px, pz, r, (i, d2) => {
      if (d2 < bd && (!filter || filter(i))) { bd = d2; best = i; }
      return false;
    });
    return best;
  }

  // --- the step ---------------------------------------------------------
  // ENEMIES CANNOT TOUCH A MARBLE. A marble has TIME on the ice and
  // nothing else — the tide walks AROUND them, full stop. The history
  // is worth one line each: stop-and-chew made marbles plugs; a chew
  // cap made queues; bite-in-passing made hit points matter again and
  // split the player's attention across two clocks. One resource, one
  // clock, and the only two enemies that interact with a marble at all
  // are the thieves: a spitter's bolt and a bomber's blast steal
  // SECONDS, which is the same currency the cards buy.
  function step(dt, marbles, hitMarble) {
    clock += dt;
    rebuildGrid();
    for (let i = 0; i < MAX_FOES; i++) {
      if (!alive[i]) continue;
      const name = kindName(i);
      const K = FOE_KINDS[name];

      if (flash[i] > 0) flash[i] -= dt;
      if (heal[i] > 0) heal[i] -= dt;
      if (scale[i] < 1) scale[i] = Math.min(1, scale[i] + dt * 5.5);
      if (burnT[i] > 0) {
        burnT[i] -= dt;
        if (hurt(i, burnD[i] * dt)) continue;
      }
      let mul = 1;
      if (slowT[i] > 0) { slowT[i] -= dt; mul *= Math.max(0, 1 - slowK[i]); }
      else slowK[i] = 0;
      if (stunT[i] > 0) { stunT[i] -= dt; mul = 0; }
      if (haste[i] > 0) { haste[i] -= dt; mul *= FOE_KINDS.herald.haste; }
      // WHICH MARBLE IS NEAREST. Everything below hangs off it: what to
      // eat, what to shoot, what to walk toward. It is an O(marbles)
      // loop per enemy and the marbles are a dozen at most — a spatial
      // structure for twelve objects is a structure that costs more to
      // maintain than to skip.
      let best = -1, bd = Infinity, contactAt = -1;
      for (let b = 0; b < marbles.length; b++) {
        const m = marbles[b];
        if (!m.alive || m.moving) continue;
        const dx = m.x - x[i], dz = m.z - z[i];
        const d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; best = b; }
        const rr = m.r + K.r * sizeK[i] + .06;
        if (d2 < rr * rr) contactAt = b;
      }
      const bdist = best >= 0 ? Math.sqrt(bd) : Infinity;

      chew[i] = contactAt;

      // --- the ones that fight from a distance
      if (K.range) {
        cd[i] -= dt * (mul > 0 ? 1 : .25);
        if (best >= 0 && bdist < K.range) {
          if (cd[i] <= 0) {
            cd[i] = K.shotCd;
            onFoeShot?.(x[i], z[i], marbles[best], K.shotDmg);
          }
          // it holds its ground at range instead of closing — which is
          // what makes it a different problem from a walker rather
          // than a walker that also shoots
          if (bdist > K.range * .62) { z[i] += parade * mul * dt * .35; }
          continue;
        }
      }

      // --- the ones that heal
      if (K.healR) {
        cd[i] -= dt;
        if (cd[i] <= 0) {
          cd[i] = K.healCd;
          let touched = 0;
          each(x[i], z[i], K.healR, (j) => {
            if (j === i || hp[j] >= maxHp[j]) return false;
            hp[j] = Math.min(maxHp[j], hp[j] + maxHp[j] * K.healFrac);
            heal[j] = .5;
            touched++;
            return false;
          });
          if (touched) onHeal?.(x[i], z[i], K.healR);
        }
      }

      // --- the one that lays more of them
      if (K.broodCd) {
        cd[i] -= dt;
        if (cd[i] <= 0 && free.length > 60) {
          cd[i] = K.broodCd;
          // the child inherits the parent's toughness scaling, so a
          // late-wave brood lays late-wave motes
          spawn('mote', x[i], z[i] - .5, maxHp[i] / K.hp);
          flash[i] = .08;
        }
      }

      // --- the drum: everything near it walks half again as fast
      if (K.hasteR) {
        each(x[i], z[i], K.hasteR, (j) => {
          if (j !== i && !FOE_KINDS[kindName(j)].hasteR) haste[j] = .5;
          return false;
        });
      }

      // only the bomber has any business touching a marble: it goes off
      // and steals time. Everyone else's contact is an accident the
      // avoidance below is already correcting.
      if (contactAt >= 0 && K.blastR) {
        onFoeBlast?.(x[i], z[i], K.blastR, K.blastDmg);
        kill(i, true);
        continue;
      }

      if (mul <= 0) continue;
      // march 2 is the CHARGE: it walks in surges rather than at a
      // steady pace, which is the one movement that makes a big slow
      // thing frightening instead of merely inevitable.
      const surge = march[i] === 2
        ? 1 + mamp[i] * Math.max(0, Math.sin(clock * .9 + mphase[i])) : 1;
      // A BOSS WALKS ON WITH THE PARADE. Until it is in frame it takes
      // the wave's own step — the exact speed every formation walks at
      // — and drops to its lumber the moment it is on camera. It used
      // to hustle at 2.8× instead, which is 2.3× the parade: it
      // overtook the procession it closes, and the whole entrance was
      // over in nine seconds through the most foreshortened band on
      // the screen. Same speed as the parade is not a fudge factor —
      // it is the rule, and it reads as one thing arriving with
      // another rather than as a number someone chose.
      const marchingOn = kind[i] === KIND_INDEX.boss && z[i] < FIELD.view - 1;
      const base = (marchingOn || kind[i] < BRUTE_IX) ? parade : K.speed * pace;
      const sp = base * mul * surge * spdK[i];

      // A BOSS STEERS AROUND. It is the one enemy a marble cannot stop
      // by standing in the way — it reads the ice ahead and walks the
      // gap, which turns the boss fight from a damage race into herding:
      // where it goes is decided by where you have NOT planted.
      if (kind[i] === KIND_INDEX.boss) {
        let ax = 0;
        for (let b = 0; b < marbles.length; b++) {
          const m = marbles[b];
          if (!m.alive || m.moving) continue;
          const dx = m.x - x[i], dz = m.z - z[i];
          // only what is AHEAD matters — dodging things behind it made
          // it moonwalk
          if (dz < 0 || dz > 6.5 || Math.abs(dx) > 3.8) continue;
          ax -= (dx >= 0 ? 1 : -1) * (1 - Math.abs(dx) / 3.8) * (1 - dz / 6.5);
        }
        // a flat lateral rate, NOT scaled by the walk: a slow boss that
        // also dodged slowly was caught by the first marble anyway
        x[i] += ax * dt * 2.4;
        homeX[i] = x[i];               // a dodge is a real course change
      }

      // A BOMBER HUNTS. Nothing else does.
      //
      // Everything used to steer toward the nearest marble inside four
      // units, and it read well for about ten seconds before it turned
      // the whole tide into a queue: every enemy on the sheet converged
      // on the screen, stopped there, and the line was never in danger
      // again. The tide's job is to WALK AT THE LINE. A marble in its
      // way is something it walks around, not a destination.
      // …and the pull toward a nearby marble is for the SMALL kinds: a
      // boss both dodging and diving at the same marble cancelled its
      // own avoidance and read as drunk.
      // and only the bomber SEEKS. Everything else gives marbles a
      // polite berth (below) and keeps walking at the line.
      const aggro = K.blastR ? 5 : 0;
      if (best >= 0 && bdist < aggro) {
        const m = marbles[best];
        const dx = m.x - x[i], dz = m.z - z[i];
        const d = Math.hypot(dx, dz) || 1;
        const pull = K.blastR ? 1 : .5;
        x[i] += (dx / d) * sp * dt * pull;
        z[i] += (dz / d) * sp * dt * pull;
        if (!K.blastR) z[i] += sp * dt * .5;
        homeX[i] = x[i];               // a hunter has left its formation
      } else {
        z[i] += sp * dt;
        // THE MARCH MOVES THE ANCHOR, and the enemy chases its anchor.
        // Scaled by `mul` like everything else, so a chilled formation
        // slows across as well as forward. The per-enemy wander that
        // used to ride along here is GONE — over a walk this long it
        // was a random scatter, and a formation that arrives scattered
        // is not a formation.
        const lat = march[i] === 1
          ? Math.sin(clock * ZIG_W + mphase[i]) * ZIG_A * mamp[i]
          : mvx[i];
        homeX[i] += lat * dt * mul;
        const kr = K.r * sizeK[i];
        if (homeX[i] < -FIELD.halfW + kr) { homeX[i] = -FIELD.halfW + kr; if (mvx[i] < 0) mvx[i] = -mvx[i]; }
        else if (homeX[i] > FIELD.halfW - kr) { homeX[i] = FIELD.halfW - kr; if (mvx[i] > 0) mvx[i] = -mvx[i]; }
        x[i] += (homeX[i] - x[i]) * Math.min(1, dt * 2.6);
      }

      // …a gentle pre-emptive swerve, so the swarm parts around a marble
      // instead of piling into the hard push below — this is what makes
      // "enemies avoid balls" a thing you can SEE rather than a
      // collision rule
      if (best >= 0 && !K.blastR && kind[i] < BRUTE_IX) {
        const m = marbles[best];
        const berth = m.r + K.r + 1.1;
        if (bdist < berth && bdist > .001) {
          const away = (x[i] - m.x) >= 0 ? 1 : -1;
          x[i] += away * (1 - bdist / berth) * sp * dt * 1.6;
        }
      }

      // …and whatever it is walking through, it walks AROUND. Without
      // this the overflow marches straight through the marble it could
      // not get a place at, which is the one thing that would make the
      // cap above look like a bug instead of a rule.
      if (best >= 0 && bdist < marbles[best].r + K.r) {
        const m = marbles[best];
        const dx = x[i] - m.x, dz = z[i] - m.z;
        const d = Math.hypot(dx, dz) || 1;
        const want = m.r + K.r;
        const push = (want - d) * Math.min(1, dt * 9);
        x[i] += (dx / d) * push;
        z[i] += (dz / d) * push;
      }

      // the bounce lives on the ANCHOR now; this is just the hard wall
      if (x[i] < -FIELD.halfW + K.r) x[i] = -FIELD.halfW + K.r;
      else if (x[i] > FIELD.halfW - K.r) x[i] = FIELD.halfW - K.r;

      if (z[i] > FIELD.line) {
        kill(i, true);
        onLeak?.(name, x[i]);
      }
    }

    // the splits, now that nothing is mid-read
    for (let k = 0; k < pendingSplit.length; k += 3) {
      const px = pendingSplit[k], pz = pendingSplit[k + 1], n = pendingSplit[k + 2];
      for (let s = 0; s < n; s++) {
        const a = (s / n) * Math.PI * 2;
        spawn('mote', px + Math.cos(a) * .34, pz + Math.sin(a) * .34);
      }
    }
    pendingSplit.length = 0;
  }

  // --- the draw ---------------------------------------------------------
  function draw(t) {
    const n = new Array(SWARM_KINDS.length).fill(0);
    let cn = 0;
    for (let i = 0; i < MAX_FOES; i++) {
      if (!alive[i]) continue;
      const name = kindName(i);
      const K = FOE_KINDS[name];
      const s = (scale[i] < 1 ? scale[i] * scale[i] * (3 - 2 * scale[i]) : 1) * sizeK[i];

      // THE GAIT. A squash on a sine and a lean into the walk — two
      // numbers, and they are the difference between a tide that
      // crawls and a field of beads sliding on ice. The squash is
      // volume-preserving so nothing looks like it is changing size.
      // ONE GAIT TEMPO for the whole parade — everyone bobbing to the
      // same beat is half of what makes it read as a parade at all
      const g = t * (2.4 + parade * 1.6) + phase[i];
      const bob = Math.sin(g);
      const sy = 1 + bob * .16, sxz = 1 / Math.sqrt(sy);
      const hop = Math.max(0, bob) * K.r * .16;
      const lean = Math.cos(g) * .15 + (chew[i] >= 0 ? .3 : 0);

      Q.setFromAxisAngle(V.set(1, 0, 0), lean);
      S.set(sxz * s, sy * s, sxz * s);
      M.compose(V.set(x[i], hop, z[i]), Q, S);

      if (bruteOf[i] >= 0) {
        const rig = bruteRigs[bruteOf[i]];
        rig.group.position.set(x[i], hop, z[i]);
        // the rig is built at the BRUTE's size, so anything bigger
        // wearing one scales by the ratio — one pool, any big enemy
        rig.group.scale.setScalar(s * rig.baseScale * (K.r / FOE_KINDS.brute.r));
        rig.group.rotation.x = lean * .5;
        rig.hp = hp[i] / maxHp[i];
      } else {
        const slot = kind[i] >= BRUTE_IX ? 1 : kind[i];
        if (kind[i] >= BRUTE_IX) {
          S.multiplyScalar(K.r / FOE_KINDS.walker.r);
          M.compose(V.set(x[i], hop, z[i]), Q, S);
        }
        const mesh = swarmMesh[slot];
        if (n[slot] < DRAW_CAP[SWARM_KINDS[slot]]) {
          mesh.setMatrixAt(n[slot], M);
          // COLOUR IS STATE. White is untouched; a hit flashes hot, a
          // chilled one goes blue, a burning one red, a healed one
          // green. It is the only status readout a thing this small can
          // carry, and it costs three floats.
          if (flash[i] > 0) C.setRGB(2.6, 1.9, 1.7);
          else if (haste[i] > 0) C.setRGB(1.6, 1.1, .6);
          else if (heal[i] > 0) C.setRGB(.7, 1.5, .95);
          else if (slowK[i] > .2) C.setRGB(.62, .86, 1.25);
          else if (burnT[i] > 0) C.setRGB(1.5, .78, .55);
          // the variant's tint, under every status: swift is washed
          // pale, heavy is soot-dark — size says it first, this seconds it
          else if (variant[i] === 1) C.setRGB(1.45, 1.4, 1.28);
          else if (variant[i] === 2) C.setRGB(.52, .5, .62);
          else C.setRGB(1, 1, 1);
          mesh.setColorAt(n[slot], C);
          n[slot]++;
        }
      }

      const cr = K.r * 2.5 * s;
      M.makeScale(cr, cr, 1);
      // the instanced plane lives on a mesh already rotated flat, so
      // its local y runs UP the sheet: world (x, z) is local (x, −z)
      M.elements[12] = x[i]; M.elements[13] = -z[i]; M.elements[14] = 0;
      contact.setMatrixAt(cn++, M);
    }
    for (let s = 0; s < swarmMesh.length; s++) {
      const m = swarmMesh[s];
      m.count = n[s];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    contact.count = cn;
    contact.instanceMatrix.needsUpdate = true;
  }

  return {
    spawn, kill, hurt, chill, each, nearest, step, draw, rebuildGrid,
    x, z, hp, maxHp, alive, mark, gen, kindName, FOE_KINDS,
    get count() { return count; },
    get room() { return free.length; },
    radiusOf: i => FOE_KINDS[kindName(i)].r * sizeK[i],
    isBrute: i => kind[i] >= BRUTE_IX,
    isBoss: i => kind[i] === KIND_INDEX.boss,
    setPace(k) { pace = k; },
    setParade(v) { parade = v; },
    /** the live boss, or -1. The HUD wants it every frame. */
    findBoss() {
      for (let i = 0; i < MAX_FOES; i++)
        if (alive[i] && kind[i] === KIND_INDEX.boss) return i;
      return -1;
    },
    /**
     * anything a marble rebounds off rather than rolls over.
     *
     * EVERY BIG KIND IS A WALL, and this used to test `=== BRUTE_IX`.
     * The boss sits at BRUTE_IX + 1, so it fell straight through to the
     * crush path and died to a single marble rolling over it — a wave's
     * whole closing act, answered by throwing anything at it once. The
     * comparison is `>=` for the same reason `isBrute` is: the moment
     * there was a second big kind, every `===` against the first one
     * became a latent bug.
     */
    bounceOf: i => kind[i] >= BRUTE_IX ? 1 : (FOE_KINDS[kindName(i)].bounce ?? 0),
    registerBrute(rig) { bruteRigs.push(rig); },
    get bruteRigs() { return bruteRigs; },
    clear() { for (let i = 0; i < MAX_FOES; i++) if (alive[i]) kill(i, true); },
    census() {
      const c = {};
      for (let i = 0; i < MAX_FOES; i++) if (alive[i]) {
        const k = kindName(i); c[k] = (c[k] || 0) + 1;
      }
      return c;
    },
    stats: () => ({ count, room: free.length }),
  };
}
