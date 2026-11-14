import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createAim } from './aim.js';

// cena mínima: parede em z=-0.5 com o cartaz em x=-2.3; "máquina" é uma caixa em x=0, z=0
const build = () => {
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4)); poster.position.set(-2.3, 1.9, -0.49);
  const machine = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.4, 0.95)); box.position.set(0, 1.2, 0); machine.add(box);
  const scene = new THREE.Scene(); scene.add(poster, machine); scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(65, 1.33, 0.1, 100);
  const aim = createAim({ camera, poster, machineGroup: machine, targets: [{ kind: 'machine', pos: { x: 0, y: 1.3, z: 0.2 } }] });
  const at = (pos, yaw, pitch = 0) => { camera.position.set(...pos); camera.rotation.set(pitch, yaw, 0, 'YXZ'); camera.updateMatrixWorld(true); return aim(yaw, pitch); };
  return { at };
};

describe('mira: cartaz do faucet x máquina', () => {
  it('olhando o cartaz de frente: faucet', () => { expect(build().at([-2.3, 1.6, 2.6], 0, 0.05)).toBe('faucet'); });
  it('olhando a máquina de frente: máquina', () => { expect(build().at([0.3, 1.6, 3.0], 0)).toBe('machine'); });
  it('olhando a máquina DE LADO (o cartaz fica na mesma direção, atrás dela): nunca faucet', () => {
    expect(build().at([-1.7, 1.6, 0.9], -Math.PI / 2)).toBe('machine');
    expect(build().at([-1.9, 1.6, 0.6], -Math.PI / 2 + 0.35)).not.toBe('faucet');
  });
  it('cartaz longe demais ou fora da mira: nada', () => {
    expect(build().at([-2.3, 1.6, 6.0], 0, 0.05)).toBeNull();
    expect(build().at([4.5, 1.6, 2.0], 0)).toBeNull();
  });
  it('máquina entre a câmera e o cartaz esconde o cartaz', () => {
    // câmera à direita da máquina olhando para a esquerda, em linha com o cartaz: a máquina está na frente
    expect(build().at([2.5, 1.9, -0.1], Math.PI / 2)).not.toBe('faucet');
  });
});
