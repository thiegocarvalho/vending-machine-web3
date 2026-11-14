import * as THREE from 'three';
import { createBatch, bakedMaterial } from './baked.js';
import { drawLed } from './led.js';
import { ROWS, COLS, TOTAL, cardIdToSlot } from '../grid.js';

const MACHINE_LIGHT = 1.25;                        // foco de luz sobre a máquina (assado)
const W = 1.9, H = 2.4, D = 0.95;                 // corpo (m)
const WIN = { x0: -W / 2 + 0.1, x1: 0.35, y0: 0.55, y1: H - 0.15 };   // janela de vidro (esquerda)
const BLUE = 0x2f90f5, BLUE_DARK = 0x2577dc, NAVY = 0x0c2766, NEON = 0x8fd8ff, WHITE = 0xe9f0fb;
const COL = { cx: 0.675, cw: 0.46 };              // coluna de controle (direita)

// Caixa de colisão em planta (x/z) da máquina, incluindo o gabinete de vidro que sobressai à frente.
export const MACHINE_COLLIDER = { minX: -W / 2 - 0.05, maxX: W / 2 + 0.05, minZ: -D / 2, maxZ: D / 2 + 0.2 };

// Geometria da coluna de controle (usada também pela câmera para enquadrar a telinha).
export const PANEL = {
  led:    { x: COL.cx, y: H - 0.42, w: 0.4, h: 0.085 },   // só mostra DISPONIVEL / INDISPONIVEL
  screen: { x: COL.cx, y: 1.42, w: 0.4, h: 0.6 },
  z: D / 2 + 0.03
};

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  r.addColorStop(0, 'rgba(120,200,255,0.55)'); r.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Reflexo diagonal do vidro: duas faixas suaves numa textura minúscula (aditiva, custa quase nada).
function streakTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const band = (x0, w, a) => {
    const l = g.createLinearGradient(x0, 0, x0 + w, 0);
    l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.5, `rgba(255,255,255,${a})`); l.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); g.transform(1, 0, -0.55, 1, 0, 0); g.fillStyle = l; g.fillRect(x0, 0, w, 128); g.restore();
  };
  band(40, 18, 0.16); band(70, 6, 0.1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildMachine() {
  const group = new THREE.Group();
  const front = D / 2;
  const solid = createBatch();                    // pintado e sombreado (assado)
  const lit = createBatch({ flat: true });        // emissivo: neon, interior iluminado, componentes acesos
  const box = (...a) => solid.add(a[0], a[1], a[2], a[3], MACHINE_LIGHT, a[4], a[5], a[6]);
  const glow = (...a) => lit.add(a[0], a[1], a[2], a[3], 1, a[4], a[5], a[6]);

  // corpo azul e rodapé
  box(W, H, D, BLUE, 0, H / 2, 0);
  box(W + 0.04, 0.14, D + 0.04, NAVY, 0, 0.07, 0);
  box(0.06, H - 0.2, 0.02, BLUE_DARK, -W / 2 + 0.03, H / 2 + 0.05, front + 0.003);        // frisos laterais
  box(0.06, H - 0.2, 0.02, BLUE_DARK, W / 2 - 0.03, H / 2 + 0.05, front + 0.003);

  // acabamento do corpo: quinas com brilho (falso chanfro), calota no topo e pés de apoio
  const EDGE = 0x6fb8ff;
  box(0.014, H - 0.14, 0.012, EDGE, -W / 2 + 0.007, H / 2 + 0.07, front + 0.004);
  box(0.014, H - 0.14, 0.012, EDGE, W / 2 - 0.007, H / 2 + 0.07, front + 0.004);
  box(W - 0.03, 0.014, 0.012, 0x9ad0ff, 0, H - 0.007, front + 0.004);                     // quina de cima, a mais clara
  box(W + 0.05, 0.05, D + 0.05, NAVY, 0, H + 0.025, 0);                                   // calota
  box(W + 0.05, 0.012, 0.012, EDGE, 0, H + 0.052, front + 0.025);
  for (const sx of [-1, 1]) box(0.1, 0.04, 0.1, 0x05070d, sx * (W / 2 - 0.12), 0.02, front - 0.12);   // pés (aparecem na sombra)

  // janela: fundo claro (caixa de luz) + moldura neon que sobressai como gabinete raso
  const wx = (WIN.x0 + WIN.x1) / 2, ww = WIN.x1 - WIN.x0, wy = (WIN.y0 + WIN.y1) / 2, wh = WIN.y1 - WIN.y0;
  const DEPTH = 0.2, fz = front + DEPTH / 2;
  glow(ww, wh, 0.01, 0xcfdcf0, wx, wy, front + 0.006);
  glow(ww, 0.09, 0.012, 0xa3b8d8, wx, WIN.y1 - 0.045, front + 0.008);                    // sombra suave do teto da janela
  glow(0.05, wh, 0.012, 0xb6c8e2, WIN.x0 + 0.025, wy, front + 0.008);                     // e das laterais
  glow(0.05, wh, 0.012, 0xb6c8e2, WIN.x1 - 0.025, wy, front + 0.008);
  const bar = 0.05;
  glow(ww + 2 * bar, bar, DEPTH, NEON, wx, WIN.y1 + bar / 2, fz);
  glow(ww + 2 * bar, bar, DEPTH, NEON, wx, WIN.y0 - bar / 2, fz);
  glow(bar, wh, DEPTH, NEON, WIN.x0 - bar / 2, wy, fz);
  glow(bar, wh, DEPTH, NEON, WIN.x1 + bar / 2, wy, fz);

  // prateleiras claras + âncoras dos cards (índice id-1): linha A no topo
  const slotAnchors = new Array(TOTAL);
  const rowPitch = wh / ROWS, colPitch = ww / COLS;
  for (let r = 0; r < ROWS; r++) {
    const shelfY = WIN.y1 - (r + 1) * rowPitch + 0.02;
    box(ww, 0.04, DEPTH - 0.03, WHITE, wx, shelfY - 0.0075, front + (DEPTH - 0.03) / 2 + 0.01);   // prateleira mais grossa: a frente dela recebe a etiqueta de preço
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c + 1;
      const a = new THREE.Object3D();
      a.name = `slot-${cardIdToSlot(id).label}`;
      a.position.set(WIN.x0 + (c + 0.5) * colPitch, shelfY + 0.14, front + 0.07);
      a.rotation.x = -0.12;                       // leve inclinação para trás
      group.add(a);
      slotAnchors[id - 1] = a;
    }
  }
  // vidro (semitransparente, na frente dos cards)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh),
    new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.1, depthWrite: false }));
  glass.position.set(wx, wy, front + DEPTH - 0.01); glass.renderOrder = 5; group.add(glass);
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh),
    new THREE.MeshBasicMaterial({ map: streakTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  streak.position.set(wx, wy, front + DEPTH - 0.008); streak.renderOrder = 6; group.add(streak);
  // halo neon sobre a lataria ao redor da janela
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(ww + 0.7, wh + 0.7),
    new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.set(wx, wy, front + 0.012); halo.renderOrder = 1; group.add(halo);

  // coluna de controle: placa azul-marinho, painel LED e telinha
  box(COL.cw, H - 0.3, 0.02, BLUE_DARK, COL.cx, (H + 0.15) / 2, front + 0.004);
  box(PANEL.led.w + 0.04, PANEL.led.h + 0.04, 0.02, 0x020306, PANEL.led.x, PANEL.led.y, front + 0.012);
  box(PANEL.screen.w + 0.04, PANEL.screen.h + 0.04, 0.02, 0x020306, PANEL.screen.x, PANEL.screen.y, front + 0.012);
  glow(0.1, 0.012, 0.01, NEON, COL.cx, 1.05, front + 0.016);                       // leitor de cartão (luz)
  box(0.16, 0.03, 0.02, 0x020306, COL.cx, 1.05, front + 0.014);
  box(0.1, 0.1, 0.025, 0xaebcd2, COL.cx - 0.1, 0.82, front + 0.016);               // moedeiro prateado
  box(0.06, 0.06, 0.02, 0x020306, COL.cx - 0.1, 0.82, front + 0.03);
  box(0.08, 0.08, 0.025, 0xaebcd2, COL.cx + 0.1, 0.82, front + 0.016);            // botão de devolução

  glow(PANEL.screen.w + 0.07, 0.008, 0.012, NEON, PANEL.screen.x, PANEL.screen.y + PANEL.screen.h / 2 + 0.03, front + 0.018);   // filete de luz da tela
  glow(PANEL.screen.w + 0.07, 0.008, 0.012, NEON, PANEL.screen.x, PANEL.screen.y - PANEL.screen.h / 2 - 0.03, front + 0.018);
  for (let i = 0; i < 6; i++) box(0.34, 0.014, 0.02, 0x07163a, COL.cx, 0.58 - i * 0.045, front + 0.016);               // grade de ventilação
  box(0.38, 0.015, 0.02, 0x8fa3c4, COL.cx, 0.66, front + 0.016);

  const ledCanvas = document.createElement('canvas'); ledCanvas.width = 480; ledCanvas.height = 102;
  const ledTex = new THREE.CanvasTexture(ledCanvas); ledTex.colorSpace = THREE.SRGBColorSpace;
  drawLed(ledCanvas.getContext('2d'), 'DISPONIVEL', 480, 102);
  const ledMesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL.led.w, PANEL.led.h), new THREE.MeshBasicMaterial({ map: ledTex }));
  ledMesh.position.set(PANEL.led.x, PANEL.led.y, PANEL.z); group.add(ledMesh);
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL.screen.w, PANEL.screen.h), new THREE.MeshBasicMaterial({ color: 0x050507 }));
  screenMesh.position.set(PANEL.screen.x, PANEL.screen.y, PANEL.z); group.add(screenMesh);
  const led = { setText(text) { drawLed(ledCanvas.getContext('2d'), text, 480, 102); ledTex.needsUpdate = true; } };

  // bandeja de retirada
  box(ww, 0.3, 0.02, NAVY, wx, 0.3, front + 0.01);
  box(ww - 0.1, 0.2, 0.025, 0x0a1a3d, wx, 0.3, front + 0.014);
  box(ww - 0.16, 0.16, 0.03, 0x020203, wx, 0.3, front + 0.02);
  glow(ww - 0.1, 0.012, 0.02, NEON, wx, 0.43, front + 0.03);
  box(0.34, 0.03, 0.04, 0xaebcd2, wx, 0.43, front + 0.04);                                  // puxador da aba
  const trayAnchor = new THREE.Object3D();
  trayAnchor.position.set(wx, 0.3, front + 0.05);
  group.add(trayAnchor);

  group.add(new THREE.Mesh(solid.build().geometry, bakedMaterial()));
  group.add(new THREE.Mesh(lit.build().geometry, bakedMaterial()));
  return { group, slotAnchors, screenMesh, ledMesh, led, trayAnchor, size: { W, H, D } };
}
