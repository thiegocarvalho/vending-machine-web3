import { describe, it, expect } from 'vitest';
import { explorerNftUrl, explorerAddressUrl, explorerTxUrl, shortAddress } from './links.js';

const C = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';
describe('links', () => {
  it('o card é visto na página NFT do explorer (o OpenSea não suporta mais testnets)', () => {
    const cfg = { explorer: 'https://sepolia.etherscan.io', contractAddress: C };
    expect(explorerNftUrl(cfg, 7)).toBe(`https://sepolia.etherscan.io/nft/${C}/7`);
    expect(explorerNftUrl({ ...cfg, explorer: '' }, 7)).toBeNull();                   // rede local: sem explorer, sem link
    expect(explorerNftUrl({ ...cfg, contractAddress: '' }, 7)).toBeNull();            // demo: sem contrato
  });
  it('explorer: endereço e transação, e nada quando não há explorer', () => {
    const cfg = { explorer: 'https://sepolia.etherscan.io', contractAddress: C };
    expect(explorerAddressUrl(cfg)).toBe(`https://sepolia.etherscan.io/address/${C}`);
    expect(explorerTxUrl(cfg, '0xabc')).toBe('https://sepolia.etherscan.io/tx/0xabc');
    expect(explorerAddressUrl({ explorer: '', contractAddress: C })).toBeNull(); expect(explorerTxUrl({ explorer: '' }, '0xabc')).toBeNull();
  });
  it('endereço abreviado', () => { expect(shortAddress(C)).toBe('0x5FC8…5707'); expect(shortAddress(null)).toBe(''); });
});
