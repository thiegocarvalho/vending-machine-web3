import { describe, it, expect } from 'vitest';
import { config } from './config.js';

describe('config', () => {
  it('uses the configured chain (default Sepolia) and an 11 m wall', () => {
    expect(config.chainId).toBe(Number(import.meta.env.VITE_CHAIN_ID) || 11155111);
    expect(config.wallRadius).toBe(11);
  });
  it('gateways end with a slash and start with Pinata or ipfs.io', () => {
    expect(config.gateways.every(g => g.endsWith('/'))).toBe(true);
    expect(config.gateways[0]).toMatch(/pinata|ipfs\.io/);
  });
});
