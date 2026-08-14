// ---------------------------------------------------------------
// THE PART REGISTRY — the one place a part type is turned on.
//
// To add a new kind of part:
//   1. write src/parts/<yourpart>.js following the contract in
//      ARCHITECTURE.md (copy the nearest existing part as a base)
//   2. import it here
//   3. put it in PARTS, in DRAW ORDER: earlier entries are drawn
//      BEHIND later ones
//
// Nothing else in the codebase needs to change. The editor panel,
// the recipe, reroll/lock, the crowd and the animator all read this
// list.
// ---------------------------------------------------------------
import { Skull, Ears } from './skull.js';
import { Eyes, Brows } from './eyes.js';
import { Mouth, Nose } from './mouthnose.js';
import { Hair } from './hair.js';
import { Extras } from './extras.js';
import { Crest } from './crest.js';
import { Torso, Arms, Legs, Tail, Wings, Paws, QuadLegs } from './body.js';

export const PARTS = [
  // --- body (region:'body'): behind and below the head, planted on
  // the floor — the animator moves the head, the body stays put ---
  Tail,     // behind everything
  Legs,
  Torso,
  Arms,     // in front of the torso, still behind the head
  Wings,    // birds only (species-specific part)
  Paws,     // the 'sit' base uses these instead of arms+legs
  QuadLegs, // the 'quad' base: four legs with cat paws
  // --- head ---
  Hair,     // the back mass draws behind the skull (see its bones())
  Crest,
  Skull,    // no neck: the head sits straight on the body, Isaac-style
  Ears,
  Eyes,
  Brows,
  Nose,
  Mouth,
  Extras,   // marks, tears, accidents: always last, over everything
];

export const PART_BY_ID = Object.fromEntries(PARTS.map(d => [d.id, d]));
