import { WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Mesh, CircleGeometry, MeshBasicMaterial } from 'three';
import { CHAR_IDS } from '../../shared/types';
import { buildPiece } from '../scene/pieces';

/** 开发用：36 个棋子一览 */
export function createGallery(el: HTMLElement, pitch = 0.35) {
  const r = new WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  el.appendChild(r.domElement);
  const s = new Scene();
  s.add(new HemisphereLight('#fff6e0', '#6a4fa0', 1.6));
  const d = new DirectionalLight('#fff', 2.2);
  d.position.set(-6, 14, 9);
  s.add(d);
  const cam = new PerspectiveCamera(30, 1, 0.1, 100);
  CHAR_IDS.forEach((id, i) => {
    const g = buildPiece(id);
    g.scale.setScalar(1.6);
    g.position.set((i % 9) * 1.5 - 6, 0, Math.floor(i / 9) * 1.6 - 2.4);
    const base = new Mesh(new CircleGeometry(0.4, 18), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4 }));
    base.rotation.x = -Math.PI / 2;
    base.position.copy(g.position);
    s.add(g, base);
  });
  const fit = () => {
    const w = el.clientWidth, h = el.clientHeight;
    r.setSize(w, h);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    cam.position.set(0, Math.sin(pitch) * 18, Math.cos(pitch) * 18);
    cam.lookAt(0, 0.4, 0);
  };
  fit();
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    r.render(s, cam);
  };
  loop();
  return () => cancelAnimationFrame(raf);
}
