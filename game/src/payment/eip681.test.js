import { describe, it, expect } from 'vitest';
import { buildEip681 } from './eip681.js';

describe('buildEip681', () => {
  it('encodes buyCard with plain integer wei', () => {
    const uri = buildEip681('0xAbC0000000000000000000000000000000000001', 11155111, 5, 100000000000000n);
    expect(uri).toBe('ethereum:0xAbC0000000000000000000000000000000000001@11155111/buyCard?uint256=5&value=100000000000000');
    expect(uri).not.toMatch(/e\+/);
  });
});
