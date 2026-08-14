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
| `src/anim.js` | boil, blink, gaze, talk, sway, breath. | you add a behaviour |
| `src/part.js` | canvas/texture plumbing (`makePart`), render resolution. | almost never |
| `src/main.js` / `src/crowd.js` | the two scenes | new scene features |

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

`states: ['idle']` by default. Every state is drawn ahead of time into
its own texture, so animating is a texture swap — free at runtime.

- Eyes declare `['open','closed','left','right','up','down']`: blinking
  and glancing are swaps.
- Mouth declares `['idle','open']`: talking is a swap plus a jaw scale.
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
