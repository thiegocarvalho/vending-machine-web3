// Cliente enxuto de JSON-RPC (sem viem): só o que o jogo usa. Os testes provam equivalência com o ABI do viem.
import { config } from '../config.js';

export const SELECTORS = { getAllCardsInfo: '0x53059aa9', uri: '0x0e89341c', buyCard: '0xc70f5eaa', balanceOfBatch: '0x4e1273f4', paused: '0x5c975abb', getMintedCount: '0x67b8706a', safeTransferFrom: '0xf242432a' };
// Eventos que mudam o que a máquina mostra (estoque, ativo, catálogo, pausa) e por isso disparam releitura.
export const TOPICS = {
  cardSoldOut: '0xd7d4b8301f7e82ef40d73af146b7194adcb1aabd52c388f160b8ba62424b333b',
  cardStatusUpdated: '0x220efe86e608509c7fd4b674d2a6d5d5fcb8fbd78486351dc87e95cbfd82f9e5',
  cardAdded: '0xf4c8d15ea1290ae55aab8115e58d6efc2ad40f3f620609eb3cd14f911b5c69b5',
  paused: '0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258',
  unpaused: '0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa'
};
export const TOPIC_CARD_PURCHASED = '0xe71c9095b9c0032cc99c9d7741a64561130963cc2bca12e41528b48f5cb3a19d';

const strip = (h) => (h.startsWith('0x') ? h.slice(2) : h);
export const pad32 = (hexOrBig) => '0x' + (typeof hexOrBig === 'bigint' || typeof hexOrBig === 'number'
  ? BigInt(hexOrBig).toString(16) : strip(hexOrBig).toLowerCase()).padStart(64, '0');
const word = (hex, i) => BigInt('0x' + hex.slice(i * 64, i * 64 + 64));

export const encodeBuyCard = (id) => SELECTORS.buyCard + strip(pad32(BigInt(id)));
export const encodeGetMintedCount = (id) => SELECTORS.getMintedCount + strip(pad32(BigInt(id)));
export const encodeUri = (id) => SELECTORS.uri + strip(pad32(BigInt(id)));

// safeTransferFrom(from, to, id, amount, bytes data=0x): 5 argumentos; `data` vazio = offset 0xa0 + comprimento 0.
export function encodeSafeTransferFrom(from, to, id, amount) {
  const w = (v) => strip(pad32(v));
  return SELECTORS.safeTransferFrom + w(from) + w(to) + w(BigInt(id)) + w(BigInt(amount)) + w(0xa0) + w(0);
}

// balanceOfBatch(address[] accounts, uint256[] ids): o saldo do mesmo endereço para cada id.
export function encodeBalanceOfBatch(address, ids) {
  const n = ids.length, w = (v) => strip(pad32(v));
  return SELECTORS.balanceOfBatch + w(0x40) + w(0x40 + 32 + 32 * n) + w(n) + ids.map(() => w(address)).join('') + w(n) + ids.map((id) => w(BigInt(id))).join('');
}
export const decodeBool = (result) => word(strip(result), 0) !== 0n;     // retorno bool (ex.: paused())
// retorno uint256[] (ex.: balanceOfBatch)
export function decodeUintArray(result) {
  const h = strip(result), start = Number(word(h, 0)) / 32, n = Number(word(h, start));
  return Array.from({ length: n }, (_, i) => word(h, start + 1 + i));
}

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

// Várias chamadas num único POST (JSON-RPC em lote). Resultado alinhado à entrada; chamada com erro vira null.
export async function rpcBatch(calls, { url = config.rpcUrl, timeoutMs = 15000, fetchImpl = fetch } = {}) {
  if (!calls.length) return [];
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const body = calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, method: c.method, params: c.params ?? [] }));
    const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const json = await res.json();
    const out = new Array(calls.length).fill(null);
    for (const r of Array.isArray(json) ? json : [json]) if (r && !r.error && r.id >= 1) out[r.id - 1] = r.result;
    return out;
  } finally { clearTimeout(timer); }
}

// Unidades já emitidas de cada card 1..total (getMintedCount em lote). Falha de um card -> null.
export async function loadMintedCounts(total, contract = config.contractAddress) {
  const res = await rpcBatch(Array.from({ length: total }, (_, i) => ({ method: 'eth_call', params: [{ to: contract, data: encodeGetMintedCount(i + 1) }, 'latest'] })));
  return res.map((r) => (r ? Number(word(strip(r), 0)) : null));
}

export async function getBalance(address) { return BigInt(await rpc('eth_getBalance', [address, 'latest'])); }

// Observa eventos do contrato por polling e chama cb(logs) quando surgem novos. Só consulta o que veio depois do início.
export function watchContractEvents(topic0List, cb, { interval = 6000, address = config.contractAddress } = {}) {
  let stopped = false, timer = null, next = null;
  const tick = async () => {
    if (stopped) return;
    try {
      const head = BigInt(await rpc('eth_blockNumber'));
      if (next === null) next = head + 1n;
      else if (head >= next) {
        const logs = await rpc('eth_getLogs', [{ address, topics: [topic0List], fromBlock: '0x' + next.toString(16), toBlock: '0x' + head.toString(16) }]);
        next = head + 1n; if (logs.length && !stopped) cb(logs);
      }
    } catch { /* rede instável: tenta no próximo ciclo */ }
    if (!stopped) timer = setTimeout(tick, interval);
  };
  timer = setTimeout(tick, 0);
  return { stop() { stopped = true; clearTimeout(timer); } };
}

// ---------- erros do contrato (custom errors) em português ----------
export const CONTRACT_ERRORS = {
  '0x0d35e921': 'O valor enviado não bate com o preço atual. Atualize a máquina e tente de novo.',
  '0x9872da53': 'Card esgotado.',
  '0xb88528e4': 'Estoque insuficiente para essa compra.',
  '0x73c5d345': 'Este card está desativado no momento.',
  '0x5d197373': 'Esse card não existe na máquina.',
  '0xd93c0665': 'A máquina está pausada: compras e envios estão suspensos.',
  '0x2c5211c6': 'Quantidade inválida.',
  '0x03dee4c5': 'Você não tem cards suficientes para enviar.',
  '0x57f447ce': 'O destinatário não aceita cards (é um contrato sem suporte a ERC-1155).',
  '0x01a83514': 'Remetente inválido.',
  '0xe237d922': 'Envio não autorizado por esta carteira.'
};
// Procura o seletor de erro em qualquer lugar do erro da carteira (data, data.originalError.data, message...).
export function explainError(e) {
  const hay = [e?.data, e?.data?.data, e?.data?.originalError?.data, e?.error?.data, e?.cause?.data, e?.message, e?.shortMessage].filter((x) => typeof x === 'string').join(' ');
  for (const m of hay.matchAll(/0x[0-9a-fA-F]{8,}/g)) { const msg = CONTRACT_ERRORS[m[0].slice(0, 10).toLowerCase()]; if (msg) return msg; }
  return null;
}
