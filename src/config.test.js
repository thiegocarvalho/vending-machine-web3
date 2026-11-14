import { describe, it, expect } from 'vitest';
import { config } from './config.js';

describe('config', () => {
  it('uses Sepolia and a 7 m wall', () => {
    expect(config.chainId).toBe(11155111);
    expect(config.wallRadius).toBe(7);
  });
  it('gateways end with a slash and start with Pinata or ipfs.io', () => {
    expect(config.gateways.every(g => g.endsWith('/'))).toBe(true);
    expect(config.gateways[0]).toMatch(/pinata|ipfs\.io/);
  });
});
