import * as THREE from 'three';
import { applyPs1Snap } from '../render/ps1Renderer.js';
import { PALETTE } from './palette.js';

const mat = (c) => applyPs1Snap(new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };

const FOG = 0x0c1424;

// Céu noturno pintado em baixa resolução: gradiente, nuvens, montanhas e linha de árvores.
export function paintSky(ctx, w = 512, h = 128, rand = Math.random) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#05080f'); g.addColorStop(0.55, '#14233d'); g.addColorStop(1, '#2a4468');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {                         // nuvens
    ctx.fillStyle = `rgba(${10 + rand() * 20},${18 + rand() * 24},${34 + rand() * 30},${0.35 + rand() * 0.4})`;
    ctx.beginPath(); ctx.ellipse(rand() * w, 8 + rand() * 55, 18 + rand() * 40, 5 + rand() * 9, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#e8f0ff';                              // estrelas
  for (let i = 0; i < 30; i++) ctx.fillRect(rand() * w, rand() * 45, 1, 1);
  ctx.fillStyle = '#0d1626';                              // montanhas
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h - 38 - 18 * Math.sin(x / 41) - 12 * Math.sin(x / 17 + 2) - rand() * 3);
  ctx.lineTo(w, h); ctx.fill();
  ctx.fillStyle = '#05080e';                              // árvores
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 3) ctx.lineTo(x, h - 16 - rand() * 9);
  ctx.lineTo(w, h); ctx.fill();
}

function skyDome() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  paintSky(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(45, 45, 40, 32, 1, true),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
  m.position.y = 14; return m;
}

export function buildScenery() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat(0x151a24));
  ground.rotation.x = -Math.PI / 2; g.add(ground);
  g.add(box(30, 0.04, 2.4, mat(0x1f2633), 0, 0.02, 0.4));          // calçada sob as máquinas
  const mark = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.5, 24), new THREE.MeshBasicMaterial({ color: PALETTE.red }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.03, 2.4); g.add(mark);

  // cerca de arame atrás das máquinas
  const fence = mat(0x2b3444);
  g.add(box(30, 0.05, 0.05, fence, 0, 1.2, -2.6), box(30, 0.05, 0.05, fence, 0, 0.15, -2.6));
  for (let x = -14; x <= 14; x += 1.5) g.add(box(0.06, 1.25, 0.06, fence, x, 0.62, -2.6));
  for (let x = -14; x <= 14; x += 0.5) g.add(box(0.015, 1.05, 0.015, fence, x, 0.65, -2.6));

  // luz fraca de rua (sem poste visível)
  const lamp = new THREE.PointLight(0xcfe3ff, 0.9, 10, 2); lamp.position.set(4.6, 4.4, -1.4); g.add(lamp);

  // postes de energia e fios ao fundo
  for (const x of [-12, 10]) {
    g.add(box(0.2, 7, 0.2, mat(0x0c0f14), x, 3.5, -8), box(2.2, 0.1, 0.1, mat(0x0c0f14), x, 6.6, -8));
  }
  g.add(skyDome());
  return g;
}

export function addLighting(scene) {
  scene.fog = new THREE.Fog(FOG, 5, 13);
  scene.background = new THREE.Color(FOG);
  scene.add(new THREE.AmbientLight(0x3a4a68, 1.1));
  const spot = new THREE.SpotLight(0xe8f0ff, 60, 14, Math.PI / 4, 0.6, 1.5);
  spot.position.set(0, 5, 3.5); spot.target.position.set(0, 1.2, 0);
  scene.add(spot, spot.target);
  const red = new THREE.PointLight(0xff0033, 1.2, 4, 2); red.position.set(0, 1.4, 1.2);
  scene.add(red);
}
