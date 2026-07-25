/**
 * warpGL — the WebGL "fast-forward through the timeline" transition between two
 * era backgrounds. One fullscreen shader quad (orthographic, no scene graph)
 * that crossfades texA→texB under a DIRECTIONAL horizontal motion blur: each
 * pixel is a weighted trail sampled to the left, so the frame reads as racing
 * left→right through time — plus a horizontal chromatic split that grows with
 * speed. Unlike a CSS scaleX/Gaussian blur (symmetric, centre-origin) this is a
 * true velocity smear (user 2026-07-25).
 *
 * Loaded via dynamic import ONLY (perf guard: three.js stays lazy in its own
 * chunk — same rule as Chakra3D / rewindGL). One-shot ~0.65s pass, ~48 texture
 * taps at 1080p — far lighter than the rewind film it borrows its machinery
 * from, and the context is released on dispose().
 */
import * as THREE from 'three'

export interface WarpGL {
  /** progress 0..1 = texA→texB crossfade; speed 0..1 = smear/chroma intensity;
   * flash 0..1 = warm exposure bloom at the cut; time = seconds (grain). */
  render(progress: number, speed: number, flash: number, time: number): void
  dispose(): void
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D texA;
uniform sampler2D texB;
uniform float uProgress;
uniform float uSpeed;
uniform float uFlash;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Directional HORIZONTAL motion blur — an 11-tap trailing smear (samples to the
// LEFT) so the frame reads as being dragged left→right, i.e. fast-forwarding.
// Length kept moderate so the scene stays perceptible through the whoosh
// (cinematic, not abstract).
vec3 hstreak(sampler2D t, vec2 uv, float speed) {
  vec3 acc = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 11; i++) {
    float fi = float(i) / 10.0;                // 0..1 along the trail
    float w = 1.0 - fi * 0.8;                   // fade toward the tail
    vec2 off = vec2(-fi * 0.12 * speed, 0.0);   // trail LEFT → motion feels rightward
    acc += texture2D(t, uv + off).rgb * w;
    total += w;
  }
  return acc / total;
}

vec3 frame(vec2 uv, float speed) {
  vec3 a = hstreak(texA, uv, speed);
  vec3 b = hstreak(texB, uv, speed);
  return mix(a, b, smoothstep(0.0, 1.0, uProgress));
}

void main() {
  vec2 uv = vUv;
  float speed = uSpeed;

  // Horizontal chromatic split, grows with speed.
  vec2 ab = vec2(0.009 * speed, 0.0);
  vec3 col = vec3(
    frame(uv + ab, speed).r,
    frame(uv, speed).g,
    frame(uv - ab, speed).b
  );

  // Warm exposure bloom at the cut (the projector "blink"), like the intro.
  col *= 1.0 + uFlash * 0.22;
  col += vec3(1.0, 0.82, 0.55) * uFlash * 0.12;

  // Film grain, a touch heavier at speed.
  float g = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 57.3);
  col += (g - 0.5) * (0.028 + 0.055 * speed);

  // Gentle vignette so it sits like a film frame.
  float d = length(vUv - 0.5);
  col *= 1.0 - smoothstep(0.52, 0.96, d) * 0.32;

  gl_FragColor = vec4(col, 1.0);
}
`

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

/**
 * Build the fast-forward surface between two era backgrounds. Rejects if WebGL
 * or either texture fails — the caller then just cuts to the new bg (the kiosk
 * must never dead-end on a transition).
 */
export async function createWarpGL(
  canvas: HTMLCanvasElement,
  fromUrl: string,
  toUrl: string,
): Promise<WarpGL> {
  const [texA, texB] = await Promise.all([loadTexture(fromUrl), loadTexture(toUrl)])

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  })
  // Render the warp at 2/3 resolution: it's a ~1s motion-blurred whoosh (66
  // texture taps/pixel) on a bandwidth-bound Arc iGPU, and the directional
  // smear + chroma + grain fully hide the softness — plus the pass is dropped
  // on landing to reveal the crisp DOM background, so the final frame is sharp
  // anyway. Backing store 1280x720, CSS still stretches it to 1920x1080. This
  // roughly halves the fragment work and keeps the frame budget under 16ms
  // (user 2026-07-25: warp was jerky). updateStyle=false → leave the CSS size.
  renderer.setSize(1280, 720, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      texA: { value: texA },
      texB: { value: texB },
      uProgress: { value: 0 },
      uSpeed: { value: 0 },
      uFlash: { value: 0 },
      uTime: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  scene.add(quad)

  // Pre-warm: compile the shader program AND draw one static frame (uSpeed 0)
  // so the GLSL compile + both texture uploads happen NOW, before the timed
  // rAF loop — otherwise the very first animated frame stalls a few hundred ms
  // (compile + upload) and the timeline visibly jumps past it (user 2026-07-25:
  // warp jerk). This lone frame is the "from" era at rest, matching the start.
  renderer.compile(scene, camera)
  renderer.render(scene, camera)

  return {
    render(progress: number, speed: number, flash: number, time: number) {
      material.uniforms.uProgress!.value = progress
      material.uniforms.uSpeed!.value = speed
      material.uniforms.uFlash!.value = flash
      material.uniforms.uTime!.value = time
      renderer.render(scene, camera)
    },
    dispose() {
      texA.dispose()
      texB.dispose()
      quad.geometry.dispose()
      material.dispose()
      // Free the GL context deterministically (see rewindGL note) — each jump
      // makes a fresh one and Chromium caps live contexts.
      renderer.forceContextLoss()
      renderer.dispose()
    },
  }
}
