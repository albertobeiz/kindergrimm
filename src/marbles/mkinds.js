// ---------------------------------------------------------------
// THE ROSTER — seven marbles, and every number in this file is
// something you can SEE.
//
// This is §10's rule ("the stats ARE the drawing") carried into a
// third game. A kind does not have a colour AND a set of stats: it
// pins a gloss recipe, and the recipe is the readout.
//
//   the HUE      says what it does          yellow shoots, orange burns,
//                                           ice-blue freezes, green rots
//   the FINISH   says how far it slides     chrome runs, rubber grips
//   the FORM     says what it weighs        a rock is heavy, a bead is not
//   the SILHOUETTE says how it fights       horns brawl, plain shoots
//
// `range` is a SINGLE number, read by the ability itself and by the
// ring the layout draws under a marble when it lands and under the one
// in your hand. It used to be a label beside a literal buried in
// `idle.fire`, which is the two-parallel-tables pattern this project
// has already been bitten by twice — and it had already drifted: one
// kind advertised a reach of 2 and shot at 4.6.
//
// `life` is how many seconds it lasts on the ice before it melts, and
// it is a per-kind CLOCK rather than a drain on hit points. Two
// reasons, and the second is the load-bearing one: a heavy marble
// should visibly outlast a light one, and army size must not be
// something a booster can inflate. Run as damage, +35% hit points was
// +35% marbles on the sheet as well — compounding into an auto-played
// run holding forty-seven of them.
//
// So a marble arriving in your hand is legible before you read its
// name, and a marble sitting on the table is legible from across the
// board. Nothing here is a stat you cannot point at.
//
// THE THIRD STAT IS THE CURVE, and it is the curling half of the game.
// The player chooses a direction and a force; the HOOK belongs to the
// marble. `curl` is a turn rate in the plane — positive breaks right,
// negative left — and a big one is not a drawback: it is the only way
// to reach behind a brute. Chrome slides far and hooks hard; a rock
// runs almost straight and stops where you put it.
//
// AN ABILITY READS ITS OWNER'S MODS (`m.mods`), never a global: a card
// is aimed at one marble type now, so "+25% damage — EMBER" touches
// every Ember on the ice and nothing else.
//
// A burst's AREA grows with the chain that set it off — `bloom(mul)`
// below, up to double size at a deep chain. The damage multiplier alone
// was invisible: a ×4 chain dealt four times the number and looked
// exactly like a ×1, and a payoff you cannot see from across the sheet
// is not a payoff. Area is the one axis of a burst the eye actually
// reads.
//
// Each kind has exactly two behaviours and no more:
//   IDLE   what it does planted, on a cooldown, for ever
//   BURST  its one big move, fired when a friendly marble STRIKES it —
//          and fired ALONG the blow, `(nx, nz)`, which is what makes a
//          carom an aimed shot rather than a firework going off. The
//          two radial bursts (Frost, Boulder) are radial on purpose:
//          they are the ones you fire when you have no angle.
//
// A kind may never do anything else, and the two must be the same
// idea at two sizes — a shooter's burst is a wall of shots, a bomber's
// is a bigger bomb. That is what makes an intentional carom read as a
// plan rather than as a slot machine.
// ---------------------------------------------------------------

// A NOTE ON FRICTION. EVERY MARBLE CAN REACH THE FAR END on clear ice
// at full power, and that is a floor the table has to respect: a kind
// that physically cannot be thrown the length of the sheet is a kind
// whose whole far half of the board is missing. The sheet is 36.5 units
// from the hand to the walk-on line and a throw leaves at 26, so
// v²/(2·gripBase·friction) ≥ 36.5 caps friction at about 1.7. Boulder
// was at 2.7 and stopped two thirds of the way up.
//
// What friction still decides is everything BETWEEN: at half power a
// Bolt runs three times as far as a Boulder, and a lane full of bodies
// takes its cut of both (`crushDrag`). Reach on empty ice is the same
// for all of them; reach through a crowd never is.
//
// A NOTE ON RANGE, because every number below was cut by about a
// quarter for it. The sheet is nine units wide. An aura of radius 2.9
// covers nearly two thirds of that, so three marbles abreast were a
// screen nothing crossed, and an auto-played run annihilated the tide
// at the far hog line with a dozen marbles standing. A range has to be
// a place on the sheet, not a band across it.
//
// every ability's numbers are per-second-ish and read against these:
// a mote is 11hp, a walker 55, a carapace 220, a brute 1800 — before
// the run's own scaling, which roughly doubles them a minute.
export const KINDS = {

  // ---------------------------------------------------------------
  popper: {
    label: 'Popper', tier: 1, weight: 30,
    blurb: 'plinks away for ever. runs straight.',
    accent: '#F2E08D',
    recipe: { species: 'wildcard', body: 'sphere', stance: 'none',
              palette: 'meadow', colorIx: 0, material: 'glossy' },
    mass: 1, friction: .95, curl: 0, radius: .5,
    hp: 440, life: 15, crush: 25, impact: 1.5,
    range: 4.2,
    // IT PIERCES, and that is the whole balance note. Measured against a
    // dense field it did 19 damage a second where an aura did 200 — a
    // single pellet cannot compete with a circle, and the starter marble
    // being a twentieth of everything else is the starter marble being a
    // punishment. Piercing keeps its silhouette, its range and its read,
    // and lets a lane of enemies pay for standing in a lane.
    idle: { every: .44, fire(m, W) {
      // IT PICKS ITS TARGET. A spitter shoots from outside every
      // marble's range and a mender undoes everybody's work; neither
      // can be answered by rolling over it, and something in the
      // roster has to be the answer. This is the only kind that reaches
      // far enough to be it, so it goes for them first — which is what
      // its long range is FOR, and what makes the plainest marble in
      // the bag worth keeping.
      let i = W.tide.nearest(m.x, m.z, m.K.range, j => {
        const k = W.tide.kindName(j);
        return k === 'spitter' || k === 'mender';
      });
      if (i < 0) i = W.tide.nearest(m.x, m.z, m.K.range);
      if (i < 0) return false;
      W.combat.pellet({
        x: m.x, z: m.z, tx: W.tide.x[i], tz: W.tide.z[i], target: i,
        speed: 14, dmg: 15 * m.mods.dmg, size: .16, color: '#FFE98A',
        trail: 1, pierce: 2,
      });
      W.snd.sfx('pop', { pan: W.pan(m.x), vol: .32, cool: .05 });
      return true;
    } },
    burst(m, W, mul, nx, nz) {
      // A CONE ALONG THE BLOW. It was a full ring, and a ring is the
      // same shot whatever angle you hit it from — which is a burst
      // that cannot be aimed, on the kind you have most of.
      const n = 13, base = Math.atan2(nz, nx), spread = .95;
      for (let k = 0; k < n; k++) {
        const a = base + (k / (n - 1) - .5) * 2 * spread;
        W.combat.pellet({
          x: m.x, z: m.z, tx: m.x + Math.cos(a) * 9, tz: m.z + Math.sin(a) * 9,
          speed: 16, dmg: 15 * mul * m.mods.dmg, size: .17, color: '#FFF0A0',
          pierce: 2, trail: 1, life: 1,
        });
      }
      W.fx.ring(m.x, m.z, 1.5, '#FFE98A', { life: .3 });
      W.snd.sfx('pop', { pan: W.pan(m.x), vol: .8, rate: .8 });
    },
  },

  // ---------------------------------------------------------------
  ember: {
    label: 'Ember', tier: 1, weight: 20,
    blurb: 'lobs fire. breaks right.',
    accent: '#E87830',
    recipe: { species: 'monster', body: 'sphere', stance: 'none',
              palette: 'ember', colorIx: 4, material: 'ceramic' },
    mass: .96, friction: 1.02, curl: .55, radius: .5,
    hp: 380, life: 14, crush: 22, impact: 1.4,
    range: 5,
    idle: { every: 1.45, fire(m, W) {
      const i = W.tide.nearest(m.x, m.z, m.K.range);
      if (i < 0) return false;
      W.combat.pellet({
        x: m.x, z: m.z, tx: W.tide.x[i], tz: W.tide.z[i],
        speed: 7.5, dmg: 22 * m.mods.dmg, size: .26, splash: 1.15,
        arc: 1.5, color: '#FF9A3C', burn: 7, trail: 1,
      });
      return true;
    } },
    burst(m, W, mul, nx, nz) {
      // thrown a body-length along the blow, so a carom PLACES the fire
      W.combat.blast(m.x + nx * 1.3, m.z + nz * 1.3, 3 * bloom(mul), 78 * mul * m.mods.dmg,
        { color: '#FF8A34', burn: 16, burnFor: 3.4 });
      W.fx.shake(.5);
      W.snd.sfx('boom', { pan: W.pan(m.x), vol: 1, rate: .78 });
    },
  },

  // ---------------------------------------------------------------
  frost: {
    label: 'Frost', tier: 1, weight: 16,
    blurb: 'chills everything near it. breaks left.',
    accent: '#5C9BC9',
    // A STRONG blue, not an icy one. Every enemy on this sheet is dark
    // and the sheet itself is pale, so a marble has exactly one job in
    // the palette: be neither. Pale mist blue was the obvious colour
    // for a frost marble and it disappeared into the ice it was
    // standing on.
    recipe: { species: 'cat', body: 'sphere', stance: 'none',
              palette: 'harbour', colorIx: 0, material: 'pearl' },
    mass: .9, friction: .78, curl: -.5, radius: .48,
    hp: 410, life: 15, crush: 20, impact: 1.2,
    range: 2.7,
    // THE AURA IS ICE ON THE GROUND, not an invisible circle. It used
    // to chill by query — mechanically identical, and the only evidence
    // was enemies turning faintly blue: on a sheet already blue, the
    // marble looked like it did nothing at all. Now it lays a visible
    // frost pool under itself, and the pool does the chilling. Every
    // kind's idle must be something you can POINT AT.
    idle: { every: .6, fire(m, W) {
      W.combat.field(m.x, m.z, m.K.range, .8,
        { slow: .52 * m.mods.chill, dps: 2.2 * m.mods.dmg, color: '#9FD8FF' });
      return W.tide.nearest(m.x, m.z, m.K.range + 1) >= 0;
    } },
    // RADIAL ON PURPOSE — the burst you fire when you have no angle.
    burst(m, W, mul) {
      W.combat.blast(m.x, m.z, 3.8 * bloom(mul), 34 * mul * m.mods.dmg, {
        nova: true, color: '#CFE9FF',
        stun: 1.5 + .5 * mul, slow: .8, slowFor: 3.4,
      });
      W.fx.shake(.3);
      W.snd.sfx('frost', { pan: W.pan(m.x), vol: 1 });
    },
  },

  // ---------------------------------------------------------------
  spike: {
    label: 'Spike', tier: 1, weight: 18,
    blurb: 'a spinning blade — shreds whatever steps inside. runs true.',
    accent: '#E85A3C',
    recipe: { species: 'monster', body: 'cube', stance: 'none',
              palette: 'melon', colorIx: 4, material: 'rubber' },
    mass: 1.4, friction: 1.25, curl: 0, radius: .56,
    hp: 470, life: 17, crush: 42, impact: 2.1,
    range: 1.7,
    idle: { every: .34, fire(m, W) {
      let any = false;
      W.tide.each(m.x, m.z, m.K.range, (i) => {
        W.tide.hurt(i, 11 * m.mods.dmg, {});
        any = true;
        return false;
      });
      if (any) {
        W.fx.ring(m.x, m.z, m.K.range, '#FF8266', { life: .28, width: .3 });
        W.fx.spark(m.x + (Math.random() - .5) * m.K.range, m.z + (Math.random() - .5) * m.K.range,
                   '#FFB08A', 4);
        W.snd.sfx('crush', { pan: W.pan(m.x), vol: .3, cool: .09 });
      }
      return any;
    } },
    burst(m, W, mul, nx, nz) {
      // it does not explode, it SPINS — and it keeps going, which is
      // what makes hitting a spike with something else worth doing:
      // you are not setting off a bomb, you are launching a saw.
      W.combat.blast(m.x + nx * .8, m.z + nz * .8, 2.8 * bloom(mul), 58 * mul * m.mods.dmg,
        { color: '#FF6A4A' });
      m.grip *= .45;              // for the rest of this throw only
      W.snd.sfx('slam', { pan: W.pan(m.x), vol: .8, rate: 1.2 });
    },
  },

  // ---------------------------------------------------------------
  bolt: {
    label: 'Bolt', tier: 2, weight: 0,
    blurb: 'chains lightning. slides for ever and hooks hard.',
    accent: '#B0B9E8',
    recipe: { species: 'robot', body: 'sphere', stance: 'none',
              palette: 'bloom', colorIx: 4, material: 'chrome' },
    mass: .72, friction: .55, curl: .95, radius: .43,
    hp: 320, life: 11, crush: 18, impact: 1.1,
    range: 3.6,
    idle: { every: .95, fire(m, W) {
      // ACQUIRE AND HOP AT THE SAME DISTANCE. They were 4.4 and 3.4:
      // an enemy at 4.0 satisfied the acquire, burned the full cooldown
      // and hit nothing, which reads as the marble being broken.
      const i = W.tide.nearest(m.x, m.z, m.K.range);
      if (i < 0) return false;
      W.combat.zap(m.x, m.z, 4 + m.mods.hops, 25 * m.mods.dmg,
        { range: m.K.range, color: '#C9B6FF' });
      return true;
    } },
    burst(m, W, mul, nx, nz) {
      W.combat.zap(m.x + nx * 1.8, m.z + nz * 1.8, 11 + m.mods.hops * 2,
        34 * mul * m.mods.dmg, { range: 4.2, color: '#E0D0FF', stun: .5 });
      W.snd.sfx('zap', { pan: W.pan(m.x), vol: 1, rate: .85 });
    },
  },

  // ---------------------------------------------------------------
  boulder: {
    label: 'Boulder', tier: 2, weight: 0,
    blurb: 'stops where you put it. nothing moves it. breaks brutes.',
    accent: '#B78ABA',
    // Mauve, not slate. A dark grey rock reads as one of THEIRS at a
    // glance, which on a board where the only rule is "mine or
    // theirs" is the worst thing a marble can do.
    recipe: { species: 'rock', body: 'rock', stance: 'none',
              palette: 'denim', colorIx: 3, material: 'wood' },
    mass: 2.6, friction: 1.62, curl: -.2, radius: .7,
    hp: 700, life: 26, crush: 42, impact: 3.4,
    range: 2.6,
    idle: { every: 2, fire(m, W) {
      const i = W.tide.nearest(m.x, m.z, m.K.range);
      if (i < 0) return false;
      W.combat.blast(m.x, m.z, m.K.range, 27 * m.mods.dmg, { color: '#C7B39A', stun: .45 });
      W.fx.ring(m.x, m.z, m.K.range, '#E8D6B8', { life: .4, width: .5 });
      W.fx.shake(.16);
      W.snd.sfx('slam', { pan: W.pan(m.x), vol: .6 });
      return true;
    } },
    burst(m, W, mul) {
      W.combat.blast(m.x, m.z, 4.4 * bloom(mul), 66 * mul * m.mods.dmg,
        { color: '#D8C3A4', stun: 1.2, quiet: true });
      W.fx.ring(m.x, m.z, 4.4 * bloom(mul), '#E4D2B4', { life: .55, width: .7 });
      W.fx.blast(m.x, m.z, 1.7, '#D8C3A4');
      W.fx.shake(.85);
      // it shoves everything of OURS as well — the only marble that
      // rearranges the whole table, and half the reason to keep one
      for (const o of W.marbles) {
        if (o === m || !o.alive) continue;
        const dx = o.x - m.x, dz = o.z - m.z;
        const d = Math.hypot(dx, dz);
        if (d > 3.6 || d < .001) continue;
        const push = (1 - d / 3.6) * 15 * (m.mass / o.mass);
        o.vx += dx / d * push; o.vz += dz / d * push;
        o.moving = true;
      }
      W.snd.sfx('slam', { pan: W.pan(m.x), vol: 1.1, rate: .7 });
    },
  },

  // ---------------------------------------------------------------
  goo: {
    label: 'Goo', tier: 2, weight: 0,
    blurb: 'lays tar. the tide crawls through it. hooks left, hard.',
    accent: '#3AB8A0',
    recipe: { species: 'slime', body: 'slime', stance: 'none',
              palette: 'lagoon', colorIx: 0, material: 'rubber' },
    mass: .86, friction: 1.4, curl: -.8, radius: .53,
    hp: 510, life: 21, crush: 20, impact: .9,
    range: 2.2,
    // IT IS A WALL, and that is the whole kind. It was a weak lobber
    // with a five-second puddle nobody could perceive — the lowest
    // damage in the roster, the hardest hook, and a gilded card to
    // unlock it. Now it does one thing nothing else does: it puts a
    // piece of the sheet permanently under tar. The tide walks through
    // at a third speed, which is worth more than any damage number,
    // and you can SEE exactly what you bought.
    onPlant(m, W) { gooPool(m, W); },
    idle: { every: 3.2, fire(m, W) { gooPool(m, W); return true; } },
    burst(m, W, mul, nx, nz) {
      // it bursts like a dropped bag — thrown FORWARD along the blow,
      // so a carom lays a barricade across the lane you aimed at
      const base = Math.atan2(nz, nx);
      for (let k = 0; k < 7; k++) {
        const a = base + (k / 6 - .5) * 2.2;
        const d = 1.5 + (k % 3) * .9;
        W.combat.field(m.x + Math.cos(a) * d, m.z + Math.sin(a) * d, 1.5, 6,
          { slow: .62, dps: 8 * mul * m.mods.dmg, color: '#5FCBA6' });
      }
      W.combat.blast(m.x, m.z, 1.9, 30 * mul * m.mods.dmg,
        { color: '#5FCBA6', slow: .6, slowFor: 3, quiet: true });
      W.snd.sfx('crush', { pan: W.pan(m.x), vol: .9, rate: .6 });
    },
  },
};

/** the tar under a Goo, laid on landing and topped up for ever after.
 *  Its own helper because both `onPlant` and `idle` want exactly it. */
function gooPool(m, W) {
  W.combat.field(m.x, m.z, m.K.range, 3.6,
    { slow: .68 * m.mods.chill, dps: 7 * m.mods.dmg, color: '#6ED2AE' });
}

/** how much bigger a chain makes a burst: ×1 at no chain, double at a
 *  deep one. Reads `mul`, which already compounds per link. */
const bloom = mul => 1 + Math.min(1, (mul - 1) * .18);

export const KIND_IDS = Object.keys(KINDS);

for (const [id, K] of Object.entries(KINDS)) {
  K.id = id;
  // the same cross-check `gmedia.js` runs over its finishes, for the
  // same reason: a kind missing its burst silently does nothing on the
  // one action the whole game is built around, and nothing would say so.
  if (typeof K.burst !== 'function') throw new Error(`mkinds: ${id} has no burst`);
  if (!K.idle || typeof K.idle.fire !== 'function') throw new Error(`mkinds: ${id} has no idle`);
  if (!(K.range > 0)) throw new Error(`mkinds: ${id} has no range`);
  if (!(K.life > 0)) throw new Error(`mkinds: ${id} has no life`);
  if (!K.blurb) throw new Error(`mkinds: ${id} has no blurb — the hand shows it`);
}

/** the bag you draw from. Weights are edited by boosters, so this is a
 *  starting hand of DICE, not a fixed list — a kind at weight 0 is
 *  real, drawable, and simply not in the bag yet. */
export function newBag() {
  return Object.fromEntries(KIND_IDS.map(id => [id, KINDS[id].weight]));
}

export function drawKind(bag, rnd = Math.random) {
  let total = 0;
  for (const id of KIND_IDS) total += bag[id];
  let x = rnd() * total;
  for (const id of KIND_IDS) if ((x -= bag[id]) < 0) return id;
  return 'popper';
}
