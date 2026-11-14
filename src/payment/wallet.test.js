import { describe, it, expect, vi } from 'vitest';
import { hasWallet, payWithWallet } from './wallet.js';

const CFG = { contractAddress: '0xAbC0000000000000000000000000000000000001', chainId: 11155111 };
const fake = (chain, overrides = {}) => ({
  ethereum: { request: vi.fn(async ({ method }) => {
    if (overrides[method]) return overrides[method]();
    if (method === 'eth_requestAccounts') return ['0xBuyer'];
    if (method === 'eth_chainId') return chain;
    if (method === 'eth_sendTransaction') return '0xhash';
    return null;
  }) }
});

describe('wallet', () => {
  it('hasWallet', () => { expect(hasWallet({})).toBe(false); expect(hasWallet(fake('0x1'))).toBe(true); });
  it('switches network before sending when on the wrong chain', async () => {
    const w = fake('0x1');
    const r = await payWithWallet(w, CFG, 5, 100n, 10);
    const methods = w.ethereum.request.mock.calls.map(c => c[0].method);
    expect(methods.indexOf('wallet_switchEthereumChain')).toBeGreaterThan(-1);
    expect(methods.indexOf('wallet_switchEthereumChain')).toBeLessThan(methods.indexOf('eth_sendTransaction'));
    expect(r.hash).toBe('0xhash');
  });
  it('maps rejection (4001) to user_rejected', async () => {
    const w = fake('0xaa36a7', { eth_sendTransaction: () => { throw Object.assign(new Error('no'), { code: 4001 }); } });
    await expect(payWithWallet(w, CFG, 5, 100n, 10)).rejects.toMatchObject({ code: 'user_rejected' });
  });
  it('does not send when sold out', async () => {
    const w = fake('0xaa36a7');
    await expect(payWithWallet(w, CFG, 5, 100n, 0)).rejects.toMatchObject({ code: 'sold_out' });
    expect(w.ethereum.request.mock.calls.some(c => c[0].method === 'eth_sendTransaction')).toBe(false);
  });
  it('no wallet', async () => {
    await expect(payWithWallet({}, CFG, 5, 100n, 10)).rejects.toMatchObject({ code: 'no_wallet' });
  });
});
