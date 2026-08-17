// Extras overlay: marks (seam / scar / barcode), studs, bandage,
// blush (colored scribble clipped to the face), glasses, the cyber
// eye mods, an antenna — and the accidents that stay in: stray
// strokes, smudges, eraser streaks that lift the drawing.
import { chaikin, circlePts, PAPER, BLUSHC } from '../sketch.js';
import { U } from '../part.js';

const wpick = (rng, pairs) => {
  let t = 0; for (const p of pairs) t += p[1];
  let x = rng.r(0, t);
  for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
  return pairs[pairs.length - 1][0];
};

export const Extras = {
  id: 'extras', label: 'extras', order: 5, depth: .7,
  gen: (rng, C) => ({
    mark: C.pick(rng, 'mark', [['none', 66], ['seam', 10], ['scar', 10], ['sutures', 8], ['barcode', 6]]),
    mod: C.pick(rng, 'mod', [['none', 82], ['patch', 10], ['monocle', 5], ['cyber', 3]]),
    tears: C.chance(rng, 'tears', .35),
    freckles: C.chance(rng, 'freckles', .2),
    spots: C.chance(rng, 'spots', .4),
    whiskers: C.chance(rng, 'whiskers', .06),
    studs: rng.chance(.12),
    bandage: rng.chance(.12),
    blush: rng.chance(.42),
    glasses: C.chance(rng, 'glasses', .14),
    antenna: rng.chance(.05),
    accentIdx: rng.ri(0, 2),
    accidents: rng.chance(.28),
    smudge: rng.chance(.18),
    eraser: rng.chance(.22),
  }),
  meta: () => ({
    mark: { label: 'mark', pick: ['none', 'seam', 'scar', 'barcode', 'sutures'] },
    mod: { label: 'eye mod', pick: ['none', 'cyber', 'patch', 'monocle'] },
    tears: { label: 'black tears', bool: true },
    freckles: { label: 'freckles', bool: true },
    spots: { label: 'spots', bool: true },
    whiskers: { label: 'whiskers', bool: true },
    studs: { label: 'piercings', bool: true },
    bandage: { label: 'plaster', bool: true },
    blush: { label: 'blush', bool: true },
    glasses: { label: 'glasses', bool: true },
    antenna: { label: 'antenna', bool: true },
    accidents: { label: 'loose strokes', bool: true },
    smudge: { label: 'smudge', bool: true },
    eraser: { label: 'eraser', bool: true },
  }),
  bones: () => [{ name: 'extras', x: 0, y: 0 }],
  size: (P, F) => [(F.w * 3.0) / U, (F.s * 2.9) / U],
  draw(s, P, st, F) {
    const S = F.s, w = F.w, ts = F.ts;
    const { facePoly, eyeX, eyeW, eh, fx, markSide, modSide } = F.L;
    const c = s.ctx;

    if (P.glasses && P.mod === 'none') {
      for (const sd of [-1, 1]) {
        s.sline(circlePts(eyeX(sd), eh * .2, eyeW(sd) * 1.15, eh * 1.6, 16), F.lwThin * 1.1, .7);
        s.sline([[eyeX(sd) + sd * eyeW(sd) * 1.15, 0], [sd * w * 1.0, -S * .06]], F.lwThin * .9, .55);
      }
      s.sline([[eyeX(-1) + eyeW(-1) * 1.1, eh * .1], [eyeX(1) - eyeW(1) * 1.1, eh * .1]], F.lwThin * .9, .55);
    }

    if (P.whiskers) {
      // three per side, sprouting from beside the muzzle
      const my2 = F.L.my - S * .06;
      for (const sd of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const a = -.22 + k * .22 + s.jr(-.05, .05);
          const x0 = fx + sd * w * .22, y0 = my2 + k * S * .03;
          s.stroke([[x0, y0], [x0 + sd * w * (.55 + k * .04), y0 + Math.sin(a) * S * .3]],
            F.lwThin * .85, { taper: .4, alpha: s.jr(.55, .85) });
        }
      }
    }
    if (P.spots) {
      // creature markings: a scatter of dots and empty rings, kept off
      // the middle of the face where the features live
      c.save(); s.poly(facePoly, true); c.clip();
      for (let i = 0; i < s.ri(4, 9); i++) {
        const a = s.jr(0, Math.PI * 2);
        const x = fx + Math.cos(a) * w * s.jr(.5, .95);
        const y = Math.sin(a) * S * s.jr(.45, .9);
        if (s.chance(.45)) {
          s.sline(circlePts(x, y, S * s.jr(.018, .045), S * s.jr(.018, .045), 10), 1.2, .5);
        } else {
          c.fillStyle = s.inkA(s.jr(.5, .85));
          s.wobbly(x, y, S * s.jr(.008, .02), S * s.jr(.008, .02)); c.fill();
        }
      }
      c.restore();
    }
    if (P.freckles) {
      for (let i = 0; i < s.ri(6, 10); i++) {
        c.fillStyle = s.inkA(s.jr(.2, .4));
        c.fillRect(fx + s.jr(-.55, .55) * w, S * s.jr(.24, .4), 1.2, 1.2);
      }
    }
    if (P.studs) {
      for (let i = 0; i < 3; i++) {
        c.fillStyle = s.inkA(.65);
        c.beginPath(); c.arc(fx + markSide * w * (.22 + .09 * i), -S * .32 - i * S * .012, S * .011, 0, Math.PI * 2); c.fill();
      }
    }
    if (P.bandage) {
      c.save();
      c.translate(markSide * w * .52 + fx * .4, S * .3);
      c.rotate(s.jr(-.6, .6));
      for (const a2 of [0, Math.PI / 2 * s.jr(.8, 1.2)]) {
        c.save(); c.rotate(a2);
        s.paperFill([[-S * .08, -S * .025], [S * .08, -S * .025], [S * .08, S * .025], [-S * .08, S * .025]]);
        s.sline([[-S * .08, -S * .025], [S * .08, -S * .025]], 1, .4);
        s.sline([[-S * .08, S * .025], [S * .08, S * .025]], 1, .4);
        c.restore();
        if (s.chance(.5)) break;   // sometimes just one strip
      }
      c.restore();
    }
    if (F.colors.blush) {
      c.save(); s.poly(facePoly, true); c.clip();
      s.setInk(BLUSHC);
      for (const sd of [-1, 1]) {
        const bb = s.blobPts(F.turn * w * .25 + sd * w * s.jr(.42, .58), S * s.jr(.3, .4), w * s.jr(.13, .19), S * s.jr(.06, .09));
        s.scribbleFill(bb, S * s.jr(.02, .028), .42);
      }
      s.setInk(null);
      c.restore();
    }

    if (P.tears) {
      // what runs out of a hollow socket, and stains on the way down
      for (const sd of [-1, 1]) {
        const ex = eyeX(sd), ew = eyeW(sd);
        const len = S * s.jr(.35, .75);
        const path = chaikin([[ex + s.jr(-.15, .15) * ew, eh * .9],
                              [ex + s.jr(-.25, .25) * ew, eh * .9 + len * .55],
                              [ex + s.jr(-.4, .4) * ew, eh * .9 + len]], false, 2);
        const wide = [...path.map(p => [p[0] - ew * .17, p[1]]), ...path.slice().reverse().map(p => [p[0] + ew * .17, p[1]])];
        F.media.tone(s, wide, { style: 'black', gap: ew * .3 });
        F.media.edge(s, wide.concat([wide[0]]), F.lwThin * .8, { amp: 1.2 });
        // a drop about to fall
        if (s.chance(.5)) {
          const tip = path[path.length - 1];
          const drop = s.blobPts(tip[0], tip[1] + S * .05, ew * .16, S * .045);
          F.media.tone(s, drop, { style: 'black', gap: ew * .3 });
          F.media.edge(s, drop.concat([drop[0]]), F.lwThin * .7, {});
        }
      }
    }

    // ---- marks ----
    if (P.mark === 'sutures') {
      // a run of stitches crossing the cheek, the face put back together
      const y0 = s.jr(-.1, .2) * S;
      const path = chaikin([[markSide * w * .28, y0 - S * .1], [markSide * w * .55, y0 + S * .06], [markSide * w * .72, y0 + S * .3]], false, 2);
      s.stroke(path, F.lwThin * .9, { taper: .3, alpha: .7 });
      for (let i = 1; i < path.length - 1; i += Math.max(2, (path.length / 6) | 0)) {
        const a = path[i - 1], b = path[i + 1];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
        const hw = S * .035;
        s.stroke([[path[i][0] - nx * hw, path[i][1] - ny * hw], [path[i][0] + nx * hw, path[i][1] + ny * hw]], F.lwThin * .7, { taper: .35, alpha: .75 });
      }
    } else if (P.mark === 'seam') {
      s.sline([[markSide * w * .70, S * .05], [markSide * w * .73, S * .42]], 1.2, .45);
      s.sline([[markSide * w * .73, S * .42], [markSide * w * .6, S * .5]], 1.1, .4);
      s.sline(circlePts(markSide * w * .70, S * .03, S * .014, S * .014, 8), 1, .45);
    } else if (P.mark === 'scar') {
      const y0 = s.jr(-.15, .25) * S;
      s.stroke([[markSide * w * .35, y0 - S * .12], [markSide * w * .75, y0 + S * .18]], F.lwThin, { taper: .3, alpha: .65 });
      for (let i = 0; i < 3; i++) {
        const t = .25 + i * .25;
        const x = markSide * w * (.35 + .4 * t), y = y0 - S * .12 + S * .3 * t;
        s.sline([[x - S * .03, y + S * .02], [x + S * .03, y - S * .02]], 1.1, .5);
      }
    } else if (P.mark === 'barcode') {
      for (let i = 0; i < 7; i++) {
        const x = markSide * w * .48 + i * S * .016 * markSide;
        s.sline([[x, S * .52], [x, S * .52 + S * (.07 + ((i % 3) ? 0 : .02))]], (i % 2) ? 1 : 1.8, .45);
      }
    }

    // ---- eye-zone tech ----
    if (P.mod === 'cyber') {
      const ecx = eyeX(modSide), ew = eyeW(modSide);
      c.fillStyle = PAPER;
      s.wobbly(ecx, eh * .3, ew * .62, eh * 1.3); c.fill();
      s.sline(circlePts(ecx, eh * .3, ew * .5, ew * .5, 16), 1.3, .75);
      s.sline(circlePts(ecx, eh * .3, ew * .3, ew * .3, 12), 1.1, .55);
      c.fillStyle = s.inkA(.9);
      c.beginPath(); c.arc(ecx, eh * .3, ew * .12, 0, Math.PI * 2); c.fill();
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * Math.PI * 2 + .78;
        s.sline([[ecx + Math.cos(a) * ew * .5, eh * .3 + Math.sin(a) * ew * .5],
                 [ecx + Math.cos(a) * ew * .74, eh * .3 + Math.sin(a) * ew * .74]], 1.1, .55);
      }
    } else if (P.mod === 'patch') {
      const ecx = eyeX(modSide), ew = eyeW(modSide);
      const p = chaikin([[ecx - ew * 1.1, -eh * 1.9], [ecx + ew * 1.1, -eh * 1.9], [ecx + ew * .85, eh * 2.2], [ecx - ew * .85, eh * 2.2]], true, 2);
      s.paperFill(p); s.pencilFill(p, .92);
      s.stroke(p.concat([p[0]]), F.lwThin, {});
      s.sline([[ecx + modSide * ew * .9, -eh * 1.5], [-modSide * w * .95, -S * .45]], 1.4, .75);
      s.sline([[ecx - modSide * ew * .5, eh * 2], [modSide * w * .97, S * .35]], 1.4, .75);
    } else if (P.mod === 'monocle') {
      const ecx = eyeX(modSide), ew = eyeW(modSide);
      const fr = [[ecx - ew * 1.2, -eh * 1.3], [ecx + ew * 1.2, -eh * 1.3], [ecx + ew * 1.2, eh * 1.7], [ecx - ew * 1.2, eh * 1.7]];
      s.sline(fr.concat([fr[0]]), F.lwThin * 1.05, .7);
      for (let k = 0; k < 3; k++)
        s.sline([[ecx + modSide * ew * 1.2, -eh * .6 + k * eh * .6], [ecx + modSide * ew * 1.45, -eh * .6 + k * eh * .6]], 1, .5);
      s.sline([[ecx - modSide * ew * 1.2, eh * .1], [-modSide * w * .98, -S * .02]], 1.1, .5);
      c.fillStyle = s.inkA(.7);
      c.beginPath(); c.arc(ecx + modSide * ew * 1.05, -eh * 1.05, S * .01, 0, Math.PI * 2); c.fill();
    }

    if (P.antenna && !['buzz'].includes(F.P.hair.style)) {
      const sd = markSide;
      s.sline([[sd * w * .45, -S * .85], [sd * w * .58, -S * 1.16]], 1.5, .75);
      c.fillStyle = s.colA(F.colors.accent, .85);
      c.beginPath(); c.arc(sd * w * .58, -S * 1.18, S * .015, 0, Math.PI * 2); c.fill();
    }

    // ---- the accidents that stay in ----
    if (P.accidents) {
      for (let k = 0; k < s.ri(1, 2); k++) {
        const x0 = s.jr(-1.1, 1.1) * w, y0 = s.jr(-1, .9) * S, a = s.jr(0, Math.PI * 2), len = S * s.jr(.15, .45);
        s.stroke([[x0, y0], [x0 + Math.cos(a) * len, y0 + Math.sin(a) * len]], F.lwThin * s.jr(.6, 1),
          { taper: .4, alpha: s.jr(.1, .22), over: S * s.jr(0, .06) });
      }
    }
    if (P.smudge) {
      const x0 = s.jr(-1, 1) * w, y0 = s.jr(-.9, .9) * S;
      c.save();
      c.translate(x0, y0); c.rotate(s.jr(0, Math.PI * 2));
      c.fillStyle = s.inkA(.06);
      c.fillRect(-S * s.jr(.08, .16), -S * .03, S * s.jr(.16, .3), S * .06);
      c.restore();
    }
    // the eraser was here: streaks that lift the drawing, a ghost left behind
    if (P.eraser) {
      for (let k = 0; k < s.ri(1, 2); k++) {
        const ex = s.jr(-.9, .9) * w, ey2 = s.jr(-1, .6) * S;
        const ea = s.jr(-.9, .9), el = S * s.jr(.18, .4);
        const dx = Math.cos(ea), dy = Math.sin(ea);
        for (let j = 0; j < s.ri(3, 5); j++) {
          const o = (j - 2) * S * .024 + s.jr(-.01, .01) * S;
          const px2 = -dy * o, py2 = dx * o;
          s.sline([[ex - dx * el * .5 + px2, ey2 - dy * el * .5 + py2], [ex + dx * el * .5 + px2, ey2 + dy * el * .5 + py2]],
            S * s.jr(.035, .06), 0, s.paperA(s.jr(.5, .75)));
        }
        for (let j = 0; j < 2; j++) {
          c.fillStyle = s.inkA(s.jr(.08, .15));
          c.fillRect(ex + s.jr(-.5, .5) * el, ey2 + s.jr(-.3, .3) * el, 1.5, 1.5);
        }
        if (s.chance(.35))
          s.stroke([[ex - dx * el * .4, ey2 - dy * el * .4], [ex + dx * el * .45, ey2 + dy * el * .45]], F.lwThin * .9,
            { taper: .3, alpha: .45 });
      }
    }
  },
};
