import * as THREE from 'three';
import { pickInteractable } from './interaction.js';

// O que está sob a mira. O cartaz do faucet só vale se for a PRIMEIRA coisa que o raio da mira atinge (a máquina na frente o esconde);
// a máquina vale pelo cone de visão. Assim o prompt do faucet não aparece olhando a máquina de lado.
export function createAim({ camera, poster, machineGroup, targets, posterReach = 4.5 }) {
  const ray = new THREE.Raycaster(); ray.far = posterReach;
  return function aim(yaw, pitch) {
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const first = ray.intersectObjects([poster, machineGroup], true)[0];
    if (first && first.object === poster) return 'faucet';
    return pickInteractable(camera.position, yaw, pitch, targets);
  };
}
