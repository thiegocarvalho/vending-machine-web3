import * as THREE from 'three';
import { createPs1Renderer } from './render/ps1Renderer.js';
import { buildMachine } from './scene/machine.js';
import { buildParkingLot, addLighting } from './scene/parkingLot.js';
import { createControls } from './player/controls.js';
import { populateCards } from './scene/cards.js';
import { loadCardsInfo } from './data/chain.js';

const canvas = document.getElementById('game');
const { resize, render } = createPs1Renderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 60);
addLighting(scene);
scene.add(buildParkingLot());
const machine = buildMachine();
scene.add(machine.group);
const controls = createControls(camera, canvas);
const infos = await loadCardsInfo();
const cardsApi = populateCards(machine.slotAnchors, infos);
window.__game = { scene, camera, machine, controls, cardsApi };

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix(); resize(w, h);
}
window.addEventListener('resize', onResize); onResize();
let last = performance.now();
(function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  controls.update(dt); render(scene, camera); requestAnimationFrame(loop);
})(last);
