// 原创程序化音效与 BGM（纯 WebAudio，无音频文件）。
let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let noiseBuf: AudioBuffer;

const LS = 'ma-audio';
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(LS) || '{}');
  } catch {
    return {};
  }
})();
export const audioPrefs = { sfx: saved.sfx ?? 0.8, music: saved.music ?? 0.45, muted: !!saved.muted };
function persist() {
  localStorage.setItem(LS, JSON.stringify(audioPrefs));
}

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyPrefs();
  return ctx;
}
function applyPrefs() {
  if (!ctx) return;
  master.gain.value = audioPrefs.muted ? 0 : 1;
  sfxBus.gain.value = audioPrefs.sfx * 0.6;
  musicBus.gain.value = audioPrefs.music * 0.35;
}
export function setAudio(p: Partial<typeof audioPrefs>) {
  Object.assign(audioPrefs, p);
  persist();
  applyPrefs();
}

/** 首次用户交互时解锁 */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}
if (typeof window !== 'undefined') {
  const once = () => {
    unlockAudio();
    if (pendingMusic) startMusic(pendingMusic);
  };
  window.addEventListener('pointerdown', once, { once: false, passive: true });
  window.addEventListener('keydown', once, { once: true });
}

type Wave = OscillatorType;
function tone(freq: number, dur: number, opt: { type?: Wave; slide?: number; vol?: number; at?: number; attack?: number; bus?: GainNode; vib?: number } = {}) {
  const c = ctx!;
  const t = c.currentTime + (opt.at ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opt.type ?? 'square';
  o.frequency.setValueAtTime(freq, t);
  if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opt.slide), t + dur);
  if (opt.vib) {
    const l = c.createOscillator();
    const lg = c.createGain();
    l.frequency.value = 9;
    lg.gain.value = opt.vib;
    l.connect(lg).connect(o.frequency);
    l.start(t);
    l.stop(t + dur);
  }
  const v = opt.vol ?? 0.3;
  const a = opt.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(opt.bus ?? sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur: number, opt: { freq?: number; q?: number; vol?: number; at?: number; type?: BiquadFilterType; sweep?: number; bus?: GainNode } = {}) {
  const c = ctx!;
  const t = c.currentTime + (opt.at ?? 0);
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = opt.type ?? 'bandpass';
  f.frequency.setValueAtTime(opt.freq ?? 1200, t);
  if (opt.sweep) f.frequency.exponentialRampToValueAtTime(opt.sweep, t + dur);
  f.Q.value = opt.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(opt.vol ?? 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(opt.bus ?? sfxBus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const N = (n: number) => 440 * 2 ** ((n - 69) / 12);

export const SFX = {
  click: () => tone(1400, 0.05, { type: 'triangle', vol: 0.2, slide: 0.7 }),
  shake: () => {
    for (let i = 0; i < 6; i++) noise(0.05, { freq: 2500 + Math.random() * 2000, q: 3, vol: 0.25, at: i * 0.07 });
  },
  diceHit: (strength = 1) => {
    noise(0.06, { freq: 900, q: 2, vol: 0.5 * strength });
    tone(180, 0.08, { type: 'triangle', vol: 0.3 * strength, slide: 0.6 });
  },
  hop: (step = 0) => tone(N(72 + (step % 5) * 2), 0.09, { type: 'square', vol: 0.09, slide: 1.6 }),
  land: () => noise(0.08, { freq: 300, type: 'lowpass', vol: 0.3 }),
  trip: () => {
    tone(N(67), 0.18, { type: 'sawtooth', vol: 0.16, slide: 0.5 });
    tone(N(62), 0.3, { type: 'sawtooth', vol: 0.16, slide: 0.5, at: 0.18 });
    noise(0.2, { freq: 400, type: 'lowpass', vol: 0.4, at: 0.3 });
  },
  power: () => {
    [76, 79, 83, 88].forEach((n, i) => tone(N(n), 0.12, { type: 'triangle', vol: 0.18, at: i * 0.05 }));
    noise(0.3, { freq: 6000, type: 'highpass', vol: 0.08 });
  },
  warp: () => {
    tone(N(60), 0.35, { type: 'sine', vol: 0.25, slide: 4, vib: 30 });
    noise(0.35, { freq: 3000, sweep: 9000, vol: 0.1, type: 'bandpass' });
  },
  chomp: () => {
    tone(110, 0.15, { type: 'square', vol: 0.3, slide: 0.4 });
    noise(0.12, { freq: 800, vol: 0.5 });
    tone(90, 0.15, { type: 'square', vol: 0.3, slide: 0.4, at: 0.18 });
    noise(0.12, { freq: 700, vol: 0.5, at: 0.18 });
  },
  coin: () => {
    tone(N(83), 0.08, { type: 'square', vol: 0.13 });
    tone(N(88), 0.25, { type: 'square', vol: 0.13, at: 0.08 });
  },
  blocked: () => tone(N(50), 0.25, { type: 'square', vol: 0.18, vib: 20 }),
  cheer: () => {
    noise(1.4, { freq: 1500, q: 0.5, vol: 0.25, sweep: 2500, type: 'bandpass' });
    [72, 76, 79, 84, 79, 84].forEach((n, i) => tone(N(n), i === 5 ? 0.5 : 0.13, { type: 'square', vol: 0.13, at: i * 0.11 }));
  },
  yourTurn: () => {
    tone(N(79), 0.14, { type: 'triangle', vol: 0.25 });
    tone(N(84), 0.3, { type: 'triangle', vol: 0.25, at: 0.13 });
  },
  card: () => noise(0.09, { freq: 3000, sweep: 1200, q: 1.5, vol: 0.25 }),
  fanfare: () => {
    [[67, 0], [72, 0.15], [76, 0.3], [79, 0.45], [76, 0.65], [79, 0.8]].forEach(([n, at], i) =>
      tone(N(n), i === 5 ? 0.7 : 0.18, { type: 'square', vol: 0.12, at }),
    );
  },
  duel: () => {
    tone(N(88), 0.08, { type: 'sawtooth', vol: 0.12 });
    noise(0.15, { freq: 7000, type: 'highpass', vol: 0.2, at: 0.05 });
  },
};

export function sfx(name: keyof typeof SFX, ...args: any[]) {
  const c = ensure();
  if (!c || audioPrefs.muted || c.state !== 'running') return;
  (SFX[name] as (...a: any[]) => void)(...args);
}

// ---------- BGM：简单的循环小调 ----------
type Song = { bpm: number; lead: (number | 0)[]; bass: number[]; drums: string; leadType: Wave };
const SONGS: Record<'lobby' | 'race', Song> = {
  lobby: {
    bpm: 104,
    leadType: 'triangle',
    // 每格 = 八分音符，0 = 休止
    lead: [72, 0, 76, 79, 77, 0, 76, 74, 72, 0, 74, 76, 74, 0, 0, 0, 69, 0, 72, 76, 74, 0, 72, 71, 72, 0, 0, 0, 79, 77, 76, 74],
    bass: [48, 48, 45, 45, 41, 41, 43, 43],
    drums: 'k.h.s.h.k.h.s.hh',
  },
  race: {
    bpm: 148,
    leadType: 'square',
    lead: [76, 76, 0, 79, 0, 76, 74, 72, 74, 0, 74, 77, 0, 74, 72, 71, 72, 72, 0, 76, 0, 72, 71, 69, 71, 0, 74, 0, 79, 0, 0, 0],
    bass: [45, 45, 41, 41, 43, 43, 40, 40],
    drums: 'k.hsk.hsk.hsk.ss',
  },
};
let musicTimer: ReturnType<typeof setInterval> | undefined;
let pendingMusic: keyof typeof SONGS | null = null;
let current: keyof typeof SONGS | null = null;

export function startMusic(name: keyof typeof SONGS | null) {
  pendingMusic = name;
  if (name === current && musicTimer) return;
  stopMusic();
  if (!name) return;
  const c = ensure();
  if (!c || c.state !== 'running') return;
  current = name;
  const song = SONGS[name];
  const step = 60 / song.bpm / 2;
  let next = c.currentTime + 0.1;
  let i = 0;
  musicTimer = setInterval(() => {
    while (next < c.currentTime + 0.3) {
      const at = next - c.currentTime;
      const n = song.lead[i % song.lead.length];
      if (n) tone(N(n), step * 1.6, { type: song.leadType, vol: 0.12, at, bus: musicBus });
      if (i % 4 === 0) {
        const b = song.bass[(i / 4) % song.bass.length];
        tone(N(b), step * 3.5, { type: 'triangle', vol: 0.3, at, bus: musicBus });
      }
      const d = song.drums[i % song.drums.length];
      if (d === 'k') tone(120, 0.12, { type: 'sine', vol: 0.5, slide: 0.35, at, bus: musicBus });
      if (d === 's') noise(0.1, { freq: 1800, q: 0.7, vol: 0.25, at, bus: musicBus });
      if (d === 'h') noise(0.03, { freq: 8000, type: 'highpass', vol: 0.12, at, bus: musicBus });
      next += step;
      i++;
    }
  }, 80);
}
export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = undefined;
  current = null;
}
