// The page everything is drawn on: cream stock, a signature in the
// corner, fold creases, and a layer of paper tooth ON TOP of the art
// (paper-colored speckle, invisible against the page, breaking up the
// graphite so it reads as pigment sitting in the grain).
import * as THREE from 'three';
import { PAPER, PR, Sketch } from './sketch.js';

// a floor: one long pencil line with a few grass ticks and scuffs
// under it. Scenes stand characters on this using F.B.floorY.
export function makeFloorLine(widthU) {
  const PXW = Math.min(2048, Math.round(widthU * 150)), PXH = 44;
  const s = new Sketch(PXW, PXH);
  s.boil((Math.random() * 1e9) | 0);
  const y = 14;
  const pts = [];
  for (let x = 8; x <= PXW - 8; x += 60) pts.push([x, y + s.jr(-1.5, 1.5)]);
  s.sline(pts, 2.4, .5);
  // the odd second pass where the pencil went back over it
  if (s.chance(.7)) {
    const a = s.jr(.15, .7), b = a + s.jr(.1, .25);
    s.sline(pts.slice((pts.length * a) | 0, (pts.length * b) | 0 + 2), 2, .3);
  }
  for (let i = 0; i < PXW / 38; i++) {
    const x = s.jr(12, PXW - 12);
    if (s.chance(.6)) s.sline([[x, y + 3], [x + s.jr(-4, 4), y + s.jr(9, 18)]], 1.3, .35);
    else s.sline([[x - s.jr(3, 7), y + s.jr(6, 10)], [x + s.jr(3, 7), y + s.jr(6, 10)]], 1.2, .25);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(widthU, PXH / 150),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(s.canvas), transparent: true, depthWrite: false }),
  );
  mesh.renderOrder = -50;
  // the drawn line is above the canvas centre; scenes place the mesh
  // at (floor target - lineDy) so the LINE is where the feet land
  mesh.userData.lineDy = (PXH / 2 - y) / 150;
  return mesh;
}

export function addPaper(scene, halfH) {
  const W = 1200, H = 900;
  const wU = 2 * halfH * (W / H) * 1.6, hU = 2 * halfH * 1.6;

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const b = c.getContext('2d');
  b.fillStyle = PAPER; b.fillRect(0, 0, W, H);

  // the artist signed the page
  b.strokeStyle = 'rgba(60,55,48,.4)';
  b.lineCap = 'round'; b.lineJoin = 'round';
  b.lineWidth = 1.6;
  const sx0 = W - 130, sy0 = H - 46;
  b.beginPath();
  for (let k = 0; k <= 22; k++) {
    const x = sx0 + k * 3.4;
    const y = sy0 + Math.sin(k * 1.1) * 4.4 + Math.sin(k * 2.7) * 2 + (Math.random() - .5) * 1.8;
    k ? b.lineTo(x, y) : b.moveTo(x, y);
  }
  b.stroke();
  b.lineWidth = 1.2;
  b.strokeStyle = 'rgba(60,55,48,.25)';
  b.beginPath();
  b.moveTo(sx0 + 5, sy0 + 12);
  b.lineTo(sx0 + 68 + Math.random() * 10, sy0 + 10 + Math.random() * 4);
  b.stroke();

  // fold creases: a lighter ridge with a darker seam beside it
  const nCrease = 2 + (Math.random() < .5 ? 1 : 0);
  for (let i = 0; i < nCrease; i++) {
    const vert = Math.random() < .55;
    const pos = (0.15 + Math.random() * .7) * (vert ? W : H);
    const drift = 30 + Math.random() * 50, ph = Math.random() * 7;
    for (const [colr, wd, off] of [['rgba(255,254,246,.4)', 2, 0], ['rgba(84,76,62,.07)', 1.4, 1.8]]) {
      b.strokeStyle = colr; b.lineWidth = wd;
      b.beginPath();
      for (let k = 0; k <= 24; k++) {
        const t = k / 24;
        const main = pos + Math.sin(t * 2.4 + ph) * drift * .3 + (t - .5) * drift;
        const x = vert ? main + off : t * W;
        const y = vert ? t * H : main + off;
        k ? b.lineTo(x, y) : b.moveTo(x, y);
      }
      b.stroke();
    }
  }

  const page = new THREE.Mesh(
    new THREE.PlaneGeometry(wU, hU),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false }),
  );
  page.position.z = -2;
  page.renderOrder = -100;
  scene.add(page);

  const t = document.createElement('canvas');
  t.width = 1600; t.height = 1200;
  const tc = t.getContext('2d');
  const td = tc.createImageData(t.width, t.height);
  for (let i = 0; i < td.data.length; i += 4) {
    if (Math.random() < .09) {
      td.data[i] = PR[0]; td.data[i + 1] = PR[1]; td.data[i + 2] = PR[2];
      td.data[i + 3] = (25 + Math.random() * 70) | 0;
    }
  }
  tc.putImageData(td, 0, 0);
  const tooth = new THREE.Mesh(
    new THREE.PlaneGeometry(wU, hU),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(t), transparent: true, depthWrite: false }),
  );
  tooth.position.z = 1;
  // above everything, with room to spare: the game room gives each
  // character a block of 16 renderOrder slots, so a fixed 1000 would
  // sink into the crowd once there are ~60 of them on the page
  tooth.renderOrder = 1e6;
  scene.add(tooth);
}
