import { describe, it, expect } from 'vitest';
import { hasWebGL2 } from './webglCheck.js';

describe('hasWebGL2', () => {
  it('is false when the context cannot be created', () => {
    expect(hasWebGL2({ createElement: () => ({ getContext: () => null }) })).toBe(false);
  });
  it('is false when getContext throws', () => {
    expect(hasWebGL2({ createElement: () => ({ getContext: () => { throw new Error('x'); } }) })).toBe(false);
  });
  it('is true when the context exists', () => {
    expect(hasWebGL2({ createElement: () => ({ getContext: () => ({}) }) })).toBe(true);
  });
});
