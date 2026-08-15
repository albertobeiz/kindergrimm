// ---------------------------------------------------------------
// THE DOLL — the stuffed thing a child will not put down.
//
// Every other charm is a number on the end of a string. This one is an
// ANIMAL. Its whole job is `fxOf`: it hands the child a FAMILIAR, a
// small live doodle of the same species that trails them around the
// room and goes for anything that comes too close. The doll on the
// card and the animal on the floor are the same creature, so the
// drawing is not a picture of the effect — it IS the effect. The ears
// you roll are the ears it has, and they are also how far off it hears
// the dark coming.
//
// Which is why it carries almost nothing itself: a child holding
// something settles instead of burning through the night, and that is
// the whole of it. The biting belongs to the thing that steps off the
// card. Give the doll damage as well and you have paid for the
// familiar twice.
//
// It is read at 22px in a HUD chip, so it is a SILHOUETTE and little
// else — ONE ring for the body and all four stubs, one big head on
// top, and the ears. The mend and the odd button eye are the only
// interior marks on it, and both are there because both are numbers.
// ---------------------------------------------------------------
import { REF, finish, barPts } from './core.js';
import { chaikin, circlePts } from '../sketch.js';

const LW = REF * .034;              // a body contour — a doll is chunky
const LWD = REF * .020;             // a seam, a stitch, a button

// A lumpy ring with NO DICE IN IT — the same trick charm.js plays, for
// the same reason. `s.blobPts` takes its phase from the boil rng, and
// a head redrawn twice a second off the boil would breathe. The phase
// comes from P instead, so a doll is the same doll every frame.
function lumpRing(cx, cy, rx, ry, ph, wob, n = 24) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2;
    const m = 1 + wob * (.17 * Math.sin(t * 2 + ph) + .1 * Math.sin(t * 5 + ph * 2.3));
    pts.push([cx + Math.cos(t) * rx * m, cy + Math.sin(t) * ry * m]);
  }
  return chaikin(pts, true, 1);
}

// the void mark — the same one every face in this world is given
function inkBlob(s, x, y, rx, ry, a = .92) {
  s.ctx.fillStyle = s.inkA(a);
  s.wobbly(x, y, rx, ry);
  s.ctx.fill();
}

// a point on the head's rim, `k` of the way out from its centre
const rim = (a, k, hy, hr) => [Math.cos(a) * hr * k, hy + Math.sin(a) * hr * .95 * k];

// ---- the body ---------------------------------------------------
// One gingerbread ring: torso, two arms and two legs in a single
// outline. Five separate lumps would be five contours redrawn every
// boil frame, and at thumbnail size they would not read as one toy
// anyway — a doll is a shape you recognise by its corners.
function bodyRing(bw, bh, by, bot) {
  return chaikin([
    [-bw * .70, by - bh * .95], [-bw * .32, by - bh * 1.12],
    [bw * .32, by - bh * 1.12], [bw * .70, by - bh * .95],
    [bw * 1.55, by - bh * .66], [bw * 1.86, by + bh * .02],   // the right arm
    [bw * .80, by + bh * .26],                                 // back INSIDE the torso,
    [bw * 1.00, by + bh * .86],                                // or the arm and the hip
    [bw * .88, bot], [bw * .30, bot],                          // are one poncho
    [0, by + bh * .72],                                        // between the legs
    [-bw * .30, bot], [-bw * .88, bot], [-bw * 1.00, by + bh * .86],
    [-bw * .80, by + bh * .26], [-bw * 1.86, by + bh * .02],
    [-bw * 1.55, by - bh * .66],
  ], true, 2);
}

// ---- the ears ---------------------------------------------------
// The ear IS the species, and the species is the animal that comes off
// the card. A cat's are triangles, a dog's hang past the jaw, and a
// nightmare's are not ears at all. All three are drawn BEFORE the
// head, so its fill closes over the seam where they were sewn on.
const EAR = {
  // no chaikin: a cat's ear is an actual triangle or it is a nub
  cat: (sd, hy, hr) => [
    rim(-Math.PI / 2 + sd * .24, .90, hy, hr),
    rim(-Math.PI / 2 + sd * .92, .90, hy, hr),
    rim(-Math.PI / 2 + sd * .68, 1.92, hy, hr),
  ],

  // the one you can see from across the street. It has to START under
  // the skull and END outside it, or the head is drawn over the top of
  // it and the dog comes out a bald egg.
  dog: (sd, hy, hr) => barPts(sd * hr * .72, hy - hr * .55,
                              sd * hr * 1.48, hy + hr * .95,
                              hr * .48, hr * .36, 2),

  // a horn — built off a SWEEPING spine, not a triangle with a lean on
  // it. That curve is the entire difference between a horn and the
  // cat's ear next to it, and at 22px it is the only difference left.
  nightmare(sd, hy, hr) {
    const N = 5, out = [], back = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const a = -Math.PI / 2 + sd * (.30 + .52 * t);   // leaves upright, sweeps out
      const p = rim(a, .86 + 1.4 * t, hy, hr);
      const w = hr * (.40 - .35 * t);                  // and comes to a point
      const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
      out.push([p[0] + nx, p[1] + ny]);
      back.push([p[0] - nx, p[1] - ny]);
    }
    return chaikin(out.concat(back.reverse()), true, 1);
  },
};

// Which side the ears are on. One ear is a doll that lost one, and the
// side is read off `ph` — settled at generation, so it cannot flip
// between two frames of the same doll.
const earSides = P => P.ears === 2 ? [-1, 1]
                    : P.ears === 1 ? [P.ph < Math.PI ? -1 : 1] : [];

// The odd eye: a button sewn on where the other one went. It is the
// only pale mark on the whole doll, which is precisely why it survives
// the HUD chip — one dark eye, and one that is not.
function sewnButton(s, cx, cy, r) {
  const ring = circlePts(cx, cy, r, r * .95, 14);
  s.sline(ring.concat([ring[0]]), LWD * 1.2, .9);
  for (const u of [-1, 1])
    s.sline([[cx - r * .42 * u, cy - r * .42], [cx + r * .42 * u, cy + r * .42]], LWD, .85);
}

// The mend: a seam across the belly with the ladder stitches still in
// it. A doll that has been sewn back up has already survived a night,
// and the steadier burn it hands over says so.
function mendSeam(s, bw, bh, by) {
  const x0 = -bw * .62, y0 = by + bh * .44;
  const dx = bw * 1.20, dy = -bh * .62;
  const sag = t => Math.sin(t * Math.PI) * bh * .16;
  const seam = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    seam.push([x0 + dx * t, y0 + dy * t + sag(t)]);
  }
  s.sline(seam, LWD, .75);
  const d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, L = bh * .26;
  for (const t of [.16, .38, .6, .82]) {
    const x = x0 + dx * t, y = y0 + dy * t + sag(t);
    s.sline([[x - nx * L, y - ny * L], [x + nx * L, y + ny * L]], LWD, .8);
  }
}

export const Doll = {
  id: 'doll', slot: 'charm', noun: 'doll', weight: 6,

  gen(rng, C) {
    // The species must be a real one — the game builds the familiar by
    // handing this straight to the character generator, so a fourth
    // word here is an animal nobody has drawn.
    const species = C.wpick(rng, [['cat', 11], ['dog', 11], ['nightmare', 4]]);
    return {
      species,
      size: rng.r(.4, .85),        // the headline: how big it is drawn AND how big the animal is
      ears: rng.ri(0, 2),          // how far off the familiar hears them coming
      stitched: rng.chance(.45),   // a mended seam
      button: rng.chance(.4),      // one eye replaced
      ph: rng.r(0, 7),             // the lumpiness phase, rolled once so it cannot shimmer
    };
  },

  // PURE. Small on purpose — comfort, not a weapon. The doll is worth
  // having for `fxOf`, and everything here is just the fact of holding
  // something soft while the light goes out.
  statsOf(P) {
    const k = P.pow;
    return {
      // a mended one has already been through a night, and they know it
      add: { maxStam: (3 + P.size * 9 + (P.stitched ? 4 : 0)) * k },
      mul: { drain: Math.max(.7, 1 - (.05 + P.size * .1) * k) },
    };
  },

  // The whole family, in one key. `familiar` is not a radius like the
  // rest of the effects — it is the recipe for a second creature, and
  // the game reads every field of it: the species it draws, how big it
  // draws it, how hard it nips, and how close a nightmare gets before
  // it stops trotting and goes for it.
  fxOf(P) {
    const k = P.pow;
    return {
      familiar: {
        species: P.species,
        // a big doll is a big animal — the one thing you can read off
        // the card without turning it over
        scale: Math.min(1, .5 + (P.size - .4) * 1.15),
        // and a bigger mouth on it. The odd button eye is worth a
        // little more: it is the eye that went for something once.
        bite: (.3 + (P.size - .4) * 1.9 + (P.button ? .1 : 0)) * k,
        // ears are hearing. Rank sharpens it, but the room is 13 units
        // across, so it is never allowed past 5.
        r: Math.min(5, (2.5 + P.ears * .55 + (P.size - .4) * 2) * (.92 + k * .1)),
      },
    };
  },

  // the loudest thing about it, and never a word the drawing does not
  // already show
  adj(P) {
    const scores = [
      ['big', (P.size - .4) / .45],
      // no baseline: an earless doll must never be called floppy
      ['floppy', P.ears ? .2 + P.ears * .26 : 0],
      ['patched', P.stitched ? .55 : 0],
      ['one-eyed', P.button ? .58 : 0],
    ];
    return scores.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  },

  desc(P) {
    return {
      cat: 'it gets down off the shelf when nobody is looking, and follows them about',
      dog: 'it gets up when nobody is looking and trots along behind them',
      nightmare: 'something small and dark walks with them now. it is on their side',
    }[P.species];
  },

  draw(s, P, F) {
    // `size` is the height of the whole doll, and every other number in
    // here is a fraction of it — so a big doll is drawn big, and that
    // is the same big that the familiar comes out at.
    const H = REF * (.5 + P.size * .58);
    const top = -H / 2, bot = H / 2;
    const hr = H * .235;                    // the head. On a doll it is enormous.
    const hy = top + hr * 1.06;
    const bw = H * .25, bh = H * .2;        // the torso's half-extents
    const by = hy + hr * .8 + bh * .8;

    for (const sd of earSides(P)) finish(s, EAR[P.species](sd, hy, hr), P.rank, { F, lw: LW });
    finish(s, bodyRing(bw, bh, by, bot), P.rank, { F, lw: LW });
    finish(s, lumpRing(0, hy, hr, hr * .95, P.ph, .14), P.rank, { F, lw: LW });

    // the face, and nothing more than the face
    const ey = hy - hr * .06, ex = hr * .36, er = hr * .17;
    const odd = P.ph % 1 < .5 ? -1 : 1;     // which eye went; also from P, also settled
    for (const sd of [-1, 1]) {
      if (P.button && sd === odd) sewnButton(s, sd * ex, ey, er * 1.15);
      else inkBlob(s, sd * ex, ey, er, er * 1.05);
    }
    if (P.species === 'nightmare') {
      // the one thing anybody ever sews shut
      const my = hy + hr * .38, mw = hr * .34;
      s.sline([[-mw, my], [mw, my]], LWD, .7);
      for (let i = 0; i < 3; i++)
        s.sline([[-mw * .6 + i * mw * .6, my - hr * .12],
                 [-mw * .6 + i * mw * .6, my + hr * .12]], LWD, .7);
    } else {
      inkBlob(s, 0, hy + hr * .34, hr * .16, hr * .13);      // the sewn-on nose
    }

    if (P.stitched) mendSeam(s, bw, bh, by);
  },
};
