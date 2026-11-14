import { clampToWall } from './movement.js';
import { config } from '../config.js';

const EYE = 1.6, SPEED = 2.4;

export function createControls(camera, dom) {
  const keys = new Set();
  let yaw = 0, pitch = 0;
  const joy = { x: 0, y: 0 };
  camera.position.set(0, EYE, 5);
  camera.rotation.order = 'YXZ';

  window.addEventListener('keydown', e => keys.add(e.code));
  window.addEventListener('keyup', e => keys.delete(e.code));

  let drag = null;
  dom.addEventListener('pointerdown', e => { if (e.target === dom) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; });
  window.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * 0.004));
  });
  window.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) drag = null; });

  function update(dt) {
    let f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) + -joy.y;
    let s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + joy.x;
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const nx = camera.position.x + (-sin * f + cos * s) * SPEED * dt;
    const nz = camera.position.z + (-cos * f - sin * s) * SPEED * dt;
    const p = clampToWall(nx, nz, config.wallRadius);
    camera.position.set(p.x, EYE, p.z);
    camera.rotation.set(pitch, yaw, 0);
  }
  const isActive = () => keys.size > 0 || joy.x !== 0 || joy.y !== 0 || !!drag;
  return { update, isActive, setJoystick(x, y) { joy.x = x; joy.y = y; }, setLook(y, p) { yaw = y; pitch = p; }, get moved() { return drag?.moved ?? 0; } };
}
