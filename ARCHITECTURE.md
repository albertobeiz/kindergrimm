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
| `src/items/core.js` | **the object hand.** `REF`, the rank ladder, `finish()`, `stamp()`, the stat algebra | you change how objects are drawn or costed |
| `src/items/*.js` | **the item families.** One file per family of object. | you add an object ← *data + one drawing* |
| `src/items/index.js` | the item registry, the roll, and favour | you add a family file |
| `src/parts/gear.js` | `Held` / `Offhand` / `Worn` — items on a body | almost never |
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
    size:  { label: 'size', range: [.3, 2] },          // add step:1 for ints
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
floor       drawn TOP-DOWN and tiled, and the tiles STREAM: a fixed
            grid that follows the view, each cell showing the variant
            (and quarter-turn) its coordinate hashes to, so the floor
            is endless for a constant cost and never bakes mid-play.
            Never paint perspective into it — a baked vanishing point
            swings around with the camera — and never draw a long
            straight line, because one that starts at a tile edge
            lines up with its neighbour's and the floor turns back
            into graph paper.
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

### Camera and gestures — the game is played on a phone

The camera orbits a **pan target** (`camWant`, eased into `camAt`), not
the origin. Panning **grabs the floor**: remember the world point under
the finger and move the target so that point stays under it. Never
convert pixels to world units by hand — the foreshortening term is easy
to get subtly wrong and reads as drift. There is no pan clamp any more
— the floor has no edge to drag into shot — so what stops you getting
lost is `keepInFrame()`, which fetches the camera back only once the
class is *entirely* out of frame. A leash that pulled sooner would
fight a player looking ahead into the dark, which is the one thing
this game most wants them to do.

**Both rays must be cast in the same frame, and the target set
absolutely.** The camera *eases* toward `camWant`, so it is always a
little behind it. Ray the floor once at the finger's current pixel and
add the difference to `camWant` and you have measured the gap against
a camera that has not caught up yet — every move re-pays a debt
already owed, so a steady finger accelerates the pan and on release it
sails past and settles back. Ray the **start** pixel and the **current**
pixel with the camera as it is right now and the lag is in both rays
and cancels; then set `camWant` from the target the drag *started*
with, never `+=`. (Measured: one 6.2-unit drag became 7.5–15.7 units
depending only on how many `pointermove` events it took.) At the wall,
re-anchor the drag on the clamped value, or dragging back does nothing
until the finger has undone every pixel the clamp refused.

**On touch a tap and the start of a drag are the same event.** So every
press begins as a *provisional tap* and only becomes a pan once it has
travelled past `TAP_SLOP` or been held past `TAP_MS`. Orders are issued
on **release**, never on press — which is also what stops a pan from
dropping a lantern while the draft is waiting for a spot. Two pointers
cancel the tap outright and become pinch (zoom) plus twist (rotate,
behind a deadzone so a plain pinch does not spin the room).

Three things that bite:

- `setPointerCapture` **throws** if the pointer is already gone. Wrap
  it, or an exception loses the whole press.
- The canvas needs `touch-action: none` or the browser claims the
  gestures for scrolling, and the viewport needs `user-scalable=no` or
  a pinch zooms the *page*.
- **Tap targets do not scale with zoom.** Pick proxies are fixed world
  sizes, so zoomed out a child is a few pixels while a thumb is ~44 of
  them. `pickScale` grows the proxies with `halfH` to compensate.

Free twist is kept for desktop, but touch gets **quarter-turn buttons**
— an arbitrary angle is horrible to aim with two fingers and this room
has nothing that needs one.

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

You start with three children on an endless dark floor: one carrying
a lamp, one a bat, one a sword, standing in the light of a single
lantern.

- **There is ONE verb.** Tap the floor and every child that is not
  fighting walks there (`state.goto`). That is the whole control
  scheme. There is **no selection and no character panel**: a child is
  only ever tapped while the draft is holding an object out, waiting
  to know who gets it. A panel would only restate in words what is
  already drawn on the child — what it carries is in its fists, and
  how it is doing is the red pulse and the mark over its head.
- **Light is not a weapon and not a shelter.** It does exactly one
  thing: you can *see*. It does not slow a nightmare (it used to mire
  them at 17%; that is gone), it does not hurt one, and standing in it
  costs and saves nothing. **A child cannot fight what it cannot see**
  — engagement requires `lightAt(mare) >= SEE` — so the lamps decide
  which of two games you are playing: in the light you stand and
  fight, in the dark you run.
- **A hand holds a lamp or a weapon, never both.** `Lamp` is a `held`
  family, so it competes with sword/bat/wand for the same slot. Its
  belly gives `lampR` *and* takes `dmg`/`swingT` — measured, a fat one
  leaves a child swinging at about 45% of an empty hand. That trade is
  the whole composition problem and it must never get cheap.
- **Every light in a draft is CARRIED.** The hand's light group is
  `kind: 'light'` minus `floor`, so it only ever deals a `Lamp`. A
  floor lantern is a *place*, and a place is worthless to a class that
  never stands still — it was dealt for a while and it was always the
  dead card. They still exist: `placeLantern()` scatters them out in
  the dark on a timer, rolled from the same `Lantern` family through
  `propDrawFor`, and you find one by walking toward a glow. On a floor
  with no landmarks that is the only thing that can pull a class
  anywhere, and unlike a lost child it needs no beacon because it *is*
  one.
- **Fighting roots you, but nobody fights alone.** A child with a lit
  nightmare in reach plants its feet and swings until one of them is
  finished; it will not walk away and you cannot call it off. A child
  with nothing in reach but a lit nightmare within `HELP_R` walks over
  and piles on — so one that arrives in the lamplight is swarmed by
  whoever is free, instead of duelling one child while the rest walk
  past. `HELP_R` is kept short so it reads as piling on and never as
  hunting. The group still tears itself in half at every crossing, and
  waiting for the stragglers *is* the game. A child that is not
  engaged can always be walked away from something it never saw —
  that is the mercy that makes the dark playable.
- **Nightmares hunt children** (`nearestKid`), not furniture. They do
  not bite: they **frighten**, `MARE_SCARE` energy per second while in
  contact, and a child at zero is collected by its parents. Nobody is
  ever hurt — this is a baby school, do not escalate it. The rule that
  a drain must be *visible* still stands, and this one is: a monster
  standing on the child, a red pulse, a mark over the head, a sound.
  Nothing else takes energy — there is no idle drain, the dark itself
  costs nothing, and a child left alone recovers (`REGEN`).
- **A child is three numbers**: **energy**, **attack**, **speed** —
  and those are exactly what the card shows. Everything else a stat
  bag carries (`reach`, `swingT`, `rest`, `lampR`, `scale`, `drain`,
  `knock`) is a modifier on how those three play out, not a fourth
  pillar. There is no morale system.
- **The floor has no edge** and no pan limit. Tiles are a fixed
  `GRID×GRID` block that follows the view, snapped to `TILE`, each
  showing the variant its coordinate hashes to (plus a quarter-turn
  from the same hash). So it is infinite, deterministic — walk away
  and back and the same scuffs are there — and a constant number of
  draw calls. **Nothing is baked during play**: the variants are drawn
  once at boot. The darkness plane follows the view too. What replaces
  `clampPan` is `keepInFrame`, which only fires once the class is
  entirely out of frame, plus the ⌾ button and `space`.
- **The camera rides the FLOCK** — `flockAt()`, the children who are
  actually walking. Whoever stopped to fight is deliberately left out:
  anchoring the frame to the one who stayed behind drags it backwards
  at exactly the moment you are deciding whether to leave them. A drag
  takes the camera back for `FOLLOW_HOLD` seconds so you can still
  look ahead into the dark, then it returns on its own.
- **You find the rest of the class in the dark.** `lost[]` children
  stand out there holding something, crying on a timer (a panned
  `squiggle`), with a question-mark mark that is the one thing visible
  through the black — it fades up as you close, so it is a direction
  and not an answer. Walk within `FIND_R` and they enlist. They are
  built ahead of time, one per frame, never in the same frame as a
  nightmare, and their kit is pre-seeded into the recipe so a found
  child costs ONE build and not two.
- **The class is meant to grow FAST** — four children by about level
  three, and up from there. `LOST_MIN`/`LOST_SPAN` is the whole dial:
  at 24-44 units a lost child was a two-way expedition that cost more
  than it brought, and at 11-23 it is a detour, which is what it
  should be. Several are out there at once (`LOST_MAX`) and the next
  is placed before you have reached the last.
- **Kills are the only economy.** `strike()` grants exactly 1 on a
  kill and nothing else fills the bar, so the number under it is *how
  many more nightmares*. The FIRST nightmare buys the first card
  (`xpNeed` starts at 1) — a player has to be shown what the bar is
  for before they can want it — and `XP_STEP` keeps them coming
  quickly after it. When it fills the world STOPS (`state.paused`
  zeroes `dt`, rendering continues) and a HAND of five generated
  objects is dealt — one lamp and four things to carry — of which you
  keep one, handing it to a child you then tap. There is no currency.
- **The tempo is spawn-gated, not fight-gated.** Measured: a class
  parked in the light kills a nightmare almost exactly as fast as one
  arrives, so `MARE_EVERY` *is* the pace of the whole game. Two
  numbers were badly wrong when this was first built and both were
  found by measuring, not by playing: nightmares at `.5` units/second
  from a spawn ring of 19 took **fifty seconds** to reach anybody, and
  a knockback of `2.6` threw them past a rooted child's reach so a
  fight was one hit every six seconds and nothing ever died.
- **The title screen** (`#start`, `state.started`) is also the load
  screen: the class is built one child per frame behind it, so the
  ~20 ms build cost lands while nobody is playing. `started` and
  `paused` are separate flags because they stop the world for opposite
  reasons — one holds a game that has not begun, the other freezes one
  in progress.
- **`frame()` and `pump()`** are the debug pair (`window.__game`). The
  loop is a named function so `pump(n)` can drive it by hand, because
  a hidden panel throttles rAF to a crawl and every measurement taken
  off one is a lie. It yields through a **MessageChannel**: a
  `setTimeout` is clamped to ~1s in a hidden tab, and a microtask
  never lets the event loop run at all, so the page hangs and nothing
  can read the result.

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

**Add an item family:** see §10. One file, one line in
`src/items/index.js`.

---

## 10. Objects — the item system

### The one idea: the stats ARE the drawing

An item is a seeded bag of params, and that same bag drives `draw()`
**and** `statsOf()`. A sword that rolled a long blade *is* drawn long
and *does* reach further; a lantern with a fat bowl *is* drawn fat and
*does* light a bigger circle. You can read an item's power off the
paper the way you can read a character's species off its ears.

Two rules fall out of that, and they are the ones to enforce in
review: **never add a stat with no visible consequence**, and **never
draw a feature that means nothing.**

### One drawing, three hosts

Every family draws itself **once**, in a `REF`-sized box (96 px) with
the origin at its **anchor** and up **negative** — the same convention
`scenery.js` uses. `stamp()` then plants that drawing wherever it is
needed:

```
the draft card   ·   the floor prop   ·   the fist of a child
```

The anchor is the **grip** for `held`/`offhand`, the **head contact**
for `worn`, the **base** for standing floor things, and the **centre**
for flat things and charms.

**It scales through `ctx.scale`, never by multiplying the numbers.**
That matters more than it looks: every decision inside `Sketch` (the
`w >= 1.2` granulation gate, the 2.2 px resample floor, the `n < 3`
bail to a plain line) is made in *user* units, before the transform.
Scaling the canvas gives the identical drawing — grain and all — at
another size. Scaling your own numbers crosses those thresholds,
shifts the whole random stream, and quietly gives you a *different*
item. Keep the factor inside roughly `[.6, 2]`; `REF = 96` was chosen
so all three hosts land in that band.

### Ranks are a medium, not a colour

| rank | look | roll | mods |
|---|---|---|---|
| `sketch` | plain graphite, one contour | ×.85–1.05 | 0 |
| `inked` | a second, confident darker pass | ×1.0–1.25 | 1 |
| `gilded` | gleam ticks + a lighter inner fill | ×1.2–1.5 | 2 |
| `nightmare` | dense scribble, barbs, a harder line | ×1.5–2.0 | 2 **+ a curse** |

Every family closes its shapes through **`finish(s, pts, rank, o)`**,
which is to items what `F.media.*` is to parts. No family may draw its
own rank look — that is what keeps the whole catalogue legible and
lets a twelfth family arrive without breaking the ladder. Pass
`{ F }` through when the item is being drawn *on a character*, and
`finish` routes it through that character's own medium.

`nightmare` is the devil deal: the best numbers in the game on an
object drawn by *them*, and it always carries a curse.

### Favour — the toybox learns what you like

Picking a family makes it both **commoner** and **better**: its draft
weight rises and its rank ladder tilts, while every other family
fades. There is no pool to maintain and no currency — favour is just a
multiplier over generation, which is what keeps the whole economy
procedural.

### The hand — what a draft is made of

`HAND` in `items/index.js` is the shape of a draft: one **lamp** and
four from the **kit**. The lamp is guaranteed because seeing is the
only thing the room can run out of, and a draft that failed to offer
it killed the run by shuffle rather than by anything you did. The
light group is `kind: 'light'` **minus `floor`** — every card in a
draft is something a child carries, because a floor lantern is a place
and a place is worthless to a class that never stands still. Favour
still steers *which* family and *what rank* inside each group, and the
kit half is where the gamble lives.

`Toy` and `Bed` are still registered, still drawn and still on
`items.html`, but no group picks them: the room stopped dealing
furniture when it stopped having any. A family is a drawing first and
a game rule second, so they were left in rather than deleted.

The card copy is three separate statements — `copy.what` (flavour),
`copy.does` (the numbers, read off the bag) and `copy.costs` (the
curse) — printed as three paragraphs, because run together as one
sentence the upgrade hides inside the flavour. `desc` keeps the joined
one-liner for tooltips.

Names are **bare** — `nameItem` returns "long inked bat", not "a long
inked bat". A name is a card heading and a kit row far more often than
it is a word in a sentence; `withArticle()` puts the article back for
the log lines, which are prose.

### The family contract

```js
export const Sword = {
  id: 'sword', slot: 'held', noun: 'sword', weight: 10,
  // floor families also declare kind: 'light' | 'toy' | 'bed'
  gen(rng, C)  { ... },   // C = { rank, pow, wpick }; pow is the rank's multiplier
  statsOf(P)   { return { add: {...}, mul: {...} } },   // PURE
  fxOf(P)      { ... },   // fear / sticky / throw / chill / lull / thrift / familiar
  patchOf(P)   { ... },   // mutation slot: a recipe patch
  objOf(P)     { ... },   // floor slot: { kind, wU, hU, r, fuel, dur, play, rest }
  adj(P), desc(P),        // the name and one line of card copy
  draw(s, P, F) { ... },  // REF space, origin at the anchor, up negative
};
```

Slots: `held` · `offhand` · `worn` · `charm` · `mutation` · `floor`.

**The drawing must be deterministic from `P`.** This is the rule that
bites. The same art is baked once as a floor prop but re-drawn every
boil frame as a character part — so anything decided with `s.jr()`
*shimmers* at 1 Hz on a child. Every shape, count and position comes
from `P`, rolled in `gen()`. `s.jr()` is only for sub-linewidth
jitter, which is the boil and is wanted.

### How an item reaches a body

`src/parts/gear.js` registers three normal parts. Their params are
deliberately tiny — `{ family, rank, seed }` — and the shape is
re-derived (memoised) from them, so a recipe stays small and JSON
round-trips, and the object in the fist is guaranteed to be the object
the card showed.

**The gear bone sits at the SHOULDER, not the hand.** Bones are flat
siblings; there is no parenting in the rig. So a held bone is placed
at exactly the arm's origin and `anim.js` hands it the arm's finished
transform in a second pass (`GEAR`), which makes the object swing
correctly in every pose — including poses nobody has written yet. The
item is then drawn at the hand's own coordinates, which `layout.js`
publishes as **`B.grip(side)`** — the muzzle lesson again: publish
where the thing landed, and the parts that sit on it never learn how
it got there. `Arms.draw` reads the same anchor, so the two can never
disagree.

Draw orders: `Held`/`Offhand` take **0** (the one free slot: in front
of the arm, still behind the head), and `Worn` shares **7** with
`Crest`, winning on registry order the way Eyes/Nose/Mouth already do.
The rig's 16-slot block is otherwise full — see §6b before choosing
anything else.

### What an object can actually do

Beyond the stat bag, `fxOf(P)` returns effects the room reads. **Units
are the contract**: everything is a radius in world units except
`sticky` (seconds) and `throw` (an object). Return a 0–1 "strength"
where a radius is expected and it silently never fires — the room is
26 units across, so a believable earshot is 2 to 6.

| effect | what it does | drawn as |
|---|---|---|
| `fear` | on a hit, every nightmare in range flinches | a chalk ring |
| `chill` | nightmares in range are mired — light no longer does this, so a charm is the only thing that can | a chalk ring |
| `lull` | children in range get their courage back faster | a chalk ring |
| `thrift` | lanterns in range burn longer | a chalk ring |
| `sticky` | a nightmare this child hits stays mired | — |
| `throw` | the child lobs a drawn marble while fighting | a flying billboard |
| `familiar` | a live doodle animal trails the child and bites | a whole character |

A familiar is a **real character**, built from the same rig as
everybody else, so it can be a cat, a dog or a small nightmare
depending on what the doll was made in the shape of. It is the only
thing in the room with a mind of its own — which is exactly why it
belongs to an object and not to a child: the rule that *children do
nothing on their own* has to stay true, and an object is allowed to be
the exception because you chose it.

**Energy is the join.** The dark burns it, a bed gives it back, and at
zero the child goes home — so anything that adds `maxStam` or lowers
`drain` buys time in the same currency a lantern buys. That is what
makes a shield, a crown or a hat worth as much as a sword, and it is
why every point of it has to be real.

There is deliberately **no morale stat**. An earlier draft had `nerve`
and a nightmare `menace`, and a child could freeze and refuse orders;
it is gone. A child that will not do what you clicked is a child you
cannot read, and the three numbers on the card are the whole contract.

### Mutations rebuild the child

A `mutation` item has no drawing on the body at all: it merges a
**recipe patch** and rebuilds the character. That costs ~20 ms, so it
may only ever happen while the draft has the world stopped. Three
things must be re-pointed on a rebuild or they rot silently: the
cached material list (the light tint would keep writing to disposed
materials and the new child would never light), the feet lift (the
animator never writes `face.group`), and the depth rank (a fresh face
has `rank === null`, which the board sort re-stamps for free). The
animator's getter must read the **live** face — `() => k.face`, never
a closure over the original.
