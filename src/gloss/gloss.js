// ---------------------------------------------------------------
// THE GLOSS LAB — one toy on a cream sweep with every knob exposed.
// The shelf page (`gcrowd.js`) is the opposite view of the SAME
// generator: both call `buildGloss`, so a part added here shows up
// there with no second implementation to keep in step.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { buildGloss, newGRecipe, ensureGParams, rerollGPart, GPARTS, BODY_IDS } from './grig.js';
import { GSPECIES, GSPECIES_IDS } from './gspecies.js';
import { PALETTES, PALETTE_BY_ID } from './gpalette.js';
import { studioEnv, makeMaterialFactory, dressScene, MATERIALS } from './gmedia.js';
import { createGlossFace, GLOSS_FACES } from './gface.js';

const stage = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
dressScene(scene, renderer);
const materialFor = makeMaterialFactory(studioEnv(renderer));

const camera = new THREE.PerspectiveCamera(30, 1, .05, 60);

let recipe = newGRecipe();
let built = null;
let life = null;                   // the same autonomic face the sheet runs

function rebuild() {
  if (built) {
    scene.remove(built.group);
    built.group.traverse(o => o.geometry?.dispose());
  }
  built = buildGloss(recipe, { materialFor });
  scene.add(built.group);
  life = createGlossFace(built, { gaze: true });
  document.getElementById('count').textContent =
    `${built.stats.meshes} parts · ${built.stats.verts.toLocaleString()} verts · `
    + `${built.stats.buildMs}ms · seed ${recipe.seed}`;
  return built;
}

// ---- camera -----------------------------------------------------------
// Dead-on by default and it HOLDS STILL: this is a face-editing page,
// and a turntable moving under a change you are judging is noise.
let yaw = 0, pitch = .05, dist = 3.2, drag = null;

function placeCamera() {
  const L = built.L;
  const cy = L.cy;
  const d = dist * Math.max(L.H, L.W);
  camera.position.set(
    Math.sin(yaw) * Math.cos(pitch) * d,
    cy + Math.sin(pitch) * d,
    Math.cos(yaw) * Math.cos(pitch) * d);
  camera.lookAt(0, cy * .96, 0);
}

stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => {
  if (!drag) return;
  yaw -= (e.clientX - drag.x) * .008;
  pitch = Math.max(-.5, Math.min(1.1, pitch + (e.clientY - drag.y) * .006));
  drag = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => { drag = null; });
stage.addEventListener('wheel', e => {
  e.preventDefault();
  dist = Math.max(1.5, Math.min(6, dist * (1 + e.deltaY * .001)));
}, { passive: false });

// ---- loop -------------------------------------------------------------
let t = 0;

function frame(dt = 16) {
  const d = dt / 1000;
  t += d;
  // gaze, blink and expression — all of it offsets on the face meshes,
  // no geometry touched and no rebuild
  const head = life.update(t, d);
  const s = 1 + Math.sin(t * 1.8) * .007;                     // breathing
  built.group.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
  built.group.position.set(head.x, head.y, 0);
  // the turn is what sells a look; the shift is the follow-through
  built.group.rotation.set(head.pitch, head.yaw, head.rot);

  placeCamera();
  renderer.render(scene, camera);
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---- ui ---------------------------------------------------------------
const $ = id => document.getElementById(id);

function chips(el, items, isSel, onPick, render) {
  el.textContent = '';
  for (const it of items) {
    const b = document.createElement('button');
    render ? render(b, it) : (b.textContent = it.label ?? it);
    if (isSel(it)) b.classList.add('sel');
    b.onclick = () => onPick(it);
    el.appendChild(b);
  }
}

function refreshChips() {
  // picking a species relaods the dice, so the parts and the body are
  // cleared and rerolled under the new casting — palette, material and
  // seed stay, because a species is not a colour or a finish
  chips($('species'), GSPECIES_IDS, id => id === recipe.species, id => {
    recipe.species = id;
    recipe.body = null;
    recipe.parts = {};
    ensureGParams(recipe);
    rebuild(); refreshUI();
  }, (b, id) => { b.textContent = GSPECIES[id].label; });

  chips($('body-pick'), BODY_IDS, id => id === recipe.body,
        id => { recipe.body = id; rebuild(); refreshChips(); });

  chips($('palette'), PALETTES, p => p.id === recipe.palette, p => {
    recipe.palette = p.id;
    recipe.colorIx = Math.min(recipe.colorIx ?? 0, p.colors.length - 1);
    rebuild(); refreshChips();
  }, (b, p) => {
    b.className = 'swatch';
    b.title = p.label;
    for (const c of p.colors) {
      const d = document.createElement('i');
      d.style.background = c;
      b.appendChild(d);
    }
  });

  const pal = PALETTE_BY_ID[recipe.palette];
  chips($('color'), pal.colors.map((c, i) => ({ c, i })), o => o.i === recipe.colorIx,
        o => { recipe.colorIx = o.i; rebuild(); refreshChips(); },
        (b, o) => { b.className = 'dot'; b.style.background = o.c; b.title = o.c; });

  chips($('material'), MATERIALS, m => m.id === recipe.material,
        m => { recipe.material = m.id; rebuild(); refreshChips(); });

  // expressions are pure offsets, so this needs no rebuild — it is the
  // fastest way to check a face still reads when it is not resting
  chips($('face'), GLOSS_FACES, id => life.face() === id,
        id => { life.setFace(id); refreshChips(); });
}

function sliderRows() {
  const box = $('knobs');
  box.textContent = '';
  for (const part of GPARTS) {
    const meta = part.meta ? part.meta() : {};
    const params = recipe.parts[part.id].params;
    const h = document.createElement('h2');
    h.textContent = part.label;
    const rr = document.createElement('button');
    rr.textContent = 'reroll';
    rr.style.cssText = 'float:right;font-size:10px;padding:1px 6px';
    rr.onclick = () => { rerollGPart(recipe, part.id); rebuild(); refreshUI(); };
    h.appendChild(rr);
    box.appendChild(h);

    for (const [k, m] of Object.entries(meta)) {
      const row = document.createElement('div');
      row.className = 'row';
      const lab = document.createElement('label');
      lab.textContent = m.label || k;
      row.appendChild(lab);

      if (m.pick) {
        const sel = document.createElement('select');
        for (const opt of m.pick) {
          const o = document.createElement('option');
          o.value = o.textContent = opt;
          sel.appendChild(o);
        }
        sel.value = params[k];
        sel.onchange = () => { params[k] = sel.value; rebuild(); };
        row.appendChild(sel);
      } else if (m.bool) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!params[k];
        cb.onchange = () => { params[k] = cb.checked; rebuild(); };
        row.appendChild(cb);
      } else {
        const inp = document.createElement('input');
        inp.type = 'range';
        inp.min = m.range[0]; inp.max = m.range[1];
        inp.step = (m.range[1] - m.range[0]) / 200;
        inp.value = params[k];
        const val = document.createElement('span');
        val.className = 'val';
        val.textContent = (+params[k]).toFixed(2);
        inp.oninput = () => {
          params[k] = +inp.value;
          val.textContent = (+inp.value).toFixed(2);
          rebuild();
        };
        row.appendChild(inp); row.appendChild(val);
      }
      box.appendChild(row);
    }
  }
}

function refreshUI() { refreshChips(); sliderRows(); }

$('another').onclick = () => {
  recipe = newGRecipe();
  ensureGParams(recipe);
  rebuild(); refreshUI();
};

addEventListener('keydown', e => { if (e.key === 'r' || e.key === 'R') $('another').click(); });

// ---- boot -------------------------------------------------------------
ensureGParams(recipe);
rebuild();
refreshUI();
resize();
// capped at 30, same as the sheet: one toy idling is not worth every
// frame a 120 Hz panel can offer, and `frame` advances by the fixed
// step it is handed either way
{
  const MIN_FRAME_MS = 1000 / 30;
  let lastDraw = -1e9;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    if (now - lastDraw < MIN_FRAME_MS - .5) return;
    lastDraw = now;
    frame(1000 / 30);
  });
}

window.__gloss = {
  get recipe() { return recipe; },
  get P() { return built.P; },
  get L() { return built.L; },
  get face() { return built.face; },
  get stats() { return built.stats; },
  rebuild, frame,
  async pump(n = 60) {
    for (let i = 0; i < n; i++) { frame(16.7); await new Promise(r => setTimeout(r, 0)); }
  },
  set(patch) { Object.assign(recipe, patch); rebuild(); refreshUI(); return built; },
  setFace(id) { life.setFace(id); refreshChips(); },
  get life() { return life; },
  view(y = 0, p = .05, d = 3.2) { yaw = y; pitch = p; dist = d; frame(0); },
};
