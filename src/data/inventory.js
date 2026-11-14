import { config } from '../config.js';
import { ethCall, encodeBalanceOfBatch, decodeUintArray } from './rpc.js';

const TOTAL = 30, KEY_ADDR = 'dvm.inventory.address', KEY_DEMO = 'dvm.inventory.demo';
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
export const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || '');

// Inventário do jogador: saldo de cada card (ERC-1155 balanceOfBatch). No modo demo (sem contrato) fica guardado no navegador.
export function createInventory({ storage = globalThis.localStorage, call = ethCall, cfg = config } = {}) {
  let address = safe(() => storage.getItem(KEY_ADDR), null);
  if (!isAddress(address)) address = null;
  let balances = new Array(TOTAL).fill(0);
  const demo = () => (cfg.demoMode);
  if (demo()) balances = safe(() => JSON.parse(storage.getItem(KEY_DEMO)) ?? balances, balances);
  const cbs = [];
  const emit = () => cbs.forEach((cb) => cb());

  return {
    get address() { return address; },
    get balances() { return balances.slice(); },
    get needsAddress() { return !demo() && !address; },
    get ownedCount() { return balances.filter((b) => b > 0).length; },
    get total() { return balances.reduce((a, b) => a + b, 0); },
    onChange(cb) { cbs.push(cb); },
    setAddress(a) {
      address = isAddress(a) ? a : null;
      safe(() => (address ? storage.setItem(KEY_ADDR, address) : storage.removeItem(KEY_ADDR)));
      if (!address) balances = new Array(TOTAL).fill(0);
      emit();
    },
    async refresh() {
      if (demo()) { emit(); return balances; }
      if (!address) { balances = new Array(TOTAL).fill(0); emit(); return balances; }
      const ids = Array.from({ length: TOTAL }, (_, i) => i + 1);
      balances = decodeUintArray(await call(cfg.contractAddress, encodeBalanceOfBatch(address, ids))).map(Number);
      emit(); return balances;
    },
    // compra confirmada: atualização otimista (no modo real, o refresh seguinte confirma com a cadeia)
    add(id, n = 1) {
      balances[id - 1] += n;
      if (demo()) safe(() => storage.setItem(KEY_DEMO, JSON.stringify(balances)));
      emit();
    }
  };
}
