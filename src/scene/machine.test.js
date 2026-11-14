import { describe, it, expect } from 'vitest';
import { buildMachine } from './machine.js';
import * as THREE from 'three';

const world = (o) => o.getWorldPosition(new THREE.Vector3());

describe('buildMachine', () => {
  const m = buildMachine();
  m.group.updateMatrixWorld(true);
  it('has 30 slot anchors, a screen and a tray', () => {
    expect(m.slotAnchors).toHaveLength(30);
    expect(m.screenMesh).toBeTruthy();
    expect(m.trayAnchor).toBeTruthy();
  });
  it('card 1 is top-left, card 30 bottom-right', () => {
    const p1 = world(m.slotAnchors[0]), p6 = world(m.slotAnchors[5]), p30 = world(m.slotAnchors[29]);
    expect(p1.y).toBeGreaterThan(p30.y);
    expect(p1.x).toBeLessThan(p6.x);
    expect(p30.x).toBeCloseTo(p6.x, 5);
  });
  it('rows descend A to E', () => {
    const ys = [0, 6, 12, 18, 24].map(i => world(m.slotAnchors[i]).y);
    for (let i = 1; i < 5; i++) expect(ys[i]).toBeLessThan(ys[i - 1]);
  });
});
