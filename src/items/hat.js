// ---------------------------------------------------------------
// THE HAT — the cosy family. Nothing about it hits anything.
//
// A hat is shade and shelter, so it buys the two stats that are about
// LASTING rather than winning: `drain` (they tire slower out there)
// and `rest` (they get more back when they stop). Both numbers are
// read off the two things an eye can measure from across the room —
// HOW WIDE THE BRIM IS and HOW DEEP THE CROWN IS — so the silhouette
// alone tells you what the hat is worth. Everything else on it is a
// small habit: the brim's edge turned up or down, a band, a patch.
//
// Four silhouettes, not one shape in four costumes: a drooping cone,
// a soft bucket, a peaked cap, a bonnet with a bow. They share the
// brim/crown pair and nothing else.
//
// The anchor is the HEAD CONTACT — the centre of the brim line. The
// crown goes UP from there, and only the brim's tips fall below it:
// the card leaves about .065 of a REF under the anchor, so the droop,
// the bow and the visor are all kept inside that.
// ---------------------------------------------------------------
import { REF, finish } from './core.js';
import { chaikin, resample } from '../sketch.js';

// where a roll sits in its own range — the two numbers the art and
// the stats both read from
const bN = P => (P.brim - .35) / .40;
const hN = P => (P.height - .30) / .45;

export const Hat = {
  id: 'hat',
  slot: 'worn',
  noun: 'hat',
  weight: 6,

  gen(rng, C) {
    return {
      style: C.wpick(rng, [['pointy', 3], ['bucket', 3], ['cap', 3], ['bonnet', 2]]),
      height: rng.r(.30, .75),        // crown depth  → rest
      brim: rng.r(.35, .75),          // brim width   → drain (the headline)
      curl: rng.r(-.08, .12),         // - the tips turn up, + they droop
      patch: rng.chance(.34),
      band: rng.chance(.5),
      // the hand, not the stats: these hold the drawing still between
      // boil frames, which is the whole reason they are rolled here
      lean: rng.chance(.5) ? 1 : -1,  // which way the point / visor / bow faces
      droop: rng.r(.16, .46),         // how far the cone's tip flops over
      bandH: rng.r(.10, .20),
      patchAt: rng.r(0, 1),
      lump: [rng.r(-.06, .06), rng.r(-.06, .06), rng.r(-.05, .05)],
    };
  },

  // COSY: drain down, rest up, and a little energy on top. No combat.
  statsOf(P) {
    const k = P.pow ?? 1, b = bN(P), h = hN(P);
    const add = {}, mul = {};

    // the brim is shade and shelter — the wider it is drawn, the
    // longer they go before they flag
    let drain = 1 - (.13 + .20 * b) * k;
    if (P.curl > 0) drain -= P.curl * .6 * k;      // turned down, it shelters
    if (P.band) drain -= .06 * k;                  // the band pulls it snug
    if (P.style === 'bucket') drain -= .07 * k;    // the softest of the four
    mul.drain = Math.max(.38, drain);

    // the crown is somewhere to keep the sleep
    let rest = 1 + (.10 + .22 * h) * k;
    if (P.style === 'cap') rest += .10 * k;        // the peak keeps the light off
    mul.rest = rest;

    // turned up: they can see where they are going, so they get there
    if (P.curl < 0) mul.speed = 1 + -P.curl * 1.1 * k;

    let stam = 0;
    if (P.patch) stam += 7 * k;                    // someone mended it, and they know
    if (P.style === 'pointy') stam += 6 * k;       // a point says something
    if (P.style === 'bonnet') stam += 9 * k;       // ties: it never comes off
    if (stam) add.maxStam = stam;

    return { add, mul };
  },

  adj(P) {
    const b = bN(P), h = hN(P);
    if (b > .6 && b >= h) return P.style === 'bucket' ? 'floppy' : 'wide';
    if (h > .6) return P.style === 'pointy' ? 'droopy' : 'tall';
    if (b < .28 && h < .28) return 'little';
    return P.patch ? 'mended' : 'snug';
  },

  desc(P) {
    if (P.curl < -.03) return 'the brim turned up, so they can see where they are going';
    if (bN(P) >= hN(P)) return 'the wider the brim the longer they go before they flag';
    return 'the deeper the crown the better they sleep it off';
  },

  draw(s, P, F) {
    const G = {
      hh: REF * P.height,             // crown height
      // the brim's drawn half-width IS P.brim; the .70 is only the
      // factor that keeps the widest roll inside the card
      bw: REF * P.brim * .70,
      lw: REF * .032,
      dir: P.lean,
      dip: REF * P.curl * .48,        // how far the tips fall past the anchor
    };
    if (P.style === 'pointy') drawPointy(s, P, F, G);
    else if (P.style === 'bucket') drawBucket(s, P, F, G);
    else if (P.style === 'cap') drawCap(s, P, F, G);
    else drawBonnet(s, P, F, G);
  },
};

// ---- shared shapes ---------------------------------------------

// a tapered ribbon down a spine — the cone, and anything else that
// has to bend and thin at the same time
function ribbon(spine, halfs) {
  const L = [], Rt = [];
  for (let i = 0; i < spine.length; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(spine.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const d = Math.hypot(nx, ny) || 1;
    nx /= d; ny /= d;
    L.push([spine[i][0] + nx * halfs[i], spine[i][1] + ny * halfs[i]]);
    Rt.push([spine[i][0] - nx * halfs[i], spine[i][1] - ny * halfs[i]]);
  }
  return chaikin(L.concat(Rt.reverse()), true, 1);
}

// The brim as a lens, thinning toward the tips. Its centre line sits
// a little ABOVE the anchor and falls away by `dip`, so even a droopy
// brim keeps its bulk over the head. `scallop` > 0 gives the bonnet's
// frilled edge instead of a clean one.
function brimRing(bw, th, dip, scallop = 0) {
  const n = scallop ? scallop * 6 : 10;
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = Math.abs(2 * t - 1);
    const x = -bw + 2 * bw * t, y = -th * .35 + dip * u * u;
    const ht = th * .5 * (1 - .42 * u * u);
    top.push([x, y - ht]);
    bot.push([x, y + ht * (scallop
      ? .5 + .7 * Math.abs(Math.sin(t * Math.PI * scallop)) : 1)]);
  }
  return chaikin(top.concat(bot.reverse()), true, 1);
}

// How tall the band is. It has a floor: a strip thinner than this
// disappears under the brim, and a band you cannot see is a stat you
// cannot read.
function bandHeight(hh, P) {
  return Math.min(hh * .45, Math.max(REF * .075, hh * P.bandH));
}

// The contrasting strip round the base of the crown. Its BOTTOM edge
// tucks just inside the brim (`y0`), so the brim — drawn after —
// closes over it the way it does on a real hat. It goes through
// finish() like any other body shape, then takes a hatch on top so it
// still reads as a DIFFERENT material in the card, where there is no
// medium to ask.
function drawBand(s, P, F, G, o) {
  if (!P.band) return;
  const { cw, cwTop, y0, bh } = o, dx = o.dx ?? 0;
  const b = chaikin([
    [-cw, y0], [cw, y0], [dx + cwTop, y0 - bh], [dx - cwTop, y0 - bh],
  ], true, 1);
  finish(s, b, P.rank, { F, lw: G.lw * .8, style: 'hatch' });
  s.hatchFill(b, REF * .05, -.65, .3, 1.15);
  s.sline([[dx - cwTop, y0 - bh], [dx + cwTop, y0 - bh]], G.lw * .5, .5);
}

// A square of other cloth, sewn on with two zigzags in opposite phase
// — which is what a cross-stitch is, and it keeps every stitch a long
// enough stroke to still have a hand in it.
function drawPatch(s, P, F, G, cx, cy, r0) {
  if (!P.patch) return;
  // a corner plus its stitching reaches about 1.6r, and nothing may
  // hang below the brim line — on a shallow crown the patch is small
  const r = Math.min(r0, -cy / 1.6);
  if (r < REF * .032) return;
  const rot = P.lump[2] * 4;                     // a few degrees off square, always the same few
  const c = Math.cos(rot), sn = Math.sin(rot);
  const sq = [[-r, -r], [r, -r], [r, r], [-r, r]]
    .map(([x, y]) => [cx + x * c - y * sn, cy + x * sn + y * c]);
  finish(s, sq, P.rank, { F, lw: G.lw * .7, style: 'hatch' });

  const ring = resample(sq.concat([sq[0]]), r * .40);
  for (const ph of [0, 1]) {
    s.sline(ring.map((p, i) => {
      const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1;
      const o = ((i + ph) % 2 ? .17 : -.09) * r;    // straddling the edge, not spiking off it
      return [p[0] + dx / d * o, p[1] + dy / d * o];
    }), G.lw * .42, .7);
  }
}

// ---- the four silhouettes ---------------------------------------
// Order is always crown → band → brim → patch → the style's own tell,
// so the brim closes over the crown's base the way it does on a head.

// A tall cone that gave up near the top. The tip travels sideways
// rather than up over the last third — that is the droop.
function drawPointy(s, P, F, G) {
  const { hh, bw, lw, dir, dip } = G;
  const cw = Math.min(bw * .72, REF * .30);
  const th = REF * .085;
  const tipX = dir * REF * P.droop;
  const N = 12, spine = [], halfs = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // both bends fade out at t=0 so the cone leaves the brim upright,
    // whatever the lean — a tilted base would hang under the brim line
    spine.push([tipX * t * t + REF * P.lump[0] * 1.8 * t * Math.sin(t * Math.PI),
                -hh * Math.sin(t * 1.44)]);
    halfs.push(cw * (1 - .93 * t) + lw * .15);
  }
  finish(s, ribbon(spine, halfs), P.rank, { F, lw });
  // the fold running up the inside of the cone
  s.sline(spine.map(([x, y], i) => [x - dir * halfs[i] * .4, y]), lw * .5, .3);

  const y0 = -th * .55, bh = bandHeight(hh, P);
  const tb = Math.asin(Math.min(1, (bh - y0) / hh)) / 1.44;     // where the band's top meets the cone
  drawBand(s, P, F, G, { cw, cwTop: cw * (1 - .93 * tb), dx: tipX * tb * tb, y0, bh });

  finish(s, brimRing(bw, th, dip), P.rank, { F, lw });

  const pt = .22 + .34 * P.patchAt, ph = cw * (1 - .93 * pt);
  drawPatch(s, P, F, G, tipX * pt * pt - dir * ph * .2,
    -hh * Math.sin(pt * 1.44), Math.min(REF * .075, ph * .5));
}

// A soft bucket: a barely tapered crown with a flat-ish top, and a
// brim that is not a plate but a SKIRT — it leaves the crown high and
// widens as it falls. That slope is the whole silhouette.
function drawBucket(s, P, F, G) {
  const { bw, lw, dir, dip } = G;
  const hh = G.hh * .95;
  const cw = Math.min(bw * .78, REF * .33);
  const L = P.lump;
  const crown = chaikin([
    [-cw, 0],
    [-cw * (1.0 + L[0]), -hh * .45],
    [-cw * .87, -hh * .86],
    [-cw * .52, -hh * (1.0 + L[1])],
    [cw * .50, -hh * (.99 + L[2])],
    [cw * .88, -hh * .85],
    [cw * (1.01 + L[0] * .6), -hh * .42],
    [cw, 0],
  ], true, 2);
  finish(s, crown, P.rank, { F, lw });
  // two soft creases where a bucket hat always collapses
  for (const sd of [-1, 1])
    s.sline([[sd * cw * .55, -hh * .12], [sd * cw * .40, -hh * .78]], lw * .45, .28);

  const top = -REF * .095;
  drawBand(s, P, F, G, { cw, cwTop: cw * 1.02, y0: top + REF * .012, bh: bandHeight(hh, P) });

  const inner = [], outer = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, u = Math.abs(2 * t - 1);
    inner.push([-cw + 2 * cw * t, top]);
    outer.push([-bw + 2 * bw * t, dip * .45 * u * u + REF * .030]);
  }
  finish(s, chaikin(inner.concat(outer.reverse()), true, 1), P.rank, { F, lw });
  // the topstitch that runs round the edge of every bucket hat
  s.sline(outer.map(([x, y]) => [x * .93, y - REF * .034]), lw * .45, .4);

  drawPatch(s, P, F, G, -dir * cw * .38, -hh * (.34 + .40 * P.patchAt),
    Math.min(REF * .085, cw * .40));
}

// A peaked cap. The crown leans toward the front and the visor's
// reach is the brim: all of P.brim goes out one side. A cap sits low,
// so the crown is drawn at .88 of the rolled depth — still the same
// number, still the same order, just a cap's proportion.
function drawCap(s, P, F, G) {
  const { bw, lw, dir, dip } = G;
  const hh = G.hh * .88;
  const cw = Math.min(bw * .72, REF * .31);
  const L = P.lump;
  const dome = chaikin([
    [-cw, 0],
    [-cw * (1.02 + L[0]), -hh * .46],
    [-cw * .70, -hh * (.90 + L[1])],
    [cw * .05, -hh * (1.0 + L[2])],
    [cw * .78, -hh * .82],
    [cw * 1.0, -hh * .38],
    [cw, 0],
  ].map(([x, y]) => [x * dir, y]), true, 2);
  finish(s, dome, P.rank, { F, lw });
  // the panel seams, and the button they meet under
  for (const sd of [-1, 1])
    s.sline([[dir * sd * cw * .62, -hh * .10],
             [dir * (cw * .05 + sd * cw * .12), -hh * .88]], lw * .45, .3);
  s.ctx.fillStyle = s.inkA(.85);
  s.wobbly(dir * cw * .05, -hh * (1.0 + L[2]) - REF * .008, REF * .022, REF * .020);
  s.ctx.fill();

  drawBand(s, P, F, G, { cw, cwTop: cw * .99, y0: -REF * .042, bh: bandHeight(hh, P) });

  const vis = chaikin([
    [-cw * .30, -REF * .050],
    [bw * .55, -REF * .062],
    [bw, -REF * .010],
    [bw * .92, REF * .028],
    [bw * .45, REF * .022],
    [-cw * .30, REF * .040],
  ].map(([x, y]) => [x * dir, y + dip * .35]), true, 2);
  finish(s, vis, P.rank, { F, lw });
  s.sline([[dir * -cw * .2, dip * .35 - REF * .012],
           [dir * bw * .55, dip * .35 - REF * .020],
           [dir * bw * .86, dip * .35 + REF * .006]], lw * .45, .4);

  drawPatch(s, P, F, G, -dir * cw * .40, -hh * (.28 + .40 * P.patchAt),
    Math.min(REF * .08, cw * .38));
}

// A bonnet: a low crown that hugs, a frilled edge framing the face,
// and the ties knotted off to one side. The frill's scallops count up
// with the brim, so the widest bonnet is also the frilliest.
function drawBonnet(s, P, F, G) {
  const { bw, lw, dir, dip } = G;
  const hh = G.hh * .90;                           // a bonnet hugs
  const cw = Math.min(bw * .78, REF * .33);
  const L = P.lump;
  const crown = chaikin([
    [-cw, 0],
    [-cw * (1.06 + L[0]), -hh * .52],
    [-cw * .62, -hh * (.98 + L[1])],
    [0, -hh],
    [cw * .64, -hh * (.97 + L[2])],
    [cw * (1.05 + L[1] * .5), -hh * .48],
    [cw, 0],
  ], true, 2);
  finish(s, crown, P.rank, { F, lw });
  // the gathers: cloth pulled up to the back of the crown
  for (let i = -1; i <= 1; i++)
    s.sline([[i * cw * .72, -hh * .06], [i * cw * .18, -hh * .86]], lw * .45, .3);

  const th = REF * .085;
  drawBand(s, P, F, G, { cw, cwTop: cw * 1.03, y0: -th * .55, bh: bandHeight(hh, P) });

  const n = 4 + Math.round(P.brim * 6);            // the wider the brim, the frillier
  finish(s, brimRing(bw, th, dip * .6, n), P.rank, { F, lw });

  drawPatch(s, P, F, G, -dir * cw * .40, -hh * (.30 + .38 * P.patchAt),
    Math.min(REF * .08, cw * .38));

  // the ties, knotted off to one side — one outline, loops and tails.
  // Big enough that the loops clear the frill's top edge, or it just
  // reads as one more scallop.
  const r = REF * .065, cx = dir * bw * .78, cy = -REF * .055;
  finish(s, bowPts(cx, cy, r), P.rank, { F, lw: lw * .8 });
  s.sline([[cx - r * .22, cy - r * .3], [cx + r * .22, cy + r * .35]], lw * .45, .5);
}

function bowPts(cx, cy, r) {
  return chaikin([
    [cx, cy - r * .28],
    [cx - r * .55, cy - r * .95], [cx - r * 1.25, cy - r * .55],
    [cx - r * 1.20, cy + r * .35], [cx - r * .30, cy + r * .30],
    [cx - r * .78, cy + r * 1.25], [cx - r * .30, cy + r * 1.35],
    [cx - r * .02, cy + r * .45],
    [cx + r * .34, cy + r * 1.30], [cx + r * .80, cy + r * 1.10],
    [cx + r * .28, cy + r * .28],
    [cx + r * 1.20, cy + r * .38], [cx + r * 1.25, cy - r * .50],
    [cx + r * .55, cy - r * .95],
  ], true, 2);
}
