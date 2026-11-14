import * as THREE from 'three';
import { createBatch } from './baked.js';
import { drawQr } from '../payment/machineScreen.js';
import { config } from '../config.js';

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

// Luz sobre o chão molhado: brilho frio da máquina, reflexo violeta do neon e poça quente do poste (aditiva).
const LIGHT = { size: 26, px: 256 };
function groundLightTexture() {
  return canvasTex(LIGHT.px, LIGHT.px, (g) => {
    const m = LIGHT.px / LIGHT.size, X = (x) => LIGHT.px / 2 + x * m, Z = (z) => LIGHT.px / 2 + z * m;
    glowDisc(g, X(0), Z(1.6), 5.5 * m, 4.2 * m, '120,160,255', 0.22);           // máquina
    glowDisc(g, X(0.1), Z(2.3), 1.3 * m, 3.6 * m, '130,90,255', 0.4);            // reflexo do neon (alongado para a câmera)
    glowDisc(g, X(0), Z(0.5), 4.5 * m, 2.2 * m, '120,90,255', 0.22);               // luz vermelha na calçada
    glowDisc(g, X(POST.x - 0.95), Z(POST.z), 3.2 * m, 3.2 * m, '255,205,140', 0.5);   // poste
  });
}

// Letreiro de neon violeta-azulado (tubos com brilho + núcleo claro).
export function paintNeon(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.lineCap = g.lineJoin = 'round';
  const text = 'Cards';
  g.font = 'italic 700 150px "Brush Script MT","Segoe Script","Snell Roundhand",cursive';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#5a3cff'; g.shadowBlur = 38; g.lineWidth = 16; g.strokeStyle = '#6a4cff';   // brilho
  g.strokeText(text, w / 2, h / 2 + 8); g.strokeText(text, w / 2, h / 2 + 8);
  g.shadowBlur = 10; g.lineWidth = 8; g.strokeStyle = '#9b86ff'; g.strokeText(text, w / 2, h / 2 + 8);
  g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = '#f0eaff'; g.strokeText(text, w / 2, h / 2 + 8);  // núcleo
  g.shadowColor = '#5a3cff'; g.shadowBlur = 20; g.lineWidth = 5; g.strokeStyle = '#7a5cff';          // moldura do letreiro
  g.strokeRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
}

// Cartaz velho estilo Polaroid, colado na parede, com o QR do faucet da Sepolia. Fica à esquerda da máquina.
export const POSTER = { x: -2.3, y: 1.75, w: 1.05, h: 1.25 };
export function paintPoster(g, w, h, qr = () => {}, rand = Math.random) {
  g.clearRect(0, 0, w, h);
  const paper = g.createLinearGradient(0, 0, w, h);                                            // papel amarelado e gasto
  paper.addColorStop(0, '#e6dfcb'); paper.addColorStop(1, '#c9bfa5');
  g.fillStyle = paper; g.fillRect(0, 0, w, h);
  const m = w * 0.07, ph = w - 2 * m;                                                          // foto quadrada, borda inferior larga
  g.fillStyle = '#bfc9c6'; g.fillRect(m, m, ph, ph);                                            // foto desbotada
  const photo = g.createLinearGradient(0, m, 0, m + ph);
  photo.addColorStop(0, 'rgba(20,50,70,0.35)'); photo.addColorStop(1, 'rgba(10,20,30,0.15)');
  g.fillStyle = photo; g.fillRect(m, m, ph, ph);
  const qs = ph * 0.62, qx = m + (ph - qs) / 2, qy = m + ph * 0.1;
  qr(g, config.faucetUrl, qx, qy, qs);                                                         // QR (branco/preto, legível)
  g.fillStyle = '#1b2a38'; g.textAlign = 'center';
  g.font = 'bold 26px "Space Grotesk",system-ui,sans-serif'; g.fillText('FREE SEPOLIA ETH', w / 2, m + ph * 0.85);
  g.font = '15px "Fira Code",monospace'; g.fillText('scan  ·  or press [E]', w / 2, m + ph * 0.94);
  g.fillStyle = '#2a2622'; g.font = 'italic 700 44px "Bradley Hand","Segoe Script","Snell Roundhand",cursive';   // legenda à mão
  g.fillText('need gas?', w / 2, m + ph + (h - m - ph) * 0.52);
  for (let i = 0; i < 9; i++) {                                                                // manchas e sujeira
    g.fillStyle = `rgba(${70 + rand() * 40},${50 + rand() * 30},20,${0.05 + rand() * 0.1})`;
    g.beginPath(); g.ellipse(rand() * w, rand() * h, 20 + rand() * 60, 10 + rand() * 40, rand() * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;                                  // vincos e arranhões
  for (let i = 0; i < 14; i++) { g.beginPath(); const x = rand() * w, y = rand() * h; g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 120, y + (rand() - 0.5) * 120); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h * 0.5); g.lineTo(w, h * 0.52); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(0, h * 0.5 + 2); g.lineTo(w, h * 0.52 + 2); g.stroke();
  const edge = g.createLinearGradient(0, 0, w, 0);                                              // bordas escurecidas
  edge.addColorStop(0, 'rgba(0,0,0,0.3)'); edge.addColorStop(0.08, 'rgba(0,0,0,0)'); edge.addColorStop(0.92, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = edge; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';                                              // canto rasgado (recorta o papel)
  g.beginPath(); g.moveTo(w, 0); g.lineTo(w - 70, 0); g.lineTo(w - 48, 26); g.lineTo(w - 22, 18); g.lineTo(w, 62); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, h); g.lineTo(34, h); g.lineTo(18, h - 24); g.lineTo(0, h - 30); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(225,205,120,0.65)';                                                       // fitas adesivas nos cantos
  g.save(); g.translate(18, 14); g.rotate(-0.6); g.fillRect(-34, -9, 70, 18); g.restore();
  g.save(); g.translate(w - 90, 12); g.rotate(0.35); g.fillRect(-34, -9, 70, 18); g.restore();
}

// Placa de alerta amarela com OVNI raptando uma pessoa.
export function paintUfoSign(g, w, h) {
  g.clearRect(0, 0, w, h);
  const tri = (inset, color) => {
    g.fillStyle = color; g.strokeStyle = color; g.lineJoin = 'round'; g.lineWidth = 26 - inset * 0.6;
    g.beginPath(); g.moveTo(w / 2, 20 + inset); g.lineTo(w - 22 - inset, h - 22 - inset * 0.6); g.lineTo(22 + inset, h - 22 - inset * 0.6); g.closePath(); g.fill(); g.stroke();
  };
  tri(0, '#e9cc2f');                                              // amarelo
  g.strokeStyle = '#0b0b0b'; g.lineWidth = 9; g.lineJoin = 'round';  // moldura preta
  g.beginPath(); g.moveTo(w / 2, 36); g.lineTo(w - 36, h - 34); g.lineTo(36, h - 34); g.closePath(); g.stroke();
  g.fillStyle = '#0b0b0b';
  g.beginPath(); g.ellipse(w / 2, 108, 62, 12, 0, 0, Math.PI * 2); g.fill();          // disco
  g.beginPath(); g.ellipse(w / 2, 100, 28, 13, 0, Math.PI, 0); g.fill();               // cúpula
  g.fillRect(w / 2 - 14, 116, 28, 5);
  g.strokeStyle = '#0b0b0b'; g.lineWidth = 2.5;                                          // feixe
  g.beginPath(); g.moveTo(w / 2 - 12, 122); g.lineTo(w / 2 - 36, h - 44); g.moveTo(w / 2 + 12, 122); g.lineTo(w / 2 + 16, h - 44); g.stroke();
  g.beginPath(); g.arc(w / 2 - 12, 150, 7, 0, Math.PI * 2); g.fill();                  // pessoa flutuando
  g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(w / 2 - 8, 160); g.lineTo(w / 2 + 2, 180); g.stroke();       // tronco
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(w / 2 - 6, 164); g.lineTo(w / 2 - 20, 150); g.moveTo(w / 2 - 4, 168); g.lineTo(w / 2 + 12, 164);
  g.moveTo(w / 2 + 2, 180); g.lineTo(w / 2 + 14, 194); g.moveTo(w / 2 + 2, 180); g.lineTo(w / 2 - 10, 194); g.stroke();
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
  b.add(0.5, 0.7, 0.16, 0x2a3348, 0.7, -3.9, 1.8, -0.42);                     // caixa elétrica
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

  // letreiro de neon violeta sobre a máquina, com halo violeta na parede
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.2),
    new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c) => glowDisc(c, 64, 64, 64, 64, '110,75,255', 0.55)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.set(0, 3.4, WALL_Z + WALL_D / 2 + 0.005); halo.renderOrder = 3; g.add(halo);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.9),
    new THREE.MeshBasicMaterial({ map: canvasTex(512, 210, (c, w, h) => paintNeon(c, w, h)), transparent: true, depthWrite: false }));
  sign.position.set(-0.1, 3.35, WALL_Z + WALL_D / 2 + 0.01); sign.renderOrder = 4; g.add(sign);

  const poster = new THREE.Mesh(new THREE.PlaneGeometry(POSTER.w, POSTER.h),
    new THREE.MeshBasicMaterial({ map: canvasTex(512, 610, (c, w, h) => paintPoster(c, w, h, drawQr)), transparent: true, alphaTest: 0.5, color: 0xe2deef }));
  poster.name = 'faucet-poster'; poster.rotation.z = -0.045;
  poster.position.set(POSTER.x, POSTER.y, WALL_Z + WALL_D / 2 + 0.012); g.add(poster);

  // placa de alerta triangular: abdução por OVNI (alpha recortado, sem ordenação)
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9),
    new THREE.MeshBasicMaterial({ map: canvasTex(256, 230, (c, w, h) => paintUfoSign(c, w, h)), transparent: true, alphaTest: 0.5, color: 0xc8c0d8, side: THREE.DoubleSide }));
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
