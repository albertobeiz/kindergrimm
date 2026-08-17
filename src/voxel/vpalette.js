// ---------------------------------------------------------------
// THE MATERIAL — what the solid is MADE of.
//
// This is `media.js`'s job in the voxel world. A part never writes a
// hex colour: it asks for `V.pal.skin`, `V.pal.cloth`, `V.pal.void`,
// and the palette decides what those mean. Swap the palette and the
// whole catalogue changes material at once — which is the only reason
// a hundred parts can agree on a look.
//
// A palette is a FAMILY, not a fixed set: `make(rng)` rolls one
// character's colours out of it, so two graphite kids are two
// different greys. The keys are the contract; the values are not.
//
//   skin / skinD / skinL   the body. D is a shade, L a highlight.
//   line                   a drawn line: a lid, a mouth, a seam
//   void                   the black of an eye. Cute-dark register:
//                          this is nearly always nearly black.
//   sclera                 what a void sits in, when the eye has one
//   cloth / clothD         clothing
//   hair / hairD           hair, fur, a mane
//   bone                   horn, antler, tooth, claw
//   accent                 the one loud colour: a scarf, a bow, a nose
//   blush                  warm cheeks — quiet, or it reads as war paint
//   glint                  the highlight tick in an eye or on metal
//
// TO ADD A PALETTE: one entry below. It shows up in the editor and in
// the recipe automatically.
// ---------------------------------------------------------------

const hsl = (h, s, l) => {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
};

export const PALETTES = {
  // the house style, ported: graphite on cream. Nothing here has a
  // hue worth naming — it is all value, which is what a pencil has.
  graphite: {
    id: 'graphite', label: 'graphite',
    make(rng) {
      const h = rng.r(28, 44), l = rng.r(.56, .74);
      return {
        skin: hsl(h, .10, l), skinD: hsl(h, .12, l - .13), skinL: hsl(h, .07, l + .10),
        line: hsl(h, .10, .17), void: hsl(h, .14, .09),
        sclera: hsl(h, .06, .92),
        cloth: hsl(h + rng.r(-14, 14), .09, rng.r(.30, .46)), clothD: hsl(h, .10, .24),
        hair: hsl(h - 4, .13, rng.r(.20, .34)), hairD: hsl(h - 4, .14, .15),
        bone: hsl(h + 6, .10, .87), accent: hsl(h - 16, .30, .44), blush: hsl(12, .20, l - .10),
        glint: hsl(h, .05, .97),
      };
    },
  },

  // wax on sugar paper: a doodle done in the box of twelve
  crayon: {
    id: 'crayon', label: 'crayon',
    make(rng) {
      const h = rng.pick([18, 34, 52, 96, 176, 208, 262, 332]);
      const sh = rng.r(22, 40);
      return {
        skin: hsl(sh, .42, rng.r(.66, .80)), skinD: hsl(sh, .44, .54), skinL: hsl(sh, .34, .88),
        line: hsl(sh - 8, .38, .20), void: hsl(sh, .30, .10),
        sclera: hsl(54, .30, .94),
        cloth: hsl(h, .52, rng.r(.44, .58)), clothD: hsl(h, .54, .32),
        hair: hsl(h + 180, .40, rng.r(.26, .42)), hairD: hsl(h + 180, .44, .18),
        bone: hsl(48, .28, .88), accent: hsl(h + 140, .58, .52), blush: hsl(4, .52, .70),
        glint: hsl(52, .40, .96),
      };
    },
  },

  // fired earth: everything is the same clay, only more or less burnt
  clay: {
    id: 'clay', label: 'clay',
    make(rng) {
      const h = rng.r(12, 30);
      return {
        skin: hsl(h, .34, rng.r(.58, .70)), skinD: hsl(h - 4, .38, .44), skinL: hsl(h + 6, .28, .80),
        line: hsl(h - 6, .34, .19), void: hsl(h - 8, .30, .10),
        sclera: hsl(h + 22, .22, .90),
        cloth: hsl(h + rng.r(-10, 26), .26, rng.r(.36, .50)), clothD: hsl(h, .28, .26),
        hair: hsl(h - 6, .32, rng.r(.22, .34)), hairD: hsl(h - 8, .34, .14),
        bone: hsl(h + 26, .20, .84), accent: hsl(h + 168, .26, .42), blush: hsl(6, .42, .60),
        glint: hsl(h + 30, .18, .94),
      };
    },
  },

  // cut out of the dark, with one cold thing looking at you. The
  // nightmare's material — and it is the whole reason `void` is a
  // palette key and not a constant.
  gloom: {
    id: 'gloom', label: 'gloom',
    make(rng) {
      const h = rng.r(200, 260);
      return {
        skin: hsl(h, .16, rng.r(.16, .26)), skinD: hsl(h, .20, .11), skinL: hsl(h, .12, .36),
        // THE EYE INVERTS. Everything else in this palette is cut out
        // of the dark, so a black void on near-black skin is a face
        // you cannot see — here the hole is what the light comes out
        // of, and the white of the eye is the darkest thing on it.
        line: hsl(h - 10, .18, .58), void: hsl(h - 34, .52, .82),
        sclera: hsl(h, .30, .10),
        cloth: hsl(h + rng.r(-30, 30), .18, rng.r(.13, .22)), clothD: hsl(h, .22, .08),
        hair: hsl(h, .14, .12), hairD: hsl(h, .18, .07),
        bone: hsl(h + 40, .10, .72), accent: hsl(rng.pick([352, 12, 158]), .44, .40), blush: hsl(350, .34, .30),
        glint: hsl(h - 20, .30, .86),
      };
    },
  },

  // pastel, and the eyes still black. The register does not soften
  // just because the colours did.
  candy: {
    id: 'candy', label: 'candy',
    make(rng) {
      const h = rng.r(0, 360);
      return {
        skin: hsl(h, .44, rng.r(.76, .86)), skinD: hsl(h - 6, .40, .62), skinL: hsl(h, .34, .93),
        line: hsl(h + 10, .28, .26), void: hsl(h, .22, .11),
        sclera: 0xfdf7ef,
        cloth: hsl(h + 120, .48, rng.r(.62, .76)), clothD: hsl(h + 120, .44, .48),
        hair: hsl(h + 220, .42, rng.r(.44, .62)), hairD: hsl(h + 220, .44, .32),
        bone: 0xfaf3e2, accent: hsl(h + 40, .62, .62), blush: hsl(348, .58, .78),
        glint: 0xffffff,
      };
    },
  },
};

export const PALETTE_IDS = Object.keys(PALETTES);

export function paletteFor(id, rng) {
  const p = PALETTES[id] ?? PALETTES.graphite;
  return { id: p.id, ...p.make(rng) };
}
