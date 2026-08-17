// The eyes, and they are the whole animation budget.
//
// THE PLATE RULE lives here in its clearest form: every state of this
// part fills EXACTLY the same cells, and only the colours change. A
// blink is then a visibility swap between two pre-built meshes and
// costs nothing at runtime — and because the footprint never moves,
// swapping one in can never leave a hole in the head.
//
// The face is painted onto whatever surface the skull turned out to
// have: each column asks `V.frontZ(x, y)` for its own front, so an eye
// wraps around a round head and sits flat on a boxy one without this
// file knowing which it got.
//
// Both eyes look the SAME WAY. That is why this part does not use
// v.sym(): mirroring x would flip the glance and give you a walleyed
// child. The glance is converted per side, on one visible line.

const TYPES = ['void', 'bead', 'saucer', 'sparkle', 'hollow', 'sleepy', 'angry', 'happy', 'xcross', 'line',
  'button', 'crescent', 'glow', 'heart', 'ring', 'spiral', 'wink', 'odd'];

// absolute [dx, dy] in world voxels — +x is the character's own right
const GLANCE = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] };

export const Eyes = {
  id: 'eyes', label: 'eyes', group: 'head',
  states: ['open', 'closed', 'left', 'right', 'up', 'down', 'angry', 'sad', 'happy', 'scared'],

  gen: (rng, C) => ({
    type: C.pick(rng, 'type', [
      ['void', 22], ['bead', 16], ['saucer', 20], ['sparkle', 12],
      ['hollow', 6], ['sleepy', 8], ['angry', 5], ['happy', 4], ['xcross', 4], ['line', 3],
    ]),
    sep: C.range(rng, 'sep', .42, .70),     // fraction of the head's half-width
    y: C.range(rng, 'y', .46, .62),         // fraction of the head's height
    w: C.int(rng, 'w', 1, 3),
    h: C.int(rng, 'h', 2, 4),
    proud: C.chance(rng, 'proud', .18),     // stands out one voxel
  }),

  meta: () => ({
    type: { label: 'type', pick: TYPES },
    sep: { label: 'spacing', range: [.2, .95] },
    y: { label: 'height', range: [.25, .8] },
    w: { label: 'width', range: [1, 4], step: 1 },
    h: { label: 'height (vx)', range: [1, 5], step: 1 },
    proud: { label: 'bulging', bool: true },
  }),

  build(v, P, st, V) {
    const r = V.eye();
    const g = GLANCE[st] ?? [0, 0];
    const pal = V.pal;

    for (const sd of [1, -1]) {
      // +ix is always OUTWARD, so the mask is written once and the
      // glance is the only thing that has to know about sides
      const gix = sd > 0 ? g[0] : -g[0], giy = g[1];

      for (let y = r.y0 - 1; y <= r.y1 + 1; y++) {
        for (let ax = r.x0 - 1; ax <= r.x1 + 1; ax++) {
          const x = sd * ax;
          const z = V.frontZ(x, y);
          if (z === null) continue;
          const inside = ax >= r.x0 && ax <= r.x1 && y >= r.y0 && y <= r.y1;
          if (!inside) { v.dab(x, y, z, pal.skin); continue; }   // the surround

          const c = pixel(P, pal, st, ax - r.x0, y - r.y0, gix, giy, sd);
          if (P.proud) { v.dab(x, y, z, pal.skin); v.set(x, y, z + 1, c); }
          else v.dab(x, y, z, c);
        }
      }
    }
  },
};

// one cell of one eye. ix: 0 = inner … W-1 = outer. iy: 0 = bottom.
// sd is the SIDE (+1 right, -1 left) — most types ignore it, but the
// asymmetric ones (wink, odd) are two different eyes on one face.
function pixel(P, pal, st, ix, iy, gix, giy, sd) {
  const W = P.w, H = P.h;
  const mid = (H - 1) / 2;

  // a blink beats everything, and a blink is one heavy line
  if (st === 'closed') return Math.round(mid) === iy ? pal.line : pal.skin;

  if (st === 'happy' && W >= 2) {
    // eyes shut upward: a line that lifts at both ends
    const arc = ix === 0 || ix === W - 1 ? 1 : 0;
    return iy === Math.min(H - 1, Math.round(mid) + arc) ? pal.line : pal.skin;
  }

  const tight = st === 'scared';
  let c = base(P.type, pal, ix, iy, W, H, gix, giy, tight, sd);

  // an expression is a LID over the eye that is already there, so the
  // type keeps its identity through every mood
  const top = H - 1;
  if (st === 'angry' && H >= 2 && iy === top && ix <= (W - 1) / 2) c = pal.skin;
  if (st === 'sad' && H >= 2 && iy === top && ix >= (W - 1) / 2) c = pal.skin;
  return c;
}

function base(type, pal, ix, iy, W, H, gix, giy, tight, sd) {
  // the two-faced types resolve to a different eye per side
  if (type === 'wink') type = sd > 0 ? 'saucer' : 'line';
  if (type === 'odd') type = sd > 0 ? 'saucer' : 'xcross';
  const cx = (W - 1) / 2, cy = (H - 1) / 2;
  // Where a pupil sits, glance included, clamped inside the rect. In a
  // BIG eye the glance travels further — the whole point of a big eye
  // is watching the pupil roll around in it, so the swing scales with
  // the room it has.
  const swx = W >= 6 ? 2.2 : W >= 4 ? 1.5 : 1;
  const swy = H >= 6 ? 2.2 : H >= 4 ? 1.5 : 1;
  const px = Math.max(0, Math.min(W - 1, Math.round(cx + gix * swx)));
  const py = Math.max(0, Math.min(H - 1, Math.round(cy + giy * swy)));
  const pupil = (rx, ry) => Math.abs(ix - px) <= rx && Math.abs(iy - py) <= ry;
  // A toy pupil is a BLOCK — about a third of the eye, never clipped:
  // it slides along the sclera and stays whole at the far edge, which
  // is what sells "looking at something" instead of "eye glitching".
  // Both the block and its travel grow with the eye.
  const pw = !tight && W >= 6 ? 3 : W >= 4 && !tight ? 2 : 1;
  const ph = !tight && H >= 6 ? 3 : H >= 4 && !tight ? 2 : 1;
  const bx = Math.max(0, Math.min(W - pw, Math.round(cx - (pw - 1) / 2 + gix * swx)));
  const by = Math.max(0, Math.min(H - ph, Math.round(cy - (ph - 1) / 2 + giy * swy)));
  const inBlock = ix >= bx && ix < bx + pw && iy >= by && iy < by + ph;

  switch (type) {
    // A filled black eye cannot point anywhere by moving — so it looks
    // around with its HIGHLIGHT, which is what a shiny eye does anyway.
    case 'void':
      return pupil(0, 0) && (gix || giy) ? pal.glint : pal.void;

    case 'bead':
      return pupil(0, tight ? 0 : Math.min(1, (H - 1) / 2 | 0)) ? pal.void : pal.skin;

    case 'saucer':
      return inBlock ? pal.void : pal.sclera;

    case 'sparkle': {
      // the glint lives in the pupil's top-outer corner and rides with it
      if (inBlock) return (ix === bx + pw - 1 && iy === by + ph - 1 && pw > 1) ? pal.glint : pal.void;
      return pal.sclera;
    }

    // a socket with nothing in it: dark rim, empty middle
    case 'hollow': {
      const rim = ix === 0 || ix === W - 1 || iy === 0 || iy === H - 1;
      return rim || W < 3 || H < 3 ? pal.void : pal.skin;
    }

    case 'sleepy':
      if (iy >= H - 1 && H >= 2) return pal.line;
      return iy <= cy ? pal.void : pal.skin;

    // the eye itself is the angry shape, before any expression lid
    case 'angry':
      return (iy === H - 1 && ix <= cx) ? pal.skin : pal.void;

    case 'happy':
      return iy <= cy ? pal.void : pal.skin;

    case 'xcross': {
      if (W < 3 || H < 3) return pal.line;
      const d = Math.abs(ix - cx) === Math.abs(iy - cy);
      return d ? pal.line : pal.skin;
    }

    // eyes that are simply drawn shut: one heavy resting line. The
    // laziest doodle eye there is, which is exactly its charm.
    case 'line':
      return iy === Math.round(cy) ? pal.line : pal.skin;

    // a doll's eye: sewn on, four thread holes
    case 'button':
      return (Math.abs(ix - Math.round(cx)) === 1 && Math.abs(iy - Math.round(cy)) === 1)
        ? pal.sclera : pal.void;

    // a moon sliver glowing in a dark socket
    case 'crescent': {
      const r = Math.min(W, H) * .42;
      const dxA = ix - cx, dyA = iy - cy;
      const dxB = ix - cx + Math.max(1.4, W * .3);
      const inA = dxA * dxA + dyA * dyA <= r * r;
      const inB = dxB * dxB + dyA * dyA <= r * r;
      return inA && !inB ? pal.glint : pal.void;
    }

    // the whole eye is lit from inside — headlamps in the dark. The
    // pupil is the one dark thing in it, and it still looks around.
    case 'glow':
      return inBlock ? pal.void : pal.glint;

    // heart eyes. The classic implicit curve, sampled on a grid the
    // size of a thumbnail — squint and it is exactly what it is.
    case 'heart': {
      const u = (ix - cx) / (W * .62), v0 = (iy - cy) / (H * .62) + .18;
      const q = u * u + v0 * v0 - .72;
      return q * q * q - u * u * v0 * v0 * v0 * 3.2 <= 0 ? pal.accent : pal.sclera;
    }

    // a donut pupil with light through the middle — and the hole
    // rides the glance, which is quietly the creepiest thing here
    case 'ring': {
      const r1 = Math.min(W, H) * .46, r2 = Math.max(1.1, r1 - 1.5);
      const d2 = (ix - px) * (ix - px) + (iy - py) * (iy - py);
      return d2 <= r1 * r1 && d2 > r2 * r2 ? pal.void : pal.sclera;
    }

    // concentric rings: hypnotised, or hypnotising, unclear
    case 'spiral':
      return Math.max(Math.abs(ix - cx), Math.abs(iy - cy)) % 2 < 1 ? pal.void : pal.sclera;
  }
  return pal.void;
}

// ---------------------------------------------------------------
// BROWS — two voxels that do most of the emotional work. They own the
// three rows above the eye, and a state moves the line inside that
// plate rather than moving the plate.
// ---------------------------------------------------------------
export const Brows = {
  id: 'brows', label: 'brows', group: 'head',
  states: ['idle', 'angry', 'sad', 'raised'],

  gen: (rng, C) => ({
    on: C.chance(rng, 'on', .62),
    style: C.pick(rng, 'style', [['bar', 34], ['angle', 26], ['thick', 20], ['dot', 12], ['worry', 8]]),
    lift: C.int(rng, 'lift', 1, 2),
    tone: C.pick(rng, 'tone', [['hair', 62], ['line', 38]]),
  }),
  meta: () => ({
    on: { label: 'visible', bool: true },
    style: { label: 'style', pick: ['bar', 'angle', 'thick', 'dot', 'worry'] },
    lift: { label: 'lift', range: [0, 3], step: 1 },
    tone: { label: 'tone', pick: ['hair', 'line'] },
  }),
  skip: P => !P.on,

  build(v, P, st, V) {
    const r = V.eye();
    const col = P.tone === 'hair' ? V.pal.hair : V.pal.line;
    const W = P.style === 'dot' ? 1 : (r.x1 - r.x0 + 1) + (P.style === 'thick' ? 1 : 0);
    // the plate: three rows above the eye, always claimed, so a raised
    // brow has somewhere to go
    const y0 = r.y1 + 1, y1 = r.y1 + 3;
    const lift = P.lift + (st === 'raised' ? 1 : 0);

    for (const sd of [1, -1]) {
      for (let y = y0; y <= y1; y++) {
        for (let i = -1; i < W + 1; i++) {
          const ax = r.x1 - i;                       // outer → inner
          const x = sd * ax;
          const z = V.frontZ(x, y);
          if (z === null) continue;
          v.dab(x, y, z, hair(P, st, i, W, y - y0, lift) ? col : V.pal.skin);
        }
      }
    }
  },
};

// i: 0 = outer end … W-1 = inner end. row: 0 … 2 above the eye.
function hair(P, st, i, W, row, lift) {
  if (i < 0 || i >= W) return false;
  const t = W > 1 ? i / (W - 1) : 0;                 // 0 outer … 1 inner
  let r = lift;
  // an expression tilts the line: angry drops the inner end, sad lifts
  // it. This is the one piece of face language that reads at any size.
  if (st === 'angry') r = lift - Math.round(t);
  else if (st === 'sad') r = lift + Math.round(t);
  else if (P.style === 'angle') r = lift + (t > .6 ? 1 : 0);
  else if (P.style === 'worry') r = lift + (t > .5 ? 1 : 0);
  r = Math.max(0, Math.min(2, r));
  if (row === r) return true;
  return P.style === 'thick' && row === Math.max(0, r - 1);
}
