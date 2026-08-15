// Part factory: draws BOIL_FRAMES redrawn variants of a doodle per
// STATE (eye open/closed, mouth idle/open...) onto canvases and wraps
// them as one textured plane with a chosen pivot. Animation is then
// two things: swapping state textures, and transforming the bone
// (the THREE.Group) the plane hangs from.
//
// U is chosen so parts draw at cyber-crowd's native pixel scale
// (face scale s ≈ 65-90 px) — the granulation constants port as-is.
import * as THREE from 'three';
import { Sketch } from './sketch.js';
import { hashStr } from './rng.js';

// Render settings. `U` is only RESOLUTION: every part sizes itself in
// world units (px / U) and the rig places bones the same way, so a
// smaller U yields the same layout drawn on smaller canvases. The
// crowd scene turns both of these down — 35 faces at editor quality
// would cost hundreds of megabytes of canvas.
export let U = 160;              // canvas px per world unit
export let BOIL_FRAMES = 3;

export function setRender({ u, frames } = {}) {
  if (u) U = u;
  if (frames) BOIL_FRAMES = frames;
}

export function makePart({ name, wU, hU, pivot = [.5, .5], states = ['idle'], draw, seed }) {
  const frames = {}, canvases = {};
  const W = Math.max(4, Math.round(wU * U)), H = Math.max(4, Math.round(hU * U));
  // States are drawn LAZILY: only the resting state is paid for at
  // build time. An expression nobody makes never costs a canvas —
  // that is what lets every part carry a full emotional repertoire
  // without the crowd paying for it 35 times over.
  function ensure(st) {
    if (frames[st]) return;
    frames[st] = []; canvases[st] = [];
    for (let f = 0; f < BOIL_FRAMES; f++) {
      const s = new Sketch(W, H);
      s.boil(hashStr(`${seed}:${name}:${st}:${f}`));
      draw(s, st);
      const tex = new THREE.CanvasTexture(s.canvas);
      tex.anisotropy = 4;
      frames[st].push(tex);
      canvases[st].push(s.canvas);
    }
  }
  ensure(states[0]);
  const geo = new THREE.PlaneGeometry(wU, hU);
  geo.translate((0.5 - pivot[0]) * wU, (0.5 - pivot[1]) * hU, 0);
  const matl = new THREE.MeshBasicMaterial({
    map: frames[states[0]][0], transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, matl);
  const h = hashStr(`${seed}:${name}`);
  const part = {
    name, mesh, matl, geo, frames, canvases, states,
    fps: .85 + (h % 100) / 130,      // per-part boil cadence, out of sync on purpose
    off: (h >>> 8) % 10,
    cur: { state: states[0], frame: 0 },
    setState(st) {
      if (part.cur.state === st || !states.includes(st)) return;
      ensure(st);
      part.cur.state = st; apply();
    },
    setFrame(f) { f = ((f % BOIL_FRAMES) + BOIL_FRAMES) % BOIL_FRAMES; if (part.cur.frame !== f) { part.cur.frame = f; apply(); } },
    // alpha of the CURRENT canvas at uv — lets clicks pass through transparent px
    alphaAt(u, v) {
      const c = canvases[part.cur.state][part.cur.frame];
      const x = Math.min(c.width - 1, (u * c.width) | 0);
      const y = Math.min(c.height - 1, ((1 - v) * c.height) | 0);
      return c.getContext('2d').getImageData(x, y, 1, 1).data[3];
    },
    dispose() {
      geo.dispose(); matl.dispose();
      for (const st in frames) frames[st].forEach(t => t.dispose());
    },
  };
  function apply() { matl.map = frames[part.cur.state][part.cur.frame]; }
  return part;
}
