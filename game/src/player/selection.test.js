import { describe, it, expect, vi } from 'vitest';
import { createSelection } from './selection.js';

describe('selection', () => {
  it('starts at 1 and moves with events', () => {
    const s = createSelection(); const cb = vi.fn(); s.onChange(cb);
    expect(s.id).toBe(1);
    expect(s.move('right')).toBe(2); expect(cb).toHaveBeenCalledWith(2);
  });
  it('does not fire when clamped', () => {
    const s = createSelection(); const cb = vi.fn(); s.onChange(cb);
    s.move('up'); expect(cb).not.toHaveBeenCalled();
  });
  it('set validates range', () => {
    const s = createSelection(); expect(() => s.set(31)).toThrow(RangeError);
    s.set(30); expect(s.id).toBe(30);
  });
});
