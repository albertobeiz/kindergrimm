# Working on drawai

**Read `ARCHITECTURE.md` first.** It defines the part contract, the two
coordinate systems and the rules that keep everything looking like one
drawing. Most tasks here are "add a part type" or "add a variant", and
that document is written to make those mechanical.

## Run it

```bash
python3 serve.py
```

`index.html` is the editor, `crowd.html` is a 7×5 page of live
characters. `serve.py` sends `no-store` on purpose: browsers cache ES
modules by URL, and a stale module makes an edited file look like a
phantom `SyntaxError`.

## The short rules

- Adding a part = one file in `src/parts/` + one line in
  `src/parts/index.js`. Do not edit `rig.js` for this.
- Adding a **species** = one entry of weights in `src/species.js`.
  A species loads the dice at generation time; it never reaches into
  `draw()`.
- But weights alone give you *a kid in a costume*. A species that
  needs a different HEAD gets a skull param the profile sets (see
  `muzzle`), and a species that needs a shape nobody else could have
  gets its own part with `species: ['bird']`. Prefer the cheaper
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

## Style

The look is graphite on cream paper, ported from the technique in
kengocodes/cyber-crowd: wobbling ribbon strokes, dry granulation, wrist
overshoots, and fills that are real techniques rather than flat colour.
The register is doodle/cartoon-dark — cute creatures with black void
eyes, ears and horns — after Fran Ferriz and The Binding of Isaac.
Keep the hand; vary the forms.

## Verifying

Screenshots in a background browser panel can be misleading: the
browser throttles `requestAnimationFrame` when the page is not
visible, so a scene can look frozen or slow when it is fine. Measure
before concluding anything about performance (a character costs ~20ms
to build).
