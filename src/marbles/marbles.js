// ---------------------------------------------------------------
// MARBLES — the third game, and the first one made of the molded
// characters.
//
// THE LOOP
//   A tide of small dark things walks down a toy tray toward a red
//   line. You hold three living marbles. You pull one back, let go,
//   and it slides: it CRUSHES everything small it rolls over, BOUNCES
//   off the rails and off the brutes, and wherever it stops it PLANTS
//   and starts fighting on its own, for ever, like a turret you threw.
//
//   And if it strikes one of YOUR marbles on the way, that marble
//   fires its one big move and is sent sliding itself — which can
//   strike a third. That is the chain, it is the only skill in the
//   game, and everything else exists to make it legible.
//
//   Kill enough and you level: three cards, take one. Let enough over
//   the line and the run is over.
//
// WHY IT CAN AFFORD HUNDREDS OF ENEMIES: a small enemy is not a
// physics body (see `mfoes.js`). The solver only ever has a dozen
// circles in it, and only while a throw is live. Between throws the
// physics costs nothing at all.
//
// WHAT LIVES WHERE
//   mtable.js   the set, the camera, screen ↔ floor
//   mfoes.js    the tide
//   mphys.js    momentum, the hook, the chain
//   mcombat.js  the five verbs an ability is written in
//   mkinds.js   the roster — stats and drawing, one object
//   mboost.js   the level-up cards
//   mfx.js      the juice
//   msound.js   the toybox
//   THIS FILE   the rules, the run, the hand and the HUD, and nothing
//               else. If something here starts knowing what a marble
//               looks like, it belongs in one of the files above.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { createTable, FIELD } from './mtable.js';
import { createTide, FOE_KINDS } from './mfoes.js';
import { createCombat } from './mcombat.js';
import { createFX } from './mfx.js';
import { toybox } from './msound.js';
import { KINDS, KIND_IDS, newBag, drawKind } from './mkinds.js';
import { makeMarble, stepShot, previewPath, PHYS } from './mphys.js';
import { newMods, newKindMods, dealBoosters, dealRecruits, RANK_COLOR } from './mboost.js';
import { buildGloss, newGRecipe, ensureGParams } from '../gloss/grig.js';
import { setGlossDetail } from '../gloss/gshape.js';
import { studioEnv, makeMaterialFactory } from '../gloss/gmedia.js';
import { createGlossFace } from '../gloss/gface.js';

// =================================================================
// THE NUMBERS. Everything tunable is here and nowhere else, so a
// balance pass is one screenful and a diff is readable.
// =================================================================
const LIVES = 20;                 // how many may cross before the run ends
// 3.6 → 5.4 → 9 → 7.5 → 6, and the history is worth keeping because
// the same number means different things at different tempos. Enemies
// that no longer stop to fight stopped killing marbles, the hand
// became effectively infinite and the game went easy; the hand
// recharging slowly is the one cost a throw has, so it is the first
// DIFFICULTY knob to turn. At 5.4 an auto-played run threw every 5.3
// seconds and did not lose a life for the first two and a half
// minutes; 9 fixed that and overshot into a wait.
//
// But 5.4 was measured against a tide walking at .42 and this one
// walks at .63 (see `TEMPO`), so the seconds are not comparable —
// what matters is the refill against the WALK, and at 6 it is a
// shorter fraction of a crossing than 5.4 ever was. A number tuned at
// one tempo has to be re-measured at another, not carried over.
//
// It is a STARTING number, not a fixed one: `quick hands` is the
// commonest plain card there is, so a run that wants its hand back
// buys it back.
const REFILL = 6;                 // seconds for one empty hand slot to fill

// THEY MELT, and it is the single most important rule in the game.
// How long each kind lasts is `life` in `mkinds.js`; this file only
// runs the clock.
//
// Without it a throw is permanent, so the standing army only ever
// grows: an auto-played run reached FORTY-FIVE marbles inside a
// minute, at which point the tide was annihilated at the far hog line
// and the game was over in the sense that nothing could happen any
// more. Every alternative was worse — a hard cap needs an arbitrary
// rule about which marble to take away, and scaling the tide to out-run
// an unbounded army just moves the same problem later.
//
// Melting fixes it in the fiction rather than in the UI: they are
// glossy little things standing on ice, working hard. At 4.5% a second
// a marble that nothing touches lasts about twenty-two seconds, so a
// player throwing at a normal rate holds a dozen or so on the sheet at
// once — enough to be an army, never enough to be a wall. It is also
// what stops turtling from being a strategy: you cannot stop throwing.
const MELT = .05;
// WHERE EACH SLOT STANDS, and it has to be computed rather than tabled
// because the hand GROWS: the gilded "a bigger pocket" card adds a
// fourth, and a fixed table put it a single unit from its neighbour —
// two marbles overlapping on the ice with their names printed on top of
// each other. Spread evenly, inside the boards for even the widest
// kind (halfW − r = 3.90 for a Boulder), and never wider than a hand of
// three, so adding a slot rearranges the hand instead of stretching it
// past the rails.
const BENCH_SPAN = 5.6;
const benchX = (i, n = S.hand.length) =>
  n <= 1 ? 0 : (i / (n - 1) - .5) * Math.min(BENCH_SPAN, 2.05 * (n - 1));
// THE PULL IS MEASURED ON THE SCREEN, NOT ON THE TABLE, and it is
// measured from WHERE YOUR FINGER LANDED rather than from the marble.
// Both are the same lesson learned twice:
//   · anchored at the marble, there is nowhere to pull. The launcher
//     sits on the near rail, which is the bottom edge of the screen —
//     a slingshot needs room BEHIND its anchor and there is none.
//   · measured on the floor, the same drag means different power
//     depending on where on the table you did it, because a pixel is
//     worth more world units the further up the table it lands.
// Press anywhere, pull back, let go. The dotted line is what tells you
// where it is going, and it has to be, which is why it simulates the
// real integrator.
const PULL_MIN = .07;             // of the pull basis, before a throw exists
const PULL_MAX = .30;             // …and where full power is reached
// THE PULL BASIS IS THE SHORT SCREEN EDGE, CAPPED. Uncapped it scaled
// the gesture to the monitor: on a phone the short edge is ~390px and
// full power is a 117px pull, but on a 1440×900 desktop it is 900px and
// full power became a 270px pull — while the marble you naturally press
// on sits at ~76% of the window's height, leaving ~215px of screen
// below it. Full power was not hard on desktop, it was UNREACHABLE:
// the cursor hit the bottom of the screen at ~0.74. Capped, a phone is
// untouched (its short edge is under the cap) and a desktop pull tops
// out at 168px, inside the room that actually exists under the bench.
const PULL_BASIS = 560;           // px — a pull is a wrist gesture, not a monitor-sized one
// The sheet is nine wide and thirty-six long, so a wide aim is a
// wide aim into the boards. Forty degrees still banks off both sides
// and still reaches every lane; ninety only wasted half the gesture.
const AIM_MAX = .74;              // radians off straight, either way

// How much of the shot the dotted line shows, in world units. The sheet
// is thirty-six long, so this is about a fifth of a full-power throw:
// enough to read the direction and the first of the hook, nowhere near
// enough to see where it stops. Drawn all the way to the resting place
// the line answered the entire question and the throw stopped being a
// judgement.
const AIM_LEAD = 8.5;

// XP. A level costs more each time, but not much more: the run should
// be levelling every ~25 seconds late on, because the cards are the
// pacing and a run that stops drafting stops being a run.
const xpFor = lvl => Math.round(16 * Math.pow(lvl, 1.28) + 8);

// THE TIDE'S CLOCK.
//
// The density comes from the SHEET, not from the spawn rate. A walker
// takes the better part of a minute to cross thirty-six units of ice,
// so two and a half spawns a second already leaves a hundred and
// twenty of them out there — and nothing ever has to arrive in a
// rush, which is the thing that would make the game about reflexes
// instead of about placement.
// A WAVE IS THREE OR FOUR FORMATIONS AND THEN A BOSS, and then it all
// happens again with tougher, faster enemies. Everything below is keyed
// to the WAVE NUMBER rather than to the clock, because that is the unit
// the player actually experiences — "I am on wave five" is a thing you
// know, "I am at two minutes forty" is not.
const waveForms = w => 5 + (w % 3);          // 5, 6, 7, 5, 6, 7 …

/** who walks on, by wave. A kind arrives one wave at a time so each
 *  one gets an entrance, and ramps to full weight over the two waves
 *  after it — the first spitter should be a thing that happened, not a
 *  third of the lane. */
const MIX = [
  { k: 'mote',     from: 1, early: 58, late: 20 },
  { k: 'walker',   from: 1, early: 42, late: 34 },
  { k: 'runner',   from: 2, early: 22, late: 24 },
  { k: 'spitter',  from: 3, early: 16, late: 20 },
  { k: 'splitter', from: 4, early: 14, late: 16 },
  { k: 'bomber',   from: 5, early: 13, late: 17 },
  { k: 'carapace', from: 6, early: 16, late: 24 },
  { k: 'mender',   from: 7, early: 8,  late: 13 },
  { k: 'brood',    from: 8, early: 7,  late: 11 },
  { k: 'herald',   from: 9, early: 6,  late: 10 },
];

/**
 * THE TIDE ARRIVES IN LUMPS WITH GAPS BETWEEN THEM, not as a hose.
 *
 * `gap` is the quiet between formations, `size` is how many walk on in
 * each. Both matter and the QUIET matters more: it is the only time the
 * player gets to look at the board, decide what is uncovered and place
 * a throw on purpose rather than at whatever is nearest.
 *
 * The space between two formations is `gap × speed`. This note used to
 * claim that space was "about the depth of a formation itself" and
 * call that the ratio to keep — it was neither true (a block of 19 is
 * 6×3, which is 1.6 units against a 5-unit gap) nor the right thing to
 * hold. `ON_ICE` is. See `gap` below.
 */
// TOUGHNESS IS THE WAVE, SPEED IS THE LEVEL — two clocks, on purpose.
//
// Both used to hang off the wave number, and a wave is three or four
// levels long: the tide walked at *exactly* the same speed for minutes
// at a time, so an escalation that was real on paper was invisible in
// the hand. The level is the finer clock and it is the one already
// ticking in the corner of the HUD, so every draft now visibly costs
// you something — you come out of it stronger and so does the sheet.
//
// 5.5% a level, and it compounds with nothing: at the level a run is
// usually on when the fourth boss walks (about 10) the tide is half
// again as fast as it started, where the old wave curve had it at 1.3.
const paceOf = lv => 1 + (lv - 1) * .055;
const PARADE = .42;                       // the base walk, before tempo

// THE TEMPO. ONE multiplier over every walking speed in the game — the
// parade, the brutes, the boss — so the whole sheet speeds up without
// any kind's pace changing relative to any other's. This is the knob
// to turn when the game feels SLOW rather than easy, and they are not
// the same complaint: difficulty is the refill and the hit points,
// tempo is how much happens a second.
//
// At 1 a walker took 86 seconds to cross the sheet — the file next
// door claimed "the better part of a minute" and had been wrong about
// it for a long time. 1.5 made that sentence true at 57 seconds and it
// still read slow, so: 1.8, and a walker crosses in 48. The ceiling is
// not the tide, it is the RAIL — blocks may not arrive faster than the
// one in front can clear the walk-on line — and at wave eight that is
// still a 6.8-second gap against a 2.1-second transit, so there is
// room above this if it is still not enough.
const TEMPO = 1.8;

// HOW MANY ARE ON THE SHEET, steady state, at every wave and every
// tempo. See the `gap` note below: this is the invariant, and `size`
// escalates a formation's SHAPE — a bigger question arriving less
// often — rather than the count. "The escalation is toughness, not
// count" is finally true by construction instead of by hoping.
const ON_ICE = 136;

function pressure(w = S.wave, lv = S.level) {
  const mix = [];
  for (const e of MIX) {
    if (w < e.from) continue;
    const age = w - e.from;
    const k = Math.min(1, age / 2);
    mix.push([e.k, e.early + (e.late - e.early) * k]);
  }
  const speed = PARADE * TEMPO * paceOf(lv);
  const size = Math.round(16 + w * 3);      // how many walk on each time
  return {
    // THE GAP IS A DISTANCE, NOT A DURATION, and the distance is set by
    // the one number that actually matters: HOW MANY ARE ON THE SHEET.
    //
    // `population = size × crossing ÷ gap`, and once the gap is a
    // distance the SPEED cancels straight out of that — so `ON_ICE` is
    // an invariant the tempo cannot touch, which is exactly what you
    // want from a tempo knob. In seconds the gap was coupled to both
    // ends and drifted with either: speed the tide up and the same
    // blocks-per-minute spread over more ground until the ice went
    // empty; grow `size` and the count crept up as a side effect of a
    // number that was only ever about a block's shape.
    //
    // (The note above this function claims the gap is "about the depth
    // of a formation itself". It is not and never was — a block of 19
    // is 6×3, which is 1.6 units deep against a 5-unit gap. Tying the
    // gap to the measured depth was tried and gives 4.4-second gaps
    // and 250 on the ice. The prose was a guess; this is the number.)
    gap: size * (FIELD.line - FIELD.far) / ON_ICE / speed,
    size,
    // AND THE ESCALATION IS TOUGHNESS AND PACE, NOT COUNT. The sheet is
    // nine units wide, so it can physically carry about five arrivals a
    // second before the walk-on line jams — measured: at three and a
    // half a second the whole tide silted into one solid mass at the
    // far end and the rest of the ice was empty.
    hp: 1.3 + (w - 1) * .75,
    // ONE multiplier for the big kinds, so the roster keeps its
    // relative pace — a runner is always about twice a walker.
    pace: TEMPO * paceOf(lv),
    // THE WAVE'S ONE SPEED — see the parade note in mfoes.js. Every
    // small kind in the wave walks at exactly this, and so does a boss
    // that has not reached the frame yet.
    speed,
    mix,
  };
}

const pickMix = mix => {
  let total = 0;
  for (const p of mix) total += p[1];
  let r = Math.random() * total;
  for (const p of mix) if ((r -= p[1]) < 0) return p[0];
  return 'walker';
};

// =================================================================
// BOOT
// =================================================================
const stage = document.getElementById('stage');
const table = createTable(stage);
const { scene, camera, renderer } = table;

// A DOZEN CHARACTERS AT SIXTY PIXELS EACH, not one at four hundred. At
// the lab's resolution a marble was 250k vertices and 28ms to build —
// half a frame, for detail that lands between two pixels. See
// `setGlossDetail` in gshape.js for what this actually turns.
setGlossDetail(.42);

const glossEnv = studioEnv(renderer);
const materialFor = makeMaterialFactory(glossEnv);
// the ice wears a clearcoat, and a clearcoat with nothing to reflect
// is a matte plane — so the studio that lights the characters lights
// the rink too
table.setEnvironment(glossEnv);
const fx = createFX(scene, camera, renderer);
const tide = createTide(scene, { onLeak, onKill, onFoeShot, onFoeBlast, onHeal });
const combat = createCombat(scene, { tide, fx, snd: toybox, mods: null, hurtMarble: hitMarble });

const play = new THREE.Group();
scene.add(play);

// The arena handed to everything that needs to reach the game: the
// same shape of contract `F` is to a drawn part. A kind, the physics
// and the weapons all speak through this and nothing else.
const W = {
  t: 0, dt: 1 / 60, tide, combat, fx, snd: toybox, field: FIELD,
  marbles: [], mods: newMods(),
  // one mods object PER KIND — a card is aimed at one marble type, and
  // every marble of that type shares its kind's object by reference
  kmods: Object.fromEntries(KIND_IDS.map(id => [id, newKindMods()])),
  pan: x => Math.max(-.85, Math.min(.85, x / 6.5)),
  onPlant, onClack, onRail, onCrush, onBruteHit,
};

// =================================================================
// CHARACTERS — the one place this file touches the gloss rig.
// =================================================================
/**
 * a marble's body, normalised so the DRAWING matches the CIRCLE the
 * physics uses. Fitted on `L.H` — the body's own height — and not on
 * the bounds, exactly as the contact sheet does it: a pair of horns
 * should overhang its collision circle, not shrink the head to fit
 * inside it.
 */
function buildCharacter(kindId, opts = {}) {
  const K = KINDS[kindId];
  const recipe = newGRecipe();
  Object.assign(recipe, K.recipe);
  ensureGParams(recipe);
  const built = buildGloss(recipe, { materialFor });
  const radius = opts.radius ?? K.radius;
  const scale = 2 * radius / built.L.H;

  const holder = new THREE.Group();
  const scaler = new THREE.Group();
  scaler.scale.setScalar(scale);
  // a marble ROLLS, so its drawing has to be centred on the circle it
  // rolls about; a brute stands on the floor like everything else the
  // tide is made of
  built.group.position.y = opts.stand ? 0 : -built.L.cy;
  scaler.add(built.group);
  holder.add(scaler);
  return { kind: kindId, built, holder, scaler, scale, radius,
           life: createGlossFace(built, { gaze: true }) };
}

function disposeCharacter(ch) {
  ch.holder.parent?.remove(ch.holder);
  ch.built.group.traverse(o => o.geometry?.dispose());
}

// ---- brutes wear real characters --------------------------------------
// Three of them, built once and re-worn. A brute is on screen for
// twenty seconds and there are never more than three, so this is the
// one place the tide can afford a molded body — and it is the place
// that most wants one, because a brute is a thing you aim AT.
// FIVE, and the spawner is capped to the same number. There were three
// against a surge that deals up to four every thirty seconds, on an
// enemy that takes a hundred seconds to walk the sheet — so from the
// third wave on, the overflow silently fell back to a walker blob
// scaled three times, with no health ring, for the one enemy the whole
// game says you should be aiming at.
const BRUTE_RIGS = 5;
{
  const ringGeo = new THREE.RingGeometry(.86, 1.02, 24);

  /** a big body for the tide to wear. `pin` is the recipe's identity;
   *  everything else still rolls, so no two brutes are the same brute. */
  const bigRig = (pin, wantHorns, radius) => {
    let recipe;
    // ROLL UNTIL IT HAS HORNS. A boss is read from across the sheet at
    // about forty pixels, where colour is mush and the only thing that
    // survives is the SILHOUETTE — and a boss that comes up hornless is
    // a big smooth ball, which reads as "large" and not as "dangerous".
    // The cast gives the monster horns about two thirds of the time, so
    // this is one or two extra rolls of pure arithmetic: `ensureGParams`
    // builds no geometry.
    for (let n = 0; n < 14; n++) {
      recipe = newGRecipe();
      Object.assign(recipe, pin);
      ensureGParams(recipe);
      if (!wantHorns || recipe.parts.crest?.params?.style === 'horns') break;
    }
    const built = buildGloss(recipe, { materialFor });
    const holder = new THREE.Group();
    const scaler = new THREE.Group();
    scaler.scale.setScalar(2 * radius / built.L.H);
    built.group.position.y = 0;
    scaler.add(built.group);
    holder.add(scaler);
    // the only health readout on the ice — a brute is the one thing
    // that is on screen long enough to have a state worth showing
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: '#E85A3C', transparent: true, opacity: .9,
      depthWrite: false, toneMapped: false,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .02;
    holder.add(ring);
    holder.visible = false;
    scene.add(holder);
    return { group: holder, built, ring, baseScale: 1, busy: false, hp: 1,
             life: createGlossFace(built, { gaze: true }) };
  };

  for (let i = 0; i < BRUTE_RIGS; i++)
    tide.registerBrute(bigRig({
      species: 'monster', body: i % 2 ? 'rock' : 'cube', stance: 'none',
      palette: 'orchard', colorIx: 0, material: i % 3 === 2 ? 'flocked' : 'wood',
    }, false, FOE_KINDS.brute.r));

  // TWO BOSSES, and they are their own thing rather than a brute at
  // 158%: crazed ceramic over a bruised violet, horns guaranteed, and
  // half again the size of the biggest thing that has ever walked on
  // before them.
  for (let i = 0; i < 2; i++) {
    const rig = bigRig({
      species: 'monster', body: i ? 'rock' : 'cube', stance: 'none',
      palette: 'dusk', colorIx: 1, material: 'crazed',
    }, true, FOE_KINDS.brute.r);
    rig.boss = true;
    rig.ring.material.color.set('#FF8A5A');
    tide.registerBrute(rig);
  }
}

// =================================================================
// THE RUN
// =================================================================
const S = {
  phase: 'menu',                 // menu | play | draft | over
  t: 0, lives: LIVES, kills: 0, leaked: 0, score: 0,
  level: 1, xp: 0, xpNeed: xpFor(1),
  wave: 1, stage: 'forms', formsLeft: 3, theme: null,
  bossAt: -1, bossName: '', bossSeen: false, surgeName: '', surgeUntil: 0,
  formT: 2,                      // seconds until the next formation walks on
  // seconds since anything crossed. A run with no way back is a run
  // that is over the moment it starts going wrong, and the player
  // cannot see that it has — so holding the line clean pays a life
  // back, which makes stabilising a thing you can SEE happen.
  sinceLeak: 0,
  bag: newBag(),
  taken: {},
  hand: [],                      // { ch, kind, ready, timer }
  sel: 1,
  chain: 0, chainBest: 0, chainPts: 0, chainLive: false,
  chainX: 0, chainZ: 0,
  hitstop: 0,
  // BULLET TIME. Separate from `hitstop`, which is two frames of
  // near-freeze on one impact: this is a longer, gentler dilation that
  // deepens with every link, so a five-marble cascade plays out at a
  // third speed and you get to WATCH it happen instead of hearing that
  // it did.
  chainSlow: 0,
  buildQueue: [],
  refillT: 0,                    // THE one recharge clock — see the loop
};

function newHand() {
  for (const h of S.hand) if (h.ch) disposeCharacter(h.ch);
  S.hand = [];
  for (let i = 0; i < W.mods.hand; i++) S.hand.push({ i, ch: null, ready: false });
  // THE FULL HAND IS STANDING THERE AT FRAME ONE. It was ONE marble for
  // a while, on the argument that the first thing the game teaches
  // should be the thing it charges for all run — but the price of a
  // throw is the REFILL, and the refill teaches itself the moment you
  // spend. What one-to-start actually taught was that the opening is a
  // wait: empty ice, nothing to decide, two slots ticking. Three in the
  // hand means the run opens on a CHOICE — where do these three go —
  // and the long clock arrives immediately afterwards, which is where
  // it means something.
  S.buildQueue = S.hand.map(h => h.i);
}

/** a slot's character is built off-frame on a time budget — a molded
 *  character is a few milliseconds and three at once inside one frame is a
 *  visible hitch at exactly the moment the player is watching a shot
 *  land. */
function serveQueue(budgetMs) {
  const until = performance.now() + budgetMs;
  while (S.buildQueue.length && performance.now() < until) {
    const i = S.buildQueue.shift();
    const h = S.hand[i];
    if (!h) continue;
    const kind = drawKind(S.bag);
    h.ch = buildCharacter(kind);
    h.kind = kind;
    h.ready = true;
    h.timer = 0;
    h.ch.holder.position.set(benchX(i), KINDS[kind].radius, FIELD.hand);
    play.add(h.ch.holder);
    if (S.phase !== 'menu') toybox.sfx('draw', { pan: W.pan(benchX(i)), vol: .5 });
  }
}

function selectedSlot() {
  const h = S.hand[S.sel];
  if (h && h.ready) return h;
  return S.hand.find(s => s.ready) ?? null;
}

// =================================================================
// THE THROW
// =================================================================
const aim = { on: false, dx: 0, dz: -1, power: 0, fromSlot: -1, ox: 0, oy: 0 };
const previewBuf = [];
const accent = new THREE.Color();

function throwMarble(slot, dx, dz, power) {
  const K = KINDS[slot.kind];
  const m = makeMarble(slot.kind, K, W.kmods[slot.kind]);
  m.ch = slot.ch;
  m.x = benchX(slot.i);
  m.z = FIELD.hand;
  const speed = power * PHYS.maxSpeed * W.mods.power;
  m.vx = dx * speed; m.vz = dz * speed;
  m.moving = true;
  m.plough = 0;
  m.lastTrailX = m.x; m.lastTrailZ = m.z;
  W.marbles.push(m);

  // EVERY MARBLE ON THE TABLE IS RE-ARMED BY A THROW. A burst is a
  // thing you set off, not a thing that recharges on a clock, so the
  // question the player is always asking — "what do I want to hit?" —
  // is answered by the board and never by a cooldown.
  // EVERY MARBLE IS RE-ARMED AND RE-GRIPPED BY A THROW. The re-arming
  // is the design; the re-gripping is a bug fix. Spike's burst multiplies
  // its own `grip` by .45 and trusted `onPlant` to put it back — but a
  // graze can set off a burst without ever setting `moving`, so the
  // marble never re-plants and never restores. Measured, four grazes
  // took a spike to 4% of its friction: twenty-four times the slide.
  for (const o of W.marbles) {
    if (o === m) continue;
    o.burstReady = true;
    if (!o.moving) o.grip = KINDS[o.kind].friction * (1 - o.mods.slide);
  }
  S.chain = 0; S.chainPts = 0; S.chainLive = true;

  slot.ch = null; slot.ready = false;
  toybox.sfx('throw', { pan: W.pan(m.x), vol: .5 + power * .5, rate: 1.1 - power * .25 });
  fx.puff(m.x, m.z, '#E8DFC9', 6);
}

// =================================================================
// CALLBACKS FROM THE SOLVER
// =================================================================
function onPlant(m) {
  m.plough = 0;
  m.grip = KINDS[m.kind].friction * (1 - m.mods.slide);   // spike's saw wears off
  toybox.sfx('plant', { pan: W.pan(m.x), vol: .55 });
  fx.puff(m.x, m.z, '#DCD2BB', 8);
  fx.ring(m.x, m.z, KINDS[m.kind].range, KINDS[m.kind].accent, { life: .7, width: .12 });
  KINDS[m.kind].onPlant?.(m, W);
}

// A GRAZE IS NOT A STRIKE. Below this, a contact is a nudge: it makes
// a small noise and moves the marble a little, and that is all.
const BURST_FORCE = .06;

function onClack(a, b, force, x, z, nx, nz) {
  // BOTH MARBLES FIRE ON A HIT — one collision, one chain link, two
  // bursts. Only the struck one used to go off, and the player's model
  // ("I smash these two together, they both do their thing") is simply
  // better than the cue-ball rule it replaced.
  //
  // And a burst NEVER AIMS AT YOUR OWN LINE: the collision normal is
  // wherever the geometry says, and half the time that is down-sheet —
  // a Popper cone firing backwards at the player reads as a bug even
  // when the vector is honest. There are no enemies behind you; the
  // lateral component keeps the aim, the down-sheet component flips.
  let dirX = nx, dirZ = nz;
  if (dirZ > 0) dirZ = -dirZ;
  const len = Math.hypot(dirX, dirZ) || 1;
  dirX /= len; dirZ /= len;

  if (force < BURST_FORCE) {
    toybox.sfx('clack', { pan: W.pan(x), vol: .18 + force * .22, rate: .82 });
    fx.hit(x, z, b.x - a.x, b.z - a.z, force * .35, '#C8D4DC');
    return;
  }

  const n = S.chain + 1;
  const chainMul = Math.pow(1.45 + W.mods.chain, n - 1);
  const fa = fireBurst(a, chainMul, dirX, dirZ);
  const fb = fireBurst(b, chainMul, dirX, dirZ);

  if (!fa && !fb) {
    // both already spent this throw — a dud, and it must not sound like
    // a link: full impact feedback for a dud is the loudest possible
    // lie about the board
    toybox.sfx('clack', { pan: W.pan(x), vol: .2 + force * .25, rate: .82 });
    fx.hit(x, z, b.x - a.x, b.z - a.z, force * .4, '#C8D4DC');
    return;
  }

  // ---- the link's juice, once per collision ----
  S.chain = n;
  S.chainBest = Math.max(S.chainBest, n);
  S.chainSlow = Math.max(S.chainSlow, .12 + Math.min(.55, n * .1));
  S.hitstop = Math.max(S.hitstop, .02 + Math.min(.12, n * .02));
  fx.shake(.12 + Math.min(.7, n * .13));
  fx.hit(x, z, b.x - a.x, b.z - a.z, force, '#FFF3D8');
  if (n >= 3) fx.blast(x, z, 1.2 + n * .3, '#FFE9A8');
  if (n >= 5) {
    fx.nova(x, z, 3 + n * .4, '#FFE9A8');
    table.lineMesh.material.color.setRGB(2.2, 1.8, 1);
    setTimeout(() => table.lineMesh.material.color.setRGB(1, 1, 1), 160);
  }
  toybox.sfx('clack', { pan: W.pan(x), vol: .35 + force * .65, rate: 1 });
  toybox.sfx('chain', {
    pan: W.pan(x), vol: .6 + Math.min(.5, n * .09),
    // up the pentatonic rather than by semitones: a chain is a PHRASE,
    // and a phrase in the key the whole game is written in
    rate: Math.pow(2, Math.min(11, n - 1) * 2 / 12),
  });
  if (n >= 3) toybox.sfx('slam', { pan: W.pan(x), vol: .35 + Math.min(.5, n * .08),
                                   rate: 1.15 - Math.min(.4, n * .05) });
  S.chainX = x; S.chainZ = z;
  S.chainPts += 40 * n;
  if (n > 1) {
    fx.text(x, z, `×${n}`, n > 3 ? '#FFD54A' : '#FFF0C0');
    showCombo(n);
  }
}

/** one marble's burst, silently — the link's shared spectacle lives in
 *  `onClack`. Returns whether it actually went off. */
function fireBurst(m, chainMul, nx, nz) {
  if (!m.burstReady || !m.alive) return false;
  m.burstReady = false;
  const mul = Math.min(9, m.mods.burst * chainMul);
  KINDS[m.kind].burst(m, W, mul, nx, nz);
  fx.ring(m.x, m.z, KINDS[m.kind].range * (1 + S.chain * .18), KINDS[m.kind].accent,
          { life: .4 + S.chain * .03, width: .3 });
  m.faceUntil = S.t + .9;
  m.ch?.life.setFace('happy');
  return true;
}

function finishChain() {
  const n = S.chain, pts = S.chainPts;
  S.chain = 0; S.chainPts = 0; S.chainLive = false;
  hideCombo();
  if (n < 2) return;
  S.score += pts;
  fx.blast(S.chainX, S.chainZ, 1.6 + n * .3, '#FFD54A');
  fx.ring(S.chainX, S.chainZ, 2.5 + n * .5, '#FFD54A', { life: .6, width: .5 });
  fx.text(S.chainX, S.chainZ + 1.2, `CHAIN ×${n}  +${pts}`, '#FFD54A');
  fx.shake(.35 + Math.min(.5, n * .08));
  toybox.sfx('take', { vol: 1, rate: 1 + Math.min(.4, n * .05) });
  // a deep chain gets the fanfare — the arpeggio the level-up plays,
  // pitched by depth, which ties the two best moments in the game to
  // the same musical gesture
  if (n >= 4) toybox.sfx('level', { vol: .9, rate: 1 + Math.min(.5, (n - 4) * .08) });
}

function onRail(m, nx, nz, force) {
  toybox.sfx('wall', { pan: W.pan(m.x), vol: .3 + force * .4, cool: .04 });
  fx.hit(m.x, m.z, nx, nz, force * .7, '#8FC0E0');
  fx.shake(force * .1);
}

function onCrush(m, i) {
  // no hit points are consulted: a marble went over it, so it is gone
  const x = tide.x[i], z = tide.z[i];
  tide.kill(i);
  fx.pop(x, z, '#5C5060', 5);

  // THE PLOUGH IS A RUN OF NOTES, NOT A STUTTER. Each body a marble
  // goes over is a crush, and consecutive ones climb — a couple of
  // semitones over a full lane — with a low MOW swelling under every
  // fourth. Twenty identical squashes in a second fuse into gravel and
  // the biggest thing a throw does goes unheard; a rising run of them
  // is the sound of getting away with something.
  m.plough = (m.plough || 0) + 1;
  const rung = Math.min(14, m.plough);
  toybox.sfx('crush', {
    pan: W.pan(x), vol: .5 + rung * .022,
    rate: (.9 + Math.random() * .16) * Math.pow(2, rung / 26),
  });
  if (m.plough % 4 === 1) {
    const sp = Math.hypot(m.vx, m.vz);
    toybox.sfx('mow', { pan: W.pan(x), vol: Math.min(1, .35 + sp / 40),
                        rate: .9 + Math.random() * .2 });
  }

  // the wake. A marble going through a crowd should leave the ice
  // looking disturbed behind it, and this is the only thing in the game
  // that says the plough is a physical event rather than a damage query.
  const sp = Math.hypot(m.vx, m.vz);
  if (sp > 3) fx.plow(m.x, m.z, m.vx / sp, m.vz / sp, Math.min(1, sp / PHYS.maxSpeed));
}

function onBruteHit(m, i, dmg, force) {
  tide.hurt(i, dmg, { stun: .35 });
  toybox.sfx('bounce', { pan: W.pan(m.x), vol: .5 + force * .5 });
  fx.hit(m.x, m.z, m.x - tide.x[i], m.z - tide.z[i], force, '#FFC98A');
  fx.shake(.15 + force * .35);
  S.hitstop = Math.max(S.hitstop, .03 + force * .06);
  fx.text(tide.x[i], tide.z[i], `${Math.round(dmg)}`, '#FFD8A0', { small: true });
}

/** an enemy stealing SECONDS — the only way the tide can touch a
 *  marble at all, and only the two thief kinds ever call it. The stolen
 *  time is said out loud on the ice, because a clock shrinking quietly
 *  is the disappearing-marble bug wearing a new hat. */
function hitMarble(m, secs, foeIndex) {
  if (!m.alive) return;
  m.life -= secs;
  m.hurtT = .12;
  toybox.sfx('hurt', { pan: W.pan(m.x), vol: .35, cool: .15 });
  fx.text(m.x, m.z + .6, `-${Math.round(secs)}s`, '#8FDFFF', { small: true });
  if (m.life <= 0 && !m.moving) meltAway(m);
}

/** it ran out. NOT the same event as being eaten: a marble that melts
 *  did its job and went, so it goes quietly — a puff, a soft note, no
 *  shake and no shrapnel. Reading the two the same way would teach the
 *  player that the tide is killing marbles it never touched. */
function meltAway(m) {
  if (!m.alive) return;
  m.alive = false;
  // LAST WORD: the gilded card that turns every death into a parting
  // shot. It fires down-sheet — a melting marble has no striker to
  // aim it, and down-sheet is where the enemies are.
  if (W.mods.deathBurst) KINDS[m.kind].burst(m, W, 1.3, 0, -1);
  toybox.sfx('melt', { pan: W.pan(m.x), vol: .8, rate: .7 });
  fx.puff(m.x, m.z, '#DCEAF2', 16);
  fx.nova(m.x, m.z, m.r * 3, '#CFE6F2');
  fx.ring(m.x, m.z, m.r * 2.6, '#BFD8E8', { life: .6 });
  if (m.ch) disposeCharacter(m.ch);
  dropSaw(m);
  dropBar(m);
}

function killMarble(m) {
  if (!m.alive) return;
  m.alive = false;
  toybox.sfx('break', { pan: W.pan(m.x), vol: .9 });
  fx.blast(m.x, m.z, 1.4, KINDS[m.kind].accent);
  fx.pop(m.x, m.z, KINDS[m.kind].accent, 16);
  fx.shake(.4);
  if (m.ch) disposeCharacter(m.ch);
  dropSaw(m);
  dropBar(m);
}

/** NOTHING LEAVES THE ARRAY MID-FRAME. A marble dying used to splice
 *  itself out on the spot, which broke three things at once: a
 *  `for…of` over the marbles skipped the one after any casualty (so a
 *  bomber that killed one marble did nothing to the next), the tide's
 *  per-marble chew counters pointed at the wrong marbles for the rest
 *  of the step, and any index taken before the splice was stale. Dying
 *  sets a flag; the array is compacted once, here, between frames. */
function reapMarbles() {
  for (let i = W.marbles.length - 1; i >= 0; i--)
    if (!W.marbles[i].alive) W.marbles.splice(i, 1);
}

// =================================================================
// THE TIDE'S SIDE
// =================================================================
function onKill(x, z, kindName) {
  S.kills++;
  S.score += FOE_KINDS[kindName].bounty * 10;
  S.xp += FOE_KINDS[kindName].bounty;
  if (kindName === 'brute') {
    fx.blast(x, z, 2.2, '#C8A0FF');
    fx.shake(.5);
    toybox.sfx('break', { pan: W.pan(x), vol: 1, rate: .7 });
  }
  if (S.xp >= S.xpNeed && S.phase === 'play') levelUp();
}

/** a spitter fires. The tide shooting back is the reason a marble
 *  planted short of one is a marble being whittled away. */
function onFoeShot(x, z, marble, dmg) {
  combat.foeShot(x, z, marble, dmg);
}

/** a bomber reaches a marble and goes off. It is the one enemy that
 *  can take half a marble's life in one event, so it is drawn and
 *  heard as the biggest thing the tide does. */
/** a bomber goes off: SECONDS drained, falling off with distance. */
function onFoeBlast(x, z, r, secs) {
  fx.blast(x, z, r, '#FF7A48');
  fx.shake(.34);
  toybox.sfx('boom', { pan: W.pan(x), vol: .85, rate: 1.15 });
  for (let i = W.marbles.length - 1; i >= 0; i--) {
    const m = W.marbles[i];
    if (!m.alive) continue;
    const d = Math.hypot(m.x - x, m.z - z);
    if (d > r) continue;
    hitMarble(m, secs * (1 - .45 * (d / r)), -1);
  }
}

function onHeal(x, z, r) {
  fx.ring(x, z, r, '#7FE0A8', { life: .5, width: .1 });
  toybox.sfx('frost', { pan: W.pan(x), vol: .22, rate: 1.5, cool: .5 });
}

function onLeak(kindName, x = 0) {
  S.leaked++;
  S.lives--;
  S.sinceLeak = 0;
  toybox.sfx('leak', { pan: W.pan(x), vol: .9 });
  fx.shake(.28);
  // WHERE it came through, not just that it did. The punishment for a
  // gap arrives fifty seconds and thirty units away from the throw that
  // failed to cover it, so the one thing the game owes the player is
  // the lane.
  fx.ring(x, FIELD.line, 1.1, '#FF4A2A', { life: .7, width: .3 });
  fx.text(x, FIELD.line, 'LEAK', '#FF6A48', { small: true });
  flashLine();
  el.lives.classList.add('hit');
  setTimeout(() => el.lives.classList.remove('hit'), 260);
  if (S.lives <= 0 && S.phase === 'play') gameOver();
}

// =================================================================
// THE DIRECTOR
// =================================================================
function director(dt) {
  const P = pressure();

  // THE BOSS'S WHOLE LIFE, CHECKED IN EVERY STAGE. It is spawned
  // during `forms`, it walks through `lull`, and it can die in either —
  // the death check used to live inside the boss branch alone, which
  // was safe only while the boss could not exist before that branch
  // owned it. It can now, and a boss killed on the approach would have
  // left the lull waiting for a sighting that was never coming.
  if (S.bossAt >= 0) {
    if (!tide.alive[S.bossAt]) { endWave(); return; }
    // THE BANNER IS THE SIGHTING, NOT THE SPAWN. The boss walks on at
    // the rail with the wave's last formation and takes the better part
    // of a minute to come down the sheet, so firing the fanfare when it
    // is created would announce a thing nobody can see yet. It goes off
    // when the boss crosses into the framed section — the moment it
    // stops being a shape in the haze. Its name and health bar are up
    // on the HUD from the spawn, so the approach is not a secret; it is
    // a countdown.
    if (!S.bossSeen && tide.z[S.bossAt] >= FIELD.view) {
      S.bossSeen = true;
      banner(S.bossName, '#FF8A5A');
      toybox.sfx('wave', { vol: 1, rate: .72 });
      fx.shake(.25);
    }
  }

  if (S.stage === 'forms') {
    S.formT -= dt;
    if (S.formT <= 0 && tide.room > P.size + 10) {
      // the gap is JITTERED. On an exact metronome the player stops
      // reading the ice and starts counting, and a tide you can count
      // is a tide you have stopped looking at.
      S.formT = P.gap * (.85 + Math.random() * .3);
      // the LAST formation of a wave is the themed one, so a wave ends
      // on its hardest question and then on its boss
      const themed = S.formsLeft === 1 ? S.theme : null;
      spawnFormation(P, themed
        ? { kind: themed.kind, march: themed.march,
            size: Math.round(themed.n * (1 + S.wave * .06)) }
        : {});
      if (themed) banner(themed.name, '#FFC98A');
      // THE BOSS WALKS ON WITH THE THEME FORMATION — the wave's last
      // block and the thing behind it, entering together at the rail.
      // It used to be created at the END of the lull, six units inside
      // the walk-on line, and then run at 2.8×; the walk now happens
      // WHILE the player fights the block it came in with, which is
      // why a minute of approach costs no dead time at all.
      if (--S.formsLeft <= 0) { spawnBoss(P); S.stage = 'lull'; }
    }
    return;
  }

  // THE LULL IS THE APPROACH, AND IT ENDS ON THE SIGHTING — not on a
  // clock. Nothing new walks on while the boss is coming down the
  // sheet: the player has the theme formation to grind and a thing
  // growing in the haze to read the board against, which is exactly
  // the deliberate minute this game is always short of. Run on a
  // timer instead, the thin formations started a full half-minute
  // before the boss arrived and quietly added two blocks to every
  // wave — an escalation nobody asked for, hidden inside a change
  // about where the boss walks on.
  if (S.stage === 'lull') {
    if (S.bossSeen) { S.stage = 'boss'; S.formT = P.gap * 1.4; }
    return;
  }

  // --- the boss holds the wave open. Formations keep coming, thinner:
  // a boss alone on empty ice is a damage race with no board in it.
  S.formT -= dt;
  if (S.formT <= 0 && tide.room > 24) {
    // measured: at a gap and a half and half the size, the boss stage
    // ran forty seconds with one other enemy on the ice — a damage race
    // with no board in it, which is exactly what the tide is there to
    // prevent
    S.formT = P.gap * 1.05;
    spawnFormation(P, { size: Math.round(P.size * .7) });
  }
}

/** the banner that names what is arriving. */
function banner(text, color = '#FFD27A') {
  S.surgeName = text;
  S.surgeUntil = S.t + 3;
  fx.text(0, FIELD.view + 2, text, color);
}

// ---------------------------------------------------------------
// THE BOSS. One per wave, it closes the wave, and its movement is
// ROLLED rather than chosen from a shelf: a pattern, an amplitude, a
// phase and a direction, so the boss you get on wave four does not
// move like the one on wave three. That is most of what makes a big
// slow thing feel like an opponent instead of a milestone.
// ---------------------------------------------------------------
const BOSS_FIRST = ['THE', 'OLD', 'BIG', 'GRAND', 'DEEP', 'LAST'];
const BOSS_SECOND = ['GLASS', 'HOLLOW', 'RUST', 'WINTER', 'PAPER', 'IRON',
                     'VELVET', 'SUGAR', 'CINDER', 'SALT'];
const BOSS_THIRD = ['MOTHER', 'TUTOR', 'MONITOR', 'PREFECT', 'MATRON',
                    'JANITOR', 'HEAD', 'NURSE', 'BELL'];
const pick = a => a[(Math.random() * a.length) | 0];

function rollBossMarch() {
  const style = ['weave', 'charge', 'sidle', 'stalk'][(Math.random() * 4) | 0];
  const phase = Math.random() * 6.283;
  const dir = Math.random() < .5 ? -1 : 1;
  if (style === 'weave')  return { march: 1, phase, amp: 1.4 + Math.random() * 1.1 };
  if (style === 'charge') return { march: 2, phase, amp: .9 + Math.random() * .9 };
  if (style === 'sidle')  return { march: 0, vx: dir * (.3 + Math.random() * .3) };
  return { march: 2, phase, amp: 1.8 + Math.random() * .9, vx: dir * .12 };
}

function spawnBoss(P) {
  const m = rollBossMarch();
  // AT THE WALK-ON LINE, LIKE EVERYTHING ELSE, AND IN STEP WITH THE
  // PARADE. It was spawned at `FIELD.far + 6` — six units INSIDE the
  // line every formation enters at, the only thing in the game that
  // did — and then hustled at 2.8×, which is 2.3× the parade speed.
  // So it overtook the procession it exists to close, and it crossed
  // the most foreshortened band on the screen (z −30 to −14.5 is 14%
  // of the screen's height) in nine seconds. The result reads as
  // APPEARING rather than arriving, which is the one thing this game
  // promises never to do.
  //
  // It walks now: on at the rail, at the wave's own step (see the
  // `marchingOn` branch in mfoes.js), lumbering only once it is in
  // frame. The commute that drove it inside in the first place is paid
  // for by moving the SPAWN earlier instead of the speed higher — it
  // comes in with the theme formation, so the approach is spent
  // fighting rather than waiting.
  S.bossAt = tide.spawn('boss', 0, FIELD.far, P.hp, m);
  S.bossName = `${pick(BOSS_FIRST)} ${pick(BOSS_SECOND)} ${pick(BOSS_THIRD)}`;
  S.bossSeen = false;
}

function endWave() {
  S.bossAt = -1;
  toybox.sfx('level', { vol: .9, rate: .8 });
  fx.text(0, 1, `WAVE ${S.wave} CLEARED`, '#8FE0A8');
  beginWave(S.wave + 1);

  // A BOSS PAYS IN MARBLES. The next wave is already set up above —
  // nothing walks on behind a draft, because the director does not run
  // outside `play` — so the pick can sit on top of it.
  const recruits = dealRecruits(S.bag);
  if (recruits.length >= 2) {
    S.phase = 'draft';
    toybox.music({ draft: true });
    fx.shake(.12);
    showDraft(recruits, 'a marble joins you');
    return;
  }
  // …and the LAST one is not a draft. A modal with a single button on
  // it is a pause with a button on it: the final marble simply arrives,
  // named over the ice like every other announcement in the game.
  if (recruits.length === 1) {
    takeBooster(recruits[0]);
    banner(`${KINDS[recruits[0].unlock].label.toUpperCase()} JOINS YOU`, '#FFD27A');
  }
}

/** push the escalation into the tide. ONE place, called from both
 *  clocks — the wave (toughness changes) and the level (speed does). */
function applyPace() {
  const P = pressure();
  tide.setPace(P.pace);
  tide.setParade(P.speed);
}

function beginWave(n) {
  S.wave = n;
  S.stage = 'forms';
  S.formsLeft = waveForms(n);
  // A REAL BREATHER between waves: the boss dies, the banner lands, and
  // there are twelve clear seconds before the next wave's first
  // formation walks on — enough to re-lay the board, which is the only
  // time the player gets to play deliberately instead of reactively.
  S.formT = n === 1 ? 2.5 : 12;
  applyPace();
  const P = pressure(n);
  const pool = themesAvailable(P);
  S.theme = pool.length ? pool[(n - 1) % pool.length] : null;
  if (n > 1) banner(`WAVE ${n}`, '#FFE0A8');
}

// EVERY WAVE HAS A THEME, and the theme is one formation of one kind
// with a name on it. A square of carapaces is a question — "your throws
// cannot answer this" — while a square of one of everything is the
// average of eight questions, which is no question at all. Only kinds
// the run has already met can be a theme: a SHELLS wave before a
// carapace has ever walked on is a kind introduced by its own boss
// fight, which is the wrong order to learn anything in.
const THEMES = [
  { name: 'RUNNERS',  kind: 'runner',   n: 20, march: 'zigzag' },
  { name: 'THE LINE', kind: 'spitter',  n: 12, march: 'straight' },
  { name: 'SPLIT',    kind: 'splitter', n: 15, march: 'zigzag' },
  { name: 'BOMBERS',  kind: 'bomber',   n: 16, march: 'zigzag' },
  { name: 'SHELLS',   kind: 'carapace', n: 16, march: 'straight' },
  { name: 'NURSES',   kind: 'mender',   n: 8,  march: 'straight' },
  { name: 'THE LAYING', kind: 'brood',  n: 9,  march: 'straight' },
  { name: 'THE DRUMS',  kind: 'herald', n: 7,  march: 'zigzag' },
];

function themesAvailable(P) {
  const have = new Set(P.mix.map(e => e[0]));
  return THEMES.filter(t => have.has(t.kind));
}


// ---------------------------------------------------------------
// THE SHAPES. Each returns a list of [dx, dz] offsets in world units:
// where each member stands relative to the point the formation walks
// on at. +dz is toward the player, so a shape's LEADING edge is its
// largest dz.
//
// The spacing is a little over two enemy diameters. Tighter and a block
// reads as one dark mass with no members in it; looser and it stops
// being a formation at all and becomes weather.
// ---------------------------------------------------------------
const SP = .82;

// ONE SHAPE: the rectangle. Six shapes were built — wedge, line, files,
// ring, arrow — and cut back to this on playtest: with everything
// moving at parade speed the extra silhouettes read as disorder, not
// variety, and a formation's job is to be INSTANTLY parseable. An n×m
// block, wider than deep like a marching rank, is parseable from the
// fog. Variety lives in the KIND, the variant, the size and the march.
/** the rectangle a block of `n` rounds to. */
function blockRect(n) {
  const cols = Math.max(3, Math.min(8, Math.round(Math.sqrt(n * 2.2))));
  return { cols, rows: Math.max(1, Math.round(n / cols)) };
}

const SHAPES = {
  block(n) {
    // an EXACT n×m — the requested size is rounded to the nearest full
    // rectangle rather than honoured. A block of fifteen used to end in
    // a half-row of three, and a rectangle with a ragged hem is not a
    // rectangle: the eye finds the straggler before it finds the shape.
    // Ranks wider than files, like a parade block.
    const { cols, rows } = blockRect(n);
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        out.push([(c - (cols - 1) / 2) * SP, -r * SP]);
    return out;
  },
};
const SHAPE_IDS = Object.keys(SHAPES);

// ---------------------------------------------------------------
// THE MARCHES — how a formation moves sideways while it walks. Every
// member gets the SAME rule, which is what keeps the shape rigid. The
// exception is `open`, where the rule is a function of where the member
// stands, which is the point of it.
// ---------------------------------------------------------------
// TWO MARCHES: straight, and one shared zigzag. `drift` and `open`
// existed and left with the extra shapes, for the same reason.
const MARCHES = ['straight', 'zigzag'];

function marchFor(style, dx, phase, dir) {
  if (style === 'zigzag') return { march: 1, phase };
  return { march: 0, vx: 0 };
}

/**
 * one formation walks on. `o` pins whatever the caller cares about —
 * the named surges pin nearly all of it.
 *
 * The kind is SINGLE by default and that is deliberate: a square of
 * carapaces is a question ("your throws cannot answer this"), while a
 * square of one of everything is the average of eight questions, which
 * is no question at all. A quarter of them carry a few of something
 * tougher tucked inside, which is how a mender or a spitter gets to be
 * a thing you have to dig out of a crowd.
 */
function spawnFormation(P, o = {}) {
  const size = Math.max(1, o.size ?? P.size);
  const shape = o.shape ?? SHAPE_IDS[(Math.random() * SHAPE_IDS.length) | 0];
  const style = o.march ?? MARCHES[(Math.random() * MARCHES.length) | 0];
  const kind = o.kind ?? pickMix(P.mix);
  const spots = SHAPES[shape](size);

  let halfSpan = 0, lead = -Infinity;
  for (const sp of spots) {
    halfSpan = Math.max(halfSpan, Math.abs(sp[0]));
    lead = Math.max(lead, sp[1]);
  }
  const room = Math.max(0, FIELD.halfW - halfSpan - .6);
  const cx = o.x ?? (Math.random() * 2 - 1) * room;
  const phase = Math.random() * 6.283;
  const dir = Math.random() < .5 ? -1 : 1;

  // from wave 3 a formation may arrive RECAST: a fifth are swift (fast,
  // weak, small and pale), a fifth heavy (slow, tough, big and dark) —
  // the same kinds asking different questions at different tempos
  const vroll = Math.random();
  const variant = o.variant ?? (S.wave < 3 ? 0 : vroll < .2 ? 1 : vroll < .4 ? 2 : 0);
  // ONE KIND PER FORMATION, no exceptions. A quarter used to carry a
  // few "guests" of something tougher tucked inside, and it blurred
  // the read: a formation is a QUESTION, and a question with a footnote
  // is two questions badly asked.
  for (let i = 0; i < spots.length && tide.room > 3; i++) {
    const [dx, dz] = spots[i];
    // the whole shape is shifted so its LEADING edge sits at the
    // walk-on line: nothing may ever pop into existence on screen —
    // enemies come from the top, out of the fog, or the tide reads as
    // a spawner instead of an army arriving
    tide.spawn(kind,
               Math.max(-FIELD.halfW + .5, Math.min(FIELD.halfW - .5, cx + dx)),
               FIELD.far + dz - lead, P.hp,
               { ...marchFor(style, dx, phase, dir), variant });
  }
  return { shape, style, kind, size, variant };
}

// There is no opening seed any more: the run begins on empty ice and
// the first formation walks out of the fog like every other. It held a
// pre-walked tide for a while ("nothing to aim at for a minute") — but
// enemies materialising down-sheet at frame one is exactly the pop-in
// this game promises never to show, and the empty opening turns out to
// be the tutorial: you watch one formation arrive and you understand
// the whole game.

// =================================================================
// LEVELS AND DRAFTS
// =================================================================
function levelUp() {
  S.xp -= S.xpNeed;
  S.level++;
  S.xpNeed = xpFor(S.level);
  // AND THE TIDE LEVELS WITH YOU. Speed hangs off the level now (see
  // `pressure`), and the only two calls that pushed it into the tide
  // were in `beginWave` — so keyed to the level and applied on the
  // wave, the number would have been right in `pressure` and stale
  // everywhere it mattered. Anything computed from a clock has to be
  // re-applied on that clock's tick, not on a different one's.
  applyPace();
  S.phase = 'draft';
  toybox.sfx('level', { vol: .9 });
  toybox.music({ draft: true });
  fx.shake(.12);
  showDraft(dealBoosters(S.taken, S.level, Math.random, 3,
                         KIND_IDS.filter(k => S.bag[k] > 0)));
}

function takeBooster(b) {
  const key = b.takenKey ?? b.id;
  S.taken[key] = (S.taken[key] || 0) + 1;
  if (b.id !== key) S.taken[b.id] = (S.taken[b.id] || 0) + 1;   // rank stepping
  // a kind-scoped card lands on ITS KIND's mods — and through the
  // shared reference, on every marble of that kind already standing
  b.apply(b.kind ? W.kmods[b.kind] : W.mods);
  if (b.unlock) S.bag[b.unlock] = Math.max(S.bag[b.unlock], 15);
  if (b.id === 'life') S.lives += 4;
  if (b.id === 'hand' && S.hand.length < W.mods.hand) {
    S.hand.push({ i: S.hand.length, ch: null, ready: false });
    S.buildQueue.push(S.hand.length - 1);
  }
  // …and the standing marbles of that kind are settled up on the spot:
  // a time card GIVES the difference, weight and grip recompute
  for (const m of W.marbles) {
    if (b.kind && m.kind !== b.kind) continue;
    const K = KINDS[m.kind], km = W.kmods[m.kind];
    const newMax = K.life * (1 + km.time) + km.timeFlat;
    const gained = newMax - m.maxLife;
    if (gained > 0) { m.maxLife = newMax; m.life += gained; }
    m.mass = K.mass * (1 + km.mass);
    if (!m.moving) m.grip = K.friction * (1 - km.slide);
  }
  hideDraft();
  S.phase = 'play';
  toybox.music({ draft: false });
  toybox.sfx('take', { vol: .9 });
  paintHud();
}

function gameOver() {
  S.phase = 'over';
  toybox.sfx('lose', { vol: 1 });
  toybox.music({ over: true });
  const score = Math.round(S.score);
  const prev = +localStorage.getItem('kg-marbles') || 0;
  const isBest = score > prev;
  localStorage.setItem('kg-marbles', Math.max(score, prev));

  // THE OBITUARY LEADS WITH THE RUN'S BEST FACT — a finale that only
  // says "you lost" wastes the one moment the player is guaranteed to
  // be reading the screen.
  const boast =
    S.chainBest >= 6 ? `a chain of ${S.chainBest} in one throw` :
    S.wave >= 4 ? `${S.wave - 1} boss${S.wave > 2 ? 'es' : ''} put down` :
    S.kills >= 200 ? `${S.kills} crushed under glass` :
    `${S.kills} crushed`;

  // the share text is a LINK the player clicks — the game never posts
  // anything itself. `location.origin` keeps it honest wherever this
  // is hosted.
  const tweet = encodeURIComponent(
    `I held the line for ${S.wave} wave${S.wave === 1 ? '' : 's'} and scored `
    + `${score.toLocaleString('en')} in MARBLES \u{1F9CA} best chain \u00d7${S.chainBest} — `
    + `can you beat me? @albertobeicas\n${location.origin}/marbles`);

  el.over.style.display = 'flex';
  el.over.innerHTML =
    `<div class="big">the line broke</div>`
    + `<div class="sub">on wave ${S.wave} · ${S.bossName ? `under ${S.bossName}` : 'under the tide'}</div>`
    + `<div class="score" id="scoreup">0</div>`
    + (isBest ? `<div class="newbest">NEW BEST</div>`
              : `<div class="sub">best ${Math.max(score, prev).toLocaleString('en')}</div>`)
    + `<div class="tally">`
    +   `<div><b>${S.wave}</b><span>waves</span></div>`
    +   `<div><b>${S.kills}</b><span>crushed</span></div>`
    +   `<div><b>\u00d7${S.chainBest}</b><span>best chain</span></div>`
    +   `<div><b>${S.level}</b><span>level</span></div>`
    + `</div>`
    + `<div class="sub boast">${boast}</div>`
    + `<div class="plea">`
    +   `<p>hey — this game is made by one person. a share and a follow on \u{1D54F} help me a lot ❤︎</p>`
    +   `<a class="share" target="_blank" rel="noopener" `
    +     `href="https://twitter.com/intent/tweet?text=${tweet}">share on \u{1D54F}</a>`
    +   `<a class="follow" target="_blank" rel="noopener" `
    +     `href="https://x.com/albertobeicas">follow @albertobeicas</a>`
    + `</div>`
    + `<div class="overrow">`
    +   `<button class="quiet" id="again">throw again</button>`
    + `</div>`;
  document.getElementById('again').onclick = () => location.reload();

  // the score COUNTS UP — a number that arrives is worth more than a
  // number that is simply there, and the tick riding up the pentatonic
  // is the same trick the chain uses. Driven by the GAME LOOP, not its
  // own requestAnimationFrame: a hidden tab throttles rAF to nothing,
  // which is the same trap every test harness in this file already
  // dodges — a private animation loop dodges nothing.
  S.countUp = { score, isBest, t: 0, lastNote: -1,
                label: document.getElementById('scoreup') };
}

/** the finale's score ticker, advanced by `frame`. */
function tickCountUp(raw) {
  const c = S.countUp;
  if (!c) return;
  c.t += raw;
  const u = Math.min(1, c.t / 1.4);
  const e = 1 - Math.pow(1 - u, 3);
  c.label.textContent = Math.round(c.score * e).toLocaleString('en');
  const note = (u * 8) | 0;
  if (note !== c.lastNote && u < 1) {
    c.lastNote = note;
    toybox.sfx('chain', { vol: .25, rate: Math.pow(2, note * 2 / 12), cool: 0 });
  }
  if (u >= 1) {
    if (c.isBest) toybox.sfx('level', { vol: .9 });
    S.countUp = null;
  }
}

// =================================================================
// PRESENTATION
// =================================================================
const UP = new THREE.Vector3(0, 1, 0);
const axis = new THREE.Vector3();
const qYaw = new THREE.Quaternion();
const qLean = new THREE.Quaternion();
const qTmp = new THREE.Quaternion();

function dressMarbles(t, dt) {
  for (const m of W.marbles) {
    // THE DEAD ARE NOT DRESSED. A marble that melts does so AFTER the
    // reaper has already run this frame, so it is still in the array
    // when dressing happens — and `barFor` was quietly rebuilding a
    // bar for the corpse, which the next frame's reap then orphaned on
    // the ice for ever. That is the trail of stray grey dashes the
    // playtest screenshot showed.
    if (!m.alive || !m.ch) continue;
    const h = m.ch.holder;
    const sp = Math.hypot(m.vx, m.vz);
    h.position.set(m.x, m.r, m.z);

    if (m.moving && sp > .2) {
      // IT SLIDES, IT DOES NOT ROLL. The first version tumbled the
      // marble end over end at v/r, which is what a ball rolling on
      // grass does and is not what anything on ice does — a curling
      // stone slides flat and turns slowly about its own vertical axis,
      // which is where the whole word "curl" comes from. It also puts
      // the face underground twice a second, and the faces are the cast.
      //
      // So: a slow yaw, turning the way the marble hooks, plus a small
      // lean INTO the travel. The lean is the only thing selling the
      // momentum now that nothing is tumbling, and it is deliberately
      // tiny — a stone that banks like a motorbike stops reading as
      // heavy.
      const dir = m.curl >= 0 ? 1 : -1;
      m.spin += dir * (.85 + sp * .055) * dt;
      qYaw.setFromAxisAngle(UP, m.spin);
      axis.set(m.vz, 0, -m.vx).normalize();
      qLean.setFromAxisAngle(axis, -Math.min(.14, sp * .0075));
      h.quaternion.copy(qLean).multiply(qYaw);
      if (m.ch.life.face() !== 'surprised') m.ch.life.setFace('surprised');
      // a ghost every so many centimetres, never every frame — a trail
      // laid per frame is a trail whose density is your frame rate
      const d = Math.hypot(m.x - m.lastTrailX, m.z - m.lastTrailZ);
      if (d > .22) {
        fx.trailPoint(m.x, m.z, m.r * .95, KINDS[m.kind].accent);
        m.lastTrailX = m.x; m.lastTrailZ = m.z;
        if (sp > 6) toybox.sfx('roll', { pan: W.pan(m.x), vol: Math.min(.3, sp / 90), cool: .06 });
      }
    } else {
      // settling: the turn unwinds to face the player again. A stone
      // has no front and may stop anywhere; a marble with a FACE on it
      // has to end up looking at the thing it is about to fight.
      h.quaternion.slerp(qTmp.identity(), Math.min(1, dt * 6));
      m.spin *= Math.max(0, 1 - dt * 6);
      if (m.faceUntil && S.t > m.faceUntil) { m.ch.life.setFace('idle'); m.faceUntil = 0; }
      else if (!m.faceUntil && m.ch.life.face() === 'surprised') m.ch.life.setFace('angry');
    }

    if (m.hurtT > 0) {
      m.hurtT -= dt;
      if (m.ch.life.face() !== 'sad') { m.ch.life.setFace('sad'); m.faceUntil = S.t + .5; }
    }

    // breath, squash, the hurt shiver and the MELT, all on the scaler so
    // the turn above is untouched. The melt is the only readout a
    // marble's life gets, and it does not need another: a marble down
    // to a third of itself is visibly a marble about to go, from across
    // the sheet, with no bar over its head.
    const sq = m.moving ? Math.min(.18, sp / PHYS.maxSpeed * .2) : 0;
    const br = 1 + Math.sin(t * 2.1 + m.x) * .012;
    const shake = m.hurtT > 0 ? Math.sin(t * 70) * .05 : 0;
    // the bar is the whole readout now, and it NEVER BLINKS OUT while
    // the marble lives — it used to vanish the instant a chain knocked
    // the marble sliding, which read as the bar being broken rather
    // than the marble being busy. It rides along, paused (the clock
    // only ticks while planted), and it drains all the way to the
    // floor: the marble and an empty bar leave together.
    {
      const bar = barFor(m);
      const tFrac = Math.max(0, Math.min(1, m.life / m.maxLife));
      // at the marble's feet, standing up to face the lens
      bar.group.position.set(m.x, .16, m.z + m.r + .3);
      bar.group.quaternion.copy(camera.quaternion);
      bar.fill.scale.x = Math.max(.001, tFrac);
      // pure TIME now — red is just the last-quarter warning
      bar.fill.material = tFrac < .25 ? barRedMat : barBlueMat;
      if (!m.moving && m.life < 3) {
        m.rattleT = (m.rattleT ?? 0) - dt;
        if (m.rattleT <= 0) { m.rattleT = .5; fx.puff(m.x, m.z, '#DCEAF2', 2); }
      }
    }
    h.position.y = m.r;
    m.ch.scaler.scale.set(
      m.ch.scale * (1 - sq * .5 + shake),
      m.ch.scale * (1 + sq + br - 1),
      m.ch.scale * (1 - sq * .5));

    // the saw: always visible on a Spike, spinning lazily while it
    // stands guard and furiously while its burst has it sliding
    if (m.kind === 'spike') {
      const saw = sawFor(m);
      saw.position.set(m.x, .02, m.z);
      saw.rotation.z -= dt * (m.moving ? 11 : 2.6);
      const r = KINDS[m.kind].range * (.94 + .06 * Math.sin(t * 3));
      saw.scale.setScalar(r);
    }

    const head = m.ch.life.update(t, dt);
    m.ch.built.head.position.set(head.x, m.ch.built.head.userData.restY + head.y, 0);
    m.ch.built.head.rotation.set(head.pitch, head.yaw, head.rot);
  }
}

function dressBench(t, dt) {
  for (const h of S.hand) {
    if (!h.ch) continue;
    const sel = h === selectedSlot();
    const g = h.ch.holder;
    const bob = Math.sin(t * 2.4 + h.i * 1.7) * .03;
    // THE HAND IS UI, so it is drawn at UI size, not at play size — a
    // marble in your hand is the thing you are choosing between and it
    // sits at the very bottom of a phone, where a 30-pixel bead is not
    // a choice you can make. It shrinks to its true size the moment it
    // is thrown, which also reads as it being launched away from you.
    // …and a little smaller when there are more of them, so a fourth
    // slot is a fuller hand rather than a crowded one
    const room = S.hand.length > 3 ? .84 : 1;
    const want = (sel ? 1.42 : 1.1) * room;
    const s = h.ch.scaler.scale.x / h.ch.scale;
    const k = s + (want - s) * Math.min(1, dt * 9);
    h.ch.scaler.scale.setScalar(h.ch.scale * k);
    // …and it has to be LIFTED by the same factor, or a marble drawn
    // half again as big is a marble buried half its depth in the tray
    g.position.set(benchX(h.i), h.ch.radius * k + bob + (sel ? .1 : 0), FIELD.hand);
    g.rotation.y = Math.sin(t * .7 + h.i) * .18;
    const head = h.ch.life.update(t, dt);
    h.ch.built.head.position.set(head.x, h.ch.built.head.userData.restY + head.y, 0);
    h.ch.built.head.rotation.set(head.pitch, head.yaw, head.rot);
  }
}

function dressBrutes(t, dt) {
  for (const rig of tide.bruteRigs) {
    if (!rig.group.visible) continue;
    rig.ring.scale.setScalar(Math.max(.001, rig.hp));
    rig.ring.material.opacity = .25 + .55 * (1 - rig.hp);
    const head = rig.life.update(t, dt);
    rig.built.head.position.set(head.x, rig.built.head.userData.restY + head.y, 0);
    rig.built.head.rotation.set(head.pitch, head.yaw, head.rot);
  }
}

// ---- the saw -----------------------------------------------------------
// SPIKE'S IDENTITY, DRAWN. Its idle is a grind with a 1.7-unit reach,
// and every readout it had was conditional: a ring IF something was
// inside, sparks IF it hit. A marble whose effect only shows while it
// is already working is a marble the player never learns — so the
// blade is now a real object, a toothed ring spinning on the ice
// around every planted Spike, whether anything is in it or not. The
// visual is the tooltip.
const sawTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  // twelve teeth: bright leading edge, faded trail, so the spin reads
  // even in a still frame
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2;
    const grad = g.createLinearGradient(Math.cos(a0) * 100, Math.sin(a0) * 100,
                                        Math.cos(a0 + .4) * 100, Math.sin(a0 + .4) * 100);
    grad.addColorStop(0, 'rgba(255,120,80,.95)');
    grad.addColorStop(1, 'rgba(255,120,80,.05)');
    g.strokeStyle = grad;
    g.lineWidth = 13;
    g.beginPath(); g.arc(0, 0, 108, a0, a0 + .42); g.stroke();
    // the tooth: a nub at each leading edge
    g.fillStyle = 'rgba(255,150,110,.95)';
    g.beginPath(); g.arc(Math.cos(a0) * 108, Math.sin(a0) * 108, 8, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
})();
const sawGeo = new THREE.PlaneGeometry(2, 2);
const sawMat = new THREE.MeshBasicMaterial({
  map: sawTex, transparent: true, depthWrite: false, toneMapped: false, opacity: .85,
});

function sawFor(m) {
  if (m.saw) return m.saw;
  const mesh = new THREE.Mesh(sawGeo, sawMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 3;
  const r = KINDS[m.kind].range;
  mesh.scale.setScalar(r);
  scene.add(mesh);
  m.saw = mesh;
  return mesh;
}

function dropSaw(m) {
  if (!m.saw) return;
  scene.remove(m.saw);
  m.saw = null;
}

// ---- the melt bar ------------------------------------------------------
// THE CLOCK, DRAWN AS A CLOCK. The melt used to read as the marble
// shrinking — physically honest and universally misread: a marble at
// 40% of itself looked broken, not old, and its death still came as a
// surprise ("balls just disappear"). A bar under each planted marble
// says the same thing the way every game says it. It drains BLUE for
// time; it turns RED when damage, not the clock, is what is about to
// kill it — one bar, and which death is coming is the colour.
const barFillGeo = new THREE.PlaneGeometry(1, .11);
barFillGeo.translate(.5, 0, 0);                 // anchored at its left edge
const barBlueMat = new THREE.MeshBasicMaterial({
  color: '#8FDFFF', depthWrite: false, toneMapped: false });
const barRedMat = new THREE.MeshBasicMaterial({
  color: '#FF7A55', depthWrite: false, toneMapped: false });

function barFor(m) {
  if (m.bar) return m.bar;
  // no fixed rotation: the bar BILLBOARDS to the camera every frame
  // (see dressMarbles), so it reads the same at any rake
  const g = new THREE.Group();
  // JUST THE BAR, no background plate — a track behind a draining bar
  // says "this is UI"; a bare strip that simply gets shorter says
  // "this much is left", which is the whole message
  const fill = new THREE.Mesh(barFillGeo, barBlueMat);
  fill.position.set(-.5, 0, 0);
  fill.renderOrder = 5;
  g.add(fill);
  g.scale.setScalar(1.15);
  scene.add(g);
  m.bar = { group: g, fill };
  return m.bar;
}

function dropBar(m) {
  if (!m.bar) return;
  scene.remove(m.bar.group);
  m.bar = null;
}

// ---- the aim line ------------------------------------------------------
const dotGeo = new THREE.BufferGeometry();
dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(96 * 3), 3));
dotGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(96 * 3), 3));
// A BRIGHT DOT ON A PALE FLOOR IS NOT A DOT. The first aim line was a
// soft white blob at the marble's own colour, and against this tray
// half the roster's line was invisible — pale blue on warm grey is a
// contrast of nothing. So every dot carries its own dark rim: a hard
// core, a dark ring around it, and it reads on the floor, on the
// paint, over a pile of enemies and over another marble.
const dotTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(26,22,20,.85)';
  g.beginPath(); g.arc(24, 24, 17, 0, 7); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(24, 24, 11, 0, 7); g.fill();
  // soften the rim only, so the core keeps its edge
  const out = g.getImageData(0, 0, 48, 48);
  for (let i = 0; i < 48 * 48; i++) {
    const x = i % 48 - 24, y = (i / 48 | 0) - 24;
    const d = Math.hypot(x, y);
    if (d > 14) out.data[i * 4 + 3] *= Math.max(0, 1 - (d - 14) / 5);
  }
  g.putImageData(out, 0, 0);
  return new THREE.CanvasTexture(c);
})();
const dots = new THREE.Points(dotGeo, new THREE.PointsMaterial({
  size: .34, map: dotTex, transparent: true, depthWrite: false,
  sizeAttenuation: true, toneMapped: false, opacity: 1, vertexColors: true,
}));
dots.frustumCulled = false;
dots.visible = false;
dots.renderOrder = 5;
scene.add(dots);

// THE REACH OF THE ONE IN YOUR HAND, drawn on the ice under it. It is
// the same ring `onPlant` throws when a marble lands, so the promise
// and the delivery are visibly the same circle.
const benchRing = new THREE.Mesh(
  new THREE.RingGeometry(.972, 1, 44),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: .2, depthWrite: false, toneMapped: false }));
benchRing.rotation.x = -Math.PI / 2;
benchRing.position.y = .015;
benchRing.visible = false;
benchRing.renderOrder = 3;
scene.add(benchRing);

const padRing = new THREE.Mesh(
  new THREE.RingGeometry(.62, .78, 32),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: .8, depthWrite: false, toneMapped: false }));
padRing.rotation.x = -Math.PI / 2;
padRing.visible = false;
padRing.renderOrder = 5;
scene.add(padRing);

function dressBenchRing(t) {
  const sel = selectedSlot();
  if (!sel || !sel.ch) { benchRing.visible = false; return; }
  const K = KINDS[sel.kind];
  // HOW FAR THIS ONE SEES, drawn under the marble in your hand. It used
  // to ride the end of the predicted path — which was a lovely thing to
  // look at and told you exactly where the throw would stop, i.e. the
  // whole answer. The line only leads now, so the ring stays home and
  // says the one thing it is for.
  benchRing.visible = true;
  benchRing.position.set(benchX(sel.i), .015, FIELD.hand);
  benchRing.scale.setScalar(K.range * (1 + Math.sin(t * 2) * .012));
  benchRing.material.color.set(K.accent);
  benchRing.material.opacity = aim.on && aim.power > .06 ? .34 : .18;
}

function dressAim() {
  const slot = aim.on ? S.hand[aim.fromSlot] : null;
  if (!aim.on || !slot || !slot.ready || aim.power < .04) {
    dots.visible = padRing.visible = false;
    return;
  }
  const K = KINDS[slot.kind];
  // the preview integrates with the KIND's own mods — a polished Bolt
  // and a stock Bolt draw different lines, as they should
  const n = previewPath(slot.kind, K, W.kmods[slot.kind], benchX(slot.i), FIELD.hand,
                        aim.dx, aim.dz, aim.power * W.mods.power, FIELD, previewBuf,
                        AIM_LEAD);
  const arr = dotGeo.attributes.position.array;
  const col = dotGeo.attributes.color.array;
  accent.set(K.accent);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = previewBuf[i * 2];
    arr[i * 3 + 1] = .14;
    arr[i * 3 + 2] = previewBuf[i * 2 + 1];
    // it fades out rather than stopping: a line with a hard end reads
    // as a promise about that spot, which is exactly the promise it is
    // no longer making
    const k = 1 - (i / n) * .88;
    col[i * 3] = accent.r * k; col[i * 3 + 1] = accent.g * k; col[i * 3 + 2] = accent.b * k;
  }
  dotGeo.setDrawRange(0, n);
  dotGeo.attributes.position.needsUpdate = true;
  dotGeo.attributes.color.needsUpdate = true;
  dots.visible = true;

  padRing.position.set(benchX(slot.i), .02, FIELD.hand);
  padRing.scale.setScalar(.7 + aim.power * .8);
  padRing.material.color.setHSL((1 - aim.power) * .32, .8, .55);
  padRing.visible = true;
}

// =================================================================
// INPUT
// =================================================================
let pointerDown = null;

function benchHit(cx, cy) {
  for (const h of S.hand) {
    if (!h.ready) continue;
    const p = table.screenAt(benchX(h.i), h.ch.radius, FIELD.hand);
    const r = stage.clientHeight * .085;
    if (Math.hypot(p.x - cx, p.y - cy) < r) return h;
  }
  return null;
}

// THE TITLE HAS TO CATCH ITS OWN TAP. The veil is a SIBLING of the
// stage, not a child of it, so a tap on "TAP TO PLAY" lands on the veil
// and the stage's own listener never hears about it — the button did
// nothing, and every automated test missed it by dispatching events
// straight at the stage instead of letting the browser hit-test them.
// The one exception is the menu link inside it, which has somewhere
// else to be.
document.getElementById('title').addEventListener('pointerdown', ev => {
  if (ev.target.closest('a')) return;
  ev.preventDefault();
  if (S.phase === 'menu') start();
});

stage.addEventListener('pointerdown', ev => {
  ev.preventDefault();
  if (S.phase === 'menu') { start(); return; }
  if (S.phase !== 'play') return;
  // a mouse drag that leaves the window keeps reporting: without the
  // capture, desktop aim froze at whatever power it had at the sill.
  // Failure is fine (a synthetic event has no capturable pointer) —
  // losing the capture must never cost the throw itself.
  try { stage.setPointerCapture(ev.pointerId); } catch {}
  pointerDown = { x: ev.clientX, y: ev.clientY };

  const onBench = benchHit(ev.clientX, ev.clientY);
  if (onBench) {
    if (S.sel !== onBench.i) toybox.sfx('select', { vol: .5 });
    S.sel = onBench.i;
  }
  const slot = selectedSlot();
  if (!slot) return;
  S.sel = slot.i;
  aim.on = true; aim.fromSlot = slot.i; aim.power = 0;
  aim.ox = ev.clientX; aim.oy = ev.clientY;
  updateAim(ev.clientX, ev.clientY);
});

function updateAim(cx, cy) {
  const slot = S.hand[aim.fromSlot];
  if (!slot || !slot.ready) return;
  // SLINGSHOT: you pull back, the marble goes the other way. The
  // camera has no roll and looks straight down the table, so screen
  // right IS world +x and screen down IS world +z — no unprojection
  // needed, and none WANTED: an unprojected drag changes its meaning
  // with the perspective under it.
  const px = aim.ox - cx, py = aim.oy - cy;
  const unit = Math.min(stage.clientWidth, stage.clientHeight, PULL_BASIS);
  const d = Math.hypot(px, py) / unit;
  if (d < .004) { aim.power = 0; return; }
  // it may only be thrown UP THE TABLE: a marble aimed at your own
  // line is never the shot, and allowing it costs a whole quadrant of
  // the aim's resolution
  let th = Math.atan2(px, -py);
  th = Math.max(-AIM_MAX, Math.min(AIM_MAX, th));
  aim.dx = Math.sin(th); aim.dz = -Math.cos(th);
  aim.power = Math.max(0, Math.min(1, (d - PULL_MIN) / (PULL_MAX - PULL_MIN)));
  if (aim.power > 0) toybox.sfx('aim', { vol: .16, cool: .1, pan: W.pan(benchX(slot.i)) });
}

addEventListener('pointermove', ev => {
  if (!pointerDown) return;
  if (aim.on) updateAim(ev.clientX, ev.clientY);
});

function cancelAim() { aim.on = false; aim.power = 0; pointerDown = null; }
addEventListener('pointercancel', cancelAim);
addEventListener('blur', cancelAim);

addEventListener('pointerup', () => {
  // …and only while the game is RUNNING. A kill can level you up
  // mid-drag: the draft veil goes up, the world stops stepping, and the
  // release used to put a marble on a paused sheet that then flew the
  // moment a card was taken.
  if (aim.on && aim.power > .06 && S.phase === 'play') {
    const slot = S.hand[aim.fromSlot];
    if (slot && slot.ready) throwMarble(slot, aim.dx, aim.dz, aim.power);
  }
  aim.on = false; aim.power = 0;
  pointerDown = null;
});

// a tab nobody is looking at should not keep humming to itself
addEventListener('visibilitychange', () => {
  if (document.hidden) toybox.stop();
  else toybox.music({ intensity: 0 });
});

addEventListener('keydown', ev => {
  if (ev.key === 'm' || ev.key === 'M') toybox.toggleMute();
  if (ev.key === 'r' || ev.key === 'R') location.reload();
  if (S.phase === 'menu' && (ev.key === ' ' || ev.key === 'Enter')) start();
  if (ev.key >= '1' && ev.key <= '4') S.sel = +ev.key - 1;
});

// =================================================================
// HUD
// =================================================================
const el = {
  lives: document.getElementById('lives'),
  bar: document.getElementById('bar'),
  lvl: document.getElementById('lvl'),
  score: document.getElementById('score'),
  wave: document.getElementById('wave'),
  draft: document.getElementById('draft'),
  over: document.getElementById('over'),
  title: document.getElementById('title'),
  boss: document.getElementById('boss'),
  bossFill: document.getElementById('bossfill'),
  bossName: document.getElementById('bossname'),
  mute: document.getElementById('mute'),
  combo: document.getElementById('combo'),
  hand: document.getElementById('hand'),
};

function paintHud() {
  el.lives.innerHTML = `<b>${S.lives}</b><span>line</span>`;
  el.lives.classList.toggle('low', S.lives <= 4);
  el.lvl.textContent = `lv ${S.level}`;
  el.score.textContent = Math.round(S.score).toLocaleString();
  el.bar.style.width = `${Math.min(100, S.xp / S.xpNeed * 100)}%`;
  // WHERE YOU ARE IN THE WAVE. It is the only thing on screen that says
  // anything about the future, and therefore the only thing that can
  // make holding a marble back a decision rather than lost production:
  // three of four formations down, with a boss after it, is a reason to
  // keep the Boulder in your hand.
  const named = S.t < S.surgeUntil;
  const forms = waveForms(S.wave);
  el.wave.textContent = named ? S.surgeName
    : S.stage === 'boss' ? 'BOSS'
    : S.stage === 'lull' ? 'INCOMING'
    : `wave ${S.wave} · ${forms - S.formsLeft + 1}/${forms}`;
  el.wave.classList.toggle('soon', !named && S.stage === 'lull');
  el.wave.classList.toggle('now', named || S.stage === 'boss');

  // the boss's health, and it is the only health bar in the game — see
  // §15: everything else dies too fast to have a state worth showing
  const b = S.bossAt;
  const up = b >= 0 && tide.alive[b];
  el.boss.style.display = up ? 'flex' : 'none';
  if (up) {
    el.bossFill.style.width = `${Math.max(0, tide.hp[b] / tide.maxHp[b]) * 100}%`;
    el.bossName.textContent = S.bossName;
  }
}

function flashLine() {
  table.lineMesh.material.color.setRGB(3, .6, .4);
  setTimeout(() => table.lineMesh.material.color.setRGB(1, 1, 1), 130);
}

/** the labels over the hand. They are DOM pinned to projected world
 *  points rather than 3d text: a name has to stay legible at a phone's
 *  pixel density, and world-space text at this scale is four pixels
 *  tall. */
function paintHand() {
  while (el.hand.children.length < S.hand.length) {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = '<b></b><span class="curl"></span><i></i><u></u>';
    el.hand.appendChild(d);
  }
  while (el.hand.children.length > S.hand.length) el.hand.lastChild.remove();

  for (const h of S.hand) {
    const node = el.hand.children[h.i];
    const p = table.screenAt(benchX(h.i), 0, FIELD.hand + .55);
    // clamped off the bottom edge: the selected slot grows a second
    // line for its blurb, and on a short window that line was landing
    // below the screen
    const y = Math.min(p.y + 6, stage.clientHeight - 60);
    node.style.transform = `translate(-50%,0) translate(${p.x}px,${y}px)`;
    node.classList.toggle('sel', h === selectedSlot());
    node.classList.toggle('empty', !h.ready);
    if (h.ready) {
      const K = KINDS[h.kind];
      node.querySelector('b').textContent = K.label;
      node.querySelector('b').style.color = K.accent;
      node.querySelector('.curl').textContent =
        K.curl > .15 ? '↷' : K.curl < -.15 ? '↶' : '↑';
      node.querySelector('i').textContent = K.blurb;
      // the bar is the REFILL and nothing else. Left at full width for a
      // ready slot it reads as an underline under the name, which is
      // the one thing a progress bar must never look like.
      // A FRACTION, never a width: how wide the track is belongs to the
      // stylesheet, and the last time this end knew a pixel number the
      // bar filled at 43% of the clock and lied for the rest.
      node.querySelector('u').style.setProperty('--fill', 0);
    } else {
      node.querySelector('b').textContent = '';
      node.querySelector('.curl').textContent = '';
      node.querySelector('i').textContent = '';
      // the ONE clock's progress shows on the next slot in line only;
      // the others wait their turn empty
      const nextUp = S.hand.find(x => !x.ready && !x.ch && !S.buildQueue.includes(x.i));
      node.querySelector('u').style.setProperty('--fill',
        h === nextUp ? Math.min(1, S.refillT / (REFILL / W.mods.refill)) : 0);
    }
  }
}

// ---- the marble portraits -------------------------------------------
// A card aimed at one kind SHOWS that marble — a rendered portrait of
// the actual character, not a name in its accent colour. Built lazily
// the first time a draft needs one (the game is paused behind the
// cards, so the handful of milliseconds is free) and cached as a data
// URL for the rest of the session.
//
// It needs its OWN renderer and its own studio env: the main env is a
// PMREM render-target texture bound to the main GL context, and a
// texture cannot cross contexts.
let thumbGear = null;
const thumbCache = {};

function kindThumb(kind) {
  if (thumbCache[kind]) return thumbCache[kind];
  if (!thumbGear) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(160, 160);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    thumbGear = {
      r,
      mat: makeMaterialFactory(studioEnv(r)),
      cam: new THREE.PerspectiveCamera(30, 1, .05, 40),
      scene: new THREE.Scene(),
    };
    thumbGear.scene.add(new THREE.HemisphereLight('#fff4e0', '#8a8072', 1.1));
    const key = new THREE.DirectionalLight('#fff6e8', 1.6);
    key.position.set(2, 4, 5);
    thumbGear.scene.add(key);
  }
  const G = thumbGear;
  const recipe = newGRecipe();
  Object.assign(recipe, KINDS[kind].recipe);
  ensureGParams(recipe);
  const built = buildGloss(recipe, { materialFor: G.mat });
  G.scene.add(built.group);
  const d = 2.6 * Math.max(built.L.H, built.L.W);
  G.cam.position.set(0, built.L.cy + d * .18, d);
  G.cam.lookAt(0, built.L.cy * .95, 0);
  G.r.render(G.scene, G.cam);
  const url = G.r.domElement.toDataURL();
  G.scene.remove(built.group);
  built.group.traverse(o => o.geometry?.dispose());
  thumbCache[kind] = url;
  return url;
}

/** the combo counter. Re-triggering a CSS animation needs the class
 *  taken off, a layout read to flush it, and the class put back — set
 *  alone it simply does not replay, and the second link of a chain
 *  would land silently. */
function showCombo(n) {
  el.combo.style.display = 'block';
  el.combo.querySelector('b').textContent = `×${n}`;
  el.combo.classList.remove('go');
  void el.combo.offsetWidth;
  el.combo.classList.toggle('big', n >= 5);
  el.combo.classList.add('go');
}

function hideCombo() { el.combo.style.display = 'none'; }

function showDraft(cards, heading = `level ${S.level}`) {
  el.draft.style.display = 'flex';
  el.draft.innerHTML = `<h2>${heading}</h2><div class="cards"></div>`;
  const box = el.draft.querySelector('.cards');
  cards.forEach((b, i) => {
    const d = document.createElement('button');
    d.className = `card ${b.rank}`;
    d.style.setProperty('--rank', RANK_COLOR[b.rank]);
    d.style.animationDelay = `${i * .07}s`;
    // THE NUMBER IS THE HEADLINE. The card used to lead with its name
    // ("hair trigger") and whisper the stat under it — and a draft is
    // read in two seconds against a paused fight, where a name is one
    // more thing to decode. The stat is the decision; the name is
    // flavour and goes underneath, small.
    // the TARGET is the second-biggest thing on the card: a stat with
    // no owner is a different decision from the same stat on your
    // best kind
    // A RECRUIT'S SUBJECT IS THE MARBLE IT HANDS YOU. It has no
    // `kind` — it is not aimed at one, it ADDS one — so the card read
    // "everyone · BOLT joins" and came with no portrait, which is
    // absurd on the one card in the game that is entirely about which
    // marble you are looking at. Display reads `unlock` as the subject;
    // the apply path still does not, and must not.
    const subject = b.kind ?? b.unlock;
    const who = subject ? KINDS[subject].label.toUpperCase() : 'everyone';
    const whoCol = subject ? KINDS[subject].accent : 'inherit';
    const orb = subject ? `<img class="orb" src="${kindThumb(subject)}" alt="">` : '';
    d.innerHTML = `${orb}<em>${b.rank}</em><span class="stat">${b.text}</span>`
      + `<b style="color:${whoCol}">${who} · <i>${b.label}</i></b>`;
    d.onclick = () => takeBooster(b);
    box.appendChild(d);
  });
  toybox.sfx('card', { vol: .6 });
}

function hideDraft() { el.draft.style.display = 'none'; }

el.mute.onclick = ev => {
  ev.stopPropagation();
  el.mute.classList.toggle('off', toybox.toggleMute());
};

function start() {
  S.phase = 'play';
  beginWave(1);
  el.title.style.display = 'none';
  toybox.music({ menu: false, intensity: 0 });
  toybox.sfx('take', { vol: .7 });
}

// =================================================================
// THE LOOP
// =================================================================
let last = performance.now();
let acc = 0;
let headless = false;

function frame(now = performance.now()) {
  let dt = Math.max(0, Math.min(.05, (now - last) / 1000));
  const raw = dt;
  last = now;
  const t = now / 1000;

  // HITSTOP. A frame or two of near-frozen time on a heavy impact is
  // the cheapest weight in games — the hit lands, the world holds its
  // breath, then it catches up. It scales dt rather than skipping
  // frames, so nothing in the simulation can miss a step.
  if (S.hitstop > 0) { S.hitstop -= dt; dt *= .18; }
  // …and the longer dilation a cascade earns. It decays in REAL time,
  // not in the dilated time it is creating, or a deep chain would take
  // most of a minute to come back up to speed.
  if (S.chainSlow > 0) {
    S.chainSlow -= raw;
    dt *= .34 + .66 * Math.max(0, 1 - S.chainSlow / .5);
  }

  serveQueue(S.phase === 'menu' ? 12 : 4);
  if (S.phase === 'over') tickCountUp(raw);

  if (S.phase === 'play') {
    S.t += dt;
    S.score += dt * 2;
    director(dt);
    tide.step(dt, W.marbles, hitMarble);
    W.t = S.t; W.dt = dt;
    stepShot(W, dt);
    combat.step(dt, S.t);

    // …and the reaper runs LAST, after the melt loop above — it used
    // to run before it, which left every freshly melted marble in the
    // array for one dressing pass
    reapMarbles();

    // the ice has gone quiet: settle up whatever that throw linked
    if (S.chainLive && !W.marbles.some(m => m.alive && m.moving)) finishChain();

    // planted marbles fight on their own — and only planted ones: a
    // marble firing while it is still sliding is a marble that never
    // has to be placed well. And they MELT while they do it.
    for (let i = W.marbles.length - 1; i >= 0; i--) {
      const m = W.marbles[i];
      if (!m.alive || m.moving) continue;
      m.life -= dt;
      if (m.life <= 0) { meltAway(m); continue; }
      const K = KINDS[m.kind];
      m.cd.idle = (m.cd.idle ?? 0) - dt;
      if (m.cd.idle <= 0) {
        const fired = K.idle.fire(m, W);
        m.cd.idle = fired ? K.idle.every : .12;
      }
    }

    // ONE recharge clock, not one per seat. Three empty slots used to
    // refill in parallel, so dumping your whole hand cost the same
    // recovery as spending one marble — the recharge is the throw's
    // only price, and a price that does not stack is not a price. Now
    // marbles come back one at a time.
    {
      const empty = S.hand.filter(h => !h.ready && !h.ch && !S.buildQueue.includes(h.i));
      if (empty.length) {
        S.refillT += dt;
        if (S.refillT >= REFILL / W.mods.refill) {
          S.refillT = 0;
          S.buildQueue.push(empty[0].i);
        }
      } else {
        S.refillT = 0;
      }
    }

    S.sinceLeak += dt;
    if (S.sinceLeak >= 60 && S.lives < LIVES) {
      S.sinceLeak = 0;
      S.lives++;
      toybox.sfx('level', { vol: .45, rate: 1.3 });
      fx.text(0, FIELD.line - .6, '+1 LINE', '#8FE0A8');
    }

    // THE SCORE FOLLOWS THE BOARD. Threat is how much is on the ice and
    // how much of the line has already gone; the wave's stage decides
    // whether the brass is allowed in at all. A boss walking on is the
    // one moment the music is permitted to announce something.
    const threat = Math.min(1, tide.count / 190 + (LIVES - S.lives) / LIVES * .55
      + (S.stage === 'boss' ? .25 : 0));
    toybox.music({ intensity: threat, boss: S.stage === 'boss' || S.stage === 'lull' });
  }

  // HEADLESS skips everything that is only true on a screen. The
  // simulation above is untouched, which is the point: a balance run is
  // measuring the game, not a picture of it — and at four minutes of
  // game time per run, dressing and drawing frames nobody is watching
  // is most of the wall clock. `fx.update` still runs, because the
  // pools would otherwise fill and the emit paths would start
  // behaving differently from the real ones.
  if (!headless) {
    dressMarbles(t, dt);
    dressBench(t, dt);
    dressBrutes(t, dt);
    tide.draw(t);
    dressAim();
    dressBenchRing(t);
    paintHand();
    acc += dt;
    if (acc > .1) { acc = 0; paintHud(); }
  }
  // ORDER MATTERS AND IT IS NOT OBVIOUS. `place` rewrites the camera's
  // position and quaternion outright, and `fx.update` adds the shake
  // offset on top of whatever it finds — so placing AFTER the shake
  // throws the shake away. It did, for a while, and the symptom is the
  // worst kind: every `fx.shake` call site still ran, nothing errored,
  // and the game simply had no weight.
  if (!headless) table.place(S.phase === 'draft' ? 1 : 0);
  fx.update(dt, t);
  if (!headless) table.render();
}

// ---- boot -------------------------------------------------------------
/**
 * `?shot=N` — run N seconds of a naive auto-played game synchronously at
 * load and stop throwing at the end, so a headless screenshot catches a
 * board mid-run with a full hand rather than the title card. It is how
 * `assets/thumbs/marbles.jpg` is made:
 *
 *   python3 serve.py &
 *   chrome --headless=new --window-size=900,1100 --use-gl=swiftshader \
 *          --screenshot=/tmp/m.png "http://localhost:8137/marbles.html?shot=26"
 *
 * Synchronous on purpose: a virtual-time budget will not wait for a
 * rAF-driven warm-up, and a page that screenshots itself has to be
 * finished before the load event is.
 */
function autoShot(seconds) {
  el.title.style.display = 'none';
  start();
  serveQueue(400);
  let t = performance.now();
  const frames = Math.round(seconds * 60);
  // THE WARM-UP IS HEADLESS. The screenshot runs under software GL,
  // where a rendered frame is most of a second — a rendered warm-up
  // took longer than the whole session it was meant to illustrate.
  // Only the last handful of frames draw anything.
  headless = true;
  for (let i = 0; i < frames; i++) {
    if (S.phase === 'draft') { hideDraft(); S.phase = 'play'; }
    const slot = S.hand.find(h => h.ready);
    // …and it stops throwing with time to spare, so the hand is full
    if (slot && i < frames - 260 && Math.random() < .02)
      throwMarble(slot, (Math.random() - .5) * .5, -1, .5 + Math.random() * .4);
    if (i === frames - 3) headless = false;
    t += 16.7;
    frame(t);
  }
}

newHand();
serveQueue(60);
paintHud();
paintHand();
toybox.music({ menu: true, intensity: 0 });
renderer.setAnimationLoop(frame);

{
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) autoShot(Math.min(60, +shot || 20));
}

// =================================================================
// THE DECIDABLE HALF — see CLAUDE.md. Everything here is a number a
// test can assert on without a screenshot.
// =================================================================
const yieldNow = () => new Promise(res => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => res();
  ch.port2.postMessage(0);
});

window.__marbles = {
  S, W, KINDS, FIELD, tide, combat, fx, table, frame, pressure, xpFor,
  // the formation machinery, so a shape or a march can be dealt by hand
  // and watched: `__marbles.spawnFormation(pressure(3), {march:'zigzag',
  // kind:'walker', size:14, x:0})`
  spawnFormation, SHAPES, MARCHES, THEMES, beginWave, spawnBoss, rollBossMarch,
  audio: toybox,
  headless(on = true) { headless = on; },
  get marbles() { return W.marbles; },
  start,
  /** drive frames by hand: a hidden tab throttles rAF to nothing, and
   *  every measurement below would otherwise be measuring a frozen
   *  game. */
  async pump(n = 60, step = 16.7) {
    renderer.setAnimationLoop(null);
    let t = performance.now();
    for (let i = 0; i < n; i++) { t += step; frame(t); await yieldNow(); }
    renderer.setAnimationLoop(frame);

{
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) autoShot(Math.min(60, +shot || 20));
}
  },
  /** put a marble on the table without throwing it — for measuring
   *  what a kind is worth per second. */
  place(kind, x, z) {
    const m = makeMarble(kind, KINDS[kind], W.kmods[kind]);
    m.x = x; m.z = z; m.moving = false;
    m.ch = buildCharacter(kind);
    play.add(m.ch.holder);
    W.marbles.push(m);
    return m;
  },
  throwFrom(slotIndex, dx, dz, power) {
    const slot = S.hand[slotIndex];
    if (slot?.ready) throwMarble(slot, dx, dz, power);
    return slot;
  },
  stats: () => ({
    phase: S.phase, t: +S.t.toFixed(2), lives: S.lives, kills: S.kills,
    level: S.level, xp: `${S.xp}/${S.xpNeed}`, score: Math.round(S.score),
    foes: tide.count, marbles: W.marbles.length, chain: S.chainBest,
    hand: S.hand.map(h => h.ready ? h.kind : '…'),
    refillT: +S.refillT.toFixed(1),
    combat: combat.stats(), fx: fx.stats?.(),
    draws: renderer.info.render.calls, tris: renderer.info.render.triangles,
  }),
  /**
   * BALANCE, MEASURED. No renderer, no meshes — the tide and the
   * weapons are pure arithmetic, so a marble mowing a dense field for
   * twenty seconds costs milliseconds. This is how the roster's numbers
   * were set, and it earned its keep immediately: the first pass
   * measured 19 damage a second for the starter marble against 201 for
   * an aura, a spread nobody would have guessed and nobody could have
   * felt through a controller.
   *
   * IT SPAWNS THE FIELD AROUND THE MARBLE. The first version put one
   * marble on the ice and let the normal spawner run, which measures
   * nothing at all: the sheet is thirty-six units long and a walker
   * takes the better part of a minute to reach anything, so a
   * twenty-second run reported zero for every kind in the roster.
   *
   * Returns damage DEALT per second, not kills — kills are hit points
   * in disguise and the whole point is to compare weapons.
   */
  dps(kind, seconds = 16, against = 'walker') {
    // NON-DESTRUCTIVE, and it has to be said out loud because the first
    // version was not: the measured field is spawned a couple of units
    // from the line, so twelve seconds of it walked two hundred enemies
    // over and ended the run you were measuring. Everything the run
    // counts is saved and put back.
    const keep = W.marbles.slice();
    const save = { lives: S.lives, kills: S.kills, score: S.score, xp: S.xp,
                   level: S.level, xpNeed: S.xpNeed, leaked: S.leaked,
                   phase: S.phase, chainBest: S.chainBest };
    W.marbles.length = 0;
    tide.clear();
    combat.clear();
    const m = makeMarble(kind, KINDS[kind], W.kmods[kind]);
    m.hp = m.maxHp = 1e9;              // measuring damage out, not survival
    W.marbles.push(m);

    let dealt = 0;
    const real = tide.hurt;
    tide.hurt = (i, d, o) => {
      const before = tide.hp[i];
      const killed = real(i, d, o);
      dealt += Math.min(d, before);
      return killed;
    };
    for (let f = 0; f < seconds * 60; f++) {
      while (tide.count < 55) {
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4.5;
        tide.spawn(against,
          Math.max(-FIELD.halfW + .5, Math.min(FIELD.halfW - .5, Math.cos(a) * r)),
          m.z - 1 + Math.sin(a) * r, 1);
      }
      tide.step(1 / 60, W.marbles, () => {});
      m.cd.idle = (m.cd.idle ?? 0) - 1 / 60;
      if (m.cd.idle <= 0) {
        const fired = KINDS[kind].idle.fire(m, W);
        m.cd.idle = fired ? KINDS[kind].idle.every : .12;
      }
      combat.step(1 / 60, S.t + f / 60);
    }
    tide.hurt = real;
    tide.clear();
    combat.clear();
    W.marbles.length = 0;
    for (const k of keep) W.marbles.push(k);
    Object.assign(S, save);
    return { kind, against, seconds, perSecond: +(dealt / seconds).toFixed(1) };
  },
  /** every kind, side by side — the table the roster is balanced on. */
  dpsAll(seconds = 16) {
    return Object.fromEntries(
      Object.keys(KINDS).map(k => [k, window.__marbles.dps(k, seconds).perSecond]));
  },
};
