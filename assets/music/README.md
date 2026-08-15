# Music stems

The game layers up to four looping stems (`src/audio.js`). Drop them
in this folder as mp3 — any that are missing simply play silent, so
you can add them one at a time.

| file         | plays when                        | character |
|--------------|-----------------------------------|-----------|
| `calm.mp3`   | always; fades as threat rises     | playful dark waltz — pizzicato, celesta, music box; creepy-cute, Elfman-ish |
| `unease.mp3` | threat > 0                        | creeping low pizzicato, bass clarinet, tiptoe tension — no melody |
| `danger.mp3` | threat > ~0.45                    | dark circus march, heartbeat pulse, low brass stabs |
| `draft.mp3`  | the draft / door scene is open    | the calm theme thinner — one music box, slower |

Rules for generating (Lyria / Gemini or anything else):

- **Same key and same tempo for all four**, so they stack. Suggest
  A minor, 84 BPM.
- **Same length** (e.g. exactly 64s), or at least an exact multiple —
  every layer loops independently from one shared start time, and
  mismatched lengths drift against each other.
- Instrumental only, quiet, mixed dark. The game plays them at low
  gain under synthesized pencil SFX; loud masters will fight the room.
- Trim to a seamless loop point yourself — generated audio almost
  never loops clean out of the box. A short crossfade baked into the
  file (tail folded into the head) is the reliable way.

Prompt direction that matches the game's register (graphite doodle,
cute-but-dark, "always night in a baby school") — playful over
mournful, mischief over dread:

> playful dark waltz, pizzicato strings, celesta and music box,
> mischievous and creepy-cute, danny elfman style, minor key, bouncy
> but gentle, halloween toybox, instrumental
