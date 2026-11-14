// Cliente enxuto de JSON-RPC (sem viem): só o que o jogo usa. Os testes provam equivalência com o ABI do viem.
import { config } from '../config.js';

export const SELECTORS = { getAllCardsInfo: '0x53059aa9', uri: '0x0e89341c', buyCard: '0xc70f5eaa' };
export const TOPIC_CARD_PURCHASED = '0xe71c9095b9c0032cc99c9d7741a64561130963cc2bca12e41528b48f5cb3a19d';

const strip = (h) => (h.startsWith('0x') ? h.slice(2) : h);
export const pad32 = (hexOrBig) => '0x' + (typeof hexOrBig === 'bigint' || typeof hexOrBig === 'number'
  ? BigInt(hexOrBig).toString(16) : strip(hexOrBig).toLowerCase()).padStart(64, '0');
const word = (hex, i) => BigInt('0x' + hex.slice(i * 64, i * 64 + 64));

export const encodeBuyCard = (id) => SELECTORS.buyCard + strip(pad32(BigInt(id)));
export const encodeUri = (id) => SELECTORS.uri + strip(pad32(BigInt(id)));

// retorno de getAllCardsInfo(): (uint256[] prices, uint256[] stocks, bool[] active)
export function decodeCardsInfo(result) {
  const h = strip(result);
  const read = (slot) => { const start = Number(word(h, slot)) / 32, n = Number(word(h, start)); return Array.from({ length: n }, (_, i) => word(h, start + 1 + i)); };
  return { prices: read(0), stocks: read(1), active: read(2).map((v) => v !== 0n) };
}

export function decodeString(result) {
  const h = strip(result), start = Number(word(h, 0)) / 32, len = Number(word(h, start));
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = parseInt(h.slice((start + 1) * 64 + i * 2, (start + 1) * 64 + i * 2 + 2), 16);
  return new TextDecoder().decode(bytes);
}

export function formatEther(wei) {
  const v = BigInt(wei), base = 10n ** 18n, int = v / base, frac = (v % base).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${int}.${frac}` : `${int}`;
}

let nextId = 1;
export async function rpc(method, params = [], { url = config.rpcUrl, timeoutMs = 12000, fetchImpl = fetch } = {}) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }) });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'Erro de RPC');
    return json.result;
  } finally { clearTimeout(timer); }
}

export const ethCall = (to, data) => rpc('eth_call', [{ to, data }, 'latest']);

export async function waitForReceipt(hash, { interval = 2000, timeoutMs = 180000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const r = await rpc('eth_getTransactionReceipt', [hash]).catch(() => null);
    if (r) { if (r.status === '0x0') throw new Error('Transação revertida'); return r; }
    if (Date.now() - t0 > timeoutMs) throw new Error('Tempo esgotado aguardando a confirmação');
    await new Promise((res) => setTimeout(res, interval));
  }
}

// Observa CardPurchased do card (opcionalmente de um comprador) por polling; chama o callback uma vez com {hash, buyer}.
export function watchPurchase(cardId, buyer, { interval = 4000 } = {}) {
  let cb = null, stopped = false, timer = null, from = null;
  const topics = [TOPIC_CARD_PURCHASED, buyer ? pad32(buyer) : null, pad32(BigInt(cardId))];
  const tick = async () => {
    if (stopped) return;
    try {
      if (from === null) from = await rpc('eth_blockNumber');
      const logs = await rpc('eth_getLogs', [{ address: config.contractAddress, topics, fromBlock: from, toBlock: 'latest' }]);
      if (logs.length && cb && !stopped) { stopped = true; cb({ hash: logs[0].transactionHash, buyer: '0x' + logs[0].topics[1].slice(26) }); return; }
    } catch { /* tenta de novo no próximo ciclo */ }
    if (!stopped) timer = setTimeout(tick, interval);
  };
  timer = setTimeout(tick, 0);
  return { on(fn) { cb = fn; }, stop() { stopped = true; clearTimeout(timer); } };
}
