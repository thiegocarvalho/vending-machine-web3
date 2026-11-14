import * as THREE from 'three';
import { createRenderer } from './render/renderer.js';
import { buildMachine, MACHINE_COLLIDER } from './scene/machine.js';
import { buildScenery, addLighting, SCENERY_COLLIDERS } from './scene/scenery.js';
import { createControls } from './player/controls.js';
import { populateCards } from './scene/cards.js';
import { loadCardsInfo } from './data/chain.js';
import { createSelection, createHighlight, pickCard, focusOn } from './player/selection.js';
import { createHud } from './hud/hud.js';
import { createMachineScreen } from './payment/machineScreen.js';
import { buildEip681 } from './payment/eip681.js';
import { hasWallet, payWithWallet } from './payment/wallet.js';
import { config } from './config.js';
import { cardIdToSlot } from './grid.js';
import { formatEther } from 'viem';
import { TIERS, RESOLUTION_LEVELS, detectTier, createAdaptiveScale } from './render/quality.js';

const canvas = document.getElementById('game');
const tier = TIERS[detectTier()];
const { renderer, resize, render, setResolutionFactor } = createRenderer(canvas, tier);

// Renderização sob demanda: só desenha enquanto há atividade (entrada, animação, carregamento).
let activeUntil = 0, loading = true;              // sempre ativo durante o carregamento inicial
const wake = (ms = 1500) => { activeUntil = Math.max(activeUntil, performance.now() + ms); };
['pointerdown', 'pointermove', 'pointerup', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchmove', 'resize', 'orientationchange', 'visibilitychange']
  .forEach((ev) => window.addEventListener(ev, () => wake(), { passive: true }));
const adaptive = createAdaptiveScale({ base: 0, max: RESOLUTION_LEVELS.length - 1, onChange: (n) => { setResolutionFactor(RESOLUTION_LEVELS[n]); wake(); } });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 60);
addLighting(scene);
scene.add(buildScenery());
const machine = buildMachine();
scene.add(machine.group);
const controls = createControls(camera, canvas, { colliders: [...SCENERY_COLLIDERS, MACHINE_COLLIDER] });
const selection = createSelection(1);
const highlight = createHighlight(scene);
const screen = createMachineScreen(machine.screenMesh);
const hudRoot = document.createElement('div'); document.body.appendChild(hudRoot);
const hud = createHud(hudRoot);

let infos = await loadCardsInfo();
const cardsApi = populateCards(machine.slotAnchors, infos, tier);
cardsApi.done.then(() => { loading = false; wake(); });
window.__game = { renderer, scene, camera, machine, controls, cardsApi, selection, tier, adaptive, wake };

const priceText = (i) => `${formatEther(infos[i - 1].price)} ETH`;
const contractForQr = config.contractAddress || '0x0000000000000000000000000000000000000000';
let busy = false;

function refresh(id) {
  const info = infos[id - 1], meta = cardsApi.metas[id - 1];
  hud.showCard(id, meta, info);
  highlight.moveTo(machine.slotAnchors[id - 1]);
  screen.draw({ state: 'idle', slot: cardIdToSlot(id).label, price: priceText(id) });
  hud.setWallet(hasWallet(window) ? 'disconnected' : 'none');
}
selection.onChange((id) => { wake(); refresh(id); focusOn(camera, controls, machine.slotAnchors[id - 1]); });
cardsApi.onLoaded((id) => { wake(); if (id === selection.id) refresh(id); });
refresh(1);

function setState(state, { message = '', hash } = {}) {
  wake(2500);
  const id = selection.id, meta = cardsApi.metas[id - 1];
  screen.draw({ state, slot: cardIdToSlot(id).label, name: meta?.name ?? '', price: priceText(id), message,
    qrText: state === 'awaiting' ? buildEip681(contractForQr, config.chainId, id, infos[id - 1].price) : '' });
  hud.setStatus({ awaiting: 'Aguardando pagamento…', sent: 'Transação enviada, aguardando bloco…', confirmed: 'ADQUIRIDO! Retire na bandeja.', error: message, idle: '' }[state],
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

function onConfirmed(id, hash) {
  infos[id - 1] = { ...infos[id - 1], stock: infos[id - 1].stock - 1 };
  setState('confirmed', { hash }); dropCard(id); busy = false;
}

hud.onShowQr(() => {
  const id = selection.id;
  if (infos[id - 1].stock <= 0) return;
  setState('awaiting');
  hud.showQr(buildEip681(contractForQr, config.chainId, id, infos[id - 1].price));
  if (!config.demoMode) import('./payment/watcher.js').then(({ watchPurchase }) => {
    const w = watchPurchase(id); w.on(({ hash }) => { w.stop(); onConfirmed(id, hash); });
  });
});

hud.onPay(async () => {
  if (busy) return; busy = true;
  const id = selection.id, info = infos[id - 1];
  try {
    setState('awaiting');
    if (config.demoMode) {
      await new Promise(r => setTimeout(r, 1200)); setState('sent', { hash: undefined });
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
});

hud.onDpad(dir => selection.move(dir));
hud.onJoystick((x, y) => { wake(); controls.setJoystick(x, y); });
hud.onWallet(async () => {
  if (!hasWallet(window)) return hud.setStatus('Nenhuma carteira detectada. Use o QR Code.', { error: true });
  try { const [a] = await window.ethereum.request({ method: 'eth_requestAccounts' }); hud.setWallet('connected', a); }
  catch { hud.setStatus('Conexão recusada.', { error: true }); }
});

window.addEventListener('keydown', (e) => {
  const d = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
  if (d) { e.preventDefault(); selection.move(d); } else if (e.key === 'Enter') hud.el.querySelector('.pay-btn').click();
});

// click / tap on a card
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener('pointerup', (e) => {
  if (controls.moved > 8) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const id = pickCard(ray, cardsApi.cards);
  if (id) { id === selection.id ? refresh(id) : selection.set(id); focusOn(camera, controls, machine.slotAnchors[id - 1]); }
});

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.fov = w / h < 0.8 ? 80 : 65; camera.updateProjectionMatrix(); resize(w, h);
}
window.addEventListener('resize', onResize); window.addEventListener('orientationchange', onResize); onResize();
let last = performance.now(), lastDraw = 0;
(function loop(t) {
  requestAnimationFrame(loop);
  if (document.hidden) { lastDraw = 0; return; }
  if (controls.isActive()) wake();
  if (!loading && t >= activeUntil) { lastDraw = 0; return; }                  // ocioso: não gasta GPU nem bateria
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  controls.update(dt); render(scene, camera);
  if (lastDraw) adaptive.sample(t - lastDraw);
  lastDraw = t;
})(last);
