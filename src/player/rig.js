// Câmera guiada: voa suavemente para uma pose (posição + olhar). Usada nos modos selecionar/pagar.
const ease = (k) => k * k * (3 - 2 * k);
export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

export function createRig(camera, controls) {
  let from = null, to = null, t0 = 0, dur = 450;
  return {
    get active() { return !!to; },
    flyTo(pose, ms = 450, now = performance.now()) {
      const { yaw, pitch } = controls.pose();
      from = { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw, pitch };
      to = pose; t0 = now; dur = ms;
    },
    // retorna true enquanto ainda está voando
    update(now = performance.now()) {
      if (!to) return false;
      const k = Math.min(1, (now - t0) / dur), e = ease(k);
      camera.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, from.z + (to.z - from.z) * e);
      controls.setLook(lerpAngle(from.yaw, to.yaw, e), from.pitch + (to.pitch - from.pitch) * e);
      if (k >= 1) { to = null; return false; }
      return true;
    }
  };
}
