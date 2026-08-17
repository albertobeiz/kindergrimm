// Panel UI for the voxel lab. Owns no state of its own: it reads and
// writes the recipe and calls app.rebuild(). Part controls are
// generated from each part def's meta(), so a new param shows up here
// the moment it exists — same deal as src/editor.js.
import { VPARTS } from './vrig.js';
import { VSPECIES, VBASES } from './vspecies.js';
import { PALETTES } from './vpalette.js';
import { VFACES } from './vanim.js';

const $ = id => document.getElementById(id);

export function initVUI(app) {
  let selected = null;

  // ---- static controls -----------------------------------------
  $('seed').onchange = () => app.regen(+$('seed').value || 0);
  $('dice').onclick = () => app.regen((Math.random() * 1e9) | 0);
  $('regen').onclick = () => app.regen((Math.random() * 1e9) | 0);
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === 'r') app.regen((Math.random() * 1e9) | 0);
    if (e.key === ' ') { e.preventDefault(); app.resetView(); }
  });

  $('species').add(new Option('all (random)', 'all'));
  for (const [id, sp] of Object.entries(VSPECIES)) $('species').add(new Option(sp.label, id));
  $('species').onchange = () => app.setSpecies($('species').value);

  $('palette').add(new Option('all (random)', 'all'));
  for (const p of Object.values(PALETTES)) $('palette').add(new Option(p.label, p.id));
  $('palette').onchange = () => app.setPalette($('palette').value);

  for (const b of VBASES) $('base').add(new Option(b, b));
  $('base').onchange = () => app.setBase($('base').value);

  $('turntable').onchange = e => app.setTurntable(e.target.checked);
  $('reset-view').onclick = () => app.resetView();

  // ---- expression chips ----------------------------------------
  const faceBtns = {};
  for (const [id, f] of Object.entries(VFACES)) {
    const b = document.createElement('button');
    b.textContent = f.label;
    b.onclick = () => { app.animator.setFace(id); mark(); };
    faceBtns[id] = b;
    $('faces').appendChild(b);
  }
  function mark() {
    const cur = app.animator.face();
    for (const [id, el] of Object.entries(faceBtns)) el.classList.toggle('sel', id === cur);
  }
  mark();
  setInterval(mark, 400);

  for (const key of ['breath', 'sway', 'blink', 'gaze', 'talk'])
    $('anim-' + key).onchange = e => { app.anim[key] = e.target.checked; };

  $('recipe-load').onclick = () => {
    try { app.setRecipe(JSON.parse($('recipe-box').value)); }
    catch (err) { alert('invalid JSON: ' + err.message); }
  };
  $('recipe-copy').onclick = () => navigator.clipboard?.writeText($('recipe-box').value);

  // ---- part chips ----------------------------------------------
  const chipEls = {};
  for (const def of VPARTS) {
    const b = document.createElement('button');
    b.textContent = def.label;
    b.onclick = () => select(selected === def.id ? null : def.id);
    chipEls[def.id] = b;
    $('chips').appendChild(b);
  }

  function select(id) {
    selected = id;
    for (const [pid, el] of Object.entries(chipEls)) {
      el.classList.toggle('sel', pid === id);
      el.classList.toggle('locked', !!app.recipe().parts[pid]?.lock);
    }
    renderPartPanel();
    app.onSelectionChange?.(id);
  }

  // ---- selected-part panel -------------------------------------
  function renderPartPanel() {
    const sec = $('sec-part');
    if (!selected) { sec.hidden = true; return; }
    sec.hidden = false;
    const def = VPARTS.find(d => d.id === selected);
    const slot = app.recipe().parts[selected];
    $('part-title').textContent = def.label;
    $('part-lock').checked = !!slot.lock;
    $('part-lock').onchange = e => { slot.lock = e.target.checked; select(selected); };
    $('part-reroll').onclick = () => { app.reroll(selected); renderPartPanel(); };

    const box = $('part-params');
    box.innerHTML = '';
    for (const [key, m] of Object.entries(def.meta?.() ?? {})) {
      const P = slot.params;
      if (!(key in P)) continue;
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('label');
      label.textContent = m.label ?? key;
      row.appendChild(label);

      if (m.pick) {
        const sel = document.createElement('select');
        for (const opt of m.pick) sel.add(new Option(opt, opt));
        sel.value = String(P[key]);
        sel.onchange = () => { P[key] = sel.value; app.rebuild(); };
        row.appendChild(sel);
      } else if (m.bool) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!P[key];
        cb.onchange = () => { P[key] = cb.checked; app.rebuild(); };
        row.appendChild(cb);
      } else if (m.range) {
        const [lo, hi] = m.range;
        const sl = document.createElement('input');
        sl.type = 'range';
        sl.min = lo; sl.max = hi;
        sl.step = m.step ?? (hi - lo) / 100;
        sl.value = P[key];
        const val = document.createElement('span');
        val.className = 'val';
        const fmt = v => m.step === 1 ? String(v) : (+v).toFixed(2);
        val.textContent = fmt(P[key]);
        sl.oninput = () => {
          P[key] = m.step === 1 ? Math.round(+sl.value) : +sl.value;
          val.textContent = fmt(P[key]);
          app.rebuild();
        };
        row.appendChild(sl); row.appendChild(val);
      }
      box.appendChild(row);
    }
  }

  function refresh() {
    const r = app.recipe();
    $('seed').value = r.seed;
    $('species').value = app.speciesMode();
    $('palette').value = app.paletteMode();
    $('base').value = r.base;
    $('turntable').checked = app.turntable();
    $('recipe-box').value = JSON.stringify(r, null, 2);
    select(selected);
  }

  return { refresh, select, get selected() { return selected; } };
}
