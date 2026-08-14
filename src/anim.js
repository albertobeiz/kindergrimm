// Animator: drives a built face. Five layers of life —
//   boil:   per-part texture frame cycling (the re-inked look)
//   blink:  eye open/closed swaps, sometimes a quick double
//   gaze:   the eyes dart left/right/up/down and hold — pre-drawn
//           states, so a glance is a texture swap — while the
//           features lean the same way through the parallax
//   talk:   mouth idle/open swaps + a little jaw stretch
//   sway/breath: the whole head drifts and swells; features
//           parallax against it by their depth
import { BOIL_FRAMES } from './part.js';

const DIRS = ['left', 'right', 'up', 'down'];
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

export function createAnimator(getFace, opts) {
  // opts = { blink, talk, sway, breath, gaze, boil, boilSpeed, phase, amp }
  let nextBlink = 1.5, blinkT = -1;
  let talkT = 0, talkOpen = false;
  let gazeDir = null, gazeUntil = 0, nextGaze = 1 + Math.random() * 4;
  let gazeQueue = [];
  // head-follow runs on a loose spring so it OVERSHOOTS and settles —
  // a cartoon head whips after the eyes, it doesn't ease into place
  let gx = 0, gy = 0, gvx = 0, gvy = 0;

  return {
    update(t, dt) {
      const face = getFace();
      if (!face) return;

      const speed = opts.boilSpeed ?? 1;
      for (const e of face.entries)
        e.part.setFrame(opts.boil ? ((t * e.part.fps * speed + e.part.off) | 0) % BOIL_FRAMES : 0);

      // ---- the head as a whole ----
      // Only the HEAD group sways, cocks and rides the breath — the
      // body group stays planted so the feet never leave the floor.
      // phase desynchronizes a crowd (35 heads breathing in unison
      // reads as the PAGE moving); amp lets a scene push the idle
      const tt = t + (opts.phase ?? 0);
      const amp = opts.amp ?? 1;
      const head = face.headGroup ?? face.group;
      const swayX = opts.sway ? Math.sin(tt * .55) * .010 * amp : 0;
      const swayY = opts.sway ? Math.cos(tt * .37) * .005 * amp : 0;
      const breath = opts.breath ? Math.sin(tt * 1.15) : 0;   // ~11 breaths/min
      head.rotation.z = opts.sway ? Math.sin(tt * .6) * .017 * amp : 0;
      head.position.y = (opts.sway ? Math.sin(tt * 1.1) * .004 * amp : 0) + breath * .006 * amp;
      head.scale.setScalar(1 + breath * .005 * amp);

      // blink: quick shut, scheduled at random, sometimes doubled
      if (opts.blink) {
        nextBlink -= dt;
        if (nextBlink < 0) {
          blinkT = .12;
          nextBlink = Math.random() < .15 ? .3 : 1.2 + Math.random() * 3.5;
        }
      }
      if (blinkT > 0) blinkT -= dt;

      // gaze: something catches the eye, gets looked at, is let go.
      // Sometimes both ways (left, then right) like checking a street.
      if (opts.gaze !== false) {
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

      const eyeState = (opts.blink && blinkT > 0) ? 'closed' : (gazeDir ?? 'open');
      for (const e of face.byId('eyes')) e.part.setState(eyeState);

      // the head whips after the eyes, overshoots, settles
      const txG = gazeDir === 'left' ? -1 : gazeDir === 'right' ? 1 : 0;
      const tyG = gazeDir === 'up' ? 1 : gazeDir === 'down' ? -1 : 0;
      const k = 105, damp = Math.pow(.0016, dt);   // frame-rate independent
      gvx = (gvx + (txG - gx) * k * dt) * damp;
      gvy = (gvy + (tyG - gy) * k * dt) * damp;
      gx += gvx * dt;
      gy += gvy * dt;

      // the head cocks toward whatever it is looking at — the head,
      // not the character: the body has its feet on the floor
      head.rotation.z += -gx * .075 * amp;
      head.position.x = gx * .022 * amp;
      head.position.y += gy * .016 * amp;

      // talk: jittery open/idle swaps + a little jaw stretch
      if (opts.talk) {
        talkT -= dt;
        if (talkT < 0) { talkOpen = Math.random() < .55; talkT = .05 + Math.random() * .1; }
      } else talkOpen = false;
      for (const e of face.byId('mouth')) {
        e.part.setState(talkOpen ? 'open' : 'idle');
        const target = talkOpen ? 1.18 : 1;
        e.bone.scale.y += (target - e.bone.scale.y) * Math.min(1, dt * 22);
      }

      // the chest is where breathing actually shows
      for (const e of face.byId('torso'))
        e.bone.scale.set(1 + breath * .016 * amp, 1 + breath * .011 * amp, 1);
      // arms hang and swing a little, out of phase with each other
      for (const e of face.byId('arms'))
        e.bone.rotation.z = Math.sin(tt * .8 + (e.side > 0 ? 1.7 : 0)) * .05 * amp * -e.side;

      // ---- per-bone parallax: depth decides how much a part rides ----
      // Head parts only: body bones hold their base position, and get
      // their life from the torso breath and the arm swing above.
      const browLift = (opts.talk ? Math.sin(t * 9 + 1) * .008 : 0)
        + gy * .022;                        // brows ride with the eyes
      for (const e of face.entries) {
        if (e.region === 'body') continue;
        const base = e.bone.userData.base;
        e.bone.position.x = base.x + (swayX + gx * .055) * e.depth;
        e.bone.position.y = base.y + (swayY + gy * .042) * e.depth + breath * .003 * e.depth
          + (e.id === 'brows' ? browLift : 0);
      }
    },
  };
}
