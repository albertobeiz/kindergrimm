// The neck: what the head sits on. Drawn behind the skull so the jaw
// overlaps it, with the throat in shadow — that shadow is what sells
// the head as a solid on top of a cylinder rather than a cutout.
// Its own bone, so the body rig can drive it later (breathing, turns).
import { chaikin } from '../sketch.js';
import { U } from '../part.js';

const wpick = (rng, pairs) => {
  let t = 0; for (const p of pairs) t += p[1];
  let x = rng.r(0, t);
  for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
  return pairs[pairs.length - 1][0];
};

const COLLARS = [['none', 40], ['shirt', 26], ['high', 14], ['rags', 12], ['bandage', 8]];

export const Neck = {
  id: 'neck', label: 'cuello', order: 0, depth: -.12,
  gen: rng => ({
    // a doodle head sits almost straight on its shoulders
    len: rng.r(.10, .22),
    wF: rng.r(.2, .36),
    lean: rng.r(-.1, .1),
    shade: rng.chance(.9),
    adam: rng.chance(.2),
    tendons: rng.chance(.3),
    collar: wpick(rng, COLLARS),
  }),
  meta: () => ({
    len: { label: 'largo', range: [.1, .7] },
    wF: { label: 'ancho', range: [.2, .7] },
    lean: { label: 'inclinación', range: [-.35, .35] },
    collar: { label: 'cuello ropa', pick: ['none', 'shirt', 'high', 'bandage', 'rags'] },
    shade: { label: 'sombra', bool: true },
    adam: { label: 'nuez', bool: true },
    tendons: { label: 'tendones', bool: true },
  }),
  bones: (P, F) => [{ name: 'neck', x: F.turn * F.w * .1 / U, y: -(F.s * F.P.skull.chinY * .8) / U }],
  size: (P, F) => [(F.w * 3.4) / U, (F.s * (1.1 + P.len * 1.6)) / U],
  draw(s, P, st, F) {
    const S = F.s, w = F.w, turn = F.turn, ts = F.ts;
    const chinY = F.P.skull.chinY;
    const top = S * chinY * .74;              // tucked up behind the jaw
    const bot = S * (chinY + P.len);
    const hw = w * P.wF;
    const lean = P.lean * w;

    // the column itself, slightly wider at the base
    const left = chaikin([[-hw, top], [-hw * 1.02 + lean * .5, (top + bot) / 2], [-hw * 1.16 + lean, bot]], false, 2);
    const right = chaikin([[hw, top], [hw * 1.02 + lean * .5, (top + bot) / 2], [hw * 1.16 + lean, bot]], false, 2);
    const column = [...left, ...right.slice().reverse()];

    s.paperFill(column);
    if (F.colors.skin) {
      const dx = s.jr(-.03, .03) * S, dy = s.jr(-.025, .025) * S;
      const off = column.map(q => [q[0] + dx, q[1] + dy]);
      F.media.skin(s, off, F.colors.skin, { gap: S * s.jr(.04, .055) });
    }

    // the throat sits in the jaw's shadow — heaviest right under the chin
    if (P.shade && F.media.underdraw) {
      s.ctx.save(); s.poly(column, true); s.ctx.clip();
      s.hatchFill(s.blobPts(lean * .3, top + S * .1, hw * 1.1, S * .13), S * .032, -1.0, .34, 1.2);
      if (s.chance(.6)) s.hatchFill(s.blobPts(lean * .4, top + S * .16, hw * .9, S * .1), S * .045, .7, .2, 1.1);
      // the far side of the cylinder falls away
      s.hatchFill(s.blobPts(-ts * hw * .8 + lean, (top + bot) / 2, hw * .42, (bot - top) * .45), S * .04, -1.1, .26, 1.15);
      s.ctx.restore();
    }

    F.media.edge(s, left, F.lwMain * .8, { taper: .2 });
    F.media.edge(s, right, F.lwMain * .8, { taper: .2 });

    if (P.tendons)
      for (const sd of [-1, 1])
        s.sline([[sd * hw * .42 + lean * .3, top + S * .06], [sd * hw * .66 + lean, bot - S * .06]], 1.2, .3);
    if (P.adam)
      s.sline(chaikin([[lean * .5 - hw * .12, top + S * .2], [lean * .5, top + S * .26], [lean * .5 + hw * .12, top + S * .19]], false, 1), 1.3, .45);

    // ---- what it disappears into ----
    if (P.collar === 'shirt' || P.collar === 'high') {
      const cy = P.collar === 'high' ? bot - S * .12 : bot;
      const spread = P.collar === 'high' ? hw * 1.3 : hw * 1.9;
      const cloth = chaikin([[-spread + lean, cy + S * .3], [-hw * 1.1 + lean, cy], [lean, cy + S * .12],
                             [hw * 1.1 + lean, cy], [spread + lean, cy + S * .3]], false, 1);
      s.stroke(cloth, F.lwThin * 1.2, { taper: .25 });
      if (P.collar === 'high') {
        s.sline([[-spread * .9 + lean, cy + S * .16], [spread * .9 + lean, cy + S * .16]], 1.2, .35);
        s.hatch(lean, cy + S * .1, spread * 1.4, S * .1, .08, 3, .16);
      } else {
        // the notch where the two halves cross
        s.sline([[lean - hw * .3, cy + S * .04], [lean, cy + S * .16]], 1.2, .4);
        s.sline([[lean + hw * .3, cy + S * .04], [lean, cy + S * .16]], 1.2, .4);
      }
    } else if (P.collar === 'bandage') {
      for (let i = 0; i < 3; i++) {
        const y = bot - S * .1 + i * S * .075;
        const band = [[-hw * 1.3 + lean, y + s.jr(-.02, .02) * S], [hw * 1.3 + lean, y + s.jr(-.02, .02) * S]];
        const strip = [[band[0][0], band[0][1] - S * .032], [band[1][0], band[1][1] - S * .032],
                       [band[1][0], band[1][1] + S * .032], [band[0][0], band[0][1] + S * .032]];
        s.paperFill(strip);
        s.sline([strip[0], strip[1]], 1.2, .45);
        s.sline([strip[3], strip[2]], 1.2, .4);
      }
    } else if (P.collar === 'rags') {
      // torn cloth hanging off the shoulders in strips
      const cy = bot - S * .04;
      const pts = [[-hw * 1.7 + lean, cy + S * .34]];
      const n = s.ri(5, 7);
      for (let i = 0; i <= n; i++) {
        const x = -hw * 1.5 + (hw * 3 / n) * i + lean;
        pts.push([x, cy + S * s.jr(.02, .2)], [x + hw * .18, cy + S * s.jr(.14, .38)]);
      }
      pts.push([hw * 1.7 + lean, cy + S * .34]);
      const rag = chaikin(pts, true, 1);
      F.media.tone(s, rag, { style: 'scribble', gap: S * .04 });
      F.media.edge(s, rag.concat([rag[0]]), F.lwThin * 1.1, { amp: 1.2 });
    }

  },
};
