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

// Ângulo (rad) entre para onde se olha e o alvo; Infinity se estiver longe demais.
export function targetAngle(cam, yaw, pitch, target, maxDist = 3.8) {
  const dx = target.x - cam.x, dy = target.y - cam.y, dz = target.z - cam.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > maxDist) return Infinity;
  if (dist < 1e-6) return 0;
  const f = forwardVector(yaw, pitch);
  return Math.acos(Math.max(-1, Math.min(1, (f.x * dx + f.y * dy + f.z * dz) / dist)));
}

export function facingTarget(cam, yaw, pitch, target, { maxDist = 3.8, maxAngleDeg = 35 } = {}) {
  return targetAngle(cam, yaw, pitch, target, maxDist) <= (maxAngleDeg * Math.PI) / 180;
}

// Qual objeto interativo está sob a mira (o mais centralizado entre os que passam no teste)? null se nenhum.
export function pickInteractable(cam, yaw, pitch, targets) {
  let best = null, bestAngle = Infinity;
  for (const t of targets) {
    const a = targetAngle(cam, yaw, pitch, t.pos, t.maxDist ?? 3.8);
    if (a <= ((t.maxAngleDeg ?? 35) * Math.PI) / 180 && a < bestAngle) { best = t.kind; bestAngle = a; }
  }
  return best;
}
