// ---------------------------------------------------------------
// how.html — the guide. Eleven steps, and every drawing on the page
// is made by the REAL generator: the same hand (sketch.js), the same
// layout, the same parts registry, the same animator. Nothing here
// is an illustration of the code, so the page cannot drift from it.
//
// Two kinds of demo:
//   FLAT   — a Sketch canvas. Parts draw in character coordinates
//            (px, y down, origin at the head's centre), and the rig
//            only splits them across canvases so the animator can
//            move them. On ONE canvas, in draw order, they compose
//            exactly — which is what makes steps 04-08 possible.
//   LIVE   — a small renderer of its own, with a real rig and a real
//            animator standing in it (steps 09-11).
// ---------------------------------------------------------------
import * as THREE from 'three';
import { Sketch, PAPER, ACCENTC } from './sketch.js';
import { setRender, U } from './part.js';
import { MEDIA, MEDIA_IDS } from './media.js';
import { SPECIES } from './species.js';
import { PARTS, newRecipe, buildCharacter, ensureParams } from './rig.js';
import { buildLayout } from './layout.js';
import { createAnimator } from './anim.js';
import { EXPRESSIONS } from './expressions.js';
import { POSES } from './poses/index.js';
import { makeFloorLine } from './paper.js';

setRender({ u: 128, frames: 3 });
THREE.ColorManagement.enabled = false;

const $ = id => document.getElementById(id);
const rnd = () => (Math.random() * 1e9) | 0;
const ACC = ACCENTC[0];                       // the muted red of a construction mark
const acc = a => `rgba(${ACC[0]},${ACC[1]},${ACC[2]},${a})`;
const ink = a => `rgba(31,29,26,${a})`;

// ---------------- small DOM helpers ----------------
function tile(host, w, h) {
  const s = new Sketch(w, h);
  s.boil(rnd());
  s.canvas.className = 'cv';
  host.appendChild(s.canvas);
  return s;
}

function cell(host, tag) {
  const d = document.createElement('div');
  d.className = 'cell';
  host.appendChild(d);
  const t = document.createElement('div');
  t.className = 'tag';
  t.textContent = tag;
  d.appendChild(t);
  return { box: d, tag: t, put: cv => d.insertBefore(cv, t) };
}

function btn(host, label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = () => fn(b);
  host.appendChild(b);
  return b;
}

function group(host, items, pick, current) {
  const bs = items.map(([id, label]) => btn(host, label, () => {
    bs.forEach(x => x.classList.remove('on'));
    bs[items.findIndex(i => i[0] === id)].classList.add('on');
    pick(id);
  }));
  const i = items.findIndex(x => x[0] === current);
  if (i >= 0) bs[i].classList.add('on');
  return bs;
}

function slider(host, label, min, max, val, step, fn) {
  const l = document.createElement('label');
  l.textContent = label;
  const r = document.createElement('input');
  r.type = 'range'; r.min = min; r.max = max; r.value = val; r.step = step;
  r.oninput = () => fn(+r.value);
  host.appendChild(l); host.appendChild(r);
  return r;
}

// ---------------- recipes, drawn flat ----------------
const paramsOf = r => Object.fromEntries(PARTS.map(d => [d.id, r.parts[d.id].params]));

function makeRecipe({ seed = rnd(), species = 'human', media = 'graphite', base = null } = {}) {
  const r = newRecipe(seed);
  r.species = species; r.media = media; r.base = base;
  ensureParams(r);
  return r;
}
const layoutOf = r => buildLayout(r, paramsOf(r));

// every (part, bone) this recipe actually draws, in draw order
function pieces(r, F) {
  const out = [];
  for (const def of PARTS) {
    if (def.species && !def.species.includes(r.species)) continue;
    if (def.base && !def.base.includes(r.base)) continue;
    const P = F.P[def.id];
    if (def.skip?.(P, F)) continue;
    for (const b of def.bones(P, F)) out.push({ def, P, b, order: b.order ?? def.order, i: out.length });
  }
  return out.sort((a, b) => a.order - b.order || a.i - b.i);
}

const paint = (s, e, F) => e.def.draw(s, e.P, e.def.states?.[0] ?? 'idle', F, e.b);

// fit a whole character into a canvas and leave the mapping behind,
// so a diagram can put a label next to an anchor afterwards
function stand(s, F, o = {}) {
  const pad = o.pad ?? 14, B = F.B;
  const y0 = F.s * (o.top ?? -1.75);
  const y1 = o.head ? F.s * 1.2 : B.floorY + F.s * (o.bot ?? .16);
  const cx = o.head ? 0 : (B.cx ?? 0) * .5;
  const halfW = o.head ? F.w * 1.55
    : Math.max(F.w * 1.8, B.halfW * 1.7 + Math.abs((B.cx ?? 0) - cx)) + F.s * .35;
  const k = Math.min((s.w - pad * 2) / (halfW * 2), (s.h - pad * 2) / (y1 - y0));
  const tx = s.w / 2 - cx * k, ty = (s.h - (y1 - y0) * k) / 2 - y0 * k;
  s.ctx.setTransform(k, 0, 0, k, tx, ty);
  return { k, tx, ty, to: (x, y) => [tx + x * k, ty + y * k] };
}

// ---------------- 01 · the pencil ----------------
// The whole look comes out of this one function, so it is worth
// taking apart. Every stroke below is a real s.stroke / s.sline /
// s.broken call; the only thing that changes is one option.
const LX = 450;                                  // where a demo stroke starts
const wave = (y, x0 = LX, x1 = 1160, n = 12, amp = 18) => {
  const p = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    p.push([x0 + t * (x1 - x0), y + Math.sin(t * 3.2) * amp]);
  }
  return p;
};

function rowLabel(s, y, name, note) {
  const c = s.ctx;
  c.textAlign = 'left';
  c.font = '25px ui-monospace, Menlo, monospace';
  c.fillStyle = ink(.62);
  c.fillText(name, 44, y - 8);
  c.font = '18px ui-monospace, Menlo, monospace';
  c.fillStyle = ink(.34);
  c.fillText(note, 44, y + 20);
}

function step1() {
  const draw = () => {
    // ---- A · one stroke, one habit at a time ----
    const host = $('d1');
    host.replaceChildren();
    const s = tile(host, 1200, 700);
    const c = s.ctx;
    const W = 15;

    rowLabel(s, 95, 'the points', 'what you hand it');
    const p0 = wave(95);
    c.strokeStyle = ink(.28); c.lineWidth = 1.4;
    c.beginPath(); p0.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    c.fillStyle = acc(.95);
    for (const p of p0) { c.beginPath(); c.arc(p[0], p[1], 5, 0, 7); c.fill(); }

    rowLabel(s, 230, 'the ribbon', 'amp: 0 · two rails, filled');
    s.stroke(wave(230), W, { amp: 0 });

    rowLabel(s, 365, 'the wander', 'amp: 9 · three sines');
    s.stroke(wave(365), W, { amp: 9 });

    rowLabel(s, 500, 'the flick', 'over: 18 · past both ends');
    s.stroke(wave(500), W, { amp: 9, over: 18 });

    rowLabel(s, 635, 'the ghost', 'ghost: true · thinner, again');
    s.stroke(wave(635), W, { amp: 9, over: 18, ghost: true });

    // ---- B · the same stroke, magnified ----
    const hostB = $('d1b');
    hostB.replaceChildren();
    const b = tile(hostB, 1200, 330);
    const bc = b.ctx;
    const K = 2.7, X0 = 40, X1 = 400, Y = 40, TX = 30, TY = 62;
    bc.setTransform(K, 0, 0, K, TX, TY);
    b.stroke(wave(Y, X0, X1, 12, 9), 15, { amp: 9, over: 20, ghost: true });
    bc.setTransform(1, 0, 0, 1, 0, 0);

    // three things you can only see this close, each pointed where
    // that habit always turns up
    const to = (x, y) => [TX + x * K, TY + y * K];
    const on = (t, dy) => {
      const x = X0 + t * (X1 - X0);
      const [px, py] = to(x, Y + Math.sin(t * 3.2) * 9);
      return [px, py + dy];
    };
    const notes = [
      ['the wrist runs past the end', to(X0 - 18, Y - 2), [96, 72]],
      ['crumbs, shed past the edge', on(.45, -24), [560, 66]],
      ['paper, bitten back in', on(.74, 26), [700, 288]],
    ];
    bc.font = '19px ui-monospace, Menlo, monospace';
    bc.lineWidth = 1.2;
    for (const [label, [px, py], [lx, ly]] of notes) {
      bc.strokeStyle = acc(.5);
      bc.beginPath(); bc.moveTo(px, py); bc.lineTo(lx, ly + (ly < py ? 6 : -14)); bc.stroke();
      bc.fillStyle = acc(.95);
      bc.fillText(label, lx, ly);
      bc.beginPath(); bc.arc(px, py, 3.2, 0, 7); bc.fill();
    }

    // ---- C · the three lines the hand can draw ----
    const hostC = $('d1c');
    hostC.replaceChildren();
    const t3 = tile(hostC, 1200, 430);
    rowLabel(t3, 100, 's.sline', 'detail · the pen sometimes lifts');
    t3.sline(wave(100), 2.4, .85);
    rowLabel(t3, 245, 's.stroke', 'mass · the ribbon above');
    t3.stroke(wave(245), 14, { ghost: true, over: 14 });
    rowLabel(t3, 390, 's.broken', 'contour · 2-3 passes, overlapping');
    t3.broken(wave(390, LX, 1160, 40, 18), 7, { ghost: true, over: 10 });
  };
  draw();
  btn($('c1'), 'draw again', draw);
}

// ---------------- 02 · the shape ----------------
function step2() {
  const host = $('d2'), ctl = $('c2');
  let wob = .55;
  const draw = () => {
    host.replaceChildren();
    const s = tile(host, 1080, 380);
    const c = s.ctx;
    const base = s.blobPts(0, 0, 118, 96, .15, wob);
    const at = dx => base.map(p => [p[0] + dx, p[1] + 190]);
    c.font = '19px ui-monospace, Menlo, monospace';

    // the points
    const a = at(190);
    c.fillStyle = acc(.9);
    for (const p of a) { c.beginPath(); c.arc(p[0], p[1], 3.4, 0, 7); c.fill(); }
    c.fillStyle = ink(.4); c.fillText('points', 145, 340);

    // the polygon
    const b = at(540);
    c.strokeStyle = ink(.55); c.lineWidth = 1.4;
    c.beginPath(); b.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
    c.fillStyle = ink(.4); c.fillText('polygon', 487, 340);

    // drawn by the hand, through the medium
    const d = at(890);
    MEDIA.graphite.tone(s, d, { style: 'hatch', gap: 9 });
    MEDIA.graphite.edge(s, d.concat([d[0]]), 4.6, {});
    c.fillStyle = ink(.4); c.fillText('drawn', 845, 340);
  };
  draw();
  slider(ctl, 'wobble', .05, 1.4, wob, .05, v => { wob = v; draw(); });
  btn(ctl, 'draw again', draw);
}

// ---------------- 03 · the material ----------------
const STYLES = [['black', 1], ['hatch', .72], ['scribble', .62], ['stipple', .5], ['light', .34]];

function step3() {
  const seed = rnd();
  // one shape, drawn from the same seed every time, so the only
  // difference between the tiles is the material
  const shapeIn = (s, cx, cy, rx, ry) => {
    s.boil(seed);
    const pts = s.blobPts(cx, cy, rx, ry, .1, .5);
    s.boil(seed + 11);
    return pts;
  };

  const host = $('d3');
  for (const id of MEDIA_IDS) {
    const s = new Sketch(360, 280);
    const pts = shapeIn(s, 180, 140, 112, 92);
    MEDIA[id].tone(s, pts, { style: 'hatch' });
    MEDIA[id].edge(s, pts.concat([pts[0]]), 5, {});
    s.canvas.className = 'cv';
    cell(host, MEDIA[id].label).put(s.canvas);
  }

  // …and the same medium answering the five densities a part can ask for
  const hostB = $('d3b');
  const row = mid => {
    hostB.replaceChildren();
    for (const [style, d] of STYLES) {
      const s = new Sketch(300, 250);
      const pts = shapeIn(s, 150, 118, 92, 76);
      MEDIA[mid].tone(s, pts, { style });
      MEDIA[mid].edge(s, pts.concat([pts[0]]), 4.4, {});
      s.canvas.className = 'cv';
      cell(hostB, `${style} · ${d}`).put(s.canvas);
    }
  };
  row('graphite');
  group($('c3'), MEDIA_IDS.map(id => [id, MEDIA[id].label]), row, 'graphite');
}

// ---------------- 04 · the head ----------------
const SHAPES = ['round', 'square', 'tall', 'drop', 'pear', 'lump', 'wide', 'bumpy', 'wonky'];
function step4() {
  const host = $('d4');
  const draw = () => {
    host.replaceChildren();
    const seed = rnd();
    for (const shape of SHAPES) {
      const r = makeRecipe({ seed, species: 'human' });
      const P = r.parts.skull.params;
      P.shape = shape; P.turn = 0; P.muzzle = 0; P.round = .97; P.press = 1;
      const F = layoutOf(r);
      const s = new Sketch(340, 340);
      s.boil(rnd());
      const poly = F.L.facePoly;
      const k = Math.min(300 / (F.w * 2.5), 300 / (F.s * 2.3), 1.5);
      s.ctx.setTransform(k, 0, 0, k, 170, 175);
      F.media.tone(s, poly, { style: 'light' });
      F.media.edge(s, poly.concat([poly[0]]), F.lwMain, {});
      s.canvas.className = 'cv';
      cell(host, shape).put(s.canvas);
    }
  };
  draw();
  btn($('c4'), 'draw again', draw);
}

// ---------------- 05 · the map ----------------
function step5() {
  const host = $('d5');
  const draw = () => {
    host.replaceChildren();
    const r = makeRecipe({ seed: rnd(), species: 'human', base: 'biped' });
    r.parts.skull.params.turn = 0;
    const F = layoutOf(r), B = F.B;
    const s = tile(host, 1320, 700);
    const t = stand(s, F, { pad: 46 });
    const c = s.ctx;

    // the drawing itself, kept faint: this step is about the numbers
    c.globalAlpha = .32;
    for (const e of pieces(r, F)) paint(s, e, F);
    c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);

    // …and the anchors every part reads instead of guessing
    const marks = [
      ['F.L.eyeX(-1)', F.L.eyeX(-1), F.L.ey0[-1], -1],
      ['F.L.noseY', F.L.nx, F.L.noseY, 1],
      ['F.L.my', F.L.mx, F.L.my, 1],
      ['F.B.shoulderX', -B.shoulderX, B.shoulderY, -1],
      ['F.B.grip(1)', ...(B.grip ? B.grip(1) : [B.hipX, B.hipY]), 1],
      ['F.B.hipX', -B.hipX, B.hipY, -1],
      ['F.B.floorY', 0, B.floorY, 1],
    ].map(([label, x, y, side]) => {
      const [px, py] = t.to(x, y);
      return { label, px, py, side, ly: py };
    });

    // labels are pushed apart down their own margin, so a low head
    // and a high shoulder never write over each other
    for (const side of [-1, 1]) {
      const col = marks.filter(m => m.side === side).sort((a, b) => a.py - b.py);
      let prev = -1e9;
      for (const m of col) { m.ly = Math.max(m.py, prev + 40); prev = m.ly; }
    }

    c.font = '19px ui-monospace, Menlo, monospace';
    c.lineWidth = 1.3;
    for (const m of marks) {
      const lx = m.side < 0 ? 300 : s.w - 300;
      c.strokeStyle = acc(.9);
      c.beginPath();
      c.moveTo(m.px - 8, m.py); c.lineTo(m.px + 8, m.py);
      c.moveTo(m.px, m.py - 8); c.lineTo(m.px, m.py + 8);
      c.stroke();
      c.strokeStyle = acc(.32);
      c.beginPath();
      c.moveTo(m.px + m.side * 11, m.py);
      c.lineTo(lx + m.side * 26, m.ly);
      c.lineTo(lx + m.side * 12, m.ly);
      c.stroke();
      c.fillStyle = acc(.95);
      c.textAlign = m.side < 0 ? 'right' : 'left';
      c.fillText(m.label, lx, m.ly + 6);
    }
    c.textAlign = 'left';
  };
  draw();
  btn($('c5'), 'draw again', draw);
}

// ---------------- 06 · the parts ----------------
function step6() {
  const host = $('d6'), chips = $('p6');
  let timer = null, list = [], F = null, s = null, at = 0, byId = new Map();

  const start = () => {
    clearInterval(timer);
    host.replaceChildren(); chips.replaceChildren(); byId = new Map();
    const r = makeRecipe({ seed: rnd(), species: 'human', base: 'biped' });
    F = layoutOf(r);
    list = pieces(r, F);
    s = tile(host, 1080, 620);
    stand(s, F, { pad: 30 });
    at = 0;
    for (const id of [...new Set(list.map(e => e.def.id))]) {
      const c = document.createElement('span');
      c.className = 'chip'; c.textContent = id;
      chips.appendChild(c); byId.set(id, c);
    }
    timer = setInterval(tick, 380);
  };

  const tick = () => {
    if (at >= list.length) { clearInterval(timer); timer = setTimeout(start, 2200); return; }
    const e = list[at++];
    paint(s, e, F);
    byId.get(e.def.id)?.classList.add('on');
  };

  start();
  btn($('c6'), 'draw again', start);
}

// ---------------- 07 · the species ----------------
function step7() {
  const host = $('d7');
  const draw = () => {
    host.replaceChildren();
    const seed = rnd();
    for (const id of ['human', 'dog', 'cat', 'nightmare']) {
      const r = makeRecipe({ seed, species: id });
      const F = layoutOf(r);
      const s = new Sketch(400, 460);
      s.boil(rnd());
      stand(s, F, { pad: 18 });
      for (const e of pieces(r, F)) paint(s, e, F);
      s.canvas.className = 'cv';
      cell(host, SPECIES[id].label).put(s.canvas);
    }
  };
  draw();
  btn($('c7'), 'draw again', draw);
}

// ---------------- 08 · the boil ----------------
function step8() {
  const host = $('d8');
  const r = makeRecipe({ seed: rnd(), species: 'human', base: 'biped' });
  const F = layoutOf(r), list = pieces(r, F);
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const s = new Sketch(420, 420);
    s.boil(1000 + f * 977);                        // same numbers, another wobble
    stand(s, F, { pad: 12, head: true });
    for (const e of list) paint(s, e, F);
    s.canvas.className = 'cv';
    frames.push(s.canvas);
    cell(host, 'frame ' + f).put(s.canvas);
  }
  // the fourth tile is the same three, flipped
  const c = cell(host, 'flipped');
  const stack = document.createElement('div');
  stack.style.position = 'relative';
  c.put(stack);
  const copies = frames.map((cv, i) => {
    const d = cv.cloneNode(true);
    d.getContext('2d').drawImage(cv, 0, 0);
    d.className = 'cv';
    d.style.cssText = i ? 'position:absolute;inset:0;visibility:hidden' : '';
    stack.appendChild(d);
    return d;
  });
  // visibility, not display: the first copy holds the tile's height
  let n = 0;
  setInterval(() => {
    copies.forEach((d, i) => { d.style.visibility = i === n ? 'visible' : 'hidden'; });
    n = (n + 1) % 3;
  }, 500);
}

// ---------------- the live rig (09 · 10 · 11) ----------------
// Each live step owns a small renderer inside its own box: three
// contexts on the page, and every one of them is the real rig with
// the real animator on top of it.
const views = [];
const CLEAR = new THREE.Color(PAPER);

function makeLive(host, o = {}) {
  const halfH = o.halfH ?? 1.3, camY = o.camY ?? -.3, floorY = o.floorY ?? -.95;
  const scene = new THREE.Scene();
  scene.background = CLEAR;
  const camera = new THREE.OrthographicCamera(-1, 1, halfH, -halfH, .1, 100);
  camera.position.set(0, camY, 10);
  const fl = makeFloorLine(4);
  fl.position.set(0, floorY - fl.userData.lineDy, -1);
  scene.add(fl);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  host.appendChild(renderer.domElement);

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();
  new ResizeObserver(resize).observe(host);

  let face = null;
  const opts = { blink: true, gaze: true, talk: false, sway: true, breath: true,
                 boil: true, boilSpeed: .5, phase: Math.random() * 10, amp: 1.2 };
  const v = {
    el: host, scene, camera, renderer, opts, ready: false,
    animator: createAnimator(() => face, opts),
    face: () => face,
    build(recipe) {
      if (face) { scene.remove(face.group); face.dispose(); }
      face = buildCharacter(recipe);
      face.group.position.y = floorY + face.F.B.floorY / U;
      scene.add(face.group);
      v.ready = true;
      return face;
    },
    frame(t, dt) {
      v.animator.update(t, dt);
      renderer.render(scene, camera);
    },
  };
  views.push(v);
  return v;
}

// one clock for all of them; a demo off the screen is not drawn
let lastT = 0;
function frame(ms) {
  requestAnimationFrame(frame);
  const t = ms / 1000;
  const dt = Math.min(.05, lastT ? t - lastT : .016);
  lastT = t;
  const H = innerHeight;
  for (const v of views) {
    if (!v.ready) continue;
    const r = v.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H) continue;
    v.frame(t, dt);
  }
}
requestAnimationFrame(frame);

// ---------------- 09 · the face ----------------
function step9() {
  const v = makeLive($('d9'), { halfH: 1.25, camY: .05, floorY: -.92 });
  const build = () => v.build(makeRecipe({ seed: rnd(), species: 'human', base: 'biped' }));
  build();
  const ctl = $('c9');
  group(ctl, Object.keys(EXPRESSIONS).map(id => [id, EXPRESSIONS[id].label]),
        id => v.animator.setFace(id), 'idle');
  btn(ctl, 'another child', () => { build(); v.animator.setFace(v.animator.face()); });
}

// ---------------- 10 · the pose ----------------
function step10() {
  const v = makeLive($('d10'), { halfH: 1.25, camY: .05, floorY: -.92 });
  const build = () => v.build(makeRecipe({ seed: rnd(), species: 'human', base: 'biped' }));
  build();
  const ctl = $('c10');
  group(ctl, POSES.map(p => [p.id, p.label]), id => v.animator.setPose(id), 'idle');
  btn(ctl, 'another child', build);
}

// ---------------- 11 · the seed ----------------
function step11() {
  const v = makeLive($('d11'), { halfH: 1.25, camY: .05, floorY: -.92 });
  const out = $('j11');
  const show = r => {
    // the real recipe, with the long floats trimmed so it stays
    // readable — every one of these is a number some part rolled
    const trim = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(2) : v;
    const short = { seed: r.seed, species: r.species, base: r.base, media: r.media,
                    parts: { skull: r.parts.skull.params } };
    out.replaceChildren();
    const b = document.createElement('b');
    b.textContent = 'the whole character, saved · decimals trimmed';
    out.appendChild(b);
    out.appendChild(document.createTextNode(
      JSON.stringify(short, trim).replace(/"([^"]+)":/g, '$1: ').replace(/,/g, ', ') +
      '\n\n…and every other part carries its own line of numbers exactly like the skull.'));
  };
  const build = () => {
    const r = makeRecipe({ seed: rnd(), media: MEDIA_IDS[(Math.random() * MEDIA_IDS.length) | 0],
                           species: ['human', 'human', 'dog', 'cat', 'nightmare'][(Math.random() * 5) | 0] });
    v.build(r);
    show(r);
  };
  build();
  btn($('c11'), 'another seed', build);
}

// ---------------- the rail, and building on scroll ----------------
const STEPS = { s1: step1, s2: step2, s3: step3, s4: step4, s5: step5, s6: step6,
                s7: step7, s8: step8, s9: step9, s10: step10, s11: step11 };

const rail = $('rail');
const secs = [...document.querySelectorAll('.step')];
const links = secs.map((sec, i) => {
  const a = document.createElement('a');
  a.href = '#' + sec.id;
  a.textContent = String(i + 1).padStart(2, '0') + ' ' + sec.dataset.title;
  rail.appendChild(a);
  return a;
});

// A step is built the first time it comes near the viewport, so the
// page opens instantly and draws itself as you go down it. Plain
// scroll maths rather than an observer: a step must also build when
// the page is opened straight onto it, or hidden in a background tab.
const born = new Set();
const near = el => {
  const r = el.getBoundingClientRect();
  return r.top < innerHeight + 400 && r.bottom > -400;
};

function sweep() {
  for (const sec of secs) {
    if (born.has(sec.id) || !near(sec)) continue;
    born.add(sec.id);
    try { STEPS[sec.id]?.(); } catch (err) { console.error(sec.id, err); }
  }
  // the rail follows whichever step is under your eyes
  let best = 0, bd = Infinity;
  secs.forEach((sec, i) => {
    const d = Math.abs(sec.getBoundingClientRect().top - innerHeight * .3);
    if (d < bd) { bd = d; best = i; }
  });
  links.forEach((a, j) => a.classList.toggle('on', j === best));
}

addEventListener('scroll', sweep, { passive: true });
addEventListener('resize', sweep);
sweep();

// a debug handle, like every other scene here
window.__how = { views, STEPS, born };
