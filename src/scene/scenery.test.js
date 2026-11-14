import { describe, it, expect } from 'vitest';
import { SCENERY_COLLIDERS, paintBricks, paintPaving, paintNeon, paintUfoSign, paintPoster, paintRoad } from './scenery.js';
import { MACHINE_COLLIDER } from './machine.js';
import { collideCircle } from '../player/movement.js';

const ALL = [...SCENERY_COLLIDERS, MACHINE_COLLIDER];

describe('paintBricks', () => {
  it('paints mortar plus staggered bricks (4 rows x 5 incl. offset bleed)', () => {
    const calls = []; const ctx = { fillRect: (...a) => calls.push(a), set fillStyle(v) {} };
    paintBricks(ctx, 256, 128, () => 0.5);
    expect(calls[0]).toEqual([0, 0, 256, 128]);       // argamassa
    expect(calls.length).toBe(1 + 4 * 5);
  });
});

describe('painted textures', () => {
  const ctx = () => new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  it('all painters run on a canvas context without throwing', () => {
    expect(() => paintPaving(ctx(), 128, 128, () => 0.5)).not.toThrow();
    expect(() => paintNeon(ctx(), 512, 210)).not.toThrow();
    expect(() => paintRoad(ctx(), 4096, 512, () => 0.5)).not.toThrow();
    expect(() => paintUfoSign(ctx(), 256, 230)).not.toThrow();
    let qrArgs = null;
    expect(() => paintPoster(ctx(), 512, 760, (...a) => { qrArgs = a; }, () => 0.5)).not.toThrow();
    expect(qrArgs[1]).toMatch(/^https:\/\/.*faucet.*sepolia/);       // o QR aponta para o faucet da Sepolia
  });
});

describe('poster layout', () => {
  // grava as chamadas de desenho e confere que o QR cabe entre a régua e a faixa inferior (nada cortado)
  it('places the QR box fully above the footer band and inside the sheet', () => {
    const calls = []; let qrBox = null;
    const g = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? (txt) => ({ width: txt.length * 40 }) : (...a) => { calls.push([k, ...a]); }), set: () => true });
    paintPoster(g, 512, 760, (ctx, url, x, y, size) => { qrBox = { x, y, size }; return size - 6; }, () => 0.5);
    expect(qrBox.x).toBeGreaterThanOrEqual(0);
    expect(qrBox.x + qrBox.size + 12 + 12).toBeLessThanOrEqual(512);          // incluindo sombra dura
    expect(qrBox.y + qrBox.size + 12 + 12).toBeLessThanOrEqual(760 - 92);     // acima da faixa inferior (92 px)
  });
});

describe('physical scenery', () => {
  it('has the brick wall behind the machine (to the horizon) and a solid lamp post, no side walls', () => {
    expect(SCENERY_COLLIDERS).toHaveLength(3);                        // muro, poste de luz e bloco da placa
    const post = SCENERY_COLLIDERS[1];
    expect(post.maxX - post.minX).toBeLessThan(0.5);
    expect(post.minX).toBeGreaterThan(MACHINE_COLLIDER.maxX);
    expect(SCENERY_COLLIDERS[0].maxX - SCENERY_COLLIDERS[0].minX).toBeGreaterThanOrEqual(60);
    const back = SCENERY_COLLIDERS[0];
    expect(back.maxZ).toBeLessThanOrEqual(MACHINE_COLLIDER.minZ + 0.05);
  });
  it('the player cannot walk through the machine from the front, sides or back', () => {
    for (const [x, z] of [[0, 0.4], [0.9, 0.2], [-0.9, 0.2], [0, -0.3], [1.0, 0]]) {
      const p = collideCircle(x, z, 0.3, ALL);
      const m = MACHINE_COLLIDER;
      const cx = Math.max(m.minX, Math.min(p.x, m.maxX)), cz = Math.max(m.minZ, Math.min(p.z, m.maxZ));
      expect(Math.hypot(p.x - cx, p.z - cz)).toBeGreaterThanOrEqual(0.3 - 1e-3);
    }
  });
  const walk = (x, z, dx, dz, steps) => {
    for (let i = 0; i < steps; i++) ({ x, z } = collideCircle(x + dx, z + dz, 0.3, ALL));
    return { x, z };
  };
  it('the spawn point (0, 5) is free', () => {
    expect(collideCircle(0, 5, 0.3, ALL)).toEqual({ x: 0, z: 5 });
  });
  it('walking straight at the back wall stops in front of it', () => {
    const p = walk(2.5, 3, 0, -0.05, 120);
    expect(p.z).toBeCloseTo(SCENERY_COLLIDERS[0].maxZ + 0.3, 2);
  });
  it('cannot walk through the lamp post', () => {
    const post = SCENERY_COLLIDERS[1], cx = (post.minX + post.maxX) / 2;
    const p = walk(cx, 4, 0, -0.05, 120);
    expect(p.z).toBeCloseTo(post.maxZ + 0.3, 2);
  });
  it('walking at the machine front stops in front of it', () => {
    const p = walk(0, 3, 0, -0.05, 100);
    expect(p.z).toBeCloseTo(MACHINE_COLLIDER.maxZ + 0.3, 2);
  });
});
