import * as THREE from 'three';
import { applyPs1Snap } from '../render/ps1Renderer.js';
import { PALETTE } from './palette.js';

const mat = (c) => applyPs1Snap(new THREE.MeshLambertMaterial({ color: c, flatShading: true }));

export function buildParkingLot() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat(0x1a1a1f));
  ground.rotation.x = -Math.PI / 2; g.add(ground);
  // parking stripes (white, behind the player area)
  for (let i = -5; i <= 5; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 3.2), mat(0x8a8a90));
    s.rotation.x = -Math.PI / 2; s.position.set(i * 2.6, 0.01, -9); g.add(s);
  }
  // a faint red zone mark in front of the machine
  const mark = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.5, 24), new THREE.MeshBasicMaterial({ color: PALETTE.red }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.012, 2.4); g.add(mark);
  // props: cones + concrete block
  [[-3.2, 2.2], [3.6, 1.2], [-4.5, -2]].forEach(([x, z]) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), mat(0xd9531e)); c.position.set(x, 0.25, z); g.add(c);
  });
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.4), mat(0x3a3a40)); block.position.set(4.2, 0.2, -3); g.add(block);
  // lamp post with weak light
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4, 0.12), mat(0x222226)); pole.position.set(-3.5, 2, -3.5); g.add(pole);
  const lamp = new THREE.PointLight(0xffd9a0, 0.5, 9, 2); lamp.position.set(-3.5, 3.9, -3.5); g.add(lamp);
  return g;
}

export function addLighting(scene) {
  scene.fog = new THREE.Fog(0x08080a, 4, 11);
  scene.background = new THREE.Color(0x08080a);
  scene.add(new THREE.AmbientLight(0x30303a, 0.9));
  const spot = new THREE.SpotLight(0xfff0e0, 60, 14, Math.PI / 4, 0.6, 1.5);
  spot.position.set(0, 5, 3.5); spot.target.position.set(0, 1.2, 0);
  scene.add(spot, spot.target);
  const glow = new THREE.PointLight(0xff0033, 1.2, 4, 2); glow.position.set(0, 1.4, 1.2);
  scene.add(glow);
}
