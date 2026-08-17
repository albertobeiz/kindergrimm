// Marks and worn things.
//
// Extras is ordered BEFORE the face (see vparts/index.js) on purpose:
// everything here paints onto a surface, and a spot that landed on an
// eye would be a bug rather than a variant. Drawing it early means the
// eyes and the mouth always win their own cells back, and a dog's
// patch ends up UNDER its eye, which is where a patch goes.
//
// Nothing here adds to the silhouette except the whiskers, and nothing
// here may float: marks go on with `dab`, which only lands where some
// earlier part already put a solid.

export const Extras = {
  id: 'extras', label: 'marks', group: 'head',

  gen: (rng, C) => ({
    spots: C.chance(rng, 'spots', .18),
    patch: C.chance(rng, 'patch', .1),
    freckles: C.chance(rng, 'freckles', .3),
    blush: C.chance(rng, 'blush', .25),
    whiskers: C.chance(rng, 'whiskers', 0),
    belly: C.chance(rng, 'belly', .2),
    side: rng.chance(.5) ? 1 : -1,
    density: C.range(rng, 'density', .18, .4),
  }),
  meta: () => ({
    spots: { label: 'spots', bool: true },
    patch: { label: 'eye patch', bool: true },
    freckles: { label: 'freckles', bool: true },
    blush: { label: 'blush', bool: true },
    whiskers: { label: 'whiskers', bool: true },
    belly: { label: 'pale belly', bool: true },
    density: { label: 'density', range: [.05, .6] },
  }),

  build(v, P, st, V) {
    const H = V.head, B = V.B, pal = V.pal;

    // ---- spots: clumps, not confetti. The hash is sampled at half
    // resolution so a spot is a blotch a few voxels across.
    if (P.spots) {
      const blot = (x, y, z, salt) =>
        v.h01(x >> 1, y >> 1, z >> 1, salt) < P.density;
      for (let y = H.y0; y <= H.y1; y++)
        for (let z = H.z0 - 1; z <= H.z1 + 1; z++)
          for (let x = H.x0; x <= H.x1; x++)
            if (blot(x, y, z, 11)) v.dab(x, y, z, pal.skinD);
      for (let y = B.torso.y0; y <= B.torso.y1; y++)
        for (let z = B.torso.z0; z <= B.torso.z1; z++)
          for (let x = B.torso.x0; x <= B.torso.x1; x++)
            if (blot(x, y, z, 11)) v.dab(x, y, z, pal.skinD);
    }

    // ---- one eye ringed in a darker tone
    if (P.patch) {
      const cx = P.side * V.eyeX, cy = V.eyeY + 1, r = Math.max(2.4, H.w * .62);
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let z = H.cz - H.d; z <= H.cz + H.d + 2; z++)
          for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
            if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) v.dab(x, y, z, pal.skinD);
    }

    // ---- the cheeks: freckles across them, blush on them
    for (const sd of [1, -1]) {
      const y = Math.max(H.y0 + 1, V.eyeY - 1);
      if (P.blush) {
        const x = sd * Math.min(H.w, V.eyeX + 1);
        for (const dy of [0, -1]) {
          const z = V.frontZ(x, y + dy);
          if (z !== null) v.dab(x, y + dy, z, pal.blush);
        }
      }
      if (P.freckles) {
        for (let i = 0; i < 4; i++) {
          const x = sd * Math.max(1, Math.round(V.eyeX * (.4 + i * .22)));
          const yy = y - (i % 2);
          if (v.h01(x, yy, 0, 21) > .55) continue;
          const z = V.frontZ(x, yy);
          if (z !== null) v.dab(x, yy, z, pal.skinD);
        }
      }
      // ---- whiskers are the one thing here that sticks out
      if (P.whiskers) {
        const y = V.noseY, x = Math.round((V.muzzle?.rx ?? H.w * .5));
        for (let i = -1; i <= 1; i++) {
          const z = V.frontZ(sd * x, y + i);
          if (z === null) continue;
          v.stroke([sd * x, y + i, z], [sd * (x + 4), y + i * 2 - 1, z - 1], .4, .4, pal.line);
        }
      }
    }

    // ---- a pale front, the way most animals are built
    if (P.belly) {
      const T = B.torso;
      const yTop = Math.round(T.y0 + (T.y1 - T.y0) * .6);
      for (let y = T.y0; y <= yTop; y++)
        for (let x = T.x0 + 1; x <= T.x1 - 1; x++)
          for (let z = T.z1; z >= T.z1 - 1; z--) v.dab(x, y, z, pal.skinL);
    }
  },
};

// ---------------------------------------------------------------
const HATS = ['none', 'cap', 'pointy', 'bucket', 'crown', 'bow'];

export const Hat = {
  id: 'hat', label: 'hat', group: 'head',

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 72], ['cap', 8], ['pointy', 6], ['bucket', 6], ['crown', 4], ['bow', 4]]),
    size: C.range(rng, 'size', .9, 1.3),
    tone: C.pick(rng, 'tone', [['cloth', 44], ['accent', 34], ['bone', 22]]),
  }),
  meta: () => ({
    style: { label: 'style', pick: HATS },
    size: { label: 'size', range: [.5, 1.8] },
    tone: { label: 'colour', pick: ['cloth', 'accent', 'bone'] },
  }),
  skip: P => P.style === 'none',

  build(v, P, st, V) {
    const H = V.head, pal = V.pal;
    const c = pal[P.tone] ?? pal.cloth;
    const cd = P.tone === 'cloth' ? pal.clothD : c;
    const yTop = (V.crownY(0, H.cz) ?? H.y1) + 1;

    if (P.style === 'bow') {                        // off to one side
      const x = H.w, y = H.y0 + Math.round(H.h * .86);
      v.sym(() => {
        for (let i = 0; i < 3; i++)
          for (let dy = -i; dy <= i; dy++) v.set(x - 1 + i, y + dy, H.cz - 1, c);
      });
      v.set(0, y, H.cz - 1, cd);
      return;
    }

    // everything else is a band round the head plus something above
    // it. Same trap as the hair: a band is a HEIGHT, not the top cell
    // of every column, or the brim slides down over the eyes.
    const rows = P.style === 'crown' ? 1 : Math.max(1, Math.round(2 * P.size));
    const brimY = yTop - 1 - Math.round(H.h * .22 * P.size);
    for (let x = H.x0 - 1; x <= H.x1 + 1; x++)
      for (let z = H.z0 - 1; z <= H.z1 + 1; z++) {
        const cy = V.crownY(x, z);
        if (cy === null || cy < brimY) continue;
        for (let y = brimY; y <= cy; y++) v.dab(x, y, z, cd);   // it sits ON the head
        for (let i = 1; i < rows; i++) v.set(x, cy + i, z, c);
      }

    if (P.style === 'cap') {                        // a peak, over the eyes
      for (let x = -Math.round(H.w * .7); x <= Math.round(H.w * .7); x++)
        for (let dz = 1; dz <= Math.max(1, Math.round(2 * P.size)); dz++)
          v.set(x, yTop, H.cz + H.d + dz, c);
    } else if (P.style === 'bucket') {              // a brim all the way round
      for (let x = H.x0 - 2; x <= H.x1 + 2; x++)
        for (let z = H.z0 - 2; z <= H.z1 + 2; z++) {
          const inHead = V.contains(x, yTop - 1, z);
          const near = V.contains(x, yTop - 1, z - 1) || V.contains(x, yTop - 1, z + 1)
            || V.contains(x - 1, yTop - 1, z) || V.contains(x + 1, yTop - 1, z);
          if (!inHead && near) v.set(x, yTop, z, cd);
        }
    } else if (P.style === 'pointy') {
      const hh = Math.max(3, Math.round(H.h * .8 * P.size));
      for (let i = 0; i < hh; i++) {
        const r = Math.max(0, (H.w * .8) * (1 - i / hh));
        v.disc(yTop + i, 0, H.cz, r + .4, r + .4, c, 2.4);
      }
    } else if (P.style === 'crown') {
      for (let x = H.x0; x <= H.x1; x++) {
        if (Math.abs(x) % 2) continue;
        const cy = V.crownY(x, H.cz);
        if (cy === null) continue;
        for (let z = H.cz - Math.round(H.d * .6); z <= H.cz + Math.round(H.d * .6); z++)
          v.set(x, cy + 1 + (Math.abs(x) % 4 === 0 ? 1 : 0), z, c);
      }
    }
  },
};
