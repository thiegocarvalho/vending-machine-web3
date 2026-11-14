import * as THREE from 'three';
import { createBatch } from './baked.js';
import { drawQr } from '../payment/machineScreen.js';
import { config } from '../config.js';

const POST = { x: 3.2, z: 1.2, h: 4.2 };                              // poste de luz ao lado da máquina
const SIGN = { x: -6.0, z: 1.0, yaw: 0.9 };                            // placa de trânsito no fim da rua (limite da área), voltada para o centro
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

export const ROAD = { z0: 4.2, z1: 14.6, w: 60 };           // 10,4 m: duas faixas
// Rua de asfalto (60 m x 10,4 m, duas faixas): granulado, remendos, rachaduras, óleo, poças, marcas de pneu, linhas de borda,
// faixa dupla amarela, faixa de pedestres, setas e bueiros. Coordenadas em metros, convertidas para pixels.
export function paintRoad(g, w, h, rand = Math.random) {
  const mx = w / ROAD.w, mz = h / (ROAD.z1 - ROAD.z0), X = (x) => (x + ROAD.w / 2) * mx, Zm = (z) => z * mz;
  g.fillStyle = '#24262f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 16000; i++) { const v = 28 + rand() * 24; g.fillStyle = `rgba(${v},${v},${v + 6},0.55)`; g.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2); }   // granulado
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(14,14,18,${0.2 + rand() * 0.2})`; g.beginPath(); g.ellipse(rand() * w, rand() * h, 30 + rand() * 120, 8 + rand() * 24, rand(), 0, Math.PI * 2); g.fill(); }   // remendos/óleo
  g.fillStyle = 'rgba(8,8,12,0.2)';                                                              // marcas de pneu (duas por faixa)
  for (const z of [1.7, 2.3, 3.3, 3.9, 6.4, 7.0, 8.1, 8.7]) g.fillRect(0, Zm(z), w, mz * 0.35);
  g.strokeStyle = 'rgba(8,8,10,0.6)'; g.lineWidth = 1.6;                                        // rachaduras
  for (let i = 0; i < 40; i++) { let x = rand() * w, y = rand() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (rand() - 0.3) * 40; y += (rand() - 0.5) * 18; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = '#0d0e14'; g.fillRect(0, 0, w, Zm(0.45)); g.fillRect(0, h - Zm(0.45), w, Zm(0.45));   // sarjetas
  g.fillStyle = 'rgba(225,225,210,0.8)'; g.fillRect(0, Zm(0.75), w, mz * 0.12); g.fillRect(0, h - Zm(0.87), w, mz * 0.12);   // linhas de borda
  g.fillStyle = '#d9b82e'; const mid = h / 2;                                                   // faixa dupla amarela
  g.fillRect(0, mid - mz * 0.17, w, mz * 0.1); g.fillRect(0, mid + mz * 0.07, w, mz * 0.1);
  g.fillStyle = 'rgba(225,225,210,0.85)';                                                       // faixa de pedestres: listras paralelas ao tráfego, de um meio-fio ao outro
  for (let z = 1.0; z + 0.5 <= (ROAD.z1 - ROAD.z0) - 0.9; z += 0.95) g.fillRect(X(-9.5), Zm(z), mx * 4.2, mz * 0.5);
  const arrow = (x, z, dir) => { g.save(); g.translate(X(x), Zm(z)); g.scale(dir, 1); g.beginPath();   // seta de sentido
    g.moveTo(mx * 1.1, 0); g.lineTo(0, -mz * 0.7); g.lineTo(0, -mz * 0.25); g.lineTo(-mx * 1.1, -mz * 0.25); g.lineTo(-mx * 1.1, mz * 0.25); g.lineTo(0, mz * 0.25); g.lineTo(0, mz * 0.7); g.closePath(); g.fill(); g.restore(); };
  g.fillStyle = 'rgba(225,225,210,0.7)'; arrow(5, 2.6, -1); arrow(-14, 2.6, -1); arrow(6, 7.7, 1); arrow(-13, 7.7, 1);
  g.fillStyle = 'rgba(120,130,190,0.14)';                                                        // poças que refletem a luz
  for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(rand() * w, h * (0.15 + rand() * 0.7), 50 + rand() * 90, 8 + rand() * 12, 0, 0, Math.PI * 2); g.fill(); }
  for (const [bx, bz] of [[3, 3.2], [-4, 7.4], [14, 2.8], [-17, 7.2]]) {                         // bueiros
    g.fillStyle = '#0a0b0f'; g.beginPath(); g.arc(X(bx), Zm(bz), mx * 0.38, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a3d4a'; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.moveTo(X(bx) - mx * 0.28, Zm(bz)); g.lineTo(X(bx) + mx * 0.28, Zm(bz)); g.moveTo(X(bx), Zm(bz) - mx * 0.28); g.lineTo(X(bx), Zm(bz) + mx * 0.28); g.stroke();
  }
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
// Gerador pseudoaleatório com semente: o horizonte é sempre o mesmo, e dois lados diferentes.
export function seeded(seed) { let t = seed >>> 0; return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

// Horizonte urbano em 3 camadas com perspectiva atmosférica: prédios distantes enevoados, médios e os mais próximos com janelas acesas.
export function paintSkyline(g, w, h, rand = seeded(7)) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#060a1a'); sky.addColorStop(0.45, '#1a1a42'); sky.addColorStop(0.8, '#52305f'); sky.addColorStop(1, '#8a3f66');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.5})`; g.fillRect(rand() * w, rand() * h * 0.45, 1.5, 1.5); }          // estrelas
  for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(${70 + rand() * 40},${50 + rand() * 30},${120 + rand() * 40},${0.06 + rand() * 0.08})`;       // nuvens
    g.beginPath(); g.ellipse(rand() * w, h * (0.1 + rand() * 0.4), 120 + rand() * 260, 14 + rand() * 26, 0, 0, Math.PI * 2); g.fill(); }
  const glow = g.createLinearGradient(0, h * 0.55, 0, h);                                                                                          // clarão da cidade (uniforme em x: textura sem emenda)
  glow.addColorStop(0, 'rgba(255,120,110,0)'); glow.addColorStop(1, 'rgba(255,120,110,0.42)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);

  const WARM = ['255,205,130', '255,185,100', '255,225,170'], COOL = ['150,205,255', '190,225,255'], POP = ['255,70,150', '90,230,255'];
  const layers = [
    { top: 0.34, bot: 0.78, color: [64, 46, 104], lit: 0.0, dens: 0.0, win: 0 },            // distante: só silhueta enevoada
    { top: 0.28, bot: 0.62, color: [34, 28, 70], lit: 0.28, dens: 0.55, win: 6 },           // meio
    { top: 0.2, bot: 0.5, color: [14, 14, 32], lit: 0.45, dens: 0.8, win: 8 }               // perto
  ];
  layers.forEach((L, li) => {
    const drawBuilding = (x, bw, bh, seed) => {                                   // determinístico por prédio: pode ser desenhado duas vezes (emenda da textura)
      const r = seeded(seed), top = h - bh, [cr, cg, cb] = L.color, k = 0.9 + r() * 0.2;
      g.fillStyle = `rgb(${cr * k | 0},${cg * k | 0},${cb * k | 0})`;
      const type = r();
      if (type < 0.35) { g.fillRect(x, top, bw, bh); g.fillRect(x + bw * 0.2, top - bh * 0.12, bw * 0.6, bh * 0.12); }                          // recuo no topo
      else if (type < 0.5) { g.fillRect(x, top, bw, bh); g.fillRect(x + bw * 0.48, top - bh * 0.25, 3, bh * 0.25);                                // antena com luz de aviso
        g.fillStyle = 'rgba(255,60,60,0.95)'; g.fillRect(x + bw * 0.48 - 1, top - bh * 0.25 - 3, 5, 5); }
      else if (type < 0.6) { g.beginPath(); g.moveTo(x, top + bh * 0.08); g.lineTo(x + bw, top); g.lineTo(x + bw, h); g.lineTo(x, h); g.fill(); }  // topo inclinado
      else g.fillRect(x, top, bw, bh);
      if (L.win) {                                                                                                                                 // janelas em grade, com andares inteiros acesos ou apagados
        const cw = L.win + 4, ch = L.win + 6, cols = Math.max(1, Math.floor((bw - 8) / cw)), rows = Math.floor((bh - 12) / ch);
        const tint = r() < 0.2 ? COOL : WARM;
        for (let rr = 0; rr < rows; rr++) {
          const floorLit = r() < L.dens;
          for (let c = 0; c < cols; c++) if (floorLit && r() < L.lit + 0.35) {
            const col = r() < 0.04 ? POP[(r() * 2) | 0] : tint[(r() * tint.length) | 0];
            g.fillStyle = `rgba(${col},${0.5 + r() * 0.45})`; g.fillRect(x + 4 + c * cw, top + 8 + rr * ch, L.win - 1, L.win);
          }
        }
        if (li === 2 && r() < 0.14) { g.fillStyle = r() < 0.5 ? 'rgba(255,60,170,0.9)' : 'rgba(70,225,255,0.9)'; g.fillRect(x + bw - 5, top + bh * 0.12, 3, bh * 0.45); }   // letreiro vertical neon
      }
    };
    let x = 0;
    while (x < w) {
      const bw = (li === 0 ? 50 : 40) + rand() * (li === 0 ? 120 : 90), bh = h * (L.top + rand() * (L.bot - L.top)) * (0.55 + 0.45 * rand());
      const seed = (rand() * 4294967295) >>> 0;
      drawBuilding(x, bw, bh, seed);
      if (x + bw > w) drawBuilding(x - w, bw, bh, seed);                                                                                           // continua do outro lado: textura repetível sem emenda
      x += bw + rand() * 8;
    }
    const haze = g.createLinearGradient(0, h * 0.4, 0, h);                                                                                          // névoa mais forte atrás
    haze.addColorStop(0, 'rgba(110,60,120,0)'); haze.addColorStop(1, `rgba(140,70,120,${0.5 - li * 0.18})`);
    g.fillStyle = haze; g.fillRect(0, 0, w, h);
  });
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
  // calçada junto ao muro, meio-fio, rua de asfalto 15 cm abaixo e calçada do outro lado
  const pave = canvasTex(128, 128, (c, w, h) => paintPaving(c, w, h), { repeat: [30, 12] });
  const flat = (w, d, x, z, y, map, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map, color }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(m); return m;
  };
  const near = flat(60, 4.5, 0, 1.75, 0, pave, 0xa0a8c4);                       // calçada z -0.5..4.0
  const farWalk = flat(60, 16, 0, ROAD.z1 + 0.2 + 8, 0, pave.clone(), 0x8890ac); farWalk.material.map.repeat.set(30, 8); farWalk.material.map.needsUpdate = true;
  const roadTex = canvasTex(4096, 512, (c, w, h) => paintRoad(c, w, h));
  roadTex.anisotropy = 8;
  flat(ROAD.w, ROAD.z1 - ROAD.z0, 0, (ROAD.z0 + ROAD.z1) / 2, -0.15, roadTex, 0xd2d6ec);

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
  b.add(60, 0.15, 0.2, 0x8a93a8, 0.9, 0, -0.075, 4.1);                         // meio-fio (lado da calçada)
  b.add(60, 0.15, 0.2, 0x8a93a8, 0.9, 0, -0.075, ROAD.z1 + 0.1);                         // meio-fio (outro lado)
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
    new THREE.MeshBasicMaterial({ map: canvasTex(POSTER_PX.w, POSTER_PX.h, (c, w, h) => paintPoster(c, w, h, drawQr)), transparent: true, alphaTest: 0.5, color: 0xe2deef }));
  poster.name = 'faucet-poster'; poster.rotation.z = -0.045;
  poster.position.set(POSTER.x, POSTER.y, WALL_Z + WALL_D / 2 + 0.012); g.add(poster);

  // placa de alerta triangular: abdução por OVNI (alpha recortado, sem ordenação)
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9),
    new THREE.MeshBasicMaterial({ map: canvasTex(256, 230, (c, w, h) => paintUfoSign(c, w, h)), transparent: true, alphaTest: 0.5, color: 0xc8c0d8, side: THREE.DoubleSide }));
  disc.rotation.y = SIGN.yaw;
  disc.position.set(SIGN.x + Math.sin(SIGN.yaw) * 0.05, 2.75, SIGN.z + Math.cos(SIGN.yaw) * 0.05); g.add(disc);

  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.2), new THREE.MeshBasicMaterial({ color: 0xfff1d0 }));
  bulb.position.set(POST.x - 0.95, POST.h - 0.12, POST.z); g.add(bulb);        // lâmpada acesa

  // horizonte urbano distante, visto por cima do muro
  const skyGeo = new THREE.PlaneGeometry(2000, 55);                                   // larguíssimo e repetido: sem borda visível ao olhar ao longo da rua
  const skyTex = (seed) => canvasTex(2048, 512, (c, w, h) => paintSkyline(c, w, h, seeded(seed)), { repeat: [9, 1] });
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: skyTex(7), fog: false }));
  sky.position.set(0, 20, -40); g.add(sky);
  const sky2 = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: skyTex(11), fog: false }));
  sky2.position.set(0, 20, 45); sky2.rotation.y = Math.PI; g.add(sky2);                                          // fundo do outro lado da rua
  return g;
}

export function addLighting(scene) {
  // Sem luzes dinâmicas: a iluminação está assada nas cores (baked.js) e no chão; só névoa e fundo.
  scene.fog = new THREE.Fog(FOG, 9, 28);
  scene.background = new THREE.Color(0x060a1a);        // topo do céu (igual ao topo do horizonte pintado), diferente da cor da neblina
}
