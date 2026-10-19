import {
  WebGLRenderer, Scene, Sprite, SpriteMaterial, CanvasTexture, SRGBColorSpace, PerspectiveCamera, HemisphereLight, DirectionalLight, Group, Mesh, Vector3, Vector2, Raycaster,
  TorusGeometry, SphereGeometry, CylinderGeometry, BoxGeometry, OctahedronGeometry, MeshBasicMaterial, PCFShadowMap, Color, CircleGeometry,
  type Object3D, type MeshToonMaterial, type BufferGeometry,
} from 'three';
import type { GameEvent, GameState, Racer, Spaces, TrackId } from '../../shared/types';
import { FINISH, TRACK_ORDER } from '../../shared/types';
import { CHARS } from '../../shared/characters';
import type { BoardApi } from '../game/board';
import { applyVisual } from '../game/describe';
import { effectivePower, noteText, predictionValid } from '../game/powers';
import { buildPiece, tintPieceOutline } from './pieces';
import { buildTrack, spaceCenter, TILE_TOP, type TrackMeshes } from './track';
import { createDiceTray } from './diceTray';
import { anim, ease, lerp, tick, wait, flushTweens, toon, outlineMat } from './fx';
import { SEAT_COLORS } from '../art/palette';
import { sfx } from '../audio';

interface Piece {
  idx: number;
  root: Group; // 位置
  body: Group; // 跳跃/挤压
  tilt: Group; // 朝相机微倾
  model: Group; // 朝向/摔倒
  ring: Mesh;
  stars: Group;
  pickables: Object3D[];
  busy: boolean;
  idles: Object3D[];
  eyes: Object3D[];
  blinkAt: number;
}

interface Particle {
  m: Mesh;
  v: Vector3;
  life: number;
  max: number;
  g: number;
  spin: number;
}

const UP = new Vector3(0, 1, 0);

export function createBoard3D(container: HTMLElement): BoardApi {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  container.insertBefore(renderer.domElement, container.firstChild);

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 200);
  scene.add(new HemisphereLight('#fff6e0', '#6a4fa0', 1.6));
  const sun = new DirectionalLight('#ffffff', 2.2);
  sun.position.set(-6, 14, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -12; sc.right = 12; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.002;
  scene.add(sun);

  const world = new Group(); // 竖屏时整体旋转
  scene.add(world);
  const pieceLayer = new Group();
  world.add(pieceLayer);

  let track: TrackMeshes | null = null;
  let trackId: TrackId | null = null;
  let raceKey = '';
  const pieces = new Map<number, Piece>();
  let state: GameState | null = null;
  let active: number | null = null;
  const tray = createDiceTray(container);
  const particles: Particle[] = [];
  let portrait = false;
  // 镜头：overview = 看全局（轻微跟随）；follow = 贴近当前行动者。
  let camMode: 'follow' | 'overview' = 'overview';
  let modeTouched = false;
  let userZoom = 1;
  const pan = new Vector3();
  const lookCur = new Vector3();
  function defaultMode() {
    if (!modeTouched) camMode = portrait ? 'follow' : 'overview';
  }

  /** 棋子默认朝向（竖屏时世界旋转了 -90°） */
  let faceBase = 0;
  function applyTilt() {
    for (const p of pieces.values()) {
      p.tilt.rotation.set(portrait ? 0 : -0.5, 0, portrait ? 0.5 : 0);
      p.model.rotation.y = faceBase;
    }
  }
  const focus = new Vector3();
  const focusTarget = new Vector3();
  let selectable: number[] | null = null;
  let selectableSpaces: number[] | null = null;

  // ---------- 布局 ----------
  let trackKey = '';
  function setTrack(t: TrackId, spaces: Spaces) {
    const key = `${t}|${JSON.stringify(spaces)}`;
    if (key === trackKey) return;
    trackKey = key;
    if (track) {
      world.remove(track.group);
      track.group.traverse((o) => (o as Mesh).geometry?.dispose?.());
    }
    track = buildTrack(t, spaces);
    trackId = t;
    world.add(track.group);
    track.setPortrait(portrait);
  }

  function slotOffsets(n: number): [number, number][] {
    if (n <= 1) return [[0, 0]];
    if (n === 2) return [[-0.19, 0.05], [0.19, -0.05]];
    if (n === 3) return [[0, -0.2], [-0.2, 0.15], [0.2, 0.15]];
    if (n === 4) return [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]];
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [Math.cos(a) * 0.28, Math.sin(a) * 0.28] as [number, number];
    });
  }

  /** 计算每个棋子的目标位置（含同格错开、领奖台） */
  function targets(s: GameState): Map<number, { p: Vector3; scale: number; hidden: boolean }> {
    const out = new Map<number, { p: Vector3; scale: number; hidden: boolean }>();
    const race = s.race;
    if (!race) return out;
    const bySpace = new Map<number, Racer[]>();
    for (const r of race.racers) {
      if (r.done === 'out') {
        out.set(r.idx, { p: spaceCenter(Math.min(r.pos, 29)), scale: 1, hidden: true });
        continue;
      }
      if (r.done === 1 || r.done === 2) {
        const c = spaceCenter(FINISH);
        const p = r.done === 1 ? new Vector3(c.x, 0.5, c.z - 0.3) : new Vector3(c.x, 0.3, c.z + 0.36);
        out.set(r.idx, { p, scale: 1, hidden: false });
        continue;
      }
      const k = Math.min(r.pos, 29);
      if (!bySpace.has(k)) bySpace.set(k, []);
      bySpace.get(k)!.push(r);
    }
    for (const [sp, rs] of bySpace) {
      const c = spaceCenter(sp);
      const offs = slotOffsets(rs.length).map(([x, z]) => (sp === 0 ? [x * 1.9 - 0.15, z * 1.9] : [x, z]) as [number, number]);
      const sc = sp === 0 ? 0.9 : rs.length > 2 ? 0.78 : rs.length === 2 ? 0.9 : 1;
      rs.forEach((r, i) => out.set(r.idx, { p: new Vector3(c.x + offs[i][0], TILE_TOP, c.z + offs[i][1]), scale: sc, hidden: false }));
    }
    return out;
  }

  function buildPieces(s: GameState) {
    const race = s.race;
    const key = race ? `${race.no}:${race.racers.map((r) => r.card).join(',')}` : '';
    if (key === raceKey) return;
    raceKey = key;
    for (const p of pieces.values()) pieceLayer.remove(p.root);
    pieces.clear();
    markers.clear();
    if (!race) return;
    for (const r of race.racers) {
      const root = new Group();
      const body = new Group();
      const model = buildPiece(r.card);
      tintPieceOutline(model, SEAT_COLORS[r.seat % 6]);
      model.scale.setScalar(1.9);
      const tilt = new Group();
      tilt.add(model);
      body.add(tilt);
      root.add(body);
      // 玩家色底座
      // 玩家色棋子底座
      const base = new Mesh(baseGeo, toon(SEAT_COLORS[r.seat % 6]));
      base.position.y = 0.03;
      base.add(new Mesh(baseGeo, outlineMat));
      root.add(base);
      const ring = new Mesh(new TorusGeometry(0.28, 0.035, 6, 24), new MeshBasicMaterial({ color: '#ffd23f' }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      ring.visible = false;
      root.add(ring);
      const stars = new Group();
      const starGeo = new OctahedronGeometry(0.06, 0);
      for (let i = 0; i < 3; i++) {
        const st = new Mesh(starGeo, new MeshBasicMaterial({ color: '#ffd23f' }));
        stars.add(st);
      }
      stars.position.y = 0.75;
      stars.visible = false;
      body.add(stars);
      const pickables: Object3D[] = [];
      model.traverse((o) => {
        if ((o as Mesh).isMesh && !o.userData.outline) pickables.push(o);
      });
      pickables.push(base);
      for (const o of pickables) o.userData.racer = r.idx;
      pieceLayer.add(root);
      const idles: Object3D[] = [];
      const eyes: Object3D[] = [];
      model.traverse((o) => {
        if (o.userData.idle) idles.push(o);
        if (o.userData.eye) {
          o.userData.sy = o.scale.y;
          eyes.push(o);
        }
      });
      pieces.set(r.idx, { idx: r.idx, root, body, tilt, model, ring, stars, pickables, busy: false, idles, eyes, blinkAt: performance.now() + Math.random() * 3000 });
    }
    applyTilt();
  }

  function applyStatic(s: GameState, animate = false) {
    updateMarkers(s);
    const t = targets(s);
    const race = s.race;
    if (!race) return;
    for (const r of race.racers) {
      const p = pieces.get(r.idx);
      const tg = t.get(r.idx);
      if (!p || !tg || p.busy) continue;
      p.root.visible = !tg.hidden;
      setTripped(p, r.tripped && !r.done);
      if (animate && p.root.position.distanceTo(tg.p) > 0.01) {
        const from = p.root.position.clone();
        const s0 = p.root.scale.x;
        anim(260, (k) => {
          const e = ease.outCubic(k);
          p.root.position.lerpVectors(from, tg.p, e);
          p.root.scale.setScalar(lerp(s0, tg.scale, e));
        });
      } else {
        p.root.position.copy(tg.p);
        p.root.scale.setScalar(tg.scale);
      }
    }
  }

  // 幕后主脑预言标记：被预言的棋子头顶浮着水晶球气泡（预言者的玩家色描边）
  const markerTex = new Map<string, CanvasTexture>();
  function crystalTex(color: string) {
    let t = markerTex.get(color);
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#ffffff';
    x.strokeStyle = color;
    x.lineWidth = 10;
    x.beginPath();
    x.arc(64, 58, 48, 0, Math.PI * 2);
    x.fill();
    x.stroke();
    x.beginPath();
    x.moveTo(52, 104); x.lineTo(64, 124); x.lineTo(76, 104);
    x.fillStyle = color;
    x.fill();
    const g = x.createRadialGradient(54, 48, 4, 64, 58, 30);
    g.addColorStop(0, '#f3e8ff');
    g.addColorStop(0.5, '#a66cff');
    g.addColorStop(1, '#5b3cc4');
    x.fillStyle = g;
    x.beginPath();
    x.arc(64, 54, 26, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#8a5a3b';
    x.fillRect(46, 78, 36, 10);
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.arc(56, 46, 6, 0, Math.PI * 2);
    x.fill();
    t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    markerTex.set(color, t);
    return t;
  }
  const markers = new Map<number, Sprite>();
  function updateMarkers(s: GameState) {
    const want = new Map<number, string>();
    for (const r of s.race?.racers ?? []) {
      if (r.prediction !== undefined && predictionValid(s, r)) want.set(r.prediction, SEAT_COLORS[r.seat % 6]);
    }
    for (const [idx, sp] of markers) {
      if (!want.has(idx)) {
        sp.removeFromParent();
        markers.delete(idx);
      }
    }
    for (const [idx, color] of want) {
      const p = pieces.get(idx);
      if (!p) continue;
      let sp = markers.get(idx);
      if (!sp) {
        sp = new Sprite(new SpriteMaterial({ map: crystalTex(color), depthTest: false }));
        sp.renderOrder = 10;
        sp.scale.setScalar(0.42);
        markers.set(idx, sp);
      } else (sp.material as SpriteMaterial).map = crystalTex(color);
      sp.position.set(0, 1.85, 0);
      p.root.add(sp);
    }
  }

  function setTripped(p: Piece, on: boolean) {
    p.model.rotation.z = on ? Math.PI / 2.2 : 0;
    p.model.position.y = on ? 0.12 : 0;
    p.stars.visible = on;
  }

  function setActive(idx: number | null) {
    active = idx;
    for (const p of pieces.values()) p.ring.visible = p.idx === idx;
    if (idx !== null) {
      const p = pieces.get(idx);
      const r = state?.race?.racers.find((x) => x.idx === idx);
      if (p && r) (p.ring.material as MeshBasicMaterial).color.set(SEAT_COLORS[r.seat % 6]);
    }
  }

  // ---------- 粒子 ----------
  const dustGeo = new SphereGeometry(0.06, 6, 4);
  const confGeo = new BoxGeometry(0.08, 0.02, 0.05);
  const sparkGeo = new OctahedronGeometry(0.06, 0);
  function burst(at: Vector3, opt: { n: number; colors: string[]; geo: BufferGeometry; speed: number; up: number; g: number; life: number; spread?: number }) {
    for (let i = 0; i < opt.n; i++) {
      const m = new Mesh(opt.geo, new MeshBasicMaterial({ color: opt.colors[i % opt.colors.length], transparent: true }));
      m.position.copy(at);
      const a = Math.random() * Math.PI * 2;
      const sp = opt.speed * (0.5 + Math.random() * 0.7);
      const v = new Vector3(Math.cos(a) * sp, opt.up * (0.6 + Math.random() * 0.6), Math.sin(a) * sp);
      world.add(m);
      particles.push({ m, v, life: 0, max: opt.life * (0.7 + Math.random() * 0.6), g: opt.g, spin: (Math.random() - 0.5) * 12 });
    }
  }
  function dust(p: Vector3) {
    burst(p.clone().setY(TILE_TOP + 0.03), { n: 6, colors: ['#ffffff', '#f3e6cf'], geo: dustGeo, speed: 1.1, up: 0.5, g: 1.5, life: 0.45 });
  }
  function confetti(p: Vector3) {
    burst(p.clone().setY(1.2), { n: 70, colors: ['#ff7a2f', '#ffd23f', '#6c4bf4', '#3ddc97', '#ff5d8f', '#4cc9f0'], geo: confGeo, speed: 2.4, up: 5, g: 7, life: 2.2 });
  }
  function sparkle(p: Vector3, color = '#ffd23f') {
    burst(p.clone().setY(p.y + 0.4), { n: 14, colors: [color, '#ffffff'], geo: sparkGeo, speed: 1.6, up: 1.6, g: 0.5, life: 0.7 });
  }
  function updateParticles(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life += dt;
      q.v.y -= q.g * dt;
      q.m.position.addScaledVector(q.v, dt);
      q.m.rotation.x += q.spin * dt;
      q.m.rotation.y += q.spin * dt * 0.7;
      const k = q.life / q.max;
      (q.m.material as MeshBasicMaterial).opacity = 1 - Math.max(0, (k - 0.6) / 0.4);
      if (k >= 1) {
        world.remove(q.m);
        (q.m.material as MeshBasicMaterial).dispose();
        particles.splice(i, 1);
      }
    }
  }

  // ---------- 漫画字 ----------
  const v3 = new Vector3();
  function screenOf(obj: Object3D, dy = 0.9): { x: number; y: number } {
    obj.getWorldPosition(v3);
    v3.y += dy;
    v3.project(camera);
    const w = container.clientWidth, h = container.clientHeight;
    return { x: ((v3.x + 1) / 2) * w, y: ((1 - v3.y) / 2) * h };
  }
  function popWord(idx: number, text: string, sub?: string, color?: string) {
    const p = pieces.get(idx);
    if (!p) return;
    const { x, y } = screenOf(p.root);
    const el = document.createElement('div');
    el.className = 'pop-word';
    el.style.left = `${Math.max(60, Math.min(container.clientWidth - 60, x))}px`;
    el.style.top = `${Math.max(50, y)}px`;
    if (color) el.style.color = color;
    el.textContent = text;
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      el.appendChild(s);
    }
    container.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ---------- 动作 ----------
  function posOfSpace(sp: number, y = TILE_TOP) {
    const c = spaceCenter(Math.min(sp, FINISH));
    return new Vector3(c.x, sp >= FINISH ? 0.5 : y, c.z);
  }

  async function hop(p: Piece, to: Vector3, dur: number, height: number, step: number) {
    const from = p.root.position.clone();
    const dir = Math.atan2(to.x - from.x, to.z - from.z);
    const face0 = p.model.rotation.y;
    const faceTo = normalizeAngle(dir);
    sfx('hop', step);
    await anim(dur * 0.18, (k) => {
      p.body.scale.set(1 + 0.15 * k, 1 - 0.22 * k, 1 + 0.15 * k);
      p.model.rotation.y = lerpAngle(face0, faceBase + normalizeAngle(faceTo - faceBase) * 0.6, k);
    });
    await anim(dur * 0.82, (k) => {
      p.root.position.lerpVectors(from, to, k);
      p.root.position.y = lerp(from.y, to.y, k) + Math.sin(k * Math.PI) * height;
      const st = Math.sin(k * Math.PI);
      p.body.scale.set(1 - 0.1 * st, 1 + 0.18 * st, 1 - 0.1 * st);
      p.body.rotation.x = Math.sin(k * Math.PI * 2) * 0.12;
    });
    p.body.rotation.x = 0;
    anim(140, (k) => {
      const s = Math.sin(k * Math.PI);
      p.body.scale.set(1 + 0.18 * s, 1 - 0.25 * s, 1 + 0.18 * s);
    });
  }

  async function moveAlong(e: Extract<GameEvent, { t: 'move' }>, sp: number) {
    const p = pieces.get(e.racer);
    if (!p || e.path.length < 2) return;
    p.busy = true;
    focusOn(p.root.position);
    const n = e.path.length - 1;
    const per = Math.max(120, 230 - n * 6) / sp;
    for (let i = 1; i <= n; i++) {
      const to = posOfSpace(e.path[i]);
      const gap = Math.abs(e.path[i] - e.path[i - 1]);
      await hop(p, to, per * Math.min(1.6, Math.max(1, gap * 0.7)), 0.35 + gap * 0.12, i);
      focusOn(to);
    }
    dust(p.root.position);
    sfx('land');
    anim(220, (k) => (p.model.rotation.y = lerpAngle(p.model.rotation.y, faceBase, k)));
    p.busy = false;
  }

  function normalizeAngle(a: number) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }
  function lerpAngle(a: number, b: number, k: number) {
    return a + normalizeAngle(b - a) * k;
  }

  function focusOn(p: Vector3) {
    focusTarget.copy(p);
  }

  const seatColor = (racer: number) => SEAT_COLORS[(state?.race?.racers.find((x) => x.idx === racer)?.seat ?? 0) % 6];

  async function play(e: GameEvent, s: GameState, sp: number) {
    state = s;
    const after = applyVisual(s, e);
    switch (e.t) {
      case 'raceStart': {
        setTrack(e.track, e.spaces ?? {});
        buildPieces(after);
        state = after;
        const t = targets(after);
        const list = [...pieces.values()];
        list.forEach((p) => {
          const tg = t.get(p.idx)!;
          p.root.position.copy(tg.p).setY(5);
          p.root.scale.setScalar(tg.scale);
          setTripped(p, false);
          p.root.visible = true;
        });
        focusOn(spaceCenter(4));
        await Promise.all(
          list.map(async (p, i) => {
            await wait((i * 160) / sp);
            const tg = t.get(p.idx)!;
            await anim(420 / sp, (k) => (p.root.position.y = lerp(5, tg.p.y, ease.inCubic(k))));
            dust(p.root.position);
            sfx('land');
            await anim(200, (k) => {
              const sq = Math.sin(k * Math.PI);
              p.body.scale.set(1 + 0.25 * sq, 1 - 0.3 * sq, 1 + 0.25 * sq);
            });
          }),
        );
        await track?.reveal(sp);
        setActive(e.first);
        return;
      }
      case 'turn': {
        setActive(e.racer);
        pan.set(0, 0, 0);
        const p = pieces.get(e.racer);
        if (p) {
          focusOn(p.root.position);
          await anim(260 / sp, (k) => (p.ring.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.4)));
        }
        return;
      }
      case 'roll': {
        await tray.roll([{ value: e.value, color: seatColor(e.racer) }], sp);
        popWord(e.racer, `${e.value} 点`, e.reroll ? '重掷' : undefined, '#ffffff');
        await wait(250 / sp);
        return;
      }
      case 'duelRoll': {
        sfx('duel');
        popWord(e.a, '决斗！', undefined, '#ff5d3d');
        await tray.roll([{ value: e.av, color: seatColor(e.a) }, { value: e.bv, color: seatColor(e.b) }], sp);
        popWord(e.winner, '胜！', `${e.av} : ${e.bv}`);
        await wait(400 / sp);
        return;
      }
      case 'move':
        await moveAlong(e, sp);
        state = after;
        applyStatic(after, true);
        return;
      case 'place': {
        const p = pieces.get(e.racer);
        if (p) {
          p.busy = true;
          const from = p.root.position.clone();
          const to = posOfSpace(e.to);
          await anim(320 / sp, (k) => {
            p.root.position.lerpVectors(from, to, ease.outCubic(k));
            p.root.position.y += Math.sin(k * Math.PI) * 0.15;
          });
          p.busy = false;
        }
        state = after;
        applyStatic(after, true);
        return;
      }
      case 'warp': {
        const p = pieces.get(e.racer);
        if (p) {
          p.busy = true;
          sfx('warp');
          sparkle(p.root.position, '#a66cff');
          await anim(260 / sp, (k) => {
            p.body.scale.setScalar(1 - ease.inBack(k) * 0.98);
            p.body.rotation.y = k * Math.PI * 2;
          });
          p.root.position.copy(posOfSpace(e.to));
          focusOn(p.root.position);
          sparkle(p.root.position, '#a66cff');
          await anim(380 / sp, (k) => {
            p.body.scale.setScalar(Math.max(0.02, ease.outBack(k)));
            p.body.rotation.y = (1 - k) * Math.PI * 2;
          });
          p.body.rotation.y = 0;
          p.busy = false;
        }
        state = after;
        applyStatic(after, true);
        return;
      }
      case 'blocked': {
        const p = pieces.get(e.racer);
        sfx('blocked');
        popWord(e.racer, '差一点！', '较真者：必须恰好到终点');
        if (p) {
          const x0 = p.body.position.x;
          await anim(500 / sp, (k) => (p.body.position.x = x0 + Math.sin(k * Math.PI * 6) * 0.08 * (1 - k)));
          p.body.position.x = x0;
        }
        return;
      }
      case 'trip': {
        const p = pieces.get(e.racer);
        sfx('trip');
        popWord(e.racer, '哎哟！');
        if (p) {
          p.stars.visible = true;
          await anim(450 / sp, (k) => {
            p.model.rotation.z = ease.outBack(k) * (Math.PI / 2.2);
            p.model.position.y = Math.sin(k * Math.PI) * 0.3 + k * 0.12;
          });
        }
        return;
      }
      case 'standUp': {
        const p = pieces.get(e.racer);
        if (p) {
          await anim(380 / sp, (k) => {
            p.model.rotation.z = (1 - ease.outBack(k)) * (Math.PI / 2.2);
            p.model.position.y = (1 - k) * 0.12 + Math.sin(k * Math.PI) * 0.2;
          });
          setTripped(p, false);
        }
        return;
      }
      case 'skip':
        popWord(e.racer, e.reason === 'hare' ? '💤 呼——' : e.reason === 'inchworm' ? '被截胡！' : '爬起来…');
        await wait(600 / sp);
        return;
      case 'power': {
        const c = CHARS[e.power];
        const p = pieces.get(e.racer);
        sfx('power');
        popWord(e.racer, c.skill, noteText(e.note));
        if (p) {
          sparkle(p.root.position);
          await anim(420 / sp, (k) => {
            const s2 = Math.sin(k * Math.PI);
            p.body.position.y = s2 * 0.25;
            p.body.rotation.y = k * Math.PI * 2;
          });
          p.body.position.y = 0;
          p.body.rotation.y = 0;
        }
        await wait(250 / sp);
        return;
      }
      case 'space': {
        const tile = track?.tiles[e.space];
        if (tile) {
          const m = tile.material as MeshToonMaterial;
          const c0 = m.color.clone();
          anim(500 / sp, (k) => m.color.copy(c0).lerp(new Color('#ffffff'), Math.sin(k * Math.PI) * 0.7));
        }
        if (e.kind === 'star') {
          const p = pieces.get(e.racer);
          if (p) {
            const coin = new Mesh(new BoxGeometry(0.26, 0.26, 0.05), toon('#e8a33d'));
            coin.position.copy(p.root.position).setY(0.8);
            world.add(coin);
            await anim(600 / sp, (k) => {
              coin.position.y = 0.8 + k * 0.8;
              coin.rotation.y = k * 10;
              coin.scale.setScalar(1 - Math.max(0, k - 0.7) / 0.3);
            });
            world.remove(coin);
            popWord(e.racer, '+1 分', '星星格');
          }
        } else if (e.kind === 'arrow') {
          await wait(200 / sp);
        } else if (e.kind === 'portal') {
          popWord(e.racer, '传送门！', undefined, '#d9c2ff');
          sparkle(pieces.get(e.racer)?.root.position ?? new Vector3(), '#a66cff');
          await wait(300 / sp);
        }
        return;
      }
      case 'eliminate': {
        const p = pieces.get(e.racer);
        const by = pieces.get(e.by);
        sfx('chomp');
        popWord(e.by, '啊呜！', undefined, '#ff5d3d');
        if (by) {
          anim(300 / sp, (k) => {
            const s2 = Math.sin(k * Math.PI * 2);
            by.body.scale.set(1 + s2 * 0.25, 1 - s2 * 0.2, 1 + s2 * 0.25);
          });
        }
        if (p) {
          p.busy = true;
          const from = p.root.position.clone();
          await anim(900 / sp, (k) => {
            p.root.position.set(from.x + k * 2, from.y + Math.sin(k * Math.PI) * 2.5 + k * 1.5, from.z - k * 3);
            p.body.rotation.z = k * 12;
            p.root.scale.setScalar(1 - k * 0.9);
          });
          p.root.visible = false;
          p.body.rotation.z = 0;
          p.busy = false;
        }
        return;
      }
      case 'finish': {
        const p = pieces.get(e.racer);
        if (p) {
          p.busy = true;
          const c = spaceCenter(FINISH);
          const to = e.place === 1 ? new Vector3(c.x, 0.5, c.z - 0.3) : new Vector3(c.x, 0.3, c.z + 0.36);
          focusOn(to);
          await hop(p, to, 520 / sp, 1.1, 3);
          confetti(to);
          await anim(500 / sp, (k) => (p.body.rotation.y = k * Math.PI * 2));
          p.body.rotation.y = 0;
          p.busy = false;
        }
        state = after;
        applyStatic(after, true);
        return;
      }
      case 'predict': {
        state = after;
        updateMarkers(after);
        const r = s.race?.racers.find((x) => x.idx === e.racer);
        if (r && effectivePower(s, r) === 'genius') popWord(e.racer, `我猜 ${e.target} 点！`, '天才预测');
        else popWord(e.racer, '我预言！', `${CHARS[s.race!.racers.find((x) => x.idx === e.target)?.card ?? 'genius'].name} 会赢`);
        await wait(700 / sp);
        return;
      }
      case 'powerSwap':
        popWord(e.racer, e.power ? CHARS[e.power].name : '……', `${CHARS[e.via].skill}`);
        sparkle(pieces.get(e.racer)?.root.position ?? new Vector3(), '#3ddc97');
        sfx('power');
        await wait(700 / sp);
        return;
      case 'raceEnd':
        setActive(null);
        await wait(500 / sp);
        return;
      default:
        await wait(120 / sp);
    }
  }

  // ---------- 相机 ----------
  let baseDist = 20;
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    portrait = w / h < 0.85;
    world.rotation.y = portrait ? -Math.PI / 2 : 0;
    faceBase = portrait ? Math.PI / 2 : 0;
    defaultMode();
    track?.setPortrait(portrait);
    applyTilt();
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    if (portrait) {
      // 竖屏：赛道转成纵向，高度方向需要容纳 ~21 单位
      baseDist = 12.4 / Math.tan(vfov / 2);
    } else {
      baseDist = Math.max(10.7 / Math.tan(hfov / 2), 4.6 / Math.tan(vfov / 2));
    }
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const camPos = new Vector3();
  // 镜头：overview = 看全局（轻微跟随）；follow = 贴近当前行动者。支持拖动平移、双指/滚轮缩放。
  function updateCamera(dt: number) {
    const k = 1 - Math.exp(-dt * 2.5);
    const ft = focusTarget.clone();
    if (portrait) ft.applyAxisAngle(UP, -Math.PI / 2);
    focus.lerp(ft, k);
    const follow = camMode === 'follow' ? 1 : portrait ? 0.3 : 0.12;
    const look = new Vector3(focus.x * follow, 0, focus.z * follow).add(pan);
    const pitch = portrait ? (camMode === 'follow' ? 0.95 : 1.1) : camMode === 'follow' ? 0.82 : 0.93;
    const near = camMode === 'follow' ? (portrait ? 0.42 : 0.55) : portrait ? 0.9 : 1;
    const dist = baseDist * near * userZoom;
    lookCur.lerp(look, 1 - Math.exp(-dt * 6));
    camPos.set(lookCur.x, Math.sin(pitch) * dist, lookCur.z + Math.cos(pitch) * dist);
    camera.position.lerp(camPos, 1 - Math.exp(-dt * 6));
    camera.lookAt(lookCur.x, 0, lookCur.z - (portrait ? 0 : 0.3));
  }

  // 手势：单指拖动平移，双指缩放，滚轮缩放
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch0 = 0;
  let zoom0 = 1;
  const onMoveGesture = (ev: PointerEvent) => {
    const prev = pointers.get(ev.pointerId);
    if (!prev) return;
    const cur = { x: ev.clientX, y: ev.clientY };
    pointers.set(ev.pointerId, cur);
    if (pointers.size >= 2) {
      const [a, b2] = [...pointers.values()];
      const d = Math.hypot(a.x - b2.x, a.y - b2.y);
      if (pinch0) userZoom = Math.min(1.6, Math.max(0.35, zoom0 * (pinch0 / d)));
      return;
    }
    if (!downAt || Math.hypot(cur.x - downAt.x, cur.y - downAt.y) < 8) return;
    const scale = (camera.position.y / container.clientHeight) * 1.6;
    pan.x -= (cur.x - prev.x) * scale;
    pan.z -= (cur.y - prev.y) * scale;
    pan.clampLength(0, 14);
  };
  const onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    userZoom = Math.min(1.6, Math.max(0.35, userZoom * (1 + Math.sign(ev.deltaY) * 0.1)));
  };
  const onPDown = (ev: PointerEvent) => {
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2) {
      const [a, b2] = [...pointers.values()];
      pinch0 = Math.hypot(a.x - b2.x, a.y - b2.y);
      zoom0 = userZoom;
      downAt = null;
    }
  };
  const onPUp = (ev: PointerEvent) => {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch0 = 0;
  };
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.addEventListener('pointermove', onMoveGesture);
  renderer.domElement.addEventListener('pointerdown', onPDown);
  window.addEventListener('pointerup', onPUp);
  window.addEventListener('pointercancel', onPUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

  // ---------- 点选 ----------
  const ray = new Raycaster();
  const ndc = new Vector2();
  let downAt: { x: number; y: number } | null = null;
  const onDown = (ev: PointerEvent) => (downAt = { x: ev.clientX, y: ev.clientY });
  const onUp = (ev: PointerEvent) => {
    if (!downAt || Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 10) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs: Object3D[] = [];
    for (const p of pieces.values()) if (p.root.visible) objs.push(...p.pickables);
    const hit = ray.intersectObjects(objs, false)[0];
    if (hit) return api.onPick(hit.object.userData.racer);
    if (selectableSpaces && track) {
      const th = ray.intersectObjects(track.tiles, false)[0];
      if (th) api.onPickSpace(th.object.userData.space);
    }
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  // ---------- 待机动画：眨眼 + 部件小动作 ----------
  const baseGeo = new CylinderGeometry(0.27, 0.31, 0.06, 20);
  function idleAnim(p: Piece, t: number) {
    if (t > p.blinkAt) {
      const k = t - p.blinkAt;
      const closed = k < 130;
      for (const e of p.eyes) e.scale.y = e.userData.sy * (closed ? 0.12 : 1);
      if (!closed) p.blinkAt = t + 1800 + Math.random() * 3500;
    }
    for (const o of p.idles) {
      const d = o.userData.idle as { kind: string; axis: 'x' | 'y' | 'z'; base: number; y?: number; s?: number };
      const ph = p.idx * 1.7;
      switch (d.kind) {
        case 'spin':
          o.rotation[d.axis] = d.base + t * 0.004;
          break;
        case 'swing':
          o.rotation[d.axis] = d.base + Math.sin(t / 420 + ph) * 0.22;
          break;
        case 'bob':
          o.position.y = (d.y ?? 0) + Math.sin(t / 330 + ph) * 0.018;
          break;
        case 'flicker':
          o.scale.setScalar((d.s ?? 1) * (0.8 + Math.abs(Math.sin(t / 60 + ph)) * 0.4));
          break;
        case 'blinkLight':
          o.scale.setScalar((d.s ?? 1) * (0.6 + Math.max(0, Math.sin(t / 300 + ph)) * 0.8));
          break;
      }
    }
  }

  // ---------- 循环 ----------
  let raf = 0;
  let last = performance.now();
  let tileFlashBase = new Map<number, Color>();
  function frame(t: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    tick(t);
    updateParticles(dt);
    track?.update(t);
    // 待机动画
    for (const p of pieces.values()) {
      if (p.stars.visible) {
        p.stars.rotation.y += dt * 4;
        p.stars.children.forEach((c, i) => {
          const a = (i / 3) * Math.PI * 2;
          c.position.set(Math.cos(a) * 0.22, Math.sin(t / 200 + i) * 0.03, Math.sin(a) * 0.22);
        });
      }
      if (p.ring.visible) p.ring.rotation.z += dt * 2;
      const sel = selectable?.includes(p.idx);
      if (sel) {
        p.ring.visible = true;
        (p.ring.material as MeshBasicMaterial).color.set('#ffffff');
        p.ring.scale.setScalar(1 + Math.sin(t / 150) * 0.15);
      }
      if (!p.busy && !sel) p.model.scale.y = 1.9 * (1 + Math.sin(t / 380 + p.idx) * 0.025);
      idleAnim(p, t);
      const mk = markers.get(p.idx);
      if (mk) mk.position.y = 1.85 + Math.sin(t / 400) * 0.06;
    }
    if (selectableSpaces && track) {
      for (const sp of selectableSpaces) {
        const m = track.tiles[sp].material as MeshToonMaterial;
        if (!tileFlashBase.has(sp)) tileFlashBase.set(sp, m.color.clone());
        m.color.copy(tileFlashBase.get(sp)!).lerp(new Color('#a66cff'), 0.4 + Math.sin(t / 150) * 0.3);
      }
    }
    updateCamera(dt);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  const api: BoardApi = {
    onPick: () => {},
    onPickSpace: () => {},
    sync(s) {
      flushTweens();
      state = s;
      if (s.race) {
        setTrack(s.race.track, s.race.spaces ?? {});
        track?.revealNow();
        buildPieces(s);
        for (const p of pieces.values()) {
          p.busy = false;
          p.body.scale.setScalar(1);
          p.body.rotation.set(0, 0, 0);
          p.body.position.set(0, 0, 0);
          p.model.rotation.y = faceBase;
        }
        applyStatic(s);
        const cur = s.race.racers.find((r) => r.idx === s.race!.current);
        setActive(s.phase === 'race' && cur && !cur.done ? cur.idx : null);
        if (cur) focusOn(pieces.get(cur.idx)?.root.position ?? new Vector3());
      } else {
        setTrack(TRACK_ORDER[0], {});
      }
    },
    play,
    get view() {
      return camMode;
    },
    setView(m) {
      modeTouched = true;
      camMode = m;
      userZoom = 1;
      pan.set(0, 0, 0);
    },
    setSelectable(idxs) {
      selectable = idxs;
      if (!idxs) setActive(active);
    },
    setSelectableSpaces(sps) {
      if (track) for (const [sp, c] of tileFlashBase) (track.tiles[sp].material as MeshToonMaterial).color.copy(c);
      tileFlashBase = new Map();
      selectableSpaces = sps;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      tray.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerup', onPUp);
      window.removeEventListener('pointercancel', onPUp);
      renderer.dispose();
      renderer.domElement.remove();
      container.querySelectorAll('.pop-word').forEach((x) => x.remove());
    },
  };
  return api;
}
