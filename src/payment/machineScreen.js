import * as THREE from 'three';
import * as QRCode from 'qrcode/lib/core/qrcode.js';
import { LCD, drawLcdText, paintLcdBackground, fitDot, clip, wrapText, textWidth } from './lcd.js';

export const SCREEN_W = 256, SCREEN_H = 384;
export const BUTTON = { x: 12, y: 318, w: 232, h: 50 };         // botão "pagar com carteira" na telinha 3D
const QR_COLORS = { bg: '#cfdea6', fg: '#10190a' };             // QR em tom de LCD: escuro sobre claro, contraste alto (lê normalmente)

export function drawQr(ctx, text, x, y, size, { bg = '#fff', fg = '#000' } = {}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'L' });
  const n = qr.modules.size, cell = Math.floor(size / (n + 2));
  const total = cell * (n + 2);
  ctx.fillStyle = bg; ctx.fillRect(x, y, total, total);
  ctx.fillStyle = fg;
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
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;   // pontos e QR nítidos
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  screenMesh.material.map = tex; screenMesh.material.color.set(0xffffff); screenMesh.material.needsUpdate = true;

  const MAXW = SCREEN_W - 28;
  // texto LCD: encolhe o ponto (até 2) e, se ainda não couber, corta com reticências
  const line = (t, y, dot, o = {}) => {
    const str = String(t).toUpperCase(), d = fitDot(str, MAXW, dot, 2), s2 = clip(str, MAXW, d);
    return drawLcdText(ctx, s2, o.align === 'left' ? 14 : SCREEN_W / 2, y, { dot: d, align: o.align || 'center', color: o.color });
  };
  const lines = (t, y, dot, maxChars) => wrapText(String(t).toUpperCase(), maxChars).slice(0, 4).forEach((l, i) => line(l, y + i * (7 * dot + 5), dot));
  function button(label, { hover = false, enabled = true } = {}) {
    const { x, y, w, h } = BUTTON;
    if (!enabled) { ctx.strokeStyle = 'rgba(23,35,12,0.5)'; ctx.setLineDash?.([4, 3]); ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.setLineDash?.([]); }
    else if (hover) { ctx.fillStyle = LCD.paperHi; ctx.fillRect(x, y, w, h); ctx.strokeStyle = LCD.ink; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4); }   // invertido ao passar o mouse
    else { ctx.fillStyle = LCD.ink; ctx.fillRect(x, y, w, h); }
    const ink = !enabled ? 'rgba(23,35,12,0.55)' : hover ? LCD.ink : LCD.paperHi;
    const str = label.toUpperCase(), d = fitDot(str, w - 20, 3, 2);
    drawLcdText(ctx, str, x + w / 2, y + (h - 7 * d) / 2, { dot: d, align: 'center', color: ink, shadow: false });
  }

  // state: idle | select | awaiting | sent | confirmed | error
  function draw({ state = 'idle', slot = '', name = '', price = '', stock, soldOut = false, qrText = '', message = '', hover = false, wallet = 'ok' } = {}) {
    paintLcdBackground(ctx, SCREEN_W, SCREEN_H);
    if (state === 'idle') {
      line('DEFI', 96, 8); line('VENDING', 168, 3); line('MACHINE', 196, 3);
      line('ESCOLHA UM CARD', 300, 2); line('_', 322, 3);
    } else if (state === 'select') {
      line(slot, 40, 9);
      lines(name, 130, 3, 14);
      if (soldOut) { line('ESGOTADO', 206, 5); line('INDISPONIVEL', 330, 2); }
      else { line(price, 214, 4); if (stock !== undefined) line(`ESTOQUE ${stock}/100`, 262, 2); line('CONFIRME PARA PAGAR', 330, 2); }
    } else if (state === 'awaiting') {
      line(`${slot} · ${price}`, 14, 2);
      if (qrText) drawQr(ctx, qrText, 28, 36, 200, QR_COLORS); else line('MODO DEMO', 130, 3);
      lines('ESCANEIE OU PAGUE COM A CARTEIRA', 242, 2, 17);
      line(name, 296, 2);
      button(wallet === 'none' ? 'SEM CARTEIRA' : 'PAGAR COM CARTEIRA', { hover, enabled: wallet !== 'none' });
    } else if (state === 'sent') {
      line('TRANSACAO', 118, 4); line('ENVIADA', 158, 4); line('AGUARDANDO O BLOCO…', 230, 2);
    } else if (state === 'confirmed') {
      line('PAGO!', 100, 8); line('CARD ADQUIRIDO', 200, 3);
    } else if (state === 'error') {
      line('ERRO', 40, 8); lines(message, 120, 2, 17); button('TENTAR NOVAMENTE', { hover });
    }
    tex.needsUpdate = true;
  }
  draw();
  return { draw, canvas };
}
