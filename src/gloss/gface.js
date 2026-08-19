// ---------------------------------------------------------------
// THE FACE LIFE — the autonomic half of `anim.js`, ported to a toy
// that has no bones.
//
// The drawn rig gets its life from blink, gaze, sway and breath. Only
// one of those needs a skeleton, so the other three come over intact,
// and gaze is the one that matters:
//
//   SOMETHING CATCHES THE EYE, gets looked at, and is let go. The eyes
//   move first. Then the head WHIPS after them on a loose spring, so
//   it overshoots and settles rather than easing into place. That
//   overshoot is the entire difference between a cartoon head turning
//   and a camera panning, and it is why the spring here is deliberately
//   under-damped.
//
// Here the toy IS the head, so the spring drives the whole body — and
// because every feature is its own mesh (see `gshape.js`), the eyes
// leading the head is two translations, not a rebuild.
//
// EVERYTHING WRITTEN HERE IS AN OFFSET FROM REST. Each frame the
// features are put back where the rig left them and the offsets are
// re-applied, so expressions blend and nothing accumulates drift —
// the same rule the drawn poses follow.
// ---------------------------------------------------------------

import { Vector3 } from 'three';

// the ball-eye lid's hinge. WORLD x, not the lid's own: a wide-set
// eye's normal tips ~30° off the camera, and a lid rolled about its
// own tilted axis closes off-camera and leaves a rim of white showing
const X_AXIS = new Vector3(1, 0, 0);

const DIRS = ['left', 'right', 'up', 'down'];
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

// Expressions are OFFSETS, not drawings. A gloss face cannot swap a
// mouth without rebuilding it, but it can raise a brow, narrow an eye
// and open a mouth — which turns out to be most of what an expression
// is anyway.
const FACES = {
  idle:      {},
  happy:     { eyeSY: .78, browLift:  .16, mouthSY: 1.14 },
  angry:     { eyeSY: .88, browLift: -.26, browRoll: -.55 },
  sad:       { eyeSY: .94, browLift:  .12, browRoll:  .48, mouthSY: .9 },
  surprised: { eyeS:  1.13, browLift: .36, mouthSY: 1.3 },
};
export const GLOSS_FACES = Object.keys(FACES);

const isEye = id => id.startsWith('eye');
const isBrow = id => id.startsWith('brow');

/**
 * built → an animator that owns every write to the face meshes.
 * `update(t, dt)` then leaves the head's offset on `.head`, which the
 * page adds to whatever else it is doing with that toy.
 */
export function createGlossFace(built, opts = {}) {
  const u = built.L.s;                       // one unit: the body radius
  const rest = new Map();
  for (const [id, m] of Object.entries(built.face)) {
    rest.set(id, {
      pos: m.position.clone(), quat: m.quaternion.clone(),
      scale: m.scale.clone(), side: id.endsWith('L') || id.includes('L') ? -1 : 1,
    });
  }

  let nextBlink = 1 + Math.random() * 3, blinkT = -1;
  let dir = null, until = 0, next = 1 + Math.random() * 4, queue = [];
  let gx = 0, gy = 0, gvx = 0, gvy = 0;      // the head spring
  let cur = 'idle', target = 'idle', w = 1;

  const api = {
    // x/y in the TOY's own units (a page at cell scale must multiply),
    // yaw/pitch/rot in radians
    head: { x: 0, y: 0, yaw: 0, pitch: 0, rot: 0 },
    face: () => target,
    setFace(id) {
      if (!FACES[id] || id === target) return;
      cur = target; target = id; w = 0;
      // pull a blink forward: a face that changes behind shut lids
      // reads as a decision, and one that changes in the open reads
      // as a glitch
      if (blinkT <= 0) { blinkT = .13; nextBlink = 1.2 + Math.random() * 3; }
    },

    update(t, dt) {
      // ---- blink ----
      if (blinkT > 0) blinkT -= dt;
      else if (t > nextBlink) { blinkT = .13; nextBlink = t + 1.4 + Math.random() * 3.4; }
      const shut = blinkT > 0 ? Math.max(.06, 1 - Math.sin((1 - blinkT / .13) * Math.PI)) : 1;

      // ---- gaze: caught, held, let go ----
      if (opts.gaze !== false) {
        if (!dir && t > next) {
          const d = DIRS[(Math.random() * 4) | 0];
          // a third of the time it looks back the other way, which is
          // what stops the sheet reading as everyone scanning a room
          queue = Math.random() < .3 ? [d, OPPOSITE[d]] : [d];
          dir = queue.shift();
          until = t + .5 + Math.random() * 1.4;
        } else if (dir && t > until) {
          dir = queue.shift() ?? null;
          if (dir) until = t + .4 + Math.random() * 1.1;
          else next = t + 1.4 + Math.random() * 4;
        }
      }
      const tx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
      const ty = dir === 'up' ? 1 : dir === 'down' ? -1 : 0;
      // under-damped ON PURPOSE — k high, damp near 1, so it passes the
      // target and comes back
      const k = 150, damp = .86;
      gvx = (gvx + (tx - gx) * k * dt) * damp;
      gvy = (gvy + (ty - gy) * k * dt) * damp;
      gx += gvx * dt; gy += gvy * dt;

      // ---- expression blend ----
      if (w < 1) w = Math.min(1, w + dt * 4);
      const A = FACES[cur], B = FACES[target];
      const mix = (key, d = 0) => (A[key] ?? d) * (1 - w) + (B[key] ?? d) * w;
      const eyeSY = mix('eyeSY', 1), eyeS = mix('eyeS', 1);
      const browLift = mix('browLift'), browRoll = mix('browRoll');
      const mouthSY = mix('mouthSY', 1);

      // ---- write ----
      for (const [id, m] of Object.entries(built.face)) {
        const r = rest.get(id);
        m.position.copy(r.pos);
        m.quaternion.copy(r.quat);
        m.scale.copy(r.scale);

        if (isEye(id)) {
          // A feature carrying its own budget uses it: that is a PUPIL
          // crossing its white, or the white itself barely stirring.
          // Anything else is a whole eye, and it has to travel far
          // enough to see — an offset you must look for is the same as
          // no offset at all.
          //
          // The budget is scaled by `shut` so a pupil is back at centre
          // by the time the lid closes over it: the white squashes
          // about the eye's middle and a pupil left out at the edge
          // would be squashed about somewhere else and slide clear.
          const tv = m.userData.travel;
          if (tv) { m.translateX(gx * tv[0] * shut); m.translateY(gy * tv[1] * shut); }
          else { m.translateX(gx * u * .17); m.translateY(gy * u * .13); }

          // A parked pupil comes back to the middle as the lid closes.
          // The white squashes about the EYE's centre; a pupil resting
          // up at the top would squash about its OWN and slide clear.
          const park = m.userData.anchorY;
          if (park) m.translateY(-park * (1 - shut));

          // A LID does not squash, it COMES DOWN. Scaling it with the
          // eye would just shrink it out of the way, which is the one
          // thing a closing lid must not do.
          const drop = m.userData.lidDrop;
          if (drop) { m.translateY(-(1 - shut) * drop); continue; }

          // A BALL eye's lid does not slide either, it ROLLS: the cap
          // is centred on the ball, so pitching it forward wraps it
          // over the front the way a real lid wraps an eyeball. A
          // translate here would slide the cap off its own sphere.
          const roll = m.userData.lidRoll;
          if (roll) { m.rotateOnWorldAxis(X_AXIS, roll * (1 - shut)); continue; }

          m.scale.set(r.scale.x * eyeS, r.scale.y * eyeS * eyeSY * (m.userData.shut ? 1 : shut), r.scale.z);
        } else if (isBrow(id)) {
          m.translateX(gx * u * .13);
          m.translateY(gy * u * .12 + browLift * u * .11);
          m.rotateZ(browRoll * r.side);
        } else if (id.startsWith('mouth')) {
          // ALL the mouth's plates: a maw is an outline, an interior,
          // teeth and a tongue, and an expression that opened only the
          // outline would leave the furniture poking through the lip
          m.translateX(gx * u * .07);
          m.translateY(gy * u * .04);
          m.scale.set(r.scale.x, r.scale.y * mouthSY, r.scale.z);
        } else if (id.startsWith('hair') || id.startsWith('hat')) {
          // HAIR AND HATS DO NOT RIDE. Every other feature slides a
          // little with the gaze because it is painted on a face that
          // is turning. These are not on the face — the group's own
          // spring already carries them, and a second offset on top
          // slides the cut off the skull and the hat off the head.
          continue;
        } else {
          m.translateX(gx * u * .09);          // nose, cheeks: they ride
          m.translateY(gy * u * .07);
        }
      }

      // What the head does about it. The TURN is what sells a look —
      // a head that only slides is a head on a rail — so the yaw and
      // pitch carry it and the shift is the follow-through.
      api.head.x = gx * u * .16;
      api.head.y = gy * u * .11;
      api.head.yaw = gx * .34;
      api.head.pitch = -gy * .22;
      api.head.rot = -gx * .07;
      return api.head;
    },
  };
  return api;
}
