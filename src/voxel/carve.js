// ---------------------------------------------------------------
// THE HAND — but for solids.
//
// `sketch.js` is the hand that draws; this is the hand that CARVES.
// A voxel part never touches three.js: it calls set/fill/disc/blob on
// a Carve and gets a bag of coloured cells. Turning that bag into a
// mesh is this file's other half, and it happens once per part.
//
// COORDINATES — integers, y UP, +z toward the viewer (so the face is
// on the +z side), x mirrored about 0. The origin is the FLOOR between
// the feet: cell y=0 is the lowest layer and its underside sits at
// world y=0, so standing a character on a floor is `position.y = 0`.
// This is deliberately NOT the 2D rig's convention (px, y down, origin
// at the head) — there is no canvas here to hang off, and a solid
// wants to be measured from the ground it stands on.
//
// Widths are ODD and centred on x=0, which is what makes `sym()` exact
// and keeps a face from being half a voxel off its own centre line.
//
// DAB vs SET is the distinction to understand: `set` adds a solid,
// `dab` only recolours a cell some EARLIER part already filled. A
// spot, a blush, a sock, an eye — anything that lives on a surface
// rather than adding to a silhouette — is dabbed, and then it can
// never float in mid-air no matter what shape the body under it
// turned out to be.
// ---------------------------------------------------------------
import * as THREE from 'three';

// One integer per cell: three 8-bit fields, so the addressable block
// is -128..127 on each axis. A character is ~34 tall; the crowd's
// platform is what actually needs the room.
const KOFF = 128;
export const key = (x, y, z) => (((x + KOFF) & 255) << 16) | (((y + KOFF) & 255) << 8) | ((z + KOFF) & 255);
export const unkey = k => [((k >> 16) & 255) - KOFF, ((k >> 8) & 255) - KOFF, (k & 255) - KOFF];

// A real hash, not a linear combination: `(x*7 + y*13 + z*29) & 7`
// looks random on a curved surface and turns into visible plaid the
// moment it is laid across a big flat one, like a floor.
export function hash3(x, y, z, salt = 0) {
  let h = 2166136261 ^ Math.imul(salt, 374761393);
  h = Math.imul(h ^ (x + 128), 16777619);
  h = Math.imul(h ^ (y + 128), 16777619);
  h = Math.imul(h ^ (z + 128), 16777619);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export class Carve {
  // `prev` is the composite of every part built BEFORE this one — what
  // `dab` and `taken` see. The rig passes it; parts never build it.
  constructor(prev = null) {
    this.cells = new Map();      // key -> colour
    this.prev = prev;
    this.m = 1;                  // x mirror, driven by sym()
  }

  // ---- the primitives ------------------------------------------
  set(x, y, z, c) { this.cells.set(key(this.m * x, y, z), c); }

  /** true if this part, or any part before it, filled the cell */
  taken(x, y, z) {
    const k = key(this.m * x, y, z);
    return this.cells.has(k) || !!this.prev?.has(k);
  }

  /** recolour a cell only where there is already something to paint */
  dab(x, y, z, c) { if (this.taken(x, y, z)) this.set(x, y, z, c); }


  /**
   * One horizontal layer of a superellipse. `n` is the whole shape
   * family in one number: 2 is a circle, 4 a rounded square, 8 a box
   * with the corners knocked off. It is the voxel answer to the 2D
   * skull's radius(ang) — same job, one dimension up.
   */
  disc(y, cx, cz, rx, rz, c, n = 2, k = 1) {
    if (rx < .4 || rz < .4) return;
    const p = 2 / n;
    for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++)
      for (let z = Math.ceil(cz - rz); z <= Math.floor(cz + rz); z++) {
        const u = Math.abs((x - cx) / rx), v = Math.abs((z - cz) / rz);
        if (Math.pow(u ** n + v ** n, p) <= k * k) this.set(x, y, z, c);
      }
  }

  /** the 3D version: a superellipsoid, stacked out of discs */
  blob(cx, cy, cz, rx, ry, rz, c, n = 2, k = 1) {
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      const t = Math.abs((y - cy) / ry);
      if (t > k) continue;
      const f = Math.pow(Math.max(0, k ** n - t ** n), 1 / n);
      this.disc(y, cx, cz, rx * f, rz * f, c, n, 1);
    }
  }

  /**
   * A thick line from a to b, tapering r0 → r1. Sampled at a third of
   * a voxel, so a diagonal limb comes out solid — stepping by 1 leaves
   * a dotted line the moment the direction is not axis-aligned.
   */
  stroke(a, b, r0, r1, c) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 3));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(a[0] + (b[0] - a[0]) * t);
      const y = Math.round(a[1] + (b[1] - a[1]) * t);
      const z = Math.round(a[2] + (b[2] - a[2]) * t);
      const r = r0 + (r1 - r0) * t, ri = Math.floor(r);
      for (let dx = -ri; dx <= ri; dx++)
        for (let dy = -ri; dy <= ri; dy++)
          for (let dz = -ri; dz <= ri; dz++)
            if (dx * dx + dy * dy + dz * dz <= r * r + .4) this.set(x + dx, y + dy, z + dz, c);
    }
  }

  /** everything placed inside runs twice, mirrored on x */
  sym(fn) {
    const m = this.m;
    this.m = m; fn(1);
    this.m = -m; fn(-1);
    this.m = m;
  }

  /**
   * Deterministic value noise from a position. This is how a spot, a
   * freckle or a scuff gets placed without storing a list in the
   * recipe — and because it is a hash and not an rng, it is stable
   * across rebuilds and across states, so nothing ever shimmers.
   */
  h01(x, y, z, salt = 0) { return hash3(x, y, z, salt); }
}

// ---------------------------------------------------------------
// THE MESHER
//
// One BufferGeometry per part per state. Interior faces are dropped
// against the WHOLE character's occupancy, not just this part's, which
// is what welds a head to a torso instead of stacking two boxes. Two
// things are baked into the vertex colours rather than lit at runtime:
//
//   face shading — a fixed light, up and to the front-right. Baked, so
//     it cannot swim when the camera orbits, and no lights are needed.
//   corner AO    — the classic voxel trick: a corner with neighbours
//     around it goes dark. This is what stops a voxel model reading as
//     a pile of cubes, and it costs three lookups per corner.
//
// Plus a whisper of per-cell value noise, so a big flat cheek has some
// grain in it. Hashed from the position, never rolled — the drawn
// version's line boil is welcome to shimmer, a solid is not.
// ---------------------------------------------------------------
const AO_STEP = .085;
const GRAIN = .05;

// Normal, the two in-plane axes, and the shade of that face.
// cross(u, v) MUST equal n, or that face comes out wound backwards and
// is culled — which shows up as seeing the model's inside.
const FACES = [
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], sh: 1.00 },   // top
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], sh: .50 },   // bottom
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], sh: .86 },   // +x
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], sh: .70 },   // -x
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], sh: .94 },    // +z, the face
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], sh: .64 },  // -z
];

/**
 * cells  Map(key -> colour)  what to draw
 * occ    Map(key -> …)        the WHOLE character, for culling and AO
 * pivot  [x,y,z] in voxels — the point this mesh's group turns about
 * vx     world units per voxel
 * shade  bake the fixed face shading into the vertex colours (default).
 *        Turn it OFF for a scene with real lights: the baked key light
 *        points one way for ever, and under a lamp that moves it fights
 *        the lighting instead of adding to it. The AO and the grain are
 *        baked either way — they are geometry, not illumination.
 *
 * Culling is done against the whole character, across groups, so a
 * head really is welded to a torso. The price is that anything which
 * moves relative to its neighbour must OVERLAP it by a voxel or two —
 * see `neckY` in vlayout.js — or a head cocking toward a glance drags
 * the culled seam into view.
 */
export function meshCells({ cells, occ, pivot = [0, 0, 0], vx = 1 / 16, shade = true }) {
  const pos = [], col = [], nor = [];
  const solid = (x, y, z) => occ.has(key(x, y, z));

  for (const [k, c] of cells) {
    const [x, y, z] = unkey(k);
    const cr = ((c >> 16) & 255) / 255, cg = ((c >> 8) & 255) / 255, cb = (c & 255) / 255;
    const grain = 1 - GRAIN * .5 + GRAIN * hash3(x, y, z, 5);

    for (const f of FACES) {
      const [nx, ny, nz] = f.n;
      if (solid(x + nx, y + ny, z + nz)) continue;   // interior: never seen
      const [ux, uy, uz] = f.u, [vx_, vy, vz] = f.v;
      const sh = (shade ? f.sh : 1) * grain;

      // the four corners, and the AO each of them sits in
      const P = [], C = [];
      for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const si = i * 2 - 1, sj = j * 2 - 1;
        const a = solid(x + nx + ux * si, y + ny + uy * si, z + nz + uz * si);
        const b = solid(x + nx + vx_ * sj, y + ny + vy * sj, z + nz + vz * sj);
        const d = solid(x + nx + ux * si + vx_ * sj, y + ny + uy * si + vy * sj, z + nz + uz * si + vz * sj);
        const ao = (a && b) ? 3 : (a ? 1 : 0) + (b ? 1 : 0) + (d ? 1 : 0);
        const s = sh * (1 - ao * AO_STEP);
        // corner offset: from the cell's centre, half a cell along the
        // normal and half along each in-plane axis
        P.push([
          (x + (nx + ux * si + vx_ * sj) * .5 - pivot[0]) * vx,
          (y + .5 + (ny + uy * si + vy * sj) * .5 - pivot[1]) * vx,
          (z + (nz + uz * si + vz * sj) * .5 - pivot[2]) * vx,
        ]);
        C.push([cr * s, cg * s, cb * s]);
      }
      // split the quad along the darker diagonal, or the AO gradient
      // kinks visibly across a corner
      const flip = C[0][0] + C[2][0] > C[1][0] + C[3][0];
      const tri = flip ? [0, 1, 2, 0, 2, 3] : [1, 2, 3, 1, 3, 0];
      for (const i of tri) { pos.push(...P[i]); col.push(...C[i]); nor.push(nx, ny, nz); }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // flat per-face normals, always: they cost 12 bytes a vertex and they
  // are the difference between a scene being able to light this and not
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.computeBoundingSphere();
  geo.userData.tris = pos.length / 9;
  return geo;
}
