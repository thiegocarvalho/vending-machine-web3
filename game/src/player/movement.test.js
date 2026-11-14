import { describe, it, expect } from 'vitest';
import { clampToWall } from './movement.js';

describe('clampToWall', () => {
  it('keeps points inside', () => { expect(clampToWall(3, 4, 7)).toEqual({ x: 3, z: 4 }); });
  it('projects outside points onto the circle', () => {
    expect(clampToWall(14, 0, 7)).toEqual({ x: 7, z: 0 });
    const p = clampToWall(0, -10, 7); expect(p.x).toBeCloseTo(0); expect(p.z).toBeCloseTo(-7);
  });
  it('handles origin and custom center', () => {
    expect(clampToWall(0, 0, 7)).toEqual({ x: 0, z: 0 });
    const p = clampToWall(20, 5, 7, { x: 5, z: 5 }); expect(p.x).toBeCloseTo(12); expect(p.z).toBeCloseTo(5);
  });
});

import { collideCircle } from './movement.js';
describe('collideCircle', () => {
  const wall = { minX: -5, maxX: 5, minZ: -1, maxZ: -0.5 };
  it('leaves free positions alone', () => { expect(collideCircle(0, 2, 0.3, [wall])).toEqual({ x: 0, z: 2 }); });
  it('stops the player in front of a wall', () => {
    const p = collideCircle(0, -0.4, 0.3, [wall]);
    expect(p.z).toBeCloseTo(-0.2); expect(p.x).toBeCloseTo(0);
  });
  it('slides along the wall (keeps lateral movement)', () => {
    const p = collideCircle(3, -0.4, 0.3, [wall]);
    expect(p.x).toBeCloseTo(3); expect(p.z).toBeCloseTo(-0.2);
  });
  it('pushes out from inside a box and around corners', () => {
    const p = collideCircle(0, -0.7, 0.3, [wall]);
    expect(p.z).toBeGreaterThanOrEqual(-0.2 - 1e-6);
    const c = collideCircle(5.1, -0.4, 0.3, [wall]);
    expect(Math.hypot(c.x - 5, c.z - -0.5)).toBeGreaterThanOrEqual(0.3 - 1e-6);
  });
  it('never ends inside any of several boxes', () => {
    const boxes = [wall, { minX: 4.5, maxX: 5, minZ: -0.5, maxZ: 4 }];
    for (const [x, z] of [[4.7, 1], [4.6, -0.3], [4.9, -0.45]]) {
      const p = collideCircle(x, z, 0.3, boxes);
      for (const b of boxes) {
        const cx = Math.max(b.minX, Math.min(p.x, b.maxX)), cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        expect(Math.hypot(p.x - cx, p.z - cz)).toBeGreaterThanOrEqual(0.3 - 1e-3);
      }
    }
  });
});
