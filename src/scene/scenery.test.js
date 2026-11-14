import { describe, it, expect, vi } from 'vitest';
import { paintSky } from './scenery.js';

describe('paintSky', () => {
  it('paints the sky layers (gradient, clouds, stars, mountains, trees) on the canvas context', () => {
    const grad = { addColorStop: vi.fn() };
    const ctx = new Proxy({ createLinearGradient: () => grad }, {
      get: (t, k) => (k in t ? t[k] : (t[k] = vi.fn())), set: () => true
    });
    paintSky(ctx, 512, 128, () => 0.5);
    expect(grad.addColorStop).toHaveBeenCalledTimes(3);
    expect(ctx.ellipse).toHaveBeenCalledTimes(40);
    expect(ctx.fillRect).toHaveBeenCalledTimes(31);
  });
});
