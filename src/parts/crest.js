// What grows out of the skull: horns, antlers, a ridge of spikes, a
// crown of bone. The dark-fantasy silhouette lives here.
// Horns and antlers get one bone per side (they can shake later);
// spikes and crowns are a single centered bone.
import { chaikin, circlePts } from '../sketch.js';
import { U } from '../part.js';

const wpick = (rng, pairs) => {
  let t = 0; for (const p of pairs) t += p[1];
  let x = rng.r(0, t);
  for (const p of pairs) { if ((x -= p[1]) < 0) return p[0]; }
  return pairs[pairs.length - 1][0];
};

// What grows out of a doodle skull: mostly EARS, then horns, then the
// odd sprout, eye stalk, halo or bolt.
const STYLES = [
  ['none', 18], ['cat', 11], ['bunny', 10], ['floppy', 10], ['bear', 9], ['horns', 9],
  ['sprout', 6], ['spikes', 6], ['stalks', 5], ['frills', 4], ['flower', 4],
  ['halo', 3], ['bolt', 3], ['antlers', 2], ['crown', 2],
];
const ALL = STYLES.map(p => p[0]);
const PAIRED = new Set(['horns', 'antlers', 'bunny', 'floppy', 'cat', 'bear', 'stalks', 'frills']);
const EARS = new Set(['cat', 'bunny', 'floppy', 'bear']);

// the inner-ear arc of a bear nub: a smile across its lower half
function circlePtsArc(cx, cy, r) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (.15 + .7 * i / 8);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * .9]);
  }
  return pts;
}

// a spine thickened into a tapered outline
function tapered(spine, w0, w1) {
  const L = [], R = [];
  for (let i = 0; i < spine.length; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(spine.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    const t = i / (spine.length - 1);
    const hw = (w0 + (w1 - w0) * t) / 2;
    L.push([spine[i][0] + nx * hw, spine[i][1] + ny * hw]);
    R.push([spine[i][0] - nx * hw, spine[i][1] - ny * hw]);
  }
  return [...L, ...R.reverse()];
}

export const Crest = {
  id: 'crest', label: 'appendages', order: 7, depth: .35,
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', STYLES),
    tone: C.pick(rng, 'tone', [['bone', 40], ['dark', 32], ['ringed', 28]]),
    len: C.range(rng, 'len', .85, 1.35),
    curve: C.range(rng, 'curve', -.5, .9),   // <0 sweeps forward, >0 curls back
    spread: C.range(rng, 'spread', .5, .78),
    // nobody draws the second ear the same as the first
    tilt: C.range(rng, 'tilt', -.3, .5),
    earAsym: rng.r(-.22, .22),
    nSpikes: rng.ri(5, 8),
    branches: rng.ri(2, 3),
  }),
  meta: () => ({
    style: { label: 'style', pick: ALL },
    tone: { label: 'material', pick: ['bone', 'dark', 'ringed', 'skin'] },
    len: { label: 'length', range: [.5, 2.4] },
    curve: { label: 'curve', range: [-.9, 1.4] },
    spread: { label: 'spread', range: [.3, 1.0] },
    tilt: { label: 'tilt', range: [-.6, .9] },
    earAsym: { label: 'asymmetry', range: [-.4, .4] },
  }),
  skip: P => P.style === 'none',
  bones: (P, F) => {
    const topY = -F.s * F.P.skull.skullY * .84;
    // An ear grows out of the BACK of the skull, so it draws behind it
    // and the head's own outline crosses its base. Horns and crowns
    // sit on top and stay in front.
    const order = EARS.has(P.style) ? 0 : 7;
    if (!PAIRED.has(P.style)) return [{ name: 'crest', order, x: F.turn * F.w * .12 / U, y: -topY / U }];
    return [-1, 1].map(sd => ({
      name: 'horn' + (sd < 0 ? 'L' : 'R'), order,
      x: sd * F.w * P.spread / U, y: -topY / U, side: sd,
    }));
  },
  size: (P, F) => PAIRED.has(P.style)
    ? [(F.w * 1.9 * Math.max(1, P.len)) / U, (F.s * 1.7 * Math.max(1, P.len)) / U]
    // the halo hangs above the head and reaches wider than a crest
    : [(F.w * (P.style === 'halo' ? 3.4 : 2.8)) / U, (F.s * (P.style === 'halo' ? 1.4 : .95)) / U],
  draw(s, P, st, F, bone) {
    const S = F.s, w = F.w;
    const sd = bone.side ?? 1;
    const bx = sd * w * P.spread, by = -S * F.P.skull.skullY * .84;

    const STYLE = { dark: 'black', ringed: 'hatch', bone: 'light' };
    const toneFill = (pts, ridges) => {
      // 'skin' is what an ear wants: the same colour as the head it
      // grows out of. Horns and antlers are the ones made of bone.
      if (P.tone === 'skin' && F.colors.skin) {
        s.paperFill(pts);
        F.media.skin(s, pts, F.colors.skin, { gap: S * .045 });
      } else F.media.tone(s, pts, { style: STYLE[P.tone] ?? 'hatch', gap: S * .05 });
      F.media.edge(s, pts.concat([pts[0]]), F.lwThin * 1.25, { amp: .9 });
      // growth rings across the horn
      if (ridges) for (const [a, b] of ridges) s.sline([a, b], 1.2, P.tone === 'dark' ? 0 : .45,
        P.tone === 'dark' ? s.paperA(.5) : undefined);
    };

    if (P.style === 'horns') {
      const L = S * .55 * P.len;
      const spine = chaikin([
        [bx, by + S * .06],
        [bx + sd * w * .22, by - L * .5],
        [bx + sd * w * (.34 + P.curve * .3), by - L * .95],
        [bx + sd * w * (.30 + P.curve * .8), by - L * 1.25],
      ], false, 2);
      const shape = tapered(spine, S * .17, S * .022);
      // the rings sit across the spine, tighter toward the base
      const ridges = [];
      for (let k = 1; k <= 4; k++) {
        const i = Math.round(spine.length * k * .17);
        if (i >= spine.length - 1) break;
        const a = spine[i], b = spine[i + 1];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
        const hw = S * .17 * (1 - k * .2) * .5;
        ridges.push([[a[0] + nx * hw, a[1] + ny * hw], [a[0] - nx * hw, a[1] - ny * hw]]);
      }
      toneFill(shape, ridges);
      // where it erupts from the skull
      s.sline([[bx - w * .11, by + S * .05], [bx + w * .11, by + S * .03]], 1.3, .35);
      for (let k = 0; k < 3; k++)
        s.sline([[bx + s.jr(-.09, .09) * w, by + S * .06], [bx + s.jr(-.13, .13) * w, by + S * .13]], 1.1, .28);

    } else if (P.style === 'bunny') {
      // long soft ears, drawn up and slightly outward, inner line in
      const L = S * .62 * P.len;
      const flop = P.curve * .35;
      const spine = chaikin([
        [bx, by + S * .05],
        [bx + sd * w * (.08 + flop * .3), by - L * .55],
        [bx + sd * w * (.12 + flop), by - L],
      ], false, 2);
      toneFill(tapered(spine, S * .155, S * .09));
      // the inside of the ear
      const inner = chaikin([
        [bx, by - L * .12],
        [bx + sd * w * (.07 + flop * .3), by - L * .55],
        [bx + sd * w * (.1 + flop * .8), by - L * .88],
      ], false, 2);
      s.paperFill(tapered(inner, S * .07, S * .035));
      s.sline(inner, 1.2, .45);

    } else if (P.style === 'cat') {
      // A BIG triangle standing on the crown. Written symmetrically on
      // purpose: inner edge toward the middle of the head, outer edge
      // away, apex leaning outward. Getting the handedness wrong here
      // puts the left ear on the right side of the head.
      const m = 1 + (sd > 0 ? P.earAsym : -P.earAsym * .6);   // uneven pair
      const hh = S * .36 * P.len * m;
      const half = w * .23 * P.len * m;           // half the base width
      const inner = bx + sd * half;               // toward the face
      const outer = bx - sd * half;               // away from it
      const apex = bx - sd * half * (.45 + P.tilt);          // the tip leans
      // NOT smoothed: chaikin rounds the corners off and a rounded
      // triangle is a blob. A cat ear is three straight edges.
      const tri = [[inner, by + S * .1], [apex, by - hh], [outer, by + S * .04]];
      toneFill(tri);
      // the pink inside, a smaller triangle sharing the apex direction
      const innerTri = [[inner - sd * half * .42, by + S * .05],
                        [apex, by - hh * .58],
                        [outer + sd * half * .3, by + S * .01]];
      s.paperFill(innerTri);
      s.sline(innerTri.concat([innerTri[0]]), F.lwThin * .85, .45);

    } else if (P.style === 'bear') {
      // a round nub half-sunk into the skull
      const r = S * .17 * P.len;
      const nub = s.blobPts(bx, by - r * .3, r, r * .92, s.jr(-.2, .2));
      toneFill(nub);
      s.sline(circlePtsArc(bx, by - r * .3, r * .55), 1.3, .45);

    } else if (P.style === 'floppy') {
      // an ear that gave up: it leaves the skull sideways and falls.
      // A long ear has to get WIDER too — length alone turns a dog's
      // ear into a noodle hanging off its head.
      const L = S * .66 * P.len;
      const fat = .55 + .45 * P.len;
      const spine = chaikin([
        [bx - sd * w * .04, by + S * .1],
        [bx + sd * w * (.30 + P.curve * .12), by + L * .18],
        [bx + sd * w * (.34 + P.curve * .2), by + L * .72],
        [bx + sd * w * .22, by + L],
      ], false, 2);
      toneFill(tapered(spine, S * .2 * fat, S * .13 * fat));
      // the inner fold, following the same fall a little shorter
      const inner = chaikin([
        [bx + sd * w * .04, by + S * .16],
        [bx + sd * w * (.26 + P.curve * .12), by + L * .3],
        [bx + sd * w * .22, by + L * .78],
      ], false, 2);
      s.paperFill(tapered(inner, S * .08 * fat, S * .045 * fat));
      s.sline(inner, 1.2, .4);

    } else if (P.style === 'stalks') {
      // an eye on a stem, looking wherever it likes
      const L = S * .48 * P.len;
      const spine = chaikin([[bx, by + S * .05], [bx + sd * w * .06, by - L * .55],
                             [bx + sd * w * (.1 + P.curve * .12), by - L]], false, 2);
      toneFill(tapered(spine, S * .05, S * .034));
      const tip = spine[spine.length - 1];
      const r = S * .085;
      const ball = s.blobPts(tip[0], tip[1] - r * .6, r, r * s.jr(.95, 1.05), s.jr(-.2, .2), .35);
      s.paperFill(ball);
      s.stroke(ball.concat([ball[0]]), F.lwThin * 1.3, { taper: .1, amp: .5 });
      const px = tip[0] + s.jr(-.35, .35) * r, py = tip[1] - r * .6 + s.jr(-.3, .3) * r;
      s.ctx.fillStyle = s.inkA(.95);
      s.wobbly(px, py, r * .34, r * .36); s.ctx.fill();

    } else if (P.style === 'frills') {
      // a fan of fins along the side of the skull
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = -1.15 + i * .42;
        const bx2 = bx + sd * w * .06 * i, by2 = by + S * (.06 + i * .16);
        const L = S * (.28 - i * .05) * P.len;
        const tipx = bx2 + sd * Math.cos(a) * L, tipy = by2 + Math.sin(a) * L;
        toneFill(chaikin([[bx2 - sd * w * .04, by2 - S * .05], [tipx, tipy],
                          [bx2 + sd * w * .05, by2 + S * .08]], true, 1));
      }

    } else if (P.style === 'halo') {
      // it is not an angel, but it found a halo somewhere
      const r = w * .58, ry2 = S * .1;
      const cy2 = by - S * .3;
      for (let k = 0; k < 2; k++)
        s.sline(circlePts(F.turn * w * .12, cy2 + k * S * .012, r * (1 - k * .06), ry2 * (1 - k * .1), 26), F.lwThin * (1.4 - k * .5), .75 - k * .3);

    } else if (P.style === 'bolt') {
      // a lightning bolt jammed into the skull
      const L = S * .5 * P.len;
      const zig = [[bx, by + S * .04], [bx + sd * w * .16, by - L * .38],
                   [bx + sd * w * .02, by - L * .45], [bx + sd * w * .2, by - L]];
      toneFill(tapered(zig, S * .09, S * .02));

    } else if (P.style === 'flower') {
      // a single bloom on a stem, planted in the head
      const L = S * .34 * P.len;
      const stem = chaikin([[bx, by + S * .04], [bx + sd * w * .04, by - L * .6], [bx + sd * w * .02, by - L]], false, 2);
      toneFill(tapered(stem, S * .035, S * .022));
      const cx2 = bx + sd * w * .02, cy2 = by - L - S * .05;
      const pr = S * .075;
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2 + s.jr(-.15, .15);
        const petal = s.blobPts(cx2 + Math.cos(a) * pr, cy2 + Math.sin(a) * pr, pr * .62, pr * .5, a, .4);
        s.paperFill(petal);
        s.stroke(petal.concat([petal[0]]), F.lwThin * 1.1, { taper: .12, amp: .5 });
      }
      s.ctx.fillStyle = s.inkA(.9);
      s.wobbly(cx2, cy2, pr * .3, pr * .3); s.ctx.fill();

    } else if (P.style === 'sprout') {
      // one hopeful curl growing out of the top
      const L = S * .3 * P.len;
      s.stroke(chaikin([[bx, by + S * .04], [bx + w * .04, by - L * .6], [bx - w * .03, by - L]], false, 2),
        F.lwThin * 1.2, { taper: .3 });
      s.curl(bx - w * .03, by - L - S * .035, S * .045, s.jr(2.2, 2.8), 4.6, s.inkA(.8), F.lwThin * 1.6);

    } else if (P.style === 'antlers') {
      const L = S * .6 * P.len;
      const spine = chaikin([
        [bx, by + S * .05],
        [bx + sd * w * .18, by - L * .45],
        [bx + sd * w * (.26 + P.curve * .2), by - L * 1.0],
      ], false, 2);
      toneFill(tapered(spine, S * .075, S * .018));
      // side branches forking off, thinner each time
      for (let k = 0; k < P.branches; k++) {
        const t = .35 + k * .26;
        const i = Math.min(spine.length - 2, Math.round(spine.length * t));
        const a = spine[i];
        const up = -L * (.24 + k * .07);
        const out = sd * w * (.16 + k * .05);
        const br = chaikin([[a[0], a[1]], [a[0] + out * .55, a[1] + up * .55], [a[0] + out, a[1] + up]], false, 2);
        toneFill(tapered(br, S * .042, S * .012));
      }

    } else if (P.style === 'spikes') {
      // a crest running over the crown
      const n = P.nSpikes;
      for (let i = 0; i < n; i++) {
        const u = (i - (n - 1) / 2) / Math.max(1, (n - 1) / 2);   // -1..1
        const cx = F.turn * w * .12 + u * w * .62;
        const cy = by + Math.abs(u) * S * .12;
        const h = S * (.30 - Math.abs(u) * .12) * P.len;
        const spine = chaikin([[cx, cy + S * .03], [cx + s.jr(-.03, .03) * w, cy - h * .6], [cx + u * w * .06, cy - h]], false, 2);
        toneFill(tapered(spine, S * .075, S * .014));
      }
      s.sline([[F.turn * w * .12 - w * .66, by + S * .1], [F.turn * w * .12 + w * .66, by + S * .1]], 1.2, .25);

    } else { // crown: a band of bone teeth around the skull
      const n = Math.max(5, P.nSpikes);
      const bandY = by + S * .16;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const u = (i / (n - 1) - .5) * 2;
        const cx = F.turn * w * .1 + u * w * .78;
        const dip = bandY + Math.abs(u) * S * .13;
        const h = S * .17 * (1 - Math.abs(u) * .35) * P.len;
        pts.push([cx - w * .075, dip], [cx, dip - h], [cx + w * .075, dip]);
      }
      const band = [...pts,
        [F.turn * w * .1 + w * .85, bandY + S * .28],
        [F.turn * w * .1 - w * .85, bandY + S * .28]];
      toneFill(chaikin(band, true, 1));
      for (let i = 0; i < n; i++) {
        const u = (i / (n - 1) - .5) * 2;
        const cx = F.turn * w * .1 + u * w * .78;
        s.sline([[cx, bandY + Math.abs(u) * S * .13], [cx, bandY + S * .26]], 1.1, .3);
      }
    }
  },
};
