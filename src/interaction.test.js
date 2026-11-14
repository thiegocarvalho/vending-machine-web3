import { describe, it, expect, vi } from 'vitest';
import { createModes, facingTarget, forwardVector, pickInteractable } from './interaction.js';

describe('createModes', () => {
  it('walks -> select -> pay and back', () => {
    const m = createModes(); const cb = vi.fn(); m.onChange(cb);
    expect(m.mode).toBe('walk');
    m.confirm(); expect(m.mode).toBe('walk');           // confirmar não faz nada fora da seleção
    m.interact(); expect(m.mode).toBe('select');
    m.confirm(); expect(m.mode).toBe('pay');
    m.interact(); expect(m.mode).toBe('pay');           // interagir só vale andando
    m.back(); expect(m.mode).toBe('select');
    m.back(); expect(m.mode).toBe('walk');
    m.back(); expect(m.mode).toBe('walk');
    expect(cb.mock.calls.map((c) => c[0])).toEqual(['select', 'pay', 'select', 'walk']);
  });
});

describe('facingTarget', () => {
  const target = { x: 0, y: 1.3, z: 0 };
  it('forward at yaw 0 looks toward -z', () => {
    const f = forwardVector(0, 0); expect(f.z).toBeCloseTo(-1); expect(f.x).toBeCloseTo(0);
  });
  it('is true when close and looking at the machine', () => {
    expect(facingTarget({ x: 0, y: 1.6, z: 2.5 }, 0, 0, target)).toBe(true);
  });
  it('is false when too far, looking away or too lateral', () => {
    expect(facingTarget({ x: 0, y: 1.6, z: 6 }, 0, 0, target)).toBe(false);
    expect(facingTarget({ x: 0, y: 1.6, z: 2.5 }, Math.PI, 0, target)).toBe(false);
    expect(facingTarget({ x: 0, y: 1.6, z: 2.5 }, 1.2, 0, target)).toBe(false);
  });
});

describe('pickInteractable', () => {
  const targets = [
    { kind: 'machine', pos: { x: 0, y: 1.3, z: 0.2 } },
    { kind: 'faucet', pos: { x: -2.25, y: 1.5, z: -0.45 }, maxDist: 4, maxAngleDeg: 22 }
  ];
  it('picks the one nearest to the crosshair', () => {
    expect(pickInteractable({ x: 0, y: 1.6, z: 3.4 }, 0, 0, targets)).toBe('machine');
    expect(pickInteractable({ x: -2.25, y: 1.6, z: 2.5 }, 0, 0, targets)).toBe('faucet');
  });
  it('is null when looking away or too far', () => {
    expect(pickInteractable({ x: 0, y: 1.6, z: 3.4 }, Math.PI, 0, targets)).toBeNull();
    expect(pickInteractable({ x: 0, y: 1.6, z: 7 }, 0, 0, targets)).toBeNull();
  });
});
