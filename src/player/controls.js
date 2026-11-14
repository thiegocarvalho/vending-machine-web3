import { clampToWall, collideCircle } from './movement.js';
import { config } from '../config.js';

const EYE = 1.6, SPEED = 2.4, BODY_RADIUS = 0.3, MOUSE_SENS = 0.0022;

export function createControls(camera, dom, { colliders = [] } = {}) {
  const keys = new Set();
  let yaw = 0, pitch = 0, enabled = true;
  const joy = { x: 0, y: 0 };
  camera.position.set(0, EYE, 5);
  camera.rotation.order = 'YXZ';

  const look = (dx, dy) => { yaw -= dx * MOUSE_SENS; pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * MOUSE_SENS)); };
  const locked = () => document.pointerLockElement === dom;
  // O navegador só concede captura do mouse após um gesto do usuário (clique ou tecla): pedimos nos dois.
  function requestLock() {
    if (!enabled || locked() || !dom.requestPointerLock) return;
    try { const p = dom.requestPointerLock(); p?.catch?.(() => {}); } catch { /* sem captura: o olhar por movimento ainda funciona */ }
  }
  function releaseLock() { if (locked()) document.exitPointerLock?.(); }

  window.addEventListener('keydown', e => { if (!enabled) return; keys.add(e.code); if (/^Key[WASD]$/.test(e.code)) requestLock(); });
  window.addEventListener('keyup', e => keys.delete(e.code));

  // Mouse: o olhar segue o movimento SEM precisar clicar (touchpad); a captura só tira o limite das bordas da tela.
  window.addEventListener('mousemove', e => {
    if (!enabled || (e.movementX === 0 && e.movementY === 0)) return;
    if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;       // salto espúrio (bug conhecido de captura)
    look(e.movementX, e.movementY);
  });
  dom.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') requestLock(); });

  // Toque: arrastar para olhar.
  let drag = null;
  dom.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && e.target === dom) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; });
  window.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id || !enabled) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    look(dx * 1.8, dy * 1.8);
  });
  window.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) drag = null; });

  function update(dt) {
    if (enabled) {
      let f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) + -joy.y;
      let s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + joy.x;
      const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const nx = camera.position.x + (-sin * f + cos * s) * SPEED * dt;
      const nz = camera.position.z + (-cos * f - sin * s) * SPEED * dt;
      const p = collideCircle(...Object.values(clampToWall(nx, nz, config.wallRadius)), BODY_RADIUS, colliders);
      camera.position.set(p.x, EYE, p.z);
    }
    camera.rotation.set(pitch, yaw, 0);
  }
  return {
    update, requestLock, releaseLock, pose: () => ({ yaw, pitch }),
    isActive: () => keys.size > 0 || joy.x !== 0 || joy.y !== 0 || !!drag,
    setEnabled(v) { enabled = v; if (!v) { keys.clear(); joy.x = joy.y = 0; drag = null; releaseLock(); } },
    get enabled() { return enabled; },
    setJoystick(x, y) { joy.x = x; joy.y = y; }, setLook(y, p) { yaw = y; pitch = p; },
    get moved() { return drag?.moved ?? 0; }
  };
}
