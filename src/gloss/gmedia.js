// ---------------------------------------------------------------
// THE STUDIO — one shared light rig and one material factory.
//
// Half of the designer-toy look is not in the geometry at all: it is
// a big soft studio reflected in a clearcoat. So the environment here
// is hand-built — three overbright softbox planes in a grey room,
// prefiltered once — and every material takes it. Parts and the rig
// never construct a material; they name a RANK and a colour and this
// factory pours it. Same rule as `F.media.*` for the pencil and
// `V.pal.*` for the cubes: one place owns the finish, so the whole
// shelf reads as one product line.
// ---------------------------------------------------------------
import * as THREE from 'three';
// for the reachability check at the bottom only — a species may NAME a
// material instead of it being dealt. `gspecies.js` imports nothing,
// so this cannot cycle.
import { GSPECIES } from './gspecies.js';
import { knitNormal, woodRough, woodNormal, layerNormal, crazeNormal,
         pearlThickness } from './gtexture.js';

/** three softboxes in a grey room → PMREM. The gloss lives here. */
export function studioEnv(renderer) {
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
    new THREE.MeshBasicMaterial({ color: new THREE.Color(.38, .36, .33), side: THREE.BackSide })));
  box(9, 5, 5.2, 5.1, 4.9,  0, 8.5, 2, 0, Math.PI / 2);   // key: big overhead softbox
  box(4, 7, 2.4, 2.3, 2.2, -8, 3, 4, Math.PI / 3);        // warm-ish fill, left
  box(3, 6, 1.4, 1.5, 1.7,  8, 2, 3, -Math.PI / 3);       // cool kicker, right

  // Structure for a MIRROR to find. A rough lobe averages the room and
  // sees a grey box; a polished one reflects it point for point, and a
  // grey box reflected point for point is still a grey box — chrome
  // with nothing to reflect reads as flat plastic. So: two dark
  // stanchions behind the camera and one bright strip beside it.
  //
  // They are deliberately NARROW. Each subtends about a fortieth of the
  // sphere, so the total irradiance moves by well under a percent and
  // the finishes that were already signed off do not shift — but a
  // mirror gets verticals to bend around, which is the whole read.
  box(1.2, 12, .05, .05, .06, -3.4, 2, 9);                // stanchion, left
  box(1.2, 12, .05, .05, .06,  3.4, 2, 9);                // stanchion, right
  box(.6, 10, 2.6, 2.55, 2.4, -6.5, 3, 5, Math.PI / 2.6); // a streak to travel
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, .04).texture;
  pmrem.dispose();
  return env;
}

// ELEVEN finishes, and the rule that decides whether one earns its
// place is the SHEET, not the turntable: a finish that only reads
// while a toy is spinning at 400px is a parameter, not a variety.
// Every one below changes something you can see in a 1/35th cell —
// the size of the highlight, whether there is one at all, or what the
// silhouette's edge does.
//
// FREQUENCY IS ART DIRECTION, the same as a style table in `eyes.js`.
// Glossy and rubber carry the shelf; a chrome turns up about
// once a sheet, which is what keeps it worth catching. Dealt with
// `wpick` in `grig.js`, never a uniform pick.
export const MATERIALS = [
  { id: 'glossy',  label: 'glossy' },
  { id: 'rubber',  label: 'rubber' },
  { id: 'ceramic', label: 'ceramic' },
  { id: 'pearl',   label: 'pearl' },
  { id: 'flocked', label: 'flocked' },
  { id: 'wood',    label: 'wood' },
  { id: 'wool',    label: 'wool' },
  { id: 'resin',   label: 'resin' },
  { id: 'chrome',  label: 'chrome' },
  { id: 'crazed',  label: 'crazed' },
  { id: 'skin',    label: 'skin' },
];
export const MATERIAL_IDS = MATERIALS.map(m => m.id);

/** how often each turns up. Sums to 100 so a weight reads as a percent
 *  of the shelf, which is the number you actually want when deciding
 *  whether something has become common enough to stop being a treat.
 *
 *  `skin` is NOT dealt: it is the humanoid's material, asked for by
 *  name, and a skin-finished bear is just a beige bear. It stays in
 *  `MATERIALS` so the filter bar and the editor can still pin it. */
export const MATERIAL_WEIGHTS = [
  ['glossy', 25], ['rubber', 19], ['pearl', 12], ['ceramic', 11], ['flocked', 8],
  ['wood', 7], ['wool', 6], ['resin', 5], ['chrome', 4], ['crazed', 3],
];

/** a lightened version of a colour — for a sheen tint only, never for a
 *  shadow. Flock and wool catch their own colour at the rim rather than
 *  a white one, which is the difference between fuzz and frost. */
const lift = (c, k) => c.clone().lerp(new THREE.Color(1, 1, 1), k);

const FINISH = {
  // a hard clearcoat over smooth plastic: one tight, travelling highlight
  glossy: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .26, metalness: 0,
    clearcoat: 1, clearcoatRoughness: .07, envMapIntensity: 1,
  }),

  // no coat at all and a broad rough lobe, so it takes the same studio
  // and returns a soft even glow with no hotspot — and it leans harder
  // on the environment, which is what keeps it from going dead flat
  rubber: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .82, metalness: 0,
    clearcoat: 0, sheen: .5, sheenRoughness: .8, sheenColor: new THREE.Color('#ffffff'),
    envMapIntensity: .7,
  }),

  // Glazed porcelain. It is the nearest neighbour glossy has, and it
  // stays legible next to it for one reason: the coat is four times
  // smoother, so the highlight is a hard small dot where glossy's is a
  // soft patch. Dull that coat and the two collapse into each other.
  ceramic: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .3, metalness: 0,
    clearcoat: 1, clearcoatRoughness: .015, envMapIntensity: 1.25,
  }),

  // Soft-vinyl pearl. The best value on the list: iridescence is a thin
  // film whose colour depends on the ANGLE, so the rim shifts green to
  // pink as the toy turns and the finish animates for free on a page
  // where nothing else moves but a face.
  //
  // THREE NUMBERS HERE ARE NOT FREE CHOICES.
  //
  // `clearcoat` is LOW because iridescence sits UNDER the coat: the coat
  // attenuates the tinted base by (1 - clearcoat·F) and stacks a plain
  // white highlight on top, so at clearcoat 1 the rainbow washes out to
  // exactly the glossy finish. This is the one place in the lab where a
  // hard coat is the wrong answer.
  //
  // `ior` is high because the film's strength is proportional to F0, and
  // a default dielectric's F0 is .04 — enough to be invisible. At 1.9 it
  // is about .1 and the colour actually arrives.
  //
  // And the thickness range only means anything because of the MAP: with
  // no map the shader takes the maximum and ignores the minimum, so the
  // toy would be one flat film. See `pearlThickness` in `gtexture.js`.
  pearl: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .3, metalness: 0, ior: 1.9,
    clearcoat: .35, clearcoatRoughness: .1, envMapIntensity: 1.05,
    iridescence: .85, iridescenceIOR: 1.5, iridescenceThicknessRange: [180, 520],
  }),

  // Flocked — the fuzz on a nodding-dog. Sheen is a retroreflective
  // lobe at grazing angles, so what it actually buys is a lit RIM on
  // the silhouette, which is the one thing that reads at sheet scale.
  // Tighter and stronger than rubber's, or the two would be one finish.
  flocked: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: 1, metalness: 0,
    clearcoat: 0, sheen: 1, sheenRoughness: .35, sheenColor: lift(c, .5),
    envMapIntensity: .55,
  }),

  // A turned toy. The COLOUR stays the palette's — a wood albedo would
  // quietly overrule `gpalette.js`, and painted beech is a real object
  // anyway. What says wood is the grain, and the grain arrives as
  // roughness and a whisper of relief, never as hue.
  //
  // `anisotropy` is the lathe. It smears the highlight PERPENDICULAR to
  // the tangent, and at rotation 0 the tangent is the UV's u — which on
  // this body runs around the equator, exactly where a tool leaves its
  // marks. So the streak comes out vertical, off a rotation of zero, for
  // free. It needs no tangent attribute: with none present three derives
  // the frame from the screen-space derivatives of the UVs, which is all
  // a sphere would have given it anyway.
  wood: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .62, metalness: 0,
    clearcoat: .35, clearcoatRoughness: .3, envMapIntensity: .85,
    anisotropy: .5, anisotropyRotation: 0,
  }),

  // Knitted, with the stitch in the normal map. Rough, unglazed, and
  // leaning on sheen for the fuzz — a jumper's read is its silhouette
  // catching light, not a highlight on its front.
  wool: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .95, metalness: 0,
    clearcoat: 0, sheen: 1, sheenRoughness: .6, sheenColor: lift(c, .35),
    envMapIntensity: .6,
  }),

  // The lab printing its own output: layer lines, a half-hearted coat,
  // the slightly chalky look of unpolished resin.
  resin: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .55, metalness: 0,
    clearcoat: .25, clearcoatRoughness: .4, envMapIntensity: .8,
  }),

  // Anodized metal. A metal has no diffuse term at all — everything you
  // see is the room, tinted by the colour — which is why `studioEnv`
  // grew two dark stanchions above. Without them this is grey plastic.
  chrome: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .16, metalness: 1,
    clearcoat: 0, envMapIntensity: 1.4,
  }),

  // Ceramic that has been around: the same glaze, a shade duller, with
  // the hairline map opened up across it.
  crazed: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .34, metalness: 0,
    clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.15,
  }),

  // SKIN — the humanoid's, ported from the chibi-skull study. Cheap
  // fake subsurface: a broad warm SHEEN does the rim glow light gets
  // when it passes through the shallow edge of a face, and a weak,
  // rough CLEARCOAT gives the soft vinyl-doll sheen without the tight
  // travelling hotspot that makes `glossy` read as plastic. The sheen
  // colour is a fixed warm pink on purpose — flesh scatters red
  // whatever shade the skin is — so it is NOT lifted from `c`.
  skin: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .62, metalness: 0,
    sheen: 1, sheenRoughness: .85, sheenColor: new THREE.Color('#ff9d8e'),
    clearcoat: .25, clearcoatRoughness: .5, envMapIntensity: .9,
  }),

  // HAIR, and it is dead-matte VINYL. Two failures are recorded in this
  // block. A hard clearcoat came first — one travelling hotspot on a
  // shape whose whole job is many soft clumps: a plastic wig. Then a
  // strong whitened sheen — and sheen is a rim lobe, so on a grooved
  // surface it lit every groove edge as a glassy STREAK, which read as
  // cellophane. The reference figures have neither: their hair is the
  // flattest thing on the toy, and the grooves read by OCCLUSION and
  // the soft studio gradient, not by any highlight. So: rough, no
  // coat, the faintest self-coloured sheen so the silhouette does not
  // go dead, and matte from ROUGHNESS — never from dimming the
  // environment, which just makes every colour darker than its swatch.
  hair: c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .97, metalness: 0,
    clearcoat: 0,
    sheen: .12, sheenRoughness: .8, sheenColor: lift(c, .12),
    envMapIntensity: .85,
  }),

};

/**
 * WHAT A FEATURE TAKES WHEN THE SHELL IS WEARING SOMETHING ELSE.
 *
 * A face feature is an `ExtrudeGeometry` plate, and its UVs are three's
 * world-space default — which is to say a texture laid on one is noise.
 * That is the mechanical reason a map is shell-only. The good reason is
 * that it is also how the real objects are built: a knitted toy has
 * PLASTIC safety eyes, a turned one has painted pupils. Nobody knits an
 * eye.
 *
 * Only the finishes whose PARAMETERS are wrong on a feature appear
 * here. `resin` and `crazed` are absent on purpose: their numbers are
 * fine at 3mm, it is only the tile that has nowhere to land, and the
 * factory drops that on its own.
 */
const FEATURE_OF = { wool: 'glossy', wood: 'glossy' };

/** the tile each finish lays on its shell, and how hard. Baked once,
 *  in `gtexture.js`, and shared by every toy on the page. */
const MAPS = {
  // the swirl in the film — see the note on `pearl` above for why this
  // is load-bearing rather than decoration
  pearl: m => { m.iridescenceThicknessMap = pearlThickness(); },
  wool: m => { m.normalMap = knitNormal(); m.normalScale.set(1, 1); },
  wood: m => {
    m.normalMap = woodNormal(); m.normalScale.set(.35, .35);
    // roughness MULTIPLIES the map, so the base is the ceiling
    m.roughnessMap = woodRough();
  },
  resin:  m => { m.normalMap = layerNormal(); m.normalScale.set(.7, .7); },
  crazed: m => { m.normalMap = crazeNormal(); m.normalScale.set(.45, .45); },
};

/**
 * `(finish, colour, shell) -> material`, cached for the whole page.
 *
 * `shell` is true for the toy's BODY and nothing else. Everything else
 * is a feature set into it, and takes `FEATURE_OF` if the shell is
 * wearing something a feature cannot wear, and never takes a tile.
 *
 * The cache key is the RESOLVED finish, not the requested one, so a
 * wool toy's glossy eyes share one material with a glossy toy's — 
 * thirty-five toys on the sheet still come out with a couple of dozen
 * materials between them.
 */
// THE CROSS-CHECK. `FINISH[id] || FINISH.glossy` fails SILENTLY: add a
// finish to `MATERIALS` and forget its recipe and you get a glossy toy
// with the right chip lit, the right filter pinned and the right id in
// the recipe. That is precisely the bug `CLAUDE.md` records against
// `eyes.js` — "a style in the table but not in the wpick list is
// unreachable and nothing will tell you; that has already happened
// once". Two parallel tables with no cross-check is the pattern, so
// here is the check, at module load, where it costs nothing.
// A material may reach a toy TWO ways now: dealt by weight, or asked
// for BY NAME by a species (`skin`). Both count as reachable; anything
// with neither is the silent bug this check exists for.
const NAMED_MATERIALS = new Set(
  Object.values(GSPECIES).map(s => s.material).filter(Boolean));

for (const id of MATERIAL_IDS) {
  if (!FINISH[id]) throw new Error(`gmedia: material '${id}' has no FINISH recipe`);
  if (!MATERIAL_WEIGHTS.some(w => w[0] === id) && !NAMED_MATERIALS.has(id))
    throw new Error(`gmedia: material '${id}' is neither dealt nor named by a species, `
                  + `so it can never reach a toy`);
}
for (const [id] of MATERIAL_WEIGHTS) {
  if (!MATERIAL_IDS.includes(id))
    throw new Error(`gmedia: weight for '${id}', which is not a material`);
}

export function makeMaterialFactory(env) {
  const cache = new Map();
  const materialFor = (finish, color, shell = false) => {
    const id = shell ? finish : (FEATURE_OF[finish] ?? finish);
    const tiled = shell && MAPS[id] ? 1 : 0;
    const key = `${id}:${tiled}:${color}`;
    if (cache.has(key)) return cache.get(key);
    const mat = (FINISH[id] || FINISH.glossy)(new THREE.Color(color));
    mat.envMap = env;
    if (tiled) MAPS[id](mat);
    cache.set(key, mat);
    return mat;
  };

  return materialFor;
}

/**
 * The seamless cyc: one warm taupe sweep, darker up in the corners and
 * lifting toward the floor line, painted into a texture rather than
 * built as geometry. A real curved wall would need lighting of its own
 * and would fight the studio env for the same job.
 */
function cycTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0,   '#b9b2a6');      // up in the roll
  grad.addColorStop(.42, '#cdc6ba');
  grad.addColorStop(.72, '#dcd5c9');      // where the wall meets the floor
  grad.addColorStop(1,   '#d3ccc0');      // floor coming toward camera
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * the cyc, one steep key with a genuinely blurred shadow, soft fill.
 *
 * `span` is how wide a piece of floor has to catch shadow: one toy on
 * the lab's turntable needs 6.4 units, a shelf of twenty needs the
 * whole grid. Everything else scales off it — the catcher, the key's
 * shadow frustum, and how far the key stands back — so a crowd gets
 * the same studio, only bigger. Returns the two handles a scene might
 * want to move (`key`, `floor`); the lab uses neither.
 */
export function dressScene(scene, renderer,
                           { span = 6.4, pool = .19, shadows = true, wallZ = 1.7 } = {}) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  // A page of toys hung on a grid has no ground to fall on — so it
  // gets a WALL instead, close behind, and the shadows land on that.
  // The key is nearly head-on and only a little up and to the left, so
  // each toy throws a short shadow down-right onto the wall just
  // behind it. Rake it any harder and every shadow lands on the
  // neighbour instead of reading as depth.
  if (shadows === 'wall') {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    scene.background = new THREE.Color('#d6cfc3');

    const key = new THREE.DirectionalLight('#fff6e8', 1.25);
    // nearly head-on: the further the wall goes back, the further a
    // raking light throws the shadow, and past about a third of a cell
    // it stops reading as depth and starts landing on the neighbour
    key.position.set(-1.1, 1.5, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const e = span * .62;
    key.shadow.camera.left = -e; key.shadow.camera.right = e;
    key.shadow.camera.top = e; key.shadow.camera.bottom = -e;
    key.shadow.camera.near = 1; key.shadow.camera.far = 30;
    // a wide blur, and it has to BE wide: VSM's radius is in shadow-map
    // texels, so over a frustum this size a single-digit radius is a
    // hard edge no matter how soft the number looks
    key.shadow.radius = 24; key.shadow.blurSamples = 26; key.shadow.bias = 0;
    scene.add(key);
    // and lift the ambient — a shadow reads soft when it is shallow as
    // well as blurred
    scene.add(new THREE.HemisphereLight('#fff4e0', '#c3b6a2', .78));

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(span * 3, span * 3),
      new THREE.MeshStandardMaterial({ color: '#d6cfc3', roughness: .96, metalness: 0 }));
    wall.position.z = -wallZ;
    wall.receiveShadow = true;
    scene.add(wall);
    return { key, wall, floor: null };
  }

  renderer.shadowMap.enabled = true;
  // VSM, not PCF: `radius` is a real blur here, and a molded toy wants
  // a shadow that reads as a pool rather than an outline
  renderer.shadowMap.type = THREE.VSMShadowMap;
  scene.background = cycTexture();

  // steep and slightly to the side, so the pool sits under the toy
  const k = span / 6.4;
  const key = new THREE.DirectionalLight('#fff6e8', 1.45);
  key.position.set(1.6 * k, 6 * k, 2.6 * k);
  key.castShadow = true;
  key.shadow.mapSize.set(span > 8 ? 2048 : 1024, span > 8 ? 2048 : 1024);
  key.shadow.camera.left = -3.6 * k; key.shadow.camera.right = 3.6 * k;
  key.shadow.camera.top = 3.6 * k; key.shadow.camera.bottom = -3.6 * k;
  key.shadow.camera.near = 1 * k; key.shadow.camera.far = 16 * k;
  key.shadow.radius = 14; key.shadow.blurSamples = 24; key.shadow.bias = 0;
  scene.add(key);
  scene.add(new THREE.HemisphereLight('#fff4e0', '#b8a890', .4));

  // The catcher has to disappear at its own edges. It must not reach
  // past the shadow camera (VSM bleeds outside the frustum, and that
  // bleed reads as a grey band ruled across the backdrop), but a plane
  // cut to fit then shows its own rim — so fade the shadow radially and
  // the pool just stops existing before the geometry does.
  const mat = new THREE.ShadowMaterial({ opacity: pool });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec2 vPool;\n' + sh.vertexShader
      .replace('void main() {', 'void main() {\n  vPool = uv;');
    sh.fragmentShader = 'varying vec2 vPool;\n' + sh.fragmentShader
      .replace('gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
               'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) * ' +
               '( 1.0 - smoothstep( 0.28, 0.48, length( vPool - 0.5 ) ) ) );');
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span, span), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return { key, floor };
}
