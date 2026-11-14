import { describe, it, expect } from 'vitest';
import { backUrlFor } from './cards.js';

describe('verso do card', () => {
  it('o verso oficial é collection.png na mesma pasta do IPFS das artes', () => {
    expect(backUrlFor({ image: 'ipfs://bafyIMG/01_A1.png' })).toBe('ipfs://bafyIMG/collection.png');
    expect(backUrlFor({ image: 'https://x.y/ipfs/bafyIMG/30_E6.png' })).toBe('https://x.y/ipfs/bafyIMG/collection.png');
  });
});
