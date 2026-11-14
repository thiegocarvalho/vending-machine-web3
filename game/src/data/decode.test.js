import { describe, it, expect, vi } from 'vitest';
import { decodeCardImage } from './decode.js';

const fakeDoc = () => { const calls = []; const g = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); }), set: (t, k, v) => { t[k] = v; return true; } });
  return { calls, doc: { createElement: () => ({ width: 0, height: 0, getContext: () => g }) } }; };

describe('decodeCardImage', () => {
  it('desenha o bitmap no tamanho da textura, invertido, e libera o bitmap', async () => {
    const { calls, doc } = fakeDoc(); const bmp = { close: vi.fn() };
    const c = await decodeCardImage('blob', { texW: 300, texH: 400 }, { createImageBitmap: async () => bmp, document: doc });
    expect([c.width, c.height]).toEqual([300, 400]);
    expect(calls).toContainEqual(['translate', 0, 400]); expect(calls).toContainEqual(['scale', 1, -1]);
    expect(calls).toContainEqual(['drawImage', bmp, 0, 0, 300, 400]);
    expect(bmp.close).toHaveBeenCalled();
  });
  it('cai para <img> quando createImageBitmap rejeita ou não existe', async () => {
    for (const env of [{ createImageBitmap: async () => { throw new Error('opções não suportadas'); } }, { createImageBitmap: null }]) {
      const { calls, doc } = fakeDoc(); const revoke = vi.fn();
      class Img { set src(v) { this._s = v; } async decode() {} }
      const c = await decodeCardImage('blob', { texW: 150, texH: 200 }, { ...env, document: doc, Image: Img, URL: { createObjectURL: () => 'blob:x', revokeObjectURL: revoke } });
      expect([c.width, c.height]).toEqual([150, 200]);
      expect(calls.some((x) => x[0] === 'drawImage' && x[1] instanceof Img)).toBe(true);
      expect(revoke).toHaveBeenCalledWith('blob:x');
    }
  });
});
