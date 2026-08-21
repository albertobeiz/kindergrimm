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
`marbles.html` is **Marbles**: a long sheet of ice, a tide of hundreds
walking down it toward a line, and three living marbles in your hand.
You pull one back and let go — direction and force are the ONLY things
you choose, the HOOK belongs to the marble — and it crushes what it
rolls over, bounces off the boards and the brutes, and wherever it
stops it PLANTS and fights on its own until it melts. Strike your own
marbles on the way and they fire their one big move ALONG the blow and
go sliding themselves: that is the chain and it is the only skill in
the game. Its rules are ARCHITECTURE.md §15 and its files are
`src/marbles/`. It affords hundreds of enemies for one reason: a small
enemy is not a physics body, only the marbles are. `editor.html` is the face editor,
`crowd.html` a 7×5 page of live characters, `items.html`
the object contact sheet. `how.html` is the **guide**: eleven steps
from a pencil stroke to a posed creature, and every demo on it runs
the real generator (`src/how.js` composes parts onto ONE Sketch
canvas — legal because parts draw in character coordinates — and
stands three real rigs in three small renderers), so the page cannot
drift from the code it explains. Its share card is drawn by the
generator too — `assets/og.html` is the generator, `assets/how-og.png`
the output, and the command to regenerate it is in that file's head. `voxel.html` is the **voxel lab** — the same
recipe idea built out of cubes instead of graphite, with its own hand,
layout, parts and animator under `src/voxel/`; it shares nothing with
the drawn generator but `rng.js`, and ARCHITECTURE.md §11 is its
contract. `gloss.html` is the **gloss lab** — a THIRD generator, the
same recipe idea rendered as glossy 3d chibi characters — real
characters, not figurines — instead of
graphite or cubes, with its own hand (`gshape.js`), studio, layout and
parts under `src/gloss/`; it shares nothing with the other two but
`rng.js`, and ARCHITECTURE.md §12 is its contract. It is all SOLID
geometry — an SDF version was built and thrown away, because an eye is
a thousandth of a body and resolving one meant resolving the whole
grid at eye scale. Two bodies — a sphere and a cube, which are
one superellipsoid with a squareness knob — then a catalogue of faces,
a colour from `gpalette.js` and one of the materials in `gmedia.js`. `glosscrowd.html` is its
crowd, and it is the DRAWN crowd's page, not the voxel one: a flat 7×5
grid straight on, characters hung on a wall close enough to catch their own
shadows, and the animation entirely face — gaze, blink, expressions
(see the end of §12).
`voxelcrowd.html` is the voxel crowd: twenty of them on a
midnight platform, the ONE scene in the project with real (moving,
shadow-casting) lights, and characters that assemble voxel by voxel
via `setDrawRange` — its rules are at the end of §11. `objects.html` is the **objects lab** — a FOURTH generator, plastic plants off the nursery shelf: grass, plant, tree, flower, four SHAPES of thing rather than four skins, with its own hand (`oshape.js`), studio, layout and parts under `src/obj/`; it shares nothing with the other three but `rng.js`, and ARCHITECTURE.md §13 is its contract. Species are the gardener's four — `ospecies.js` casts `blade`/`rosette`/`crown`/`sprig` foliage and four blooms, the leaves and soil read role names from `opalette.js` (a green is only ever "the leaf green of this garden"), and the layout publishes the formation the parts root on (`rootY` soil, `crownY` perch, `leaf.size` unit). Its one word of caution is the same as every lab: geometry may never roll — counts, sizes, leans and the lump seeds are `gen()`'d and placed with a positional hash, so the same JSON grows the same plant. `photo.html` is **the photo** — a SCENE, not a fifth generator: one seed composes a toy-shelf class portrait out of the gloss characters and the plants (a giant centre, mediums beside, smalls out wide, a tiny front row, trees behind, grass filling gaps, head-only floaters clustered overhead). It is the one page with a POST STACK (`vendor/postprocessing/` + `vendor/n8ao.js` for SSAO) and it dresses its own set — real floor and wall, one colour, so the AO draws the corner. Two lessons live in `src/photo.js`: N8AO gamma-corrects by default and OutputPass converts again (double-corrected, the photo went up like chalk — `gammaCorrection: false`), and a steep overhead key pools every shadow exactly where the camera cannot see it, so the photo's key stands camera-side. `serve.py` sends `no-store` on purpose:
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
  for being too complex; `src/orla.js` is the shape to copy. If an
  idea needs a second subsystem, say what it would cost and wait.
- In `marbles.html` adding a **marble** is one entry in `mkinds.js`
  and adding an **enemy** is one entry in `mfoes.js`, and both have a
  rule that decides whether the entry earns its place. A marble pins a
  gloss recipe and the recipe IS its stat block — hue says what it
  does, finish says how far it slides, form says what it weighs,
  silhouette says how it fights — and it gets exactly two behaviours,
  an idle and a burst, which must be the same idea at two sizes. An
  enemy has to be answerable by a DIFFERENT DECISION from every enemy
  already there; two that both mean "throw harder" are one enemy with
  two models.
- The numbers that hold that game up: the melt clock (a marble has
  TIME on the ice and nothing else — enemies cannot damage marbles at
  all, they walk around them; only the two thief kinds touch the clock,
  stealing seconds, and the time cards buy it back), and the crush mark
  (one crush per marble per enemy, or the damage scales with the frame
  rate). Both were found by MEASURING — `__marbles.headless(true)` plus
  an auto-player — not by playing, and the measurements are in §15.
- The third is the REFILL, and it is the difficulty knob: the run opens
  on a FULL HAND — three marbles at frame one — and a long clock, 7.5
  seconds a slot, one slot at a time. Stock up front, price behind it.
  Together with the melt clock it is the only thing setting how big the
  standing army gets (`life / REFILL`, measured at 2.8 marbles), so
  moving either moves the whole game — a 17% change to it moved run
  length by 24%. Small steps, measure both ends, table in §15.
- And the fourth is the CLASH: a full-power ram is worth about a
  QUARTER of a big enemy, so the first boss falls to four of them with
  any starting kind. Ram damage is `impact` alone — it was
  `impact * mass` and those are the same fact twice (every kind is
  authored at `impact ≈ 1.4 × mass`), which squared the weight axis and
  made the roster's spread 11.5× instead of 3.8×. If a stat multiplies
  another stat, check they are not two names for one thing.
- **Toughness is the WAVE, speed is the LEVEL** — two escalation
  clocks, and `applyPace()` is called from both. Anything computed
  from a clock has to be re-applied on that clock's tick: speed keyed
  to the level but pushed into the tide only by `beginWave` is right
  in `pressure()` and stale everywhere it matters.
- **`TEMPO` is the knob for "it feels slow"; `REFILL` and `hp` are the
  knobs for "it feels easy."** Don't reach for one when the complaint
  is the other. Turning `TEMPO` is safe because the gap is a DISTANCE
  and not a duration — speed cancels out of `population = size ×
  crossing ÷ gap`, so `ON_ICE` holds at 136 whatever the tempo and
  whatever `size` does. Expressed in seconds it drifted with both.
  And a number tuned at one tempo may not be carried over to another:
  re-measure it, don't translate it.
- **A level-up is only ever an improvement. A BOSS pays in marbles.**
  The three unlocks live in `RECRUITS`, not `BOOSTERS`, and killing a
  boss deals them — so the roster is complete by wave four whatever the
  dice say instead of being a gamble. The last one is a banner, not a
  one-card modal.
- **A boss walks on at the walk-on line with the parade, at the
  parade's speed** — it arrives with the wave's theme formation and
  lumbers only once it is in frame. Its banner fires on the SIGHTING,
  the lull ends on the sighting too (never a timer — on a timer the
  thin formations start half a minute early and silently add two blocks
  to every wave), and its death is checked in every stage, because it
  can now die before the boss stage owns it.
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
- The gloss lab is a **parallel** generator too, not a port. Adding a
  face part = one file in `src/gloss/gparts/` + one line in its
  `index.js`; a VARIANT of one = one entry in that part's `STYLE`
  table, and that is the cheap lever that should be the usual answer;
  a palette = one entry in `gpalette.js`. Prefer a style entry to a
  part, the same way a snout is a param and wings are a part.
- In the gloss lab **frequency is art direction**, so a style table is
  dealt with `rng.wpick`, never `rng.pick`. Brows are anecdotal (~12%
  have one), noses are ~25%, and the plain eye shapes carry the line
  so the odd ones stay odd. A uniform pick over eleven eye styles
  gives a sheet that is a third hearts and stars.
- The objects lab is a **parallel** generator too, not a port. Adding a
  part = one file in `src/obj/oparts/` + one line in its `index.js`;
  a VARIANT = an entry in a part's `gen`/weighted table plus a
  branch in its `build`; a species = one entry of weights in
  `ospecies.js`; a palette = one entry in `opalette.js`; a finish =
  `FINISHES` in `omedia.js`. Prefer the cheapest lever: a blade, a
  crown and a rosette are all the one LEAVES part, not three parts.
- In the objects lab **geometry may never roll.** Counts, sizes,
  leans and the lump wobble seeds all live in `gen()`; `build()`
  places them with `oshash(seed, i)` (the same stable-scatter trick
  the voxel `h01` does). A plant built with `s.jr()`-style call
  would shimmer on every rebuild — it does not, and that is the
  contract. The one exception a shape may say is its own: the blade
  BAKES lean/droop into the outline so a grass tuft is curvy, not
  sticks.
- In the objects lab **species are shapes, not skins**: a grass tuft
  and a tree crown share almost no bodies, so species branch the
  foliage and bloom parts hard on style. Never make a fifth species
  that is just a recolour — that is a palette entry, not a species.
- Adding a gloss **species** = one entry of weights in
  `src/gloss/gspecies.js` — the third copy of the casting idea, own
  helper on purpose. A species loads the dice so the compound characters
  arrive assembled (panda = bear ears + ink eye patches; pig = snout;
  robot = cube + screen face; humanoid = the modeled chibi SKULL +
  hair on the crown + skin, §12); it may bias the BODY form but never
  the palette or material — a lavender panda is still a panda. The
  ONE exception is the humanoid, which names both (`skin` palette,
  `skin` material) because a chrome one is a different object, not the
  same one in another finish. `wildcard`
  is the free roll and stays the biggest slice: the casting exists to
  assemble compounds, not to shrink the generator to eight characters.
  Parts' gen() takes `(rng, C)` and asks `C.pick/range/chance`; the
  species wins where it has an opinion, the part default elsewhere.
- The gloss face lives in the **upper half**, and the mouth sits high —
  just under the eyes, about where a nose would be — with the body
  falling away empty below it. Slung low it reads as a smiley drawn on
  a ball. And keep the proportion ranges WIDE: every body is the same
  normalised sphere, so eye size, eye spacing and mouth size are the
  only variety the sheet has. They were ±6% once and every character came
  out the same circle.
- The **humanoid inverts that rule**, and it is the only thing that
  does: *frente despejada, ojos a mitad de cara*. Its whole top half
  is bare forehead and the face hangs off the midline. The numbers are
  measured off the chibi reference sheet and are checked, not guessed
  — the eye's CENTRE ~64% down the head, its TOP ~52% (i.e. right at
  the midline), each eye ~25% of the head's width, eye centres ~50% of
  the half-width out, the mouth ~77% down. Guessing put the face too
  high and too small twice. Measure with `__probe` in the lab console
  and average over ~30 seeds — one character is not a proportion.
- **Hair is ONE MOLDED MASS with the clumps carved in** — a closed
  thick shell (torus topology: outer surface up, inner surface back
  down hugging the head; the fold is the molded rim), with GROOVES
  notched at clump boundaries and a hem that SCALLOPS to a point under
  each clump. Three attempts live behind that sentence: a smooth shell
  is a helmet, and separate tiles gap onto skin, catch the light as
  streaks, and have no volume. It still grows from the crown — the
  (azimuth, height) parametrisation converges at the pole, so the
  grooves meet in a whorl for free (fade them near it, or it spikes).
- The hem — front/side/back, by azimuth — is still the whole haircut,
  and the ORDERING is the read: fringe high, temples lower, nape
  lowest. Jitter the clump boundaries; the eye reads a repeat before
  it reads the hair.
- Hair is COMBED FROM A WHORL: grooves are rays out of a placeable
  whorl point (back of crown; front hairline for upswept cuts), never
  meridians from the pole — meridians meet at the top and make a
  pumpkin. Point strands come in exactly two families, momiage (only
  where the ear is exposed) and fringe wisps that HANG past the hem —
  hanging is the one direction a strand cannot misread; flow-marched
  wisps and crown flyaways both read as antennae and were cut. Every
  strand's root starts INSIDE the mass.
- But length alone is not STYLING: a blunt fringe ruled across the brow
  is a bowl cut, and a table of lengths gives you fourteen of them. The
  fringe's SHAPE is its own dimension — `part` (diagonal), `curtain`
  (open in the middle, forehead showing) and `pomp` (swept up). `pomp`
  needs geometry, not a hem number: a radial push is just a fatter
  helmet, so it displaces the outer surface up and forward, peaking
  between hairline and crown and returning to zero at both — carried
  into the crown fold it tears the mass open.
- Keep a **media melena** band. There was a hole between `bob` (jaw)
  and `long` (chest) and it is the commonest length there is.
- Hair is **dead-matte vinyl**: no clearcoat (a hotspot on soft clumps
  is a plastic wig) and only the faintest sheen — strong sheen is a rim
  lobe and lights every groove edge as a glassy streak. Matte comes
  from roughness, never from dimming `envMapIntensity`, which just
  darkens every colour off its swatch. Tails and the ahoge are tubes;
  a tail's stand-off scales with the HEAD, never the hair's length —
  scaled by length it doubled the character's width and the sheet shrank the
  face to half its neighbours' to fit the cell.
- Hair colour is its own table in `gpalette.js`, never the body
  palette, and the LAYOUT owns the two facts that are about the PAIR:
  the brow is the hair pulled toward ink, and hair within a sixth of
  the skin in luma gets pushed off it (a third of the sheet vanished
  into its own face before that guard; now 4%).
- A humanoid's mouth is a **small line**, not a maw. Two reasons and
  both matter: the reference mouth is a stroke a fraction of an eye
  wide, and a big mouth also REACHES further, so the layout's
  clear-the-eyes push drops it onto the chin.
- A gloss face has **two storeys and a silhouette**, and that is what
  separates a creature from an emoji: the MUZZLE (`muzzle.js` — patch,
  lump or snout; the layout publishes `L.muzzle` and the nose and
  mouth stand on its `proud`), the CREST (`crest.js` — ears and horns
  on `L.top(t)`; the silhouette does the species work), and MAW mouths
  (`mouth.js` — ink outline + dark `MAW` interior + teeth + tongue,
  licensed to be half the face). A snout stands the nose part down: it
  brought its own nostrils.
- When a maw is taller than the room under the eyes, the layout pushes
  the mouth down and then takes the remaining deficit off the mouth's
  SIZE (`L.mouthFit`) — the chin can run out, and what gives is scale,
  never overlap.
- Where the face's rows sit is published by `glayout.js`
  (`eyeX / eyeY / mouthY / noseY / eyeR`). A part must never reach into
  another part's params to stay out of its way — `noseY` is the
  midpoint of eyes and mouth by construction, so a nose cannot collide
  with a mouth however either is dragged.
- A gloss part hands back **specs**, never geometry: it names an
  outline from `gshape.js` and passes numbers. It never touches
  three.js and never builds a material — it takes colours off `L`
  (`body / warm / ink`). That is what `F.media.*` is to a drawn part.
- A feature may carry a **travel budget** (`spec.travel`, in its own
  plane) saying how far it may slide when the character looks somewhere. A
  PUPIL gets most of its white and a white eye gets almost nothing, so
  `gface.js` drives a moving pupil without knowing what shape any eye
  is. Travel is scaled by the blink, or a pupil left out at the edge
  gets squashed about the wrong centre and slides clear of its lid.
- Every face feature is its own MESH, and that is the whole point: a
  blink is `scale.y` and a glance is a translate, so the face animates
  without a rebuild. `gface.js` owns every write to a feature mesh —
  it restores rest and re-applies offsets each frame, so blink, gaze
  and expression can never fight over one transform. Expressions are
  OFFSETS scaled by blend weight, never absolute transforms, same rule
  as the drawn poses.
- The gloss face never learns the body's shape: it places through
  `L.at(ax, ay)`, which returns a point and a normal. A new body only
  has to provide that function and it inherits the whole face
  catalogue. A superellipsoid's normal is the **gradient**, not the
  direction from the centre — use the centre and a cube's features all
  point at its corners instead of lying flat on its face.
- A gloss **body form is one exponent**, not a second primitive:
  `|x/rx|ⁿ + |y/ry|ⁿ + |z/rz|ⁿ = 1`, where n=2 is a ball and n≈4 a
  rounded cube. `sphere` pins n at 2 so it stays exact; `cube` reads
  the rolled `corner`. Both `gshape.solidGeometry` and `L.at` use the
  same n, so they can never disagree about where the surface is.
- A modeled chibi **skull** was a third body form for a while
  (`gskull.js`, a subdivided control cage) and is gone. Keep the
  lesson — *a shape you can name the parts of wants a cage, not an
  exponent*, since a chin-tuck knob on the superellipsoid failed in
  three different shapes — but keep the verdict too: this lab makes
  CHIBI CHARACTERS, and an anatomically-argued skull looked like it
  had wandered in off another register. A form that is right in
  isolation and wrong in the line-up is wrong.
- Adding an **extra** — spectacles, a hat, a face mark — is a file in
  `gparts/` like any part, but deal it RARE (the three sit at 88/86/82%
  none): an accessory on everyone is the house style, not a character.
  They take their colour from `ACC_COLORS` via `L.acc`, never the character's
  five — on a humanoid every palette colour is a skin tone and the
  first beanie read as a bald head — and `pickAcc` scores on full RGB
  distance, not luma, or a terracotta lands on peach skin. They wear
  the `acc` finish, whose sheen is SELF-COLOURED: rubber's white sheen
  washed a brick red to pale pink, the same error the hair records.
- A hat either **hugs or perches**. A bow or a crown perches on the
  hair (`L.hairTop`). A beanie or a headband is pulled ON, and no size
  lets one share a skull with a haircut — clear the hair and it is a
  bowl balanced on the head, hug the skull and it vanishes underneath,
  squash the hair under its rim (built, worked) and they still fight
  every seed. They are worn on a BARE head: `hat.js` publishes
  `hatBare` and `ghair.js` builds nothing. Same edge as `eyeProud` for
  spectacles clearing a ball eye — the part that knows a fact states
  it and the layout hands it over.
- **Hats are human.** The part default is `none` at 100 so only the
  humanoid's profile deals them. Spectacles are frames plus a BRIDGE,
  never temple arms: a plate lands on a tangent plane, so an arm either
  starts in mid-air at the temple or flies off the side of the head.
  Size the bridge off the lens centre's world x, not off a face
  coordinate — those are not the same unit and it came out floating.
- There are **four bodies**, built two ways: `sphere` and `cube` are
  the superellipsoid; `rock` and `slime` are MODELED in `gform.js` — a
  low-poly cage of `[y, radius]` rings through Catmull-Clark, and `at`
  raycasts the same arrays that get stamped. Both were tried as
  formulas twice first (a radial displacement, then a silhouette
  profile) and neither works: a radial scale keeps a ball's topology of
  extents so nothing sits flat, and a profile is only an outline. *A
  shape you can name the parts of wants a cage.*
- Give a rock FEW sides — twelve subdivide into a smooth pebble, eight
  keep facets. Put the lumps in the CAGE with fixed harmonics, so
  subdivision softens them into swells and they cannot boil.
- A gloss character has a **stance** — `none` or `biped` (`recipe.stance`,
  weighted per species like the body form; head-only carries the
  sheet, the humanoid pins biped, and `quad` was built and cut — from
  the front it read as a worse biped). The frame (`gparts/frame.js`)
  is RAYMAN anatomy: an upright pill torso, and MITTS and SHOES
  floating in air — modeled from cages like the rock, no limbs, no
  neck — with the head sunk into the torso by a socket. Its
  proportions scale off the HEAD, the layout calls `frameLayout` first
  because the head's height depends on it, and the head is its own
  GROUP in the rig so the gaze turns it while the feet stay planted.
  A modeled form (rock, slime) never takes a frame — its base already
  is its bottom — and `L.H` stays the HEAD's height so the sheet keeps
  normalising faces. See ARCHITECTURE.md §12, "The stance".
- A biped wears an **outfit** the LAYOUT resolves (`L.outfit`, colours
  via `pickOutfit` — cloth clears skin and hair, gloves and shoes clear
  the cloth). Gloves and shoes are always coloured; the torso is cloth
  only when `dressed` rolls (humanoid pins 1, robot .1 — a robot's
  torso is its chassis). A dressed torso may carry a screen-printed
  motif: `clothPrint` in `gtexture.js` bakes cloth + ink into ONE map
  and the factory sets the material colour white — print is the one
  place a texture is the right tool for clothing; a painted hem never
  is. `none` carries the motif table: a print on every chest is a
  uniform, not a wardrobe.
- A modeled form needs two things from the layout: `hwAt` must read its
  binned half-width (the peak of a drop is most of its height, and a
  feature guarded against `rx` there leaves the silhouette), and the
  FACE follows the width — the upper-half rule would put a slime's eyes
  on its spike, so a form may bias the face down. Deal them weighted;
  uniform made the modeled pair 40% of a sheet.
- Adding an eye style is one entry in `eyes.js`'s `STYLE` table — and
  ADD IT TO THE WEIGHTS TOO. A style in the table but not in the
  `wpick` list is unreachable and nothing will tell you; that has
  already happened once.
- Features are **proud, not cut in**: a plate's front sits at z = 0
  and its body runs backward, so it can never float off the
  silhouette.
- **A shadow comes from geometry and the studio, never from a colour
  picked to look like one.** An eye rim — the same outline a size
  larger in a darkened body tone — was tried as a stand-in for the
  reference's carved socket and removed: on pale palettes a darkened
  body colour reads as a second COLOUR, not a darker one, and with no
  concavity behind it there was no cue saying "recess" either. It read
  as two stacked shapes. Want the carved look back? Model it.
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
  `game.html`, `marbles.html`, `items.html`, `objects.html`,
  `photo.html`) and confirm the console
  is clean — a
  stale import or a renamed export is a real bug and takes one reload
  to find;
- assert on **numbers**, not vibes, through `window.__game` /
  `window.__orla` (and `window.__object` for the plants lab — same
  recipe in → same plant out, checked by build spec + JSON
  round-trip): drain rates, the shape of a draft hand, where the
  camera target lands;
- **balance is measurable here, so measure it.** `marbles.html` is the
  furthest this has been taken: `__marbles.headless(true)` drops every
  part of the frame that only exists on a screen, so a four-minute
  auto-played run costs a couple of seconds and the whole difficulty
  curve can be read off a table of `[t, lives, level, foes, marbles,
  kills]`. Three real bugs came out of it that no amount of playing
  would have named. A recipe is cheap —
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
