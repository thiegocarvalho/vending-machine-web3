import './hud.css';
import { renderMinimap } from './minimap.js';
import { cardIdToSlot } from '../grid.js';
import { drawQr } from '../payment/machineScreen.js';
import { formatEther } from 'viem';
import { config } from '../config.js';

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

export function createHud(root) {
  root.innerHTML = '';
  const hud = el(`<div id="hud">
    <div class="top"><div class="title">DEFI VENDING MACHINE<small>${config.chainName.toUpperCase()} TESTNET</small></div><button class="wallet">Carteira</button></div>
    <div class="minimap"></div>
    <div class="hint">WASD andar · arrastar olhar · ←↑↓→ escolher card · Enter pagar</div>
    <aside class="panel"><button class="close" aria-label="Fechar">✕</button>
      <div class="slot"></div><h2>Selecione um card</h2><p class="desc">Clique/toque num card da máquina.</p>
      <dl></dl>
      <div class="actions"><button class="qr-btn" disabled>QR Code</button><button class="pay-btn" disabled>Pagar com carteira</button></div>
      <canvas class="qr" width="260" height="260"></canvas>
      <div class="status"></div></aside>
    <div class="joy"><i></i></div>
    <div class="dpad"><button class="u">▲</button><button class="l">◀</button><button class="r">▶</button><button class="d">▼</button></div>
  </div>`);
  root.appendChild(hud);
  const q = (s) => hud.querySelector(s);
  const cbs = { pay: () => {}, qr: () => {}, dpad: () => {}, joy: () => {}, wallet: () => {}, close: () => {} };

  function setMinimap(id) {
    const m = q('.minimap'); m.innerHTML = `<b>${cardIdToSlot(id).label}</b>`;
    renderMinimap(id).flat().forEach(on => m.appendChild(el(`<i class="${on ? 'on' : ''}"></i>`)));
  }
  setMinimap(1);

  q('.pay-btn').onclick = () => cbs.pay();
  q('.qr-btn').onclick = () => cbs.qr();
  q('.wallet').onclick = () => cbs.wallet();
  q('.close').onclick = () => { hud.classList.remove('sheet'); cbs.close(); };
  [['u', 'up'], ['d', 'down'], ['l', 'left'], ['r', 'right']].forEach(([c, d]) => q('.dpad .' + c).onclick = () => cbs.dpad(d));

  // virtual joystick
  const joy = q('.joy'), knob = joy.firstElementChild;
  let pid = null;
  const setJoy = (e) => {
    const r = joy.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    knob.style.transform = `translate(${x * R * 0.6}px,${y * R * 0.6}px)`; cbs.joy(x, y);
  };
  joy.addEventListener('pointerdown', e => { pid = e.pointerId; joy.setPointerCapture(pid); setJoy(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === pid) setJoy(e); });
  const end = (e) => { if (e.pointerId === pid) { pid = null; knob.style.transform = ''; cbs.joy(0, 0); } };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);

  return {
    el: hud,
    onPay: f => cbs.pay = f, onShowQr: f => cbs.qr = f, onDpad: f => cbs.dpad = f, onJoystick: f => cbs.joy = f, onWallet: f => cbs.wallet = f,
    showCard(id, meta, info) {
      setMinimap(id);
      q('.slot').textContent = `SLOT ${cardIdToSlot(id).label} · CARD #${String(id).padStart(2, '0')}`;
      q('h2').textContent = meta ? meta.name.replace(/^Card #\d+:\s*/, '') : `Card #${id}`;
      q('.desc').textContent = meta ? meta.description : 'Carregando metadados…';
      const sold = info && (info.stock <= 0 || !info.active);
      q('dl').innerHTML = info ? `<dt>Preço</dt><dd>${formatEther(info.price)} ETH</dd><dt>Estoque</dt><dd>${sold ? 'SOLD OUT' : info.stock + ' / 100'}</dd><dt>Edição</dt><dd>001</dd>` : '';
      q('.pay-btn').disabled = !info || sold; q('.qr-btn').disabled = !info || sold;
      q('.panel').classList.remove('qr-on'); q('.status').textContent = ''; q('.status').className = 'status';
      hud.classList.add('sheet');
    },
    setWallet(state, addr) {
      const b = q('.wallet');
      b.textContent = { none: 'Sem carteira', disconnected: 'Conectar', connected: addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : 'Conectada', wrongNetwork: 'Rede errada' }[state];
      q('.pay-btn').title = state === 'none' ? 'Instale uma carteira (ex.: MetaMask) ou use o QR Code' : '';
      if (state === 'none') q('.pay-btn').dataset.nowallet = '1'; else delete q('.pay-btn').dataset.nowallet;
    },
    disablePay(v) { q('.pay-btn').disabled = v; },
    showQr(text) {
      const c = q('canvas.qr'); const g = c.getContext('2d'); g.clearRect(0, 0, 260, 260);
      if (text) { drawQr(g, text, 0, 0, 260); q('.panel').classList.add('qr-on'); } else q('.panel').classList.remove('qr-on');
    },
    setStatus(text, { error = false, hash } = {}) {
      const s = q('.status'); s.className = 'status' + (error ? ' err' : ''); s.textContent = text;
      if (hash && config.explorer) { const a = document.createElement('a'); a.href = `${config.explorer}/tx/${hash}`; a.target = '_blank'; a.rel = 'noopener'; a.textContent = ' ver no explorer'; s.appendChild(a); }
    }
  };
}
