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
const TORSOS = [['bean', 22], ['round', 18], ['square', 14], ['pear', 16],
                ['tiny', 10], ['barrel', 12], ['drop', 8]];

export const Torso = {
  id: 'torso', label: 'torso', order: -2, depth: -.25, region: 'body',
  gen: (rng, C) => ({
    shape: C.pick(rng, 'shape', TORSOS),
    // Isaac proportions: the body is a small blob under a huge head.
    // Both are ratios AGAINST the head, so shrinking them is what
    // makes a character read as big-headed — not scaling the skull.
    wF: C.range(rng, 'wF', .34, .6),   // half width, against the head half width
    hF: C.range(rng, 'hF', .36, .68),  // height, against the head scale
    lean: rng.r(-.06, .06),            // the whole body tips a little
    pattern: C.pick(rng, 'pattern', [['none', 34], ['stripes', 22], ['belly', 18], ['buttons', 14], ['pocket', 12]]),
    clothOn: rng.chance(.45), clothIdx: rng.ri(0, 7),
    tone: C.pick(rng, 'tone', [['light', 46], ['hatch', 22], ['scribble', 18], ['black', 14]]),
  }),
  meta: () => ({
    shape: { label: 'forma', pick: ['bean', 'round', 'square', 'pear', 'tiny', 'barrel', 'drop'] },
    wF: { label: 'ancho', range: [.3, 1.0] },
    hF: { label: 'alto', range: [.3, 1.3] },
    lean: { label: 'inclinación', range: [-.2, .2] },
    pattern: { label: 'estampado', pick: ['none', 'stripes', 'belly', 'buttons', 'pocket'] },
    tone: { label: 'tono', pick: ['light', 'hatch', 'scribble', 'black'] },
    clothOn: { label: 'ropa color', bool: true },
    clothIdx: { label: 'tinte ropa', range: [0, 7], step: 1 },
  }),
  bones: (P, F) => [{ name: 'torso', x: (F.B.quad ? F.B.cx : 0) / U, y: -F.B.top / U }],
  size: (P, F) => [(F.B.halfW * (F.B.quad ? 4.2 : 3.2)) / U, (F.B.h * 2.4) / U],
  draw(s, P, st, F) {
    const B = F.B, S = F.s;
    const hw = B.halfW, top = B.top, bot = B.bot;

    // the silhouette: shape families, all drawn as one closed path
    let pts;
    if (B.quad) {
      // ON ALL FOURS: a long low barrel that runs AWAY from the head,
      // not a torso hanging under it
      const c = B.cx, d = B.dir;
      pts = [[c - d * hw, top + B.h * .42], [c - d * hw * .78, top + B.h * .05],
             [c + d * hw * .5, top], [c + d * hw, top + B.h * .34],
             [c + d * hw * .96, bot], [c - d * hw * .9, bot]];
    } else if (B.sit) {
      // SITTING: one mass, narrow at the shoulders and spreading to a
      // wide base — the haunches. No legs are drawn: the paws are a
      // part of their own and the rest is a bag sitting on the floor.
      pts = [[-hw * .58, top], [hw * .58, top],
             [hw * .92, top + B.h * .45], [hw, bot],
             [hw * .5, bot + B.h * .04], [-hw * .5, bot + B.h * .04],
             [-hw, bot], [-hw * .92, top + B.h * .45]];
    } else if (P.shape === 'square') {
      pts = [[-hw, top], [hw, top], [hw * 1.04, bot], [-hw * 1.04, bot]];
    } else if (P.shape === 'pear') {
      pts = [[-hw * .62, top], [hw * .62, top], [hw * 1.05, bot - B.h * .3], [hw * .8, bot], [-hw * .8, bot], [-hw * 1.05, bot - B.h * .3]];
    } else if (P.shape === 'tiny') {
      // narrow, not short: every silhouette must reach `bot`, because
      // the hips (and so the legs and the floor) are measured from it
      pts = [[-hw * .6, top], [hw * .6, top], [hw * .5, bot], [-hw * .5, bot]];
    } else if (P.shape === 'round') {
      pts = [];
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2;
        pts.push([Math.cos(a) * hw, (top + bot) / 2 + Math.sin(a) * B.h / 2]);
      }
    } else if (P.shape === 'barrel') {
      // straight sides bulging at the middle: a little tank
      pts = [[-hw * .88, top], [hw * .88, top], [hw * 1.06, top + B.h * .5],
             [hw * .9, bot], [-hw * .9, bot], [-hw * 1.06, top + B.h * .5]];
    } else if (P.shape === 'drop') {
      // narrow shoulders over a heavy bottom, the opposite of pear
      pts = [[-hw * .44, top], [hw * .44, top], [hw * .95, top + B.h * .55],
             [hw * .7, bot], [-hw * .7, bot], [-hw * .95, top + B.h * .55]];
    } else { // bean: shoulders narrower than the belly
      pts = [[-hw * .78, top], [hw * .78, top], [hw, top + B.h * .5], [hw * .82, bot], [-hw * .82, bot], [-hw, top + B.h * .5]];
    }
    // the whole body tips: the lean grows toward the shoulders, so the
    // base stays flat on the floor
    if (P.lean) pts = pts.map(([x, y]) => [x + P.lean * (bot - y), y]);
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
  id: 'arms', label: 'brazos', order: -1, depth: -.15, region: 'body',
  base: ['biped'],
  // Every character has arms — they are half the pose. Every style
  // here is an IDLE: nothing reaches for the sky, because a standing
  // doodle with its arms up reads as jumping, not waiting.
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['stub', 34], ['noodle', 18], ['wing', 14],
                                 ['hips', 14], ['clasped', 12], ['behind', 8]]),
    len: C.range(rng, 'len', .55, .95),    // stubby: hands end beside the belly
    droop: C.range(rng, 'droop', .35, 1.0), // hanging close, like the reference
    // nobody draws both arms the same: the right one wanders a little
    asym: rng.r(-.22, .28),
    hand: C.pick(rng, 'hand', [['mitten', 58], ['dot', 26], ['claw', 16]]),
  }),
  meta: () => ({
    style: { label: 'estilo', pick: ['stub', 'noodle', 'wing', 'hips', 'clasped', 'behind'] },
    len: { label: 'largo', range: [.4, 1.8] },
    droop: { label: 'caída', range: [-.2, 1.2] },
    asym: { label: 'asimetría', range: [-.5, .5] },
    hand: { label: 'mano', pick: ['mitten', 'dot', 'claw'] },
  }),
  bones: (P, F) => [-1, 1].map(sd => ({
    name: 'arm' + (sd < 0 ? 'L' : 'R'),
    x: sd * F.B.shoulderX / U, y: -F.B.shoulderY / U, side: sd,
  })),
  // wide enough for a hand tucked across the belly, tall enough for a
  // long droop; the canvas is centred on the shoulder
  size: (P, F) => [(F.B.halfW * 3.4 + F.B.h * 1.6 * P.len) / U,
                   (F.B.h * 2.2 * P.len + F.s * .3) / U],
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

    // Where the hand ends up. Arms hang CLOSE to the body at rest —
    // held out wide reads as a jumping jack, not an idle. The right
    // arm is drawn a touch differently from the left, on purpose.
    const asym = sd > 0 ? P.asym : 0;
    const droop = Math.max(.15, P.droop + asym);
    let dropY = L * (.55 + droop * .55);
    let outX = sd * L * .32;
    let mid;

    if (P.style === 'hips') {
      // elbow out, hand tucked back onto the waist
      outX = sd * B.halfW * .82;
      dropY = B.hipY - y0 - S * .04;
      mid = [x0 + sd * L * .72, y0 + dropY * .42];
    } else if (P.style === 'clasped') {
      // both hands meet over the belly
      outX = -sd * B.shoulderX * .48;
      dropY = L * (.62 + droop * .35);
      mid = [x0 + sd * L * .34, y0 + dropY * .55];
    } else if (P.style === 'behind') {
      // tucked away: barely more than a shoulder and a knuckle
      outX = sd * L * .12;
      dropY = L * (.34 + droop * .2);
      mid = [x0 + sd * L * .22, y0 + dropY * .5];
    } else if (P.style === 'noodle') {
      mid = [x0 + outX * .3 + sd * L * .22, y0 + dropY * .45];   // a loose curve
    } else {
      mid = [x0 + outX * .5, y0 + dropY * .5];
    }

    const spine = chaikin([[x0, y0], mid, [x0 + outX, y0 + dropY]], false, 2);
    const thick = P.style === 'noodle' ? S * .055 : P.style === 'behind' ? S * .07 : S * .085;
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
  id: 'legs', label: 'piernas', order: -3, depth: -.35, region: 'body',
  base: ['biped'],
  // every character stands on something — no floating blobs
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['stub', 54], ['noodle', 18], ['wide', 28]]),
    len: C.range(rng, 'len', .3, .7),   // tiny: the reference barely has legs
    foot: C.pick(rng, 'foot', [['oval', 62], ['mitten', 26], ['claw', 12]]),
  }),
  meta: () => ({
    style: { label: 'estilo', pick: ['stub', 'noodle', 'wide'] },
    len: { label: 'largo', range: [.3, 1.8] },
    foot: { label: 'pie', pick: ['oval', 'mitten', 'claw'] },
  }),
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

// =================================================================
// TAIL — one bone, sticking out from behind one hip. Drawn behind
// everything, and wagged by the animator.
// =================================================================
export const Tail = {
  id: 'tail', label: 'rabo', order: -4, depth: -.4, region: 'body',
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 62], ['wag', 14], ['curl', 12], ['puff', 8], ['spike', 4]]),
    len: C.range(rng, 'len', .8, 1.4),
    side: rng.chance(.5) ? -1 : 1,
  }),
  meta: () => ({
    style: { label: 'estilo', pick: ['none', 'wag', 'curl', 'puff', 'spike'] },
    len: { label: 'largo', range: [.4, 2] },
  }),
  skip: P => P.style === 'none',
  bones: (P, F) => [{
    name: 'tail',
    x: (F.B.quad ? F.B.tailX : P.side * F.B.halfW * .82) / U,
    y: -(F.B.quad ? F.B.hipY - F.B.h * .5 : F.B.hipY - F.B.h * .18) / U,
    side: F.B.quad ? F.B.dir : P.side,
  }],
  size: (P, F) => [(F.B.halfW * 2.6 * P.len + F.s * .3) / U, (F.B.h * 2.4 * P.len + F.s * .3) / U],
  draw(s, P, st, F, bone) {
    const sd = bone.side, B = F.B, S = F.s;
    const x0 = B.quad ? B.tailX : sd * B.halfW * .82;
    const y0 = B.quad ? B.hipY - B.h * .5 : B.hipY - B.h * .18;
    const L = B.h * .8 * P.len;

    if (P.style === 'puff') {
      // a bobtail: one round tuft against the hip
      const r = S * .1 * P.len;
      const b = s.blobPts(x0 + sd * r * .5, y0 + r * .2, r, r * s.jr(.85, 1.05), s.jr(-.3, .3), .7);
      F.media.tone(s, b, { style: 'light', col: F.colors.cloth, gap: S * .04 });
      F.media.edge(s, b.concat([b[0]]), F.lwThin * 1.2, { amp: 1 });
      return;
    }

    let spine;
    if (P.style === 'curl') {
      // up and over into a question mark
      spine = chaikin([[x0, y0], [x0 + sd * L * .5, y0 - L * .25],
                       [x0 + sd * L * .62, y0 - L * .8], [x0 + sd * L * .2, y0 - L * .95]], false, 2);
    } else if (P.style === 'spike') {
      spine = chaikin([[x0, y0], [x0 + sd * L * .55, y0 - L * .2], [x0 + sd * L * 1.0, y0 - L * .55]], false, 2);
    } else { // wag: out and down, the default dog tail
      spine = chaikin([[x0, y0], [x0 + sd * L * .55, y0 - L * .15], [x0 + sd * L * .85, y0 + L * .25]], false, 2);
    }

    const thick = P.style === 'spike' ? S * .075 : S * .06;
    const tip = P.style === 'spike' ? S * .012 : S * .038;
    const shape = limbShape(spine, thick, tip);
    F.media.tone(s, shape, { style: 'light', col: F.colors.cloth, gap: S * .04 });
    F.media.edge(s, shape.concat([shape[0]]), F.lwThin * 1.2, { amp: .8 });
  },
};

// =================================================================
// WINGS — a SPECIES-SPECIFIC part. `species: [...]` means the rig
// skips it entirely for anyone else: no amount of dice-loading turns
// an arm into a wing, so some shapes have to belong to somebody.
// =================================================================
export const Wings = {
  id: 'wings', label: 'alas', order: -1, depth: -.15, region: 'body',
  species: ['monster'], base: ['biped'],
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['folded', 54], ['open', 28], ['tucked', 18]]),
    len: C.range(rng, 'len', .9, 1.4),
    feathers: rng.ri(3, 5),
  }),
  meta: () => ({
    style: { label: 'estilo', pick: ['folded', 'open', 'tucked'] },
    len: { label: 'largo', range: [.5, 2] },
    feathers: { label: 'plumas', range: [2, 6], step: 1 },
  }),
  bones: (P, F) => [-1, 1].map(sd => ({
    name: 'wing' + (sd < 0 ? 'L' : 'R'),
    x: sd * F.B.shoulderX / U, y: -F.B.shoulderY / U, side: sd,
  })),
  size: (P, F) => [(F.B.halfW * 2.4 + F.B.h * 1.4 * P.len) / U, (F.B.h * 2.6 * P.len) / U],
  draw(s, P, st, F, bone) {
    const sd = bone.side, B = F.B, S = F.s;
    const x0 = sd * B.shoulderX, y0 = B.shoulderY;
    const L = B.h * (P.style === 'tucked' ? .5 : .78) * P.len;
    const out = P.style === 'open' ? 1.15 : .55;   // open wings reach out and up
    const lift = P.style === 'open' ? -.55 : .05;

    // the wing plate, then feathers cut into its trailing edge
    const tipX = x0 + sd * L * out, tipY = y0 + L * (lift + .55);
    const plate = chaikin([
      [x0 - sd * S * .02, y0 - S * .05],
      [x0 + sd * L * out * .75, y0 + L * lift * .8],
      [tipX, tipY],
      [x0 + sd * L * .12, y0 + L * .5],
    ], true, 2);
    F.media.tone(s, plate, { style: 'light', col: F.colors.cloth, gap: S * .05 });
    F.media.edge(s, plate.concat([plate[0]]), F.lwThin * 1.3, { amp: .8 });

    // the feather lines fan from the shoulder toward the tip
    for (let k = 1; k <= P.feathers; k++) {
      const u = k / (P.feathers + 1);
      s.sline([[x0 + sd * S * .02, y0 + L * .12],
               [x0 + sd * L * out * (.35 + u * .65), y0 + L * (lift * .5 + .22 + u * .42)]],
        F.lwThin * .9, .45);
    }
  },
};

// =================================================================
// PAWS — the sitting base. Four of them: two little ones planted at
// the front and two splayed at the sides, exactly the four marks the
// reference uses. This part replaces arms AND legs when the skeleton
// is 'sit', which is what a base IS.
// =================================================================
export const Paws = {
  id: 'paws', label: 'patas', order: -1, depth: -.2, region: 'body',
  base: ['sit'],
  gen: (rng, C) => ({
    front: C.pick(rng, 'front', [['oval', 62], ['mitten', 26], ['claw', 12]]),
    spread: C.range(rng, 'spread', .85, 1.2),
    toes: rng.chance(.45),
  }),
  meta: () => ({
    front: { label: 'patas', pick: ['oval', 'mitten', 'claw'] },
    spread: { label: 'apertura', range: [.6, 1.5] },
    toes: { label: 'deditos', bool: true },
  }),
  bones: (P, F) => [{ name: 'paws', x: 0, y: -F.B.bot / U }],
  size: (P, F) => [(F.B.halfW * 3.4 * P.spread) / U, (F.s * .7) / U],
  draw(s, P, st, F) {
    const B = F.B, S = F.s;
    const r = B.pawR;

    // the two side paws first: they sit behind the front ones
    for (const sd of [-1, 1]) {
      const x = sd * B.sidePawX * P.spread, y = B.sidePawY;
      const pad = s.blobPts(x, y, r * 1.35, r * .72, s.jr(-.12, .12) + sd * .18, .4);
      s.paperFill(pad);
      if (F.colors.skin) F.media.skin(s, pad, F.colors.skin, { gap: S * .04 });
      F.media.edge(s, pad.concat([pad[0]]), F.lwThin * 1.25, { amp: .7 });
    }

    for (const sd of [-1, 1]) {
      const x = sd * B.frontPawX, y = B.frontPawY;
      if (P.front === 'claw') {
        for (let k = 0; k < 3; k++)
          s.stroke([[x + (k - 1) * r * .4, y - r * .5], [x + (k - 1) * r * .55, y + r * .5]],
            F.lwThin * 1.1, { taper: .4 });
        continue;
      }
      const wf = P.front === 'mitten' ? 1 : 1.18;
      const pad = s.blobPts(x, y, r * wf, r * (P.front === 'mitten' ? 1 : .92), s.jr(-.12, .12), .4);
      s.paperFill(pad);
      if (F.colors.skin) F.media.skin(s, pad, F.colors.skin, { gap: S * .04 });
      F.media.edge(s, pad.concat([pad[0]]), F.lwThin * 1.3, { amp: .7 });
      // the little toe lines that turn a blob into a paw
      if (P.toes)
        for (let k = -1; k <= 1; k++)
          s.sline([[x + k * r * .42, y - r * .5], [x + k * r * .46, y + r * .1]], 1.1, .4);
    }
  },
};

// =================================================================
// QUAD LEGS — the four-legged base. Four stubby legs under a
// horizontal body, each ending in a cat's paw: a rounded pad with
// two toe lines. The back pair sits further out and slightly higher,
// which reads as "behind" without drawing any perspective.
// =================================================================
export const QuadLegs = {
  id: 'quadlegs', label: 'patas', order: -3, depth: -.3, region: 'body',
  base: ['quad'],
  gen: (rng, C) => ({
    thick: C.range(rng, 'thick', .8, 1.2),
    toes: C.chance(rng, 'toes', .7),
    back: C.chance(rng, 'back', .85),      // are the hind legs visible
  }),
  meta: () => ({
    thick: { label: 'grosor', range: [.5, 1.6] },
    toes: { label: 'deditos', bool: true },
    back: { label: 'patas traseras', bool: true },
  }),
  bones: (P, F) => [{ name: 'quadlegs', x: F.B.cx / U, y: -F.B.legTopY / U }],
  size: (P, F) => [(F.B.halfW * 4.4) / U, (F.B.legLen * 2.6 + F.s * .6) / U],
  draw(s, P, st, F) {
    const B = F.B, S = F.s;
    const r = B.pawR, th = S * .07 * P.thick;
    const D = B.dir;

    const leg = (x, y0, len, scale) => {
      const spine = chaikin([[x, y0], [x + s.jr(-.01, .01) * S, y0 + len * .6], [x, y0 + len]], false, 2);
      const shape = limbShape(spine, th * scale, th * scale * .92);
      F.media.tone(s, shape, { style: 'light', gap: S * .04 });
      F.media.edge(s, shape.concat([shape[0]]), F.lwThin * 1.2, { amp: .7 });
      // the paw: a pad wider than tall, with the toe lines that make it a cat's
      const pad = s.blobPts(x, y0 + len + r * .28, r * 1.15 * scale, r * .78 * scale, s.jr(-.1, .1), .35);
      s.paperFill(pad);
      if (F.colors.skin) F.media.skin(s, pad, F.colors.skin, { gap: S * .035 });
      F.media.edge(s, pad.concat([pad[0]]), F.lwThin * 1.25, { amp: .6 });
      if (P.toes)
        for (let k = -1; k <= 1; k++)
          s.sline([[x + k * r * .38 * scale, y0 + len - r * .1],
                   [x + k * r * .42 * scale, y0 + len + r * .5]], 1.1, .42);
    };

    // hind pair first: further out, a little shorter, drawn behind
    // Front and hind pairs sit at the two ENDS of the body, each drawn
    // twice with a small offset: the near leg and the far one behind it.
    for (const off of [D * S * .07, 0]) {
      leg(B.backLegX + off, B.legTopY - B.h * .05, B.legLen * (off ? .88 : 1), off ? .9 : 1);
      leg(B.frontLegX + off, B.legTopY, B.legLen * (off ? .9 : 1), off ? .9 : 1);
    }
  },
};
