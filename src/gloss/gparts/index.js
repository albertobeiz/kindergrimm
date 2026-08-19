// The registry. Order is build order, and the only hard requirement is
// that `body` runs first — the layout it establishes is what every
// face part places against.
//
// Adding a face part = one file here + one line below. It never
// touches the rig, the shapes it can use are in `gshape.js`, and it
// places itself through `L.at`.
import { Body } from './body.js';
import { Frame } from './frame.js';
import { Crest } from './crest.js';
import { Hair } from './hair.js';
import { Eyes } from './eyes.js';
import { Brows } from './brows.js';
import { Nose } from './nose.js';
import { Mouth } from './mouth.js';
import { Blush } from './blush.js';
// THE EXTRAS. Everything above is what a character IS; these are what it is
// WEARING or what has happened to it, and all three are dealt rare on
// purpose — an accessory on every character is not a character, it is the
// house style.
import { Specs } from './specs.js';
import { Hat } from './hat.js';
import { Mark } from './mark.js';

// There WAS a `muzzle` part here — a second storey on the lower face
// in patch, lump and snout. All three are gone. The flat patch read as
// a white block behind the mouth, and the two solid ones pushed the
// face out into a snout that fought the head's own silhouette. What
// carries a species turned out to be the EARS and the eye patches, not
// a second lump of geometry.
export const GPARTS = [Body, Frame, Crest, Hair, Hat, Eyes, Brows, Specs, Nose, Mouth,
                       Blush, Mark];
export const GPART_BY_ID = Object.fromEntries(GPARTS.map(p => [p.id, p]));
