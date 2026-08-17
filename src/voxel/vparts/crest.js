// What grows out of the skull: ears, horns, antlers, a ridge of
// spikes, eye stalks. This is the biggest silhouette lever in the
// catalogue — the difference between a child and a thing under the bed
// is mostly what is on its head.
//
// Everything here is rooted by ASKING the skull where its surface is
// (`V.contains`), never by assuming a head size. A dome and a boxy
// head take the same ear and it sits correctly on both.

const STYLES = ['none', 'cat', 'bunny', 'floppy', 'bear', 'horns', 'antlers', 'spikes', 'stalks', 'sprout'];
const PAIRED = new Set(['cat', 'bunny', 'floppy', 'bear', 'horns', 'antlers', 'stalks']);

export const Crest = {
  id: 'crest', label: 'ears / horns', group: 'head',

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [
      ['none', 30], ['cat', 12], ['bunny', 10], ['floppy', 10], ['bear', 8],
      ['horns', 10], ['antlers', 6], ['spikes', 6], ['stalks', 4], ['sprout', 4],
    ]),
    len: C.range(rng, 'len', .8, 1.4),
    spread: C.range(rng, 'spread', .55, .95),
    lean: C.range(rng, 'lean', -.3, .8),      // <0 forward, >0 back
    tone: C.pick(rng, 'tone', [['hair', 34], ['bone', 26], ['dark', 22], ['skin', 18]]),
    n: C.int(rng, 'n', 3, 6),                 // spikes / branches
  }),
  meta: () => ({
    style: { label: 'style', pick: STYLES },
    len: { label: 'length', range: [.4, 2.4] },
    spread: { label: 'spread', range: [.2, 1.3] },
    lean: { label: 'lean', range: [-1, 1.4] },
    tone: { label: 'material', pick: ['hair', 'bone', 'dark', 'skin'] },
    n: { label: 'count', range: [2, 8], step: 1 },
  }),
  skip: P => P.style === 'none',

  build(v, P, st, V) {
    const H = V.head, pal = V.pal;
    const c = P.tone === 'dark' ? pal.hairD : P.tone === 'bone' ? pal.bone
      : P.tone === 'skin' ? pal.skinD : pal.hair;
    // capped against the head, not just scaled by it: a dog's `len`
    // goes to 2.2 and a floppy ear that then adds half as much again
    // hangs past the animal's own knees
    const L = Math.max(2, Math.min(Math.round(H.h * .85), Math.round(H.h * .5 * P.len)));
    const xr = Math.max(1, Math.round(H.w * P.spread));
    const zc = H.cz + Math.round(P.lean * -2);

    if (!PAIRED.has(P.style)) {
      if (P.style === 'spikes') {
        // a ridge down the crown, tallest in the middle
        for (let i = 0; i < P.n; i++) {
          const x = Math.round((i - (P.n - 1) / 2) * Math.max(1, (H.w * 2) / P.n));
          const y = V.crownY(x, zc);
          if (y === null) continue;
          const h = Math.max(1, Math.round(L * .7 * (1 - Math.abs(x) / (H.w + 1) * .5)));
          v.stroke([x, y - 1, zc], [x, y + h, zc], 0.9, 0.4, c);
        }
      } else if (P.style === 'sprout') {
        const y = V.crownY(0, zc) ?? H.y1;
        v.stroke([0, y - 1, zc], [1, y + L, zc + 1], 0.6, 0.6, c);
        v.blob(1, y + L + 1, zc + 1, 1.6, 1.2, 1.6, pal.accent, 2.4);
      }
      return;
    }

    v.sym(sd => {
      switch (P.style) {
        case 'cat': {                       // a triangle standing on the head
          const y = V.crownY(xr, zc) ?? H.y1;
          for (let i = 0; i < L; i++) {
            const hw = Math.max(0, Math.round((1 - i / L) * (H.w * .34 + .6)));
            const x = xr + Math.round(i * .18);
            for (let dx = -hw; dx <= hw; dx++)
              for (let dz = -1; dz <= 1; dz++) v.set(x + dx, y - 1 + i, zc + dz, i > L * .55 ? c : pal.skinD);
          }
          break;
        }
        case 'bunny': {
          const y = V.crownY(xr, zc) ?? H.y1;
          v.stroke([xr, y - 1, zc], [xr + Math.round(L * .2), y + L * 1.6, zc], 1.4, 1.1, c);
          // the pink inside, because a bunny ear without one is a horn
          v.stroke([xr, y + 1, zc + 1], [xr + Math.round(L * .2), y + L * 1.5, zc + 1], .6, .5, pal.accent);
          break;
        }
        case 'floppy': {                    // down the side of the head
          const yTop = H.y0 + Math.round(H.h * .74);
          const x = V.edgeX(yTop, zc) ?? H.w;
          v.stroke([x, yTop, zc], [x + 1, yTop - L * .7, zc], 1.6, 1.2, c);
          v.stroke([x + 1, yTop - L * .7, zc], [x + 1, yTop - L, zc + 1], 1.2, .8, c);
          break;
        }
        case 'bear': {
          const y = V.crownY(xr, zc) ?? H.y1;
          const r = Math.max(1.4, H.w * .34);
          v.blob(xr, y, zc, r, r, r * .8, c, 2.4);
          break;
        }
        case 'horns': {
          const y = V.crownY(xr, zc) ?? H.y1;
          const mid = [xr + L * .35, y + L * .7, zc - L * .1];
          v.stroke([xr, y - 1, zc], mid, 1.5, 1.0, c);
          v.stroke(mid, [xr + L * .3, y + L * 1.3, zc + L * .35], 1.0, .4, c);
          break;
        }
        case 'antlers': {
          const y = V.crownY(xr, zc) ?? H.y1;
          const tip = [xr + L * .3, y + L * 1.2, zc];
          v.stroke([xr, y - 1, zc], tip, 1.2, .5, c);
          for (let i = 0; i < Math.max(1, P.n - 2); i++) {
            const t = .35 + i * .3;
            const from = [xr + L * .3 * t, y + L * 1.2 * t, zc];
            v.stroke(from, [from[0] + L * .45, from[1] + L * .3, zc + (i % 2 ? 1 : -1) * L * .2], .7, .4, c);
          }
          break;
        }
        case 'stalks': {                    // and something on the end, looking
          const y = V.crownY(xr, zc) ?? H.y1;
          const tip = [xr + L * .2, y + L * 1.2, zc];
          v.stroke([xr, y - 1, zc], tip, .6, .6, c);
          v.blob(tip[0], tip[1] + 1, tip[2], 1.7, 1.7, 1.7, pal.sclera, 2.2);
          v.set(Math.round(tip[0]), Math.round(tip[1] + 1), Math.round(tip[2]) + 2, pal.void);
          break;
        }
      }
    });
  },
};
