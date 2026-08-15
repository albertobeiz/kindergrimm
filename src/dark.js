// ---------------------------------------------------------------
// THE DARK — global illumination, Don't-Starve style.
//
// The room is BLACK. Not tinted, not dimmed: black, everywhere the
// light does not reach. That single decision is what makes a lantern
// feel like a decision instead of a decoration.
//
// How: one big plane lying on the floor whose fragment shader knows
// where every light is, in WORLD space. Each pixel asks "how far am I
// from the nearest lamp" and paints itself black in proportion. It is
// a shadow mask painted onto the ground, so it costs one draw call
// and needs no render targets.
//
// The edge of a light pool wobbles on a slow clock, because a child
// drawing a circle of lamplight would never get it round, and a
// perfectly smooth radial gradient is the one thing here that would
// look like a computer did it.
//
// Billboards standing ON the floor are NOT darkened by this plane —
// they are drawn over it. The scene tints those on the CPU from the
// same lightAt(), so what you see and what the game thinks are lit
// can never disagree.
// ---------------------------------------------------------------
import * as THREE from 'three';

export const MAX_LIGHTS = 24;

// `size` must comfortably exceed the FLOOR, or at a wide zoom the
// floor's corners stick out past the dark as a bright frame.
export function createDarkness(scene, size = 400) {
  const uniforms = {
    lights: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, 0, 0)) },
    nLights: { value: 0 },
    ambient: { value: .015 },        // the shadows are BLACK. this is nearly nothing
    maxLit: { value: .96 },          // and the brightest spot is never fully lit
    time: { value: 0 },
    darkCol: { value: new THREE.Color('#07080c') },
    warmCol: { value: new THREE.Color('#2a1d0e') },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vXZ;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.);
        vXZ = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      #define MAXL ${MAX_LIGHTS}
      uniform vec3 lights[MAXL];      // x, z, radius
      uniform int nLights;
      uniform float ambient, maxLit, time;
      uniform vec3 darkCol, warmCol;
      varying vec2 vXZ;

      void main() {
        // Lights ACCUMULATE and fall off from the very centre. The old
        // version was max() of a smoothstep with a plateau, which is
        // why it read as a flat bright disc with a soft rim instead of
        // a lamp. A real pool of light has no plateau: it is brightest
        // under the lamp and gets dimmer the whole way out.
        float lit = 0.;
        for (int i = 0; i < MAXL; i++) {
          if (i >= nLights) break;
          vec3 L = lights[i];
          vec2 d = vXZ - L.xy;
          float r = length(d);
          float a = atan(d.y, d.x);
          // the pool breathes, and is never quite a circle
          float wob = 1. + .07 * sin(a * 5. + time * .55 + L.x)
                        + .04 * sin(a * 9. - time * .4 + L.y);
          // INVERSE-SQUARE, the way light actually behaves: bright and
          // generous through the middle, then a very long, very slow
          // slide into black that reaches roughly 2.3x the nominal
          // radius. The old x*x hit zero AT the radius, which is what
          // gave the pool a findable edge.
          float t = r / (L.z * wob);
          float f = 1. / (1. + 2.2 * t * t);
          lit += max(0., (f - .08) / .92);
        }
        lit = 1. - exp(-lit * 3.2);         // saturating, so lamps overlap kindly
        float v = clamp(max(lit, ambient), 0., 1.) * maxLit;

        // the dark is cold and the edge of a pool is warm, so the
        // falloff carries a little firelight instead of going grey
        vec3 col = mix(darkCol, warmCol, smoothstep(.05, .55, lit));
        gl_FragColor = vec4(col, 1. - v);
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = .04;
  mesh.renderOrder = -8500;         // over the floor, under the light pools
  scene.add(mesh);

  return {
    mesh,
    // `lights` = [{x, z, r}], already filtered to the live ones
    update(lights, t) {
      uniforms.time.value = t;
      const n = Math.min(MAX_LIGHTS, lights.length);
      for (let i = 0; i < n; i++) {
        const l = lights[i];
        uniforms.lights.value[i].set(l.x, l.z, l.r);
      }
      uniforms.nLights.value = n;
    },
    setAmbient: a => { uniforms.ambient.value = a; },
  };
}
