// ---------------------------------------------------------------
// THE TILE BAKERY — `gshape.js` cuts and stamps, this one WEAVES,
// TURNS and CRACKS. Four finishes in `gmedia.js` need a surface that
// parameters alone cannot say: a knit stitch, a lathe's ring grain, a
// printer's layer lines, a glaze's crazing. Every one of them is baked
// here, procedurally, into a canvas — nothing is loaded, the same way
// the studio is a hand-built room and the cyc is a gradient.
//
// THREE RULES.
//
// 1. A TILE IS BAKED ONCE. Every generator below is wrapped in a lazy
//    singleton, because the material factory caches on colour and a
//    palette would otherwise re-weave the same jumper twelve times.
//
// 2. A TILE MUST WRAP. It is laid on `solidGeometry`'s UVs, which come
//    straight off `SphereGeometry`: u runs once around the equator, v
//    from pole to pole. So a pattern is drawn with its neighbours
//    already present outside the edges, or built out of terms that are
//    periodic by construction, and the seam has nothing to show.
//
// 3. THE BODY ONLY. These land on the shell and never on a face
//    feature — a plate is an `ExtrudeGeometry` whose UVs are three's
//    world-space default, which is to say noise. `gmedia.js` enforces
//    that; this file only has to be worth laying down.
//
// A note on which way is up: a normal map here is OpenGL convention
// (+Y up) and `CanvasTexture` uploads with `flipY`, so canvas y runs
// OPPOSITE to v. That is why the green channel takes +dy and the red
// takes −dx below. Get it backwards and every bump becomes a dent —
// which is legible, but only once you know to look for it.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';

/** a 2D context of a given size, with the canvas kept alive by it. */
function surface(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c.getContext('2d', { willReadFrequently: true });
}

/** everything here tiles, so everything here repeats. */
function wrap(tex, rx, ry) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  // grazing angles are most of a toy's silhouette and that is exactly
  // where an unfiltered repeat turns to mush. three clamps this to
  // whatever the card actually supports.
  tex.anisotropy = 8;
  return tex;
}

/**
 * height field → tangent-space normal map.
 *
 * Central differences, wrapped at the edges so the derivative is
 * continuous across the seam too — a tile that wraps but whose
 * GRADIENT does not still draws a bright line down the back of the
 * head. Reads the red channel; ignores the rest.
 */
function normalFromHeight(ctx, strength) {
  const { width: w, height: h } = ctx.canvas;
  const src = ctx.getImageData(0, 0, w, h).data;
  const out = new ImageData(w, h);
  const d = out.data;
  const at = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // OpenGL tangent space, and `flipY` has already turned v over
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      d[i]     = (nx * .5 + .5) * 255;
      d[i + 1] = (ny * .5 + .5) * 255;
      d[i + 2] = (nz * .5 + .5) * 255;
      d[i + 3] = 255;
    }
  }
  const o = surface(w, h);
  o.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(o.canvas);
  // a normal map is DATA. Tag it sRGB and every slope comes out wrong.
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * blur a height field in place — WRAPPING.
 *
 * Canvas blur does not know the tile repeats: at the edges it mixes the
 * pattern with nothing, so every edge comes back slightly flattened and
 * the seam shows up on the toy as a fine line ruled around it. Which it
 * did, right across the crown of the first knitted head.
 *
 * So the tile is laid out three by three, blurred whole, and the middle
 * one taken back. Every edge then had a real neighbour to blur into.
 * It costs nine times the pixels of a blur that happens exactly once
 * per finish per page, which is nothing at all.
 */
function soften(ctx, px) {
  const { width: w, height: h } = ctx.canvas;
  const big = surface(w * 3, h * 3);
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) big.drawImage(ctx.canvas, x * w, y * h);
  const b = surface(w * 3, h * 3);
  b.filter = `blur(${px}px)`;
  b.drawImage(big.canvas, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(b.canvas, -w, -h);
  return ctx;
}

/** bake once, hand back forever. */
function once(fn) {
  let cached = null;
  return () => (cached ??= fn());
}

// ---- 1. KNIT ----------------------------------------------------------
// Stockinette: columns of V's, each one two yarn legs, every leg
// overlapping its neighbours. The overlap is drawn ADDITIVELY on
// purpose — where two legs cross, the height stacks, and that little
// bump is what reads as one strand passing over another. Modelling the
// over/under properly would need depth sorting for a bump nobody can
// see from across a shelf.
const KNIT = 8;                       // stitches per tile, both ways

export const knitNormal = once(() => {
  const N = 512, cell = N / KNIT;
  const g = surface(N, N);
  g.fillStyle = '#000';
  g.fillRect(0, 0, N, N);
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = 'rgba(255,255,255,.58)';
  g.lineWidth = cell * .28;
  g.lineCap = 'round';

  // A V IS TALLER THAN ITS CELL, and that is the whole trick. Its arms
  // have to reach up PAST the bottom of the V in the row above — a real
  // stitch is pulled through the one before it, so the two overlap. Stop
  // the arms inside the cell and the rows no longer touch: you get a
  // clean horizontal band of bare yarn every row, which on a sphere
  // reads as a dashed line ruled around the head. It did, on the first
  // pass; that is what these numbers are for.
  const TOP = -.38, BOT = .70;      // in cells, and BOT - 1 > TOP is the rule
  for (let row = -1; row <= KNIT; row++) {
    for (let col = -1; col <= KNIT; col++) {
      const x = col * cell, y = row * cell;
      for (const dir of [-1, 1]) {
        g.beginPath();
        g.moveTo(x + cell * .5, y + cell * BOT);
        g.quadraticCurveTo(x + cell * (.5 + dir * .24), y + cell * .30,
                           x + cell * (.5 + dir * .48), y + cell * TOP);
        g.stroke();
      }
    }
  }
  g.globalCompositeOperation = 'source-over';
  soften(g, cell * .075);
  return wrap(normalFromHeight(g, 2.8), 3, 1.5);
});

// ---- 2. TURNED WOOD ---------------------------------------------------
// A toy on a lathe takes its grain as RINGS around the spin axis, and
// the sphere's v runs pole to pole — so a ring is a band of constant
// v and the mapping is free. The wander across u is built from whole
// harmonics of u only, which is what makes it periodic and therefore
// seamless, rather than something that has to be drawn twice.
function woodProfile(depth) {
  const W = 256, H = 1024;
  const g = surface(W, H);
  const img = new ImageData(W, H);
  const d = img.data;
  const rnd = mulberry32(0x5EED); // deterministic: same grain every load
  // a few fixed harmonics of v, so the ring spacing is uneven the way
  // real growth rings are
  const bands = Array.from({ length: 5 }, () => [rnd() * 2 - 1, 1 + ((rnd() * 6) | 0)]);

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // The wander, in whole cycles of u only. It has to be BIG enough
      // to see: rings that run dead straight around a sphere read as a
      // machined thread, not a grain, and the first pass at a twelfth
      // of this was exactly that.
      const wob = Math.sin(u * Math.PI * 2) * .045 + Math.sin(u * Math.PI * 4 + 1.1) * .022;
      // and FEW enough to count. About twenty rings pole to pole is what
      // a turning this size shows; eighty is corrugation.
      let t = (v + wob) * 9;
      for (const [amp, k] of bands) t += amp * 1.6 * Math.sin((v + wob) * Math.PI * 2 * k);
      // a ring is a hard early-wood line with a soft late-wood fade
      const f = t - Math.floor(t);
      const ring = Math.pow(1 - Math.abs(f * 2 - 1), 2.4);
      const val = (1 - ring * depth) * 255;
      const i = (y * W + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = val;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return g;
}

/** the grain as ROUGHNESS: late wood drinks the light, early wood
 *  polishes. This is the half of wood you actually see on a painted
 *  toy, where the colour is the palette's and not the timber's. */
export const woodRough = once(() => {
  // SHALLOW on purpose. `roughnessMap` MULTIPLIES `material.roughness`,
  // so a full-contrast profile would take the early wood down to a
  // near-mirror and the toy would read as striped plastic. A ring is a
  // change of sheen, not a change of surface.
  const g = woodProfile(.42);
  const tex = new THREE.CanvasTexture(g.canvas);
  tex.colorSpace = THREE.NoColorSpace;      // data, not colour
  return wrap(tex, 1, 2);
});

/** and the same grain as a whisper of relief. */
export const woodNormal = once(() => wrap(normalFromHeight(soften(woodProfile(.85), 1.2), 1.5), 1, 2));

// ---- 5. PEARL FILM ----------------------------------------------------
// Where a thin film is THICKER, and therefore what colour it returns.
//
// This one exists because of a trap in three: without a thickness map,
// `iridescenceThicknessRange[0]` is dead — the shader takes the MAXIMUM
// and nothing else, so the whole toy is one flat film and the range you
// wrote is a lie. Give it a map and the low number wakes up, and a
// pearl gets what a pearl actually has: bands of colour that swirl over
// each other rather than one even sheen.
//
// It is built from WHOLE harmonics of u and v only, which is what makes
// it periodic — a smooth blob field is the one pattern that would show
// its seam most.
export const pearlThickness = once(() => {
  const N = 256;
  const g = surface(N, N);
  const img = new ImageData(N, N);
  const d = img.data;
  const TAU = Math.PI * 2;
  for (let y = 0; y < N; y++) {
    const v = y / N;
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const h = .5 + .5 * (
        .52 * Math.sin(TAU * (u + v) + .7) +
        .30 * Math.sin(TAU * (2 * u - v) + 2.4) +
        .18 * Math.sin(TAU * (u - 3 * v) + 4.1));
      const val = Math.max(0, Math.min(1, h)) * 255;
      const i = (y * N + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = val;   // the shader reads GREEN
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(g.canvas);
  tex.colorSpace = THREE.NoColorSpace;      // data, not colour
  return wrap(tex, 1, 1);                   // one big swirl, not a tile
});

// ---- 3. LAYER LINES ---------------------------------------------------
// The lab printing its own output. Layers stack perpendicular to the
// build axis, which is v again — so this is a pure function of v, a
// sawtooth with a rounded shoulder, and the tile can be four pixels
// wide without anyone knowing.
export const layerNormal = once(() => {
  const W = 8, H = 512, LAYERS = 42;
  const g = surface(W, H);
  const img = new ImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const t = (y / H) * LAYERS;
    const f = t - Math.floor(t);
    // each layer is a squat bead: rounded on top, cut sharp underneath
    const bead = Math.pow(Math.sin(f * Math.PI), .55);
    const val = bead * 255;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = val;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return wrap(normalFromHeight(g, 1.1), 1, 8);
});

// ---- 4. CRAZING -------------------------------------------------------
// The hairline map that opens up in an old glaze. Cracks are GROOVES,
// so they are drawn dark into a light field, and every stroke is drawn
// nine times — the tile and its eight neighbours — which is the
// cheapest way to make a scattered pattern wrap when it has no
// periodicity of its own.
export const crazeNormal = once(() => {
  const N = 512;
  const g = surface(N, N);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, N, N);
  g.strokeStyle = 'rgba(0,0,0,.85)';
  g.lineWidth = 1.6;
  g.lineCap = 'round';

  const rnd = mulberry32(0xC7A2);
  // walk a crack: short segments turning a little each time, so it
  // wanders like a split rather than a scratch
  const cracks = [];
  for (let i = 0; i < 34; i++) {
    const pts = [[rnd() * N, rnd() * N]];
    let a = rnd() * Math.PI * 2;
    const steps = 5 + ((rnd() * 7) | 0);
    for (let s = 0; s < steps; s++) {
      a += (rnd() - .5) * 1.1;
      const len = N * (.03 + rnd() * .07);
      const [px, py] = pts[pts.length - 1];
      pts.push([px + Math.cos(a) * len, py + Math.sin(a) * len]);
    }
    cracks.push(pts);
  }

  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      for (const pts of cracks) {
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, x + ox * N, y + oy * N));
        g.stroke();
      }
    }
  }
  soften(g, .9);
  return wrap(normalFromHeight(g, 2.6), 2, 1);
});
