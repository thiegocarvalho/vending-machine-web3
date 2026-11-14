import * as THREE from 'three';
import { createPs1Renderer } from './render/ps1Renderer.js';

const canvas = document.getElementById('game');
const { resize, render } = createPs1Renderer(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08080a);
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 60);
camera.position.set(0, 1.6, 4);

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix(); resize(w, h);
}
window.addEventListener('resize', onResize); onResize();
(function loop() { render(scene, camera); requestAnimationFrame(loop); })();
