// ---------------------------------------------------------------
// THE LAYOUT — everything two parts must agree on, measured once.
//
// Coordinates: world units, y up, +z toward the viewer (the face is on
// the +z side), origin at the FLOOR under the character. Same convention as
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
import { eyeReach, eyeSpan, eyeProud } from './gparts/eyes.js';
import { hairOuter } from './ghair.js';
import { hatBare } from './gparts/hat.js';
import { mouthReach, mouthSpan } from './gparts/mouth.js';
import { frameLayout } from './gparts/frame.js';
// the ONE copy of each surface: the same functions/arrays the body is
// BUILT from, so where a feature lands and where the skin is can
// never disagree (see gshape.js and gskull.js)
import { surfT, surfN } from './gshape.js';
import { formSurface, isMeshForm } from './gform.js';
import { HAIR_BY_ID, INK, mix, luma, pickAcc, pickOutfit } from './gpalette.js';

// how far off centre ax = ±1 reaches, in radians. Beyond ~1.05 a
// feature starts wrapping onto the side of the head where the camera
// cannot see it.
const SPREAD = .92;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function buildGlossLayout(P, colors, form = 'sphere', stance = 'none') {
  const B = P.body;

  // ---- the surface, per form ------------------------------------------
  // Both branches define the same six things and nothing downstream
  // knows which branch ran: rx/ry/rz (extents), cy (centre height —
  // the floor is y = 0), topY (the crown), at/top/hwAt.
  const rx = B.r * B.wide;
  // NEVER THINNER THAN SQUARE. Guaranteed here and not just in the
  // part's ranges, because a species can cast its own `tall` and
  // outvote them — that has already happened twice with sizes. One
  // clamp in the layout and no profile can make a narrow head.
  const ry = B.r * Math.min(B.tall, B.wide);
  const rz = B.r * B.deep;
  // The FORM is one exponent, not a second body of code: n = 2 is a
  // ball, and squaring it off is turning that number up. A sphere is
  // pinned at 2 so it stays exact; only a cube reads the roll.
  //
  // There WAS a third form here — `head`, a modeled chibi skull from a
  // subdivided control cage. It is gone, and so is `gskull.js`. It was
  // a good skull and it was the wrong object: this lab makes CHARACTERS, and
  // a sphere or a cube with a face on it is one. Everything the skull
  // was carrying — the hair, the proportions, the face catalogue — sits
  // on these two perfectly well, and one exponent is a knob you can
  // scrub where a cage is a thing you have to sculpt.
  // `rock` and `slime` keep the ball's exponent and bend the SURFACE
  // instead — see `formK`. A cube is the only form that reads `corner`.
  const exp = form === 'cube' ? B.corner : 2;
  const meshed = isMeshForm(form);

  // THE STANCE — what the head stands on. Computed FIRST, because the
  // head's whole height depends on it; everything after this only sees
  // a bigger `cy`, which is what lets the face catalogue survive a
  // torso arriving under it untouched. A modeled form (rock, slime) is
  // already a whole creature — its foot or its base IS its bottom — so
  // it never takes a frame.
  if (meshed) stance = 'none';
  const frame = stance !== 'none'
    ? frameLayout(P.frame, { r: B.r, ry }, stance) : null;
  const lift = frame ? frame.headBase : 0;

  let cy = ry + lift, topY = ry * 2 + lift, at, top, hwAt, formMesh = null;
  // the HEAD's lowest point. The floor and the bottom of the head used
  // to be the same y, and the chin clamps below leaned on that — with
  // a frame they split, and a clamp still measuring off the floor
  // would happily run a maw down onto the chest.
  let botY = lift;

  if (meshed) {
    // MODELED: a control cage through Catmull-Clark (`gform.js`), and
    // `at` raycasts the very arrays the body will be stamped from, so
    // a feature lands on the real subdivided surface rather than on an
    // idea of it.
    const F = formSurface(form, { scale: B.r, width: B.wide, height: B.tall, depth: B.deep });
    formMesh = F.mesh;
    cy = -F.minY;
    topY = cy + F.maxY;
    botY = 0;
    const cast = (dx, dy, dz) =>
      // the jittered retry is for a ray grazing an edge exactly: rare,
      // but a null here would take the whole build down
      F.pick(dx, dy, dz) ?? F.pick(dx + 1e-4, dy + 1e-4, dz);
    at = (ax, ay) => {
      const u = ax * SPREAD, v = ay * SPREAD, cv = Math.cos(v);
      const h = cast(Math.sin(u) * cv, Math.sin(v), Math.cos(u) * cv);
      return { p: [h.p[0], h.p[1] + cy, h.p[2]], n: h.n };
    };
    top = t => {
      const h = cast(Math.sin(t), Math.cos(t), 0);
      return { p: [h.p[0], h.p[1] + cy, h.p[2]], n: h.n };
    };
    hwAt = yy => F.halfWidthAt(yy - cy);
  } else {
    at = (ax, ay) => {
      const u = ax * SPREAD, v = ay * SPREAD, cv = Math.cos(v);
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
      const s2 = surfT(d[0], d[1], 0, rx, ry, rz, exp);
      const x = d[0] * s2, y = d[1] * s2;
      return { p: [x, y + cy, 0], n: surfN(x, y, 0, rx, ry, rz, exp) };
    };
    hwAt = () => rx;
  }

  // WHERE THE FACE'S ROWS SIT, published once. Brows must clear the
  // eyes, a nose must land between the eyes and the mouth, cheeks sit
  // outboard of both — all of that is agreement BETWEEN parts, so it
  // belongs here rather than in each part reaching into another's
  // params.
  // THE FACE FOLLOWS THE WIDTH. On a drop the upper half is the peak,
  // and the lab's own upper-half rule would put the eyes on a spike —
  // so a form may pull the face down toward the part of itself that is
  // actually wide enough to carry one.
  const faceBias = form === 'slime' ? -.34 : 0;
  const eyeX = P.eyes.x, eyeY = P.eyes.y + faceBias;
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
    const roomDn = a0.p[1] - (botY + (cy - botY) * .07);
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
  // one character in twenty still overlapping.
  const surfY = v => at(0, v).p[1];
  const clearY = at(eyeX, eyeY).p[1]                    // the eye's centre
                 - eyeReach(P) * eyeSize                // down to its lowest ink
                 - mouthReach(P) * eyeR                 // the mouth's real reach —
                                                        // a maw is EYES tall
                 - eyeR * .1;                           // and air between them

  let mouthY = P.mouth.y + faceBias;
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
    const room = surfY(mouthY) - (botY + (cy - botY) * .12);
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
   * character in five had one hanging off the side.
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
  // A beanie or a headband is worn on a bare head: there is no size at
  // which one shares a skull with a haircut without fighting it.
  const bare = hatBare(P);
  const hasHair = !!(P.hair && P.hair.style !== 'bald') && !bare;

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

  // THE OUTFIT — colours the frame wears, resolved HERE because they
  // are agreements: cloth must clear the skin and the hair, gloves and
  // shoes must clear the cloth, and the print's ink must clear its own
  // cloth (light ink on dark cloth, dark on light — a tone-on-tone
  // print vanishes at sheet scale). The frame part just reads it.
  let outfit = null;
  if (frame) {
    const F = P.frame;
    const { cloth, glove, shoe } = pickOutfit(F.clothIx ?? 0, colors.body, hairHex);
    outfit = {
      dressed: !!F.dressed, cloth, glove, shoe,
      motif: F.dressed ? (F.motif ?? 'none') : 'none',
      ink: luma(cloth) < .45 ? '#F2ECE2' : '#2B2422',
    };
  }

  return {
    outfit,
    rx, ry, rz,
    form, exp,                 // the body's shape family, for the part
    // the body as raw numbers — the only thing HAIR needs in order to
    // grow on it, and the reason one hair generator covers both forms
    shape: { rx, ry, rz, exp, cy },
    formMesh,                  // the modeled bodies' arrays, to stamp
    // the STANCE, measured. `frame` is null for a head-only character, and
    // the frame part stamps exactly what is in here — the layout is
    // the one place the head and the torso can agree on a socket.
    stance, frame,
    hair: hairHex,
    // pulled toward ink: a platinum brow at full strength vanishes, and
    // an ink brow under blonde hair belongs to a different face
    browColor: hasHair ? mix(hairHex, INK, .38) : INK,
    // H is the HEAD's height, not the character's: the sheet normalises faces
    // by it, and a head that shrank because it grew a body would defeat
    // the point of having one. The whole character's height is in `bounds`.
    H: topY - botY, W: rx * 2,
    cy,                        // the body's centre, sitting on the floor
    s: B.r,                    // the one number every feature scales off
    eyeX, eyeY, mouthY, mouthFit,
    // what the EXTRAS have to clear. Spectacles must sit in front of a
    // ball eye, a hat on top of a big soft cut — and only the eyes and
    // the hair can know how far out they reach.
    eyeProud: eyeProud(P),
    hairTop: hasHair ? hairOuter(P) : 1,
    // a pulled-on hat is worn on a BARE head — see `hatBare`
    hatBare: bare,
    // what the EXTRAS are made of: never the character's own five, and
    // guaranteed clear of both the skin and the hair
    acc: pickAcc(P.hat?.accIx ?? 0, colors.body, hairHex),
    eyeR,                      // the unit the OTHER face parts size off
    eyeSize,                   // what the eyes themselves use
    // the midpoint by construction, so a nose can never collide with a
    // mouth however either one is dragged
    noseY: (eyeY + mouthY) / 2,
    at, top, onFace,
    ...colors,                 // body, warm, ink, sclera, maw, lite
  };
}
