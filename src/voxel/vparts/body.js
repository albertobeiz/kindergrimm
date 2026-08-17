// The body: torso, arms, legs, four legs, tail.
//
// Everything here reads its anchors off `V.B`, which is the only thing
// that knows whether this character stands up or goes on all fours. A
// limb never asks what base it is on — it asks where the shoulder is.
//
// Arms and Legs are `base: ['biped']`, Legs4 is `base: ['quad']`, and
// the rig skips the ones that do not apply. That is the same mechanism
// species uses, one level down: a base is a skeleton, not a costume.

const SHAPES = { bean: 2.4, barrel: 4.0, round: 2.2, pear: 2.6, tiny: 2.4 };
const TORSO_SHAPES = Object.keys(SHAPES);

export const Torso = {
  id: 'torso', label: 'torso', group: 'body',

  gen: (rng, C) => ({
    shape: C.pick(rng, 'shape', [['bean', 30], ['barrel', 22], ['round', 20], ['pear', 16], ['tiny', 12]]),
    w: C.int(rng, 'w', 2, 4),          // half-width
    h: C.int(rng, 'h', 6, 10),
    d: C.int(rng, 'd', 2, 3),          // half-depth
    cloth: C.chance(rng, 'cloth', .72),
    hem: C.range(rng, 'hem', .25, .75),
    band: C.chance(rng, 'band', .3),
  }),
  meta: () => ({
    shape: { label: 'shape', pick: TORSO_SHAPES },
    w: { label: 'half width', range: [1, 6], step: 1 },
    h: { label: 'height', range: [3, 14], step: 1 },
    d: { label: 'half depth', range: [1, 5], step: 1 },
    cloth: { label: 'clothed', bool: true },
    hem: { label: 'hem', range: [0, 1] },
    band: { label: 'band', bool: true },
  }),

  build(v, P, st, V) {
    const T = V.B.torso, pal = V.pal;
    const n = SHAPES[P.shape] ?? 2.4;
    const k = P.shape === 'tiny' ? .82 : 1;
    const cy = (T.y0 + T.y1) / 2, cz = (T.z0 + T.z1) / 2;
    const rx = (T.x1 + .49) * k, rz = ((T.z1 - T.z0) / 2 + .49) * k;
    const ry = (T.y1 - T.y0) / 2 + .49;
    const hemY = Math.round(T.y0 + (T.y1 - T.y0) * P.hem);

    for (let y = T.y0; y <= T.y1; y++) {
      // pear widens toward the hips, bean pinches at the waist
      const t = (y - cy) / (ry || 1);
      let f = Math.pow(Math.max(0, 1 - Math.abs(t) ** n), 1 / n);
      if (P.shape === 'pear') f *= 1 - .18 * t;
      if (P.shape === 'bean') f *= 1 - .12 * Math.cos(t * 3.1);
      const dressed = P.cloth && y >= hemY;
      let c = dressed ? pal.cloth : pal.skin;
      if (dressed && y === T.y1) c = pal.clothD;                 // a collar
      if (dressed && P.band && y === hemY) c = pal.clothD;       // a hem line
      v.disc(y, 0, cz, rx * f, rz * f, c, n);
    }
  },
};

// ---------------------------------------------------------------
const HANDS = ['mitten', 'claw', 'dot', 'none'];

export const Arms = {
  id: 'arms', label: 'arms', group: 'body', base: ['biped'],

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['down', 40], ['stub', 22], ['noodle', 22], ['up', 16]]),
    len: C.range(rng, 'len', .8, 1.35),
    thick: C.range(rng, 'thick', .9, 1.5),
    hand: C.pick(rng, 'hand', [['mitten', 46], ['dot', 30], ['claw', 16], ['none', 8]]),
    sleeve: C.chance(rng, 'sleeve', .5),
  }),
  meta: () => ({
    style: { label: 'style', pick: ['down', 'stub', 'noodle', 'up'] },
    len: { label: 'length', range: [.4, 2] },
    thick: { label: 'thickness', range: [.6, 2.4] },
    hand: { label: 'hand', pick: HANDS },
    sleeve: { label: 'sleeve', bool: true },
  }),

  build(v, P, st, V) {
    const B = V.B, pal = V.pal;
    const L = Math.max(2, Math.round(B.th * .8 * P.len * (P.style === 'stub' ? .5 : 1)));
    const r = P.thick * (P.style === 'noodle' ? .7 : 1.1);
    const sleeveTo = P.sleeve && V.P.torso.cloth ? Math.round(L * .45) : 0;
    const armC = pal.skin;

    v.sym(() => {
      const x0 = B.armX, y0 = B.shoulderY, z0 = B.armZ;
      // where the hand ends up: down the side, out and up, or noodling
      const end = P.style === 'up' ? [x0 + L * .55, y0 + L * .7, z0]
        : P.style === 'noodle' ? [x0 + L * .5, y0 - L * .85, z0 + L * .25]
          : [x0 + Math.max(0, L * .12), y0 - L, z0];

      if (sleeveTo) {
        const mid = [x0 + (end[0] - x0) * .45, y0 + (end[1] - y0) * .45, z0 + (end[2] - z0) * .45];
        v.stroke([x0, y0, z0], mid, r + .35, r, pal.cloth);
        v.stroke(mid, end, r, r * .85, armC);
      } else {
        v.stroke([x0, y0, z0], end, r + .2, r * .85, armC);
      }

      const [hx, hy, hz] = end.map(Math.round);
      if (P.hand === 'mitten') v.blob(hx, hy - 1, hz, r + .9, r + .9, r + .7, armC, 2.4);
      else if (P.hand === 'dot') v.blob(hx, hy - 1, hz, r + .3, r + .3, r + .3, pal.line);
      else if (P.hand === 'claw')
        for (let i = -1; i <= 1; i++) v.stroke([hx, hy - 1, hz], [hx + i, hy - 3, hz + i], .55, .35, pal.bone);
    });
  },
};

// ---------------------------------------------------------------
export const Legs = {
  id: 'legs', label: 'legs', group: 'body', base: ['biped'],

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['stump', 40], ['thick', 30], ['noodle', 30]]),
    len: C.int(rng, 'len', 3, 7),
    w: C.int(rng, 'w', 1, 2),
    feet: C.chance(rng, 'feet', .78),
    trouser: C.chance(rng, 'trouser', .45),
  }),
  meta: () => ({
    style: { label: 'style', pick: ['stump', 'thick', 'noodle'] },
    len: { label: 'length', range: [1, 10], step: 1 },
    w: { label: 'width', range: [1, 3], step: 1 },
    feet: { label: 'feet', bool: true },
    trouser: { label: 'trousers', bool: true },
  }),

  build(v, P, st, V) {
    const B = V.B, pal = V.pal;
    const r = P.style === 'noodle' ? .8 : P.style === 'thick' ? P.w + .6 : P.w + .1;
    const kneeY = Math.round(B.legLen * .5);

    v.sym(() => {
      const x = B.legX, z = 0;
      if (P.trouser) {
        v.stroke([x, B.hipY + 1, z], [x, kneeY, z], r + .2, r, pal.cloth);
        v.stroke([x, kneeY, z], [x, 0, z], r, r, pal.skin);
      } else {
        v.stroke([x, B.hipY + 1, z], [x, 0, z], r + .2, r, pal.skin);
      }
      // a foot is two voxels of overhang and it does most of the work
      // of making a stumpy leg look like it is standing on something
      if (P.feet) {
        const fw = Math.ceil(r);
        for (let dx = -fw; dx <= fw; dx++)
          for (let dz = 0; dz <= 2; dz++) v.set(x + dx, 0, z + dz, pal.clothD);
      }
    });
  },
};

// ---------------------------------------------------------------
export const Legs4 = {
  id: 'legs4', label: 'legs (four)', group: 'body', base: ['quad'],

  gen: (rng, C) => ({
    len: C.int(rng, 'len', 2, 5),
    w: C.int(rng, 'w', 1, 2),
    paws: C.chance(rng, 'paws', .8),
    sock: C.chance(rng, 'sock', .35),
  }),
  meta: () => ({
    len: { label: 'length', range: [1, 7], step: 1 },
    w: { label: 'width', range: [1, 3], step: 1 },
    paws: { label: 'paws', bool: true },
    sock: { label: 'socks', bool: true },
  }),

  build(v, P, st, V) {
    const B = V.B, pal = V.pal;
    const r = P.w + .1;
    for (const z of [B.frontLegZ, B.backLegZ]) {
      v.sym(() => {
        const x = B.legX;
        v.stroke([x, B.hipY + 1, z], [x, 0, z], r + .3, r, pal.skin);
        if (P.sock) v.stroke([x, 1, z], [x, 0, z], r, r, pal.skinL);
        if (P.paws) {
          const fw = Math.ceil(r);
          for (let dx = -fw; dx <= fw; dx++)
            for (let dz = -1; dz <= 1; dz++) v.set(x + dx, 0, z + dz, P.sock ? pal.skinL : pal.skinD);
        }
      });
    }
  },
};

// ---------------------------------------------------------------
const TAILS = ['none', 'wag', 'curl', 'puff', 'spike', 'long'];

export const Tail = {
  id: 'tail', label: 'tail', group: 'body',

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 70], ['wag', 8], ['curl', 8], ['puff', 6], ['spike', 4], ['long', 4]]),
    len: C.range(rng, 'len', .8, 1.5),
    tone: C.pick(rng, 'tone', [['hair', 50], ['skin', 34], ['bone', 16]]),
  }),
  meta: () => ({
    style: { label: 'style', pick: TAILS },
    len: { label: 'length', range: [.4, 2.2] },
    tone: { label: 'tone', pick: ['hair', 'skin', 'bone'] },
  }),
  skip: P => P.style === 'none',

  build(v, P, st, V) {
    const B = V.B, pal = V.pal;
    const c = P.tone === 'skin' ? pal.skin : P.tone === 'bone' ? pal.bone : pal.hair;
    const L = Math.max(2, Math.round(B.th * .8 * P.len));
    const root = [0, B.tailY, B.tailZ];

    switch (P.style) {
      case 'wag':                                    // up and out behind
        v.stroke(root, [0, B.tailY + L * .7, B.tailZ - L * .5], 1.3, .8, c);
        break;
      case 'curl':
        v.stroke(root, [0, B.tailY + L * .5, B.tailZ - L * .6], 1.2, .8, c);
        v.stroke([0, B.tailY + L * .5, B.tailZ - L * .6],
          [0, B.tailY + L * 1.1, B.tailZ - L * .1], .9, .7, c);
        break;
      case 'puff':
        v.blob(0, B.tailY + 1, B.tailZ - 2, L * .55, L * .55, L * .55, c, 2.3);
        break;
      case 'spike':
        v.stroke(root, [0, B.tailY - 1, B.tailZ - L], 1.2, .35, c);
        break;
      case 'long':
        v.stroke(root, [0, B.tailY + L * .3, B.tailZ - L], 1.1, .6, c);
        v.blob(0, B.tailY + L * .4, B.tailZ - L - 1, 1.5, 1.5, 1.5, pal.skinL, 2.3);
        break;
    }
  },
};
