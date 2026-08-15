// ---------------------------------------------------------------
// CHARMS — the small thing on a string round a child's neck.
//
// Eight of them, and they are eight DIFFERENT IDEAS, not eight
// re-skins of a damage number. That is the point of the family: it is
// the commonest thing you are offered, so it has to be the place the
// odd effects live, or every draft turns into "another +dmg".
//
// Two consequences for the art:
//
//   1. A charm is never drawn on the child. It is read on a card and
//      in a HUD chip at about 22px. So each one is a BOLD SILHOUETTE
//      and almost nothing else — a fang, a bell, a spiral, a key. If
//      you would not know it at a thumbnail, it does not go in.
//   2. They all hang from the same short cord loop. That loop is the
//      family's signature: eight unrelated doodles read as one set
//      because they are all tied on the same piece of string.
//
// Everything the drawing shows is a number. Roots on the tooth are
// bite. Whorls on the shell are stamina. The hole in the pebble is
// how fast it can be lobbed. Nothing here is decoration, and nothing
// here is rolled at draw time — see `lumpRing`.
// ---------------------------------------------------------------
import { REF, finish } from './core.js';
import { chaikin, arcPts } from '../sketch.js';

// the cord, in REF units. The loop sits at the crown and every kind
// begins just inside it, so the doodle always covers the knot.
const CORD_R = REF * .075;
const LW = REF * .032;              // the contour weight of a body
const LWD = REF * .021;             // a detail line — a wrap, a whorl

// A lumpy ring with NO DICE IN IT. `s.blobPts` would be the obvious
// call, but it draws its phase from the boil rng: on a card that is
// fine, on anything redrawn twice a second the stone would change
// shape in your hand. The phase comes from P instead, so a pebble is
// the same pebble every frame.
function lumpRing(cx, cy, rx, ry, ph, wob, n = 26) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2;
    const m = 1 + wob * (.17 * Math.sin(t * 2 + ph) + .1 * Math.sin(t * 5 + ph * 2.3));
    pts.push([cx + Math.cos(t) * rx * m, cy + Math.sin(t) * ry * m]);
  }
  return chaikin(pts, true, 1);
}

// the void mark — the same one the eyes are drawn with. A hole, a
// clapper, an eye on a stalk: in this world dark IS the shape.
function inkBlob(s, x, y, rx, ry, a = .9) {
  s.ctx.fillStyle = s.inkA(a);
  s.wobbly(x, y, rx, ry);
  s.ctx.fill();
}

// ---- the eight doodles -----------------------------------------
// Each is handed the box it may use: T is its top edge, H its height,
// W its half-width. None of them knows how big the host is.

// TOOTH — a crown and its roots. One root is a fang, three is a molar,
// and the count is the bite.
function drawTooth(s, P, F, T, H, W) {
  const n = P.roots, gum = T + H * .46;
  const pts = [[-W, gum], [-W * .97, T + H * .17], [-W * .6, T + H * .01], [0, T],
               [W * .6, T + H * .01], [W * .97, T + H * .17], [W, gum]];
  const tw = W * (n === 1 ? .58 : n === 2 ? .33 : .23);
  for (let i = n - 1; i >= 0; i--) {            // right to left along the gum
    const u = n === 1 ? 0 : (i / (n - 1) - .5) * 2;
    const cx = u * W * .6, tip = T + H - Math.abs(u) * H * .07;
    pts.push([cx + tw, gum], [cx * 1.3 + tw * .18, tip],
             [cx * 1.3 - tw * .18, tip], [cx - tw, gum]);
  }
  finish(s, chaikin(pts, true, 1), P.rank, { F, lw: LW });
}

// BELL — the mouth is how far it carries, the peal ticks are how much
// the dark hates hearing it.
function drawBell(s, P, F, T, H, W) {
  const mw = W * (.5 + P.flare * .38), hb = H * .82;
  const prof = [[.28, 0], [.36, .1], [.45, .3], [.62, .52], [.84, .72], [.99, .83], [1, .92]];
  const pts = [];
  for (const [x, y] of prof) pts.push([-x * mw, T + y * hb]);
  for (let i = prof.length - 1; i >= 0; i--) pts.push([prof[i][0] * mw, T + prof[i][1] * hb]);
  finish(s, chaikin(pts, true, 1), P.rank, { F, lw: LW });
  inkBlob(s, 0, T + hb + H * .08, W * .15, W * .15);        // the clapper
  const cy = T + hb * .56;                                  // beside the mouth,
  for (const sd of [-1, 1]) {                               // not over the crown
    for (let k = 0; k < P.peals; k++) {
      const r = mw * (1.12 + k * .22);
      const arc = arcPts(0, cy, r, r, -.85, -.12, 8).map(p => [p[0] * sd, p[1]]);
      s.sline(arc, LWD * 1.1, .8);
    }
  }
}

// SNAIL — the shell is the whole point: every extra whorl is another
// day it can keep going, and another step it will not take.
function drawSnail(s, P, F, T, H, W) {
  const fy = T + H;
  const foot = chaikin([[-W * 1.02, fy - H * .3], [-W * .45, fy - H * .34],
                        [W * .45, fy - H * .3], [W, fy - H * .2],
                        [W * .92, fy], [-W * .7, fy], [-W, fy - H * .1]], true, 2);
  finish(s, foot, P.rank, { F, lw: LW });
  const sr = W * .74, cx = W * .12, cy = fy - H * .3 - sr * .78;
  finish(s, lumpRing(cx, cy, sr, sr * .95, P.ph, .18), P.rank, { F, lw: LW });
  const spiral = [], steps = P.whorls * 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = .8 + t * P.whorls * Math.PI * 2, r = sr * (.86 - t * .78);
    spiral.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  s.sline(spiral, LWD, .7);
  const hx = -W * .9, hy = fy - H * .32;                    // the stalks
  for (const [dx, dy] of [[-.26, -.4], [.03, -.47]]) {
    const tx = hx + W * dx, ty = hy + H * dy;
    s.sline([[hx, hy], [hx + (tx - hx) * .45 - W * .1, hy + (ty - hy) * .6], [tx, ty]], LWD, .7);
    inkBlob(s, tx, ty, W * .085, W * .085);
  }
}

// KEY — it opens nothing. It is a promise that things stay whole, and
// the teeth on the bit are how strong the promise is.
function drawKey(s, P, F, T, H, W) {
  const br = W * .6, bcy = T + br, sw = W * .155, bot = T + H;
  const n = P.teeth, bit = H * .42, th = bit / (n * 2 - 1);
  const pts = [[-sw, bcy], [-sw, bot], [sw, bot]];
  for (let i = 0; i < n; i++) {                             // bottom tooth first
    const y0 = bot - H * .03 - i * th * 2, tl = W * .62 * (1 - i * .13);
    pts.push([sw, y0], [sw + tl, y0], [sw + tl, y0 - th], [sw, y0 - th]);
  }
  pts.push([sw, bcy]);
  finish(s, pts, P.rank, { F, lw: LW * .95 });
  finish(s, lumpRing(0, bcy, br, br * .92, P.ph, .1), P.rank, { F, lw: LW });
  inkBlob(s, 0, bcy, br * .42, br * .4);                    // the bow's hole
}

// FEATHER — the sweep IS the speed. A straight one is a quill; the
// bent one came off something that was already moving.
function drawFeather(s, P, F, T, H, W) {
  const N = 16, spineX = t => Math.sin(t * Math.PI * .78) * W * P.curve * 2.1;
  const L = [], R = [];
  for (let i = 0; i < N; i++) {
    const t = i / N, x = spineX(t), y = T + t * H;
    const u = Math.max(0, Math.min(1, (t - .17) / .83));
    const w = W * (.04 + .5 * Math.pow(Math.sin(u * Math.PI), .7)) * (1 - t * .12);
    // the splits, staggered, because a symmetrical feather is a leaf
    L.push([x - w * (i === 7 || i === 11 ? .5 : 1), y]);
    R.push([x + w * (i === 9 ? .5 : 1), y]);
  }
  const pts = L.concat([[spineX(1), T + H]], R.reverse());   // and a real point
  finish(s, chaikin(pts, true, 1), P.rank, { F, lw: REF * .028 });
  const sp = [];                                            // the rachis, so the bend reads
  for (let i = 0; i <= N; i++) sp.push([spineX(i / N), T + (i / N) * H]);
  s.sline(sp, LWD, .55);
}

// CANDLE — a light you hold in one hand. The flame eats the candle:
// a big flame is a short stub, and the rays are how far it reaches.
function drawCandle(s, P, F, T, H, W) {
  const fh = H * (.14 + P.flame * .22), top = T + fh + H * .05, cw = W * .42;
  finish(s, chaikin([[-cw, top], [cw, top], [cw * 1.1, T + H], [-cw * 1.1, T + H]], true, 1),
    P.rank, { F, lw: LW });
  const fl = chaikin([[0, top + H * .01], [W * .24, top - fh * .38],
                      [0, top - fh], [-W * .24, top - fh * .38]], true, 2);
  s.ctx.fillStyle = s.inkA(.5);
  s.poly(fl, true); s.ctx.fill();
  const fcy = top - fh * .55;
  for (let i = 0; i < 5; i++) {                             // a child draws light as spokes
    const a = -Math.PI / 2 + (i - 2) * .72;
    const r0 = fh * .62, r1 = r0 + fh * (.3 + P.flame * .34);
    s.sline([[Math.cos(a) * r0, fcy + Math.sin(a) * r0],
             [Math.cos(a) * r1, fcy + Math.sin(a) * r1]], REF * .018, .5);
  }
}

// PEBBLE — a hag stone. The hole is why it is on the cord at all, and
// a wide hole whips off the string quicker.
function drawPebble(s, P, F, T, H, W) {
  const rx = W * .82, ry = W * (.44 + P.heft * .3), cy = T + H * .52;
  finish(s, lumpRing(0, cy, rx, ry, P.ph, .46), P.rank, { F, lw: REF * .034 });
  const hr = Math.min(rx, ry) * P.hole;
  inkBlob(s, rx * .06, cy - ry * .5, hr, hr * .92);
}

// THREAD — a bobbin. The wraps are how long the tangle holds, and the
// loose end trailing off it is the same thread, so it grows with them.
function drawThread(s, P, F, T, H, W) {
  const w = W * .86, waist = W * .44, bot = T + H * .84;
  finish(s, [[-w, T], [w, T], [w * .62, T + H * .14], [waist, T + H * .2],
             [waist, T + H * .6], [w * .62, T + H * .68], [w, T + H * .76], [w, bot],
             [-w, bot], [-w, T + H * .76], [-w * .62, T + H * .68], [-waist, T + H * .6],
             [-waist, T + H * .2], [-w * .62, T + H * .14]], P.rank, { F, lw: LW });
  for (let i = 0; i < P.wraps; i++) {
    const y = T + H * .25 + (i / Math.max(1, P.wraps - 1)) * H * .3;
    s.sline([[-waist * 1.04, y], [0, y + H * .022], [waist * 1.04, y]], LWD, .65);
  }
  const tl = .55 + P.wraps * .13, sx = w * .78, sy = bot - H * .1, tail = [];
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * tl;
    tail.push([sx + Math.sin(t * 2.4) * W * .34, sy + t * H * .3]);
  }
  s.sline(chaikin(tail, false, 1), LWD, .7);
}

const KIND = {
  tooth: drawTooth, bell: drawBell, snail: drawSnail, key: drawKey,
  feather: drawFeather, candle: drawCandle, pebble: drawPebble, thread: drawThread,
};

export const Charm = {
  id: 'charm', slot: 'charm', noun: 'charm', weight: 11,

  gen(rng, C) {
    const kind = C.wpick(rng, [
      ['tooth', 14], ['feather', 13], ['bell', 12], ['candle', 12],
      ['pebble', 12], ['key', 10], ['snail', 9], ['thread', 9],
    ]);
    // `size` is every kind's overall scale AND every radius it hands
    // out — a big charm is drawn big and is felt further away.
    // `ph` is the lumpiness phase, rolled once so it cannot shimmer.
    const P = { kind, size: rng.r(.4, .75), ph: rng.r(0, 7) };
    if (kind === 'tooth') P.roots = rng.ri(1, 3);
    if (kind === 'bell') { P.flare = rng.r(.5, 1); P.peals = rng.ri(1, 3); }
    if (kind === 'snail') P.whorls = rng.ri(2, 4);
    if (kind === 'key') P.teeth = rng.ri(1, 3);
    if (kind === 'feather') P.curve = rng.r(.12, .42);
    if (kind === 'candle') P.flame = rng.r(.45, 1);
    if (kind === 'pebble') { P.heft = rng.r(.5, 1); P.hole = rng.r(.2, .4); }
    if (kind === 'thread') P.wraps = rng.ri(2, 5);
    return P;
  },

  // PURE. Three of the eight are deliberately empty here — the key,
  // the pebble and the thread do their whole job in fxOf, and padding
  // them with a token +dmg would make eight ideas into one.
  statsOf(P) {
    const k = P.pow;
    switch (P.kind) {
      case 'tooth':   return { add: { dmg: (.34 + P.roots * .22) * k } };
      // the wider the mouth the louder it is, and the harder the ring
      // shoves whatever it lands on
      case 'bell':    return { add: { knock: (.5 + P.flare * 1.5) * k } };
      case 'snail':   return {
        add: { maxStam: (12 + P.whorls * 10) * k },
        // the cost does NOT scale with rank — a gilded snail is a
        // better snail, not a slower one
        mul: { speed: 1 - (.08 + P.whorls * .03),
               drain: Math.max(.45, 1 - (.05 + P.whorls * .045) * k) },
      };
      case 'feather': return { mul: { speed: 1 + (.1 + P.curve * .4) * k } };
      case 'candle':  return { add: { lampR: (.6 + P.flame * .9) * k } };
      default:        return {};
    }
  },

  fxOf(P) {
    const k = P.pow, R = 1 + P.size * 1.4;      // the reach of a worn thing
    switch (P.kind) {
      // Every value here is a RADIUS in world units, except `sticky`
      // (seconds) and `throw` (the four numbers a lob needs). The
      // room is 13 units across, so 2-6 is a believable earshot.
      case 'tooth':  return { fear: (1.6 + R) * k };
      case 'bell':   return { fear: (1.2 + P.peals * .5 + P.size * 1.8) * k };
      case 'key':    return { thrift: (2.4 + P.teeth * .5 + P.size * 2) * k };
      // a snail slows everything down, itself included
      case 'snail':  return { chill: (1.8 + P.whorls * .5) * k };
      // a stub of candle is a nightlight: it helps the others sleep
      case 'candle': return { lull: (2.2 + P.flame * 2.4) * k };
      case 'pebble': return { throw: { dmg: (.45 + P.heft * .75) * k,
                                       every: Math.max(1.1, 2.8 - P.hole * 1.4),
                                       speed: 6.2,
                                       r: (3.4 + P.size * 2.4) * k } };
      case 'thread': return { sticky: (.8 + P.wraps * .45) * k };
      default:       return {};
    }
  },

  // the kind is the adjective: it is the only thing about a charm
  // anyone says out loud
  adj: P => P.kind,

  desc(P) {
    return {
      tooth:   'more roots, more bite — and the dark flinches when it lands',
      bell:    'the wider the mouth the further into the dark it carries',
      snail:   'slow, but it carries its own bed on its back',
      key:     'it opens nothing. beds and toys near it just last longer',
      feather: 'swept the way a fast thing is swept',
      candle:  'a light small enough to hold in one hand',
      pebble:  'the hole is for the cord, the rest is for throwing',
      thread:  'what it touches stays wound up, out where the light is',
    }[P.kind];
  },

  draw(s, P, F) {
    const scl = P.kind === 'feather' ? .92 : 1;     // a feather is a small thing
    const H = REF * (.26 + P.size * .3) * scl;
    const W = REF * (.15 + P.size * .17) * scl;
    const top = -(H + CORD_R * 1.75) / 2;
    const cordC = top + CORD_R;
    // a couple of kinds hang lopsided (a feather sweeps one way, a
    // snail's stalks stick out the front). The CORD MOVES WITH THEM —
    // the anchor is the centre of the whole pendant, not of the doodle
    const dx = P.kind === 'feather' ? -W * P.curve * 1.05
             : P.kind === 'snail' ? W * .08 : 0;
    s.ctx.save();
    s.ctx.translate(dx, 0);
    // the cord first: whatever hangs on it covers the knot
    s.sline(arcPts(0, cordC, CORD_R, CORD_R, Math.PI * .58, Math.PI * 2.42, 22), REF * .026, .75);
    KIND[P.kind](s, P, F, cordC + CORD_R * .85, H, W);
    s.ctx.restore();
  },
};
