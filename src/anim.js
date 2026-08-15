// Animator: drives a built character. Three stacked systems, all of
// them writing OFFSETS from each bone's rest position:
//
//   AUTONOMIC life — boil, blink, gaze, sway, breath, talk, the arm
//     hang and the tail wag. Always running; poses and expressions
//     scale it through `auto` multipliers (sleep turns the gaze off
//     and the breath up) instead of replacing it, which is what keeps
//     a sitting character alive rather than frozen.
//
//   POSES (src/poses/) — idle, walk, run, sit, sleep, attack. Each
//     pose writes bone/group offsets scaled by its blend weight, and
//     transitions simply move the weights: two poses mix, so nothing
//     snaps. One gait phase is shared by walk and run, so a tempo
//     change never teleports a foot. One-shots (attack) play out and
//     hand back to the pose underneath.
//
//   EXPRESSIONS (src/expressions.js) — the face. Texture swaps are
//     binary, so they land while a blink has the eyes shut; the body
//     language (brows, shiver, sob) rides its own crossfade weight.
import { BOIL_FRAMES, U } from './part.js';
import { POSE_BY_ID } from './poses/index.js';
import { EXPRESSIONS } from './expressions.js';

const DIRS = ['left', 'right', 'up', 'down'];
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
const TRANS = .38;         // pose crossfade, seconds
const SHOT_TRANS = .13;    // one-shots hit faster
const FACE_TRANS = .5;     // expression body-language ramp
const sstep = w => w * w * (3 - 2 * w);
// Parts that are bolted to a hand rather than to the body: they take
// the arm's transform wholesale instead of accumulating their own.
// A worn hat is NOT in here — it lives on the head like a crest.
const GEAR = new Set(['held', 'offhand']);

export function createAnimator(getFace, opts) {
  // opts = { blink, talk, sway, breath, gaze, boil, boilSpeed, phase, amp }
  // ---- autonomic state ----
  let nextBlink = 1.5, blinkT = -1;
  let talkT = 0, talkOpen = false, talkS = 1;
  let gazeDir = null, gazeUntil = 0, nextGaze = 1 + Math.random() * 4;
  let gazeQueue = [];
  // head-follow runs on a loose spring so it OVERSHOOTS and settles —
  // a cartoon head whips after the eyes, it doesn't ease into place
  let gx = 0, gy = 0, gvx = 0, gvy = 0;

  // ---- pose state ----
  const layers = [{ def: POSE_BY_ID.idle, w: 1, target: 1, time: 0 }];
  let basePose = 'idle';           // what a one-shot returns to
  let gait = 0, speed = 1;

  // ---- expression state ----
  let faceCur = 'idle', facePrev = 'idle', faceW = 1, faceSrc = 'init';
  let pending = null, pendingAge = 0;   // the face waiting for its blink

  // ---- the accumulators everything writes into ----
  // r*: the whole character (rotates about the FEET so the soles stay
  // planted), h*: the head group, b*: the body group.
  const A = { rx: 0, ry: 0, rrot: 0, hx: 0, hy: 0, hrot: 0, hs: 0, bx: 0, by: 0, bsx: 0, bsy: 0 };
  let stateReq = {};
  let cw = 0;                      // blend weight of whoever writes now
  const ctx = {
    t: 0, dt: 0, time: 0, w: 0, face: null, F: null, B: null, S: 0, base: 'biped',
    get gait() { return gait; },
    get speed() { return speed; },
    root(dx, dy, rot = 0) { A.rx += dx / U * cw; A.ry += dy / U * cw; A.rrot += rot * cw; },
    head(dx, dy, rot = 0, ds = 0) { A.hx += dx / U * cw; A.hy += dy / U * cw; A.hrot += rot * cw; A.hs += ds * cw; },
    body(dsx = 0, dsy = 0, dx = 0, dy = 0) { A.bsx += dsx * cw; A.bsy += dsy * cw; A.bx += dx / U * cw; A.by += dy / U * cw; },
    bone(e, o) {
      const a = e.acc ??= { x: 0, y: 0, rot: 0, sx: 0, sy: 0 };
      if (o.dx) a.x += o.dx / U * cw;
      if (o.dy) a.y += o.dy / U * cw;
      if (o.rot) a.rot += o.rot * cw;
      if (o.sx) a.sx += o.sx * cw;
      if (o.sy) a.sy += o.sy * cw;
    },
    each(id, fn) { for (const e of ctx.face.byId(id)) fn(e); },
    // texture requests only land once the writer really owns the body:
    // a flip-book frame snapping in at 3% weight would read as a glitch
    state(id, st) {
      if (cw < .45) return;
      const r = stateReq[id];
      if (!r || cw > r.w) stateReq[id] = { st, w: cw };
    },
  };

  function setFace(id, src = 'user') {
    if (!EXPRESSIONS[id]) return;
    // choosing 'idle' releases the user's claim, so a later sleep can
    // shut the eyes again
    if (src === 'user' && id === 'idle') src = 'init';
    if ((pending?.id ?? faceCur) === id) { if (src === 'user') faceSrc = 'user'; return; }
    pending = { id, src };
    pendingAge = 0;
    // pull a blink forward: the texture swap hides behind shut lids
    if (blinkT <= 0) { blinkT = .13; nextBlink = 1.2 + Math.random() * 3; }
  }

  function setPose(id, o) {
    const def = POSE_BY_ID[id];
    if (!def) return;
    if (o?.speed != null) speed = o.speed;
    const top = layers[layers.length - 1];
    if (top.def.id === id && top.target === 1) {
      if (def.oneShot) top.time = 0;     // re-trigger the hit
      return;
    }
    if (!def.oneShot) basePose = id;
    for (const l of layers) l.target = 0;
    let layer = layers.find(l => l.def.id === id);
    if (layer) { layers.splice(layers.indexOf(layer), 1); layer.target = 1; layer.time = 0; }
    else layer = { def, w: 0, target: 1, time: 0 };
    layers.push(layer);
    // a pose can bring its own face (sleep shuts the eyes) — but it
    // never overrides one the user chose explicitly
    if (def.face && faceSrc !== 'user') setFace(def.face, 'pose');
    else if (!def.face && faceSrc === 'pose' && !def.oneShot) setFace('idle', 'init');
  }

  return {
    setPose,
    setFace: id => setFace(id, 'user'),
    pose: () => layers[layers.length - 1].def.id,
    face: () => pending?.id ?? faceCur,

    update(t, dt) {
      const face = getFace();
      if (!face) return;
      const amp = opts.amp ?? 1;
      const tt = t + (opts.phase ?? 0);

      const bspeed = opts.boilSpeed ?? 1;
      for (const e of face.entries)
        e.part.setFrame(opts.boil ? ((t * e.part.fps * bspeed + e.part.off) | 0) % BOIL_FRAMES : 0);

      // ---- pose weights: linear ramps, eased and normalized on use --
      for (const l of layers) {
        l.time += dt;
        const rate = dt / (l.def.oneShot ? SHOT_TRANS : TRANS);
        l.w = l.target > l.w ? Math.min(l.target, l.w + rate) : Math.max(0, l.w - rate);
      }
      for (let i = layers.length - 1; i >= 0; i--)
        if (layers[i].w <= 0 && layers[i].target === 0 && layers.length > 1) layers.splice(i, 1);
      const top = layers[layers.length - 1];
      if (top.def.oneShot && top.target === 1 && top.time > top.def.dur) setPose(basePose);

      let wTot = 0;
      const ws = layers.map(l => { const e = sstep(l.w); wTot += e; return e; });
      if (wTot > 1e-6) for (let i = 0; i < ws.length; i++) ws[i] /= wTot;

      const fw = sstep(faceW);
      const eCur = EXPRESSIONS[faceCur], ePrev = EXPRESSIONS[facePrev];
      const auto = k => {
        let v = 0;
        for (let i = 0; i < layers.length; i++) v += ws[i] * (layers[i].def.auto?.[k] ?? 1);
        const a = ePrev.auto?.[k] ?? 1, b = eCur.auto?.[k] ?? 1;
        return v * (a + (b - a) * fw);
      };

      // one shared gait phase: walk and run agree on where the feet are
      let hz = 0;
      for (let i = 0; i < layers.length; i++) hz += ws[i] * (layers[i].def.gaitHz ?? 0);
      gait += dt * hz * speed * Math.PI * 2;

      // ---- blink, and the mask a pending expression hides behind ----
      const blinkAmp = opts.blink ? auto('blink') : 0;
      if (blinkAmp > .25) {
        nextBlink -= dt;
        if (nextBlink < 0) {
          blinkT = .12;
          nextBlink = Math.random() < .15 ? .3 : 1.2 + Math.random() * 3.5;
        }
      }
      if (blinkT > 0) blinkT -= dt;
      if (pending) {
        pendingAge += dt;
        // commit while the lids are shut; if nothing can blink (sleep,
        // blink disabled), give up on the mask after a beat
        if ((blinkT > .04 && blinkT < .12) || pendingAge > .35) {
          facePrev = faceCur;
          faceCur = pending.id;
          faceSrc = pending.src;
          faceW = faceCur === facePrev ? 1 : 0;
          pending = null;
        }
      }
      faceW = Math.min(1, faceW + dt / FACE_TRANS);

      // ---- gaze: something catches the eye, gets looked at, let go --
      if (opts.gaze !== false && auto('gaze') > .2) {
        if (!gazeDir && t > nextGaze) {
          const d = DIRS[(Math.random() * DIRS.length) | 0];
          gazeQueue = Math.random() < .3 ? [d, OPPOSITE[d]] : [d];
          gazeDir = gazeQueue.shift();
          gazeUntil = t + .5 + Math.random() * 1.4;
        } else if (gazeDir && t > gazeUntil) {
          gazeDir = gazeQueue.shift() ?? null;
          if (gazeDir) gazeUntil = t + .4 + Math.random() * 1.1;
          else nextGaze = t + 1.5 + Math.random() * 4.5;
        }
      } else gazeDir = null;

      // the head whips after the eyes, overshoots, settles
      const txG = gazeDir === 'left' ? -1 : gazeDir === 'right' ? 1 : 0;
      const tyG = gazeDir === 'up' ? 1 : gazeDir === 'down' ? -1 : 0;
      const k = 105, damp = Math.pow(.0016, dt);   // frame-rate independent
      gvx = (gvx + (txG - gx) * k * dt) * damp;
      gvy = (gvy + (tyG - gy) * k * dt) * damp;
      gx += gvx * dt;
      gy += gvy * dt;

      // ---- talk: jittery open/idle swaps + a little jaw stretch ----
      if (opts.talk) {
        talkT -= dt;
        if (talkT < 0) { talkOpen = Math.random() < .55; talkT = .05 + Math.random() * .1; }
      } else talkOpen = false;
      talkS += ((talkOpen ? 1.18 : 1) - talkS) * Math.min(1, dt * 22);

      // ---- run the poses and the expression body language ----------
      A.rx = A.ry = A.rrot = A.hx = A.hy = A.hrot = A.hs = A.bx = A.by = A.bsx = A.bsy = 0;
      stateReq = {};
      for (const e of face.entries)
        if (e.acc) { const a = e.acc; a.x = a.y = a.rot = a.sx = a.sy = 0; }
      ctx.t = t; ctx.dt = dt; ctx.face = face;
      ctx.F = face.F; ctx.B = face.F.B; ctx.S = face.F.s;
      ctx.base = face.recipe.base ?? 'biped';
      for (let i = 0; i < layers.length; i++) {
        if (ws[i] < .003) continue;
        cw = ctx.w = ws[i]; ctx.time = layers[i].time;
        layers[i].def.update?.(ctx);
      }
      ctx.time = t;
      if (ePrev.update && 1 - fw > .003) { cw = ctx.w = 1 - fw; ePrev.update(ctx); }
      if (eCur.update && fw > .003) { cw = ctx.w = fw; eCur.update(ctx); }

      // ---- autonomic amplitudes, scaled by pose and expression -----
      const swAmp = (opts.sway ? auto('sway') : 0) * amp;
      const brMul = opts.breath ? auto('breath') : 0;
      const brAmp = brMul * amp;
      // a deep breath is also a slow one: sleep breathes at ~2/3 tempo
      const breath = brMul ? Math.sin(tt * 1.15 / (1 + Math.max(0, brMul - 1) * .55)) : 0;
      const swayX = Math.sin(tt * .55) * .010 * swAmp;
      const swayY = Math.cos(tt * .37) * .005 * swAmp;
      const armAmp = auto('arms') * amp;
      const tailAmp = auto('tail') * amp;

      // ---- apply --------------------------------------------------
      const head = face.headGroup ?? face.group;
      const feetY = -face.F.B.floorY / U;          // local y of the soles
      // the root rotation pivots on the feet: p += (I − R)·pivot
      const rr = A.rrot;
      const rox = Math.sin(rr) * feetY + A.rx;
      const roy = feetY * (1 - Math.cos(rr)) + A.ry;

      // the breath, taken by the WHOLE body, anchored at the feet;
      // pose body-scale composes on top of it, same anchor
      let headRide = 0;
      if (face.bodyGroup) {
        const chestY = -face.F.B.top / U;
        const syB = 1 + breath * .022 * brAmp;
        const sy = syB + A.bsy, sx = 1 - breath * .009 * brAmp + A.bsx;
        face.bodyGroup.scale.set(sx, sy, 1);
        face.bodyGroup.rotation.z = rr;
        face.bodyGroup.position.set(rox + A.bx, feetY * (1 - sy) + roy + A.by, 0);
        headRide = (chestY - feetY) * (syB - 1);
      }

      head.rotation.z = rr + Math.sin(tt * .6) * .017 * swAmp + A.hrot - gx * .075 * amp;
      head.position.x = rox + A.hx + gx * .022 * amp;
      head.position.y = roy + A.hy + Math.sin(tt * 1.1) * .004 * swAmp
        + breath * .004 * brAmp + headRide + gy * .016 * amp;
      head.scale.setScalar(1 + breath * .004 * brAmp + A.hs);

      // ---- per-bone: parallax, hang, wag, plus whatever the poses
      // and expressions accumulated ---------------------------------
      const browLift = (opts.talk ? Math.sin(t * 9 + 1) * .008 : 0)
        + gy * .022;                        // brows ride with the eyes
      // Gear rides the hand. A held object's bone sits at exactly the
      // arm's origin (see src/parts/gear.js), so handing it the arm's
      // finished transform makes it swing with that arm in every pose
      // — including poses written years from now, which is why this is
      // done here once rather than in each pose file. Two passes,
      // because entries come in registry order and nothing guarantees
      // the arm is reached first.
      const arms = {};
      for (const e of face.entries) if (e.id === 'arms') arms[e.side] = e;

      for (const e of face.entries) {
        if (GEAR.has(e.id)) continue;
        const base = e.bone.userData.base;
        const a = e.acc;
        let x = base.x + (a ? a.x : 0);
        let y = base.y + (a ? a.y : 0);
        if (e.region !== 'body') {
          x += (swayX + gx * .055) * e.depth;
          y += (swayY + gy * .042) * e.depth + breath * .003 * brAmp * e.depth
            + (e.id === 'brows' ? browLift : 0);
        }
        e.bone.position.x = x;
        e.bone.position.y = y;

        let rot = a ? a.rot : 0;
        if (e.id === 'arms') rot += Math.sin(tt * .8 + (e.side > 0 ? 1.7 : 0)) * .04 * armAmp * -e.side;
        if (e.id === 'tail') rot += Math.sin(tt * 2.6) * .13 * tailAmp * -e.side;
        e.bone.rotation.z = rot;

        let sx = 1 + (a ? a.sx : 0), sy = 1 + (a ? a.sy : 0);
        if (e.id === 'torso') sx += breath * .012 * brAmp;   // the chest swells a little more
        if (e.id === 'mouth') sy *= talkS;
        e.bone.scale.set(sx, sy, 1);
      }

      for (const e of face.entries) {
        if (!GEAR.has(e.id)) continue;
        const arm = arms[e.side];
        if (arm) {
          e.bone.position.copy(arm.bone.position);
          e.bone.rotation.z = arm.bone.rotation.z;
          e.bone.scale.copy(arm.bone.scale);
        } else {
          // no arm to hold it: fall back to its own rest pose so a
          // hatless-but-armless body still draws something sane
          const b = e.bone.userData.base, a = e.acc;
          e.bone.position.set(b.x + (a ? a.x : 0), b.y + (a ? a.y : 0), 0);
          e.bone.rotation.z = a ? a.rot : 0;
        }
      }

      // ---- texture states: expression first, pose requests over it,
      // then the involuntary overrides (blink shuts, talk opens) -----
      const want = Object.assign({}, eCur.states);
      for (const id in stateReq) want[id] = stateReq[id].st;
      want.eyes = (blinkAmp > 0 && blinkT > 0) ? 'closed' : (want.eyes ?? gazeDir ?? 'open');
      if (talkOpen) want.mouth = 'open';
      for (const e of face.entries) e.part.setState(want[e.id] ?? e.part.states[0]);
    },
  };
}
