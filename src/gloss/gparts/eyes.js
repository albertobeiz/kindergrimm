// THE EYES — the part that decides what the toy IS. Every style is one
// plate per side — plus a border, a pupil and a lid on the white-eyed
// ones — and every one of them lands through `L.at`, so none of them
// know what shape they are sitting on.
//
// There WAS a third plate: a rim, the same outline a size larger in a
// darker body tone, standing in for the carved socket of the reference.
// It was removed. Against saturated vinyl a .74 shade reads as shadow,
// but these palettes are pale and low-contrast, so it came out as a
// second COLOUR rather than a darker one — and with no concavity behind
// it there was no cue saying "recess" either. It read as two stacked
// shapes, because that is what it was. If the carved look is wanted
// back it has to be real geometry: depth in the rim and the ink sunk
// into it, not a colour standing in for a shadow.

// outline + the numbers that outline reads.
//   `shut`   already a closed lid, so the blink leaves it alone
//   `sclera` a WHITE eye with a dark pupil laid on it — two plates,
//            and the pupil is the one thing on this toy that moves
//            independently of the face it is on
const STYLE = {
  bead:     { outline: 'ellipse', wf: .62, hf: .62 },
  oval:     { outline: 'ellipse', wf: .78, hf: 1.15 },
  round:    { outline: 'ellipse', wf: 1, hf: 1 },
  sparkle:  { outline: 'sparkle', wf: 1.14, hf: 1.28, pinch: .22 },
  star:     { outline: 'star', wf: 1.2, hf: 1.2 },
  heart:    { outline: 'heart', wf: 1, hf: 1 },
  ring:     { outline: 'ring', wf: 1.05, hf: 1.05, thick: .36 },
  cross:    { outline: 'cross', wf: 1.1, hf: 1.1 },
  sleepy:   { outline: 'band', wf: 1.15, hf: .16, curve: 'arc', sag: -.14, shut: true },
  happy:    { outline: 'band', wf: 1.15, hf: .16, curve: 'arc', sag: .3, shut: true },
  angry:    { outline: 'ellipse', wf: .84, hf: 1, roll: .34 },

  // --- the drawn eye: a BORDER, a white, and a big pupil ---
  // The border is the doodle's ink line, and it is what the first pass
  // was missing. Note this is NOT the rim that was thrown out: that
  // was a body-coloured ring standing in for a shadow, which read as a
  // second colour. An INK line around a WHITE fill is line art, and it
  // is the thing every eye in the reference sheet has.
  pupil:    { outline: 'ellipse', wf: .92, hf: 1.14, sclera: true, pupilF: .62, border: .3 },
  // the same construction with a smaller pupil in a bigger white —
  // reads startled even when it is not looking anywhere
  googly:   { outline: 'ellipse', wf: 1.02, hf: 1.06, sclera: true, pupilF: .42, border: .26 },
  // and the square of it, for the cube heads
  box:      { outline: 'rect', wf: .74, hf: .84, r: .26, sclera: true, pupilF: .6, border: .28 },
  // BIG, and it gets away with it by growing the way a face has room
  // to grow: a tall rectangle gains all its area in height, so it can
  // be enormous without crowding the centre line the way a wide eye
  // does. Rectangular pupil to match, and because the white is so tall
  // the pupil has a long way to travel in it — this is the most
  // expressive gaze in the catalogue.
  slab:     { outline: 'rect', wf: .88, hf: 1.40, r: .3, sclera: true, border: .24,
              pupilF: .68, pupilHF: .44, pupilOutline: 'rect', pupilR: .3 },
  // a straight-sided diamond: the sparkle's own family, walked out to
  // pinch .5 where the quadratic control lands on the chord
  diamond:  { outline: 'sparkle', wf: .92, hf: 1.18, pinch: .5 },
  square:   { outline: 'rect', wf: .66, hf: .7, r: .28 },

  // --- the BALL eye: the one eye that is a solid, not a plate ---
  // A white sphere standing proud of the head, an ink bead sunk into
  // its front, and a hemisphere CAP in the body colour lying over the
  // top half — the Rabbid / Muppet construction. The cap is centred on
  // the ball, so the blink is a rotation: it ROLLS forward over the
  // eyeball instead of sliding down a face (`lidRoll`, in gface.js).
  // A SPHERE by decree. An ellipsoid lid cannot
  // roll: turned 120° its short axis faces where the ball's long axis
  // is, and the pupil punches through the shell. Sphere on sphere can
  // never misalign, and the ball being a ball IS the style anyway.
  orb:      { orb: true, wf: 1.02, hf: 1.02 },
  flower:   { outline: 'flower', wf: 1.06, hf: 1.06, petals: 5, amp: .3 },
  crescent: { outline: 'crescent', wf: .82, hf: 1.12, bite: .55 },
  wobble:   { outline: 'wobble', wf: .9, hf: 1 },
  spiral:   { outline: 'band', wf: 1, hf: .13, curve: 'spiral' },
};

export const EYE_STYLES = Object.keys(STYLE);

/**
 * How far an eye reaches from its own centre, in units of `L.eyeSize`.
 *
 * The LAYOUT needs this: it is what stops a mouth being placed inside
 * a tall eye, and only this file knows how tall a style is. A pure
 * function of the recipe, so the layout can ask before anything is
 * built. Border included — it is part of the drawn shape.
 */
// The eye's extent has to cover EVERYTHING the part emits, not just
// the eye shape. A roll counts: a tilted rectangle is wider than its
// own width.
function extent(P, alongY) {
  const st = STYLE[P.eyes.style] ?? STYLE.oval;
  const hf = st.hf;
  const bt = st.sclera ? Math.min(st.wf, hf) * st.border : 0;
  const a = (alongY ? hf : st.wf) + bt;      // the axis we want
  const b = (alongY ? st.wf : hf) + bt;      // and the one that rolls into it
  const rl = Math.abs(st.roll ?? 0);
  return a * Math.cos(rl) + b * Math.sin(rl);
}

/**
 * How far an eye reaches from its own centre, in units of `L.eyeSize`.
 *
 * The LAYOUT needs this: it is what stops a mouth being placed inside
 * a tall eye, and only this file knows how tall a style is. A pure
 * function of the recipe, so the layout can ask before anything is
 * built. The border is included — it is part of the drawn shape.
 */
export function eyeReach(P) { return extent(P, true); }

/** the same, sideways: half-width in units of `L.eyeSize`. The layout
 *  uses it to keep an eye on the head and out of its partner. */
export function eyeSpan(P) { return extent(P, false); }

/**
 * How far the eye's FRONT stands off the skin, in units of `L.eyeSize`.
 *
 * Spectacles need it and only this file can know it: an `orb` is a ball
 * standing most of its own radius proud, so a lens placed for a flat
 * plate cuts straight through the eyeball. Same edge as `eyeReach` —
 * the eyes publish a fact about themselves rather than the other part
 * reading their style table.
 */
export function eyeProud(P) {
  const st = STYLE[P.eyes.style] ?? STYLE.oval;
  // the ball sits centred .32 of its radius INTO the head, so its front
  // crest is .68 of a radius out; the pupil adds a little on top
  if (st.orb) return st.wf * .74;
  return (P.eyes.proud ?? .2) + .12;      // plate front, plus its pupil
}

export const Eyes = {
  id: 'eyes', label: 'eyes', order: 1,

  // Weighted, not uniform: eleven styles dealt evenly gives a sheet
  // where a third of the toys have hearts or stars for eyes, and the
  // odd ones stop being odd. The plain shapes carry the line and the
  // rest are the exceptions.
  gen: (rng, C) => ({
    // reweighted against the Ferriz sheet: it is carried by tiny wide
    // beads, white-and-pupil eyes and lidded ones — sparkles are OUR
    // habit, not his, and they drop to a treat
    style: C.pick(rng, 'style', [['pupil', 17], ['bead', 15], ['slab', 9], ['box', 8],
                      ['googly', 8], ['oval', 8], ['sleepy', 6], ['happy', 6],
                      ['cross', 5], ['round', 4], ['sparkle', 3], ['orb', 3],
                      ['square', 2],
                      ['diamond', 2], ['crescent', 1], ['star', 1], ['ring', 1],
                      ['heart', 1], ['flower', 1], ['angry', 1], ['spiral', 1],
                      ['wobble', 1]]),
    // WHERE THE PUPIL PARKS in its white: +1 is jammed against the top
    // of the eye, −1 against the bottom, 0 dead centre. A pupil resting
    // at the top reads alert and a little unhinged; at the bottom it
    // reads sleepy or sly. Centred is the least interesting of the
    // three, which is why it is not the default.
    pupilY: rng.wpick([[.78, 26], [-.72, 20], [0, 24], [.45, 16], [-.4, 14]]),
    // a heavy lid over the top of the eye, and it comes DOWN when the
    // toy blinks. Only the white-and-pupil eyes read it — a lid on a
    // solid black shape is just a thicker black shape.
    lid: C.chance(rng, 'lid', .4),
    // a wink is not a twelfth style, it is any style with one lid down
    wink: C.chance(rng, 'wink', .08),
    // The face lives in the UPPER half — that empty sweep of body under
    // the mouth is most of what makes the reference read as a toy
    // rather than a smiley. And these ranges are WIDE on purpose:
    // tiny-eyed and saucer-eyed are the same generator.
    // WIDE-SET and not huge. Two big eyes crowding the centre line is
    // the single thing that makes these read as emoji instead of as
    // toys — the reference sets them far enough apart that there is
    // face between them.
    x: C.range(rng, 'x', .46, .68),       // face coordinate, out from the middle
    y: C.range(rng, 'y', .08, .3),
    // BIG. The features fill a Ferriz head — small features huddled in
    // the middle of a big empty ball was the single loudest difference
    // on the first sheet. Everything else sizes off the eyes, so this
    // is also what makes the mouths and muzzles read.
    // The FLOOR is what matters here, not the ceiling: everything else
    // on the face sizes off this, so a low roll shrinks the whole face
    // to a stamp in the middle of a big blank head. At .14 there were
    // several a sheet.
    size: C.range(rng, 'size', .142, .182),  // × body radius
    proud: rng.r(.1, .3),     // × eye size
  }),

  meta: () => ({
    style: { label: 'style', pick: EYE_STYLES },
    wink: { label: 'wink', bool: true },
    x: { label: 'apart', range: [.1, .8] },
    y: { label: 'height', range: [-.4, .6] },
    size: { label: 'size', range: [.05, .26] },
    proud: { label: 'relief', range: [0, .7] },
    pupilY: { label: 'pupil parks', range: [-1, 1] },
    lid: { label: 'eyelid', bool: true },
  }),

  build(add, P, L) {
    const E = P.eyes;
    // `eyeSize`, not `eyeR`: the layout publishes the eyes' own radius
    // (bigger on a cube, whose flat face has room a sphere's curvature
    // never gives) separately from the unit the nose, mouth and blush
    // size off. It has to live there and not here — the layout uses the
    // same number to keep the mouth out from under a tall eye.
    const r = L.eyeSize;

    for (const [id, side] of [['eyeL', -1], ['eyeR', 1]]) {
      // the winking side gets a closed lid whatever the style is
      const shut = E.wink && side > 0;
      const st = shut ? STYLE.happy : STYLE[E.style];
      const a = L.onFace(side * L.eyeX, L.eyeY);
      // AN EYE'S ASPECT IS THE STYLE'S, FULL STOP. There WAS a rolled
      // `tall` that stretched the height on top of the style's own
      // proportions, and it is gone: a round eye came out an egg, a
      // slab came out a bar, and on the rectangles — whose corner
      // radius is a fraction of the SHORTER half-extent — a bar rounded
      // its ends into a capsule and stopped being the shape it named. A
      // clamp on the stretch only bounded the damage. The size varies,
      // the aspect does not, so `round` is round on every toy.
      const w = r * st.wf;
      const h = r * st.hf;
      const d = r * .34;

      // THE BALL EYE takes its own road: three solids, no plates.
      if (st.orb) {
        const R = w;                 // the ball's radius across
        // sunk a third in, like the button nose: a bump on the face,
        // not a bead balanced on it
        const ballProud = -R * .32;
        // the whole ball barely stirs — the thing inside it moves
        const ride = [R * .06, R * .05];
        // `shut: true` on the ball and the bead: the blink must not
        // squash them — a deflating eyeball is horrible — the cap
        // closing over them IS the blink.
        add({ type: 'solid', id, rx: R, ry: R, rz: R,
              p: a.p, n: a.n, proud: ballProud, color: L.sclera,
              travel: ride, shut: true });

        // the ink bead, sunk into the ball's front so it can never
        // float — the same trick as `dab` in the voxel hand. Sunk
        // DEEP: its crown must stay inside the lid's shell, or a shut
        // lid has a black dot punching through it.
        const pr = R * .36;
        const park = (R - pr) * .4 * E.pupilY;
        add({ type: 'solid', id: id + 'Pupil', rx: pr, ry: pr, rz: pr,
              p: a.p, n: a.n, proud: ballProud + R - pr * .7,
              color: L.ink, offset: [0, park], anchorY: park,
              travel: [(R - pr) * .5, (R - pr) * .4 * (1 - Math.abs(E.pupilY))],
              shut: true });

        // the CAP: a hemisphere-and-a-bit in the body colour, CENTRED
        // ON THE BALL — its own p, proud 0 — so its rim hugs the ball
        // all the way round and the blink can pivot it about the
        // ball's centre. Its axis is NOT the eye's surface normal:
        // that normal tips up with the face, which parks the cap over
        // the whole front. The lid brings its own basis, tipped BACK,
        // so at rest only its front rim shows — a heavy lid over the
        // top third — and the pupil has the rest of the ball to live
        // on. The roll budget is what carries it from there to shut.
        const ballC = [a.p[0] + a.n[0] * ballProud,
                       a.p[1] + a.n[1] * ballProud,
                       a.p[2] + a.n[2] * ballProud];
        add({ type: 'solid', id: id + 'Lid', dome: .56,
              rx: R * 1.16, ry: R * 1.16, rz: R * 1.16,
              p: ballC, n: [a.n[0] * .35, .95, .85],
              color: L.body, travel: ride, lidRoll: 2.2 });
        continue;
      }

      const roll = (st.roll ?? 0) * side;
      const base = { type: 'plate', p: a.p, n: a.n, roll,
                     pinch: st.pinch, thick: st.thick,
                     // The outline wants a corner radius in WORLD units,
                     // and a style states it as a fraction — of the
                     // SHORTER half-extent, which is the only one that
                     // means anything on a tall rectangle. As a fraction
                     // of height it would round a slab's corners past
                     // its own width and silently give back a capsule.
                     r: st.r == null ? undefined : Math.min(w, h) * st.r,
                     petals: st.petals, amp: st.amp, bite: st.bite,
                     curve: st.curve, sag: st.sag == null ? undefined : st.sag * r };
      const isBand = st.outline === 'band';

      const proud = r * E.proud;
      // the white barely shifts — an eyeball does not slide around a
      // face, the thing inside it does
      const ride = st.sclera ? [w * .1, h * .08] : null;

      // There WAS a PATCH here — a field of another pour behind each
      // eye, the panda's black oval. Removed: on a face this size it
      // read as a second thing stuck on the head rather than as part
      // of the eye, and it was the one feature that regularly slid off
      // the silhouette because it was twice the eye across.

      // THE BORDER: the same outline a size larger in ink, sitting a
      // hair further back, so what shows around the white is a drawn
      // line rather than a gap.
      if (st.sclera) {
        // ONE thickness on every side. Grown as a percentage per axis
        // instead, a tall eye gets a heavy brow-line and hairline
        // sides — a drawn outline is a stroke of constant width.
        const bt = Math.min(w, h) * st.border;
        const bw = w + bt, bh = h + bt;
        add({ ...base, id: id + 'Border', outline: st.outline, w: bw, h: bh,
              r: st.r == null ? undefined : Math.min(bw, bh) * st.r,
              d: d * .8, bevel: Math.min(d * .34, bt * .8),
              proud: proud - d * .16, color: L.ink, travel: ride });
      }

      add({ ...base, id, outline: st.outline, w, h,
            tube: isBand ? h : undefined,
            d, bevel: Math.min(d * .6, h * .45),
            proud, color: st.sclera ? L.sclera : L.ink,
            travel: ride,
            shut: !!(st.shut || shut) });

      // THE PUPIL, and it is the only part of this toy that moves
      // relative to the face it is on. It carries its own travel
      // budget — how far it may slide before it would leave the white
      // — so `gface.js` can drive it without knowing an eye's shape.
      if (st.sclera && !shut) {
        // A style may set the pupil's height independently of its
        // width: on a tall eye a pupil scaled by one factor fills the
        // whole white and has nowhere left to look.
        const pw = w * st.pupilF, ph = h * (st.pupilHF ?? st.pupilF * .96);
        // the room the pupil has to move in, and where in that room it
        // rests. Whatever it parks against, it keeps the REST of the
        // room to look around in — so a pupil already at the top does
        // not get to travel further up and slide out of its own eye.
        const roomY = h - ph;
        const park = roomY * E.pupilY;
        add({ type: 'plate', id: id + 'Pupil',
              outline: st.pupilOutline ?? 'ellipse',
              r: st.pupilR == null ? undefined : Math.min(pw, ph) * st.pupilR,
              p: a.p, n: a.n,
              w: pw, h: ph, d: d * .55, bevel: d * .26,
              proud: proud + d * .3, color: L.ink,
              offset: [0, park], anchorY: park,
              travel: [(w - pw) * .74, roomY * (1 - Math.abs(E.pupilY)) * .85] });

        // THE LID: a heavy stroke lying over the top of the eye, and
        // it slides down as the toy blinks. It is the clearest thing
        // the separate-mesh face buys — a lid closing over a pupil
        // costs one translate and no geometry at all.
        if (E.lid) {
          add({ type: 'plate', id: id + 'Lid', outline: 'band',
                curve: 'arc', sag: -h * .34, tube: h * .3, h: h * .3,
                p: a.p, n: a.n, w: w * 1.04,
                d: d * .9, bevel: d * .3,
                proud: proud + d * .42, color: L.ink,
                offset: [0, h * .82], travel: ride, lidDrop: h * 1.05 });
        }
      }

      // There was a painted catchlight here — a small white dot on the
      // upper left of every dark eye. It is gone. The clearcoat already
      // puts a real highlight on these, and a painted one sat on top of
      // it as a second, flatter dot that did not move with the light.
      // Gloss is the studio's job; do not draw it on.
    }
  },
};
