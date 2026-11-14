import './inventory.css';
import { cardIdToSlot } from '../grid.js';

const TOTAL = 30;

// Painel DOM do inventário. A arte 3D do card é desenhada no canvas do jogo (visualizador); aqui ficam lista, saldos e carteira.
export function createInventoryPanel(root, cb) {
  const el = document.createElement('div'); el.id = 'inv';
  el.innerHTML = `
    <div class="inv-panel">
      <header><h2>INVENTÁRIO</h2><span class="inv-count"></span><button class="inv-close" aria-label="Fechar">ESC ✕</button></header>
      <div class="inv-wallet"><span class="addr"></span>
        <div class="row"><button class="connect">Conectar carteira</button></div>
        <div class="row"><input class="paste" placeholder="ou cole um endereço 0x…" spellcheck="false" autocomplete="off" /><button class="use">Ver</button></div>
      </div>
      <div class="inv-grid"></div>
    </div>
    <div class="inv-detail"><div class="slot"></div><h3></h3><p class="bal"></p><span class="loading">carregando arte completa…</span>
      <p class="hint">Arraste para girar · roda ou pinça para zoom · duplo clique restaura</p></div>`;
  root.appendChild(el);
  const q = (s) => el.querySelector(s);
  const grid = q('.inv-grid'), cells = [];
  for (let id = 1; id <= TOTAL; id++) {
    const b = document.createElement('button'); b.className = 'inv-cell locked'; b.dataset.id = id; b.title = cardIdToSlot(id).label;
    const c = document.createElement('canvas'); c.width = 90; c.height = 120; b.appendChild(c);
    const qty = document.createElement('span'); qty.className = 'qty'; qty.hidden = true; b.appendChild(qty);
    b.onclick = () => { if (!b.classList.contains('locked')) cb.onSelect(id); };
    grid.appendChild(b); cells.push({ b, c, qty });
  }
  q('.inv-close').onclick = () => cb.onClose();
  q('.connect').onclick = () => cb.onConnect();
  const use = () => cb.onAddress(q('.paste').value.trim());
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
      q('.inv-count').textContent = `${owned}/${TOTAL} COLETADOS · ${total} CARDS`;
      q('.addr').textContent = demo ? 'MODO DEMO · saldos guardados neste navegador' : address ? `Carteira ${short(address)}` : 'Conecte a carteira ou cole um endereço para ver seus cards.';
      q('.inv-wallet').querySelectorAll('.row').forEach((r) => { r.style.display = demo ? 'none' : ''; });
      q('.connect').style.display = !demo && hasWallet ? '' : 'none';
      grid.querySelector('.inv-empty')?.remove();
      if (!owned) { const e = document.createElement('div'); e.className = 'inv-empty'; e.textContent = 'Nenhum card ainda. Compre um na máquina e ele aparece aqui.'; grid.prepend(e); }
    },
    setSelected(id, meta, balance) {
      cells.forEach(({ b }, i) => b.classList.toggle('sel', i + 1 === id));
      if (!id) { q('.slot').textContent = ''; q('h3').textContent = ''; q('.bal').textContent = ''; return; }
      q('.slot').textContent = cardIdToSlot(id).label;
      q('h3').textContent = meta ? meta.name.replace(/^Card #\d+:\s*/, '') : `Card #${String(id).padStart(2, '0')}`;
      q('.bal').textContent = `Você tem ${balance} · card #${String(id).padStart(2, '0')}`;
    },
    // desenha a miniatura (canvas já invertido para o WebGL) na célula
    setThumb(id, srcCanvas) {
      const g = cells[id - 1].c.getContext('2d'); g.save(); g.translate(0, 120); g.scale(1, -1);
      try { g.drawImage(srcCanvas, 0, 0, 90, 120); } catch { /* textura ainda não carregada */ } g.restore();
    },
    setLoading(on) { q('.loading').classList.toggle('on', !!on); }
  };
}
