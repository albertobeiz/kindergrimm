# Working on drawai

**Read `ARCHITECTURE.md` first.** It defines the part contract, the two
coordinate systems and the rules that keep everything looking like one
drawing. Most tasks here are "add a part type" or "add a variant", and
that document is written to make those mechanical.

## Run it

```bash
python3 serve.py
```

`index.html` is the **menu** and the only place the scenes are linked
from — a scene never links to another, only back to the menu.
`game.html` is the Kindergrimm room (the game), `editor.html` is the
face editor, `crowd.html` a 7×5 page of live characters, `items.html`
the object contact sheet. `serve.py` sends `no-store` on purpose:
browsers cache ES modules by URL, and a stale module makes an edited
file look like a phantom `SyntaxError`.

## The short rules

- Adding a part = one file in `src/parts/` + one line in
  `src/parts/index.js`. Do not edit `rig.js` for this.
- Adding a **species** = one entry of weights in `src/species.js`.
  A species loads the dice at generation time; it never reaches into
  `draw()`.
- But weights alone give you *a kid in a costume*. A species that
  needs a different HEAD gets a skull param the profile sets (see
  `muzzle`), and a species that needs a shape nobody else could have
  gets its own part with `species: ['nightmare']`. Prefer the cheaper
  lever: a snout is a param, wings are a part.
- Draw through `F.media.tone / skin / edge`. Never call `pencilFill`,
  `washFill`, `oilFill` etc. from a part.
- Size from `F.s`, `F.w`, `F.B.*`. No raw pixel constants.
- `bones()` and `size()` are in world units (`px / U`); `draw()` is in
  pixels with y down and the origin at the head's centre.
- Choices that must hold still go in `gen()`. Randomness used inside
  `draw()` is re-rolled every redraw — that is the line boil, and it
  will shimmer.
- Anything two parts must agree on belongs in `src/layout.js`.
- `game.html` (Kindergrimm) is the only **3D** scene: floor on XZ,
  orbiting ortho camera, yaw-only billboards. It does NOT use
  `addPaper()` — those are camera-facing quads and would go edge-on.
  See ARCHITECTURE.md §6b before touching it. The editor and the
  crowd are still flat pages and must stay working.
- Adding an **object** = one file in `src/items/` + one line in
  `src/items/index.js`. **The stats ARE the drawing**: the same rolled
  params feed `draw()` and `statsOf()`, so a long blade is drawn long
  AND reaches further. Never add a stat you cannot see; never draw a
  feature that means nothing.
- A `floor` family must also declare `kind: 'light' | 'toy' | 'bed'`.
  The draft deals a fixed HAND — one of each of those three, plus
  three carried — so a floor family without a `kind` is never dealt.
- An item is authored ONCE, in `REF` space with the origin at its
  anchor, and `stamp()` puts it on the card, on the floor and in a
  child's fist. Scale through `ctx.scale`, never by multiplying your
  own numbers — `Sketch` decides granulation and resampling in user
  units, so hand-scaling silently gives you a different item.
- Close every item shape through `finish()`, never `paperFill`/
  `stroke` directly. That is what `F.media.*` is for parts: it owns
  the four ranks, so rarity stays legible across the catalogue.
- An item's `draw()` must be **deterministic from `P`**. It is baked
  once as a floor prop but re-drawn every boil frame on a child, so
  anything rolled with `s.jr()` shimmers. Roll it in `gen()`.
- Adding a **pose** = one file in `src/poses/` + one line in
  `src/poses/index.js`; handle all three bases (biped/sit/quad).
  Adding an **expression** = one entry in `src/expressions.js`,
  plus a state branch in a face part if it needs a new drawing.
  Poses/expressions write OFFSETS scaled by their blend weight —
  never absolute transforms — that is what makes transitions smooth.

## Style

The look is graphite on cream paper, ported from the technique in
kengocodes/cyber-crowd: wobbling ribbon strokes, dry granulation, wrist
overshoots, and fills that are real techniques rather than flat colour.
The register is doodle/cartoon-dark — cute creatures with black void
eyes, ears and horns — after Fran Ferriz and The Binding of Isaac.
Keep the hand; vary the forms.

## Verifying

**The playtesting is Alberto's.** Don't try to play the game to judge
a change: it is too stateful for that — a dark room, long clocks,
orders that only pay off minutes later, and a feel that a screenshot
cannot carry. Build the thing, hand it over, and say what you did and
did not check.

What is worth doing yourself is the cheap, decidable half:

- load every page (`index.html`, `editor.html`, `crowd.html`,
  `game.html`, `items.html`) and confirm the console is clean — a
  stale import or a renamed export is a real bug and takes one reload
  to find;
- assert on **numbers**, not vibes, through `window.__game`: drain
  rates, the shape of a draft hand, where the camera target lands;
- check layout in both the desktop and the phone widths.

Screenshots in a background browser panel can be misleading: the
browser throttles `requestAnimationFrame` when the page is not
visible, so a scene can look frozen or slow when it is fine. Measure
before concluding anything about performance (a character costs ~20ms
to build).
