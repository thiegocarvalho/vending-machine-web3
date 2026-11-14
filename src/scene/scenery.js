import * as THREE from 'three';
import { createBatch } from './baked.js';
import { PALETTE } from './palette.js';


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

// Chão com a poça de luz assada (gradiente radial), em baixa resolução.
function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64 + 6, 4, 64, 64, 40);
  r.addColorStop(0, '#46557a'); r.addColorStop(0.45, '#26324c'); r.addColorStop(1, '#0c1424');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
  return t;
}

export function buildScenery() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2; g.add(ground);
  const mark = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.5, 24), new THREE.MeshBasicMaterial({ color: PALETTE.red }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.03, 2.4); g.add(mark);

  // tudo que é estático vai para UM objeto (1 draw call): calçada, cerca de arame e postes de energia
  const b = createBatch();
  b.add(30, 0.04, 2.4, 0x3a4560, 0.9, 0, 0.02, 0.4);
  b.add(30, 0.05, 0.05, 0x4a5878, 0.7, 0, 1.2, -2.6);
  b.add(30, 0.05, 0.05, 0x4a5878, 0.7, 0, 0.15, -2.6);
  for (let x = -14; x <= 14; x += 1.5) b.add(0.06, 1.25, 0.06, 0x4a5878, 0.7, x, 0.62, -2.6);
  for (let x = -14; x <= 14; x += 0.5) b.add(0.015, 1.05, 0.015, 0x4a5878, 0.7, x, 0.65, -2.6);
  for (const x of [-12, 10]) {
    b.add(0.2, 7, 0.2, 0x1a2030, 0.4, x, 3.5, -8);
    b.add(2.2, 0.1, 0.1, 0x1a2030, 0.4, x, 6.6, -8);
  }
  g.add(b.build());
  g.add(skyDome());
  return g;
}

export function addLighting(scene) {
  // Sem luzes dinâmicas: a iluminação está assada nas cores (baked.js) e no chão; só névoa e fundo.
  scene.fog = new THREE.Fog(FOG, 5, 13);
  scene.background = new THREE.Color(FOG);
}
