// ---------------------------------------------------------------
// THE SHIELD — the energy family.
//
// Nothing on it cuts anything. A shield is the thing a child gets
// BEHIND, so every number it hands out is about staying out there:
// the energy to keep standing, a slower burn while they do, and the
// shove you get by leaning on it. The price is a little speed, and
// that price is paid in the WIDTH you actually drew.
//
// Two readings come straight off the paper and the stats read the
// same two: how much of a child it HIDES (the long axis, and how
// solidly the silhouette fills its own box) and how WIDE it is to
// carry around. That is why the three shapes are not skins —
//   round  widest, honest cover, costs the most speed
//   kite   tall and narrow, cheapest to carry, less of it to hide behind
//   door   tall and solid, the most cover, and a fair price for it
// — and why SHAPES below is read by draw() and statsOf() alike. A
// shape cannot lie about what it covers; there is only one table.
//
// The ANCHOR is the GRIP: dead centre of the back. The fist lands in
// the middle of the boss, so the body is drawn all around 0,0.
// ---------------------------------------------------------------
import { REF, finish, barPts, starPts } from './core.js';
import { chaikin } from '../sketch.js';

// ax, ay: the half-extents, as fractions of L (the long half-axis).
// fill: how much of its own bounding box the silhouette really covers.
// Everything downstream — cover, bulk, width — comes from these three.
const SHAPES = {
  round: { ax: .95, ay: .95, fill: .82 },
  kite:  { ax: .68, ay: 1.0, fill: .60 },
  door:  { ax: .72, ay: 1.0, fill: .90 },
};

// the round's numbers are the yardstick, so `round` reads as 1.0
const cover = S => (S.ay * .6 + S.fill * .4) / (SHAPES.round.ay * .6 + SHAPES.round.fill * .4);
const bulk  = S => (S.ax * S.ay * S.fill) / (SHAPES.round.ax * SHAPES.round.ay * SHAPES.round.fill);
const width = S => S.ax / SHAPES.round.ax;

// a painted shield is one somebody sat down and finished, and it is
// worth carrying a bit longer for it
const PAINT_STAM = { none: 0, cross: 3, quarters: 3.6, star: 5 };

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// ---- geometry ---------------------------------------------------
// A lumpy ellipse whose lumps come from a PHASE ROLLED IN gen(), not
// from the boil. The outline of a shield in a fist must hold still;
// the hand it was drawn with comes from finish()'s stroke.
function ovalPts(cx, cy, rx, ry, n, ph, amt) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const m = 1 + amt * (.62 * Math.sin(t * 2 + ph) + .38 * Math.sin(t * 3 + ph * 2.1));
    pts.push([cx + Math.cos(t) * rx * m, cy + Math.sin(t) * ry * m]);
  }
  return pts;
}

// the same trick for the cornered shapes: push each keypoint in and
// out by a fixed amount of its own index, so it is crooked but stable
function crook(pts, amt, ph) {
  return pts.map(([x, y], i) => {
    const w = Math.sin(i * 1.7 + ph) * amt;
    return [x * (1 + w), y * (1 + w * .6)];
  });
}

function bodyPts(P, hx, hy) {
  if (P.shape === 'round') return ovalPts(0, 0, hx, hy, 26, P.wob, .045);

  if (P.shape === 'kite') {
    // widest at the shoulders, then all the way down to a point
    const k = [
      [-hx * .94, -hy * .42], [-hx * .72, -hy * .86], [-hx * .3, -hy], [0, -hy * 1.02],
      [hx * .3, -hy], [hx * .72, -hy * .86], [hx * .94, -hy * .42],
      [hx * .62, hy * .3], [hx * .24, hy * .8],
      [0, hy], [0, hy],                          // doubled: chaikin must not eat the point
      [-hx * .24, hy * .8], [-hx * .62, hy * .3],
    ];
    return chaikin(crook(k, .03, P.wob), true, 1);
  }

  // door: a round-topped plank, flat on the floor end
  const d = [
    [-hx, -hy * .5], [-hx * .86, -hy * .85], [-hx * .42, -hy], [0, -hy * 1.02],
    [hx * .42, -hy], [hx * .86, -hy * .85], [hx, -hy * .5],
    [hx * .98, hy * .86], [hx * .84, hy],
    [-hx * .84, hy], [-hx * .98, hy * .86],
  ];
  return chaikin(crook(d, .028, P.wob), true, 1);
}

// ---- the paint --------------------------------------------------
// Drawn ON the face, clipped to it, so the motif runs off the edge
// the way a child's does rather than politely stopping short.
function paintFace(s, P, body, hx, hy, R) {
  if (P.paint === 'none') return;
  s.ctx.save();
  s.poly(body, true);
  s.ctx.clip();

  if (P.paint === 'cross') {
    const t = R * .15;                             // the width of the crayon
    const arms = [
      barPts(0, -hy * 1.04, 0, hy * 1.04, t, t, 1),
      barPts(-hx * 1.04, -hy * .12, hx * 1.04, -hy * .12, t, t, 1),
    ];
    for (const b of arms) {
      s.hatchFill(b, REF * .05, -.7, .34, 1.2);
      s.sline(b.concat([b[0]]), REF * .02, .45);
    }
  } else if (P.paint === 'quarters') {
    const qx = hx * 1.06, qy = hy * 1.06;
    s.hatchFill([[0, 0], [qx, 0], [qx, -qy], [0, -qy]], REF * .055, -.75, .3, 1.2);
    s.hatchFill([[0, 0], [-qx, 0], [-qx, qy], [0, qy]], REF * .055, .75, .3, 1.2);
    s.sline([[0, -qy], [0, qy]], REF * .024, .5);
    s.sline([[-qx, 0], [qx, 0]], REF * .024, .5);
  } else {
    const st = starPts(0, 0, R * .24, R * .58, 5, -Math.PI / 2);
    s.hatchFill(st, REF * .05, .6, .28, 1.2);
    s.sline(st.concat([st[0]]), REF * .024, .5);
  }

  s.ctx.restore();
}

export const Shield = {
  id: 'shield',
  slot: 'offhand',
  noun: 'shield',
  weight: 7,
  // The anchor is the CENTRE, not a base: the fist closes in the
  // middle of the shield, so the body is drawn all round the origin.
  // Nothing has to be declared for that — `thumbFor` measures the ink
  // and frames whatever it finds. (`flat` is for floor objects that
  // LIE on the lino, and setting it here would be a lie.)

  gen(rng, C) {
    // rank shows up as SIZE before it shows up as a number: a gilded
    // shield is a bigger shield. Clamped so it always fits the box.
    const size = Math.min(.85, Math.max(.45, rng.r(.45, .72) * (1 + (C.pow - 1) * .45)));
    return {
      size,
      shape: C.wpick(rng, [['round', 5], ['kite', 4], ['door', 3]]),
      paint: C.wpick(rng, [['none', 4], ['cross', 4], ['quarters', 3], ['star', 2]]),
      boss: rng.chance(.55),
      rim: rng.chance(.5),
      wob: rng.r(0, Math.PI * 2),   // the outline's own crookedness, rolled once
    };
  },

  statsOf(P) {
    const S = SHAPES[P.shape] ?? SHAPES.round;
    const u = clamp01((P.size - .45) / .4);
    const pw = .6 + .4 * (P.pow ?? 1);
    const cov = cover(S), blk = bulk(S), wid = width(S);

    // the mass of it, plus how much of them it hides and whatever
    // somebody painted on the front: the rimmed ones take a knock
    // without folding
    const stam = ((6 + 15 * u) * blk + (P.rim ? 6 : 0)
                  + (8 + 12 * u) * cov + PAINT_STAM[P.paint]) * pw;
    // saturating, so a nightmare shield never reaches free stamina
    const d = (.05 + .12 * u) * cov * pw;

    return {
      // the boss is the part you SHOVE with — it is the only thing on
      // a shield that ever touches a nightmare
      add: { maxStam: stam, knock: P.boss ? (.5 + 1.1 * u) * pw : 0 },
      mul: {
        drain: 1 / (1 + d),
        // the cost is the WIDTH, and it does not care what rank it is:
        // a fat shield is a fat shield to hold out in front of you
        speed: 1 - (.02 + .085 * u) * wid,
      },
    };
  },

  // No fxOf. A shield is entirely the four numbers above — there is
  // nothing it does at a distance, and an aura on it would be a
  // circle on the floor nobody could point at a drawn feature for.

  adj(P) {
    if (P.size >= .76) return 'great';
    if (P.size <= .54) return 'little';
    if (P.shape === 'door') return 'tall';
    if (P.shape === 'kite') return 'pointy';
    if (P.paint === 'star') return 'starred';
    if (P.boss) return 'domed';
    if (P.rim) return 'rimmed';
    return 'plain';
  },

  desc(P) {
    if (P.size >= .76) return 'wide enough to put a whole child behind';
    if (P.paint === 'star') return 'somebody painted the star on, and they carry it further for that';
    if (P.shape === 'door') return 'a door you can carry, and stand behind';
    if (P.shape === 'kite') return 'narrow enough to hold up all night';
    if (P.paint !== 'none') return 'the painted side goes out, so the dark can see it too';
    if (P.boss) return 'you push with the dome and hide behind the rest';
    return 'the more of you it covers the longer you last out there';
  },

  draw(s, P, F) {
    const S = SHAPES[P.shape] ?? SHAPES.round;
    const L = REF * P.size * .5;             // the long half-axis: size IS the silhouette
    const hx = L * S.ax, hy = L * S.ay;
    const R = Math.min(hx, hy);
    const body = bodyPts(P, hx, hy);

    finish(s, body, P.rank, { lw: REF * .032, F });
    paintFace(s, P, body, hx, hy, R);

    // the rim: a second contour run just inside the edge, the way you
    // reinforce a bit of cardboard before you trust it
    if (P.rim) {
      const inner = s.offsetShape(body, .88, 0, 0, 0);
      s.sline(inner.concat([inner[0]]), REF * .022, .5);
    }

    // the boss last: it stands proud of the face, so it covers the
    // paint rather than the other way round — and it sits on the grip
    if (P.boss) {
      const br = R * .22;
      finish(s, ovalPts(0, 0, br, br * .96, 18, P.wob * 1.7, .05), P.rank, { lw: REF * .026, F });
      const hl = [];
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI * (1.05 + .42 * i / 6);
        hl.push([Math.cos(a) * br * .55, Math.sin(a) * br * .55]);
      }
      s.sline(hl, REF * .018, .5);
    }
  },
};
