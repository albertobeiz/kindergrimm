// Hair: one logical part, two bones — the mass behind the head and
// the bangs/cap in front. Tone is a technique (solid graphite,
// hatch, scribble, stipple, light), sometimes in color.
// Structural choices (spike count, bun position...) are params so
// the construction holds still while the ink boils.
import { chaikin, circlePts } from '../sketch.js';
import { U } from '../part.js';

const wpick = (rng, pairs) => {
  let t = 0; for (const p of pairs) t += p[1];
  let x = rng.r(0, t);
  for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
  return pairs[pairs.length - 1][0];
};

// One register now: the doodle head is often bare skull, but when it
// does have hair it can be anything — punk spikes, an afro, pigtails,
// a bowl cut, one hopeless cowlick.
const STYLES = [
  ['bald', 20], ['spiky', 11], ['messy', 9], ['bowl', 8], ['curly', 7],
  ['buzz', 6], ['bob', 6], ['afro', 5], ['pigtails', 5], ['mohawk', 5],
  ['long', 4], ['buns', 4], ['topknot', 4], ['cowlick', 3], ['ponytail', 3],
];
const ALL_STYLES = STYLES.map(p => p[0]);
const TONES = [['black', 28], ['hatch', 20], ['scribble', 16], ['stipple', 13], ['light', 23]];

export const Hair = {
  id: 'hair', label: 'hair', order: 6,
  skip: P => P.style === 'bald',
  gen: (rng, C) => {
    const style = C.pick(rng, 'style', STYLES);
    return {
      style,
      tone: C.pick(rng, 'tone', TONES),
      colOn: rng.chance(.22), colIdx: rng.ri(0, 5),
      bang: ({ bob: 'clumps', long: 'clumps', messy: 'ragged', ponytail: rng.chance(.5) ? 'clumps' : 'none' })[style] ?? 'none',
      bangN: rng.ri(5, 12),
      cpart: rng.chance(.35),
      longZig: rng.chance(.5), longNt: rng.ri(3, 5),
      flare: rng.r(.85, 1.22), fall: rng.r(.8, .95),
      spikyN: rng.ri(9, 13),
      bunsTop: rng.chance(.5),
      afroR: rng.r(1.0, 1.28),
      mohawkN: rng.ri(5, 8),
      tailUp: rng.chance(.5),      // pigtails ride high or hang low
    };
  },
  meta: () => ({
    style: { label: 'style', pick: ALL_STYLES },
    tone: { label: 'tone', pick: TONES.map(p => p[0]) },
    bang: { label: 'fringe', pick: ['none', 'clumps', 'ragged'] },
    colOn: { label: 'colour', bool: true },
    colIdx: { label: 'dye', range: [0, 5], step: 1 },
    flare: { label: 'flare', range: [.7, 1.4] },
    fall: { label: 'fall', range: [.6, 1.1] },
  }),
  bones: () => [
    { name: 'hairBack', tag: 'back', order: -2, depth: -.35, x: 0, y: 0 },
    { name: 'hairFront', tag: 'front', order: 6, depth: .25, x: 0, y: 0 },
  ],
  size: (P, F) => [(F.w * 3.4) / U, (F.s * 3.0) / U],
  draw(s, P, st, F, bone) {
    const S = F.s, w = F.w, turn = F.turn, ts = F.ts;
    const skullY = F.P.skull.skullY;
    const { hairlinePts, capPts } = F.L;
    const bang = P.bang === 'none' ? null : P.bang;

    const toneFill = pts =>
      F.media.tone(s, pts, { style: P.tone, col: F.colors.hairCol, gap: S * .05 });
    const hairPiece = (pts, opts = {}) => {
      toneFill(pts);
      F.media.edge(s, pts.concat([pts[0]]), opts.lw ?? F.lwThin * 1.3, { amp: opts.amp });
    };

    s.setInk(F.colors.hairCol);

    if (bone.tag === 'back') {
      if (P.style === 'bob' || P.style === 'messy') {
        const rag = P.style === 'messy';
        let pts = [[-1.18 * w, S * .55], [-1.24 * w, -.45 * S], [-.9 * w, -1.02 * S], [0, -1.15 * S], [.9 * w, -1.02 * S], [1.24 * w, -.45 * S], [1.18 * w, S * .55]];
        if (rag) {
          const bot = [];
          for (let i = 0; i < 6; i++) {
            const x = 1.05 * w - i * (2.1 * w / 5);
            bot.push([x + s.jr(-.06, .06) * w, S * (.55 + s.jr(0, .25))], [x - w * .17, S * (.42 + s.jr(0, .1))]);
          }
          pts = [...pts, ...bot];
        } else pts.push([0, S * .62]);
        hairPiece(chaikin(pts, true, rag ? 1 : 2), { lw: F.lwMain });
      } else if (P.style === 'long') {
        const flare = P.flare, fall = S * P.fall;
        const bot = [];
        if (!P.longZig) {
          bot.push([1.02 * w * flare, fall], [-1.02 * w * flare, fall]);
        } else {
          const nt = P.longNt;
          for (let i = 0; i <= nt; i++) {
            const x = (1.02 - i * 2.04 / nt) * w * flare;
            bot.push([x, fall + ((i % 2) ? -S * .12 : S * s.jr(0, .08))]);
          }
        }
        hairPiece(chaikin([[-1.1 * w, -.5 * S], [-.95 * w, -1.04 * S], [0, -1.16 * S], [.95 * w, -1.04 * S], [1.1 * w, -.5 * S],
                           [1.12 * w * flare, S * .35], ...bot.reverse(), [-1.12 * w * flare, S * .35]], true, 2), { lw: F.lwMain });
        for (const sd of [-1, 1])
          s.sline([[sd * 1.02 * w, -.2 * S], [sd * 1.08 * w * P.flare, S * .45], [sd * 1.0 * w * P.flare, fall * .9]], 1.2,
            P.tone === 'black' ? 0 : .3, P.tone === 'black' ? s.paperA(.4) : undefined);
      } else if (P.style === 'spiky') {
        const pts = [];
        const nsp = P.spikyN;
        for (let i = 0; i <= nsp; i++) {
          const a = Math.PI + i / nsp * Math.PI;
          pts.push([Math.cos(a) * w * 1.0, -S * .05 + Math.sin(a) * S * .9]);
          if (i < nsp) {
            const a2 = Math.PI + (i + .5) / nsp * Math.PI;
            const len = s.jr(.12, .26) * S;
            pts.push([Math.cos(a2) * (w * 1.0 + len), -S * .05 + Math.sin(a2) * (S * .9 + len)]);
          }
        }
        pts.push([w * 1.0, S * .1], [-w * 1.0, S * .1]);
        hairPiece(pts, { amp: .8 });
      } else if (P.style === 'ponytail') {
        const d = -ts;    // tail swings behind, away from the gaze
        hairPiece(chaikin([[d * .4 * w, -.92 * S], [d * 1.35 * w, -.6 * S], [d * 1.4 * w, S * .22], [d * 1.02 * w, S * .92],
                           [d * .92 * w, S * .35], [d * .98 * w, -.25 * S]], true, 2));
        s.sline([[d * 1.16 * w, -.28 * S], [d * 1.12 * w, S * .6]], 1.2, P.tone === 'black' ? 0 : .3,
          P.tone === 'black' ? s.paperA(.4) : undefined);
      } else if (P.style === 'pigtails') {
        // two bunches sticking out sideways, tied at the base
        for (const sd of [-1, 1]) {
          const bx = sd * w * 1.02, by = P.tailUp ? -S * .5 : -S * .1;
          hairPiece(chaikin([[sd * w * .7, by - S * .18], [sd * w * 1.5, by - S * .1],
                             [sd * w * 1.62, by + S * .3], [sd * w * 1.2, by + S * .45],
                             [sd * w * .78, by + S * .22]], true, 2), { amp: 1.1 });
          for (let k = 0; k < 2; k++)
            s.sline([[sd * w * .82, by - S * .06 + k * S * .1], [sd * w * 1.35, by + S * .02 + k * S * .12]], 1.2, .35);
        }
      } else if (P.style === 'afro') {
        // a big soft cloud, drawn as a ring of bumps
        const R = w * 1.18 * P.afroR, RY = S * .95 * P.afroR;
        const pts = [];
        const n = 16;
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (1 + i / (n - 1));
          const bump = 1 + .09 * Math.sin(i * 2.3) + s.jr(-.03, .03);
          pts.push([Math.cos(a) * R * bump, -S * .18 + Math.sin(a) * RY * bump]);
        }
        pts.push([w * .95, S * .2], [-w * .95, S * .2]);
        hairPiece(chaikin(pts, true, 1), { lw: F.lwMain, amp: 1.4 });
      } else if (P.style === 'topknot') {
        const bx = turn * w * .12;
        hairPiece(chaikin([[bx - w * .16, -S * (skullY + .02)], [bx - w * .2, -S * (skullY + .34)],
                           [bx + w * .1, -S * (skullY + .42)], [bx + w * .22, -S * (skullY + .12)],
                           [bx + w * .18, -S * (skullY + .02)]], true, 2), { amp: 1.1 });
        for (let k = 0; k < 2; k++)
          s.sline([[bx - w * .18, -S * (skullY + .04) - k * S * .05], [bx + w * .2, -S * (skullY + .06) - k * S * .05]], 1.4, .5);
      } else if (P.style === 'buns') {
        if (P.bunsTop) {
          const bx = turn * w * .15;
          hairPiece(s.blobPts(bx, -S * (skullY + .14), S * .16, S * .13));
          s.sline([[bx - S * .08, -S * (skullY + .03)], [bx + S * .07, -S * (skullY + .05)]], 1.3, .5);
        } else {
          for (const sd of [-1, 1])
            hairPiece(s.blobPts(sd * w * .62, -S * (skullY - .04), S * .12, S * .11));
        }
      }
      s.setInk(null);
      return;
    }

    // ---- front layer ----
    if (bang === 'clumps' || bang === 'ragged') {
      const topY = -S * (skullY - .03);
      const bp = [[-.98 * w, -.52 * S], [-.5 * w, topY * .9], [turn * w * .12, topY * .98], [.5 * w, topY * .9], [.98 * w, -.52 * S]];
      const bots = [];
      const n = bang === 'ragged' ? Math.max(9, P.bangN) : Math.min(7, Math.max(5, P.bangN));
      for (let i = 0; i < n; i++) {
        const xr = .95 * w - i * (1.9 * w / n);
        const xt = xr - (1.9 * w / n) * .5 + s.jr(-.2, .2) * (1.9 * w / n);
        let tip = bang === 'ragged' ? s.jr(-.22, .06) : s.jr(-.06, .22);
        if (bang === 'clumps' && s.chance(.08)) tip = s.jr(.26, .32);
        if (P.cpart && Math.abs(xt - turn * w * .15) < w * .22) tip = -.5;
        bots.push([xr, S * s.jr(-.38, -.24)], [xt, S * tip]);
      }
      const bpoly = chaikin([...bp, [.99 * w, -.5 * S], ...bots, [-.99 * w, -.5 * S]], true, 1);
      toneFill(bpoly);
      const faintEdge = P.tone === 'light' || P.tone === 'stipple';
      s.stroke(chaikin([[.99 * w, -.5 * S], ...bots, [-.99 * w, -.5 * S]], false, 1),
        faintEdge ? F.lwThin * .95 : F.lwThin * 1.3,
        faintEdge ? { amp: .9, alpha: .5 } : { ghost: true, amp: .9 });
      if (P.style === 'ponytail')
        s.broken(chaikin(bp, false, 1), F.lwThin * 1.3, {});
      if (P.tone === 'light')
        for (let i = 0; i < s.ri(4, 7); i++) {
          const x0 = s.jr(-.7, .7) * w;
          s.sline([[x0, -S * .72], [x0 + s.jr(-.12, .12) * w, S * s.jr(-.35, -.05)]], 1.2, .28);
        }
    } else if (P.style === 'spiky') {
      toneFill(capPts);
      s.broken(chaikin(hairlinePts, false, 1), F.lwThin * 1.1, { alpha: .6 });
      for (let i = 0; i < s.ri(4, 6); i++) {
        const t = s.jr(.1, .9);
        const hx = (t - .5) * 1.5 * w;
        const hy = (-.66 + Math.abs(t - .5) * .22) * S;
        const p = [[hx - w * .08, hy], [hx + s.jr(-.06, .06) * w, hy + S * s.jr(.14, .3)], [hx + w * .09, hy]];
        toneFill(p);
        s.sline(p, 1.3, .55);
      }
    } else if (['slick', 'buns', 'topknot', 'pigtails', 'afro'].includes(P.style)) {
      toneFill(capPts);
      s.broken(capPts.concat([capPts[0]]), F.lwThin * 1.3, { ghost: true });
      if (P.tone !== 'black' && P.style === 'slick')
        for (let i = 0; i < 6; i++) {
          const x0 = (-0.62 + i * .25) * w;
          s.sline(chaikin([[x0, -.6 * S], [x0 * .7, -.8 * S], [x0 * .5, -.95 * S]], false, 1), 1.2, .32);
        }
    } else if (P.style === 'bowl') {
      const fringeY = -S * .16;
      const bot = [];
      for (let i = 0; i < 7; i++) {
        const x = .95 * w - i * (1.9 * w / 6);
        bot.push([x, fringeY + ((i === 2 || i === 5) ? S * .035 : 0) + s.jr(-.008, .008) * S]);
      }
      hairPiece(chaikin([[-.97 * w, fringeY - .02 * S], [-.99 * w, -.5 * S], [-.8 * w, -S * skullY * .78], [turn * w * .1, -S * (skullY + .04)],
                         [.8 * w, -S * skullY * .78], [.99 * w, -.5 * S], [.97 * w, fringeY - .02 * S], ...bot], true, 1), { lw: F.lwMain });
    } else if (P.style === 'curly') {
      // the mass sits ON the skull, not over the face: blobPts spins
      // its ellipse freely, so keep it shallow or it swallows the eyes
      const massCY = -S * .74, massRX = w * 1.12, massRY = S * .46;
      const mass = s.blobPts(turn * w * .1, massCY, massRX, massRY, s.jr(-.25, .25));
      toneFill(mass);
      s.broken(mass.concat([mass[0]]), F.lwThin * 1.1, { alpha: .5, amp: 1.5 });
      const c = s.ctx;
      c.save();
      s.poly(mass, true); c.clip();
      const curlC = P.tone === 'black';
      const [mx0, my0] = [turn * w * .1 - massRX, massCY - massRY];
      const [mx1, my1] = [turn * w * .1 + massRX, massCY + massRY];
      for (let i = 0; i < s.ri(22, 32); i++) {
        s.curl(s.jr(mx0, mx1), s.jr(my0, my1), S * s.jr(.028, .06), s.jr(0, Math.PI * 2), s.jr(3.4, 5.4),
          curlC ? s.paperA(s.jr(.5, .75)) : s.inkA(s.jr(.4, .75)), s.jr(1.2, 2.1));
      }
      c.restore();
      // loose curls escaping the mass
      for (let i = 0; i < s.ri(3, 5); i++) {
        const a = s.jr(-.2, Math.PI + .2);
        s.curl(turn * w * .1 - Math.cos(a) * massRX, massCY - Math.sin(a) * massRY,
          S * s.jr(.03, .05), s.jr(0, Math.PI * 2), 4, s.inkA(s.jr(.4, .65)), 1.5);
      }
    } else if (P.style === 'mohawk') {
      // shaved sides, one ridge of spikes over the crown
      s.sline(chaikin(hairlinePts, false, 1), 1.2, .4);
      const n = P.mohawkN;
      for (let i = 0; i < n; i++) {
        const u = (i - (n - 1) / 2) / Math.max(1, (n - 1) / 2);
        const cx = turn * w * .12 + u * w * .3;
        const cy = -S * (skullY * .92) + Math.abs(u) * S * .1;
        const h = S * (.42 - Math.abs(u) * .16);
        toneFill([[cx - w * .085, cy + S * .06], [cx + s.jr(-.05, .05) * w, cy - h], [cx + w * .085, cy + S * .06]]);
        s.sline([[cx - w * .085, cy + S * .06], [cx + s.jr(-.05, .05) * w, cy - h]], 1.3, .55);
      }
    } else if (P.style === 'cowlick') {
      // one strand that refuses, and nothing else
      s.sline(chaikin(hairlinePts, false, 1), 1.2, .35);
      const bx = turn * w * .1 + s.jr(-.2, .2) * w;
      const top = -S * skullY;
      s.stroke(chaikin([[bx, top + S * .06], [bx + w * .12, top - S * .2],
                        [bx - w * .1, top - S * .3], [bx + w * .06, top - S * .42]], false, 2),
        F.lwThin * 1.5, { taper: .3 });
    } else if (P.style === 'buzz') {
      s.sline(chaikin(hairlinePts, false, 1), 1.3, .5);
      s.stippleFill(capPts, S * .026, .42);
      s.broken(chaikin([[-w * .8, -S * skullY * .72], [turn * w * .12, -S * skullY * 1.02], [w * .8, -S * skullY * .72]], false, 2), F.lwMain * .9, { ghost: true });
    }

    // shine: a paper zigzag lifted out of the mass
    if (P.tone !== 'light' && P.tone !== 'stipple' && ['bob', 'long', 'ponytail', 'slick', 'bowl'].includes(P.style)) {
      const zz = [];
      for (let i = 0; i < 9; i++) zz.push([(-.72 + i * .18) * w, S * (-.63 + ((i % 2) ? .05 : -.02) + s.jr(-.008, .008))]);
      s.sline(zz, S * .05, 0, s.paperA(P.tone === 'black' ? .8 : .55));
    }

    s.setInk(null);
  },
};
