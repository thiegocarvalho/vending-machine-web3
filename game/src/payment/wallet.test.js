import { describe, it, expect, vi } from 'vitest';
import { hasWallet, payWithWallet, transferWithWallet } from './wallet.js';
import { SELECTORS } from '../data/rpc.js';

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
  it('mapeia erros do contrato (ex.: esgotado) para mensagem em português', async () => {
    const w = fake('0xaa36a7', { eth_sendTransaction: () => { throw Object.assign(new Error('execution reverted'), { data: '0x9872da53' + '0'.repeat(64) }); } });
    await expect(payWithWallet(w, CFG, 5, 100n, 10)).rejects.toMatchObject({ code: 'contract', message: expect.stringMatching(/esgotado/i) });
  });
  describe('transferWithWallet', () => {
    const A = '0xa78276259faC49aF008Be85D855e0Cb0F1aD9433', B = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    it('troca de rede se preciso e envia safeTransferFrom ao contrato (sem valor)', async () => {
      const w = fake('0x1'); const r = await transferWithWallet(w, CFG, { from: A, to: B, id: 7, amount: 2 });
      const calls = w.ethereum.request.mock.calls.map((c) => c[0]);
      expect(calls.some((c) => c.method === 'wallet_switchEthereumChain')).toBe(true);
      const tx = calls.find((c) => c.method === 'eth_sendTransaction').params[0];
      expect(tx).toMatchObject({ from: A, to: CFG.contractAddress }); expect(tx.value).toBeUndefined();
      expect(tx.data.startsWith(SELECTORS.safeTransferFrom)).toBe(true); expect(r.hash).toBe('0xhash');
    });
    it('recusa na carteira e erro do contrato viram mensagens claras', async () => {
      const rej = fake('0xaa36a7', { eth_sendTransaction: () => { throw Object.assign(new Error('no'), { code: 4001 }); } });
      await expect(transferWithWallet(rej, CFG, { from: A, to: B, id: 7, amount: 1 })).rejects.toMatchObject({ code: 'user_rejected', message: expect.stringMatching(/envio/i) });
      const bad = fake('0xaa36a7', { eth_sendTransaction: () => { throw Object.assign(new Error('x'), { data: '0x57f447ce' + '0'.repeat(64) }); } });
      await expect(transferWithWallet(bad, CFG, { from: A, to: B, id: 7, amount: 1 })).rejects.toMatchObject({ message: expect.stringMatching(/ERC-1155/) });
    });
    it('sem carteira', async () => { await expect(transferWithWallet({}, CFG, { from: A, to: B, id: 7, amount: 1 })).rejects.toMatchObject({ code: 'no_wallet' }); });
  });
});
