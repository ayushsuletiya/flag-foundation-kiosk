/**
 * rewindGL — the WebGL "film rewind" surface behind the History intro.
 *
 * One fullscreen shader quad (orthographic camera, no scene graph) that
 * crossfades between the per-year background textures while layering the
 * artifacts that sell a rewind: vertical motion streaks, chromatic
 * aberration, film-gate weave, exposure flashes at each cut, grain,
 * scratches and a vignette. All intensity is driven by two uniforms
 * (uSpeed, uBlur) so the JS timeline can speed-ramp and brake.
 *
 * Loaded via dynamic import ONLY (perf guard: three.js stays lazy in its
 * own chunk — same rule as Chakra3D). Cost: ~30 mip-biased texture taps at
 * 1080p for a one-shot ~5s intro — far lighter than the chakra god-rays
 * the Arc iGPU already runs continuously.
 */
import * as THREE from 'three'

export interface RewindState {
  /** Index of the outgoing year texture. */
  from: number
  /** Index of the incoming year texture. */
  to: number
  /** Crossfade within the current cut, 0..1. */
  progress: number
  /** Rewind intensity 0..1 — drives streaks, aberration, weave, zoom. */
  speed: number
  /** Soft-focus amount (mip bias); intro starts blurred, landing sharpens. */
  blur: number
  /** Exposure flash 0..1, spiked at each cut and decayed by the timeline. */
  flash: number
  /** Seconds since the intro started. */
  time: number
}

export interface RewindGL {
  setState(state: RewindState): void
  render(): void
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
uniform float uBlur;
uniform float uFlash;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 5-tap vertical streak — motion blur along the "time axis" of the rewind.
vec3 streak(sampler2D t, vec2 uv, float speed, float bias) {
  vec3 acc = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i) / 4.0;
    float w = 1.0 - fi * 0.55;
    vec2 offset = vec2(0.0, (fi - 0.5) * 0.085 * speed);
    acc += texture2D(t, uv + offset, bias).rgb * w;
    total += w;
  }
  return acc / total;
}

void main() {
  vec2 uv = vUv;

  // Film-gate weave: the frame never sits perfectly still while rewinding.
  uv.x += sin(uTime * 43.0 + uv.y * 8.0) * 0.0016 * uSpeed;
  uv.y += sin(uTime * 29.0) * 0.0022 * uSpeed;

  // Slight zoom pulse toward the center at speed.
  float zoom = 1.0 + 0.05 * uSpeed;
  uv = (uv - 0.5) / zoom + 0.5;

  float bias = uBlur * 4.0 + uSpeed * 1.4;

  // Chromatic aberration grows with speed, radial from center.
  vec2 dir = uv - 0.5;
  vec2 ab = dir * 0.007 * uSpeed;

  vec3 a = vec3(
    streak(texA, uv + ab, uSpeed, bias).r,
    streak(texA, uv, uSpeed, bias).g,
    streak(texA, uv - ab, uSpeed, bias).b
  );
  vec3 b = vec3(
    streak(texB, uv + ab, uSpeed, bias).r,
    streak(texB, uv, uSpeed, bias).g,
    streak(texB, uv - ab, uSpeed, bias).b
  );

  vec3 col = mix(a, b, smoothstep(0.0, 1.0, uProgress));

  // Exposure flash on each cut (the projector "blink") + a warm gold
  // light-leak rolling up from the bottom of the gate.
  col *= 1.0 + uFlash * 0.35;
  float leak = uFlash * (0.65 - 0.45 * uv.y);
  col += vec3(1.0, 0.72, 0.42) * leak * 0.6;

  // Film grain, heavier at speed.
  float grain = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 91.7);
  col += (grain - 0.5) * (0.045 + 0.09 * uSpeed);

  // Occasional vertical scratches while rewinding.
  float scratch = step(0.997, hash(vec2(floor(uv.x * 240.0), floor(uTime * 22.0))));
  col += scratch * 0.14 * uSpeed;

  // Vignette.
  float d = length(vUv - 0.5);
  col *= 1.0 - smoothstep(0.42, 0.86, d) * 0.5;

  gl_FragColor = vec4(col, 1.0);
}
`

/* ---- Golden dust particles ------------------------------------------ */
/* A THREE.Points cloud streaming with the rewind: gentle drifting motes
   while the frame is at rest, stretching into ember streaks at speed.
   Encoded per-point in `position`: x = clip-space X, y = phase seed,
   z = per-point random (size / rate / alpha). ~900 points — negligible. */

const PARTICLE_COUNT = 900

const P_VERT = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
varying float vAlpha;
void main() {
  float rate = 0.045 + uSpeed * (0.7 + position.z * 0.9);
  float y = fract(position.y + uTime * rate);
  gl_Position = vec4(position.x, y * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = (2.0 + position.z * 4.5) * (1.0 + uSpeed * 1.8);
  vAlpha = (0.16 + position.z * 0.38) * (0.35 + 0.65 * uSpeed);
}
`

const P_FRAG = /* glsl */ `
precision highp float;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.06, d) * vAlpha;
  gl_FragColor = vec4(vec3(1.0, 0.85, 0.56) * a, a);
}
`

function buildParticles(): {
  points: THREE.Points
  material: THREE.ShaderMaterial
} {
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = Math.random() * 2 - 1 // clip X
    positions[i * 3 + 1] = Math.random() // phase seed
    positions[i * 3 + 2] = Math.random() // size / rate / alpha random
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.ShaderMaterial({
    vertexShader: P_VERT,
    fragmentShader: P_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  return { points, material }
}

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearMipmapLinearFilter
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
 * Build the rewind surface. `urls` are the per-year backgrounds in rewind
 * order (1947 first, 1857 last). Rejects if WebGL or any texture fails —
 * the caller then skips the intro entirely (kiosk must never dead-end).
 */
export async function createRewindGL(
  canvas: HTMLCanvasElement,
  urls: string[],
): Promise<RewindGL> {
  const textures = await Promise.all(urls.map(loadTexture))

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  })
  renderer.setSize(1920, 1080, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      texA: { value: textures[0] },
      texB: { value: textures[0] },
      uProgress: { value: 0 },
      uSpeed: { value: 0 },
      uBlur: { value: 1.4 },
      uFlash: { value: 0 },
      uTime: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  scene.add(quad)

  const particles = buildParticles()
  particles.points.renderOrder = 1 // dust drifts OVER the film frame
  scene.add(particles.points)

  return {
    setState(state: RewindState) {
      const u = material.uniforms
      u.texA!.value = textures[Math.max(0, Math.min(textures.length - 1, state.from))]
      u.texB!.value = textures[Math.max(0, Math.min(textures.length - 1, state.to))]
      u.uProgress!.value = state.progress
      u.uSpeed!.value = state.speed
      u.uBlur!.value = state.blur
      u.uFlash!.value = state.flash
      u.uTime!.value = state.time
      const p = particles.material.uniforms
      p.uTime!.value = state.time
      p.uSpeed!.value = state.speed
    },
    render() {
      renderer.render(scene, camera)
    },
    dispose() {
      for (const tex of textures) tex.dispose()
      quad.geometry.dispose()
      material.dispose()
      particles.points.geometry.dispose()
      particles.material.dispose()
      renderer.dispose()
    },
  }
}
