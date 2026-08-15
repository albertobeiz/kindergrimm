# Music stems

The game layers up to four looping stems (`src/audio.js`). Drop them
in this folder as mp3 — any that are missing simply play silent, so
you can add them one at a time.

| file         | plays when                        | character |
|--------------|-----------------------------------|-----------|
| `calm.mp3`   | always; fades as threat rises     | sparse broken music box lullaby, minor key, lots of silence, tape wow |
| `unease.mp3` | threat > 0                        | low drones, bowed metal, faint air — no melody |
| `danger.mp3` | threat > ~0.45                    | slow heartbeat pulse, denser texture |
| `draft.mp3`  | the draft / door scene is open    | the calm theme, thinner — a single music box, slower |

Rules for generating (Lyria / Gemini or anything else):

- **Same key and same tempo for all four**, so they stack. Suggest
  A minor, 60 BPM.
- **Same length** (e.g. exactly 64s), or at least an exact multiple —
  every layer loops independently from one shared start time, and
  mismatched lengths drift against each other.
- Instrumental only, quiet, mixed dark. The game plays them at low
  gain under synthesized pencil SFX; loud masters will fight the room.
- Trim to a seamless loop point yourself — generated audio almost
  never loops clean out of the box. A short crossfade baked into the
  file (tail folded into the head) is the reliable way.

Prompt direction that matches the game's register (graphite doodle,
cute-but-dark, "always night in a baby school"):

> slow broken music box lullaby, A minor, 60 bpm, sparse, detuned,
> tape hiss and wow, long silences, childlike but wrong, no drums,
> instrumental
