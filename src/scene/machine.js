import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { applyPs1Snap } from '../render/ps1Renderer.js';
import { ROWS, COLS, TOTAL, cardIdToSlot } from '../grid.js';

const W = 1.9, H = 2.4, D = 0.95;                 // body size (m)
const WIN = { x0: -W / 2 + 0.1, x1: 0.35, y0: 0.55, y1: H - 0.15 }; // glass window (left ~70%)

function mat(color, opts = {}) {
  return applyPs1Snap(new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
}
function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function buildMachine() {
  const group = new THREE.Group();
  const front = D / 2;

  // body shell + base + vent
  box(W, H, D, PALETTE.body, 0, H / 2, 0, group);
  box(W + 0.04, 0.12, D + 0.04, PALETTE.black, 0, 0.06, 0, group);
  for (let i = 0; i < 6; i++) box(W - 0.2, 0.012, 0.01, PALETTE.red, 0, 0.1 + i * 0.016, front + 0.025, group);

  // glass window: dark back panel + red frame bars protruding as a shallow cabinet
  const wx = (WIN.x0 + WIN.x1) / 2, ww = WIN.x1 - WIN.x0, wy = (WIN.y0 + WIN.y1) / 2, wh = WIN.y1 - WIN.y0;
  const DEPTH = 0.2, fz = front + DEPTH / 2;
  const back = box(ww, wh, 0.01, 0x050507, wx, wy, front + 0.006, group);
  back.material.color.setHex(0x050507);
  const bar = 0.05;
  box(ww + 2 * bar, bar, DEPTH, PALETTE.red, wx, WIN.y1 + bar / 2, fz, group);
  box(ww + 2 * bar, bar, DEPTH, PALETTE.red, wx, WIN.y0 - bar / 2, fz, group);
  box(bar, wh, DEPTH, PALETTE.red, WIN.x0 - bar / 2, wy, fz, group);
  box(bar, wh, DEPTH, PALETTE.red, WIN.x1 + bar / 2, wy, fz, group);

  // shelves + anchors (id-1 index): row A on top
  const slotAnchors = new Array(TOTAL);
  const rowPitch = wh / ROWS, colPitch = ww / COLS;
  for (let r = 0; r < ROWS; r++) {
    const shelfY = WIN.y1 - (r + 1) * rowPitch + 0.02;
    box(ww, 0.025, DEPTH - 0.03, PALETTE.metal, wx, shelfY, front + (DEPTH - 0.03) / 2 + 0.01, group);
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c + 1;
      const a = new THREE.Object3D();
      a.name = `slot-${cardIdToSlot(id).label}`;
      a.position.set(WIN.x0 + (c + 0.5) * colPitch, shelfY + 0.14, front + 0.07);
      a.rotation.x = -0.12;                       // slight lean back
      group.add(a);
      slotAnchors[id - 1] = a;
    }
  }
  // glass pane (semi transparent, in front of cards)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(ww, wh),
    new THREE.MeshBasicMaterial({ color: PALETTE.glass, transparent: true, opacity: 0.14, depthWrite: false })
  );
  glass.position.set(wx, wy, front + DEPTH - 0.01);
  glass.renderOrder = 5;
  group.add(glass);

  // control column (right)
  const cx = 0.78, cw = 0.52;
  box(cw, H - 0.3, 0.02, PALETTE.metal, cx, (H + 0.15) / 2, front + 0.004, group);
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x050507 }));
  screenMesh.position.set(cx, H - 0.42, front + 0.02);
  group.add(screenMesh);
  box(0.42, 0.32, 0.01, PALETTE.red, cx, H - 0.42, front + 0.012, group);
  box(0.3, 0.12, 0.03, PALETTE.black, cx, H - 0.88, front + 0.03, group);         // card reader
  box(0.24, 0.01, 0.01, PALETTE.red, cx, H - 0.88, front + 0.048, group);
  for (let k = 0; k < 12; k++) {                                                      // keypad 3x4
    box(0.06, 0.05, 0.015, PALETTE.white, cx - 0.09 + (k % 3) * 0.09, H - 1.1 - Math.floor(k / 3) * 0.075, front + 0.02, group);
  }
  box(0.1, 0.03, 0.02, PALETTE.black, cx, 0.95, front + 0.02, group);               // coin slot
  box(0.1, 0.1, 0.02, PALETTE.black, cx, 0.6, front + 0.02, group);

  // delivery tray (below window, left)
  box(ww, 0.36, 0.02, PALETTE.black, wx, 0.3, front + 0.01, group);
  box(ww - 0.1, 0.24, 0.025, PALETTE.red, wx, 0.3, front + 0.008, group);
  box(ww - 0.16, 0.2, 0.03, 0x020203, wx, 0.3, front + 0.02, group);
  const trayAnchor = new THREE.Object3D();
  trayAnchor.position.set(wx, 0.3, front + 0.05);
  group.add(trayAnchor);

  return { group, slotAnchors, screenMesh, trayAnchor, size: { W, H, D } };
}
