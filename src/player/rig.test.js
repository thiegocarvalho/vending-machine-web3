import { describe, it, expect } from 'vitest';
import { createRig, lerpAngle } from './rig.js';

const fakeCam = () => ({ position: { x: 0, y: 1.6, z: 5, set(x, y, z) { this.x = x; this.y = y; this.z = z; } } });
const fakeControls = (yaw = 0, pitch = 0) => ({ yaw, pitch, pose() { return { yaw: this.yaw, pitch: this.pitch }; }, setLook(y, p) { this.yaw = y; this.pitch = p; } });

describe('lerpAngle', () => {
  it('takes the short way around', () => {
    expect(lerpAngle(3.0, -3.0, 0.5)).toBeCloseTo(Math.PI, 1);
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });
});

describe('createRig', () => {
  it('flies camera and look to the target pose and then goes idle', () => {
    const cam = fakeCam(), ctl = fakeControls(), rig = createRig(cam, ctl);
    rig.flyTo({ x: 1, y: 1.2, z: 2, yaw: 0.4, pitch: -0.1 }, 400, 1000);
    expect(rig.active).toBe(true);
    expect(rig.update(1200)).toBe(true);                 // meio do caminho
    expect(cam.position.z).toBeGreaterThan(2); expect(cam.position.z).toBeLessThan(5);
    expect(rig.update(1500)).toBe(false);                // terminou
    expect(rig.active).toBe(false);
    expect(cam.position).toMatchObject({ x: 1, y: 1.2, z: 2 });
    expect(ctl.yaw).toBeCloseTo(0.4); expect(ctl.pitch).toBeCloseTo(-0.1);
  });
  it('a new flyTo starts from wherever the camera currently is', () => {
    const cam = fakeCam(), ctl = fakeControls(), rig = createRig(cam, ctl);
    rig.flyTo({ x: 0, y: 1.6, z: 1, yaw: 0, pitch: 0 }, 400, 0); rig.update(200);
    const mid = cam.position.z;
    rig.flyTo({ x: 0, y: 1.6, z: 9, yaw: 0, pitch: 0 }, 400, 200); rig.update(200);
    expect(cam.position.z).toBeCloseTo(mid, 5);
  });
  it('is idle when never started', () => {
    expect(createRig(fakeCam(), fakeControls()).update(0)).toBe(false);
  });
});
