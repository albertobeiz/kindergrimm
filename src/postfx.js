// ---------------------------------------------------------------
// THE LENS — everything that happens to the page AFTER it is drawn.
//
// Ported from the draw-test prototype, because this pass is most of
// why that thing looks like a photographed diorama and not like a
// flat canvas:
//
//   tilt-shift  a horizontal band stays sharp, everything above and
//               below blurs. Your eye reads that as "very small
//               things, photographed close" — it is the whole
//               miniature illusion, and it costs two blur pairs.
//   pop         a little saturation and contrast, so graphite on
//               cream doesn't go muddy once the blur has averaged it
//   night       the moonlit tint: the frame slides toward a cold,
//               dark copy of itself. Nothing in the world changes
//               colour — the LENS changes, which is why a single
//               float can turn the whole school to night.
//   vignette    the corners fall off, so the eye goes to the middle
// ---------------------------------------------------------------
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

export function createPostFX(renderer) {
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(1, 1) } },
    vertexShader: VERT,
    fragmentShader: `
      varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 dir; uniform vec2 res;
      void main(){
        vec2 px = dir / res;
        vec4 c = texture2D(tDiffuse, vUv) * .227;
        c += (texture2D(tDiffuse, vUv + px * 1.384) + texture2D(tDiffuse, vUv - px * 1.384)) * .316;
        c += (texture2D(tDiffuse, vUv + px * 3.230) + texture2D(tDiffuse, vUv - px * 3.230)) * .070;
        gl_FragColor = c;
      }`,
  });

  const compMat = new THREE.ShaderMaterial({
    uniforms: {
      tSharp: { value: null }, tBlur: { value: null },
      focusY: { value: .42 }, band: { value: .17 }, soft: { value: .34 },
      night: { value: 0 }, flash: { value: 0 }, gloom: { value: 0 }, vig: { value: .5 },
    },
    vertexShader: VERT,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tSharp; uniform sampler2D tBlur;
      uniform float focusY, band, soft, night, flash, gloom, vig;
      void main(){
        vec3 s = texture2D(tSharp, vUv).rgb;
        vec3 b = texture2D(tBlur, vUv).rgb;
        float m = smoothstep(band, band + soft, abs(vUv.y - focusY));
        vec3 c = mix(s, b, m);
        float g = dot(c, vec3(.299, .587, .114));
        c = mix(vec3(g), c, 1.18);            // saturation pop
        c = (c - .5) * 1.06 + .5;             // a little contrast
        c = mix(c, c * vec3(.46, .51, .70), night * .62);   // moonlit ink
        // the school flinches when something is being broken
        c = mix(c, vec3(.86, .40, .34), flash * .30);
        // …and the shadows rush in when a light dies: the same beat as
        // damage, but cold and dark instead of red
        c = mix(c, c * vec3(.16, .19, .34), gloom * .88);
        // vignette: the page darkens into its corners
        vec2 d = vUv - vec2(.5, .46);
        float r = length(vec2(d.x * 1.05, d.y));
        c *= 1. - vig * smoothstep(.34, .95, r);
        gl_FragColor = vec4(c, 1.);
      }`,
  });

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blurScene = new THREE.Scene();
  blurScene.add(new THREE.Mesh(quadGeo, blurMat));
  const compScene = new THREE.Scene();
  compScene.add(new THREE.Mesh(quadGeo, compMat));

  let rtScene = null, rtA = null, rtB = null;

  function resize(w, h) {
    rtScene?.dispose(); rtA?.dispose(); rtB?.dispose();
    rtScene = new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h));
    rtA = new THREE.WebGLRenderTarget(Math.max(1, w >> 1), Math.max(1, h >> 1));
    rtB = new THREE.WebGLRenderTarget(Math.max(1, w >> 1), Math.max(1, h >> 1));
  }

  function blurPass(from, to, dx, dy) {
    blurMat.uniforms.tDiffuse.value = from.texture;
    blurMat.uniforms.dir.value.set(dx, dy);
    blurMat.uniforms.res.value.set(to.width, to.height);
    renderer.setRenderTarget(to);
    renderer.render(blurScene, quadCam);
  }

  function render(scene, camera) {
    if (!rtScene) return renderer.render(scene, camera);
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);
    // three ping-pong pairs: cheap, and wide enough that the blur
    // reads as "out of focus" rather than "slightly smudged"
    blurPass(rtScene, rtA, 1, 0); blurPass(rtA, rtB, 0, 1);
    blurPass(rtB, rtA, 1, 0); blurPass(rtA, rtB, 0, 1);
    blurPass(rtB, rtA, 1, 0); blurPass(rtA, rtB, 0, 1);
    compMat.uniforms.tSharp.value = rtScene.texture;
    compMat.uniforms.tBlur.value = rtB.texture;
    renderer.setRenderTarget(null);
    renderer.render(compScene, quadCam);
  }

  return {
    resize, render,
    setNight: f => { compMat.uniforms.night.value = f; },
    setFlash: f => { compMat.uniforms.flash.value = f; },
    setGloom: f => { compMat.uniforms.gloom.value = f; },
  };
}
