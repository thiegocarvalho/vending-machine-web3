import { describe, it, expect, vi } from 'vitest';
import { ipfsToHttp, fetchIpfs, idToHex } from './ipfs.js';

const GW = ['https://a.test/ipfs/', 'https://b.test/ipfs/'];
const ok = (body) => ({ ok: true, status: 200, json: async () => body, blob: async () => body });
const bad = { ok: false, status: 500, json: async () => ({}) };

describe('ipfs', () => {
  it('ipfsToHttp', () => {
    expect(ipfsToHttp('ipfs://abc/1.json', 'https://ipfs.io/ipfs/')).toBe('https://ipfs.io/ipfs/abc/1.json');
    expect(ipfsToHttp('https://x.test/a', 'https://ipfs.io/ipfs/')).toBe('https://x.test/a');
  });
  it('idToHex pads to 64 lowercase hex', () => {
    expect(idToHex(30)).toBe('0'.repeat(62) + '1e');
  });
  it('falls back to the next gateway on failure', async () => {
    const f = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(ok({ name: 'x' }));
    expect(await fetchIpfs('ipfs://abc/1.json', GW, { fetchImpl: f })).toEqual({ name: 'x' });
    expect(f.mock.calls[1][0]).toBe('https://b.test/ipfs/abc/1.json');
  });
  it('rejects when all gateways fail', async () => {
    const f = vi.fn().mockResolvedValue(bad);
    await expect(fetchIpfs('ipfs://abc/1.json', GW, { fetchImpl: f })).rejects.toThrow();
  });
  it('times out a slow gateway and moves on', async () => {
    const slow = (_u, { signal }) => new Promise((_r, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
    const f = vi.fn().mockImplementationOnce(slow).mockResolvedValueOnce(ok({ n: 1 }));
    expect(await fetchIpfs('ipfs://abc/1.json', GW, { fetchImpl: f, timeoutMs: 20 })).toEqual({ n: 1 });
  });
});
