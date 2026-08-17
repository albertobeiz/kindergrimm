// Nose and mouth. Both are painted onto whatever front surface the
// skull ended up with, so on a muzzled species they climb onto the
// snout by themselves — `V.noseY` and `V.mouthY` already account for
// the muzzle, and neither of these parts knows the word.
//
// The mouth is animated (talk, and the expressions), so it obeys the
// plate rule: four rows and a fixed width, claimed in every state,
// repainted per state. The nose never moves, so it does not have to.

const NOSE = ['none', 'dot', 'button', 'wide', 'beak', 'skull'];

export const Nose = {
  id: 'nose', label: 'nose', group: 'head',

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['none', 22], ['dot', 26], ['button', 26], ['wide', 12], ['beak', 8], ['skull', 6]]),
    size: C.range(rng, 'size', .8, 1.5),
    tone: C.pick(rng, 'tone', [['line', 54], ['accent', 26], ['skinD', 20]]),
  }),
  meta: () => ({
    style: { label: 'style', pick: NOSE },
    size: { label: 'size', range: [.5, 2.2] },
    tone: { label: 'tone', pick: ['line', 'accent', 'skinD'] },
  }),
  skip: P => P.style === 'none',

  build(v, P, st, V) {
    const y = V.noseY, c = V.pal[P.tone === 'line' ? 'line' : P.tone];
    const w = Math.max(0, Math.round(P.size) - 1);      // half-width in voxels

    if (P.style === 'skull') {                          // two slits, no nose
      for (const sd of [1, -1]) paintAt(v, V, sd * (w + 1), y, c);
      return;
    }
    if (P.style === 'beak') {                           // a wedge out front
      const len = Math.max(2, Math.round(P.size * 2));
      const z0 = V.frontZ(0, y);
      if (z0 === null) return;
      for (let i = 0; i < len; i++) {
        const hw = Math.max(0, w - Math.floor(i * 1.2));
        for (let x = -hw; x <= hw; x++) v.set(x, y - (i > len - 2 ? 1 : 0), z0 + 1 + i, c);
      }
      return;
    }

    // dot / button / wide: a painted patch, and button also bulges
    for (let x = -w; x <= w; x++) {
      const rows = P.style === 'wide' ? [y] : P.style === 'dot' ? [y] : [y, y + 1];
      for (const yy of rows) {
        const z = V.frontZ(x, yy);
        if (z === null) continue;
        if (P.style === 'button' && yy === y) { v.dab(x, yy, z, c); v.set(x, yy, z + 1, c); }
        else v.dab(x, yy, z, c);
      }
    }
  },
};

function paintAt(v, V, x, y, c) {
  const z = V.frontZ(x, y);
  if (z !== null) v.dab(x, y, z, c);
}

// ---------------------------------------------------------------
const MOUTHS = ['line', 'wobble', 'grin', 'frown', 'teeth', 'zigzag', 'void', 'cat', 'tiny', 'stitch', 'oh', 'crook'];

export const Mouth = {
  id: 'mouth', label: 'mouth', group: 'head',
  states: ['idle', 'open', 'grin', 'frown', 'angry', 'sad', 'sleep'],

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [
      ['line', 16], ['wobble', 16], ['grin', 14], ['frown', 10], ['teeth', 10],
      ['zigzag', 8], ['void', 8], ['cat', 8], ['tiny', 6], ['stitch', 4],
    ]),
    w: C.int(rng, 'w', 1, 3),                // half-width
    y: C.range(rng, 'y', -1, 1),             // nudge up or down a voxel
  }),
  meta: () => ({
    style: { label: 'style', pick: MOUTHS },
    w: { label: 'half width', range: [0, 4], step: 1 },
    y: { label: 'nudge', range: [-2, 2] },
  }),

  build(v, P, st, V) {
    const pal = V.pal;
    const y0 = V.mouthY + Math.round(P.y);
    // the plate: four rows and one voxel of margin, claimed in every
    // state so a yawn has room and a shut mouth leaves no hole
    for (let ax = -(P.w + 1); ax <= P.w + 1; ax++) {
      for (let dy = -1; dy <= 2; dy++) {
        const y = y0 + dy;
        const z = V.frontZ(ax, y);
        if (z === null) continue;
        v.dab(ax, y, z, cell(P, pal, st, ax, dy, v) ?? pal.skin);
      }
    }
  },
};

// ax: signed x, 0 is the centre line. dy: -1…2, 0 is the mouth line.
function cell(P, pal, st, ax, dy, v) {
  const W = P.w, t = W > 0 ? Math.abs(ax) / W : 0;
  const out = Math.abs(ax) > W;

  // ---- states that replace the mouth outright ----
  if (st === 'open' || st === 'sleep') {
    // a hole, one voxel narrower than the line so it reads as a mouth
    const w = st === 'sleep' ? Math.max(0, W - 1) : W;
    if (Math.abs(ax) > w) return null;
    if (dy === 0 || dy === 1) return pal.void;
    if (dy === 2 && st === 'open' && Math.abs(ax) < w) return pal.accent;   // a tongue
    return null;
  }
  // +dy is UP, so a grin lifts its corners and a frown drops them
  if (out) return null;
  if (st === 'frown' || st === 'sad') return dy === -Math.round(t) ? pal.line : null;
  if (st === 'grin') return dy === Math.round(t) ? pal.line : null;
  if (st === 'angry') {
    if (dy === -Math.round(t * 1.4)) return pal.line;
    return dy === 1 && Math.abs(ax) === W && W > 0 ? pal.bone : null;       // a bared tooth
  }

  // ---- the resting mouth, one branch per style ----
  switch (P.style) {
    case 'line': return dy === 0 ? pal.line : null;
    case 'tiny': return dy === 0 && ax === 0 ? pal.line : null;
    case 'wobble': return dy === (v.h01(ax, 0, 0, 7) < .4 ? 1 : 0) ? pal.line : null;
    case 'grin': return dy === Math.round(t) ? pal.line : null;
    case 'frown': return dy === -Math.round(t) ? pal.line : null;
    case 'zigzag': return dy === (Math.abs(ax) % 2) ? pal.line : null;
    case 'stitch': return dy === 0 && Math.abs(ax) % 2 === 0 ? pal.line : null;
    case 'void': return (dy === 0 || dy === 1) ? pal.void : null;
    case 'teeth':
      if (dy === 0) return pal.void;
      return dy === 1 && Math.abs(ax) % 2 === 0 ? pal.bone : null;
    // the W under a cat's nose, and the whole cat is in it
    case 'cat':
      if (ax === 0) return dy === 1 ? pal.line : null;
      return dy === 0 && Math.abs(ax) === 1 ? pal.line : null;
    // a little round o of permanent mild surprise
    case 'oh':
      return ax === 0 && (dy === 0 || dy === 1) ? pal.void : null;
    // a grin that only ever made it up one side
    case 'crook':
      return dy === (ax > 0 ? Math.round(t) : 0) ? pal.line : null;
  }
  return null;
}
