import { describe, it, expect } from 'vitest';
import { createRig, lerpAngle, smoothDamp } from './rig.js';

const fakeCam = () => ({ position: { x: 0, y: 1.6, z: 5, set(x, y, z) { this.x = x; this.y = y; this.z = z; } } });
const fakeControls = (yaw = 0, pitch = 0) => ({ yaw, pitch, pose() { return { yaw: this.yaw, pitch: this.pitch }; }, setLook(y, p) { this.yaw = y; this.pitch = p; } });
const run = (rig, t0, frames, dtMs = 16.6667) => { let t = t0, last = true; for (let i = 0; i < frames && last; i++) { t += dtMs; last = rig.update(t); } return { t, active: last }; };

describe('lerpAngle', () => { it('pelo caminho curto', () => { expect(lerpAngle(3.0, -3.0, 0.5)).toBeCloseTo(Math.PI, 1); expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5); }); });

describe('smoothDamp', () => {
  it('converge ao alvo sem ultrapassá-lo (amortecimento crítico)', () => {
    let x = 0, vel = 0, max = 0;
    for (let i = 0; i < 300; i++) { [x, vel] = smoothDamp(x, 1, vel, 0.12, 1 / 60); max = Math.max(max, x); }
    expect(max).toBeLessThanOrEqual(1 + 1e-9); expect(x).toBeCloseTo(1, 4);
  });
  it('é independente do FPS (mesmo tempo, mesmo resultado)', () => {
    const f = (dt, n) => { let x = 0, v = 0; for (let i = 0; i < n; i++) [x, v] = smoothDamp(x, 1, v, 0.15, dt); return x; };
    expect(f(1 / 30, 15)).toBeCloseTo(f(1 / 120, 60), 2);
  });
});

describe('createRig (câmera suave)', () => {
  it('voa até a pose, fica parada exatamente nela e então fica ociosa', () => {
    const cam = fakeCam(), ctl = fakeControls(), rig = createRig(cam, ctl);
    rig.flyTo({ x: 1, y: 1.2, z: 2, yaw: 0.4, pitch: -0.1 }, 450, 0);
    expect(rig.active).toBe(true);
    const r = run(rig, 0, 400);
    expect(r.active).toBe(false); expect(rig.active).toBe(false);
    expect(cam.position).toMatchObject({ x: 1, y: 1.2, z: 2 }); expect(ctl.yaw).toBeCloseTo(0.4, 6); expect(ctl.pitch).toBeCloseTo(-0.1, 6);
    expect(r.t).toBeLessThan(1500);                                  // não demora uma eternidade para assentar
  });
  it('mudar o alvo no meio do voo NÃO para nem recomeça: a velocidade continua (sem engasgo)', () => {
    const cam = fakeCam(), ctl = fakeControls(), rig = createRig(cam, ctl);
    rig.flyTo({ x: 1, y: 1.6, z: 5, yaw: 0, pitch: 0 }, 400, 0);
    let t = 0; for (let i = 0; i < 8; i++) { t += 16.67; rig.update(t); }
    const before = [], samples = 4;
    for (let i = 0; i < samples; i++) { const x0 = cam.position.x; t += 16.67; rig.update(t); before.push(cam.position.x - x0); }
    rig.flyTo({ x: 1.4, y: 1.6, z: 5, yaw: 0, pitch: 0 }, 400, t);          // novo card, mesma direção
    const x1 = cam.position.x; t += 16.67; rig.update(t);
    const step = cam.position.x - x1;
    expect(step).toBeGreaterThan(before[samples - 1] * 0.8);                  // não caiu para ~0 como numa animação que recomeça
  });
  it('card vizinho em direção oposta: freia com continuidade (sem inverter de repente) e depois chega ao novo alvo', () => {
    const cam = fakeCam(), ctl = fakeControls(), rig = createRig(cam, ctl);
    rig.flyTo({ x: 0.4, y: 1.6, z: 5, yaw: 0, pitch: 0 }, 340, 0);           // ~2 colunas de distância
    let t = 0, prev = cam.position.x, lastStep = 0;
    for (let i = 0; i < 6; i++) { t += 16.67; rig.update(t); lastStep = cam.position.x - prev; prev = cam.position.x; }
    rig.flyTo({ x: 0.2, y: 1.6, z: 5, yaw: 0, pitch: 0 }, 340, t);            // jogador voltou 1 coluna
    t += 16.67; rig.update(t); const firstAfter = cam.position.x - prev;
    expect(lastStep).toBeGreaterThan(0.005);
    expect(firstAfter).toBeGreaterThan(-lastStep * 0.5); expect(firstAfter).toBeLessThan(lastStep * 1.1);    // variação contínua da velocidade
    for (let i = 0; i < 200; i++) { t += 16.67; rig.update(t); }
    expect(cam.position.x).toBeCloseTo(0.2, 3);
  });
  it('gira pelo caminho mais curto (sem dar a volta inteira)', () => {
    const cam = fakeCam(), ctl = fakeControls(3.0), rig = createRig(cam, ctl);
    rig.flyTo({ x: 0, y: 1.6, z: 5, yaw: -3.0, pitch: 0 }, 400, 0);
    let t = 0, maxAbs = 0; for (let i = 0; i < 200 && rig.active; i++) { t += 16.67; rig.update(t); maxAbs = Math.max(maxAbs, Math.abs(ctl.yaw - 3.0)); }
    expect(maxAbs).toBeLessThan(0.5);
  });
  it('ocioso se nunca foi chamado', () => { expect(createRig(fakeCam(), fakeControls()).update(0)).toBe(false); });
});
