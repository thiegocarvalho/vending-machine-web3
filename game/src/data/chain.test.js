import { describe, it, expect } from 'vitest';
import { buildInfos, SLOTS, createUriResolver } from './chain.js';

const raw = (n, over = {}) => ({ prices: Array.from({ length: n }, () => 100000000000000n), stocks: Array.from({ length: n }, () => 100n), active: Array.from({ length: n }, () => true), ...over });

describe('buildInfos', () => {
  it('sempre devolve as 30 posições da máquina', () => {
    expect(buildInfos(raw(30))).toHaveLength(SLOTS); expect(buildInfos(raw(12))).toHaveLength(SLOTS); expect(buildInfos(raw(45))).toHaveLength(SLOTS);
  });
  it('posições sem card no contrato ficam ausentes e indisponíveis', () => {
    const i = buildInfos(raw(12));
    expect(i[11]).toMatchObject({ missing: false, active: true }); expect(i[12]).toMatchObject({ missing: true, active: false, stock: 0, max: 0 });
    expect(i[29].missing).toBe(true);
  });
  it('o estoque máximo vem de estoque + emitidos (card com estoque diferente de 100)', () => {
    const r = raw(3, { stocks: [10n, 0n, 250n] });
    const i = buildInfos(r, [5, 40, 0]);
    expect(i[0]).toMatchObject({ stock: 10, minted: 5, max: 15 }); expect(i[1]).toMatchObject({ stock: 0, minted: 40, max: 40 }); expect(i[2].max).toBe(250);
  });
  it('sem a contagem de emitidos, cai no padrão do contrato (100, ou o estoque se maior)', () => {
    expect(buildInfos(raw(1))[0]).toMatchObject({ minted: null, max: 100 });
    expect(buildInfos(raw(1, { stocks: [300n] }))[0].max).toBe(300);
  });
  it('preserva preço e flag de ativo', () => {
    const i = buildInfos(raw(2, { prices: [1n, 2n], active: [true, false] }));
    expect(i[0].price).toBe(1n); expect(i[1]).toMatchObject({ price: 2n, active: false });
  });
});

describe('createUriResolver', () => {
  it('pergunta o modelo ao contrato uma única vez para os 30 cards e troca o {id}', async () => {
    let calls = 0;
    const resolve = createUriResolver(async () => { calls++; return 'ipfs://bafyCID/{id}.json'; });
    const uris = await Promise.all(Array.from({ length: 30 }, (_, i) => resolve(i + 1)));
    expect(calls).toBe(1);
    expect(uris[0]).toBe('ipfs://bafyCID/0000000000000000000000000000000000000000000000000000000000000001.json');
    expect(uris[29]).toMatch(/\/000000000000000000000000000000000000000000000000000000000000001e\.json$/);
  });
  it('se a pergunta falhar, o próximo pedido tenta de novo (não guarda o erro)', async () => {
    let calls = 0;
    const resolve = createUriResolver(async () => { if (++calls === 1) throw new Error('rede'); return 'ipfs://X/{id}.json'; });
    await expect(resolve(1)).rejects.toThrow('rede');
    await expect(resolve(2)).resolves.toMatch(/^ipfs:\/\/X\//);
    expect(calls).toBe(2);
  });
});
