import { describe, it, expect, vi } from 'vitest';
import { encodeFunctionData, decodeFunctionResult, encodeFunctionResult, parseAbi, toFunctionSelector, toEventSelector, formatEther as viemFormatEther } from 'viem';
import { SELECTORS, TOPIC_CARD_PURCHASED, encodeBuyCard, encodeUri, encodeBalanceOfBatch, decodeUintArray, decodeBool, decodeCardsInfo, decodeString, formatEther, pad32 } from './rpc.js';

const ABI = parseAbi([
  'function uri(uint256 cardId) view returns (string)',
  'function getAllCardsInfo() view returns (uint256[] prices, uint256[] stocks, bool[] activeStatuses)',
  'function buyCard(uint256 cardId) payable',
  'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
  'function paused() view returns (bool)'
]);

// O RPC enxuto substitui a biblioteca viem no navegador; estes testes provam que gera/decodifica exatamente o mesmo ABI.
describe('rpc ABI (equivalência com viem)', () => {
  it('selectors e tópico do evento batem com a assinatura do contrato', () => {
    expect(SELECTORS.getAllCardsInfo).toBe(toFunctionSelector('getAllCardsInfo()'));
    expect(SELECTORS.uri).toBe(toFunctionSelector('uri(uint256)'));
    expect(SELECTORS.buyCard).toBe(toFunctionSelector('buyCard(uint256)'));
    expect(TOPIC_CARD_PURCHASED).toBe(toEventSelector('CardPurchased(address,uint256,uint256,uint256,uint256)'));
  });
  it('encodeBuyCard / encodeUri iguais ao viem', () => {
    for (const id of [1, 7, 30, 255, 65535]) {
      expect(encodeBuyCard(id)).toBe(encodeFunctionData({ abi: ABI, functionName: 'buyCard', args: [BigInt(id)] }));
      expect(encodeUri(id)).toBe(encodeFunctionData({ abi: ABI, functionName: 'uri', args: [BigInt(id)] }));
    }
  });
  it('balanceOfBatch: selector, codificação e decodificação iguais ao viem', () => {
    expect(SELECTORS.balanceOfBatch).toBe(toFunctionSelector('balanceOfBatch(address[],uint256[])'));
    const addr = '0xa78276259faC49aF008Be85D855e0Cb0F1aD9433', ids = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(encodeBalanceOfBatch(addr, ids)).toBe(encodeFunctionData({ abi: ABI, functionName: 'balanceOfBatch', args: [ids.map(() => addr), ids.map(BigInt)] }));
    const vals = ids.map((i) => BigInt(i % 4));
    expect(decodeUintArray(encodeFunctionResult({ abi: ABI, functionName: 'balanceOfBatch', result: vals }))).toEqual(vals);
  });
  it('paused(): selector e decodificação do bool iguais ao viem', () => {
    expect(SELECTORS.paused).toBe(toFunctionSelector('paused()'));
    for (const v of [true, false]) expect(decodeBool(encodeFunctionResult({ abi: ABI, functionName: 'paused', result: v }))).toBe(v);
  });
  it('decodeCardsInfo lê o retorno de getAllCardsInfo', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100000000000000n + BigInt(i)), stocks = Array.from({ length: 30 }, (_, i) => BigInt(100 - i));
    const active = Array.from({ length: 30 }, (_, i) => i % 7 !== 0);
    const hex = encodeFunctionResult({ abi: ABI, functionName: 'getAllCardsInfo', result: [prices, stocks, active] });
    expect(decodeCardsInfo(hex)).toEqual({ prices, stocks, active });
  });
  it('decodeString lê strings (inclusive UTF-8)', () => {
    for (const str of ['ipfs://bafy.../{id}.json', 'Pirâmide Bem No Comecinho ✓', '']) {
      const hex = encodeFunctionResult({ abi: ABI, functionName: 'uri', result: str });
      expect(decodeString(hex)).toBe(str);
    }
  });
  it('formatEther igual ao viem', () => {
    for (const wei of [0n, 1n, 100000000000000n, 1000000000000000000n, 1234500000000000000n, 999999999999999999999n]) {
      expect(formatEther(wei)).toBe(viemFormatEther(wei));
    }
  });
  it('pad32 completa a 32 bytes', () => {
    expect(pad32('0xAbC0000000000000000000000000000000000001')).toBe('0x000000000000000000000000abc0000000000000000000000000000000000001');
  });
});

import { TOPICS, CONTRACT_ERRORS, explainError, encodeSafeTransferFrom, encodeGetMintedCount, rpcBatch, loadMintedCounts, watchContractEvents } from './rpc.js';
import { toFunctionSelector as fsel, toEventSelector as esel } from 'viem';

describe('rpc: transferência, eventos, lote e erros do contrato', () => {
  it('selectors e tópicos conferem com as assinaturas do contrato', () => {
    expect(SELECTORS.getMintedCount).toBe(fsel('getMintedCount(uint256)'));
    expect(SELECTORS.safeTransferFrom).toBe(fsel('safeTransferFrom(address,address,uint256,uint256,bytes)'));
    expect(TOPICS.cardSoldOut).toBe(esel('CardSoldOut(uint256)'));
    expect(TOPICS.cardStatusUpdated).toBe(esel('CardStatusUpdated(uint256,bool)'));
    expect(TOPICS.cardAdded).toBe(esel('CardAdded(uint256,uint256,uint256)'));
    expect(TOPICS.paused).toBe(esel('Paused(address)')); expect(TOPICS.unpaused).toBe(esel('Unpaused(address)'));
  });
  it('safeTransferFrom e getMintedCount codificam iguais ao viem', () => {
    const abi = parseAbi(['function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)', 'function getMintedCount(uint256 cardId) view returns (uint256)']);
    const a = '0xa78276259faC49aF008Be85D855e0Cb0F1aD9433', b = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    expect(encodeSafeTransferFrom(a, b, 7, 3)).toBe(encodeFunctionData({ abi, functionName: 'safeTransferFrom', args: [a, b, 7n, 3n, '0x'] }));
    expect(encodeGetMintedCount(12)).toBe(encodeFunctionData({ abi, functionName: 'getMintedCount', args: [12n] }));
  });
  it('todo erro do contrato tem seletor correto e mensagem em português', () => {
    const sigs = { IncorrectPayment: 'IncorrectPayment(uint256,uint256)', CardIsSoldOut: 'CardIsSoldOut(uint256)', InsufficientStock: 'InsufficientStock(uint256,uint256,uint256)', CardNotActive: 'CardNotActive(uint256)', InvalidCardId: 'InvalidCardId(uint256)', EnforcedPause: 'EnforcedPause()', InvalidAmount: 'InvalidAmount()', ins: 'ERC1155InsufficientBalance(address,uint256,uint256,uint256)', rcv: 'ERC1155InvalidReceiver(address)', snd: 'ERC1155InvalidSender(address)', app: 'ERC1155MissingApprovalForAll(address,address)' };
    for (const sig of Object.values(sigs)) expect(CONTRACT_ERRORS[fsel(sig)], sig).toBeTruthy();
  });
  it('explainError acha o seletor em qualquer formato de erro de carteira', () => {
    const data = '0x9872da53' + '0'.repeat(63) + '5';
    expect(explainError({ data })).toMatch(/esgotado/i);
    expect(explainError({ data: { originalError: { data } } })).toMatch(/esgotado/i);
    expect(explainError({ message: `execution reverted, data: "${data}"` })).toMatch(/esgotado/i);
    expect(explainError({ data: '0xd93c0665' })).toMatch(/pausada/i);
    expect(explainError({ message: 'user rejected' })).toBeNull();
  });
  it('rpcBatch: um POST, resultados alinhados, erro vira null', async () => {
    const seen = []; const fetchImpl = async (u, o) => { seen.push(JSON.parse(o.body)); return { ok: true, json: async () => [{ id: 2, result: '0x2' }, { id: 1, result: '0x1' }, { id: 3, error: { message: 'x' } }] }; };
    const out = await rpcBatch([{ method: 'a' }, { method: 'b' }, { method: 'c' }], { fetchImpl });
    expect(seen).toHaveLength(1); expect(out).toEqual(['0x1', '0x2', null]);
  });
  it('loadMintedCounts lê o emitido de cada card em lote', async () => {
    vi.stubGlobal('fetch', async (u, o) => ({ ok: true, json: async () => JSON.parse(o.body).map((c) => ({ id: c.id, result: '0x' + (c.id * 2).toString(16).padStart(64, '0') })) }));
    expect(await loadMintedCounts(3, '0xAbC0000000000000000000000000000000000001')).toEqual([2, 4, 6]);
    vi.unstubAllGlobals();
  });
  it('watchContractEvents: só avisa de eventos novos, depois do início', async () => {
    const calls = []; let head = 100; const logsAt = { 103: [{ topics: [TOPICS.cardSoldOut] }] };
    vi.stubGlobal('fetch', async (u, o) => { const b = JSON.parse(o.body); calls.push(b.method); const r = b.method === 'eth_blockNumber' ? '0x' + head.toString(16) : (logsAt[head] ?? []); return { ok: true, json: async () => ({ id: b.id, result: r }) }; });
    vi.useFakeTimers(); const got = []; const w = watchContractEvents([TOPICS.cardSoldOut], (l) => got.push(l), { interval: 1000, address: '0xAbC0000000000000000000000000000000000001' });
    await vi.advanceTimersByTimeAsync(10); expect(got).toHaveLength(0);                  // 1º ciclo só marca o ponto de partida
    head = 103; await vi.advanceTimersByTimeAsync(1100); expect(got).toHaveLength(1);
    head = 103; await vi.advanceTimersByTimeAsync(1100); expect(got).toHaveLength(1);    // sem bloco novo: nada
    w.stop(); vi.useRealTimers(); vi.unstubAllGlobals();
  });
});
