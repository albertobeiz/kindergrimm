// ---------------------------------------------------------------
// THE WEAPONS — what a planted marble does to the tide.
//
// Every ability in `mkinds.js` is spelled out of the five verbs in
// this file, and that is the point: a kind names a verb and some
// numbers, exactly the way a drawn part names a medium and some
// numbers. Nothing in the roster touches three.js, spawns a mesh or
// knows what a projectile looks like — so adding a kind is arithmetic,
// and the whole catalogue stays visually consistent for free.
//
//   pellet   a thing that travels and hits
//   blast    a circle of damage, right now
//   zap      a chain that hops from body to body
//   field    a circle that keeps mattering for a few seconds
//
// PROJECTILES ARE PARALLEL ARRAYS AND ONE INSTANCED MESH, for the same
// reason the tide is: a shooter marble fires twice a second, ten of
// them fire twenty times a second, and none of that may hand the
// collector anything.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { MAX_FOE_R } from './mfoes.js';
import { FIELD } from './mtable.js';

const MAX_SHOTS = 260;
const MAX_FIELDS = 26;

/** the glow every projectile is drawn with: a soft ball of light that
 *  survives being 6 pixels across at the far end of the table. A lit
 *  material would go grey up there — these are unlit and untonemapped
 *  on purpose, so a pellet is the same brightness wherever it is. */
function shotGeometry() {
  return new THREE.SphereGeometry(1, 8, 6);
}

function fieldTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,.62)');
  grad.addColorStop(.55, 'rgba(255,255,255,.34)');
  grad.addColorStop(.86, 'rgba(255,255,255,.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
  // a soft ragged rim, so a pool reads as spilled and not as a decal
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2, r = 60 + Math.sin(i * 2.7) * 5;
    g.beginPath();
    g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 9 + Math.sin(i * 1.9) * 4, 0, 7);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

export function createCombat(scene, { tide, fx, snd, mods, hurtMarble }) {
  // ---- projectiles ----------------------------------------------------
  const px = new Float32Array(MAX_SHOTS), pz = new Float32Array(MAX_SHOTS);
  const py = new Float32Array(MAX_SHOTS);
  const vx = new Float32Array(MAX_SHOTS), vz = new Float32Array(MAX_SHOTS);
  const life = new Float32Array(MAX_SHOTS), dmg = new Float32Array(MAX_SHOTS);
  const rad = new Float32Array(MAX_SHOTS), splash = new Float32Array(MAX_SHOTS);
  const arc = new Float32Array(MAX_SHOTS), t0 = new Float32Array(MAX_SHOTS);
  const span = new Float32Array(MAX_SHOTS);
  const target = new Int16Array(MAX_SHOTS);
  const targetGen = new Uint16Array(MAX_SHOTS);
  const pierce = new Int8Array(MAX_SHOTS);
  const burn = new Float32Array(MAX_SHOTS), slow = new Float32Array(MAX_SHOTS);
  const live = new Uint8Array(MAX_SHOTS);
  const colR = new Float32Array(MAX_SHOTS), colG = new Float32Array(MAX_SHOTS), colB = new Float32Array(MAX_SHOTS);
  const trail = new Uint8Array(MAX_SHOTS);
  // HOSTILE SHOTS RIDE THE SAME ARRAYS. A spitter's bolt is a pellet
  // that homes on a marble instead of on an enemy and hurts the other
  // side when it lands — one flag and one reference, rather than a
  // second pool with its own update, its own mesh and its own bugs.
  const foe = new Uint8Array(MAX_SHOTS);
  const tgt = new Array(MAX_SHOTS).fill(null);
  let head = 0, shots = 0;

  const mesh = new THREE.InstancedMesh(
    shotGeometry(),
    new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: .96 }),
    MAX_SHOTS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 4;
  scene.add(mesh);

  // ---- fields ---------------------------------------------------------
  const fx0 = new Float32Array(MAX_FIELDS), fz0 = new Float32Array(MAX_FIELDS);
  const fr = new Float32Array(MAX_FIELDS), ft = new Float32Array(MAX_FIELDS);
  const fmax = new Float32Array(MAX_FIELDS);
  const fdps = new Float32Array(MAX_FIELDS), fslow = new Float32Array(MAX_FIELDS);
  const fburn = new Float32Array(MAX_FIELDS);
  const flive = new Uint8Array(MAX_FIELDS);
  const fcol = [];
  let fhead = 0;

  const fieldMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: fieldTexture(), transparent: true, depthWrite: false,
      toneMapped: false, blending: THREE.NormalBlending, opacity: .9,
    }),
    MAX_FIELDS);
  fieldMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fieldMesh.setColorAt(0, new THREE.Color(1, 1, 1));
  fieldMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  fieldMesh.rotation.x = -Math.PI / 2;
  fieldMesh.position.y = .012;
  fieldMesh.frustumCulled = false;
  fieldMesh.renderOrder = 3;
  fieldMesh.count = 0;
  scene.add(fieldMesh);

  const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const C = new THREE.Color();
  let now = 0;

  // ---------------------------------------------------------------
  // THE VERBS
  // ---------------------------------------------------------------

  /** a travelling shot. `arc` lifts it off the floor in a lob — a
   *  fireball that flies flat reads as a laser, and the lob is most of
   *  what makes the fire marble read as artillery. */
  function pellet(o) {
    // THE RING BUFFER OVERWRITES THE OLDEST SHOT rather than dropping
    // the newest: a dropped new shot is a weapon that silently stops
    // firing when the screen is busy, which is the worst moment for it.
    // The scan has to fall back to `head` and not to wherever it
    // stopped — landing on `head - 1` meant a full pool destroyed the
    // shot fired an instant earlier, for ever, and never rotated.
    let i = head, found = false;
    for (let n = 0; n < MAX_SHOTS; n++) {
      const k = (head + n) % MAX_SHOTS;
      if (!live[k]) { i = k; found = true; break; }
    }
    head = (i + 1) % MAX_SHOTS;
    if (found) shots++;

    const dx = o.tx - o.x, dz = o.tz - o.z;
    const d = Math.hypot(dx, dz) || 1;
    live[i] = 1;
    px[i] = o.x; pz[i] = o.z; py[i] = o.y ?? .34;
    vx[i] = dx / d * o.speed; vz[i] = dz / d * o.speed;
    life[i] = o.life ?? Math.min(2.2, d / o.speed + .25);
    span[i] = life[i]; t0[i] = 0;
    dmg[i] = o.dmg; rad[i] = o.size ?? .17; splash[i] = o.splash ?? 0;
    arc[i] = o.arc ?? 0; target[i] = o.target ?? -1;
    pierce[i] = o.pierce ?? 0; burn[i] = o.burn ?? 0; slow[i] = o.slow ?? 0;
    trail[i] = o.trail ? 1 : 0;
    foe[i] = o.foe ? 1 : 0; tgt[i] = o.marble ?? null;
    C.set(o.color);
    colR[i] = C.r; colG[i] = C.g; colB[i] = C.b;
  }

  /** damage in a circle, immediately. The one verb everything else is
   *  written in terms of. */
  function blast(x, z, r, damage, o = {}) {
    let hits = 0;
    tide.each(x, z, r + MAX_FOE_R, (i) => {
      const dx = tide.x[i] - x, dz = tide.z[i] - z;
      const d = Math.hypot(dx, dz);
      if (d > r + tide.radiusOf(i)) return false;
      // falloff, because a blast with a hard edge reads as a hitbox:
      // full damage at the centre, three-fifths at the rim
      const k = 1 - .4 * (d / r);
      tide.hurt(i, damage * k, o);
      hits++;
      return false;
    });
    if (o.quiet !== true) {
      if (o.nova) fx.nova(x, z, r, o.color ?? '#B8E4FF');
      else fx.blast(x, z, r, o.color ?? '#FFB65A');
    }
    return hits;
  }

  /** a chain that hops. Each hop is a bolt drawn between two enemies,
   *  and it will not hop back to something it has already hit — a
   *  chain that ping-pongs between two bodies looks broken even when
   *  the damage is right. */
  const seen = new Set();
  function zap(x, z, hops, damage, o = {}) {
    seen.clear();
    let cx = x, cz = z, hit = 0;
    const range = o.range ?? 3.2;
    const color = o.color ?? '#FFF0A8';
    for (let n = 0; n < hops; n++) {
      const i = tide.nearest(cx, cz, range, j => !seen.has(j));
      if (i < 0) break;
      seen.add(i);
      fx.zap(cx, cz, tide.x[i], tide.z[i], color);
      // each hop is worth a little less, so a long chain is a reward
      // for placement rather than a reason to only ever build chains
      tide.hurt(i, damage * Math.pow(.88, n), o);
      cx = tide.x[i]; cz = tide.z[i];
      hit++;
    }
    if (hit) snd.sfx('zap', { vol: .5 + .04 * hit, pan: pan(x), cool: .05 });
    return hit;
  }

  /** a circle that keeps mattering. Slows, burns, or both. */
  function field(x, z, r, secs, o = {}) {
    let i = fhead;
    for (let n = 0; n < MAX_FIELDS; n++) {
      const k = (fhead + n) % MAX_FIELDS;
      if (!flive[k]) { i = k; break; }
    }
    fhead = (i + 1) % MAX_FIELDS;
    flive[i] = 1;
    fx0[i] = x; fz0[i] = z; fr[i] = r;
    ft[i] = fmax[i] = secs;
    fdps[i] = o.dps ?? 0; fslow[i] = o.slow ?? 0; fburn[i] = o.burn ?? 0;
    fcol[i] = new THREE.Color(o.color ?? '#7ED9B0');
  }

  const pan = x => Math.max(-.8, Math.min(.8, x / 6));
  const offRink = (x, z) =>
    x < -FIELD.halfW - .6 || x > FIELD.halfW + .6 || z < FIELD.far - 1 || z > FIELD.back;

  // ---------------------------------------------------------------
  function step(dt, t) {
    now = t;

    // --- shots
    let n = 0;
    for (let i = 0; i < MAX_SHOTS; i++) {
      if (!live[i]) continue;
      t0[i] += dt;
      life[i] -= dt;

      if (life[i] <= 0 || offRink(px[i], pz[i])) { live[i] = 0; shots--; continue; }

      if (foe[i]) {
        // a spitter's bolt: it homes on the marble it was aimed at,
        // and if that marble is gone before it arrives it simply flies
        // on and expires — a shot that vanishes when its target dies
        // reads as the game taking the shot back
        const m = tgt[i];
        if (m && m.alive) {
          const dx = m.x - px[i], dz = m.z - pz[i];
          const d = Math.hypot(dx, dz) || 1;
          const sp = Math.hypot(vx[i], vz[i]);
          const k = Math.min(1, dt * 4.5);
          vx[i] += (dx / d * sp - vx[i]) * k;
          vz[i] += (dz / d * sp - vz[i]) * k;
          if (d < m.r + rad[i] + .05) {
            hurtMarble?.(m, dmg[i]);
            fx.spark(px[i], pz[i], '#9BE8D2', 5);
            live[i] = 0; shots--;
            continue;
          }
        }
        px[i] += vx[i] * dt; pz[i] += vz[i] * dt;
        py[i] = .34 + (arc[i] ? Math.sin(Math.PI * Math.min(1, t0[i] / span[i])) * arc[i] : 0);
        S.setScalar(rad[i]);
        M.compose(V.set(px[i], py[i], pz[i]), Q.identity(), S);
        mesh.setMatrixAt(n, M);
        C.setRGB(colR[i], colG[i], colB[i]);
        mesh.setColorAt(n, C);
        n++;
        if (trail[i]) fx.trailPoint(px[i], pz[i], rad[i] * .8, colorOf(i));
        continue;
      }

      // mild homing: a pellet aimed at where an enemy WAS misses a
      // moving one every time, and a shooter that misses reads as
      // broken rather than as fair
      if (target[i] >= 0 && tide.alive[target[i]] && tide.gen[target[i]] === targetGen[i]) {
        const j = target[i];
        const dx = tide.x[j] - px[i], dz = tide.z[j] - pz[i];
        const d = Math.hypot(dx, dz) || 1;
        const sp = Math.hypot(vx[i], vz[i]);
        const k = Math.min(1, dt * 6);
        vx[i] += (dx / d * sp - vx[i]) * k;
        vz[i] += (dz / d * sp - vz[i]) * k;
      }

      px[i] += vx[i] * dt; pz[i] += vz[i] * dt;
      py[i] = .34 + (arc[i] ? Math.sin(Math.PI * Math.min(1, t0[i] / span[i])) * arc[i] : 0);

      // NOTHING LEAVES THE RINK. A shot whose target died flies on by
      // design — that is better than one that vanishes when its target
      // does — but it must not fly out over the boards and off into the
      // room, which is what a spitter's bolt did whenever the marble it
      // was aimed at melted first.
      let done = false;
      if (!done) {
        tide.each(px[i], pz[i], rad[i] + MAX_FOE_R, (j) => {
          const rr = rad[i] + tide.radiusOf(j);
          const dx = tide.x[j] - px[i], dz = tide.z[j] - pz[i];
          if (dx * dx + dz * dz > rr * rr) return false;
          if (splash[i] > 0) {
            blast(px[i], pz[i], splash[i], dmg[i], {
              color: `rgb(${colR[i] * 255 | 0},${colG[i] * 255 | 0},${colB[i] * 255 | 0})`,
              burn: burn[i], slow: slow[i],
            });
            snd.sfx('boom', { pan: pan(px[i]), cool: .04 });
          } else {
            tide.hurt(j, dmg[i], { burn: burn[i], slow: slow[i] });
            fx.spark(px[i], pz[i], colorOf(i), 3);
          }
          if (pierce[i] > 0) { pierce[i]--; return false; }
          done = true;
          return true;
        });
      }
      if (done) { live[i] = 0; shots--; continue; }

      S.setScalar(rad[i]);
      M.compose(V.set(px[i], py[i], pz[i]), Q.identity(), S);
      mesh.setMatrixAt(n, M);
      C.setRGB(colR[i], colG[i], colB[i]);
      mesh.setColorAt(n, C);
      n++;
      if (trail[i]) fx.trailPoint(px[i], pz[i], rad[i] * .8, colorOf(i));
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // --- fields
    let fn = 0;
    for (let i = 0; i < MAX_FIELDS; i++) {
      if (!flive[i]) continue;
      ft[i] -= dt;
      if (ft[i] <= 0) { flive[i] = 0; continue; }
      if (fdps[i] || fslow[i] || fburn[i]) {
        tide.each(fx0[i], fz0[i], fr[i], (j) => {
          if (fdps[i]) tide.hurt(j, fdps[i] * dt, {});
          if (fslow[i]) tide.chill(j, fslow[i], .35);
          if (fburn[i]) tide.hurt(j, 0, { burn: fburn[i], burnFor: .6 });
          return false;
        });
      }
      // it grows in fast and shrinks out slowly — a pool that pops out
      // of existence reads as a bug, and a fade alone reads as fog
      const u = 1 - ft[i] / fmax[i];
      const grow = Math.min(1, u * 6);
      const fade = Math.min(1, ft[i] / .6);
      const r = fr[i] * 2 * grow * (.9 + .1 * Math.sin(now * 3 + i));
      M.makeScale(r, r, 1);
      M.elements[12] = fx0[i]; M.elements[13] = -fz0[i]; M.elements[14] = 0;
      fieldMesh.setMatrixAt(fn, M);
      C.copy(fcol[i]).multiplyScalar(.55 + .45 * fade);
      fieldMesh.setColorAt(fn, C);
      fn++;
    }
    fieldMesh.count = fn;
    fieldMesh.instanceMatrix.needsUpdate = true;
    if (fieldMesh.instanceColor) fieldMesh.instanceColor.needsUpdate = true;
  }

  const tmpC = new THREE.Color();
  const colorOf = i => tmpC.setRGB(colR[i], colG[i], colB[i]).getStyle();

  function clear() {
    live.fill(0); flive.fill(0); shots = 0;
    mesh.count = 0; fieldMesh.count = 0;
  }

  /** a spitter's bolt. Named rather than a flag on `pellet`, because
   *  the call site reads as what it is: the tide shooting back. */
  function foeShot(x, z, marble, damage) {
    pellet({
      x, z, tx: marble.x, tz: marble.z, marble, foe: 1,
      speed: 6.5, dmg: damage, size: .17, color: '#7FE0C4', arc: .5, trail: 1, life: 3,
    });
    snd.sfx('pop', { pan: pan(x), vol: .3, rate: .7, cool: .06 });
  }

  return {
    pellet, blast, zap, field, foeShot, step, clear,
    stats: () => ({ shots, fields: flive.reduce((a, v) => a + v, 0) }),
  };
}
