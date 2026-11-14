import { describe, it, expect, vi } from 'vitest';
import { pickTier, TIERS, createAdaptiveScale } from './quality.js';

describe('pickTier', () => {
  it('low for little memory or few cores', () => {
    expect(pickTier({ deviceMemory: 2, hardwareConcurrency: 8 })).toBe('low');
    expect(pickTier({ deviceMemory: 8, hardwareConcurrency: 2 })).toBe('low');
  });
  it('high for strong desktop-class devices', () => {
    expect(pickTier({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe('high');
  });
  it('medium when unknown (Safari/Firefox hide deviceMemory)', () => {
    expect(pickTier({ hardwareConcurrency: 6 })).toBe('medium');
    expect(pickTier({})).toBe('medium');
  });
  it('economia de dados força o nível baixo e celular nunca passa de médio', () => {
    expect(pickTier({ saveData: true, deviceMemory: 8, hardwareConcurrency: 8 })).toBe('low');
    expect(pickTier({ coarse: true, deviceMemory: 8, hardwareConcurrency: 8 })).toBe('medium');
  });
  it('níveis mais baixos usam menos memória de textura e menos FPS máximo', () => {
    expect(TIERS.low.roadPx).toBeLessThan(TIERS.high.roadPx);
    expect(TIERS.low.maxFps).toBeLessThanOrEqual(TIERS.medium.maxFps);
    expect(TIERS.low.mip).toBe(false);
  });
  it('lower tiers render fewer pixels and use smaller textures', () => {
    expect(TIERS.low.dprCap).toBeLessThan(TIERS.high.dprCap);
    expect(TIERS.low.antialias).toBe(false);
    expect(TIERS.low.texW).toBeLessThan(TIERS.high.texW);
  });
});

describe('createAdaptiveScale', () => {
  const feed = (a, ms, n) => { for (let i = 0; i < n; i++) a.sample(ms); };
  it('raises the pixel scale when frames are slow', () => {
    const onChange = vi.fn(); const a = createAdaptiveScale({ base: 3, max: 6, onChange });
    feed(a, 40, 45);
    expect(onChange).toHaveBeenCalledWith(4);
    expect(a.scale).toBe(4);
  });
  it('never exceeds max', () => {
    const a = createAdaptiveScale({ base: 3, max: 4, onChange() {} });
    feed(a, 50, 500);
    expect(a.scale).toBe(4);
  });
  it('lowers back toward base only after sustained headroom', () => {
    const a = createAdaptiveScale({ base: 3, max: 6, onChange() {} });
    feed(a, 40, 45); expect(a.scale).toBe(4);
    feed(a, 8, 45); expect(a.scale).toBe(4);      // one fast window is not enough
    feed(a, 8, 90); expect(a.scale).toBe(3);
    feed(a, 8, 500); expect(a.scale).toBe(3);     // never below base
  });
  it('ignores hitches (tab switch, long gaps)', () => {
    const a = createAdaptiveScale({ base: 3, max: 6, onChange() {} });
    feed(a, 2000, 200);
    expect(a.scale).toBe(3);
  });
});
