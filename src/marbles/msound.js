// ---------------------------------------------------------------
// TOYBOX — a box of glossy marbles on a wooden nursery floor.
//
// This is `marbles.html`'s audio, and it is a SIBLING of src/audio.js,
// not a reuse of it. That module's whole register is "a pencil at a
// desk" — graphite, paper, an eraser — and every recipe in it is one
// of those three. Same relationship as src/gloss/ has to src/parts/:
// the same idea (one lazy context, a couple of synth helpers, one
// vocabulary table, a voice cap, per-sound cooldowns) built again in
// a different hand. It shares nothing with audio.js, not even a bus,
// on purpose — two registers glued through one compressor duck each
// other, and a pencil has no business in this room.
//
// The register: hard plastic, hollow wood, a xylophone, a rubber
// squeak. Everything here is a sound a TOY could make. The spells are
// the exception and even they are a toy's IDEA of magic — a thumb
// piano, a struck jar, a kazoo — never a laser and never a choir.
//
// The key is F MAJOR PENTATONIC (F G A C D) and every pitched sound
// that plausibly can be is on it: `select`, `level`, `take`, `frost`,
// `lose`, `wave`, `leak` and the whole music bed. Five notes with no
// semitone between any two of them cannot be stacked wrong, so a
// level-up landing on top of a card riffle and a fireball is still a
// chord — the game is always in tune with itself. `leak` is the one
// sound that has to feel WRONG, and it gets there by detuning two of
// the key's own notes against each other rather than by leaving the
// key: sour, but still this game's sour.
//
// Pure synthesis. No sample files, no fetch, no imports, nothing to
// load. Browsers refuse audio before a user gesture, so the context
// is created lazily by the unlock listeners this module registers for
// itself; game code never thinks about it.
//
// The LEVELS here are measured, not guessed, and `clack` is 0 dB: it
// is the sound you hear most, so everything else is written as a
// distance from it. Roughly: the pick-ups and knocks sit within 4 dB
// of it, `crush` and `hurt` 13-16 dB under, `aim` 30 under, and only
// the big moments go above — `slam` and `boom` +3, `level` and
// `break` +7, `lose` +11. Any recipe can be re-measured by rendering
// it through an OfflineAudioContext (shim window.AudioContext, import
// this module, dispatch a pointerdown, call sfx, startRendering) and
// three of these numbers were fixed that way after being written by
// ear: `wave` was 1.7x the loudest impact in sustained energy, `leak`
// peaked louder than losing a marble, and `hurt` was 21 dB down and
// effectively inaudible in a fight.
// ---------------------------------------------------------------

let ctx = null;
let master, sfxBus, musicBus;
let NOISE = null;
let muted = false;
let killed = false;                      // stop() was called; wake() undoes it

const MASTER = .9;
// The cap counts SCHEDULED voices, not sounding ones — a sound that
// lays out a dozen taps over half a second reserves all twelve the
// moment it is asked for. That is deliberate (it is a budget, not a
// meter) and it is why the riffle is a dozen ticks and not forty.
const VOICE_CAP = 40;
let voices = 0;

const lastPlay = {};                     // name → time, for cooldowns
const REPEAT = {};                       // name → { t, run }, for the duck

const jr = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fclamp = f => (f < 10 ? 10 : f > 18000 ? 18000 : f);

// ---- the key ----------------------------------------------------
// F major pentatonic, addressed by SCALE DEGREE so nothing in this
// file is ever a magic frequency: 0 is F3, +5 is the octave, and
// negatives go down. Every pitched recipe names a degree, so
// transposing the whole game is one number.
const ROOT = 174.61;                     // F3
const PENTA = [0, 2, 4, 7, 9];           // F G A C D, in semitones
function note(deg) {
  const oct = Math.floor(deg / 5);
  return ROOT * Math.pow(2, oct + PENTA[deg - oct * 5] / 12);
}

// ---- the context ------------------------------------------------
function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4;
  comp.attack.value = .003; comp.release.value = .18;

  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER;
  master.connect(ctx.destination);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = .85;
  sfxBus.connect(comp); comp.connect(master);

  // Music joins AFTER the compressor. A swarm being crushed must not
  // pump the bed — that is the one thing that would make a quiet
  // generative pad audible for the wrong reason.
  musicBus = ctx.createGain();
  // A SCORE, not furniture: the bed was at .3 when it was a pad and a
  // heartbeat designed to be ignored. It joins after the compressor, so
  // it is never ducked by the swarm — this is the level it actually
  // plays at, and it is the one number to turn if it fights the game.
  musicBus.gain.value = .44;
  musicBus.connect(master);

  buildRoom();

  // Two seconds of white noise, shared by every burst. Sources are
  // free, buffers are not.
  const len = (ctx.sampleRate * 2) | 0;
  NOISE = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = NOISE.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  if (wanted) music();                   // asked for before the gesture
}
addEventListener('pointerdown', unlock);
addEventListener('keydown', unlock);

// A little wooden ROOM, on the sfx only. Two short delays with soft
// feedback, lowpassed so it can never add brightness — not a reverb,
// because a nursery is small and a marble arena is a box. It is here
// to GLUE: hundreds of bone-dry clacks read as a machine, the same
// clacks with a tenth of a room read as a floor.
function buildRoom() {
  const send = ctx.createGain(); send.gain.value = .11;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 3000;
  const d1 = ctx.createDelay(.2), d2 = ctx.createDelay(.2);
  d1.delayTime.value = .021; d2.delayTime.value = .037;
  const fb = ctx.createGain(); fb.gain.value = .22;   // loop gain .44 — decays
  const p1 = ctx.createStereoPanner(), p2 = ctx.createStereoPanner();
  p1.pan.value = -.4; p2.pan.value = .4;
  sfxBus.connect(send); send.connect(lp);
  lp.connect(d1); lp.connect(d2);
  d1.connect(fb); d2.connect(fb); fb.connect(lp);     // legal: the cycle has delay in it
  d1.connect(p1); d2.connect(p2);
  p1.connect(master); p2.connect(master);             // post-compressor: the room is not squashed
}

// ---- the three helpers ------------------------------------------
// Everything in the vocabulary is these: filtered noise (burst), a
// decaying oscillator (tone), and a struck body made of a few of them
// (modal). `knock` is the fourth and it is only a composition of the
// others, but it is the one that matters — see its comment.
//
// `r` is the transpose and it runs through all four: it multiplies
// oscillator frequencies AND filter frequencies AND the noise's
// playback rate, so `rate` really shifts pitch instead of only
// re-scrubbing a noise buffer. That is what the chain ladder needs.

const ENVS = {
  hit: u => Math.pow(1 - u, 2.4),                     // strike and decay
  click: u => Math.pow(1 - u, 6),                     // gone almost at once
  swish: u => Math.sin(Math.PI * u),                  // in and out
  fall: u => Math.min(1, u * 10) * Math.pow(1 - u, 1.6),
  swell: u => Math.pow(Math.sin(Math.PI * u), 1.7),   // slow both ways
  grain: u => Math.pow(Math.sin(Math.PI * u), 1.1),   // overlaps cleanly
};

function burst(t0, o) {
  if (!ctx) return;
  const bus = o.bus ?? sfxBus, capped = bus === sfxBus;
  if (capped && voices >= VOICE_CAP) return;
  if (capped) voices++;

  const r = o.r ?? 1, dur = o.dur;
  const src = ctx.createBufferSource();
  src.buffer = NOISE;
  src.loop = true;
  src.playbackRate.value = (o.rate ?? 1) * r;

  const filt = ctx.createBiquadFilter();
  filt.type = o.type ?? 'bandpass';
  filt.Q.value = o.q ?? 1;
  filt.frequency.setValueAtTime(fclamp(o.f * r), t0);
  // A knock's filter falls as fast as its gain does. Hold the cutoff
  // still and the same noise reads as a drum skin; sweep it down and
  // it reads as a small hard thing that has already stopped moving.
  if (o.fEnd) filt.frequency.exponentialRampToValueAtTime(fclamp(o.fEnd * r), t0 + dur);

  // Plastic is SMOOTH: `jit` defaults to zero here, where audio.js
  // jitters every envelope it has. Graphite is grain and a jagged
  // envelope IS the pencil; on a marble the same jitter reads as a
  // torn speaker. Only the sliding and rattling sounds ask for it.
  const env = ENVS[o.env ?? 'hit'];
  const jit = o.jit ?? 0;
  const steps = Math.max(10, Math.min(48, (dur * 220) | 0));
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1);
    curve[i] = env(u) * (1 - jit + jit * Math.random()) * (o.vol ?? .4);
  }
  const g = ctx.createGain();
  g.gain.setValueCurveAtTime(curve, t0, dur);

  const pan = ctx.createStereoPanner();
  pan.pan.value = clamp(o.pan ?? 0, -1, 1);

  src.connect(filt); filt.connect(g); g.connect(pan); pan.connect(bus);
  // Start somewhere random in the buffer: two grains cut from the same
  // 40 ms of noise ARE the same sound, and `roll` fires fifteen a
  // second.
  src.start(t0, Math.random() * (NOISE.duration - .1));
  src.stop(t0 + dur + .02);
  src.onended = () => { if (capped) voices--; };
}

function tone(t0, o) {
  if (!ctx) return;
  const bus = o.bus ?? sfxBus, capped = bus === sfxBus;
  if (capped && voices >= VOICE_CAP) return;
  if (capped) voices++;

  const r = o.r ?? 1, dur = o.dur;
  const atk = Math.min(o.atk ?? .002, dur * .5);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  if (o.curve) {
    // a bend with a corner in it (the squeak) — a curve, because two
    // ramps on one param have to be scheduled and this cannot collide
    const c = new Float32Array(o.curve.length);
    for (let i = 0; i < c.length; i++) c[i] = fclamp(o.curve[i] * r);
    osc.frequency.setValueCurveAtTime(c, t0, dur);
  } else {
    osc.frequency.setValueAtTime(fclamp(o.f * r), t0);
    if (o.fEnd) osc.frequency.exponentialRampToValueAtTime(fclamp(o.fEnd * r), t0 + (o.bend ?? dur));
  }

  let out = osc;
  if (o.fc) {
    const f = ctx.createBiquadFilter();
    f.type = o.ft ?? 'lowpass';
    f.Q.value = o.q ?? .8;
    f.frequency.setValueAtTime(fclamp(o.fc * r), t0);
    if (o.fcEnd) f.frequency.exponentialRampToValueAtTime(fclamp(o.fcEnd * r), t0 + dur);
    osc.connect(f); out = f;
  }

  const g = ctx.createGain();
  const peak = Math.max(.0001, o.vol ?? .3);   // never ramp exponentially from zero
  g.gain.setValueAtTime(.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);

  const pan = ctx.createStereoPanner();
  pan.pan.value = clamp(o.pan ?? 0, -1, 1);

  out.connect(g); g.connect(pan); pan.connect(bus);
  osc.start(t0); osc.stop(t0 + dur + .02);
  osc.onended = () => { if (capped) voices--; };
}

// A struck object is a handful of partials at INHARMONIC ratios with
// the high ones dying first, and that ratio set IS the material: 2.76
// and 5.4 is a hard little shell, 3.0 and 6.2 is a xylophone bar,
// 2.1 and 3.5 is a lump of wood. Harmonic ratios (2, 3, 4) would be a
// string or a pipe, which is why nothing here uses them.
function modal(t0, o) {
  const r = o.r ?? 1;
  const parts = o.parts ?? [[1, 1, 1], [2.76, .45, .6], [5.4, .2, .35]];
  // A higher-pitched object is a SMALLER one, and small things ring
  // shorter. Without this the chain ladder sounds like tape speed.
  const dur = o.dur * Math.pow(r, -.35);
  for (const [ratio, amp, dec] of parts) {
    tone(t0, {
      f: o.f * ratio, dur: Math.max(.012, dur * dec), vol: (o.vol ?? .3) * amp,
      pan: o.pan, type: o.type ?? 'sine', atk: .0012, r, bus: o.bus,
    });
  }
}

// THE knock, and the reason plastic reads as plastic: a few
// milliseconds of high filtered noise (the transient) sitting UNDER a
// pitched resonant body, with an optional low thump for the floor
// answering. High-frequency content is where "hard" lives — take the
// transient away and every one of these becomes a drum. Every
// hard-object sound in the vocabulary goes through here, so the
// family resemblance is structural rather than a thing to remember.
function knock(t0, o) {
  const r = o.r ?? 1, v = o.vol ?? .5;
  const bright = o.bright ?? 6000;
  burst(t0, {
    dur: o.tick ?? .02, type: 'highpass', f: bright, fEnd: bright * .3, q: .5,
    vol: v * (o.tickVol ?? .5), pan: o.pan, env: 'click', r,
  });
  modal(t0, { f: o.f, dur: o.dur ?? .07, vol: v * .5, pan: o.pan, parts: o.parts, r });
  if (o.wood) {
    tone(t0, {
      f: o.wood, fEnd: o.wood * .68, dur: o.woodDur ?? .06,
      vol: v * (o.woodVol ?? .35), type: 'triangle', pan: o.pan, atk: .0015, r,
    });
  }
}

// ---- the vocabulary ---------------------------------------------
// Every recipe takes (time, pan, vol, rate) and rolls the rest
// itself. Per-play randomness is CORRECT here, unlike in a part's
// draw(): a repeated identical sample is exactly what makes game SFX
// sound canned, and three percent of pitch plus a tenth of level is
// the whole difference between a hundred plays and one play heard a
// hundred times.
const SOUNDS = {

  // -- throw and physics --

  // a marble arriving in your hand: the click of it against the tray,
  // then a small ping up the scale (A5 → C6) saying "this one is
  // yours"
  draw(t, p, v, r) {
    knock(t, { f: jr(680, 760), bright: 5200, tick: .014, dur: .05, vol: .34 * v, pan: p, wood: 215, r });
    tone(t + .02, {
      f: note(12), fEnd: note(13), dur: .22, vol: .16 * v,
      type: 'triangle', pan: p, atk: .012, fc: 3200, r,
    });
  },

  // the aim being pulled. Fires every few pixels of drag, so it is
  // the quietest thing in the file and it is one node. The game
  // raises `rate` with the pull — a tick that climbs is a spring
  // loading.
  aim(t, p, v, r) {
    burst(t, { dur: .007, type: 'bandpass', f: 5200, q: 1.6, vol: .05 * v, pan: p, env: 'click', r });
  },

  // release: a woody thock in the palm and the air the marble takes
  // with it, pitching down as it leaves
  throw(t, p, v, r) {
    knock(t, {
      f: jr(210, 250), bright: 3400, tick: .018, tickVol: .35, dur: .1,
      vol: .5 * v, pan: p, wood: 105, woodVol: .6, woodDur: .11,
      parts: [[1, 1, 1], [2.1, .4, .5], [3.5, .16, .3]], r,
    });
    burst(t + .01, {
      dur: .22, type: 'bandpass', f: 2000, fEnd: 480, q: .9, jit: .25,
      vol: .22 * v, pan: p, env: 'fall', r,
    });
  },

  // ONE GRAIN of a marble sliding on a board. The game retriggers it
  // ~15/s with `vol` scaled to speed, so it is a single source, a
  // single filter and nothing else. A resonant lowpass gives the
  // floor's body and the envelope jitter gives the sand; two nodes
  // cannot do both any other way.
  roll(t, p, v, r) {
    burst(t, {
      dur: .085, type: 'lowpass', f: jr(300, 420), q: 3.5, jit: .55,
      rate: jr(.85, 1.15), vol: .3 * v, pan: p, env: 'grain', r,
    });
  },

  // THE sound of the game — two hard marbles meeting. Heard hundreds
  // of times a run, so: bright transient, inharmonic shell, a little
  // wood under it, and every number rolled. The wood scales WITH the
  // shell, so a clack transposed up the chain ladder is a smaller
  // marble rather than the same marble in a different tape machine.
  clack(t, p, v, r) {
    const f = jr(1080, 1240), a = jr(.88, 1.06);
    knock(t, {
      f, bright: 8400, tick: .018, tickVol: .55, dur: .075,
      vol: .55 * v * a, pan: p, wood: f * .17, woodVol: .4, woodDur: .05,
      parts: [[1, 1, 1], [1.72, .5, .62], [2.65, .28, .4], [4.4, .12, .25]], r,
    });
  },

  // the rim: the same event with the top taken off and a longer body,
  // because the wall is big and does not move
  wall(t, p, v, r) {
    const f = jr(380, 460);
    knock(t, {
      f, bright: 3600, tick: .02, tickVol: .3, dur: .11, vol: .45 * v * jr(.9, 1.06),
      pan: p, wood: f * .42, woodVol: .55, woodDur: .09,
      parts: [[1, 1, 1], [2.1, .4, .55], [3.5, .18, .3]], r,
    });
  },

  // coming to rest: it touches down, wobbles, and is still. The
  // second tap is quieter, lower and slightly later than you expect —
  // an even double tap is a machine.
  plant(t, p, v, r) {
    knock(t, { f: 560, bright: 4200, tick: .014, dur: .05, vol: .3 * v, pan: p, wood: 172, r });
    knock(t + jr(.07, .1), { f: 505, bright: 3200, tick: .012, dur: .045, vol: .13 * v, pan: p, wood: 158, r });
  },

  // rebounding off something big and rubbery. Rubber is a pitch that
  // DROPS while the thing squashes, with the filter falling with it,
  // and no click at all — a rubber wall has no transient, which is
  // the only reason this is not a knock.
  bounce(t, p, v, r) {
    tone(t, {
      f: jr(430, 520), fEnd: jr(150, 190), dur: .18, vol: .38 * v, type: 'triangle',
      pan: p, fc: 2200, fcEnd: 600, q: 1.2, atk: .004, r,
    });
    burst(t, { dur: .035, type: 'lowpass', f: 900, fEnd: 300, vol: .16 * v, pan: p, r });
  },

  // -- combat --

  // a little one squashed. Up to twenty a second, so two nodes and
  // not one more, and EVERYTHING rolled: centre frequency, Q, length,
  // the blip's pitch, the level. The shell is the noise, the squish
  // is the blip dropping a fifth under it.
  crush(t, p, v, r) {
    const f = jr(1300, 2800), d = jr(.022, .04);
    burst(t, {
      dur: d, type: 'bandpass', f, fEnd: f * jr(.3, .5), q: jr(1.2, 2.6), jit: .5,
      vol: .16 * v * jr(.75, 1.15), pan: p, r,
    });
    tone(t, {
      f: jr(300, 620), fEnd: jr(110, 200), dur: d * 1.4, vol: .1 * v * jr(.7, 1.2),
      type: 'triangle', pan: p, atk: .001, r,
    });
  },

  // a pellet leaving: blunt, lowpassed, no crack. It is a puff of air
  // in a plastic tube, not a gun.
  // THE MOW — a marble shoving a lane of bodies aside. It rides UNDER
  // the individual crushes rather than replacing them: twenty little
  // squashes in a second is a stutter, and a stutter with a swell under
  // it is a plough. Short, dark, and swept downward so it reads as
  // something heavy passing rather than as wind.
  mow(t, p, v, r) {
    burst(t, { f: 900 * r, fEnd: 220 * r, q: .6, dur: .3, vol: .5 * v,
               type: 'bandpass', env: 'swish', pan: p });
    tone(t, { f: 150 * r, fEnd: 74 * r, dur: .22, vol: .34 * v,
              type: 'triangle', atk: .006, pan: p });
  },

  // THE CHAIN CHIME — one rung of the combo ladder. It is a pitched
  // bell rather than a noise so a long chain arrives as an ascending
  // PHRASE: the ladder is the only feedback that tells you how deep you
  // are without looking away from the ice.
  chain(t, p, v, r) {
    modal(t, { f: 660 * r, dur: 1.1, vol: .5 * v, pan: p,
               parts: [[1, 1, 1], [2.01, .5, .7], [3.02, .26, .5], [5.4, .1, .3]] });
    tone(t, { f: 660 * r * 2, dur: .1, vol: .16 * v, type: 'sine', atk: .002, pan: p });
  },

  // A MARBLE MELTING — the kettle going quiet. A short down-bent whine
  // over a fizz of frost: sad, small, and nothing like `break`, because
  // melting is the clock running out and breaking is the tide winning,
  // and the player has to be able to tell those apart with their eyes
  // shut.
  melt(t, p, v, r) {
    tone(t, { f: 520 * r, fEnd: 210 * r, dur: .5, vol: .4 * v, type: 'sine',
              atk: .01, pan: p });
    burst(t, { f: 5200, fEnd: 2400, q: .8, dur: .4, vol: .22 * v,
               type: 'bandpass', env: 'fall', pan: p });
  },

  pop(t, p, v, r) {
    tone(t, { f: jr(300, 380), fEnd: jr(110, 145), dur: .06, vol: .3 * v, type: 'sine', pan: p, atk: .002, r });
    burst(t, { dur: .018, type: 'lowpass', f: 1600, fEnd: 600, vol: .12 * v, pan: p, env: 'click', r });
  },

  // a fireball, which in a nursery is a plastic bucket of air being
  // thumped. The SOFT EDGE is the whole sound: a 6 ms attack instead
  // of an instant one is what separates a bucket from an explosion,
  // and there is deliberately no high content anywhere in it.
  boom(t, p, v, r) {
    tone(t, { f: jr(140, 165), fEnd: 44, dur: .38, vol: .45 * v, type: 'sine', pan: p, atk: .006, r });
    burst(t, {
      dur: .34, type: 'bandpass', f: 260, fEnd: 120, q: 1.6, jit: .25,
      vol: .3 * v, pan: p, env: 'fall', r,
    });
    burst(t + .005, { dur: .1, type: 'lowpass', f: 2200, fEnd: 500, vol: .2 * v, pan: p, r });
  },

  // frost: a glass jar struck with a spoon. Long ringing partials at
  // glass ratios, on C6 or D6 so it lands in the key, plus a thread
  // of very high noise ringing along with it — that hiss is the
  // shimmer, and it is what a plain bell is missing.
  frost(t, p, v, r) {
    const f = note(13 + (Math.random() * 2 | 0));      // C6 / D6
    // 1.2 s nominal is about .75 s of audible tail: an exponential ramp
    // to silence passes -40 dB at three fifths of its length, so a ring
    // has to be written longer than the ring you want to hear.
    modal(t, {
      f, dur: 1.2, vol: .2 * v, pan: p, r,
      parts: [[1, 1, 1], [2.41, .5, .7], [4.17, .28, .45], [6.9, .13, .3]],
    });
    burst(t, { dur: .5, type: 'bandpass', f: 7000, fEnd: 5200, q: 2.5, vol: .06 * v, pan: p, env: 'fall', r });
  },

  // lightning: a handful of tiny bright crackles inside 60 ms with
  // one falling spark over them. The spark is what makes it a
  // discharge instead of a rattle.
  zap(t, p, v, r) {
    const n = 3 + (Math.random() * 3 | 0);
    let tt = t;
    for (let i = 0; i < n; i++) {
      burst(tt, {
        dur: jr(.008, .02), type: 'highpass', f: jr(3500, 7000), fEnd: jr(1500, 3000),
        q: .7, jit: .8, vol: .28 * v * jr(.6, 1), pan: p, env: 'click', r,
      });
      tt += jr(.006, .02);
    }
    tone(t, { f: 2400, fEnd: 700, dur: .09, vol: .1 * v, type: 'triangle', pan: p, r });
  },

  // the ground pound: the lowest thing in the game. A wooden boom is
  // a sub-thump PLUS a board — the flat slap of a big panel — and the
  // 3 ms of high noise on top is the only reason it reads as a floor
  // rather than as a subwoofer test.
  slam(t, p, v, r) {
    tone(t, { f: 95, fEnd: 34, dur: .55, vol: .55 * v, type: 'sine', pan: p, atk: .004, r });
    modal(t, { f: 78, dur: .35, vol: .18 * v, pan: p, r, parts: [[1, 1, 1], [2.4, .35, .5], [4.1, .14, .3]] });
    burst(t, { dur: .12, type: 'lowpass', f: 1400, fEnd: 260, q: 1.4, vol: .32 * v, pan: p, r });
    burst(t, { dur: .03, type: 'highpass', f: 2600, fEnd: 1000, vol: .15 * v, pan: p, env: 'click', r });
  },

  // taking damage: a rubber squeak, which is a resonant filter riding
  // a pitch that goes UP and then gives out. Up-then-down is the
  // whole gesture — a squeak that only falls is a sad trombone.
  hurt(t, p, v, r) {
    const f = jr(520, 700);
    tone(t, {
      // a bandpass this narrow, parked above the fundamental, throws most
      // of the saw away — the nominal level has to be high to arrive at
      // an audible one (measured at 21 dB under a clack before this)
      f, curve: [f * .8, f * 1.35, f * 1.12, f * .72], dur: .13, vol: .38 * v,
      type: 'sawtooth', pan: p, atk: .008, fc: f * 2.2, ft: 'bandpass', q: 5, r,
    });
  },

  // a marble destroyed, and it has to land: the snap (the brightest,
  // shortest thing in the file), whatever was inside it going down,
  // and then the pieces BOUNCING — spacing that shortens is the
  // rhythm of a dropped object and nothing else sounds like it.
  break(t, p, v, r) {
    knock(t, {
      f: jr(2000, 2600), bright: 9500, tick: .016, tickVol: 1.1, dur: .05,
      vol: .8 * v, pan: p, wood: 300, woodVol: .5,
      parts: [[1, 1, 1], [1.94, .5, .5], [3.3, .25, .3]], r,
    });
    tone(t + .02, {
      f: 260, fEnd: 70, dur: .5, vol: .3 * v, type: 'triangle', pan: p,
      fc: 1200, fcEnd: 300, atk: .004, r,
    });
    let tt = t + .09, dt = .12, f = jr(300, 380), amp = .34;
    for (let i = 0; i < 6; i++) {
      knock(tt, { f, bright: 3400, tick: .012, tickVol: .35, dur: .05, vol: amp * v, pan: p + jr(-.12, .12), wood: f * .5, r });
      tt += dt; dt *= .8; f *= jr(.9, .97); amp *= .68;
    }
  },

  // one of them gets across the line. The two notes ARE in the key
  // (A3 down to F3) — the sourness is BEATING: a second reed 35 cents
  // flat grinding against each one about four times a second. That
  // way the bad news still belongs to this game rather than sounding
  // like it wandered in from another one.
  leak(t, p, v, r) {
    // Two saws each, so the level is double what it reads as here — at
    // .18 this was the loudest peak in the game, louder than losing a
    // marble, which is the wrong order for a warning.
    const steps = [[note(2), t, .12], [note(0), t + .17, .135]];
    for (const [f, t0, g] of steps) {
      for (const c of [1, Math.pow(2, -35 / 1200)]) {
        tone(t0, {
          f: f * c, dur: .32, vol: g * v, type: 'sawtooth', pan: p,
          atk: .022, fc: 900, fcEnd: 480, q: 1, r,
        });
      }
    }
  },

  // -- ui and flow --

  // picking a marble out of the hand: a bright mallet note, and it
  // wanders over three degrees of the scale so picking five in a row
  // arpeggiates instead of beeping
  select(t, p, v, r) {
    const f = note([10, 12, 13][Math.random() * 3 | 0]);
    knock(t, {
      f, bright: 6000, tick: .01, tickVol: .28, dur: .2, vol: .3 * v, pan: p,
      parts: [[1, 1, 1], [3, .3, .4], [6.2, .1, .2]], r,
    });
  },

  // levelling up: F5–A5–C6, the major triad off the top of the key. A
  // xylophone bar is tuned so its first overtone is THREE times the
  // fundamental — that ratio is the instrument, and the 6.2 above it
  // is the rosewood.
  level(t, p, v, r) {
    [10, 12, 13].forEach((d, i) => {
      knock(t + i * .085, {
        f: note(d), bright: 7000, tick: .012, tickVol: .3, dur: .3,
        vol: (.3 + i * .04) * v, pan: p, parts: [[1, 1, 1], [3, .32, .4], [6.2, .12, .2]], r,
      });
    });
  },

  // a card sliding in. A riffle ACCELERATES — that is the whole tell;
  // evenly-spaced ticks are a ratchet. Kept to a dozen because the
  // voice cap counts scheduled voices (see VOICE_CAP).
  card(t, p, v, r) {
    const n = 10 + (Math.random() * 4 | 0);
    let tt = t, dt = .03;
    for (let i = 0; i < n; i++) {
      burst(tt, {
        dur: .012, type: 'highpass', f: jr(2600, 4200), fEnd: jr(1200, 1800), q: .6,
        vol: .11 * v * jr(.7, 1.1), pan: p + jr(-.06, .06), env: 'click', r,
      });
      tt += dt; dt *= .93;
    }
    burst(t, { dur: .26, type: 'lowpass', f: 3600, fEnd: 1400, jit: .3, vol: .1 * v, pan: p, env: 'swish', r });
  },

  // a booster taken: the clunk of a wooden block dropped into a slot,
  // and the F chord under it, strummed by twelve milliseconds so it
  // is an instrument being played rather than three notes triggered
  take(t, p, v, r) {
    knock(t, {
      f: 260, bright: 3000, tick: .018, tickVol: .4, dur: .12, vol: .5 * v, pan: p,
      wood: 120, woodVol: .7, woodDur: .13, parts: [[1, 1, 1], [2.3, .4, .5]], r,
    });
    [5, 7, 8].forEach((d, i) => tone(t + .03 + i * .012, {
      f: note(d), dur: .5, vol: .12 * v, type: 'triangle', pan: p,
      atk: .006, fc: 2600, fcEnd: 1100, r,
    }));
  },

  // the run ends: D5 C5 A4 F4 down the scale, each one softer, and
  // then the lid — a big soft thock and the air it pushes out of the
  // box. It is slow on purpose; a fast loss sound is a buzzer.
  lose(t, p, v, r) {
    [4, 3, 2, 0].forEach((d, i) => {
      knock(t + i * .3, {
        f: note(d) * 2, bright: 2600, tick: .012, tickVol: .18, dur: .5,
        vol: (.32 - i * .05) * v, pan: p, parts: [[1, 1, 1], [3, .22, .35]], r,
      });
    });
    const tl = t + 1.35;
    tone(tl, { f: 120, fEnd: 46, dur: .6, vol: .45 * v, type: 'sine', pan: p, atk: .007, r });
    burst(tl, { dur: .3, type: 'lowpass', f: 1200, fEnd: 200, jit: .2, vol: .2 * v, pan: p, env: 'fall', r });
  },

  // a surge arriving: a bowed box, not a horn. The swell is a LOWPASS
  // opening and closing, and the thread of noise moving with it is
  // the bow's grit — without that scrape a swelling triangle is just
  // a synth, which is the one thing this game must never sound like.
  wave(t, p, v, r) {
    // Measured, not guessed, and trimmed twice: a sustained sound is
    // levelled by its RMS and not by its peak, and at the level this
    // was first written to it had the highest sustained energy in the
    // vocabulary — sitting for a second and a half in the same low band
    // as `slam` and `boom`, which are the exact hits it would cover. A
    // warning has to be heard UNDER the game, not instead of it.
    for (const [d, g, det] of [[-5, .1, 0], [-2, .061, 6], [-5, .043, -7]]) {
      tone(t, {
        f: note(d) * Math.pow(2, det / 1200), dur: 1.3, vol: g * v, type: 'triangle',
        pan: p, atk: .45, fc: 300, fcEnd: 900, q: 1.2, r,
      });
    }
    burst(t, { dur: 1.3, type: 'bandpass', f: 320, fEnd: 700, q: 1.8, jit: .35, vol: .05 * v, pan: p, env: 'swell', r });
  },
};

// How long a sound must wait before it may play again. These are
// defaults for sounds that fire from inside per-frame loops, and
// `opts.cool` overrides. The unlisted default is one frame's worth:
// two identical hits scheduled at the same timestamp are not twice as
// loud, they are one hit 6 dB louder and slightly wrong.
const COOL = {
  aim: .045, roll: .04, crush: .013, clack: .012, wall: .03, bounce: .035,
  mow: .1, chain: .02, melt: .3,
  pop: .025, zap: .05, frost: .06, boom: .05, slam: .08,
  hurt: .08, break: .05, leak: .12,
};

// A sound fired twenty times a second is not twenty times as loud in
// the world — the ear fuses the stream and only the peaks pile up.
// Each repeat inside the fuse window costs the next play a little
// level and silence pays it straight back, which is what keeps a
// swarm being crushed sounding like gravel instead of a chainsaw.
// `clack` is deliberately NOT in this table: its repeats are the
// chain ladder, and a ladder that goes quiet as it climbs is a bug.
// `crush` ducks GENTLY. It was at .05 and a marble ploughing a whole
// formation faded to nothing after the first half-dozen — the one hit
// the player most wants to hear, quietly turned down by its own
// success. `chain` and `mow` are exempt for the same reason `clack` is:
// their repeats ARE the feedback.
const DUCK = { crush: .028, pop: .04, roll: .03, aim: .04, zap: .05, wall: .03, bounce: .03, hurt: .05 };

function repeatDuck(name, now) {
  const cost = DUCK[name];
  if (!cost) return 1;
  const s = REPEAT[name] || (REPEAT[name] = { t: -9, run: 0 });
  s.run = now - s.t < .18 ? Math.min(s.run + 1, 11) : 0;
  s.t = now;
  return 1 - s.run * cost;
}

// opts: { pan: -1..1, vol: 0..1.5, cool: seconds, rate: .5..2 }
// `rate` transposes — the game climbs it a semitone per collision in
// a chain, 2^(n/12), and the sound really goes up the scale.
function sfx(name, opts = {}) {
  const rec = SOUNDS[name];
  if (!ctx || muted || !rec) return;
  wake();
  const now = ctx.currentTime;
  const cool = opts.cool ?? COOL[name] ?? .008;
  if (now - (lastPlay[name] ?? -9) < cool) return;
  lastPlay[name] = now;
  const v = clamp(opts.vol ?? 1, 0, 1.5) * repeatDuck(name, now);
  if (v <= .002) return;
  // two milliseconds of lead: scheduling exactly at currentTime lands
  // in the past on a busy frame and the envelope's head is eaten
  rec(now + .002, clamp(opts.pan ?? 0, -1, 1), v, clamp(opts.rate ?? 1, .5, 2));
}

// ---- the music ---------------------------------------------------
// Generative, because there are no files here either — and it is a
// SCORE now rather than furniture. The first version was three quiet
// layers designed to be ignorable (a pad, a sparse pluck, a heartbeat)
// and it was correct for a game about a pencil and wrong for this one:
// a sheet of ice with a tide walking down it wants something with a
// pulse in it.
//
// What makes recorded epic music epic is not volume, it is an
// OSTINATO — a short figure repeating under a slow harmony, so the
// harmony feels like it is being driven somewhere. So:
//
//   PAD      four detuned sawtooth pairs holding the chord. It does not
//            restart on a chord change, it GLIDES — restarting six
//            oscillators every two bars is a wash of attacks and reads
//            as a synth patch changing, not as strings moving.
//   BASS     the chord root on the beat, an octave apart, short.
//   OSTINATO sixteenths through the chord tones. This is the engine.
//   DRUMS    a low boom on 1 and 3, a noise crack on 2 and 4, and
//            sixteenth shakers once it is really going.
//   BRASS    a slow three-note motif over the chord — the "tune" — and
//            it only ever appears high up or against a boss, so it
//            stays an event.
//
// THE KEY IS D MINOR, which is the relative minor of the F major
// pentatonic every pitched effect in this file is written in: the same
// seven notes, so the score and the sound effects cannot clash however
// they land against each other.
//
// Notes are booked by a lookahead scheduler: a setInterval every 50 ms
// that schedules everything due in the next 200 ms. A setTimeout per
// note is at the mercy of the main thread and would swing.
const LOOKAHEAD = .2, TICK = 50;

const BPM = 84;
const STEP = 60 / BPM / 4;               // one sixteenth
const MROOT = 73.416;                    // D2
const mhz = (semi, oct = 0) => MROOT * Math.pow(2, oct + semi / 12);

// Semitones above D. Dm, B♭, F, C — the four chords most of this kind
// of music is made of, and they are four because eight bars is long
// enough to feel like a passage and short enough to learn in one run.
const PROG = [
  { root: 0,  tones: [0, 3, 7] },        // i    Dm
  { root: 8,  tones: [8, 12, 15] },      // VI   B♭
  { root: 3,  tones: [3, 7, 10] },       // III  F
  { root: 10, tones: [10, 14, 17] },     // VII  C
];
// The boss gets its own four, and the difference is the last one: an A
// MAJOR against a D minor is the raised seventh, and that one note is
// the whole reason the harmonic minor sounds like something is coming.
const PROG_BOSS = [
  { root: 0,  tones: [0, 3, 7] },        // i    Dm
  { root: 8,  tones: [8, 12, 15] },      // VI   B♭
  { root: 5,  tones: [5, 8, 12] },       // iv   Gm
  { root: 7,  tones: [7, 11, 14] },      // V    A  (raised 7th)
];

const M = { intensity: 0, menu: false, over: false, draft: false, boss: false };
const applied = { intensity: -1, menu: null, draft: null, over: null, boss: null };
let wanted = false;
let pad = null, padFilt = null, padGain = null, padOsc = null;
let sched = null, nextStep = 0, stepN = 0, chordAt = -1;

function startMusic() {
  if (pad) return;
  const t = ctx.currentTime;
  padFilt = ctx.createBiquadFilter();
  padFilt.type = 'lowpass'; padFilt.Q.value = .9; padFilt.frequency.value = 420;
  padGain = ctx.createGain(); padGain.gain.value = .0001;
  padFilt.connect(padGain); padGain.connect(musicBus);

  // four voices, each a PAIR detuned a few cents apart. The beating
  // between the pair is the entire difference between "strings" and
  // "an oscillator": one saw held forever is a test tone.
  padOsc = [];
  for (let i = 0; i < 4; i++) {
    for (const cents of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mhz(PROG[0].tones[i % 3], i < 3 ? 1 : 2) * Math.pow(2, cents / 1200);
      const g = ctx.createGain();
      g.gain.value = (i === 3 ? .1 : .22) / 2;
      const pan = ctx.createStereoPanner();
      pan.pan.value = (i - 1.5) / 2.2;
      o.connect(g); g.connect(pan); pan.connect(padFilt);
      o.start(t);
      padOsc.push({ o, cents, slot: i });
    }
  }
  pad = true;
  chordAt = -1;
  nextStep = t + .06; stepN = 0;
  sched = setInterval(pump, TICK);
  applyMusic();
}

function stopMusic(fade = 1.2) {
  if (!pad) return;
  const t = ctx.currentTime;
  clearInterval(sched); sched = null;
  padGain.gain.cancelScheduledValues(t);
  padGain.gain.setTargetAtTime(.0001, t, Math.max(.02, fade / 3));
  for (const v of padOsc) v.o.stop(t + fade + .3);
  pad = null; padFilt = null; padGain = null; padOsc = null;
}

const prog = () => (M.boss && !M.menu ? PROG_BOSS : PROG);

function applyMusic() {
  if (!ctx || !pad) return;
  const t = ctx.currentTime;
  const i = clamp(M.intensity, 0, 1);
  // the filter opening IS the arrangement getting louder — a bed that
  // only gains volume gets closer, a bed that opens gets bigger
  const open = M.over ? 300 : M.menu ? 460 : 520 + i * 1500 + (M.boss ? 500 : 0);
  padFilt.frequency.setTargetAtTime(open, t, M.over ? 1.6 : M.draft ? .5 : 1.1);
  // the draft freezes the run, so everything but the pad stops and the
  // pad itself drops back — the cards are a held breath
  const g = M.over ? .075 : M.draft ? .06 : M.menu ? .085 : .11 + i * .1;
  padGain.gain.setTargetAtTime(g, t, M.over ? 1.4 : M.draft ? .4 : 1.1);
}

/** move the held pad onto a new chord. A GLIDE, not a retrigger. */
function setChord(t, c) {
  const gl = STEP * 3;
  for (const v of padOsc) {
    const semi = c.tones[v.slot % 3];
    const oct = v.slot < 3 ? 1 : 2;
    v.o.frequency.setTargetAtTime(
      mhz(semi, oct) * Math.pow(2, v.cents / 1200), t, gl);
  }
}

function pump() {
  if (!ctx || !pad) return;
  // A hidden tab throttles setInterval to about once a second, and a
  // naive scheduler answers by dumping a second of notes at one
  // instant. Same trap as the rAF one: if we fell behind, do not catch
  // up — start again from now.
  if (nextStep < ctx.currentTime - .25) nextStep = ctx.currentTime + .05;
  const until = ctx.currentTime + LOOKAHEAD;
  let guard = 0;
  while (nextStep < until && guard++ < 32) {
    schedStep(nextStep, stepN++);
    nextStep += STEP;
  }
}

// one sixteenth. `n` counts them from the start of the run, so every
// layer is a modulo of the same number and nothing can drift.
function schedStep(t, n) {
  const P = prog();
  const bar = (n / 16) | 0;
  const ci = (bar >> 1) % P.length;                 // two bars a chord
  const c = P[ci];
  const beat = n % 16;

  if (ci !== chordAt) { chordAt = ci; setChord(t, c); }

  // the run is over: the chords keep turning under the screen and one
  // low note lands every other bar. Quiet, but never nothing.
  if (M.over) {
    if (beat === 0 && (bar % 2 === 0))
      tone(t, { f: mhz(c.root, 0), dur: STEP * 10, vol: .085, type: 'sawtooth',
                atk: .5, fc: 180, fcEnd: 90, q: .9, bus: musicBus });
    return;
  }
  if (M.draft) return;                              // the cards: pad alone

  const i = clamp(M.intensity, 0, 1);
  const boss = M.boss;
  const drive = M.menu ? 0 : i;

  // --- BASS. Always there, because it is what the pad is standing on.
  if (beat % 4 === 0) {
    const oct = beat === 0 ? 0 : (beat === 8 ? 0 : 1);
    tone(t, { f: mhz(c.root, oct), dur: STEP * 3.2, vol: M.menu ? .08 : .13 + drive * .07,
              type: 'sawtooth', atk: .006, fc: 260 + drive * 220, fcEnd: 120, q: 1.1,
              bus: musicBus });
  }

  // --- OSTINATO. The engine: chord tones up and back, every sixteenth
  // once it is moving. Sparse below a quarter intensity so the opening
  // of a run is not already at full tilt.
  if (!M.menu && drive > .12) {
    const fig = [0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1];
    const on = drive > .45 ? true : beat % 2 === 0;
    if (on) {
      const semi = c.tones[fig[beat]];
      const oct = 2 + (drive > .7 && beat % 8 === 0 ? 1 : 0);
      tone(t, {
        f: mhz(semi, oct), dur: STEP * 1.7, vol: .062 + drive * .06,
        type: 'triangle', atk: .003, fc: 2600, fcEnd: 900, q: .9,
        pan: ((beat % 4) - 1.5) / 4, bus: musicBus,
      });
    }
  } else if (M.menu && beat % 8 === 0) {
    // the menu keeps one lonely note of it, so the title is the same
    // piece of music asleep rather than a different one
    tone(t, { f: mhz(c.tones[beat ? 2 : 0], 2), dur: .7, vol: .075,
              type: 'triangle', atk: .004, fc: 1800, fcEnd: 700, bus: musicBus });
  }

  // --- DRUMS.
  if (!M.menu && drive > .28) {
    const d = (drive - .28) / .72;
    if (beat === 0 || beat === 8) boom(t, .3 + d * .32);
    if (beat === 4 || beat === 12) crack(t, .1 + d * .16);
    if (d > .55 && beat % 2 === 1) shaker(t, .022 * d);
    // and the one fill that says a bar just ended
    if (d > .35 && beat === 14 && ((bar % 4) === 3)) {
      crack(t, .1 * d); crack(t + STEP * .5, .14 * d);
    }
  }

  // --- BRASS. The tune, and it is rationed: high intensity or a boss.
  if (!M.menu && (boss || drive > .62) && beat === 0 && (bar % 2 === 0)) {
    const line = boss ? [0, 2, 1] : [2, 0, 1];
    const semi = c.tones[line[(bar >> 1) % 3]];
    brass(t, mhz(semi, boss ? 1 : 2), STEP * 12, .12 + drive * .07);
  }
}

// Music voices are not counted against the sfx cap on purpose: a bed
// that drops out because the swarm is loud is worse than no bed.
function boom(t, g) {
  // 55 down to 28 in a third of a second: the pitch drop IS the size of
  // the drum. Held flat it is a bass note, not an impact.
  tone(t, { f: 62, fEnd: 28, bend: .18, dur: .42, vol: g, type: 'sine', atk: .004, bus: musicBus });
  tone(t, { f: 124, fEnd: 60, bend: .08, dur: .12, vol: g * .35, type: 'triangle', atk: .002, bus: musicBus });
}

function crack(t, g) {
  burst(t, { f: 1900, fEnd: 700, q: .7, dur: .17, vol: g, type: 'bandpass',
             env: 'hit', bus: musicBus });
  tone(t, { f: 190, fEnd: 140, dur: .09, vol: g * .5, type: 'triangle', atk: .002, bus: musicBus });
}

function shaker(t, g) {
  burst(t, { f: 7200, q: .8, dur: .05, vol: g, type: 'highpass', env: 'hit',
             pan: jr(-.4, .4), bus: musicBus });
}

function brass(t, f, dur, g) {
  // a saw with a slow attack and a filter that opens INTO the note is
  // the cheapest convincing brass there is: what the ear reads as brass
  // is the harmonics arriving late, not the waveform.
  tone(t, { f, dur, vol: g, type: 'sawtooth', atk: .09,
            fc: 300, fcEnd: 2200, q: 1.4, pan: -.12, bus: musicBus });
  tone(t, { f: f * 1.005, dur, vol: g * .7, type: 'sawtooth', atk: .12,
            fc: 300, fcEnd: 1800, q: 1.4, pan: .12, bus: musicBus });
}

// patch: { intensity: 0..1, menu, over, draft, boss }. Cheap to call
// every frame — the ramps are only re-aimed when something actually
// moved, or a per-frame call would post sixty automation events a
// second.
function music(patch) {
  if (patch) Object.assign(M, patch);
  wanted = true;
  if (!ctx) return;                      // remembered until the first gesture
  wake();
  // OVER IS A MUSICAL STATE, NOT A STOP. It used to fade the bed out
  // and leave the game-over screen in dead air — which is the one
  // moment the player is sitting still reading a number, and the worst
  // possible moment for the room to go quiet. The score does not end,
  // it just loses everything that was driving it: no drums, no
  // ostinato, no brass, the filter shut down to a murmur and the
  // harmony left turning over by itself.
  if (!pad) startMusic();
  if (Math.abs(M.intensity - applied.intensity) > .015 ||
      M.menu !== applied.menu || M.draft !== applied.draft ||
      M.boss !== applied.boss || applied.over) {
    applied.intensity = M.intensity; applied.menu = M.menu;
    applied.draft = M.draft; applied.boss = M.boss; applied.over = false;
    applyMusic();
  }
}

// ---- switches ----------------------------------------------------
function wake() {
  if (!killed) return;
  killed = false;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, .05);
}

// Everything off — the page went away. NOT the end of a run: `over` is
// a musical state (see `music`), and the only thing that may leave the
// game in silence is a tab nobody is looking at. Nothing is
// force-stopped except the pad: the tail of whatever was ringing just
// ends under a master duck that is fast enough to land inside a frame
// and slow enough not to click, and every voice still retires through
// its own onended, so the counter cannot leak. The next sfx() or
// music() call brings the level back.
function stop() {
  if (!ctx) return;
  stopMusic(.05);
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0, ctx.currentTime, .04);
  killed = true;
}

function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted || killed ? 0 : MASTER, ctx.currentTime, .04);
  return muted;
}

export const toybox = {
  sfx, music, toggleMute, stop,
  // for measurement only: a test can tap the master and read what the
  // score is actually putting out, which is the only way anything in
  // this file gets checked without ears
  get ctx() { return ctx; },
  get master() { return master; },
  get musicBus() { return musicBus; },
  get muted() { return muted; },
  get ready() { return !!ctx; },
};
