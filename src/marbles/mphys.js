// ---------------------------------------------------------------
// THE SHOT — everything that moves under its own momentum.
//
// There are never more than a dozen dynamic bodies on this table and
// they are all circles, so the solver is a hundred lines and no
// library. What it owes the game is exact:
//
//   1. a marble slides, CURVES, and comes to rest;
//   2. it kills what it rolls over and slows a little for each;
//   3. it bounces off the rails and off a brute;
//   4. it knocks OUR OTHER MARBLES, which fire their burst and are
//      sent sliding themselves — that is the chain, and it is the
//      whole skill of the game.
//
// THE CURVE IS THE MARBLE'S, NOT THE PLAYER'S. You choose a direction
// and a force; the hook is a property of the thing in your hand, the
// way a curling stone's is a property of the ice it is thrown on. A
// marble that always hooks right is a different tool from one that
// runs straight, and learning to shoot around a brute with it is the
// game's deepest move. It is implemented as a constant TURN RATE, not
// a constant sideways force: at constant turn rate the radius of the
// arc shrinks as the marble slows, so the hook arrives LATE, which is
// what a curling stone actually does and what makes the shot readable
// — it goes where you aimed and then breaks at the end.
//
// SUBSTEPS ARE NOT OPTIONAL. A marble at full power covers most of its
// own diameter in one frame at 60Hz, and at 30 it covers two: without
// substepping it tunnels through the rail, through a brute, and
// straight past half the swarm it should have ploughed. The step count
// is derived from the fastest body, so a slow frame costs more
// substeps instead of correctness.
// ---------------------------------------------------------------
import { MAX_FOE_R } from './mfoes.js';

// The numbers that are about PHYSICS rather than about any one marble.
export const PHYS = {
  gripBase: 5.4,        // deceleration, world units/s² — a kind scales this
  maxSpeed: 26,         // a full-power throw
  minSpeed: .55,        // below this it is at rest, and snapping it there
                        // is what stops a marble creeping for ever
  railBounce: .72,
  ballBounce: .94,      // marbles are hard plastic; they barely eat energy
  curlRate: 2.9,        // see `hook` below — NOT radians/second
  crushDrag: .038,      // speed lost per small enemy ploughed, as a fraction.
                        // This is the plough feel AND the only limit on a
                        // throw's reach, now that a crush is always a kill:
                        // what a big formation costs you is the rest of your
                        // line, not the kills.
  bruteBounce: .82,
};

/** a marble body. The gloss character is attached but never consulted here:
 *  this file knows a radius and a mass, and nothing about what it looks
 *  like. */
let nextUid = 1;

export function makeMarble(kind, K, mods) {
  return {
    kind, K,
    // THIS KIND's mods, shared by every marble of the kind — the
    // abilities read `m.mods`, and a card taken mid-run reaches every
    // standing marble of its type through this one reference
    mods,
    // unique for this marble's whole life, and the tide stamps it: one
    // crush per marble per enemy, ever. See `sweep` for why.
    uid: nextUid++,
    x: 0, z: 0, vx: 0, vz: 0,
    r: K.radius,
    mass: K.mass * (1 + mods.mass),
    grip: K.friction * (1 - mods.slide),
    curl: K.curl,
    // vestigial — nothing damages a marble any more; kept because the
    // debug helpers pin it
    hp: K.hp, maxHp: K.hp,
    // THE MELT CLOCK — see `life` in mkinds.js. Deliberately NOT scaled
    // by any booster: hit points buy survival, never time.
    //
    // It used to be shadowed. This literal also carried a `life: null`
    // placeholder for the character's face animator, three lines below,
    // and the last key wins — so every marble was born with a null
    // clock, `m.life -= dt` coerced it to a negative number, and the
    // marble melted on its first planted frame. Two marbles ever stood
    // on the ice and the run was over in ninety seconds. It is exactly
    // the collision ARCHITECTURE.md records between a spec's `exp` and
    // a placed solid's `n`, in a new file, a year later: two meanings,
    // one key, and nothing says a word.
    // …and the clock is a STAT now: the time cards stretch it, the two
    // thief enemies steal from it. The old rule ("no booster may touch
    // time") died with marble hit points — with one clock instead of
    // two, time IS survival, so the cards must be able to buy it.
    life: K.life * (1 + mods.time) + mods.timeFlat,
    maxLife: K.life * (1 + mods.time) + mods.timeFlat,
    alive: true, moving: false,
    burstReady: true,           // one burst per throw, per marble
    cd: {},                     // weapon cooldowns, owned by the kind
    // presentation. The character and its face animator hang off `ch`,
    // set by the game — NOT off this object, which is what caused the
    // collision above.
    ch: null,
    spin: 0, hurtT: 0, lastTrailX: 0, lastTrailZ: 0,
  };
}

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/**
 * one whole frame of momentum. `W` is the arena — see marbles.js for
 * what it carries. Returns the number of marble-on-marble hits, which
 * the game uses to know a chain is still running.
 */
export function stepShot(W, dt) {
  const { marbles, field } = W;
  let fastest = 0;
  for (const m of marbles) if (m.moving) fastest = Math.max(fastest, Math.hypot(m.vx, m.vz));
  if (fastest < .01) return 0;

  // half a radius per substep is the safety margin: it keeps the
  // crush sweep continuous as well as the collisions, so nothing is
  // stepped over unkilled
  const steps = clamp(Math.ceil((fastest * dt) / (.2)), 1, 10);
  const h = dt / steps;
  let hits = 0;
  for (let s = 0; s < steps; s++) hits += substep(W, h, field);
  return hits;
}

function substep(W, dt, field) {
  const { marbles, tide } = W;
  let hits = 0;

  for (const m of marbles) {
    if (!m.alive || !m.moving) continue;
    let sp = Math.hypot(m.vx, m.vz);

    // --- the hook.
    //
    // ROTATE THE VELOCITY, DO NOT ADD TO IT. A sideways force
    // accelerates the marble, and a shot that gets FASTER as it curves
    // reads as a bug even when the numbers are right.
    //
    // AND THE TURN RATE GOES AS 1/SPEED, which is the whole feel. A
    // constant turn rate was the first attempt and it is wrong twice:
    // on a sheet this long a full-power throw is airborne for four
    // seconds, so any rate big enough to see turned the shot through
    // a hundred and sixty degrees — the marble drew a circle. Going as
    // 1/v it is a constant sideways ACCELERATION expressed as a
    // rotation, so the marble runs almost true while it is fast and
    // BREAKS at the end, which is what a curling stone does and what
    // makes the shot readable: it goes where you aimed, and then it
    // goes somewhere better.
    if (m.curl) {
      const w = m.curl * PHYS.curlRate * dt / Math.max(2.4, sp);
      const c = Math.cos(w), s2 = Math.sin(w);
      const vx = m.vx * c - m.vz * s2;
      m.vz = m.vx * s2 + m.vz * c;
      m.vx = vx;
    }

    // --- friction, as a constant deceleration. Not an exponential
    // decay: a decay never actually stops, and "comes to rest" is the
    // single most important verb in this game.
    const dec = PHYS.gripBase * m.grip * dt;
    if (sp <= dec) { m.vx = m.vz = 0; sp = 0; }
    else { const k = (sp - dec) / sp; m.vx *= k; m.vz *= k; sp -= dec; }

    m.x += m.vx * dt;
    m.z += m.vz * dt;
    m.spin += sp * dt * 2.4;

    // --- rails
    const lim = field.halfW - m.r;
    if (m.x < -lim) { m.x = -lim - (m.x + lim) * PHYS.railBounce; m.vx = Math.abs(m.vx) * PHYS.railBounce; railHit(W, m, 1, 0); }
    else if (m.x > lim) { m.x = lim - (m.x - lim) * PHYS.railBounce; m.vx = -Math.abs(m.vx) * PHYS.railBounce; railHit(W, m, -1, 0); }
    const nearZ = field.bench - m.r, farZ = field.far + m.r;
    if (m.z < farZ) { m.z = farZ - (m.z - farZ) * PHYS.railBounce; m.vz = Math.abs(m.vz) * PHYS.railBounce; railHit(W, m, 0, 1); }
    else if (m.z > nearZ) { m.z = nearZ - (m.z - nearZ) * PHYS.railBounce; m.vz = -Math.abs(m.vz) * PHYS.railBounce; railHit(W, m, 0, -1); }

    // --- the plough. Continuous in the substep, so nothing is stepped
    // over. A small enemy dies outright unless the marble has slowed
    // to a crawl; a brute is a wall.
    if (sp > 1.2) sweep(W, m, sp, dt);

    // --- rest
    if (sp > 0 && sp < PHYS.minSpeed) {
      m.vx = m.vz = 0;
      m.moving = false;
      W.onPlant(m);
    } else if (sp === 0 && m.moving) {
      m.moving = false;
      W.onPlant(m);
    }
  }

  // --- marble on marble. O(n²) over a dozen bodies, and the pair loop
  // is where the game's whole chain lives.
  for (let i = 0; i < marbles.length; i++) {
    const a = marbles[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < marbles.length; j++) {
      const b = marbles[j];
      if (!b.alive) continue;
      if (!a.moving && !b.moving) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const rr = a.r + b.r;
      let d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, nz = dz / d;

      // separate first, by mass share, so a heavy marble shoves a light
      // one aside rather than both meeting in the middle
      const overlap = rr - d;
      const tot = a.mass + b.mass;
      a.x -= nx * overlap * (b.mass / tot); a.z -= nz * overlap * (b.mass / tot);
      b.x += nx * overlap * (a.mass / tot); b.z += nz * overlap * (a.mass / tot);

      const rvx = b.vx - a.vx, rvz = b.vz - a.vz;
      const sep = rvx * nx + rvz * nz;
      if (sep > 0) continue;                        // already parting
      const imp = -(1 + PHYS.ballBounce) * sep / (1 / a.mass + 1 / b.mass);
      a.vx -= imp * nx / a.mass; a.vz -= imp * nz / a.mass;
      b.vx += imp * nx / b.mass; b.vz += imp * nz / b.mass;
      if (!a.moving && Math.hypot(a.vx, a.vz) > PHYS.minSpeed) a.moving = true;
      if (!b.moving && Math.hypot(b.vx, b.vz) > PHYS.minSpeed) b.moving = true;

      const force = clamp(-sep / 12, 0, 1);
      hits++;
      // the contact normal travels with the event: a burst fires ALONG
      // the blow that set it off, which is what turns a carom from
      // "set off a firework" into "aim a firework"
      W.onClack(a, b, force, (a.x + b.x) / 2, (a.z + b.z) / 2, nx, nz);
    }
  }
  return hits;
}

function railHit(W, m, nx, nz) {
  const sp = Math.hypot(m.vx, m.vz);
  if (sp < 1) return;
  W.onRail(m, nx, nz, clamp(sp / PHYS.maxSpeed, 0, 1));
}

/**
 * the sweep: what a moving marble does to the tide it passes through.
 *
 * A SMALL ENEMY IS NOT COLLIDED WITH, IT IS DELETED. The marble keeps
 * its heading exactly; all it loses is a fraction of its speed per
 * kill. Anything else — even a token impulse per enemy — turns a
 * clean shot through a crowd into a random walk, and the shot is the
 * thing the player aimed.
 */
function sweep(W, m, sp, dt) {
  const { tide } = W;
  let drag = 0;
  // the query has to cover the biggest enemy's RADIUS, not an
  // arbitrary margin: `each` filters on centre distance
  tide.each(m.x, m.z, m.r + MAX_FOE_R, (i) => {
    const rr = m.r + tide.radiusOf(i);
    const dx = tide.x[i] - m.x, dz = tide.z[i] - m.z;
    if (dx * dx + dz * dz > rr * rr) return false;

    // A THING A MARBLE BOUNCES OFF is exempt from the mark below: that
    // is a rebound, not a crush, and a marble may legitimately hit one
    // twice. A brute is a wall; a carapace is a lighter one.
    const bounce = tide.bounceOf(i);
    if (bounce > 0) {
      const d = Math.hypot(dx, dz) || 1;
      const nx = dx / d, nz = dz / d;
      const into = m.vx * nx + m.vz * nz;
      if (into > 0) {
        const e = PHYS.bruteBounce * bounce;
        m.vx -= (1 + e) * into * nx;
        m.vz -= (1 + e) * into * nz;
        m.x = tide.x[i] - nx * rr * 1.02;
        m.z = tide.z[i] - nz * rr * 1.02;
        // A CLASH IS WORTH ABOUT A QUARTER OF A BIG ONE, and that is
        // the whole rule: the FIRST boss goes down in four full-power
        // rams to any of the four kinds the bag starts with (three to
        // a Spike), a Boulder does it in two, and the wave scaling
        // takes it from there. Measured down a clear lane from the
        // hand — traffic on the way costs speed, and speed is linear
        // in here, so a ram through a crowd is worth proportionally
        // less. That is the trade and it is the right one.
        //
        // `mass` WAS IN HERE AND IT WAS THE SAME FACT TWICE. Every
        // kind in the roster is authored at `impact ≈ 1.4 × mass`, so
        // multiplying the two SQUARED the weight axis: the spread from
        // a Goo to a Boulder came out 11.5×, which is why no single
        // sentence about what a ram is worth was ever true of both
        // ends of the roster — this comment used to claim 2% and 18%
        // in the same breath and both were measurements. It is 3.8×
        // now, the spread `impact` was written to have. Weight still
        // does its job one line up, in the rebound, and in the clack
        // that shoves your own marble — which is what the `denser`
        // card has always actually been buying.
        const dmg = m.mods.impact * m.K.impact * sp * (2 - bounce) * 9.2;
        W.onBruteHit(m, i, dmg, sp / PHYS.maxSpeed * bounce);
      }
      return false;
    }

    // ONCE PER MARBLE PER ENEMY. The substep count comes from the frame
    // time, so damage and drag charged per substep made the plough hit
    // harder and slow more on a fast display than on a slow one — the
    // same throw, two different games.
    if (tide.mark[i] === m.uid) return false;
    tide.mark[i] = m.uid;

    // THE CRUSH IS A KILL, and it is not a damage number.
    //
    // It used to scale with momentum, and the effect in play was that a
    // marble visibly rolled straight over things and they got up: a
    // slow marble tickled a walker for a ninth of its life, which reads
    // as the game refusing the hit you can see landing. If a marble
    // goes over something small, that thing dies — whatever its hit
    // points say. What speed buys is not lethality, it is REACH: a
    // marble slows for every body it ploughs, so how deep the lane goes
    // is still decided by how hard you threw.
    W.onCrush(m, i);
    // `plow` is the "heavier roll" card: speed KEPT per body, which is
    // reach through a crowd — the only thing left for a crush card to
    // buy now that a crush always kills
    drag += PHYS.crushDrag * (tide.radiusOf(i) / .26) * (1 - m.mods.plow);
    return false;
  });
  if (drag > 0) {
    const k = Math.max(.35, 1 - drag);
    m.vx *= k; m.vz *= k;
  }
}

/**
 * THE AIM PREVIEW. The same integrator, run forward with nothing else
 * in the world but the rails — so the dotted line the player follows
 * is drawn by the code that will actually move the marble, curve and
 * all. A preview computed by a second, simpler formula is a preview
 * that lies, and it lies worst exactly where the shot is interesting.
 *
 * `maxDist` cuts it short: it is a LEAD, not a solution.
 *
 * The swarm is left OUT of it on purpose: the plough drag depends on
 * how many enemies are standing there when the marble arrives, which
 * is not knowable, and a preview that flickers as the tide walks
 * through it is unreadable. So the line is the shot on an empty
 * table: true at the start, honest about the hook, and short of the
 * truth once it starts killing things — which is the right way round.
 */
export function previewPath(kind, K, mods, x0, z0, dirX, dirZ, power, field, out,
                            maxDist = Infinity) {
  const grip = K.friction * (1 - mods.slide);
  let x = x0, z = z0;
  let vx = dirX * power * PHYS.maxSpeed, vz = dirZ * power * PHYS.maxSpeed;
  const dt = 1 / 60;
  let n = 0, travelled = 0;
  out.length = 0;
  for (let i = 0; i < 460 && n < 96; i++) {
    let sp = Math.hypot(vx, vz);
    if (sp < PHYS.minSpeed) break;
    if (K.curl) {
      const w = K.curl * PHYS.curlRate * dt / Math.max(2.4, sp);
      const c = Math.cos(w), s = Math.sin(w);
      const nx = vx * c - vz * s;
      vz = vx * s + vz * c; vx = nx;
    }
    const dec = PHYS.gripBase * grip * dt;
    if (sp <= dec) break;
    const k = (sp - dec) / sp; vx *= k; vz *= k;
    const px = x, pz = z;
    x += vx * dt; z += vz * dt;
    travelled += Math.hypot(x - px, z - pz);
    // THE LINE ONLY LEADS. Drawn to the resting place it answered the
    // whole question — direction, hook and distance — and a throw with
    // no question left in it is a throw you are executing rather than
    // making. It stops after the first few units, which is enough to
    // aim by and not enough to plan by.
    if (travelled > maxDist) break;
    const r = K.radius;
    const lim = field.halfW - r;
    if (x < -lim) { x = -lim; vx = Math.abs(vx) * PHYS.railBounce; }
    else if (x > lim) { x = lim; vx = -Math.abs(vx) * PHYS.railBounce; }
    if (z < field.far + r) { z = field.far + r; vz = Math.abs(vz) * PHYS.railBounce; }
    else if (z > field.bench - r) { z = field.bench - r; vz = -Math.abs(vz) * PHYS.railBounce; }
    if (i % 5 === 0) { out.push(x, z); n++; }
  }
  return n;
}
