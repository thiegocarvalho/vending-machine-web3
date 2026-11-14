import { describe, it, expect } from 'vitest';
import { approach } from './spotlight.js';

describe('approach', () => {
  it('moves toward the target without overshooting', () => {
    let v = 0; for (let i = 0; i < 200; i++) v = approach(v, 1, 9, 1 / 60);
    expect(v).toBeGreaterThan(0.99); expect(v).toBeLessThanOrEqual(1);
  });
  it('is frame-rate independent (same time => same result)', () => {
    let a = 0, b = 0;
    for (let i = 0; i < 30; i++) a = approach(a, 1, 9, 1 / 30);
    for (let i = 0; i < 60; i++) b = approach(b, 1, 9, 1 / 60);
    expect(a).toBeCloseTo(b, 6);
  });
  it('stays put when already at the target', () => { expect(approach(0.5, 0.5, 9, 0.016)).toBe(0.5); });
});
