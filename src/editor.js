// Panel UI. Owns no state of its own: it reads/writes the recipe and
// calls app.rebuild() after every change. Part controls are generated
// from each part def's meta() so new params show up automatically.
import { PARTS } from './rig.js';
import { MEDIA } from './media.js';
import { SPECIES } from './species.js';
import { POSES } from './poses/index.js';
import { EXPRESSIONS } from './expressions.js';

const $ = id => document.getElementById(id);

export function initUI(app) {
  // app = { recipe(), setRecipe(json), rebuild(), reroll(id), regen(seed?), anim }
  let selected = null;

  // ---- static controls -----------------------------------------
  $('seed').onchange = () => app.regen(+$('seed').value || 0);
  $('dice').onclick = () => app.regen((Math.random() * 1e9) | 0);
  $('regen').onclick = () => app.regen((Math.random() * 1e9) | 0);
  addEventListener('keydown', e => {
    if (e.key === 'r' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))
      app.regen((Math.random() * 1e9) | 0);
  });
  $('species').add(new Option('todas (al azar)', 'todas'));
  for (const [id, sp] of Object.entries(SPECIES)) $('species').add(new Option(sp.label, id));
  // a species change re-casts every unlocked part: same seed, new animal
  $('species').onchange = () => app.setSpecies($('species').value);

  $('media').add(new Option('todos (al azar)', 'todos'));
  for (const m of Object.values(MEDIA)) $('media').add(new Option(m.label, m.id));
  $('media').onchange = () => { app.setMedia($('media').value); };
  $('color').onchange = () => { app.recipe().color = $('color').value; app.rebuild(); };

  // ---- pose / expression chips ---------------------------------
  const poseBtns = {}, faceBtns = {};
  for (const p of POSES) {
    const b = document.createElement('button');
    b.textContent = p.label;
    b.onclick = () => { app.animator.setPose(p.id); markAnim(); };
    poseBtns[p.id] = b;
    $('poses').appendChild(b);
  }
  for (const [id, ex] of Object.entries(EXPRESSIONS)) {
    const b = document.createElement('button');
    b.textContent = ex.label;
    b.onclick = () => { app.animator.setFace(id); markAnim(); };
    faceBtns[id] = b;
    $('faces').appendChild(b);
  }
  function markAnim() {
    const pose = app.animator.pose(), face = app.animator.face();
    for (const [id, el] of Object.entries(poseBtns)) el.classList.toggle('sel', id === pose);
    for (const [id, el] of Object.entries(faceBtns)) el.classList.toggle('sel', id === face);
  }
  markAnim();
  setInterval(markAnim, 400);   // one-shots and sleep's face hand back on their own

  for (const key of ['blink', 'gaze', 'talk', 'sway', 'breath', 'boil'])
    $('anim-' + key).onchange = e => { app.anim[key] = e.target.checked; };
  $('anim-speed').oninput = e => {
    app.anim.boilSpeed = +e.target.value;
    $('anim-speed-val').textContent = (+e.target.value).toFixed(2);
  };

  $('recipe-load').onclick = () => {
    try { app.setRecipe(JSON.parse($('recipe-box').value)); }
    catch (err) { alert('JSON inválido: ' + err.message); }
  };
  $('recipe-copy').onclick = () => navigator.clipboard?.writeText($('recipe-box').value);

  // ---- part chips ----------------------------------------------
  const chipEls = {};
  for (const def of PARTS) {
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
    const def = PARTS.find(d => d.id === selected);
    const slot = app.recipe().parts[selected];
    $('part-title').textContent = def.label;
    $('part-lock').checked = !!slot.lock;
    $('part-lock').onchange = e => { slot.lock = e.target.checked; select(selected); };
    $('part-reroll').onclick = () => { app.reroll(selected); renderPartPanel(); };

    const box = $('part-params');
    box.innerHTML = '';
    const meta = def.meta?.() ?? {};
    for (const [key, m] of Object.entries(meta)) {
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
        row.appendChild(sl);
        row.appendChild(val);
      }
      box.appendChild(row);
    }
  }

  // ---- refresh from app state ----------------------------------
  function refresh() {
    const r = app.recipe();
    $('seed').value = r.seed;
    $('species').value = app.speciesMode();
    $('media').value = app.mediaMode();
    $('color').value = r.color || 'auto';
    $('recipe-box').value = JSON.stringify(r, null, 2);
    select(selected);           // re-render chips + part panel
  }

  return { refresh, select, get selected() { return selected; } };
}
