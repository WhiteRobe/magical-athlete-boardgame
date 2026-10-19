import {
  Group, Mesh, SphereGeometry, CylinderGeometry, BoxGeometry, ConeGeometry, TorusGeometry, CapsuleGeometry,
  type BufferGeometry, type Material,
} from 'three';
import type { CharId } from '../../shared/types';
import { PAL } from '../art/palette';
import { toon, outlineMat } from './fx';

// 程序化低多边形棋子：基础几何体拼装，卡通着色 + 描边。单位：棋子约 0.9 高，底部 y=0，面朝 +z。

const geoCache = new Map<string, BufferGeometry>();
function geo(key: string, make: () => BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

type V3 = [number, number, number];
const INK = '#2b1b4d';
const SKIN = '#ffd9b8';
const WHITE = '#ffffff';

class B {
  g = new Group();
  add(geom: BufferGeometry, color: string, p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1], outline = true, mat?: Material) {
    const m = new Mesh(geom, mat ?? toon(color));
    m.position.set(...p);
    m.rotation.set(...r);
    m.scale.set(...s);
    m.castShadow = true;
    if (outline) {
      const o = new Mesh(geom, outlineMat);
      o.userData.outline = true;
      m.add(o);
    }
    this.g.add(m);
    return m;
  }
  sph(r: number, c: string, p: V3, s: V3 = [1, 1, 1], o = true, seg = 10) {
    return this.add(geo(`s${r}|${seg}`, () => new SphereGeometry(r, seg, Math.max(6, seg - 3))), c, p, [0, 0, 0], s, o);
  }
  cyl(rt: number, rb: number, h: number, c: string, p: V3, r: V3 = [0, 0, 0], seg = 10, o = true) {
    return this.add(geo(`c${rt}|${rb}|${h}|${seg}`, () => new CylinderGeometry(rt, rb, h, seg)), c, p, r, [1, 1, 1], o);
  }
  box(w: number, h: number, d: number, c: string, p: V3, r: V3 = [0, 0, 0], o = true) {
    return this.add(geo(`b${w}|${h}|${d}`, () => new BoxGeometry(w, h, d)), c, p, r, [1, 1, 1], o);
  }
  cone(rad: number, h: number, c: string, p: V3, r: V3 = [0, 0, 0], seg = 10) {
    return this.add(geo(`k${rad}|${h}|${seg}`, () => new ConeGeometry(rad, h, seg)), c, p, r);
  }
  tor(R: number, t: number, c: string, p: V3, r: V3 = [0, 0, 0], arc = Math.PI * 2) {
    return this.add(geo(`t${R}|${t}|${arc}`, () => new TorusGeometry(R, t, 6, 16, arc)), c, p, r);
  }
  cap(rad: number, len: number, c: string, p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) {
    return this.add(geo(`p${rad}|${len}`, () => new CapsuleGeometry(rad, len, 4, 10)), c, p, r, s);
  }
  /** 一对大眼睛（带高光，标记 eye 供眨眼动画使用） */
  eyes(y: number, z: number, gap = 0.09, size = 0.055, x = 0) {
    for (const sx of [-1, 1]) {
      const w = this.sph(size, WHITE, [x + sx * gap, y, z], [1, 1.15, 0.6], true, 8);
      const pu = this.sph(size * 0.58, INK, [x + sx * gap, y - 0.004, z + size * 0.4], [1, 1.1, 0.5], false, 7);
      const hl = this.sph(size * 0.2, WHITE, [x + sx * gap + size * 0.2, y + size * 0.25, z + size * 0.62], [1, 1, 0.5], false, 5);
      for (const m of [w, pu, hl]) m.userData.eye = true;
    }
  }
  /** 腮红 */
  cheeks(y: number, z: number, gap = 0.12, x = 0) {
    for (const sx of [-1, 1]) this.sph(0.035, '#ff8fb1', [x + sx * gap, y, z], [1.3, 0.7, 0.3], false, 6);
  }
  /** 微笑（半个圆环） */
  smile(y: number, z: number, w = 0.05, x = 0) {
    return this.add(geo(`sm${w}`, () => new TorusGeometry(w, 0.012, 4, 10, Math.PI)), INK, [x, y, z], [0, 0, Math.PI], [1, 1, 1], false);
  }
  /** 给部件打上待机动画标签 */
  tag<T extends Mesh>(m: T, kind: 'spin' | 'swing' | 'flicker' | 'bob' | 'blinkLight', axis: 'x' | 'y' | 'z' = 'z'): T {
    m.userData.idle = { kind, axis, base: m.rotation[axis], y: m.position.y, s: m.scale.x };
    return m;
  }
}

type Build = (b: B, c: { b: string; a: string }) => void;

const GOLD = '#ffd23f';

const BUILD: Record<CharId, Build> = {
  alchemist: (b, { b: body, a }) => {
    b.cone(0.25, 0.5, body, [0, 0.25, 0], [0, 0, 0], 12);
    b.tor(0.2, 0.025, GOLD, [0, 0.08, 0], [Math.PI / 2, 0, 0]);
    for (const [x, y] of [[-0.1, 0.2], [0.08, 0.32], [0.12, 0.12]]) b.sph(0.022, GOLD, [x, y, 0.2 - y * 0.3], [1, 1, 0.5], false, 5);
    b.sph(0.15, SKIN, [0, 0.55, 0]);
    b.eyes(0.57, 0.12, 0.055, 0.035);
    b.cheeks(0.52, 0.13, 0.085);
    b.cone(0.05, 0.12, '#ffffff', [0, 0.44, 0.1], [Math.PI + 0.3, 0, 0], 6); // 胡子
    b.cone(0.19, 0.36, body, [0, 0.84, -0.01], [-0.15, 0, 0], 12);
    b.cyl(0.19, 0.19, 0.03, a, [0, 0.67, 0], [0, 0, 0], 14);
    b.sph(0.03, GOLD, [0.04, 0.82, 0.13]);
    b.sph(0.09, a, [0.23, 0.3, 0.12], [1, 1, 1], true, 10);
    b.cyl(0.03, 0.03, 0.1, '#e9f7ef', [0.23, 0.42, 0.12]);
    b.tag(b.sph(0.03, '#ffffff', [0.23, 0.5, 0.12], [1, 1, 1], false, 6), 'bob');
  },
  babayaga: (b, { b: body, a }) => {
    for (const x of [-0.12, 0.12]) {
      b.cyl(0.028, 0.028, 0.32, a, [x, 0.16, 0], [0, 0, x * 1.2]);
      for (const r of [-0.5, 0, 0.5]) b.cyl(0.015, 0.012, 0.1, a, [x * 1.3 + Math.sin(r) * 0.05, 0.015, 0.04 + Math.cos(r) * 0.03], [Math.PI / 2, r, 0], 4);
    }
    b.box(0.44, 0.3, 0.36, body, [0, 0.47, 0]);
    for (let i = 0; i < 3; i++) b.box(0.45, 0.012, 0.37, '#5a3a26', [0, 0.36 + i * 0.1, 0], [0, 0, 0], false);
    b.cone(0.37, 0.32, '#5a3a26', [0, 0.78, 0], [0, Math.PI / 4, 0], 4);
    b.box(0.06, 0.16, 0.06, '#7a6a5a', [0.12, 0.92, -0.05]);
    b.tag(b.sph(0.04, '#d9d2c5', [0.12, 1.05, -0.05], [1, 1, 1], false, 6), 'bob');
    b.box(0.14, 0.13, 0.02, GOLD, [0, 0.48, 0.18]);
    b.eyes(0.48, 0.2, 0.035, 0.026);
  },
  banana: (b, { b: body, a }) => {
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      b.sph(0.12 - Math.abs(t - 0.5) * 0.11, body, [Math.sin(t * Math.PI) * 0.16 - 0.04, 0.1 + t * 0.62, 0], [1, 1.25, 0.95], true, 9);
    }
    b.cyl(0.025, 0.035, 0.09, a, [-0.06, 0.78, 0], [0, 0, 0.5]);
    b.sph(0.03, a, [-0.04, 0.06, 0]);
    for (const y of [0.3, 0.55]) b.sph(0.015, '#b8892b', [0.13, y, 0.06], [1, 1, 0.5], false, 5);
    b.eyes(0.42, 0.12, 0.055, 0.038, 0.11);
    b.cheeks(0.36, 0.12, 0.09, 0.11);
    b.smile(0.34, 0.13, 0.03, 0.11);
  },
  blimp: (b, { b: body, a }) => {
    b.sph(0.26, body, [0, 0.6, 0], [1.5, 0.95, 0.95], true, 14);
    for (const y of [0.52, 0.68]) b.tor(0.245, 0.012, '#ffffff', [0, y, 0], [0, Math.PI / 2, 0]);
    b.box(0.18, 0.08, 0.11, a, [0, 0.31, 0]);
    for (const x of [-0.05, 0.04]) b.box(0.03, 0.03, 0.01, '#bff6ff', [x, 0.31, 0.056], [0, 0, 0], false);
    b.cyl(0.01, 0.01, 0.1, a, [0, 0.37, 0]);
    for (const r of [0, Math.PI / 2]) b.box(0.02, 0.2, 0.2, a, [-0.4, 0.6, 0], [r, 0, 0]);
    const prop = b.box(0.015, 0.2, 0.03, INK, [-0.45, 0.6, 0], [0, 0, 0], false);
    b.tag(prop, 'spin', 'x');
    b.eyes(0.63, 0.24, 0.07, 0.045, 0.12);
    b.smile(0.54, 0.25, 0.035, 0.12);
    b.cyl(0.03, 0.03, 0.02, INK, [0, 0.12, 0]);
    b.cyl(0.008, 0.008, 0.2, INK, [0, 0.2, 0], [0, 0, 0], 4, false);
  },
  centaur: (b, { b: body, a }) => {
    b.cap(0.13, 0.3, body, [-0.05, 0.36, 0], [0, 0, Math.PI / 2]);
    for (const [x, z] of [[-0.22, 0.07], [-0.22, -0.07], [0.1, 0.07], [0.1, -0.07]]) {
      b.cyl(0.035, 0.03, 0.26, body, [x, 0.13, z]);
      b.cyl(0.04, 0.04, 0.03, '#3b2a1e', [x, 0.015, z]);
    }
    b.tag(b.cyl(0.03, 0.05, 0.22, '#5a3a26', [-0.36, 0.38, 0], [0, 0, 0.9]), 'swing', 'y');
    b.cap(0.09, 0.14, a, [0.12, 0.56, 0]);
    b.box(0.2, 0.04, 0.2, '#8a5a3b', [0.12, 0.5, 0], [0, 0, 0], false); // 腰带
    b.sph(0.1, a, [0.12, 0.78, 0]);
    b.sph(0.1, '#5a3a26', [0.1, 0.83, -0.03], [1.05, 0.7, 1]);
    b.cap(0.03, 0.1, '#5a3a26', [0.04, 0.78, -0.07], [0.4, 0, 0.3]);
    b.eyes(0.79, 0.09, 0.04, 0.03, 0.12);
    b.smile(0.73, 0.1, 0.025, 0.12);
    b.cyl(0.006, 0.006, 0.4, '#8a5a3b', [0.26, 0.6, 0.06], [0, 0, -0.3], 4, false); // 弓
    b.tor(0.12, 0.012, '#8a5a3b', [0.29, 0.62, 0.06], [0, 0, -0.3 + Math.PI / 2], Math.PI);
  },
  cheerleader: (b, { b: body, a }) => {
    b.cone(0.22, 0.38, body, [0, 0.2, 0], [Math.PI, 0, 0], 12);
    for (let i = 0; i < 6; i++) b.box(0.05, 0.16, 0.01, i % 2 ? '#ffffff' : body, [Math.sin((i / 6) * Math.PI * 2) * 0.2, 0.08, Math.cos((i / 6) * Math.PI * 2) * 0.2], [0, (i / 6) * Math.PI * 2, 0], false);
    b.sph(0.15, SKIN, [0, 0.52, 0]);
    b.sph(0.155, '#c2410c', [0, 0.56, -0.03], [1, 0.9, 1]);
    b.tag(b.cap(0.05, 0.14, '#c2410c', [0.13, 0.62, -0.12], [0.6, 0, -0.5]), 'swing');
    b.box(0.06, 0.04, 0.03, GOLD, [0.08, 0.66, -0.06], [0, 0, 0.5], false);
    b.eyes(0.52, 0.13, 0.055, 0.035);
    b.cheeks(0.47, 0.13, 0.085);
    b.smile(0.45, 0.14, 0.03);
    b.box(0.12, 0.06, 0.01, '#ffffff', [0, 0.28, 0.13], [0.2, 0, 0], false);
    for (const x of [-0.27, 0.27]) {
      const pom = b.sph(0.1, a, [x, 0.5, 0.03], [1, 1, 1], true, 7);
      b.tag(pom, 'bob');
    }
  },
  coach: (b, { b: body, a }) => {
    b.cap(0.18, 0.18, body, [0, 0.3, 0]);
    b.box(0.03, 0.3, 0.02, a, [0, 0.28, 0.18]);
    for (const sx of [-1, 1]) b.box(0.02, 0.32, 0.02, a, [sx * 0.17, 0.3, 0.07], [0, 0, 0], false);
    b.sph(0.14, SKIN, [0, 0.62, 0]);
    b.sph(0.145, body, [0, 0.66, 0], [1, 0.6, 1]);
    b.box(0.2, 0.025, 0.14, body, [0, 0.67, 0.13]);
    b.eyes(0.61, 0.12, 0.05, 0.032);
    b.box(0.12, 0.02, 0.015, '#5a3a26', [0, 0.57, 0.135], [0, 0, 0], false); // 胡子
    b.cyl(0.004, 0.004, 0.2, INK, [0, 0.5, 0.15], [0.2, 0, 0], 3, false);
    b.sph(0.03, '#c0c7d6', [0.0, 0.42, 0.18]);
    b.box(0.1, 0.13, 0.02, '#ffffff', [-0.2, 0.32, 0.1], [0, 0.4, 0.2]); // 写字板
  },
  copycat: (b, { b: body, a }) => {
    b.sph(0.22, body, [0, 0.27, 0], [1, 1.1, 1]);
    for (let i = 0; i < 3; i++) b.tor(0.2 - i * 0.02, 0.015, '#2a9a9a', [0, 0.18 + i * 0.1, 0], [Math.PI / 2, 0, 0]);
    b.sph(0.18, body, [0, 0.58, 0]);
    for (const x of [-0.11, 0.11]) {
      b.cone(0.07, 0.14, body, [x, 0.75, 0], [0, 0, -x * 2]);
      b.cone(0.035, 0.08, '#ff8fb1', [x, 0.74, 0.03], [0, 0, -x * 2], 6);
    }
    b.sph(0.08, a, [0, 0.53, 0.13], [1.2, 0.8, 0.6]);
    b.sph(0.02, '#ff8fb1', [0, 0.56, 0.18], [1, 0.8, 0.6], false, 5);
    b.eyes(0.62, 0.15, 0.07, 0.045);
    for (const sx of [-1, 1]) for (const dy of [0, 0.03]) b.box(0.1, 0.006, 0.006, INK, [sx * 0.14, 0.53 + dy, 0.15], [0, 0, sx * (dy ? -0.15 : 0.1)], false);
    b.tag(b.cyl(0.03, 0.03, 0.35, body, [-0.2, 0.3, -0.15], [0.3, 0, 0.9]), 'swing', 'y');
  },
  dicemonger: (b, { b: body, a }) => {
    b.box(0.42, 0.42, 0.42, body, [0, 0.24, 0], [0, 0.2, 0]);
    for (const [x, y] of [[-0.1, 0.36], [0.1, 0.12], [-0.1, 0.12]]) b.sph(0.035, a, [x + 0.04, y, 0.21], [1, 1, 0.3], false, 6);
    b.cyl(0.2, 0.2, 0.03, a, [0, 0.46, 0], [0, 0, 0], 14);
    b.cyl(0.12, 0.12, 0.2, a, [0, 0.57, 0]);
    b.cyl(0.125, 0.125, 0.04, GOLD, [0, 0.5, 0]);
    b.eyes(0.27, 0.23, 0.07, 0.04, 0.04);
    b.tor(0.05, 0.01, GOLD, [0.11, 0.27, 0.24]); // 单片眼镜
    b.box(0.15, 0.1, 0.02, '#3ddc97', [0.27, 0.3, 0.1], [0, -0.4, 0.3]); // 钞票
  },
  duelist: (b, { b: body, a }) => {
    b.cap(0.15, 0.2, body, [0, 0.3, 0]);
    b.tor(0.15, 0.02, a, [0, 0.36, 0], [Math.PI / 2, 0, 0]);
    b.sph(0.14, body, [0, 0.6, 0]);
    b.box(0.17, 0.12, 0.05, '#444', [0, 0.6, 0.11]);
    for (let i = 0; i < 4; i++) b.box(0.15, 0.008, 0.01, '#888', [0, 0.56 + i * 0.027, 0.137], [0, 0, 0], false);
    b.tag(b.cap(0.04, 0.14, a, [0, 0.79, -0.03], [0.6, 0, 0]), 'swing', 'x');
    b.cyl(0.008, 0.008, 0.5, '#c0c7d6', [0.22, 0.45, 0.12], [0.5, 0, -0.6], 4);
    b.cyl(0.05, 0.05, 0.015, GOLD, [0.17, 0.33, 0.06], [0.5, 0, -0.6], 10);
    b.cyl(0.13, 0.11, 0.06, '#c0c7d6', [-0.18, 0.32, 0.08], [Math.PI / 2, 0, 0.3], 12); // 小盾
  },
  egg: (b, { b: body, a }) => {
    b.sph(0.24, body, [0, 0.33, 0], [1, 1.35, 1], true, 16);
    for (let i = 0; i < 6; i++) b.box(0.07, 0.015, 0.02, a, [-0.17 + i * 0.07, 0.42 + (i % 2) * 0.03, 0.22], [0, 0, i % 2 ? 0.5 : -0.5]);
    b.sph(0.05, '#ffe9b0', [-0.1, 0.18, 0.2], [1, 0.8, 0.4], false, 6);
    b.eyes(0.3, 0.22, 0.07, 0.04);
    b.cheeks(0.24, 0.23, 0.11);
    b.smile(0.23, 0.24, 0.025);
    b.tag(b.sph(0.05, '#ffffff', [0, 0.68, 0], [1, 0.6, 1], true, 8), 'bob'); // 蛋壳帽
  },
  flipflop: (b, { b: body, a }) => {
    b.cyl(0.2, 0.2, 0.06, body, [0, 0.2, 0], [Math.PI / 2 - 0.25, 0, 0], 16).scale.set(1, 1, 1.7);
    b.cyl(0.19, 0.19, 0.02, '#ffffff', [0, 0.2, -0.035], [Math.PI / 2 - 0.25, 0, 0], 16).scale.set(1, 1, 1.7);
    b.tor(0.13, 0.025, a, [0, 0.4, 0.05], [0.2, 0, 0], Math.PI);
    b.sph(0.035, a, [0, 0.5, 0.06]);
    b.sph(0.03, '#ffd23f', [0, 0.52, 0.08]);
    b.eyes(0.3, 0.08, 0.07, 0.04);
    b.smile(0.21, 0.08, 0.03);
  },
  genius: (b, { b: body, a }) => {
    b.cap(0.12, 0.12, WHITE, [0, 0.2, 0]);
    b.box(0.05, 0.08, 0.02, '#4cc9f0', [0.06, 0.24, 0.12], [0, 0, 0], false); // 笔
    b.sph(0.24, body, [0, 0.56, 0], [1.15, 0.9, 1], true, 12);
    for (const [x, y] of [[-0.12, 0.7], [0.1, 0.72], [0, 0.76], [-0.17, 0.58], [0.17, 0.6]]) b.sph(0.06, body, [x, y, 0.03], [1, 0.7, 1], false, 6);
    for (const x of [-0.08, 0.08]) b.tor(0.05, 0.012, a, [x, 0.53, 0.21]);
    b.box(0.04, 0.01, 0.01, a, [0, 0.53, 0.22]);
    b.sph(0.025, INK, [-0.08, 0.53, 0.22], [1, 1, 0.4], false, 6).userData.eye = true;
    b.sph(0.025, INK, [0.08, 0.53, 0.22], [1, 1, 0.4], false, 6).userData.eye = true;
    b.tag(b.sph(0.035, GOLD, [0.2, 0.86, 0], [1, 1, 1], false, 6), 'blinkLight'); // 灵光一闪
  },
  gunk: (b, { b: body, a }) => {
    b.sph(0.26, body, [0, 0.2, 0], [1.2, 0.85, 1.1], true, 12);
    b.sph(0.17, body, [0.02, 0.4, 0]);
    for (const [x, z] of [[0.28, 0.1], [-0.25, 0.14], [0.05, 0.3]]) b.sph(0.06, a, [x, 0.04, z], [1, 0.5, 1], true, 7);
    for (const [x, y] of [[-0.12, 0.3], [0.15, 0.22]]) b.sph(0.03, '#c8f7a0', [x, y, 0.2], [1, 1, 0.5], false, 5);
    b.tag(b.sph(0.04, body, [0.2, 0.5, 0.05], [1, 1.4, 1], true, 6), 'bob'); // 滴落
    b.eyes(0.42, 0.15, 0.07, 0.045);
    b.smile(0.3, 0.2, 0.04);
  },
  hare: (b, { b: body, a }) => {
    b.sph(0.2, body, [0, 0.22, 0], [1, 1.1, 1]);
    b.sph(0.12, '#ffffff', [0, 0.22, 0.12], [1, 1.2, 0.6]);
    b.sph(0.15, body, [0, 0.5, 0]);
    for (const x of [-0.06, 0.06]) {
      const ear = b.cap(0.045, 0.26, body, [x, 0.82, 0], [0, 0, x * 2]);
      b.tag(ear, 'swing');
      b.cap(0.022, 0.2, a, [x * 1.1, 0.82, 0.03], [0, 0, x * 2]);
    }
    b.sph(0.06, WHITE, [0, 0.22, -0.2]);
    b.eyes(0.52, 0.12, 0.055, 0.036);
    b.cheeks(0.46, 0.12, 0.09);
    b.sph(0.025, a, [0, 0.46, 0.15]);
    b.box(0.04, 0.035, 0.01, '#ffffff', [0, 0.42, 0.14], [0, 0, 0], false); // 门牙
    b.box(0.12, 0.05, 0.02, '#ff5d3d', [0, 0.35, 0.18], [0, 0, 0], false); // 号码布
  },
  heckler: (b, { b: body, a }) => {
    b.sph(0.25, body, [0, 0.3, 0], [1, 1.1, 1]);
    b.cone(0.12, 0.25, a, [0.24, 0.38, 0.12], [0, 0, -Math.PI / 2], 12);
    b.tor(0.12, 0.015, INK, [0.36, 0.38, 0.12], [0, Math.PI / 2, 0]);
    b.eyes(0.4, 0.21, 0.07, 0.04, -0.04);
    b.box(0.09, 0.02, 0.02, INK, [-0.11, 0.48, 0.21], [0, 0, -0.4]);
    b.box(0.09, 0.02, 0.02, INK, [0.04, 0.48, 0.21], [0, 0, 0.4]);
    b.sph(0.05, INK, [-0.04, 0.24, 0.22], [1.3, 1, 0.4], false);
    b.sph(0.025, '#ff8fb1', [-0.04, 0.22, 0.24], [1.3, 0.8, 0.4], false, 5);
    b.cone(0.05, 0.12, '#3ddc97', [0, 0.62, 0], [0, 0, 0.3], 5); // 小叶子
  },
  hugebaby: (b, { b: body, a }) => {
    b.sph(0.36, body, [0, 0.4, 0], [1, 1, 1], true, 16);
    b.cyl(0.3, 0.32, 0.16, WHITE, [0, 0.12, 0], [0, 0, 0], 14);
    b.sph(0.03, '#9ad0ff', [0.18, 0.15, 0.26], [1, 1, 0.5], false, 5);
    b.eyes(0.48, 0.32, 0.12, 0.06);
    b.cheeks(0.38, 0.33, 0.2);
    b.cyl(0.07, 0.07, 0.03, a, [0, 0.33, 0.34], [Math.PI / 2, 0, 0]);
    b.tor(0.04, 0.012, a, [0, 0.27, 0.36]);
    b.sph(0.03, a, [0, 0.33, 0.37]);
    b.tag(b.cap(0.03, 0.05, body, [0, 0.8, 0.04], [0.4, 0, 0]), 'swing');
    for (const x of [-0.3, 0.3]) b.sph(0.08, body, [x, 0.3, 0.12]); // 小手
  },
  hypnotist: (b, { b: body, a }) => {
    b.cone(0.24, 0.48, body, [0, 0.24, 0], [0, 0, 0], 12);
    for (let i = 0; i < 5; i++) b.sph(0.02, GOLD, [Math.sin(i * 1.3) * 0.15, 0.1 + i * 0.06, 0.15 - i * 0.015], [1, 1, 0.5], false, 5);
    b.sph(0.16, body, [0, 0.58, 0]);
    b.cone(0.17, 0.25, a, [0, 0.8, 0], [0, 0, 0], 12);
    b.tor(0.165, 0.02, GOLD, [0, 0.69, 0], [Math.PI / 2, 0, 0]);
    for (const x of [-0.065, 0.065]) {
      b.sph(0.045, WHITE, [x, 0.6, 0.13], [1, 1, 0.5]).userData.eye = true;
      b.tag(b.tor(0.025, 0.007, a, [x, 0.6, 0.155]), 'spin');
    }
    const pend = new Group();
    pend.position.set(0.25, 0.43, 0.12);
    const str = b.cyl(0.004, 0.004, 0.22, INK, [0, -0.11, 0], [0, 0, 0], 4, false);
    const ball = b.sph(0.04, a, [0, -0.23, 0], [1, 1, 1], true, 8);
    pend.add(str, ball);
    b.g.add(pend);
    pend.userData.idle = { kind: 'swing', axis: 'z', base: 0 };
  },
  inchworm: (b, { b: body, a }) => {
    const pts: V3[] = [[-0.26, 0.08, 0], [-0.18, 0.22, 0], [-0.06, 0.3, 0], [0.07, 0.24, 0], [0.16, 0.12, 0]];
    pts.forEach((p, i) => {
      b.sph(0.09 + i * 0.005, body, p);
      b.sph(0.025, '#c8f7a0', [p[0], p[1] + 0.06, p[2] + 0.05], [1, 1, 0.5], false, 5);
    });
    b.sph(0.13, body, [0.24, 0.2, 0.05]);
    for (const x of [-0.04, 0.04]) {
      b.cyl(0.006, 0.006, 0.12, INK, [0.24 + x, 0.37, 0.05], [0, 0, -x * 4], 4, false);
      b.tag(b.sph(0.022, a, [0.24 + x * 1.6, 0.43, 0.05]), 'bob');
    }
    b.eyes(0.22, 0.16, 0.05, 0.035, 0.24);
    b.cheeks(0.17, 0.16, 0.07, 0.24);
    b.smile(0.16, 0.17, 0.025, 0.24);
  },
  lackey: (b, { b: body, a }) => {
    b.cap(0.15, 0.22, body, [0, 0.3, 0]);
    b.cone(0.08, 0.2, body, [-0.06, 0.12, -0.12], [0.5, 0, 0], 4); // 燕尾
    b.cone(0.08, 0.2, body, [0.06, 0.12, -0.12], [0.5, 0, 0], 4);
    b.box(0.08, 0.2, 0.02, WHITE, [0, 0.38, 0.15]);
    b.box(0.08, 0.03, 0.03, '#e63946', [0, 0.47, 0.16]);
    for (const y of [0.32, 0.38]) b.sph(0.012, GOLD, [0, y, 0.165], [1, 1, 0.5], false, 5);
    b.sph(0.13, SKIN, [0, 0.64, 0.02]);
    b.sph(0.135, '#33334d', [0, 0.68, 0], [1, 0.6, 1]);
    b.box(0.2, 0.03, 0.12, a, [0.2, 0.36, 0.06], [0, 0, -0.3]);
    b.cyl(0.07, 0.07, 0.015, '#c0c7d6', [0.22, 0.4, 0.06], [0, 0, -0.3], 12); // 托盘
    b.box(0.05, 0.015, 0.02, INK, [-0.05, 0.64, 0.14]).userData.eye = true;
    b.box(0.05, 0.015, 0.02, INK, [0.05, 0.64, 0.14]).userData.eye = true;
    b.box(0.1, 0.012, 0.01, '#5a3a26', [0, 0.59, 0.15], [0, 0, 0], false);
  },
  leaptoad: (b, { b: body, a }) => {
    b.sph(0.25, body, [0, 0.18, 0], [1.15, 0.7, 1]);
    b.sph(0.18, a, [0, 0.14, 0.08], [1, 0.6, 1]);
    for (const [x, z] of [[-0.12, -0.1], [0.14, -0.06], [0.02, -0.18]]) b.sph(0.035, '#1f8a50', [x, 0.3, z], [1, 0.5, 1], false, 6);
    for (const x of [-0.24, 0.24]) b.sph(0.09, body, [x, 0.08, -0.06], [1, 0.6, 1.4]);
    for (const x of [-0.14, 0.14]) b.sph(0.05, body, [x, 0.03, 0.2], [1.3, 0.4, 1]);
    for (const x of [-0.1, 0.1]) b.sph(0.07, body, [x, 0.34, 0.05]);
    b.eyes(0.36, 0.1, 0.1, 0.045);
    b.tor(0.1, 0.012, INK, [0, 0.24, 0.22], [0, 0, Math.PI], Math.PI);
    b.cheeks(0.24, 0.22, 0.16);
    b.cyl(0.16, 0.18, 0.04, '#e63946', [0, 0.42, 0], [0, 0, 0], 12); // 头带
  },
  legs: (b, { b: body, a }) => {
    for (const x of [-0.07, 0.07]) {
      b.cyl(0.025, 0.025, 0.5, body, [x, 0.28, 0]);
      b.box(0.08, 0.05, 0.14, a, [x, 0.03, 0.03]);
      b.box(0.08, 0.015, 0.14, '#ffffff', [x, 0.005, 0.03], [0, 0, 0], false);
      b.tor(0.028, 0.008, '#ffffff', [x, 0.45, 0], [Math.PI / 2, 0, 0]); // 运动袜
    }
    b.sph(0.17, body, [0, 0.64, 0]);
    b.tor(0.165, 0.025, a, [0, 0.68, 0], [Math.PI / 2, 0, 0]);
    b.eyes(0.64, 0.15, 0.06, 0.04);
    b.smile(0.56, 0.16, 0.035);
    b.tag(b.sph(0.03, '#9ad0ff', [0.15, 0.72, 0.05], [0.7, 1, 0.7], false, 5), 'bob'); // 汗珠
  },
  lovableloser: (b, { b: body, a }) => {
    b.sph(0.22, body, [0, 0.24, 0]);
    b.sph(0.17, body, [0, 0.52, 0]);
    for (const x of [-0.17, 0.17]) b.tag(b.sph(0.07, '#5d86d6', [x, 0.5, 0], [0.6, 1.4, 1]), 'swing');
    b.box(0.1, 0.035, 0.02, a, [0.07, 0.62, 0.14], [0, 0, 0.5]);
    b.box(0.035, 0.1, 0.02, a, [0.07, 0.62, 0.141], [0, 0, 0.5], false);
    b.eyes(0.52, 0.15, 0.06, 0.04);
    b.cheeks(0.46, 0.14, 0.1);
    b.tor(0.03, 0.01, INK, [0, 0.43, 0.16], [0, 0, 0], Math.PI);
    b.tag(b.sph(0.02, '#4cc9f0', [-0.08, 0.44, 0.16], [0.8, 1.3, 0.5], false, 5), 'bob');
    b.sph(0.06, '#ffffff', [0.18, 0.2, 0.12], [1, 0.9, 0.5]); // 手里的小旗
  },
  magician: (b, { b: body, a }) => {
    b.cone(0.25, 0.48, a, [0, 0.24, -0.02], [0, 0, 0], 12);
    b.cap(0.12, 0.15, body, [0, 0.3, 0.03]);
    b.box(0.06, 0.05, 0.02, WHITE, [0, 0.42, 0.14], [0, 0, 0], false); // 领结
    b.sph(0.13, SKIN, [0, 0.58, 0]);
    b.cyl(0.18, 0.18, 0.02, body, [0, 0.67, 0], [0, 0, 0], 14);
    b.cyl(0.11, 0.11, 0.2, body, [0, 0.78, 0]);
    b.cyl(0.115, 0.115, 0.04, a, [0, 0.71, 0]);
    b.eyes(0.58, 0.12, 0.045, 0.03);
    b.box(0.08, 0.015, 0.01, INK, [0, 0.53, 0.13], [0, 0, 0], false); // 小胡子
    b.cyl(0.015, 0.015, 0.22, INK, [0.2, 0.42, 0.1], [0, 0, -0.8], 5);
    b.sph(0.022, WHITE, [0.29, 0.5, 0.1]);
    b.tag(b.sph(0.03, GOLD, [0.33, 0.56, 0.1], [1, 1, 1], false, 4), 'blinkLight');
    b.tag(b.sph(0.06, '#ffffff', [-0.1, 0.92, 0.02], [0.8, 1, 0.8], true, 8), 'bob'); // 帽子里的兔耳
  },
  mastermind: (b, { b: body, a }) => {
    b.cone(0.2, 0.36, a, [0, 0.18, 0], [0, 0, 0], 12);
    b.box(0.09, 0.09, 0.02, GOLD, [0, 0.24, 0.17], [0, 0, Math.PI / 4], false);
    b.sph(0.26, body, [0, 0.58, 0], [1.1, 0.95, 1], true, 14);
    for (const [x, y] of [[-0.12, 0.72], [0.08, 0.76], [0.18, 0.66]]) b.tor(0.04, 0.008, '#8a84b8', [x, y, 0.16], [0.6, 0, 0], Math.PI);
    b.sph(0.03, INK, [-0.08, 0.58, 0.24], [1, 1, 0.4], false).userData.eye = true;
    b.tor(0.06, 0.012, GOLD, [0.09, 0.58, 0.24]);
    b.sph(0.025, INK, [0.09, 0.58, 0.245], [1, 1, 0.4], false, 6).userData.eye = true;
    b.cyl(0.003, 0.003, 0.2, GOLD, [0.15, 0.47, 0.24], [0, 0, 0.2], 3, false);
    b.tor(0.035, 0.008, INK, [0, 0.46, 0.26], [0, 0, 0.3], Math.PI * 0.8);
    b.tag(b.sph(0.06, '#c8a8ff', [0.3, 0.3, 0.12], [1, 1, 1], true, 10), 'bob'); // 水晶球
  },
  mouth: (b, { b: body, a }) => {
    b.box(0.46, 0.46, 0.4, a, [0, 0.3, 0]);
    for (const [x, y] of [[-0.2, 0.5], [0.2, 0.5], [-0.2, 0.1], [0.2, 0.1]]) b.sph(0.018, '#8892a6', [x, y, 0.205], [1, 1, 0.4], false, 5);
    b.box(0.38, 0.2, 0.05, body, [0, 0.27, 0.19]);
    for (let i = 0; i < 5; i++) {
      b.cone(0.03, 0.06, WHITE, [-0.14 + i * 0.07, 0.34, 0.22], [Math.PI, 0, 0], 4);
      b.cone(0.03, 0.06, WHITE, [-0.14 + i * 0.07, 0.2, 0.22], [0, 0, 0], 4);
    }
    b.cyl(0.01, 0.01, 0.12, INK, [0, 0.58, 0], [0, 0, 0], 4, false);
    b.tag(b.sph(0.035, '#ff5d3d', [0, 0.65, 0], [1, 1, 1], true, 8), 'blinkLight');
    for (const x of [-0.12, 0.12]) b.sph(0.04, GOLD, [x, 0.46, 0.2], [1, 1, 0.4]).userData.eye = true;
    for (const x of [-0.25, 0.25]) b.cyl(0.03, 0.03, 0.08, '#8892a6', [x, 0.3, 0], [0, 0, Math.PI / 2], 8);
  },
  partyanimal: (b, { b: body, a }) => {
    b.sph(0.22, body, [0, 0.25, 0]);
    for (let i = 0; i < 8; i++) b.sph(0.02, ['#ffd23f', '#4cc9f0', '#3ddc97'][i % 3], [Math.cos(i) * 0.18, 0.15 + (i % 4) * 0.07, 0.12 + Math.sin(i) * 0.04], [1, 1, 0.4], false, 4);
    b.sph(0.16, body, [0, 0.52, 0]);
    b.cone(0.1, 0.25, '#ffd23f', [0.03, 0.78, 0], [0, 0, -0.2]);
    b.tor(0.09, 0.012, '#4cc9f0', [0.02, 0.7, 0], [Math.PI / 2, 0, 0]);
    b.sph(0.03, '#4cc9f0', [0.06, 0.91, 0]);
    b.eyes(0.53, 0.14, 0.06, 0.038);
    b.cheeks(0.47, 0.14, 0.1);
    b.sph(0.04, INK, [0, 0.43, 0.15], [1.2, 0.8, 0.4], false, 6);
    b.cone(0.03, 0.18, '#ff5d3d', [-0.12, 0.45, 0.13], [0, 0, 1.2], 6); // 派对吹笛
    b.cyl(0.005, 0.005, 0.35, INK, [0.24, 0.5, 0], [0, 0, 0], 4, false);
    b.tag(b.sph(0.1, a, [0.24, 0.72, 0], [1, 1.2, 1]), 'bob');
  },
  rocket: (b, { b: body, a }) => {
    b.cap(0.15, 0.2, body, [0, 0.3, 0]);
    b.box(0.05, 0.07, 0.01, '#4cc9f0', [0.07, 0.36, 0.15], [0, 0, 0], false); // 口袋笔
    b.sph(0.14, SKIN, [0, 0.62, 0]);
    b.sph(0.15, '#eeeeee', [0, 0.68, -0.03], [1.05, 0.6, 1]);
    for (const x of [-0.1, 0, 0.1]) b.cone(0.04, 0.08, '#eeeeee', [x, 0.78, -0.04], [0, 0, x * 3], 5);
    b.cap(0.035, 0.15, '#4cc9f0', [0, 0.64, 0.11], [0, 0, Math.PI / 2]);
    b.smile(0.56, 0.13, 0.03);
    b.cyl(0.08, 0.08, 0.3, a, [0, 0.42, -0.17]);
    b.cone(0.08, 0.14, a, [0, 0.64, -0.17]);
    for (const x of [-0.08, 0.08]) b.box(0.01, 0.1, 0.08, a, [x, 0.3, -0.17], [0, 0, 0], false);
    b.tag(b.cone(0.06, 0.14, GOLD, [0, 0.2, -0.17], [Math.PI, 0, 0]), 'flicker');
    b.tag(b.cone(0.035, 0.1, '#ff5d3d', [0, 0.19, -0.17], [Math.PI, 0, 0], 6), 'flicker');
  },
  romantic: (b, { b: body, a }) => {
    for (const x of [-0.1, 0.1]) b.sph(0.16, body, [x, 0.5, 0], [1, 1, 0.9]);
    b.cone(0.24, 0.32, body, [0, 0.25, 0], [Math.PI, 0, 0], 12);
    b.sph(0.04, '#ffffff', [-0.13, 0.58, 0.12], [1, 1, 0.4], false, 6);
    b.eyes(0.48, 0.14, 0.07, 0.04);
    b.cheeks(0.42, 0.14, 0.13);
    b.smile(0.4, 0.15, 0.035);
    b.cyl(0.01, 0.01, 0.22, a, [0.24, 0.32, 0.08], [0, 0, -0.2], 4);
    b.sph(0.05, '#e63946', [0.26, 0.44, 0.08]);
    b.tag(b.sph(0.04, '#ff8fb1', [-0.22, 0.75, 0], [1, 1, 0.5], false, 6), 'bob'); // 飘着的小爱心
  },
  scoocher: (b, { b: body, a }) => {
    b.cap(0.08, 0.36, body, [0, 0.08, 0.02], [0, 0, Math.PI / 2], [1, 0.8, 1]);
    b.tor(0.13, 0.07, a, [-0.02, 0.27, -0.02], [0, 0, 0]);
    b.tor(0.06, 0.035, '#d0609a', [-0.02, 0.27, 0.04], [0, 0, 0]);
    b.sph(0.09, a, [-0.02, 0.27, -0.02]);
    b.sph(0.09, body, [0.24, 0.2, 0.02]);
    for (const z of [-0.03, 0.03]) {
      b.cyl(0.006, 0.006, 0.12, INK, [0.27, 0.32, z], [z * 4, 0, -0.3], 4, false);
      b.tag(b.sph(0.022, INK, [0.29, 0.38, z * 1.5], [1, 1, 1], false, 6), 'bob');
    }
    b.eyes(0.22, 0.09, 0.04, 0.025, 0.24);
    b.cheeks(0.18, 0.09, 0.06, 0.24);
    for (let i = 0; i < 3; i++) b.sph(0.02, '#e8f4ff', [-0.3 - i * 0.07, 0.02, 0.02], [1, 0.4, 1], false, 4); // 黏液痕
  },
  sisyphus: (b, { b: body, a }) => {
    b.sph(0.24, a, [0.12, 0.25, 0.05], [1, 1, 1], true, 7);
    for (const [x, y] of [[0.05, 0.35], [0.2, 0.18]]) b.box(0.08, 0.01, 0.01, '#5d5d68', [x, y, 0.28], [0, 0, 0.6], false);
    b.cap(0.08, 0.18, body, [-0.2, 0.28, 0], [0, 0, -0.5]);
    b.box(0.17, 0.12, 0.17, '#f2e8d5', [-0.19, 0.26, 0], [0, 0, -0.5], false); // 长袍
    b.sph(0.1, body, [-0.25, 0.48, 0]);
    b.sph(0.1, '#7a5a3b', [-0.27, 0.52, -0.02], [1.05, 0.7, 1]);
    b.eyes(0.5, 0.08, 0.035, 0.025, -0.24);
    b.tag(b.sph(0.02, '#9ad0ff', [-0.17, 0.55, 0.06], [0.7, 1, 0.7], false, 5), 'bob'); // 汗
    for (const x of [-0.27, -0.13]) b.cyl(0.025, 0.025, 0.2, body, [x, 0.09, 0], [0, 0, 0.3]);
  },
  skipper: (b, { b: body, a }) => {
    b.cap(0.16, 0.2, body, [0, 0.3, 0]);
    b.tor(0.155, 0.02, a, [0, 0.3, 0], [Math.PI / 2, 0, 0]);
    for (const x of [-0.05, 0.05]) b.sph(0.015, GOLD, [x, 0.36, 0.15], [1, 1, 0.5], false, 5);
    b.sph(0.14, SKIN, [0, 0.62, 0]);
    b.sph(0.1, '#f2f2f2', [0, 0.55, 0.08], [1.2, 0.8, 0.8]);
    b.cyl(0.16, 0.14, 0.08, a, [0, 0.77, 0], [-0.1, 0, 0], 12);
    b.cyl(0.165, 0.165, 0.025, body, [0, 0.74, 0.01], [-0.1, 0, 0], 12);
    b.box(0.2, 0.02, 0.1, INK, [0, 0.735, 0.13], [-0.1, 0, 0]);
    b.sph(0.025, GOLD, [0, 0.79, 0.15]);
    b.eyes(0.64, 0.12, 0.05, 0.032);
    b.cyl(0.012, 0.012, 0.1, '#8a5a3b', [0.08, 0.53, 0.15], [1.2, 0, 0], 5);
    b.tag(b.sph(0.02, '#e8e8e8', [0.12, 0.62, 0.2], [1, 1, 1], false, 4), 'bob'); // 烟斗的烟
    b.tor(0.08, 0.02, '#e63946', [-0.2, 0.3, 0.08], [0, 0.4, 0]); // 救生圈
  },
  stickler: (b, { b: body, a }) => {
    b.box(0.22, 0.8, 0.06, body, [0, 0.4, 0]);
    for (let i = 0; i < 9; i++) b.box(i % 2 ? 0.05 : 0.09, 0.012, 0.01, a, [-0.11 + (i % 2 ? 0.025 : 0.045), 0.1 + i * 0.075, 0.032], [0, 0, 0], false);
    for (const x of [-0.05, 0.05]) b.tor(0.035, 0.008, a, [x, 0.55, 0.04]);
    b.sph(0.016, INK, [-0.05, 0.55, 0.04], [1, 1, 0.5], false, 6).userData.eye = true;
    b.sph(0.016, INK, [0.05, 0.55, 0.04], [1, 1, 0.5], false, 6).userData.eye = true;
    b.box(0.08, 0.015, 0.01, INK, [0, 0.45, 0.04]);
    for (const x of [-0.05, 0.05]) b.box(0.05, 0.01, 0.01, INK, [x, 0.6, 0.04], [0, 0, -x * 6], false); // 皱眉
    const pointer = b.cyl(0.008, 0.008, 0.2, INK, [0.17, 0.62, 0.04], [0, 0, -0.9], 4, false);
    b.tag(pointer, 'swing');
    b.sph(0.03, '#ffffff', [0.25, 0.68, 0.04]);
  },
  suckerfish: (b, { b: body, a }) => {
    b.sph(0.2, body, [0, 0.32, 0], [1.4, 0.8, 0.8], true, 12);
    b.sph(0.18, '#e8f0fb', [0.02, 0.26, 0.04], [1.2, 0.5, 0.7], false, 10);
    b.tag(b.cone(0.13, 0.16, body, [-0.33, 0.32, 0], [0, 0, Math.PI / 2], 4), 'swing', 'y');
    b.sph(0.1, a, [0.02, 0.45, 0], [1.6, 0.3, 0.8]);
    for (let i = 0; i < 5; i++) b.box(0.006, 0.01, 0.14, '#8fa8cc', [-0.1 + i * 0.05, 0.48, 0], [0, 0, 0], false);
    b.eyes(0.36, 0.14, 0.06, 0.035, 0.14);
    b.sph(0.035, '#ff8fb1', [0.28, 0.28, 0.06]);
    b.tor(0.03, 0.008, INK, [0.24, 0.27, 0.1], [0, 0.6, Math.PI], Math.PI);
    b.cyl(0.03, 0.05, 0.16, body, [0, 0.08, 0]);
    b.tag(b.sph(0.025, '#bff6ff', [0.32, 0.45, 0.04], [1, 1, 1], false, 5), 'bob'); // 泡泡
  },
  thirdwheel: (b, { b: body, a }) => {
    const wheel = new Group();
    wheel.position.set(0, 0.33, 0);
    const parts = [
      b.tor(0.26, 0.07, a, [0, 0, 0], [0, 0, 0]),
      b.cyl(0.2, 0.2, 0.06, body, [0, 0, 0], [Math.PI / 2, 0, 0], 14),
      ...[0, 1, 2].map((i) => b.box(0.02, 0.4, 0.02, INK, [0, 0, 0.04], [0, 0, (i * Math.PI) / 3], false)),
    ];
    for (let i = 0; i < 12; i++) parts.push(b.box(0.03, 0.05, 0.16, '#55556a', [Math.cos((i / 12) * Math.PI * 2) * 0.32, Math.sin((i / 12) * Math.PI * 2) * 0.32, 0], [0, 0, (i / 12) * Math.PI * 2], false));
    for (const m of parts) wheel.add(m);
    wheel.userData.idle = { kind: 'spin', axis: 'z', base: 0 };
    b.g.add(wheel);
    b.sph(0.08, body, [0, 0.33, 0.05]);
    b.eyes(0.35, 0.1, 0.035, 0.024);
    b.smile(0.3, 0.12, 0.02);
    b.tag(b.sph(0.04, GOLD, [0.3, 0.68, 0], [1, 1, 1], false, 4), 'blinkLight');
  },
  twin: (b, { b: body, a }) => {
    for (const [x, c] of [[-0.13, body], [0.13, a]] as const) {
      b.cap(0.1, 0.22, c, [x, 0.25, 0]);
      b.sph(0.1, c, [x, 0.5, 0]);
      b.eyes(0.5, 0.09, 0.04, 0.028, x);
      b.cheeks(0.45, 0.09, 0.055, x);
      b.smile(0.44, 0.1, 0.02, x);
      b.cone(0.03, 0.08, c, [x, 0.62, 0], [0, 0, x * 2], 6);
    }
    b.cyl(0.006, 0.006, 0.18, INK, [0, 0.3, 0.06], [0, 0, Math.PI / 2], 3, false); // 牵手
  },
};

export function buildPiece(id: CharId): Group {
  const b = new B();
  const p = PAL[id];
  BUILD[id](b, { b: p.body, a: p.accent });
  b.g.userData.char = id;
  return b.g;
}
