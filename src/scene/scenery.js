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

// Parede de tijolos atrás da máquina, até o horizonte (a névoa esconde o fim). Fonte única para geometria e colisão.
const WALL_H = 4.5, WALL_W = 60, WALL_Z = -0.8, WALL_D = 0.6;
export const SCENERY_COLLIDERS = [{ minX: -WALL_W / 2, maxX: WALL_W / 2, minZ: WALL_Z - WALL_D / 2, maxZ: WALL_Z + WALL_D / 2 }];

// Textura de tijolos (1 tile = 2,0 m x 0,8 m: 4 tijolos x 4 fiadas), repetida pela parede.
export function paintBricks(ctx, w = 256, h = 128, rand = Math.random) {
  ctx.fillStyle = '#1b1416'; ctx.fillRect(0, 0, w, h);                 // argamassa
  const cols = 4, rows = 4, bw = w / cols, bh = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0), shade = 0.8 + rand() * 0.4;
      ctx.fillStyle = `rgb(${Math.round(112 * shade)},${Math.round(58 * shade)},${Math.round(54 * shade)})`;
      ctx.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }
}
function brickTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  paintBricks(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(WALL_W / 2.0, WALL_H / 0.8); t.anisotropy = 4;
  return t;
}

export function buildScenery() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2; g.add(ground);
  const mark = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.5, 24), new THREE.MeshBasicMaterial({ color: PALETTE.red }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.03, 2.4); g.add(mark);

  // tudo que é estático vai para UM objeto (1 draw call)
  const b = createBatch();
  b.add(WALL_W, 0.28, 0.05, 0x222a3a, 0.7, 0, 0.14, -0.49);                  // rodapé
  b.add(0.14, WALL_H, 0.14, 0x1a2030, 0.5, 2.7, WALL_H / 2, -0.44);           // cano
  b.add(0.5, 0.7, 0.16, 0x2a3348, 0.7, -3.0, 1.8, -0.42);                     // caixa elétrica
  b.add(5.0, 0.12, 2.2, 0x1a2030, 0.6, 0, 3.5, 0.6);                          // toldo sobre a máquina
    g.add(b.build());
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H),
    new THREE.MeshBasicMaterial({ map: brickTexture(), color: 0x8f98b4 }));         // tom frio da noite sobre os tijolos
  wall.position.set(0, WALL_H / 2, WALL_Z + WALL_D / 2 + 0.001); g.add(wall);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.5), new THREE.MeshBasicMaterial({ color: 0xdff0ff }));
  lamp.position.set(0, 3.43, 0.9); g.add(lamp);                              // luminária sob o toldo
  return g;
}

export function addLighting(scene) {
  // Sem luzes dinâmicas: a iluminação está assada nas cores (baked.js) e no chão; só névoa e fundo.
  scene.fog = new THREE.Fog(FOG, 5, 13);
  scene.background = new THREE.Color(FOG);
}
