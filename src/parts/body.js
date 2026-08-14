// ---------------------------------------------------------------
// THE BODY — torso, arms, legs. Three parts, kept deliberately dumb.
//
// A doodle body is a shape with limbs stuck on: the head does the
// acting, the body just has to be alive and not distract. Everything
// hangs off `F.B`, the body block computed in src/layout.js, so the
// three parts always agree on where the shoulders and hips are.
//
// This file is also the best template for a NEW part type: Torso is
// a single-bone part, Arms and Legs are mirrored two-bone parts.
// See ARCHITECTURE.md for the full contract.
// ---------------------------------------------------------------
import { chaikin } from '../sketch.js';
import { U } from '../part.js';

const wpick = (rng, pairs) => {
  let t = 0; for (const p of pairs) t += p[1];
  let x = rng.r(0, t);
  for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
  return pairs[pairs.length - 1][0];
};

// a spine thickened into a tapered outline — the shape of any limb
function limbShape(spine, w0, w1) {
  const L = [], R = [];
  for (let i = 0; i < spine.length; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(spine.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    const t = i / (spine.length - 1);
    const hw = (w0 + (w1 - w0) * t) / 2;
    L.push([spine[i][0] + nx * hw, spine[i][1] + ny * hw]);
    R.push([spine[i][0] - nx * hw, spine[i][1] - ny * hw]);
  }
  return [...L, ...R.reverse()];
}

// hands and feet are the same idea at different sizes
function paw(s, F, cx, cy, r, kind, sd) {
  if (kind === 'none') return;
  if (kind === 'dot') {
    s.ctx.fillStyle = s.inkA(.9);
    s.wobbly(cx, cy, r * .6, r * .6); s.ctx.fill();
    return;
  }
  if (kind === 'claw') {
    for (let k = 0; k < 3; k++) {
      const a = -.4 + k * .6;
      s.stroke([[cx, cy], [cx + sd * Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5]],
        F.lwThin * 1.1, { taper: .4 });
    }
    return;
  }
  // mitten: a soft blob, the doodle default
  const b = s.blobPts(cx, cy, r, r * s.jr(.85, 1.05), s.jr(-.3, .3), .45);
  s.paperFill(b);
  s.stroke(b.concat([b[0]]), F.lwThin * 1.2, { taper: .12, amp: .5 });
}

// =================================================================
// TORSO — one bone, the anchor the limbs hang from
// =================================================================
export const Torso = {
  id: 'torso', label: 'torso', order: -2, depth: -.25,
  gen: rng => ({
    shape: wpick(rng, [['bean', 30], ['round', 22], ['square', 20], ['pear', 18], ['tiny', 10]]),
    wF: rng.r(.46, .78),          // half width, against the head half width
    hF: rng.r(.55, .95),          // height, against the head scale
    pattern: wpick(rng, [['none', 34], ['stripes', 22], ['belly', 18], ['buttons', 14], ['pocket', 12]]),
    clothOn: rng.chance(.45), clothIdx: rng.ri(0, 7),
    tone: wpick(rng, [['light', 46], ['hatch', 22], ['scribble', 18], ['black', 14]]),
  }),
  meta: () => ({
    shape: { label: 'forma', pick: ['bean', 'round', 'square', 'pear', 'tiny'] },
    wF: { label: 'ancho', range: [.3, 1.0] },
    hF: { label: 'alto', range: [.3, 1.3] },
    pattern: { label: 'estampado', pick: ['none', 'stripes', 'belly', 'buttons', 'pocket'] },
    tone: { label: 'tono', pick: ['light', 'hatch', 'scribble', 'black'] },
    clothOn: { label: 'ropa color', bool: true },
    clothIdx: { label: 'tinte ropa', range: [0, 7], step: 1 },
  }),
  bones: (P, F) => [{ name: 'torso', x: 0, y: -F.B.top / U }],
  size: (P, F) => [(F.B.halfW * 3.2) / U, (F.B.h * 2.2) / U],
  draw(s, P, st, F) {
    const B = F.B, S = F.s;
    const hw = B.halfW, top = B.top, bot = B.bot;

    // the silhouette: four shape families, all drawn as one closed path
    let pts;
    if (P.shape === 'square') {
      pts = [[-hw, top], [hw, top], [hw * 1.04, bot], [-hw * 1.04, bot]];
    } else if (P.shape === 'pear') {
      pts = [[-hw * .62, top], [hw * .62, top], [hw * 1.05, bot - B.h * .3], [hw * .8, bot], [-hw * .8, bot], [-hw * 1.05, bot - B.h * .3]];
    } else if (P.shape === 'tiny') {
      pts = [[-hw * .6, top], [hw * .6, top], [hw * .66, top + B.h * .55], [-hw * .66, top + B.h * .55]];
    } else if (P.shape === 'round') {
      pts = [];
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2;
        pts.push([Math.cos(a) * hw, (top + bot) / 2 + Math.sin(a) * B.h / 2]);
      }
    } else { // bean: shoulders narrower than the belly
      pts = [[-hw * .78, top], [hw * .78, top], [hw, top + B.h * .5], [hw * .82, bot], [-hw * .82, bot], [-hw, top + B.h * .5]];
    }
    pts = chaikin(pts, true, 2);

    F.media.tone(s, pts, { style: P.tone, col: F.colors.cloth, gap: S * .05 });
    F.media.edge(s, pts.concat([pts[0]]), F.lwMain * .9, { amp: .9 });

    // what is printed on it
    const c = s.ctx;
    c.save(); s.poly(pts, true); c.clip();
    if (P.pattern === 'stripes') {
      for (let y = top + B.h * .18; y < bot; y += B.h * .17)
        s.sline([[-hw * 1.1, y + s.jr(-.01, .01) * S], [hw * 1.1, y + s.jr(-.01, .01) * S]], F.lwThin * 1.6, .55);
    } else if (P.pattern === 'belly') {
      const bel = s.blobPts(0, top + B.h * .62, hw * .58, B.h * .3, s.jr(-.15, .15), .4);
      s.paperFill(bel);
      s.stroke(bel.concat([bel[0]]), F.lwThin * 1.1, { taper: .12, amp: .6 });
    } else if (P.pattern === 'buttons') {
      for (let k = 0; k < 3; k++) {
        c.fillStyle = s.inkA(.85);
        s.wobbly(s.jr(-.02, .02) * S, top + B.h * (.3 + k * .22), S * .02, S * .02); c.fill();
      }
    } else if (P.pattern === 'pocket') {
      const px = hw * .3, py = top + B.h * .5;
      const pk = [[px - hw * .3, py], [px + hw * .3, py], [px + hw * .26, py + B.h * .26], [px - hw * .26, py + B.h * .26]];
      s.sline(pk.concat([pk[0]]), F.lwThin * 1.2, .5);
    }
    c.restore();
  },
};

// =================================================================
// ARMS — one bone per side, so they can wave independently
// =================================================================
export const Arms = {
  // order -1: in front of the torso, but BEHIND the head — a raised
  // arm must pass behind the face, never across it
  id: 'arms', label: 'brazos', order: -1, depth: -.15,
  gen: rng => ({
    style: wpick(rng, [['stub', 34], ['noodle', 26], ['up', 18], ['wing', 12], ['none', 10]]),
    len: rng.r(.75, 1.3),
    droop: rng.r(-.2, .8),        // <0 raised, >0 hanging
    hand: wpick(rng, [['mitten', 52], ['dot', 22], ['claw', 14], ['none', 12]]),
  }),
  meta: () => ({
    style: { label: 'estilo', pick: ['stub', 'noodle', 'up', 'wing', 'none'] },
    len: { label: 'largo', range: [.4, 1.8] },
    droop: { label: 'caída', range: [-.6, 1.2] },
    hand: { label: 'mano', pick: ['mitten', 'dot', 'claw', 'none'] },
  }),
  skip: P => P.style === 'none',
  bones: (P, F) => [-1, 1].map(sd => ({
    name: 'arm' + (sd < 0 ? 'L' : 'R'),
    x: sd * F.B.shoulderX / U, y: -F.B.shoulderY / U, side: sd,
  })),
  size: (P, F) => [(F.B.halfW * 2.6 * P.len) / U, (F.B.h * 2.2 * P.len) / U],
  draw(s, P, st, F, bone) {
    const sd = bone.side, B = F.B, S = F.s;
    const x0 = sd * B.shoulderX, y0 = B.shoulderY;
    const L = B.h * .62 * P.len;

    if (P.style === 'wing') {
      // a stubby fin rather than an arm
      const fin = chaikin([[x0 - sd * S * .02, y0 - S * .04],
                           [x0 + sd * L * .9, y0 + L * .3],
                           [x0 + sd * L * .5, y0 + L * .75],
                           [x0, y0 + L * .2]], true, 2);
      F.media.tone(s, fin, { style: 'light', col: F.colors.cloth, gap: S * .05 });
      F.media.edge(s, fin.concat([fin[0]]), F.lwThin * 1.3, { amp: .8 });
      return;
    }

    // where the hand ends up: out and down, or up over the head
    const up = P.style === 'up';
    const dropY = up ? -L * .85 : L * (.35 + P.droop * .6);
    const outX = sd * L * (up ? .5 : .75);
    const mid = P.style === 'noodle'
      ? [x0 + outX * .4 + sd * L * .28, y0 + dropY * .45]       // a loose curve
      : [x0 + outX * .55, y0 + dropY * .5];

    const spine = chaikin([[x0, y0], mid, [x0 + outX, y0 + dropY]], false, 2);
    const thick = P.style === 'noodle' ? S * .055 : S * .085;
    const shape = limbShape(spine, thick, thick * .82);
    F.media.tone(s, shape, { style: 'light', gap: S * .05 });
    F.media.edge(s, shape.concat([shape[0]]), F.lwThin * 1.25, { amp: .8 });

    const tip = spine[spine.length - 1];
    paw(s, F, tip[0], tip[1], S * .075, P.hand, sd);
  },
};

// =================================================================
// LEGS — one bone per side. 'none' leaves a blob sitting on the floor
// =================================================================
export const Legs = {
  id: 'legs', label: 'piernas', order: -3, depth: -.35,
  gen: rng => ({
    style: wpick(rng, [['stub', 40], ['noodle', 24], ['none', 22], ['wide', 14]]),
    len: rng.r(.6, 1.25),
    foot: wpick(rng, [['oval', 46], ['mitten', 28], ['none', 16], ['claw', 10]]),
  }),
  meta: () => ({
    style: { label: 'estilo', pick: ['stub', 'noodle', 'none', 'wide'] },
    len: { label: 'largo', range: [.3, 1.8] },
    foot: { label: 'pie', pick: ['oval', 'mitten', 'none', 'claw'] },
  }),
  skip: P => P.style === 'none',
  bones: (P, F) => [-1, 1].map(sd => ({
    name: 'leg' + (sd < 0 ? 'L' : 'R'),
    x: sd * F.B.hipX / U, y: -F.B.hipY / U, side: sd,
  })),
  size: (P, F) => [(F.B.halfW * 2.4) / U, (F.B.h * 2.0 * P.len + F.s * .5) / U],
  draw(s, P, st, F, bone) {
    const sd = bone.side, B = F.B, S = F.s;
    const x0 = sd * B.hipX, y0 = B.hipY;
    const L = B.h * .5 * P.len;
    const splay = P.style === 'wide' ? sd * L * .45 : sd * L * .1;

    const spine = chaikin([[x0, y0], [x0 + splay * .5, y0 + L * .55], [x0 + splay, y0 + L]], false, 2);
    const thick = P.style === 'noodle' ? S * .05 : S * .08;
    const shape = limbShape(spine, thick, thick * .85);
    F.media.tone(s, shape, { style: 'light', gap: S * .05 });
    F.media.edge(s, shape.concat([shape[0]]), F.lwThin * 1.25, { amp: .8 });

    const tip = spine[spine.length - 1];
    if (P.foot === 'oval') {
      // a foot flattened against the ground
      const f = s.blobPts(tip[0] + sd * S * .03, tip[1] + S * .015, S * .095, S * .05, s.jr(-.12, .12), .4);
      s.paperFill(f);
      s.stroke(f.concat([f[0]]), F.lwThin * 1.2, { taper: .12, amp: .5 });
    } else {
      paw(s, F, tip[0], tip[1] + S * .02, S * .07, P.foot, sd);
    }
  },
};
