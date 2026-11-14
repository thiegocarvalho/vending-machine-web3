// Câmera guiada: segue uma pose-alvo (posição + olhar) com amortecimento crítico ("smooth damp"). Diferente de uma animação de duração
// fixa, mudar o alvo no meio do caminho mantém a velocidade — sem parar e recomeçar a cada card (era isso que dava o "engasgo").
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}
const wrapPi = (d) => { d = ((d + Math.PI) % (2 * Math.PI)); if (d < 0) d += 2 * Math.PI; return d - Math.PI; };

// Amortecimento crítico estável (mesma fórmula do SmoothDamp): retorna [novoValor, novaVelocidade]. Sem overshoot.
export function smoothDamp(cur, target, vel, smoothTime, dt) {
  const st = Math.max(1e-4, smoothTime), omega = 2 / st, x = omega * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target, temp = (vel + omega * change) * dt;
  let nv = (vel - omega * temp) * e, out = target + (change + temp) * e;
  if ((target - cur > 0) === (out > target)) { out = target; nv = dt > 0 ? (out - target) / dt : 0; }     // evita passar do alvo
  return [out, nv];
}

const AXES = ['x', 'y', 'z', 'yaw', 'pitch'];
const EPS = { x: 0.0015, y: 0.0015, z: 0.0015, yaw: 0.0008, pitch: 0.0008 };

export function createRig(camera, controls) {
  const s = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, v = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  let target = null, smooth = 0.15, lastT = null;
  return {
    get active() { return !!target; },
    // ms = duração aproximada do movimento (o amortecimento assenta em ~3,4 × o tempo de suavização)
    flyTo(pose, ms = 450, now = performance.now()) {
      const wasActive = !!target;
      const { yaw, pitch } = controls.pose();
      Object.assign(s, { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw, pitch });
      if (!wasActive) for (const k of AXES) v[k] = 0;                    // continuidade: se já estava voando, mantém a velocidade
      target = { ...pose, yaw: s.yaw + wrapPi(pose.yaw - s.yaw) };         // gira pelo caminho mais curto
      smooth = clamp(ms / 1000 / 3.4, 0.05, 0.4); lastT = now;
    },
    // retorna true enquanto ainda está voando
    update(now = performance.now()) {
      if (!target) return false;
      const dt = clamp((now - lastT) / 1000, 0, 0.05); lastT = now;
      let settled = true;
      for (const k of AXES) {
        [s[k], v[k]] = smoothDamp(s[k], target[k], v[k], smooth, dt);
        if (Math.abs(target[k] - s[k]) > EPS[k] || Math.abs(v[k]) > EPS[k] * 4) settled = false;
      }
      if (settled) { for (const k of AXES) { s[k] = target[k]; v[k] = 0; } }
      camera.position.set(s.x, s.y, s.z); controls.setLook(s.yaw, s.pitch);
      if (settled) { target = null; return false; }
      return true;
    }
  };
}
