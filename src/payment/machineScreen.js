import * as THREE from 'three';
import QRCode from 'qrcode';

const W = 256, H = 192;
const COLORS = { red: '#ff0033', black: '#050507', white: '#ffffff', dim: '#80808a' };

export function drawQr(ctx, text, x, y, size) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'L' });
  const n = qr.modules.size, cell = Math.floor(size / (n + 2));
  const total = cell * (n + 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, total, total);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(c, r)) ctx.fillRect(x + (c + 1) * cell, y + (r + 1) * cell, cell, cell);
}

export function createMachineScreen(screenMesh) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  screenMesh.material.map = tex; screenMesh.material.color.set(0xffffff); screenMesh.material.needsUpdate = true;

  function text(t, x, y, size, color = COLORS.white, align = 'left') {
    ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.textAlign = align; ctx.fillText(t, x, y);
  }
  // state: idle | awaiting | sent | confirmed | error
  function draw({ state = 'idle', slot = '', name = '', price = '', qrText = '', message = '' } = {}) {
    ctx.fillStyle = COLORS.black; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = COLORS.red; ctx.strokeRect(1, 1, W - 2, H - 2);
    if (state === 'idle') {
      text('DEFI VENDING', W / 2, 70, 22, COLORS.red, 'center');
      text('SELECIONE UM CARD', W / 2, 110, 14, COLORS.white, 'center');
      if (slot) text(`${slot}  ${price}`, W / 2, 150, 14, COLORS.dim, 'center');
    } else if (state === 'awaiting') {
      text(`${slot} ${price}`, 8, 18, 13, COLORS.red);
      if (qrText) drawQr(ctx, qrText, 8, 26, 160); else text('MODO DEMO', 8, 100, 14);
      text('ESCANEIE', 176, 60, 12); text('PARA PAGAR', 176, 76, 12);
      text(name.slice(0, 18), 8, 186, 11, COLORS.dim);
    } else if (state === 'sent') {
      text('TRANSACAO ENVIADA', W / 2, 90, 14, COLORS.white, 'center');
      text('AGUARDANDO BLOCO...', W / 2, 120, 12, COLORS.dim, 'center');
    } else if (state === 'confirmed') {
      text('PAGO!', W / 2, 90, 30, COLORS.red, 'center');
      text('RETIRE SEU CARD', W / 2, 125, 14, COLORS.white, 'center');
    } else if (state === 'error') {
      text('ERRO', W / 2, 70, 24, COLORS.red, 'center');
      text(message.slice(0, 30), W / 2, 110, 11, COLORS.white, 'center');
    }
    tex.needsUpdate = true;
  }
  draw();
  return { draw, canvas };
}
