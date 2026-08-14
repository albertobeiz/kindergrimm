// ---------------------------------------------------------------
// The hand — graphite on cream, ported from kengocodes/cyber-crowd.
//
// A stroke here is not ctx.stroke(): it's a filled ribbon whose
// width and spine wobble at three frequencies, with dry granulation
// (graphite crumbs shed past the edges, paper biting back in),
// overshoots that veer off-axis, and optional ghost repeats.
// Fills are techniques: hatch / scribble / stipple / solid graphite
// with eraser blobs. Color is the same machinery with the ink
// swapped (setInk) — colored pencil, not paint.
//
// Randomness comes from this.j, reseeded per boil frame: same
// params + different boil seed = same face, freshly redrawn.
// Geometry choices (keypoints, casting) belong OUTSIDE, in params.
// ---------------------------------------------------------------
import { mulberry32 } from './rng.js';

export const TAU = Math.PI * 2;
export const PAPER = '#f6f1e5';
export const PR = [246, 241, 229];
export const INK = [31, 29, 26];

// the muted box of colors: skins, the rare colored hair, small accents
export const SKINC = [[138, 93, 66], [164, 113, 79], [192, 138, 92], [176, 107, 62], [227, 201, 160],
                      [217, 169, 143], [156, 136, 120], [221, 198, 135]];
export const HAIRCOL = [[170, 96, 48], [180, 150, 72], [92, 132, 120], [92, 104, 140], [140, 96, 88], [124, 124, 84]];
export const ACCENTC = [[168, 72, 60], [86, 130, 120], [178, 134, 58]];
export const BLUSHC = [208, 148, 140];

export const smooth = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);

// ---------------- pure geometry ----------------
export function resample(pts, step) {
  const out = [[pts[0][0], pts[0][1]]];
  let need = step;
  for (let i = 1; i < pts.length; i++) {
    let x0 = pts[i - 1][0], y0 = pts[i - 1][1];
    const x1 = pts[i][0], y1 = pts[i][1];
    let d = Math.hypot(x1 - x0, y1 - y0);
    while (d >= need && d > 0) {
      const t = need / d;
      x0 += (x1 - x0) * t; y0 += (y1 - y0) * t;
      out.push([x0, y0]);
      d = Math.hypot(x1 - x0, y1 - y0);
      need = step;
    }
    need -= d;
  }
  const last = pts[pts.length - 1], le = out[out.length - 1];
  if (Math.hypot(last[0] - le[0], last[1] - le[1]) > step * .25) out.push([last[0], last[1]]);
  return out;
}

export function chaikin(pts, closed, it) {
  while (it-- > 0) {
    const out = [], n = pts.length;
    if (!closed) out.push(pts[0]);
    const end = closed ? n : n - 1;
    for (let i = 0; i < end; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
    }
    if (!closed) out.push(pts[n - 1]);
    pts = out;
  }
  return pts;
}

export function circlePts(cx, cy, rx, ry, n = 22, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * TAU;
    const x = Math.cos(t) * rx, y = Math.sin(t) * ry;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}

export function arcPts(cx, cy, rx, ry, a0, a1, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + (a1 - a0) * i / n;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return pts;
}

export function bbox(pts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function offsetPath(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const dd = Math.hypot(nx, ny) || 1;
    out.push([pts[i][0] + nx / dd * d, pts[i][1] + ny / dd * d]);
  }
  return out;
}

// ---------------- the sketch surface ----------------
export class Sketch {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ink = INK;
    this.boil(1);
  }

  boil(seed) { this.j = mulberry32((seed >>> 0) || 1); }
  jr(a, b) { return a + this.j() * (b - a); }
  ri(a, b) { return Math.floor(this.jr(a, b + 1)); }
  chance(p) { return this.j() < p; }
  pick(arr) { return arr[(this.j() * arr.length) | 0]; }
  weighted(pairs) {
    let t = 0; for (const p of pairs) t += p[1];
    let x = this.j() * t;
    for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  }

  setInk(c) { this.ink = c || INK; }
  inkA(a) { return `rgba(${this.ink[0]},${this.ink[1]},${this.ink[2]},${Math.min(1, a)})`; }
  colA(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${Math.min(1, a)})`; }
  paperA(a) { return `rgba(${PR[0]},${PR[1]},${PR[2]},${a})`; }

  poly(pts, close) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (close) c.closePath();
  }

  // rot defaults to anything — fine for round blobs, but pass a small
  // one for eccentric shapes or a free spin will stand them on end.
  // wob scales the lumpiness: 1 is a scribbled mass, ~.4 is a shape
  // drawn slowly because it mattered (an eye, a held breath).
  blobPts(cx, cy, rx, ry, rot = this.jr(0, TAU), wob = 1) {
    const ph = this.jr(0, 7), n = 16, pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / n * TAU;
      const m = 1 + (.17 * Math.sin(t * 2 + ph) + .1 * Math.sin(t * 5 + ph * 2.3)) * wob;
      const x = Math.cos(t) * rx * m, y = Math.sin(t) * ry * m;
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return chaikin(pts, true, 1);
  }

  // a filled shape that was drawn by hand, not computed (path only)
  wobbly(cx, cy, rx, ry) {
    const c = this.ctx, ph = this.jr(0, 7), n = 18;
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n * TAU;
      const m = 1 + .05 * Math.sin(t * 3 + ph) + .03 * Math.sin(t * 7 + ph * 2);
      const x = cx + Math.cos(t) * rx * m + this.jr(-.3, .3), y = cy + Math.sin(t) * ry * m + this.jr(-.3, .3);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
  }

  // ---- the graphite stroke: a wobbling ribbon with dry edges ----
  stroke(pts, w, o = {}) {
    const ctx = this.ctx;
    const alpha = o.alpha ?? this.jr(.68, .97);
    const amp = o.amp ?? (w * .5 + .9);
    const taper = o.taper ?? .22;
    if (o.over) {
      // overshoots veer off-axis, the way a flick of the wrist does
      pts = pts.slice();
      const a = pts[0], b = pts[1];
      const d0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const f0 = o.over * this.jr(-.5, .5);
      pts[0] = [a[0] - (b[0] - a[0]) / d0 * o.over - (b[1] - a[1]) / d0 * f0,
                a[1] - (b[1] - a[1]) / d0 * o.over + (b[0] - a[0]) / d0 * f0];
      const y = pts[pts.length - 1], z = pts[pts.length - 2];
      const d1 = Math.hypot(y[0] - z[0], y[1] - z[1]) || 1;
      const f1v = o.over * this.jr(-.5, .5);
      pts[pts.length - 1] = [y[0] + (y[0] - z[0]) / d1 * o.over - (y[1] - z[1]) / d1 * f1v,
                             y[1] + (y[1] - z[1]) / d1 * o.over + (y[0] - z[0]) / d1 * f1v];
    }
    const rs = resample(pts, Math.max(2.2, w * .9));
    const n = rs.length;
    if (n < 3) {
      ctx.strokeStyle = this.inkA(alpha); ctx.lineWidth = w; ctx.lineCap = 'round';
      this.poly(pts, false); ctx.stroke();
      return;
    }
    const p1 = this.jr(0, 7), p2 = this.jr(0, 7), p3 = this.jr(0, 7), p4 = this.jr(0, 7);
    const f1 = this.jr(1.5, 3.5), f2 = this.jr(5, 9), f3 = this.jr(11, 17);
    const L = [], Rt = [], C = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = rs[Math.max(0, i - 1)], b = rs[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const d = Math.hypot(nx, ny) || 1;
      nx /= d; ny /= d;
      const off = amp * (.55 * Math.sin(t * f1 * 2 + p1) + .3 * Math.sin(t * f2 + p2) + .15 * Math.sin(t * f3 + p3));
      const px = rs[i][0] + nx * off + this.jr(-.35, .35), py = rs[i][1] + ny * off + this.jr(-.35, .35);
      let half = w / 2 * (o.wedge ? (.25 + .95 * t) : (.3 + .7 * smooth(Math.min(t, 1 - t) / taper)))
                       * (1 + .38 * Math.sin(t * 7.3 + p4) + .14 * Math.sin(t * 19 + p2)) * this.jr(.88, 1.14);
      half = Math.max(half, .28);
      L.push([px + nx * half, py + ny * half]);
      Rt.push([px - nx * half, py - ny * half]);
      C.push([px, py, nx, ny, half]);
    }
    // the graphite core
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]);
    ctx.closePath();
    ctx.fillStyle = this.inkA(alpha * .62);
    ctx.fill();
    // dry granulation: graphite crumbs across and past the stroke,
    // and paper biting back into its edges — nothing stays smooth
    if (w >= 1.2) {
      for (const [px, py, nx, ny, half] of C) {
        const nd = Math.min(4, Math.max(1, Math.round(half * 1.5)));
        for (let k = 0; k < nd; k++) {
          if (this.chance(.3)) continue;
          const u = this.jr(-1.05, 1.05);
          const sz = this.jr(.7, 1.5) + (half > 2 ? .4 : 0);
          ctx.fillStyle = this.inkA(alpha * this.jr(.2, .55));
          ctx.fillRect(px + nx * half * u + this.jr(-.7, .7) - sz / 2, py + ny * half * u + this.jr(-.7, .7) - sz / 2, sz, sz);
        }
        if (this.chance(.45)) {
          const u = (this.chance(.5) ? 1 : -1) * this.jr(.8, 1.15);
          const sz = this.jr(.9, 2);
          ctx.fillStyle = this.paperA(this.jr(.4, .8));
          ctx.fillRect(px + nx * half * u - sz / 2, py + ny * half * u - sz / 2, sz, sz);
        }
      }
    }
    if (o.ghost && this.chance(.6)) {
      this.stroke(pts, w * .45, { alpha: alpha * .2, amp: amp * 1.9, taper });
      if (this.chance(.3)) this.stroke(pts, w * .35, { alpha: alpha * .12, amp: amp * 2.6, taper });
    }
  }

  // a contour drawn in 2-3 passes that overlap, the sketcher's habit
  broken(pts, w, o = {}) {
    const n = pts.length;
    if (n < 10) { this.stroke(pts, w, o); return; }
    const segs = this.ri(2, 3);
    for (let i = 0; i < segs; i++) {
      const a = Math.max(0, Math.floor(n * i / segs - n * .05));
      const b = Math.min(n, Math.floor(n * (i + 1) / segs + n * .09));
      this.stroke(pts.slice(a, b), w * this.jr(.6, 1.3),
        { ...o, alpha: (o.alpha ?? this.jr(.68, .97)) * this.jr(.75, 1.05),
          over: (i === 0 || i === segs - 1) ? o.over : w * this.jr(0, 2) });
    }
  }

  // thin pencil line: tremor on the wobble, sometimes the pen lifts
  sline(pts, w, alpha, color) {
    const ctx = this.ctx;
    const rs = resample(pts, 3);
    const p1 = this.jr(0, 7), p2 = this.jr(0, 7), f = this.jr(4, 9);
    ctx.beginPath();
    let lift = false;
    for (let i = 0; i < rs.length; i++) {
      const t = i / (rs.length - 1 || 1);
      const a = rs[Math.max(0, i - 1)], b = rs[Math.min(rs.length - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const d = Math.hypot(nx, ny) || 1;
      const off = (w * .55 + .5) * (.6 * Math.sin(t * f + p1) + .4 * Math.sin(t * f * 2.7 + p2));
      const x = rs[i][0] + nx / d * off + this.jr(-.45, .45), y = rs[i][1] + ny / d * off + this.jr(-.45, .45);
      if (!i || lift) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      lift = this.chance(.035);
    }
    ctx.strokeStyle = color || this.inkA(Math.min(1, alpha * 1.3));
    ctx.lineWidth = w * this.jr(.75, 1.3); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
    // heavier pencil lines shed a few crumbs too
    if (!color && w >= 1.3) {
      for (let i = 0; i < rs.length; i += 2) {
        if (this.chance(.55)) continue;
        const sz = this.jr(.6, 1.2);
        ctx.fillStyle = this.chance(.7) ? this.inkA(alpha * this.jr(.2, .4)) : this.paperA(this.jr(.4, .7));
        ctx.fillRect(rs[i][0] + this.jr(-w * .8 - .6, w * .8 + .6) - sz / 2, rs[i][1] + this.jr(-w * .8 - .6, w * .8 + .6) - sz / 2, sz, sz);
      }
    }
  }

  hatch(cx, cy, wdt, hgt, ang, n, alpha, w = 1.1) {
    const px = Math.cos(ang + Math.PI / 2), py = Math.sin(ang + Math.PI / 2);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1 || 1) - .5) * wdt;
      const jl = this.jr(.75, 1.2), jo = this.jr(-.1, .1) * hgt;
      this.sline([[cx + px * t - dx * (hgt / 2 * jl) + jo * dx, cy + py * t - dy * (hgt / 2 * jl) + jo * dy],
                  [cx + px * t + dx * (hgt / 2 * jl) + jo * dx, cy + py * t + dy * (hgt / 2 * jl) + jo * dy]], w, alpha * this.jr(.6, 1.15));
    }
  }

  hatchFill(pts, spacing, ang, alpha, w = 1.1) {
    const ctx = this.ctx;
    const [x0, y0, x1, y1] = bbox(pts);
    const diag = Math.hypot(x1 - x0, y1 - y0);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    ctx.save();
    this.poly(pts, true); ctx.clip();
    const px = Math.cos(ang + Math.PI / 2), py = Math.sin(ang + Math.PI / 2);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const n = Math.ceil(diag / spacing);
    for (let i = -n; i <= n; i++) {
      const t = i * spacing + this.jr(-.2, .2) * spacing;
      this.sline([[cx + px * t - dx * diag * .6, cy + py * t - dy * diag * .6], [cx + px * t + dx * diag * .6, cy + py * t + dy * diag * .6]], w, alpha * this.jr(.6, 1.1));
    }
    ctx.restore();
  }

  stippleFill(pts, spacing, alpha) {
    const ctx = this.ctx;
    const [x0, y0, x1, y1] = bbox(pts);
    const n = ((x1 - x0) * (y1 - y0)) / (spacing * spacing);
    ctx.save();
    this.poly(pts, true); ctx.clip();
    for (let i = 0; i < n; i++) {
      const sz = this.jr(.8, 1.8);
      ctx.fillStyle = this.inkA(alpha * this.jr(.5, 1.2));
      ctx.fillRect(this.jr(x0, x1), this.jr(y0, y1), sz, sz);
    }
    ctx.restore();
  }

  scribbleFill(pts, spacing, alpha) {
    const ctx = this.ctx;
    const [x0, y0, x1, y1] = bbox(pts);
    ctx.save();
    this.poly(pts, true); ctx.clip();
    const slope = this.jr(-.25, .25);
    for (let y = y0 - spacing; y < y1 + spacing; y += spacing * this.jr(.8, 1.2)) {
      const line = [];
      const ph = this.jr(0, 7);
      for (let x = x0; x <= x1; x += 5)
        line.push([x, y + (x - x0) * slope + Math.sin(x * .55 + ph) * spacing * .42 + this.jr(-1, 1)]);
      if (line.length > 1) this.sline(line, 1, alpha * this.jr(.6, 1.05));
    }
    ctx.restore();
  }

  // solid graphite: flat base, two scribble passes, eraser blobs lifting out
  pencilFill(pts, darkness) {
    const ctx = this.ctx;
    const [x0, y0, x1, y1] = bbox(pts);
    ctx.save();
    this.poly(pts, true); ctx.clip();
    ctx.fillStyle = this.inkA(darkness * .48);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let pass = 0; pass < 2; pass++) {
      const slope = this.jr(-.5, .5), sp = this.jr(2.6, 3.8);
      for (let y = y0 - sp; y < y1 + sp; y += sp * this.jr(.8, 1.25)) {
        const line = [];
        const ph = this.jr(0, 7);
        for (let x = x0; x <= x1; x += 5)
          line.push([x, y + (x - x0) * slope + Math.sin(x * .5 + ph) * sp * .4 + this.jr(-1, 1)]);
        if (line.length > 1) this.sline(line, this.jr(1.4, 2.2), darkness * this.jr(.42, .62));
      }
    }
    for (let k = 0; k < this.ri(2, 3); k++) {
      this.poly(this.blobPts(this.jr(x0, x1), this.jr(y0, y1), (x1 - x0) * this.jr(.1, .22), (y1 - y0) * this.jr(.1, .2)), true);
      ctx.fillStyle = this.paperA(this.jr(.06, .14));
      ctx.fill();
    }
    ctx.restore();
  }

  inkFill(pts, a) { this.poly(pts, true); this.ctx.fillStyle = this.inkA(a); this.ctx.fill(); }
  paperFill(pts) { this.poly(pts, true); this.ctx.fillStyle = PAPER; this.ctx.fill(); }

  // ---------------- wet and dry media ----------------
  // Everything below paints a SHAPE. They differ in what the material
  // does at the edges, which is what the eye actually reads:
  //   wash  — pigment floats, then dries darker where the pool ended
  //   oil   — opaque loaded strokes, each one a ridge that catches light
  //   chalk — pigment sits on the tooth, never fully covering it
  //   marker— flat translucent bands, doubled where the nib crossed

  colMix(c, f) { return c.map(v => Math.max(0, Math.min(255, v * f)) | 0); }

  // shift a shape about its own centre: paint never lands quite on the drawing
  offsetShape(pts, scale, dx, dy, wob = 0) {
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; }
    cx /= pts.length; cy /= pts.length;
    return pts.map(p => [
      cx + (p[0] - cx) * scale + dx + (wob ? this.jr(-wob, wob) : 0),
      cy + (p[1] - cy) * scale + dy + (wob ? this.jr(-wob, wob) : 0),
    ]);
  }

  // watercolor: translucent layers that never register, a darker rim
  // where each pool dried, blooms pushing pigment outward, granulation
  washFill(pts, col, o = {}) {
    const { layers = 3, alpha = .17, bleed = 1, rim = true, blooms = true } = o;
    const c = this.ctx;
    for (let L = 0; L < layers; L++) {
      const shape = this.offsetShape(pts, 1 + L * .018 * bleed,
        this.jr(-2.2, 2.2) * bleed, this.jr(-2.2, 2.2) * bleed, 1.5 * bleed);
      this.poly(shape, true);
      c.fillStyle = this.colA(this.colMix(col, 1 - L * .06), alpha);
      c.fill();
      // the tide line: pigment crowds the edge as the water retreats
      if (rim && L === layers - 1) {
        c.save();
        this.poly(shape, true); c.clip();
        c.strokeStyle = this.colA(this.colMix(col, .82), alpha * 1.5);
        c.lineWidth = this.jr(2.5, 5);
        c.lineJoin = 'round';
        this.poly(this.offsetShape(shape, 1, 0, 0, 1.2), true);
        c.stroke();
        c.restore();
      }
    }
    c.save();
    this.poly(this.offsetShape(pts, 1.03, 0, 0, 2), true); c.clip();
    if (blooms) {
      // backruns: water pushed in late carries pigment to a hard ring
      for (let k = 0; k < this.ri(1, 3); k++) {
        const [x0, y0, x1, y1] = bbox(pts);
        const b = this.blobPts(this.jr(x0, x1), this.jr(y0, y1),
          (x1 - x0) * this.jr(.12, .3), (y1 - y0) * this.jr(.12, .3));
        this.poly(b, true);
        c.fillStyle = this.paperA(this.jr(.12, .26));
        c.fill();
        c.strokeStyle = this.colA(this.colMix(col, .8), .16);
        c.lineWidth = this.jr(1.2, 2.4);
        c.stroke();
      }
    }
    // granulation: the heavy pigment settles into the paper's low spots
    const [gx0, gy0, gx1, gy1] = bbox(pts);
    const n = Math.min(320, ((gx1 - gx0) * (gy1 - gy0)) / 34);
    for (let i = 0; i < n; i++) {
      c.fillStyle = this.colA(this.colMix(col, .72), this.jr(.05, .22));
      c.fillRect(this.jr(gx0, gx1), this.jr(gy0, gy1), this.jr(.8, 1.9), this.jr(.8, 1.9));
    }
    c.restore();
  }

  // one loaded brush mark: opaque body, a lighter ridge where the
  // bristles piled the paint up, a darker trough on the other side
  daub(x0, y0, x1, y1, wd, col, o = {}) {
    const c = this.ctx;
    const alpha = o.alpha ?? 1;
    const mx = (x0 + x1) / 2 + this.jr(-1, 1), my = (y0 + y1) / 2 + this.jr(-1, 1);
    let nx = -(y1 - y0), ny = x1 - x0;
    const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, x1, y1);
    c.strokeStyle = this.colA(col, alpha);
    c.lineWidth = wd;
    c.stroke();
    c.beginPath();
    c.moveTo(x0 + nx * wd * .28, y0 + ny * wd * .28);
    c.quadraticCurveTo(mx + nx * wd * .28, my + ny * wd * .28, x1 + nx * wd * .28, y1 + ny * wd * .28);
    c.strokeStyle = this.colA(this.colMix(col, this.jr(1.14, 1.3)), alpha * .85);
    c.lineWidth = wd * this.jr(.16, .3);
    c.stroke();
    c.beginPath();
    c.moveTo(x0 - nx * wd * .3, y0 - ny * wd * .3);
    c.quadraticCurveTo(mx - nx * wd * .3, my - ny * wd * .3, x1 - nx * wd * .3, y1 - ny * wd * .3);
    c.strokeStyle = this.colA(this.colMix(col, this.jr(.72, .86)), alpha * .7);
    c.lineWidth = wd * this.jr(.14, .26);
    c.stroke();
  }

  // oil: the shape is covered by daubs, not filled. Direction holds
  // roughly, colour shifts stroke to stroke, and the paint runs past
  // the drawing here and there.
  oilFill(pts, col, o = {}) {
    const { alpha = 1, ang = null, density = 1 } = o;
    const c = this.ctx;
    const [x0, y0, x1, y1] = bbox(pts);
    c.save();
    this.poly(this.offsetShape(pts, 1.02, 0, 0, 1.5), true);
    c.clip();
    // a ground colour so gaps between daubs don't show paper
    this.poly(this.offsetShape(pts, 1.05, 0, 0, 0), true);
    c.fillStyle = this.colA(this.colMix(col, .9), alpha * .95);
    c.fill();
    const a = ang ?? this.jr(-1.3, -.5);
    const dx = Math.cos(a), dy = Math.sin(a);
    const diag = Math.hypot(x1 - x0, y1 - y0);
    const wd = Math.max(3.5, diag * .085);
    const step = wd * .62 / density;
    const px = -dy, py = dx;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (let off = -diag * .6; off <= diag * .6; off += step * this.jr(.8, 1.2)) {
      const bx = cx + px * off, by = cy + py * off;
      const len = diag * this.jr(.22, .55);
      const t0 = this.jr(-.55, .15) * diag;
      const sx = bx + dx * t0, sy = by + dy * t0;
      const tint = this.colMix(col, this.jr(.82, 1.18));
      this.daub(sx, sy, sx + dx * len, sy + dy * len, wd * this.jr(.8, 1.25), tint, { alpha });
    }
    c.restore();
  }

  // chalk / soft pastel: pigment caught on the tooth, edges crumbling,
  // and streaks lifted back out with a finger
  chalkFill(pts, col, o = {}) {
    const { alpha = .5, density = 1 } = o;
    const c = this.ctx;
    const [x0, y0, x1, y1] = bbox(pts);
    c.save();
    this.poly(pts, true); c.clip();
    this.poly(pts, true);
    c.fillStyle = this.colA(col, alpha * .38);
    c.fill();
    const a = this.jr(-1.2, -.5);
    const dx = Math.cos(a), dy = Math.sin(a);
    const diag = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.min(1400, diag * diag * .04 * density);
    for (let i = 0; i < n; i++) {
      const t = this.jr(-.6, .6) * diag, u = this.jr(-.6, .6) * diag;
      const cx = (x0 + x1) / 2 + dx * t - dy * u;
      const cy = (y0 + y1) / 2 + dy * t + dx * u;
      const sz = this.jr(1, 3.2);
      c.fillStyle = this.colA(this.colMix(col, this.jr(.85, 1.15)), this.jr(.05, .3) * alpha * 2);
      c.fillRect(cx, cy, sz, sz * this.jr(.6, 1.4));
    }
    // smudged with a thumb, and lifted in places
    for (let k = 0; k < this.ri(2, 4); k++) {
      this.poly(this.blobPts(this.jr(x0, x1), this.jr(y0, y1), (x1 - x0) * this.jr(.1, .26), (y1 - y0) * this.jr(.08, .2)), true);
      c.fillStyle = this.chance(.5) ? this.paperA(this.jr(.1, .26)) : this.colA(this.colMix(col, .8), .12);
      c.fill();
    }
    c.restore();
  }

  // marker: flat translucent bands, doubling darker where they overlap
  markerFill(pts, col, o = {}) {
    const { alpha = .3 } = o;
    const c = this.ctx;
    const [x0, y0, x1, y1] = bbox(pts);
    c.save();
    this.poly(this.offsetShape(pts, 1.01, this.jr(-2, 2), this.jr(-2, 2), 0), true);
    c.clip();
    const a = this.jr(-.35, .35) + (this.chance(.5) ? 0 : Math.PI / 2);
    const dx = Math.cos(a), dy = Math.sin(a);
    const px = -dy, py = dx;
    const diag = Math.hypot(x1 - x0, y1 - y0);
    const wd = Math.max(6, diag * .16);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    c.lineCap = 'square';
    for (let off = -diag * .6; off <= diag * .6; off += wd * this.jr(.72, .95)) {
      const bx = cx + px * off, by = cy + py * off;
      c.beginPath();
      c.moveTo(bx - dx * diag * .7, by - dy * diag * .7);
      c.lineTo(bx + dx * diag * .7, by + dy * diag * .7);
      c.strokeStyle = this.colA(col, alpha * this.jr(.8, 1.15));
      c.lineWidth = wd;
      c.stroke();
    }
    c.restore();
  }

  curl(cx, cy, r, a0, len, color, width) {
    const ctx = this.ctx;
    ctx.beginPath();
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const a = a0 + len * i / n;
      const x = cx + Math.cos(a) * r * this.jr(.92, 1.08) + this.jr(-.4, .4);
      const y = cy + Math.sin(a) * r * this.jr(.92, 1.08) + this.jr(-.4, .4);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
  }
}
