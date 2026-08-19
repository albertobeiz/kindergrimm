# drawai

Procedural doodle characters, drawn as if by hand on cream paper,
rigged one part per bone so they can be animated and used later in
games.

**Adding a part type? Read [ARCHITECTURE.md](ARCHITECTURE.md).**

```bash
python3 serve.py
```

- `index.html` — the menu. The five scenes, and the only place they
  are linked from: no scene links to another. The two games get the
  same card on it.
- `orla.html` — **the class photo**: pick five children of ten and the
  photo is scored like a poker hand.
- `game.html` — **Kindergrimm**: a baby school in the dark.
- `editor.html` — one face, click a part to tune it, reroll or lock
  parts, seed and medium selectors, animation toggles.
- `crowd.html` — a 7×5 page of living faces, no editing. Click a face
  and it is someone else; `R` draws a new page.
- `items.html` — the toy shop: every object family × every rank, the
  contact sheet the art gets reviewed on.

## How it fits together

A face is a **recipe**: `{seed, media, color, parts:{...}}`. It is the
only state — the same JSON always redraws the same face, so a face can
be saved, shared and rebuilt inside a game at runtime.

- `src/sketch.js` — the hand. Strokes are filled ribbons with wobble,
  dry granulation and overshoots; fills are techniques (hatch,
  scribble, stipple, graphite, wash, oil daubs, chalk, marker).
- `src/media.js` — what the character is made of. A medium answers
  `tone` / `skin` / `edge`, so parts describe shapes and never pick a
  technique.
- `src/species.js` — what animal it is. A species is a table of loaded
  dice (dog → floppy ears, snout, spots, no hair), not new drawings,
  so adding one is data only.
- `src/layout.js` — every measurement two parts have to agree on: the
  head outline, the eye anchors, the body block.
- `src/parts/*.js` — one file per feature family (skull, eyes, mouth,
  hair, horns/ears, body, extras). `parts/index.js` is the registry:
  the ordered list of what is switched on.
- `src/rig.js` — recipe → bones → meshes. Generic: it knows nothing
  about eyes or arms, so adding a part never touches it.
- `src/anim.js` — boil, blink, gaze saccades, talk, sway and breath.
  Eyes pre-draw six states, so a glance is a texture swap.
- `src/crowd.js` — the crowd, plus the life director that makes one
  character glance, mutter or throw an emote every so often.

## License

Public domain, under [the Unlicense](LICENSE) — use it anywhere, for
anything, no strings. Attribution is not required, but a link back is
always appreciated.
