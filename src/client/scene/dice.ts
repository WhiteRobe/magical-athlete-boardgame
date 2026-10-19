import { Mesh, BoxGeometry, CanvasTexture, MeshToonMaterial, Quaternion, Vector3, SRGBColorSpace, Group, type Object3D } from 'three';
import { anim, ease, lerp, outlineMat } from './fx';
import { sfx } from '../audio';
import { contrastOn } from '../art/palette';

// 骰子：服务端决定点数，客户端用「解析抛物线弹跳 + 衰减自旋」播放，最终姿态精确落在指定面。
const FACE_VALUES = [3, 4, 1, 6, 2, 5]; // BoxGeometry 材质顺序 +x -x +y -y +z -z
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};

const texCache = new Map<string, CanvasTexture>();
function faceTex(v: number, color: string) {
  const key = `${color}|${v}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const pip = contrastOn(color);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = color;
  x.fillRect(0, 0, 128, 128);
  // 内凹面板 + 高光，让骰子有圆角厚度感
  x.fillStyle = 'rgba(255,255,255,.18)';
  x.fillRect(10, 10, 108, 54);
  x.strokeStyle = 'rgba(43,27,77,.28)';
  x.lineWidth = 8;
  x.beginPath();
  x.roundRect(8, 8, 112, 112, 22);
  x.stroke();
  for (const [px, py] of PIPS[v]) {
    const r = v === 1 ? 19 : 12.5;
    x.fillStyle = pip;
    x.beginPath();
    x.arc(px * 128, py * 128, r, 0, Math.PI * 2);
    x.fill();
    // 点子外圈，保证在任意底色上都清楚
    x.lineWidth = 3;
    x.strokeStyle = pip === '#ffffff' ? 'rgba(43,27,77,.55)' : 'rgba(255,255,255,.5)';
    x.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

const UP_ROT: Record<number, [Vector3, number]> = {
  1: [new Vector3(1, 0, 0), 0],
  6: [new Vector3(1, 0, 0), Math.PI],
  2: [new Vector3(1, 0, 0), -Math.PI / 2],
  5: [new Vector3(1, 0, 0), Math.PI / 2],
  3: [new Vector3(0, 0, 1), Math.PI / 2],
  4: [new Vector3(0, 0, 1), -Math.PI / 2],
};

export class Dice {
  mesh: Mesh;
  root = new Group();
  /** 基础缩放（骰盘里放大） */
  size = 1;
  constructor(scene: Object3D, color = '#ffffff') {
    const geo = new BoxGeometry(0.5, 0.5, 0.5);
    this.mesh = new Mesh(geo, FACE_VALUES.map((v) => new MeshToonMaterial({ map: faceTex(v, color) })));
    this.color = color;
    this.mesh.castShadow = true;
    const o = new Mesh(geo, outlineMat);
    o.scale.setScalar(1.02);
    this.mesh.add(o);
    this.root.add(this.mesh);
    this.root.visible = false;
    scene.add(this.root);
  }

  /** 从 from 抛到 to，最终 value 朝上。返回落地 Promise。 */
  private color = '';
  setColor(color: string) {
    if (color === this.color) return;
    this.color = color;
    const mats = this.mesh.material as MeshToonMaterial[];
    FACE_VALUES.forEach((v, i) => {
      mats[i].map = faceTex(v, color);
      mats[i].needsUpdate = true;
    });
  }

  async throw(value: number, from: Vector3, to: Vector3, dur: number, hScale = 1) {
    const [axis, ang] = UP_ROT[value];
    const final = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.random() * Math.PI * 2).multiply(new Quaternion().setFromAxisAngle(axis, ang));
    const spinAxis = new Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize();
    const spins = Math.PI * 2 * (2.2 + Math.random());
    const q = new Quaternion();
    const tmp = new Quaternion();
    this.root.visible = true;
    this.root.scale.setScalar(this.size);
    const half = 0.25;
    const bounces = [0, 0.55, 0.8, 1]; // 弹跳分段
    const heights = [2.6 * hScale, 0.7 * hScale, 0.22 * hScale];
    let lastSeg = -1;
    sfx('shake');
    await anim(dur, (k) => {
      const e = ease.outCubic(k);
      this.root.position.set(lerp(from.x, to.x, e), 0, lerp(from.z, to.z, e));
      let seg = 0;
      while (seg < 2 && k > bounces[seg + 1]) seg++;
      const s0 = bounces[seg], s1 = bounces[seg + 1];
      const u = (k - s0) / (s1 - s0);
      const h = seg === 0 ? lerp(from.y, 0, u) + heights[0] * Math.sin(u * Math.PI) * (1 - u) : heights[seg] * Math.sin(u * Math.PI);
      this.root.position.y = half + Math.max(0, h);
      if (seg !== lastSeg && seg > 0) sfx('diceHit', seg === 1 ? 1 : 0.6);
      lastSeg = seg;
      const rem = 1 - ease.outCubic(Math.min(1, k * 1.08));
      tmp.setFromAxisAngle(spinAxis, spins * rem);
      q.copy(tmp).multiply(final);
      this.mesh.quaternion.copy(q);
    });
    sfx('diceHit', 0.4);
    this.mesh.quaternion.copy(final);
    this.root.position.set(to.x, half, to.z);
  }

  async hide(dur = 250) {
    await anim(dur, (k) => this.root.scale.setScalar(this.size * (1 - ease.inBack(k) * 0.999)));
    this.root.visible = false;
  }
}
