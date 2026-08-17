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
from — a scene never links to another, only back to the menu. There are
TWO games and they get the SAME card on it: same size, same dark ink,
same weight. The menu is not allowed to say which one is the real one.
`orla.html` is **the class photo**, scored like a poker
hand — pick five of ten children. The five in the photo LEAVE FOR
GOOD and five strangers replace them, so the shelf is always half
faces you have weighed up and half new ones; an object is drafted
after every photo. A persistent class with veteran bonuses was tried
and removed — a bonus that grows on use makes picking the same five
optimal, and it did. It is a FLAT page like the editor and the crowd, and its whole
rule set is one file (`src/orla.js`). `game.html` is **Kindergrimm**:
an endless dark floor, one verb (tap where the class walks), children
who stop to fight whatever they can SEE, and a lamp that competes with
a weapon for the same hand. Its rules are in ARCHITECTURE.md §6b and
they are not the ones an older version of this file described — no
beds, no toys, no play, and light no longer slows anything.
`editor.html` is the face editor,
`crowd.html` a 7×5 page of live characters, `items.html`
the object contact sheet. `voxel.html` is the **voxel lab** — the same
recipe idea built out of cubes instead of graphite, with its own hand,
layout, parts and animator under `src/voxel/`; it shares nothing with
the drawn generator but `rng.js`, and ARCHITECTURE.md §11 is its
contract. `voxelcrowd.html` is the voxel crowd: twenty of them on a
midnight platform, the ONE scene in the project with real (moving,
shadow-casting) lights, and characters that assemble voxel by voxel
via `setDrawRange` — its rules are at the end of §11. `serve.py` sends `no-store` on purpose:
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
- In `game.html` the one rule that everything else hangs off is
  **light is sight, and nothing else**. It does not slow a nightmare,
  it does not shelter a child, and standing in it is free — but a
  child cannot fight what it cannot see. Give light a second job and
  the lamp-or-weapon choice in the `held` slot collapses, which is the
  only decision the game has.
- Adding an **object** = one file in `src/items/` + one line in
  `src/items/index.js`. **The stats ARE the drawing**: the same rolled
  params feed `draw()` and `statsOf()`, so a long blade is drawn long
  AND reaches further. Never add a stat you cannot see; never draw a
  feature that means nothing.
- The draft deals a fixed HAND: **one lamp and four kit**, and every
  card is something a child CARRIES. The light group is
  `kind: 'light'` minus `floor`, so it only ever deals the held
  `Lamp`; the kit group takes everything else that is not `floor`.
  Floor lanterns are not dealt — `placeLantern()` scatters them in the
  dark for you to walk into. `Toy` and `Bed` still exist and are still
  on `items.html`, but nothing deals them any more.
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
- **Keep a game small.** A 2500-line turn-based build was thrown away
  for being too complex; `src/orla.js` is the shape to copy — one
  file, one screen, one verb, a rule you can say in a sentence. If an
  idea needs a second subsystem, say what it would cost and wait.
  And the test for any new game here: would it be as good with
  coloured squares? Then it is the wrong game for this engine.
- In `orla.html` the scoring vocabulary may only name things you can
  SEE. Two traps are already written down in `src/orla.js`: gear is
  `base:['biped']`, so "carries something" secretly means "is not a
  dog or a cat"; and a dog is 84% floppy-eared, so "floppy ears"
  secretly means "is a dog". Check any new predicate against
  `species.js` before adding it.
- The voxel lab is a **parallel** generator, not a port. Adding a part
  = one file in `src/voxel/vparts/` + one line in
  `src/voxel/vparts/index.js`; a species = one entry in `vspecies.js`;
  a palette = one entry in `vpalette.js`. Its two rules are: **build
  order is ownership** (every cell belongs to the LAST part that wrote
  it, so nothing is drawn twice), and **the plate rule** — every state
  of a part fills the same cells and only the colours change, which is
  what makes a blink a visibility swap. `__voxel.audit()` checks the
  second one and it is worth running after touching an animated part.
- A voxel part places cells through the hand in `carve.js` and never
  touches three.js. `dab` only lands on what an earlier part already
  filled — anything that lives on a surface (a spot, an eye, a sock)
  is dabbed, so it can never float. Colours come from `V.pal.*`, never
  a hex literal: that is what `media.js` is to the drawn parts.
- The voxel head's shape lives in `vlayout.js` (`V.contains`,
  `V.frontZ`, `V.crownY`), not in the Skull part, because the whole
  face is painted onto it. Same reason as the muzzle in the drawn rig:
  publish where the thing landed and the parts that sit on it never
  learn how it got there.
- Adding a **pose** = one file in `src/poses/` + one line in
  `src/poses/index.js`; handle all three bases (biped/sit/quad).
  Adding an **expression** = one entry in `src/expressions.js`,
  plus a state branch in a face part if it needs a new drawing.
  Poses/expressions write OFFSETS scaled by their blend weight —
  never absolute transforms — that is what makes transitions smooth.

## Language

**Everything is in English** — every page, every menu, every button,
every generated rule, every parameter label in the editor, and the code
itself (ids, keys, function names, comments). The project was half
Spanish and is not any more; a new Spanish string is a bug. `lang="en"`
on every page.

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
- assert on **numbers**, not vibes, through `window.__game` /
  `window.__orla`: drain rates, the shape of a draft hand, where the
  camera target lands;
- **balance is measurable here, so measure it.** A recipe is cheap —
  no canvas is touched until a character is built — so thousands of
  scoring passes can be run in the console against the real code.
  That is how `TARGETS` in `src/orla.js` was set, and a guessed
  number in its place was out by a factor of five;
- check layout in both the desktop and the phone widths.

Screenshots in a background browser panel can be misleading: the
browser throttles `requestAnimationFrame` when the page is not
visible, so a scene can look frozen or slow when it is fine. Measure
before concluding anything about performance (a character costs ~20ms
to build). Give a new scene a named `frame()` and an async
`pump(n)` on its debug object (see `src/orla.js`) — it is the only
way to drive an animation to its end while the panel is hidden, and
it must yield between frames or the awaits never resolve.
