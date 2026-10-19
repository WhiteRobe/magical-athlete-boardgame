import {
  Group, Mesh, CylinderGeometry, Shape, ExtrudeGeometry, ConeGeometry, DodecahedronGeometry, PlaneGeometry, CircleGeometry,
  CanvasTexture, MeshBasicMaterial, OctahedronGeometry, CapsuleGeometry, Vector3, SRGBColorSpace, IcosahedronGeometry, BoxGeometry, SphereGeometry, TorusGeometry,
  CatmullRomCurve3, QuadraticBezierCurve3, TubeGeometry, RepeatWrapping, MeshToonMaterial, Color, type BufferGeometry, type Object3D,
} from 'three';
import type { Spaces, TrackId } from '../../shared/types';
import { FINISH } from '../../shared/types';
import { themeOf, type TrackTheme } from '../art/themes';
import { toon, outlineMat, anim, ease } from './fx';

// 赛道布局：上排 0..12（左→右），右侧弯道 13..15，下排 16..29（右→左），终点领奖台在左下。
export const ROW_Z = 1.45;
const D = 1.05;
const X0 = -6.3;

export function spaceCenter(i: number): Vector3 {
  if (i === 0) return new Vector3(X0 - 0.45, 0, -ROW_Z);
  if (i <= 12) return new Vector3(X0 + i * D, 0, -ROW_Z);
  if (i <= 15) {
    const ang = -Math.PI / 2 + ((i - 12) * Math.PI) / 4;
    return new Vector3(X0 + 12 * D + Math.cos(ang) * ROW_Z, 0, Math.sin(ang) * ROW_Z);
  }
  if (i <= 29) return new Vector3(X0 + 12 * D - (i - 16) * D, 0, ROW_Z);
  return new Vector3(X0 + 12 * D - 14 * D - 0.45, 0, ROW_Z); // 终点领奖台
}
export const TILE_TOP = 0.22;

const INK = '#2b1b4d';
const GOLD_C = '#ffd23f';

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 格子贴花：描边粗细按字号比例，避免中文笔画被描边糊成黑块 */
function label(text: string, opts: { color?: string; size?: number; stroke?: string; icon?: (c: CanvasRenderingContext2D) => void } = {}) {
  return canvasTex(128, 128, (x) => {
    opts.icon?.(x);
    if (!text) return;
    const size = opts.size ?? 54;
    x.font = `900 ${size}px 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.lineWidth = Math.max(4, size * (/[^\x00-\x7f]/.test(text) ? 0.1 : 0.18));
    x.strokeStyle = opts.stroke ?? INK;
    x.strokeText(text, 64, 68);
    x.fillStyle = opts.color ?? '#ffffff';
    x.fillText(text, 64, 68);
  });
}

function starPath(x: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
}

function starShape(r: number) {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return s;
}

function arrowShape() {
  const s = new Shape();
  s.moveTo(0, 0.3);
  s.lineTo(0.26, 0.02);
  s.lineTo(0.1, 0.02);
  s.lineTo(0.1, -0.28);
  s.lineTo(-0.1, -0.28);
  s.lineTo(-0.1, 0.02);
  s.lineTo(-0.26, 0.02);
  s.closePath();
  return s;
}

/** 草地纹理：底色 + 色斑 + 草叶笔触 + 花点 */
function grassTexture(th: TrackTheme) {
  const t = canvasTex(256, 256, (x) => {
    x.fillStyle = th.grass;
    x.fillRect(0, 0, 256, 256);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      x.fillStyle = th.grass2;
      x.globalAlpha = 0.35;
      x.beginPath();
      x.ellipse(rnd() * 256, rnd() * 256, 12 + rnd() * 26, 8 + rnd() * 16, rnd() * 3, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 0.55;
    x.strokeStyle = th.rim;
    x.lineWidth = 2;
    x.lineCap = 'round';
    for (let i = 0; i < 140; i++) {
      const px = rnd() * 256, py = rnd() * 256;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + (rnd() - 0.5) * 4, py - 5 - rnd() * 4);
      x.stroke();
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 18; i++) {
      x.fillStyle = th.flowers[i % th.flowers.length];
      x.beginPath();
      x.arc(rnd() * 256, rnd() * 256, 2.2, 0, Math.PI * 2);
      x.fill();
    }
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(0.28, 0.28);
  return t;
}

/** 正面朝 +z 的牌子 */
function signBoard(text: string, bg: string) {
  const tex = canvasTex(256, 96, (x) => {
    x.fillStyle = bg;
    x.beginPath();
    x.roundRect(4, 4, 248, 88, 20);
    x.fill();
    x.lineWidth = 8;
    x.strokeStyle = INK;
    x.stroke();
    x.font = "900 58px 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif";
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.lineWidth = 7;
    x.strokeStyle = INK;
    x.strokeText(text.split('').join(' '), 128, 52);
    x.fillStyle = '#ffffff';
    x.fillText(text.split('').join(' '), 128, 52);
  });
  const face = new MeshBasicMaterial({ map: tex });
  const edge = toon(bg);
  const m = new Mesh(new BoxGeometry(1.05, 0.4, 0.06), [edge, edge, edge, edge, face, face]);
  return outlined(m);
}

function outlined<T extends Mesh>(m: T, shadow = false): T {
  const o = new Mesh(m.geometry, outlineMat);
  o.userData.outline = true;
  m.add(o);
  m.castShadow = shadow;
  return m;
}

export interface TrackMeshes {
  group: Group;
  tiles: Mesh[]; // index = space（可点选的格面）
  /** 动画装饰，每帧调用 */
  update(t: number): void;
  /** 竖屏时把格子上的文字转正 */
  setPortrait(on: boolean): void;
  /** 随机赛道：逐个翻开特殊格（动画）；无需揭晓的赛道立即返回 */
  reveal(speed: number): Promise<void>;
  /** 直接显示全部特殊格（重连对齐） */
  revealNow(): void;
}

/** 从 i 到 i±1 的 xz 方向角（用于箭头朝向） */
function dirAngle(i: number, delta: number) {
  const a = spaceCenter(Math.max(0, Math.min(29, i)));
  const b = spaceCenter(Math.max(0, Math.min(FINISH, i + Math.sign(delta))));
  return Math.atan2(b.x - a.x, b.z - a.z);
}

export function buildTrack(track: TrackId, spaces: Spaces): TrackMeshes {
  const th = themeOf(track);
  const g = new Group();
  const tiles: Mesh[] = [];
  const updaters: ((t: number) => void)[] = [];
  const textDecals: Mesh[] = [];
  const clouds: Group[] = [];
  /** 需要始终面向相机的牌子（竖屏时世界旋转了） */
  const facers: Object3D[] = [];
  /** 背景牌坊：竖屏时绕所属物体转到相机背后方向 */
  const facersAround: { o: Object3D; base: Vector3; d: number }[] = [];

  // ================= 浮空岛 =================
  const islandW = 19.8, islandH = 5.9, cx = -0.6;
  const shape = roundedRect(islandW, islandH, 2.4);
  const topGeo = new ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.14, bevelThickness: 0.12, bevelSegments: 3, curveSegments: 14 });
  const grassMat = new MeshToonMaterial({ color: '#ffffff', map: grassTexture(th), gradientMap: (toon(th.grass) as MeshToonMaterial).gradientMap });
  const top = new Mesh(topGeo, [grassMat, toon(th.rim)]);
  top.rotation.x = -Math.PI / 2;
  top.position.set(cx, -0.32, 0);
  top.receiveShadow = true;
  const topOutline = new Mesh(topGeo, outlineMat);
  topOutline.scale.set(1.004, 1.008, 1);
  top.add(topOutline);
  g.add(top);
  // 草皮外沿的「垂落」草团
  const pts = shape.getSpacedPoints(70);
  const dripGeo = new SphereGeometry(0.22, 7, 5);
  pts.forEach((p, i) => {
    if (i % 2) return;
    const m = new Mesh(dripGeo, toon(th.rim));
    m.position.set(p.x + cx, -0.42 - (i % 3) * 0.05, -p.y);
    m.scale.set(1.1, 0.75 + (i % 4) * 0.15, 1.1);
    g.add(m);
  });
  // 土层：两层地层
  const dirtGeo = new ExtrudeGeometry(roundedRect(islandW - 0.35, islandH - 0.35, 2.2), { depth: 0.55, bevelEnabled: false, curveSegments: 12 });
  const dirt = outlined(new Mesh(dirtGeo, toon(th.dirt)));
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(cx, -0.95, 0);
  g.add(dirt);
  const dirt2Geo = new ExtrudeGeometry(roundedRect(islandW - 1.6, islandH - 1.4, 1.8), { depth: 0.5, bevelEnabled: false, curveSegments: 10 });
  const dirt2 = outlined(new Mesh(dirt2Geo, toon(th.dirt2)));
  dirt2.rotation.x = -Math.PI / 2;
  dirt2.position.set(cx, -1.45, 0);
  g.add(dirt2);
  // 悬挂岩块与钟乳
  const rockGeo = new DodecahedronGeometry(1, 0);
  for (let i = 0; i < 8; i++) {
    const r = outlined(new Mesh(rockGeo, toon(i % 2 ? th.dirt : th.dirt2)));
    r.position.set(-8.6 + i * 2.35 + Math.sin(i * 3) * 0.5, -1.8 - (i % 3) * 0.3, Math.cos(i * 2.3) * 1.1);
    r.scale.set(1.2, 0.8 + (i % 3) * 0.35, 1.1);
    r.rotation.set(i, i * 2, 0);
    g.add(r);
  }
  for (let i = 0; i < 5; i++) {
    const c = outlined(new Mesh(new ConeGeometry(0.85 - i * 0.08, 2.4 - (i % 2) * 0.6, 6), toon(th.dirt2)));
    c.rotation.x = Math.PI;
    c.position.set(-7.2 + i * 3.6, -2.7 - (i % 2) * 0.3, Math.sin(i * 1.7) * 0.7);
    g.add(c);
  }
  // 远处的小浮岛
  for (let i = 0; i < 3; i++) {
    const isle = new Group();
    const cap = outlined(new Mesh(new CylinderGeometry(0.9, 0.7, 0.25, 7), toon(th.grass)));
    const base = outlined(new Mesh(new ConeGeometry(0.75, 1.3, 7), toon(th.dirt)));
    base.rotation.x = Math.PI;
    base.position.y = -0.78;
    const tr = outlined(new Mesh(new ConeGeometry(0.35, 0.8, 6), toon(th.tree)));
    tr.position.set(0.2, 0.52, 0);
    isle.add(cap, base, tr);
    isle.position.set([-12.5, 12.5, 11][i], [-1.5, -0.8, -2.5][i], [-4.5, -4, 4.5][i]);
    isle.scale.setScalar([0.9, 0.7, 0.6][i]);
    const y0 = isle.position.y;
    updaters.push((t) => (isle.position.y = y0 + Math.sin(t / 1400 + i * 2) * 0.12));
    g.add(isle);
  }

  // 地表装饰统一放在草皮表面高度
  const GROUND = 0.1;
  const deco = new Group();
  deco.position.y = GROUND;
  g.add(deco);

  // ================= 小路 =================
  const curve = new CatmullRomCurve3(Array.from({ length: FINISH + 1 }, (_, i) => spaceCenter(i).setY(0)));
  const pathGeo = new TubeGeometry(curve, 160, 0.5, 8, false);
  const path = new Mesh(pathGeo, toon(th.path));
  path.scale.y = 0.06;
  path.receiveShadow = true;
  deco.add(path);
  // 路边小石子
  const pebble = new DodecahedronGeometry(0.07, 0);
  for (let i = 0; i < 90; i++) {
    const u = (i + 0.37) / 90;
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const side = i % 2 ? 1 : -1;
    const m = new Mesh(pebble, toon(i % 3 ? '#d9d2c5' : th.dirt));
    m.position.set(p.x - tan.z * 0.6 * side, 0.02, p.z + tan.x * 0.6 * side);
    m.scale.set(1 + (i % 3) * 0.4, 0.6, 1);
    deco.add(m);
  }

  // ================= 格子 =================
  const sideGeo = new CylinderGeometry(0.52, 0.57, 0.17, 6);
  const capGeo = new CylinderGeometry(0.5, 0.5, 0.06, 6);
  const insetGeo = new CylinderGeometry(0.41, 0.43, 0.025, 6);
  const plane = new PlaneGeometry(0.74, 0.74);
  const starGeo = new ExtrudeGeometry(starShape(0.2), { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  starGeo.center();
  const arrowGeo = new ExtrudeGeometry(arrowShape(), { depth: 0.07, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 });
  arrowGeo.center();
  const peelGeo = new SphereGeometry(0.09, 7, 5);

  const portalColors = ['#a66cff', '#4cc9f0', '#ff5df0'];
  let portalNo = 0;
  const swirlTex = canvasTex(128, 128, (x) => {
    const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.35, '#d9c2ff');
    gr.addColorStop(1, 'rgba(108,75,244,0)');
    x.fillStyle = gr;
    x.beginPath();
    x.arc(64, 64, 62, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = '#6c4bf4';
    x.lineWidth = 6;
    x.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      x.beginPath();
      for (let a = 0; a < Math.PI * 2.2; a += 0.1) {
        const r = 6 + a * 8;
        x.lineTo(64 + Math.cos(a + (k * 2 * Math.PI) / 3) * r, 64 + Math.sin(a + (k * 2 * Math.PI) / 3) * r);
      }
      x.stroke();
    }
  });
  const mysteryTex = label('?', { size: 70, color: GOLD_C, stroke: INK });
  const specials: { i: number; holder: Group; cap: Mesh; real: Mesh; mystery: Mesh; parts: Group; color: string }[] = [];

  for (let i = 0; i <= 29; i++) {
    const p = spaceCenter(i);
    const fx = i > 0 ? spaces[i] : undefined;
    const holder = new Group();
    holder.position.copy(p);
    if (i === 0) holder.scale.set(1.75, 1, 1.75);
    const side = outlined(new Mesh(sideGeo, toon(i === 0 ? '#e0a92a' : th.tileSide)));
    side.position.y = 0.06;
    side.receiveShadow = true;
    holder.add(side);
    const plain = th.tilePalette ? th.tilePalette[i % th.tilePalette.length] : i % 5 === 0 ? '#ffe7b0' : th.tile;
    const color =
      i === 0 ? '#ffd23f'
      : fx?.kind === 'trip' ? '#ffb3a6'
      : fx?.kind === 'star' ? '#fff0a6'
      : fx?.kind === 'arrow' ? (fx.delta > 0 ? '#b8f5d0' : '#ffc2c2')
      : fx?.kind === 'portal' ? '#e2d4ff'
      : plain;
    const cap = new Mesh(capGeo, toon(color).clone());
    cap.position.y = 0.17;
    cap.receiveShadow = true;
    cap.userData.space = i;
    holder.add(cap);
    // 内凹面板：稍深一点，让格子有厚度
    const inset = new Mesh(insetGeo, toon(new Color(color).multiplyScalar(0.93).getStyle()));
    inset.position.y = 0.2;
    inset.receiveShadow = true;
    holder.add(inset);

    let tex: CanvasTexture;
    if (fx?.kind === 'star') tex = label('', { icon: (x) => { starPath(x, 64, 64, 44); x.fillStyle = '#ffd23f'; x.fill(); x.lineWidth = 7; x.strokeStyle = INK; x.stroke(); } });
    else if (fx?.kind === 'trip') tex = label('!', { size: 56, color: INK, stroke: '#fff', icon: (x) => {
      x.fillStyle = '#ff5d3d'; x.strokeStyle = INK; x.lineWidth = 8; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(64, 12); x.lineTo(118, 110); x.lineTo(10, 110); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#ffd23f'; x.beginPath(); x.moveTo(64, 36); x.lineTo(98, 98); x.lineTo(30, 98); x.closePath(); x.fill();
    } });
    else if (fx?.kind === 'arrow') tex = label(String(Math.abs(fx.delta)), { size: 44, icon: (x) => {
      x.fillStyle = fx.delta > 0 ? '#3ddc97' : '#ff5d3d'; x.strokeStyle = INK; x.lineWidth = 7; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(64, 8); x.lineTo(118, 64); x.lineTo(88, 64); x.lineTo(88, 120); x.lineTo(40, 120); x.lineTo(40, 64); x.lineTo(10, 64); x.closePath();
      x.fill(); x.stroke();
    } });
    else if (fx?.kind === 'portal') tex = label(`→${fx.to}`, { size: 34, color: '#ffffff' });
    else if (i === 0) tex = label('起点', { color: INK, stroke: '#ffffff', size: 40 });
    else tex = label(String(i), { color: i % 5 === 0 ? '#ff7a2f' : '#ffffff', size: i % 5 === 0 ? 58 : 48 });
    const decal = new Mesh(plane, new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    decal.rotation.x = -Math.PI / 2;
    if (fx?.kind === 'arrow') decal.rotation.z = dirAngle(i, fx.delta) + Math.PI;
    else textDecals.push(decal);
    decal.position.y = 0.215;
    holder.add(decal);

    // 机关格子的立体标记（放进 parts，随机赛道开场时再揭晓）
    const parts = new Group();
    holder.add(parts);
    if (fx?.kind === 'star') {
      const st = outlined(new Mesh(starGeo, toon('#ffd23f', { emissive: '#7a5a00' })));
      st.position.set(0.32, 0.75, -0.1);
      st.scale.setScalar(0.85);
      parts.add(st);
      updaters.push((t) => {
        st.rotation.y = t / 500 + i;
        st.position.y = 0.72 + Math.sin(t / 400 + i) * 0.06;
      });
    } else if (fx?.kind === 'trip') {
      // 香蕉皮
      const peel = new Group();
      for (let k = 0; k < 3; k++) {
        const m = outlined(new Mesh(peelGeo, toon('#ffd84a')));
        m.scale.set(0.6, 0.35, 1.5);
        m.position.set(Math.cos((k * 2 * Math.PI) / 3) * 0.08, 0, Math.sin((k * 2 * Math.PI) / 3) * 0.08);
        m.rotation.y = -(k * 2 * Math.PI) / 3 + Math.PI / 2;
        peel.add(m);
      }
      const stem = new Mesh(new SphereGeometry(0.05, 6, 4), toon('#6b4a1f'));
      stem.position.y = 0.04;
      peel.add(stem);
      peel.position.set(0.33, 0.24, 0.18);
      parts.add(peel);
    } else if (fx?.kind === 'arrow') {
      const ar = outlined(new Mesh(arrowGeo, toon(fx.delta > 0 ? '#3ddc97' : '#ff5d3d')));
      const dir = dirAngle(i, fx.delta);
      const pivot = new Group();
      pivot.rotation.y = dir + Math.PI;
      pivot.add(ar);
      pivot.position.set(0, 0.62, 0);
      parts.add(pivot);
      ar.rotation.x = -Math.PI / 2 + 0.9;
      updaters.push((t) => {
        const k = (t / 700 + i * 0.3) % 1;
        ar.position.z = -0.12 + k * 0.24;
      });
    } else if (fx?.kind === 'portal') {
      const pc = portalColors[portalNo++ % portalColors.length];
      // 入口：旋转的漩涡 + 立起来的光环
      const swirl = new Mesh(new CircleGeometry(0.42, 24), new MeshBasicMaterial({ map: swirlTex, transparent: true, depthWrite: false, color: pc }));
      swirl.rotation.x = -Math.PI / 2;
      swirl.position.y = 0.23;
      parts.add(swirl);
      const hoop = outlined(new Mesh(new TorusGeometry(0.3, 0.045, 8, 24), toon(pc, { emissive: pc })));
      hoop.position.y = 0.62;
      parts.add(hoop);
      updaters.push((t) => {
        swirl.rotation.z = -t / 400;
        hoop.rotation.y = t / 900;
        hoop.position.y = 0.62 + Math.sin(t / 500 + i) * 0.05;
      });
      // 出口：地面光圈
      const out = spaceCenter(fx.to);
      const exit = new Mesh(new TorusGeometry(0.36, 0.035, 6, 24), toon(pc, { emissive: pc }));
      exit.rotation.x = Math.PI / 2;
      exit.position.set(out.x - p.x, 0.25, out.z - p.z);
      parts.add(exit);
      updaters.push((t) => exit.scale.setScalar(1 + Math.sin(t / 300 + i) * 0.08));
      // 连线：抬起的光点弧线，光点沿弧线流动
      const a = new Vector3(0, 0.62, 0);
      const b2 = new Vector3(out.x - p.x, 0.3, out.z - p.z);
      const mid = a.clone().lerp(b2, 0.5).setY(1.6 + a.distanceTo(b2) * 0.18);
      const arc = new QuadraticBezierCurve3(a, mid, b2);
      const dotGeo = new SphereGeometry(0.04, 6, 4);
      const n = 22;
      for (let k = 0; k < n; k++) {
        const d = new Mesh(dotGeo, new MeshBasicMaterial({ color: pc, transparent: true }));
        parts.add(d);
        updaters.push((t) => {
          const u = (k / n + t / 2600) % 1;
          d.position.copy(arc.getPoint(u));
          const w = 0.5 + 0.5 * Math.sin(u * Math.PI);
          d.scale.setScalar(0.6 + w * 0.7);
          (d.material as MeshBasicMaterial).opacity = 0.35 + w * 0.65;
        });
      }
    }
    if (fx && th.reveal) {
      const mystery = new Mesh(plane, new MeshBasicMaterial({ map: mysteryTex, transparent: true, depthWrite: false }));
      mystery.rotation.x = -Math.PI / 2;
      mystery.position.y = 0.216;
      holder.add(mystery);
      textDecals.push(mystery);
      specials.push({ i, holder, cap, real: decal, mystery, parts, color });
    }
    g.add(holder);
    tiles[i] = cap;
  }

  /** 随机赛道：特殊格先盖着「?」 */
  function cover(on: boolean) {
    for (const sp of specials) {
      sp.parts.visible = !on;
      sp.real.visible = !on;
      sp.mystery.visible = on;
      (sp.cap.material as MeshToonMaterial).color.set(on ? th.tile : sp.color);
    }
  }
  cover(true);


  // ================= 起点拱门 =================
  const sp = spaceCenter(0);
  const startGate = new Group();
  startGate.position.set(sp.x, GROUND, sp.z - 1.05);
  facersAround.push({ o: startGate, base: new Vector3(sp.x, GROUND, sp.z), d: 1.05 });
  const pillarGeo = new CylinderGeometry(0.08, 0.1, 1.5, 8);
  for (const z of [-0.95, 0.95]) {
    const pl = outlined(new Mesh(pillarGeo, toon('#3ddc97')), true);
    pl.position.set(z, 0.75, 0);
    startGate.add(pl);
    const knob = outlined(new Mesh(new SphereGeometry(0.13, 10, 8), toon('#ffd23f')));
    knob.position.set(z, 1.55, 0);
    startGate.add(knob);
    // 气球
    for (let k = 0; k < 2; k++) {
      const bal = outlined(new Mesh(new SphereGeometry(0.16, 10, 8), toon(k ? '#ff5d8f' : '#4cc9f0')));
      const bx = z + (k ? 0.2 : -0.05) * Math.sign(z), bz = -0.1 - k * 0.12;
      bal.scale.set(1, 1.2, 1);
      const string = new Mesh(new CylinderGeometry(0.006, 0.006, 0.7, 3), toon(INK));
      string.position.set(bx, 1.55, bz);
      startGate.add(string);
      startGate.add(bal);
      updaters.push((t) => bal.position.set(bx + Math.sin(t / 900 + k) * 0.04, 2.0 + Math.sin(t / 700 + k * 2) * 0.05, bz));
    }
  }
  const archGeo = new TorusGeometry(0.95, 0.07, 6, 20, Math.PI);
  const arch = outlined(new Mesh(archGeo, toon('#ff7a2f')));
  arch.position.y = 1.5;
  arch.scale.y = 0.45;
  startGate.add(arch);
  const startSign = signBoard('起点', '#3ddc97');
  startSign.position.y = 1.78;
  startGate.add(startSign);
  g.add(startGate);

  // ================= 终点：拱门 + 领奖台 + 奖杯 + 彩旗 =================
  const fp = spaceCenter(FINISH);
  const finish = new Group();
  finish.position.copy(fp);
  const pod1 = outlined(new Mesh(new BoxGeometry(0.66, 0.5, 0.62), toon('#ffd23f')), true);
  pod1.position.set(0, 0.25, -0.3);
  const pod2 = outlined(new Mesh(new BoxGeometry(0.66, 0.3, 0.62), toon('#dfe6f0')), true);
  pod2.position.set(0, 0.15, 0.36);
  for (const m of [pod1, pod2]) {
    m.receiveShadow = true;
    finish.add(m);
  }
  const numPlate = (n: string, h: number) => {
    const m = new Mesh(plane, new MeshBasicMaterial({ map: label(n, { color: INK, stroke: '#fff', size: 70 }), transparent: true }));
    m.scale.setScalar(0.55);
    m.position.set(0, h, 0.313);
    return m;
  };
  pod1.add(numPlate('1', 0));
  pod2.add(numPlate('2', 0));
  // 奖杯
  const cup = new Group();
  const bowl = outlined(new Mesh(new CylinderGeometry(0.16, 0.07, 0.22, 10), toon('#ffcc33', { emissive: '#7a5a00' })));
  bowl.position.y = 0.26;
  const stemC = outlined(new Mesh(new CylinderGeometry(0.03, 0.04, 0.12, 6), toon('#ffcc33')));
  stemC.position.y = 0.1;
  const baseC = outlined(new Mesh(new BoxGeometry(0.2, 0.06, 0.14), toon('#8a5a3b')));
  baseC.position.y = 0.03;
  for (const sx of [-1, 1]) {
    const h = outlined(new Mesh(new TorusGeometry(0.06, 0.018, 5, 10), toon('#ffcc33')));
    h.position.set(sx * 0.17, 0.28, 0);
    cup.add(h);
  }
  cup.add(bowl, stemC, baseC);
  cup.position.set(0, 0.5, -0.42);
  cup.scale.setScalar(1.2);
  finish.add(cup);
  updaters.push((t) => (cup.rotation.y = Math.sin(t / 1200) * 0.5));
  // 终点拱门（黑白格横幅）
  const checker = canvasTex(256, 64, (x) => {
    for (let a = 0; a < 16; a++) for (let b = 0; b < 4; b++) {
      x.fillStyle = (a + b) % 2 ? INK : '#ffffff';
      x.fillRect(a * 16, b * 16, 16, 16);
    }
  });
  const finGate = new Group();
  finGate.position.set(0, 0, -1.0);
  for (const z of [-0.95, 0.95]) {
    const pl = outlined(new Mesh(pillarGeo, toon('#ff7a2f')), true);
    pl.position.set(z, 0.75, 0);
    finGate.add(pl);
    const knob = outlined(new Mesh(new SphereGeometry(0.13, 10, 8), toon('#ffd23f')));
    knob.position.set(z, 1.55, 0);
    finGate.add(knob);
  }
  const bar = outlined(new Mesh(new BoxGeometry(1.95, 0.14, 0.12), new MeshBasicMaterial({ map: checker })));
  bar.position.set(0, 1.42, 0);
  finGate.add(bar);
  const finBoard = signBoard('终点', '#ff7a2f');
  finBoard.position.set(0, 1.74, 0);
  finGate.add(finBoard);
  // 彩旗串
  const flagGeo = new ConeGeometry(0.06, 0.14, 3);
  const flagColors = ['#ff5d8f', '#ffd23f', '#4cc9f0', '#3ddc97', '#a66cff'];
  for (let k = 0; k < 9; k++) {
    const u = k / 8;
    const f = new Mesh(flagGeo, toon(flagColors[k % 5]));
    f.rotation.x = Math.PI;
    f.position.set(-0.85 + u * 1.7, 1.22 - Math.sin(u * Math.PI) * 0.12, 0.02);
    finGate.add(f);
    updaters.push((t) => (f.rotation.z = Math.sin(t / 300 + k) * 0.2));
  }
  finish.add(finGate);
  facersAround.push({ o: finGate, base: new Vector3(), d: 1.0 });
  const line = new Mesh(new PlaneGeometry(0.3, 1.3), new MeshBasicMaterial({ map: checker }));
  line.rotation.x = -Math.PI / 2;
  line.position.set(0.62, GROUND + 0.012, 0);
  finish.add(line);
  g.add(finish);

  // ================= 装饰 =================
  const rng = (() => {
    let s = track.length * 977 + 13;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  // 中央空地（两排之间）与外缘的可放置点
  const spots: [number, number][] = [];
  for (let k = 0; k < 9; k++) spots.push([-5.6 + k * 1.4 + (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.9]);
  for (let k = 0; k < 7; k++) spots.push([-8.4 + k * 2.9 + rng() * 0.6, -2.45 + rng() * 0.15]);
  for (let k = 0; k < 6; k++) spots.push([-7.6 + k * 3 + rng() * 0.6, 2.45 - rng() * 0.15]);
  spots.push([8.7, -1.9], [8.8, 1.9], [-9.3, -0.4]);

  const treeTop = new ConeGeometry(0.42, 0.7, 7);
  const treeTop2 = new ConeGeometry(0.31, 0.55, 7);
  const roundTop = new IcosahedronGeometry(0.38, 1);
  const trunk = new CylinderGeometry(0.07, 0.1, 0.38, 6);
  const bush = new IcosahedronGeometry(0.26, 1);
  const flower = new SphereGeometry(0.05, 6, 4);
  const mushCap = new SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const mushStem = new CylinderGeometry(0.05, 0.065, 0.16, 6);
  const dot = new SphereGeometry(0.025, 5, 4);
  const add = (o: Object3D, x: number, z: number, s = 1) => {
    o.position.set(x, 0, z);
    o.scale.multiplyScalar(s);
    o.rotation.y = rng() * Math.PI * 2;
    deco.add(o);
    return o;
  };
  const mushroom = (capColor: string, glow?: string) => {
    const m = new Group();
    const st = outlined(new Mesh(mushStem, toon('#fff4e0')));
    st.position.y = 0.08;
    const cp = outlined(new Mesh(mushCap, toon(capColor, glow ? { emissive: glow } : {})));
    cp.position.y = 0.15;
    m.add(st, cp);
    for (let k = 0; k < 4; k++) {
      const d = new Mesh(dot, toon('#ffffff'));
      const a = k * 1.7;
      d.position.set(Math.cos(a) * 0.09, 0.27 - (k % 2) * 0.04, Math.sin(a) * 0.09);
      m.add(d);
    }
    return m;
  };
  const tree = (round: boolean, c1: string, c2: string) => {
    const t = new Group();
    const tr = outlined(new Mesh(trunk, toon(th.trunk)));
    tr.position.y = 0.19;
    t.add(tr);
    if (round) {
      const a = outlined(new Mesh(roundTop, toon(c1)), true);
      a.position.y = 0.7;
      a.scale.set(1, 1.1, 1);
      const b2 = outlined(new Mesh(roundTop, toon(c2)));
      b2.position.set(0.18, 0.88, 0.12);
      b2.scale.setScalar(0.55);
      t.add(a, b2);
    } else {
      const a = outlined(new Mesh(treeTop, toon(c1)), true);
      a.position.y = 0.62;
      const b2 = outlined(new Mesh(treeTop2, toon(c2)));
      b2.position.y = 0.98;
      t.add(a, b2);
    }
    return t;
  };
  const bushWithFlowers = () => {
    const b = new Group();
    for (let k = 0; k < 3; k++) {
      const m = outlined(new Mesh(bush, toon(k === 1 ? th.tree2 : th.tree)));
      m.position.set((k - 1) * 0.28, 0.18, (k % 2) * 0.12);
      m.scale.setScalar(k === 1 ? 1.15 : 0.85);
      b.add(m);
    }
    for (let k = 0; k < 6; k++) {
      const f = new Mesh(flower, toon(th.flowers[k % th.flowers.length]));
      f.position.set((rng() - 0.5) * 0.7, 0.3 + rng() * 0.15, (rng() - 0.2) * 0.35);
      b.add(f);
    }
    return b;
  };

  // ---- 嘉年华 ----
  let carouselPlaced = false;
  const stripeTex = (a: string, b: string) => {
    const tx = canvasTex(64, 16, (x) => {
      for (let i = 0; i < 8; i++) {
        x.fillStyle = i % 2 ? a : b;
        x.fillRect(i * 8, 0, 8, 16);
      }
    });
    tx.wrapS = RepeatWrapping;
    return tx;
  };
  const candy = th.flowers;
  const tent = (k: number) => {
    const g2 = new Group();
    const tex = stripeTex(candy[k % candy.length], '#ffffff');
    const gm = (toon('#ffffff') as MeshToonMaterial).gradientMap;
    const wall = outlined(new Mesh(new CylinderGeometry(0.42, 0.42, 0.45, 12, 1, true), new MeshToonMaterial({ map: tex, gradientMap: gm, side: 2 })), true);
    wall.position.y = 0.22;
    const roof = outlined(new Mesh(new ConeGeometry(0.52, 0.5, 12), new MeshToonMaterial({ map: tex, gradientMap: gm })), true);
    roof.position.y = 0.7;
    const door = new Mesh(new PlaneGeometry(0.2, 0.3), toon(INK));
    door.position.set(0, 0.15, 0.425);
    const pole = new Mesh(new CylinderGeometry(0.012, 0.012, 0.25, 4), toon(INK));
    pole.position.y = 1.05;
    const flag = new Mesh(new ConeGeometry(0.05, 0.14, 3), toon(candy[(k + 1) % candy.length]));
    flag.rotation.z = -Math.PI / 2;
    flag.position.set(0.07, 1.12, 0);
    updaters.push((tt) => (flag.rotation.x = Math.sin(tt / 250 + k) * 0.3));
    g2.add(wall, roof, door, pole, flag);
    return g2;
  };
  const balloons = (k: number) => {
    const g2 = new Group();
    for (let i = 0; i < 3; i++) {
      const b = outlined(new Mesh(new SphereGeometry(0.13, 10, 8), toon(candy[(k + i) % candy.length])));
      b.scale.set(1, 1.2, 1);
      const bx = (i - 1) * 0.15, by = 0.95 + (i % 2) * 0.18;
      const str = new Mesh(new CylinderGeometry(0.004, 0.004, by, 3), toon(INK));
      str.position.set(bx / 2, by / 2, 0);
      str.rotation.z = -bx * 0.5;
      g2.add(b, str);
      updaters.push((tt) => b.position.set(bx + Math.sin(tt / 800 + i + k) * 0.03, by + Math.sin(tt / 600 + i) * 0.04, 0));
    }
    const w = outlined(new Mesh(new BoxGeometry(0.12, 0.08, 0.12), toon('#8a5a3b')));
    w.position.y = 0.04;
    g2.add(w);
    return g2;
  };
  const lollipop = (k: number) => {
    const g2 = new Group();
    const stick = new Mesh(new CylinderGeometry(0.02, 0.02, 0.6, 5), toon('#ffffff'));
    stick.position.y = 0.3;
    const tex = canvasTex(64, 64, (x) => {
      x.fillStyle = '#ffffff';
      x.beginPath();
      x.arc(32, 32, 31, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = candy[k % candy.length];
      x.lineWidth = 7;
      x.beginPath();
      for (let a = 0; a < Math.PI * 6; a += 0.2) x.lineTo(32 + Math.cos(a) * a * 1.6, 32 + Math.sin(a) * a * 1.6);
      x.stroke();
    });
    const disc = outlined(new Mesh(new CylinderGeometry(0.22, 0.22, 0.06, 18), [toon(candy[k % candy.length]), new MeshBasicMaterial({ map: tex }), new MeshBasicMaterial({ map: tex })]));
    disc.rotation.x = Math.PI / 2;
    disc.position.y = 0.7;
    facers.push(disc);
    g2.add(stick, disc);
    return g2;
  };
  const carousel = () => {
    const g2 = new Group();
    const base = outlined(new Mesh(new CylinderGeometry(0.75, 0.8, 0.12, 16), toon('#ffd23f')), true);
    base.position.y = 0.06;
    const tex = stripeTex('#ff5d8f', '#ffffff');
    const roof = outlined(new Mesh(new ConeGeometry(0.85, 0.45, 16), new MeshToonMaterial({ map: tex, gradientMap: (toon('#fff') as MeshToonMaterial).gradientMap })), true);
    roof.position.y = 1.25;
    const top = outlined(new Mesh(new SphereGeometry(0.08, 8, 6), toon('#ffd23f')));
    top.position.y = 1.52;
    const spin = new Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pole = new Mesh(new CylinderGeometry(0.02, 0.02, 1.05, 5), toon('#ffffff'));
      pole.position.set(Math.cos(a) * 0.55, 0.62, Math.sin(a) * 0.55);
      const horse = new Group();
      const body = outlined(new Mesh(new CapsuleGeometry(0.07, 0.18, 4, 8), toon(candy[i % candy.length])));
      body.rotation.z = Math.PI / 2;
      const head = outlined(new Mesh(new BoxGeometry(0.08, 0.12, 0.07), toon(candy[i % candy.length])));
      head.position.set(0.13, 0.08, 0);
      horse.add(body, head);
      horse.position.set(Math.cos(a) * 0.55, 0.5, Math.sin(a) * 0.55);
      horse.rotation.y = -a + Math.PI / 2;
      spin.add(pole, horse);
      updaters.push((tt) => (horse.position.y = 0.5 + Math.sin(tt / 300 + i) * 0.08));
    }
    updaters.push((tt) => (spin.rotation.y = tt / 1600));
    g2.add(base, roof, top, spin);
    return g2;
  };
  // ---- 神秘（随机赛道）----
  const qTex = canvasTex(128, 128, (x) => {
    x.fillStyle = '#ffb627';
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#c47a00';
    x.lineWidth = 10;
    x.strokeRect(5, 5, 118, 118);
    for (const [px, py] of [[16, 16], [112, 16], [16, 112], [112, 112]]) {
      x.fillStyle = '#c47a00';
      x.beginPath();
      x.arc(px, py, 5, 0, Math.PI * 2);
      x.fill();
    }
    x.font = "900 86px system-ui, sans-serif";
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineWidth = 10;
    x.strokeStyle = INK;
    x.strokeText('?', 64, 70);
    x.fillStyle = '#ffffff';
    x.fillText('?', 64, 70);
  });
  const qBlock = (k: number) => {
    const g2 = new Group();
    const m = outlined(new Mesh(new BoxGeometry(0.34, 0.34, 0.34), [0, 1, 2, 3, 4, 5].map(() => new MeshToonMaterial({ map: qTex, color: '#ffffff', gradientMap: (toon('#fff') as MeshToonMaterial).gradientMap }))));
    g2.add(m);
    updaters.push((tt) => {
      m.position.y = 0.6 + Math.sin(tt / 600 + k) * 0.12;
      m.rotation.y = tt / 1500 + k;
    });
    return g2;
  };
  const crystals = (k: number) => {
    const g2 = new Group();
    for (let i = 0; i < 3; i++) {
      const c = outlined(new Mesh(new OctahedronGeometry(0.14, 0), toon(i % 2 ? '#7cf0ff' : '#ff5df0', { emissive: i % 2 ? '#1b6f7f' : '#7f1b78' })));
      c.scale.set(1, 2 - i * 0.4, 1);
      c.position.set((i - 1) * 0.16, 0.25 - i * 0.03, (i % 2) * 0.1);
      c.rotation.z = (i - 1) * 0.3;
      g2.add(c);
    }
    updaters.push((tt) => (g2.children[0].rotation.y = tt / 800 + k));
    return g2;
  };
  const runeTex = canvasTex(128, 128, (x) => {
    x.strokeStyle = '#ffd23f';
    x.lineWidth = 4;
    x.beginPath();
    x.arc(64, 64, 56, 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([6, 8]);
    x.beginPath();
    x.arc(64, 64, 42, 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([]);
    // 四角闪光
    x.fillStyle = '#7cf0ff';
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const cx = 64 + Math.cos(a) * 42, cy = 64 + Math.sin(a) * 42;
      x.beginPath();
      x.moveTo(cx, cy - 9); x.lineTo(cx + 3, cy - 3); x.lineTo(cx + 9, cy); x.lineTo(cx + 3, cy + 3);
      x.lineTo(cx, cy + 9); x.lineTo(cx - 3, cy + 3); x.lineTo(cx - 9, cy); x.lineTo(cx - 3, cy - 3);
      x.closePath();
      x.fill();
    }
    x.font = "900 40px system-ui, sans-serif";
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#ffd23f';
    x.fillText('?', 64, 66);
  });
  const rune = () => {
    const m = new Mesh(new CircleGeometry(0.4, 20), new MeshBasicMaterial({ map: runeTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    updaters.push((tt) => {
      m.rotation.z = tt / 3000;
      (m.material as MeshBasicMaterial).opacity = 0.5 + Math.sin(tt / 700) * 0.3;
    });
    const g2 = new Group();
    g2.add(m);
    return g2;
  };

  spots.forEach(([x, z], k) => {
    const r = rng();
    if (th.ambient === 'carnival') {
      if (r < 0.3) add(tent(k), x, z, 0.75 + rng() * 0.2);
      else if (r < 0.5 && !carouselPlaced && Math.abs(z) < 0.5) {
        carouselPlaced = true;
        add(carousel(), x, z, 0.85);
      } else if (r < 0.75) add(balloons(k), x, z, 0.9);
      else add(lollipop(k), x, z, 0.9 + rng() * 0.3);
      return;
    }
    if (th.ambient === 'mystic') {
      if (r < 0.35) add(crystals(k), x, z, 0.8 + rng() * 0.4);
      else if (r < 0.65) add(qBlock(k), x, z, 0.9);
      else add(rune(), x, z, 1);
      return;
    }
    if (th.ambient === 'meadow') {
      if (r < 0.35) add(tree(r < 0.17, th.tree, th.tree2), x, z, 0.7 + rng() * 0.35);
      else if (r < 0.65) add(bushWithFlowers(), x, z, 0.8 + rng() * 0.3);
      else if (r < 0.85) add(mushroom(k % 2 ? '#e63946' : '#ff8fb1'), x, z, 0.9 + rng() * 0.5);
      else {
        const rock = outlined(new Mesh(rockGeo, toon('#cfc6b6')));
        rock.scale.set(0.25, 0.17, 0.22);
        add(rock, x, z, 1);
        rock.position.y = 0.06;
      }
    } else {
      if (r < 0.3 && th.water) {
        // 水洼 + 荷叶 + 冒泡
        const pond = new Group();
        const water = new Mesh(new CircleGeometry(0.45, 16), new MeshBasicMaterial({ color: th.water, transparent: true, opacity: 0.85 }));
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.012;
        water.scale.set(1.3, 1, 1);
        const rim = new Mesh(new TorusGeometry(0.45, 0.04, 4, 20), toon(th.rim));
        rim.rotation.x = Math.PI / 2;
        rim.scale.set(1.3, 1, 1);
        rim.position.y = 0.01;
        pond.add(water, rim);
        const pad = new Mesh(new CircleGeometry(0.12, 10, 0.3, Math.PI * 1.8), toon('#3fae5a'));
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(0.15, 0.02, 0.05);
        pond.add(pad);
        for (let b = 0; b < 3; b++) {
          const bub = new Mesh(new SphereGeometry(0.04 + b * 0.012, 6, 4), new MeshBasicMaterial({ color: '#bff6ff', transparent: true }));
          pond.add(bub);
          const ox = (rng() - 0.5) * 0.5, oz = (rng() - 0.5) * 0.3, ph = rng();
          updaters.push((t) => {
            const kk = (t / 1600 + ph + b * 0.33) % 1;
            bub.position.set(ox, 0.02 + kk * 0.35, oz);
            bub.scale.setScalar(kk < 0.85 ? 1 : 1 + (kk - 0.85) * 6);
            (bub.material as MeshBasicMaterial).opacity = kk < 0.85 ? 0.85 : Math.max(0, 1 - (kk - 0.85) * 7);
          });
        }
        pond.position.set(x, 0, z);
        deco.add(pond);
      } else if (r < 0.55) {
        // 扭曲的怪树
        const t = new Group();
        const segs = 4;
        for (let s = 0; s < segs; s++) {
          const m = outlined(new Mesh(trunk, toon(th.trunk)));
          m.position.set(Math.sin(s) * 0.08, 0.17 + s * 0.3, 0);
          m.rotation.z = Math.sin(s * 1.7) * 0.4;
          t.add(m);
        }
        const c1 = outlined(new Mesh(roundTop, toon(th.tree)), true);
        c1.position.set(0.1, 1.3, 0);
        c1.scale.set(1.1, 0.7, 1.1);
        const c2 = outlined(new Mesh(roundTop, toon(th.tree2)));
        c2.position.set(-0.25, 1.15, 0.1);
        c2.scale.setScalar(0.55);
        t.add(c1, c2);
        add(t, x, z, 0.6 + rng() * 0.25);
      } else if (r < 0.85) {
        add(mushroom(k % 2 ? '#7cf0ff' : '#ff5df0', k % 2 ? '#1b6f7f' : '#7f1b78'), x, z, 0.9 + rng() * 0.6);
      } else {
        const b = bushWithFlowers();
        add(b, x, z, 0.8);
      }
    }
  });

  // 沼泽：藤蔓从岛边垂下 + 萤火虫；神秘：闪烁的星光
  if (th.ambient === 'swamp' || th.ambient === 'mystic') {
    for (let k = 0; k < (th.ambient === 'swamp' ? 10 : 0); k++) {
      const p = pts[(k * 7 + 3) % pts.length];
      const len = 0.8 + rng() * 1.2;
      const vc = new CatmullRomCurve3([
        new Vector3(0, 0, 0), new Vector3(0.08, -len * 0.35, 0.05), new Vector3(-0.06, -len * 0.7, 0), new Vector3(0.04, -len, 0.04),
      ]);
      const vine = new Mesh(new TubeGeometry(vc, 10, 0.035, 4, false), toon('#3fae5a'));
      vine.position.set(p.x + cx, -0.35, -p.y);
      g.add(vine);
      const leaf = new Mesh(new SphereGeometry(0.07, 5, 4), toon('#58c46b'));
      leaf.position.set(p.x + cx + 0.04, -0.35 - len, -p.y + 0.04);
      leaf.scale.set(1, 0.5, 1.4);
      g.add(leaf);
    }
    const flyGeo = new SphereGeometry(0.035, 5, 4);
    for (let k = 0; k < 14; k++) {
      const f = new Mesh(flyGeo, new MeshBasicMaterial({ color: th.glow ?? '#fff', transparent: true }));
      const bx = -8 + rng() * 16, bz = -2.4 + rng() * 4.8, ph = rng() * 10;
      updaters.push((t) => {
        const s = t / 1000 + ph;
        f.position.set(bx + Math.sin(s * 0.7) * 0.6, 0.5 + Math.sin(s * 1.3) * 0.25, bz + Math.cos(s * 0.5) * 0.4);
        (f.material as MeshBasicMaterial).opacity = 0.4 + Math.abs(Math.sin(s * 2)) * 0.6;
      });
      deco.add(f);
    }
  } else if (th.ambient === 'meadow') {
    // 草地：蝴蝶
    const wing = new PlaneGeometry(0.12, 0.09);
    for (let k = 0; k < 4; k++) {
      const bf = new Group();
      const col = th.flowers[k % th.flowers.length];
      const wl = new Mesh(wing, new MeshBasicMaterial({ color: col, side: 2 }));
      const wr = new Mesh(wing, new MeshBasicMaterial({ color: col, side: 2 }));
      wl.position.x = -0.06;
      wr.position.x = 0.06;
      bf.add(wl, wr);
      const ph = rng() * 10, bx = -6 + rng() * 12, bz = (rng() - 0.5) * 1.2;
      updaters.push((t) => {
        const s = t / 1000 + ph;
        bf.position.set(bx + Math.sin(s * 0.4) * 2, 0.7 + Math.sin(s * 2.1) * 0.15, bz + Math.cos(s * 0.6) * 0.6);
        bf.rotation.y = s * 0.4;
        const flap = Math.sin(t / 60 + ph) * 1.1;
        wl.rotation.y = flap;
        wr.rotation.y = -flap;
      });
      deco.add(bf);
    }
  }

  // ================= 云 =================
  const cloudGeo = new SphereGeometry(0.6, 9, 7);
  for (let i = 0; i < 6; i++) {
    const c = new Group();
    for (let k = 0; k < 4; k++) {
      const m = new Mesh(cloudGeo, toon('#ffffff'));
      m.position.set(k * 0.6 - 0.9, Math.sin(k * 2) * 0.15, (k % 2) * 0.3);
      m.scale.setScalar(0.7 + ((k + i) % 3) * 0.25);
      c.add(m);
    }
    c.position.set(-14 + i * 5.5, -3.6 - (i % 3) * 0.9, i % 2 ? -5.5 : 6);
    c.userData.speed = 0.15 + (i % 3) * 0.08;
    clouds.push(c);
    g.add(c);
  }

  // 机关格：不投射阴影的部件也接收阴影即可
  g.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && !m.userData.outline && (m.geometry as BufferGeometry) !== dripGeo) m.receiveShadow = true;
  });

  return {
    group: g,
    tiles,
    revealNow: () => cover(false),
    async reveal(speed) {
      if (!specials.length || specials[0].parts.visible) return;
      for (const sp of specials) {
        const { holder, parts } = sp;
        // 翻牌：格子翻转一圈，中途换成真面目，机关从天而降
        anim(420 / speed, (k) => {
          holder.rotation.x = ease.outCubic(k) * Math.PI * 2;
          if (k > 0.5 && !sp.real.visible) {
            sp.real.visible = true;
            sp.mystery.visible = false;
            (sp.cap.material as MeshToonMaterial).color.set(sp.color);
          }
        });
        parts.visible = true;
        parts.position.y = 2;
        anim(520 / speed, (k) => (parts.position.y = (1 - ease.outBack(k)) * 2));
        await anim(140 / speed, () => {});
      }
      await anim(500 / speed, () => {});
      for (const sp of specials) sp.holder.rotation.x = 0;
    },
    setPortrait(on) {
      for (const d of textDecals) d.rotation.z = on ? Math.PI / 2 : 0;
      for (const c of clouds) c.visible = !on;
      for (const f of facers) f.rotation.y = on ? Math.PI / 2 : 0;
      for (const f of facersAround) {
        f.o.rotation.y = on ? Math.PI / 2 : 0;
        f.o.position.copy(f.base).add(on ? new Vector3(-f.d, 0, 0) : new Vector3(0, 0, -f.d));
      }
    },
    update(t) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * 0.016;
        if (c.position.x > 16) c.position.x = -16;
      }
      for (const u of updaters) u(t);
    },
  };
}
