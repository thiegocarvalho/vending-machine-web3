import { describe, it, expect, vi } from 'vitest';
import { walletStatus, createWalletSession } from './session.js';

const ADDR = '0xa78276259faC49aF008Be85D855e0Cb0F1aD9433';
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const cfg = { chainId: 11155111, chainName: 'Sepolia' };

describe('walletStatus', () => {
  const base = { hasWallet: true, wantedChain: 11155111 };
  it('cobre todos os estados', () => {
    expect(walletStatus({ demo: true })).toBe('demo');
    expect(walletStatus({ hasWallet: false })).toBe('nowallet');
    expect(walletStatus({ ...base })).toBe('disconnected');
    expect(walletStatus({ ...base, connecting: true })).toBe('connecting');
    expect(walletStatus({ ...base, address: ADDR, source: 'wallet', chainId: 11155111 })).toBe('connected');
    expect(walletStatus({ ...base, address: ADDR, source: 'wallet', chainId: 1 })).toBe('wrongnet');
    expect(walletStatus({ ...base, address: ADDR, source: 'manual' })).toBe('readonly');
    expect(walletStatus({ hasWallet: false, address: ADDR, source: 'wallet' })).toBe('readonly');   // endereço lembrado, sem extensão
  });
  it('conectar tem prioridade sobre tudo (feedback imediato)', () => {
    expect(walletStatus({ ...base, address: ADDR, source: 'wallet', chainId: 1, connecting: true })).toBe('connecting');
  });
});

describe('createWalletSession', () => {
  const fakeWin = (extra = {}) => { const handlers = {}; return { handlers, ethereum: { request: vi.fn(async ({ method }) => {
    if (extra[method]) return extra[method]();
    if (method === 'eth_accounts') return [ADDR]; if (method === 'eth_requestAccounts') return [ADDR]; if (method === 'eth_chainId') return '0xaa36a7'; return null;
  }), on: (e, f) => { handlers[e] = f; }, removeListener: vi.fn() } }; };

  it('lê a conta sem pop-up, e conecta pedindo permissão', async () => {
    const win = fakeWin(), s = createWalletSession({ win, cfg, storage: mem() });
    expect(await s.silentAccount()).toBe(ADDR);
    expect(await s.connect()).toBe(ADDR);
    expect(await s.chainId()).toBe(11155111);
  });
  it('desconectar lembra a escolha: não reconecta sozinho até conectar de novo', async () => {
    const st = mem(), win = fakeWin(), s = createWalletSession({ win, cfg, storage: st });
    await s.disconnect();
    expect(win.ethereum.request).toHaveBeenCalledWith({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
    expect(s.dismissed).toBe(true); expect(await s.silentAccount()).toBeNull();
    await s.connect(); expect(s.dismissed).toBe(false); expect(await s.silentAccount()).toBe(ADDR);
  });
  it('desconectar funciona mesmo se a carteira não suporta revogar permissões', async () => {
    const s = createWalletSession({ win: fakeWin({ wallet_revokePermissions: () => { throw new Error('unsupported'); } }), cfg, storage: mem() });
    await expect(s.disconnect()).resolves.toBeUndefined(); expect(s.dismissed).toBe(true);
  });
  it('troca de rede usa wallet_switchEthereumChain e cai para add quando a rede é desconhecida (4902)', async () => {
    const win = fakeWin({ eth_chainId: () => '0x1', wallet_switchEthereumChain: () => { throw Object.assign(new Error('x'), { code: 4902 }); } });
    await createWalletSession({ win, cfg, storage: mem() }).switchNetwork();
    const methods = win.ethereum.request.mock.calls.map((c) => c[0].method);
    expect(methods).toContain('wallet_addEthereumChain');
  });
  it('repassa eventos de conta e de rede e permite cancelar', () => {
    const win = fakeWin(), cb = vi.fn(), off = createWalletSession({ win, cfg, storage: mem() }).onChange(cb);
    win.handlers.accountsChanged([ADDR]); win.handlers.chainChanged('0x1');
    expect(cb).toHaveBeenNthCalledWith(1, { type: 'accounts', accounts: [ADDR] }); expect(cb).toHaveBeenNthCalledWith(2, { type: 'chain' });
    off(); expect(win.ethereum.removeListener).toHaveBeenCalledTimes(2);
  });
  it('sem extensão: tudo degrada em silêncio', async () => {
    const s = createWalletSession({ win: {}, cfg, storage: mem() });
    expect(s.available).toBe(false); expect(await s.silentAccount()).toBeNull(); expect(await s.chainId()).toBeNull(); expect(s.onChange(() => {})()).toBeUndefined();
  });
});
