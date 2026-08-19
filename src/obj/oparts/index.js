// The registry. Order is build order (and draw order among meshes,
// which barely matters here — plants are opaque, depth sorts itself).
// Adding a plant part = one file here + one line below; it never
// touches the rig, the shapes it can use are in `oshape.js`, and it
// places itself off `L` (rootY, crownY, leaf unit) and `C` (colours).
import { Mound } from './mound.js';
import { Stem } from './stem.js';
import { Leaves } from './leaves.js';
import { Bloom } from './bloom.js';

export const OPARTS = [Mound, Stem, Leaves, Bloom];
export const OPART_BY_ID = Object.fromEntries(OPARTS.map(p => [p.id, p]));