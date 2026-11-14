import { describe, it, expect } from 'vitest';
import { SCENERY_COLLIDERS } from './scenery.js';
import { MACHINE_COLLIDER } from './machine.js';
import { collideCircle } from '../player/movement.js';

const ALL = [...SCENERY_COLLIDERS, MACHINE_COLLIDER];

describe('physical scenery', () => {
  it('has a wall behind the machine and two side walls', () => {
    expect(SCENERY_COLLIDERS).toHaveLength(3);
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
  it('walking at a side wall from inside the nook stops before it', () => {
    const r = walk(4, 2, 0.05, 0, 100);
    expect(r.x).toBeCloseTo(SCENERY_COLLIDERS[2].minX - 0.3, 2);
    const l = walk(-4, 2, -0.05, 0, 100);
    expect(l.x).toBeCloseTo(SCENERY_COLLIDERS[1].maxX + 0.3, 2);
  });
  it('walking at the machine front stops in front of it', () => {
    const p = walk(0, 3, 0, -0.05, 100);
    expect(p.z).toBeCloseTo(MACHINE_COLLIDER.maxZ + 0.3, 2);
  });
});
