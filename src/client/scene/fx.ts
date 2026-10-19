import { Color, DataTexture, RedFormat, NearestFilter, ShaderMaterial, BackSide, MeshToonMaterial, AdditiveBlending, type Texture } from 'three';

// ---------- 补间 ----------
type Job = { t0: number; dur: number; fn: (k: number) => void; done: () => void };
const jobs: Job[] = [];
let now = 0;

export function tick(t: number) {
  now = t;
  for (let i = jobs.length - 1; i >= 0; i--) {
    const j = jobs[i];
    const k = j.dur <= 0 ? 1 : Math.min(1, (t - j.t0) / j.dur);
    j.fn(k);
    if (k >= 1) {
      jobs.splice(i, 1);
      j.done();
    }
  }
}
export function busyTweens() {
  return jobs.length > 0;
}
/** 在 dur 毫秒内以 k∈[0,1] 调用 fn */
export function anim(dur: number, fn: (k: number) => void): Promise<void> {
  return new Promise((done) => {
    fn(0);
    jobs.push({ t0: now || performance.now(), dur, fn, done });
  });
}
export const wait = (ms: number) => anim(ms, () => {});
/** 立即完成所有补间 */
export function flushTweens() {
  for (const j of jobs.splice(0)) {
    j.fn(1);
    j.done();
  }
}

export const ease = {
  linear: (k: number) => k,
  inCubic: (k: number) => k * k * k,
  outCubic: (k: number) => 1 - (1 - k) ** 3,
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  outBack: (k: number) => {
    const c = 1.9;
    return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
  },
  outElastic: (k: number) => (k === 0 || k === 1 ? k : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  inBack: (k: number) => 2.7 * k * k * k - 1.7 * k * k,
};
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// ---------- 材质 ----------
let gradient: Texture | null = null;
function toonGradient() {
  if (gradient) return gradient;
  const d = new Uint8Array([90, 170, 255]);
  const t = new DataTexture(d, 3, 1, RedFormat);
  t.minFilter = t.magFilter = NearestFilter;
  t.needsUpdate = true;
  gradient = t;
  return t;
}
const toonCache = new Map<string, MeshToonMaterial>();
export function toon(color: string | number, opts: { emissive?: string; flat?: boolean } = {}) {
  const key = `${color}|${opts.emissive ?? ''}|${opts.flat ? 1 : 0}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new MeshToonMaterial({ color: new Color(color), gradientMap: toonGradient() });
    if (opts.emissive) {
      m.emissive = new Color(opts.emissive);
      m.emissiveIntensity = 0.6;
    }
    toonCache.set(key, m);
  }
  return m;
}

/** 反向外壳描边：沿法线外扩 */
export const outlineMat = new ShaderMaterial({
  uniforms: { thickness: { value: 0.022 }, color: { value: new Color('#2b1b4d') } },
  vertexShader: `uniform float thickness;
void main(){ vec3 p = position + normal * thickness; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
  fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color,1.0); }`,
  side: BackSide,
});

/** 玩家色描边：亮化的玩家色实线 + 更宽的半透明加法外发光壳（边缘渐隐）。按颜色缓存，所有棋子共享。 */
const seatOutlineCache = new Map<string, { line: ShaderMaterial; glow: ShaderMaterial }>();
export function seatOutlineMats(hex: string) {
  let m = seatOutlineCache.get(hex);
  if (m) return m;
  const base = new Color(hex);
  const line = outlineMat.clone();
  line.uniforms.thickness.value = 0.02;
  line.uniforms.color.value = base.clone().lerp(new Color('#ffffff'), 0.18);
  const glow = new ShaderMaterial({
    uniforms: { thickness: { value: 0.05 }, color: { value: base.clone().lerp(new Color('#ffffff'), 0.35) }, opacity: { value: 0.55 } },
    vertexShader: `uniform float thickness; varying float vF;
void main(){
  vec4 mv = modelViewMatrix * vec4(position + normal * thickness, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vF = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vF;
void main(){ gl_FragColor = vec4(color * opacity * vF * vF, 1.0); }`,
    side: BackSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  seatOutlineCache.set(hex, (m = { line, glow }));
  return m;
}
