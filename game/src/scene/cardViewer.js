import * as THREE from 'three';

// ---------- matemática pura (testável) ----------
export const CARD = { w: 0.75, h: 1.0, d: 0.009 };   // ~1% da altura: espessura de carta de verdade
const FOV = 40, TAN = Math.tan((FOV * Math.PI) / 360);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Distância da câmera em que o card inteiro cabe na tela (com folga), em qualquer proporção.
// availW/availH: fração da tela realmente livre (o resto é coberto pelo painel do inventário).
export function fitDistance(aspect, fill = 0.72, availW = 1, availH = 1) {
  const byHeight = (CARD.h / 2) / (TAN * fill * availH), byWidth = (CARD.w / 2) / (TAN * aspect * 0.9 * availW);
  return Math.max(byHeight, byWidth);
}
export const zoomRange = (fit) => ({ min: fit * 0.42, max: fit * 1.5 });
export const zoomBy = (dist, factor, fit) => { const r = zoomRange(fit); return clamp(dist * factor, r.min, r.max); };

// Inércia: a rotação continua depois de soltar e desacelera (independente do FPS). Retorna se ainda se move.
export function stepInertia(s, dt, friction = 4) {
  s.yaw += s.vyaw * dt; s.pitch = clamp(s.pitch + s.vpitch * dt, -0.9, 0.9);
  const k = Math.exp(-friction * dt); s.vyaw *= k; s.vpitch *= k;
  if (Math.abs(s.vyaw) < 0.01) s.vyaw = 0; if (Math.abs(s.vpitch) < 0.01) s.vpitch = 0;
  return s.vyaw !== 0 || s.vpitch !== 0;
}

// ---------- texturas auxiliares ----------
export function paintCardBack(g, w, h, rand = Math.random) {
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#0d1230'); bg.addColorStop(1, '#1a0f3a');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,100,255,0.10)'; g.lineWidth = 2;
  for (let x = -h; x < w; x += 26) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke(); }          // trama diagonal
  g.strokeStyle = '#7a5cff'; g.shadowColor = '#5a3cff'; g.shadowBlur = 16; g.lineWidth = 6;
  g.strokeRect(22, 22, w - 44, h - 44); g.shadowBlur = 0; g.lineWidth = 2; g.strokeRect(38, 38, w - 76, h - 76);
  g.fillStyle = '#f0eaff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#7a5cff'; g.shadowBlur = 18;
  g.font = 'italic 700 92px "Brush Script MT","Segoe Script",cursive'; g.fillText('Cards', w / 2, h * 0.46);
  g.shadowBlur = 0; g.font = '600 26px "Fira Code",monospace'; g.fillStyle = '#9b86ff'; g.fillText('DEFI VENDING MACHINE', w / 2, h * 0.58);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${rand() * 0.25})`; g.fillRect(rand() * w, rand() * h, 2, 2); }
}
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const shineTexture = () => canvasTexture(256, 64, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.42, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(210,225,255,0.9)');
  gr.addColorStop(0.58, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const glowTexture = (rgb = '110,140,255', a = 0.32) => canvasTexture(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 64); r.addColorStop(0, `rgba(${rgb},${a})`); r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
// Fundo do inventário: noite azul-arroxeada com névoa de luz e um leve toque de vermelho da marca no chão; vinheta nas bordas.
export function paintViewerBackdrop(g, w, h, rand = Math.random) {
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#03050c'); sky.addColorStop(0.55, '#0a1126'); sky.addColorStop(1, '#101734');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const haze = g.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, w * 0.7); haze.addColorStop(0, 'rgba(80,120,255,0.22)'); haze.addColorStop(1, 'rgba(80,120,255,0)');
  g.fillStyle = haze; g.fillRect(0, 0, w, h);
  const floor = g.createRadialGradient(w * 0.5, h * 1.02, 4, w * 0.5, h * 1.02, w * 0.55); floor.addColorStop(0, 'rgba(255,42,68,0.09)'); floor.addColorStop(1, 'rgba(255,42,68,0)');
  g.fillStyle = floor; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(190,205,255,${0.08 + rand() * 0.35})`; const r = rand() < 0.1 ? 2 : 1; g.fillRect(rand() * w, rand() * h * 0.9, r, r); }   // poeira de luz
  const vig = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vig; g.fillRect(0, 0, w, h);
}

// ---------- visualizador ----------
// Cena própria renderizada pelo MESMO renderer do jogo (nada de segundo contexto WebGL: poupa memória no celular).
export function createCardViewer() {
  const scene = new THREE.Scene(); scene.background = canvasTexture(512, 512, (g, w, h) => paintViewerBackdrop(g, w, h));
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 30);
  const group = new THREE.Group(); scene.add(group);

  const edge = new THREE.MeshBasicMaterial({ color: 0x8c92a8 });   // miolo claro do papel-cartão
  const front = new THREE.MeshBasicMaterial({ color: 0x20243a }), back = new THREE.MeshBasicMaterial({ map: canvasTexture(384, 512, (g, w, h) => paintCardBack(g, w, h)) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CARD.w, CARD.h, CARD.d), [edge, edge, edge, edge, front, back]);   // +x -x +y -y +z -z
  group.add(body);
  const shineMap = shineTexture(); shineMap.wrapS = THREE.RepeatWrapping; shineMap.repeat.set(0.5, 1);
  const shine = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w, CARD.h), new THREE.MeshBasicMaterial({ map: shineMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
  shine.position.z = CARD.d / 2 + 0.001; group.add(shine);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.z = -0.6; scene.add(glow);
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ map: glowTexture('255,60,80', 0.16), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(floorGlow);                                                            // reflexo vermelho sob o card (a marca)

  const s = { yaw: 0.45, pitch: -0.12, vyaw: 0, vpitch: 0 };
  let aspect = 1, fit = fitDistance(1), dist = fit, layout = { sx: 0, sy: 0 }, zoomed = false;    // zoomed: o jogador mexeu no zoom (não recentralizar ao reorganizar a tela)

  function placeCamera() {
    camera.aspect = aspect; camera.updateProjectionMatrix();
    camera.position.set(0, 0, dist); camera.lookAt(0, 0, 0);
    const halfH = TAN * dist, halfW = halfH * aspect;                       // desloca o card para a região livre (ao lado do painel)
    group.position.set(layout.sx * halfW, layout.sy * halfH, 0); glow.position.set(group.position.x, group.position.y, -0.6); floorGlow.position.set(group.position.x, group.position.y - 0.62, -0.2);
    group.rotation.set(s.pitch, s.yaw, 0);
    shineMap.offset.x = 0.5 + Math.sin(s.yaw * 1.4 + s.pitch) * 0.45;       // brilho que desliza conforme o card gira
  }
  placeCamera();

  // ----- entrada: arrastar gira, roda/pinça dá zoom, duplo clique restaura -----
  let canvas = null; const pts = new Map(); let pinch = 0, lastMove = 0, onAnim = () => {};
  const down = (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture?.(e.pointerId); s.vyaw = s.vpitch = 0; if (pts.size === 2) pinch = dist2(); onAnim(); };
  const dist2 = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const move = (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    const now = performance.now(), dt = Math.max(0.008, (now - lastMove) / 1000); lastMove = now;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) { const d = dist2(); if (pinch) { dist = zoomBy(dist, pinch / d, fit); zoomed = true; } pinch = d; }
    else { s.yaw += dx * 0.011; s.pitch = clamp(s.pitch + dy * 0.011, -0.9, 0.9); s.vyaw = clamp((dx * 0.011) / dt, -9, 9); s.vpitch = clamp((dy * 0.011) / dt, -9, 9); }
    placeCamera(); onAnim();
  };
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; if (performance.now() - lastMove > 90) s.vyaw = s.vpitch = 0; onAnim(); };
  const wheel = (e) => { e.preventDefault(); dist = zoomBy(dist, Math.exp(e.deltaY * 0.0012), fit); zoomed = true; placeCamera(); onAnim(); };
  const reset = () => { Object.assign(s, { yaw: 0.45, pitch: -0.12, vyaw: 0, vpitch: 0 }); dist = fit; zoomed = false; placeCamera(); onAnim(); };

  return {
    scene, camera,
    attach(cv, onAnimate = () => {}) {
      canvas = cv; onAnim = onAnimate;
      cv.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', wheel, { passive: false }); cv.addEventListener('dblclick', reset);
    },
    detach() {
      if (!canvas) return;
      canvas.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('dblclick', reset); pts.clear(); canvas = null;
    },
    // verso oficial (card_back.png do IPFS); enquanto não chega, fica o verso desenhado
    setBack(tex) { if (tex) { back.map = tex; back.needsUpdate = true; } },
    setFront(tex) { front.map = tex || null; front.color.set(tex ? 0xffffff : 0x20243a); front.needsUpdate = true; },
    setLayout(a, l) { aspect = a; layout = l; fit = fitDistance(a, l.fill ?? 0.72, l.availW ?? 1, l.availH ?? 1);   // o card cabe só na região livre ao lado/acima do painel
      dist = zoomed ? clamp(dist, zoomRange(fit).min, zoomRange(fit).max) : fit; placeCamera(); },      // sem zoom do jogador: começa sempre no enquadramento ideal
    reset, showBack() { Object.assign(s, { yaw: Math.PI - 0.45, pitch: -0.12, vyaw: 0, vpitch: 0 }); placeCamera(); onAnim(); },
    // chamado a cada quadro com o inventário aberto; true se ainda há movimento (inércia/arrasto)
    update(dt) { const moving = stepInertia(s, dt); if (moving) placeCamera(); return moving || pts.size > 0; },
    get state() { return { ...s, dist, fit }; },
    dispose() { this.detach(); scene.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.dispose(); }); }); }
  };
}
