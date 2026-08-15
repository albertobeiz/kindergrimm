// ---------------------------------------------------------------
// THE FLOOR OF THE SCHOOL, and the shadows on it.
//
// This is a REAL horizontal plane now (game.js lays it flat on XZ and
// orbits a camera over it), so nothing here may fake perspective: a
// painted vanishing point would swing around with the camera. Marks
// are drawn top-down and evenly, exactly as the draw-test prototype
// does its chunk floors, and the recession comes from the camera.
//
// The floor is deliberately DARKER than the cream page. That is most
// of why draw-test reads as a world and an empty sheet reads as a
// sketchbook — the children need something to stand out against.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { Sketch, chaikin } from './sketch.js';
import { makeRng, hashStr } from './rng.js';

// Deliberately muted. Under a lamp this reads as warm worn lino; if
// it were as bright as the page the light pools would blow out into
// white blanks and the room would stop feeling cosy.
export const FLOOR_COL = '#c3bca4';
export const ROOM_BG = '#07080c';

const TEX = 384;

// One floor tile, TILE world units square. Seeded, so the same tile
// index always redraws identically — and so no two tiles in the room
// carry the same scuffs.
export function makeFloorTexture(seed) {
  const rng = makeRng(hashStr(`floor:${seed}`));
  const s = new Sketch(TEX, TEX);
  s.boil(rng.ri(1, 1e9));
  const c = s.ctx;

  c.fillStyle = FLOOR_COL;
  c.fillRect(0, 0, TEX, TEX);

  // the tooth of the lino: a thousand specks of dirt in the grain
  for (let i = 0; i < 1500; i++) {
    c.fillStyle = `rgba(58,52,36,${Math.random() * .055})`;
    c.fillRect(Math.random() * TEX, Math.random() * TEX, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  // NO floorboards, and no long straight anything: a ruled line that
  // starts at a tile edge lines up with its neighbour's and the whole
  // floor turns back into graph paper. Everything here is short,
  // scattered and high-frequency, so the tile seams disappear into it.

  // a couple of faint mottles, small enough that they read as wear
  // rather than as clouds — and never big enough to clip at the tile
  // edge, which is what turns a soft blob into a visible seam
  for (let i = 0; i < 4; i++) {
    c.fillStyle = `rgba(96,88,64,${s.jr(.012, .028)})`;
    c.beginPath();
    c.ellipse(s.jr(70, TEX - 70), s.jr(70, TEX - 70), s.jr(26, 58), s.jr(20, 46), s.jr(0, 3), 0, Math.PI * 2);
    c.fill();
  }

  // hatch clusters — somebody scribbled here and never rubbed it out
  for (let i = 0; i < 26; i++) {
    const px = s.jr(20, TEX - 20), py = s.jr(20, TEX - 20);
    s.hatch(px, py, s.jr(18, 46), s.jr(10, 26), s.jr(-1.4, 1.4), s.ri(3, 5), s.jr(.06, .16));
  }

  // little tufts of scratch: three ticks leaning the same way
  for (let i = 0; i < 16; i++) {
    const gx = s.jr(15, TEX - 15), gy = s.jr(15, TEX - 15), a = s.jr(-1.3, -.3);
    for (let k = 0; k < 3; k++)
      s.sline([[gx + k * 4 - 4, gy], [gx + k * 5 - 5 + Math.cos(a) * s.jr(7, 15), gy + Math.sin(a) * s.jr(7, 15)]],
        1, .22);
  }

  // crumbs and pebbles and a dropped bead
  for (let i = 0; i < 12; i++) {
    const p = s.blobPts(s.jr(20, TEX - 20), s.jr(20, TEX - 20), s.jr(3, 8), s.jr(2, 5), s.jr(-.3, .3), .5);
    s.sline(p.concat([p[0]]), 1, .3);
  }

  // cracks in the lino
  for (let i = 0; i < rng.ri(1, 3); i++) {
    let x = s.jr(50, TEX - 50), y = s.jr(50, TEX - 50), a = rng.r(0, Math.PI * 2);
    const pts = [[x, y]];
    for (let k = 0; k < 4; k++) {
      a += s.jr(-.8, .8);
      x += Math.cos(a) * s.jr(14, 36); y += Math.sin(a) * s.jr(14, 36);
      pts.push([x, y]);
    }
    s.sline(chaikin(pts, false, 1), 1.2, .34);
  }

  // a spill nobody cleaned up: paint, juice, something worse
  if (rng.chance(.45)) {
    const sx = s.jr(60, TEX - 60), sy = s.jr(60, TEX - 60);
    const col = rng.chance(.5) ? 'rgba(122,54,45,.10)' : 'rgba(58,52,36,.09)';
    for (let k = 0; k < 3; k++) {
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(sx + s.jr(-12, 12), sy + s.jr(-9, 9), s.jr(10, 28), s.jr(8, 19), s.jr(0, 3), 0, Math.PI * 2);
      c.fill();
    }
  }

  const tex = new THREE.CanvasTexture(s.canvas);
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------
// SHADOWS — flat on the floor, yawed with the camera by the scene so
// the ellipse always lies across the screen. A handful are drawn once
// and shared, because 20 characters do not need 20 shadows.
// ---------------------------------------------------------------
export function makeShadowTextures(n = 4) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const W = 160, H = 80;
    const s = new Sketch(W, H);
    s.boil((Math.random() * 1e9) | 0);
    const cx = W / 2, cy = H / 2, rx = W * .34, ry = H * .3;
    for (let k = 0; k < 3; k++) {
      const b = s.blobPts(cx + s.jr(-3, 3), cy + s.jr(-2, 2), rx * s.jr(.9, 1.1), ry * s.jr(.85, 1.05), s.jr(-.08, .08), .45);
      s.sline(b.concat([b[0]]), 1.6, .22);
    }
    const body = s.blobPts(cx, cy, rx * .92, ry * .86, s.jr(-.05, .05), .5);
    s.scribbleFill(body, 3, .42);
    s.hatchFill(body, 3.4, s.jr(.2, .5), .3, 1.3);
    const tex = new THREE.CanvasTexture(s.canvas);
    tex.anisotropy = 4;
    out.push(tex);
  }
  return out;
}
