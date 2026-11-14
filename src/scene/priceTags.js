import * as THREE from 'three';
import { formatEther } from '../data/rpc.js';
import { drawLcdText, textWidth, LCD } from '../payment/lcd.js';

// Etiquetas de preço (ETH) à frente de cada card, como as etiquetas de prateleira de uma máquina de verdade.
// Todas as 30 num só objeto (1 draw call): uma malha de 30 quadrados com UV num atlas de 6x5 etiquetas.
// dy/dz: posição da etiqueta em relação ao centro do card — na borda da prateleira (abaixo e à frente), longe do card.
export const TAG = { cols: 6, rows: 5, cw: 128, ch: 32, w: 0.15, h: 0.03, dy: -0.1475, dz: 0.111 };

export function formatPrice(wei) {
  const s = formatEther(wei);
  return s.length > 8 ? (s.slice(0, 8).replace(/\.?0+$/, '') || '0') : s;
}

// O que a etiqueta mostra: preço, ESGOTADO (sem estoque) ou INATIVO (card desativado no contrato).
export function tagFor(info) {
  if (!info) return { kind: 'price', text: '— ETH' };
  if (info.offline) return { kind: 'off', text: 'SEM REDE' };                       // sem conexão com o contrato
  if (info.missing) return { kind: 'off', text: 'SEM CARD' };                    // o contrato tem menos cards que espaços na máquina
  if (!info.active && info.stock > 0) return { kind: 'off', text: 'INATIVO' };
  if (info.stock <= 0) return { kind: 'sold', text: 'ESGOTADO' };
  return { kind: 'price', text: `${formatPrice(info.price)} ETH` };
}

const STYLE = {
  price: { bg: LCD.paperHi, ink: LCD.ink, edge: 'rgba(23,35,12,0.6)' },
  sold:  { bg: '#1b0609', ink: '#ff3b4d', edge: '#5a0f18' },
  off:   { bg: '#23262e', ink: '#9aa1b3', edge: '#4a4f5c' }
};

export function paintTag(g, kind, text, x, y, cw = TAG.cw, ch = TAG.ch) {
  const st = STYLE[kind];
  g.fillStyle = st.bg; g.fillRect(x, y, cw, ch);
  g.strokeStyle = st.edge; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
  const dot = 2, tw = textWidth(text, dot);
  drawLcdText(g, text, x + (cw - tw) / 2, y + (ch - 7 * dot) / 2, { dot, color: st.ink, shadow: kind === 'price' });
}

export function createPriceTags(anchors, infos) {
  const canvas = document.createElement('canvas'); canvas.width = TAG.cols * TAG.cw; canvas.height = TAG.rows * TAG.ch;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.anisotropy = 4;
  const n = anchors.length, pos = new Float32Array(n * 12), uv = new Float32Array(n * 8), idx = [];
  const wp = new THREE.Vector3();
  anchors.forEach((a, i) => {
    a.updateWorldMatrix(true, false); a.getWorldPosition(wp);
    // etiqueta reta (sem a inclinação do card) na frente da prateleira: centro do card + (0, dy, dz), plano vertical
    const hw = TAG.w / 2, hh = TAG.h / 2, cx = wp.x, cy = wp.y + TAG.dy, cz = wp.z + TAG.dz;
    [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(([x, y], k) => pos.set([cx + x, cy + y, cz], i * 12 + k * 3));
    const col = i % TAG.cols, row = Math.floor(i / TAG.cols), u0 = col / TAG.cols, u1 = (col + 1) / TAG.cols, v1 = 1 - row / TAG.rows, v0 = 1 - (row + 1) / TAG.rows;
    uv.set([u0, v0, u1, v0, u1, v1, u0, v1], i * 8);
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
  mesh.frustumCulled = false;                        // malha espalhada pela máquina inteira
  function update(list) {
    list.forEach((info, i) => { const t = tagFor(info); paintTag(ctx, t.kind, t.text, (i % TAG.cols) * TAG.cw, Math.floor(i / TAG.cols) * TAG.ch); });
    tex.needsUpdate = true;
  }
  update(infos);
  return { mesh, update };
}
