// Hair is a SHELL, not a shape: it recolours the skull's own top cells
// and then adds volume above them. That is why it fits a dome, a brick
// and a wonky head without ever measuring one — it asks each column
// where its own crown is and lays hair down from there.
//
// The three numbers that make a hairstyle are how far it comes down at
// the FRONT, the SIDES and the BACK, as fractions of the head's height.
// A fringe that reaches the brow and a bob that reaches the jaw are the
// same eight lines with different fractions.

const STYLES = ['bald', 'cap', 'bob', 'mop', 'spike', 'tuft', 'long', 'mohawk', 'buns', 'bowl',
  'comb', 'curtain', 'widow', 'pigtails', 'bedhead', 'emo', 'monk'];

// front, side, back — how far down the head, as a fraction of its height
const CUT = {
  cap:    [.14, .22, .28, { vol: 0 }],
  bob:    [.26, .62, .58, { vol: 1 }],
  mop:    [.30, .40, .46, { vol: 1, jag: .22 }],
  spike:  [.16, .24, .30, { vol: 1, spike: 1 }],
  tuft:   [.02, .06, .10, { vol: 1, jag: .1 }],
  long:   [.24, .52, .48, { vol: 1, tail: 1 }],
  mohawk: [.10, .10, .16, { vol: 0, ridge: 1 }],
  buns:   [.18, .30, .34, { vol: 1, buns: 1 }],
  bowl:   [.38, .46, .44, { vol: 1 }],
  comb:     [.16, .26, .30, { vol: 1, comb: 1 }],     // swept to one side
  curtain:  [.52, .55, .30, { vol: 1, curtain: 1 }],  // long, parted middle
  widow:    [.18, .30, .34, { vol: 1, widow: 1 }],    // a point down the brow
  pigtails: [.16, .30, .36, { vol: 1, tails: 1 }],
  bedhead:  [.18, .30, .34, { vol: 1, jag: .5, spike: 1 }],
  emo:      [.20, .42, .40, { vol: 1, emo: 1 }],      // fringe over ONE eye
  monk:     [.02, .34, .38, { monk: 1 }],             // the ring, bare on top
};

export const Hair = {
  id: 'hair', label: 'hair', group: 'head',

  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [
      ['bald', 10], ['cap', 12], ['bob', 13], ['mop', 15], ['spike', 11],
      ['tuft', 11], ['long', 9], ['mohawk', 7], ['buns', 6], ['bowl', 6],
    ]),
    len: C.range(rng, 'len', .85, 1.2),
    side: rng.chance(.5) ? 1 : -1,        // which eye an emo fringe hides
    tone: C.pick(rng, 'tone', [['hair', 78], ['bone', 12], ['accent', 10]]),
  }),
  meta: () => ({
    style: { label: 'style', pick: STYLES },
    len: { label: 'length', range: [.4, 1.8] },
    tone: { label: 'colour', pick: ['hair', 'bone', 'accent'] },
  }),
  skip: P => P.style === 'bald',

  build(v, P, st, V) {
    const H = V.head, pal = V.pal;
    const c = pal[P.tone] ?? pal.hair;
    const cd = P.tone === 'hair' ? pal.hairD : c;
    const [fr, sd, bk, o] = CUT[P.style] ?? CUT.cap;

    // A HAIRLINE IS A HEIGHT, not a column top. Covering "the topmost
    // solid cell of every column" sounds like a shell and is not: on
    // the front of a round head a column is a couple of cells halfway
    // down the face, so that rule lays hair across the cheeks. Cover
    // by absolute y and the three fractions become an actual haircut.
    for (let x = H.x0 - 1; x <= H.x1 + 1; x++) {
      for (let z = H.z0 - 1; z <= H.z1 + 1; z++) {
        if (o.ridge && Math.abs(x) > 1) continue;
        const f = (z - H.cz) / (H.d + .5);
        let frac = f > .35 ? fr : f < -.35 ? bk : sd;
        // a jagged lower edge is what separates a mop from a helmet
        if (o.jag) frac += (v.h01(x, 0, z, 3) - .5) * o.jag;
        if (o.comb) frac += x > 1 ? .11 : x < -1 ? -.09 : 0;
        if (o.curtain && f > .35 && Math.abs(x) <= 2) frac = .05;
        if (o.widow && f > .35) frac += Math.abs(x) <= 1 ? .17 : 0;
        // the emo fringe drops over one whole eye — the eye part owns
        // its own cells, so the eye pokes THROUGH the fringe, which is
        // somehow more emo than covering it
        const emoSide = o.emo && f > .35 && x * P.side > 1;
        if (emoSide) frac = .55;
        if (o.monk && Math.abs(x) < H.w * .6 && (z - H.cz) > -H.d * .4 && f > -.6) continue;
        let limit = Math.round(H.y1 - H.h * frac * P.len);
        // and never past the brow — a fringe in the eyes reads as a
        // bug, and the eye owns that plate anyway
        if (f > .1) limit = Math.max(limit, emoSide ? V.eyeY - 1 : V.eyeY + 2);
        const top = V.crownY(x, z);
        if (top === null || top < limit) continue;
        for (let y = limit; y <= top; y++)
          if (v.taken(x, y, z)) v.set(x, y, z, y === limit ? cd : c);
        // volume: one course of hair standing above the crown
        if (o.vol && top >= H.y1 - 1) v.set(x, top + 1, z, c);
        if (o.spike && v.h01(x, 1, z, 5) < .32 && top >= H.y1 - 1)
          v.set(x, top + 2, z, c);
      }
    }

    if (o.ridge) {
      for (let z = H.cz - H.d; z <= H.cz + Math.round(H.d * .6); z++) {
        const ty = V.crownY(0, z);
        if (ty === null) continue;
        const hh = Math.round(H.h * .3 * P.len * (1 - Math.abs(z - H.cz) / (H.d + 1) * .5));
        for (let y = ty + 1; y <= ty + Math.max(1, hh); y++) v.set(0, y, z, c);
      }
    }

    if (o.buns) v.sym(() => {
      const x = H.w, y = H.y0 + Math.round(H.h * .82);
      const r = Math.max(1.6, H.w * .42);
      v.blob(x + 1, y, H.cz - 1, r, r, r, c, 2.4);
    });

    // pigtails hang off the sides and taper, like handles
    if (o.tails) v.sym(() => {
      const y = H.y0 + Math.round(H.h * .8);
      const x = (V.edgeX(y, H.cz) ?? H.w) + 1;
      v.stroke([x, y, H.cz], [x + 2, y - H.h * .55 * P.len, H.cz], 1.5, .7, c);
    });

    // a mass down the back, below the head, where the shoulders are
    if (o.tail) {
      const len = Math.round(H.h * .7 * P.len);
      for (let x = H.x0 + 1; x <= H.x1 - 1; x++)
        for (let y = H.y0 - len; y < H.y0; y++) {
          const w = 1 - (H.y0 - y) / (len + 1);
          if (Math.abs(x) > Math.round(H.w * (.5 + w * .5))) continue;
          v.set(x, y, H.z0 + (v.h01(x, y, 0, 9) < .3 ? 1 : 0), y % 2 ? c : cd);
        }
    }
  },
};
