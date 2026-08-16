// ---------------------------------------------------------------
// LA ORLA — the class photo, scored like a poker hand.
//
// THE LOOP
//   Eight children stand on two shelves. You pick FIVE for the photo
//   and press the button. The photo is scored the way a hand of cards
//   is scored: the five make a FIGURA — pareja, trío, full, camada —
//   on whichever trait they share most of (species, eyes, mouth), and
//   that figura is worth PUNTOS × MULTI. Then every child adds a few
//   puntos of their own, and then every OBJECT you own fires in turn
//   and pushes one of the two numbers. Multiply, and that is the shot.
//
//   Two photos a round, added together against a target. The five in
//   the photo graduate and leave; the ones you left out stay on the
//   shelf and sulk — so keeping a nightmare back to finish a trío next
//   photo is a real decision. Three rounds, and between them you keep
//   one of two new objects.
//
// WHY IT IS A GAME AND NOT A QUIZ: the objects. One says "+20 puntos
// por cada perro" and the next says "×2 multi si ninguno lleva gafas",
// and the photo you want is the one where they both go off.
//
// THE FLAT PAGE. This is a 2D scene like the editor and the crowd —
// cream stock, an orthographic camera straight on, no orbit and no
// billboards. See ARCHITECTURE.md §6b for why the game room is the
// odd one out, not this.
//
// NO CLOCK. `dt` moves the score animation and the boil. Nothing else
// in this file reads elapsed time.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { PAPER } from './sketch.js';
import { setRender, U } from './part.js';
import { addPaper, makeFloorLine } from './paper.js';
import { newRecipe, buildCharacter, ensureParams, setDepthRank } from './rig.js';
import { createAnimator } from './anim.js';
import { SPECIES_IDS } from './species.js';
import { FAMILIES, rollItem, thumbFor } from './items/index.js';
import { audio } from './audio.js';

setRender({ u: 128, frames: 2 });
THREE.ColorManagement.enabled = false;

// =================================================================
// THE NUMBERS. Everything tunable is here and nowhere else.
// =================================================================
const PHOTO = 5;                 // children in a photo
const SHELF = 8;                 // children on the shelves
const SHOTS = 2;                 // photos per round
const CHILD_PTS = 10;            // what one child brings, just by being in it

// The figuras, in the order a player learns them. `pts` are chips and
// `multi` is the multiplier — the split is the whole reason a score
// can explode: objects that add puntos are linear, objects that touch
// multi are not, and the good photo is the one that feeds both.
const FIGURAS = {
  nada:        { pts: 5,   multi: 1, word: 'ni una pareja' },
  pareja:      { pts: 20,  multi: 1, word: 'pareja' },
  doble:       { pts: 35,  multi: 2, word: 'doble pareja' },
  trio:        { pts: 55,  multi: 2, word: 'trío' },
  arcoiris:    { pts: 60,  multi: 3, word: 'orla arcoíris' },
  full:        { pts: 90,  multi: 3, word: 'full' },
  poker:       { pts: 130, multi: 4, word: 'póker' },
  camada:      { pts: 200, multi: 6, word: 'camada' },
};

// Measured, not guessed. Simulated with the real scoring code over 500
// runs a round, against a player who looks at twelve of the fifty-six
// possible photos and keeps the best — roughly what a person does —
// and with the object count the game ACTUALLY gives: one to start and
// one after each of the first two rounds, so round three is played
// with three. (Measuring round three with four, which is the number it
// looks like you should have, put its target 800 too high.)
// Pass rates come out 92% / 69% / 46%: round one teaches, round two
// bites, and about three runs in ten are finished. (Re-measured after
// `boca` was swapped for `estampado` — one axis fewer to match on cost
// round three about 300 points.)
const TARGETS = [900, 1800, 3200];

// What an object's rule is worth, by rank. The ladder is steep on
// purpose: a gilded object should feel like it changed the run.
const POWER = {
  sketch:    { per: 12, mper: 1, flat: 45,  mflat: 2, x: 1.6, iff: 60,  pair: 1 },
  inked:     { per: 20, mper: 1, flat: 75,  mflat: 3, x: 2.2, iff: 100, pair: 2 },
  gilded:    { per: 32, mper: 2, flat: 120, mflat: 4, x: 3,   iff: 160, pair: 2 },
  nightmare: { per: 48, mper: 3, flat: 180, mflat: 6, x: 4,   iff: 240, pair: 3 },
};

// how likely each rank is to be offered, by round
const RANK_BY_ROUND = [
  [['sketch', 70], ['inked', 26], ['gilded', 4]],
  [['sketch', 40], ['inked', 42], ['gilded', 15], ['nightmare', 3]],
  [['sketch', 20], ['inked', 42], ['gilded', 30], ['nightmare', 8]],
];

// =================================================================
// THE VOCABULARY — what the game is allowed to talk about.
//
// Two rules govern everything in this section, and they are the ones
// to enforce in review: a trait may only be scored if two children
// sharing it LOOK alike at the size they are drawn, and a predicate
// may only be named if a player can point at it. Anything subtle is
// a stat you cannot see, which ARCHITECTURE.md §10 already forbids
// for objects and which would be worse here, where it is the rule.
// =================================================================
const P = (c, id) => c.recipe.parts[id]?.params ?? {};

const SP_PLURAL = { human: 'humanos', dog: 'perros', cat: 'gatos', nightmare: 'pesadillas' };
const PAT_PLURAL = { stripes: 'rayas', belly: 'barrigas', buttons: 'botones', pocket: 'bolsillos' };

// THE AXES a figura can be made on, and the choice is not free.
//
// Almost every legible trait in this engine is a species tell — that
// is what a casting profile IS (ARCHITECTURE §8) — so an axis picked
// carelessly scores species under another name and the player learns
// nothing from it. Measured as mutual information with `recipe.species`
// over 200k rolled children: crest .84, mouth .63, tail .53, base .52,
// eyes .50, hair .37 … and `torso.pattern` **.00**, the one legible
// trait no species has an opinion about, drawn on every base.
//
// So: species is the suit, pattern is the honest cross-cut, and eyes
// sit in between — a dog is mostly dot-eyed but a human rolls dot 16%
// of the time, so it still crosses.
//
// `boca` was here and is gone: it leaked the most of the three AND its
// five commonest values (wobble, tiny, smirk, frown, grit) are all one
// thin wiggly line at the size these are drawn, so "pareja de bocas"
// was a figura the player could not check.
//
// `nul` is a value that means ABSENCE. Three children with no pattern
// are not a trío of anything.
const AXES = [
  { id: 'especie', of: c => c.recipe.species,
    word: (fig, v) => `${fig} de ${SP_PLURAL[v] ?? v}` },
  { id: 'estampado', of: c => P(c, 'torso').pattern, nul: 'none',
    word: (fig, v) => `${fig} de ${PAT_PLURAL[v] ?? v}` },
  { id: 'ojos', of: c => P(c, 'eyes').type,
    word: fig => `${fig} de ojos` },
];

const HORNS = new Set(['horns', 'spikes', 'antlers', 'stalks']);
const EARS = new Set(['floppy', 'cat', 'bear', 'bunny']);

// One-child tests an object's rule may name. Deliberately short: every
// one of these is something you can see across the page.
//
// NOT HERE, and on purpose: anything about what a child is CARRYING.
// Held/Offhand declare base:['biped'], so "lleva algo" would secretly
// mean "no es un perro ni un gato" — a rule that reads as one thing
// and tests another.
// Every predicate carries BOTH forms. One is not enough: "por cada
// perro" and "todos son perro" cannot come from the same string, and
// generated copy that does not agree in number reads as a bug in the
// game rather than a rule in it.
const PREDS = [
  { id: 'perro', one: 'perro', many: 'perros', test: c => c.recipe.species === 'dog' },
  { id: 'gato', one: 'gato', many: 'gatos', test: c => c.recipe.species === 'cat' },
  { id: 'humano', one: 'humano', many: 'humanos', test: c => c.recipe.species === 'human' },
  { id: 'pesadilla', one: 'pesadilla', many: 'pesadillas', test: c => c.recipe.species === 'nightmare' },
  { id: 'cuernos', one: 'niño con cuernos', many: 'niños con cuernos', test: c => HORNS.has(P(c, 'crest').style) },
  { id: 'orejas', one: 'niño con orejas', many: 'niños con orejas', test: c => EARS.has(P(c, 'crest').style) },
  { id: 'gafas', one: 'niño con gafas', many: 'niños con gafas', test: c => !!P(c, 'extras').glasses },
  { id: 'llora', one: 'niño que llora', many: 'niños que lloran', test: c => !!P(c, 'extras').tears },
  { id: 'manchas', one: 'niño con manchas', many: 'niños con manchas', test: c => !!P(c, 'extras').spots },
  { id: 'pelo', one: 'niño con pelo', many: 'niños con pelo', test: c => (P(c, 'hair').style ?? 'bald') !== 'bald' },
  { id: 'rabo', one: 'niño con rabo', many: 'niños con rabo', test: c => (P(c, 'tail').style ?? 'none') !== 'none' },
  { id: 'cuatro', one: 'niño a cuatro patas', many: 'niños a cuatro patas', test: c => c.recipe.base === 'quad' },
];

// Conditions over the whole photo. "los cinco son…" rather than
// "todos son…" because it also names how many there are, which the
// player is otherwise left to remember.
const CONDS = [
  { id: 'ninguno', label: p => `no hay ningún ${p.one}`, test: (ph, p) => !ph.some(p.test) },
  { id: 'todos', label: p => `los cinco son ${p.many}`, test: (ph, p) => ph.every(p.test) },
  { id: 'tres', label: p => `hay tres o más ${p.many}`, test: (ph, p) => ph.filter(p.test).length >= 3 },
];

const rnd = n => (Math.random() * n) | 0;
const pick = a => a[rnd(a.length)];
function wpick(pairs) {
  let t = 0; for (const p of pairs) t += p[1];
  let x = Math.random() * t;
  for (const p of pairs) if ((x -= p[1]) < 0) return p[0];
  return pairs[pairs.length - 1][0];
}

// ---- the figura --------------------------------------------------
// Count how many children share each value on an axis, and read the
// group sizes the way a poker hand is read.
function figuraOn(photo, axis) {
  const seen = new Map();
  for (const c of photo) {
    const v = axis.of(c);
    if (v === undefined || v === axis.nul) continue;
    seen.set(v, (seen.get(v) ?? 0) + 1);
  }
  const groups = [...seen.entries()].sort((a, b) => b[1] - a[1]);
  if (!groups.length) return null;
  const [topVal, top] = groups[0];
  const second = groups[1]?.[1] ?? 0;
  let key = 'nada';
  if (top >= 5) key = 'camada';
  else if (top === 4) key = 'poker';
  else if (top === 3 && second === 2) key = 'full';
  else if (top === 3) key = 'trio';
  else if (top === 2 && second === 2) key = 'doble';
  else if (top === 2) key = 'pareja';
  else if (groups.length === photo.length) key = 'arcoiris';
  const f = FIGURAS[key];
  return { key, ...f, axis, value: topVal, name: axis.word(f.word, topVal) };
}

// the best figura across every axis — that is the one the photo is
// worth, and its name is what gets printed
function bestFigura(photo) {
  let best = null;
  for (const axis of AXES) {
    const f = figuraOn(photo, axis);
    if (!f) continue;
    const score = f.pts * f.multi;
    if (!best || score > best.pts * best.multi) best = f;
  }
  return best ?? { key: 'nada', ...FIGURAS.nada, name: FIGURAS.nada.word };
}

// how many plain pairs are in the photo, on any axis — what a toy pays
function pairsIn(photo) {
  let n = 0;
  for (const axis of AXES) {
    const seen = new Map();
    for (const c of photo) {
      const v = axis.of(c);
      if (v !== undefined && v !== axis.nul) seen.set(v, (seen.get(v) ?? 0) + 1);
    }
    for (const [, k] of seen) n += k >> 1;
  }
  return n;
}

// =================================================================
// THE OBJECTS.
//
// An object is a rolled item from the existing catalogue — its own
// drawing, its own name, its own rank — carrying ONE rule. The rule's
// KIND comes from the family, so a sword hits (puntos) and a wand
// multiplies and a crown is worth something just for being worn; its
// SIZE comes from the rank. Only the predicate is free.
//
// This is a compromise with the house rule that "the stats ARE the
// drawing" (ARCHITECTURE.md §10): a sword's rolled blade length does
// not set the number here. The alternative was twelve hand-written
// rules and no variety by round three.
// =================================================================
// Multiplying is what makes a score EXPLODE rather than grow, so two
// families carry it rather than one: measured over 600 shelves with a
// single ×-family in the pool, the best photo a player could find was
// only about twice a random one, and a game where skill is worth 2× is
// a game where the objects are decoration.
const KIND_BY_FAMILY = {
  sword: 'per', bat: 'per', lantern: 'mper',
  wand: 'x', doll: 'x', charm: 'mper', crown: 'mflat', hat: 'mflat',
  shield: 'flat', toy: 'pair', bed: 'flat', mutation: 'mflat',
};

function makeRule(kind, rank) {
  const pw = POWER[rank];
  if (kind === 'per') {
    const p = pick(PREDS);
    return { kind, text: `+${pw.per} puntos por cada ${p.one}`,
             apply: (s, ph) => { s.pts += pw.per * ph.filter(p.test).length; } };
  }
  if (kind === 'mper') {
    const p = pick(PREDS);
    return { kind, text: `+${pw.mper} multi por cada ${p.one}`,
             apply: (s, ph) => { s.multi += pw.mper * ph.filter(p.test).length; } };
  }
  if (kind === 'x') {
    const p = pick(PREDS), cond = pick(CONDS);
    return { kind, text: `×${pw.x} multi si ${cond.label(p)}`,
             apply: (s, ph) => { if (cond.test(ph, p)) s.multi *= pw.x; } };
  }
  if (kind === 'iff') {
    const p = pick(PREDS), cond = pick(CONDS);
    return { kind, text: `+${pw.iff} puntos si ${cond.label(p)}`,
             apply: (s, ph) => { if (cond.test(ph, p)) s.pts += pw.iff; } };
  }
  if (kind === 'pair') {
    return { kind, text: `+${pw.pair} multi por cada pareja de la orla`,
             apply: (s, ph) => { s.multi += pw.pair * pairsIn(ph); } };
  }
  if (kind === 'flat') return { kind, text: `+${pw.flat} puntos`, apply: s => { s.pts += pw.flat; } };
  return { kind: 'mflat', text: `+${pw.mflat} multi`, apply: s => { s.multi += pw.mflat; } };
}

// Two families are left out on purpose. A `mutation` has no object to
// draw — it is a patch to a child — so its card comes out blank; and a
// `bed` seen from above is furniture, not something you hang on a wall
// with a rule written under it.
const OBJ_FAMILIES = FAMILIES.filter(f => f.id !== 'mutation' && f.id !== 'bed');

function rollObject(round, forceRank = null) {
  // the rank is a MEDIUM as much as a number (ARCHITECTURE §10): it
  // changes how the object is drawn, so it has to be chosen before the
  // art is rolled, never relabelled after
  const rank = forceRank ?? wpick(RANK_BY_ROUND[Math.min(round, RANK_BY_ROUND.length - 1)]);
  // any family will do — the art is the point, and the kind it maps to
  // is what keeps a sword feeling like a sword
  for (let t = 0; t < 6; t++) {
    const fam = pick(OBJ_FAMILIES);
    const item = rollItem(fam.id, rank, (Math.random() * 1e9) | 0);
    if (!item) continue;
    return { item, rank, family: fam.id, ...makeRule(KIND_BY_FAMILY[fam.id] ?? 'per', rank) };
  }
  return null;
}

// =================================================================
// THE PAGE
// =================================================================
// THE SHELVES RESHAPE. Four across is a class photo and it is right on
// anything wider than it is tall; on a phone held upright it is eight
// children about ninety pixels each, with two thirds of the screen
// empty above and below them. Portrait gets two columns of four, which
// is less of a photo and twice the child.
const CELL_W = 1.6, CELL_H = 2.15, FACE_SCALE = .92;
let COLS = 4, ROWS = 2;
// what the camera must contain, plus room for the HUD strip on top
// and the button bar underneath
const needW = () => COLS * CELL_W / 2 + .35;
const needH = () => ROWS * CELL_H / 2 + .95;

const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
camera.position.set(0, -.12, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
stage.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = 'none';

const rowFloorY = row => -(row - (ROWS - 1) / 2) * CELL_H - CELL_H * .34;
const cellPos = i => [
  ((i % COLS) - (COLS - 1) / 2) * CELL_W,
  rowFloorY((i / COLS) | 0),
];

// the shelves themselves, redrawn when the page changes shape
const shelves = [];
function drawShelves() {
  for (const fl of shelves) {
    scene.remove(fl);
    fl.geometry.dispose();
    fl.material.map?.dispose();
    fl.material.dispose();
  }
  shelves.length = 0;
  for (let r = 0; r < ROWS; r++) {
    const fl = makeFloorLine(COLS * CELL_W + .6);
    fl.position.set(0, rowFloorY(r) - fl.userData.lineDy, -1);
    scene.add(fl);
    shelves.push(fl);
  }
}

function onResize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;                    // a hidden page measures 0×0
  const aspect = w / h;

  const wantCols = aspect < .95 ? 2 : 4;
  if (wantCols !== COLS || !shelves.length) {
    COLS = wantCols;
    ROWS = SHELF / COLS;
    drawShelves();
    for (const c of cells) if (c) placeCell(c);
  }

  // FIT BOTH WAYS. An orthographic camera sized by height alone shows
  // `halfH * aspect` across, and a phone held upright has an aspect
  // near .46 — so a frame that holds a row on a laptop holds a third
  // of one on a phone. Whichever axis is tighter decides.
  let halfH = needH(), halfW = needH() * aspect;
  if (halfW < needW()) { halfW = needW(); halfH = needW() / aspect; }
  camera.top = halfH; camera.bottom = -halfH;
  camera.left = -halfW; camera.right = halfW;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
addEventListener('resize', onResize);
addEventListener('load', onResize);

// generous: the page has to cover the widest frame either shape asks
// for, and it is 1.6× oversized inside addPaper anyway
addPaper(scene, 5.4);

// =================================================================
// THE CHILDREN
// =================================================================
const cells = new Array(SHELF).fill(null);
const buildQueue = [];

// the only expression this game ever asks for, and the parts it moves
// (see `crying` in expressions.js)
const WARM = { eyes: ['cry'], brows: ['sad'], mouth: ['cry'], tearsWet: ['flow'] };

function buildCell(i) {
  if (cells[i]) {
    scene.remove(cells[i].holder);
    cells[i].face.dispose();
    cells[i] = null;
  }
  const recipe = newRecipe();
  recipe.species = SPECIES_IDS[rnd(SPECIES_IDS.length)];
  recipe.base = null;                       // the species picks it
  ensureParams(recipe);
  const face = buildCharacter(recipe);

  // PREWARM THE CRYING FACE. States are drawn lazily, which is right
  // for the crowd page where nobody ever emotes and wrong here, where
  // three children start crying the instant the photo fills up — that
  // is four canvases each, drawn mid-tap. Paying for them now costs a
  // couple of milliseconds inside a build that is already happening
  // behind the fill-in. (ARCHITECTURE.md §6b, the same reason game.js
  // has a WARM table.)
  for (const e of face.entries) {
    const want = WARM[e.id];
    if (!want) continue;
    const cur = e.part.cur.state;
    for (const st of want) e.part.setState(st);
    e.part.setState(cur);
  }

  const holder = new THREE.Group();
  holder.add(face.group);                   // the animator owns face.group
  scene.add(holder);
  const c = {
    i, recipe, face, holder, picked: false, fade: 1, opacity: 1,
    parts: face.entries.map(e => e.part.matl),
    animator: createAnimator(() => face, {
      blink: true, gaze: true, talk: false, sway: true, breath: true, boil: true,
      // identical recipes would otherwise boil in lockstep; the phase
      // option never reaches the boil clock (anim.js reads raw t), so
      // the speed is what has to differ
      boilSpeed: .46 + i * .015, phase: Math.random() * 20, amp: 1.4,
    }),
  };
  cells[i] = c;
  placeCell(c);
  return c;
}

// A child in the photo STEPS FORWARD: down the page, noticeably
// bigger, and in front of everyone else in the draw order. This is the
// only feedback the selection has, so it is deliberately too much
// rather than tasteful — the first build moved them 0.16 units and
// scaled them 9%, and you could not tell who was in the photo at all.
// The other half of the job is done in the loop, which pales everyone
// who is not in it.
function placeCell(c) {
  const [x, fy] = cellPos(c.i);
  const s = FACE_SCALE * (c.picked ? 1.16 : 1);
  c.holder.position.set(x, fy + (c.face.F.B.floorY / U) * s + (c.picked ? -.26 : 0), c.picked ? .5 : 0);
  c.holder.scale.setScalar(s);
  setDepthRank(c.face, c.picked ? 8 + c.i : c.i);
}

const photoOf = () => cells.filter(c => c && c.picked);

function togglePick(c) {
  if (!c || busy) return;
  if (!c.picked && photoOf().length >= PHOTO) return;
  c.picked = !c.picked;
  placeCell(c);
  audio.sfx(c.picked ? 'tick' : 'tap', { vol: .5 });
  paintHud();
}

// picking by cell rather than by pixel: the target is a whole child,
// and raycasting the part meshes would miss the gaps between strokes
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', ev => {
  const r = renderer.domElement.getBoundingClientRect();
  if (!r.width || !r.height) return;
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = ray.ray.origin;
  let best = -1, bd = Infinity;
  for (let i = 0; i < SHELF; i++) {
    const [x, y] = cellPos(i);
    const d = Math.hypot(p.x - x, p.y - (y + .7));
    if (d < bd) { bd = d; best = i; }
  }
  if (best >= 0 && bd < Math.max(CELL_W, CELL_H) * .62) togglePick(cells[best]);
});

// =================================================================
// THE RUN
// =================================================================
const S = {
  round: 0,            // 0-based index into TARGETS
  shot: 0,             // photos taken this round
  banked: 0,           // score so far this round
  objects: [],
  over: false,
};
let busy = true;       // true while anything is animating or building

// ---- the little animation engine (the only thing dt does here) ----
const tweens = [];
const tween = (dur, fn) => new Promise(res => tweens.push({ t: 0, dur, fn, res }));
const sleep = ms => tween(ms / 1000, () => {});
function stepTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i];
    w.t += dt;
    const k = Math.min(1, w.t / w.dur);
    w.fn(k);
    if (k >= 1) { tweens.splice(i, 1); w.res(); }
  }
}

// =================================================================
// THE DOM
// =================================================================
const el = {
  round: document.getElementById('round'),
  meterBar: document.querySelector('#meter .bar i'),
  meterTxt: document.getElementById('meterTxt'),
  kit: document.getElementById('kit'),
  score: document.getElementById('score'),
  floats: document.getElementById('floats'),
  go: document.getElementById('go'),
  picked: document.getElementById('picked'),
  over: document.getElementById('over'),
};

const projV = new THREE.Vector3();
function screenOf(x, y) {
  projV.set(x, y, 0).project(camera);
  const r = renderer.domElement.getBoundingClientRect();
  return [r.left + (projV.x * .5 + .5) * r.width, r.top + (-projV.y * .5 + .5) * r.height];
}

function float(sx, sy, text, cls) {
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  s.style.left = `${sx}px`;
  s.style.top = `${sy}px`;
  el.floats.appendChild(s);
  setTimeout(() => s.remove(), 1050);
}

function paintHud() {
  const target = TARGETS[S.round];
  el.round.innerHTML = `ronda <b>${S.round + 1}/${TARGETS.length}</b> · foto <b>${Math.min(S.shot + 1, SHOTS)}/${SHOTS}</b>`;
  const frac = Math.max(0, Math.min(1, S.banked / target));
  el.meterBar.style.width = `${frac * 100}%`;
  el.meterBar.classList.toggle('over', S.banked >= target);
  el.meterTxt.innerHTML = `<b>${Math.round(S.banked)}</b> / ${target}`;
  const n = photoOf().length;
  el.picked.textContent = busy ? '' : `${n}/${PHOTO}`;
  el.go.disabled = busy || n !== PHOTO;
}

function paintKit() {
  el.kit.innerHTML = '';
  for (const o of S.objects) {
    const d = document.createElement('div');
    d.className = `obj r-${o.rank}`;
    d.appendChild(thumbFor(o.item, 64));
    const s = document.createElement('span');
    s.innerHTML = `${o.item.name}<br><em>${o.text}</em>`;
    d.appendChild(s);
    o.el = d;
    el.kit.appendChild(d);
  }
}

// =================================================================
// SCORING — the whole point, and it is an ANIMATION.
//
// Balatro's pleasure is not the arithmetic, it is watching the
// arithmetic happen one contributor at a time: the hand is named,
// then each card pays, then each joker fires, and only at the end do
// the two numbers multiply. Resolve it all at once and the same
// score is worth nothing.
// =================================================================
function sumEl(pts, multi) {
  return `<div class="sum"><b>${Math.round(pts)}</b><span class="x">×</span><i>${round2(multi)}</i></div>`;
}
const round2 = n => (Math.abs(n - Math.round(n)) < .01 ? String(Math.round(n)) : n.toFixed(1));

async function scorePhoto() {
  const photo = photoOf();
  if (photo.length !== PHOTO || busy) return;
  busy = true;
  paintHud();

  const fig = bestFigura(photo);
  const s = { pts: fig.pts, multi: fig.multi };

  el.score.style.display = 'block';
  el.score.innerHTML = `<div class="figura">${fig.name}</div>${sumEl(s.pts, s.multi)}`;
  audio.sfx('scratch', { vol: .7 });
  await sleep(520);

  const show = () => {
    el.score.innerHTML = `<div class="figura">${fig.name}</div>${sumEl(s.pts, s.multi)}`;
    const sum = el.score.querySelector('.sum');
    sum.classList.add('pop');
  };

  // every child pays, left to right, the way you would count them
  for (const c of [...photo].sort((a, b) => a.i - b.i)) {
    s.pts += CHILD_PTS;
    const [x, y] = cellPos(c.i);
    const [sx, sy] = screenOf(x, y + 1.1);
    float(sx, sy, `+${CHILD_PTS}`, 'pts');
    c.animator.setFace('idle');
    show();
    audio.sfx('tick', { vol: .4 });
    await sleep(150);
  }

  // then the objects, in the order you own them
  for (const o of S.objects) {
    const before = { pts: s.pts, multi: s.multi };
    o.apply(s, photo);
    if (s.pts === before.pts && s.multi === before.multi) continue;   // it did nothing
    o.el?.classList.add('fire');
    const r = o.el?.getBoundingClientRect();
    if (r) {
      const dp = s.pts - before.pts;
      if (dp) float(r.right + 12, r.top + r.height / 2, `+${Math.round(dp)}`, 'pts');
      if (s.multi !== before.multi) {
        // a multiplying object shows what it multiplied BY, not the
        // difference — "×2.5" is the thing the player is chasing and
        // "+9 multi" hides it
        const txt = o.kind === 'x' ? `×${round2(POWER[o.rank].x)}` : `+${round2(s.multi - before.multi)}`;
        float(r.right + 12, r.top + r.height / 2 - 18, txt, 'mult');
      }
    }
    show();
    audio.sfx('tap', { vol: .55 });
    await sleep(330);
    o.el?.classList.remove('fire');
  }

  // and only now do they multiply
  const total = Math.round(s.pts * s.multi);
  el.score.innerHTML = `<div class="figura">${fig.name}</div>${sumEl(s.pts, s.multi)}`
    + `<div class="total">${total}</div>`;
  audio.sfx('paper', { vol: .8 });
  await sleep(900);

  S.banked += total;
  S.shot++;
  paintHud();
  el.score.style.display = 'none';

  // the five graduate: they bow out and their places are refilled.
  // Nothing may build while the player is looking at a still page, so
  // the new ones are queued and drawn in over the next few frames.
  await tween(.55, k => { for (const c of photo) c.fade = 1 - k; });
  for (const c of photo) buildQueue.push(c.i);

  await sleep(260);
  finishShot();
}

function finishShot() {
  const target = TARGETS[S.round];
  if (S.banked >= target) { winRound(); return; }
  if (S.shot >= SHOTS) { lose(); return; }
  // the replacements may still be drawing themselves in; the loop
  // hands control back when the shelf is full
  busy = buildQueue.length > 0;
  paintHud();
}

// =================================================================
// ROUNDS
// =================================================================
function winRound() {
  if (S.round + 1 >= TARGETS.length) { win(); return; }
  audio.sfx('paper');
  // two offers that DO DIFFERENT THINGS. Rolled freely, "+4 multi" and
  // "+4 multi" comes up often enough to be the first thing you notice,
  // and a choice between two identical rules is not a choice.
  const offers = [];
  for (let t = 0; t < 12 && offers.length < 2; t++) {
    const o = rollObject(S.round + 1);
    if (!o) continue;                                  // a family declined to roll
    if (offers.length && o.kind === offers[0].kind) continue;
    offers.push(o);
  }
  if (!offers.length) { takeObject(null); return; }    // nothing to offer: move on
  el.over.style.display = 'flex';
  el.over.innerHTML = `<h2>ronda ${S.round + 1} superada<small> · quédate con uno</small></h2>`
    + `<div class="cards">` + offers.map((o, i) =>
      `<button class="r-${o.rank}" data-i="${i}"><b>${o.item.name}</b>`
      + `<div class="rule">${o.text}</div>`
      + (o.item.copy?.costs ? `<div class="cost">${o.item.copy.costs}</div>` : '')
      + `</button>`).join('') + `</div>`
    + `<button class="quiet">no coger nada</button>`;
  el.over.querySelectorAll('.cards button').forEach(b => {
    const o = offers[+b.dataset.i];
    b.insertBefore(thumbFor(o.item, 92), b.firstChild);
    b.onclick = () => takeObject(o);
  });
  el.over.querySelector('.quiet').onclick = () => takeObject(null);
}

function takeObject(o) {
  if (o) { S.objects.push(o); paintKit(); audio.sfx('scratch'); }
  el.over.style.display = 'none';
  S.round++;
  S.shot = 0;
  S.banked = 0;
  busy = false;
  paintHud();
}

function ending(title, sub) {
  S.over = true;
  busy = true;
  el.over.style.display = 'flex';
  el.over.innerHTML = `<div class="big">${title}</div><div class="sub">${sub}</div>`
    + `<button class="quiet" onclick="location.reload()">otra orla</button>`;
  paintHud();
}

function win() {
  audio.sfx('paper');
  const best = Math.max(TARGETS.length, +localStorage.getItem('kg-orla') || 0);
  localStorage.setItem('kg-orla', best);
  ending('la orla está hecha',
    `las tres rondas, con ${S.objects.length} objeto${S.objects.length === 1 ? '' : 's'} en la pared`);
}

function lose() {
  audio.sfx('tear');
  const prev = +localStorage.getItem('kg-orla') || 0;
  if (S.round + 1 > prev) localStorage.setItem('kg-orla', S.round + 1);
  ending('no salió la foto',
    `te quedaste en la ronda ${S.round + 1} de ${TARGETS.length}`
    + ` · ${Math.round(S.banked)} de ${TARGETS[S.round]}`);
}

el.go.onclick = () => scorePhoto();
addEventListener('keydown', ev => {
  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (!el.go.disabled) scorePhoto(); }
  if (ev.key.toLowerCase() === 'r') location.reload();
  if (ev.key.toLowerCase() === 'm') audio.toggleMute();
});

// =================================================================
// BOOT AND LOOP
// =================================================================
for (let i = 0; i < SHELF; i++) buildQueue.push(i);
// You start with one object, so the very first photo already has a
// rule in it and the idea explains itself. It is always the plainest
// rank: a gilded opener rolled in testing and tripled round one.
const first = rollObject(0, 'sketch');
if (first) S.objects.push(first);
paintKit();
paintHud();
onResize();

// A named function rather than a closure handed straight to three, so
// a test can PUMP it: the browser throttles requestAnimationFrame to
// nothing while the page is hidden, and an automated check of a whole
// scoring pass would otherwise be measuring a frozen game (CLAUDE.md).
let last = performance.now();
function frame(now) {
  // clamped at BOTH ends: a hand-pumped frame can hand us a `now`
  // behind the last real one, and a negative dt runs tweens backwards
  const dt = Math.max(0, Math.min(.05, (now - last) / 1000));
  last = now;
  const t = now / 1000;

  // Fill the shelves on a time budget rather than one per frame: a
  // character costs ~20 ms, so this is one or two a frame, and a slow
  // frame draws more of them instead of taking a minute.
  if (buildQueue.length) {
    const until = performance.now() + 22;
    do { buildCell(buildQueue.shift()); } while (buildQueue.length && performance.now() < until);
    if (!buildQueue.length && !S.over && el.over.style.display !== 'flex') {
      busy = false;
      paintHud();
    }
  }

  stepTweens(dt);

  // Who is in the photo, said twice: the chosen stand forward (see
  // placeCell) and everybody else goes PALE — lighter pencil, which is
  // the one dimming this medium can do honestly. And once the photo is
  // full, the ones left out start crying, which is the whole joke.
  let nPicked = 0;
  for (const c of cells) if (c?.picked) nPicked++;
  const full = nPicked === PHOTO;
  for (const c of cells) {
    if (!c) continue;
    c.animator.setFace(full && !c.picked ? 'crying' : 'idle');
    const want = c.fade * (nPicked && !c.picked ? .42 : 1);
    if (c.opacity !== want) {
      c.opacity = want;
      for (const m of c.parts) m.opacity = want;
    }
    c.animator.update(t, dt);
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// the decidable half — see CLAUDE.md
window.__orla = {
  S, cells, FIGURAS, TARGETS, AXES, PREDS, POWER,
  bestFigura, figuraOn, pairsIn, rollObject, makeRule, scorePhoto, togglePick,
  photoOf, buildQueue, camera, renderer, frame,
  get busy() { return busy; },
  pick: i => togglePick(cells[i]),
  // Pump frames by hand. It has to be ASYNC and yield between them:
  // the scoring pass is a chain of awaits, and a synchronous loop
  // would run every tween to the end without ever letting a single
  // continuation off the microtask queue.
  async pump(n = 60, step = 16) {
    let t = performance.now();
    for (let i = 0; i < n; i++) { t += step; frame(t); await Promise.resolve(); }
  },
};
