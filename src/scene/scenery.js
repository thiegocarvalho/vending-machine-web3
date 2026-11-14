import * as THREE from 'three';
import { createBatch } from './baked.js';
import { PALETTE } from './palette.js';


const FOG = 0x0c1424;

// Chão com a poça de luz assada (gradiente radial), 
function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64 + 6, 4, 64, 64, 40);
  r.addColorStop(0, '#46557a'); r.addColorStop(0.45, '#26324c'); r.addColorStop(1, '#0c1424');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Paredes: a fonte única de verdade para a geometria E para a colisão (jogador não atravessa).
const WALL_H = 4.5;
const WALLS = [
  { x: 0,    z: -0.8, w: 18,  d: 0.6, label: 'back' },    // atrás da máquina
  { x: -5.5, z: 2.0,  w: 0.4, d: 5,   label: 'left' },    // retornos laterais formam um nicho
  { x: 5.5,  z: 2.0,  w: 0.4, d: 5,   label: 'right' }
];
const toBox = (o) => ({ minX: o.x - o.w / 2, maxX: o.x + o.w / 2, minZ: o.z - o.d / 2, maxZ: o.z + o.d / 2 });
export const SCENERY_COLLIDERS = WALLS.map(toBox);

export function buildScenery() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2; g.add(ground);
  const mark = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.5, 24), new THREE.MeshBasicMaterial({ color: PALETTE.red }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.03, 2.4); g.add(mark);

  // tudo que é estático vai para UM objeto (1 draw call)
  const b = createBatch();
  for (const o of WALLS) b.add(o.w, WALL_H, o.d, o.label === 'back' ? 0x44506c : 0x39445c, o.label === 'back' ? 0.6 : 0.45, o.x, WALL_H / 2, o.z);
  b.add(18, 0.28, 0.05, 0x222a3a, 0.7, 0, 0.14, -0.49);                       // rodapé
  for (const y of [1.1, 2.0, 2.9, 3.8]) b.add(18, 0.05, 0.03, 0x2c364c, 0.6, 0, y, -0.495);   // fiadas
  b.add(0.14, WALL_H, 0.14, 0x1a2030, 0.5, 2.7, WALL_H / 2, -0.44);           // cano
  b.add(0.5, 0.7, 0.16, 0x2a3348, 0.7, -3.0, 1.8, -0.42);                     // caixa elétrica
  b.add(5.0, 0.12, 2.2, 0x1a2030, 0.6, 0, 3.5, 0.6);                          // toldo sobre a máquina
  b.add(0.1, 0.8, 0.1, 0x1a2030, 0.6, -2.4, 3.9, -0.4);
  g.add(b.build());
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.5), new THREE.MeshBasicMaterial({ color: 0xdff0ff }));
  lamp.position.set(0, 3.43, 0.9); g.add(lamp);                              // luminária sob o toldo
  return g;
}

export function addLighting(scene) {
  // Sem luzes dinâmicas: a iluminação está assada nas cores (baked.js) e no chão; só névoa e fundo.
  scene.fog = new THREE.Fog(FOG, 5, 13);
  scene.background = new THREE.Color(FOG);
}
