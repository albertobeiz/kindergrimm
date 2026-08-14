// The eyes — the doodle repertoire, one bone each.
//
// Two families share the file:
//   ONE-MARK eyes (saucer, dot, star, sparkle, happy, sleepy, wide,
//     spiral, angry) — drawn quickly and confidently, no socket
//   SOCKET eyes (hollow, void, sunken, xcross) — a hole in the head,
//     the bestiary register
//
// Six states are pre-drawn: open / closed / left / right / up / down.
// A glance is a texture swap; every pupil-bearing type shifts its
// pupil by the state, so the crowd can actually look around.
//
// Eyes are drawn SLOWLY: low blob wobble, single-pass contours. The
// rest of the face can be scribbled, the eyes are what you look at.
import { chaikin, circlePts, PAPER } from '../sketch.js';
import { U } from '../part.js';

const wpick = (rng, pairs) => {
  let t = 0; for (const p of pairs) t += p[1];
  let x = rng.r(0, t);
  for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
  return pairs[pairs.length - 1][0];
};

const TYPES = [
  ['saucer', 20], ['dot', 13], ['hollow', 12], ['void', 10], ['wide', 8],
  ['xcross', 8], ['sparkle', 7], ['sleepy', 6], ['star', 5], ['spiral', 5],
  ['happy', 5], ['angry', 4], ['sunken', 4], ['closed', 3],
];
const ALL = TYPES.map(p => p[0]);
const DARK = new Set(['hollow', 'void', 'sunken', 'xcross']);
const SIMPLE = new Set(['saucer', 'dot', 'star', 'sparkle', 'happy', 'sleepy', 'wide', 'spiral', 'angry']);

// gaze states are pre-drawn like blink frames: the pupil sits where
// the state says, and swapping textures IS the eye moving
const GAZES = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

// a pupil, its highlight, and wherever the gaze has dragged them
function pupil(s, cx, cy, r, glint, o = {}) {
  const c = s.ctx;
  c.fillStyle = s.inkA(o.alpha ?? .95);
  s.wobbly(cx, cy, r, r * (o.squash ?? 1));
  c.fill();
  if (glint) {
    c.fillStyle = PAPER;
    s.wobbly(cx - r * .34, cy - r * .38, r * .3, r * .3);
    c.fill();
  }
}

function starPts(cx, cy, r, n = 5, inner = .44, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + i * Math.PI / n;
    const rr = r * (i % 2 ? inner : 1);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

export const Eyes = {
  id: 'eyes', label: 'ojos', order: 3, depth: 1,
  states: ['open', 'closed', 'left', 'right', 'up', 'down'],
  gen: (rng, C) => ({
    type: C.pick(rng, 'type', TYPES),
    // the doodle habit of drawing each eye without checking the other
    type2: rng.chance(.4) ? C.pick(rng, 'type', TYPES) : 'none',
    scaleR: rng.r(.8, 1.25),
    scale: C.range(rng, 'scale', 1.1, 1.7),
    ehJit: rng.r(.9, 1.1),
    fierce: rng.r(-.05, .55),
    gazeJit: rng.r(-.1, .1),
    sx: C.range(rng, 'sx', .42, .56),
    sink: rng.r(.5, .85),
    lashes: rng.chance(.22),        // a few lashes flicking off the top
    glint: rng.chance(.82),
  }),
  meta: () => ({
    type: { label: 'tipo', pick: ALL },
    type2: { label: 'tipo dcho', pick: ['none', ...ALL] },
    scale: { label: 'tamaño', range: [.6, 2.4] },
    scaleR: { label: 'tamaño dcho', range: [.5, 1.6] },
    sx: { label: 'separación', range: [.28, .7] },
    sink: { label: 'hundimiento', range: [.4, 1.4] },
    fierce: { label: 'fiereza', range: [-.2, .8] },
    gazeJit: { label: 'mirada', range: [-.45, .45] },
    lashes: { label: 'pestañas', bool: true },
    glint: { label: 'brillo', bool: true },
  }),
  bones: (P, F) => [-1, 1].map(sd => ({
    name: 'eye' + (sd < 0 ? 'L' : 'R'),
    x: F.L.eyeX(sd) / U, y: -F.L.ey0[sd] / U, side: sd,
  })),
  size: (P, F) => [(F.L.ew0 * 4.6 + 16) / U, (F.s * 1.35) / U],
  draw(s, P, st, F, bone) {
    const sd = bone.side, S = F.s;
    const { gaze, lashW, ecxJit } = F.L;
    const mism = P.type2 && P.type2 !== 'none' && sd > 0;
    const type = mism ? P.type2 : P.type;
    const sideScale = sd > 0 ? (P.scaleR ?? 1) : 1;
    const ew = F.L.eyeW(sd) * sideScale;
    const eh = F.L.eh * sideScale;
    // parts draw in face coordinates; the rig centers the canvas on
    // the bone anchor (eyeX, ey0), so land the eye right there
    s.ctx.translate(0, F.L.ey0[sd]);
    const ecx = F.L.eyeX(sd) + ecxJit[sd];
    const c = s.ctx;
    const shut = st === 'closed';
    const [gzx, gzy] = GAZES[st] ?? [0, 0];
    const cy0 = eh * .2;

    const lashFlicks = r => {
      if (!P.lashes) return;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI * (.72 - k * .16) + sd * .08;
        const x0 = ecx + Math.cos(a) * r, y0 = cy0 + Math.sin(a) * r;
        s.stroke([[x0, y0], [x0 + Math.cos(a) * r * .42, y0 + Math.sin(a) * r * .42]],
          lashW * .55, { taper: .35, alpha: .9 });
      }
    };

    // ---- the one-mark eyes -----------------------------------
    if (SIMPLE.has(type)) {
      if (shut) {
        s.stroke(chaikin([[ecx - ew * .55, eh * .5], [ecx, -eh * .5], [ecx + ew * .55, eh * .5]], false, 1),
          lashW * .8, { taper: .3 });
        return;
      }
      const r = Math.min(ew * .68, F.w * Math.min(P.sx, .55) * .74);

      if (type === 'happy') {
        // the contented ^ — no eye at all, just the joy of it
        s.stroke(chaikin([[ecx - r * .85, cy0 + r * .45], [ecx, cy0 - r * .6], [ecx + r * .85, cy0 + r * .45]], false, 1),
          lashW * .95, { taper: .28 });
        return;
      }
      if (type === 'spiral') {
        const pts = [];
        const turns = 2.6, n = 44, a0 = s.jr(0, Math.PI * 2), dir = sd;
        for (let i = 0; i <= n; i++) {
          const t = i / n, a = a0 + dir * t * turns * Math.PI * 2;
          pts.push([ecx + Math.cos(a) * r * .9 * t, cy0 + Math.sin(a) * r * .9 * t * s.jr(.95, 1.02)]);
        }
        s.sline(pts, 1.6, .88);
        return;
      }
      if (type === 'angry') {
        // a wedge pressed down over a hard little pupil
        pupil(s, ecx + gzx * r * .34, cy0 + gzy * r * .3 + r * .12, r * .3, P.glint);
        s.stroke([[ecx - sd * r * 1.05, cy0 - r * .95], [ecx + sd * r * .95, cy0 - r * .28]],
          lashW * 1.2, { taper: .2, alpha: 1, amp: .5 });
        return;
      }
      if (type === 'sleepy') {
        // half a lid, a flat pupil under it, and the bag below
        pupil(s, ecx + gzx * r * .3, cy0 + gzy * r * .2 + r * .1, r * .3, P.glint, { squash: .62 });
        s.stroke([[ecx - r * 1.0, cy0 - r * .18], [ecx, cy0 - r * .34], [ecx + r * 1.0, cy0 - r * .2]],
          lashW * 1.05, { taper: .25, alpha: .95 });
        if (s.chance(.6)) s.sline([[ecx - r * .55, cy0 + r * .55], [ecx + r * .5, cy0 + r * .48]], 1.1, .35);
        return;
      }

      // the disc family: saucer / wide / star / sparkle share a body
      const rr = type === 'wide' ? r * 1.06 : r;
      const disc = s.blobPts(ecx, cy0, rr, rr * s.jr(.96, 1.03), s.jr(-.15, .15), .4);
      if (type !== 'dot') {
        s.paperFill(disc);
        s.stroke(disc.concat([disc[0]]), F.lwThin * 1.5, { taper: .1, amp: .5, alpha: .92 });
        lashFlicks(rr);
      }

      const px = ecx + Math.max(-rr * .5, Math.min(rr * .5, gaze + gzx * rr * .62));
      const py = cy0 + rr * s.jr(-.06, .12) + gzy * rr * .55;

      if (type === 'star') {
        // a star where the pupil should be — delighted, or unwell
        const sp = starPts(px, py, rr * .5, 5, .42, s.jr(-.3, .3));
        s.poly(sp, true); c.fillStyle = s.inkA(.95); c.fill();
      } else if (type === 'sparkle') {
        pupil(s, px, py, rr * .42, false);
        // two highlights and a glimmer outside the eye
        c.fillStyle = PAPER;
        s.wobbly(px - rr * .16, py - rr * .18, rr * .17, rr * .17); c.fill();
        s.wobbly(px + rr * .16, py + rr * .16, rr * .08, rr * .08); c.fill();
        const gx2 = ecx + sd * rr * 1.15, gy2 = cy0 - rr * .95;
        const sp = starPts(gx2, gy2, rr * .3, 4, .3, .4);
        s.poly(sp, true); c.fillStyle = s.inkA(.85); c.fill();
      } else if (type === 'wide') {
        // enormous white, tiny frightened dot
        pupil(s, px, py, rr * .2, P.glint);
      } else if (type === 'dot') {
        // the dot IS the pupil, so a glance just nudges it
        if (s.chance(.35)) s.sline(circlePts(ecx, cy0, rr * .55, rr * .57, 14), 1.2, .5);
        pupil(s, ecx + gzx * rr * .3, cy0 + gzy * rr * .3, rr * .3, P.glint);
        lashFlicks(rr * .6);
      } else {
        pupil(s, px, py, rr * s.jr(.3, .4), P.glint);
        if (s.chance(.3))   // the heavy lid: half asleep
          s.stroke([[ecx - rr * .95, cy0 - rr * .45], [ecx + rr * .95, cy0 - rr * .5]], lashW * .8, { taper: .25 });
      }
      return;
    }

    // ---- the socket eyes -------------------------------------
    const cy = eh * .35;
    // Cap the socket well short of the face midline or two big
    // hollows merge into one bandit mask across the nose.
    const rxRaw = ew * .78;
    const rx = Math.min(rxRaw, F.w * Math.min(P.sx, .55) * .68);
    const ry = rx * s.jr(.92, 1.02);

    s.hatch(ecx, cy, rx * 2.2, ry * 2.3, -1.0 + sd * .12, 3, .09 * P.sink);

    if (type === 'xcross') {
      // dead: a compact X pressed hard into the paper
      const r = Math.min(rx, ry) * .62;
      for (const [x0, x1] of [[-r, r], [r, -r]]) {
        s.stroke([[ecx + x0, cy - r * .9], [ecx + x1, cy + r * .9]], lashW * 1.05, { taper: .16, alpha: 1, amp: .5 });
        s.stroke([[ecx + x0 * .9, cy - r * .82], [ecx + x1 * .9, cy + r * .82]], lashW * .7, { taper: .2, alpha: .9, amp: .4 });
      }
      return;
    }

    // the socket is drawn with care: gently lumpy, one steady contour
    const sock = s.blobPts(ecx, cy, rx, ry, s.jr(-.22, .22), .45);
    if (type === 'hollow') {
      // a pit: solid, nothing living in it
      F.media.tone(s, sock, { style: 'black', gap: rx * .5 });
      s.stroke(sock.concat([sock[0]]), F.lwThin * 1.2, { taper: .12, amp: .6, alpha: .9 });
      if (!shut && P.glint) {
        c.fillStyle = PAPER;
        s.wobbly(ecx + gaze * .4 - rx * .22 + gzx * rx * .4, cy - ry * .34 + gzy * ry * .42, rx * .17, rx * .17);
        c.fill();
      }
    } else if (type === 'void') {
      // empty white socket, one small pupil adrift in it
      s.paperFill(sock);
      F.media.tone(s, sock, { style: 'light', gap: rx * .5 });
      s.stroke(sock.concat([sock[0]]), F.lwThin * 1.45, { taper: .12, amp: .6, alpha: .9 });
      if (!shut) {
        const vx = ecx + Math.max(-rx * .55, Math.min(rx * .55, gaze * 1.1 + gzx * rx * .6));
        const vy = cy + ry * s.jr(-.08, .08) + gzy * ry * .55;
        pupil(s, vx, vy, rx * .2, P.glint);
      }
    } else { // sunken: a hole with something small alive in it
      F.media.tone(s, sock, { style: 'hatch', gap: rx * .26 });
      if (F.media.underdraw) s.hatchFill(sock, rx * .3, -.7, .28, 1.1);
      s.stroke(sock.concat([sock[0]]), F.lwThin * 1.3, { taper: .12, amp: .7, alpha: .88 });
      if (!shut) {
        pupil(s, ecx + gaze * .8 + gzx * rx * .48, cy + ry * .05 + gzy * ry * .45, rx * .26, P.glint);
      }
    }

    // the lid comes down over the socket, it doesn't erase it
    if (shut) {
      s.stroke(chaikin([[ecx - rx * 1.02, cy - ry * .2], [ecx, cy + ry * .45], [ecx + rx * 1.02, cy - ry * .3]], false, 1),
        lashW * .95, { taper: .22 });
    }
    s.sline([[ecx - rx * .9, cy - ry * 1.15], [ecx + rx * .8, cy - ry * 1.3]], 1.3, .3);
  },
};

export const Brows = {
  id: 'brows', label: 'cejas', order: 4, depth: .9,
  // An animal has no eyebrows. The profile turns these off entirely
  // (`brows: { on: 0 }`) and that alone stops a cat looking like a
  // person in a cat hat.
  gen: (rng, C) => ({
    on: C.chance(rng, 'on', .45),
    a: rng.r(-.15, .55),
    thF: rng.r(.018, .05),
    yF: rng.r(.1, .2),
  }),
  meta: () => ({
    on: { label: 'visibles', bool: true },
    a: { label: 'ángulo', range: [-.4, .8] },
    thF: { label: 'grosor', range: [.012, .07] },
    yF: { label: 'altura', range: [.04, .32] },
  }),
  skip: P => !P.on,
  bones: (P, F) => [-1, 1].map(sd => ({
    name: 'brow' + (sd < 0 ? 'L' : 'R'),
    x: F.L.eyeX(sd) / U, y: -F.L.browY / U, side: sd,
  })),
  size: (P, F) => [(F.L.ew0 * 2.6) / U, (F.s * .4) / U],
  draw(s, P, st, F, bone) {
    const sd = bone.side;
    const { eh, ecxJit, browY } = F.L;
    const ew = F.L.eyeW(sd);
    const ecx = F.L.eyeX(sd) + ecxJit[sd] * .4;
    s.stroke([[ecx - sd * ew * .95, browY + P.a * eh * 1.6], [ecx + sd * ew * .85, browY - P.a * eh * 1.6]],
      F.s * P.thF, { over: F.s * .02, taper: .32 });
  },
};
