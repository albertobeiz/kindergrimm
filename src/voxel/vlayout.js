// ---------------------------------------------------------------
// THE SKELETON — every measurement more than one part needs.
//
// Same rule as `src/layout.js`: a part must not invent an anchor. If
// the eyes and the brows have to agree on where the face is, the face
// is measured ONCE here and read off `V`.
//
// The head's own solid test lives here too, and that is the important
// bit. `V.contains(x,y,z)` and `V.frontZ(x,y)` are the head's profile —
// the Skull part fills them in, and every face part paints onto the
// surface they describe. So when a species grows a muzzle, the profile
// swells, `frontZ` reports the new tip, and the nose and mouth land on
// it without ever learning that muzzles exist. That is the muzzle
// lesson from the drawn generator, and it is the whole reason the face
// parts are three lines long each.
//
// Voxel space: integers, y up, +z front, x mirrored about 0, y=0 is
// the floor. Widths and depths are HALF-extents so everything is odd
// and exactly symmetric.
// ---------------------------------------------------------------
import { makeRng, hashStr } from '../rng.js';
import { paletteFor } from './vpalette.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// shape → the superellipse exponent and the radius multipliers. `n` is
// the family in one number: 2.4 is a ball, 6 is a box with the corners
// knocked off. Adding a head shape = one row here plus its name in
// Skull.gen's pick list.
const SHAPES = {
  box:   { n: 16.0, kx: 1.00, ky: 1.00, kz: 1.00 },
  round: { n: 2.4, kx: 1.00, ky: 1.00, kz: 1.00 },
  tall:  { n: 8.0, kx: 0.86, ky: 1.12, kz: 0.94 },
  wide:  { n: 8.0, kx: 1.18, ky: 0.84, kz: 1.06 },
  dome:  { n: 2.6, kx: 1.00, ky: 1.00, kz: 1.00, flat: true },
  drop:  { n: 2.8, kx: 1.00, ky: 1.02, kz: 1.00, pinch: .42 },
  wonky: { n: 2.8, kx: 1.00, ky: 1.00, kz: 1.00, wonk: 1.5 },
  // the graveyard range. `arch` rounds only the crown (a tombstone),
  // `bell` flares the jaw, `cof` is widest at the shoulders and tapers
  // both ways — a standing coffin.
  tomb:  { n: 14.0, kx: 1.00, ky: 1.00, kz: 1.00, arch: 1 },
  bell:  { n: 6.0, kx: 1.00, ky: 1.00, kz: 1.00, bell: 1 },
  coffin:{ n: 10.0, kx: 1.05, ky: 1.06, kz: 1.00, cof: 1 },
  slab:  { n: 12.0, kx: 1.34, ky: 0.72, kz: 1.00 },
  tower: { n: 10.0, kx: 0.70, ky: 1.26, kz: 0.90 },
};
export const HEAD_SHAPES = Object.keys(SHAPES);

// ---------------- the body ----------------
// Both bases publish neckY, top, chestY and the pieces their own limbs
// need. Nothing outside here may branch on the base for a position.
function bipedBody(Ps) {
  const T = Ps.torso, L = Ps.legs;
  const legLen = L.len;
  const y0 = legLen, y1 = legLen + T.h - 1;
  return {
    base: 'biped',
    legLen, legX: clamp(T.w - L.w, 1, T.w), legZ: Math.min(T.d, L.w + 1),
    hipY: y0, footY: 0,
    torso: { x0: -T.w, x1: T.w, y0, y1, z0: -T.d, z1: T.d },
    tw: T.w, th: T.h, td: T.d,
    shoulderY: y1 - 2, armX: T.w + 1, armZ: Math.min(1, T.d),
    chestY: y0 + (T.h - 1) * .6,
    tailZ: -T.d, tailY: y0 + 1,
    // the head sinks TWO rows into the shoulders. The seam between the
    // head group and the body group is culled like any other interior
    // face, so it has to be buried deep enough that a head cocking
    // toward a glance can never swing it into view.
    neckY: y1 - 1, top: y1,
  };
}

function quadBody(Ps) {
  const T = Ps.torso, L = Ps.legs4;
  const legLen = L.len;
  // the body lies along z with its FRONT at z = 0, so the head hangs
  // off the front and the tail off the back
  const len = T.h + 4;                    // a quad's "height" is its length
  // and its height comes off the same number, or the barrel ends up
  // shallower than the head is tall and the animal is all face
  const y0 = legLen, y1 = legLen + Math.max(4, Math.round(T.h * .75));
  return {
    base: 'quad',
    legLen, legX: clamp(T.w - L.w, 1, T.w), legZ: 0,
    hipY: y0, footY: 0,
    torso: { x0: -T.w, x1: T.w, y0, y1, z0: -(len - 1), z1: 0 },
    tw: T.w, th: y1 - y0 + 1, td: T.d,
    bodyLen: len,
    frontLegZ: -1, backLegZ: -(len - 2),
    shoulderY: y1, armX: T.w + 1, armZ: 0,
    chestY: (y0 + y1) / 2,
    tailZ: -(len - 1), tailY: y1 - 1,
    neckY: y1 + 1, top: y1,
  };
}

// ---------------- the head ----------------
function headLayout(Ps, B) {
  const P = Ps.skull;
  const S = SHAPES[P.shape] ?? SHAPES.round;
  const w = P.w, d = P.d, h = P.h;

  // where the head sits on the body: a biped wears it on top, a quad
  // carries it out front and sunk into the shoulders
  const cz = B.base === 'quad' ? d - 1 : 0;
  const y0 = B.base === 'quad' ? B.top - 2 : B.neckY;
  const y1 = y0 + h - 1;
  const cy = y0 + (h - 1) / 2;

  const rx = (w + .49) * S.kx;
  const rz = (d + .49) * S.kz;
  // +1.1 rather than +.49: a crown pinched to the mathematical top of
  // an ellipsoid reads as a cone, and a doodle head is broad up there
  const ry = ((h - 1) / 2 + 1.1) * S.ky;
  const n = S.n, jaw = P.jaw;

  // the head-only profile at a given y: centre shift and both radii.
  // Memoised on the integer y — every face part scans columns through
  // `frontZ`, so this runs thousands of times per build and is all the
  // Math.pow the head costs.
  const profs = new Map();
  function prof(y) {
    if (profs.has(y)) return profs.get(y);
    const r = prof_(y);
    profs.set(y, r);
    return r;
  }
  function prof_(y) {
    const t = (y - cy) / ry;
    if (Math.abs(t) >= 1) return null;
    // a tombstone is flat-sided with only the crown rounded
    const ny = S.arch && t > 0 ? 2.35 : n;
    let f = (S.flat || S.arch) && t < 0 ? 1 : Math.pow(Math.max(0, 1 - Math.abs(t) ** ny), 1 / ny);
    if (S.pinch && t > 0) f *= 1 - S.pinch * t ** 1.4;
    let fx = f, cxs = 0;
    if (S.bell) fx *= 1 + .34 * Math.max(0, -t - .25);
    if (S.cof) fx *= 1 - .45 * Math.abs(t - .2);
    if (t < 0) fx *= 1 + (jaw - 1) * (-t) ** 1.2;   // the jaw tapers
    if (S.wonk) {                                    // nobody's head is straight
      cxs = P.wonk * Math.sin((t + 1) * 1.7);
      fx *= 1 + .10 * Math.cos(t * 4);
    }
    return { cx: cxs, rx: rx * fx, rz: rz * f };
  }

  // THE FACE IS A WALL. Forward of the centre-plane the head stops
  // curving: every row extrudes its widest section straight out to one
  // fixed front plane, so the skull is a loaf — rounded back, rounded
  // silhouette, dead-flat face. Flat is what makes a voxel face read:
  // the whole eye sits at ONE depth, the way every toy voxel character
  // ever shipped does it. The silhouette shapes (tall, drop, wonky…)
  // all survive, because the silhouette is the y-profile and the flat
  // front shows it off.
  const zFront = cz + Math.max(1, Math.round(rz * .55));
  const inHead = (x, y, z) => {
    const p = prof(y);
    if (!p) return false;
    if (p.rx < .5 || p.rz < .5) return false;
    if (z > zFront) return false;
    const dz = z > cz ? 0 : (z - cz) / p.rz;
    return Math.abs((x - p.cx) / p.rx) ** n + Math.abs(dz) ** n <= 1;
  };

  // ---- the muzzle, in the OUTLINE and not on top of it ----
  const mz0 = (() => {              // the head's front at the muzzle line
    const my = y0 + (h - 1) * P.muzzleY;
    for (let z = cz + Math.ceil(rz) + 1; z >= cz; z--) if (inHead(0, Math.round(my), z)) return z;
    return cz;
  })();
  const muz = P.muzzle >= .8 ? {
    cx: 0, cy: y0 + (h - 1) * P.muzzleY, cz: mz0 + P.muzzle / 2,
    rx: Math.max(1.4, w * .58), ry: Math.max(1.4, h * .21), rz: P.muzzle / 2 + 1.2,
  } : null;

  const inMuzzle = (x, y, z) => {
    if (!muz || z < mz0 - 1) return false;
    return Math.abs((x - muz.cx) / muz.rx) ** 2.6
      + Math.abs((y - muz.cy) / muz.ry) ** 2.6
      + Math.abs((z - muz.cz) / muz.rz) ** 2.6 <= 1;
  };

  const contains = (x, y, z) => inHead(x, y, z) || inMuzzle(x, y, z);

  const zTop = cz + Math.ceil(rz) + Math.ceil(P.muzzle) + 2;
  /** the z of the front surface of the head at that column, or null */
  const frontZ = (x, y) => {
    for (let z = zTop; z >= cz - Math.ceil(rz) - 1; z--) if (contains(x, y, z)) return z;
    return null;
  };
  /** the top of the head in that column — where a hat or an ear roots */
  const crownY = (x, z) => {
    for (let y = y1 + 1; y >= y0; y--) if (contains(x, y, z)) return y;
    return null;
  };
  /** how far out the head reaches at that height, on the +x side */
  const edgeX = (y, z) => {
    for (let i = w + 2; i >= 0; i--) if (contains(i, y, z)) return i;
    return null;
  };

  // ---- the face, measured once ----
  const E = Ps.eyes;
  const eyeY = clamp(Math.round(y0 + (h - 1) * E.y), y0 + 2, y1 - 2);
  // the low clamp is the eye's own width: it guarantees at least one
  // column of skin on the centre line, or the two eyes meet and the
  // face becomes one band across
  const eyeX = clamp(Math.round(w * E.sep), Math.min(w, E.w), w);
  // A muzzle face keeps its snout anatomy. A BARE face compresses the
  // doodle way: the mouth tucks in right UNDER the eye band — high on
  // the face, chin left empty — but never inside it: the eyes are wide
  // enough now that a mouth between them gets eaten to a single voxel,
  // which is how a whole crowd went mouthless once.
  const mouthY = muz
    ? clamp(Math.round(muz.cy) - 1, y0 + 1, eyeY - 2)
    : clamp(eyeY - 3, y0 + 1, y1 - 4);
  const noseY = muz
    ? clamp(Math.round(muz.cy) + 1, mouthY + 1, eyeY - 1)
    : clamp(eyeY - 1, mouthY + 1, y1 - 1);

  return {
    head: { x0: -w, x1: w, y0, y1, z0: cz - d, z1: cz + d, cx: 0, cy, cz, w, h, d, n, rx, ry, rz },
    muzzle: muz, contains, inMuzzle, inHead, frontZ, crownY, edgeX, prof,
    // Face rects are the +x SIDE ONLY — draw one and let v.sym() make
    // the pair, or the two eyes can drift half a voxel apart.
    eyeY, eyeX, mouthY, noseY,
    eye: () => ({ x0: eyeX - (E.w - 1), x1: eyeX, y0: eyeY, y1: eyeY + E.h - 1 }),
    // where the head GROUP turns: a biped nods on its neck, a quad on
    // the point where its skull sinks into the shoulders
    headPivot: B.base === 'quad' ? [0, y0 + 1, cz - d] : [0, B.neckY, 0],
    top: y1,
  };
}

export function buildVoxelLayout(recipe, Ps) {
  const rng = makeRng(hashStr(`${recipe.seed}:vpal:${recipe.palette}`));
  const pal = paletteFor(recipe.palette, rng);
  const base = recipe.base === 'quad' ? 'quad' : 'biped';
  const B = base === 'quad' ? quadBody(Ps) : bipedBody(Ps);
  const H = headLayout(Ps, B);
  return {
    P: Ps, pal, recipe, base, species: recipe.species, B, ...H,
    height: H.top + 1,
  };
}
