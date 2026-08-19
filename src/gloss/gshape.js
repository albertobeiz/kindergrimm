// ---------------------------------------------------------------
// THE HAND — `sketch.js` draws, `carve.js` carves, this one CUTS AND
// STAMPS. Everything in this lab is solid geometry: no fields, no
// sampling grid, nothing to resolve. Two things get made here.
//
//   A SOLID — the body. A sphere, scaled.
//   A PLATE — every face feature. An outline, extruded, bevelled.
//
// The plate is the whole face system, and it is one shape of thing on
// purpose: a flat front with a rounded rim. That rim is the cartoon
// read — it is what catches the studio highlight around the edge of an
// eye, and it is why a feature looks moulded into the toy rather than
// printed on it.
//
// AUTHORING RULE: a plate's front crest sits at z = 0 and its body
// runs BACKWARD. Placed on the skin it is therefore flush, and `proud`
// is the single number that lifts it out. Because the body runs
// backward and the sphere curves away underneath, a plate can never
// float off the silhouette.
//
// Parts never import this file — they never touch three.js. They name
// an OUTLINE and hand over numbers, and the rig stamps them here.
// ---------------------------------------------------------------
import * as THREE from 'three';

const SEG = 44;

// ---- outlines ---------------------------------------------------------
// Every one is centred on the origin and takes HALF-extents.

function ellipse(w, h) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, w, h, 0, Math.PI * 2, false, 0);
  return s;
}

function ring(w, h, thick) {
  const s = ellipse(w, h);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, w * (1 - thick), h * (1 - thick), 0, Math.PI * 2, true, 0);
  s.holes.push(hole);
  return s;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  r = Math.min(r, w, h);
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);  s.absarc(w - r, -h + r, r, -Math.PI / 2, 0);
  s.lineTo(w, h - r);   s.absarc(w - r, h - r, r, 0, Math.PI / 2);
  s.lineTo(-w + r, h);  s.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-w, -h + r); s.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

/** a rounded rectangle with a rounded rectangle punched out of it —
 *  square spectacles, and anything else that is a frame rather than a
 *  filled shape. `ring` is its elliptical twin. */
function rectRing(w, h, r, thick) {
  const s = roundedRect(w, h, r);
  const iw = w * (1 - thick), ih = h * (1 - thick);
  const ir = Math.max(1e-4, Math.min(r * (1 - thick), iw, ih));
  const hole = new THREE.Path();
  // wound the OTHER way round from `roundedRect`: a hole has to run
  // against its shape or three fills it in as solid
  hole.moveTo(-iw + ir, -ih);
  hole.absarc(-iw + ir, -ih + ir, ir, Math.PI * 1.5, Math.PI, true);
  hole.lineTo(-iw, ih - ir);
  hole.absarc(-iw + ir, ih - ir, ir, Math.PI, Math.PI / 2, true);
  hole.lineTo(iw - ir, ih);
  hole.absarc(iw - ir, ih - ir, ir, Math.PI / 2, 0, true);
  hole.lineTo(iw, -ih + ir);
  hole.absarc(iw - ir, -ih + ir, ir, 0, -Math.PI / 2, true);
  s.holes.push(hole);
  return s;
}

/** the four-point sparkle. The sides are pulled IN toward the centre —
 *  that concavity is the entire reason it reads as a star and not a
 *  diamond, and `pinch` is how deep the waist cuts. */
function sparkle(w, h, pinch) {
  const s = new THREE.Shape();
  s.moveTo(0, h);
  s.quadraticCurveTo(w * pinch, h * pinch, w, 0);
  s.quadraticCurveTo(w * pinch, -h * pinch, 0, -h);
  s.quadraticCurveTo(-w * pinch, -h * pinch, -w, 0);
  s.quadraticCurveTo(-w * pinch, h * pinch, 0, h);
  return s;
}

function star5(w, h) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 ? .46 : 1;
    const x = Math.cos(a) * w * r, y = -Math.sin(a) * h * r;
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function heart(w, h) {
  const s = new THREE.Shape();
  s.moveTo(0, -h);
  s.bezierCurveTo(-w * 1.25, h * .18, -w * .62, h * 1.28, 0, h * .46);
  s.bezierCurveTo(w * .62, h * 1.28, w * 1.25, h * .18, 0, -h);
  return s;
}

/** an X: a plus polygon turned 45°. The bevel rounds its corners. */
function cross(w, arm) {
  const c = Math.SQRT1_2;
  const pts = [[arm, arm], [w, arm], [w, -arm], [arm, -arm], [arm, -w], [-arm, -w],
               [-arm, -arm], [-w, -arm], [-w, arm], [-arm, arm], [-arm, w], [arm, w]];
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => {
    const px = (x - y) * c, py = (x + y) * c;
    i === 0 ? s.moveTo(px, py) : s.lineTo(px, py);
  });
  s.closePath();
  return s;
}

/** a polar polygon: `r(θ)` sampled round once. Every lobed outline in
 *  the catalogue is one of these with a different harmonic. */
function polar(w, h, n, fn) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, r = fn(a);
    const x = Math.cos(a) * w * r, y = Math.sin(a) * h * r;
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/** a daisy. `petals` lobes from one absolute cosine. */
function flower(w, h, petals, amp) {
  return polar(w, h, 132, a => 1 - amp + amp * Math.abs(Math.cos(petals * a / 2)));
}

/** an organic lump — fixed harmonics, so it is the SAME lump every
 *  rebuild. A wobble rolled per frame is the drawn rig's line boil,
 *  and a solid has no business shimmering. */
function wobble(w, h) {
  return polar(w, h, 108, a => 1 + .13 * Math.cos(3 * a + .7) + .07 * Math.sin(5 * a));
}

/** a moon: one bulging arc out and a shallower one back. `bite` is how
 *  deep the inner curve cuts, so 0 is a disc and 1 is a hair. */
function crescent(w, h, bite) {
  const s = new THREE.Shape();
  const o = w * 1.33, i = o * (1 - bite);
  s.moveTo(0, h);
  s.bezierCurveTo(-o, h * .55, -o, -h * .55, 0, -h);
  s.bezierCurveTo(-i, -h * .5, -i, h * .5, 0, h);
  return s;
}

function triangle(w, h, flip) {
  const s = new THREE.Shape();
  const d = flip ? -1 : 1;
  s.moveTo(0, -h * d); s.lineTo(w, h * d); s.lineTo(-w, h * d);
  s.closePath();
  return s;
}

// ---- bands ------------------------------------------------------------
// A mouth, a brow and a closed lid are all the SAME object: a stroke of
// constant width along a centreline. One ribbon function and a table of
// centrelines gives the whole family, so adding a mouth shape is adding
// a curve, not a polygon.

function ribbon(pts, tube) {
  const n = pts.length, nor = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    nor.push([-dy / l, dx / l]);
  }
  const s = new THREE.Shape();
  s.moveTo(pts[0][0] + nor[0][0] * tube, pts[0][1] + nor[0][1] * tube);
  for (let i = 1; i < n; i++) s.lineTo(pts[i][0] + nor[i][0] * tube, pts[i][1] + nor[i][1] * tube);
  for (let i = n - 1; i >= 0; i--) s.lineTo(pts[i][0] - nor[i][0] * tube, pts[i][1] - nor[i][1] * tube);
  s.closePath();
  return s;
}

const STEPS = 16;
const span = f => Array.from({ length: STEPS }, (_, i) => f(-1 + 2 * i / (STEPS - 1)));

// `sag > 0` curves the middle DOWN — which is a smile, because the
// ends are what lift. Negate it and the same curve is a frown.
const CURVE = {
  line: (w, sag) => [[-w, 0], [w, 0]],
  arc:  (w, sag) => span(t => [t * w, sag * (t * t - 1)]),
  // ω — two dips meeting at a peak in the middle. The cat mouth.
  wave: (w, sag) => span(t => [t * w, sag * (Math.cos(t * Math.PI * 2) * .5 - .5)]),
  zig:  (w, sag) => Array.from({ length: 7 }, (_, i) =>
          [-w + 2 * w * i / 6, (i % 2 ? -sag : sag) * .6]),
  // dizzy. A spiral is not a shape to be cut, it is a STROKE — so it
  // costs one centreline here rather than a new outline.
  spiral: w => Array.from({ length: 40 }, (_, i) => {
    const t = i / 39, a = t * Math.PI * 4.3, r = w * (1 - t * .84);
    return [Math.cos(a) * r, Math.sin(a) * r];
  }),
};

// ---- the dispatch -----------------------------------------------------
// A part names one of these and passes numbers. Nothing else.

const OUTLINE = {
  ellipse: s => ellipse(s.w, s.h),
  ring:    s => ring(s.w, s.h, s.thick ?? .36),
  rring:   s => rectRing(s.w, s.h, s.r ?? s.h * .4, s.thick ?? .3),
  rect:    s => roundedRect(s.w, s.h, s.r ?? s.h * .92),
  sparkle: s => sparkle(s.w, s.h, s.pinch ?? .22),
  star:    s => star5(s.w, s.h),
  heart:   s => heart(s.w, s.h),
  cross:   s => cross(Math.max(s.w, s.h), Math.min(s.w, s.h) * .38),
  tri:     s => triangle(s.w, s.h, s.flip),
  flower:  s => flower(s.w, s.h, s.petals ?? 5, s.amp ?? .3),
  wobble:  s => wobble(s.w, s.h),
  crescent: s => crescent(s.w, s.h, s.bite ?? .55),
  band:    s => ribbon(CURVE[s.curve ?? 'arc'](s.w, s.sag ?? 0), s.tube ?? s.h),
};

export const OUTLINES = Object.keys(OUTLINE);

/**
 * plate spec → BufferGeometry, front crest at z = 0, body running
 * backward, centred in u/v.
 *   { outline, w, h, d, bevel?, + whatever that outline reads }
 */
export function plateGeometry(spec) {
  const shape = OUTLINE[spec.outline](spec);
  const depth = Math.max(spec.d, 1e-4);
  // the bevel cannot exceed what the thinnest part of the outline has
  // to give up, or ExtrudeGeometry folds the shape inside out
  const bevel = Math.max(1e-5, Math.min(spec.bevel ?? depth * .55, depth * .9));

  const g = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: SEG,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6,
  });
  g.translate(0, 0, -(depth + bevel));            // front crest to z = 0
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, 0);
  g.computeVertexNormals();
  return g;
}

// ---- THE SURFACE, shared with the layout ------------------------------
// A superellipsoid: |x/rx|ⁿ + |y/ry|ⁿ + |z/rz|ⁿ = 1.
//
// These two functions ARE the surface: `solidGeometry` builds with
// them and `L.at` places with them, imported from here, so the two can
// never disagree about where the skin is — which used to be guaranteed
// by careful duplication and is now guaranteed by there being one copy.
//
// A chin-tuck knob lived here for a day, trying to bend this formula
// into a chibi skull, and it could not: one implicit surface cannot
// say "cheeks full HERE, chin THIS wide, face flat in front". The
// humanoid's head is MODELED instead — a control cage + subdivision,
// in gskull.js — and this family stays what it is: a ball with a
// squareness knob.

// Two shapes the exponent cannot reach — a rock that sits FLAT and a
// slime that comes to a POINT — are not here at all. They were tried
// twice in this file, first as a radial displacement on the ball and
// then as a surface of revolution over a silhouette, and both are gone:
// see `gform.js`, which models them from a control cage. A radial
// scale moves a ball's surface but keeps its topology of extents, so
// nothing can sit flat; a profile is only an outline, and everything a
// shape does that is not its outline then has to be smuggled in on
// top. A shape you can name the parts of wants a cage.

/** how far along direction (dx,dy,dz) the surface sits. */
export function surfT(dx, dy, dz, rx, ry, rz, n) {
  return 1 / Math.pow(Math.pow(Math.abs(dx / rx), n)
                    + Math.pow(Math.abs(dy / ry), n)
                    + Math.pow(Math.abs(dz / rz), n), 1 / n);
}

/** the outward normal at a surface point — the GRADIENT, never the
 *  direction from the centre. */
export function surfN(x, y, z, rx, ry, rz, n) {
  const gx = Math.pow(Math.abs(x / rx), n - 1) * Math.sign(x) / rx;
  const gy = Math.pow(Math.abs(y / ry), n - 1) * Math.sign(y) / ry;
  const gz = Math.pow(Math.abs(z / rz), n - 1) * Math.sign(z) / rz;
  const l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}

/**
 * The body, and any other solid lump (a button nose).
 *
 * A SUPERELLIPSOID: `|x/rx|ⁿ + |y/ry|ⁿ + |z/rz|ⁿ = 1`. One number is
 * the whole shape family — n=2 is a ball, n≈4 a rounded cube, n=8 a
 * box with the corners knocked off — which is the same lever the voxel
 * hand uses for its discs and the same reason: a form should be a knob
 * you can scrub, not a second primitive to maintain.
 *
 * It is built by pushing a sphere's vertices out to the surface, so the
 * topology (and therefore the UV-free smooth shading) is unchanged. The
 * normals are ANALYTIC — the gradient of the implicit surface, not
 * averaged from triangles — because a rounded cube's flat faces meet
 * its corners at exactly the place where averaged normals go lumpy, and
 * a lumpy highlight on a clearcoat is the first thing you notice.
 *
 * `dome` cuts the solid short: a fraction of π swept down from the top
 * pole, so `.5` is a hemisphere. It exists for exactly one thing — the
 * ball eye's lid, a cap that sits OVER another solid — which is why the
 * open rim is fine: whatever a dome caps is filling it from inside.
 */
export function solidGeometry(rx, ry, rz, n = 2, dome = 0, domeFrom = 0) {
  const g = dome
    ? new THREE.SphereGeometry(1, 72, 40, 0, Math.PI * 2,
                               Math.PI * domeFrom, Math.PI * (dome - domeFrom))
    : new THREE.SphereGeometry(1, 72, 54);
  const pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    // a sphere vertex is already a unit direction
    const dx = pos.getX(i), dy = pos.getY(i), dz = pos.getZ(i);
    const t = surfT(dx, dy, dz, rx, ry, rz, n);
    const x = dx * t, y = dy * t, z = dz * t;
    pos.setXYZ(i, x, y, z);
    const nn = surfN(x, y, z, rx, ry, rz, n);
    nor.setXYZ(i, nn[0], nn[1], nn[2]);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}

/**
 * A modeled mesh (`gform.js`, `ghair.js`) → BufferGeometry. The arrays arrive
 * ALREADY BUILT from the layout's surface — the same vertices the
 * features were placed against — so this is packing, not modeling.
 * All vertices are shared, so computeVertexNormals is seam-free.
 */
export function skullGeometry({ verts, faces }) {
  const position = new Float32Array(verts.length * 3);
  for (let i = 0; i < verts.length; i++) {
    position[i * 3] = verts[i][0];
    position[i * 3 + 1] = verts[i][1];
    position[i * 3 + 2] = verts[i][2];
  }
  const indices = [];
  for (const f of faces)
    for (let i = 2; i < f.length; i++) indices.push(f[0], f[i - 1], f[i]);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * surface point + normal → plate transform. v is held to world-up so a
 * feature never rolls with the surface's whim, and `proud` lifts it out
 * along the normal. `roll` tilts it in its own plane — which is all a
 * slanted eyebrow is.
 */
export function basisAt(p, n, proud = 0, roll = 0) {
  const N = new THREE.Vector3(n[0], n[1], n[2]).normalize();
  const T = new THREE.Vector3(0, 1, 0).cross(N);
  if (T.lengthSq() < 1e-6) T.set(1, 0, 0); else T.normalize();
  const B = new THREE.Vector3().crossVectors(N, T);
  const q = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(T, B, N));
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  return {
    position: new THREE.Vector3(p[0], p[1], p[2]).addScaledVector(N, proud),
    quaternion: q,
  };
}

// Animating the face is NOT here — `gface.js` owns every write to a
// feature mesh, so blink, gaze and expression can never fight each
// other over the same transform.
