// The medium: what the face is MADE of. Parts describe shapes; the
// medium decides how a shape gets its value, its colour and its edge.
//
//   tone(s, pts, o)  — a mass: hair, a horn, the dark inside a socket
//   skin(s, pts, col, o) — colour laid over the face and neck
//   edge(s, pts, w, o)   — the contour that closes a shape
//   underdraw            — whether graphite hatching still shows
//                          (true under a wash, false under oil paint)
//
// `o.style` carries the part's own density choice — black / hatch /
// scribble / stipple / light — and each medium answers it in its own
// vocabulary rather than ignoring it.
import { INK } from './sketch.js';

const DENSITY = { black: 1, hatch: .72, scribble: .62, stipple: .5, light: .34 };
const dens = style => DENSITY[style] ?? .7;

export const MEDIA = {
  graphite: {
    id: 'graphite', label: 'graphite', underdraw: true,
    tone(s, pts, o = {}) {
      const style = o.style ?? 'hatch';
      s.paperFill(pts);
      if (o.col) s.setInk(o.col);
      if (style === 'black') s.pencilFill(pts, o.dark ?? 1);
      else if (style === 'hatch') { s.inkFill(pts, .06); s.hatchFill(pts, o.gap ?? 7, s.jr(1.1, 1.7), .4, 1.15); }
      else if (style === 'scribble') { s.inkFill(pts, .05); s.scribbleFill(pts, o.gap ?? 8, .42); }
      else if (style === 'stipple') { s.inkFill(pts, .04); s.stippleFill(pts, (o.gap ?? 7) * .6, .5); }
      else s.inkFill(pts, .03);
      s.setInk(null);
    },
    skin(s, pts, col, o = {}) {
      s.setInk(col);
      s.poly(pts, true); s.ctx.fillStyle = s.inkA(.08); s.ctx.fill();
      if (o.scrib) s.scribbleFill(pts, o.gap ?? 6, .45);
      else {
        s.hatchFill(pts, o.gap ?? 7, s.jr(.7, 1.5), .4, 1.4);
        if (s.chance(.5)) s.hatchFill(pts, (o.gap ?? 7) * 1.7, s.jr(-1.4, -.7), .18, 1.2);
      }
      s.setInk(null);
    },
    edge(s, pts, w, o = {}) { s.broken(pts, w, { ghost: true, ...o }); },
  },

  ink: {
    id: 'ink', label: 'ink', underdraw: true,
    tone(s, pts, o = {}) {
      const d = dens(o.style);
      s.paperFill(pts);
      if (o.col) s.setInk(o.col);
      s.inkFill(pts, .16 + d * .74);
      // dry brush: the loaded edge skipped, and the paper shows through
      const c = s.ctx;
      c.save(); s.poly(pts, true); c.clip();
      for (let i = 0; i < s.ri(4, 9); i++) {
        const [x0, y0, x1, y1] = boxOf(pts);
        s.sline([[x0 - 4, s.jr(y0, y1)], [x1 + 4, s.jr(y0, y1)]],
          s.jr(1.4, 4), 0, s.paperA(s.jr(.25, .7) * (1 - d * .5)));
      }
      c.restore();
      if (d > .6) s.hatchFill(pts, 9, s.jr(1, 1.6), .2, 1.2);
      s.setInk(null);
    },
    skin(s, pts, col, o = {}) {
      s.setInk(col);
      s.washFill(pts, col, { layers: 2, alpha: .13, bleed: .8, blooms: false });
      s.hatchFill(pts, o.gap ?? 8, s.jr(.7, 1.5), .22, 1.2);
      s.setInk(null);
    },
    edge(s, pts, w, o = {}) { s.broken(pts, w * 1.25, { ghost: true, ...o }); },
  },

  watercolor: {
    id: 'watercolor', label: 'watercolour', underdraw: true,
    tone(s, pts, o = {}) {
      const d = dens(o.style);
      const col = o.col ?? [86, 92, 104];
      s.washFill(pts, col, { layers: 2 + Math.round(d * 2), alpha: .1 + d * .13, bleed: 1.1 });
      if (d > .75) s.washFill(pts, s.colMix(col, .8), { layers: 1, alpha: .16, bleed: .7, blooms: false });
    },
    skin(s, pts, col) {
      s.washFill(pts, col, { layers: 2, alpha: .14, bleed: 1.2 });
    },
    edge(s, pts, w, o = {}) { s.broken(pts, w * .8, { ghost: false, alpha: .62, ...o }); },
  },

  oil: {
    id: 'oil', label: 'oil', underdraw: false,
    tone(s, pts, o = {}) {
      const d = dens(o.style);
      const col = o.col ?? s.colMix([70, 66, 62], .6 + d * .8);
      s.oilFill(pts, o.col ? s.colMix(col, .6 + d * .7) : col, { density: .9 + d * .5 });
    },
    skin(s, pts, col) { s.oilFill(pts, col, { density: 1 }); },
    edge(s, pts, w, o = {}) { s.broken(pts, w * .85, { alpha: .5, ...o }); },
  },

  chalk: {
    id: 'chalk', label: 'charcoal', underdraw: true,
    tone(s, pts, o = {}) {
      const d = dens(o.style);
      s.chalkFill(pts, o.col ?? [52, 48, 44], { alpha: .28 + d * .5, density: .8 + d * .7 });
    },
    skin(s, pts, col) { s.chalkFill(pts, col, { alpha: .34, density: .7 }); },
    edge(s, pts, w, o = {}) { s.broken(pts, w * 1.1, { ghost: true, alpha: .62, ...o }); },
  },

  marker: {
    id: 'marker', label: 'marker', underdraw: true,
    tone(s, pts, o = {}) {
      const d = dens(o.style);
      const col = o.col ?? [78, 74, 70];
      s.markerFill(pts, col, { alpha: .16 + d * .3 });
      if (d > .8) s.markerFill(pts, s.colMix(col, .85), { alpha: .22 });
    },
    skin(s, pts, col) { s.markerFill(pts, col, { alpha: .22 }); },
    edge(s, pts, w, o = {}) { s.broken(pts, w * 1.15, { ghost: false, alpha: .9, ...o }); },
  },
};

export const MEDIA_IDS = Object.keys(MEDIA);

function boxOf(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}
