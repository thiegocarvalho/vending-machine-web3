import * as THREE from 'three';
import { createRenderer } from './render/renderer.js';
import { buildMachine, MACHINE_COLLIDER, PANEL } from './scene/machine.js';
import { buildScenery, addLighting, SCENERY_COLLIDERS, POSTER } from './scene/scenery.js';
import { createControls } from './player/controls.js';
import { createRig } from './player/rig.js';
import { createSpotlight, approach as approachNum } from './scene/spotlight.js';
import { populateCards, loadFullTexture, loadBackTexture } from './scene/cards.js';
import { createCardViewer } from './scene/cardViewer.js';
import { createPriceTags } from './scene/priceTags.js';
import { createInventory, isAddress } from './data/inventory.js';
import { createInventoryPanel } from './hud/inventory.js';
import { loadCardsInfo, loadPaused } from './data/chain.js';
import { createSelection, createHighlight, pickCard } from './player/selection.js';
import { createHud } from './hud/hud.js';
import { createMachineScreen, buttonHit } from './payment/machineScreen.js';
import { buildEip681 } from './payment/eip681.js';
import { hasWallet, payWithWallet } from './payment/wallet.js';
import { createWalletSession, walletStatus } from './payment/session.js';
import { config } from './config.js';
import { cardIdToSlot } from './grid.js';
import { createModes, pickInteractable } from './interaction.js';
import { formatEther, waitForReceipt } from './data/rpc.js';
import { TIERS, RESOLUTION_LEVELS, detectTier, createAdaptiveScale } from './render/quality.js';

// As fontes do cartaz/telinha precisam estar prontas antes de pintar as texturas (com tempo-limite para ficar offline).
await Promise.race([
  Promise.all(['900 150px "Bebas Neue"', 'bold 20px "Fira Code"', 'bold 20px "Space Grotesk"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 1500))
]).catch(() => {});

const canvas = document.getElementById('game');
const tier = TIERS[detectTier()];
const { renderer, resize, render, setResolutionFactor, onRestore } = createRenderer(canvas, tier);
onRestore(() => wake());

// Renderização sob demanda: só desenha enquanto há atividade (entrada, animação, carregamento).
let activeUntil = 0, loading = true, needsFrame = true;   // sempre ativo durante o carregamento inicial; needsFrame garante ao menos 1 desenho por pedido
const wake = (ms = 1500) => { activeUntil = Math.max(activeUntil, performance.now() + ms); needsFrame = true; schedule(); };
// Sem quadros agendados quando ocioso: zero acordadas da CPU. Um quadro pedido há mais de 300 ms sem disparar (alguns navegadores
// móveis descartam callbacks de rAF ao ir para segundo plano) é substituído; a "ficha" invalida o antigo para não rodar duas vezes.
let rafId = 0, rafAt = 0, rafTok = 0;
const schedule = () => {
  const now = performance.now();
  if (rafId && now - rafAt < 300) return;
  const tok = ++rafTok; rafAt = now;
  rafId = requestAnimationFrame((t) => { if (tok === rafTok) loop(t); });
};
['pointerdown', 'pointermove', 'pointerup', 'mousemove', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchmove', 'resize', 'orientationchange', 'visibilitychange', 'focus', 'pageshow']
  .forEach((ev) => window.addEventListener(ev, () => wake(), { passive: true }));
document.addEventListener('visibilitychange', () => wake());
const adaptive = createAdaptiveScale({ base: 0, max: RESOLUTION_LEVELS.length - 1, onChange: (n) => { setResolutionFactor(RESOLUTION_LEVELS[n]); wake(); } });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
addLighting(scene);
const sceneryGroup = buildScenery(tier);
scene.add(sceneryGroup);
const machine = buildMachine();
scene.add(machine.group);
const controls = createControls(camera, canvas, { colliders: [...SCENERY_COLLIDERS, MACHINE_COLLIDER] });
const rig = createRig(camera, controls);
const modes = createModes();
const selection = createSelection(1);
const highlight = createHighlight(scene);
const spot = createSpotlight(scene);
highlight.setVisible(false);
const screen = createMachineScreen(machine.screenMesh);
const hudRoot = document.createElement('div'); document.body.appendChild(hudRoot);
const hud = createHud(hudRoot);
const inventory = createInventory();
const viewer = createCardViewer();

let infos = await loadCardsInfo();
const cardsApi = populateCards(machine.slotAnchors, infos, tier);
cardsApi.done.then(() => { loading = false; wake(); });
machine.group.updateMatrixWorld(true);
const tags = createPriceTags(machine.slotAnchors, infos);                       // etiquetas de preço (ETH) à frente de cada card
scene.add(tags.mesh);
window.__game = { get state() { return { loopRuns, rafId, loading, activeUntil, now: performance.now(), hidden: document.hidden, mode: modes.mode }; }, renderer, scene, camera, machine, controls, cardsApi, selection, tier, adaptive, wake, modes, rig, hud };

const priceText = (i) => `${formatEther(infos[i - 1].price)} ETH`;
const contractForQr = config.contractAddress || '0x0000000000000000000000000000000000000000';
const INTERACTABLES = [
  { kind: 'machine', pos: { x: 0, y: 1.3, z: 0.2 } },
  { kind: 'faucet', pos: { x: POSTER.x, y: POSTER.y, z: -0.45 }, maxDist: 4.2, maxAngleDeg: 20 }
];
const openFaucet = () => window.open(config.faucetUrl, '_blank', 'noopener,noreferrer');
const front = machine.size.D / 2;
let busy = false, watcher = null, screenArgs = { state: 'idle' }, hoverBtn = false;

// ---------- poses de câmera ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const walkPose = () => ({ x: 0, y: 1.6, z: 3.4, yaw: 0, pitch: 0 });
// Zoom de foco: bem perto do card selecionado (um pouco mais longe em telas estreitas para caber mais colunas).
const focusDistance = () => (camera.aspect < 0.8 ? 0.82 : 0.58);
function selectPose(id) {
  const p = machine.slotAnchors[id - 1].getWorldPosition(new THREE.Vector3());
  return { x: p.x, y: p.y + 0.02, z: p.z + focusDistance(), yaw: 0, pitch: 0 };
}
// enquadra o painel LED e a telinha juntos
const payPose = () => ({ x: PANEL.screen.x, y: (PANEL.led.y + PANEL.screen.y) / 2 - 0.05, z: front + 0.03 + 1.05, yaw: 0, pitch: 0 });

// ---------- painel LED e telinha ----------
// Painel LED vermelho: só o estado do contrato (DISPONIVEL / INDISPONIVEL quando pausado). Relido ao entrar na máquina e ao voltar para a aba.
let paused = false;
const isSoldOut = (i) => !i || i.stock <= 0 || !i.active;
// Estoque/preço/ativo vêm do contrato: relidos ao entrar na máquina, ao voltar à aba e antes de pagar (outros jogadores também compram).
async function refreshInfos() {
  if (config.demoMode) return;                                                   // demo: o estoque simulado é local
  try { infos = await loadCardsInfo(); } catch { return; }
  infos.forEach((inf, i) => cardsApi.setSoldOut(i + 1, isSoldOut(inf)));
  tags.update(infos); refresh(); wake();
}
async function refreshAvailability() {
  try { paused = await loadPaused(); } catch { /* mantém o último estado conhecido */ }
  machine.led.setText(paused ? 'INDISPONIVEL' : 'DISPONIVEL'); wake();
}
function drawScreen(args = screenArgs) {
  screenArgs = args;
  const id = selection.id, meta = cardsApi.metas[id - 1];
  screen.draw({ slot: cardIdToSlot(id).label, name: meta?.name?.replace(/^Card #\d+:\s*/, '') ?? '', price: priceText(id), stock: infos[id - 1].stock, soldOut: isSoldOut(infos[id - 1]),
    hover: hoverBtn, wallet: hasWallet(window) ? 'ok' : 'none', ...args });
  wake();
}
function refresh() {
  const id = selection.id;
  hud.showCard(id, cardsApi.metas[id - 1], infos[id - 1]);
  highlight.moveTo(machine.slotAnchors[id - 1]); spot.moveTo(machine.slotAnchors[id - 1]);
  if (modes.mode !== 'pay') drawScreen({ state: modes.mode === 'walk' ? 'idle' : 'select' });
  wake();
}
selection.onChange(() => { refresh(); if (modes.mode === 'select') rig.flyTo(selectPose(selection.id), 340); });
cardsApi.onLoaded((id) => { wake(); if (id === selection.id) refresh(); });

// ---------- pagamento ----------
function setState(state, { message = '', hash } = {}) {
  const qrText = state === 'awaiting' ? buildEip681(contractForQr, config.chainId, selection.id, infos[selection.id - 1].price) : '';
  drawScreen({ state, message, qrText });
  hud.setStatus({ awaiting: '', sent: 'Transação enviada, aguardando bloco…', confirmed: 'ADQUIRIDO! Abrindo o seu inventário…', error: message, idle: '', select: '' }[state] ?? '',
    { error: state === 'error', hash });
}


function stopWatcher() { watcher?.stop(); watcher = null; }
function onConfirmed(id, hash, buyer) {
  stopWatcher();
  infos[id - 1] = { ...infos[id - 1], stock: infos[id - 1].stock - 1 };
  if (infos[id - 1].stock <= 0) cardsApi.setSoldOut(id, true);
  tags.update(infos);
  setState('confirmed', { hash }); busy = false;
  if (buyer && !inventory.address) inventory.setAddress(buyer, 'manual');        // pagou por QR (sem extensão): o comprador do evento vira o endereço consultado
  inventory.add(id);
  // Depois do "PAGO!" na telinha, abre o inventário já no card recém-adquirido (em vez de animação de queda na bandeja).
  setTimeout(() => { if (modes.mode === 'pay' && !invOpen) openInventory({ fresh: id }); }, 1300);
}

function startPayment() {
  const id = selection.id;
  setState('awaiting');
  if (!config.demoMode) import('./payment/watcher.js').then(({ watchPurchase }) => {
    if (modes.mode !== 'pay' || selection.id !== id) return;
    stopWatcher(); watcher = watchPurchase(id); watcher.on(({ hash, buyer }) => onConfirmed(id, hash, buyer));
  });
}

async function payNow() {
  if (busy) return;
  if (paused) return setState('error', { message: 'Máquina indisponível: contrato pausado.' });
  busy = true;
  await refreshInfos();                                                          // estoque mais recente antes de gastar gás
  if (isSoldOut(infos[selection.id - 1])) { busy = false; return setState('error', { message: 'Card esgotado.' }); }
  const id = selection.id, info = infos[id - 1];
  try {
    setState('awaiting');
    if (config.demoMode) {
      await new Promise(r => setTimeout(r, 1200)); setState('sent');
      await new Promise(r => setTimeout(r, 1800)); onConfirmed(id); return;
    }
    const { hash, from } = await payWithWallet(window, config, id, info.price, info.stock);
    if (from) { session.clearDismissed(); inventory.setAddress(from, 'wallet'); }
    setState('sent', { hash });
    await waitForReceipt(hash);
    onConfirmed(id, hash);
  } catch (e) {
    busy = false; setState('error', { message: e.message });
  }
}

// ---------- inventário (tecla I) ----------
let invOpen = false, invSel = 0, invPrevEnabled = true, invFresh = 0;
const fullCache = new Map();                                                    // id -> textura em alta (LRU de 3)
const session = createWalletSession({ cfg: config });
let connecting = false, walletChain = null, walletError = '';
const invPanel = createInventoryPanel(document.body, {
  onClose: () => closeInventory(), onSelect: (id) => selectInv(id),
  onConnect: () => connectWallet(), onDisconnect: () => disconnectWallet(), onSwitch: () => switchNetwork(),
  onAddress: async (a) => { walletError = isAddress(a) ? '' : 'Endereço inválido: use 0x seguido de 40 caracteres.'; if (!walletError) inventory.setAddress(a, 'manual'); await refreshInventory(); }
});
async function syncWallet() {
  if (session.available && inventory.source === 'wallet') walletChain = await session.chainId();
  invPanel.setWallet({
    status: walletStatus({ demo: config.demoMode, hasWallet: session.available, address: inventory.address, source: inventory.source, chainId: walletChain, wantedChain: config.chainId, connecting }),
    address: inventory.address, hasWallet: session.available, chainName: config.chainName, error: walletError
  });
}
async function connectWallet() {
  connecting = true; walletError = ''; await syncWallet();
  try { inventory.setAddress(await session.connect(), 'wallet'); }
  catch (e) { walletError = e.code === 4001 ? 'Conexão recusada na carteira.' : 'Não foi possível conectar: ' + (e.shortMessage || e.message); }
  connecting = false; await refreshInventory();
}
async function disconnectWallet() { walletError = ''; await session.disconnect(); inventory.setAddress(null); walletChain = null; await refreshInventory(); }
async function switchNetwork() {
  walletError = '';
  try { await session.switchNetwork(); } catch (e) { walletError = e.code === 4001 ? 'Troca de rede recusada.' : 'Não foi possível trocar de rede.'; }
  await refreshInventory();
}
// a extensão mudou de conta ou de rede (ou o jogador desconectou pela própria carteira)
session.onChange(async (ev) => {
  if (ev.type === 'accounts') {
    const a = ev.accounts[0];
    if (a && (inventory.source === 'wallet' || (!inventory.address && !session.dismissed))) inventory.setAddress(a, 'wallet');
    else if (!a && inventory.source === 'wallet') inventory.setAddress(null);
  }
  if (invOpen) await refreshInventory(); wake();
});
// Retrato: painel embaixo (card no alto da tela). Paisagem: painel à esquerda (card no espaço livre à direita). Mede o painel real,
// então vale para qualquer tamanho de tela (celular pequeno, tablet, desktop, deitado).
const invLayout = () => {
  const w = innerWidth, h = innerHeight, r = invPanel.el.querySelector('.inv-panel').getBoundingClientRect();
  if (h > w) { const ph = Math.min(h * 0.8, r.height || h * 0.5); return { sx: w < 480 ? 0.2 : 0, sy: ph / h, availW: w < 480 ? 0.78 : 1, availH: 1 - ph / h }; }          // celular estreito: o card vai um pouco para a direita, livrando o texto à esquerda
  const pw = Math.min(w * 0.8, r.width || Math.min(420, 0.46 * w)); return { sx: pw / w, sy: 0, availW: 1 - pw / w, availH: 1 };
};
function layoutViewer() { viewer.setLayout(innerWidth / innerHeight, invLayout()); }
function paintInventory() {
  invPanel.setData({ balances: inventory.balances, address: inventory.address, hasWallet: hasWallet(window), demo: config.demoMode });
  cardsApi.cards.forEach((m, i) => { const img = m.material.map?.image; if (img) invPanel.setThumb(i + 1, img); });
  wake();
}
async function refreshInventory() {
  try { await inventory.refresh(); } catch (e) { hud.setStatus('Não foi possível ler os saldos: ' + e.message, { error: true }); }
  paintInventory(); await syncWallet();
  if (!invSel || inventory.balances[invSel - 1] <= 0) selectInv(inventory.balances.findIndex((n) => n > 0) + 1 || 0);
}
async function selectInv(id) {
  invSel = id; invPanel.setSelected(id, id ? cardsApi.metas[id - 1] : null, id ? inventory.balances[id - 1] : 0);
  if (!id) { viewer.setFront(null); viewer.showBack(); wake(); return; }
  viewer.reset();                                                              // cada card começa de frente
  viewer.setFront(fullCache.get(id) ?? cardsApi.cards[id - 1].material.map);     // mostra já a miniatura e troca pela arte completa quando chegar
  wake();
  if (fullCache.has(id) || !cardsApi.metas[id - 1]) return;
  invPanel.setLoading(true);
  try {
    const tex = await loadFullTexture(cardsApi.metas[id - 1], { aniso: tier.aniso });
    fullCache.set(id, tex);
    if (fullCache.size > 3) { const [oldId, old] = fullCache.entries().next().value; if (oldId !== invSel) { old.dispose(); fullCache.delete(oldId); } }
    if (invSel === id) viewer.setFront(tex);
  } catch { /* fica a miniatura */ }
  if (invSel === id) invPanel.setLoading(false);
  wake();
}
let backTex = null, backLoading = false;
async function ensureBack() {                                                    // verso oficial: baixado uma vez, na primeira abertura
  if (backTex || backLoading) return;
  const meta = cardsApi.metas.find(Boolean); if (!meta) return;
  backLoading = true;
  try { backTex = await loadBackTexture(meta, { aniso: tier.aniso }); viewer.setBack(backTex); wake(); } catch { /* fica o verso desenhado */ }
  backLoading = false;
}
async function openInventory({ fresh = 0 } = {}) {
  if (invOpen || (rig.active && !fresh) || (modes.mode === 'pay' && !fresh)) return;
  invOpen = true; invPrevEnabled = controls.enabled; controls.setEnabled(false);
  hud.el.style.display = 'none'; canvas.style.cursor = 'default';
  invFresh = fresh; invSel = fresh || invSel;                                    // compra nova: já seleciona e destaca o card adquirido
  layoutViewer(); viewer.attach(canvas, () => wake(400)); invPanel.open(); invPanel.setNew(fresh); paintInventory(); wake(600); ensureBack();
  if (!config.demoMode) {                                                        // reconcilia com a carteira sem abrir pop-up
    const a = await session.silentAccount();
    if (a && (!inventory.address || inventory.source === 'wallet')) inventory.setAddress(a, 'wallet');
    else if (!a && inventory.source === 'wallet') inventory.setAddress(null);   // a carteira revogou o acesso
  }
  await refreshInventory();
  if (fresh && inventory.balances[fresh - 1] > 0) selectInv(fresh);              // compra nova: mostra o card adquirido em 3D
}
function closeInventory() {
  if (!invOpen) return;
  invOpen = false; viewer.detach(); invPanel.close(); invPanel.setNew(0); invFresh = 0; hud.el.style.display = '';
  if (modes.mode === 'pay') modes.back();                                        // veio da compra: volta à seleção de cards
  if (modes.mode === 'walk' && invPrevEnabled) controls.setEnabled(true);
  wake(800);
}

// ---------- modos ----------
let pendingWalk = false;
modes.onChange((mode) => {
  wake(3000); aimed = null; hud.setMode(mode); hud.setStatus('');
  if (mode === 'walk') {
    stopWatcher(); highlight.setVisible(false); spot.setOn(false); controls.setEnabled(false); pendingWalk = true;
    rig.flyTo(walkPose(), 600); drawScreen({ state: 'idle' });
  } else if (mode === 'select') {
    refreshMachine(); stopWatcher(); busy = false; controls.setEnabled(false); highlight.setVisible(true); spot.setOn(true);
    rig.flyTo(selectPose(selection.id), 650); refresh();
  } else if (mode === 'pay') {
    spot.setOn(false); rig.flyTo(payPose(), 550); startPayment();
  }
});
hud.setMode('walk');
refresh(); refreshAvailability();
const refreshMachine = () => { refreshAvailability(); refreshInfos(); };
window.addEventListener('focus', refreshMachine); document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshMachine(); });

function tryConfirm() {
  if (paused) return hud.setStatus('Máquina indisponível no momento (contrato pausado).', { error: true });
  const info = infos[selection.id - 1];
  if (info.stock <= 0 || !info.active) return hud.setStatus('Card esgotado.', { error: true });
  hud.setStatus(''); modes.confirm();
}
let aimed = null;                                    // objeto interativo sob a mira (andando)
const tryUse = () => {
  if (modes.mode !== 'walk' || !controls.enabled) return;
  if (aimed === 'machine') modes.interact(); else if (aimed === 'faucet') openFaucet();
};

hud.onInventory(() => (invOpen ? closeInventory() : openInventory()));
hud.onUse(tryUse); hud.onConfirm(tryConfirm); hud.onBack(() => modes.back());
hud.onJoystick((x, y) => { wake(); controls.setJoystick(x, y); });

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;                               // digitando um endereço
  if (invOpen) {                                                                  // inventário aberto: I/Esc fecham, setas trocam de card
    if (e.code === 'KeyI' || e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); closeInventory(); return; }
    const own = inventory.balances.map((n, i) => (n > 0 ? i + 1 : 0)).filter(Boolean), at = own.indexOf(invSel);
    if (own.length && (e.code === 'ArrowRight' || e.code === 'ArrowDown')) { e.preventDefault(); selectInv(own[(at + 1) % own.length]); }
    else if (own.length && (e.code === 'ArrowLeft' || e.code === 'ArrowUp')) { e.preventDefault(); selectInv(own[(at - 1 + own.length) % own.length]); }
    else if (e.code === 'KeyR') viewer.reset();
    return;
  }
  if (e.code === 'KeyI' && !e.repeat) { e.preventDefault(); openInventory(); return; }
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

const parallax = { x: 0, y: 0, yaw: 0, pitch: 0 };
canvas.addEventListener('pointermove', (e) => {
  if (invOpen) return;
  if (e.pointerType === 'mouse') { parallax.x = (e.clientX / innerWidth) * 2 - 1; parallax.y = (e.clientY / innerHeight) * 2 - 1; }
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
  if (invOpen) return;
  if (rig.active || controls.moved > 8) return;
  if (modes.mode === 'walk') return;                              // andando, o clique não faz nada (o cartaz abre só por E / botão do celular)
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
  camera.aspect = w / h; camera.fov = w / h < 0.8 ? 80 : 65; camera.updateProjectionMatrix(); resize(w, h); if (invOpen) layoutViewer();
}
window.addEventListener('resize', onResize); window.addEventListener('orientationchange', onResize); onResize();

let last = performance.now(), lastDraw = 0;
const minFrameMs = 1000 / (tier.maxFps || 60);
let loopRuns = 0;
function loop(t) {
  rafId = 0; loopRuns++;
  if (document.hidden) {                                                         // aba escondida: não desenha; só reverifica 1x/s enquanto havia trabalho pendente
    lastDraw = 0; if (loading || t < activeUntil) setTimeout(schedule, 1000);
    return;
  }
  const flying = rig.update(t);
  if (flying) wake();
  if (pendingWalk && !flying) { pendingWalk = false; controls.setEnabled(true); }
  if (controls.isActive()) wake();
  if (!loading && !needsFrame && t >= activeUntil) { lastDraw = 0; return; }     // ocioso: não gasta GPU, bateria nem acorda a CPU
  needsFrame = false;
  schedule();
  if (lastDraw && t - lastDraw < minFrameMs - 2) return;                         // limite de FPS do nível (30 fps no baixo)
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (modes.mode === 'select' && !flying) {                                      // profundidade: a câmera acompanha de leve o mouse
    parallax.yaw = approachNum(parallax.yaw, -parallax.x * 0.05, 8, dt); parallax.pitch = approachNum(parallax.pitch, -parallax.y * 0.035, 8, dt);
    controls.setLook(parallax.yaw, parallax.pitch);
    if (Math.abs(parallax.yaw + parallax.x * 0.05) > 5e-4 || Math.abs(parallax.pitch + parallax.y * 0.035) > 5e-4) wake(400);
  }
  if (invOpen && viewer.update(dt)) wake(300);
  if (spot.update(dt)) wake(400);
  controls.update(dt);
  if (modes.mode === 'walk' && controls.enabled) {                               // prompt "E" quando perto e olhando
    const { yaw, pitch } = controls.pose();
    const now = pickInteractable(camera.position, yaw, pitch, INTERACTABLES);
    if (now !== aimed) { aimed = now; hud.showPrompt(now); }
  }
  invOpen ? render(viewer.scene, viewer.camera) : render(scene, camera);
  if (lastDraw) adaptive.sample(t - lastDraw);
  lastDraw = t;
}
schedule();
