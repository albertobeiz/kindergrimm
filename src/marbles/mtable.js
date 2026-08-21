// ---------------------------------------------------------------
// THE SHEET — the ice MARBLES is played on, and the camera that frames
// it. One file, so the game never touches three.js geometry directly:
// it asks for a floor point, a shake-free camera and a few handles.
//
// IT IS A CURLING SHEET, and the proportion is the whole read: long,
// narrow, and seen from behind one end so it converges to a point in
// the haze. Everything about the game comes out of that shape — the
// tide has a LONG walk, so hundreds of them are on the ice at once
// without anything ever spawning fast; a marble has room to actually
// HOOK; and the far end is somewhere you can barely see, which is
// where they come from.
//
// A nearly square table was built first and it was wrong for one
// reason worth writing down: with the far end ten units away, a
// thrown marble arrives before its curve has done anything, and the
// curve is the game.
//
// THE CAMERA FRAMES THE NEAR SECTION ONLY (`FIELD.view`). It cannot
// frame the whole sheet — thirty-four units of ice in a phone-shaped
// window puts the near end at the size of a coin. So the near section
// is fitted exactly, the rest runs away up the screen, and the fog
// takes the far end before the geometry runs out. Nothing has to be
// cropped and nothing has a visible edge.
// ---------------------------------------------------------------
import * as THREE from 'three';

export const FIELD = {
  halfW: 4.6,          // the sheet's half-width, inside the boards
  far: -30,            // where the tide walks on
  view: -14.5,         // …but only this much is FRAMED; the rest is haze
  line: 6,             // the line they must not cross
  // INSIDE THE NEAR RAIL FOR THE WIDEST MARBLE. At 6.9 a Boulder
  // (radius .7) started outside `bench − r` and was snapped back with a
  // phantom wall knock before it had touched anything — a power-
  // dependent penalty on the heaviest kind, which is exactly the kind
  // you throw softly.
  hand: 6.5,           // where your marbles wait and where a throw starts
  bench: 7.5,          // the near wall a marble bounces off
  back: 8.4,           // the back of the rink
};

const RAIL_H = .4;

// ---------------------------------------------------------------
// THE ICE. Painted, not simulated: a pale blue-white with the long
// sweep streaks that run down a sheet, a pebble speckle, the two
// hog lines and a house at the near end.
//
// IT IS NOT WHITE. Ice photographed on a rink is a pale grey-blue with
// a lot of tone in it, and a white floor would take the whole
// additive-effects budget with it — a bright explosion over white is
// a slightly brighter white. This one sits about two thirds up the
// range so there is somewhere for a highlight to go.
// ---------------------------------------------------------------
function iceTexture(w, d) {
  const px = 12;
  const c = document.createElement('canvas');
  c.width = Math.round(w * px); c.height = Math.round(d * px);
  const g = c.getContext('2d');
  const W = c.width, H = c.height;

  // IT IS NOT WHITE, AND THE FIRST PASS WAS. Ice photographed on a
  // rink is a pale grey-blue with a lot of tone in it; painted at the
  // value it "should" be, the whole sheet blew out under the key and
  // took the effects with it — an additive explosion over white is a
  // slightly brighter white. This sits about two thirds up the range,
  // which leaves somewhere for a highlight to go.
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#7e97ab');       // the far end, in its own shade
  base.addColorStop(.42, '#97afc0');
  base.addColorStop(.78, '#a7bfcd');
  base.addColorStop(1, '#9cb4c4');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // SWEEP STREAKS, down the sheet. They are the difference between
  // "a blue floor" and "ice somebody has been playing on": long, very
  // low contrast, and never straight — a swept line wanders.
  g.lineCap = 'round';
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * W;
    const len = H * (.1 + Math.random() * .5);
    const y0 = Math.random() * (H - len);
    g.strokeStyle = Math.random() < .5
      ? `rgba(255,255,255,${.05 + Math.random() * .1})`
      : `rgba(120,150,172,${.03 + Math.random() * .06})`;
    g.lineWidth = px * (.03 + Math.random() * .12);
    g.beginPath();
    g.moveTo(x, y0);
    for (let s = 1; s <= 4; s++)
      g.lineTo(x + (Math.random() - .5) * px * .8, y0 + len * s / 4);
    g.stroke();
  }

  // the pebble — the sprayed droplets a sheet is dressed with. At this
  // scale it is texture, not dots, so it is deliberately near-invisible
  // one grain at a time.
  for (let i = 0; i < W * H / 26; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const r = px * (.03 + Math.random() * .06);
    g.fillStyle = Math.random() < .55
      ? 'rgba(255,255,255,.16)' : 'rgba(140,166,186,.13)';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }

  // ---- the markings ----
  // world z → canvas y. The plane is rotated flat, so its local +y runs
  // UP the sheet and v = 1 lands at the FAR end — which puts canvas y=0
  // at `far`, not at `back`. Getting this backwards paints the whole
  // rink mirrored and nothing about the result says so.
  const zToY = z => (z - FIELD.far) * px;

  // the centre line, running the length of the sheet
  g.strokeStyle = 'rgba(90,120,142,.3)';
  g.lineWidth = px * .07;
  g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();

  // THE HOUSE, AT THE FAR END — which is where curling puts it, and
  // which turns out to be where this game wants it too. You throw from
  // your end toward it; the tide walks OUT of it. It gives the far end
  // of a very long sheet a thing to be instead of a vanishing point,
  // and it reads through the haze as the place they come from.
  const hx = W / 2, hy = zToY(-24);
  for (const [r, col, a] of [[3.4, '#5c86ad', .42], [2.3, '#dfe9ef', .5],
                             [1.3, '#b04a38', .42], [.5, '#eef3f6', .55]]) {
    g.globalAlpha = a;
    g.fillStyle = col;
    g.beginPath(); g.arc(hx, hy, r * px, 0, 7); g.fill();
  }
  g.globalAlpha = 1;

  // the hog lines — the near one is where a throw is committed, the far
  // one is where the tide walks on
  g.strokeStyle = 'rgba(92,134,173,.45)';
  g.lineWidth = px * .16;
  for (const z of [FIELD.line - 9, -19.5]) {
    g.beginPath(); g.moveTo(0, zToY(z)); g.lineTo(W, zToY(z)); g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

/** the pebble, as relief rather than paint — a tiny normal map tiled
 *  down the sheet. It is what makes the ice catch the key as a field
 *  of glints instead of one mirror smear, and it is the only reason a
 *  clearcoat on a flat plane reads as ice at all. */
function pebbleNormal() {
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#8080ff';
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * N, y = Math.random() * N;
    const r = 1.2 + Math.random() * 2.6;
    // a droplet is a little dome: light on one side, dark on the other
    const grad = g.createLinearGradient(x - r, y - r, x + r, y + r);
    grad.addColorStop(0, 'rgba(180,180,255,.9)');
    grad.addColorStop(.5, 'rgba(128,128,255,.2)');
    grad.addColorStop(1, 'rgba(70,70,255,.9)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 46);
  return tex;
}

/** the red line, painted rather than built. */
function lineTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0,    'rgba(214,64,40,0)');
  grad.addColorStop(.34,  'rgba(214,64,40,.5)');
  grad.addColorStop(.455, 'rgba(196,44,26,1)');
  grad.addColorStop(.545, 'rgba(196,44,26,1)');
  grad.addColorStop(.68,  'rgba(214,64,40,.42)');
  grad.addColorStop(1,    'rgba(214,64,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** the room the rink stands in. */
function backdrop() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#4a5666');
  grad.addColorStop(.40, '#6d7b8a');
  grad.addColorStop(.62, '#93a2ad');
  grad.addColorStop(1, '#7e8b96');
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

export function createTable(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .94;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = backdrop();
  const FOG = new THREE.Color('#8d9aa6');
  scene.fog = new THREE.Fog(FOG, 40, 90);

  const camera = new THREE.PerspectiveCamera(36, 1, .4, 120);

  // ---- light ----------------------------------------------------------
  // The key stands CAMERA-SIDE, the lesson `photo.js` records: hung
  // overhead it pools every shadow directly under the marbles, exactly
  // where this camera cannot see it.
  const key = new THREE.DirectionalLight('#fff4e4', 1.75);
  key.position.set(-7, 13, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  // The shadow frustum covers the NEAR SECTION, not the sheet. Stretched
  // over thirty-four units it was a metre of world per texel and every
  // marble stood in a grey smudge; up the ice nothing casts anything
  // worth seeing anyway, because it is thirty units away and in fog.
  const ex = 11;
  key.shadow.camera.left = -ex; key.shadow.camera.right = ex;
  key.shadow.camera.top = ex; key.shadow.camera.bottom = -ex;
  key.shadow.camera.near = 6; key.shadow.camera.far = 48;
  key.shadow.radius = 6; key.shadow.blurSamples = 16; key.shadow.bias = -.0004;
  key.target.position.set(0, 0, -1);
  scene.add(key);
  scene.add(key.target);
  scene.add(new THREE.HemisphereLight('#eaf4ff', '#5f6a74', .62));
  // a cold rim from up the sheet, so a marble's far edge separates from
  // ice that is nearly its own value
  const rim = new THREE.DirectionalLight('#bcd8ff', .7);
  rim.position.set(6, 5, -20);
  scene.add(rim);

  // ---- the rink -------------------------------------------------------
  const W = FIELD.halfW * 2, D = FIELD.back - FIELD.far;
  const midZ = (FIELD.back + FIELD.far) / 2;

  const iceMat = new THREE.MeshPhysicalMaterial({
    map: iceTexture(W, D),
    normalMap: pebbleNormal(),
    roughness: .30, metalness: 0,
    clearcoat: 1, clearcoatRoughness: .14,
    envMapIntensity: .9,
  });
  iceMat.normalScale.set(.32, .32);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), iceMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = midZ;
  floor.receiveShadow = true;
  scene.add(floor);

  // the rink floor outside the sheet — dark, so the ice reads as lit
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: '#4e5762', roughness: .95, metalness: 0 }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -.24;
  outside.receiveShadow = true;
  scene.add(outside);

  // THE BOARDS. A capsule on its side is a moulded bumper for free, and
  // the sheet needs one down each side for the whole length — a bank
  // shot off the boards is half the aiming vocabulary.
  const railMat = new THREE.MeshPhysicalMaterial({
    color: '#2E5F86', roughness: .32, metalness: 0,
    clearcoat: 1, clearcoatRoughness: .12,
  });
  const rails = new THREE.Group();
  const rail = (len, x, z, vertical) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(RAIL_H, len, 5, 12), railMat);
    m.rotation.z = Math.PI / 2;
    if (vertical) m.rotation.y = Math.PI / 2;
    m.position.set(x, RAIL_H * .5, z);
    m.castShadow = true; m.receiveShadow = true;
    rails.add(m);
  };
  rail(D, -FIELD.halfW - RAIL_H, midZ, true);
  rail(D,  FIELD.halfW + RAIL_H, midZ, true);
  rail(W + RAIL_H * 2, 0, FIELD.back + RAIL_H, false);
  scene.add(rails);

  // THE NEIGHBOURING SHEETS. A rink has four or five of them side by
  // side, and this is the honest answer to the one framing problem the
  // shape of this game cannot solve: a long strip seen raked is always
  // taller than it is wide on screen, so a wide window has margins
  // whatever the camera does. Fill them with the thing that would
  // actually be there. They are scenery — dimmer, no markings anybody
  // could mistake for the sheet in play, nothing standing on them —
  // and they cost two planes and four capsules.
  {
    // …and they have to be CLEARLY duller than the sheet in play. At
    // the same glaze they came out brighter than it — the eye went to
    // the empty ice either side of the game, which is the opposite of
    // what scenery is for.
    const dim = new THREE.MeshPhysicalMaterial({
      color: '#6f818e', roughness: .62, metalness: 0,
      clearcoat: .15, clearcoatRoughness: .45, envMapIntensity: .16,
    });
    const dimRail = new THREE.MeshPhysicalMaterial({
      color: '#20465f', roughness: .58, metalness: 0,
      clearcoat: .25, clearcoatRoughness: .4, envMapIntensity: .5,
    });
    const gap = W + RAIL_H * 4 + 1.1;
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(W, D), dim);
      p.rotation.x = -Math.PI / 2;
      p.position.set(side * gap, -.05, midZ);
      p.receiveShadow = true;
      scene.add(p);
      for (const edge of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(RAIL_H, D, 4, 8), dimRail);
        m.rotation.z = Math.PI / 2; m.rotation.y = Math.PI / 2;
        m.position.set(side * gap + edge * (FIELD.halfW + RAIL_H), RAIL_H * .5 - .05, midZ);
        scene.add(m);
      }
    }
  }

  const lineMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W, .95),
    new THREE.MeshBasicMaterial({
      map: lineTexture(), transparent: true, depthWrite: false, toneMapped: false,
    }));
  lineMesh.rotation.x = -Math.PI / 2;
  lineMesh.position.set(0, .006, FIELD.line);
  lineMesh.renderOrder = 1;
  scene.add(lineMesh);

  // ---- camera framing --------------------------------------------------
  const target = new THREE.Vector3(0, .3, -2.6);
  const corners = [];
  for (const x of [-FIELD.halfW - .35, FIELD.halfW + .35]) {
    for (const z of [FIELD.view, FIELD.bench])
      for (const y of [0, 1.1]) corners.push(new THREE.Vector3(x, y, z));
    // the hand's lane: the marbles you are choosing between are drawn
    // at UI size with their names pinned under them, so the frame has
    // to reserve a strip of ice behind the house with nothing on it
    corners.push(new THREE.Vector3(x, 0, FIELD.back + 1.4));
    corners.push(new THREE.Vector3(x * .6, 1.7, FIELD.hand));
  }

  // THE RAKE FOLLOWS THE ASPECT, and on a sheet this shape it has to.
  //
  // A long strip seen from a steep angle is always TALLER than it is
  // wide on screen, whatever the distance — so a fixed 40° rake framed
  // beautifully on a phone and left two thirds of a desktop window
  // empty grey either side of a narrow ribbon. Flattening the camera
  // compresses the sheet's length vertically without touching its
  // width, which is exactly the trade a wide window wants; it is also
  // how every broadcast frames a long field on a wide screen.
  //
  // The floor is 30°: below that the far half converges before it gets
  // anywhere you could aim into. The ceiling is 44°: above it you are
  // looking at the tops of their heads, and every marble here has a
  // FACE on its front, which is the whole cast.
  const dir = new THREE.Vector3(0, .69, .72).normalize();
  let dist = 22;

  function rakeFor(aspect) {
    const k = Math.max(0, Math.min(1, (aspect - .75) / (1.65 - .75)));
    // FLAT, and it went the wrong way once first: "tilt less" was read
    // as more top-down and the answer was the opposite — a lower, more
    // level view, the broadcast angle, faces toward the lens. What the
    // top-down move was actually solving (flat-on-ice UI collapsing
    // edge-on) is solved properly now by billboarding the time bars at
    // the camera instead of raking the whole world to face them.
    const deg = 38 - 11 * k;
    const r = deg * Math.PI / 180;
    dir.set(0, Math.sin(r), Math.cos(r));
  }
  const shakeFree = new THREE.Vector3();
  const probe = new THREE.Vector3();

  function fits(d) {
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    const inv = camera.matrixWorldInverse, proj = camera.projectionMatrix;
    for (const c of corners) {
      probe.copy(c).applyMatrix4(inv).applyMatrix4(proj);
      if (Math.abs(probe.x) > 1 || Math.abs(probe.y) > 1) return false;
    }
    return true;
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    rakeFor(camera.aspect);
    let lo = 6, hi = 120;
    for (let i = 0; i < 15; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid; else lo = mid;
    }
    dist = hi;
    place();
    // THE HAZE IS SET IN WORLD Z, NOT IN CAMERA UNITS. What has to be
    // true is that the far end of the sheet is gone and a marble
    // planted deep is still clearly there — so both ends are measured
    // as real distances to real points on the ice, and a phone that had
    // to stand further back gets the same picture rather than a grey one.
    scene.fog.near = camera.position.distanceTo(probe.set(0, 0, -3));
    scene.fog.far = camera.position.distanceTo(probe.set(0, 0, FIELD.far)) * 1.24;
  }

  /** put the camera where the game wants it, before any shake. */
  function place(lift = 0) {
    camera.position.copy(target).addScaledVector(dir, dist * (1 - lift * .05));
    camera.lookAt(target);
    shakeFree.copy(camera.position);
  }

  // ---- world → screen --------------------------------------------------
  // There is deliberately no screen → floor. There was, and the aim
  // used it; unprojecting the drag made the same gesture mean different
  // power depending on where on the sheet your finger happened to be,
  // because a pixel is worth more world units the further up the ice it
  // lands. The aim is measured on the screen now (see `updateAim`), and
  // the only thing left needing a projection is the DOM label pinned
  // under each marble in your hand.
  const proj = new THREE.Vector3();
  function screenAt(x, y, z) {
    const r = renderer.domElement.getBoundingClientRect();
    proj.set(x, y, z).project(camera);
    return { x: (proj.x * .5 + .5) * r.width, y: (-proj.y * .5 + .5) * r.height, depth: proj.z };
  }

  resize();
  addEventListener('resize', resize);

  return {
    renderer, scene, camera, key, floor, rails, lineMesh,
    place, resize, screenAt,
    /** the studio env the characters are lit by also lights the ice —
     *  a clearcoat with nothing to reflect is a matte plane. */
    setEnvironment(env) { scene.environment = env; },
    get shakeFree() { return shakeFree; },
    render() { renderer.render(scene, camera); },
  };
}
