// ---------------------------------------------------------------
// THE STUDIO — one soft daylight rig and one material factory, the
// plants lab's own (the labs share nothing but `rng.js`).
//
// A plant's look is mostly whether it just came from the rain. So
// the finishes are leaf finishes: MATTE (a dry leaf), GLAZE (a wet
// one — the highlight is a tight coat), FUZZ (a soft grey felt,
// the inside of the leaf). Parts never build a material; the rig
// names a colour and a finish and this factory pours them. Same
// rule as `F.media.*` for the pencils.
// ---------------------------------------------------------------
import * as THREE from 'three';

/** a soft-top daylight rig → PMREM. One wide cool box overhead,
 *  a warm fill to the left, and a paper floor. No stanchions: the
 *  leaves are opaque plastic, not mirrors. */
export function plantStudio(renderer) {
  const room = new THREE.Scene();
  const box = (w, h, cr, cg, cb, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cr, cg, cb), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
    room.add(m);
  };
  room.add(new THREE.Mesh(
    new THREE.BoxGeometry(24, 24, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(.34, .35, .32), side: THREE.BackSide })));
  box(10, 6, 6.2, 6.3, 6.0, 0, 7.5, 1.5, 0, Math.PI / 2);   // the sun: overhead
  box(5, 7, 3.0, 2.8, 2.4, -7, 3, 3, Math.PI / 3);          // warm fill, left
  box(3.4, 6, 1.2, 1.3, 1.5, 7, 2, 3, -Math.PI / 3);        // cool bounce, right
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, .04).texture;
  pmrem.dispose();
  return env;
}

// LIFT: a colour code to a lighter shade — for the glaze's sheen
// tint, never for a shadow.
const lift = (c, k) => c.clone().lerp(new THREE.Color(1, 1, 1), k);

// THREE finishes. Matte carries the shelf; glaze is the rain; fuzz
// is the suede side of the leaf.
export const FINISHES = [
  { id: 'matte', label: 'matte',
    make: c => new THREE.MeshPhysicalMaterial({
      color: c, roughness: .72, metalness: 0,
      clearcoat: 0, sheen: 0, envMapIntensity: .65,
    }),
    weight: 55 },
  { id: 'glaze', label: 'glaze',
    make: c => new THREE.MeshPhysicalMaterial({
      color: c, roughness: .28, metalness: 0,
      clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.05,
    }),
    weight: 30 },
  { id: 'fuzz', label: 'fuzz',
    make: c => new THREE.MeshPhysicalMaterial({
      color: c, roughness: .95, metalness: 0,
      clearcoat: 0, sheen: .7, sheenRoughness: .55, sheenColor: lift(c, .25),
      envMapIntensity: .6,
    }),
    weight: 15 },
];

export const FINISH_WEIGHTS = FINISHES.map(f => [f.id, f.weight]);
export const FINISH_BY_ID = Object.fromEntries(FINISHES.map(f => [f.id, f]));

// the reachability check, like the gloss media's — a finish listed
// but not dealt is a silent bug
for (const f of FINISHES) {
  if (!FINISH_BY_ID[f.id]) throw new Error(`omedia: finish '${f.id}' has no recipe`);
  if (!FINISH_WEIGHTS.some(w => w[0] === f.id))
    throw new Error(`omedia: finish '${f.id}' is not dealt, so it can never reach a plant`);
}

/** (finish, colorHex) → material, cached per page. One material per
 *  finish×colour so a whole shelf of plants stays cheap. */
export function makeMaterialFactory(env) {
  const cache = new Map();
  return (finish, color) => {
    const id = finish ?? 'matte';
    const mat = FINISH_BY_ID[id] ?? FINISHES[0];
    const key = `${id}:${color}`;
    if (cache.has(key)) return cache.get(key);
    const m = mat.make(new THREE.Color(color));
    m.envMap = env;
    cache.set(key, m);
    return m;
  };
}

/** the seamless cyc — a warm cream sweep, same register as the rest
 *  of the project's paper. */
function cycTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0,   '#b7b0a4');
  grad.addColorStop(.42, '#cbc4b8');
  grad.addColorStop(.72, '#d9d2c6');
  grad.addColorStop(1,   '#d0c8ba');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** light the lab: async the cyc, one key with a soft shadow, fill. */
export function dressPlantScene(scene, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  scene.background = cycTexture();

  const key = new THREE.DirectionalLight('#fff6e8', 1.3);
  key.position.set(-1.2, 2, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const e = 3;
  key.shadow.camera.left = -e; key.shadow.camera.right = e;
  key.shadow.camera.top = e; key.shadow.camera.bottom = -e;
  key.shadow.camera.near = 1; key.shadow.camera.far = 12;
  key.shadow.radius = 12;
  scene.add(key);
  scene.add(new THREE.HemisphereLight('#fff6e8', '#cfc2aa', .85));

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    new THREE.MeshStandardMaterial({ color: '#d5cdc0', roughness: .95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);
  return { key, floor };
}