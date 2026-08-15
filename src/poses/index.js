// ---------------------------------------------------------------
// THE POSE REGISTRY — what a character is DOING with its body.
//
// A pose is a plain object, and adding one is the same mechanical
// job as adding a part: one file here, one line in POSES.
//
//   export const MyPose = {
//     id: 'myPose', label: 'mi pose',
//
//     // multipliers on the autonomic life the animator always runs
//     // (sway, breath, blink, gaze, arms, tail). Anything omitted
//     // stays at 1. Sleep turns the gaze off and the breath up.
//     auto: { gaze: 0, breath: 2 },
//
//     // strides per second, fed into ONE gait phase shared by every
//     // pose that declares it — walk→run is a tempo change on the
//     // same phase, never a teleported foot.
//     gaitHz: 1.6,
//
//     // one-shots (attack) play for `dur` seconds, then hand back
//     // to whatever pose was underneath.
//     oneShot: true, dur: .9,
//
//     // a pose may bring its own expression (sleep shuts the eyes);
//     // it never overrides one the user chose explicitly.
//     face: 'sleeping',
//
//     update(ctx) { ... },   // called every frame while blended in
//   };
//
// update() writes OFFSETS from each bone's rest pose, never absolute
// positions. Every write is scaled by the pose's blend weight, which
// is what makes any transition a crossfade: two poses simply mix.
//
// ctx — read: t, dt, time (pose-local), w, face, F, B, S (=F.s),
//   base ('biped'|'sit'|'quad'), gait (shared phase, radians), speed.
// ctx — write (dx/dy in CHARACTER PIXELS with +dy UP, rot in radians
//   CCW on screen, scales as DELTAS from 1):
//   root(dx, dy, rot)      the whole character, rotating about the FEET
//   head(dx, dy, rot, ds)  the head group, on top of root
//   body(dsx, dsy, dx, dy) the body group; scale anchors at the feet
//   bone(e, {dx, dy, rot, sx, sy})   one entry from face.entries
//   each(id, fn)           for every entry of a part id
//   state(id, st)          request a pre-drawn texture state (the
//                          flip-book: quad legs step, a roar). Only
//                          lands once the pose owns >45% of the blend.
// ---------------------------------------------------------------
import { Idle } from './idle.js';
import { Walk, Run } from './gait.js';
import { Sit } from './sit.js';
import { Sleep } from './sleep.js';
import { Attack } from './attack.js';
import { Play } from './play.js';

export const POSES = [Idle, Walk, Run, Sit, Sleep, Attack, Play];
export const POSE_BY_ID = Object.fromEntries(POSES.map(p => [p.id, p]));
