// ---------------------------------------------------------------
// SOUND — the desk, not the room.
//
// Every effect in this game is a sound a desk makes while somebody
// draws at it: graphite strokes, an eraser rubbing, paper sliding, a
// pencil tapped on wood. Nothing here is a monster noise or a coin
// jingle — a nightmare dying IS the eraser, something new arriving IS
// a scribble. That is the audio half of the promise the visuals make:
// the whole game is one drawing being worked on.
//
// All of it is synthesized. Pencil-on-paper is filtered noise with a
// jittery envelope; there are no sample files, nothing to load, and
// every play is a little different — the audio equivalent of the line
// boil. Per-play randomness is CORRECT here, unlike in a part's
// draw(): a repeated identical sample is what makes game SFX feel
// canned.
//
// The music is the one thing that is not synthesized: three or four
// generated stems (see assets/music/README.md) layered by a threat
// number. Missing stems are fine — the layer loads silent and the
// game plays without it.
//
// Browsers refuse audio before a user gesture, so the context is
// created lazily by the unlock listeners this module registers for
// itself. Game code never has to think about it.
// ---------------------------------------------------------------

let ctx = null;
let master, sfxBus, musicBus;
let NOISE = null;
let muted = false;
let voices = 0;                          // cap so a pile-up cannot clip
const VOICE_CAP = 24;
const lastPlay = {};                     // name → time, for per-sound cooldowns

function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  // sfx run through a compressor so a swing landing during a scribble
  // glues instead of clipping; music joins after it, already mixed
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : .9;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = .8;
  sfxBus.connect(comp); comp.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = .5;
  musicBus.connect(master);

  // 1.5s of white noise, shared by every burst; sources are free,
  // buffers are not
  const len = (ctx.sampleRate * 1.5) | 0;
  NOISE = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = NOISE.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  loadMusic();
  applyMusic();
}
addEventListener('pointerdown', unlock);
addEventListener('keydown', unlock);

const jr = (a, b) => a + Math.random() * (b - a);

// ---- the one synth ----------------------------------------------
// Everything below is this: the noise buffer, through one filter,
// through a gain whose curve is an envelope times per-step jitter.
// The jitter is the graphite — a smooth envelope on filtered noise
// sounds like wind; a jagged one sounds like a pencil.
const ENVS = {
  hit: u => Math.pow(1 - u, 2.2),                          // strike, decay
  swish: u => Math.sin(Math.PI * u),                       // in and out
  fall: u => Math.min(1, u * 12) * (1 - u),                // fast in, long out
  swell: u => Math.pow(Math.sin(Math.PI * u), 1.6),        // slow in and out
};

function burst(t0, o) {
  if (!ctx || voices >= VOICE_CAP) return;
  voices++;
  const dur = o.dur;
  const src = ctx.createBufferSource();
  src.buffer = NOISE;
  src.loop = true;                       // a long stroke outlives the buffer
  src.playbackRate.value = o.rate ?? 1;

  const filt = ctx.createBiquadFilter();
  filt.type = o.type ?? 'bandpass';
  filt.Q.value = o.q ?? 1;
  filt.frequency.setValueAtTime(o.f, t0);
  if (o.fEnd) filt.frequency.exponentialRampToValueAtTime(o.fEnd, t0 + dur);

  const env = ENVS[o.env ?? 'hit'];
  const jit = o.jit ?? .6;
  const steps = Math.max(12, Math.min(64, (dur * 90) | 0));
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1);
    let a = env(u) * (1 - jit + jit * Math.random());
    // `rub` counts the back-and-forth passes of an eraser — the LFO is
    // baked into the curve rather than being another node
    if (o.rub) a *= .5 + .5 * Math.sin(u * Math.PI * 2 * o.rub);
    curve[i] = a * (o.vol ?? .5);
  }
  const g = ctx.createGain();
  g.gain.setValueCurveAtTime(curve, t0, dur);

  const pan = ctx.createStereoPanner();
  pan.pan.value = o.pan ?? 0;

  src.connect(filt); filt.connect(g); g.connect(pan); pan.connect(sfxBus);
  src.start(t0); src.stop(t0 + dur + .02);
  src.onended = () => { voices--; };
}

// a pitched thump under a click — the wood of the desk
function thump(t0, o) {
  if (!ctx || voices >= VOICE_CAP) return;
  voices++;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t0);
  osc.frequency.exponentialRampToValueAtTime(o.f * .6, t0 + o.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.vol ?? .3, t0);
  g.gain.exponentialRampToValueAtTime(.001, t0 + o.dur);
  const pan = ctx.createStereoPanner();
  pan.pan.value = o.pan ?? 0;
  osc.connect(g); g.connect(pan); pan.connect(sfxBus);
  osc.start(t0); osc.stop(t0 + o.dur + .02);
  osc.onended = () => { voices--; };
}

// ---- the vocabulary ---------------------------------------------
// Named for what happens at the desk, not what happens in the game,
// so a sound stays honest about what it is when a new event borrows
// it. Every recipe takes { pan, vol } and jitters the rest itself.
const SOUNDS = {
  // a quick scribble — something being drawn into the room
  scratch(t, p, v) {
    const n = 2 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const dur = jr(.06, .14);
      burst(t, { dur, f: jr(2300, 4200), q: .8, jit: .85, vol: .4 * v, pan: p, env: 'swish' });
      t += dur * jr(.75, 1.1);
    }
  },
  // the eraser — a nightmare being un-drawn
  erase(t, p, v) {
    burst(t, { dur: jr(.45, .65), f: jr(850, 1200), q: .6, jit: .9, rub: jr(3, 5),
      vol: .55 * v, pan: p, env: 'swell', rate: .8 });
  },
  // pencil rapped on the desk — a hit landing
  tap(t, p, v) {
    burst(t, { dur: .035, type: 'highpass', f: 1800, jit: .25, vol: .5 * v, pan: p });
    thump(t, { f: jr(560, 840), dur: .06, vol: .18 * v, type: 'triangle', pan: p });
  },
  // the tiniest stroke — a small commitment (a pick, a marble thrown)
  tick(t, p, v) {
    burst(t, { dur: .045, f: jr(3200, 4400), q: 1.2, jit: .4, vol: .3 * v, pan: p });
  },
  // a page slid across the desk — the draft UI
  paper(t, p, v) {
    burst(t, { dur: jr(.15, .2), type: 'lowpass', f: 3800, jit: .35, rate: 1.6,
      vol: .4 * v, pan: p, env: 'swish' });
  },
  // knuckles on wood, twice — someone at the door
  knock(t, p, v) {
    for (let i = 0; i < 2; i++) {
      const tt = t + i * .22;
      thump(tt, { f: jr(150, 185), dur: .13, vol: .5 * v, pan: p });
      burst(tt, { dur: .02, type: 'highpass', f: 900, jit: .2, vol: .3 * v, pan: p });
    }
  },
  // a pencil lead snapping — furniture giving out
  snap(t, p, v) {
    burst(t, { dur: .05, type: 'highpass', f: 1300, jit: .2, vol: .7 * v, pan: p });
    thump(t, { f: 260, dur: .11, vol: .3 * v, pan: p });
  },
  // low gritty scraping — something chewing on the furniture
  gnaw(t, p, v) {
    burst(t, { dur: jr(.16, .24), f: jr(550, 800), q: 2, jit: .9, rate: .7,
      vol: .4 * v, pan: p, env: 'swish' });
  },
  // a wobbly hesitant line — a child getting frightened
  squiggle(t, p, v) {
    burst(t, { dur: jr(.28, .4), f: 2800, fEnd: jr(1700, 2300), q: 1.4, jit: .9,
      rub: jr(6, 9), vol: .4 * v, pan: p, env: 'swell' });
  },
  // one long stroke fading off the page — a child leaving
  stroke(t, p, v) {
    burst(t, { dur: 1.15, f: 2400, fEnd: 1000, q: .9, jit: .7,
      vol: .5 * v, pan: p, env: 'fall' });
  },
  // a breath of air — a lamp going out
  puff(t, p, v) {
    burst(t, { dur: .3, type: 'lowpass', f: 700, fEnd: 250, jit: .3,
      vol: .5 * v, pan: p, env: 'fall' });
  },
  // something low arriving at the edge of hearing — a nightmare
  loom(t, p, v) {
    burst(t, { dur: jr(.8, 1.1), type: 'lowpass', f: 320, jit: .45, rate: .5,
      vol: .5 * v, pan: p, env: 'swell' });
  },
  // the page tears — the game is over
  tear(t, p, v) {
    burst(t, { dur: .45, f: 500, fEnd: 3000, q: 1.1, jit: .95, vol: .9 * v, pan: p, env: 'swish' });
    burst(t + .08, { dur: .3, type: 'lowpass', f: 900, jit: .8, vol: .4 * v, pan: p, env: 'fall' });
  },
};

// opts: { pan: -1..1, vol: 0..1, cool: seconds } — `cool` throttles a
// sound that fires from inside a per-frame loop (a nightmare chewing)
function sfx(name, opts = {}) {
  if (!ctx || muted || !SOUNDS[name]) return;
  const now = ctx.currentTime;
  if (opts.cool && now - (lastPlay[name] ?? -9) < opts.cool) return;
  lastPlay[name] = now;
  SOUNDS[name](now + .001,
    Math.max(-1, Math.min(1, opts.pan ?? 0)),
    Math.max(0, Math.min(1.5, opts.vol ?? 1)));
}

// ---- music ------------------------------------------------------
// Vertical layering: every stem plays all the time, looping, and the
// game only moves GAINS. A missing file is a silent layer, so the
// game is complete with zero stems and gets richer as they land in
// assets/music/ (see the README there for what to generate).
const LAYER_NAMES = ['calm', 'unease', 'danger', 'draft'];
const layers = {};                       // name → { gain, buffer }
let musicBase = 0;                       // shared start time, so late loaders sync
let musicState = { started: false, threat: 0, draft: false, over: false };

async function loadMusic() {
  musicBase = ctx.currentTime + .1;
  // Ask the directory listing which stems exist before fetching any —
  // serve.py answers it, and it turns four red 404 lines on every
  // load of a stemless checkout into zero. If listings ever go away,
  // `have` is null and we just try them all.
  const have = await fetch('assets/music/')
    .then(r => (r.ok ? r.text() : null))
    .catch(() => null);
  for (const name of LAYER_NAMES) {
    if (have !== null && !have.includes(`${name}.mp3`)) continue;
    fetch(`assets/music/${name}.mp3`)
      .then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(b => ctx.decodeAudioData(b))
      .then(buffer => {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(musicBus);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(g);
        // a stem that finished decoding mid-run starts already into its
        // loop, so every layer stays on the same bar line
        const late = Math.max(0, ctx.currentTime - musicBase) % buffer.duration;
        src.start(ctx.currentTime, late);
        layers[name] = { gain: g, buffer };
        applyMusic();
      })
      .catch(() => {});                  // no stem yet — a silent layer
  }
}

// One knob: `threat` in 0..1, from the room's actual danger. The
// layers divide it between them — calm gives way as unease rises, and
// danger only speaks in the top half. The draft freezes the world, so
// it mostly freezes the music too.
function layerTargets({ started, threat, draft, over }) {
  if (over) return { calm: 0, unease: 0, danger: 0, draft: 0 };
  if (!started) return { calm: .45, unease: 0, danger: 0, draft: 0 };
  if (draft) return { calm: .15, unease: .1, danger: 0, draft: .8 };
  return {
    calm: .85 - threat * .55,
    unease: Math.min(1, threat * 1.5) * .75,
    danger: Math.max(0, (threat - .45) / .55) * .9,
    draft: 0,
  };
}

function applyMusic() {
  if (!ctx) return;
  const want = layerTargets(musicState);
  for (const name of LAYER_NAMES) {
    const l = layers[name];
    if (!l) continue;
    // seconds-long ramps on purpose: the room gets scarier the way
    // dusk does, not the way a stinger does
    l.gain.gain.setTargetAtTime(want[name], ctx.currentTime, 1.4);
  }
}

function setMusic(next) {
  musicState = { ...musicState, ...next };
  applyMusic();
}

function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : .9, ctx.currentTime, .05);
  return muted;
}

export const audio = {
  sfx, setMusic, toggleMute,
  get muted() { return muted; },
  get ready() { return !!ctx; },
  get layers() { return Object.keys(layers); },
  get music() { return musicState; },
};
