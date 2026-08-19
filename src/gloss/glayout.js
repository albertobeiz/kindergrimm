// ---------------------------------------------------------------
// THE LAYOUT — everything two parts must agree on, measured once.
//
// Coordinates: world units, y up, +z toward the viewer (the face is on
// the +z side), origin at the FLOOR under the toy. Same convention as
// the voxel lab, and for the same reason: a solid wants measuring from
// the ground it sits on.
//
// The whole thing is one function. `L.at(ax, ay)` takes a FACE
// COORDINATE — ax across, ay up, both roughly −1…1 — and returns the
// point on the body and the normal there. On an ellipsoid that is
// arithmetic; on the humanoid's SKULL (a modeled, subdivided mesh —
// gskull.js) it is a raycast against the real surface. Either way a
// feature asks where it lands and never learns how the body is made.
//
// Every face part places itself through `at` and nothing else. That is
// what lets a second body shape arrive later — the skull already did —
// and inherit the entire face catalogue: whatever `at` returns, the
// features land on it.
// ---------------------------------------------------------------
// The one thing the layout asks a PART for. How tall an eye is lives
// in the eye style table and nowhere else, but the layout is what has
// to keep a mouth out from under one — so the eyes publish their reach
// as a pure function of the recipe and this asks. It is the only edge
// pointing this way, and it beats copying the style table in here.
import { eyeReach, eyeSpan } from './gparts/eyes.js';
import { mouthReach, mouthSpan } from './gparts/mouth.js';
// the ONE copy of each surface: the same functions/arrays the body is
// BUILT from, so where a feature lands and where the skin is can
// never disagree (see gshape.js and gskull.js)
import { surfT, surfN } from './gshape.js';
import { skullSurface } from './gskull.js';
import { HAIR_BY_ID, INK, mix, luma } from './gpalette.js';

// how far off centre ax = ±1 reaches, in radians. Beyond ~1.05 a
// feature starts wrapping onto the side of the head where the camera
// cannot see it.
const SPREAD = .92;

export function buildGlossLayout(P, colors, form = 'sphere') {
  const B = P.body;

  // ---- the surface, per form ------------------------------------------
  // Both branches define the same six things and nothing downstream
  // knows which branch ran: rx/ry/rz (extents), cy (centre height —
  // the floor is y = 0), topY (the crown), at/top/hwAt.
  let rx, ry, rz, exp = 2, cy, topY, at, top, hwAt, skull = null, profile = null;

  if (form === 'head') {
    // THE SKULL — modeled, not described. A control cage put through
    // Catmull-Clark subdivision (gskull.js); `at` raycasts the same
    // mesh the body will be built from, so features sit on the real
    // subdivided surface, never on an approximation of it.
    skull = skullSurface(B.skull, {
      scale: B.r, width: B.wide, height: B.tall, depth: B.deep,
    });
    cy = -skull.minY;
    topY = cy + skull.maxY;
    rx = skull.maxX; ry = (skull.maxY - skull.minY) / 2; rz = skull.maxZ;
    // the cage as a function — what HAIR is lofted from, so a cap can
    // never disagree with the head it is sitting on
    profile = skull.profile;

    const cast = (dx, dy, dz) =>
      // the jittered retry is for a ray grazing an edge exactly —
      // rare, but a null here would take the whole build down
      skull.pick(dx, dy, dz) ?? skull.pick(dx + 1e-4, dy + 1e-4, dz);
    at = (ax, ay) => {
      const u = ax * SPREAD, v = ay * SPREAD;
      const cv = Math.cos(v);
      const h = cast(Math.sin(u) * cv, Math.sin(v), Math.cos(u) * cv);
      return { p: [h.p[0], h.p[1] + cy, h.p[2]], n: h.n };
    };
    top = t => {
      const h = cast(Math.sin(t), Math.cos(t), 0);
      return { p: [h.p[0], h.p[1] + cy, h.p[2]], n: h.n };
    };
    hwAt = yy => skull.halfWidthAt(yy - cy);
  } else {
    rx = B.r * B.wide;
    // NEVER THINNER THAN SQUARE. Guaranteed here and not just in the
    // part's ranges, because a species can cast its own `tall` and
    // outvote them — that has already happened twice with sizes. One
    // clamp in the layout and no profile can make a narrow head.
    ry = B.r * Math.min(B.tall, B.wide);
    rz = B.r * B.deep;
    // The FORM is one exponent, not a second body of code: n = 2 is a
    // ball, and squaring it off is turning that number up. A sphere
    // is pinned at 2 so it stays exact; only a cube reads the roll.
    exp = form === 'cube' ? B.corner : 2;
    cy = ry;
    topY = ry * 2;

    at = (ax, ay) => {
      const u = ax * SPREAD, v = ay * SPREAD;
      const cv = Math.cos(v);
      // a direction, then pushed out to wherever the surface actually
      // is; the normal is the GRADIENT of the implicit surface, never
      // the direction from the centre — get this wrong and every
      // feature on a squashed body tips, and on a cube they would all
      // point at the corners instead of lying flat on the face
      const d = [Math.sin(u) * cv, Math.sin(v), Math.cos(u) * cv];
      const t = surfT(d[0], d[1], d[2], rx, ry, rz, exp);
      const x = d[0] * t, y = d[1] * t, z = d[2] * t;
      return { p: [x, y + cy, z], n: surfN(x, y, z, rx, ry, rz, exp) };
    };
    top = t => {
      const d = [Math.sin(t), Math.cos(t), 0];
      const s = surfT(d[0], d[1], 0, rx, ry, rz, exp);
      const x = d[0] * s, y = d[1] * s;
      return { p: [x, y + cy, 0], n: surfN(x, y, 0, rx, ry, rz, exp) };
    };
    hwAt = () => rx;
  }

  // WHERE THE FACE'S ROWS SIT, published once. Brows must clear the
  // eyes, a nose must land between the eyes and the mouth, cheeks sit
  // outboard of both — all of that is agreement BETWEEN parts, so it
  // belongs here rather than in each part reaching into another's
  // params.
  const eyeX = P.eyes.x, eyeY = P.eyes.y;
  const eyeR = B.r * P.eyes.size;
  // a cube's face is FLAT, so its eyes have room a sphere's curvature
  // never gives them. Only the eyes grow — the nose, mouth and cheeks
  // keep sizing off `eyeR`, because they got no extra room
  let eyeSize = eyeR * (form === 'cube' ? 1.22 : 1);

  // AN EYE HAS TO FIT THE HEAD IT IS ON. The styles are free to ask for
  // whatever they want — a `slab` asks for two and a half times the eye
  // unit in height — and this is what makes that safe: the eyes publish
  // how far they reach and how wide they span, and the size is cut back
  // until they are on the head and clear of each other. Without it,
  // going big on a style means going off the silhouette on the small
  // bodies, and the only fix left is timid numbers everywhere.
  {
    const reachY = eyeReach(P), spanX = eyeSpan(P);
    const a0 = at(eyeX, eyeY);
    const cxOff = Math.abs(a0.p[0]);
    // the two vertical rooms measured separately: on a skull the jaw
    // is shallower than the cranium, so an eye set low runs out of
    // chin long before it runs out of forehead
    const roomUp = topY * .93 - a0.p[1];
    const roomDn = a0.p[1] - cy * .07;
    eyeSize = Math.min(
      eyeSize,
      Math.min(roomUp, roomDn) / reachY,     // stays on the head, top and bottom
      (hwAt(a0.p[1]) * .95 - cxOff) / spanX, // and inside the cheeks at THIS height
      cxOff / (spanX * 1.1),                 // and out of the other eye
    );
    // The floor exists so a weird roll cannot erase the eyes — but it
    // must stay BELOW what containment asks for, or it wins the fight
    // and tall eyes dangle off the chin of every squat head. At .3 of
    // the unit it did exactly that, a row of them, like legs.
    eyeSize = Math.max(eyeSize, eyeR * .15);
  }

  // THE MOUTH IS PUSHED OUT FROM UNDER THE EYES. The eye and mouth
  // height ranges overlap on their own — a low eye and a high mouth
  // collide even with the old shapes — and a tall style like `slab`
  // reaches so far down that it lands on the mouth three times in
  // four. So the rolled `mouth.y` is a WISH, and this is where it
  // gets to be true: the eyes declare how far they reach
  // (`eyeReach`, which only they can know), and the mouth is moved
  // down until it is clear of them.
  // Solved against the REAL surface by bisection, not by inverting a
  // sine. The height a face coordinate lands at depends on the depth
  // radius and the exponent as well as `ry`, so `asin(y / ry)` is only
  // right on a perfect sphere — and it was wrong often enough to leave
  // one toy in twenty still overlapping.
  const surfY = v => at(0, v).p[1];
  const clearY = at(eyeX, eyeY).p[1]                    // the eye's centre
                 - eyeReach(P) * eyeSize                // down to its lowest ink
                 - mouthReach(P) * eyeR                 // the mouth's real reach —
                                                        // a maw is EYES tall
                 - eyeR * .1;                           // and air between them

  let mouthY = P.mouth.y;
  let mouthFit = 1;
  if (surfY(mouthY) > clearY) {
    let lo = -1.05, hi = mouthY;                        // lo: as low as a mouth may go
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      surfY(m) > clearY ? (hi = m) : (lo = m);
    }
    mouthY = lo;
    // A maw can be taller than the room the head has under the eyes,
    // and then no amount of pushing down fits it — the chin runs out.
    // What gives is the SIZE: the deficit comes off the mouth's scale,
    // so the huge ones stay huge wherever huge fits.
    const deficit = surfY(mouthY) - clearY;
    if (deficit > 0) {
      const need = mouthReach(P) * eyeR;
      mouthFit = Math.max(.4, (need - deficit) / need);
    }
  }

  // THE CHIN. Pushed down to clear the eyes, a big maw runs off the
  // bottom of the head — and there is nothing below it to push against,
  // so the SIZE is what gives. This was missing: the clamp only ever
  // looked upward at the eyes.
  {
    const need = mouthReach(P) * eyeR * mouthFit;
    const room = surfY(mouthY) - cy * .12;
    if (need > room) mouthFit *= Math.max(.35, room / need);
  }

  // and SIDEWAYS: a head narrows toward the chin, and a maw pushed
  // down there was overflowing the silhouette on the squat bodies.
  // At .88 of the half-width a mouth spans almost the whole face and
  // reads as a letterbox cut in the head rather than a mouth on it.
  {
    const spanNeed = mouthSpan(P) * eyeR * mouthFit;
    const hw = Math.abs(at(1, mouthY).p[0]);
    if (spanNeed > hw * .7) mouthFit *= Math.max(.35, hw * .7 / spanNeed);
  }

  /**
   * `at`, but pulled back onto the FRONT of the head.
   *
   * Out near the silhouette the surface turns away, and a plate landed
   * there stands almost edge-on: it reads as a fin sticking off the
   * outline rather than a mark on the face. Cheeks are the ones that
   * do it — they are placed OUTBOARD of the eyes by design, and one
   * toy in five had one hanging off the side.
   *
   * The guard used to live in the face part, and was lost when the
   * face was split into six of them. It belongs here: it is a fact
   * about the BODY, and every part that lands on a body wants it.
   */
  // `halfW` is the feature's own half-width: testing only where its
  // CENTRE lands leaves a wide cheek overhanging by half of itself,
  // because the head is curving away under it the whole time.
  function onFace(ax, ay, { facing = .6, halfW = 0 } = {}) {
    const ok = v => {
      const a = at(v, ay);
      // the head's half-width at THIS height, not the crown's — a
      // skull's chin is narrower than rx and a cheek tested against
      // rx would overhang it
      return a.n[2] >= facing && Math.abs(a.p[0]) + halfW <= hwAt(a.p[1]) * .96;
    };
    if (ax === 0 || ok(ax)) return at(ax, ay);
    const sgn = Math.sign(ax);
    let lo = 0, hi = Math.abs(ax);
    for (let i = 0; i < 18; i++) {
      const m = (lo + hi) / 2;
      ok(sgn * m) ? (lo = m) : (hi = m);
    }
    return at(sgn * lo, ay);
  }

  // HAIR'S COLOUR, resolved once. Two parts read it — the hair itself
  // and the BROW, which has to be the same head's hair or the face
  // reads as somebody else's eyebrows glued on. That is exactly the
  // "anything two parts must agree on lives here" rule.
  let hairHex = HAIR_BY_ID[P.hair?.color]?.hex ?? INK;
  const hasHair = !!(P.hair && P.hair.style !== 'bald' && profile);

  // HAIR HAS TO COME OFF THE HEAD IT IS ON. Skin and hair are rolled
  // from two independent tables, so nothing stops caramel hair landing
  // on caramel skin — and a third of the sheet came out with a haircut
  // you could only find by its silhouette. Where the two are within a
  // sixth of each other in luma, the hair is pushed the way it is
  // already leaning, hardest when the clash is worst.
  //
  // A TIE GOES DARKER: hair darker than skin is the overwhelmingly
  // common pairing, and it is the one that reads at sheet scale.
  // This is not the painted-shadow rule being broken — nothing here is
  // standing in for a shadow. It is two objects that must not be the
  // same colour, which is the same job `luma` was written for.
  if (hasHair) {
    const NEED = .17;
    const d = luma(hairHex) - luma(colors.body);
    if (Math.abs(d) < NEED)
      hairHex = mix(hairHex, d > .02 ? '#FFF6EC' : INK,
                    .18 + .42 * (NEED - Math.abs(d)) / NEED);
  }

  return {
    rx, ry, rz,
    form, exp,                 // the body's shape family, for the part
    skull: skull?.mesh,        // the skull's arrays, for the body part to stamp
    profile,                   // …and as a function, for the hair
    hair: hairHex,
    // pulled toward ink: a platinum brow at full strength vanishes, and
    // an ink brow under blonde hair belongs to a different face
    browColor: hasHair ? mix(hairHex, INK, .38) : INK,
    H: topY, W: rx * 2,
    cy,                        // the body's centre, sitting on the floor
    s: B.r,                    // the one number every feature scales off
    eyeX, eyeY, mouthY, mouthFit,
    eyeR,                      // the unit the OTHER face parts size off
    eyeSize,                   // what the eyes themselves use
    // the midpoint by construction, so a nose can never collide with a
    // mouth however either one is dragged
    noseY: (eyeY + mouthY) / 2,
    at, top, onFace,
    ...colors,                 // body, warm, ink, sclera, maw, lite
  };
}
