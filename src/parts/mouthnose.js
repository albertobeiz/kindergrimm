// Nose and mouth, both leaning toward where the head points.
// The mouth's 'open' state (used by the talk animation) is what the
// jaw swaps to; dark styles open into a maw instead of a mouth.
import { chaikin, PAPER } from '../sketch.js';
import { U } from '../part.js';

const wpick = (rng, pairs) => {
  let t = 0; for (const p of pairs) t += p[1];
  let x = rng.r(0, t);
  for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
  return pairs[pairs.length - 1][0];
};

const c2fill = (s, col, a) => { s.ctx.fillStyle = s.colA(col, a); s.ctx.fill(); };

const NOSES = [
  ['none', 46], ['button', 18], ['triangle', 12], ['line', 10], ['snout', 8], ['skull', 6],
];

export const Nose = {
  id: 'nose', label: 'nariz', order: 3, depth: 1.15,
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', NOSES),
    nostril: rng.chance(.6),
    // a snout is a family, not one drawing: greyhound to bulldog
    snoutLen: C.range(rng, 'snoutLen', .75, 1.5),
    snoutFat: C.range(rng, 'snoutFat', .8, 1.3),
    snoutTip: C.range(rng, 'snoutTip', -.1, .18),   // <0 upturned, >0 drooping
  }),
  meta: () => ({
    style: { label: 'estilo', pick: NOSES.map(p => p[0]) },
    nostril: { label: 'aleta', bool: true },
    snoutLen: { label: 'hocico largo', range: [.5, 2] },
    snoutFat: { label: 'hocico grueso', range: [.6, 1.6] },
    snoutTip: { label: 'hocico caído', range: [-.25, .3] },
  }),
  skip: P => P.style === 'none',
  // noseY comes from the layout: on a muzzled head it lands on the
  // snout, otherwise mid-face
  bones: (P, F) => [{ name: 'nose', x: F.L.nx * .7 / U, y: -F.L.noseY / U }],
  size: (P, F) => [(F.w * 1.4 * Math.max(1, P.snoutLen)) / U, (F.s * .8 * Math.max(1, P.snoutFat)) / U],
  draw(s, P, st, F) {
    const S = F.s, w = F.w, ts = F.ts, at = F.at;
    const { fx, nx } = F.L;
    // ny is the layout's nose anchor: on a muzzled head it sits on the
    // snout, otherwise mid-face. Everything below is drawn around it.
    const ny = F.L.noseY;

    if (P.style === 'button') {
      const r = w * .085 * (F.L.M.on ? 1.7 : 1);
      if (F.L.M.on) {
        // on a muzzle it is an animal's nose: solid, dark, wider than
        // tall, with one wet highlight
        const b = s.blobPts(nx, ny, r * 1.15, r * .82, s.jr(-.12, .12), .4);
        F.media.tone(s, b, { style: 'black', gap: r * .5 });
        s.stroke(b.concat([b[0]]), F.lwThin * 1.1, { taper: .12, amp: .5 });
        s.ctx.fillStyle = PAPER;
        s.wobbly(nx - r * .4, ny - r * .3, r * .2, r * .16); s.ctx.fill();
        return;
      }
      // a soft round nose, the friendliest mark on a human face
      const b = s.blobPts(nx, ny, r, r * s.jr(.8, .95), s.jr(-.2, .2), .4);
      s.paperFill(b);
      s.stroke(b.concat([b[0]]), F.lwThin * 1.2, { taper: .12, amp: .5 });
      s.ctx.fillStyle = s.inkA(.5);
      s.wobbly(nx - r * .3, ny - r * .25, r * .22, r * .2); s.ctx.fill();
      return;
    }
    if (P.style === 'triangle') {
      // the cat nose: a small solid wedge with a line dropping from it
      const r = w * .075 * (F.L.M.on ? 1.5 : 1);
      const tri = [[nx - r, ny - S * .03], [nx + r, ny - S * .03], [nx, ny - S * .03 + r * 1.15]];
      s.poly(tri, true); s.ctx.fillStyle = s.inkA(.9); s.ctx.fill();
      s.sline([[nx, ny - S * .03 + r * 1.1], [nx, ny - S * .03 + r * 2.1]], 1.2, .5);
      return;
    }
    if (P.style === 'snout') {
      // a muzzle pushed out front, two nostrils in it. The three
      // snout params are what separate a greyhound from a bulldog —
      // same code, a family of shapes.
      const rx = w * .2 * P.snoutLen, ry = S * .1 * P.snoutFat;
      const cy = ny + S * .04 + S * P.snoutTip;
      const sn = s.blobPts(nx, cy, rx, ry, s.jr(-.15, .15), .45);
      s.paperFill(sn);
      s.stroke(sn.concat([sn[0]]), F.lwThin * 1.25, { taper: .12, amp: .6 });
      // the dark button on the end, and the nostrils in it
      const bx = nx, by = cy - ry * .34;
      s.ctx.fillStyle = s.inkA(.8);
      s.wobbly(bx, by, rx * .3, ry * .34); s.ctx.fill();
      for (const sd2 of [-1, 1]) {
        s.ctx.fillStyle = s.inkA(.9);
        s.wobbly(nx + sd2 * rx * .42, cy, rx * .1, ry * .18); s.ctx.fill();
      }
      // the seam running down from the muzzle to the mouth
      s.sline([[nx, cy + ry * .6], [nx + s.jr(-2, 2), cy + ry * 1.15]], 1.2, .45);
      return;
    }
    if (P.style === 'skull') {
      // no bridge, just the hole: two dark slits leaning with the turn
      for (const sd of [-1, 1]) {
        const cx = nx + sd * w * .085 + ts * w * .02 * at;
        const slit = chaikin([[cx + sd * w * .035, ny - S * .02], [cx + sd * w * .012, ny + S * .08], [cx - sd * w * .02, ny + S * .14]], false, 2);
        const back = chaikin([[cx - sd * w * .01, ny + S * .14], [cx - sd * w * .005, ny + S * .05], [cx + sd * w * .012, ny - S * .02]], false, 2);
        const shape = [...slit, ...back];
        F.media.tone(s, shape, { style: 'black', gap: w * .1 });
        F.media.edge(s, shape.concat([shape[0]]), F.lwThin * .95, { amp: .8 });
      }
      if (F.media.underdraw) s.hatch(nx, ny + S * .04, w * .3, S * .16, -1.1, 3, .13);
      return;
    }

    s.stroke(chaikin([[fx * .85 + w * .01, ny - S * .17], [nx + w * .01, ny], [nx + ts * w * .07 * at + w * .02, ny + S * .13]], false, 1),
      F.lwThin, { taper: .3 });
    if (P.nostril) s.sline([[nx + w * .02, ny + S * .14], [nx - ts * w * .07, ny + S * .165]], 1.1, .5);
    s.hatch(nx - w * .07, ny + S * .09, S * .03, S * .05, -1.1, 2, .11);
  },
};

// A doodle mouth is one mark, a hole, or a band of teeth
const MOUTHS = [
  ['zigzag', 13], ['tiny', 11], ['maw', 10], ['wobble', 9], ['void', 9],
  ['cat', 8], ['tongue', 7], ['buckteeth', 6], ['drool', 5], ['smirk', 5],
  ['grit', 5], ['frown', 4], ['stitch', 4], ['fangs', 4],
];
const ALL = [...MOUTHS.map(p => p[0]), 'beak', 'flat', 'open'];

export const Mouth = {
  id: 'mouth', label: 'boca', order: 3, depth: 1, states: ['idle', 'open'], pivot: [.5, .7],
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', MOUTHS),
    myF: C.range(rng, 'myF', .42, .56),
    // doodle mouths swing wild: a dot of a mouth or a grin ear to ear
    wF: C.range(rng, 'wF', .55, 2.1),
    beakLen: C.range(rng, 'beakLen', .8, 1.4),
    upperLip: rng.chance(.2),
    crease: rng.chance(.3),
    nTeeth: rng.ri(3, 5),
    nStitch: rng.ri(3, 5),
  }),
  meta: () => ({
    style: { label: 'estilo', pick: ALL },
    myF: { label: 'altura', range: [.45, .72] },
    wF: { label: 'ancho', range: [.5, 1.8] },
    beakLen: { label: 'pico largo', range: [.5, 2] },
    upperLip: { label: 'labio', bool: true },
    crease: { label: 'pliegue', bool: true },
    nTeeth: { label: 'dientes', range: [2, 7], step: 1 },
  }),
  bones: (P, F) => [{ name: 'mouth', x: F.L.mx / U, y: -F.L.my / U }],
  size: (P, F) => [(F.L.mw * 4.2 + 20) / U, (F.s * .9) / U],
  draw(s, P, st, F) {
    const S = F.s, w = F.w;
    const { mw, my, mx, fx } = F.L;
    const lw = F.lwThin;
    const open = st === 'open';

    if (P.upperLip)
      s.stroke([[mx - mw * .8 + s.jr(-.04, .04) * w, my + s.jr(-.035, .035) * S],
                [mx + mw * .7 + s.jr(-.04, .04) * w, my + s.jr(-.035, .035) * S]], lw, { taper: .3, alpha: .18 });

    // ---- the bestiary mouths --------------------------------
    if (P.style === 'maw' || P.style === 'void' || (P.style === 'fangs' && open)) {
      const gape = open ? 1.55 : 1;
      const mrx = mw * (P.style === 'void' ? .55 : .8);
      const mry = S * .085 * gape * (P.style === 'void' ? .8 : 1);
      const hole = s.blobPts(mx, my + S * .02, mrx, mry);
      F.media.tone(s, hole, { style: 'black', gap: mrx * .35 });
      F.media.edge(s, hole.concat([hole[0]]), lw * 1.15, { amp: 1 });
      if (P.style !== 'void') {
        // teeth cut back OUT of the dark: paper wedges top and bottom
        const n = P.nTeeth;
        for (let i = 0; i < n; i++) {
          const u = (i + .5) / n;
          const tx = mx - mrx * .82 + mrx * 1.64 * u;
          const th = mry * s.jr(.55, .95);
          const tooth = [[tx - mrx * .12, my + S * .02 - mry], [tx + s.jr(-.02, .02) * mrx, my + S * .02 - mry + th], [tx + mrx * .12, my + S * .02 - mry]];
          s.paperFill(tooth);
          s.sline(tooth, 1.1, .5);
        }
        for (let i = 0; i < n - 1; i++) {
          const u = (i + .5) / (n - 1);
          const tx = mx - mrx * .6 + mrx * 1.2 * u;
          const th = mry * s.jr(.4, .8);
          const tooth = [[tx - mrx * .1, my + S * .02 + mry], [tx + s.jr(-.02, .02) * mrx, my + S * .02 + mry - th], [tx + mrx * .1, my + S * .02 + mry]];
          s.paperFill(tooth);
          s.sline(tooth, 1.1, .45);
        }
      }
      // the shadow the jaw casts under itself
      if (F.media.underdraw) s.hatch(mx, my + mry + S * .05, mrx * 1.5, S * .07, .1, 3, .14);
      return;
    }

    if (P.style === 'beak') {
      // Two wedges hinged at the corner. `open` swings the lower one
      // down, so a bird can talk with the same machinery as a mouth.
      const bl = Math.max(S * .1, mw * .95) * P.beakLen;
      const bh = S * .075 * P.beakLen;
      const hinge = [mx - bl * .42, my];
      const tipX = mx + bl * .58, tipY = my + (open ? -bh * .15 : bh * .1);
      const upper = chaikin([hinge, [mx + bl * .1, my - bh * .95], [tipX, tipY]], true, 1);
      F.media.tone(s, upper, { style: 'light', col: F.colors.accent, gap: S * .04 });
      F.media.edge(s, upper.concat([upper[0]]), lw * 1.15, { amp: .7 });
      const drop = open ? bh * 1.5 : bh * .1;
      const lower = chaikin([hinge, [mx + bl * .08, my + bh * .55 + drop], [tipX, tipY + drop * .55]], true, 1);
      F.media.tone(s, lower, { style: 'light', col: F.colors.accent, gap: S * .04 });
      F.media.edge(s, lower.concat([lower[0]]), lw * 1.05, { amp: .7 });
      if (open) s.inkFill([hinge, [mx + bl * .3, my + bh * .2], [mx + bl * .05, my + bh * .5 + drop * .5]], .55);
      s.sline([[hinge[0], hinge[1]], [tipX * .9, tipY]], 1.2, .35);
      return;
    }

    if (P.style === 'buckteeth') {
      // two big square teeth hanging over a small mouth
      const tw = Math.max(S * .05, mw * .32), th = S * .075 * (open ? 1.35 : 1);
      s.stroke([[mx - mw * .7, my], [mx + mw * .7, my + s.jr(-.01, .01) * S]], lw * 1.1, { taper: .3 });
      for (const sd2 of [-1, 1]) {
        const tx = mx + sd2 * tw * .52;
        const tooth = [[tx - tw * .48, my], [tx + tw * .48, my], [tx + tw * .44, my + th], [tx - tw * .44, my + th]];
        s.paperFill(tooth);
        F.media.edge(s, tooth.concat([tooth[0]]), lw * .95, { amp: .6 });
      }
      if (F.media.underdraw) s.hatch(mx, my + th * 1.35, tw * 2, S * .04, .1, 2, .18);
      return;
    }

    if (P.style === 'drool') {
      // an open mouth with a thread of drool escaping one corner
      const orx = Math.max(S * .055, mw * .5), ory = S * .062 * (open ? 1.4 : 1);
      const hole = s.blobPts(mx, my, orx, ory, s.jr(-.12, .12), .5);
      F.media.tone(s, hole, { style: 'black', gap: orx * .4 });
      F.media.edge(s, hole.concat([hole[0]]), lw * 1.1, { amp: .8 });
      const sd2 = s.chance(.5) ? -1 : 1;
      const dx0 = mx + sd2 * orx * .72;
      s.sline(chaikin([[dx0, my + ory * .5], [dx0 + sd2 * S * .012, my + ory + S * .06],
                       [dx0, my + ory + S * .12]], false, 2), 1.4, .6);
      const bead = s.blobPts(dx0, my + ory + S * .15, S * .022, S * .028, 0, .4);
      s.paperFill(bead);
      s.stroke(bead.concat([bead[0]]), lw * .8, { taper: .12, amp: .4 });
      return;
    }

    if (P.style === 'tongue') {
      // mouth open, tongue hanging out, no dignity at all
      const orx = Math.max(S * .06, mw * .42), ory = S * .07 * (open ? 1.4 : 1);
      const hole = s.blobPts(mx, my, orx, ory, s.jr(-.15, .15));
      F.media.tone(s, hole, { style: 'black', gap: orx * .4 });
      F.media.edge(s, hole.concat([hole[0]]), lw * 1.1, { amp: .9 });
      const tx = mx + orx * s.jr(-.3, .3);
      const tongue = chaikin([[tx - orx * .34, my + ory * .4], [tx - orx * .38, my + ory + S * .055],
                              [tx, my + ory + S * .085], [tx + orx * .38, my + ory + S * .05],
                              [tx + orx * .34, my + ory * .4]], true, 2);
      s.paperFill(tongue);
      if (F.colors.skin) { s.poly(tongue, true); c2fill(s, F.colors.skin, .35); }
      F.media.edge(s, tongue.concat([tongue[0]]), lw * .9, {});
      s.sline([[tx, my + ory * .7], [tx + s.jr(-2, 2), my + ory + S * .06]], 1.1, .4);
      return;
    }

    if (P.style === 'stitch') {
      // sewn shut: the seam and the thread crossing it
      const seam = chaikin([[mx - mw, my + s.jr(-.01, .01) * S], [mx, my + S * .012], [mx + mw * .95, my - s.jr(0, .02) * S]], false, 1);
      s.stroke(seam, lw * 1.15, { taper: .2, over: S * .015 });
      const n = P.nStitch;
      for (let i = 0; i < n; i++) {
        const u = (i + .5) / n;
        const tx = mx - mw * .8 + mw * 1.6 * u;
        const ty = my + Math.sin(u * Math.PI) * S * .008;
        s.stroke([[tx - S * .022, ty - S * .03], [tx + S * .022, ty + S * .032]], lw * .8, { taper: .3, alpha: .8 });
        if (s.chance(.5)) s.sline([[tx - S * .018, ty - S * .026], [tx + S * .018, ty + S * .028]], 1, .35);
      }
      if (open) {   // the thread strains but the mouth stays shut
        s.hatch(mx, my + S * .05, mw * 1.2, S * .05, .1, 2, .16);
      }
      return;
    }

    if (P.style === 'fangs') {
      s.stroke([[mx - mw, my], [mx + mw * .9, my + s.jr(-.02, .02) * S]], lw * 1.1, { taper: .25, over: S * .02 });
      for (const sd of [-1, 1]) {
        const fx2 = mx + sd * mw * .52;
        const fang = [[fx2 - mw * .1, my], [fx2 + s.jr(-.02, .02) * mw, my + S * .075], [fx2 + mw * .1, my]];
        s.paperFill(fang);
        s.broken(fang.concat([fang[0]]), lw * .9, { ghost: true });
        s.hatch(fx2, my + S * .03, mw * .12, S * .05, -1, 2, .2);
      }
      return;
    }

    // ---- the portrait mouths --------------------------------
    // zigzag and cat handle 'open' themselves — the grin widens, the
    // cat mouth drops a small dark wedge — so they skip the generic gape
    if ((open || P.style === 'open') && P.style !== 'zigzag' && P.style !== 'cat') {
      s.stroke([[mx - mw * .7, my], [mx + mw * .7, my]], lw * 1.1, { taper: .25 });
      s.inkFill([[mx - mw * .32, my + S * .008], [mx + mw * .32, my + S * .008], [mx + mw * .2, my + S * .05], [mx - mw * .2, my + S * .05]], .7);
    } else if (P.style === 'flat') {
      s.stroke([[mx - mw, my], [mx + mw * .9, my + s.jr(-.02, .02) * S]], lw * 1.1, { taper: .25, over: S * .02 });
    } else if (P.style === 'frown') {
      s.stroke(chaikin([[mx - mw, my - S * .02], [mx, my + S * .025], [mx + mw * .9, my - S * .025]], false, 1), lw * 1.1, { taper: .25 });
    } else if (P.style === 'smirk') {
      s.stroke(chaikin([[mx - mw * .7, my + S * .01], [mx + mw * .5, my - S * .005], [mx + mw * .95, my - S * .045]], false, 1), lw * 1.1, { taper: .25 });
    } else if (P.style === 'zigzag') {
      // the wide toothy grin: a band with a sawtooth bite through it
      const bh = S * .05 * (open ? 1.5 : 1);
      const band = chaikin([[mx - mw * 1.05, my - bh], [mx + mw * 1.05, my - bh * .9],
                            [mx + mw * 1.1, my + bh], [mx - mw * 1.08, my + bh * 1.1]], true, 2);
      s.paperFill(band);
      F.media.edge(s, band.concat([band[0]]), lw * 1.15, { amp: .9 });
      const zz = [];
      const n = P.nTeeth * 2 + 2;
      for (let i = 0; i <= n; i++)
        zz.push([mx - mw + (mw * 2 / n) * i, my + ((i % 2) ? bh * .55 : -bh * .5) + s.jr(-.004, .004) * S]);
      s.stroke(zz, lw * .95, { taper: .35, amp: .4 });
      // the grin darkens into its corners
      if (F.media.underdraw) {
        s.hatch(mx - mw * .88, my, S * .05, bh * 1.4, .2, 3, .3);
        s.hatch(mx + mw * .88, my, S * .05, bh * 1.4, -.2, 3, .3);
      }
    } else if (P.style === 'cat') {
      // The W. On a muzzle it spans the pale patch, which is the
      // single mark that makes a cat a cat.
      const M = F.L.M;
      const cw = M.on ? M.rx * .78 : mw * .62;
      const dip = (M.on ? M.ry * .34 : S * .032);
      s.stroke(chaikin([[mx - cw, my - dip * .7], [mx - cw * .5, my + dip], [mx, my - dip * .5]], false, 1), lw * 1.25, { taper: .3 });
      s.stroke(chaikin([[mx, my - dip * .5], [mx + cw * .5, my + dip], [mx + cw, my - dip * .7]], false, 1), lw * 1.25, { taper: .3 });
      if (open) s.inkFill([[mx - cw * .3, my + dip * .6], [mx + cw * .3, my + dip * .6], [mx, my + dip * 2.2]], .8);
    } else if (P.style === 'tiny') {
      s.stroke([[mx - mw * .28, my], [mx + mw * .28, my + s.jr(-.01, .01) * S]], lw * 1.25, { taper: .3, over: S * .012 });
    } else if (P.style === 'wobble') {
      const n = s.ri(3, 4), pts = [];
      for (let i = 0; i <= n; i++)
        pts.push([mx - mw * .8 + (mw * 1.6 / n) * i, my + ((i % 2) ? S * .022 : -S * .018) + s.jr(-.006, .006) * S]);
      s.stroke(chaikin(pts, false, 1), lw * 1.15, { taper: .28 });
    } else { // grit
      s.stroke([[mx - mw, my], [mx + mw, my]], lw * 1.1, { taper: .25 });
      s.sline([[mx - mw * .4, my - S * .015], [mx - mw * .35, my + S * .015]], 1, .45);
      s.sline([[mx + mw * .3, my - S * .015], [mx + mw * .35, my + S * .015]], 1, .45);
    }

    if (P.crease) s.sline([[fx - w * .1, S * .7], [fx + w * .12, S * .71]], 1, .16);
  },
};
