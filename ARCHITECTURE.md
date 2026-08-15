# drawai — architecture, and how to add a part

Read this before touching the code. It is written so that adding a new
kind of part is a **small, local, mechanical** change: one new file,
one line in a registry, nothing else.

---

## 1. The one-paragraph version

A character is a **recipe** (plain JSON). The **rig** asks each
**part** to generate its params — biased by the **species** profile —
then hands everything to the **layout**, which computes every shared
measurement once. Each part is then asked what bones it wants and
draws itself onto a small canvas per bone. Those canvases become
textures on flat planes hanging off `THREE.Group` bones, which the
**animator** moves. Drawing is done by the **hand** (`sketch.js`)
through a **medium** (`media.js`), so every part looks like it was
made by the same person with the same pencil.

```
                 species.js  (loads the dice)
                      │
recipe ──► gen() ─────┴──► params ──► layout.js ──► F (shared geometry,
                                                       colours, medium)
                                          │
                  parts/index.js ─────────┼──► bones(P,F) ──► canvas per bone
                                          │    draw(s,P,st,F,bone)
                                          ▼
                                       rig.js ──► bones ──► anim.js
```

**Three levers, deliberately independent:**

| Lever | Answers | Where |
|---|---|---|
| **species** | *what animal is it* | `species.js` — biases generation only |
| **media** | *what is it made of* | `media.js` — graphite, oil, watercolour… |
| **params** | *which individual is it* | the recipe itself |

---

## 2. Files

| File | What lives there | Touch it when… |
|---|---|---|
| `src/sketch.js` | **The hand.** Strokes, fills, hatching, washes, oil daubs, geometry helpers. | you need a new *drawing technique* |
| `src/media.js` | **The material.** graphite/ink/watercolour/oil/chalk/marker; each answers `tone`/`skin`/`edge`. | you add a new medium |
| `src/species.js` | **The casting.** One table of loaded dice per species. | you add a species ← *data only* |
| `src/layout.js` | **The skeleton.** Every shared measurement: head outline, eye anchors, body block `B`. | two parts must agree on a position |
| `src/parts/*.js` | **The parts.** One file per feature family. | you add a part or a variant ← *usually this* |
| `src/parts/index.js` | **The registry.** The ordered list of active parts. | you add a part file |
| `src/rig.js` | recipe → bones → meshes. Generic; knows nothing about eyes or arms. | almost never |
| `src/anim.js` | **The animator core.** Autonomic life (boil, blink, gaze, talk, sway, breath), pose blending, expression crossfades. | you change how blending works |
| `src/poses/*.js` | **The poses.** idle, walk, run, sit, sleep, attack — one file each. | you add a pose ← *like adding a part* |
| `src/expressions.js` | **The expressions.** idle, angry, scared, crying, sleeping. | you add an expression |
| `src/part.js` | canvas/texture plumbing (`makePart`), render resolution. | almost never |
| `src/ground.js` | the game room's floor tiles + the blob shadows | the room's look |
| `src/scenery.js` | the props in the room (toys, cots, the nightlight) | you add furniture |
| `src/dark.js` | **global illumination** — the room is black outside the lamps | how light behaves |
| `src/postfx.js` | tilt-shift, vignette — the *lens* | the mood of the whole frame |
| `src/main.js` / `src/crowd.js` / `src/game.js` | the three scenes | new scene features |

---

## 3. Coordinates and units — the thing to get right

There are exactly two:

**Character coordinates** — what `draw()` uses. Pixels, **y points
DOWN**, origin at the **centre of the head**. The body is at positive
y. `F.s` is the head scale in px and almost every number should be
written as a multiple of it (`F.s * .3`), never as a raw pixel count,
so characters stay consistent at any size.

**World units** — what `bones()` and `size()` use. This is
`pixels / U`. Always divide by `U`:

```js
bones: (P, F) => [{ name: 'thing', x: F.B.hipX / U, y: -F.B.hipY / U }],
```

Note the **minus** on y: bone space is normal 3D (y up), drawing space
is canvas (y down). A part that sits below the head has a *negative*
bone y and draws at *positive* y.

`U` is resolution only. The crowd lowers it to draw 35 characters
cheaply; layout is unaffected because everything is a ratio.

---

## 4. The part contract

A part is a plain object. Only `id`, `label`, `order`, `gen`, `bones`,
`size` and `draw` are required.

```js
export const MyPart = {
  id: 'myPart',          // unique; also the key inside recipe.parts
  label: 'mi parte',     // shown in the editor (Spanish)
  order: 3,              // draw order: higher is drawn IN FRONT
  depth: 1,              // parallax: how much it rides when the head moves
                         //   1 = a front feature, 0 = the skull, <0 = behind
  region: 'head',        // 'head' (default) moves with sway/gaze/breath;
                         //   'body' stays PLANTED on the floor
  species: ['nightmare'],// optional: this part EXISTS only for these
                         //   species. Omit and everyone can have it.
  pivot: [.5, .5],       // optional: where the bone sits on the canvas
                         //   [.5,1] = top edge (part hangs downward)
  states: ['idle'],      // optional: extra pre-drawn textures (see §6)

  // Params from a seeded rng — this is what makes one character
  // differ from another. Keep every value a plain number/string/bool
  // so the recipe stays JSON.
  //
  // C is the CASTING helper (§9): ask it for anything a species might
  // want an opinion about, and it falls back to your default when the
  // species is silent. Use the plain rng for the rest.
  gen: (rng, C) => ({
    style: C.pick(rng, 'style', [['a', 60], ['b', 40]]),  // weighted list
    size:  C.range(rng, 'size', .5, 1.5),                 // a number
    on:    C.chance(rng, 'on', .4),                       // a yes/no
    jitter: rng.r(-.1, .1),                               // nobody's business
  }),

  // editor controls, one entry per param you want to expose
  meta: () => ({
    style: { label: 'estilo', pick: ['a', 'b'] },
    size:  { label: 'tamaño', range: [.3, 2] },        // add step:1 for ints
    on:    { label: 'visible', bool: true },
  }),

  skip: (P, F) => P.style === 'none',   // optional: draw nothing

  // one entry per canvas. Two entries = a mirrored pair.
  bones: (P, F) => [-1, 1].map(sd => ({
    name: 'my' + (sd < 0 ? 'L' : 'R'),
    x: sd * F.w * .5 / U,
    y: -F.s * .2 / U,
    side: sd,            // handed to draw() as bone.side
    // order / depth can be overridden here per bone
  })),

  // canvas size in WORLD units. Must cover everything you draw or it
  // gets clipped. Too big is only a memory cost.
  size: (P, F) => [(F.w * 1.5) / U, (F.s * 1.2) / U],

  // s = Sketch, P = params, st = current state, F = layout, bone = the
  // bone entry from bones(). Draw in CHARACTER coordinates.
  draw(s, P, st, F, bone) {
    const sd = bone.side;
    const shape = s.blobPts(sd * F.w * .5, F.s * .2, F.s * .1, F.s * .1, 0, .45);
    F.media.tone(s, shape, { style: 'light', gap: F.s * .05 });
    F.media.edge(s, shape.concat([shape[0]]), F.lwThin * 1.2, {});
  },
};
```

Then register it in `src/parts/index.js`, in draw order. That is the
whole job — the editor panel, the recipe, reroll/lock and the crowd
all pick it up automatically.

---

## 5. Rules that keep it looking like one drawing

1. **Never call a technique directly.** Use `F.media.tone(...)` for a
   mass, `F.media.skin(...)` for skin colour, `F.media.edge(...)` for a
   contour. If you call `s.pencilFill` yourself, your part stays
   graphite while the rest of the character is watercolour.
   Fine detail lines (`s.sline`, `s.stroke`) are exempt — they are the
   underdrawing. Guard heavy pencil shading with
   `if (F.media.underdraw)`, which is false for oil.
2. **Size everything from `F.s`** (head scale) or `F.w` / `F.B.*`.
   No raw pixel constants.
3. **Weights:** `F.lwMain` for a silhouette, `F.lwThin` for detail.
4. **`s.blobPts` spins its ellipse freely.** For anything not roughly
   circular pass a small explicit rotation, or it will stand on end and
   slash across the character: `s.blobPts(x, y, rx, ry, s.jr(-.2,.2))`.
   Its 6th argument is wobble: `1` is a scribbled mass, `~.4` is a
   shape drawn slowly and carefully (eyes use this).
5. **Randomness inside `draw()` is the boil.** It is re-rolled every
   redraw, so anything decided there *shimmers*. Decisions that must
   hold still (which style, how long, which side) belong in `gen()`.
6. **Positions two parts share go in `layout.js`**, not in both parts.

---

## 6. States (how animation works)

`states: ['idle']` by default. Every state is drawn into its own
texture, so animating is a texture swap — free at runtime. States are
drawn **lazily**: only the resting state is paid for at build time,
and an expression nobody makes never costs a canvas.

- Eyes declare the autonomic set (`open/closed` + four glances) plus
  the expression set (`angry/scared/cry`): blinking, glancing and
  emoting are all swaps.
- Mouth declares `['idle','open']` for talk plus
  `['angry','scared','cry','sleep']` for the expressions.
- Brows declare `['idle','angry','sad','raised']`; QuadLegs declare
  `['idle','stepA','stepB','fold']` — the four-legged walk is a
  flip-book of diagonal pairs, and 'fold' is the sphinx sleep.
- `draw()` receives the state as `st` and decides what changes.

The animator also moves bones (`e.bone.position/rotation/scale`) —
that is how sway, breath, arm swing and the gaze parallax work. Bones
remember their rest position in `bone.userData.base`.

The rig splits bones into `headGroup` and `bodyGroup` by each part's
`region`. All head motion (sway, the gaze head-cock, the breath lift)
is applied to `headGroup` only; the body stays planted so the feet
never leave the floor. Body parts get their life explicitly (the torso
swells with the breath, the arms swing) — if you add a body part and
want it to move, add its behaviour to `anim.js`, don't give it
`region:'head'`.

**The floor:** `F.B.floorY` is how far (in px) the character's feet
hang below the head centre, whatever its proportions. Scenes stand a
character on a drawn line with
`group.position.y = floorLineY + F.B.floorY / U`. If your part extends
below the feet, extend `bodyLayout()` so `floorY` still tells the
truth.

### Poses and expressions

On top of the autonomic life sit two crossfaded systems:

**Poses** (`src/poses/`, registry in `src/poses/index.js`) say what
the body is doing: idle, walk, run, sit, sleep, attack. A pose writes
bone/group *offsets* through a small ctx API, and every write is
scaled by the pose's blend weight — a transition is two poses mixing,
so nothing snaps. Walk and run share ONE gait phase, so a tempo change
never teleports a foot. One-shots (attack) play out and hand back.
Poses scale the autonomic layers through `auto` multipliers (sleep:
gaze 0, breath 2.2) instead of switching them off. The full contract
is documented at the top of `src/poses/index.js`; every pose handles
the three bases (`biped`/`sit`/`quad`).

**Expressions** (`src/expressions.js`) say what the face is doing:
idle, angry, scared, crying, sleeping. An expression = texture states
per face part + continuous body language on the same weight API.
Texture swaps are binary, so the animator lands them *while a blink
has the eyes shut*; the brows/shiver/sob ramp with the crossfade,
which is where the smoothness comes from.

Scenes drive both with `animator.setPose(id)` / `animator.setFace(id)`.

---

## 6b. The room (`game.html`) — Kindergrimm, and 3D

The game scene is a **real 3D world**, ported from the `draw-test`
prototype: a floor lying flat on XZ, an orthographic camera orbiting
above it, and every drawing standing on that floor as an upright
billboard. The editor and the crowd are still flat pages — only this
scene is 3D, which is why `addPaper()` (a camera-facing page plus a
paper-tooth quad) is **not** used here: under an orbiting camera those
go edge-on. The game gets its grain and vignette from DOM overlays in
`game.html` instead, and its lens from `postfx.js`.

```
billboard   holder.rotation.y = view.az     — yaw ONLY, never pitch.
            The drawing stays square to the page and simply eats the
            foreshortening. That is the whole Don't-Starve trick.
mirror      screen-space, never world-space:
              mdot = cos(h)*view.rightX + sin(h)*view.rightZ
            latch the flip only when |mdot| > .15, then lerp scale.x
            through zero so the turn reads as a paper flip. A
            world-space flip moonwalks the moment the camera orbits
            past 90°. Safe only because parts are DoubleSide planes.
depth key   x*sin(az) + z*cos(az) — the view-axis projection. Under an
            ORTHO camera radial distance is the wrong key and inverts
            characters at opposite frame edges.
shadow      its own scene object, never a child of the holder, or it
            inherits the yaw, the mirror and the breath.
            rotation.order = 'YXZ' so the yaw spins the ellipse WITHIN
            the floor instead of tipping it out of it.
floor       drawn TOP-DOWN and tiled. Never paint perspective into it
            — a baked vanishing point swings around with the camera —
            and never draw a long straight line, because one that
            starts at a tile edge lines up with its neighbour's and
            the floor turns back into graph paper.
```

The one fact that makes all this cheap: **`anim.js` never writes
`face.group`** — only `headGroup`/`bodyGroup`. So world placement, the
billboard yaw and the mirror all live on a holder above it, and the
animator never has to know the world became 3D. Every screen-space
offset it writes (sway, gaze parallax, breath) stays correct at every
azimuth, because a billboard is permanently a front view.

**Depth sorting is not optional.** Every material is `transparent`
with `depthWrite: false`, so what you see is decided *entirely* by
draw order, and three sorts by `renderOrder` before it ever looks at
z. Part orders span -4 (tail) to 7 (a horned crest), so with the raw
numbers every character's torso draws before *any* character's head
and two overlapping characters interleave part by part — a far face
punches through a near back.

`setDepthRank(face, rank)` in `rig.js` fixes this by giving each
character a contiguous 16-slot block of the renderOrder line
(`+0` shadow, `+1…+12` parts, `+13…+15` props). Rank 0 is farthest.
**Ranks must be unique** — two characters sharing one fall back to
three's mesh-id tie-break and interleave silently, so always break the
depth sort on entity index. The scene re-stamps every frame; a rebuilt
character has `rank === null` and is re-stamped for free.

**Lazy states cut both ways.** They are right for the crowd (35
characters that mostly never emote) and wrong in the room, where the
first blink and first glance would draw canvases mid-play. `game.js`
prewarms the states it will actually reach for (`WARM`) during the
load pass and leaves the expressions lazy.

**Nothing may build during play.** A character costs ~20 ms. The class
fills on a time budget at boot, and the nightmare wave is *queued* at
dusk and built one per frame — building a whole wave in one frame
stutters at exactly the moment the night is meant to feel dangerous.

### Global illumination (`src/dark.js`)

The room is **black**, everywhere the light does not reach — not
tinted, not dimmed. There is no day/night cycle; it is always dark,
and light is the only safe ground. That one decision is what makes a
lantern a decision instead of a decoration.

It is one plane lying on the floor whose fragment shader is handed
every live light in WORLD space. Each pixel asks how far it is from
the nearest lamp and paints itself black in proportion — a shadow mask
on the ground, one draw call, no render targets. The pool edge wobbles
on a slow clock, because a child drawing a circle of lamplight would
never get it round, and a clean radial gradient is the one thing here
that would look like a computer did it.

Billboards standing on the floor are **not** darkened by that plane —
they are drawn over it. `game.js` tints them on the CPU
(`mat.color.setScalar(v)`) from the same `lightAt()`, so what you see
and what the game thinks is lit can never disagree.

### The game

You start with three children, one bed, one floor lantern and one toy.

- **Children do NOTHING on their own.** There is no autonomy at all:
  every child stands where it is, burning stamina, until you tell it
  otherwise. Click a child to select it, then click a bed (rest), a
  toy (play), a nightmare (go at it) or the floor (walk there). An
  idle child is a child running down, which is what makes the clock
  feel like yours.
- **Orders persist**: a child on a toy plays until the toy breaks or
  you say otherwise; a child in a bed sleeps until it is full.
- **Everything breaks** — beds and toys by use, lights by time.
- **The dark is the threat.** A child outside the light is `scared`
  and loses stamina fast; at zero its parents come and take it home.
  Lose all three and the school closes. Children are never hurt and
  never die — this is a baby school, do not escalate it.
- **Nerve.** Every child has a nerve of -3…+3, every nightmare a
  menace of -3…+3, and **courage = nerve + light×3**. Out-matched, a
  child freezes and cries — and a frozen child *ignores your orders*
  until the thing leaves. This is the join between the two systems:
  the same child breaks in the dark and holds under a lamp.
- **Nightmares** chew on the furniture, never on a child. **Light does
  not kill them — it mires them** (17% speed under a lamp). The
  children do the killing. They want the closest bed or toy and do not
  care who is using it, so they have their own `nearestBreakable()`.
- **The bar and the draft.** Playing fills one shared bar. When it
  fills the world STOPS (`state.paused` zeroes `dt`, rendering
  continues) and three cards are drawn from `KNACKS` (applied to a
  child you then click) and `PLACEABLES` (put where you then click).
  There is no currency — the draft is the whole economy.

**Picking** is done with invisible proxy quads (`addPick`), one per
clickable entity, raycast in place of the real drawings: hit-testing
every part mesh of a child would be slow and would miss the gaps
between the strokes. Proxies must be *positioned* — characters get
theirs moved each frame, and a static thing needs its proxy placed at
creation or it sits at the origin, unclickable, while the origin
silently becomes clickable instead.

Objects that lie on the floor (beds) are `flat: true` — drawn
top-down, laid with `rotation.x = -π/2`, and placed UNDER the darkness
plane so the light shader paints them per-pixel like the floor.

**Every upright thing is a billboard** — props included, not just the
characters. `mesh.rotation.y = view.az` has to be re-applied to all of
them every frame; a prop that only gets a position is pinned to +Z and
goes edge-on the moment the camera orbits. They are **never mirrored**:
a doodle child does not turn around to walk the other way.

Bodies take up room: `separate()` pushes every overlapping pair of
characters apart along the line between them, half the correction
each, after everyone has moved.

---

## 7. Recipe

```json
{ "seed": 12345, "species": "dog", "media": "graphite", "color": "auto",
  "parts": { "eyes": { "params": { "type": "saucer" }, "lock": true, "rr": 2 } } }
```

Same JSON in, same character out, on any machine. `rr` re-rolls one
part; `lock` protects it from a global regenerate. This is the format a
game would ship.

---

## 8. Species — a casting profile, not code

A dog is **not** a new set of drawings. It is the same catalogue of
parts with the dice loaded toward floppy ears, a snout, spots and no
hair. So a species is a table of weights, in `src/species.js`:

```js
dog: {
  label: 'perro',
  cast: {
    crest:  { style: { floppy: 62, bear: 22, none: 16 } },
    nose:   { style: { snout: 74, button: 26 }, snoutLen: [1.15, 1.6] },
    extras: { spots: .55, tears: .04 },
  },
},
```

One table per part id. **The value's type says what it does:**

| You write | It means |
|---|---|
| `{ a: 60, b: 40 }` an object | weighted pick — and options you leave out **cannot happen** |
| `[1.1, 1.6]` an array | a number drawn from this range |
| `.55` a number | a probability |

Anything the profile does not mention keeps the part's own default, so
a profile states **only what makes that species different**.

**Species touches generation only.** Once params exist they are plain
numbers, so a saved recipe rebuilds identically even if the profile
changes or disappears — and you can still hand-edit any param
afterwards. That is why species lives beside the parts and not inside
them.

**The real job a species does is coherence.** Left to chance, floppy
ears, a snout and a wagging tail would almost never land on the same
character. Guaranteeing they arrive together is what a species *is*.

### But casting alone is not enough

Loading the dice gets you a human with animal accessories — *a kid in
a costume*. What actually makes a dog a dog is that **the head is a
different shape**, and a nightmare has parts a person simply does not. So a
species has three levers, in increasing cost:

| Lever | Cost | Example |
|---|---|---|
| **weights** — bias existing choices | free, data only | dogs get floppy ears and spots |
| **skull shape** — the head's own outline | one param + one branch | `muzzle` puts a snout in the silhouette |
| **its own part** — `species: ['nightmare']` | a new part file | wings; no dice roll turns an arm into one |

The rule of thumb: reach for a new part only when the shape could not
belong to anybody else. Wings qualify. A snout did not — it became a
param on the skull, so any species can have one.

**The muzzle is the worked example.** `skull.muzzle` does two things:
it swells the silhouette a little, and it tells `Skull.draw` to lay a
LOBE with its own contour over the jaw. A smooth bulge alone reads as
a long chin; the second outline is what reads as a snout. And because
`layout.js` publishes where that lobe landed (`F.L.M`), the nose and
the mouth sit **on** it — `F.L.noseY` and `F.L.my` already account for
it, so those parts never learn what a muzzle is.

### Bases — the skeleton, not the casting

`recipe.base` says what the character is built on: `biped` (the
big-headed two-legged doodle) or `sit` (an animal on its haunches with
its paws on the floor). The species picks one from its `bases` table.

A base changes two things and nothing else:

1. **`bodyLayout()` branches on it** and publishes different anchors —
   `sit` exports `frontPawX/Y`, `sidePawX/Y` and `pawR` where `biped`
   exports shoulders and hips. Both still publish `floorY`, so the
   floor code never learns a base exists.
2. **Parts declare `base: ['biped']` or `base: ['sit']`** and the rig
   skips the others. Arms and Legs are biped-only; `Paws` draws all
   four at once and is sit-only. Everything above the neck — every
   head, eye, ear, muzzle and medium — is shared untouched.

That is the whole mechanism, and it is the same one as `species`. A
quadruped standing on all fours would be a third base: a new branch in
`bodyLayout` and a `Legs4` part.

### Adding a species

1. Copy the nearest entry in `species.js` and change the tables.
2. If it needs a shape nobody has drawn yet (a beak, a tail), add that
   as a normal **variant of an existing part** first — see §9 — and
   then every species can use it.
3. Nothing else. Both scenes pick the new species up automatically.

### When a species needs a shape that varies

If a species wants a *family* of a shape rather than one drawing, give
that part params and let the profile set their range. The snout is the
worked example: `snoutLen`, `snoutFat`, `snoutTip` turn one drawing
into greyhound-to-bulldog, and then

```js
dog: { cast: { nose: { snoutLen: [1.15, 1.6] } } },   // long muzzles
cat: { cast: { nose: { snoutLen: [.5,  .8 ] } } },    // flat faces
```

Add params where you want two characters (or two species) to *differ*.
Don't parameterise for its own sake: every param is another knob in
the editor and another thing randomness can ruin.

## 9. Recipes for common jobs

**Add a variant to an existing part** (easiest, most common): add the
name to that part's weighted table in `gen`, add it to the `pick` list
in `meta`, and add an `else if` branch in `draw`. Nothing else. It is
immediately available to every species.

**Add a species:** see §8. Data only, no drawing.

**Add a new part type:** copy `src/parts/body.js` (Torso is a
single-bone part, Arms/Legs are mirrored pairs), fill in the contract
above, register it in `src/parts/index.js` at the right draw order.

**Add a drawing technique:** add a method to `Sketch` in `sketch.js`,
then expose it through the media that should use it.

**Add a medium:** add an entry to `MEDIA` in `media.js` with
`tone`/`skin`/`edge`/`underdraw`. It appears in both scenes' selectors
automatically.

**Add a body-relative anchor:** extend `bodyLayout()` in `layout.js`
and read it from `F.B`.

**Add a pose:** copy the nearest file in `src/poses/`, register it in
`src/poses/index.js`. Handle the three bases. The contract is at the
top of the registry.

**Add an expression:** one entry in `src/expressions.js`. If it needs
a face nobody can draw, first add that as a *state* of the eye, brow
or mouth part (one branch in its `draw()`), then point at it from
`states`.
