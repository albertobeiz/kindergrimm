/**
 * Catmull-Clark subdivision for closed quad/n-gon meshes.
 *
 * three.js used to ship SubdivisionModifier but it was removed, and the
 * community replacement (three-subdivide) is Loop subdivision on triangles,
 * which does not give the same surface. Catmull-Clark on quads is what C4D and
 * Blender do, and it is about 60 lines, so we just do it.
 *
 * Mesh format is plain arrays:
 *   verts: [[x, y, z], ...]
 *   faces: [[i, j, k, l], ...]   (any arity, wound consistently)
 */

function addTo(out, v) {
  out[0] += v[0];
  out[1] += v[1];
  out[2] += v[2];
}

function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function subdivide({ verts, faces }) {
  const nv = verts.length;

  // 1. face points: the centroid of each face
  const facePoints = faces.map((f) => {
    const c = [0, 0, 0];
    for (const vi of f) addTo(c, verts[vi]);
    return scale(c, 1 / f.length);
  });

  // 2. edges. Every edge in a closed mesh is shared by exactly two faces.
  const edges = new Map(); // "a_b" (a<b) -> { a, b, faces: [] }
  const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  faces.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const key = edgeKey(a, b);
      let e = edges.get(key);
      if (!e) edges.set(key, (e = { a: Math.min(a, b), b: Math.max(a, b), faces: [] }));
      e.faces.push(fi);
    }
  });

  // 3. edge points: average of the two endpoints and the two face points.
  //    A border edge (one face) falls back to the midpoint.
  const edgePointIndex = new Map();
  const edgePoints = [];
  for (const [key, e] of edges) {
    const p = [0, 0, 0];
    addTo(p, verts[e.a]);
    addTo(p, verts[e.b]);
    if (e.faces.length === 2) {
      addTo(p, facePoints[e.faces[0]]);
      addTo(p, facePoints[e.faces[1]]);
      edgePointIndex.set(key, nv + faces.length + edgePoints.length);
      edgePoints.push(scale(p, 0.25));
    } else {
      edgePointIndex.set(key, nv + faces.length + edgePoints.length);
      edgePoints.push(scale(p, 0.5));
    }
  }

  // 4. move the original vertices: (F + 2R + (n-3)P) / n
  const F = Array.from({ length: nv }, () => [0, 0, 0]);
  const R = Array.from({ length: nv }, () => [0, 0, 0]);
  const faceValence = new Array(nv).fill(0);
  const edgeValence = new Array(nv).fill(0);

  faces.forEach((f, fi) => {
    for (const vi of f) {
      addTo(F[vi], facePoints[fi]);
      faceValence[vi]++;
    }
  });
  for (const e of edges.values()) {
    const mid = scale([
      verts[e.a][0] + verts[e.b][0],
      verts[e.a][1] + verts[e.b][1],
      verts[e.a][2] + verts[e.b][2],
    ], 0.5);
    addTo(R[e.a], mid);
    edgeValence[e.a]++;
    addTo(R[e.b], mid);
    edgeValence[e.b]++;
  }

  const newVerts = new Array(nv);
  for (let i = 0; i < nv; i++) {
    const n = faceValence[i];
    const f = scale(F[i], 1 / n);
    const r = scale(R[i], 1 / edgeValence[i]);
    const p = verts[i];
    newVerts[i] = [
      (f[0] + 2 * r[0] + (n - 3) * p[0]) / n,
      (f[1] + 2 * r[1] + (n - 3) * p[1]) / n,
      (f[2] + 2 * r[2] + (n - 3) * p[2]) / n,
    ];
  }

  // 5. each n-gon becomes n quads
  const outVerts = newVerts.concat(facePoints, edgePoints);
  const outFaces = [];
  faces.forEach((f, fi) => {
    const fp = nv + fi;
    for (let i = 0; i < f.length; i++) {
      const prev = f[(i - 1 + f.length) % f.length];
      const cur = f[i];
      const next = f[(i + 1) % f.length];
      outFaces.push([
        cur,
        edgePointIndex.get(edgeKey(cur, next)),
        fp,
        edgePointIndex.get(edgeKey(prev, cur)),
      ]);
    }
  });

  return { verts: outVerts, faces: outFaces };
}

export function subdivideN(mesh, times) {
  let m = mesh;
  for (let i = 0; i < times; i++) m = subdivide(m);
  return m;
}
