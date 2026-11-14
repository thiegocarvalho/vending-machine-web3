import './hud.css';
import { cardIdToSlot } from '../grid.js';
import { formatEther } from '../data/rpc.js';
import { config } from '../config.js';

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const key = (k) => `<span class="key">${k}</span>`;

// HUD enxuto, no estilo de jogos de survival-horror: mira, prompt de interação, e pouca informação por modo.
export function createHud(root) {
  root.innerHTML = '';
  const hud = el(`<div id="hud" class="mode-walk">
    <div class="cross"></div>
    <div class="prompt"><span class="key">E</span><span class="label"><small></small><b></b></span></div>
    <div class="info">
      <div class="slot"></div>
      <div class="detail"><div class="name"></div><div class="meta"><span class="price"></span><span class="stock"></span></div></div>
    </div>
    <div class="status"></div>
    <div class="keys keys-walk">${key('W')}${key('A')}${key('S')}${key('D')} Mover <i></i> ${key('I')} Inventário</div>
    <div class="keys keys-select">${key('I')} Inventário <i></i> ${key('ESC')} Sair</div>
    <div class="keys keys-pay">${key('ESC')} Voltar</div>
    <div class="net-alert" hidden><span></span><button>Tentar de novo</button></div>
    <div class="net">${config.chainName.toUpperCase()}</div>
    <div class="joy"><i></i></div>
    <button class="m-wallet">ABRIR NA CARTEIRA</button><button class="m-inv">INVENTÁRIO</button><button class="m-use">USAR</button><button class="m-ok">CONFIRMAR</button><button class="m-back">VOLTAR</button>
  </div>`);
  root.appendChild(hud);
  const q = (s) => hud.querySelector(s);
  const cbs = { wallet: () => {}, inv: () => {}, use: () => {}, ok: () => {}, back: () => {}, joy: () => {} };

  q('.m-inv').onclick = () => cbs.inv(); q('.m-wallet').onclick = () => cbs.wallet(); q('.m-use').onclick = () => cbs.use(); q('.m-ok').onclick = () => cbs.ok(); q('.m-back').onclick = () => cbs.back();
  q('.prompt').onclick = () => cbs.use();

  // joystick virtual (toque)
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
    onInventory: f => cbs.inv = f, onOpenWallet: f => cbs.wallet = f, onUse: f => cbs.use = f, onConfirm: f => cbs.ok = f, onBack: f => cbs.back = f, onJoystick: f => cbs.joy = f,
    // celular sem extensão de carteira: o botão abre o link ethereum: direto no app da carteira
    setMode(mode) { hud.className = `mode-${mode}`; hud.classList.toggle('no-wallet', !window.ethereum?.request); if (mode !== 'walk') hud.classList.remove('can-use'); },
    // kind: null | 'machine' | 'faucet'
    showPrompt(kind) {
      const on = !!kind && hud.classList.contains('mode-walk');
      hud.classList.toggle('can-use', on);
      if (on) {
        const t = { machine: ['DEFI VENDING MACHINE', 'Usar a máquina'], faucet: ['SEPOLIA FAUCET · GOOGLE', 'Abrir o faucet'] }[kind];
        q('.prompt small').textContent = t[0]; q('.prompt b').textContent = t[1]; q('.m-use').textContent = kind === 'faucet' ? 'FAUCET' : 'USAR';
      }
    },
    // aviso de rede no topo; fn = ação do botão "tentar de novo". setAlert('') esconde.
    setAlert(text, fn) {
      const a = q('.net-alert'); a.hidden = !text; q('.net-alert span').textContent = text || '';
      q('.net-alert button').onclick = () => fn?.();
    },
    showCard(id, meta, info) {
      q('.slot').textContent = cardIdToSlot(id).label;
      q('.name').textContent = meta ? meta.name.replace(/^Card #\d+:\s*/, '') : `Card #${String(id).padStart(2, '0')}`;
      const sold = info && (info.missing || info.stock <= 0 || !info.active);
      q('.price').textContent = info && !info.missing ? `${formatEther(info.price)} ETH` : '';
      q('.stock').textContent = info ? (info.offline ? 'SEM REDE' : info.missing ? 'SEM CARD' : sold ? 'ESGOTADO' : `${info.stock}/${info.max ?? 100}`) : '';
      q('.stock').classList.toggle('sold', !!sold);
    },
    setStatus(text, { error = false, hash } = {}) {
      const s = q('.status'); s.className = 'status' + (error ? ' err' : '') + (text ? ' on' : ''); s.textContent = text;
      if (hash && config.explorer) { const a = document.createElement('a'); a.href = `${config.explorer}/tx/${hash}`; a.target = '_blank'; a.rel = 'noopener'; a.textContent = ' · ver no explorer'; s.appendChild(a); }
    }
  };
}
