import * as THREE from 'three';
import * as QRCode from 'qrcode/lib/core/qrcode.js';

export const SCREEN_W = 256, SCREEN_H = 384;
export const BUTTON = { x: 20, y: 318, w: 216, h: 50 };         // botão "pagar com carteira" na telinha 3D
const C = { bg: '#06122c', neon: '#8fd8ff', red: '#ff0033', white: '#ffffff', dim: '#7f93b8' };
const FONT = (px, w = 'bold') => `${w} ${px}px "Space Grotesk", system-ui, sans-serif`;

export function drawQr(ctx, text, x, y, size) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'L' });
  const n = qr.modules.size, cell = Math.floor(size / (n + 2));
  const total = cell * (n + 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, total, total);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(c, r)) ctx.fillRect(x + (c + 1) * cell, y + (r + 1) * cell, cell, cell);
  return total;                                    // lado real desenhado (múltiplo da célula)
}

// uv da telinha (origem embaixo-esquerda) -> está sobre o botão?
export function buttonHit(uv) {
  if (!uv) return false;
  const x = uv.x * SCREEN_W, y = (1 - uv.y) * SCREEN_H;
  return x >= BUTTON.x && x <= BUTTON.x + BUTTON.w && y >= BUTTON.y && y <= BUTTON.y + BUTTON.h;
}

export function createMachineScreen(screenMesh) {
  const canvas = document.createElement('canvas'); canvas.width = SCREEN_W; canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;   // QR nítido
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  screenMesh.material.map = tex; screenMesh.material.color.set(0xffffff); screenMesh.material.needsUpdate = true;

  const text = (t, x, y, px, color = C.white, align = 'center', weight = 'bold') => {
    ctx.fillStyle = color; ctx.font = FONT(px, weight); ctx.textAlign = align; ctx.fillText(t, x, y);
  };
  function button(label, { hover = false, enabled = true } = {}) {
    ctx.fillStyle = !enabled ? '#2a3552' : hover ? '#ff4d6a' : C.red;
    ctx.fillRect(BUTTON.x, BUTTON.y, BUTTON.w, BUTTON.h);
    ctx.strokeStyle = enabled ? C.white : C.dim; ctx.lineWidth = hover ? 3 : 1.5; ctx.strokeRect(BUTTON.x, BUTTON.y, BUTTON.w, BUTTON.h);
    text(label, BUTTON.x + BUTTON.w / 2, BUTTON.y + BUTTON.h / 2 + 6, 17, enabled ? C.white : C.dim);
  }

  // state: idle | select | awaiting | sent | confirmed | error
  function draw({ state = 'idle', slot = '', name = '', price = '', stock, qrText = '', message = '', hover = false, wallet = 'ok' } = {}) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.strokeStyle = C.neon; ctx.lineWidth = 3; ctx.strokeRect(2, 2, SCREEN_W - 4, SCREEN_H - 4);
    if (state === 'idle') {
      text('DEFI', SCREEN_W / 2, 130, 44, C.neon); text('VENDING MACHINE', SCREEN_W / 2, 164, 20);
      text('APROXIME-SE E USE', SCREEN_W / 2, 250, 13, C.dim, 'center', 'normal');
    } else if (state === 'select') {
      text(slot, SCREEN_W / 2, 100, 58, C.red);
      text(name.slice(0, 22), SCREEN_W / 2, 150, 17);
      text(price, SCREEN_W / 2, 200, 24, C.neon);
      if (stock !== undefined) text(stock <= 0 ? 'ESGOTADO' : `ESTOQUE ${stock}/100`, SCREEN_W / 2, 232, 13, C.dim, 'center', 'normal');
      text('CONFIRME PARA PAGAR', SCREEN_W / 2, 300, 13, C.dim, 'center', 'normal');
    } else if (state === 'awaiting') {
      text(`${slot} · ${price}`, SCREEN_W / 2, 30, 17, C.neon);
      if (qrText) drawQr(ctx, qrText, 28, 42, 200); else text('MODO DEMO', SCREEN_W / 2, 150, 18);
      text('ESCANEIE OU PAGUE COM A CARTEIRA', SCREEN_W / 2, 270, 10.5, C.dim, 'center', 'normal');
      text(name.slice(0, 26), SCREEN_W / 2, 292, 12, C.white, 'center', 'normal');
      button(wallet === 'none' ? 'SEM CARTEIRA' : 'PAGAR COM CARTEIRA', { hover, enabled: wallet !== 'none' });
    } else if (state === 'sent') {
      text('TRANSAÇÃO ENVIADA', SCREEN_W / 2, 160, 18); text('aguardando o bloco…', SCREEN_W / 2, 196, 14, C.dim, 'center', 'normal');
    } else if (state === 'confirmed') {
      text('PAGO!', SCREEN_W / 2, 160, 52, C.red); text('RETIRE SEU CARD', SCREEN_W / 2, 210, 18);
    } else if (state === 'error') {
      text('ERRO', SCREEN_W / 2, 110, 36, C.red);
      const words = message.split(' '); let line = '', y = 160;
      for (const w of words) { if ((line + w).length > 24) { text(line, SCREEN_W / 2, y, 13, C.white, 'center', 'normal'); line = ''; y += 20; } line += w + ' '; }
      text(line, SCREEN_W / 2, y, 13, C.white, 'center', 'normal');
      button('TENTAR NOVAMENTE', { hover });
    }
    tex.needsUpdate = true;
  }
  draw();
  return { draw, canvas };
}
