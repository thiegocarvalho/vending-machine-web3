import * as THREE from 'three';
import { createRenderer } from './render/renderer.js';
import { buildMachine, MACHINE_COLLIDER, PANEL } from './scene/machine.js';
import { buildScenery, addLighting, SCENERY_COLLIDERS } from './scene/scenery.js';
import { createControls } from './player/controls.js';
import { createRig } from './player/rig.js';
import { populateCards } from './scene/cards.js';
import { loadCardsInfo } from './data/chain.js';
import { createSelection, createHighlight, pickCard } from './player/selection.js';
import { createHud } from './hud/hud.js';
import { createMachineScreen, buttonHit } from './payment/machineScreen.js';
import { buildEip681 } from './payment/eip681.js';
import { hasWallet, payWithWallet } from './payment/wallet.js';
import { config } from './config.js';
import { cardIdToSlot } from './grid.js';
import { createModes, facingTarget } from './interaction.js';
import { formatEther } from 'viem';
import { TIERS, RESOLUTION_LEVELS, detectTier, createAdaptiveScale } from './render/quality.js';

const canvas = document.getElementById('game');
const tier = TIERS[detectTier()];
const { renderer, resize, render, setResolutionFactor } = createRenderer(canvas, tier);

// Renderização sob demanda: só desenha enquanto há atividade (entrada, animação, carregamento).
let activeUntil = 0, loading = true;              // sempre ativo durante o carregamento inicial
const wake = (ms = 1500) => { activeUntil = Math.max(activeUntil, performance.now() + ms); };
['pointerdown', 'pointermove', 'pointerup', 'mousemove', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchmove', 'resize', 'orientationchange', 'visibilitychange']
  .forEach((ev) => window.addEventListener(ev, () => wake(), { passive: true }));
const adaptive = createAdaptiveScale({ base: 0, max: RESOLUTION_LEVELS.length - 1, onChange: (n) => { setResolutionFactor(RESOLUTION_LEVELS[n]); wake(); } });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 60);
addLighting(scene);
scene.add(buildScenery());
const machine = buildMachine();
scene.add(machine.group);
const controls = createControls(camera, canvas, { colliders: [...SCENERY_COLLIDERS, MACHINE_COLLIDER] });
const rig = createRig(camera, controls);
const modes = createModes();
const selection = createSelection(1);
const highlight = createHighlight(scene);
highlight.setVisible(false);
const screen = createMachineScreen(machine.screenMesh);
const hudRoot = document.createElement('div'); document.body.appendChild(hudRoot);
const hud = createHud(hudRoot);

let infos = await loadCardsInfo();
const cardsApi = populateCards(machine.slotAnchors, infos, tier);
cardsApi.done.then(() => { loading = false; wake(); });
window.__game = { renderer, scene, camera, machine, controls, cardsApi, selection, tier, adaptive, wake, modes, rig, hud };

const priceText = (i) => `${formatEther(infos[i - 1].price)} ETH`;
const contractForQr = config.contractAddress || '0x0000000000000000000000000000000000000000';
const MACHINE_TARGET = { x: 0, y: 1.3, z: 0.2 };
const front = machine.size.D / 2;
let busy = false, watcher = null, screenArgs = { state: 'idle' }, hoverBtn = false;

// ---------- poses de câmera ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const walkPose = () => ({ x: 0, y: 1.6, z: 3.4, yaw: 0, pitch: 0 });
function selectPose(id) {
  const p = machine.slotAnchors[id - 1].getWorldPosition(new THREE.Vector3());
  return { x: p.x, y: clamp(p.y, 1.0, 2.0), z: p.z + 1.25, yaw: 0, pitch: 0 };
}
// enquadra o painel LED e a telinha juntos
const payPose = () => ({ x: PANEL.screen.x, y: (PANEL.led.y + PANEL.screen.y) / 2 - 0.05, z: front + 0.03 + 1.05, yaw: 0, pitch: 0 });

// ---------- painel LED e telinha ----------
function ledText() {
  const id = selection.id, info = infos[id - 1];
  if (modes.mode === 'walk') return '-- --';
  if (info.stock <= 0 || !info.active) return 'SOLD';
  return `${cardIdToSlot(id).label} #${String(id).padStart(2, '0')}`;
}
function drawScreen(args = screenArgs) {
  screenArgs = args;
  const id = selection.id, meta = cardsApi.metas[id - 1];
  screen.draw({ slot: cardIdToSlot(id).label, name: meta?.name?.replace(/^Card #\d+:\s*/, '') ?? '', price: priceText(id), stock: infos[id - 1].stock,
    hover: hoverBtn, wallet: hasWallet(window) ? 'ok' : 'none', ...args });
  wake();
}
function refresh() {
  const id = selection.id;
  hud.showCard(id, cardsApi.metas[id - 1], infos[id - 1]);
  highlight.moveTo(machine.slotAnchors[id - 1]);
  machine.led.setText(ledText());
  if (modes.mode !== 'pay') drawScreen({ state: modes.mode === 'walk' ? 'idle' : 'select' });
  wake();
}
selection.onChange(() => { refresh(); if (modes.mode === 'select') rig.flyTo(selectPose(selection.id), 380); });
cardsApi.onLoaded((id) => { wake(); if (id === selection.id) refresh(); });

// ---------- pagamento ----------
function setState(state, { message = '', hash } = {}) {
  const qrText = state === 'awaiting' ? buildEip681(contractForQr, config.chainId, selection.id, infos[selection.id - 1].price) : '';
  drawScreen({ state, message, qrText });
  hud.setStatus({ awaiting: '', sent: 'Transação enviada, aguardando bloco…', confirmed: 'ADQUIRIDO! Retire na bandeja.', error: message, idle: '', select: '' }[state] ?? '',
    { error: state === 'error', hash });
}

function dropCard(id) {
  wake(5000);
  const src = cardsApi.cards[id - 1];
  const copy = src.clone(); copy.material = src.material;
  scene.add(copy);
  src.getWorldPosition(copy.position); const t0 = performance.now(), from = copy.position.clone();
  const to = machine.trayAnchor.getWorldPosition(new THREE.Vector3());
  (function step(now) {
    const k = Math.min(1, (now - t0) / 900); copy.position.lerpVectors(from, to, k * k);
    k < 1 ? requestAnimationFrame(step) : setTimeout(() => scene.remove(copy), 4000);
  })(t0);
}

function stopWatcher() { watcher?.stop(); watcher = null; }
function onConfirmed(id, hash) {
  stopWatcher();
  infos[id - 1] = { ...infos[id - 1], stock: infos[id - 1].stock - 1 };
  if (infos[id - 1].stock <= 0) cardsApi.setSoldOut(id, true);
  setState('confirmed', { hash }); machine.led.setText('OK'); dropCard(id); busy = false;
  setTimeout(() => { if (modes.mode === 'pay') modes.back(); }, 2200);
}

function startPayment() {
  const id = selection.id;
  setState('awaiting');
  if (!config.demoMode) import('./payment/watcher.js').then(({ watchPurchase }) => {
    if (modes.mode !== 'pay' || selection.id !== id) return;
    stopWatcher(); watcher = watchPurchase(id); watcher.on(({ hash }) => onConfirmed(id, hash));
  });
}

async function payNow() {
  if (busy) return; busy = true;
  const id = selection.id, info = infos[id - 1];
  try {
    setState('awaiting');
    if (config.demoMode) {
      await new Promise(r => setTimeout(r, 1200)); setState('sent');
      await new Promise(r => setTimeout(r, 1800)); onConfirmed(id); return;
    }
    const { hash } = await payWithWallet(window, config, id, info.price, info.stock);
    setState('sent', { hash });
    const { publicClient } = await import('./data/chain.js');
    await publicClient.waitForTransactionReceipt({ hash });
    onConfirmed(id, hash);
  } catch (e) {
    busy = false; setState('error', { message: e.message });
  }
}

// ---------- modos ----------
let pendingWalk = false;
modes.onChange((mode) => {
  wake(3000); canUse = false; hud.setMode(mode); hud.setStatus('');
  if (mode === 'walk') {
    stopWatcher(); highlight.setVisible(false); controls.setEnabled(false); pendingWalk = true;
    rig.flyTo(walkPose(), 600); machine.led.setText('-- --'); drawScreen({ state: 'idle' });
  } else if (mode === 'select') {
    stopWatcher(); busy = false; controls.setEnabled(false); highlight.setVisible(true);
    rig.flyTo(selectPose(selection.id), 550); refresh();
  } else if (mode === 'pay') {
    rig.flyTo(payPose(), 550); startPayment();
  }
});
hud.setMode('walk');
refresh();

function tryConfirm() {
  const info = infos[selection.id - 1];
  if (info.stock <= 0 || !info.active) return hud.setStatus('Card esgotado.', { error: true });
  hud.setStatus(''); modes.confirm();
}
const tryUse = () => { if (modes.mode === 'walk' && controls.enabled && hud.el.classList.contains('can-use')) modes.interact(); };

hud.onUse(tryUse); hud.onConfirm(tryConfirm); hud.onBack(() => modes.back());
hud.onDpad(dir => selection.move(dir));
hud.onJoystick((x, y) => { wake(); controls.setJoystick(x, y); });

window.addEventListener('keydown', (e) => {
  if (e.repeat && modes.mode !== 'select') return;
  const m = modes.mode;
  if (m === 'walk') { if (e.code === 'KeyE' || e.code === 'Enter') tryUse(); return; }
  const back = e.code === 'Escape' || e.code === 'Backspace' || e.code === 'KeyQ';
  if (back) { e.preventDefault(); return modes.back(); }
  if (m === 'select') {
    const d = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' }[e.code];
    if (d) { e.preventDefault(); selection.move(d); }
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); tryConfirm(); }
  } else if (m === 'pay' && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault(); if (screenArgs.state === 'awaiting') payNow(); else if (screenArgs.state === 'error') setState('awaiting');
  }
});

// ---------- mouse/toque sobre objetos 3D (só com o cursor livre: selecionar e pagar) ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function cast(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
const screenUv = () => ray.intersectObject(machine.screenMesh, false)[0]?.uv ?? null;

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || rig.active) return;
  if (modes.mode === 'select') {
    cast(e); const id = pickCard(ray, cardsApi.cards);
    canvas.style.cursor = id ? 'pointer' : 'default';
    if (id && id !== selection.id) selection.set(id);
  } else if (modes.mode === 'pay') {
    cast(e); const over = (screenArgs.state === 'awaiting' || screenArgs.state === 'error') && buttonHit(screenUv());
    canvas.style.cursor = over ? 'pointer' : 'default';
    if (over !== hoverBtn) { hoverBtn = over; drawScreen(); }
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (rig.active || controls.moved > 8) return;
  if (modes.mode === 'select') {
    cast(e); const id = pickCard(ray, cardsApi.cards);
    if (!id) return;
    id === selection.id ? tryConfirm() : selection.set(id);       // toque: 1º seleciona, 2º confirma
  } else if (modes.mode === 'pay') {
    cast(e);
    if (buttonHit(screenUv())) { if (screenArgs.state === 'awaiting') payNow(); else if (screenArgs.state === 'error') setState('awaiting'); }
  }
});

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.fov = w / h < 0.8 ? 80 : 65; camera.updateProjectionMatrix(); resize(w, h);
}
window.addEventListener('resize', onResize); window.addEventListener('orientationchange', onResize); onResize();

let last = performance.now(), lastDraw = 0, canUse = false;
(function loop(t) {
  requestAnimationFrame(loop);
  if (document.hidden) { lastDraw = 0; return; }
  const flying = rig.update(t);
  if (flying) wake();
  if (pendingWalk && !flying) { pendingWalk = false; controls.setEnabled(true); }
  if (controls.isActive()) wake();
  if (!loading && t >= activeUntil) { lastDraw = 0; return; }                  // ocioso: não gasta GPU nem bateria
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  controls.update(dt);
  if (modes.mode === 'walk' && controls.enabled) {                              // prompt "E" quando perto e olhando a máquina
    const { yaw, pitch } = controls.pose();
    const near = facingTarget(camera.position, yaw, pitch, MACHINE_TARGET);
    if (near !== canUse) { canUse = near; hud.showPrompt(near); }
  }
  render(scene, camera);
  if (lastDraw) adaptive.sample(t - lastDraw);
  lastDraw = t;
})(last);
