# drawai — architecture, and how to add a part

Read this before touching the code. It is written so that adding a new
kind of part is a **small, local, mechanical** change: one new file,
one line in a registry, nothing else.

---

## 1. The one-paragraph version

A character is a **recipe** (plain JSON). The **rig** hands the recipe
to a **layout**, which computes every shared measurement once. Then
each **part** is asked what bones it wants and draws itself onto a
small canvas per bone. Those canvases become textures on flat planes
hanging off `THREE.Group` bones, which the **animator** moves. Drawing
is done by the **hand** (`sketch.js`) through a **medium**
(`media.js`), so every part looks like it was made by the same person
with the same pencil.

```
recipe ──► layout.js ──► F  (all shared geometry, colours, medium)
                          │
        parts/index.js ───┼──► for each part: bones(P,F) ──► canvas per bone
                          │                    draw(s,P,st,F,bone)
                          ▼
                       rig.js ──► THREE.Group of bones ──► anim.js
```

---

## 2. Files

| File | What lives there | Touch it when… |
|---|---|---|
| `src/sketch.js` | **The hand.** Strokes, fills, hatching, washes, oil daubs, geometry helpers. | you need a new *drawing technique* |
| `src/media.js` | **The material.** graphite/ink/watercolour/oil/chalk/marker; each answers `tone`/`skin`/`edge`. | you add a new medium |
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
  pivot: [.5, .5],       // optional: where the bone sits on the canvas
                         //   [.5,1] = top edge (part hangs downward)
  states: ['idle'],      // optional: extra pre-drawn textures (see §6)

  // params from a seeded rng — this is what makes one character differ
  // from another. Keep every value a plain number/string/bool so the
  // recipe stays JSON.
  gen: rng => ({ style: rng.pick(['a', 'b']), size: rng.r(.5, 1.5) }),

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

---

## 7. Recipe

```json
{ "seed": 12345, "media": "graphite", "color": "auto",
  "parts": { "eyes": { "params": { "type": "saucer" }, "lock": true, "rr": 2 } } }
```

Same JSON in, same character out, on any machine. `rr` re-rolls one
part; `lock` protects it from a global regenerate. This is the format a
game would ship.

---

## 8. Recipes for common jobs

**Add a variant to an existing part** (easiest, most common): add the
name to that part's weighted table in `gen`, add it to the `pick` list
in `meta`, and add an `else if` branch in `draw`. Nothing else.

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
