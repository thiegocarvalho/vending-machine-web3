import './inventory.css';
import { cardIdToSlot } from '../grid.js';

const TOTAL = 30;

// Painel DOM do inventário. A arte 3D do card é desenhada no canvas do jogo (visualizador); aqui ficam lista, saldos e carteira.
export function createInventoryPanel(root, cb) {
  const el = document.createElement('div'); el.id = 'inv';
  el.innerHTML = `
    <div class="inv-panel">
      <header>
        <div class="inv-title"><small>DEFI VENDING MACHINE</small><h2>INVENTÁRIO</h2></div>
        <button class="inv-close" aria-label="Fechar inventário"><span>I</span> FECHAR</button>
      </header>
      <div class="inv-stats">
        <div class="stat"><b class="s-owned">0</b><em>/30</em><small>COLETADOS</small></div>
        <div class="stat"><b class="s-total">0</b><small>CARDS NO TOTAL</small></div>
        <div class="bar"><i></i></div>
      </div>
      <div class="inv-wallet" data-state="disconnected">
        <div class="w-head"><span class="dot"></span><div class="w-info"><b class="w-label"></b><span class="w-addr"></span></div><button class="w-copy" title="Copiar endereço">COPIAR</button></div>
        <p class="w-note"></p>
        <div class="w-actions"><button class="w-primary"></button><button class="w-secondary"></button></div>
        <div class="w-paste"><input class="paste" placeholder="ou cole um endereço 0x…" spellcheck="false" autocomplete="off" /><button class="use">Ver</button></div>
      </div>
      <div class="inv-grid"></div>
    </div>
    <div class="inv-detail">
      <div class="fresh" hidden>ADQUIRIDO AGORA</div><div class="owned"></div><div class="slot"></div><h3></h3><p class="bal"></p>
      <span class="loading">carregando arte completa…</span>
    </div>`;
  root.appendChild(el);
  const q = (s) => el.querySelector(s);
  const grid = q('.inv-grid'), cells = [];
  for (let id = 1; id <= TOTAL; id++) {
    const b = document.createElement('div'); b.className = 'inv-cell locked'; b.dataset.id = id; b.title = cardIdToSlot(id).label; b.setAttribute('role', 'button'); b.tabIndex = 0;   // div (não button): a proporção 3:4 por padding só funciona fora de <button>
    const c = document.createElement('canvas'); c.width = 90; c.height = 120; b.appendChild(c);
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = cardIdToSlot(id).label; b.appendChild(lbl);
    const qty = document.createElement('span'); qty.className = 'qty'; qty.hidden = true; b.appendChild(qty);
    b.onclick = () => { if (!b.classList.contains('locked')) cb.onSelect(id); };
    b.onkeydown = (e) => { if (e.key === 'Enter' && !b.classList.contains('locked')) cb.onSelect(id); };
    grid.appendChild(b); cells.push({ b, c, qty });
  }
  q('.inv-close').onclick = () => cb.onClose();
  const use = () => cb.onAddress(q('.paste').value.trim());
  let primary = null, secondary = null;
  q('.w-primary').onclick = () => primary?.(); q('.w-secondary').onclick = () => secondary?.();
  q('.w-copy').onclick = async (e) => {
    const btn = e.currentTarget, addr = btn.dataset.addr; if (!addr) return;
    try { await navigator.clipboard.writeText(addr); btn.textContent = 'COPIADO ✓'; } catch { btn.textContent = 'SELECIONE E COPIE'; }
    setTimeout(() => { btn.textContent = 'COPIAR'; }, 1400);
  };
  q('.use').onclick = use; q('.paste').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') use(); });   // não deixa o jogo capturar as teclas digitadas

  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  return {
    el,
    get isOpen() { return el.classList.contains('open'); },
    open() { el.classList.add('open'); }, close() { el.classList.remove('open'); },
    // saldos: array de 30 números; address: string|null; hasWallet: há extensão no navegador
    setData({ balances, address, hasWallet, demo }) {
      cells.forEach(({ b, qty }, i) => { const n = balances[i] | 0; b.classList.toggle('locked', n <= 0); qty.hidden = n <= 0; qty.textContent = `×${n}`; });
      const owned = balances.filter((n) => n > 0).length, total = balances.reduce((a, n) => a + n, 0);
      q('.s-owned').textContent = owned; q('.s-total').textContent = total; q('.bar i').style.width = `${(owned / TOTAL) * 100}%`;
      grid.querySelector('.inv-empty')?.remove();
      if (!owned) { const e = document.createElement('div'); e.className = 'inv-empty'; e.textContent = 'Nenhum card ainda. Compre um na máquina e ele aparece aqui.'; grid.prepend(e); }
    },
    // status: demo | nowallet | disconnected | connecting | connected | wrongnet | readonly (ver payment/session.js)
    setWallet({ status, address = null, hasWallet = false, chainName = 'Sepolia', error = '' }) {
      const W = q('.inv-wallet'); W.dataset.state = status;
      const T = {
        demo: ['MODO DEMO', 'Saldos guardados neste navegador.'],
        nowallet: ['SEM CARTEIRA NO NAVEGADOR', 'Instale uma carteira (ex.: MetaMask) ou cole um endereço para só consultar.'],
        disconnected: ['CARTEIRA DESCONECTADA', 'Conecte a carteira para ver os seus cards.'],
        connecting: ['CONECTANDO…', 'Confirme na janela da carteira.'],
        connected: ['CARTEIRA CONECTADA', ''],
        wrongnet: ['REDE ERRADA', `Troque para ${chainName} para comprar e ver os saldos certos.`],
        readonly: ['SOMENTE LEITURA', hasWallet ? 'Endereço consultado. Conecte a carteira para comprar.' : 'Endereço consultado, sem carteira conectada.']
      }[status];
      q('.w-label').textContent = T[0]; q('.w-addr').textContent = address ? short(address) : '';
      const note = q('.w-note'); note.textContent = error || T[1]; note.classList.toggle('err', !!error); note.hidden = !(error || T[1]);
      const copy = q('.w-copy'); copy.dataset.addr = address || ''; copy.hidden = !address;
      const set = (btn, label, fn, opts = {}) => { btn.hidden = !label; btn.textContent = label || ''; btn.disabled = !!opts.disabled; btn.classList.toggle('busy', !!opts.busy); return fn; };
      const none = () => {};
      primary = secondary = null;
      if (status === 'disconnected') primary = set(q('.w-primary'), 'Conectar carteira', cb.onConnect);
      else if (status === 'connecting') set(q('.w-primary'), 'Aguardando a carteira…', none, { disabled: true, busy: true });
      else if (status === 'wrongnet') primary = set(q('.w-primary'), `Trocar para ${chainName}`, cb.onSwitch);
      else if (status === 'readonly' && hasWallet) primary = set(q('.w-primary'), 'Conectar carteira', cb.onConnect);
      else set(q('.w-primary'), '', none);
      if (status === 'connected' || status === 'wrongnet') secondary = set(q('.w-secondary'), 'Desconectar', cb.onDisconnect);
      else if (status === 'readonly') secondary = set(q('.w-secondary'), 'Remover', cb.onDisconnect);
      else set(q('.w-secondary'), '', none);
      q('.w-actions').hidden = !(q('.w-primary').textContent || q('.w-secondary').textContent);
      q('.w-paste').hidden = !['nowallet', 'disconnected', 'readonly'].includes(status);
    },
    setSelected(id, meta, balance) {
      cells.forEach(({ b }, i) => b.classList.toggle('sel', i + 1 === id));
      if (!id) { q('.slot').textContent = ''; q('h3').textContent = ''; q('.bal').textContent = ''; q('.owned').textContent = ''; return; }
      q('.slot').textContent = cardIdToSlot(id).label;
      q('h3').textContent = meta ? meta.name.replace(/^Card #\d+:\s*/, '') : `Card #${String(id).padStart(2, '0')}`;
      q('.owned').textContent = `×${balance}`; q('.bal').textContent = `CARD #${String(id).padStart(2, '0')} · EDIÇÃO 001`;
    },
    // desenha a miniatura (canvas já invertido para o WebGL) na célula
    setThumb(id, srcCanvas) {
      const g = cells[id - 1].c.getContext('2d'); g.save(); g.translate(0, 120); g.scale(1, -1);
      try { g.drawImage(srcCanvas, 0, 0, 90, 120); } catch { /* textura ainda não carregada */ } g.restore();
    },
    // destaca o card recém-adquirido (faixa "NOVO" na célula e selo no detalhe); 0 limpa
    setNew(id) {
      cells.forEach(({ b }, i) => b.classList.toggle('new', i + 1 === id));
      q('.fresh').hidden = !id;
    },
    setLoading(on) { q('.loading').classList.toggle('on', !!on); }
  };
}
