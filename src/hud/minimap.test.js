import { describe, it, expect } from 'vitest';
import { renderMinimap } from './minimap.js';

describe('renderMinimap', () => {
  it('is 5x6 with only the selected cell marked', () => {
    const m = renderMinimap(1);
    expect(m).toHaveLength(5); expect(m.every(r => r.length === 6)).toBe(true);
    expect(m[0][0]).toBe(true); expect(m.flat().filter(Boolean)).toHaveLength(1);
    const z = renderMinimap(30); expect(z[4][5]).toBe(true); expect(z.flat().filter(Boolean)).toHaveLength(1);
  });
});
