// ---------------------------------------------------------------
// THE ANIMATOR — breath and face, and deliberately nothing else.
//
// A voxel character has no line boil to keep it alive and no poses to
// blend, so all the life comes from two places:
//
//   THE BREATH — the body group swells about the feet and the head
//     group rides up the exact amount the chest grew under it. That
//     one coupling is what stops a breathing character looking like a
//     head bobbing next to a torso. Plus a slow sway, because nobody
//     stands still.
//
//   THE FACE — blink, glance, talk and expression, and every one of
//     them is a VISIBILITY SWAP between meshes that were built once.
//     Nothing is rebuilt, nothing is re-meshed; a blink costs two
//     boolean writes. That is the whole reason the plate rule exists.
//
// Expressions land while the eyes are shut, the same trick the drawn
// generator uses: a discrete swap is invisible if it happens behind a
// blink, and obvious if it does not. The body language that goes with
// an expression (a droop, a lean, a shiver) is continuous and rides
// its own crossfade, so the mood arrives smoothly even though the face
// itself changed in one frame.
// ---------------------------------------------------------------

const DIRS = ['left', 'right', 'up', 'down'];
const FACE_TRANS = .45;
const sstep = w => w * w * (3 - 2 * w);

// TO ADD AN EXPRESSION: one entry. `states` names a state per part id
// (the part must declare it in `states`), the rest is body language.
export const VFACES = {
  idle: { label: 'idle', states: {} },
  happy: {
    label: 'happy', states: { eyes: 'happy', mouth: 'grin', brows: 'raised' },
    bounce: 1, breath: 1.2,
  },
  angry: {
    label: 'angry', states: { eyes: 'angry', mouth: 'angry', brows: 'angry' },
    lean: .10, breath: 1.7, shake: .5,
  },
  sad: {
    label: 'sad', states: { eyes: 'sad', mouth: 'sad', brows: 'sad' },
    droop: .13, breath: .75,
  },
  scared: {
    label: 'scared', states: { eyes: 'scared', mouth: 'open', brows: 'raised' },
    shiver: 1, breath: 2.1, lean: -.07,
  },
  asleep: {
    label: 'asleep', states: { eyes: 'closed', mouth: 'sleep', brows: 'sad' },
    droop: .2, breath: 2.6, blink: 0, gaze: 0,
  },
};
export const VFACE_IDS = Object.keys(VFACES);

export function createVoxelAnimator(getChar, opts) {
  // opts = { breath, sway, blink, gaze, talk, amp, phase }
  let nextBlink = 1.4, blinkT = -1;
  let gazeDir = null, gazeUntil = 0, nextGaze = .6 + Math.random() * 2;
  let gx = 0, gy = 0, gvx = 0, gvy = 0;          // the head chases the eyes
  let talkT = 0, talkOpen = false;
  let cur = 'idle', prev = 'idle', w = 1, pending = null, pendingAge = 0;
  let hopT = -1, tilt = 0, tiltWant = 0;         // the one-shot jump, the head-cock

  function setFace(id) {
    if (!VFACES[id] || (pending?.id ?? cur) === id) return;
    pending = { id }; pendingAge = 0;
    if (blinkT <= 0) { blinkT = .13; nextBlink = 1.2 + Math.random() * 3; }
  }

  return {
    setFace,
    face: () => pending?.id ?? cur,
    /** a happy little jump — one shot, ignored while already airborne */
    hop() { if (hopT < 0) hopT = 0; },

    update(t, dt) {
      const face = getChar();
      if (!face) return;
      const amp = opts.amp ?? 1;
      const tt = t + (opts.phase ?? 0);
      const E = VFACES[cur], EP = VFACES[prev];
      const fw = sstep(w);
      // an expression scales the autonomic layers rather than replacing
      // them, so an asleep character still breathes — deeper and slower
      const mix = k => {
        const a = EP[k] ?? (k === 'breath' ? 1 : 0), b = E[k] ?? (k === 'breath' ? 1 : 0);
        return a + (b - a) * fw;
      };

      // ---- blink, and the mask an expression hides behind ----------
      const canBlink = opts.blink !== false && mix('blink') !== 0
        && (EP.blink ?? 1) + (E.blink ?? 1) > 0;
      if (canBlink) {
        nextBlink -= dt;
        if (nextBlink < 0) {
          blinkT = .12;
          nextBlink = Math.random() < .16 ? .28 : 1.2 + Math.random() * 3.4;
        }
      }
      if (blinkT > 0) blinkT -= dt;
      if (pending) {
        pendingAge += dt;
        if ((blinkT > .03 && blinkT < .12) || pendingAge > .34) {
          prev = cur; cur = pending.id;
          w = cur === prev ? 1 : 0;
          pending = null;
        }
      }
      w = Math.min(1, w + dt / FACE_TRANS);

      // ---- the glance ---------------------------------------------
      const gazeOn = opts.gaze !== false && (E.gaze ?? 1) > 0;
      if (gazeOn) {
        if (!gazeDir && t > nextGaze) {
          gazeDir = DIRS[(Math.random() * DIRS.length) | 0];
          gazeUntil = t + .6 + Math.random() * 1.6;
          // half the time the whole head cocks toward what it noticed —
          // the puzzled-puppy tilt, and it costs one rotation
          tiltWant = Math.random() < .5 ? (gazeDir === 'left' ? 1 : -1) * (.1 + Math.random() * .12) : 0;
        } else if (gazeDir && t > gazeUntil) {
          gazeDir = null;
          tiltWant = 0;
          nextGaze = t + .8 + Math.random() * 2.6;
        }
      } else { gazeDir = null; tiltWant = 0; }
      tilt += (tiltWant - tilt) * Math.min(1, dt * 6);

      // the head whips after the eyes and settles — a spring, not an
      // ease, because a cartoon head overshoots
      const txG = gazeDir === 'left' ? -1 : gazeDir === 'right' ? 1 : 0;
      const tyG = gazeDir === 'up' ? 1 : gazeDir === 'down' ? -1 : 0;
      const k = 95, damp = Math.pow(.0018, dt);
      gvx = (gvx + (txG - gx) * k * dt) * damp;
      gvy = (gvy + (tyG - gy) * k * dt) * damp;
      gx += gvx * dt; gy += gvy * dt;

      // ---- talk ----------------------------------------------------
      if (opts.talk) {
        talkT -= dt;
        if (talkT < 0) { talkOpen = Math.random() < .55; talkT = .06 + Math.random() * .12; }
      } else talkOpen = false;

      // ---- the breath, and the head riding it ----------------------
      const brMul = (opts.breath === false ? 0 : 1) * mix('breath') * amp;
      // a deep breath is a slow one: asleep runs at about two thirds
      const rate = 1.05 / (1 + Math.max(0, mix('breath') - 1) * .5);
      const br = brMul ? Math.sin(tt * rate) : 0;
      const swAmp = (opts.sway === false ? 0 : 1) * amp;

      // ---- the hop: anticipation squash, air, landing squash -------
      let hopY = 0, hopSq = 0;
      if (hopT >= 0) {
        hopT += dt / .62;
        if (hopT >= 1) { hopT = -1; }
        else {
          const ph = hopT;
          if (ph < .18) hopSq = -Math.sin(ph / .18 * Math.PI) * .16;          // crouch
          else if (ph < .82) hopY = Math.sin((ph - .18) / .64 * Math.PI) * .16; // air
          else hopSq = -Math.sin((ph - .82) / .18 * Math.PI) * .12;           // land
        }
      }

      const sy = 1 + br * .030 * brMul + hopSq
        + (E.bounce ? Math.abs(Math.sin(tt * 2.4)) * .02 * fw : 0);
      const sx = 1 - br * .012 * brMul - hopSq * .6;
      face.bodyGroup.scale.set(sx, sy, sx);
      face.bodyGroup.position.y = hopY;

      const hp = face.V.headPivot, vx = face.stats.vx;
      const droop = mix('droop'), lean = mix('lean');
      const shiver = mix('shiver') * Math.sin(t * 34) * .006;
      const shake = mix('shake') * Math.sin(t * 21) * .010;

      // the head group is a SIBLING of the body, so it has to be told
      // how far the chest grew underneath it — otherwise the neck
      // stretches and the seam opens
      face.headGroup.position.set(
        (shiver + shake) + gx * .012 * amp,
        hp[1] * vx * sy + hopY + (br * .004 * brMul + Math.sin(tt * 1.1) * .003 * swAmp) - droop * .06,
        hp[2] * vx,
      );
      // yaw is the move a billboard could never make: in 3D the head
      // actually turns toward what it is looking at
      face.headGroup.rotation.set(
        -gy * .17 * amp - droop * .5 + lean * .8,
        gx * .30 * amp + Math.sin(tt * .43) * .05 * swAmp,
        Math.sin(tt * .61) * .022 * swAmp - gx * .05 * amp + tilt,
      );

      // ---- the states: expression, then the involuntary overrides --
      const want = Object.assign({}, E.states);
      if (canBlink && blinkT > 0) want.eyes = 'closed';
      else if (gazeDir && !E.states.eyes) want.eyes = gazeDir;
      if (talkOpen) want.mouth = 'open';
      for (const e of face.entries) e.setState(want[e.id] ?? e.states[0]);
    },
  };
}
