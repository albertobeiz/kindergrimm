# drawai

Procedural doodle faces, drawn as if by hand on cream paper, rigged one
part per bone so they can be animated and used later in games.

```bash
python3 serve.py
```

- `index.html` — the editor: one face, click a part to tune it, reroll
  or lock parts, seed and medium selectors, animation toggles.
- `crowd.html` — a 7×5 page of living faces, no editing. Click a face
  and it is someone else; `R` draws a new page.

## How it fits together

A face is a **recipe**: `{seed, media, color, parts:{...}}`. It is the
only state — the same JSON always redraws the same face, so a face can
be saved, shared and rebuilt inside a game at runtime.

- `src/sketch.js` — the hand. Strokes are filled ribbons with wobble,
  dry granulation and overshoots; fills are techniques (hatch,
  scribble, stipple, graphite, wash, oil daubs, chalk, marker).
- `src/media.js` — what the face is made of. A medium answers `tone` /
  `skin` / `edge`, so parts describe shapes and never pick a technique.
- `src/parts/*.js` — one file per feature. Each declares how to
  generate its params, which bones it needs and how to draw itself in
  face coordinates.
- `src/facerig.js` — turns a recipe into a tree of bones with a drawn
  part hanging from each, and derives the shared layout (skull
  keypoints, eye positions, mouth width…).
- `src/anim.js` — boil, blink, gaze saccades, talk, sway and breath.
  Eyes pre-draw six states, so a glance is a texture swap.
- `src/crowd.js` — the crowd, plus the life director that makes one
  face glance, mutter or throw an emote every so often.
