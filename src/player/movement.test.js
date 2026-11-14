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
