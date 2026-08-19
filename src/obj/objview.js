// ---------------------------------------------------------------
// THE OBJECTS LAB — one plant on a cream sweep with every knob
// exposed. Four species: grass, plant, tree, flower — the same
// recipe idea the gloss characters and the voxels run, poured as garden
// plastic. `R` grows another.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { buildPlant, newORecipe, ensureOParams, rerollOPart, OPARTS, OSPECIES_IDS } from './orig.js';
import { OSPECIES } from './ospecies.js';
import { OPALETTES } from './opalette.js';
import { plantStudio, makeMaterialFactory, dressPlantScene, FINISHES } from './omedia.js';

const stage = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const materialFor = makeMaterialFactory(plantStudio(renderer));
dressPlantScene(scene, renderer);

const camera = new THREE.PerspectiveCamera(30, 1, .05, 60);

let recipe = newORecipe();
let built = null;

// ---- camera -----------------------------------------------------------
// the same orbit as the gloss lab: az/el/dist around a target, and
// the turntable is a slow az drift. The target and distance roll to
// fit the plant that was built.
const view = { az: .6, el: .3, dist: 3.2, targetY: 1 };

function place() {
  const d = view.dist, ce = Math.cos(view.el);
  camera.position.set(
    Math.sin(view.az) * ce * d,
    view.targetY + Math.sin(view.el) * d,
    Math.cos(view.az) * ce * d);
  camera.lookAt(0, view.targetY, 0);
}

function rebuild() {
  if (built) {
    scene.remove(built.group);
    built.group.traverse(o => o.geometry?.dispose());
  }
  built = buildPlant(recipe, { materialFor });
  scene.add(built.group);
  const b = built.bounds;
  // fit the camera to the plant: bounds.h is the real height, and
  // at fov 30 the visible half-height at distance d is d*tan15.
  // Solve for d so the plant fills ~72% of the frame vertically
  const span = Math.max(b.w, Math.max(b.h, .5));
  view.targetY = b.minY + b.h * .5;
  view.dist = span / Math.tan(camera.fov * Math.PI / 360) * .72;
  count();
  frame(0);
}
function count() {
  const s = built.stats;
  document.getElementById('count').textContent =
    `${s.meshes} parts · ${s.verts.toLocaleString()} verts · ${s.buildMs}ms · seed ${recipe.seed}`;
}

let drag = null;
let turntable = true;

stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => {
  if (!drag) return;
  view.az -= (e.clientX - drag.x) * .008;
  view.el = Math.max(.05, Math.min(1.25, view.el + (e.clientY - drag.y) * .006));
  drag = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => { drag = null; });
stage.addEventListener('wheel', e => {
  e.preventDefault();
  view.dist = Math.max(1, Math.min(10, view.dist * (1 + e.deltaY * .001)));
}, { passive: false });

// ---- loop -------------------------------------------------------------
let t = 0;
function frame(dt = 16) {
  t += dt / 1000;
  if (turntable) view.az += dt / 1000 * .08;
  place();
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
    b.onclick = () => { onPick(it); refreshUI(); };
    el.appendChild(b);
  }
}

function refreshChips() {
  chips($('species'), OSPECIES_IDS, id => id === recipe.species, id => {
    recipe.species = id;
    recipe.parts = {};
    ensureOParams(recipe);
    rebuild();
  }, (b, id) => { b.textContent = OSPECIES[id]?.label ?? id; });

  chips($('palette'), OPALETTES, p => p.id === recipe.palette, p => {
    recipe.palette = p.id;
    rebuild();
  }, (b, p) => {
    b.className = 'swatch';
    b.title = p.label;
    for (const r of ['ground', 'leaf', 'leafD', 'bloom']) {
      const i = document.createElement('i');
      i.style.background = p.roles[r];
      b.appendChild(i);
    }
  });

  chips($('material'), FINISHES, m => m.id === recipe.material, m => {
    recipe.material = m.id;
    rebuild();
  });
}

function sliderRows() {
  const box = $('knobs');
  box.textContent = '';
  for (const part of OPARTS) {
    const meta = part.meta ? part.meta() : {};
    const params = recipe.parts[part.id].params ?? {};
    const h = document.createElement('h2');
    h.textContent = part.label;
    const rr = document.createElement('button');
    rr.textContent = 'reroll';
    rr.style.cssText = 'float:right;font-size:10px;padding:1px 6px';
    rr.onclick = () => { rerollOPart(recipe, part.id); rebuild(); };
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
        inp.step = m.step && m.range[1] - m.range[0] > 20 ? m.step : (m.range[1] - m.range[0]) / 100;
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
  recipe = newORecipe();
  ensureOParams(recipe);
  rebuild();
  refreshUI();
};
$('turntable').onchange = e => { turntable = e.target.checked; };
$('seed').value = recipe.seed;
const reseed = () => {
  recipe.seed = (Math.random() * 1e9) | 0;
  recipe.parts = {};
  ensureOParams(recipe);
  $('seed').value = recipe.seed;
  rebuild();
  refreshUI();
};
$('dice').onclick = reseed;
$('seed').onchange = e => {
  recipe.seed = (parseInt(e.target.value, 10) || 0) | 0;
  recipe.parts = {};
  ensureOParams(recipe);
  rebuild();
  refreshUI();
};

addEventListener('keydown', e => { if (e.key === 'r' || e.key === 'R') $('another').click(); });

// ---- boot -------------------------------------------------------------
ensureOParams(recipe);
rebuild();
refreshUI();
resize();
renderer.setAnimationLoop(() => frame());

window.__object = {
  get recipe() { return recipe; },
  get P() { return built?.P; },
  get stats() { return built?.stats; },
  get bounds() { return built?.bounds; },
  rebuild, frame,
  set(patch) { Object.assign(recipe, patch);
    ensureOParams(recipe);
    rebuild(); return built; },
  reroll(id) { rerollOPart(recipe, id); rebuild(); return built; },
  async pump(n = 60) {
    for (let i = 0; i < n; i++) { frame(16.7); await new Promise(r => setTimeout(r, 0)); }
  },
};