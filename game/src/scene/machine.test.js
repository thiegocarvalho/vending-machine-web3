import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

// ambiente node: canvas mínimo para as texturas desenhadas (LED)
const noop = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => noop }) });
const { buildMachine } = await import('./machine.js');

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
  it('has a red-LED display and a screen on the right column, below it', () => {
    expect(m.ledMesh).toBeTruthy();
    const led = world(m.ledMesh), scr = world(m.screenMesh);
    expect(scr.y).toBeLessThan(led.y);
    expect(led.x).toBeGreaterThan(world(m.slotAnchors[5]).x);           // à direita da janela
    expect(typeof m.led.setText).toBe('function');
  });
  it('keeps draw calls low: body and glow batches are single meshes', () => {
    let meshes = 0; m.group.traverse((o) => { if (o.isMesh) meshes++; });
    expect(meshes).toBeLessThanOrEqual(8);
  });
  it('rows descend A to E', () => {
    const ys = [0, 6, 12, 18, 24].map(i => world(m.slotAnchors[i]).y);
    for (let i = 1; i < 5; i++) expect(ys[i]).toBeLessThan(ys[i - 1]);
  });
});
