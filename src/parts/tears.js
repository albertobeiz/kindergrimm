// WET TEARS — the crying expression's water, one small canvas per
// eye. The resting state is an EMPTY canvas: states are lazy, so this
// part costs nothing until somebody actually cries. (The goth black
// tears in extras.js are a different thing — those are a permanent
// feature; these come and go with the expression.)
//
// Everything in here is decided inside draw(), on purpose: the boil
// re-rolls it every frame, so the water shimmers and the flung beads
// jump around — a doodle cries HARD.
import { chaikin } from '../sketch.js';
import { U } from '../part.js';

export const Tears = {
  id: 'tearsWet', label: 'llanto', order: 6, depth: 1.05,
  states: ['none', 'flow'],
  gen: rng => ({ len: rng.r(.7, 1.15), wob: rng.r(.85, 1.2) }),
  meta: () => ({
    len: { label: 'largo', range: [.4, 1.6] },
    wob: { label: 'caudal', range: [.6, 1.6] },
  }),
  bones: (P, F) => [-1, 1].map(sd => ({
    name: 'tear' + (sd < 0 ? 'L' : 'R'),
    x: F.L.eyeX(sd) / U, y: -F.L.ey0[sd] / U, side: sd,
  })),
  size: (P, F) => [(F.L.ew0 * 3.4) / U, (F.s * 1.9) / U],
  draw(s, P, st, F, bone) {
    if (st !== 'flow') return;
    const sd = bone.side, S = F.s;
    // land on the eye anchor, same trick as the eyes themselves
    s.ctx.translate(0, F.L.ey0[sd]);
    const ex = F.L.eyeX(sd) + F.L.ecxJit[sd];
    const ew = F.L.eyeW(sd), eh = F.L.eh;

    // the stream: paper-bright water with a thin nervous edge
    const len = S * .5 * P.len;
    const path = chaikin([
      [ex + s.jr(-.12, .12) * ew, eh * .7],
      [ex + sd * s.jr(0, .18) * ew, eh * .7 + len * .5],
      [ex + sd * s.jr(.1, .35) * ew, eh * .7 + len],
    ], false, 2);
    const hw = ew * .15 * P.wob;
    const wide = [...path.map(p => [p[0] - hw, p[1]]),
                  ...path.slice().reverse().map(p => [p[0] + hw, p[1]])];
    s.paperFill(wide);
    s.stroke(wide.concat([wide[0]]), F.lwThin * .95, { taper: .15, amp: .7, alpha: .8 });

    // the drop about to land…
    const tip = path[path.length - 1];
    const drop = s.blobPts(tip[0], tip[1] + S * .06, ew * .14, S * .045, 0, .45);
    s.paperFill(drop);
    s.stroke(drop.concat([drop[0]]), F.lwThin * .85, { taper: .12, amp: .5 });

    // …and one flung clear of the face
    const bx = ex + sd * ew * s.jr(.9, 1.35), by = eh * .5 + s.jr(-.25, .15) * S;
    const bead = s.blobPts(bx, by, ew * .1, S * .035, sd * .4, .5);
    s.paperFill(bead);
    s.stroke(bead.concat([bead[0]]), F.lwThin * .8, { taper: .12, amp: .5 });
  },
};
