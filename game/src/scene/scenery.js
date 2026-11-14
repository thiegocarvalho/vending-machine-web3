import * as THREE from 'three';
import { createBatch } from './baked.js';
import { drawQr } from '../payment/machineScreen.js';
import { config } from '../config.js';

const POST = { x: 3.2, z: 3.4, h: 4.2 };                              // poste de luz ao lado da máquina
const FOG = 0x141a2e;                           // neblina azul-arroxeada da noite

let ANISO = 4;                                  // definido por buildScenery conforme o nível de qualidade
const canvasTex = (w, h, draw, { repeat, srgb = true } = {}) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = ANISO; }
  return t;
};
const glowDisc = (g, x, y, rx, ry, rgb, a) => {                  // elipse com gradiente (luz suave)
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  r.addColorStop(0, `rgba(${rgb},${a})`); r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
};

// Calçada: uma única laje (concreto liso com junta fina e um brilho leve na quina), repetida. Textura mínima: 64x64, sem aleatoriedade.
export function paintPaving(ctx, w, h) {
  ctx.fillStyle = '#3b404d'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, 0, 2, h);          // quina iluminada
  ctx.fillStyle = '#12151f'; ctx.fillRect(w - 2, 0, 2, h); ctx.fillRect(0, h - 2, w, 2);                   // junta
}

export const ROAD = { z0: 4.2, z1: 14.6, w: 60 };           // 10,4 m: duas faixas
const ROAD_H = ROAD.z1 - ROAD.z0, ROAD_TILE = 2;           // largura em z (m); o asfalto repete a cada 2 m

// Asfalto: um ladrilho pequeno e repetido (nítido de perto, quase sem memória). Só granulado fino, que repete sem emenda visível.
export function paintAsphalt(g, w, h, rand = Math.random) {
  const k = w / 256;                                                                             // escala as quantidades pela resolução
  g.fillStyle = '#2b2d34'; g.fillRect(0, 0, w, h);
  for (let i = 0, n = Math.round(5200 * k * k); i < n; i++) {                                   // pedrinhas escuras e claras
    const v = rand() < 0.55 ? 14 + rand() * 24 : 52 + rand() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 5},${0.3 + rand() * 0.3})`; const sz = rand() < 0.8 ? 1 : 2; g.fillRect(rand() * w, rand() * h, sz, sz);
  }
}

// Desgaste: camada translúcida (manchas, trilhas de roda, rachaduras e tinta gasta sobre as faixas) que quebra a repetição do ladrilho.
// Mesmo mapeamento da rua inteira: x em [-30, 30] m, y = 0 na borda de z0.
export function paintRoadWear(g, w, h, rand = Math.random) {
  const mx = w / ROAD.w, mz = h / ROAD_H, X = (x) => (x + ROAD.w / 2) * mx, Zm = (z) => z * mz;
  g.clearRect(0, 0, w, h);
  for (let i = 0, n = 70; i < n; i++) {                                                          // manchas largas e suaves
    const dark = rand() < 0.55, rx = (2 + rand() * 7) * mx;
    g.save(); g.translate(rand() * w, rand() * h); g.scale(1, (0.5 + rand() * 1.2) * mz / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, dark ? 'rgba(6,6,10,0.20)' : 'rgba(90,94,108,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
  }
  for (const zc of [2.0, 3.6, 6.8, 8.4]) {                                                       // trilhas de roda
    const gr = g.createLinearGradient(0, Zm(zc - 0.7), 0, Zm(zc + 0.7));
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(8,8,12,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, Zm(zc - 0.7), w, Zm(1.4));
  }
  g.strokeStyle = 'rgba(6,6,9,0.55)'; g.lineWidth = Math.max(1, w / 2400);                       // poucas rachaduras finas
  for (let i = 0; i < 9; i++) { let x = rand() * w, y = rand() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (rand() - 0.2) * 0.5 * mx; y += (rand() - 0.5) * 0.18 * mz; g.lineTo(x, y); } g.stroke(); }
  const mid = Zm(ROAD_H / 2);                                                                    // tinta gasta: pontos de asfalto sobre a faixa central e a de pedestres
  for (let i = 0, n = Math.round(9000 * w * h / (2048 * 256)); i < n; i++) {
    const x = rand() * w, y = rand() * h;
    if (Math.abs(y - mid) < mz * 0.4 || (x > X(-9.6) && x < X(-5.2))) { g.fillStyle = `rgba(40,42,50,${0.4 + rand() * 0.3})`; g.fillRect(x, y, 1 + rand(), 1 + rand()); }
  }
}

// Marcações da rua como caixas finas no lote estático (nítidas em qualquer resolução, sem textura).
export function addRoadMarkings(batch, y = -0.145) {
  const T = 0.01, L = 0.78, zc = (z) => ROAD.z0 + z, bar = (w, d, x, z, hex) => batch.add(w, T, d, hex, L, x, y, zc(z));
  bar(ROAD.w, 0.45, 0, 0.225, 0x0f1016); bar(ROAD.w, 0.45, 0, ROAD_H - 0.225, 0x0f1016);        // sarjetas
  bar(ROAD.w, 0.12, 0, 0.81, 0xdcdcd0); bar(ROAD.w, 0.12, 0, ROAD_H - 0.81, 0xdcdcd0);          // linhas de borda
  bar(ROAD.w, 0.1, 0, ROAD_H / 2 - 0.12, 0xd9b82e); bar(ROAD.w, 0.1, 0, ROAD_H / 2 + 0.12, 0xd9b82e);   // faixa dupla amarela
  for (let z = 1.0; z + 0.5 <= ROAD_H - 0.9; z += 0.95) bar(4.2, 0.5, -9.5 + 2.1, z + 0.25, 0xe1e1d2);   // faixa de pedestres
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

// Cartaz vintage-brutalista colado na parede (à esquerda da máquina): tipografia pesada esticada, blocos duros, uma cor de tinta,
// papel envelhecido e o QR do faucet da Sepolia. Layout em coordenadas calculadas: nada passa por baixo das faixas.
export const POSTER = { x: -2.3, y: 1.9, w: 1.05, h: 1.56 };
export const POSTER_PX = { w: 512, h: 760 };
const HEAVY = '"Bebas Neue","Impact","Haettenschweiler","Arial Narrow",sans-serif', MONO = '"Fira Code","Courier New",monospace';
// Texto pesado esticado na largura alvo (tipografia brutalista); o contorno engrossa fontes finas de reserva.
function stretch(g, text, x, baseline, px, targetW, color) {
  g.font = `900 ${px}px ${HEAVY}`;
  const w = g.measureText?.(text)?.width;
  const sx = w ? Math.max(0.6, Math.min(2, targetW / w)) : 1;
  g.save(); g.translate(x, baseline); g.scale(sx, 1);
  g.fillStyle = color; g.strokeStyle = color; g.lineJoin = 'miter'; g.lineWidth = px * 0.012;
  g.fillText(text, 0, 0); g.strokeText(text, 0, 0); g.restore();
}
export function paintPoster(g, w, h, qr = () => 0, rand = Math.random) {
  const INK = '#15110e', RED = '#d9302f', PAPER = '#d8d0b8', M = 30, BAR = 56, FOOT = 92;
  g.clearRect(0, 0, w, h);
  g.fillStyle = PAPER; g.fillRect(0, 0, w, h);                                              // papel envelhecido
  const tone = g.createLinearGradient(0, 0, 0, h); tone.addColorStop(0, 'rgba(120,90,40,0.16)'); tone.addColorStop(1, 'rgba(60,40,20,0.28)');
  g.fillStyle = tone; g.fillRect(0, 0, w, h);

  g.fillStyle = INK; g.fillRect(0, 0, w, BAR);                                               // faixa superior
  g.fillStyle = PAPER; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `bold 19px ${MONO}`;
  g.fillText('SEPOLIA TESTNET', M, BAR / 2); g.textAlign = 'right'; g.fillText('Nº 11155111', w - M, BAR / 2);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';

  const PX = 190, cap = PX * 0.7;                                                            // título gigante, esticado na largura
  const freeY = BAR + 28 + cap, gasY = freeY + cap + 30;
  stretch(g, 'FREE', M, freeY, PX, w - 2 * M, INK);
  stretch(g, 'GAS', M + 6, gasY + 5, PX, w - 2 * M, INK);                                    // erro de registro: sombra preta deslocada
  stretch(g, 'GAS', M, gasY, PX, w - 2 * M, RED);
  const ruleY = gasY + 26;
  g.fillStyle = INK; g.fillRect(M, ruleY, w - 2 * M, 12);                                    // régua grossa

  // QR dentro do espaço entre a régua e a faixa inferior, com sombra dura calculada a partir do tamanho real
  const top = ruleY + 12 + 30, bottom = h - FOOT - 28 - 12;
  const side = Math.min(bottom - top, 232), qx = M, qy = top;
  const total = qr(g, config.faucetUrl, qx + 10, qy + 10, side - 20) || side - 20;
  const box = total + 20;
  g.fillStyle = '#fff';                                                                       // margem branca ao redor do QR (zona de silêncio)
  g.fillRect(qx, qy, box, 10); g.fillRect(qx, qy + 10 + total, box, 10); g.fillRect(qx, qy, 10, box); g.fillRect(qx + 10 + total, qy, 10, box);
  g.fillStyle = INK; g.fillRect(qx + box, qy + 12, 12, box); g.fillRect(qx + 12, qy + box, box, 12);   // sombra dura (direita e abaixo)
  g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(qx - 4, qy - 4, box + 8, box + 8);

  const tx = qx + box + 36, tw = w - tx - M;                                                 // coluna de texto (sem instruções de teclado)
  const lines = [['ETH', INK], ['DE TESTE', INK], ['CUSTO', INK], ['ZERO', RED]];
  const lh = box / lines.length;
  lines.forEach(([t, c], i) => stretch(g, t, tx, qy + lh * (i + 1) - lh * 0.18, lh * 0.9, tw * (t === 'DE TESTE' ? 1 : 0.8), c));

  g.fillStyle = INK; g.fillRect(0, h - FOOT, w, FOOT);                                       // faixa inferior
  g.fillStyle = PAPER; g.textBaseline = 'middle'; g.font = `bold 21px ${MONO}`;
  g.fillText('cloud.google.com/web3/faucet', M, h - FOOT + 32);
  g.font = `bold 16px ${MONO}`; g.fillStyle = RED; g.fillText('FAUCET · GOOGLE · SEPOLIA', M, h - FOOT + 64); g.textBaseline = 'alphabetic';

  for (let i = 0; i < 600; i++) {                                                            // retícula de pontos (meio-tom) no canto
    const x = w - 170 + (i % 30) * 6, y = BAR + 8 + Math.floor(i / 30) * 6;
    if (x < w - 8 && rand() > 0.15) { g.fillStyle = `rgba(21,17,14,${0.12 + (y - BAR) / 420})`; g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
  }
  for (let i = 0; i < 10; i++) {                                                             // manchas de umidade
    g.fillStyle = `rgba(${80 + rand() * 40},${55 + rand() * 30},20,${0.05 + rand() * 0.1})`;
    g.beginPath(); g.ellipse(rand() * w, rand() * h, 20 + rand() * 70, 10 + rand() * 45, rand() * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.5;                                // arranhões
  for (let i = 0; i < 16; i++) { g.beginPath(); const x = rand() * w, y = rand() * h; g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 140, y + (rand() - 0.5) * 140); g.stroke(); }
  for (const f of [0.33, 0.66]) {                                                            // dobras do papel
    g.strokeStyle = 'rgba(0,0,0,0.26)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h * f); g.lineTo(w, h * f + 3); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.38)'; g.beginPath(); g.moveTo(0, h * f + 2); g.lineTo(w, h * f + 5); g.stroke();
  }
  const edge = g.createLinearGradient(0, 0, w, 0);                                           // bordas gastas
  edge.addColorStop(0, 'rgba(0,0,0,0.28)'); edge.addColorStop(0.06, 'rgba(0,0,0,0)'); edge.addColorStop(0.94, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = edge; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';                                            // só dois cantos rasgados, pequenos (nada de conteúdo cortado)
  g.beginPath(); g.moveTo(w, 0); g.lineTo(w - 46, 0); g.lineTo(w - 30, 18); g.lineTo(w - 12, 12); g.lineTo(w, 40); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, h); g.lineTo(34, h); g.lineTo(18, h - 20); g.lineTo(0, h - 28); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(210,190,110,0.7)';                                                     // fita nos cantos de cima
  g.save(); g.translate(26, 14); g.rotate(-0.6); g.fillRect(-34, -9, 70, 18); g.restore();
  g.save(); g.translate(w - 110, 10); g.rotate(0.3); g.fillRect(-34, -9, 70, 18); g.restore();
}


// Horizonte urbano ao fundo (visto por cima do muro): prédios com janelas acesas na neblina.

// Parede de tijolos atrás da máquina, até o horizonte (a névoa esconde o fim). Fonte única para geometria e colisão.
const WALL_H = 4.5, WALL_W = 60, WALL_Z = -0.8, WALL_D = 0.6;
export const SCENERY_COLLIDERS = [
  { minX: -WALL_W / 2, maxX: WALL_W / 2, minZ: WALL_Z - WALL_D / 2, maxZ: WALL_Z + WALL_D / 2 },
  { minX: POST.x - 0.15, maxX: POST.x + 0.15, minZ: POST.z - 0.15, maxZ: POST.z + 0.15 }
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

export function buildScenery({ aniso = 4, roadPx = 4096 } = {}) {
  ANISO = aniso;
  const g = new THREE.Group();
  // calçada junto ao muro, meio-fio, rua de asfalto 15 cm abaixo e calçada do outro lado
  const SLAB = 1.5;                                                              // 1 laje = 1,5 m; uma textura só serve às duas calçadas
  const pave = canvasTex(64, 64, (c, w, h) => paintPaving(c, w, h), { repeat: [1, 1] }); pave.anisotropy = Math.min(ANISO, 4);
  const flat = (w, d, x, z, y, map, color = 0xffffff, tile = 0) => {
    const geo = new THREE.PlaneGeometry(w, d);
    if (tile) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (d / tile)); }   // UV em metros: lajes do mesmo tamanho em qualquer plano
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, color }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(m); return m;
  };
  flat(60, 4.5, 0, 1.75, 0, pave, 0xa0a8c4, SLAB);                                 // calçada z -0.5..4.0
  flat(60, 16, 0, ROAD.z1 + 0.2 + 8, 0, pave, 0x8890ac, SLAB);                     // calçada do outro lado
  const tilePx = roadPx <= 1024 ? 128 : 256;                                       // asfalto: ladrilho de 2 m (64 a 128 px/m), repetido
  const roadTex = canvasTex(tilePx, tilePx, (c, w, h) => paintAsphalt(c, w, h), { repeat: [1, 1] });
  roadTex.anisotropy = Math.max(1, aniso * 2);
  flat(ROAD.w, ROAD_H, 0, (ROAD.z0 + ROAD.z1) / 2, -0.15, roadTex, 0xd2d6ec, ROAD_TILE);
  const wearTex = canvasTex(roadPx / 2, roadPx / 16, (c, w, h) => paintRoadWear(c, w, h));    // desgaste: baixa resolução basta (é suave)
  const wear = flat(ROAD.w, ROAD_H, 0, (ROAD.z0 + ROAD.z1) / 2, -0.1485, wearTex, 0xffffff);
  wear.material.transparent = true; wear.material.depthWrite = false;

  const wet = new THREE.Mesh(new THREE.PlaneGeometry(LIGHT.size, LIGHT.size),                  // luz/reflexos sobre o chão molhado
    new THREE.MeshBasicMaterial({ map: groundLightTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  wet.rotation.x = -Math.PI / 2; wet.position.y = 0.012; wet.renderOrder = 1; g.add(wet);

  // tudo que é estático e sólido vai para UM objeto (1 draw call)
  const b = createBatch();
  b.add(WALL_W, 0.28, 0.05, 0x222a3a, 0.7, 0, 0.14, -0.49);                  // rodapé
  b.add(0.5, 0.7, 0.16, 0x2a3348, 0.7, -3.9, 1.8, -0.42);                     // caixa elétrica
  b.add(0.16, POST.h, 0.16, 0x232b3c, 0.8, POST.x, POST.h / 2, POST.z);        // poste de luz
  b.add(0.3, 0.3, 0.3, 0x232b3c, 0.8, POST.x, 0.15, POST.z);
  b.add(1.0, 0.1, 0.1, 0x232b3c, 0.8, POST.x - 0.45, POST.h - 0.05, POST.z);
  b.add(0.55, 0.1, 0.3, 0x2c3650, 0.9, POST.x - 0.95, POST.h - 0.05, POST.z);
  b.add(60, 0.15, 0.2, 0x8a93a8, 0.9, 0, -0.075, 4.1);                         // meio-fio (lado da calçada)
  b.add(60, 0.15, 0.2, 0x8a93a8, 0.9, 0, -0.075, ROAD.z1 + 0.1);                         // meio-fio (outro lado)
  addRoadMarkings(b);
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
    new THREE.MeshBasicMaterial({ map: canvasTex(POSTER_PX.w, POSTER_PX.h, (c, w, h) => paintPoster(c, w, h, drawQr)), transparent: true, alphaTest: 0.5, color: 0xe2deef }));
  poster.name = 'faucet-poster'; poster.rotation.z = -0.045;
  poster.position.set(POSTER.x, POSTER.y, WALL_Z + WALL_D / 2 + 0.012); g.add(poster);

  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.2), new THREE.MeshBasicMaterial({ color: 0xfff1d0 }));
  bulb.position.set(POST.x - 0.95, POST.h - 0.12, POST.z); g.add(bulb);        // lâmpada acesa

  return g;
}

export function addLighting(scene) {
  // Sem luzes dinâmicas: a iluminação está assada nas cores (baked.js) e no chão; só névoa e fundo.
  scene.fog = new THREE.Fog(FOG, 9, 28);
  scene.background = new THREE.Color(FOG);
}
