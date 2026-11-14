// Modos do jogador e detecção de "olhando para a máquina".
export function createModes() {
  let mode = 'walk'; const cbs = [];
  const go = (m) => { if (m !== mode) { mode = m; cbs.forEach((cb) => cb(mode)); } };
  return {
    get mode() { return mode; },
    interact() { if (mode === 'walk') go('select'); },
    confirm() { if (mode === 'select') go('pay'); },
    back() { if (mode === 'pay') go('select'); else if (mode === 'select') go('walk'); },
    onChange(cb) { cbs.push(cb); }
  };
}

export function forwardVector(yaw, pitch) {
  return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
}

export function facingTarget(cam, yaw, pitch, target, { maxDist = 3.8, maxAngleDeg = 35 } = {}) {
  const dx = target.x - cam.x, dy = target.y - cam.y, dz = target.z - cam.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > maxDist) return false;
  if (dist < 1e-6) return true;
  const f = forwardVector(yaw, pitch);
  const cos = (f.x * dx + f.y * dy + f.z * dz) / dist;
  return cos >= Math.cos((maxAngleDeg * Math.PI) / 180);
}
