import { describe, it, expect } from 'vitest';
import { bakeBox, createBatch } from './baked.js';

describe('baked lighting', () => {
  it('shades faces by orientation: front brighter than back', () => {
    const g = bakeBox(1, 1, 1, 0xffffff, 1);
    const n = g.attributes.normal, c = g.attributes.color;
    let front = 0, back = 0;
    for (let i = 0; i < n.count; i++) { if (n.getZ(i) > 0.5) front = c.getX(i); if (n.getZ(i) < -0.5) back = c.getX(i); }
    expect(front).toBeGreaterThan(back);
  });
  it('merges many boxes into a single mesh', () => {
    const b = createBatch();
    for (let i = 0; i < 50; i++) b.add(0.1, 1, 0.1, 0x445566, 1, i, 0, 0);
    const mesh = b.build();
    expect(mesh.geometry.attributes.position.count).toBe(50 * 24);
  });
});
