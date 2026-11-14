import { describe, it, expect } from 'vitest';
import { openseaCardUrl, explorerAddressUrl, explorerTxUrl, shortAddress } from './links.js';

const C = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';
describe('links', () => {
  it('OpenSea de testes só na Sepolia, apontando para o card', () => {
    expect(openseaCardUrl({ chainId: 11155111, contractAddress: C }, 7)).toBe(`https://testnets.opensea.io/assets/sepolia/${C}/7`);
    expect(openseaCardUrl({ chainId: 31337, contractAddress: C }, 7)).toBeNull();           // rede local: sem link
    expect(openseaCardUrl({ chainId: 11155111, contractAddress: '' }, 7)).toBeNull();        // demo: sem contrato
  });
  it('explorer: endereço e transação, e nada quando não há explorer', () => {
    const cfg = { explorer: 'https://sepolia.etherscan.io', contractAddress: C };
    expect(explorerAddressUrl(cfg)).toBe(`https://sepolia.etherscan.io/address/${C}`);
    expect(explorerTxUrl(cfg, '0xabc')).toBe('https://sepolia.etherscan.io/tx/0xabc');
    expect(explorerAddressUrl({ explorer: '', contractAddress: C })).toBeNull(); expect(explorerTxUrl({ explorer: '' }, '0xabc')).toBeNull();
  });
  it('endereço abreviado', () => { expect(shortAddress(C)).toBe('0x5FC8…5707'); expect(shortAddress(null)).toBe(''); });
});
