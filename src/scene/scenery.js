import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createBatch } from './baked.js';

const POST = { x: 3.2, z: 1.2, h: 4.2 };                              // poste de luz ao lado da máquina
const SIGN = { x: -1.4, z: 1.6 };                                      // placa de rua sobre bloco de concreto
const FOG = 0x141a2e;                           // neblina azul-arroxeada da noite

const canvasTex = (w, h, draw, { repeat, srgb = true } = {}) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4; }
  return t;
};
const glowDisc = (g, x, y, rx, ry, rgb, a) => {                  // elipse com gradiente (luz suave)
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  r.addColorStop(0, `rgba(${rgb},${a})`); r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
};

// Calçada de lajes (1 tile = 2 m x 2 m = 2x2 lajes), repetida pelo chão.
export function paintPaving(ctx, w, h, rand = Math.random) {
  const n = 2, sw = w / n, sh = h / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 52 + rand() * 18;
    ctx.fillStyle = `rgb(${v},${v + 4},${v + 14})`; ctx.fillRect(i * sw, j * sh, sw, sh);
  }
  ctx.strokeStyle = '#0a0d16'; ctx.lineWidth = 3;
  for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * sw, 0); ctx.lineTo(i * sw, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * sh); ctx.lineTo(w, i * sh); ctx.stroke(); }
}

// Luz sobre o chão molhado: brilho frio da máquina, reflexo vermelho do neon e poça quente do poste (aditiva).
const LIGHT = { size: 26, px: 256 };
function groundLightTexture() {
  return canvasTex(LIGHT.px, LIGHT.px, (g) => {
    const m = LIGHT.px / LIGHT.size, X = (x) => LIGHT.px / 2 + x * m, Z = (z) => LIGHT.px / 2 + z * m;
    glowDisc(g, X(0), Z(1.6), 5.5 * m, 4.2 * m, '120,160,255', 0.22);           // máquina
    glowDisc(g, X(0.1), Z(2.3), 1.3 * m, 3.6 * m, '255,40,60', 0.38);            // reflexo do neon (alongado para a câmera)
    glowDisc(g, X(0), Z(0.5), 4.5 * m, 2.2 * m, '255,50,70', 0.2);               // luz vermelha na calçada
    glowDisc(g, X(POST.x - 0.95), Z(POST.z), 3.2 * m, 3.2 * m, '255,205,140', 0.5);   // poste
  });
}

// Letreiro de neon vermelho (tubos com brilho + núcleo claro).
export function paintNeon(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.lineCap = g.lineJoin = 'round';
  const text = 'Cards';
  g.font = 'italic 700 150px "Brush Script MT","Segoe Script","Snell Roundhand",cursive';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#ff1830'; g.shadowBlur = 38; g.lineWidth = 16; g.strokeStyle = '#ff2a3c';   // brilho
  g.strokeText(text, w / 2, h / 2 + 8); g.strokeText(text, w / 2, h / 2 + 8);
  g.shadowBlur = 10; g.lineWidth = 8; g.strokeStyle = '#ff5a68'; g.strokeText(text, w / 2, h / 2 + 8);
  g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = '#ffe3dc'; g.strokeText(text, w / 2, h / 2 + 8);  // núcleo
  g.shadowColor = '#ff1830'; g.shadowBlur = 20; g.lineWidth = 5; g.strokeStyle = '#ff3a4c';          // moldura do letreiro
  g.strokeRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
}

// Grafite: caveira ciano e letras magenta, em spray sobre os tijolos (transparente).
export function paintGraffiti(g, w, h, rand = Math.random) {
  g.clearRect(0, 0, w, h);
  g.shadowColor = '#19e0d0'; g.shadowBlur = 14; g.fillStyle = '#17b8b0';
  g.beginPath(); g.ellipse(w * 0.3, h * 0.45, w * 0.17, h * 0.36, 0, 0, Math.PI * 2); g.fill();         // caveira
  g.fillStyle = '#0b1020'; g.shadowBlur = 0;
  g.beginPath(); g.ellipse(w * 0.24, h * 0.4, 20, 28, 0, 0, Math.PI * 2); g.ellipse(w * 0.36, h * 0.4, 20, 28, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(w * 0.255, h * 0.68, 66, 22);
  g.font = 'bold 92px "Impact","Arial Black",sans-serif'; g.textAlign = 'left'; g.lineWidth = 10; g.lineJoin = 'round';
  g.strokeStyle = '#1a0a2e'; g.strokeText('ZERU', w * 0.5, h * 0.72);
  g.shadowColor = '#ff2bd6'; g.shadowBlur = 18; g.fillStyle = '#e02ec0'; g.fillText('ZERU', w * 0.5, h * 0.72);
  g.shadowBlur = 0;
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? '224,46,192' : '23,184,176'},${0.3 + rand() * 0.4})`; g.beginPath(); g.arc(rand() * w, rand() * h, 1 + rand() * 3, 0, Math.PI * 2); g.fill(); }
}

// Horizonte urbano ao fundo (visto por cima do muro): prédios com janelas acesas na neblina.
export function paintSkyline(g, w, h, rand = Math.random) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0b1020'); bg.addColorStop(0.6, '#2b2748'); bg.addColorStop(1, '#4a3a5a');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  let x = 0;
  while (x < w) {
    const bw = 30 + rand() * 70, bh = h * (0.25 + rand() * 0.5);
    g.fillStyle = `rgb(${12 + rand() * 10},${14 + rand() * 10},${28 + rand() * 12})`; g.fillRect(x, h - bh, bw, bh);
    for (let k = 0; k < bw * bh / 500; k++) {
      if (rand() < 0.45) continue;
      g.fillStyle = rand() < 0.8 ? '#ffb860' : '#ff5a5a';
      g.fillRect(x + 4 + rand() * (bw - 10), h - bh + 6 + rand() * (bh - 12), 3, 4);
    }
    x += bw + rand() * 6;
  }
  const haze = g.createLinearGradient(0, h * 0.5, 0, h);
  haze.addColorStop(0, 'rgba(90,70,120,0)'); haze.addColorStop(1, 'rgba(120,80,130,0.55)');
  g.fillStyle = haze; g.fillRect(0, 0, w, h);
}

// Parede de tijolos atrás da máquina, até o horizonte (a névoa esconde o fim). Fonte única para geometria e colisão.
const WALL_H = 4.5, WALL_W = 60, WALL_Z = -0.8, WALL_D = 0.6;
export const SCENERY_COLLIDERS = [
  { minX: -WALL_W / 2, maxX: WALL_W / 2, minZ: WALL_Z - WALL_D / 2, maxZ: WALL_Z + WALL_D / 2 },
  { minX: POST.x - 0.15, maxX: POST.x + 0.15, minZ: POST.z - 0.15, maxZ: POST.z + 0.15 },
  { minX: SIGN.x - 0.3, maxX: SIGN.x + 0.3, minZ: SIGN.z - 0.3, maxZ: SIGN.z + 0.3 }
];

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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
    new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c, w, h) => paintPaving(c, w, h), { repeat: [30, 30] }), color: 0xa0a8c4 }));
  ground.rotation.x = -Math.PI / 2; g.add(ground);
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(LIGHT.size, LIGHT.size),                  // luz/reflexos sobre o chão molhado
    new THREE.MeshBasicMaterial({ map: groundLightTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  wet.rotation.x = -Math.PI / 2; wet.position.y = 0.012; wet.renderOrder = 1; g.add(wet);

  // tudo que é estático e sólido vai para UM objeto (1 draw call)
  const b = createBatch();
  b.add(WALL_W, 0.28, 0.05, 0x222a3a, 0.7, 0, 0.14, -0.49);                  // rodapé
  b.add(0.14, WALL_H, 0.14, 0x1a2030, 0.5, 2.7, WALL_H / 2, -0.44);           // cano
  b.add(0.5, 0.7, 0.16, 0x2a3348, 0.7, -3.0, 1.8, -0.42);                     // caixa elétrica
  b.add(0.16, POST.h, 0.16, 0x232b3c, 0.8, POST.x, POST.h / 2, POST.z);        // poste de luz
  b.add(0.3, 0.3, 0.3, 0x232b3c, 0.8, POST.x, 0.15, POST.z);
  b.add(1.0, 0.1, 0.1, 0x232b3c, 0.8, POST.x - 0.45, POST.h - 0.05, POST.z);
  b.add(0.55, 0.1, 0.3, 0x2c3650, 0.9, POST.x - 0.95, POST.h - 0.05, POST.z);
  b.add(0.6, 0.55, 0.6, 0x7a8294, 0.8, SIGN.x, 0.275, SIGN.z);                 // bloco de concreto
  b.add(0.07, 2.4, 0.07, 0x20262f, 0.8, SIGN.x, 1.75, SIGN.z);                 // haste da placa
  b.add(0.1, 0.1, 0.12, 0x4a4f5a, 0.7, -1.9, 0.05, 2.2); b.add(0.1, 0.1, 0.1, 0x6a5a4a, 0.7, 2.0, 0.05, 2.7);   // latas no chão
  b.add(0.1, 0.1, 0.1, 0x4a4f5a, 0.7, 0.9, 0.05, 3.1);
  g.add(b.build());

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H),
    new THREE.MeshBasicMaterial({ map: canvasTex(256, 128, (c, w, h) => paintBricks(c, w, h), { repeat: [WALL_W / 2.0, WALL_H / 0.8] }), color: 0x9a96b0 }));
  wall.position.set(0, WALL_H / 2, WALL_Z + WALL_D / 2 + 0.001); g.add(wall);

  // grafite (2 painéis num só objeto)
  const gt = canvasTex(512, 256, (c, w, h) => paintGraffiti(c, w, h));
  const tag = (x, y, w, h) => new THREE.PlaneGeometry(w, h).translate(x, y, 0);
  const graffiti = new THREE.Mesh(mergeGeometries([tag(4.6, 1.7, 3.6, 1.8), tag(-5.2, 1.4, 2.6, 1.3)]),
    new THREE.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false, color: 0xb8bcd4 }));
  graffiti.position.z = WALL_Z + WALL_D / 2 + 0.003; graffiti.renderOrder = 2; g.add(graffiti);

  // letreiro de neon vermelho sobre a máquina, com halo vermelho na parede
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.2),
    new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c) => glowDisc(c, 64, 64, 64, 64, '255,35,55', 0.55)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.set(0, 3.4, WALL_Z + WALL_D / 2 + 0.005); halo.renderOrder = 3; g.add(halo);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.9),
    new THREE.MeshBasicMaterial({ map: canvasTex(512, 210, (c, w, h) => paintNeon(c, w, h)), transparent: true, depthWrite: false }));
  sign.position.set(-0.1, 3.35, WALL_Z + WALL_D / 2 + 0.01); sign.renderOrder = 4; g.add(sign);

  // placa redonda de rua (azul com seta)
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20),
    new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#1d4fa8'; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 54, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(64, 26); c.lineTo(92, 62); c.lineTo(72, 62); c.lineTo(72, 102); c.lineTo(56, 102); c.lineTo(56, 62); c.lineTo(36, 62); c.fill();
    }), color: 0xb0b8d0 }));
  disc.position.set(SIGN.x, 2.75, SIGN.z + 0.05); g.add(disc);

  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.2), new THREE.MeshBasicMaterial({ color: 0xfff1d0 }));
  bulb.position.set(POST.x - 0.95, POST.h - 0.12, POST.z); g.add(bulb);        // lâmpada acesa

  // horizonte urbano distante, visto por cima do muro
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(220, 55),
    new THREE.MeshBasicMaterial({ map: canvasTex(1024, 256, (c, w, h) => paintSkyline(c, w, h)), fog: false }));
  sky.position.set(0, 20, -40); g.add(sky);
  return g;
}

export function addLighting(scene) {
  // Sem luzes dinâmicas: a iluminação está assada nas cores (baked.js) e no chão; só névoa e fundo.
  scene.fog = new THREE.Fog(FOG, 7, 20);
  scene.background = new THREE.Color(FOG);
}
