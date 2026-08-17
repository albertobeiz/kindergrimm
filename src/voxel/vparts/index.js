// ---------------------------------------------------------------
// THE VOXEL PART REGISTRY — the one place a part type is turned on.
//
// To add a part:
//   1. write src/voxel/vparts/<yourpart>.js following the contract in
//      ARCHITECTURE.md §11 (copy the nearest part as a base)
//   2. import it here
//   3. put it in this list, in BUILD ORDER
//
// BUILD ORDER IS OWNERSHIP. Every cell belongs to exactly one part:
// the LAST one to write it. That is the voxel version of draw order,
// and it is stricter — a later part does not cover an earlier one, it
// takes the cell outright, so nothing is ever drawn twice and there is
// no z-fighting to sort out. It is why the face is listed after the
// skull (an eye takes the skin cell it sits on) and why the marks are
// listed BEFORE the hair (a spot must not land on a hairstyle) and
// before the face (a spot must never land on an eye).
//
// Nothing else needs to change. The editor panel, the recipe,
// reroll/lock and the animator all read this list.
// ---------------------------------------------------------------
import { Skull } from './skull.js';
import { Crest } from './crest.js';
import { Hair } from './hair.js';
import { Eyes, Brows } from './eyes.js';
import { Nose, Mouth } from './face.js';
import { Extras, Hat } from './extras.js';
import { Torso, Arms, Legs, Legs4, Tail } from './body.js';

export const VPARTS = [
  // --- the body group: planted on the floor, breathes ---
  Tail,
  Legs,      // biped
  Legs4,     // quad
  Torso,
  Arms,      // biped
  // --- the head group: rides the breath, sways, cocks toward a glance
  Skull,     // the solid the rest of the head is painted onto
  Extras,    // marks go UNDER the hair and UNDER the face
  Hair,
  Crest,     // ears and horns push through the hair
  // --- the face: painted onto whatever front surface the skull has.
  // MOUTH FIRST: on a doodle face the mouth sits up BETWEEN the eyes,
  // and when the two plates touch it is the eyes that must win the
  // contested cells — a mouth clipped by an eye is a doodle, an eye
  // clipped by a mouth is a bug.
  Mouth,
  Eyes,
  Brows,
  Nose,
  // --- worn over the lot ---
  Hat,
];

export const VPART_BY_ID = Object.fromEntries(VPARTS.map(d => [d.id, d]));
