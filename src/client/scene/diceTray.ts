import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Mesh, Vector3, Group, BoxGeometry,
  Shape, ExtrudeGeometry, PlaneGeometry, CanvasTexture, SRGBColorSpace, MeshToonMaterial,
} from 'three';
import { Dice } from './dice';
import { toon, outlineMat, tick, anim, ease } from './fx';

/**
 * 独立骰盘：HUD 层的小 three 场景（木质托盘 + 毛毡底），永远在棋盘之上，不会被棋子或镜头遮挡。
 * 骰子颜色 = 投掷玩家主色；决斗时两颗并排。
 */
export interface DiceTray {
  roll(dice: { value: number; color: string }[], speed: number): Promise<void>;
  dispose(): void;
}

function roundRect(w: number, h: number, r: number) {
  const s = new Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function createDiceTray(container: HTMLElement): DiceTray {
  const wrap = document.createElement('div');
  wrap.className = 'dice-tray';
  container.appendChild(wrap);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  wrap.appendChild(renderer.domElement);
  const scene = new Scene();
  scene.add(new HemisphereLight('#fff6e0', '#6a4fa0', 1.7));
  const sun = new DirectionalLight('#ffffff', 2);
  sun.position.set(-2, 6, 4);
  scene.add(sun);
  const camera = new PerspectiveCamera(30, 1.5, 0.1, 50);
  camera.position.set(0, 5.2, 3.4);
  camera.lookAt(0, 0, 0.1);

  // 托盘：木框 + 毛毡底
  const W = 2.5, H = 1.6;
  const tray = new Group();
  const frameShape = roundRect(W + 0.3, H + 0.3, 0.35);
  frameShape.holes.push(roundRect(W, H, 0.25));
  const frameGeo = new ExtrudeGeometry(frameShape, { depth: 0.28, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  const frame = new Mesh(frameGeo, toon('#c98a4b'));
  frame.rotation.x = -Math.PI / 2;
  frame.add(new Mesh(frameGeo, outlineMat));
  tray.add(frame);
  const felt = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#5b3cc4';
    x.fillRect(0, 0, 128, 128);
    x.globalAlpha = 0.18;
    for (let i = 0; i < 400; i++) {
      x.fillStyle = i % 2 ? '#ffffff' : '#000000';
      x.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
    }
    x.globalAlpha = 0.5;
    x.strokeStyle = '#ffd23f';
    x.lineWidth = 2;
    x.setLineDash([5, 6]);
    x.strokeRect(10, 10, 108, 108);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  })();
  const floor = new Mesh(new PlaneGeometry(W + 0.1, H + 0.1), new MeshToonMaterial({ map: felt, gradientMap: (toon('#fff') as MeshToonMaterial).gradientMap }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  tray.add(floor);
  // 底座阴影
  const base = new Mesh(new BoxGeometry(W + 0.4, 0.1, H + 0.4), toon('#8a5a3b'));
  base.position.y = -0.06;
  tray.add(base);
  scene.add(tray);

  const dice = [new Dice(scene), new Dice(scene)];
  dice.forEach((d) => (d.size = 1.5));

  let raf = 0;
  let running = false;
  let stopAt = 0;
  function loop(t: number) {
    tick(t);
    renderer.render(scene, camera);
    if (t < stopAt || running) raf = requestAnimationFrame(loop);
    else raf = 0;
  }
  function kick(ms: number) {
    stopAt = Math.max(stopAt, performance.now() + ms);
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    kick(50);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(wrap);
  resize();

  return {
    async roll(list, speed) {
      wrap.classList.add('show', 'active');
      running = true;
      kick(100);
      const n = list.length;
      dice.forEach((d, i) => {
        if (i >= n) {
          d.root.visible = false;
          return;
        }
      });
      await Promise.all(
        list.map(async ({ value, color }, i) => {
          const d = dice[i];
          d.setColor(color);
          const tx = n === 1 ? 0 : i === 0 ? -0.55 : 0.55;
          const to = new Vector3(tx, 0, 0.05);
          const from = new Vector3(tx * 0.6 + 0.7, 1.5, 0.5 - i * 0.25);
          await d.throw(value, from, to, 950 / speed, 0.45);
          // 落定后小幅回弹
          await anim(160, (k) => d.root.scale.setScalar(1.5 * (1 + Math.sin(k * Math.PI) * 0.12 * (1 - ease.outCubic(k)))));
        }),
      );
      running = false;
      kick(400);
      wrap.classList.remove('active');
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      wrap.remove();
    },
  };
}
