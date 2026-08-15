// ---------------------------------------------------------------
// THE THINGS IN THE ROOM.
//
// Scene furniture, not rig parts: these never animate, never emote,
// and are drawn straight through Sketch the way paper.js draws its
// floor line. Each one is a flat billboard standing on the floor —
// the scene yaws them to face the camera, so they are always drawn
// front-on and can be as flat as a sticker.
//
// Every draw function works in CANVAS PIXELS with the origin moved to
// the BASE of the object: x = 0 is its centre line, y = 0 is where it
// meets the floor, and up is negative. That way a prop is authored
// the way you would draw it standing on a table.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { Sketch, chaikin, circlePts } from './sketch.js';
import { hashStr } from './rng.js';

const PPU = 128;                 // canvas px per world unit

// A prop mesh: pivot at the bottom centre so `position.y = 0` stands
// it on the floor. Billboarding is the scene's job.
// `flat: true` for things that LIE on the floor (a bed, a rug). Those
// are drawn from above with the origin in the middle, and the scene
// lays them down — they are not billboards and never face the camera.
export function makeProp({ draw, wU, hU, seed = 'p', flat = false }) {
  const W = Math.max(8, Math.round(wU * PPU)), H = Math.max(8, Math.round(hU * PPU));
  const s = new Sketch(W, H);
  s.boil(hashStr(String(seed)));
  s.ctx.save();
  s.ctx.translate(W / 2, flat ? H / 2 : H);
  draw(s, W, H);
  s.ctx.restore();

  const tex = new THREE.CanvasTexture(s.canvas);
  tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(wU, hU);
  if (!flat) geo.translate(0, hU / 2, 0);      // upright: pivot at the feet
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  return mesh;
}

// the outline habit of this project: fill with paper so the floor
// doesn't show through, then put a wobbling contour on it
// Drawn HARDER than a face is. These sit on a floor that is darker
// than the page, at a distance, under a blur — a delicate contour
// just dissolves into the lino.
const solid = (s, pts, lw = 3.2) => {
  s.paperFill(pts);
  s.stroke(pts.concat([pts[0]]), lw, { taper: .1, amp: .8, alpha: 1 });
};

// ---- toys ------------------------------------------------------
// Every prop is authored against its OWN canvas (W wide, H tall, base
// at y=0 going up negative), so it fills the space it is given and
// `wU`/`hU` in PROPS are the object's real size in the room. Author
// them any smaller and they arrive on the floor as postage stamps.

export function drawBlocks(s, W, H) {
  const n = s.ri(2, 3), u = H / n;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.min(W * .92, u * s.jr(.86, 1.02)), h = u * s.jr(.9, 1);
    const bx = x + s.jr(-W * .06, W * .06);
    const sq = [[bx - w / 2, y], [bx + w / 2, y - s.jr(-3, 3)],
                [bx + w / 2, y - h], [bx - w / 2, y - h + s.jr(-3, 3)]];
    solid(s, sq, 3);
    // the letter nobody can read — and not always an A, or a room
    // full of blocks starts to look like an eye chart
    const cx = bx, cy = y - h * .5, r = w * .22;
    const mark = s.ri(0, 3);
    if (mark === 0) {
      s.sline([[cx - r, cy + r], [cx, cy - r], [cx + r, cy + r]], 2, .6);
      s.sline([[cx - r * .5, cy + r * .15], [cx + r * .5, cy + r * .15]], 1.8, .55);
    } else if (mark === 1) {
      s.sline([[cx - r, cy - r], [cx + r, cy + r]], 2, .6);
      s.sline([[cx + r, cy - r], [cx - r, cy + r]], 2, .6);
    } else if (mark === 2) {
      const o = circlePts(cx, cy, r, r, 12);
      s.sline(o.concat([o[0]]), 2, .6);
    }
    y -= h - 2;
    x = bx;
  }
}

export function drawBall(s, W, H) {
  const r = Math.min(W, H) * .46;
  const b = s.blobPts(0, -r, r, r * s.jr(.96, 1.04), s.jr(-.2, .2), .35);
  solid(s, b, 3);
  const band = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    band.push([-r + 2 * r * t, -r + Math.sin(Math.PI * t) * r * .45]);
  }
  s.sline(chaikin(band, false, 1), 2, .55);
  s.hatchFill(b, 6, -.7, .12, 1);
}

export function drawChair(s, W, H) {
  const w = W * .42, seat = -H * .44, back = -H * .96;
  s.sline([[-w, 0], [-w * .85, seat]], 2.6, .7);
  s.sline([[w, 0], [w * .85, seat]], 2.6, .7);
  const st = [[-w, seat], [w, seat], [w * .9, seat + H * .09], [-w * .9, seat + H * .09]];
  solid(s, st, 3);
  s.sline([[-w * .8, seat], [-w * .7, back]], 2.6, .7);
  s.sline([[w * .8, seat], [w * .7, back]], 2.6, .7);
  s.sline([[-w * .75, back + H * .1], [w * .75, back + H * .1]], 2.4, .6);
  s.sline([[-w * .72, back + H * .26], [w * .72, back + H * .26]], 2.2, .5);
}

export function drawCot(s, W, H) {
  const w = W * .46, h = H * .82;
  const box = [[-w, 0], [w, 0], [w, -h], [-w, -h]];
  solid(s, box, 3.2);
  for (let i = -3; i <= 3; i++)                       // the bars
    s.sline([[i * w / 3.6, -h * .12], [i * w / 3.6, -h + h * .08]], 2.2, .5);
  s.sline([[-w, -h], [w, -h]], 2.8, .65);
  const bl = s.blobPts(w * .35, -h * .38, w * .45, h * .3, s.jr(-.15, .15), .7);
  s.paperFill(bl);
  s.scribbleFill(bl, 4, .32);
  s.sline(bl.concat([bl[0]]), 2.2, .55);
}

export function drawPlant(s, W, H) {
  const pw = W * .26, ph = H * .38;
  const pot = [[-pw, 0], [pw, 0], [pw * .78, -ph], [-pw * .78, -ph]];
  solid(s, pot, 3);
  s.hatchFill(pot, 5, -.8, .18, 1.1);
  for (let i = 0; i < s.ri(5, 7); i++) {              // the leaves
    const a = -Math.PI / 2 + s.jr(-1.15, 1.15), L = s.jr(H * .34, H * .58);
    const tipX = Math.cos(a) * L, tipY = -ph + Math.sin(a) * L;
    const leaf = chaikin([[0, -ph], [tipX * .5 - Math.sin(a) * W * .09, tipY * .55],
                          [tipX, tipY], [tipX * .5 + Math.sin(a) * W * .09, tipY * .5]], true, 2);
    s.paperFill(leaf);
    s.sline(leaf.concat([leaf[0]]), 2.2, .55);
  }
}

export function drawTeddy(s, W, H) {
  const r = Math.min(W * .42, H * .27);
  const body = s.blobPts(0, -r * 1.1, r * .95, r * 1.05, s.jr(-.1, .1), .5);
  solid(s, body, 2.8);
  const head = s.blobPts(0, -r * 2.5, r * .8, r * .76, s.jr(-.1, .1), .45);
  solid(s, head, 2.8);
  for (const sd of [-1, 1]) {
    const e = s.blobPts(sd * r * .62, -r * 3.06, r * .31, r * .31, 0, .5);
    solid(s, e, 2.4);
  }
  for (const sd of [-1, 1]) {                          // the void eyes
    s.ctx.fillStyle = s.inkA(.92);
    s.wobbly(sd * r * .28, -r * 2.6, r * .14, r * .16);
    s.ctx.fill();
  }
  s.sline([[-r * .2, -r * 2.24], [r * .2, -r * 2.24]], 1.8, .65);
}

export function drawCrayons(s, W, H) {
  const pw = W * .3, ph = H * .42;
  const pot = [[-pw, 0], [pw, 0], [pw * .85, -ph], [-pw * .85, -ph]];
  for (let i = 0; i < s.ri(5, 7); i++) {               // sticking out at all angles
    const x = s.jr(-pw * .7, pw * .7), a = s.jr(-.5, .5), L = s.jr(H * .32, H * .55);
    s.stroke([[x, -ph * .6], [x + Math.sin(a) * L, -ph - Math.cos(a) * L]], 6,
      { taper: .15, alpha: .85, amp: .5 });
  }
  solid(s, pot, 3);
  s.hatchFill(pot, 4.5, -.7, .2, 1.1);
}

// ---- things that lie on the floor ------------------------------
// A bed seen FROM ABOVE, origin in the middle: mattress, a pillow at
// one end, and a blanket turned down the way a nursery bed is made.
export function drawBedTop(s, W, H) {
  const w = W * .44, h = H * .46;
  const mat = [[-w, -h], [w, -h], [w * 1.02, h], [-w * 1.02, h]];
  s.paperFill(mat);
  s.stroke(mat.concat([mat[0]]), 3.4, { taper: .08, amp: .7, alpha: 1 });
  s.hatchFill(mat, 9, -.5, .10, 1.1);

  // the pillow
  const pil = s.blobPts(0, -h * .62, w * .74, h * .2, s.jr(-.06, .06), .45);
  s.paperFill(pil);
  s.stroke(pil.concat([pil[0]]), 2.6, { taper: .1, amp: .6 });
  s.sline([[-w * .4, -h * .62], [w * .4, -h * .6]], 1.6, .3);

  // the blanket, turned down, with a couple of creases
  const bl = [[-w * .98, -h * .2], [w * .98, -h * .22], [w * .96, h * .9], [-w * .96, h * .92]];
  s.paperFill(bl);
  s.stroke(bl.concat([bl[0]]), 2.8, { taper: .08, amp: .6 });
  s.scribbleFill(bl, 7, .13);
  for (let i = 0; i < 3; i++) {
    const y = -h * .05 + i * h * .3;
    s.sline([[-w * .82, y + s.jr(-3, 3)], [w * .82, y + s.jr(-3, 3)]], 1.5, .22);
  }
  s.sline([[-w * .98, -h * .2], [w * .98, -h * .22]], 2.4, .45);
}

// ---- the lights ------------------------------------------------
// A torch: cheap, small, and gone in a minute. The thing you put down
// when you have nothing better and something is coming.
export function drawTorch(s, W, H) {
  const w = W * .12;
  s.stroke([[0, 0], [s.jr(-3, 3), -H * .68]], w * 2.2, { taper: .18, alpha: .9 });
  const head = s.blobPts(0, -H * .76, W * .2, H * .13, s.jr(-.1, .1), .6);
  s.paperFill(head);
  s.stroke(head.concat([head[0]]), 2.6, { taper: .12, amp: .8, alpha: 1 });
  const fl = chaikin([[0, -H * .8], [W * .13, -H * .88], [0, -H * .99], [-W * .13, -H * .88]], true, 2);
  s.ctx.fillStyle = s.inkA(.4);
  s.poly(fl, true); s.ctx.fill();
  for (let i = 0; i < 5; i++) {                       // the sparks coming off it
    const a = -Math.PI / 2 + s.jr(-1, 1), r = H * s.jr(.1, .18);
    s.sline([[Math.cos(a) * r * .5, -H * .86 + Math.sin(a) * r * .5],
             [Math.cos(a) * r, -H * .86 + Math.sin(a) * r]], 1.4, .45);
  }
}

// The big one: a paper shade on a stand, throwing light across half
// the room. Expensive, and worth it.
export function drawAreaLantern(s, W, H) {
  const legW = W * .3;
  s.sline([[-legW, 0], [-legW * .3, -H * .34]], 3, .7);
  s.sline([[legW, 0], [legW * .3, -H * .34]], 3, .7);
  s.sline([[0, 0], [0, -H * .34]], 2.6, .5);
  s.stroke([[0, -H * .3], [s.jr(-2, 2), -H * .56]], W * .07, { taper: .18, alpha: .85 });
  // the shade: a wide cone
  const shade = [[-W * .46, -H * .58], [W * .46, -H * .58], [W * .2, -H * .93], [-W * .2, -H * .93]];
  s.paperFill(shade);
  s.stroke(shade.concat([shade[0]]), 3.4, { taper: .08, amp: .7, alpha: 1 });
  s.hatchFill(shade, 6, -.6, .14, 1.1);
  // and the glow under it
  for (let i = 0; i < 7; i++) {
    const x = -W * .38 + (i / 6) * W * .76;
    s.sline([[x, -H * .55], [x * 1.5, -H * .34]], 1.6, .4);
  }
  s.ctx.fillStyle = s.inkA(.42);
  s.wobbly(0, -H * .6, W * .14, H * .04);
  s.ctx.fill();
}

// ---- the thing you are defending -------------------------------
// The nightlight in the middle of the room. Everything the game does
// happens because this is still lit.
export function drawNightlight(s, W, H) {
  const baseW = W * .34, stemH = H * .56, bulbR = Math.min(W * .28, H * .2);
  const baseH = H * .12;
  const base = [[-baseW, 0], [baseW, 0], [baseW * .7, -baseH], [-baseW * .7, -baseH]];
  solid(s, base, 3.2);
  s.hatchFill(base, 4.5, -.7, .2, 1.1);
  s.stroke([[0, -baseH * .8], [s.jr(-2, 2), -stemH]], W * .07, { taper: .2, alpha: .85 });
  const bulb = s.blobPts(0, -stemH - bulbR * .8, bulbR, bulbR * 1.05, s.jr(-.1, .1), .35);
  s.paperFill(bulb);
  s.stroke(bulb.concat([bulb[0]]), 3.2, { taper: .1, amp: .6 });
  // the rays: a child draws light as spokes, so we do too
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + s.jr(-.06, .06);
    const r0 = bulbR * 1.25, r1 = bulbR * s.jr(1.5, 1.95);
    s.sline([[Math.cos(a) * r0, -stemH - bulbR * .8 + Math.sin(a) * r0],
             [Math.cos(a) * r1, -stemH - bulbR * .8 + Math.sin(a) * r1]], 1.8, .5);
  }
  s.ctx.fillStyle = s.inkA(.5);
  s.wobbly(0, -stemH - bulbR * .8, bulbR * .22, bulbR * .26);
  s.ctx.fill();
}

// ---- the lantern the player puts down ---------------------------
export function drawLantern(s, W, H) {
  const w = W * .34, h = H * .74;
  const body = [[-w, 0], [w, 0], [w * .8, -h], [-w * .8, -h]];
  s.paperFill(body);
  s.stroke(body.concat([body[0]]), 3, { taper: .12, amp: .7, alpha: 1 });
  s.sline([[-w * .75, -h * .28], [w * .75, -h * .28]], 2, .5);
  s.sline([[-w * .78, -h * .68], [w * .78, -h * .68]], 2, .5);
  // the handle
  const hd = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (i / 10);
    hd.push([Math.cos(a) * -w * .7, -h - Math.sin(a) * H * .16]);
  }
  s.sline(hd, 2.4, .65);
  // the flame
  const fl = chaikin([[0, -h * .42], [4, -h * .6], [0, -h * .82], [-4, -h * .6]], true, 2);
  s.ctx.fillStyle = s.inkA(.45);
  s.poly(fl, true); s.ctx.fill();
}

// sizes are the object's REAL size in the room now — a child stands
// about 1.9 units tall, so a chair at 1.0 comes up to its waist
export const PROPS = [
  { draw: drawBlocks, wU: .55, hU: .95, weight: 2, solid: .2 },
  { draw: drawBall, wU: .6, hU: .6, weight: 3, solid: .22 },
  { draw: drawChair, wU: .75, hU: 1.05, weight: 2, solid: .26 },
  { draw: drawCot, wU: 1.7, hU: 1.0, weight: 2, solid: .5 },
  { draw: drawPlant, wU: 1.1, hU: 1.2, weight: 2, solid: .26 },
  { draw: drawTeddy, wU: .6, hU: .8, weight: 3, solid: .2 },
  { draw: drawCrayons, wU: .6, hU: .8, weight: 2, solid: .2 },
];
export const PROP_BAG = PROPS.flatMap(p => Array(p.weight).fill(p));
